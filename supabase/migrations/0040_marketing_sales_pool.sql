-- 0040_marketing_sales_pool.sql
-- Return a safe Sales Person pool for Marketing Admin team management.

create or replace function public.marketing_admin_list_sales_pool()
returns table (
  id uuid,
  platform_id text,
  name text,
  is_assigned_to_me boolean,
  is_assigned_elsewhere boolean
)
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and profiles.admin_role = 'marketing_admin'
      and profiles.marketing_policy_version = '2026-09'
  ) then
    raise exception 'Only an approved Marketing Admin can view the Sales Person pool';
  end if;

  return query
  select
    p.id,
    p.platform_id,
    coalesce(p.name, 'Unnamed Sales Person'),
    exists (
      select 1 from public.marketing_team_memberships tm
      where tm.sales_person_id = p.id
        and tm.marketing_admin_id = auth.uid()
        and tm.ended_at is null
    ),
    exists (
      select 1 from public.marketing_team_memberships tm
      where tm.sales_person_id = p.id
        and tm.marketing_admin_id <> auth.uid()
        and tm.ended_at is null
    )
  from public.profiles p
  where p.role = 'admin' and p.admin_role = 'sales_person'
  order by p.name nulls last, p.platform_id;
end;
$$;

revoke all on function public.marketing_admin_list_sales_pool() from public, anon;
grant execute on function public.marketing_admin_list_sales_pool() to authenticated;
