-- ============================================================================
-- 0014_google_signin.sql
-- Supports Google sign-in. The one subtlety: auth.users.email_confirmed_at
-- gets set immediately for EVERY signup once Supabase's "Confirm email" is
-- off (per 0013's setup) — password signups included — so it can't be used
-- to detect "this was actually verified by Google". raw_app_meta_data->>
-- 'provider' can: it's 'google' for OAuth sign-ins and 'email' for
-- password ones. Only Google sign-ins get auto-verified here; everyone
-- else still goes through the app's own email_verification_tokens flow.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone, email_verified_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    case when new.raw_app_meta_data ->> 'provider' = 'google' then now() else null end
  );
  return new;
end;
$$;
