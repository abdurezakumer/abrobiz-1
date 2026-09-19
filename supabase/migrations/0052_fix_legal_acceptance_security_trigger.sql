-- 0052_fix_legal_acceptance_security_trigger.sql
-- The legal acceptance RPC deliberately sets app.legal_acceptance before
-- updating the three consent fields. The final security-hardening trigger must
-- honor that marker while continuing to protect every other profile field.

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_super_admin() then
    -- These fields are never editable through the browser, regardless of the
    -- legal-acceptance marker.
    if new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.admin_role is distinct from old.admin_role
      or new.platform_id is distinct from old.platform_id
      or new.email_verified_at is distinct from old.email_verified_at
      or new.marketing_policy_accepted_at is distinct from old.marketing_policy_accepted_at
      or new.marketing_policy_version is distinct from old.marketing_policy_version then
      raise exception 'Protected profile fields can only be changed through an authorized workflow';
    end if;

    -- Only record_legal_acceptance sets this transaction-local marker, and that
    -- function validates the authenticated user, both required consents, and
    -- the current legal-document version before reaching this update.
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
