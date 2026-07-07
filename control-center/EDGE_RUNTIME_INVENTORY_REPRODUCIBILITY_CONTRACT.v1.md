# ESA-RR-002 Runtime Repair Implementation Law Contract (Option A)

## ESA-RR-002 Status

ESA-RR-002 STATUS: PROPOSED

## Governance and contract refinement boundary

This document is a sealed *governance + contract refinement* artifact.

Non-goals in this packet:
- Do not implement ESA-RR-002 runtime repair.
- Do not modify runtime checker behavior.
- Do not implement contract tests.
- Do not classify B02.
- Do not regenerate the runtime inventory or runtime map to make `control:runtime` pass.
- Do not approve ESA-RR-002 in this packet.
- Do not push.

## Option A (final)

OPTION A — PROVENANCE-BACKED RETENTION

No Option B or C is reopened in this packet.

## Phase A — inspected governed state (contract-local sealing)

### Existing relationship evidence comparison (semantic normalization)

The canonical semantic relationship-evidence fields are:
- `database_role`
- `database_objects`
- `schedule_or_trigger`
- `deployment_surface`
- `governance_reachability`

The comparator uses:
- scalar normalization for scalar fields via `String(value).trim()`, treating empty as `null`;
- list normalization for `database_objects` by sorting unique trimmed strings;
- `governance_reachability` sourced from `governance_reachability` (inventory already) or `governance_reachability_type` (legacy/inventory representation);
- equality checks consistent with those normalizations.

Where the committed inventory representation uses `governance_reachability_type`,
the semantic comparison/provenance name remains `governance_reachability`.

## Phase B — sealed source-presence state law

### Runtime-derived source presence states

Every runtime candidate under ESA-RR-002 is classified at check/bootstrap execution time into exactly one of:
- `PRESENT_TRACKED`
- `PRESENT_PRESERVED_CANDIDATE`
- `ABSENT_PRESERVED_CANDIDATE`

#### PRESENT_TRACKED

The candidate path is returned by `git ls-files` and the source path is present/readable in the current checkout.

#### PRESENT_PRESERVED_CANDIDATE

The candidate path is not tracked by `git ls-files`, is represented by the governed asset-register candidate snapshot with `candidate_disposition === "PRESERVED_CANDIDATE"`, and the source path is present/readable in the current workspace.

#### ABSENT_PRESERVED_CANDIDATE

The candidate path is not tracked by `git ls-files`, is represented by the governed asset-register candidate snapshot with `candidate_disposition === "PRESERVED_CANDIDATE"`, and the source path is absent from the current checkout/workspace.

### State derivation law

- `source presence state` is derived from:
  1. current tracked-path identity (`git ls-files`),
  2. governed preserved-candidate identity (`candidate_disposition === "PRESERVED_CANDIDATE"`),
  3. current source-path presence.
- Source presence state must not be trusted from any previously committed runtime-inventory field as proof of current presence.

The checker may use an internal enum/string representation for the three states.

Note: A durable committed `source_presence_state` field is not required (and should not be introduced solely for this purpose).

Any candidate combination that cannot be classified under the three approved states remains governed by existing fail-closed candidate/runtime discovery law.

### Empty-file distinction

- A PRESENT source containing zero bytes is a present zero-byte source.
- An ABSENT source is source absence.

These states are not interchangeable.

Relationship extractors must never receive synthetic `""` merely because a source is absent.

## Phase C — sealed provenance representation

### Approved durable provenance field name

The committed durable runtime inventory provenance object is:
- `relationship_evidence_provenance`

### Exact schema law

`relationship_evidence_provenance` contains exactly these governed fields:
- `source_content_sha256`
- `relationship_evidence_sha256`
- `captured_source_presence_state`

It must not include:
- timestamps
- absolute machine paths
- workspace names
- usernames
- hostnames
- checkout directory names

### Provenance creation law

A new or refreshed `relationship_evidence_provenance` object may only be created from a source in:
- `PRESENT_TRACKED`
- `PRESENT_PRESERVED_CANDIDATE`

It must never be newly created from:
- `ABSENT_PRESERVED_CANDIDATE`

Therefore, `captured_source_presence_state` must be exactly one of:
- `PRESENT_TRACKED`
- `PRESENT_PRESERVED_CANDIDATE`

(`ABSENT_PRESERVED_CANDIDATE` is invalid as a captured provenance origin.)

## Phase D — sealed source-content identity

### `source_content_sha256`

`source_content_sha256` is the SHA-256 over the exact current source-file bytes read from disk.

Before hashing:
- Do not perform UTF-8 re-encoding.
- Do not do newline normalization.
- Do not trim.
- Do not parse/re-serialize.
- Do not source-format.

Required distinction:
- LF source bytes must not equal CRLF source bytes for the purposes of content identity.

## Phase E — sealed governed relationship-evidence fingerprint

### Governed relationship evidence set

Under ESA-RR-002, the semantic governed relationship-evidence set is exactly:
- `database_role`
- `database_objects`
- `schedule_or_trigger`
- `deployment_surface`
- `governance_reachability`

`governance_reachability` is populated from the inventory field:
- `governance_reachability_type`

where required by the existing comparator representation.

No other runtime inventory fields participate in `relationship_evidence_sha256` under ESA-RR-002.

### Canonical relationship-evidence representation

The checker must construct one canonical semantic object with keys in this exact order:
```json
{
  "database_role": "...",
  "database_objects": [],
  "schedule_or_trigger": "...",
  "deployment_surface": "...",
  "governance_reachability": "..."
}
```

Each field must first use the same semantic normalization already governing equality in `compareRelationshipEvidence()`.

After existing comparison normalization:
1. construct the five-key object in the exact governed key order;
2. `JSON.stringify` that canonical object;
3. encode the resulting JSON string as UTF-8;
4. calculate SHA-256;
5. emit lowercase hexadecimal.

The emitted fingerprint is:
- `relationship_evidence_sha256`

### Binding law

Valid retained relationship evidence requires both:
- `source_content_sha256`
- `relationship_evidence_sha256`

The relationship-evidence hash must equal the hash recalculated from the committed inventory's current governed relationship-evidence fields.

## Phase F — sealed absent preserved-candidate retention law

For `ABSENT_PRESERVED_CANDIDATE`, normal validation must:
1. not read synthetic source text;
2. not invoke relationship extractors using empty/default source content;
3. locate the committed `relationship_evidence_provenance`;
4. validate its exact schema;
5. require `captured_source_presence_state` to be `PRESENT_TRACKED` or `PRESENT_PRESERVED_CANDIDATE`;
6. validate `source_content_sha256` format;
7. validate `relationship_evidence_sha256` format;
8. recalculate `relationship_evidence_sha256` from the committed governed relationship-evidence fields;
9. require the recalculated fingerprint to equal the committed provenance fingerprint;
10. retain the committed relationship evidence only when all checks pass.

If any required provenance condition fails:
- FAIL CLOSED

The checker must report a provenance/reproducibility failure.

It must not:
- erase the retained evidence
- replace it with empty evidence
- trust it silently
- refresh provenance from absence

## Phase G — sealed returning-source conflict law

A returning source is a candidate with valid retained provenance/evidence in the committed inventory, but is currently:
- `PRESENT_TRACKED`
  or
- `PRESENT_PRESERVED_CANDIDATE`

after previously being reproducible through absent-candidate retention.

### Validation/check mode

Normal validation must:
1. read the current exact source bytes;
2. calculate current exact-byte `source_content_sha256`;
3. run current relationship extractors against the real current source;
4. calculate current canonical `relationship_evidence_sha256`;
5. compare current source hash with committed provenance `source_content_sha256`;
6. compare current relationship-evidence hash with committed provenance `relationship_evidence_sha256`;
7. compare current semantic relationship evidence using the governed comparator.

If the current source hash differs: FAIL / DRIFT

If the current relationship-evidence fingerprint differs: FAIL / DRIFT

If semantic relationship evidence differs: FAIL / DRIFT

Normal validation must not automatically overwrite retained provenance.

Normal validation must not continue using retained relationship evidence once a real current source is present.

### Bootstrap/generation mode

When the source is currently present, approved bootstrap/generation may:
1. read the current exact source bytes;
2. calculate current exact-byte SHA-256;
3. re-extract current relationship evidence;
4. calculate current relationship-evidence SHA-256;
5. write current relationship evidence;
6. write/refresh `relationship_evidence_provenance` from the current present source.

Therefore:
- validation detects returning-source drift.
- bootstrap may deliberately regenerate the governed current state from a real present source.

## Phase H — sealed bootstrap vs validation law

### Validation/check mode (read-only)

Validation is read-only and must never:
- create provenance
- refresh provenance
- repair malformed provenance
- replace retained evidence
- rewrite source hashes
- rewrite relationship-evidence hashes
- regenerate inventory
- regenerate runtime map

Validation determines whether committed governed runtime state is reproducible.

### Bootstrap/generation mode — PRESENT source

For `PRESENT_TRACKED` and `PRESENT_PRESERVED_CANDIDATE`, bootstrap may:
1. read current source bytes
2. hash current exact bytes
3. extract current relationship evidence
4. write current relationship evidence
5. write or refresh `relationship_evidence_provenance`
6. regenerate governed inventory/map outputs

### Bootstrap/generation mode — ABSENT preserved candidate

For `ABSENT_PRESERVED_CANDIDATE`, bootstrap must not generate new provenance.

Bootstrap may carry forward committed relationship evidence and committed provenance only when the same validation rules for absent retained evidence pass.

If valid: CARRY FORWARD

If invalid: FAIL CLOSED

Bootstrap must not:
- invent provenance
- refresh provenance from absence
- replace retained evidence with empty evidence
- silently demote the preserved candidate
- silently exclude the candidate

## Phase I — sealed contract proof mapping requirement

Do not rename, remove, duplicate, or change the expected outcome of:
- `ESA-RR-T01` through `ESA-RR-T16`

The mapping table below provides explicit proof projection for repair-law labels:
- `R1 OPTION A`
- `R2 EXACT-BYTE SOURCE IDENTITY`
- `R3 SOURCE-PRESENCE STATES`
- `R4 NO SYNTHETIC EMPTY SOURCE`
- `R5 ABSENT EVIDENCE RETENTION`
- `R6 PROVENANCE BINDING`
- `R7 FAIL-CLOSED INVALID PROVENANCE`
- `R8 RETURNING-SOURCE REREAD`
- `R9 RETURNING-SOURCE RE-EXTRACTION`
- `R10 GOVERNED RELATIONSHIP FIELDS`
- `R11 CLEAN-CHECKOUT REPRODUCIBILITY`
- `R12 RETURNING-SOURCE DRIFT`
- `R13 MAP NEWLINE NORMALIZATION`
- `R14 BOOTSTRAP / VALIDATION SEPARATION`

Every test ID appears exactly once as the primary test row.

The following mechanical mapping is the contract-local sealed projection (no runtime repair code is added here):

| Primary ESA-RR test ID | Repair-law labels proved by this test |
|---|---|
| `ESA-RR-T01` | `R1 OPTION A` |
| `ESA-RR-T02` | `R2 EXACT-BYTE SOURCE IDENTITY` |
| `ESA-RR-T03` | `R3 SOURCE-PRESENCE STATES` |
| `ESA-RR-T04` | `R4 NO SYNTHETIC EMPTY SOURCE` |
| `ESA-RR-T05` | `R5 ABSENT EVIDENCE RETENTION` |
| `ESA-RR-T06` | `R6 PROVENANCE BINDING` |
| `ESA-RR-T07` | `R7 FAIL-CLOSED INVALID PROVENANCE` |
| `ESA-RR-T08` | `R8 RETURNING-SOURCE REREAD` |
| `ESA-RR-T09` | `R9 RETURNING-SOURCE RE-EXTRACTION` |
| `ESA-RR-T10` | `R10 GOVERNED RELATIONSHIP FIELDS` |
| `ESA-RR-T11` | `R11 CLEAN-CHECKOUT REPRODUCIBILITY` |
| `ESA-RR-T12` | `R12 RETURNING-SOURCE DRIFT` |
| `ESA-RR-T13` | `R13 MAP NEWLINE NORMALIZATION` |
| `ESA-RR-T14` | `R14 BOOTSTRAP / VALIDATION SEPARATION` |
| `ESA-RR-T15` | `R6 PROVENANCE BINDING`, `R5 ABSENT EVIDENCE RETENTION` |
| `ESA-RR-T16` | `R11 CLEAN-CHECKOUT REPRODUCIBILITY`, `R14 BOOTSTRAP / VALIDATION SEPARATION` |

## Proof of comparator-field parity (contract-local binding)

The canonical relationship evidence fingerprint law in this document binds to the same semantic normalization already governing equality in `compareRelationshipEvidence()`.

## ESA-RR-002 required “contract-local implementation boundary” note

This packet seals the policy and contract only.

No boundary code changes are performed here.

## ESA-RR-002 implementation surface boundary (sealed)

Approved implementation boundary (policy contract):
- `control-center/check_edge_system_runtime_inventory.js`
- `tests/edge-system-runtime-inventory.test.js`

Approved generated-output mutation scope *only as a direct result* of an approved checker bootstrap (no runtime application code changes in this packet):
- `control-center/EDGE_SYSTEM_RUNTIME_INVENTORY.v1.json`
- `control-center/EDGE_SYSTEM_RUNTIME_MAP.md`

This packet does not implement runtime repair and must not modify any runtime application code.
