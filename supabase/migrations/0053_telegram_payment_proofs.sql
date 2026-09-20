-- 0053_telegram_payment_proofs.sql
-- Payment receipts are archived in a private Telegram channel. Supabase
-- Storage remains available for storefront assets and legacy receipts, but
-- new payment submissions use this auditable Telegram proof record.

create table if not exists public.telegram_payment_proofs (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_upload_id uuid not null unique,
  telegram_channel_id text not null,
  telegram_message_id bigint not null,
  telegram_file_id text not null,
  content_type text not null default 'image/jpeg',
  file_size bigint,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint telegram_payment_proofs_channel_id_format check (telegram_channel_id ~ '^-?[0-9]{5,32}$'),
  constraint telegram_payment_proofs_file_id_length check (length(telegram_file_id) between 1 and 512),
  constraint telegram_payment_proofs_content_type check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint telegram_payment_proofs_size check (file_size is null or file_size between 1 and 5242880)
);

alter table public.payments
  add column if not exists telegram_proof_id uuid references public.telegram_payment_proofs(id) on delete set null;

create index if not exists telegram_payment_proofs_business_created_idx
  on public.telegram_payment_proofs (business_id, created_at desc);
create index if not exists telegram_payment_proofs_payment_idx
  on public.telegram_payment_proofs (payment_id)
  where payment_id is not null;
create unique index if not exists telegram_payment_proofs_channel_message_idx
  on public.telegram_payment_proofs (telegram_channel_id, telegram_message_id);
create index if not exists payments_telegram_proof_idx
  on public.payments (telegram_proof_id)
  where telegram_proof_id is not null;

alter table public.telegram_payment_proofs enable row level security;

drop policy if exists telegram_payment_proofs_select_scoped on public.telegram_payment_proofs;
create policy telegram_payment_proofs_select_scoped on public.telegram_payment_proofs
  for select using (
    public.has_admin_permission('payments.read')
    or exists (
      select 1 from public.businesses b
      where b.id = public.telegram_payment_proofs.business_id
        and b.owner_id = auth.uid()
    )
  );

-- All proof writes and payment linkage happen through service-role Edge
-- Functions. There are intentionally no client insert/update/delete policies.

alter table public.telegram_pending_actions
  add column if not exists state text not null default 'awaiting_plan';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'telegram_pending_actions_state_check'
      and conrelid = 'public.telegram_pending_actions'::regclass
  ) then
    alter table public.telegram_pending_actions
      add constraint telegram_pending_actions_state_check
      check (state in ('awaiting_plan', 'awaiting_method', 'awaiting_proof'));
  end if;
end;
$$;

create table if not exists public.telegram_admin_pending_actions (
  telegram_chat_id text primary key,
  payment_id uuid not null references public.payments(id) on delete cascade,
  state text not null default 'awaiting_rejection_reason'
    check (state in ('awaiting_rejection_reason', 'awaiting_custom_reason')),
  updated_at timestamptz not null default now()
);

alter table public.telegram_admin_pending_actions enable row level security;

-- A Telegram proof is a valid alternative to a private Storage path. Legacy
-- Storage-backed rows remain valid so existing payment history is untouched.
create or replace function public.validate_payment_submission()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_plan public.plans;
  v_method_active boolean;
begin
  if new.telegram_proof_id is not null then
    if new.proof_url is not null
       or not exists (
         select 1 from public.telegram_payment_proofs proof
         where proof.id = new.telegram_proof_id
           and proof.business_id = new.business_id
           and proof.payment_id is null
       ) then
      raise exception 'Payment proof is invalid';
    end if;
  elsif new.proof_url is null
     or new.proof_url !~* ('^' || new.business_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.(jpg|png|webp|pdf)$')
     or not exists (
       select 1 from storage.objects o
       where o.bucket_id = 'payment-proofs'
         and o.name = new.proof_url
     ) then
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

-- Service-role only idempotent submission for proofs archived in Telegram.
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
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'Invalid idempotency key';
  end if;
  if p_telegram_proof_id is null then raise exception 'Payment proof is invalid'; end if;

  select * into v_plan from public.plans
  where id = p_plan_id and is_active and not is_trial;
  if v_plan.id is null
     or p_billing_cycle <> v_plan.billing_interval
     or p_amount_etb <> v_plan.price_etb then
    raise exception 'Payment plan details are invalid';
  end if;

  if not exists (
    select 1 from public.telegram_payment_proofs
    where id = p_telegram_proof_id and business_id = p_business_id and payment_id is null
  ) then
    raise exception 'Payment proof is invalid';
  end if;

  v_hash := encode(extensions.digest(jsonb_build_object(
    'business_id', p_business_id,
    'plan_id', p_plan_id,
    'billing_cycle', p_billing_cycle,
    'amount_etb', p_amount_etb,
    'payment_method_id', p_payment_method_id,
    'telegram_proof_id', p_telegram_proof_id,
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
    business_id, plan_id, billing_cycle, amount_etb, payment_method_id,
    proof_url, telegram_proof_id, owner_note, status
  ) values (
    p_business_id, p_plan_id, p_billing_cycle, p_amount_etb, p_payment_method_id,
    null, p_telegram_proof_id, coalesce(p_owner_note, ''), 'pending'
  ) returning * into v_payment;

  update public.telegram_payment_proofs
  set payment_id = v_payment.id, consumed_at = now()
  where id = p_telegram_proof_id and payment_id is null;
  if not found then raise exception 'Payment proof is invalid'; end if;

  update public.request_idempotency set result_id = v_payment.id
  where idempotency_key = p_idempotency_key;
  return v_payment;
end;
$$;

revoke all on function public.submit_telegram_payment_idempotent(text, uuid, uuid, text, numeric, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_telegram_payment_idempotent(text, uuid, uuid, text, numeric, uuid, uuid, text) to service_role;

-- Telegram callbacks are received by a service-role Edge Function, but the
-- linked administrator must still be the actor recorded by the existing
-- approval RPCs and admin audit log. These wrappers are service-role-only and
-- validate the supplied administrator before setting the transaction-local
-- auth subject used by the shared RPCs.
create or replace function public.telegram_admin_approve_payment(
  p_payment_id uuid,
  p_admin_id uuid
)
returns public.payments
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' or p_admin_id is null then
    raise exception 'Not authorized';
  end if;
  perform set_config('request.jwt.claim.sub', p_admin_id::text, true);
  if not public.has_admin_permission('payments.review') then
    raise exception 'Not authorized';
  end if;
  return public.admin_approve_payment(p_payment_id);
end;
$$;

create or replace function public.telegram_admin_reject_payment(
  p_payment_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns public.payments
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' or p_admin_id is null then
    raise exception 'Not authorized';
  end if;
  perform set_config('request.jwt.claim.sub', p_admin_id::text, true);
  if not public.has_admin_permission('payments.review') then
    raise exception 'Not authorized';
  end if;
  return public.admin_reject_payment(p_payment_id, left(coalesce(p_reason, ''), 1000));
end;
$$;

revoke all on function public.telegram_admin_approve_payment(uuid, uuid) from public, anon, authenticated;
revoke all on function public.telegram_admin_reject_payment(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.telegram_admin_approve_payment(uuid, uuid) to service_role;
grant execute on function public.telegram_admin_reject_payment(uuid, uuid, text) to service_role;
