# SKCS Technical Debt

## Known debt themes

- Legacy compatibility layers still exist beside the newer SQL-first design.
- Some schema assumptions are duplicated across older migrations and newer views.
- Provider and quota logic is split across multiple runtime services.
- Not every business rule is yet captured in SQL.
- The current repository still mixes publication logic, scoring logic, and compatibility logic.

## Why this matters

- Technical debt in SKCS is mostly architectural drift.
- The knowledge layer should make drift visible before it becomes a production issue.

## Next debt items to track

- Duplicate prediction read surfaces.
- Legacy migrations that no longer match the live schema shape.
- Hidden cron or interval jobs.
- Provider fallback complexity.
