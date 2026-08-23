-- ============================================================================
-- 0005_fix_storage_policies.sql
-- BUGFIX — run this on top of your existing project.
--
-- The write/delete policies on storage.objects for logos/covers/item-images/
-- payment-proofs had a column-shadowing bug: inside the EXISTS subquery over
-- `businesses b`, the unqualified `name` in `storage.foldername(name)`
-- resolved to `businesses.name` (the business's display name) instead of the
-- intended `storage.objects.name` (the uploaded file's path), because
-- `businesses` also happens to have a `name` column. Postgres silently
-- preferred the closer (subquery-local) column instead of erroring, so the
-- ownership check was always false — no one, including the rightful owner,
-- could actually upload. This drops and recreates the five affected
-- policies with the outer table properly qualified.
--
-- This was caught by testing actual RLS enforcement (not just checking that
-- the SQL was valid) against real INSERT attempts as both the legitimate
-- owner and an impostor — both are now verified to behave correctly.
-- ============================================================================

drop policy if exists "public_buckets_owner_write" on storage.objects;
drop policy if exists "public_buckets_owner_update" on storage.objects;
drop policy if exists "public_buckets_owner_delete" on storage.objects;
drop policy if exists "payment_proofs_owner_or_admin_read" on storage.objects;
drop policy if exists "payment_proofs_owner_write" on storage.objects;

create policy "public_buckets_owner_write" on storage.objects
  for insert with check (
    bucket_id in ('logos', 'covers', 'item-images')
    and (
      public.is_admin()
      or exists (
        select 1 from public.businesses b
        where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
      )
    )
  );

create policy "public_buckets_owner_update" on storage.objects
  for update using (
    bucket_id in ('logos', 'covers', 'item-images')
    and (
      public.is_admin()
      or exists (
        select 1 from public.businesses b
        where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
      )
    )
  );

create policy "public_buckets_owner_delete" on storage.objects
  for delete using (
    bucket_id in ('logos', 'covers', 'item-images')
    and (
      public.is_admin()
      or exists (
        select 1 from public.businesses b
        where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
      )
    )
  );

create policy "payment_proofs_owner_or_admin_read" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (
      public.is_admin()
      or exists (
        select 1 from public.businesses b
        where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
      )
    )
  );

create policy "payment_proofs_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
    )
  );
