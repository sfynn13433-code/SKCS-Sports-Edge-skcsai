# ESG-001 — Sport Governor and Canonical Rule Registry Proposal

**Status:** PROPOSED — FUTURE MINI-PROJECT  
**Priority:** CRITICAL  
**Workstream:** Prediction Pipeline / Scout Handoff / Sports Rule Governance  
**Recorded:** 2026-07-13  
**Owner decision:** Stephen approved the architectural direction that every supported sporting code must have its own sport governor operating under one shared SKCS sports-governance constitution.

---

## 1. Problem statement

SKCS Edge contains evidence of multiple rules or interpretations for the same soccer outcome. This can cause one runtime surface to accept an outcome while another rejects it. Valid sports data may therefore exist while no prescription is produced because prediction, market, filtering, and prescription layers do not share one authoritative rule.

The absence of a sport-specific governor during the original build allowed duplicate, overlapping, or conflicting rule definitions to develop.

## 2. Architectural decision

SKCS will use:

1. One shared SKCS Sports Governance Constitution.
2. One governor for each supported sporting code.
3. One canonical rule registry shared by Scout and Edge.
4. One active rule version for each sport, outcome, and market scope.
5. Explicit rejection reasons whenever a prescription is not produced.

Initial governor set:

- Soccer Governor
- Cricket Governor
- Rugby Governor
- Tennis Governor
- Additional sport governors only through separately approved expansion

## 3. Responsibility boundary

### Shared Sports Governance Constitution

Defines the mandatory structure for all sport governors, including rule identifiers, ownership, approval, versioning, effective dates, evidence, testing, deprecation, retirement, and change control.

### Sport Governor

Owns the canonical definitions, terminology, input requirements, calculations, competition scope, exceptions, settlement interpretation, and prescription eligibility rules for one sporting code.

### Scout

Acquires, validates, and publishes governed sports truth and inputs that satisfy the applicable sport-governor contract.

### Edge

Consumes governed Scout intelligence and applies only the approved sport-governor rule identifiers and versions for prediction, scoring, filtering, market interpretation, ACCA construction, prescription generation, explanation, and publication.

## 4. Required canonical rule fields

Each rule must define at minimum:

- `sport_id`
- `rule_id`
- `rule_name`
- `rule_version`
- `canonical_definition`
- `outcome_or_market_scope`
- `input_requirements`
- `calculation_logic`
- `competition_scope`
- `exceptions`
- `eligibility_thresholds`
- `rejection_reason_codes`
- `validation_tests`
- `effective_date`
- `supersedes_rule_version`
- `retirement_state`
- `governance_owner`

## 5. First implementation mini-project

**Name:** Soccer Governor and Canonical Rule Consolidation

**Start condition:** Must not activate until the current approved repository-cleanup mini-project is formally closed and Control Center sequencing separately approves ESG-001.

**Exact scope:** Inventory all soccer rule implementations and references across Scout, Edge, prediction logic, filtering, prescriptions, ACCA logic, APIs, scripts, SQL, configuration, tests, and governance artifacts. Identify duplicate, overlapping, and conflicting definitions. Select one canonical rule and one active version for every supported soccer outcome.

**Objective:** Ensure that valid governed soccer data produces a deterministic prescription decision because every participating component uses the same approved rule authority.

## 6. Definition of Done

ESG-001 is complete only when:

1. Every soccer rule and rule consumer is inventoried.
2. Duplicate and conflicting definitions are documented with evidence.
3. One canonical definition is approved for each supported soccer outcome and market.
4. One rule identifier and active version are designated for each canonical rule.
5. Scout output requirements map to the canonical soccer rules.
6. Edge prediction, filtering, ACCA, prescription, explanation, and publication paths reference the canonical rules.
7. Legacy rules are marked for governed retirement and are not silently deleted.
8. Tests prove identical inputs produce identical rule decisions across all governed consumers.
9. Tests prove valid governed data can produce the expected prescription.
10. Tests prove insufficient or invalid data returns one explicit rejection reason code.
11. No unexplained `NO_PRESCRIPTION` result remains.
12. Control Center ledger, master project register, dependency map, backlog, governed asset register, and relevant tests are synchronized.

## 7. Current execution boundary

This proposal records future critical work only.

It does not:

- activate ESG-001;
- change any soccer rule;
- modify Scout or Edge runtime behavior;
- clear the Scout ↔ Edge marriage gate;
- alter Supabase or Neon;
- remove or retire any existing rule;
- interrupt the currently active repository-cleanup mini-project.

A separate Control Center approval is required before inspection or implementation begins.
