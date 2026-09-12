-- Complete referral attribution for Google signups.
--
-- Google ID-token sign-in does not accept custom user metadata during the
-- provider exchange. The auth trigger therefore creates a safe direct
-- attribution first; the authenticated client then calls the existing
-- create_marketing_attribution RPC with the referral code. This update lets
-- that RPC complete only a newly-created direct attribution and never replace
-- an existing referral or an admin correction.

create or replace function public.create_marketing_attribution(
  p_owner_id uuid,
  p_referral_code text default null
)
returns public.marketing_attributions
language plpgsql
security definer set search_path = public
as $$
declare
  v_attribution public.marketing_attributions;
  v_existing public.marketing_attributions;
  v_code public.marketing_referral_codes;
  v_admin_id uuid;
  v_code_text text := nullif(upper(btrim(coalesce(p_referral_code, ''))), '');
begin
  if auth.role() <> 'service_role' and auth.uid() <> p_owner_id then
    raise exception 'Not authorized';
  end if;

  if v_code_text is not null then
    select * into v_code
    from public.marketing_referral_codes
    where code = v_code_text and is_active;
    if v_code.id is not null then
      select marketing_admin_id into v_admin_id
      from public.marketing_team_memberships
      where sales_person_id = v_code.sales_person_id and ended_at is null
      order by started_at desc limit 1;
      if not exists (
        select 1 from public.profiles
        where id = v_code.sales_person_id
          and role = 'admin'
          and admin_role = 'sales_person'
      ) then
        v_code.id := null;
      end if;
    end if;
  end if;

  select * into v_existing
  from public.marketing_attributions
  where owner_id = p_owner_id
  for update;

  if found then
    -- Only complete the direct attribution created by the auth trigger. A
    -- referral or an admin correction remains immutable.
    if v_existing.source = 'direct'
       and v_code.id is not null
       and exists (
         select 1 from auth.users u
         where u.id = p_owner_id
           and u.created_at >= now() - interval '10 minutes'
       ) then
      update public.marketing_attributions
      set sales_person_id = v_code.sales_person_id,
          marketing_admin_id = v_admin_id,
          referral_code_id = v_code.id,
          referral_code_snapshot = v_code.code,
          source = 'referral_code',
          attribution_status = 'locked',
          locked_at = now(),
          updated_at = now()
      where id = v_existing.id
      returning * into v_attribution;

      insert into public.marketing_attribution_events (
        attribution_id, owner_id,
        old_sales_person_id, old_marketing_admin_id,
        new_sales_person_id, new_marketing_admin_id,
        reason
      ) values (
        v_attribution.id, p_owner_id,
        v_existing.sales_person_id, v_existing.marketing_admin_id,
        v_attribution.sales_person_id, v_attribution.marketing_admin_id,
        'Referral attribution completed after Google signup'
      );
      return v_attribution;
    end if;
    return v_existing;
  end if;

  insert into public.marketing_attributions (
    owner_id, sales_person_id, marketing_admin_id, referral_code_id,
    referral_code_snapshot, source
  ) values (
    p_owner_id,
    case when v_code.id is null then null else v_code.sales_person_id end,
    case when v_code.id is null then null else v_admin_id end,
    case when v_code.id is null then null else v_code.id end,
    case when v_code.id is null then null else v_code.code end,
    case when v_code.id is null then 'direct' else 'referral_code' end
  )
  returning * into v_attribution;

  insert into public.marketing_attribution_events (
    attribution_id, owner_id, new_sales_person_id, new_marketing_admin_id, reason
  ) values (
    v_attribution.id, p_owner_id, v_attribution.sales_person_id,
    v_attribution.marketing_admin_id,
    case when v_attribution.sales_person_id is null
      then 'Direct registration'
      else 'Referral registration'
    end
  );
  return v_attribution;
end;
$$;

revoke all on function public.create_marketing_attribution(uuid, text) from public;
grant execute on function public.create_marketing_attribution(uuid, text) to authenticated, service_role;
