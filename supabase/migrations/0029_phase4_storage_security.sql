-- ============================================================================
-- 0029_phase4_storage_security.sql
-- Force managed uploads through the server-validated Storage Function and
-- tighten object-path authorization without rewriting existing objects.
-- ============================================================================

-- Browser clients may read intended public assets and authorized private proof
-- objects, but all managed writes go through storage-upload. This prevents a
-- caller from bypassing magic-byte validation and upload rate limits with a
-- direct Storage API request.
revoke insert, update, delete on storage.objects from anon, authenticated;

drop policy if exists "public_buckets_owner_write" on storage.objects;
drop policy if exists "public_buckets_owner_update" on storage.objects;
drop policy if exists "public_buckets_owner_delete" on storage.objects;
drop policy if exists "payment_proofs_owner_write" on storage.objects;

-- Keep explicit deny-by-default write policies absent for browser roles. The
-- service-role upload function performs the ownership check and bypasses RLS.

drop policy if exists "payment_proofs_owner_or_admin_read" on storage.objects;
create policy "payment_proofs_owner_or_admin_read" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and array_length(storage.foldername(storage.objects.name), 1) = 1
    and (storage.foldername(storage.objects.name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and storage.filename(storage.objects.name) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
    and (
      public.is_admin()
      or exists (
        select 1 from public.businesses b
        where b.id::text = (storage.foldername(storage.objects.name))[1]
          and b.owner_id = auth.uid()
      )
    )
  );

-- Public assets remain intentionally public, but their object names are
-- restricted to one tenant UUID plus one generated filename. This avoids
-- traversal/separator/control-character paths for future reads and writes.
drop policy if exists "logos_public_read" on storage.objects;
drop policy if exists "covers_public_read" on storage.objects;
drop policy if exists "item_images_public_read" on storage.objects;
create policy "logos_public_read" on storage.objects
  for select using (
    bucket_id = 'logos'
    and array_length(storage.foldername(storage.objects.name), 1) = 1
    and (storage.foldername(storage.objects.name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and storage.filename(storage.objects.name) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
  );

create policy "covers_public_read" on storage.objects
  for select using (
    bucket_id = 'covers'
    and array_length(storage.foldername(storage.objects.name), 1) = 1
    and (storage.foldername(storage.objects.name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and storage.filename(storage.objects.name) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
  );

create policy "item_images_public_read" on storage.objects
  for select using (
    bucket_id = 'item-images'
    and array_length(storage.foldername(storage.objects.name), 1) = 1
    and (storage.foldername(storage.objects.name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and storage.filename(storage.objects.name) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
  );

-- Storage metadata is not exposed to browser roles as a writable database
-- surface. The function uses service-role storage APIs after authorization.
revoke all on table public.request_idempotency from public, anon, authenticated;

-- Keep the database reference coupled to an actual private proof object even
-- if a caller bypasses the normal submit-payment Edge Function and writes
-- through an otherwise-authorized database path.
create or replace function public.validate_payment_submission()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_plan public.plans;
  v_method_active boolean;
begin
  if new.proof_url is null
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
