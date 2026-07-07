# ESA-RR-002 Runtime Repair Implementation Law Contract (Option A)

## ESA-RR-002 Status

ESA-RR-002 STATUS: APPROVED

ESA-RR-002 CLOSURE HOLD REMAINS: YES

## Governance and contract refinement boundary

This document is a sealed *governance + contract refinement* artifact.

Non-goals in this packet:
- Do not implement ESA-RR-002 runtime repair.
- Do not modify runtime checker behavior.
- Do not implement contract tests.
- Do not classify B02.
- Do not regenerate the runtime inventory or runtime map to make `control:runtime` pass.
- Do not change ESA-RR-002 approval in this packet; closure remains HOLD.
- Do not push.

## Option A (final)

OPTION A — PROVENANCE-BACKED RETENTION

No Option B or C is reopened in this packet.

## Phase 0 — closure-HOLD forensic evidence (F1-F3)

The scope refinement must accurately record the closure-HOLD evidence that proved two remaining deterministic implementation-law gaps.

F1 — CLEAN-CHECKOUT TRACKED SOURCE HASH DRIFT
- TOTAL SOURCE CONTENT SHA DRIFT PATHS: 34
- PRESENT_TRACKED: 34
- PRESENT_PRESERVED_CANDIDATE: 0
- ABSENT_PRESERVED_CANDIDATE: 0
- Evidence proved CRLF-to-LF semantic normalization reproduced the index blob bytes, therefore the drift root cause was an EOL / filter identity drift between working-tree representation and index blob bytes.

F2 — TEST RENAME RESIDUE NOT THE CAUSE OF THE EIGHT MISSING SOURCES
- Rename helper call sites: 10
- ORPHANED TEST-RENAME TEMP FILE COUNT: 0
- MISSING INCIDENT PATHS EXPLAINED BY TEST RENAME RESIDUE: 0/8
- Therefore the eight currently absent paths must not be described as test-rename residue.

F3 — ABSENT CANDIDATE SILENT OMISSION
- The following eight governed preserved candidates existed in the pre-Commit-B inventory without relationship_evidence_provenance and were silently absent from the post-bootstrap inventory.
- Violates the already-approved fail-closed retention intent.

CURRENT MISSING-PROVENANCE INCIDENT PATHS (count=8):
- `scratch/inspect_edge_external_sources.js`
- `scripts/inspect_secondary.js`
- `scripts/seed_acca_test_data.js`
- `scripts/seed_final.js`
- `supabase/migrations/20260616_scout_signal_mirror.sql`
- `supabase/migrations/20260617000000_setup_accas.sql`
- `temp_migrate.js`
- `try_regions.js`

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

## Phase BA — BYTE AUTHORITY + ABSENT-CANDIDATE FAIL-CLOSED SCOPE SEAL

### Final byte authority selection (BA-A only)

BA-A — TRACKED GIT BLOB AUTHORITY

The implementation agent must not choose between BA-A / BA-B / BA-C.
For this sealed packet, the law is state-specific:

- PRESENT_TRACKED uses raw tracked Git index blob bytes as the only authoritative source bytes.
- PRESENT_PRESERVED_CANDIDATE uses raw filesystem bytes as the only authoritative source bytes.
- ABSENT_PRESERVED_CANDIDATE has no current source bytes (no source-content extraction).

### LAW BA-1 — final byte authority selection

PRESENT_TRACKED:
- Authoritative source bytes are the exact raw Git index blob bytes for the tracked path.
- The raw object read is semantically equivalent to: `git cat-file blob :<asset_path>`
- The process must capture stdout as raw bytes / Buffer.
- Do not decode to text before `source_content_sha256`.
- Do not use `--filters` or `--textconv`.
- Do not apply newline normalization, trimming, JSON parsing/serialization, text re-encoding, or any source canonicalization prior to `source_content_sha256`.

PRESENT_PRESERVED_CANDIDATE:
- Authoritative source bytes remain the exact filesystem bytes returned by `fs.readFileSync(... )` as a Buffer.
- Do not normalize these bytes before `source_content_sha256`.

ABSENT_PRESERVED_CANDIDATE:
- No current source bytes exist.

### LAW BA-2 — current source presence remains filesystem-derived

This law changes byte authority for PRESENT_TRACKED.
It does NOT change the three source-presence states.

Exactly three states remain:
- `PRESENT_TRACKED`
- `PRESENT_PRESERVED_CANDIDATE`
- `ABSENT_PRESERVED_CANDIDATE`

For PRESENT_TRACKED:
- the filesystem path must currently exist as a file.
- A raw Git blob existing in the index does not by itself prove current filesystem presence.

### LAW BA-3 — tracked worktree drift fail-closed

Using raw Git blob authority must not make actual working-tree source edits invisible.

The checker must derive tracked working-tree drift separately from byte authority.
It must use a deterministic Git query equivalent to:

`git diff --name-only --no-ext-diff --no-renames`

For every PRESENT_TRACKED material runtime source:
- if its `asset_path` is in the tracked working-tree changed-path set: fail closed with deterministic drift error:
  - `ESA_RR_002_TRACKED_WORKTREE_DRIFT: <asset_path>`

Git-recognized EOL checkout cleanliness relative to the index must not trigger this error.
Actual Git-recognized working-tree edits must trigger it.

### LAW BA-4 — staged index drift fail-closed (canonical bootstrap boundary)

The Git index is mutable.
Canonical runtime inventory bootstrap must not capture provenance from staged runtime-source content that is not represented by the current HEAD commit.

Before canonical bootstrap/write:
derive tracked staged-path drift relative to HEAD using a deterministic Git query equivalent to:

`git diff --cached --name-only --no-ext-diff --no-renames`

For every PRESENT_TRACKED material runtime source:
- if its `asset_path` is in the staged changed-path set: fail closed before any inventory/map write with deterministic error:
  - `ESA_RR_002_TRACKED_INDEX_DRIFT: <asset_path>`

This guarantees the raw index blob used for canonical provenance is also reproducible from the current committed Git state for material runtime sources.

### LAW BA-5 — raw tracked blob read helper law

Implementation must use semantics equivalent to:

```js
function readTrackedIndexBlobBytes(relativePath) {
  const assetPath = normalizePath(relativePath);

  const result = spawnSync(
    "git",
    ["cat-file", "blob", `:${assetPath}`],
    {
      cwd: ROOT,
      encoding: null,
      maxBuffer: 64 * 1024 * 1024,
    }
  );

  if (
    result.error ||
    result.status !== 0 ||
    !Buffer.isBuffer(result.stdout)
  ) {
    return {
      bytes: null,
      error:
        `ESA_RR_002_TRACKED_BLOB_READ_FAILED: ${assetPath}`,
    };
  }

  return {
    bytes: result.stdout,
    error: null,
  };
}
```

Raw Buffer stdout, `git cat-file blob :<asset_path>`, no `--filters`, no `--textconv`, no string decoding before SHA-256.
A raw blob read failure fails closed.

### LAW BA-6 — one authoritative byte buffer per present source

For every PRESENT source derive exactly once:
- `authoritativeSourceBytes`

Then use the SAME Buffer for:
- `source_content_sha256`
- relationship extraction input text (after UTF-8 decoding)

through:
- `authoritativeSourceBytes.toString("utf8")`

Do not hash one representation and extract from another.

## Phase AC — GOVERNED ABSENT PRESERVED CANDIDATE FAIL-CLOSED SCOPE SEAL

### LAW AC-1 — governed absent candidates never disappear

Every path returned by the governed preserved-candidate candidate-universe law remains part of discovery consideration even when the source is absent.

For every ABSENT_PRESERVED_CANDIDATE:
- locate the committed inventory record by `asset_path`.
- Exactly three outcomes are valid:
  - AC-1A: committed record exists + valid provenance => carry forward committed relationship evidence + committed provenance unchanged.
  - AC-1B: committed record exists but provenance is missing/invalid/stale => fail closed; candidate must not be omitted, demoted, or removed from the problem set.
    - deterministic semantic error: `ESA_RR_002_ABSENT_PROVENANCE_REQUIRED: <asset_path>`
    - (or additional existing provenance schema/fingerprint errors if appropriate)
  - AC-1C: no committed inventory record exists => fail closed:
    - deterministic semantic error: `ESA_RR_002_ABSENT_COMMITTED_RECORD_REQUIRED: <asset_path>`

### LAW AC-2 — bootstrap must prove candidate-universe accounting

Before canonical write derive:
- `candidateUniversePathSet`
- `accountedPathSet`

A candidate is accounted only when it produced:
- a valid PRESENT discovered surface
- a valid ABSENT provenance carry-forward surface
- a deterministic fail-closed diagnostic

The bootstrap must prove:
- `candidateUniversePathSet - accountedPathSet = EMPTY`

If not empty:
- fail closed with deterministic error:
  - `ESA_RR_002_CANDIDATE_UNACCOUNTED: <asset_path>`

### LAW AC-3 — no canonical write on absent-provenance error

If any absent preserved candidate reports:
- `ESA_RR_002_ABSENT_PROVENANCE_REQUIRED`
- `ESA_RR_002_ABSENT_COMMITTED_RECORD_REQUIRED`
- or any existing provenance validation/fingerprint error:

then bootstrap must write:
- NO inventory file
- NO runtime map file

The complete next canonical state must be built in memory.

### LAW AC-4 — current eight-path recovery prerequisite

The following eight paths are currently proven absent and lack valid prior relationship_evidence_provenance.
The implementation agent may not invent provenance for these paths.
The canonical ESA-RR-002 bootstrap cannot successfully close until each path follows RCP-1 or RCP-2 in the next controlled task.

Recovery prerequisite route (current expected):
- RCP-1 — recover real source bytes; do not guess/recreate source content
- RCP-2 — locate previously captured valid relationship_evidence_provenance from a trusted governed canonical artifact and prove it corresponds to the existing committed relationship evidence (current evidence reports no such pre-Commit-B provenance)

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

`source_content_sha256` is the SHA-256 over the exact authoritative source bytes selected by BA-A:

- For `PRESENT_TRACKED`: raw tracked Git index blob bytes (`git cat-file blob :<asset_path>`) captured as a Buffer (no decoding before hashing).
- For `PRESENT_PRESERVED_CANDIDATE`: exact filesystem bytes captured as a Buffer (`fs.readFileSync`) with no normalization.

For `ABSENT_PRESERVED_CANDIDATE`, no source-content hash is extracted.

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
3. locate the committed inventory record by `asset_path`, else fail closed:
   - `ESA_RR_002_ABSENT_COMMITTED_RECORD_REQUIRED: <asset_path>`
4. locate the committed `relationship_evidence_provenance`, else fail closed:
   - `ESA_RR_002_ABSENT_PROVENANCE_REQUIRED: <asset_path>`
5. validate its exact schema;
6. require `captured_source_presence_state` to be `PRESENT_TRACKED` or `PRESENT_PRESERVED_CANDIDATE`;
7. validate `source_content_sha256` format;
8. validate `relationship_evidence_sha256` format;
9. recalculate `relationship_evidence_sha256` from the committed governed relationship-evidence fields;
10. require the recalculated fingerprint to equal the committed provenance fingerprint;
11. retain the committed relationship evidence only when all checks pass.

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

Do not rename, remove, duplicate, or create additional test IDs beyond:
- `ESA-RR-T01` through `ESA-RR-T16` (no `T17`).

### LAW TS-1 — contract-test filesystem safety

ESA-RR-T01 through ESA-RR-T16 may not rename/move/delete/truncate/rewrite any real governed preserved-candidate source path.
All presence/absence/returning-source simulations must use test-owned fixtures in temporary directories only.

Seal required proof:
- REAL GOVERNED SOURCE MUTATION BY ESA-RR TESTS: 0

### LAW TS-2 — exact 16 test IDs remain

The contract test IDs remain exactly:
- `ESA-RR-T01` ... `ESA-RR-T16` (16 total; no T17).

### Proof obligations mapping onto existing primary rows (no new test IDs)

The following proof obligations must be demonstrated by the implementation correction using the existing T01-T16 tests (test logic may be updated, but T01-T16 identity remains):

| Primary ESA-RR test ID | Proof obligations proved by this test |
|---|---|
| `ESA-RR-T01` | absent committed record required; candidate-universe accounting (fail closed if unaccounted) |
| `ESA-RR-T02` | tracked Git blob byte authority (BA-A); tracked worktree drift fail-closed |
| `ESA-RR-T03` | real governed source mutation count zero (via fixture-only mutation); source-presence state transitions |
| `ESA-RR-T04` | same authoritative byte buffer law (no synthetic empty-source relationship extraction) |
| `ESA-RR-T05` | absent provenance required (AC-1B fail-closed); absent evidence retention |
| `ESA-RR-T06` | absent provenance/provenance binding fail-closed (AC-1B); provenance binding |
| `ESA-RR-T07` | absent provenance required (AC-1B schema invalid/missing provenance); fail closed invalid provenance |
| `ESA-RR-T08` | returning-source reread; same authoritative buffer used for hash and extraction |
| `ESA-RR-T09` | returning-source re-extraction; governed relationship fields from authoritative bytes |
| `ESA-RR-T10` | governed relationship fields drift behavior (unchanged non-governed inventory fields) |
| `ESA-RR-T11` | clean-checkout reproducibility; real governed source mutation count zero (fixture-only) |
| `ESA-RR-T12` | returning-source drift; staged index drift fail-closed (BA-4) |
| `ESA-RR-T13` | map newline normalization parity (observational; not byte authority) |
| `ESA-RR-T14` | bootstrap/validation separation (no canonical write on read-only validation) |
| `ESA-RR-T15` | absent governed-candidate accounting (no silent omission); absent evidence retention |
| `ESA-RR-T16` | tracked staged/clean checkout boundaries; candidate-universe accounting; fixture-only mutation proof |

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
