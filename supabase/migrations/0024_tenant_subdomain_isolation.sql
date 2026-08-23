-- ============================================================================
-- 0024_tenant_subdomain_isolation.sql
-- Make the one-account/one-site rule concurrency-safe and add an explicit
-- owner-scoped lookup for dashboard clients.
-- ============================================================================

-- These indexes are idempotent defenses for databases that were created from
-- an older schema or manually. Existing duplicate data must be resolved before
-- this migration can be applied.
create unique index if not exists businesses_owner_id_unique_idx
  on public.businesses (owner_id);

create unique index if not exists businesses_slug_lower_unique_idx
  on public.businesses (lower(slug));

create or replace function public.lock_business_owner_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Serialize concurrent setup clicks for the same account. The unique
  -- owner index remains the final database guarantee. This trigger preserves
  -- the complete demo-catalog behavior from migration 0020.
  perform pg_advisory_xact_lock(hashtextextended('abrobiz-owner:' || new.owner_id::text, 0));
  return new;
end;
$$;

drop trigger if exists businesses_lock_owner_insert on public.businesses;
create trigger businesses_lock_owner_insert
  before insert on public.businesses
  for each row execute function public.lock_business_owner_insert();

-- The client already scopes getMyBusiness(), but this RPC is useful for future
-- server-side dashboard reads and makes the ownership boundary explicit.
create or replace function public.get_my_business()
returns setof public.businesses
language sql
stable
security definer set search_path = public
as $$
  select b.* from public.businesses b where b.owner_id = auth.uid();
$$;

revoke all on function public.get_my_business() from public;
grant execute on function public.get_my_business() to authenticated;
