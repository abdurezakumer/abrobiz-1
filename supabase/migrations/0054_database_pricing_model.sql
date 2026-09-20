-- Database-backed monthly, annual, and time-bounded promotional pricing.
-- Existing price_etb/billing_interval columns remain for backwards
-- compatibility; all new payment validation uses the fields below.

alter table public.plans
  add column if not exists monthly_price_etb numeric(12, 2),
  add column if not exists annual_price_etb numeric(12, 2),
  add column if not exists discount_type text not null default 'none',
  add column if not exists discount_value numeric(12, 2) not null default 0,
  add column if not exists discount_label text not null default '',
  add column if not exists discount_starts_at timestamptz,
  add column if not exists discount_ends_at timestamptz;

alter table public.telegram_pending_actions
  add column if not exists billing_cycle text;

alter table public.telegram_pending_actions
  drop constraint if exists telegram_pending_actions_billing_cycle_check;

alter table public.telegram_pending_actions
  add constraint telegram_pending_actions_billing_cycle_check
  check (billing_cycle is null or billing_cycle in ('month', 'year'));

alter table public.telegram_pending_actions
  drop constraint if exists telegram_pending_actions_state_check;

alter table public.telegram_pending_actions
  add constraint telegram_pending_actions_state_check
  check (state in ('awaiting_plan', 'awaiting_cycle', 'awaiting_method', 'awaiting_proof'));

update public.plans
set monthly_price_etb = case
      when billing_interval = 'month' then price_etb
      else round(price_etb / 12, 2)
    end
where monthly_price_etb is null;

update public.plans
set annual_price_etb = case
      when billing_interval = 'year' then price_etb
      else round(price_etb * 12, 2)
    end
where annual_price_etb is null;

alter table public.plans
  drop constraint if exists plans_discount_type_check,
  drop constraint if exists plans_pricing_values_check,
  drop constraint if exists plans_discount_window_check;

alter table public.plans
  add constraint plans_discount_type_check
    check (discount_type in ('none', 'percent', 'fixed')),
  add constraint plans_pricing_values_check
    check (coalesce(monthly_price_etb, 0) >= 0 and coalesce(annual_price_etb, 0) >= 0 and discount_value >= 0 and (discount_type <> 'percent' or discount_value <= 100)),
  add constraint plans_discount_window_check
    check (discount_ends_at is null or discount_starts_at is null or discount_ends_at > discount_starts_at);

create or replace function public.plan_price_for_cycle(
  p_plan_id uuid,
  p_billing_cycle text,
  p_at timestamptz default now()
)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_plan public.plans;
  v_base numeric;
  v_discount numeric := 0;
  v_event_active boolean;
begin
  if p_billing_cycle not in ('month', 'year') then return null; end if;
  select * into v_plan from public.plans where id = p_plan_id;
  if v_plan.id is null then return null; end if;
  if auth.role() = 'authenticated' and (not v_plan.is_active or v_plan.is_trial) then return null; end if;

  v_base := case
    when p_billing_cycle = 'month' then coalesce(v_plan.monthly_price_etb,
      case when v_plan.billing_interval = 'month' then v_plan.price_etb else round(v_plan.price_etb / 12, 2) end)
    else coalesce(v_plan.annual_price_etb,
      case when v_plan.billing_interval = 'year' then v_plan.price_etb
           else coalesce(v_plan.monthly_price_etb, v_plan.price_etb) * 12 end)
  end;

  v_event_active := v_plan.discount_type <> 'none'
    and v_plan.discount_value > 0
    and (v_plan.discount_starts_at is null or p_at >= v_plan.discount_starts_at)
    and (v_plan.discount_ends_at is null or p_at <= v_plan.discount_ends_at);

  if v_event_active and v_plan.discount_type = 'percent' then
    v_discount := v_base * least(v_plan.discount_value, 100) / 100;
  elsif v_event_active and v_plan.discount_type = 'fixed' then
    v_discount := least(v_plan.discount_value, v_base);
  end if;

  return round(greatest(0, v_base - v_discount), 2);
end;
$$;

revoke all on function public.plan_price_for_cycle(uuid, text, timestamptz) from public;
grant execute on function public.plan_price_for_cycle(uuid, text, timestamptz) to authenticated, service_role;

-- The finance role can manage plan pricing. The UI remains permission-aware,
-- while this policy is the authoritative protection for direct API calls.
create or replace function public.has_admin_permission(p_permission text)
returns boolean
language plpgsql
security definer set search_path = public
stable
as $$
declare v_role text; v_admin_role text;
begin
  select role, admin_role into v_role, v_admin_role from public.profiles where id = auth.uid();
  if v_role = 'super_admin' or v_admin_role = 'super_admin' then return true; end if;
  if v_role <> 'admin' then return false; end if;
  return case v_admin_role
    when 'operations' then p_permission in ('dashboard.read', 'businesses.read', 'businesses.manage', 'payments.read', 'payments.review', 'support.read')
    when 'finance' then p_permission in ('dashboard.read', 'payments.read', 'payments.review', 'plans.manage')
    when 'support' then p_permission in ('dashboard.read', 'users.read', 'support.read', 'notifications.send')
    when 'content' then p_permission in ('dashboard.read', 'templates.manage', 'announcements.send')
    when 'marketing_admin' then p_permission in ('dashboard.read', 'marketing.read', 'marketing.manage', 'marketing.referrals', 'marketing.commissions', 'marketing.reminders')
    when 'sales_person' then p_permission in ('dashboard.read', 'marketing.read', 'marketing.referrals', 'marketing.commissions')
    else false
  end;
end;
$$;

drop policy if exists "plans_admin_insert" on public.plans;
create policy "plans_admin_insert" on public.plans for insert with check (public.has_admin_permission('plans.manage'));
drop policy if exists "plans_admin_update" on public.plans;
create policy "plans_admin_update" on public.plans for update using (public.has_admin_permission('plans.manage')) with check (public.has_admin_permission('plans.manage'));
drop policy if exists "plans_admin_delete" on public.plans;
create policy "plans_admin_delete" on public.plans for delete using (public.has_admin_permission('plans.manage'));
drop policy if exists "plans_select" on public.plans;
create policy "plans_select" on public.plans for select using (is_active or public.has_admin_permission('plans.manage'));

-- Keep the database trigger authoritative for both browser and Telegram
-- submissions, including event pricing at the time the proof is received.
create or replace function public.validate_payment_submission()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_plan public.plans;
  v_method_active boolean;
  v_expected numeric;
begin
  if new.telegram_proof_id is not null then
    if new.proof_url is not null or not exists (
      select 1 from public.telegram_payment_proofs proof
      where proof.id = new.telegram_proof_id and proof.business_id = new.business_id and proof.payment_id is null
    ) then raise exception 'Payment proof is invalid'; end if;
  elsif new.proof_url is null
     or new.proof_url !~* ('^' || new.business_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.(jpg|png|webp|pdf)$')
     or not exists (select 1 from storage.objects o where o.bucket_id = 'payment-proofs' and o.name = new.proof_url) then
    raise exception 'Payment proof path is invalid';
  end if;

  select * into v_plan from public.plans where id = new.plan_id and is_active and not is_trial;
  v_expected := public.plan_price_for_cycle(new.plan_id, new.billing_cycle);
  if v_plan.id is null or v_expected is null or round(new.amount_etb, 2) <> v_expected then
    raise exception 'Payment plan details are invalid';
  end if;

  select is_active into v_method_active from public.payment_methods where id = new.payment_method_id;
  if coalesce(v_method_active, false) is not true then raise exception 'Payment method is unavailable'; end if;
  if new.status = 'pending' and (new.reviewed_by is not null or new.reviewed_at is not null or new.rejection_reason is not null) then
    raise exception 'Pending payment review fields must be empty';
  end if;
  return new;
end;
$$;

-- Direct client insert remains locked down and now uses calculated pricing.
drop policy if exists "payments_insert_own_pending" on public.payments;
create policy "payments_insert_own_pending" on public.payments
for insert with check (
  status = 'pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null
  and proof_url is not null and proof_url like business_id::text || '/%'
  and exists (select 1 from public.businesses b where b.id = public.payments.business_id and b.owner_id = auth.uid())
  and public.plan_price_for_cycle(plan_id, billing_cycle) = amount_etb
  and exists (select 1 from public.plans p where p.id = public.payments.plan_id and p.is_active and not p.is_trial)
  and exists (select 1 from public.payment_methods m where m.id = public.payments.payment_method_id and m.is_active)
);

create or replace function public.submit_telegram_payment_idempotent(
  p_idempotency_key text,
  p_business_id uuid,
  p_plan_id uuid,
  p_billing_cycle text,
  p_amount_etb numeric,
  p_payment_method_id uuid,
  p_telegram_proof_id uuid,
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
  v_plan public.plans;
  v_expected numeric;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' then raise exception 'Invalid idempotency key'; end if;
  if p_telegram_proof_id is null then raise exception 'Payment proof is invalid'; end if;
  select * into v_plan from public.plans where id = p_plan_id and is_active and not is_trial;
  v_expected := public.plan_price_for_cycle(p_plan_id, p_billing_cycle);
  if v_plan.id is null or v_expected is null or round(p_amount_etb, 2) <> v_expected then raise exception 'Payment plan details are invalid'; end if;
  if not exists (select 1 from public.telegram_payment_proofs where id = p_telegram_proof_id and business_id = p_business_id and payment_id is null) then raise exception 'Payment proof is invalid'; end if;

  v_hash := encode(extensions.digest(jsonb_build_object('business_id', p_business_id, 'plan_id', p_plan_id, 'billing_cycle', p_billing_cycle, 'amount_etb', p_amount_etb, 'payment_method_id', p_payment_method_id, 'telegram_proof_id', p_telegram_proof_id, 'owner_note', p_owner_note)::text, 'sha256'), 'hex');
  insert into public.request_idempotency (idempotency_key, operation, request_hash) values (p_idempotency_key, 'payment', v_hash) on conflict (idempotency_key) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    select * into v_existing from public.request_idempotency where idempotency_key = p_idempotency_key for update;
    if v_existing.expires_at <= now() then
      delete from public.request_idempotency where idempotency_key = p_idempotency_key;
      insert into public.request_idempotency (idempotency_key, operation, request_hash) values (p_idempotency_key, 'payment', v_hash);
    elsif v_existing.operation <> 'payment' or v_existing.request_hash <> v_hash then raise exception 'Idempotency key was already used for another request';
    elsif v_existing.result_id is null then raise exception 'Request is already being processed';
    else
      select * into v_payment from public.payments where id = v_existing.result_id;
      if v_payment.id is null then raise exception 'Stored request result is unavailable'; end if;
      return v_payment;
    end if;
  end if;
  insert into public.payments (business_id, plan_id, billing_cycle, amount_etb, payment_method_id, proof_url, telegram_proof_id, owner_note, status)
  values (p_business_id, p_plan_id, p_billing_cycle, p_amount_etb, p_payment_method_id, null, p_telegram_proof_id, coalesce(p_owner_note, ''), 'pending') returning * into v_payment;
  update public.telegram_payment_proofs set payment_id = v_payment.id, consumed_at = now() where id = p_telegram_proof_id and payment_id is null;
  if not found then raise exception 'Payment proof is invalid'; end if;
  update public.request_idempotency set result_id = v_payment.id where idempotency_key = p_idempotency_key;
  return v_payment;
end;
$$;
