# EDGE-GOV-001 - Edge Asset Work Sequence Policy

Policy ID: EDGE-GOV-001

Policy title: Edge Asset Work Sequence Policy

Governed work sequence:

CLASSIFY
-> CLASSIFICATION CLOSURE
-> FINDING REVIEW
-> SEPARATE APPROVED MINI-PROJECT
-> INSPECT
-> REPAIR ONLY IF PROVED
-> VALIDATE
-> FORMAL CLOSE

Rules:

1. Classification is classification only. No cleanup, merge, deletion, refactor, or repair during classification.
2. Classification must formally close before asset repair begins unless an evidenced critical blocker makes classification impossible.
3. A finding does not automatically become repair work. Record it, review it, and create a separate governed task.
4. Only one approved mini-project may be active at a time.
5. Inspect before change. Require evidence from references, dependencies, runtime use, source authority, and relevant tests.
6. Never repair, delete, merge, or refactor on assumptions.
7. Unrelated findings must be deferred and must not expand current scope.
8. No new mini-project starts until the current one is formally PASS, HOLD/DEFERRED, or otherwise closed by explicit governance decision.
9. Canonical Control Center next_action controls work sequence and may not be bypassed because another issue appears interesting.
10. Every repair mini-project must have exact scope, objective, and Definition of Done before modification.
11. Repository asset register classification is the baseline for later inspection. Do not restart repository discovery from scratch without evidence that the baseline is invalid.
12. IDE/Codex work packets must be narrow and deterministic by default: one question or one focused change, minimum files, short evidence return. Broad multi-phase work requires explicit approval.
