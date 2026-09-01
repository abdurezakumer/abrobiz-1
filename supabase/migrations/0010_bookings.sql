-- ============================================================================
-- 0010_bookings.sql
-- Generic booking request: a table reservation for a restaurant, an
-- appointment for a salon, a room booking for a hotel — same shape works for
-- all of them, same as the catalog's category/item generalization. Premium
-- feature: the insert policy checks get_business_entitlements(), so this is
-- enforced server-side, not just hidden in the UI.
-- ============================================================================

create table public.bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_name text not null,
  phone text not null default '',
  party_size int,
  requested_date date not null,
  requested_time text not null default '',
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);

create index bookings_business_id_idx on public.bookings (business_id, requested_date);

alter table public.bookings enable row level security;

create policy "bookings_public_insert" on public.bookings
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.is_published and not b.is_blocked)
    and coalesce((public.get_business_entitlements(business_id) ->> 'bookings')::boolean, false)
  );

create policy "bookings_select_own_or_admin" on public.bookings
  for select using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "bookings_update_own_or_admin" on public.bookings
  for update using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create function public.notify_owner_of_booking()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_business_name text;
begin
  select owner_id, name into v_owner, v_business_name from public.businesses where id = new.business_id;
  if v_owner is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_owner, 'booking_request',
            'New booking request from ' || new.customer_name,
            new.requested_date || ' ' || coalesce(nullif(new.requested_time, ''), ''),
            '/dashboard/bookings');
  end if;
  return new;
end;
$$;

create trigger bookings_notify_owner
  after insert on public.bookings
  for each row execute function public.notify_owner_of_booking();
