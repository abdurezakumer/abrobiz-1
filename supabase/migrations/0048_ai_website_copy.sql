-- AI website copy is a presentation draft layered over the existing business
-- facts. It never replaces owner-managed business or catalog data.
create table public.ai_website_copy_generations (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  language text not null check (language in ('en', 'am', 'or')),
  tone text not null check (tone in ('professional', 'premium', 'friendly', 'modern', 'minimal', 'persuasive')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED', 'ARCHIVED')),
  content jsonb not null default '{}'::jsonb,
  source_hash text not null,
  model text not null,
  generation_version text not null default '1.0.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_copy_business_status_created_idx
  on public.ai_website_copy_generations (business_id, status, created_at desc);
create index ai_copy_owner_created_idx
  on public.ai_website_copy_generations (owner_id, created_at desc);

alter table public.ai_website_copy_generations enable row level security;

create policy "ai_copy_owner_select" on public.ai_website_copy_generations
  for select using (
    owner_id = auth.uid()
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "ai_copy_owner_insert" on public.ai_website_copy_generations
  for insert with check (
    owner_id = auth.uid()
    and status = 'DRAFT'
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "ai_copy_owner_update" on public.ai_website_copy_generations
  for update using (
    owner_id = auth.uid()
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  ) with check (
    owner_id = auth.uid()
    and status = 'DRAFT'
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- Public visitors may read only approved copy for a live, unblocked site.
-- The table contains generated presentation text only, not private owner data.
create policy "ai_copy_public_approved_select" on public.ai_website_copy_generations
  for select using (
    status = 'APPROVED'
    and exists (
      select 1 from public.businesses b
      where b.id = business_id and b.is_published and not b.is_blocked
    )
  );

create or replace function public.approve_ai_website_copy(p_generation_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_business_id uuid;
  v_owner_id uuid;
  v_result jsonb;
begin
  select business_id, owner_id into v_business_id, v_owner_id
  from public.ai_website_copy_generations
  where id = p_generation_id;

  if v_business_id is null or v_owner_id <> auth.uid()
     or not exists (select 1 from public.businesses b where b.id = v_business_id and b.owner_id = auth.uid()) then
    raise exception 'Generation not found or not authorized';
  end if;

  update public.ai_website_copy_generations
  set status = 'ARCHIVED', updated_at = now()
  where business_id = v_business_id and status = 'APPROVED' and id <> p_generation_id;

  update public.ai_website_copy_generations
  set status = 'APPROVED', updated_at = now()
  where id = p_generation_id and status = 'DRAFT'
  returning jsonb_build_object(
    'id', id,
    'business_id', business_id,
    'language', language,
    'tone', tone,
    'status', status,
    'content', content,
    'created_at', created_at,
    'updated_at', updated_at
  ) into v_result;

  if v_result is null then raise exception 'Only a draft can be approved'; end if;
  return v_result;
end;
$$;

revoke all on function public.approve_ai_website_copy(uuid) from public, anon;
grant execute on function public.approve_ai_website_copy(uuid) to authenticated;

create or replace function public.touch_ai_website_copy_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger ai_website_copy_updated_at
  before update on public.ai_website_copy_generations
  for each row execute function public.touch_ai_website_copy_updated_at();
