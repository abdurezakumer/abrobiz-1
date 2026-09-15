-- AI website copy is a paid-plan capability. Keep it in the existing JSON
-- feature flag model so plan access remains admin-configurable without a new
-- entitlement table or a second permission system.

update public.plans
set feature_flags = coalesce(feature_flags, '{}'::jsonb)
  || jsonb_build_object('aiCopy', slug = 'premium')
where slug in ('trial', 'basic', 'business', 'premium');

update public.plans
set features = case
  when slug = 'premium'
    and not (features @> '["AI website copy assistant"]'::jsonb)
    then features || '["AI website copy assistant"]'::jsonb
  else features
end
where slug = 'premium';
