# SKCS Semantic Drift Monitoring & Enforcement Control Plane
## Implementation Blueprint v1.0

---

## 1. Executive Summary

The semantic layer has moved from documentation to runtime enforcement. The `semantic_violations` ledger is now recording every blocked field, missing identity, and forbidden context injection. This blueprint defines the endpoint, dashboard, and Layer 5 control-plane integration that turn that ledger into an operational safety system, a self-governing mechanism that prevents silent model drift, provider schema breaks, and enrichment hallucination from ever reaching the prediction engine without explicit approval.

All components integrate with the existing `backend/semantic-layer/enforcementGuard.js`, `backend/services/aiPipeline.js`, and Supabase backend.

---

## 2. Semantic Drift Summary Endpoint

### 2.1 Location
- **Supabase Edge Function:** `supabase/functions/semantic-drift-summary/index.ts`
- **Exposed as:** `GET https://<project>.functions.supabase.co/semantic-drift-summary`

### 2.2 Request Parameters
| Param | Type | Default | Description |
|---|---|---|---|
| `since` | ISO8601 | `now() - 24h` | Start of aggregation window |
| `pipeline` | string | `null` (all) | Filter by pipeline name (e.g., `aiPipeline`) |
| `provider` | string | `null` (all) | Filter by data provider (e.g., `sportsdataio`) |

### 2.3 Response Contract
```json
{
  "window": {
    "from": "2026-06-03T00:00:00Z",
    "to": "2026-06-04T00:00:00Z"
  },
  "total_violations": 23,
  "by_severity": {
    "critical": 2,
    "warning": 15,
    "info": 6
  },
  "by_type": {
    "UNKNOWN_FIELD": 10,
    "FORBIDDEN_CONTEXT": 3,
    "MISSING_CANONICAL_ID": 2,
    "INVALID_STATUS": 5,
    "INJURY_BOUNDARY_BREACH": 3
  },
  "drift_velocity": {
    "per_hour_last_24h": [0,0,0,2,1,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    "trend": "rising"
  },
  "rule_failure_heatmap": [
    { "rule_id": "FIELD_NOT_IN_REGISTRY", "field_path": "payload.weather", "count": 12 },
    { "rule_id": "MISSING_CANONICAL_ID", "count": 2 }
  ],
  "provider_drift": [
    {
      "provider": "sportsdataio",
      "new_field_intrusions": ["weather"],
      "missing_canonical_ids": 2
    }
  ],
  "degraded_flag": true,
  "recent_criticals": [
    {
      "occurred_at": "2026-06-04T08:12:00Z",
      "pipeline": "aiPipeline",
      "violation_type": "MISSING_CANONICAL_ID",
      "message": "Item has no canonical GameId and will be quarantined",
      "context": { "provider_id": "xyz" }
    }
  ]
}
```

### 2.4 Database Function (PL/pgSQL)
Deploy via migration `supabase/migrations/20260822000013_semantic_violation_summary.sql`.

```sql
create or replace function get_semantic_violation_summary(
  since_ts timestamptz,
  pipeline_filter text default null,
  provider_filter text default null
)
returns jsonb
language plpgsql stable
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'window', jsonb_build_object('from', since_ts, 'to', now()),
    'total_violations', count(*),
    'by_severity', coalesce(jsonb_object_agg(severity, cnt), '{}'),
    'by_type', coalesce(jsonb_object_agg(violation_type, cnt_type), '{}'),
    'drift_velocity', (
      select coalesce(array_agg(h.cnt order by h.hour), array_fill(0, array[24]))
      from (
        select date_trunc('hour', occurred_at) as hour, count(*) as cnt
        from semantic_violations
        where occurred_at >= since_ts
          and (pipeline_filter is null or pipeline = pipeline_filter)
          and (provider_filter is null or context->>'provider' = provider_filter)
        group by hour
        order by hour
      ) h
    ),
    'trend', (
      case
        when coalesce(sum(case when occurred_at < since_ts + interval '12h' then 1 else 0 end),0) <
             coalesce(sum(case when occurred_at >= since_ts + interval '12h' then 1 else 0 end),0)
        then 'rising'
        when coalesce(sum(case when occurred_at < since_ts + interval '12h' then 1 else 0 end),0) >
             coalesce(sum(case when occurred_at >= since_ts + interval '12h' then 1 else 0 end),0)
        then 'falling'
        else 'stable'
      end
    ),
    'rule_failure_heatmap', (
      select coalesce(jsonb_agg(r), '[]')
      from (
        select rule_id, field_path, count(*) as count
        from semantic_violations
        where occurred_at >= since_ts
          and (pipeline_filter is null or pipeline = pipeline_filter)
        group by rule_id, field_path
        order by count desc
      ) r
    ),
    'provider_drift', (
      select coalesce(jsonb_agg(pd), '[]')
      from (
        select context->>'provider' as provider,
               array_agg(distinct raw_value->>'field_name') filter (where violation_type = 'UNKNOWN_FIELD' and raw_value ? 'field_name') as new_field_intrusions,
               count(*) filter (where violation_type = 'MISSING_CANONICAL_ID') as missing_canonical_ids
        from semantic_violations
        where occurred_at >= since_ts
          and (pipeline_filter is null or pipeline = pipeline_filter)
        group by context->>'provider'
      ) pd
    ),
    'degraded_flag', exists (
      select 1 from semantic_violations
      where occurred_at >= since_ts and severity = 'critical'
    ),
    'recent_criticals', (
      select coalesce(jsonb_agg(c), '[]')
      from (
        select occurred_at, pipeline, violation_type, message, context
        from semantic_violations
        where occurred_at >= since_ts and severity = 'critical'
        order by occurred_at desc limit 10
      ) c
    )
  ) into result
  from semantic_violations
  where occurred_at >= since_ts
    and (pipeline_filter is null or pipeline = pipeline_filter)
    and (provider_filter is null or context->>'provider' = provider_filter);
  
  return result;
end;
$$;
```

### 2.5 Edge Function (Deno)
```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const since = url.searchParams.get("since") || new Date(Date.now() - 86400000).toISOString();
  const pipeline = url.searchParams.get("pipeline");
  const provider = url.searchParams.get("provider");

  const { data, error } = await supabase.rpc("get_semantic_violation_summary", {
    since_ts: since,
    pipeline_filter: pipeline,
    provider_filter: provider,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
});
```

---

## 3. Semantic Drift Dashboard

### 3.1 Data Flow
```
Dashboard (React)
    │
    │  GET /semantic-drift-summary?since=...&pipeline=aiPipeline
    │
    ▼
Supabase Edge Function → get_semantic_violation_summary()
    │
    │  JSON response
    ▼
Dashboard widgets update
```

### 3.2 Component Tree
```
<SemanticDriftDashboard>
  <DegradedBanner degraded={summary.degraded_flag} />
  <DriftVelocityChart data={summary.drift_velocity.per_hour_last_24h} trend={summary.trend} />
  <RuleFailureHeatmap data={summary.rule_failure_heatmap} />
  <ProviderDriftCards providers={summary.provider_drift} />
  <RecentCriticalsFeed violations={summary.recent_criticals} />
  <SummaryStats total={summary.total_violations} bySeverity={summary.by_severity} />
</SemanticDriftDashboard>
```

### 3.3 Widget Specifications

#### A. Degraded Banner
- **Condition:** `degraded_flag === true`
- **Renders:** A full-width banner with warning text: “Prediction Engine in Degraded State – Semantic contract violations detected”
- **Interaction:** Click navigates to full violation log or filtered `semantic_violations` view

#### B. Drift Velocity Chart
- **Chart type:** Area or bar chart
- **X-axis:** Hours (0–23, with actual timestamps as tooltip)
- **Y-axis:** Violation count
- **Threshold:** Horizontal dashed line at configurable value (e.g. 5). When crossed, color changes to red.
- **Sparkline summary:** Next to chart title, show trend arrow and label (e.g. “↑ Rising – 12% increase in last 12h”)

#### C. Rule Failure Heatmap
- **Representation:** Horizontal stacked bar chart or a compact table
- **Columns:** `Rule ID`, `Field Path`, `Count`, `% of Total`
- **Color:** Intensity proportional to count
- **Drill-down:** Clicking a row opens a modal with sample violations for that rule

#### D. Provider Drift Cards
- One card per provider with:
  - Provider Name
  - Missing Canonical IDs shown as a red number if >0
  - New Field Intrusions listed with warning styling
  - Timestamp of the most recent intrusion

#### E. Recent Criticals Feed
- Scrollable list with:
  - Timestamp
  - Pipeline
  - Violation type
  - Message
  - Context
- Auto-refresh every 60 seconds

### 3.4 Implementation Example (React + TypeScript)

#### Custom Hook
```tsx
// hooks/useDriftSummary.ts
import { useState, useEffect } from 'react';

export interface DriftSummary {
  total_violations: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  drift_velocity: { per_hour_last_24h: number[]; trend: string };
  rule_failure_heatmap: { rule_id: string; field_path: string; count: number }[];
  provider_drift: { provider: string; new_field_intrusions: string[]; missing_canonical_ids: number }[];
  degraded_flag: boolean;
  recent_criticals: any[];
  window: { from: string; to: string };
}

export function useDriftSummary(since?: string) {
  const [data, setData] = useState<DriftSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    fetch(`/api/semantic/drift-summary?${params}`)
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(e.message));
  }, [since]);

  return { data, error };
}
```

#### Dashboard Page Skeleton
```tsx
// pages/SemanticDriftDashboard.tsx
import { useDriftSummary } from '../hooks/useDriftSummary';
import DegradedBanner from '../components/DegradedBanner';
import DriftVelocityChart from '../components/DriftVelocityChart';
import RuleFailureHeatmap from '../components/RuleFailureHeatmap';
import ProviderDriftCards from '../components/ProviderDriftCards';
import RecentCriticalsFeed from '../components/RecentCriticalsFeed';

export default function SemanticDriftDashboard() {
  const { data, error } = useDriftSummary();

  if (error) return <div className="error">Failed to load drift data: {error}</div>;
  if (!data) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <DegradedBanner show={data.degraded_flag} />
      <div className="stats-grid">
        <StatCard title="Total Violations" value={data.total_violations} />
        <StatCard title="Critical" value={data.by_severity.critical || 0} color="red" />
        <StatCard title="Warning" value={data.by_severity.warning || 0} color="orange" />
      </div>
      <div className="chart-row">
        <DriftVelocityChart data={data.drift_velocity} trend={data.trend} />
        <RuleFailureHeatmap data={data.rule_failure_heatmap} />
      </div>
      <div className="bottom-row">
        <ProviderDriftCards providers={data.provider_drift} />
        <RecentCriticalsFeed violations={data.recent_criticals} />
      </div>
    </div>
  );
}
```

---

## 4. Layer 5 Control Plane Integration

### 4.1 PASS / WARN / FAIL Logic
The drift summary directly feeds a control-plane decision inside `aiPipeline.js` or any enrichment pipeline.

```ts
// Inside aiPipeline.js, before buildMatchContext()

const drift = await fetchDriftSummary();
let controlPlaneState: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

if (drift.degraded_flag) {
  controlPlaneState = 'FAIL';
} else if (drift.total_violations > 10) {
  controlPlaneState = 'WARN';
}

switch (controlPlaneState) {
  case 'FAIL':
    throw new DegradedStateError('Semantic contract violation critical');
  case 'WARN':
    console.warn('Semantic drift warning – proceeding with caution');
    break;
  case 'PASS':
    break;
}
```

### 4.2 Integration with enforcementGuard.js
The guard already logs violations. After each pipeline run, check the aggregated state and decide whether to propagate `degraded_flag` to downstream systems.

```ts
const summary = await getDriftSummary({ pipeline: 'snapshot_today_import' });
if (summary.degraded_flag) {
  // Send Slack alert, mark predictions as low confidence, etc.
}
```

---

## 5. Dependency Registry & Observability Registry (Scope)

### 5.1 `dependency_registry.md`
- Maps each pipeline step to required tables and views.
- Lists expected columns, data types, and the impact of missing or null values.
- Example:
  ```
  Step: buildMatchContext()
  Depends on: canonical_results (game_id, ht_home_score, ht_away_score, ft_home_score, ft_away_score, winner)
  Failure mode: If Game.HomeTeamScorePeriod1 is null, HT grading returns null; error logged as INVALID_STATUS.
  ```

### 5.2 `observability_registry.md`
- Defines healthy metrics for every background job.
- Adds semantic thresholds for `UNKNOWN_FIELD` violations and `degraded_flag`.
- Becomes the single source for alerting rules.

These will be drafted in a subsequent document upon request.

---

## 6. Implementation Checklist

- [ ] Deploy SQL function `get_semantic_violation_summary` via migration.
- [ ] Deploy Edge Function `semantic-drift-summary` with secrets.
- [ ] Add frontend route `/semantic-drift` and dashboard page.
- [ ] Wire the `useDriftSummary` hook into the admin panel.
- [ ] Implement `PASS/WARN/FAIL` gating in `aiPipeline.js`.
- [ ] Configure alerting for any `FAIL` state.
- [ ] Document thresholds and rationale in `observability_registry.md`.
- [ ] Schedule a review of dependency chains and write `dependency_registry.md`.

---

## 7. Appendix: Additional SQL Migrations

To support the provider filter, ensure the `context` column in `semantic_violations` includes a `provider` field. Update `violationLogger.js` to always include it:

```ts
logViolation({
  pipeline,
  violation_type,
  context: {
    game_id: gameId,
    provider: 'sportsdataio',
    ...rest
  },
});
```

A migration to add an index on `(context->>'provider')` may be beneficial:

```sql
create index idx_semviol_provider on semantic_violations ((context->>'provider'));
```

---

**Blueprint Version:** 1.0
**Prepared for:** SKCS Engineering Team
**Next steps:** Implement, then request `dependency_registry.md` and `observability_registry.md` drafts.
