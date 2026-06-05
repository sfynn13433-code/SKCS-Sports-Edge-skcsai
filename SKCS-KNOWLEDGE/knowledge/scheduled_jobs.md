# SKCS Scheduled Jobs

## Known backend schedules

- `backend/services/cronJobs.js`
  - Contains recurring Node cron jobs for operational sync.
- `backend/services/skcsHeartbeat.js`
  - Uses intervals for pre-match metadata refresh; live-score, trends, and news refresh are disabled in pre-match-only mode.
- `scripts/external-scheduler.js`
  - Holds additional scheduled background actions.
- `scripts/scheduler.js`
  - Local scheduler helper used for recurring tasks.

## Supabase cron references

- `supabase/migrations/20260822000001_add_partitioning.sql`
  - Contains a `cron.schedule(...)` example for partition maintenance.
- `supabase/migrations/20260822000004_create_materialized_admin_views.sql`
  - Includes refresh helpers for admin materialized views.

## What to record for each job

- Name.
- Schedule.
- Purpose.
- Dependencies.
- Failure impact.
- Whether it is production critical.

## Current operational note

- Scheduled jobs should be treated as part of the engine, not as optional convenience scripts.
- If a job costs API calls, that cost should be documented here and in the provider registry, with pre-match-only defaults preferred over live polling.
