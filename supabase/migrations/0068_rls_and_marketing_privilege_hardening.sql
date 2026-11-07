-- Close remaining direct-write and role-check gaps found in the RLS audit.

-- Referral codes, team assignments, attributions, and commission rules are
-- mutated only by audited, permission-checked SECURITY DEFINER workflows.
-- Browser clients need SELECT, not direct DML on these sensitive records.
drop policy if exists marketing_referral_codes_write on public.marketing_referral_codes;
drop policy if exists marketing_team_write on public.marketing_team_memberships;
drop policy if exists marketing_attributions_update_super on public.marketing_attributions;
drop policy if exists marketing_rules_write on public.marketing_commission_rules;

revoke all privileges on table public.marketing_referral_codes,
  public.marketing_team_memberships,
  public.marketing_attributions,
  public.marketing_commission_rules
from public, anon, authenticated;
grant select on table public.marketing_referral_codes,
  public.marketing_team_memberships,
  public.marketing_attributions,
  public.marketing_commission_rules
to authenticated;
grant all privileges on table public.marketing_referral_codes,
  public.marketing_team_memberships,
  public.marketing_attributions,
  public.marketing_commission_rules
to service_role;

-- Approved reviews are public only while the related business is live and
-- unblocked. Owners and explicitly authorized staff retain their scoped view.
drop policy if exists reviews_select_scoped on public.reviews;
create policy reviews_select_scoped on public.reviews
  for select using (
    (
      is_approved
      and exists (
        select 1
        from public.businesses b
        where b.id = reviews.business_id
          and b.is_published
          and not b.is_blocked
      )
    )
    or public.has_admin_permission('reviews.read')
    or public.has_admin_permission('dashboard.read')
    or exists (
      select 1 from public.businesses b
      where b.id = reviews.business_id and b.owner_id = auth.uid()
    )
  );

-- The MFA-aware RLS helpers do not protect SECURITY DEFINER RPCs by
-- themselves. Enforce step-up directly on both marketing-team RPC paths.
create or replace function public.marketing_admin_manage_sales_team(
  p_sales_person_id uuid,
  p_action text
)
returns public.marketing_team_memberships
language plpgsql
security definer set search_path = public
as $$
declare
  v_membership public.marketing_team_memberships;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.has_privileged_mfa() then raise exception 'Administrator MFA is required'; end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and admin_role = 'marketing_admin'
      and marketing_policy_version = '2026-09'
  ) then
    raise exception 'Only an approved Marketing Admin can manage a Sales team';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_sales_person_id and role = 'admin' and admin_role = 'sales_person'
  ) then
    raise exception 'Sales Person not found';
  end if;
  if p_action is null or p_action not in ('add', 'remove') then raise exception 'Invalid team action'; end if;

  if p_action = 'remove' then
    update public.marketing_team_memberships
    set ended_at = now()
    where sales_person_id = p_sales_person_id
      and marketing_admin_id = auth.uid()
      and ended_at is null
    returning * into v_membership;
    if v_membership.id is null then raise exception 'This Sales Person is not on your active team'; end if;
  else
    select * into v_membership
    from public.marketing_team_memberships
    where sales_person_id = p_sales_person_id and ended_at is null
    order by started_at desc
    limit 1;
    if v_membership.id is not null and v_membership.marketing_admin_id <> auth.uid() then
      raise exception 'This Sales Person is assigned to another Marketing Admin';
    end if;
    if v_membership.id is null then
      insert into public.marketing_team_memberships (sales_person_id, marketing_admin_id, created_by)
      values (p_sales_person_id, auth.uid(), auth.uid())
      returning * into v_membership;
    end if;
  end if;

  insert into public.admin_logs (admin_id, action, target_table, target_id, meta)
  values (auth.uid(), 'marketing_team_' || p_action, 'marketing_team_memberships', v_membership.id,
          jsonb_build_object('sales_person_id', p_sales_person_id, 'marketing_admin_id', auth.uid()));
  return v_membership;
end;
$$;

revoke all on function public.marketing_admin_manage_sales_team(uuid, text) from public, anon;
grant execute on function public.marketing_admin_manage_sales_team(uuid, text) to authenticated;

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
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.has_privileged_mfa() then raise exception 'Administrator MFA is required'; end if;
  if not exists (
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
