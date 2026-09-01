-- 0017_templates.sql
-- Admin-managed, manifest-driven storefront templates. A GitHub repository is
-- imported as metadata/configuration; arbitrary repository code is never run in
-- the browser or in an Edge Function.

create table if not exists public.templates (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  repo_url text,
  preview_url text,
  config jsonb not null default '{}'::jsonb,
  is_builtin boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists templates_active_sort_idx on public.templates (is_active, sort_order, name);
alter table public.templates enable row level security;

drop policy if exists "templates_public_read_active" on public.templates;
create policy "templates_public_read_active" on public.templates
  for select using (is_active or public.is_admin());

drop policy if exists "templates_admin_insert" on public.templates;
create policy "templates_admin_insert" on public.templates
  for insert with check (public.is_admin());

drop policy if exists "templates_admin_update" on public.templates;
create policy "templates_admin_update" on public.templates
  for update using (public.is_admin());

drop policy if exists "templates_admin_delete" on public.templates;
create policy "templates_admin_delete" on public.templates
  for delete using (public.is_admin());

insert into public.templates (slug, name, description, config, is_builtin, sort_order)
values
  ('modern-dark', 'Modern Dark', 'Bold, moody, great for evening and nightlife businesses.',
    '{"bg":"#111318","card":"#191C22","text":"#F5F3EF","textDim":"rgba(245,243,239,0.55)","border":"rgba(255,255,255,0.08)","heroBg":"#0A0C10"}'::jsonb, true, 10),
  ('clean-minimal', 'Clean Minimal', 'Light, crisp, and suitable for almost any business.',
    '{"bg":"#FBFAF8","card":"#FFFFFF","text":"#161616","textDim":"rgba(22,22,22,0.55)","border":"rgba(22,22,22,0.08)","heroBg":"#F6F3EE"}'::jsonb, true, 20),
  ('traditional-warm', 'Traditional Warm', 'Earthy tones with a welcoming, culturally rich feel.',
    '{"bg":"#3E2A1C","card":"#4A3323","text":"#F5EDE0","textDim":"rgba(245,237,224,0.6)","border":"rgba(245,237,224,0.12)","heroBg":"#2E1F15"}'::jsonb, true, 30)
on conflict (slug) do nothing;

