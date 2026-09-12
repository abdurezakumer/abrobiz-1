-- 0038_auto_marketing_referral_codes.sql
-- Generate and manage Sales Person referral codes entirely on the server.

create or replace function public.ensure_marketing_referral_code(p_sales_person_id uuid)
returns public.marketing_referral_codes
language plpgsql
security definer set search_path = public
as $$
declare
  v_existing public.marketing_referral_codes;
  v_created public.marketing_referral_codes;
  v_profile public.profiles;
  v_base text;
  v_candidate text;
  v_attempt integer;
begin
  select * into v_profile
  from public.profiles
  where id = p_sales_person_id
    and role = 'admin'
    and admin_role = 'sales_person';
  if v_profile.id is null then raise exception 'Sales Person not found'; end if;

  select * into v_existing
  from public.marketing_referral_codes
  where sales_person_id = p_sales_person_id and is_active
  order by created_at desc
  limit 1;
  if v_existing.id is not null then return v_existing; end if;

  v_base := regexp_replace(upper(coalesce(v_profile.platform_id, 'PARTNER')), '[^A-Z0-9]', '', 'g');
  if length(v_base) < 3 then v_base := 'PARTNER'; end if;
  v_base := left(v_base, 18);

  for v_attempt in 1..20 loop
    v_candidate := left(v_base, 18) || '-' || upper(substr(md5(
      p_sales_person_id::text || clock_timestamp()::text || random()::text || v_attempt::text
    ), 1, 6));
    begin
      insert into public.marketing_referral_codes (sales_person_id, code, label, created_by)
      values (p_sales_person_id, v_candidate, 'System-generated Sales Person referral code', auth.uid())
      returning * into v_created;
      return v_created;
    exception when unique_violation then
      -- A concurrent assignment may have created the active code, or the
      -- random candidate may already exist. Try again without weakening the
      -- database uniqueness constraint.
      select * into v_existing
      from public.marketing_referral_codes
      where sales_person_id = p_sales_person_id and is_active
      order by created_at desc
      limit 1;
      if v_existing.id is not null then return v_existing; end if;
    end;
  end loop;
  raise exception 'Could not generate a unique referral code';
end;
$$;

revoke all on function public.ensure_marketing_referral_code(uuid) from public, anon, authenticated;
grant execute on function public.ensure_marketing_referral_code(uuid) to service_role;

create or replace function public.super_admin_rotate_marketing_referral_code(p_sales_person_id uuid)
returns public.marketing_referral_codes
language plpgsql
security definer set search_path = public
as $$
declare
  v_code public.marketing_referral_codes;
begin
  if not public.is_super_admin() then raise exception 'Super administrators only'; end if;
  if not exists (select 1 from public.profiles where id = p_sales_person_id and role = 'admin' and admin_role = 'sales_person') then
    raise exception 'Sales Person not found';
  end if;
  update public.marketing_referral_codes
  set is_active = false, updated_at = now()
  where sales_person_id = p_sales_person_id and is_active;
  select * into v_code from public.ensure_marketing_referral_code(p_sales_person_id);
  insert into public.admin_logs (admin_id, action, target_table, target_id, meta)
  values (auth.uid(), 'rotate_referral_code', 'marketing_referral_codes', v_code.id,
          jsonb_build_object('sales_person_id', p_sales_person_id));
  return v_code;
end;
$$;

revoke all on function public.super_admin_rotate_marketing_referral_code(uuid) from public;
grant execute on function public.super_admin_rotate_marketing_referral_code(uuid) to authenticated;

-- Prevent the old user-entered-code RPC from bypassing automatic generation.
drop function if exists public.super_admin_create_referral_code(uuid, text, text);

create or replace function public.super_admin_assign_admin_role(
  p_user_id uuid,
  p_admin_role text
)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles;
  v_old_role text;
  v_old_admin_role text;
  v_role text;
begin
  if not public.is_super_admin() then raise exception 'Super administrators only'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'You cannot change your own administrator role'; end if;
  if p_admin_role not in ('none', 'super_admin', 'operations', 'support', 'finance', 'content', 'marketing_admin', 'sales_person') then raise exception 'Invalid administrator role'; end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if v_profile.id is null then raise exception 'User not found'; end if;
  v_old_role := v_profile.role;
  v_old_admin_role := v_profile.admin_role;
  v_role := case when p_admin_role = 'none' then 'owner' when p_admin_role = 'super_admin' then 'super_admin' else 'admin' end;

  update public.profiles
  set role = v_role, admin_role = p_admin_role
  where id = p_user_id
  returning * into v_profile;

  if p_admin_role = 'sales_person' then
    perform public.ensure_marketing_referral_code(p_user_id);
  elsif v_old_admin_role = 'sales_person' then
    update public.marketing_referral_codes
    set is_active = false, updated_at = now()
    where sales_person_id = p_user_id and is_active;
    update public.marketing_team_memberships
    set ended_at = coalesce(ended_at, now())
    where sales_person_id = p_user_id and ended_at is null;
  elsif v_old_admin_role = 'marketing_admin' then
    update public.marketing_team_memberships
    set ended_at = coalesce(ended_at, now())
    where marketing_admin_id = p_user_id and ended_at is null;
  end if;

  insert into public.admin_logs (admin_id, action, target_table, target_id, meta)
  values (auth.uid(), 'assign_admin_role', 'profiles', p_user_id,
          jsonb_build_object('from_role', v_old_role, 'from_admin_role', v_old_admin_role,
                             'to_role', v_role, 'to_admin_role', p_admin_role,
                             'target_platform_id', v_profile.platform_id));
  return v_profile;
end;
$$;

revoke all on function public.super_admin_assign_admin_role(uuid, text) from public;
grant execute on function public.super_admin_assign_admin_role(uuid, text) to authenticated, service_role;

-- Backfill a code for any existing Sales Person created before this migration.
do $$
declare
  v_sales record;
begin
  for v_sales in
    select id from public.profiles where role = 'admin' and admin_role = 'sales_person'
  loop
    perform public.ensure_marketing_referral_code(v_sales.id);
  end loop;
end;
$$;
