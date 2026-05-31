# SKCS Engine V2 — Phase 0b.5 Canonical Replay Engine

## Version: 1.0

## Status: ACTIVE DESIGN CONTRACT (next build)

**Depends on:** `docs/canonical_ingest_firewall.spec.md` (Phase -0.5)  
**Blocks:** Phase 0b `match_results` at scale, Phase 1 `team_strength_params`

---

## 1. What the firewall achieved (and did not)

### Achieved — forward protection

| Capability | Status |
|------------|--------|
| Block Odds API → canonical | ✅ `canonicalIngestFirewall.js` |
| API-Sports shape gate | ✅ |
| Rejection observability | ✅ `byReason` stats |

### Not achieved — backward guarantee

| Capability | Status |
|------------|--------|
| Past canonical rows are correct | ❌ ~81% historical Odds-shaped rows |
| Replay-safe truth layer | ❌ no rebuild yet |
| Deterministic V2 recompute from scratch | ❌ |
| Historical consistency / audit trail | ❌ no `replay_run_id` |

> **You can prevent future corruption. You cannot yet guarantee past correctness or reproducibility.**

The firewall is **data sovereignty at the front door**, not a time machine.

---

## 2. System framing (locked)

SKCS is now a **data sovereignty layer for sports intelligence**, not a Poisson system yet.

```text
V1 = live prediction pipeline (production, unchanged)
V2 foundation = controlled data authority + enforced truth boundary
V2 math = downstream of sovereignty (not started)
```

---

## 3. Next tension after firewall (API-Sports SPOF)

Phase -0.5 solved **correctness vs mixing**.

Phase 0+ introduces **completeness vs correctness**:

| Risk | Mitigation |
|------|------------|
| Goals update latency | Finished refresh job (`fixtures?id=`) |
| Partial league coverage | Explicit `FOOTBALL_REPLAY_LEAGUES` list |
| League ID mismatch (TheSportsDB 4328 ≠ API-Sports 39) | Replay uses **API-Sports league IDs only** |
| 100 calls/day budget | Date-batched replay + league priority tiers |

---

## 4. Phase 0b.5 — Canonical replay engine

### 4.1 Purpose

```text
rebuild_canonical_from_api_sports(start_date, end_date)
```

Rebuild the football truth layer **deterministically** from API-Sports so that:

1. Historical Odds-shaped canonical rows are superseded or quarantined
2. Every canonical row passes the firewall
3. V2 can be recomputed from a known baseline (`replay_run_id`)

### 4.2 Non-goals

- Does not touch `events` (Odds market layer)
- Does not run Poisson or publish predictions
- Does not use `events.home_team` for identity

### 4.3 Inputs

| Parameter | Description |
|-----------|-------------|
| `start_date` | UTC date `YYYY-MM-DD` (inclusive) |
| `end_date` | UTC date `YYYY-MM-DD` (inclusive) |
| `league_ids` | API-Sports league IDs (default: tier-1 football list) |
| `season` | API-Sports season year (e.g. `2025`) |
| `mode` | `merge` (default) or `replace_window` |

### 4.4 Default football leagues (API-Sports IDs)

| League | API-Sports `league` id |
|--------|------------------------|
| Premier League | 39 |
| La Liga | 140 |
| Bundesliga | 78 |
| Serie A | 135 |
| Ligue 1 | 61 |

**Do not use** TheSportsDB IDs (`4328`, etc.) in replay — those are a different provider namespace.

### 4.5 Algorithm

```text
FOR each league_id IN league_ids:
  FOR each date IN date_range(start_date, end_date):
    CALL API-Sports GET /fixtures?league=&season=&date=
    FOR each fixture IN response:
      payload = full response element (unchanged)
      IF canonicalIngestFirewall.evaluateCanonicalIngest({ raw_provider_data: payload }) accepts:
        UPSERT football_canonical_events
          provider_name = 'api-sports'
          provider_event_id = fixture.id
          raw_provider_data = payload (full JSON)
          replay_run_id = :run_id
          replayed_at = now()
      ELSE:
        log reject reason

AFTER window ingest (optional second pass):
  FOR each finished fixture in window missing goals:
    CALL GET /fixtures?id=fixture_id
    MERGE goals + status into raw_provider_data
```

### 4.6 API budget discipline

With ~100 calls/day/sport:

| Strategy | Calls per full tier-1 day sweep |
|----------|----------------------------------|
| 5 leagues × 1 date | 5 |
| 5 leagues × 30 days | 150 (multi-day replay needs scheduling) |

**Rule:** Replay is a **scheduled backfill job**, not per-sync fan-out. Run nightly with `--max-days=1` or prioritize leagues.

### 4.7 Idempotency

- Upsert key: `(provider_name, sport, provider_event_id)` or `fixture.id`
- Same fixture re-fetched → overwrites `raw_provider_data` + `replayed_at`
- Same logical match → same `fixture.id` (API-Sports stable)

### 4.8 Quarantine legacy pollution (recommended)

Before or after first replay:

```sql
-- Option A: archive non-api-sports rows
UPDATE football_canonical_events
SET metadata = metadata || '{"quarantined": true, "reason": "pre_firewall_odds_shape"}'::jsonb
WHERE provider_name IS DISTINCT FROM 'api-sports'
   OR NOT (raw_provider_data ? 'fixture' AND raw_provider_data ? 'teams');

-- Option B: move to football_canonical_events_quarantine table (migration)
```

Do **not** delete until integrity audit passes on replacement volume.

### 4.9 Schema additions (migration)

```sql
ALTER TABLE football_canonical_events
  ADD COLUMN IF NOT EXISTS replay_run_id UUID,
  ADD COLUMN IF NOT EXISTS replayed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS canonical_replay_runs (
  id UUID PRIMARY KEY DEFAULT gen_gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leagues JSONB NOT NULL DEFAULT '[]',
  fixtures_fetched INT DEFAULT 0,
  fixtures_accepted INT DEFAULT 0,
  fixtures_rejected INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running'
);
```

### 4.10 Success gates (0b.5 complete)

| Gate | Target |
|------|--------|
| `provider_name = 'api-sports'` on active canonical rows | ≥ 95% → 100% |
| Odds-shaped rows in active canonical set | 0% |
| Rows with `fixture.id` + `teams.*.id` | ≥ 95% |
| Finished rows in window with goals in JSON | ≥ 95% |
| Replay run logged with counts | required |

**Probe:** `node scripts/audit-v2-provider-coverage.js`

---

## 5. Phase 0b — Match results (after 0b.5)

### Function

```text
build_match_results_from_canonical(start_date, end_date)
```

### Rules

- Source: `football_canonical_events` only
- `evaluateCanonicalIngest(..., { requireGoals: true })` for finished status
- Map teams via `upsert_skcs_team_from_provider` / `team_identity_map`
- **Never** read `events` for scores or identity

### Output

Upsert `match_results` with `source_table = 'football_canonical_events'`.

SQL function already sketched: `ingest_match_results_from_football_canonical()` — run only after replay gates pass.

---

## 6. Historical integrity audit (required checklist)

```sql
-- canonical_source_distribution
SELECT
  COALESCE(provider_name, '(null)') AS provider,
  COUNT(*)::int AS n,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM football_canonical_events
WHERE COALESCE(metadata->>'quarantined', 'false') <> 'true'
GROUP BY 1
ORDER BY n DESC;

-- shape check
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (
    WHERE raw_provider_data ? 'fixture'
      AND raw_provider_data ? 'teams'
      AND raw_provider_data #>> '{teams,home,id}' IS NOT NULL
  )::int AS apisports_shape,
  COUNT(*) FILTER (
    WHERE raw_provider_data ? 'bookmakers'
      OR raw_provider_data ? 'sport_key'
  )::int AS odds_shape
FROM football_canonical_events
WHERE COALESCE(metadata->>'quarantined', 'false') <> 'true';
```

**Expected after replay:** `api-sports` → 100%, `odds_shape` → 0.

---

## 7. Locked sequence (no debate)

```text
Phase -0.5   Firewall (DONE)
Phase 0b.5   rebuild_canonical_from_api_sports + quarantine legacy
Phase 0      team_identity_map (provider IDs from canonical JSON)
Phase 0b     build_match_results_from_canonical
Phase 1      team_strength_params
...
```

V1 production pipeline continues in parallel; V2 training reads only post-replay canonical + `match_results`.

---

## 8. Implementation artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Firewall spec | `docs/canonical_ingest_firewall.spec.md` | ✅ |
| Firewall runtime | `backend/services/canonicalIngestFirewall.js` | ✅ |
| Replay design | `docs/SKCS_ENGINE_V2_PHASE0B5_REPLAY.md` | ✅ this doc |
| Replay script | `scripts/rebuild-canonical-from-api-sports.js` | 🔲 skeleton |
| Integrity audit | `scripts/audit-v2-provider-coverage.js` | ✅ extend |

---

## 9. One-sentence contract

> Firewall separates football truth from betting perception; **replay** makes that separation **true historically**, not only for new rows.

Without 0b.5, V2 mathematics cannot be trustworthy — only directionally correct.
