-- ============================================================================
-- 0027_phase2_authorization_hardening.sql
-- Explicit tenant-preserving update checks and server-side data integrity.
-- ============================================================================

-- Explicit WITH CHECK clauses prevent an authorized update of an old row from
-- moving that row into another tenant.
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

-- Payment submissions cannot claim arbitrary plan prices, inactive methods,
-- or another tenant's proof path. The trigger also covers service-role
-- submissions from the Telegram integration.
create or replace function public.validate_payment_submission()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_plan public.plans;
  v_method_active boolean;
begin
  if new.proof_url is null or new.proof_url !~ ('^' || new.business_id::text || '/[^/].*') then
    raise exception 'Payment proof path is invalid';
  end if;

  select * into v_plan
  from public.plans
  where id = new.plan_id and is_active and not is_trial;
  if v_plan.id is null
     or new.billing_cycle <> v_plan.billing_interval
     or new.amount_etb <> v_plan.price_etb then
    raise exception 'Payment plan details are invalid';
  end if;

  select is_active into v_method_active
  from public.payment_methods
  where id = new.payment_method_id;
  if coalesce(v_method_active, false) is not true then
    raise exception 'Payment method is unavailable';
  end if;

  if new.status = 'pending'
     and (new.reviewed_by is not null or new.reviewed_at is not null or new.rejection_reason is not null) then
    raise exception 'Pending payment review fields must be empty';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_validate_submission on public.payments;
create trigger payments_validate_submission
  before insert on public.payments
  for each row execute function public.validate_payment_submission();

drop policy if exists "payments_insert_own_pending" on public.payments;
create policy "payments_insert_own_pending" on public.payments
  for insert with check (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and rejection_reason is null
    and proof_url is not null
    and proof_url like business_id::text || '/%'
    and exists (select 1 from public.businesses b where b.id = public.payments.business_id and b.owner_id = auth.uid())
    and exists (
      select 1 from public.plans p
      where p.id = public.payments.plan_id
        and p.is_active and not p.is_trial
        and p.billing_interval = public.payments.billing_cycle
        and p.price_etb = public.payments.amount_etb
    )
    and exists (select 1 from public.payment_methods m where m.id = public.payments.payment_method_id and m.is_active)
  );

-- Owner order updates are status changes only. Customer fields, tenant, and
-- server-calculated total are immutable outside trusted admin/service flows.
create or replace function public.protect_order_integrity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin()
     and (
       new.business_id is distinct from old.business_id
       or new.customer_name is distinct from old.customer_name
       or new.phone is distinct from old.phone
       or new.fulfillment_type is distinct from old.fulfillment_type
       or new.address is distinct from old.address
       or new.notes is distinct from old.notes
       or new.total_etb is distinct from old.total_etb
       or new.created_at is distinct from old.created_at
     ) then
    raise exception 'Order details cannot be changed after submission';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_protect_integrity on public.orders;
create trigger orders_protect_integrity
  before update on public.orders
  for each row execute function public.protect_order_integrity();

-- Keep audit actors truthful. Service-role jobs are allowed to write their
-- own operational records without a user JWT.
create or replace function public.protect_admin_log_actor()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and new.admin_id is distinct from auth.uid() then
    raise exception 'Audit actor is invalid';
  end if;
  return new;
end;
$$;

drop trigger if exists admin_logs_protect_actor on public.admin_logs;
create trigger admin_logs_protect_actor
  before insert on public.admin_logs
  for each row execute function public.protect_admin_log_actor();

-- Server-side upload limits for all application-managed buckets. Public
-- branding assets remain public; payment proofs remain private by policy.
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('logos', 'covers', 'item-images');

update storage.buckets
set file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'payment-proofs';

-- Page views are public by design, but the write path is now rate-limited by
-- the Edge Function above. Only that function's service-role client may call
-- the SECURITY DEFINER RPC directly.
revoke execute on function public.track_page_view(uuid, text, text) from public, anon, authenticated;
grant execute on function public.track_page_view(uuid, text, text) to service_role;

-- Keep the public ordering RPC bounded and validate every client-controlled
-- field before creating rows. Prices still come only from public.items.
create or replace function public.submit_order(
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
  v_item jsonb;
  v_item_row public.items;
  v_total numeric := 0;
  v_qty int;
  v_item_id text;
  v_quantity text;
begin
  if p_customer_name is null or length(trim(p_customer_name)) not between 1 and 120
     or p_phone is null or length(p_phone) > 40
     or length(coalesce(p_address, '')) > 500
     or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'Order details are invalid';
  end if;
  if not exists (select 1 from public.businesses b where b.id = p_business_id and b.is_published and not b.is_blocked) then
    raise exception 'Business not available';
  end if;
  if not coalesce((public.get_business_entitlements(p_business_id) ->> 'ordering')::boolean, false) then
    raise exception 'Ordering is not available for this business';
  end if;
  if p_fulfillment_type not in ('pickup', 'delivery') then
    raise exception 'Invalid fulfillment type';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Order must include between 1 and 50 items';
  end if;

  insert into public.orders (business_id, customer_name, phone, fulfillment_type, address, notes, status, total_etb)
  values (p_business_id, trim(p_customer_name), p_phone, p_fulfillment_type, coalesce(p_address, ''), coalesce(p_notes, ''), 'pending', 0)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_id := v_item ->> 'item_id';
    v_quantity := v_item ->> 'quantity';
    if v_item_id is null or v_item_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Order item is invalid';
    end if;
    if v_quantity is null then
      v_qty := 1;
    else
      if v_quantity !~ '^[0-9]{1,3}$' then raise exception 'Order quantity is invalid'; end if;
      v_qty := v_quantity::int;
      if v_qty < 1 or v_qty > 100 then raise exception 'Order quantity is invalid'; end if;
    end if;

    select * into v_item_row
    from public.items
    where id = v_item_id::uuid and business_id = p_business_id and is_available;
    if v_item_row.id is null then
      raise exception 'One of the items in your order is no longer available';
    end if;

    v_total := v_total + (v_item_row.price * v_qty);
    insert into public.order_items (order_id, item_id, item_name, price_etb, quantity)
    values (v_order.id, v_item_row.id, coalesce(v_item_row.translations -> 'en' ->> 'name', 'Item'), v_item_row.price, v_qty);
  end loop;

  update public.orders set total_etb = v_total where id = v_order.id;
  v_order.total_etb := v_total;
  insert into public.notifications (user_id, type, title, body, link)
  select b.owner_id, 'new_order', 'New order from ' || trim(p_customer_name),
         v_total || ' ETB - ' || jsonb_array_length(p_items) || ' item(s)', '/dashboard/orders'
  from public.businesses b where b.id = p_business_id;
  return v_order;
end;
$$;
