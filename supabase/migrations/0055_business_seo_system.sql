-- AbroBiz SEO metadata, deterministic initialization, and crawl-safe public RPCs.
-- This migration is intentionally additive and idempotent. It does not change
-- authentication, payment, subscription, or tenant ownership rules.

alter table public.businesses
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_image_url text,
  add column if not exists seo_indexing_enabled boolean not null default true,
  add column if not exists seo_title_source text not null default 'automatic',
  add column if not exists seo_description_source text not null default 'automatic',
  add column if not exists seo_image_source text not null default 'automatic',
  add column if not exists seo_content_version integer not null default 1,
  add column if not exists seo_last_generated_at timestamptz;

update public.businesses
set seo_title_source = 'automatic'
where seo_title_source is null;

update public.businesses
set seo_description_source = 'automatic'
where seo_description_source is null;

update public.businesses
set seo_image_source = 'automatic'
where seo_image_source is null;

alter table public.businesses
  drop constraint if exists businesses_seo_title_source_check,
  drop constraint if exists businesses_seo_description_source_check,
  drop constraint if exists businesses_seo_image_source_check;

alter table public.businesses
  add constraint businesses_seo_title_source_check
    check (seo_title_source in ('automatic', 'owner_customized', 'ai_generated', 'admin_managed')),
  add constraint businesses_seo_description_source_check
    check (seo_description_source in ('automatic', 'owner_customized', 'ai_generated', 'admin_managed')),
  add constraint businesses_seo_image_source_check
    check (seo_image_source in ('automatic', 'owner_customized', 'ai_generated', 'admin_managed')),
  add constraint businesses_seo_title_length_check
    check (seo_title is null or char_length(seo_title) <= 160),
  add constraint businesses_seo_description_length_check
    check (seo_description is null or char_length(seo_description) <= 500),
  add constraint businesses_seo_image_url_length_check
    check (seo_image_url is null or char_length(seo_image_url) <= 2048);

create index if not exists businesses_seo_index_idx
  on public.businesses (is_published, is_blocked, seo_indexing_enabled, slug);

create index if not exists subscriptions_business_status_end_idx
  on public.subscriptions (business_id, status, end_date);

-- Automatic SEO is factual and deliberately modest. The browser can derive
-- the same values immediately, while this function gives activation/backfill
-- workflows a durable, idempotent record without overwriting custom fields.
create or replace function public.initialize_business_seo(p_business_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.businesses b
  set seo_title = case
        when b.seo_title_source = 'automatic' or b.seo_title is null then
          left(trim(b.name || case when coalesce(c.label, '') <> '' and lower(c.label) <> 'business' then ' | ' || c.label else ' | AbroBiz' end), 160)
        else b.seo_title
      end,
      seo_description = case
        when b.seo_description_source = 'automatic' or b.seo_description is null then
          left(coalesce(nullif(trim(b.description), ''), nullif(trim(b.about_content), ''), trim(b.name) || ' on AbroBiz. Visit the official storefront for current information and contact details.'), 500)
        else b.seo_description
      end,
      seo_content_version = coalesce(b.seo_content_version, 1) + 1,
      seo_last_generated_at = now(),
      updated_at = now()
  from public.business_categories c
  where b.id = p_business_id
    and c.id is not distinct from b.category_id;

  -- Businesses without a category still receive deterministic SEO.
  update public.businesses b
  set seo_title = case
        when b.seo_title_source = 'automatic' or b.seo_title is null then left(trim(b.name || ' | AbroBiz'), 160)
        else b.seo_title
      end,
      seo_description = case
        when b.seo_description_source = 'automatic' or b.seo_description is null then
          left(coalesce(nullif(trim(b.description), ''), nullif(trim(b.about_content), ''), trim(b.name) || ' on AbroBiz. Visit the official storefront for current information and contact details.'), 500)
        else b.seo_description
      end,
      seo_content_version = coalesce(b.seo_content_version, 1) + 1,
      seo_last_generated_at = now(),
      updated_at = now()
  where b.id = p_business_id
    and b.category_id is null;
end;
$$;

revoke all on function public.initialize_business_seo(uuid) from public;

-- Activation and factual business edits refresh only automatic fields. Owner
-- customizations remain untouched, including during repeated webhook retries.
create or replace function public.refresh_business_seo_after_business_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.initialize_business_seo(new.id);
  return new;
end;
$$;

drop trigger if exists businesses_refresh_automatic_seo on public.businesses;
create trigger businesses_refresh_automatic_seo
  after update of name, description, about_content, category_id, is_published on public.businesses
  for each row execute function public.refresh_business_seo_after_business_change();

create or replace function public.refresh_business_seo_after_subscription_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status in ('trial', 'active') and new.end_date >= current_date then
    perform public.initialize_business_seo(new.business_id);
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_refresh_automatic_seo on public.subscriptions;
create trigger subscriptions_refresh_automatic_seo
  after insert or update of status, end_date, plan_id on public.subscriptions
  for each row execute function public.refresh_business_seo_after_subscription_change();

-- Safe, idempotent existing-business backfill. It writes only fields that are
-- still automatic/default and never changes publication or indexing state.
do $$
declare
  item record;
begin
  for item in select id from public.businesses loop
    perform public.initialize_business_seo(item.id);
  end loop;
end;
$$;

-- Public tenant SEO data contains only storefront fields already intended for
-- public display. It never returns owner IDs, payment data, attribution, or
-- internal/admin fields. The subscription predicate is the authoritative
-- activation check used by the existing entitlement function.
create or replace function public.get_public_business_seo(p_slug text)
returns jsonb
language sql
security definer stable set search_path = public
as $$
  select jsonb_build_object(
    'name', b.name,
    'slug', b.slug,
    'description', b.description,
    'aboutContent', b.about_content,
    'logoUrl', b.logo_url,
    'coverUrl', b.cover_url,
    'phone', b.phone,
    'email', b.email,
    'address', b.address,
    'mapsUrl', b.maps_url,
    'social', coalesce(b.social, '{}'::jsonb),
    'openingHours', coalesce(b.opening_hours, '{}'::jsonb),
    'isPublished', b.is_published,
    'isBlocked', b.is_blocked,
    'seoTitle', b.seo_title,
    'seoDescription', b.seo_description,
    'seoImageUrl', b.seo_image_url,
    'seoIndexingEnabled', coalesce(b.seo_indexing_enabled, true),
    'category', jsonb_build_object('slug', c.slug, 'label', c.label)
  )
  from public.businesses b
  left join public.business_categories c on c.id = b.category_id
  where b.slug = lower(trim(p_slug))
    and b.is_published
    and not b.is_blocked
    and exists (
      select 1
      from public.subscriptions s
      join public.plans p on p.id = s.plan_id
      where s.business_id = b.id
        and s.status in ('trial', 'active')
        and s.end_date >= current_date
    );
$$;

revoke all on function public.get_public_business_seo(text) from public;
grant execute on function public.get_public_business_seo(text) to anon, authenticated;

create or replace function public.list_indexable_businesses(p_limit integer default 500, p_offset integer default 0)
returns table(slug text, updated_at timestamptz)
language sql
security definer stable set search_path = public
as $$
  select b.slug, b.updated_at
  from public.businesses b
  where b.is_published
    and not b.is_blocked
    and coalesce(b.seo_indexing_enabled, true)
    and exists (
      select 1
      from public.subscriptions s
      join public.plans p on p.id = s.plan_id
      where s.business_id = b.id
        and s.status in ('trial', 'active')
        and s.end_date >= current_date
    )
  order by b.updated_at desc, b.slug asc
  limit greatest(1, least(coalesce(p_limit, 500), 1000))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_indexable_businesses(integer, integer) from public;
grant execute on function public.list_indexable_businesses(integer, integer) to anon, authenticated;

create or replace function public.count_indexable_businesses()
returns bigint
language sql
security definer stable set search_path = public
as $$
  select count(*)
  from public.businesses b
  where b.is_published
    and not b.is_blocked
    and coalesce(b.seo_indexing_enabled, true)
    and exists (
      select 1
      from public.subscriptions s
      join public.plans p on p.id = s.plan_id
      where s.business_id = b.id
        and s.status in ('trial', 'active')
        and s.end_date >= current_date
    );
$$;

revoke all on function public.count_indexable_businesses() from public;
grant execute on function public.count_indexable_businesses() to anon, authenticated;
