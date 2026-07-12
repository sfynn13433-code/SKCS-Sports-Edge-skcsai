# EST-001 — Supabase Storage and FIP Retention Contract v1

## Contract status

| Field | Value |
|---|---|
| **Contract ID** | `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1` |
| **Governed task** | `EST-001` — Supabase Storage and FIP Retention Contract |
| **Contract mode** | Contract-only (EST-001-C1) |
| **Marriage gate** | **BLOCKED** (unchanged) |
| **`supabase_storage_gate`** | **BLOCKED** (unchanged) |
| **Runtime implementation** | **FORBIDDEN** in this packet |
| **Date sealed** | 2026-07-12 |
| **Prior contracts** | `EMG-001_SCOUT_EDGE_MARRIAGE_GATE_CONTRACT.v1`, `EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1`, `SEE-001_SCOUT_EDGE_E2E_MARRIAGE_PROOF.v1` |

---

## 1. Purpose

This contract defines **what Edge may store in Supabase**, **what must remain canonical in Scout**, and **how transport, retention, replay, audit, and deletion** interact for validated Scout FIP handoff.

EST-001-C1 answers:

1. What does Edge store?
2. What does Edge not store?
3. What remains canonical in Scout?
4. What Supabase tables or future schema may be allowed?
5. What retention period applies?
6. What replay/audit evidence is required?
7. What must fail closed before prediction use?

This contract **does not** create tables, run SQL, mutate Supabase, or implement runtime storage.

---

## 2. Core law (non-negotiable)

| Principle | Law |
|---|---|
| **Sports truth canonicality** | Scout (Neon + governed evidence archive) owns sports truth |
| **Edge canonicality** | Supabase owns derived Edge application state only |
| **Transport ≠ retention** | Moving a FIP through Edge for analysis does **not** authorize permanent full-FIP storage |
| **No Scout mirror** | Supabase must not become a second Scout evidence database |
| **Capacity constraint** | Edge Supabase budget ≈ **0.5 GB** total |
| **Reference over duplication** | Prefer `fip_id` + `validation.hash` + provenance linkage over full payload retention |

---

## 3. Canonical source of truth

| Domain | Canonical system | Canonical store | Edge may copy? |
|---|---|---|---|
| Sports truth assembly | **Scout** | Neon | **NO** (reference only) |
| Raw acquisition evidence | **Scout** | Neon + governed archive (e.g. Drive) | **NO** |
| Validated FIP authority | **Scout** | Neon (validated package) | **NO** full body |
| FIP validation state | **Scout** | Neon | **NO** (reference only) |
| Historical intelligence evidence | **Scout** | Neon / archive | **NO** |
| Prediction outputs | **Edge** | Supabase | **YES** (derived) |
| Subscriber/commercial state | **Edge** | Supabase | **YES** |
| Intake audit events | **Edge** | Supabase (minimal) | **YES** (bounded) |
| FIP provenance linkage | **Edge** | Supabase (minimal) | **YES** (reference fields only) |

**Replay authority:** To reconstruct sports truth, Edge must **read back to Scout** using `fip_id` and `validation.hash`, not rely on a full FIP copy in Supabase.

---

## 4. Data classification and storage boundaries

### 4.1 Data classes

| Class | Name | Description | Default persistence |
|---|---|---|---|
| **T0** | Transient FIP transport | Full validated FIP in memory during EFI-001 intake and envelope mapping | **None** — process lifetime only |
| **R1** | FIP provenance reference | `fip_id`, `fip_schema_version`, `validation.hash`, `validation.validated_at`, `scout_run_id`, `intake_id`, `idempotency_key` | **Yes** — minimal row linked to predictions |
| **R2** | Intake audit event | EFI-001 §9 evidence record (accept/reject/no-op) | **Yes** — bounded retention |
| **R3** | Derived analysis envelope snapshot | Optional compact envelope hash or redacted subset for audit | **Optional** — proof mode only; not default production |
| **D1** | Derived prediction state | `predictions_raw`, filtered stages, `direct1x2_prediction_final`, grading outputs | **Yes** — existing Edge lifecycle |
| **D2** | Subscriber/commercial state | profiles, subscriptions, auth-related tables | **Yes** — existing Edge lifecycle |
| **F1** | Forbidden Scout mirror | Raw provider dumps, Scout evidence archives, full FIP body, H2H/history mirrors | **FORBIDDEN** |

### 4.2 What Edge stores (allowed)

| Stored artifact | Class | Rule |
|---|---|---|
| Prediction rows with provenance metadata | R1 + D1 | Link `fip_id` + `validation.hash` on derived outputs |
| Intake audit events | R2 | One row per intake attempt; no full FIP body |
| Idempotency registry entry | R1 | Key + outcome + timestamp |
| Compact envelope hash (optional) | R3 | Allowed only in `PROOF_FIXTURE` mode |
| Existing Edge prediction/subscriber tables | D1, D2 | Unchanged; provenance fields added by future implementation |

### 4.3 What Edge does not store (forbidden)

| Forbidden content | Class | Fail-closed code |
|---|---|---|
| Full validated FIP JSON body as permanent row | F1 | `STORE_FIP_BODY_FORBIDDEN` |
| Scout raw acquisition evidence | F1 | `STORE_SCOUT_EVIDENCE_MIRROR_FORBIDDEN` |
| Scout historical intelligence archive | F1 | `STORE_SCOUT_HISTORY_MIRROR_FORBIDDEN` |
| Neon table replicas (`scout_raw_match_signals`, etc.) | F1 | `STORE_SCOUT_DB_MIRROR_FORBIDDEN` |
| Unredacted third-party provider snapshots as sports truth | F1 | `STORE_PROVIDER_TRUTH_FORBIDDEN` |
| Duplicate Scout evidence store inside Supabase | F1 | `STORE_CAPACITY_LAW_VIOLATION` |

### 4.4 Transport law

```text
Scout validated FIP (canonical in Neon)
  → transient T0 in Edge process memory only
    → EFI-001 intake validation
      → R1 provenance reference persisted (if authorized)
      → R2 audit event persisted (if authorized)
        → D1 derived prediction outputs persisted
          → T0 discarded
```

**T0 must not survive past the intake transaction boundary** except in explicitly authorized `PROOF_FIXTURE` debug captures, which themselves must not enter production retention.

---

## 5. Future Supabase schema allowance (declarative only)

EST-001-C1 **declares** the following future schema classes. **No migration is authorized in this packet.**

### 5.1 Allowed future tables (names reserved)

| Table (reserved) | Class | Purpose | Max row width guidance |
|---|---|---|---|
| `fip_intake_events` | R2 | Audit log for EFI-001 intake attempts | No `fip_body` column |
| `fip_provenance_refs` | R1 | Idempotency + provenance registry | Reference fields only |
| `fip_prediction_links` | R1 | Join provenance ref → prediction row ids | Foreign keys only |

### 5.2 Allowed extensions to existing tables

| Existing table family | Allowed addition |
|---|---|
| `predictions_raw` | `fip_id`, `validation_hash`, `fip_schema_version`, `scout_run_id`, `intake_id`, `sports_truth_origin` |
| `direct1x2_prediction_final` | Same provenance reference fields |
| Filtered/stage tables | Provenance reference fields only |

### 5.3 Forbidden schema patterns

| Pattern | Ruling |
|---|---|
| `fip_body`, `raw_fip`, `scout_evidence_blob` JSONB columns | **FORBIDDEN** |
| Tables mirroring Scout Neon entities | **FORBIDDEN** |
| Unbounded append-only FIP payload history | **FORBIDDEN** |
| Full context-pack snapshots as permanent sports-truth store | **FORBIDDEN** |

---

## 6. Retention periods

| Class | Retention | Deletion trigger |
|---|---|---|
| **T0** Transient FIP | Process lifetime only (≤ intake transaction + analysis pass) | Automatic at end of intake/analysis |
| **R1** Provenance reference | Co-terminus with linked prediction lifecycle + **180 days** after match settlement/grading closure | Purge job after retention window |
| **R2** Intake audit events | **90 days** default; **365 days** for `PROOF_FIXTURE` packets | Scheduled purge; audit export before purge in proof mode |
| **R3** Envelope snapshot (optional) | **30 days** proof-only | Purge on proof packet close |
| **D1** Derived predictions | Existing Edge grading/accuracy lifecycle | Existing Edge policies |
| **D2** Subscriber state | Existing commercial policies | Existing Edge policies |
| **F1** Forbidden | Must never be written | N/A |

### Retention override law

No retention extension beyond these defaults without **separate Control Center authorization** and storage-budget re-validation.

---

## 7. Storage budget and gate interaction

### Capacity law

| Threshold | % of 0.5 GB | Action |
|---|---|---|
| **Normal** | < 80% | Standard operation when gates permit |
| **Warning** | ≥ 80% | Log warning; block new R3 snapshots |
| **Critical** | ≥ 95% | Fail closed on new R2 writes unless purge authorized |
| **Hard block** | ≥ 100% | Fail closed on all new FIP-related writes |

### `supabase_storage_gate` interaction

| Gate state | Effect |
|---|---|
| `BLOCKED` (current) | No new FIP-related schema or production persistence implementation authorized |
| Contract sealed (EST-001-C1) | Defines law only; does **not** clear gate |
| Future `APPROVED` | Requires storage inventory proof + budget enforcement implementation + forbidden-mirror checks |

**EST-001-C1 does not change `supabase_storage_gate` from `BLOCKED`.**

---

## 8. Replay, audit, and idempotency

### 8.1 Replay law

| Replay need | Authority | Method |
|---|---|---|
| Reconstruct sports truth | **Scout** | Fetch by `fip_id` + verify `validation.hash` against Scout canonical store |
| Prove intake occurred | **Edge** | Read `fip_intake_events` (future) or audit sink |
| Prove prediction lineage | **Edge** | Join D1 outputs → R1 provenance refs |
| Re-run analysis | **Edge** | Fetch fresh FIP from Scout; **do not** replay from Supabase FIP body |

**Supabase is not a replay source for canonical FIP body.**

### 8.2 Audit evidence (required)

Every production or proof intake must leave an auditable trail:

| Evidence | Storage class | Required |
|---|---|---|
| EFI-001 intake event record | R2 | YES |
| Provenance reference row | R1 | YES on `ACCEPTED` |
| Linkage to prediction row ids | R1 | YES on successful prediction insert |
| Storage budget snapshot at intake time | R2 metadata | YES in proof mode; recommended in production |
| Purge/deletion audit entry | R2 | YES when retention purge runs |

### 8.3 Idempotency alignment (EFI-001)

```text
idempotency_key = SHA-256(fip_id + "|" + validation.hash + "|" + fip_schema_version)
```

| Event | Storage behavior |
|---|---|
| First `ACCEPTED` intake | Insert R1 + R2; proceed to prediction |
| Duplicate key, identical payload | R2 `NO_OP` event; no duplicate R1; no duplicate prediction |
| Duplicate key, hash mismatch | R2 `REJECTED`; fail closed; no prediction |
| Replay request | Must not create second prediction for same idempotency key |

---

## 9. Fail-closed rules before prediction use

Prediction use (`buildRawPredictionFromProviderItem()` and downstream writes) is **blocked** when any of the following is true:

| Code | Condition |
|---|---|
| `STORE_GATE_BLOCKED` | `supabase_storage_gate` is `BLOCKED` and governed mode is `AUTHORIZED_PRODUCTION` persistence |
| `STORE_FIP_BODY_FORBIDDEN` | Implementation attempts to persist full FIP body |
| `STORE_SCOUT_MIRROR_FORBIDDEN` | Implementation attempts Scout evidence mirror |
| `STORE_PROVENANCE_MISSING` | R1 fields cannot be recorded on accepted intake |
| `STORE_AUDIT_MISSING` | R2 intake event cannot be recorded |
| `STORE_BUDGET_CRITICAL` | Storage ≥ 95% without authorized purge |
| `STORE_RETENTION_POLICY_UNKNOWN` | Row class has no declared retention law |
| `STORE_REPLAY_SOURCE_INVALID` | Analysis attempts to use Supabase-stored FIP body as sports truth |
| `STORE_MARRIAGE_GATE_BLOCKED` | Production Scout intake without proof authorization while marriage gate blocked |

### Proof-mode exception (E2E-001 only)

In explicitly authorized `PROOF_FIXTURE` mode:

- R2 audit events are **required**
- R1 provenance refs are **required**
- R3 optional snapshots are **permitted** with 30-day retention
- Full FIP body persistence remains **forbidden** even in proof mode

---

## 10. Deletion and purge law

| Action | Rule |
|---|---|
| Scheduled purge of R2 audit events | Permitted after retention window; must write purge audit entry |
| Purge of R1 provenance refs | Permitted only after linked predictions reach retention closure |
| Purge under budget pressure | Requires Control Center authorized purge packet; prefer R3 → R2 → oldest settled R1 |
| Deletion of D1 predictions | Existing Edge lifecycle only |
| Deletion of Scout canonical data from Edge | **N/A** — Edge must not hold it |

---

## 11. Relationship to upstream contracts

| Contract | EST-001-C1 relationship |
|---|---|
| **EMG-001** | Transport vs retention separation; no Scout mirror; gate stays BLOCKED |
| **EFI-001** | R2 stores EFI-001 §9 evidence; R1 stores §8 provenance; T0 is transient only |
| **E2E-001** | Proof mode retention rules enable auditable E2E without full FIP mirror |
| **FIP-001** | Canonical FIP body remains in Scout; Edge holds references only |

---

## 12. Blocked before implementation

| Blocker | Owner |
|---|---|
| SQL migrations / table creation | Future EST-001 implementation packet |
| Supabase storage inventory integration | Future EST-001 implementation packet |
| Budget enforcement runtime | Future EST-001 implementation packet |
| Purge job implementation | Future EST-001 implementation packet |
| `supabase_storage_gate` clearance | Separate explicit approval after proofs |
| EFI-001 runtime intake persistence | Future EFI-001 implementation packet |
| Marriage gate clearance | Separate explicit approval after E2E-001 |

---

## 13. EST-001-C1 completion verdict

| Criterion | Result |
|---|---|
| Supabase/FIP retention contract written | **PASS** |
| Canonical source of truth defined | **PASS** |
| Edge storage boundaries defined | **PASS** |
| Retention and audit rules defined | **PASS** |
| Replay/idempotency rules defined | **PASS** |
| Runtime implementation forbidden | **PASS** |
| Marriage gate remains BLOCKED | **PASS** |
| `supabase_storage_gate` remains BLOCKED | **PASS** |

---

## 14. Validation boundary

EST-001-C1:

- **Does** define Supabase storage and FIP retention law.
- **Does** keep `scout_edge_marriage_gate` and `supabase_storage_gate` **BLOCKED**.
- **Does** authorize E2E-001 contract planning when separately approved.
- **Does not** create schema, run SQL, mutate Supabase, implement storage runtime, or clear gates.
- **Does not** reopen the cleanup programme.

---

## 15. References

- `EMG-001_SCOUT_EDGE_MARRIAGE_GATE_CONTRACT.v1.md` §5, §8
- `EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1.md` §8, §9
- `EDGE_CONTROL_CENTER.md` §5 — Supabase storage law
- `EDGE_BUILD_CONTROL_LEDGER.v1.json` — `supabase_storage_policy`, `supabase_storage_gate`
