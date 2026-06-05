# SKCS Documentation Policy

## Core rule

- No new formula, rule, table, view, API integration, scheduled job, or provider should be considered complete until it has a documentation entry.

## What must be documented

- Purpose.
- Inputs and outputs.
- Relationships.
- Consumers.
- Dependencies.
- Failure mode.
- Ownership or subsystem.

## Required behavior for future changes

- Update the knowledge layer in the same change as the code when possible.
- If a change is too large, add a gap note immediately and close it in the next step.
- Do not let undocumented assets accumulate silently.

## Practical priority

- Document first.
- Change second.
- Audit third.
- Run `npm run verify:rulebook` before merging rule-related changes to catch legacy `80/70/59` or `76%` drift.
- Run `npm run install:hooks` once per clone to enable the local pre-commit guard (no GitHub Actions billing).
