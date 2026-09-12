-- 0039_marketing_team_management.sql
-- Give Marketing Admins scoped team controls without granting role or
-- cross-team reassignment authority.

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
  if p_action not in ('add', 'remove') then raise exception 'Invalid team action'; end if;

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
