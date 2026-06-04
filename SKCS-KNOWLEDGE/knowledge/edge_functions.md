# SKCS Edge Functions

## Current status

No Supabase Edge Functions were confirmed in the current repo scan.

## What is present instead

- Most orchestration lives in backend services and cron-driven Node.js jobs.
- Data ingestion, scoring, and publication are primarily handled through backend code plus Supabase SQL.

## What this file should capture later

- Function name.
- Trigger source.
- Inputs.
- Outputs.
- Dependencies.
- Cost impact.
- Failure behavior.

## Gap note

- If Edge Functions are added later, they should be inventoried here immediately so they do not become hidden infrastructure.
