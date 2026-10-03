-- 0061_payment_review_audit_snapshot.sql
-- Preserve the reviewer identity with each Telegram proof while keeping
-- payments.reviewed_by and admin_logs as the authoritative audit fields.

create index if not exists payments_reviewed_by_created_idx
  on public.payments (reviewed_by, reviewed_at desc)
  where reviewed_by is not null;

create or replace function public.snapshot_payment_review_audit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_reviewer public.profiles;
begin
  if new.telegram_proof_id is null
     or new.reviewed_by is null
     or new.reviewed_by is not distinct from old.reviewed_by
     and new.reviewed_at is not distinct from old.reviewed_at
     and new.status is not distinct from old.status
     and new.rejection_reason is not distinct from old.rejection_reason then
    return new;
  end if;

  select * into v_reviewer
  from public.profiles
  where id = new.reviewed_by;

  update public.telegram_payment_proofs
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'review', jsonb_build_object(
      'status', new.status,
      'reviewed_at', new.reviewed_at,
      'reviewed_by', jsonb_build_object(
        'id', new.reviewed_by,
        'platform_id', v_reviewer.platform_id,
        'name', v_reviewer.name,
        'email', v_reviewer.email,
        'role', v_reviewer.role,
        'admin_role', v_reviewer.admin_role
      ),
      'rejection_reason', nullif(new.rejection_reason, '')
    )
  )
  where id = new.telegram_proof_id;

  return new;
end;
$$;

revoke all on function public.snapshot_payment_review_audit() from public, anon, authenticated;

drop trigger if exists payments_snapshot_review_audit on public.payments;
create trigger payments_snapshot_review_audit
  after update of status, reviewed_by, reviewed_at, rejection_reason on public.payments
  for each row execute function public.snapshot_payment_review_audit();

