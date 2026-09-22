-- 0059_marketing_scoped_analytics_and_direct_admin_commission.sql
-- Scope marketing analytics to attributed customers and apply the active
-- commission rule consistently, including direct Marketing Admin referrals.

-- Marketing roles may read only their own attributed customers and the
-- Sales Persons directly managed by their active team memberships.
drop policy if exists profiles_select_self_or_scoped on public.profiles;
create policy profiles_select_self_or_scoped on public.profiles
  for select using (
    id = auth.uid()
    or public.has_admin_permission('users.read')
    or exists (
      select 1
      from public.marketing_attributions ma
      where ma.owner_id = profiles.id
        and (ma.sales_person_id = auth.uid() or ma.marketing_admin_id = auth.uid())
    )
    or exists (
      select 1
      from public.marketing_team_memberships tm
      where tm.ended_at is null
        and (
          (tm.marketing_admin_id = auth.uid() and tm.sales_person_id = profiles.id)
          or (tm.sales_person_id = auth.uid() and tm.marketing_admin_id = profiles.id)
        )
    )
  );

drop policy if exists "businesses_select" on public.businesses;
create policy "businesses_select" on public.businesses
  for select using (
    (is_published and not is_blocked)
    or owner_id = auth.uid()
    or public.has_admin_permission('businesses.read')
    or exists (
      select 1
      from public.marketing_attributions ma
      where ma.owner_id = businesses.owner_id
        and (ma.sales_person_id = auth.uid() or ma.marketing_admin_id = auth.uid())
    )
  );

drop policy if exists "subscriptions_select_own_or_admin" on public.subscriptions;
create policy "subscriptions_select_own_or_admin" on public.subscriptions
  for select using (
    public.has_admin_permission('payments.read')
    or exists (
      select 1 from public.businesses b
      where b.id = subscriptions.business_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.businesses b
      join public.marketing_attributions ma on ma.owner_id = b.owner_id
      where b.id = subscriptions.business_id
        and (ma.sales_person_id = auth.uid() or ma.marketing_admin_id = auth.uid())
    )
  );

drop policy if exists "payments_select_own_or_admin" on public.payments;
create policy "payments_select_own_or_admin" on public.payments
  for select using (
    public.has_admin_permission('payments.read')
    or exists (
      select 1 from public.businesses b
      where b.id = payments.business_id and b.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.businesses b
      join public.marketing_attributions ma on ma.owner_id = b.owner_id
      where b.id = payments.business_id
        and (ma.sales_person_id = auth.uid() or ma.marketing_admin_id = auth.uid())
    )
  );

-- A direct MA referral has no Sales Person intermediary. The Marketing Admin
-- receives the complete partner share defined by the active rule (the Sales
-- Person rate plus the Marketing Admin rate), while AbroBiz retains its share.
create or replace function public.marketing_create_commissions_for_payment(p_payment_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_payment public.payments;
  v_owner_id uuid;
  v_attr public.marketing_attributions;
  v_rule public.marketing_commission_rules;
  v_sales_amount numeric(12, 2) := 0;
  v_admin_amount numeric(12, 2) := 0;
  v_abrobiz_amount numeric(12, 2);
  v_sales_rate numeric(5, 2) := 0;
  v_admin_rate numeric(5, 2) := 0;
  v_abrobiz_rate numeric(5, 2) := 100;
  v_count integer := 0;
  v_direct_admin_referral boolean := false;
begin
  if auth.role() <> 'service_role' and not public.has_admin_permission('payments.review') then
    raise exception 'Not authorized';
  end if;

  select p.* into v_payment
  from public.payments p
  where p.id = p_payment_id and p.status = 'approved';
  if v_payment.id is null then raise exception 'Approved payment not found'; end if;

  select owner_id into v_owner_id from public.businesses where id = v_payment.business_id;

  if exists (
    select 1 from public.marketing_commission_ledger
    where payment_id = p_payment_id and entry_type = 'original'
  ) then
    return 0;
  end if;

  select * into v_attr from public.marketing_attributions where owner_id = v_owner_id;
  select * into v_rule
  from public.marketing_commission_rules
  where is_active and effective_at <= now()
  order by effective_at desc
  limit 1;
  if v_rule.id is null then raise exception 'No active commission rule'; end if;

  v_direct_admin_referral := v_attr.sales_person_id is null
    and v_attr.marketing_admin_id is not null
    and v_attr.referral_code_id is not null
    and exists (
      select 1
      from public.marketing_referral_codes code
      where code.id = v_attr.referral_code_id
        and code.marketing_admin_id = v_attr.marketing_admin_id
    );

  if v_attr.sales_person_id is not null then
    v_sales_rate := v_rule.sales_person_rate;
    v_sales_amount := round(v_payment.amount_etb * v_sales_rate / 100, 2);
  end if;

  if v_attr.marketing_admin_id is not null then
    v_admin_rate := case
      when v_direct_admin_referral then v_rule.sales_person_rate + v_rule.marketing_admin_rate
      else v_rule.marketing_admin_rate
    end;
    v_admin_amount := round(v_payment.amount_etb * v_admin_rate / 100, 2);
  end if;

  v_abrobiz_amount := v_payment.amount_etb - v_sales_amount - v_admin_amount;
  v_abrobiz_rate := case
    when v_payment.amount_etb = 0 then 100
    else round(v_abrobiz_amount * 100 / v_payment.amount_etb, 2)
  end;

  if v_attr.sales_person_id is not null and v_sales_amount > 0 then
    insert into public.marketing_commission_ledger (
      payment_id, owner_id, sales_person_id, marketing_admin_id, commission_rule_id,
      recipient_type, rate, amount_etb, status, note
    ) values (
      p_payment_id, v_owner_id, v_attr.sales_person_id, v_attr.marketing_admin_id,
      v_rule.id, 'sales_person', v_sales_rate, v_sales_amount, 'pending',
      'Generated from the approved full plan payment using the active commission rule.'
    );
    v_count := v_count + 1;
    insert into public.notifications (user_id, type, title, body, link)
    values (v_attr.sales_person_id, 'commission_calculated', 'Commission calculated', 'A customer payment attributed to you has been approved. Open Marketing to view the ledger.', '/admin/marketing');
  end if;

  if v_attr.marketing_admin_id is not null and v_admin_amount > 0 then
    insert into public.marketing_commission_ledger (
      payment_id, owner_id, sales_person_id, marketing_admin_id, commission_rule_id,
      recipient_type, rate, amount_etb, status, note
    ) values (
      p_payment_id, v_owner_id, v_attr.sales_person_id, v_attr.marketing_admin_id,
      v_rule.id, 'marketing_admin', v_admin_rate, v_admin_amount, 'pending',
      case when v_direct_admin_referral
        then 'Generated from a direct Marketing Admin referral using the complete active partner commission share.'
        else 'Generated from the approved full plan payment using the active commission rule.'
      end
    );
    v_count := v_count + 1;
    insert into public.notifications (user_id, type, title, body, link)
    values (v_attr.marketing_admin_id, 'commission_calculated', 'Commission calculated', 'A customer payment attributed to your marketing workflow has been approved. Open Marketing to view the ledger.', '/admin/marketing');
  end if;

  insert into public.marketing_commission_ledger (
    payment_id, owner_id, sales_person_id, marketing_admin_id, commission_rule_id,
    recipient_type, rate, amount_etb, status, note
  ) values (
    p_payment_id, v_owner_id, v_attr.sales_person_id, v_attr.marketing_admin_id,
    v_rule.id, 'abrobiz', v_abrobiz_rate, v_abrobiz_amount, 'recognized',
    'Platform share from the approved full plan payment using the active commission rule.'
  );
  v_count := v_count + 1;
  return v_count;
end;
$$;

revoke all on function public.marketing_create_commissions_for_payment(uuid) from public, anon, authenticated;
grant execute on function public.marketing_create_commissions_for_payment(uuid) to service_role;
