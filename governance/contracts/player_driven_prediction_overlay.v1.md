# Player-Driven Prediction Overlay v1

**Overlay ID:** PDM-001  
**Status:** PROPOSED  
**Applies to:** SKCS Scout and SKCS Edge  
**Decision date:** 2026-07-17  
**Implementation authority:** None. This document records architecture and future governed work only.

## 1. Decision

SKCS predictions shall be designed from the people and interactions that produce team behaviour, rather than treating a club's historic team identity or league position as the primary causal unit.

The governing chain is:

`people -> availability and current state -> relationships -> coaching/tactical system -> team behaviour -> match behaviour -> outcomes`

A club or team remains a necessary container and contextual entity, but it is not sufficient evidence for future performance. Historic team dominance must not be treated as a permanent strength constant when the underlying players, coaching staff, roles, age profile, fitness, chemistry or tactical system have changed.

## 2. Why this overlay exists

Conventional team-first models can overvalue reputation and historical results. A previously dominant team may deteriorate because experienced players leave, key players age, replacements do not fit the system, roles change, the manager changes, physical intensity declines, chemistry weakens or opponents adapt.

The prediction architecture must therefore be capable of explaining material changes in expected performance through current personnel and system evidence.

## 3. Scout responsibility

Scout remains the sole governed evidence-acquisition and evidence-history authority. Scout shall eventually provide full-fidelity, canonical, traceable historical evidence required by player-driven modelling, including where available:

- player identity and aliases;
- fixture participation, starts, substitutions and minutes;
- position, role and formation context;
- goals, assists, shots, shot locations and shot quality inputs;
- passes, defensive actions, fouls, cards and other event evidence;
- player availability, injuries and suspensions;
- age and objective workload/recovery evidence;
- teammates and opponents present during events;
- coaches, managers and relevant staff tenure/change evidence;
- team and competition context;
- source provenance, evidence timestamps, quality state and schema version.

Scout may perform objective, reproducible transformations such as canonical identity resolution, time normalization, unit normalization, age-at-fixture, rest days, minutes totals and governed event classification.

Scout shall not own predictive interpretations such as player importance, player decline, tactical fit, chemistry scores, expected goals, win probabilities, confidence, model weights or publication qualification.

## 4. Edge responsibility

Edge owns modelling and future interpretation. Edge shall eventually consume governed historical and current-fixture evidence to build:

- player-state estimates;
- player digital twins or equivalent evidence-backed state models;
- player interaction and chemistry graphs;
- lineup and replacement impact models;
- coach and tactical-system modifiers;
- ageing, development, workload and recovery trends;
- scenario simulations;
- team behaviour assembled from the available people and system;
- player, team and market outcome probabilities;
- calibration, uncertainty, counterfactuals and abstention/publication gates.

Team-level predictions remain valid outputs, but they must be derived from the current personnel/system model and contextual evidence rather than from club reputation alone.

## 5. Data boundary

Scout must not reduce the handoff to final percentages or thin summary scores. Edge requires historical player-, coach-, lineup-, fixture- and event-level evidence sufficient to construct and test its own formulas.

The governing rule is:

> Scout supplies what happened, who was involved, when it happened, under what context, and how reliable the evidence is. Edge calculates what that evidence means for the future.

Edge must not independently acquire uncontrolled supplier sports data. The preferred future transport is a versioned, governed historical evidence publication or read-only analytical interface from Scout, with immutable evidence snapshot references.

## 6. Model philosophy reserved for future Edge work

Future governed work may evaluate multiple independent model families, including:

- dynamic player and team state models;
- shot/chance-generation models;
- lineup and player-interaction models;
- tactical matchup models;
- historical similar-match retrieval;
- coaching and regime-change models;
- scenario and Monte Carlo simulation;
- context-aware mixtures of experts;
- causal adjustment tests;
- market benchmarking;
- adversarial/red-team review;
- explicit natural uncertainty, data uncertainty and model disagreement;
- qualified, conditional or no-prediction outputs.

No formula, model weight or implementation is approved by this overlay.

## 7. Required future mini-project split

PDM-001 is a cross-project overlay and must later be decomposed into separately approved mini-projects.

### Scout future mini-project

Define and prove the Player/Personnel Historical Evidence Contract and publication mechanism. It must identify current evidence coverage and gaps before adding collection or storage.

### Edge future mini-project

Define and prove a player-driven probabilistic baseline against a conventional team-level baseline using time-separated historical testing, calibration, Brier score and log loss.

Neither project may start automatically from this document.

## 8. Definition of Done for PDM-001 governance capture

- The shared architectural decision is recorded in both repositories.
- Scout and Edge responsibilities are explicit.
- Full historical player/personnel evidence is distinguished from final prediction output.
- Direct supplier acquisition by Edge remains forbidden.
- Implementation and formula selection remain deferred.
- Both Control Centers reference this overlay as PROPOSED and not startable.

## 9. Non-goals

This overlay does not:

- change Scout runtime acquisition;
- change the FIP runtime contract;
- change Neon or Drive storage;
- copy Scout history into Edge Supabase;
- implement player profiles or digital twins;
- alter Edge prediction formulas;
- approve the Scout-Edge marriage gate;
- start a prediction-engine project.

## 10. Supplemental operating decision — revolving workload and progressive prediction

**Supplemental decision date:** 2026-07-17
**Decision status:** Recorded addition to the PDM-001 architecture; no runtime or implementation authority is granted.

### 10.1 Nine-day revolving fixture horizon

The shared Scout–Edge operating model shall be designed around a revolving nine-day horizon:

- Days 1 through 8 are the active fixture-processing window.
- Day 1 represents the most immediate fixture day and receives the highest prediction-refresh priority.
- Day 8 represents the furthest active fixture day.
- Day 9 is a lightweight background-preparation day that discovers, verifies and prepares fixtures before they enter Day 8.
- At rollover, each active fixture day moves one position closer, the prepared Day 9 cohort becomes Day 8, and completed Day 1 fixtures move to post-fixture closure.

The existence of a fixture in the window does not require full reprocessing. Scout and Edge must prefer delta-based work and skip unchanged fixtures.

### 10.2 Three-hour workload ownership windows

The twenty-four-hour operating day may be divided into eight three-hour ownership windows, one for each active fixture day.

Each ownership window must:

1. process the assigned fixture day first;
2. enforce a bounded execution, request and retry budget;
3. checkpoint and close its assigned work safely;
4. release unused capacity to other approved work, such as another sporting code, Day 9 preparation, reconciliation, archiving or controlled retries.

A three-hour ownership window is a capacity boundary, not an instruction to consume the full three hours. Football may receive a larger weighted allocation because of its fixture and evidence volume, but it must not monopolise the operating day or prevent the other governed sporting codes from progressing.

### 10.3 Scout workload responsibility

Scout progressively matures the evidence package across the active fixture horizon.

Scout must:

- discover and verify fixtures through the applicable identity and fixture gates;
- collect, classify and archive governed evidence;
- identify what changed since the previous successful package;
- distinguish material changes from repeated or non-material evidence;
- perform only objective and reproducible transformations;
- issue versioned fixture evidence packages and deltas;
- mark the affected evidence domains and package readiness;
- avoid unnecessary archive and index writes when no material change exists.

Distant fixture days may require broader evidence preparation, while later fixture days require increasingly current evidence. Scout must not execute prediction formulas, assign predictive weights or publish probabilities.

### 10.4 Edge workload responsibility

Edge progressively matures the prediction as Scout evidence matures.

The intended Edge policy is:

- establish an initial baseline for eligible distant fixtures;
- perform only minor or incremental adjustments for Days 8 through 2 when material evidence changes;
- assign the greatest formula and simulation capacity to Day 1;
- perform a nominal scheduled refresh every three hours for eligible active fixtures;
- skip fixtures whose consumed Scout package has not materially changed;
- rerun only formulas and model components that depend on the changed evidence domains;
- preserve formula, feature, model and consumed-package version references for every refresh.

A small priority-event lane may refresh one affected fixture without waiting for the next scheduled cycle when Scout verifies a material late event such as a confirmed lineup, late withdrawal, cancellation, kickoff or venue change, or major weather disruption.

### 10.5 Multi-sport and formula isolation

The platform is intended to support sixteen governed sporting codes. Each code must therefore have isolated workload controls.

Future implementation must provide:

- sport-specific queues or equivalent partitions;
- per-sport fixture, request, duration and retry budgets;
- prioritisation that prevents one sport from starving another;
- checkpoints and explicit overflow handling;
- failure isolation so that one sport does not block the remaining sports;
- sport-scoped formulas and features.

Each Edge formula or model component must declare at minimum:

- the sporting code to which it applies;
- its required evidence domains;
- its feature and formula dependencies;
- its eligible fixture stage or refresh trigger;
- its version;
- the conditions under which recalculation may be skipped.

No fixture may trigger formulas from another sporting code, and no evidence update may cause an uncontrolled full-history or full-portfolio recalculation.

### 10.6 Governed Scout-to-Edge handoff

The future versioned handoff should expose sufficient control metadata for incremental Edge processing, including where applicable:

- fixture identity and sporting code;
- fixture-window day;
- evidence-package version;
- evidence effective time;
- changed evidence domains;
- material-change state;
- readiness state;
- superseded package reference;
- evidence quality and provenance references.

Edge must record which Scout package version was consumed and which formula and model versions produced the resulting prediction state.

### 10.7 Required proof before activation

Before runtime implementation, separately approved mini-projects must:

1. inventory the current Scout scheduler, tick, package and queue behaviour;
2. inventory the current Edge refresh, formula and dependency behaviour;
3. define capacity budgets and overflow rules;
4. prove sport and fixture isolation;
5. prove delta-based package and formula refresh behaviour;
6. run the design in shadow mode;
7. measure duration, throughput, retries, failures, storage growth and skipped unchanged work;
8. demonstrate that football cannot consume the complete operating day;
9. demonstrate that one sporting-code failure cannot stop the others.

This addition does not approve scheduler implementation, formula implementation, production activation or expansion of any sporting code.
