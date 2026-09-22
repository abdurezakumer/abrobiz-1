-- Complete the Google onboarding sequence with a required phone number and
-- enforce the platform owner's permanent super-admin identity.

create or replace function public.complete_google_phone_prompt(p_phone text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_phone text := btrim(coalesce(p_phone, ''));
  v_profile public.profiles;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from auth.users
    where id = v_user_id and coalesce(raw_app_meta_data ->> 'provider', '') = 'google'
  ) then
    raise exception 'Google onboarding is only available for Google accounts';
  end if;
  if v_phone !~ '^[+0-9() .-]{3,40}$' then
    raise exception 'Enter a valid phone number';
  end if;

  select * into v_profile from public.profiles where id = v_user_id for update;
  if v_profile.id is null or v_profile.role <> 'owner' then
    raise exception 'Owner account not found';
  end if;
  if v_profile.referral_prompt_completed_at is null then
    raise exception 'Complete the referral choice first';
  end if;

  update public.profiles
  set phone = v_phone
  where id = v_user_id;
  return true;
end;
$$;

revoke all on function public.complete_google_phone_prompt(text) from public, anon;
grant execute on function public.complete_google_phone_prompt(text) to authenticated;

-- The role-change guard permits only this migration-local bootstrap marker to
-- establish the protected account. All browser role changes remain governed
-- by the existing super-admin and MFA checks.
create or replace function public.protect_admin_role_changes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.admin_role is distinct from old.admin_role then
    if current_setting('app.super_admin_bootstrap', true) is distinct from 'on'
       and auth.role() <> 'service_role'
       and not public.is_super_admin() then
      raise exception 'Only a super administrator can change administrator roles';
    end if;
    if current_setting('app.super_admin_bootstrap', true) is distinct from 'on'
       and auth.role() <> 'service_role'
       and new.id = auth.uid() then
      raise exception 'You cannot change your own administrator role';
    end if;
    if old.role = 'super_admin' and new.role <> 'super_admin'
       and (select count(*) from public.profiles where role = 'super_admin') <= 1 then
      raise exception 'At least one super administrator is required';
    end if;
  end if;
  return new;
end;
$$;

-- Protect both the current email and the role invariant. This is a database
-- invariant, so a second super-admin cannot demote the platform owner and a
-- direct profile update cannot bypass the rule.
create or replace function public.protect_platform_owner_identity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if current_setting('app.super_admin_bootstrap', true) is distinct from 'on'
     and (
       lower(coalesce(new.email, '')) = 'oneabdre@gmail.com'
       or (tg_op = 'UPDATE' and lower(coalesce(old.email, '')) = 'oneabdre@gmail.com')
     ) then
    if lower(coalesce(new.email, '')) <> 'oneabdre@gmail.com'
       or new.role <> 'super_admin'
       or new.admin_role <> 'super_admin' then
      raise exception 'The AbroBiz platform owner must remain a super administrator';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_platform_owner_identity on public.profiles;
create trigger profiles_protect_platform_owner_identity
  before insert or update on public.profiles
  for each row execute function public.protect_platform_owner_identity();

-- Ensure the configured platform owner exists and is always a full
-- super-administrator. The profile insert covers legacy accounts whose auth
-- row exists but whose profile was not created by an earlier trigger.
do $$
begin
  perform set_config('app.super_admin_bootstrap', 'on', true);

  insert into public.profiles (id, platform_id, email, name, phone, email_verified_at)
  select u.id,
         public.generate_unique_platform_id(),
         coalesce(u.email, 'oneabdre@gmail.com'),
         coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name', ''),
         coalesce(u.raw_user_meta_data ->> 'phone', ''),
         coalesce(u.email_confirmed_at, now())
  from auth.users u
  where lower(u.email) = 'oneabdre@gmail.com'
    and not exists (select 1 from public.profiles p where p.id = u.id);

  update public.profiles p
  set email = 'oneabdre@gmail.com',
      role = 'super_admin',
      admin_role = 'super_admin',
      email_verified_at = coalesce(p.email_verified_at, now())
  from auth.users u
  where p.id = u.id
    and (lower(p.email) = 'oneabdre@gmail.com' or lower(u.email) = 'oneabdre@gmail.com');
end;
$$;
