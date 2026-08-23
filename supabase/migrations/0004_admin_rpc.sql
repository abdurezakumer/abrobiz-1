-- ============================================================================
-- 0004_admin_rpc.sql
-- Atomic payment-approval RPCs. Callable by an authenticated admin (web
-- panel) or by the service role (Telegram webhook edge function, Phase 3),
-- so both approval paths share one source of truth.
-- ============================================================================

create function public.admin_approve_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer set search_path = public
as $$
declare
  v_payment public.payments;
  v_current_end date;
  v_new_start date;
  v_new_end date;
  v_months int;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'Not authorized';
  end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment is null then
    raise exception 'Payment not found';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Payment already reviewed';
  end if;

  update public.payments
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_payment_id
  returning * into v_payment;

  select end_date into v_current_end from public.subscriptions where business_id = v_payment.business_id;

  -- Extend from the current end date if it's still in the future (renewing
  -- early doesn't forfeit remaining days); otherwise start from today.
  v_new_start := case when v_current_end is not null and v_current_end > current_date
                       then v_current_end else current_date end;
  v_months := case when v_payment.billing_cycle = 'year' then 12 else 1 end;
  v_new_end := v_new_start + make_interval(months => v_months);

  update public.subscriptions
  set plan_id = v_payment.plan_id,
      status = 'active',
      start_date = case when v_current_end is not null and v_current_end > current_date
                         then start_date else current_date end,
      end_date = v_new_end,
      updated_at = now()
  where business_id = v_payment.business_id;

  insert into public.notifications (user_id, type, title, body, link)
  select b.owner_id, 'payment_approved', 'Payment approved',
         'Your payment has been approved and your subscription is now active.',
         '/dashboard/billing'
  from public.businesses b where b.id = v_payment.business_id;

  return v_payment;
end;
$$;

create function public.admin_reject_payment(p_payment_id uuid, p_reason text)
returns public.payments
language plpgsql
security definer set search_path = public
as $$
declare
  v_payment public.payments;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'Not authorized';
  end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment is null then
    raise exception 'Payment not found';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Payment already reviewed';
  end if;

  update public.payments
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = p_reason
  where id = p_payment_id
  returning * into v_payment;

  insert into public.notifications (user_id, type, title, body, link)
  select b.owner_id, 'payment_rejected', 'Payment rejected',
         coalesce('Reason: ' || p_reason, 'Your payment proof was rejected. Please review and resubmit.'),
         '/dashboard/billing'
  from public.businesses b where b.id = v_payment.business_id;

  return v_payment;
end;
$$;
