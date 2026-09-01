-- ============================================================================
-- 0012_reviews.sql
-- Public reviews — Premium feature #3. New reviews start unapproved so a
-- business can't be hit with spam/abuse the moment this is turned on; only
-- approved reviews are visible to other visitors. Plain RLS (not an RPC
-- like orders) since there's no money/pricing integrity concern here, just
-- an entitlement + moderation gate.
-- ============================================================================

create table public.reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text not null default '',
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index reviews_business_id_idx on public.reviews (business_id, created_at desc);

alter table public.reviews enable row level security;

create policy "reviews_select_approved_or_own" on public.reviews
  for select using (
    is_approved
    or public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "reviews_public_insert" on public.reviews
  for insert with check (
    is_approved = false
    and exists (select 1 from public.businesses b where b.id = business_id and b.is_published and not b.is_blocked)
    and coalesce((public.get_business_entitlements(business_id) ->> 'reviews')::boolean, false)
  );

create policy "reviews_update_own_or_admin" on public.reviews
  for update using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "reviews_delete_own_or_admin" on public.reviews
  for delete using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create function public.notify_owner_of_review()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.businesses where id = new.business_id;
  if v_owner is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_owner, 'new_review', new.customer_name || ' left a ' || new.rating || '-star review',
            left(new.comment, 140), '/dashboard/reviews');
  end if;
  return new;
end;
$$;

create trigger reviews_notify_owner
  after insert on public.reviews
  for each row execute function public.notify_owner_of_review();
