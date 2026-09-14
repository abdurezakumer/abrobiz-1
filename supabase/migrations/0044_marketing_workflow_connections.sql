-- 0044_marketing_workflow_connections.sql
-- Keep existing referral attribution connected when a Sales Person is added
-- to a Marketing Admin team after the owner has already registered. Also make
-- scheduled reminder history visible only to the responsible partner roles.

create or replace function public.sync_marketing_attributions_for_team(
  p_sales_person_id uuid,
  p_marketing_admin_id uuid
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_attribution public.marketing_attributions;
  v_count integer := 0;
begin
  if p_sales_person_id is null or p_marketing_admin_id is null then
    return 0;
  end if;

  for v_attribution in
    select *
    from public.marketing_attributions
    where sales_person_id = p_sales_person_id
      and marketing_admin_id is null
    for update
  loop
    insert into public.marketing_attribution_events (
      attribution_id,
      owner_id,
      old_sales_person_id,
      old_marketing_admin_id,
      new_sales_person_id,
      new_marketing_admin_id,
      reason,
      changed_by
    ) values (
      v_attribution.id,
      v_attribution.owner_id,
      v_attribution.sales_person_id,
      v_attribution.marketing_admin_id,
      v_attribution.sales_person_id,
      p_marketing_admin_id,
      'Marketing Admin team assignment connected an existing referral',
      auth.uid()
    );

    update public.marketing_attributions
    set marketing_admin_id = p_marketing_admin_id,
        updated_at = now()
    where id = v_attribution.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.sync_marketing_attributions_for_team(uuid, uuid) from public, anon, authenticated;

create or replace function public.sync_marketing_attributions_after_team_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.ended_at is null then
    perform public.sync_marketing_attributions_for_team(new.sales_person_id, new.marketing_admin_id);
  end if;
  return new;
end;
$$;

drop trigger if exists marketing_team_attribution_sync on public.marketing_team_memberships;
create trigger marketing_team_attribution_sync
  after insert or update of sales_person_id, marketing_admin_id, ended_at
  on public.marketing_team_memberships
  for each row execute function public.sync_marketing_attributions_after_team_change();

-- Reminder events are written by the service-role cron, but partner users may
-- read only events belonging to their own responsible attribution rows.
grant select on public.marketing_reminder_events to authenticated;
drop policy if exists marketing_reminder_events_select on public.marketing_reminder_events;
create policy marketing_reminder_events_select
  on public.marketing_reminder_events
  for select
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.marketing_attributions a
      where a.id = marketing_reminder_events.attribution_id
        and (a.sales_person_id = auth.uid() or a.marketing_admin_id = auth.uid())
    )
  );

create index if not exists marketing_reminder_events_attribution_sent_idx
  on public.marketing_reminder_events (attribution_id, sent_at desc);

-- Repair any existing team assignments created before this connection trigger.
do $$
declare
  v_membership record;
begin
  for v_membership in
    select sales_person_id, marketing_admin_id
    from public.marketing_team_memberships
    where ended_at is null
  loop
    perform public.sync_marketing_attributions_for_team(
      v_membership.sales_person_id,
      v_membership.marketing_admin_id
    );
  end loop;
end;
$$;
