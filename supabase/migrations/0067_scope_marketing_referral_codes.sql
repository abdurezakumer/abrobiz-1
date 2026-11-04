-- Keep marketing referral-code reads and direct writes inside each
-- salesperson's own account or the Marketing Admin's active team.
drop policy if exists marketing_referral_codes_select on public.marketing_referral_codes;
create policy marketing_referral_codes_select on public.marketing_referral_codes
  for select using (
    public.is_super_admin()
    or sales_person_id = auth.uid()
    or marketing_admin_id = auth.uid()
    or exists (
      select 1
      from public.marketing_team_memberships tm
      where tm.sales_person_id = marketing_referral_codes.sales_person_id
        and tm.marketing_admin_id = auth.uid()
        and tm.ended_at is null
    )
  );

drop policy if exists marketing_referral_codes_write on public.marketing_referral_codes;
create policy marketing_referral_codes_write on public.marketing_referral_codes
  for all using (
    public.is_super_admin()
    or (
      sales_person_id = auth.uid()
      and public.has_admin_permission('marketing.referrals')
    )
    or (
      public.has_admin_permission('marketing.manage')
      and (
        marketing_admin_id = auth.uid()
        or exists (
          select 1
          from public.marketing_team_memberships tm
          where tm.sales_person_id = marketing_referral_codes.sales_person_id
            and tm.marketing_admin_id = auth.uid()
            and tm.ended_at is null
        )
      )
    )
  ) with check (
    public.is_super_admin()
    or (
      sales_person_id = auth.uid()
      and public.has_admin_permission('marketing.referrals')
    )
    or (
      public.has_admin_permission('marketing.manage')
      and (
        marketing_admin_id = auth.uid()
        or exists (
          select 1
          from public.marketing_team_memberships tm
          where tm.sales_person_id = marketing_referral_codes.sales_person_id
            and tm.marketing_admin_id = auth.uid()
            and tm.ended_at is null
        )
      )
    )
  );

-- Exact live-site KPI, independent of the marketing workspace's paginated
-- customer list. The attribution predicate prevents the public-business read
-- policy from turning a table-wide count into a platform-wide total.
create or replace function public.marketing_my_live_business_count()
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(distinct b.id)
  from public.marketing_attributions a
  join public.businesses b on b.owner_id = a.owner_id
  where (
    public.is_super_admin()
    or a.sales_person_id = auth.uid()
    or a.marketing_admin_id = auth.uid()
  )
    and b.is_published
    and not b.is_blocked;
$$;

revoke all on function public.marketing_my_live_business_count() from public, anon;
grant execute on function public.marketing_my_live_business_count() to authenticated;
