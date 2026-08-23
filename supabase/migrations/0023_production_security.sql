-- ============================================================================
-- 0023_production_security.sql
-- Database-backed rate limiting and final tenant-boundary hardening.
-- ============================================================================

create table if not exists public.rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists rate_limits_updated_at_idx on public.rate_limits (updated_at);
alter table public.rate_limits enable row level security;

-- The function is callable only by trusted Edge Functions and never exposes
-- the rate-limit table to browser clients.
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.rate_limits;
  v_now timestamptz := now();
begin
  if p_key is null or length(trim(p_key)) = 0 or length(p_key) > 200 then
    raise exception 'Invalid rate-limit key';
  end if;
  if p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit configuration';
  end if;

  select * into v_row
  from public.rate_limits
  where bucket_key = p_key
  for update;

  if not found then
    insert into public.rate_limits (bucket_key, window_started_at, request_count, updated_at)
    values (p_key, v_now, 1, v_now);
    return true;
  end if;

  if v_now >= v_row.window_started_at + make_interval(secs => p_window_seconds) then
    update public.rate_limits
    set window_started_at = v_now, request_count = 1, updated_at = v_now
    where bucket_key = p_key;
    return true;
  end if;

  if v_row.request_count >= p_limit then
    update public.rate_limits set updated_at = v_now where bucket_key = p_key;
    return false;
  end if;

  update public.rate_limits
  set request_count = request_count + 1, updated_at = v_now
  where bucket_key = p_key;
  return true;
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- Remove stale buckets without exposing delete access to clients. Run this
-- from a scheduled SQL job once per day in production.
create or replace function public.purge_rate_limits()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not public.is_admin() and auth.role() <> 'service_role' then
    raise exception 'Not authorized';
  end if;
  delete from public.rate_limits where updated_at < now() - interval '2 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.purge_rate_limits() from public;
grant execute on function public.purge_rate_limits() to authenticated, service_role;

-- Public form throttles use a business plus customer-provided contact key.
-- This is intentionally a second layer; Edge Functions additionally limit by
-- source IP for endpoints that are routed through them.
create or replace function public.enforce_public_form_rate_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_identity text;
  v_scope text;
  v_allowed boolean;
begin
  if tg_table_name = 'contact_messages' then
    v_scope := 'contact';
    v_identity := lower(coalesce(nullif(trim(new.email), ''), nullif(trim(new.phone), ''), nullif(trim(new.name), ''), 'anonymous'));
  elsif tg_table_name = 'bookings' then
    v_scope := 'booking';
    v_identity := lower(coalesce(nullif(trim(new.phone), ''), nullif(trim(new.customer_name), ''), 'anonymous'));
  else
    v_scope := 'review';
    v_identity := lower(coalesce(nullif(trim(new.customer_name), ''), 'anonymous'));
  end if;

  v_allowed := public.consume_rate_limit(
    v_scope || ':' || new.business_id::text || ':' || left(v_identity, 120),
    case when v_scope = 'review' then 5 else 10 end,
    900
  );
  if not v_allowed then
    raise exception 'Too many requests. Please try again later';
  end if;
  return new;
end;
$$;

drop trigger if exists contact_messages_rate_limit on public.contact_messages;
create trigger contact_messages_rate_limit
  before insert on public.contact_messages
  for each row execute function public.enforce_public_form_rate_limit();

drop trigger if exists bookings_rate_limit on public.bookings;
create trigger bookings_rate_limit
  before insert on public.bookings
  for each row execute function public.enforce_public_form_rate_limit();

drop trigger if exists reviews_rate_limit on public.reviews;
create trigger reviews_rate_limit
  before insert on public.reviews
  for each row execute function public.enforce_public_form_rate_limit();

-- Prevent tenant identifiers from being moved during owner updates.
drop policy if exists "contact_messages_update_own_or_admin" on public.contact_messages;
create policy "contact_messages_update_own_or_admin" on public.contact_messages
  for update
  using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.contact_messages.business_id and b.owner_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.contact_messages.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "bookings_update_own_or_admin" on public.bookings;
create policy "bookings_update_own_or_admin" on public.bookings
  for update
  using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.bookings.business_id and b.owner_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.bookings.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "orders_update_own_or_admin" on public.orders;
create policy "orders_update_own_or_admin" on public.orders
  for update
  using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.orders.business_id and b.owner_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.orders.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "reviews_update_own_or_admin" on public.reviews;
create policy "reviews_update_own_or_admin" on public.reviews
  for update
  using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.reviews.business_id and b.owner_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.reviews.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "telegram_links_update_own_or_admin" on public.business_telegram_links;
drop policy if exists "business_telegram_links_update_own_or_admin" on public.business_telegram_links;
create policy "telegram_links_update_own_or_admin" on public.business_telegram_links
  for update
  using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.business_telegram_links.business_id and b.owner_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = public.business_telegram_links.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "admin_telegram_links_update" on public.admin_telegram_links;
create policy "admin_telegram_links_update" on public.admin_telegram_links
  for update
  using (admin_id = auth.uid() or public.is_admin())
  with check (admin_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
