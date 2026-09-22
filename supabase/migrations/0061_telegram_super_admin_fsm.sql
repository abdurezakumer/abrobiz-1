-- Persist the small amount of state needed by the private super-admin bot
-- console. All reads and writes are performed by the service-role webhook.

create table if not exists public.telegram_super_admin_sessions (
  telegram_chat_id text primary key,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  state text not null default 'menu'
    check (state in ('menu', 'awaiting_user_search')),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create index if not exists telegram_super_admin_sessions_admin_idx
  on public.telegram_super_admin_sessions (admin_id, updated_at desc);

alter table public.telegram_super_admin_sessions enable row level security;

-- No browser-facing policies are intentional. The Telegram webhook uses the
-- service role after it has independently verified the linked super-admin.
revoke all on public.telegram_super_admin_sessions from public, anon, authenticated;
