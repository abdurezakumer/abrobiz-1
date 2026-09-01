-- ============================================================================
-- 0028_phase3_abuse_hardening.sql
-- Bounded public writes, idempotency, and database-level input constraints.
-- ============================================================================

-- Public writes are routed through rate-limited Edge Functions. Keeping the
-- tables protected here prevents a caller from bypassing those functions with
-- direct PostgREST requests.
revoke insert on public.contact_messages, public.bookings, public.reviews from anon, authenticated;
revoke execute on function public.submit_order(uuid, text, text, text, text, text, jsonb) from anon, authenticated;
grant execute on function public.submit_order(uuid, text, text, text, text, text, jsonb) to service_role;

create table if not exists public.request_idempotency (
  idempotency_key text primary key,
  operation text not null check (operation in ('order', 'payment')),
  request_hash text not null,
  result_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists request_idempotency_expires_at_idx
  on public.request_idempotency (expires_at);
alter table public.request_idempotency enable row level security;
revoke all on public.request_idempotency from public, anon, authenticated;

create or replace function public.submit_order_idempotent(
  p_idempotency_key text,
  p_business_id uuid,
  p_customer_name text,
  p_phone text,
  p_fulfillment_type text,
  p_address text,
  p_notes text,
  p_items jsonb
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_existing public.request_idempotency;
  v_hash text;
  v_rows integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'Invalid idempotency key';
  end if;

  v_hash := encode(extensions.digest(jsonb_build_object(
    'business_id', p_business_id,
    'customer_name', p_customer_name,
    'phone', p_phone,
    'fulfillment_type', p_fulfillment_type,
    'address', p_address,
    'notes', p_notes,
    'items', p_items
  )::text, 'sha256'), 'hex');

  insert into public.request_idempotency (idempotency_key, operation, request_hash)
  values (p_idempotency_key, 'order', v_hash)
  on conflict (idempotency_key) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select * into v_existing from public.request_idempotency
    where idempotency_key = p_idempotency_key for update;
    if v_existing.expires_at <= now() then
      delete from public.request_idempotency where idempotency_key = p_idempotency_key;
      insert into public.request_idempotency (idempotency_key, operation, request_hash)
      values (p_idempotency_key, 'order', v_hash);
    elsif v_existing.operation <> 'order' or v_existing.request_hash <> v_hash then
      raise exception 'Idempotency key was already used for another request';
    elsif v_existing.result_id is null then
      raise exception 'Request is already being processed';
    else
      select * into v_order from public.orders where id = v_existing.result_id;
      if v_order.id is null then raise exception 'Stored request result is unavailable'; end if;
      return v_order;
    end if;
  end if;

  v_order := public.submit_order(p_business_id, p_customer_name, p_phone, p_fulfillment_type, p_address, p_notes, p_items);
  update public.request_idempotency set result_id = v_order.id where idempotency_key = p_idempotency_key;
  return v_order;
end;
$$;

create or replace function public.submit_payment_idempotent(
  p_idempotency_key text,
  p_business_id uuid,
  p_plan_id uuid,
  p_billing_cycle text,
  p_amount_etb numeric,
  p_payment_method_id uuid,
  p_proof_url text,
  p_owner_note text
)
returns public.payments
language plpgsql
security definer set search_path = public
as $$
declare
  v_payment public.payments;
  v_existing public.request_idempotency;
  v_hash text;
  v_rows integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'Invalid idempotency key';
  end if;

  v_hash := encode(extensions.digest(jsonb_build_object(
    'business_id', p_business_id,
    'plan_id', p_plan_id,
    'billing_cycle', p_billing_cycle,
    'amount_etb', p_amount_etb,
    'payment_method_id', p_payment_method_id,
    'proof_url', p_proof_url,
    'owner_note', p_owner_note
  )::text, 'sha256'), 'hex');

  insert into public.request_idempotency (idempotency_key, operation, request_hash)
  values (p_idempotency_key, 'payment', v_hash)
  on conflict (idempotency_key) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select * into v_existing from public.request_idempotency
    where idempotency_key = p_idempotency_key for update;
    if v_existing.expires_at <= now() then
      delete from public.request_idempotency where idempotency_key = p_idempotency_key;
      insert into public.request_idempotency (idempotency_key, operation, request_hash)
      values (p_idempotency_key, 'payment', v_hash);
    elsif v_existing.operation <> 'payment' or v_existing.request_hash <> v_hash then
      raise exception 'Idempotency key was already used for another request';
    elsif v_existing.result_id is null then
      raise exception 'Request is already being processed';
    else
      select * into v_payment from public.payments where id = v_existing.result_id;
      if v_payment.id is null then raise exception 'Stored request result is unavailable'; end if;
      return v_payment;
    end if;
  end if;

  insert into public.payments (
    business_id, plan_id, billing_cycle, amount_etb, payment_method_id, proof_url, owner_note, status
  ) values (
    p_business_id, p_plan_id, p_billing_cycle, p_amount_etb, p_payment_method_id, p_proof_url, coalesce(p_owner_note, ''), 'pending'
  ) returning * into v_payment;

  update public.request_idempotency set result_id = v_payment.id where idempotency_key = p_idempotency_key;
  return v_payment;
end;
$$;

revoke all on function public.submit_order_idempotent(text, uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.submit_payment_idempotent(text, uuid, uuid, text, numeric, uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_order_idempotent(text, uuid, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.submit_payment_idempotent(text, uuid, uuid, text, numeric, uuid, text, text) to service_role;

create or replace function public.purge_phase3_request_state()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_deleted integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  delete from public.request_idempotency where expires_at < now();
  get diagnostics v_deleted = row_count;
  delete from public.rate_limits where updated_at < now() - interval '2 days';
  return v_deleted;
end;
$$;

revoke all on function public.purge_phase3_request_state() from public, anon, authenticated;
grant execute on function public.purge_phase3_request_state() to service_role;

-- Limit pending payment flooding without invalidating existing historical rows.
create or replace function public.prevent_duplicate_pending_payment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'pending' then
    perform pg_advisory_xact_lock(hashtextextended(new.business_id::text, 90431));
    if exists (select 1 from public.payments where business_id = new.business_id and status = 'pending') then
      raise exception 'A payment is already awaiting review';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_prevent_duplicate_pending on public.payments;
create trigger payments_prevent_duplicate_pending
  before insert on public.payments
  for each row execute function public.prevent_duplicate_pending_payment();

-- Future writes have deliberate bounds even when they originate from a
-- trusted function. Existing rows are not rewritten or deleted.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_phase3_lengths') then
    alter table public.profiles add constraint profiles_phase3_lengths check (length(name) <= 120 and length(phone) <= 40 and length(email) <= 254) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'businesses_phase3_lengths') then
    alter table public.businesses add constraint businesses_phase3_lengths check (
      length(name) between 1 and 120 and length(description) <= 2000 and length(about_content) <= 10000
      and length(email) <= 254 and length(phone) <= 40 and length(address) <= 300 and length(maps_url) <= 500
      and length(slug) <= 63 and coalesce(cardinality(gallery_urls), 0) <= 20 and coalesce(cardinality(languages), 0) between 1 and 5
      and pg_column_size(opening_hours) <= 32768 and pg_column_size(social) <= 32768
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'categories_phase3_limits') then
    alter table public.categories add constraint categories_phase3_limits check (length(name) between 1 and 120 and length(icon) <= 50 and pg_column_size(translations) <= 32768) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_phase3_limits') then
    alter table public.items add constraint items_phase3_limits check ((image_url is null or length(image_url) <= 1000) and pg_column_size(translations) <= 32768) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_messages_phase3_limits') then
    alter table public.contact_messages add constraint contact_messages_phase3_limits check (length(name) between 1 and 120 and length(email) <= 254 and length(phone) <= 40 and length(message) between 1 and 5000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_phase3_limits') then
    alter table public.bookings add constraint bookings_phase3_limits check (length(customer_name) between 1 and 120 and length(phone) <= 40 and coalesce(party_size, 1) between 1 and 50 and length(requested_time) <= 20 and length(notes) <= 2000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reviews_phase3_limits') then
    alter table public.reviews add constraint reviews_phase3_limits check (length(customer_name) between 1 and 120 and length(comment) <= 2000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_phase3_limits') then
    alter table public.payments add constraint payments_phase3_limits check ((proof_url is null or length(proof_url) <= 500) and length(owner_note) <= 2000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'announcements_phase3_limits') then
    alter table public.announcements add constraint announcements_phase3_limits check (length(subject) between 1 and 200 and length(body) between 1 and 10000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'page_views_phase3_limits') then
    alter table public.page_views add constraint page_views_phase3_limits check (length(path) <= 200 and length(referrer) <= 1000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_categories_phase3_limits') then
    alter table public.business_categories add constraint business_categories_phase3_limits check (length(slug) between 1 and 63 and length(label) between 1 and 120 and length(item_label) <= 120 and length(category_label) <= 120 and length(icon) <= 50) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plans_phase3_limits') then
    alter table public.plans add constraint plans_phase3_limits check (length(slug) between 1 and 63 and length(name) between 1 and 120 and price_etb >= 0 and coalesce(trial_days, 0) between 0 and 3650 and pg_column_size(features) <= 32768 and pg_column_size(feature_flags) <= 32768) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payment_methods_phase3_limits') then
    alter table public.payment_methods add constraint payment_methods_phase3_limits check (length(name) between 1 and 120 and length(account_name) <= 200 and length(account_number) <= 200 and length(instructions) <= 2000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'templates_phase3_limits') then
    alter table public.templates add constraint templates_phase3_limits check (length(slug) between 1 and 70 and length(name) between 1 and 120 and length(description) <= 500 and length(repo_url) <= 500 and length(preview_url) <= 1000 and pg_column_size(config) <= 32768) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notifications_phase3_limits') then
    alter table public.notifications add constraint notifications_phase3_limits check (length(title) between 1 and 200 and length(body) <= 2000 and length(link) <= 500) not valid;
  end if;
end;
$$;

-- Only HTTPS external URLs are accepted for business-owned web links.
create or replace function public.validate_business_urls()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_url text;
begin
  foreach v_url in array coalesce(new.gallery_urls, '{}'::text[]) loop
    if v_url !~ '^https://[^[:space:]]+$' then raise exception 'Gallery URLs must use HTTPS'; end if;
  end loop;
  if coalesce(new.logo_url, '') <> '' and new.logo_url !~ '^https://[^[:space:]]+$' then raise exception 'Logo URL must use HTTPS'; end if;
  if coalesce(new.cover_url, '') <> '' and new.cover_url !~ '^https://[^[:space:]]+$' then raise exception 'Cover URL must use HTTPS'; end if;
  if coalesce(new.maps_url, '') <> '' and new.maps_url !~ '^https://[^[:space:]]+$' then raise exception 'Map URL must use HTTPS'; end if;
  if new.social is not null then
    for v_url in select value from jsonb_each_text(new.social) where key ilike '%url' loop
      if v_url <> '' and v_url !~ '^https://[^[:space:]]+$' then raise exception 'Social URLs must use HTTPS'; end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_validate_urls on public.businesses;
create trigger businesses_validate_urls
  before insert or update on public.businesses
  for each row execute function public.validate_business_urls();

create or replace function public.validate_template_urls()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(new.repo_url, '') <> '' and new.repo_url !~ '^https://github[.]com/[^[:space:]]+$' then raise exception 'Template repository URL must use GitHub HTTPS'; end if;
  if coalesce(new.preview_url, '') <> '' and new.preview_url !~ '^https://[^[:space:]]+$' then raise exception 'Template preview URL must use HTTPS'; end if;
  return new;
end;
$$;

drop trigger if exists templates_validate_urls on public.templates;
create trigger templates_validate_urls
  before insert or update on public.templates
  for each row execute function public.validate_template_urls();

create or replace function public.validate_item_url()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(new.image_url, '') <> '' and new.image_url !~ '^https://[^[:space:]]+$' then
    raise exception 'Item image URL must use HTTPS';
  end if;
  return new;
end;
$$;

drop trigger if exists items_validate_url on public.items;
create trigger items_validate_url
  before insert or update on public.items
  for each row execute function public.validate_item_url();

-- Authenticated catalog/business writes also get an account-scoped guard. This
-- protects direct PostgREST writes that do not pass through a browser button.
create or replace function public.enforce_owner_write_rate_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null and auth.role() <> 'service_role' then
    if not public.consume_rate_limit('owner-write:' || auth.uid()::text, 300, 60) then
      raise exception 'Too many changes. Please try again shortly';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists categories_owner_write_rate_limit on public.categories;
create trigger categories_owner_write_rate_limit
  before insert or update on public.categories
  for each row execute function public.enforce_owner_write_rate_limit();

drop trigger if exists items_owner_write_rate_limit on public.items;
create trigger items_owner_write_rate_limit
  before insert or update on public.items
  for each row execute function public.enforce_owner_write_rate_limit();

drop trigger if exists businesses_owner_write_rate_limit on public.businesses;
create trigger businesses_owner_write_rate_limit
  before update on public.businesses
  for each row execute function public.enforce_owner_write_rate_limit();
