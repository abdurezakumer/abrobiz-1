-- 0043_marketing_activity_read_policy.sql
-- Ensure the optional marketing activity feed is readable by authenticated
-- users only when they are responsible for the related attribution.

grant select on public.marketing_attribution_events to authenticated;

drop policy if exists marketing_attribution_events_select
  on public.marketing_attribution_events;

create policy marketing_attribution_events_select
  on public.marketing_attribution_events
  for select
  using (
    owner_id = auth.uid()
    or new_sales_person_id = auth.uid()
    or new_marketing_admin_id = auth.uid()
    or public.is_super_admin()
  );
