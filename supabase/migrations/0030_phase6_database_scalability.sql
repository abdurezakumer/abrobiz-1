-- ============================================================================
-- 0030_phase6_database_scalability.sql
-- Evidence-backed indexes and bounded maintenance for high-growth workloads.
-- No primary keys, RLS policies, or historical data are changed.
-- ============================================================================

-- Subscription cron filters by status + end_date and updates by id.
create index if not exists subscriptions_status_end_date_idx
  on public.subscriptions (status, end_date);

-- Owner/admin dashboards filter payments by tenant/status and sort by time.
create index if not exists payments_business_created_at_idx
  on public.payments (business_id, created_at desc);
create index if not exists payments_status_created_at_idx
  on public.payments (status, created_at asc);

-- Public reviews filter by tenant + approval state and sort newest first.
create index if not exists reviews_business_approved_created_at_idx
  on public.reviews (business_id, is_approved, created_at desc);

-- Telegram webhook lookups use chat IDs; partial indexes avoid null entries.
create index if not exists business_telegram_links_chat_idx
  on public.business_telegram_links (telegram_chat_id)
  where telegram_chat_id is not null;
create index if not exists admin_telegram_links_chat_idx
  on public.admin_telegram_links (telegram_chat_id)
  where telegram_chat_id is not null;

-- Replay and token maintenance need time-ordered access.
create index if not exists telegram_processed_updates_processed_at_idx
  on public.telegram_processed_updates (processed_at);
create index if not exists email_verification_tokens_expires_at_idx
  on public.email_verification_tokens (expires_at);
create index if not exists password_reset_tokens_expires_at_idx
  on public.password_reset_tokens (expires_at);

-- Global analytics retention is ordered by time, unlike the tenant query index.
create index if not exists page_views_created_at_id_idx
  on public.page_views (created_at, id);

-- Replace unbounded Phase 3 maintenance deletes with bounded batches. The
-- function remains service-role-only and preserves the existing API contract.
create or replace function public.purge_phase3_request_state()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_deleted integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;

  delete from public.request_idempotency
  where ctid in (
    select ctid
    from public.request_idempotency
    where expires_at < now()
    order by expires_at
    limit 5000
  );
  get diagnostics v_deleted = row_count;

  delete from public.rate_limits
  where ctid in (
    select ctid
    from public.rate_limits
    where updated_at < now() - interval '2 days'
    order by updated_at
    limit 5000
  );
  return v_deleted;
end;
$$;

revoke all on function public.purge_phase3_request_state() from public, anon, authenticated;
grant execute on function public.purge_phase3_request_state() to service_role;

-- Keep the legacy maintenance RPC bounded as well. Operators can call it
-- repeatedly until it returns zero rather than creating a large delete.
create or replace function public.purge_rate_limits()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not public.is_admin() and auth.role() <> 'service_role' then
    raise exception 'Not authorized';
  end if;
  delete from public.rate_limits
  where ctid in (
    select ctid
    from public.rate_limits
    where updated_at < now() - interval '2 days'
    order by updated_at
    limit 5000
  );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_rate_limits() from public, anon, authenticated;
grant execute on function public.purge_rate_limits() to service_role;

-- Explicit, operator-selected analytics retention. This never runs
-- automatically and cannot delete more than one bounded batch per call.
create or replace function public.purge_page_views(
  p_before timestamptz,
  p_batch_size integer default 5000
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_deleted integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  if p_before is null or p_batch_size < 1 or p_batch_size > 5000 then
    raise exception 'Invalid page-view cleanup request';
  end if;
  delete from public.page_views
  where ctid in (
    select ctid
    from public.page_views
    where created_at < p_before
    order by created_at, id
    limit p_batch_size
  );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_page_views(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.purge_page_views(timestamptz, integer) to service_role;

-- Expired verification/reset records and old Telegram replay records are
-- bounded maintenance targets. This function is explicit and service-role
-- only so retention is controlled by an operator/job, not by a user request.
create or replace function public.purge_expired_security_state(
  p_before timestamptz,
  p_batch_size integer default 5000
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_deleted integer := 0;
  v_count integer;
  v_batch integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  if p_before is null or p_batch_size < 1 or p_batch_size > 5000 then
    raise exception 'Invalid security-state cleanup request';
  end if;

  v_batch := least(p_batch_size, 5000);

  delete from public.email_verification_tokens
  where ctid in (
    select ctid
    from public.email_verification_tokens
    where expires_at < p_before
    order by expires_at
    limit v_batch
  );
  get diagnostics v_deleted = row_count;

  delete from public.password_reset_tokens
  where ctid in (
    select ctid
    from public.password_reset_tokens
    where expires_at < p_before
    order by expires_at
    limit v_batch
  );
  get diagnostics v_count = row_count;
  v_deleted := v_deleted + v_count;

  delete from public.telegram_processed_updates
  where ctid in (
    select ctid
    from public.telegram_processed_updates
    where processed_at < p_before
    order by processed_at
    limit v_batch
  );
  get diagnostics v_count = row_count;
  v_deleted := v_deleted + v_count;

  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_security_state(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.purge_expired_security_state(timestamptz, integer) to service_role;
