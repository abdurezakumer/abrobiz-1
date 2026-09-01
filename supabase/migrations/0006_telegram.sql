-- ============================================================================
-- 0006_telegram.sql
-- Tables supporting the Telegram bot: admins link their own chat the same
-- way business owners do, and a small state table lets the (stateless) bot
-- webhook remember where an owner is mid-conversation (pick plan -> pick
-- payment method -> send photo) between separate function invocations.
-- ============================================================================

create table public.admin_telegram_links (
  id uuid primary key default extensions.gen_random_uuid(),
  admin_id uuid not null unique references public.profiles (id) on delete cascade,
  telegram_chat_id text,
  telegram_username text,
  link_token text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  linked_at timestamptz
);

alter table public.admin_telegram_links enable row level security;

create policy "admin_telegram_links_select" on public.admin_telegram_links
  for select using (admin_id = auth.uid() or public.is_admin());

create policy "admin_telegram_links_insert" on public.admin_telegram_links
  for insert with check (admin_id = auth.uid());

create policy "admin_telegram_links_update" on public.admin_telegram_links
  for update using (admin_id = auth.uid() or public.is_admin());

-- Ephemeral per-chat conversation state for the /pay flow. Only ever
-- touched by the Edge Function (service role), so no client-facing
-- policies are needed — RLS is enabled with zero policies, which denies
-- all access except to service_role (which bypasses RLS entirely).
create table public.telegram_pending_actions (
  telegram_chat_id text primary key,
  business_id uuid references public.businesses (id) on delete cascade,
  plan_id uuid references public.plans (id),
  payment_method_id uuid references public.payment_methods (id),
  updated_at timestamptz not null default now()
);

alter table public.telegram_pending_actions enable row level security;
