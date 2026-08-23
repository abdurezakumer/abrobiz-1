-- ============================================================================
-- 0011_ordering.sql
-- Online ordering — Premium feature #2. Writes go exclusively through
-- submit_order() (security definer, atomic): it re-prices every line from
-- the current items table server-side rather than trusting whatever the
-- client sends, checks entitlement + published status itself, and creates
-- the order + all its items + the owner notification in one transaction.
-- orders/order_items intentionally have NO client-facing insert policy —
-- RLS is enabled with only select/update policies, so the RPC is the only
-- write path.
-- ============================================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_name text not null,
  phone text not null default '',
  fulfillment_type text not null default 'pickup' check (fulfillment_type in ('pickup', 'delivery')),
  address text not null default '',
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  total_etb numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index orders_business_id_idx on public.orders (business_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  item_name text not null,
  price_etb numeric(12, 2) not null,
  quantity int not null default 1 check (quantity > 0)
);

create index order_items_order_id_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "orders_select_own_or_admin" on public.orders
  for select using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "orders_update_own_or_admin" on public.orders
  for update using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "order_items_select_own_or_admin" on public.order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      join public.businesses b on b.id = o.business_id
      where o.id = order_id and b.owner_id = auth.uid()
    )
  );

-- ── submit_order RPC ────────────────────────────────────────────────────

create function public.submit_order(
  p_business_id uuid,
  p_customer_name text,
  p_phone text,
  p_fulfillment_type text,
  p_address text,
  p_notes text,
  p_items jsonb -- [{"item_id": "...", "quantity": 2}, ...]
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
begin
  if not exists (select 1 from public.businesses b where b.id = p_business_id and b.is_published and not b.is_blocked) then
    raise exception 'Business not available';
  end if;

  if not coalesce((public.get_business_entitlements(p_business_id) ->> 'ordering')::boolean, false) then
    raise exception 'Ordering is not available for this business';
  end if;

  if p_fulfillment_type not in ('pickup', 'delivery') then
    raise exception 'Invalid fulfillment type';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must include at least one item';
  end if;

  insert into public.orders (business_id, customer_name, phone, fulfillment_type, address, notes, status, total_etb)
  values (p_business_id, p_customer_name, p_phone, p_fulfillment_type, p_address, p_notes, 'pending', 0)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_item_row
    from public.items
    where id = (v_item ->> 'item_id')::uuid and business_id = p_business_id and is_available;

    if v_item_row.id is null then
      raise exception 'One of the items in your order is no longer available';
    end if;

    v_qty := greatest(coalesce((v_item ->> 'quantity')::int, 1), 1);
    v_total := v_total + (v_item_row.price * v_qty);

    insert into public.order_items (order_id, item_id, item_name, price_etb, quantity)
    values (
      v_order.id,
      v_item_row.id,
      coalesce(v_item_row.translations -> 'en' ->> 'name', 'Item'),
      v_item_row.price,
      v_qty
    );
  end loop;

  update public.orders set total_etb = v_total where id = v_order.id;
  v_order.total_etb := v_total;

  insert into public.notifications (user_id, type, title, body, link)
  select b.owner_id, 'new_order', 'New order from ' || p_customer_name,
         v_total || ' ETB - ' || jsonb_array_length(p_items) || ' item(s)',
         '/dashboard/orders'
  from public.businesses b where b.id = p_business_id;

  return v_order;
end;
$$;

grant execute on function public.submit_order(uuid, text, text, text, text, text, jsonb) to anon, authenticated;
