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

When current approved Edge work is closed and Scout evidence coverage is known, perform a read-only joint PDM-001 prediction-input, formula-dependency and capacity inspection covering the nine-day revolving fixture horizon, three-hour refresh design, Day 1 prioritisation, incremental Days 2–8 refreshes, per-sport workload limits and consumed Scout package versions. Do not change prediction rules, formulas, schedulers or runtime behaviour during that inspection.

## Governance note

This proposal file does not bypass `EDGE_MASTER_PROJECT_REGISTER.v1.json`. PDM-001 must be added through the canonical project-registration workflow before it becomes an executable mini-project.

## Recorded operating-model addition — progressive prediction and Scout balance

PDM-001 now also records the intended cross-project workload model:

- Days 1 through 8 form the active revolving fixture horizon.
- Day 9 is prepared in the background before entering Day 8.
- The twenty-four-hour day may be divided into eight bounded three-hour fixture-day ownership windows.
- Football may receive a larger weighted allocation but may not prevent other sporting codes from progressing.
- Scout performs fixture verification, evidence acquisition, classification, archiving and objective package preparation.
- Scout publishes versioned evidence packages and identifies material changes and affected evidence domains.
- Edge consumes those package versions and owns all formulas, features, simulations, weights, probabilities and prediction publication decisions.
- Day 1 receives the greatest Edge compute and refresh priority.
- Days 8 through 2 receive baseline or incremental recalculation only when relevant evidence changes.
- Edge may use a nominal three-hour scheduled refresh for eligible fixtures.
- Confirmed lineups and other verified late material events may enter a narrow targeted-refresh lane.
- Edge must rerun only the formulas and model components dependent on the changed evidence.
- All sixteen sporting codes require isolated workload budgets, formula lanes, checkpoints and failure boundaries.

This is a governance addition only. It does not authorise prediction-runtime, scheduler, formula, storage, UI or production changes.

### Required future proof

A separately approved joint inspection must determine:

- the current Edge refresh and prediction execution paths;
- current feature, formula and model dependency behaviour;
- whether consumed Scout package versions are recorded;
- whether unchanged fixtures can be skipped safely;
- the required Day 1 versus Days 2–8 compute allocation;
- per-sport capacity, checkpoint, overflow and failure-isolation requirements;
- the shadow-mode and load proof required before activation.
