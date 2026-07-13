# SEM-GOV-001 — Unified Sports Intelligence Lifecycle Contract v1

## Contract status

| Field | Value |
|---|---|
| **Contract ID** | `SEM-GOV-001_UNIFIED_SPORTS_INTELLIGENCE_LIFECYCLE_CONTRACT.v1` |
| **Programme** | `SEM-GOV-001` — Unified Sports Intelligence Lifecycle |
| **Governed mini-project** | `SEM-GOV-001A` — Canonical Lifecycle, Terminology, Rolling Eight-Day Funnel and Help Contract |
| **Contract mode** | Contract-only (SEM-GOV-001A-C1) |
| **Governor gate field** | `unified_lifecycle_governor` in `EDGE_BUILD_CONTROL_LEDGER.v1.json` — **BLOCKED** until runtime foundation (SEM-GOV-001B) is separately approved and proven |
| **Date sealed** | 2026-07-13 |
| **Authoritative baseline** | `6a3d880ea0f80bfad05e040a42bd7901f3e4c840` |
| **Prior evidence** | P1-B02 read-only inspection; SEM-GOV-001A design packet |

---

## 1. Authority

The **Unified Sports Intelligence Lifecycle Governor** (`LifecycleGovernor`) is the canonical authority within the Scout–Edge fixture lifecycle, public transparency, and publication domain.

### Governor governs

- Fixture admission
- Lifecycle state
- Lifecycle stage
- Timing windows
- Daily rollover
- Hold decisions
- Elimination decisions
- Re-entry
- Scout FIP refresh behavior
- Publication eligibility
- Public fixture visibility
- Safe BOT explanation categories
- Funnel counts
- Archive transitions
- Sport activation within the lifecycle

### Governor may supersede

Within this domain only, the Governor may supersede conflicting:

- Lower-level pipeline constants
- Filter rules
- API behavior
- Stage labels
- UI terminology

### Governor remains subordinate to

- The SKCS Constitution
- Evidence-integrity laws (`EFI-001`, `EST-001`, `FIP-001`)
- Security and legal controls (`ESEC-001`, `RLL-001` when approved)
- Database-integrity rules
- Control Center governance
- Explicit human approval gates
- `scout_edge_marriage_gate` (`EMG-001`) — Governor does not clear marriage or storage gates

### Authority hierarchy

```text
SKCS Constitution
  ↓
Evidence-integrity laws
  ↓
Security and legal controls
  ↓
Control Center governance
  ↓
Explicit human approval gates
  ↓
EMG-001 scout_edge_marriage_gate (integration clearance — separate control)
  ↓
SEM-GOV-001 Unified Sports Intelligence Lifecycle Governor
  ↓
Sport-specific intelligence engines (Football first)
  ↓
Public surfaces (SMH, fixture details, Direct Insights, EdgeMind BOT, ACCA, prediction pages)
```

### Relationship to EMG-001

| Control | Role |
|---|---|
| **EMG-001 marriage gate** | Controls whether Scout is the production sports-truth provider |
| **SEM-GOV-001 Governor** | Controls how every admitted fixture moves through lifecycle regardless of intake source |

---

## 2. Platform invariant

Use this exact principle everywhere:

> **One platform language.**
> **One fixture lifecycle.**
> **One source of truth.**
> **Multiple sport-specific intelligence engines.**

No website page, API, BOT, pipeline, diagnostic surface, or sport implementation may independently invent lifecycle stages, fixture states, or customer-facing terminology.

Existing implementation is not protected merely because it already exists. Competing stage models (`elite_6_stage`, `core_4_stage`, EdgeMind four-stage narrative, `pipelineLogger` operational counters as product labels) must be retired or remapped to this contract in governed implementation phases.

---

## 3. Football-first policy

Football is the **first complete reference implementation**.

After football is implemented and proven:

1. Scout completes or updates the next sport's governed evidence and FIP support.
2. Edge implements that sport's intelligence rules.
3. The canonical lifecycle, states, public explanations, and rolling funnel are **reused unchanged**.
4. Only sport-specific evidence, context, thresholds, and analysis logic may differ.
5. The website and app must be updated for that sport in the **same governed release sequence**.

---

## 4. Canonical public lifecycle stages

Six customer-facing and governance stages. **These are the only lifecycle stage names** permitted in product UI, APIs, diagnostics, Help, and BOT copy.

| # | Token | Label |
|---|---|---|
| 1 | `ADMITTED` | Fixture Admitted |
| 2 | `EVIDENCE_REVIEW` | Evidence Review |
| 3 | `CONTEXT_REVIEW` | Context Review |
| 4 | `STABILITY_REVIEW` | Stability Review |
| 5 | `PUBLICATION_REVIEW` | Publication Review |
| 6 | `FINAL_DECISION` | Final Decision |

### Stage invariants

1. Stages are **not** calendar-day-driven.
2. A fixture may occupy a stage for minutes or days independent of `days_to_kickoff`.
3. `lifecycle_stage` and `lifecycle_state` are orthogonal dimensions.
4. The existing Edge Six-Stage Insight Engine (`direct1x2Engine.evaluateDirect1x2`) may be retained internally but must report into this canonical lifecycle and must not expose conflicting names elsewhere in the product.

### Internal engine mapping (Football — implementation reference)

| Internal engine stage | Canonical lifecycle stage |
|---|---|
| Pre-engine admission | `ADMITTED` |
| Raw Data | `EVIDENCE_REVIEW` |
| Weather + Injuries + H2H & Form | `CONTEXT_REVIEW` |
| Volatility Check | `STABILITY_REVIEW` |
| Final Insight + tier filter | `PUBLICATION_REVIEW` |
| Publication decision | `FINAL_DECISION` |

`engine_stage` (1–6) is an internal field. It must not be shown to customers before `FINAL_APPROVED`.

---

## 5. Canonical lifecycle states

Eight governed state tokens. All product surfaces must use these exact tokens.

### `VISIBLE`

The fixture is **publicly listed** in the active rolling window, but meaningful analysis may not have started. Customers see fixture identity, competition, kickoff, lifecycle stage, and safe BOT explanation only.

### `UNDER_REVIEW`

One or more governed lifecycle checks are **actively in progress**. The fixture remains in the active funnel. Customers see stage progress but no insights.

### `HELD`

Progression is **paused** while waiting for evidence, stability, timing eligibility, or a human/governance gate. Hold reason must use a governed category from §10.

### `ELIMINATED`

The fixture is **no longer eligible for publication** but remains visible in governed history with a safe elimination category. Eliminated fixtures must not silently disappear.

### `FINAL_APPROVED`

All required gates passed. An insight **may be released** according to customer access rules (tier, plan, subscription). `FINAL_APPROVED` does not bypass subscriber gates.

### `CANCELLED`

The source confirms the fixture will not proceed. Retained in history with `MATCH_CANCELLED` category.

### `POSTPONED`

The fixture has been rescheduled and awaits updated timing or evidence. Publication eligibility is revoked if previously granted.

### `ARCHIVED`

The fixture has left the active pre-match window. The **complete historical record** is preserved. Archived fixtures are read-only in the active funnel.

---

## 6. Rolling eight-day funnel

The Sports Market Hub operates as a **continuously replenished** rolling eight-day fixture window.

### Day labels (SAST — `Africa/Johannesburg`)

| Label | Definition |
|---|---|
| **Today** | SAST calendar date 0 |
| **Day 2** | SAST calendar date +1 |
| **Day 3** | +2 |
| **Day 4** | +3 |
| **Day 5** | +4 |
| **Day 6** | +5 |
| **Day 7** | +6 |
| **Day 8** | +7 |

**Invariant:** Rolling eight-day window = today plus seven future calendar dates.

### Daily rollover (00:00 SAST)

At each daily rollover:

1. Completed or expired **Today** fixtures leave the active window and are **archived**.
2. **Day 2** becomes **Today**.
3. **Day 3** becomes **Day 2**.
4. **Day 4** becomes **Day 3**.
5. **Day 5** becomes **Day 4**.
6. **Day 6** becomes **Day 5**.
7. **Day 7** becomes **Day 6**.
8. **Day 8** becomes **Day 7**.
9. Newly discovered fixtures populate the new **Day 8**.

### Rollover invariants

- The funnel must **not** be rebuilt from scratch.
- `fixture_uid` (permanent fixture identity) and complete lifecycle history remain **continuous** across rollover.
- Calendar position is **not** fixture identity. Day labels are recomputed; history is append-only.

---

## 7. Separate dimensions

The Governor must separately track:

| Dimension | Description |
|---|---|
| `fixture_uid` | Permanent fixture identity |
| `day_label` | Calendar position (Today…Day 8) — recomputed at rollover |
| `days_to_kickoff` | Informational; does not auto-advance stage |
| `lifecycle_state` | One of §5 tokens |
| `lifecycle_stage` | One of §4 tokens |
| `engine_stage` | Internal intelligence engine step (1–6) |
| `evidence_fresh_at` | Evidence freshness timestamp |
| `publication_eligible` | Boolean; true only at `FINAL_APPROVED` |

**Calendar day must never automatically determine lifecycle stage.**

Examples:

- A Day 7 fixture may already be in Context Review if evidence is sufficient.
- A Day 2 fixture may remain Held because required evidence is incomplete.
- A Day 5 fixture may be Eliminated immediately due to cancellation or identity failure.
- A Held fixture may re-enter review after a fresh Scout FIP arrives.

---

## 8. Transparent funnel

Customers must be able to see:

- Fixtures admitted
- Fixtures active
- Fixtures held
- Fixtures eliminated
- Fixtures cancelled
- Fixtures postponed
- Fixtures final approved
- Newly admitted Day 8 fixtures
- Fixtures carried forward during rollover
- Changes since the previous rollover
- Governed reason-category totals

### Funnel counter definitions

| Counter | Definition |
|---|---|
| `admitted_total` | Fixtures admitted to current rolling window epoch |
| `active_total` | States: `VISIBLE`, `UNDER_REVIEW`, `HELD` |
| `held_total` | State: `HELD` |
| `eliminated_total` | State: `ELIMINATED` (current window) |
| `cancelled_total` | State: `CANCELLED` |
| `postponed_total` | State: `POSTPONED` |
| `final_approved_total` | State: `FINAL_APPROVED` |
| `archived_exit_total` | Fixtures archived at last rollover |
| `by_stage` | Count per `lifecycle_stage` (active only) |
| `by_category` | Count per hold/elimination category |

Daily `funnel_snapshot` records must be **durable** (not process-local). In-memory `pipelineLogger` may remain operational telemetry but is not the customer system of record.

### View defaults

- Normal view defaults to **active** fixtures.
- Separate views or filters required for: held, eliminated, cancelled, postponed, approved, archived.
- Eliminated fixtures must not silently disappear.

---

## 9. Public information boundary

### Before `FINAL_APPROVED`, customers may see only

- Fixture identity
- Teams or participants
- Sport
- Competition
- Kickoff date and time
- Lifecycle state
- Lifecycle stage
- Safe public BOT explanation
- Governed hold or elimination category

### Before `FINAL_APPROVED`, the system must not reveal

- Predictions
- Recommendations
- Internal probabilities
- Unapproved confidence
- Probability movements
- Model weights
- Proprietary formulas
- Private prompts
- Internal chain-of-thought
- Private governance reasoning

### Post-approval

Published insights, confidence, and markets may be shown per subscriber tier and plan gates only.

---

## 10. Safe public explanation taxonomy

Initial governed category tokens:

| Token | Public label |
|---|---|
| `TIMING_WINDOW` | Outside current analysis window |
| `INSUFFICIENT_EVIDENCE` | Waiting on required match evidence |
| `CONFIDENCE_THRESHOLD` | Did not meet publication confidence standard |
| `VOLATILITY_ELEVATED` | Match conditions too unstable for direct insight |
| `MARKET_CONFLICT` | Markets could not be resolved consistently |
| `CONTROL_PLANE_HOLD` | Under governance review |
| `SEMANTIC_ALIGNMENT` | Fixture identity could not be verified |
| `SPORT_NOT_ACTIVE` | Sport not in current programme |
| `PUBLICATION_DEFERRED` | Analysis complete; awaiting final approval |
| `MATCH_CANCELLED` | Match cancelled |
| `MATCH_POSTPONED` | Match postponed |
| `APPROVED` | Cleared for release |

### BOT derivation law

Each BOT explanation must be derived from:

1. A recorded lifecycle event
2. A governed category from this taxonomy
3. A timestamp
4. The fixture identity
5. The responsible Governor decision

The BOT must **never** invent or infer an elimination or hold reason. Synthetic narratives (`buildFallbackPipelineData`, template-only confidence messages without event binding) are forbidden for lifecycle surfaces.

---

## 11. Sports Market Hub navigation contract

Sport, competition, date, lifecycle state, and product type are **separate navigation dimensions**. They must never be mixed into one taxonomy.

### Canonical navigation order

1. **Sport**
2. **Competition**
3. **Rolling date window** (Today…Day 8)
4. **Lifecycle-state view**
5. **Product or insight type**

### Canonical sport classification examples

| Sport | Competition / discipline |
|---|---|
| Motorsport | Formula 1 |
| American Football | NFL |
| Ice Hockey | NHL |
| Baseball | MLB |
| Australian Rules Football | AFL |
| Combat Sports | MMA and Boxing (unless later Scout contracts require separate canonical sports) |

The UI must obtain sport and competition values from a **governed sport and competition registry**, not independent hard-coded lists.

---

## 12. Sports Market Hub Help and onboarding contract

The Sports Market Hub must include a visible **Help / How It Works** control near the Hub header.

### Help system requirements

| Requirement | Detail |
|---|---|
| A. First-visit guided walkthrough | Onboarding flow for new users |
| B. Reopenable Help panel | Persistent access after first visit |
| C. Mobile and desktop behavior | Responsive layout |
| D. Keyboard navigation and accessibility | WCAG-aligned focus and ARIA |
| E. Future language translation support | String registry ready for `RLL-001` |
| F. EdgeMind BOT help prompts | Governed help copy |
| G. Canonical glossary | Terms from §5 and §14 |

### Walkthrough steps

1. Choose a sport.
2. Choose a competition.
3. Choose Today through Day 8.
4. Choose a lifecycle view.
5. Read the funnel summary.
6. Open a fixture.
7. Understand when insights become available.
8. Use EdgeMind BOT for governed explanations.

### Required Help explanation

> A fixture's calendar day and lifecycle stage are **not the same thing**.

Example for Help copy:

> A Day 7 fixture may already be in Context Review, while a Day 2 fixture may remain Held because required evidence is incomplete.

### Canonical Help glossary

| Term | Definition |
|---|---|
| **VISIBLE** | The fixture is listed in the active window, but full analysis may not have started. |
| **UNDER REVIEW** | The fixture is actively progressing through one or more governed checks. |
| **HELD** | Progression is paused while SKCS waits for stronger evidence, greater stability, timing eligibility, or a governance decision. |
| **ELIMINATED** | The fixture did not qualify for publication. It remains available with a safe reason category. |
| **FINAL APPROVED** | The fixture passed all required checks and may display an approved insight. |
| **CANCELLED** | The source confirms that the fixture will not proceed. |
| **POSTPONED** | The fixture has been rescheduled and is awaiting updated timing or evidence. |
| **ARCHIVED** | The fixture has left the active pre-match window, but its governed history is preserved. |

All Help text, BOT text, API labels, and website labels must use the same **canonical terminology registry**.

---

## 13. Website-wide terminology

### Canonical public wording

- Fixture Admitted
- Evidence Review
- Context Review
- Stability Review
- Publication Review
- Final Decision
- Final Approved Insight
- Held
- Eliminated
- Archived

### Surfaces requiring alignment (future implementation)

- Homepage Decision Engine section
- Sports Market Hub
- Fixture-detail view
- EdgeMind BOT
- Insights pages
- Direct Insights
- Secondary markets
- Same-match products
- ACCAs
- Subscriptions
- APIs
- Diagnostics
- Help and onboarding

### Terminology corrections (recorded for future phases)

- **"ACCA's"** must later be corrected to **"ACCAs"**.
- **"API Data Collection"** must later be replaced or remapped because Scout becomes the governed evidence-acquisition layer.

### Banned customer-facing labels (to retire)

- Collection, Baseline, Reality Check, Decision Engine (as lifecycle stage names)
- `elite_6_stage` / `core_4_stage` keys as customer labels
- `ingested`, `normalized`, `market_scored` as funnel product labels

---

## 14. Timing windows

Four separate policy windows. **Exact scoring and publication cutoffs are not approved in this contract** — recorded for resolution in SEM-GOV-001B/C.

### Visibility window

Rolling **eight calendar days** (Today through Day 8, SAST). Governor supersedes current `SYNC_FUTURE_DAYS = 7` for customer visibility when runtime Governor is active.

### Evidence-intake window

Governor-owned admission horizon aligned to the eight-day visibility window. Exact cutoffs deferred to SEM-GOV-001B.

### Scoring window

Governor-owned window during which internal intelligence engines may execute. Scoring does not imply publication. Exact cutoffs deferred to SEM-GOV-001C.

### Publication window

Governor-owned window during which `FINAL_APPROVED` may be granted. Exact cutoffs deferred to SEM-GOV-001C/F.

### Current conflicts (recorded — not resolved in SEM-GOV-001A)

| Conflict | Current code | Status |
|---|---|---|
| Seven-day sync window | `syncService.SYNC_FUTURE_DAYS = 7` | Superseded by eight-day visibility when Governor active |
| P1-B01 48-hour FIP horizon | `fipIntakeService.MAX_KICKOFF_HORIZON_MS` | **Provisional — not permanent production policy** |
| Rolling eight-day visibility | This contract | Authoritative customer vision |
| Inconsistent post-kickoff grace | 0 / 15min / 2hr / 6hr / 24hr across layers | Deferred to SEM-GOV-001B |
| Runtime 45% vs rulebook 30% confidence | `aiPipeline` vs `SKCS_MASTER_RULEBOOK.md` | Deferred to SEM-GOV-001C |

### Provisional P1-B01 48-hour rule

The P1-B01 48-hour FIP kickoff horizon in `fipIntakeService.js` remains **provisional**. It must **not** be treated as permanent production policy. When the Lifecycle Governor is active, evidence-intake window policy in SEM-GOV-001B supersedes it. Until SEM-GOV-001B ships, the 48-hour rule remains in code unchanged.

---

## 15. Required future persistence

Minimum future requirements (no SQL in SEM-GOV-001A):

- Permanent fixture identity (`fixture_uid`)
- Current lifecycle state
- Current lifecycle stage
- Previous state
- Transition history (append-only events)
- Hold reason (governed category)
- Elimination category
- Scout refresh history
- Daily rollover history
- Publication history
- Public-safe explanation history
- Daily funnel snapshots
- Per-sport and per-competition counts

In-memory `pipelineLogger` funnel metrics must not remain the sole customer-facing record.

---

## 16. Required future surfaces

Future implementation requirements:

| Surface | Purpose |
|---|---|
| Fixture-first Sports Market Hub API | Active funnel fixtures without unreleased insights |
| Lifecycle-state API | State and stage per fixture |
| Rolling eight-day fixture API | Today…Day 8 fixture lists |
| Funnel-summary API | §8 counters and rollover delta |
| Fixture lifecycle history API | Eliminated/cancelled/postponed/archived views |
| EdgeMind explanation API | Event-bound safe explanations |
| Help/onboarding content API or canonical frontend registry | §12 Help system |
| Active / held / eliminated / approved / cancelled / postponed views | SMH filters |

---

## 17. Implementation phases

| Phase | ID | Scope |
|---|---|---|
| **A** | SEM-GOV-001A | Canonical lifecycle, terminology, rolling funnel and Help contract (**this document**) |
| **B** | SEM-GOV-001B | Football lifecycle persistence and Governor runtime foundation |
| **C** | SEM-GOV-001C | Football Scout FIP and Edge pipeline integration |
| **D** | SEM-GOV-001D | Football Sports Market Hub fixture-first navigation and rolling eight-day UI |
| **E** | SEM-GOV-001E | Football BOT transparency, Help and onboarding |
| **F** | SEM-GOV-001F | Direct Insights, secondary markets, same-match and ACCA alignment |
| **G** | SEM-GOV-001G | Football end-to-end proof |
| **H** | SEM-GOV-001H | Multi-sport rollout template |

No phase may begin without explicit Stephen approval. No SQL, runtime code, or UI changes in SEM-GOV-001A.

**Note:** `EPRV-001` batch label `P1-B02` (Context Bypass) is a separate workstream and must not be confused with SEM-GOV-001 phases.

---

## 18. Definition of Done — SEM-GOV-001A

SEM-GOV-001A is complete only when:

- [x] One canonical lifecycle is documented (§4)
- [x] One canonical state model is documented (§5)
- [x] The rolling eight-day invariant is documented (§6)
- [x] The Help and onboarding contract is documented (§12)
- [x] The Hub navigation dimensions are documented (§11)
- [x] The public information boundary is documented (§9)
- [x] Safe explanation categories are documented (§10)
- [x] Website-wide terminology is documented (§13)
- [x] Football-first rollout is documented (§3)
- [x] Multi-sport reuse is documented (§3, phase H)
- [x] The provisional 48-hour rule is explicitly classified (§14)
- [x] Implementation phases are documented (§17)
- [x] The contract is registered in Control Center governance
- [ ] Focused governance checks pass except independently proven baseline defects (ALI-001, RLL-001, SPM-001)

---

## 19. Files likely amended in later phases (reference only)

| Area | Files |
|---|---|
| Governor core | `backend/services/lifecycleGovernor.js` (new) |
| Pipeline hooks | `backend/services/aiPipeline.js`, `syncService.js`, `fipIntakeService.js`, `filterEngine.js`, `accaBuilder.js` |
| APIs | `backend/routes/v1/lifecycle.js` (new), `backend/routes/predictions.js` |
| SMH | `public/js/smh-hub.js`, `public/js/smh-hub-master-rulebook.js` |
| BOT | `backend/controllers/edgeMindController.js` |
| Governance | `control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json`, `EMG-001`, `EPI-001` cross-references |

---

## 20. Contract boundary (SEM-GOV-001A)

This contract **does**:

- Define canonical lifecycle law for the entire SKCS website and app
- Register the programme and implementation sequence
- Classify timing conflicts and the provisional 48-hour rule

This contract **does not**:

- Implement runtime code, SQL, Supabase migrations, or UI
- Clear `scout_edge_marriage_gate`, `supabase_storage_gate`, or `unified_lifecycle_governor`
- Delete external providers
- Repair ALI-001, RLL-001, or SPM-001 proposal registration defects
- Approve exact scoring or publication cutoffs
