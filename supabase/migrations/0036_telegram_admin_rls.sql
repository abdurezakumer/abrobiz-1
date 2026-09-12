-- 0036_telegram_admin_rls.sql
-- Telegram link tokens are account credentials. A normal administrator may
-- manage only its own link; only a super administrator can inspect or manage
-- another administrator's link.

drop policy if exists "admin_telegram_links_select" on public.admin_telegram_links;
create policy "admin_telegram_links_select" on public.admin_telegram_links
  for select using (admin_id = auth.uid() or public.is_super_admin());

drop policy if exists "admin_telegram_links_insert" on public.admin_telegram_links;
create policy "admin_telegram_links_insert" on public.admin_telegram_links
  for insert with check (admin_id = auth.uid() and public.is_admin());

drop policy if exists "admin_telegram_links_update" on public.admin_telegram_links;
create policy "admin_telegram_links_update" on public.admin_telegram_links
  for update using (admin_id = auth.uid() or public.is_super_admin())
  with check (admin_id = auth.uid() or public.is_super_admin());
