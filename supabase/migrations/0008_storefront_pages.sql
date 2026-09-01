-- ============================================================================
-- 0008_storefront_pages.sql
-- Supports the multi-page storefront (Home / Menu / About / Contact):
-- richer About content + a photo gallery per business, a "featured" flag on
-- items for the Home page highlight strip, and a real contact form that
-- lands in the owner's dashboard as a message + notification.
-- ============================================================================

alter table public.businesses add column if not exists about_content text not null default '';
alter table public.businesses add column if not exists gallery_urls text[] not null default '{}';

alter table public.items add column if not exists is_featured boolean not null default false;

create table public.contact_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index contact_messages_business_id_idx on public.contact_messages (business_id, created_at desc);

alter table public.contact_messages enable row level security;

-- Anyone can submit a message to a published, non-blocked business — this is
-- the public contact form, so it must work for anonymous visitors.
create policy "contact_messages_public_insert" on public.contact_messages
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.is_published and not b.is_blocked)
  );

create policy "contact_messages_select_own_or_admin" on public.contact_messages
  for select using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

create policy "contact_messages_update_own_or_admin" on public.contact_messages
  for update using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- Notify the owner in-app whenever a message comes in.
create function public.notify_owner_of_contact_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_business_name text;
begin
  select owner_id, name into v_owner, v_business_name from public.businesses where id = new.business_id;
  if v_owner is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_owner, 'contact_message', 'New message from ' || new.name,
            left(new.message, 140), '/dashboard/messages');
  end if;
  return new;
end;
$$;

create trigger contact_messages_notify_owner
  after insert on public.contact_messages
  for each row execute function public.notify_owner_of_contact_message();
