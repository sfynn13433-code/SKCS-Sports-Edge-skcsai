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
