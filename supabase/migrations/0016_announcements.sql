-- ============================================================================
-- 0016_announcements.sql
-- Admin -> all business owners broadcast email. No service role needed here
-- at all: admins can already read every profile (profiles_select_own_or_admin
-- already covers it), so the sending Edge Function runs entirely on the
-- calling admin's own session — the least-privileged option available.
-- ============================================================================

create table public.announcements (
  id uuid primary key default extensions.gen_random_uuid(),
  admin_id uuid references public.profiles (id),
  subject text not null,
  body text not null,
  audience text not null default 'all_owners' check (audience in ('all_owners')),
  recipient_count int not null default 0,
  created_at timestamptz not null default now()
);

create index announcements_created_at_idx on public.announcements (created_at desc);

alter table public.announcements enable row level security;

create policy "announcements_admin_select" on public.announcements
  for select using (public.is_admin());

create policy "announcements_admin_insert" on public.announcements
  for insert with check (public.is_admin());
