-- ============================================================================
-- 0007_subscription_cron.sql
-- Adds a column so reminders are sent once, then wires up a daily scheduled
-- job (pg_cron + pg_net, both Supabase-provided) that calls the
-- subscription-cron Edge Function.
--
-- pg_cron/pg_net aren't available in a plain local Postgres, so unlike the
-- other migrations this one can only be verified against a real Supabase
-- project, not this sandbox. Run it there.
-- ============================================================================

alter table public.subscriptions add column if not exists reminder_sent_at timestamptz;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ----------------------------------------------------------------------------
-- After running the block above, schedule the daily job SEPARATELY with your
-- own project ref and secret filled in (see SETUP.md Phase 3.5) — a
-- migration file is the wrong place for project-specific values and a
-- secret, so it isn't included here. The snippet to run looks like:
--
-- select cron.schedule(
--   'daily-subscription-check',
--   '0 3 * * *',  -- 03:00 UTC every day
--   $$
--   select net.http_post(
--     url := 'https://<YOUR_PROJECT_REF>.functions.supabase.co/subscription-cron',
--     headers := jsonb_build_object('Authorization', 'Bearer <YOUR_CRON_SECRET>'),
--     body := '{}'::jsonb
--   );
--   $$
-- );
-- ----------------------------------------------------------------------------
