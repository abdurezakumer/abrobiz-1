-- 0037_marketing_attribution_commissions.sql
-- Server-side marketing attribution, referral codes, full-payment commission
-- ledger, team membership, and configurable follow-up rules.

alter table public.profiles drop constraint if exists profiles_admin_role_check;
alter table public.profiles
  add constraint profiles_admin_role_check check (
    admin_role in ('none', 'super_admin', 'operations', 'support', 'finance',
                   'content', 'marketing_admin', 'sales_person')
  );
alter table public.profiles
  add column if not exists marketing_policy_accepted_at timestamptz,
  add column if not exists marketing_policy_version text;

create or replace function public.record_marketing_policy_acceptance()
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and admin_role in ('marketing_admin', 'sales_person', 'super_admin')) then
    raise exception 'Marketing policy is not required for this account';
  end if;
  update public.profiles set marketing_policy_accepted_at = now(), marketing_policy_version = '2026-09' where id = auth.uid();
  return true;
end;
$$;
revoke all on function public.record_marketing_policy_acceptance() from public;
grant execute on function public.record_marketing_policy_acceptance() to authenticated;

create table if not exists public.marketing_referral_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  sales_person_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  label text not null default '',
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketing_referral_codes_active_sales_idx
  on public.marketing_referral_codes (sales_person_id) where is_active;
create index if not exists marketing_referral_codes_sales_idx
  on public.marketing_referral_codes (sales_person_id, is_active);

create table if not exists public.marketing_team_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  sales_person_id uuid not null references public.profiles (id) on delete cascade,
  marketing_admin_id uuid not null references public.profiles (id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists marketing_team_active_sales_idx
  on public.marketing_team_memberships (sales_person_id) where ended_at is null;
create index if not exists marketing_team_admin_idx
  on public.marketing_team_memberships (marketing_admin_id, ended_at);

create table if not exists public.marketing_attributions (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  sales_person_id uuid references public.profiles (id) on delete set null,
  marketing_admin_id uuid references public.profiles (id) on delete set null,
  referral_code_id uuid references public.marketing_referral_codes (id) on delete set null,
  referral_code_snapshot text,
  source text not null default 'direct' check (source in ('direct', 'referral_link', 'referral_code', 'admin_assigned')),
  attribution_status text not null default 'locked' check (attribution_status in ('locked', 'corrected')),
  attributed_at timestamptz not null default now(),
  locked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_attributions_sales_idx
  on public.marketing_attributions (sales_person_id, attributed_at desc);
create index if not exists marketing_attributions_admin_idx
  on public.marketing_attributions (marketing_admin_id, attributed_at desc);

create table if not exists public.marketing_attribution_events (
  id uuid primary key default extensions.gen_random_uuid(),
  attribution_id uuid not null references public.marketing_attributions (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  old_sales_person_id uuid references public.profiles (id) on delete set null,
  old_marketing_admin_id uuid references public.profiles (id) on delete set null,
  new_sales_person_id uuid references public.profiles (id) on delete set null,
  new_marketing_admin_id uuid references public.profiles (id) on delete set null,
  reason text not null default '',
  changed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists marketing_attribution_events_owner_idx
  on public.marketing_attribution_events (owner_id, created_at desc);

create table if not exists public.marketing_commission_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  sales_person_rate numeric(5, 2) not null check (sales_person_rate >= 0 and sales_person_rate <= 100),
  marketing_admin_rate numeric(5, 2) not null check (marketing_admin_rate >= 0 and marketing_admin_rate <= 100),
  abrobiz_rate numeric(5, 2) not null check (abrobiz_rate >= 0 and abrobiz_rate <= 100),
  effective_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (sales_person_rate + marketing_admin_rate + abrobiz_rate = 100)
);

create unique index if not exists marketing_commission_rules_active_idx
  on public.marketing_commission_rules (is_active) where is_active;

insert into public.marketing_commission_rules (
  name, sales_person_rate, marketing_admin_rate, abrobiz_rate
)
select 'Standard referral distribution', 20, 5, 75
where not exists (select 1 from public.marketing_commission_rules);

create table if not exists public.marketing_commission_ledger (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  sales_person_id uuid references public.profiles (id) on delete set null,
  marketing_admin_id uuid references public.profiles (id) on delete set null,
  commission_rule_id uuid not null references public.marketing_commission_rules (id) on delete restrict,
  recipient_type text not null check (recipient_type in ('sales_person', 'marketing_admin', 'abrobiz')),
  rate numeric(5, 2) not null check (rate >= -100 and rate <= 100),
  amount_etb numeric(12, 2) not null,
  status text not null default 'pending' check (status in ('calculated', 'pending', 'eligible', 'approved', 'payable', 'paid', 'recognized', 'reversed', 'disputed', 'cancelled')),
  entry_type text not null default 'original' check (entry_type in ('original', 'reversal')),
  source_ledger_id uuid references public.marketing_commission_ledger (id),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketing_commission_original_unique_idx
  on public.marketing_commission_ledger (payment_id, recipient_type)
  where entry_type = 'original';
create index if not exists marketing_commission_owner_idx
  on public.marketing_commission_ledger (owner_id, status, created_at desc);
create index if not exists marketing_commission_recipient_idx
  on public.marketing_commission_ledger (recipient_type, status, created_at desc);

create table if not exists public.marketing_reminder_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  days_after_registration integer not null unique check (days_after_registration >= 0 and days_after_registration <= 3650),
  message text not null default '',
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_reminder_events (
  id uuid primary key default extensions.gen_random_uuid(),
  attribution_id uuid not null references public.marketing_attributions (id) on delete cascade,
  reminder_rule_id uuid not null references public.marketing_reminder_rules (id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (attribution_id, reminder_rule_id)
);

insert into public.marketing_reminder_rules (name, days_after_registration, message)
values
  ('Registration follow-up', 0, 'New AbroBiz owner registration is waiting for payment follow-up.'),
  ('First payment reminder', 1, 'This AbroBiz owner registered yesterday and has not completed the full plan payment.'),
  ('Third-day payment reminder', 3, 'This AbroBiz owner has not completed the full plan payment after three days.'),
  ('Final payment reminder', 7, 'Final follow-up: this AbroBiz owner has not completed the full plan payment after seven days.')
on conflict (days_after_registration) do nothing;

-- Keep attribution assignment valid even when a trusted service or a
-- super-admin performs the write.
create or replace function public.validate_marketing_team_membership()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = new.sales_person_id and role = 'admin' and admin_role = 'sales_person') then
    raise exception 'The selected user is not an active Sales Person';
  end if;
  if not exists (select 1 from public.profiles where id = new.marketing_admin_id and role in ('admin', 'super_admin') and admin_role in ('marketing_admin', 'super_admin')) then
    raise exception 'The selected user is not a Marketing Admin';
  end if;
  return new;
end;
$$;

drop trigger if exists marketing_team_membership_validate on public.marketing_team_memberships;
create trigger marketing_team_membership_validate
  before insert or update on public.marketing_team_memberships
  for each row execute function public.validate_marketing_team_membership();

-- Every owner gets exactly one immutable attribution record. Direct owners
-- remain unassigned and therefore generate 100% AbroBiz revenue if they pay.
create or replace function public.create_marketing_attribution(
  p_owner_id uuid,
  p_referral_code text default null
)
returns public.marketing_attributions
language plpgsql
security definer set search_path = public
as $$
declare
  v_attribution public.marketing_attributions;
  v_code public.marketing_referral_codes;
  v_admin_id uuid;
  v_code_text text := nullif(upper(btrim(coalesce(p_referral_code, ''))), '');
begin
  if auth.role() <> 'service_role' and auth.uid() <> p_owner_id then
    raise exception 'Not authorized';
  end if;

  if v_code_text is not null then
    select * into v_code
    from public.marketing_referral_codes
    where code = v_code_text and is_active;
    if v_code.id is not null then
      select marketing_admin_id into v_admin_id
      from public.marketing_team_memberships
      where sales_person_id = v_code.sales_person_id and ended_at is null
      order by started_at desc limit 1;
      if not exists (select 1 from public.profiles where id = v_code.sales_person_id and role = 'admin' and admin_role = 'sales_person') then
        v_code.id := null;
      end if;
    end if;
  end if;

  insert into public.marketing_attributions (
    owner_id, sales_person_id, marketing_admin_id, referral_code_id,
    referral_code_snapshot, source
  ) values (
    p_owner_id,
    case when v_code.id is null then null else v_code.sales_person_id end,
    case when v_code.id is null then null else v_admin_id end,
    case when v_code.id is null then null else v_code.id end,
    case when v_code.id is null then null else v_code.code end,
    case when v_code.id is null then 'direct' else 'referral_code' end
  )
  on conflict (owner_id) do nothing
  returning * into v_attribution;

  if v_attribution.id is null then
    select * into v_attribution from public.marketing_attributions where owner_id = p_owner_id;
  else
    insert into public.marketing_attribution_events (
      attribution_id, owner_id, new_sales_person_id, new_marketing_admin_id, reason
    ) values (
      v_attribution.id, p_owner_id, v_attribution.sales_person_id,
      v_attribution.marketing_admin_id,
      case when v_attribution.sales_person_id is null then 'Direct registration' else 'Referral registration' end
    );
  end if;
  return v_attribution;
end;
$$;

revoke all on function public.create_marketing_attribution(uuid, text) from public;
grant execute on function public.create_marketing_attribution(uuid, text) to authenticated, service_role;

-- The auth trigger carries the referral code in raw_user_meta_data so email,
-- Google, and future signup paths share the same server-side attribution rule.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, platform_id, email, name, phone)
  values (
    new.id,
    'ABZ-' || upper(substr(replace(new.id::text, '-', ''), 1, 12)),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do update set email = excluded.email;
  perform public.create_marketing_attribution(new.id, new.raw_user_meta_data ->> 'referral_code');
  return new;
end;
$$;

create or replace function public.marketing_create_commissions_for_payment(p_payment_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_payment public.payments;
  v_owner_id uuid;
  v_attr public.marketing_attributions;
  v_rule public.marketing_commission_rules;
  v_sales_amount numeric(12, 2) := 0;
  v_admin_amount numeric(12, 2) := 0;
  v_abrobiz_amount numeric(12, 2);
  v_sales_rate numeric(5, 2) := 0;
  v_admin_rate numeric(5, 2) := 0;
  v_abrobiz_rate numeric(5, 2) := 100;
  v_count integer := 0;
begin
  if auth.role() <> 'service_role' and not public.has_admin_permission('payments.review') then
    raise exception 'Not authorized';
  end if;

  select p.* into v_payment
  from public.payments p
  where p.id = p_payment_id and p.status = 'approved';
  if v_payment.id is null then raise exception 'Approved payment not found'; end if;
  select owner_id into v_owner_id from public.businesses where id = v_payment.business_id;

  if exists (select 1 from public.marketing_commission_ledger where payment_id = p_payment_id and entry_type = 'original') then
    return 0;
  end if;

  select * into v_attr from public.marketing_attributions where owner_id = v_owner_id;
  select * into v_rule from public.marketing_commission_rules
  where is_active and effective_at <= now()
  order by effective_at desc limit 1;
  if v_rule.id is null then raise exception 'No active commission rule'; end if;

  if v_attr.sales_person_id is not null then
    v_sales_rate := v_rule.sales_person_rate;
    v_sales_amount := round(v_payment.amount_etb * v_sales_rate / 100, 2);
  end if;
  if v_attr.marketing_admin_id is not null then
    v_admin_rate := v_rule.marketing_admin_rate;
    v_admin_amount := round(v_payment.amount_etb * v_admin_rate / 100, 2);
  end if;
  v_abrobiz_amount := v_payment.amount_etb - v_sales_amount - v_admin_amount;
  v_abrobiz_rate := case when v_payment.amount_etb = 0 then 100 else round(v_abrobiz_amount * 100 / v_payment.amount_etb, 2) end;

  if v_attr.sales_person_id is not null and v_sales_amount > 0 then
    insert into public.marketing_commission_ledger (
      payment_id, owner_id, sales_person_id, marketing_admin_id, commission_rule_id,
      recipient_type, rate, amount_etb, status, note
    ) values (
      p_payment_id, v_owner_id, v_attr.sales_person_id, v_attr.marketing_admin_id,
      v_rule.id, 'sales_person', v_sales_rate, v_sales_amount, 'pending', 'Generated from the approved full plan payment.'
    );
    v_count := v_count + 1;
    insert into public.notifications (user_id, type, title, body, link)
    values (v_attr.sales_person_id, 'commission_calculated', 'Commission calculated', 'A customer payment attributed to you has been approved. Open Marketing to view the ledger.', '/admin/marketing');
  end if;

  if v_attr.marketing_admin_id is not null and v_admin_amount > 0 then
    insert into public.marketing_commission_ledger (
      payment_id, owner_id, sales_person_id, marketing_admin_id, commission_rule_id,
      recipient_type, rate, amount_etb, status, note
    ) values (
      p_payment_id, v_owner_id, v_attr.sales_person_id, v_attr.marketing_admin_id,
      v_rule.id, 'marketing_admin', v_admin_rate, v_admin_amount, 'pending', 'Generated from the approved full plan payment.'
    );
    v_count := v_count + 1;
    insert into public.notifications (user_id, type, title, body, link)
    values (v_attr.marketing_admin_id, 'commission_calculated', 'Team commission calculated', 'A customer payment from your team has been approved. Open Marketing to view the ledger.', '/admin/marketing');
  end if;

  insert into public.marketing_commission_ledger (
    payment_id, owner_id, sales_person_id, marketing_admin_id, commission_rule_id,
    recipient_type, rate, amount_etb, status, note
  ) values (
    p_payment_id, v_owner_id, v_attr.sales_person_id, v_attr.marketing_admin_id,
    v_rule.id, 'abrobiz', v_abrobiz_rate, v_abrobiz_amount, 'recognized', 'Platform share from the approved full plan payment.'
  );
  v_count := v_count + 1;
  return v_count;
end;
$$;

revoke all on function public.marketing_create_commissions_for_payment(uuid) from public, anon, authenticated;
grant execute on function public.marketing_create_commissions_for_payment(uuid) to service_role;

create or replace function public.marketing_payment_approval_commission_trigger()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    perform public.marketing_create_commissions_for_payment(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists payments_marketing_commission_on_approval on public.payments;
create trigger payments_marketing_commission_on_approval
  after update of status on public.payments
  for each row execute function public.marketing_payment_approval_commission_trigger();

create or replace function public.super_admin_create_referral_code(
  p_sales_person_id uuid,
  p_code text,
  p_label text default ''
)
returns public.marketing_referral_codes
language plpgsql
security definer set search_path = public
as $$
declare v_code public.marketing_referral_codes; v_normalized text := upper(btrim(p_code));
begin
  if not public.is_super_admin() then raise exception 'Super administrators only'; end if;
  if not exists (select 1 from public.profiles where id = p_sales_person_id and role = 'admin' and admin_role = 'sales_person') then raise exception 'Sales Person not found'; end if;
  if v_normalized !~ '^[A-Z0-9][A-Z0-9_-]{2,31}$' then raise exception 'Referral code must be 3 to 32 letters, numbers, hyphens, or underscores'; end if;
  update public.marketing_referral_codes set is_active = false, updated_at = now() where sales_person_id = p_sales_person_id and is_active;
  insert into public.marketing_referral_codes (sales_person_id, code, label, created_by) values (p_sales_person_id, v_normalized, left(coalesce(p_label, ''), 120), auth.uid()) returning * into v_code;
  insert into public.admin_logs (admin_id, action, target_table, target_id, meta) values (auth.uid(), 'create_referral_code', 'marketing_referral_codes', v_code.id, jsonb_build_object('sales_person_id', p_sales_person_id, 'code', v_normalized));
  return v_code;
end;
$$;

create or replace function public.super_admin_assign_marketing_team(
  p_sales_person_id uuid,
  p_marketing_admin_id uuid
)
returns public.marketing_team_memberships
language plpgsql
security definer set search_path = public
as $$
declare v_membership public.marketing_team_memberships;
begin
  if not public.is_super_admin() then raise exception 'Super administrators only'; end if;
  if not exists (select 1 from public.profiles where id = p_sales_person_id and role = 'admin' and admin_role = 'sales_person') then raise exception 'Sales Person not found'; end if;
  if not exists (select 1 from public.profiles where id = p_marketing_admin_id and role in ('admin', 'super_admin') and admin_role in ('marketing_admin', 'super_admin')) then raise exception 'Marketing Admin not found'; end if;
  update public.marketing_team_memberships set ended_at = now() where sales_person_id = p_sales_person_id and ended_at is null;
  insert into public.marketing_team_memberships (sales_person_id, marketing_admin_id, created_by) values (p_sales_person_id, p_marketing_admin_id, auth.uid()) returning * into v_membership;
  insert into public.admin_logs (admin_id, action, target_table, target_id, meta) values (auth.uid(), 'assign_marketing_team', 'marketing_team_memberships', v_membership.id, jsonb_build_object('sales_person_id', p_sales_person_id, 'marketing_admin_id', p_marketing_admin_id));
  return v_membership;
end;
$$;

create or replace function public.super_admin_reassign_marketing_attribution(
  p_owner_id uuid,
  p_sales_person_id uuid,
  p_reason text
)
returns public.marketing_attributions
language plpgsql
security definer set search_path = public
as $$
declare v_old public.marketing_attributions; v_new_admin uuid; v_new public.marketing_attributions;
begin
  if not public.is_super_admin() then raise exception 'Super administrators only'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'A reason is required for attribution changes'; end if;
  if p_sales_person_id is not null and not exists (select 1 from public.profiles where id = p_sales_person_id and role = 'admin' and admin_role = 'sales_person') then raise exception 'Sales Person not found'; end if;
  select * into v_old from public.marketing_attributions where owner_id = p_owner_id for update;
  if v_old.id is null then raise exception 'Attribution not found'; end if;
  select marketing_admin_id into v_new_admin from public.marketing_team_memberships where sales_person_id = p_sales_person_id and ended_at is null order by started_at desc limit 1;
  insert into public.marketing_attribution_events (attribution_id, owner_id, old_sales_person_id, old_marketing_admin_id, new_sales_person_id, new_marketing_admin_id, reason, changed_by)
  values (v_old.id, p_owner_id, v_old.sales_person_id, v_old.marketing_admin_id, p_sales_person_id, v_new_admin, left(btrim(p_reason), 1000), auth.uid());
  update public.marketing_attributions set sales_person_id = p_sales_person_id, marketing_admin_id = v_new_admin, source = 'admin_assigned', attribution_status = 'corrected', updated_at = now() where id = v_old.id returning * into v_new;
  insert into public.admin_logs (admin_id, action, target_table, target_id, meta) values (auth.uid(), 'reassign_marketing_attribution', 'marketing_attributions', v_old.id, jsonb_build_object('owner_id', p_owner_id, 'reason', left(btrim(p_reason), 1000)));
  return v_new;
end;
$$;

create or replace function public.super_admin_update_commission_status(
  p_ledger_id uuid,
  p_status text
)
returns public.marketing_commission_ledger
language plpgsql
security definer set search_path = public
as $$
declare v_row public.marketing_commission_ledger;
begin
  if not public.is_super_admin() then raise exception 'Super administrators only'; end if;
  if p_status not in ('calculated', 'pending', 'eligible', 'approved', 'payable', 'paid', 'disputed', 'cancelled') then raise exception 'Invalid commission status'; end if;
  update public.marketing_commission_ledger set status = p_status, updated_at = now() where id = p_ledger_id returning * into v_row;
  if v_row.id is null then raise exception 'Commission entry not found'; end if;
  insert into public.admin_logs (admin_id, action, target_table, target_id, meta) values (auth.uid(), 'update_commission_status', 'marketing_commission_ledger', v_row.id, jsonb_build_object('status', p_status));
  return v_row;
end;
$$;

create or replace function public.super_admin_set_commission_rule(
  p_name text,
  p_sales_person_rate numeric,
  p_marketing_admin_rate numeric,
  p_abrobiz_rate numeric
)
returns public.marketing_commission_rules
language plpgsql
security definer set search_path = public
as $$
declare v_rule public.marketing_commission_rules;
begin
  if not public.is_super_admin() then raise exception 'Super administrators only'; end if;
  if p_sales_person_rate < 0 or p_marketing_admin_rate < 0 or p_abrobiz_rate < 0
     or p_sales_person_rate + p_marketing_admin_rate + p_abrobiz_rate <> 100 then
    raise exception 'Commission rates must total exactly 100 percent';
  end if;
  update public.marketing_commission_rules set is_active = false where is_active;
  insert into public.marketing_commission_rules (name, sales_person_rate, marketing_admin_rate, abrobiz_rate, created_by)
  values (left(btrim(p_name), 120), p_sales_person_rate, p_marketing_admin_rate, p_abrobiz_rate, auth.uid())
  returning * into v_rule;
  insert into public.admin_logs (admin_id, action, target_table, target_id, meta)
  values (auth.uid(), 'set_commission_rule', 'marketing_commission_rules', v_rule.id,
    jsonb_build_object('sales_person_rate', p_sales_person_rate, 'marketing_admin_rate', p_marketing_admin_rate, 'abrobiz_rate', p_abrobiz_rate));
  return v_rule;
end;
$$;

create or replace function public.super_admin_reverse_payment_commissions(
  p_payment_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare v_original public.marketing_commission_ledger; v_count integer := 0; v_exists boolean;
begin
  if not public.is_super_admin() then raise exception 'Super administrators only'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'A reason is required for a reversal'; end if;
  select exists (select 1 from public.marketing_commission_ledger where payment_id = p_payment_id and entry_type = 'reversal') into v_exists;
  if v_exists then return 0; end if;
  for v_original in select * from public.marketing_commission_ledger where payment_id = p_payment_id and entry_type = 'original' loop
    insert into public.marketing_commission_ledger (payment_id, owner_id, sales_person_id, marketing_admin_id, commission_rule_id, recipient_type, rate, amount_etb, status, entry_type, source_ledger_id, note)
    values (v_original.payment_id, v_original.owner_id, v_original.sales_person_id, v_original.marketing_admin_id, v_original.commission_rule_id, v_original.recipient_type, -v_original.rate, -v_original.amount_etb, 'reversed', 'reversal', v_original.id, left(btrim(p_reason), 1000));
    update public.marketing_commission_ledger set status = 'reversed', updated_at = now() where id = v_original.id;
    v_count := v_count + 1;
  end loop;
  insert into public.admin_logs (admin_id, action, target_table, target_id, meta) values (auth.uid(), 'reverse_payment_commissions', 'payments', p_payment_id, jsonb_build_object('reason', left(btrim(p_reason), 1000), 'entries', v_count));
  return v_count;
end;
$$;

revoke all on function public.super_admin_create_referral_code(uuid, text, text) from public;
revoke all on function public.super_admin_assign_marketing_team(uuid, uuid) from public;
revoke all on function public.super_admin_reassign_marketing_attribution(uuid, uuid, text) from public;
revoke all on function public.super_admin_update_commission_status(uuid, text) from public;
revoke all on function public.super_admin_reverse_payment_commissions(uuid, text) from public;
revoke all on function public.super_admin_set_commission_rule(text, numeric, numeric, numeric) from public;
grant execute on function public.super_admin_create_referral_code(uuid, text, text) to authenticated;
grant execute on function public.super_admin_assign_marketing_team(uuid, uuid) to authenticated;
grant execute on function public.super_admin_reassign_marketing_attribution(uuid, uuid, text) to authenticated;
grant execute on function public.super_admin_update_commission_status(uuid, text) to authenticated;
grant execute on function public.super_admin_reverse_payment_commissions(uuid, text) to authenticated;
grant execute on function public.super_admin_set_commission_rule(text, numeric, numeric, numeric) to authenticated;

-- Replace the role matrix with the marketing roles included. Existing roles
-- retain their previous permissions.
create or replace function public.has_admin_permission(p_permission text)
returns boolean
language plpgsql
security definer set search_path = public
stable
as $$
declare v_role text; v_admin_role text;
begin
  select role, admin_role into v_role, v_admin_role from public.profiles where id = auth.uid();
  if v_role = 'super_admin' or v_admin_role = 'super_admin' then return true; end if;
  if v_role <> 'admin' then return false; end if;
  return case v_admin_role
    when 'operations' then p_permission in ('dashboard.read', 'businesses.read', 'businesses.manage', 'payments.read', 'payments.review', 'support.read')
    when 'finance' then p_permission in ('dashboard.read', 'payments.read', 'payments.review')
    when 'support' then p_permission in ('dashboard.read', 'users.read', 'support.read', 'notifications.send')
    when 'content' then p_permission in ('dashboard.read', 'templates.manage', 'announcements.send')
    when 'marketing_admin' then p_permission in ('dashboard.read', 'marketing.read', 'marketing.manage', 'marketing.referrals', 'marketing.commissions', 'marketing.reminders')
    when 'sales_person' then p_permission in ('dashboard.read', 'marketing.read', 'marketing.referrals', 'marketing.commissions')
    else false
  end;
end;
$$;

-- Extend the existing super-admin role assignment RPC without changing its
-- safety rules or self-promotion protections.
create or replace function public.super_admin_assign_admin_role(
  p_user_id uuid,
  p_admin_role text
)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare v_profile public.profiles; v_old_role text; v_old_admin_role text; v_role text;
begin
  if not public.is_super_admin() then raise exception 'Super administrators only'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'You cannot change your own administrator role'; end if;
  if p_admin_role not in ('none', 'super_admin', 'operations', 'support', 'finance', 'content', 'marketing_admin', 'sales_person') then raise exception 'Invalid administrator role'; end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if v_profile.id is null then raise exception 'User not found'; end if;
  v_old_role := v_profile.role; v_old_admin_role := v_profile.admin_role;
  v_role := case when p_admin_role = 'none' then 'owner' when p_admin_role = 'super_admin' then 'super_admin' else 'admin' end;
  update public.profiles set role = v_role, admin_role = p_admin_role where id = p_user_id returning * into v_profile;
  insert into public.admin_logs (admin_id, action, target_table, target_id, meta) values (auth.uid(), 'assign_admin_role', 'profiles', p_user_id, jsonb_build_object('from_role', v_old_role, 'from_admin_role', v_old_admin_role, 'to_role', v_role, 'to_admin_role', p_admin_role, 'target_platform_id', v_profile.platform_id));
  return v_profile;
end;
$$;

-- RLS: marketing data is visible only to the responsible role or super admin.
alter table public.marketing_referral_codes enable row level security;
alter table public.marketing_team_memberships enable row level security;
alter table public.marketing_attributions enable row level security;
alter table public.marketing_attribution_events enable row level security;
alter table public.marketing_commission_rules enable row level security;
alter table public.marketing_commission_ledger enable row level security;
alter table public.marketing_reminder_rules enable row level security;
alter table public.marketing_reminder_events enable row level security;

create policy marketing_referral_codes_select on public.marketing_referral_codes for select using (
  sales_person_id = auth.uid() or public.is_super_admin() or public.has_admin_permission('marketing.manage')
  or exists (select 1 from public.marketing_team_memberships tm where tm.sales_person_id = marketing_referral_codes.sales_person_id and tm.marketing_admin_id = auth.uid() and tm.ended_at is null)
);
create policy marketing_referral_codes_write on public.marketing_referral_codes for all using (
  public.is_super_admin() or public.has_admin_permission('marketing.manage') or (sales_person_id = auth.uid() and public.has_admin_permission('marketing.referrals'))
) with check (
  public.is_super_admin() or public.has_admin_permission('marketing.manage') or (sales_person_id = auth.uid() and public.has_admin_permission('marketing.referrals'))
);

create policy marketing_team_select on public.marketing_team_memberships for select using (
  public.is_super_admin() or sales_person_id = auth.uid() or marketing_admin_id = auth.uid()
);
create policy marketing_team_write on public.marketing_team_memberships for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy marketing_attributions_select on public.marketing_attributions for select using (
  owner_id = auth.uid() or sales_person_id = auth.uid() or marketing_admin_id = auth.uid() or public.is_super_admin()
);
create policy marketing_attributions_update_super on public.marketing_attributions for update using (public.is_super_admin()) with check (public.is_super_admin());

create policy marketing_attribution_events_select on public.marketing_attribution_events for select using (
  owner_id = auth.uid() or new_sales_person_id = auth.uid() or new_marketing_admin_id = auth.uid() or public.is_super_admin()
);

create policy marketing_rules_select on public.marketing_commission_rules for select using (
  public.has_admin_permission('marketing.commissions')
);
create policy marketing_rules_write on public.marketing_commission_rules for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy marketing_ledger_select on public.marketing_commission_ledger for select using (
  sales_person_id = auth.uid() or marketing_admin_id = auth.uid() or public.is_super_admin()
);
create policy marketing_ledger_update_super on public.marketing_commission_ledger for update using (public.is_super_admin()) with check (public.is_super_admin());

create policy marketing_reminder_rules_select on public.marketing_reminder_rules for select using (public.has_admin_permission('marketing.reminders'));
create policy marketing_reminder_rules_write on public.marketing_reminder_rules for all using (public.is_super_admin()) with check (public.is_super_admin());
create policy marketing_reminder_events_select on public.marketing_reminder_events for select using (public.is_super_admin());

revoke insert, update, delete on public.marketing_attribution_events from anon, authenticated;
revoke insert, update, delete on public.marketing_commission_ledger from anon, authenticated;
revoke insert, update, delete on public.marketing_reminder_events from anon, authenticated;

-- Existing owner accounts are direct/unassigned unless a future super-admin
-- attribution correction explicitly links them to a partner.
insert into public.marketing_attributions (owner_id, source)
select id, 'direct' from public.profiles where role = 'owner'
on conflict (owner_id) do nothing;
