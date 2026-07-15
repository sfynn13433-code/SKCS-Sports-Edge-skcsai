# SEM-GOV-001D-UI3-I11 Gate B-C1 — HMAC Submitted-Body Hash Binding Correction

| Field | Value |
|---|---|
| Packet ID | SEM-GOV-001D-UI3-I11-GATE-B-C1 |
| Start HEAD | `8db9f7d37836457aa04d17c06225c7e088b49085` |
| Code required | **YES** |
| Correction result | **PASS** |
| Gate B rerun required | **YES** |
| Full marriage proof | **HOLD** |
| Runtime services changed | HMAC authenticator and governed intake adapter only |
| HTTP route change | **NO** |
| SQL or migration change | **NO** |
| Runtime governance gates | **BLOCKED** |

## A. Proven defect

Gate B proved that a valid HMAC signature over FIP A's caller-supplied body hash could authenticate distinct valid FIP B.

The authentication signature was valid for the supplied authentication context, but the supplied authentication body hash was not compared with an independently recomputed hash of the actual FIP submitted to the intake adapter.

## B. Correction

The governed intake adapter now computes:

`SHA256_HEX(stableStringify(actual_submitted_fip_object))`

The independently computed hash is passed separately to the HMAC authenticator.

The authenticator performs a constant-time comparison between:

- `context.auth.bodyHash`
- the independently computed actual submitted-body hash

A mismatch returns:

`FIP_AUTH_BODY_HASH_MISMATCH`

The mismatch is rejected before:

- secret lookup
- nonce lookup
- nonce reservation
- canonical FIP validation
- fixture identity resolution
- lifecycle confirmation
- D3 persistence
- evidence persistence

## C. Security proof

| Check | Result |
|---|---|
| Modified FIP B independently valid | PASS |
| Signature still bound to FIP A body hash | PASS |
| FIP A and FIP B body hashes differ | PASS |
| FIP B rejected | PASS |
| Rejection code | `FIP_AUTH_BODY_HASH_MISMATCH` |
| Nonce reservations | 0 |
| Identity calls | 0 |
| Lifecycle calls | 0 |
| D3 calls | 0 |
| Evidence calls | 0 |
| Metadata writes | 0 |
| Evidence writes | 0 |

## D. Regression proof

A correctly signed FIP remains accepted.

Replay protection remains active:

- First valid submission: accepted
- First valid submission nonce reservation: one
- Same signed context replayed: rejected
- Replay rejection code: `FIP_AUTH_REPLAY_DETECTED`
- Additional metadata writes after replay: zero
- Additional evidence writes after replay: zero

## E. Preserved boundaries

- No Supabase or external database connection
- No Scout or Neon connection
- No HTTP route
- No SQL or migration
- No feature-flag configuration change
- No governance gate clearance
- No D1 prediction implementation
- No R1 provenance implementation
- No production wiring
- No `control:assets` repair
- No I12 work
- `evidence/` preserved
- `evidence-home1-scratch/` preserved

## F. Runtime gate state

- `scout_edge_marriage_gate`: **BLOCKED**
- `unified_lifecycle_governor`: **BLOCKED**
- `supabase_storage_gate`: **BLOCKED**

The CLEARED values used by focused tests are injected test-only dependencies and do not alter runtime governance.

## G. Definition of Done

- [x] Actual submitted-body hash independently recomputed
- [x] Constant-time body-hash comparison added
- [x] Dedicated mismatch code added
- [x] Mismatch rejected before nonce processing
- [x] Mismatch produces zero downstream calls and writes
- [x] Correctly signed intake remains accepted
- [x] Replay protection remains active
- [x] Runtime governance gates remain BLOCKED
- [x] Full marriage proof remains HOLD
- [x] No out-of-scope implementation

## H. Decision

**PASS — HMAC SUBMITTED-BODY HASH BINDING CORRECTED.**

This correction does not clear Gate B by itself. The unchanged Gate B security preflight, mock orchestration test, and governance test must all pass afterward.
