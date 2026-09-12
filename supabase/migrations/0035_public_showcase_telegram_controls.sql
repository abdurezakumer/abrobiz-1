-- 0035_public_showcase_telegram_controls.sql
-- Public storefront discovery and one-chat-per-account Telegram controls.

-- A Telegram chat can belong to one AbroBiz connection at a time. Clear any
-- accidental duplicates before adding the unique guards; the oldest link is
-- retained and the later duplicate is safely disconnected.
with ranked as (
  select id, row_number() over (partition by telegram_chat_id order by linked_at asc nulls last, id) as rn
  from public.business_telegram_links
  where telegram_chat_id is not null and linked_at is not null
)
update public.business_telegram_links b
set telegram_chat_id = null, telegram_username = null, linked_at = null
from ranked r where r.id = b.id and r.rn > 1;

with ranked as (
  select id, row_number() over (partition by telegram_chat_id order by linked_at asc nulls last, id) as rn
  from public.admin_telegram_links
  where telegram_chat_id is not null and linked_at is not null
)
update public.admin_telegram_links a
set telegram_chat_id = null, telegram_username = null, linked_at = null
from ranked r where r.id = a.id and r.rn > 1;

create unique index if not exists business_telegram_chat_unique_idx
  on public.business_telegram_links (telegram_chat_id)
  where telegram_chat_id is not null and linked_at is not null;
create unique index if not exists admin_telegram_chat_unique_idx
  on public.admin_telegram_links (telegram_chat_id)
  where telegram_chat_id is not null and linked_at is not null;

create or replace function public.disconnect_telegram_connection(p_kind text)
returns boolean
language plpgsql
security definer set search_path = public, extensions
as $$
declare v_count integer := 0;
begin
  if p_kind = 'business' then
    update public.business_telegram_links l
    set telegram_chat_id = null, telegram_username = null, linked_at = null,
        link_token = encode(extensions.gen_random_bytes(16), 'hex')
    from public.businesses b
    where l.business_id = b.id and b.owner_id = auth.uid();
    get diagnostics v_count = row_count;
  elsif p_kind = 'admin' and public.is_admin() then
    update public.admin_telegram_links
    set telegram_chat_id = null, telegram_username = null, linked_at = null,
        link_token = encode(extensions.gen_random_bytes(16), 'hex')
    where admin_id = auth.uid();
    get diagnostics v_count = row_count;
  else
    raise exception 'Not authorized';
  end if;
  return v_count > 0;
end;
$$;

revoke all on function public.disconnect_telegram_connection(text) from public;
grant execute on function public.disconnect_telegram_connection(text) to authenticated;

-- Published-but-blocked businesses must never appear in public discovery or
-- storefront reads, while owners and authorized staff retain their access.
drop policy if exists "businesses_select" on public.businesses;
create policy "businesses_select" on public.businesses
  for select using ((is_published and not is_blocked) or owner_id = auth.uid() or public.has_admin_permission('businesses.read'));
