
## SKCS-INFRA-001 — Supabase Decomposition & Migration Programme (FROZEN — 2026-06-18)

### Status: Active Migration Project
### Governance: Separate initiative — no feature development in Scout or Edge until Phase 1 complete.

### Phase Plan:
- Phase 0 (NOW): Freeze all feature work. No new schemas, no new migrations, no new endpoints.
- Phase 1: Replace Supabase PostgreSQL with Neon.
- Phase 2: Replace pg_cron / pg_net / Edge Functions with Render cron jobs.
- Phase 3: Introduce Directus for Scout human review.
- Phase 4: Google Drive as cold archive / knowledge layer.
- Phase 5: Render standardization (all execution on Render).
- Phase 6: Vercel unchanged.
- Phase 7: Auth migration (Appwrite, final phase).
- Phase 8: Payments migration (Stripe, final phase).

### Extensions to drop:
- supabase_vault (unused, both projects)
- pg_cron (Test only, replaced by Render cron)
- pg_net (Test only, replaced by Node HTTP)
