# ESEC-001-C1 — Security Boundary Inspection and Contract

| Field | Value |
|---|---|
| Start HEAD | `cce4d5bb6fea669d01856e4425ba2af804f3724a` |
| Code required | **YES** |
| Result | **PASS WITH CRITICAL BLOCKERS** |
| ESEC-001 | **PARTIAL** |
| E2E-001 | **BLOCKED** |
| Full marriage proof | **HOLD** |
| Runtime remediation authorized | **NO** |
| External connections | **0** |
| Secret values recorded | **NO** |

## Findings

| ID | Severity | State | Finding |
|---|---|---|---|
| AUTH-001 | CRITICAL | OPEN | Validated Supabase JWT is unconditionally promoted to admin |
| SUB-001 | CRITICAL | OPEN | Active-subscription enforcement always passes |
| KEY-001 | CRITICAL | OPEN | Legacy shared user key is public and enabled by backend default |
| CRON-001 | CRITICAL | OPEN | Cron path prefixes bypass role authorization |
| ROUTE-001 | CRITICAL | OPEN | Mutation-capable pipeline and internal fixture routes lack explicit authentication |
| DB-001 | HIGH | OPEN | Server startup performs FORCE_BOOT_TEST writes using a privileged-key preference chain |
| RLS-001 | HIGH | OPEN | New RLS-enabled proof tables have zero explicit policies |
| CRED-001 | HIGH | OPEN | Service-role, subscriber, scheduler and Scout M2M credential boundaries are not operationally separated |

## Credential-class law

- Supabase anon key: public client identifier, not a service secret.
- Supabase service-role key: privileged server-only secret.
- Subscriber JWT: end-user identity token; never sufficient by itself for admin privilege.
- Admin API key: operator secret validated only by server middleware.
- Scheduler secret: dedicated server-to-server credential; never authorized by path alone.
- Scout HMAC secret: dedicated Scout-to-Edge integration secret with rotation and replay protection.

## Preserved blocks

- `scout_edge_marriage_gate`: **BLOCKED**
- `unified_lifecycle_governor`: **BLOCKED**
- `supabase_storage_gate`: **BLOCKED**

## Next mini-project

**ESEC-001-I1 — Fail-Closed Authentication and Credential-Boundary Remediation.**

ESEC-001-I1 requires separate authorization. This inspection does not change runtime code, credentials, SQL, migrations, routes, deployment, Scout transport, or gates.

## Decision

**PASS WITH CRITICAL BLOCKERS — ESEC REMAINS PARTIAL AND E2E REMAINS BLOCKED.**
