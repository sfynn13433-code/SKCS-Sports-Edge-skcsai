# ESEC-001-I1 - Fail-Closed Authentication and Credential-Boundary Implementation

| Field | Value |
|---|---|
| Start HEAD | `ae2cee2e20c090b516d3d374ce5f3fd4425c8ffc` |
| Source implementation commits | `3048120c`, `a0c34d8a`, `b9700c3d`, `7a326b6e` |
| Result | **PASS - SOURCE AND TEST CLOSURE** |
| ESEC-001 | **PARTIAL** |
| E2E-001 | **BLOCKED** |
| Full marriage proof | **HOLD** |
| External connections | **0** |
| Secret values recorded | **NO** |

## A. Objective

Implement fail-closed authentication, subscription enforcement, scheduler authorization and credential-class separation without executing production deployment, E2E proof, RLS migrations or Scout transport activation.

## B. Source findings disposition

| Finding | Disposition |
|---|---|
| AUTH-001 | SOURCE_CLOSED_TESTED |
| SUB-001 | SOURCE_CLOSED_TESTED |
| KEY-001 | SOURCE_CLOSED_TESTED |
| CRON-001 | SOURCE_CLOSED_TESTED |
| ROUTE-001 | SOURCE_CLOSED_TESTED |
| DB-001 | SOURCE_CLOSED_TESTED |
| CRED-001 | SOURCE_BOUNDARY_CLOSED_RUNTIME_UNVERIFIED |
| RLS-001 | OPEN_EXCLUDED |

## C. Credential-class law

- Supabase anon key is a public client identifier used only for public read boundaries.
- Supabase service-role key is a privileged server-only credential used only for trusted backend writes.
- Subscriber JWT proves end-user identity and never grants admin privilege by itself.
- Admin API key is an operator credential validated by fail-closed server middleware.
- Scheduler secret is a dedicated server-to-server credential carried only through the canonical scheduler header.
- Scout HMAC credentials remain distinct from subscriber, admin, scheduler and Supabase credentials.

## D. Implemented outcomes

- Arbitrary Supabase JWT users are no longer promoted to admin.
- Subscription middleware fails closed.
- Browser shared-key authentication was replaced with Supabase session bearer authentication.
- VIP failures cannot fall back to public payloads.
- Cron path and query-string authorization bypasses were removed.
- Scheduler callers and mutation routes use the canonical scheduler-secret boundary.
- Automatic FORCE_BOOT_TEST startup writes were removed.
- Public direct-insight reads use the anon key only.
- AI pipeline persistence uses the service-role key only.

## E. Active proof

The active implementation proof is:

`npm run test:esec-001-i1`

The suite contains 32 focused source, middleware, browser, scheduler, database, credential and governance tests.

## F. Historical C1 evidence

ESEC-001-C1 remains preserved as historical inspection evidence. Its report and contract continue to describe the security state observed at the C1 inspection HEAD.

The C1 test is read-only and no longer generates or overwrites governance artifacts. C1 is not the current acceptance proof.

## G. Explicit exclusions

- No RLS migration design or execution.
- No E2E execution.
- No deployment.
- No Supabase function deployment.
- No Scout transport activation.
- No production credential creation, replacement, rotation or revocation.
- No runtime gate clearance.
- No `control:assets` execution.

## H. Remaining blockers

- RLS-001 remains open.
- Production credential configuration and rotation evidence remain absent.
- Runtime and deployment verification remain blocked.
- E2E-001 remains blocked.
- All runtime governance gates remain blocked.

## I. Definition of Done

- Fail-closed source changes are committed.
- Dedicated credential boundaries are covered by focused tests.
- C1 is preserved as non-mutating historical evidence.
- I1 is the active source-and-test proof.
- Canonical ledger and generated projections reflect the I1 result.
- ESEC-001 remains PARTIAL.
- RLS-001 and runtime/deployment proof remain open.
- No prohibited work occurs.

## J. Decision

**PASS - ESEC-001-I1 SOURCE AND TEST REMEDIATION IS COMPLETE. ESEC-001 REMAINS PARTIAL, RLS-001 REMAINS OPEN, AND ALL RUNTIME GATES REMAIN BLOCKED.**

## K. Broad Control Center suite result

The broad `npm run test:control-center` suite was executed and returned **HOLD**:

- Tests: 331
- Passed: 319
- Failed: 12
- Active ESEC-I1 focused proof: **32/32 PASS**
- Historical C1 proof: **2/2 PASS**
- Project-register bootstrap: **PASS ? 42 projects / 42 ledger tasks**

The broad failures include existing cleanup-programme count drift and repository-wide asset-register drift outside ESEC-001-I1. The following three Packet 4B files are also reported as ungoverned workspace candidates because `control:assets` and repository-wide asset registration were explicitly excluded:

- `control-center/ESEC-001_I1_FAIL_CLOSED_AUTHENTICATION_AND_CREDENTIAL_BOUNDARY_IMPLEMENTATION.v1.md`
- `reports/esec-001/fail-closed-authentication-implementation.json`
- `tests/esec-001-i1-governance.test.js`

These three files require a separately authorized asset-governance packet. They do not invalidate the focused ESEC-I1 source-and-test result, but the broad Control Center suite must not be represented as passing.
