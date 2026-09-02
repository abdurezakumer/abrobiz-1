-- ============================================================================
-- 0032_plan_pricing.sql
-- Current monthly AbroBiz plan prices. The free trial is unchanged.
-- ============================================================================

update public.plans
set price_etb = case slug
  when 'basic' then 1000
  when 'business' then 1500
  when 'premium' then 2000
  else price_etb
end
where slug in ('basic', 'business', 'premium');
