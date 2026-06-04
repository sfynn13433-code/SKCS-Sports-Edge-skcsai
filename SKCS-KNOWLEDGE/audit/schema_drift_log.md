# SKCS Schema Drift Log

## 2026-06-03

- Compatibility issue detected when pushing migrations: an older migration attempted `ALTER TABLE public.predictions_final` while the current schema chain treats `predictions_final` as a view.
- Fix applied in repo to guard the constraint change behind a table-kind check.

## Why this matters

- The repo has evolved through multiple schema eras.
- Some scripts still assume old table-based shapes.
- The knowledge layer should record these mismatches before they become production failures.

## Future entries

- Table-to-view migrations.
- Column rename migrations.
- New canonical tables that replace older publication tables.
- Any change that alters the read path for the website or AI tools.
