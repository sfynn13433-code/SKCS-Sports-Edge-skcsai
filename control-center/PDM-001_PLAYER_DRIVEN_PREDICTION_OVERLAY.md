# PDM-001 — Player-Driven Prediction Overlay

**Control state:** PROPOSED  
**Startable:** NO  
**Priority:** Future architecture  
**Scope type:** Cross-project overlay  
**Companion Scout record:** `control-center/PDM-001_PLAYER_DRIVEN_PREDICTION_OVERLAY.md` in SKCS Scout  
**Architecture contract:** `governance/contracts/player_driven_prediction_overlay.v1.md`

## Objective

Preserve the approved architectural direction that future SKCS prediction work must be player/personnel-driven and interaction-aware, while keeping Scout responsible for governed historical evidence and Edge responsible for predictive interpretation, simulation and publication.

## Edge future scope

Before implementation, define and test a player-driven probabilistic baseline that consumes governed player, coach, lineup, fixture and event history from Scout. Compare it against a conventional team-level baseline using time-separated historical tests, calibration, Brier score and log loss.

## Explicitly deferred

- prediction-runtime changes;
- formula or weight selection;
- Player Digital Twin implementation;
- Supabase schema or storage changes;
- copying Scout raw/history data into Supabase;
- direct supplier acquisition by Edge;
- FIP intake changes;
- Scout-Edge marriage approval;
- UI or publication changes.

## Dependencies

- Scout Player/Personnel Historical Evidence Contract;
- governed historical transport and immutable evidence snapshots;
- Edge prediction-pipeline inspection and baseline definition;
- storage/retention decision that preserves Scout as evidence authority;
- separate mini-project approval.

## Definition of Done for this registration

- Architecture decision preserved in a governed Edge contract.
- Matching proposal preserved in Scout.
- Responsibilities and data boundary are explicit.
- Project remains PROPOSED and not startable.
- Later activation requires registration through the canonical Edge Master Project Register workflow and separate approval.

## Next action

When current approved Edge work is closed and Scout evidence coverage is known, perform a read-only Edge prediction-input and baseline inspection. Do not change prediction rules during that inspection.

## Governance note

This proposal file does not bypass `EDGE_MASTER_PROJECT_REGISTER.v1.json`. PDM-001 must be added through the canonical project-registration workflow before it becomes an executable mini-project.
