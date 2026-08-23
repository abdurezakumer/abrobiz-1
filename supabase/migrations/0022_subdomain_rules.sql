-- ============================================================================
-- 0022_subdomain_rules.sql
-- A business slug is the single DNS label before .abrobiz.com.
-- ============================================================================

create or replace function public.validate_business_subdomain()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.slug is null
     or new.slug <> lower(new.slug)
     or new.slug !~ '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$'
     or lower(new.slug) = any (array[
       'www', 'app', 'admin', 'api', 'mail', 'smtp', 'auth', 'dashboard',
       'login', 'register', 'setup', 'support', 'status', 'static', 'cdn'
     ]) then
    raise exception 'Choose a valid, available AbroBiz subdomain';
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_validate_subdomain on public.businesses;
create trigger businesses_validate_subdomain
  before insert or update of slug on public.businesses
  for each row execute function public.validate_business_subdomain();
