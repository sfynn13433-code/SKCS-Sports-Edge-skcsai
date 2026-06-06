# BSD Governance Hold

**Status:** **LIFTED** — field-level audit complete (2026-06-11)  
**Opened:** 2026-06-06  
**Closed:** 2026-06-11  
**Owner:** SKCS Governance Layer

## Merge gate — complete

- [x] **1. Full JSON payload capture** — odds/comparison, polymarket, lineups
- [x] **2. Field inventory** — see `../providers/bzzoiro_field_audit.md`
- [x] **3. Canonical mapping verification** — `../providers/bzzoiro_provider_mapping.md` updated
- [x] **4. Governance scoring per field** — Pred / Rel / Gov scores locked
- [x] **5. Final approval matrix** — Approved / Restricted / Blocked per field

## Promotion sequence — executed

```text
Field audit complete          ✅
Registry files updated        ✅
Final governance review       ✅
Commit to deploy/main         ✅ (pending push)
Phase 3 sandboxed adapter     ✅ backend/providers/football/bzzoiroProvider.js
```

## Runtime constraints (remain in force)

- BSD is **ENRICHMENT + VERIFICATION** only — never canonical primary
- Adapter gated: `ENABLE_BZZOIRO_PROVIDER=true` + `BZZOIRO_API_TOKEN`
- Blocked endpoints hard-disabled in `bzzoiroApiClient.js`
- `confidence` / `ai_score` → verification lane only in normalizer

## Sign-off

| Reviewer | Date | Decision |
|----------|------|----------|
| SKCS Governance Layer | 2026-06-11 | **Approved for deploy/main** (governance docs + sandboxed adapter) |
