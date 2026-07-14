# SEM-GOV-001D-UI3-I9 — Production Composition and M2M Auth Foundation Packet

| Field | Value |
|---|---|
| Packet ID | SEM-GOV-001D-UI3-I9 |
| Start HEAD | `c072d34a7151ce473d27e218f665bded574749f5` |
| Mode | Scoped isolated composition — no route, no production activation |
| Decision | **PASS** |
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

---

## A. Authority and start HEAD

- **Controlling contracts:** `SEM-GOV-001D-UI3-I8_DURABLE_INTAKE_EVIDENCE_STORAGE_IMPLEMENTATION_PACKET.v1.md`, `SEM-GOV-001D-UI3-I7_GOVERNED_FIP_INTAKE_ADAPTER_IMPLEMENTATION_PACKET.v1.md`, `EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1.md`
- **Start HEAD:** `c072d34a7151ce473d27e218f665bded574749f5`
- **Pre-change inspection:** I7 adapter, I8 evidence service, D3 persistence, and identity resolver exist as isolated injectable services; no composition root; no M2M authenticator; no HTTP route; migrations NOT APPLIED; all gates BLOCKED.

---

## B. Inspection findings

| Finding | Result |
|---|---|
| Composition root | **None before I9** |
| M2M authenticator | **None before I9** |
| HTTP FIP route | None |
| Production caller | None |
| Secrets in source | None |
| Migrations | NOT APPLIED |
| Feature flag default | Disabled (`featureFlagEnabled === true` required) |

---

## C. Files implemented

### Created
- `backend/services/fipIntakeM2MAuthenticator.js`
- `backend/services/governedFipIntakeComposition.js`
- `tests/fip-intake-m2m-authenticator.test.js`
- `tests/governed-fip-intake-composition.test.js`
- `control-center/SEM-GOV-001D-UI3-I9_PRODUCTION_COMPOSITION_AND_M2M_AUTH_FOUNDATION_PACKET.v1.md`
- `tests/sem-gov-001d-ui3-i9-implementation-packet.test.js`

### Unchanged (hard boundary)
- `governedFipIntakeAdapter.js` (consumed, not modified)
- `fipIntakeEvidenceService.js` (consumed via `createEst001RetentionPolicy`)
- routes, controllers, migrations, `public/`, `aiPipeline.js`

---

## D. M2M authentication design

**Factory:** `createHmacM2MAuthenticator({ secretResolver, nonceStore, clock, maxClockSkewMs? })`

**Signing payload (newline-separated):**
```
callerIdentityRef\ngovernedMode\ntimestamp\nnonce\nbodyHash
```

**Algorithm:** HMAC-SHA256 hex digest

**Domain codes:**
- `FIP_AUTH_CONTEXT_INVALID`
- `FIP_AUTH_TIMESTAMP_INVALID` (5-minute skew window)
- `FIP_AUTH_REPLAY_DETECTED`
- `FIP_AUTH_SIGNATURE_INVALID`
- `FIP_AUTH_CALLER_UNKNOWN`
- `FIP_INTAKE_UNAUTHORIZED` (reserved for adapter mapping)

**Security laws:**
- Secrets resolved only via injected `secretResolver` — no `process.env` reads
- Nonce replay prevention via injected `nonceStore`
- Constant-time signature comparison

---

## E. Composition design

**Factory:** `createGovernedFipIntakeComposition(deps)`

**Required dependencies:** `db`, `gateReader`, `governor`, `clock`, `intakeIdGenerator`, `secretResolver`, `nonceStore`

**Wires:**
- `createHmacM2MAuthenticator` → `authorizeCaller`
- `createFixtureIdentityResolver` → `db.query`
- `createFixtureDisplayMetadataPersistenceService`
- `createFipIntakeEvidenceService` + `createEst001RetentionPolicy`
- `createGovernedFipIntakeAdapter`

**Activation surface (frozen):**
```javascript
{
  featureFlagEnabled,      // false unless deps.featureFlagEnabled === true
  productionRouteMounted: false,
  migrationsApplied: false
}
```

**Public API:** `receiveValidatedFip` + frozen `components` bag — no router, no listen, no fetch.

---

## F. Fail-closed behaviour

| Condition | Behaviour |
|---|---|
| `featureFlagEnabled !== true` | Adapter returns `FIP_FEATURE_DISABLED` before auth/DB |
| Blocked gates | Unchanged from I7/I8 services |
| Missing M2M context | `FIP_AUTH_CONTEXT_INVALID` |
| Unknown caller | `FIP_AUTH_CALLER_UNKNOWN` |

Composition test proves zero `db.query` / `withTransaction` when feature flag disabled.

---

## G. Compatibility corrections

**None required.** Supplied code passed all focused tests without modification.

`createEst001RetentionPolicy` export confirmed in `fipIntakeEvidenceService.js`.

---

## H. Migration and network boundary

- No migration apply
- No Scout, Neon, or Supabase connections
- No HTTP route mounted
- No production intake activation
- No secrets committed to repository

---

## I. Test matrix and results

| Suite | Result |
|---|---|
| `npm run test:sem-gov-001d-ui3-i9` | PASS (11 focused + packet guard) |
| `npm run test:sem-gov-001d-ui3-i8` through `i1` | PASS |
| `npm run control:center` | PASS |
| `npm run control:projects` | PASS |
| `npm run verify:rulebook` | PASS |

---

## J. Prohibited work (deferred)

- HTTP route mounting
- Environment-variable secret reads
- Scout connection
- Migration apply
- Production intake activation
- Gate clearance
- `public/` changes

---

## K. FUTURE_SECURITY_NOTE

Five GitHub Dependabot dependency vulnerabilities remain recorded for future remediation. Not addressed in I9 scope.

---

## L. Definition of Done

- [x] HMAC M2M authenticator with injected secret/nonce stores
- [x] Composition root wiring adapter + services
- [x] Feature flag defaults disabled
- [x] Mock-first tests pass
- [x] No route, network, migration, or production activation
- [x] All gates remain BLOCKED
- [x] Control Center registration complete

---

## M. Inspection decision

**PASS**

Isolated composition and M2M authentication foundation delivered. Production activation remains blocked by feature flag default, gate BLOCKED state, and explicit `productionRouteMounted: false` / `migrationsApplied: false` activation surface.
