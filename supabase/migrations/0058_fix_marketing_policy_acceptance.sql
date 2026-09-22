-- 0058_fix_marketing_policy_acceptance.sql
-- Allow the dedicated marketing-policy acceptance workflow to update its
-- protected profile fields without weakening ordinary profile updates.

create or replace function public.record_marketing_policy_acceptance()
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and admin_role in ('marketing_admin', 'sales_person', 'super_admin')
  ) then
    raise exception 'Marketing policy is not required for this account';
  end if;

  -- This transaction-local marker is recognized only by the profile security
  -- trigger and cannot authorize ordinary browser profile updates.
  perform set_config('app.marketing_policy_acceptance', 'on', true);

  update public.profiles
  set marketing_policy_accepted_at = now(),
      marketing_policy_version = '2026-09'
  where id = v_user_id;

  if not found then
    raise exception 'Marketing policy acceptance could not be saved';
  end if;

  return true;
end;
$$;

revoke all on function public.record_marketing_policy_acceptance() from public, anon;
grant execute on function public.record_marketing_policy_acceptance() to authenticated;

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_super_admin() then
    if current_setting('app.super_admin_bootstrap', true) is distinct from 'on'
      and (
        new.id is distinct from old.id
        or new.email is distinct from old.email
        or new.role is distinct from old.role
        or new.admin_role is distinct from old.admin_role
        or new.email_verified_at is distinct from old.email_verified_at
        or (
          current_setting('app.marketing_policy_acceptance', true) is distinct from 'on'
          and (
            new.marketing_policy_accepted_at is distinct from old.marketing_policy_accepted_at
            or new.marketing_policy_version is distinct from old.marketing_policy_version
          )
        )
      ) then
      raise exception 'Protected profile fields can only be changed through an authorized workflow';
    end if;

    if current_setting('app.platform_id_migration', true) is distinct from 'on'
      and new.platform_id is distinct from old.platform_id then
      raise exception 'Protected profile fields can only be changed through an authorized workflow';
    end if;

    if current_setting('app.referral_prompt_completion', true) is distinct from 'on'
      and new.referral_prompt_completed_at is distinct from old.referral_prompt_completed_at then
      raise exception 'Referral prompt completion must be recorded through the referral workflow';
    end if;

    if current_setting('app.legal_acceptance', true) is distinct from 'on'
      and (
        new.terms_accepted_at is distinct from old.terms_accepted_at
        or new.privacy_accepted_at is distinct from old.privacy_accepted_at
        or new.legal_version is distinct from old.legal_version
      ) then
      raise exception 'Legal acceptance must be recorded through the acceptance flow';
    end if;
  end if;
  return new;
end;
$$;
