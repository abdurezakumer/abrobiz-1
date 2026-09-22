-- 0060_telegram_proof_metadata_and_history.sql
-- Persist complete payment-proof metadata and keep it linked to payment history.

alter table public.telegram_payment_proofs
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists telegram_payment_proofs_metadata_gin_idx
  on public.telegram_payment_proofs using gin (metadata);

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
  v_method public.payment_methods;
  v_expected numeric;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' then raise exception 'Invalid idempotency key'; end if;
  if p_telegram_proof_id is null then raise exception 'Payment proof is invalid'; end if;

  select * into v_plan from public.plans where id = p_plan_id and is_active and not is_trial;
  v_expected := public.plan_price_for_cycle(p_plan_id, p_billing_cycle);
  if v_plan.id is null or v_expected is null or round(p_amount_etb, 2) <> v_expected then raise exception 'Payment plan details are invalid'; end if;
  select * into v_method from public.payment_methods where id = p_payment_method_id and is_active;
  if v_method.id is null then raise exception 'Payment method is unavailable'; end if;
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

  update public.telegram_payment_proofs
  set payment_id = v_payment.id,
      consumed_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'payment', jsonb_build_object(
          'id', v_payment.id,
          'plan_id', p_plan_id,
          'plan_name', v_plan.name,
          'billing_cycle', p_billing_cycle,
          'amount_etb', p_amount_etb,
          'payment_method_id', p_payment_method_id,
          'method_name', v_method.name,
          'owner_note', coalesce(p_owner_note, ''),
          'status', 'pending',
          'linked_at', now()
        )
      )
  where id = p_telegram_proof_id and payment_id is null;
  if not found then raise exception 'Payment proof is invalid'; end if;

  update public.request_idempotency set result_id = v_payment.id where idempotency_key = p_idempotency_key;
  return v_payment;
end;
$$;

revoke all on function public.submit_telegram_payment_idempotent(text, uuid, uuid, text, numeric, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_telegram_payment_idempotent(text, uuid, uuid, text, numeric, uuid, uuid, text) to service_role;
