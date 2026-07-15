# SEM-GOV-001D-UI3-I11 — Gate B Mock-Only Orchestration Proof Packet

| Field | Value |
|---|---|
| Packet ID | SEM-GOV-001D-UI3-I11-GATE-B |
| Gate | **B** — Mock-only orchestration proof |
| Start HEAD | `22f90670063e8e162147e80e452e2443ce2834f5` |
| Code required | **YES** |
| Security preflight | **FAIL** |
| Gate B decision | HOLD WITH CORRECTION REQUIRED |
| Full marriage proof decision | **HOLD** |
| Mock orchestration proof | **NOT RUN** |
| Runtime services changed | **NO** |
| External database or network activity | **NONE** |
| `scout_edge_marriage_gate` | **BLOCKED** — unchanged |
| `unified_lifecycle_governor` | **BLOCKED** — unchanged |
| `supabase_storage_gate` | **BLOCKED** — unchanged |

---

## A. Scope and authority

Gate A authorized a mock-only Gate B orchestration proof using:

- Existing production composition and authentication logic
- Real HMAC-SHA256 logic with a deterministic test secret
- Injected test-only gates
- In-memory fixture identity, lifecycle, display metadata, and evidence storage

Gate B did not authorize:

- Supabase or external database connections
- Scout or Neon connections
- HTTP routes
- SQL or migration changes
- Feature-flag configuration changes
- Governance gate clearance
- D1 prediction implementation
- R1 provenance implementation
- Production wiring
- Runtime service modifications during the security preflight
- Repair of known pre-existing `control:assets` failures
- I12 work

## B. Security preflight method

The security preflight:

1. Built canonical FIP A.
2. Built a modified FIP B.
3. Recomputed FIP B's canonical Scout FIP validation hash.
4. Confirmed FIP B was independently valid.
5. Computed the authentication bodyHash from FIP A.
6. Signed the authentication context using FIP A's bodyHash.
7. Submitted FIP B with the unchanged authentication signature created for FIP A.

The secure required outcome was:

- FIP B rejected
- A non-empty rejection code returned
- Zero `fixture_display_metadata` writes
- Zero `fip_intake_evidence` writes

## C. Security preflight result

| Check | Result |
|---|---|
| FIP B independently valid | PASS |
| Signed FIP A hash differs from submitted FIP B hash | PASS |
| Signed FIP A body hash | `4634ee308e5aa0ddc4abf0ffcd36450af1bdf7951d52bcdd6a5e6426bbcc0412` |
| Submitted FIP B body hash | `aed5c7dbc589f54808db92cec6358d8a62c93e7492202062febdee47d1584a4d` |
| FIP B rejected | **FAIL** |
| FIP B accepted | **YES** |
| Rejection code | `null` |
| Fixture identity calls | 1 |
| Lifecycle calls | 1 |
| D3 metadata calls | 1 |
| Evidence calls | 1 |
| `fixture_display_metadata` writes | 1 |
| `fip_intake_evidence` writes | 1 |

## D. Proven defect

The current HMAC authentication pathway verifies that the caller supplied a valid signature over the caller-supplied authentication bodyHash.

It does not prove that the supplied bodyHash is the SHA-256 hash of the actual FIP object passed to `receiveValidatedFip`.

As a result, a valid signature created for FIP A authenticated a distinct, independently valid FIP B.

The accepted FIP B continued through:

- Caller authentication
- Canonical FIP validation
- Fixture identity resolution
- Lifecycle parent confirmation
- D3 display metadata persistence
- Intake evidence persistence
- Accepted intake result

This proves that the HMAC authentication context is not cryptographically bound to the actual submitted FIP payload.

## E. Failure law applied

Because FIP B was accepted and produced metadata and evidence writes:

- Gate B execution stopped immediately.
- The mock orchestration proof was not run.
- The Gate B governance test was not run.
- The complete Gate B package script was not run.
- No runtime correction was attempted.
- No existing test was weakened or changed to pass.
- No unrelated repair was attempted.
- No commit or push occurred.

## F. Gate B decision

**HOLD WITH CORRECTION REQUIRED**

Gate B has not proven secure mock-only orchestration.

The full marriage proof remains **HOLD**.

This result does not clear or alter:

- `scout_edge_marriage_gate`
- `unified_lifecycle_governor`
- `supabase_storage_gate`

All three runtime governance gates remain **BLOCKED**.

## G. Preserved boundaries

- `evidence/` preserved
- `evidence-home1-scratch/` preserved
- No `backend/` file modified
- No runtime service modified
- No SQL or migration modified
- No route modified
- No feature-flag configuration modified
- No governance gate modified
- No D1 implementation
- No R1 implementation
- No production wiring
- No `control:assets` repair
- No I12 work
- No external database or network connection
- No commit or push

## H. Evidence authority

Canonical Gate B failure evidence:

`reports/ui3-i11/mock-orchestration-evidence.json`

Required evidence state:

- `result`: `HOLD_WITH_CORRECTION_REQUIRED`
- `decision`: `HOLD_WITH_CORRECTION_REQUIRED`
- `securityPreflight.result`: `FAIL`
- `securityPreflight.fipBValidationAccepted`: `true`
- `securityPreflight.submittedFipBAccepted`: `true`
- `securityPreflight.bodyHashBoundToSubmittedPayload`: `false`
- `securityPreflight.metadataWrites`: `1`
- `securityPreflight.evidenceWrites`: `1`
- `orchestration.result`: `NOT_RUN`
- `nextAction`: `OPEN_SEPARATE_BODY_HASH_BINDING_CORRECTION_MINI_PROJECT`

## I. Definition of Done — Gate B HOLD closure

- [x] Valid FIP A created
- [x] Distinct valid FIP B created
- [x] FIP B canonical validation hash recomputed
- [x] Authentication signed using FIP A body hash
- [x] FIP B submitted using the unchanged FIP A signature
- [x] Defect reproduced
- [x] FIP B acceptance recorded
- [x] Metadata and evidence writes recorded
- [x] Execution stopped under failure law
- [x] No runtime repair attempted
- [x] Runtime gates remain BLOCKED
- [x] Full marriage proof remains HOLD
- [x] Separate correction mini-project identified

## J. Required next mini-project

**SEM-GOV-001D-UI3-I11 Gate B-C1 — HMAC Submitted-Body Hash Binding Correction**

Gate B-C1 must:

1. Recompute the submitted FIP body hash from the actual FIP object at the intake boundary.
2. Compare it in constant time with `context.auth.bodyHash`.
3. Reject a mismatch before:
   - nonce reservation
   - canonical validation
   - identity resolution
   - lifecycle confirmation
   - metadata persistence
   - evidence persistence
4. Return a dedicated bounded rejection code.
5. Preserve valid HMAC authentication behaviour.
6. Preserve replay protection.
7. Make the existing Gate B security preflight pass without weakening the test.
8. Make the complete Gate B mock-only orchestration proof pass.
9. Keep all runtime governance gates BLOCKED.
10. Make no route, SQL, migration, D1, R1, production wiring, or I12 change outside the separately approved correction scope.

## K. Final decision

**SEM-GOV-001D-UI3-I11 Gate B: HOLD WITH CORRECTION REQUIRED**

**Full marriage proof: HOLD**

**Next authorized work after formal Gate B closure: Gate B-C1 — HMAC Submitted-Body Hash Binding Correction**
