-- ============================================================================
-- 0007_subscription_cron.sql
-- Adds a column so reminders are sent once. The daily scheduled job is an
-- operational setup step (pg_cron + pg_net) and is not part of the core
-- migration chain because it requires project-specific URL and secret values.
--
-- pg_cron/pg_net are managed Supabase extensions and must be enabled in the
-- project before the separate scheduling SQL is run.
-- ============================================================================

alter table public.subscriptions add column if not exists reminder_sent_at timestamptz;

-- ----------------------------------------------------------------------------
-- Enable pg_cron and pg_net in the Supabase dashboard, then schedule the job
-- separately with your project ref and secret filled in (see SETUP.md Phase 3.5) — a
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
