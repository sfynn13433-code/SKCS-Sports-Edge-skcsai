# SKCS Edge Project Dependency Map

Generated from `EDGE_MASTER_PROJECT_REGISTER.v1.json`.

## ECC-001 — Edge Control Center v1

Status: DONE
Governed by: ECC-001
Blocked by: none
Blocks: EPR-001

## EPR-001 — Edge Master Project Register

Status: TESTED
Governed by: EPR-001
Blocked by: ECC-001
Blocks: EDGE-GOV-001, ESA-001, EAC-001

## EDGE-GOV-001 — Edge Asset Work Sequence Policy

Status: DONE
Governed by: EDGE-GOV-001
Blocked by: EPR-001
Blocks: none

## ESA-001 — Edge System and Runtime Inventory

Status: TESTED
Governed by: ESA-001
Blocked by: EPR-001
Blocks: EAC-001, EMG-001, EFI-001, EST-001, ESEC-001, EPI-001, EGR-001, EAI-001, EUI-001, EOPS-001, FIP-001

## EAC-001 — Edge Asset Classification and Repository Map

Status: APPROVED
Governed by: EAC-001
Blocked by: EPR-001, ESA-001
Blocks: EAC-R1-001, EMG-001

## EAC-R1-001 — EAC-001 B18 Manifest and Repository Map Alignment Repair

Status: DONE
Governed by: EAC-R1-001
Blocked by: EAC-001
Blocks: none

## EMG-001 — Scout-Edge Marriage Gate Contract

Status: APPROVED
Governed by: EMG-001
Blocked by: ESA-001, EAC-001
Blocks: EFI-001, EST-001, ESEC-001, FIP-001

## EFI-001 — FIP Intake Handshake

Status: TESTED
Governed by: EFI-001
Blocked by: ESA-001, EMG-001
Blocks: EPRV-001, E2E-001

## EST-001 — Supabase Storage and FIP Retention Contract

Status: TESTED
Governed by: EST-001
Blocked by: ESA-001, EMG-001
Blocks: EOPS-001, E2E-001

## ESEC-001 — Subscriber and Security Boundary

Status: PROPOSED
Governed by: ESEC-001
Blocked by: ESA-001, EMG-001
Blocks: EUI-001, EOPS-001, E2E-001

## EPI-001 — Prediction Pipeline Integrity

Status: TESTED
Governed by: EPI-001
Blocked by: ESA-001
Blocks: EGR-001, EAI-001, EUI-001, E2E-001

## EPRV-001 — External Sports Provider Removal

Status: PARTIAL
Governed by: EPRV-001
Blocked by: EFI-001
Blocks: E2E-001

## EGR-001 — Grading and Accuracy Governance

Status: PROPOSED
Governed by: EGR-001
Blocked by: ESA-001, EPI-001
Blocks: none

## EAI-001 — AI Provider and EdgeMind Boundary

Status: PROPOSED
Governed by: EAI-001
Blocked by: ESA-001, EPI-001
Blocks: none

## EUI-001 — Subscriber UI and Prediction Delivery

Status: PROPOSED
Governed by: EUI-001
Blocked by: ESA-001, ESEC-001, EPI-001
Blocks: none

## ECU-001 — Edge Control Center Operator UI

Status: APPROVED
Governed by: ECU-001
Blocked by: none
Blocks: none

## EOPS-001 — Deployment and Operations Governance

Status: PROPOSED
Governed by: EOPS-001
Blocked by: ESA-001, EST-001, ESEC-001
Blocks: none

## FIP-001 — Scout FIP Authority Contract

Status: APPROVED
Governed by: FIP-001
Blocked by: ESA-001, EMG-001
Blocks: none

## E2E-001 — Scout to Edge End-to-End Proof

Status: BLOCKED
Governed by: E2E-001
Blocked by: EFI-001, EST-001, ESEC-001, EPI-001, EPRV-001
Blocks: none

## ESA-RR-001 — ESA-RR-001 Runtime Repair Base Contract (Approved)

Status: APPROVED
Governed by: ESA-RR-001
Blocked by: none
Blocks: none

## ESA-RR-002 — ESA-RR-002 Implementation Law Seal (Hold)

Status: TESTED
Governed by: ESA-RR-002
Blocked by: none
Blocks: none

## SEM-GOV-001A — Canonical Lifecycle, Terminology, Rolling Eight-Day Funnel and Help Contract

Status: APPROVED
Governed by: SEM-GOV-001A
Blocked by: ESA-001, EPI-001
Blocks: none

## SEM-GOV-001B — Football Lifecycle Persistence Contract

Status: APPROVED
Governed by: SEM-GOV-001B
Blocked by: SEM-GOV-001A
Blocks: none
