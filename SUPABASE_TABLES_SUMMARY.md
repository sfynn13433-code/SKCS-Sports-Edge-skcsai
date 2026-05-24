# Supabase Tables - Complete List with Functions

**Total Tables:** 81

---

## Prediction Tables

| Table Name | Function |
|------------|----------|
| `predictions_raw` | Stores raw AI predictions before processing |
| `predictions_filtered` | Stores final/published predictions for display |
| `predictions_stage_1` | Stores intermediate prediction pipeline stages |
| `predictions_stage_2` | Stores intermediate prediction pipeline stages |
| `predictions_stage_3` | Stores intermediate prediction pipeline stages |
| `predictions_unified` | Unified predictions table |
| `predictions_accuracy` | Tracks prediction accuracy metrics |
| `ai_predictions` | Prediction-related table |
| `direct1x2_prediction_final` | Stores final/published predictions for display |
| `direct_1x2_insights` | Stores AI-generated insights and analysis |
| `direct_1x2_stages` | Stores intermediate prediction pipeline stages |
| `prediction_core` | Prediction-related table |
| `prediction_insights` | Stores AI-generated insights and analysis |
| `prediction_metadata` | Stores prediction metadata |
| `prediction_publication` | Stores prediction publication data |
| `prediction_publish_runs` | Tracks prediction publish runs |
| `prediction_results` | Stores prediction results |
| `prediction_secondary_markets` | Stores secondary market predictions |

---

## Fixture/Match Tables

| Table Name | Function |
|------------|----------|
| `fixtures` | Stores match/fixture information |
| `fixtures_unified` | Unified fixture data |
| `fixtures_backup_phase1` | Backup table for fixtures |
| `cricket_fixtures` | Stores cricket match fixtures |
| `cricket_fixtures_backup_phase1` | Backup table for cricket fixtures |
| `raw_fixtures` | Raw fixture data from external APIs |
| `normalized_fixtures` | Normalized fixture data |
| `matches` | Stores match/fixture information |
| `zz_archive_matches` | Archived historical fixtures |
| `events` | Stores event-related data |

---

## Subscription Tables

| Table Name | Function |
|------------|----------|
| `subscriptions` | Stores user subscription information |
| `subscription_plans` | Defines subscription plan tiers and features |

---

## Context/Enrichment Tables

| Table Name | Function |
|------------|----------|
| `context_intelligence_cache` | Stores context/enrichment data |
| `fixture_context_cache` | Stores context/enrichment data |
| `injuries` | Stores injury data for teams/players |
| `event_injuries` | Stores injury snapshots for events |
| `event_injury_snapshots` | Stores injury snapshots for events |
| `news_mentions` | Stores news mentions and sentiment |
| `event_news_scores` | Stores news snapshots for events |
| `event_news_snapshots` | Stores news snapshots for events |
| `event_weather_snapshots` | Stores weather conditions for events |
| `event_odds_snapshots` | Stores odds snapshots for events |
| `match_context_data` | Stores context/enrichment data |

---

## Rule/Config Tables

| Table Name | Function |
|------------|----------|
| `tier_rules` | Defines tier-based rules and restrictions |
| `tier_rules_backup_phase2` | Backup table for tier rules |
| `market_rules_unified` | Stores configuration rules |
| `cricket_market_rules` | Defines cricket-specific market rules |
| `cricket_market_rules_backup_phase2` | Backup table for cricket market rules |
| `acca_rules` | Defines ACCA (accumulator) rules |
| `secondary_market_allowlist` | Stores configuration rules |

---

## Admin/Debug Tables

| Table Name | Function |
|------------|----------|
| `debug_published` | Admin/debug table |
| `scheduler_run_locks` | Manages scheduler locks |
| `scheduling_logs` | Stores scheduling/processing logs |
| `fixture_processing_log` | Stores processing logs |
| `table_lifecycle_registry` | Admin/debug table |

---

## Entity Tables

| Table Name | Function |
|------------|----------|
| `teams` | Stores team/player entity data |
| `team_stats` | Stores team statistics |
| `team_week_locks` | Manages weekly data locks for teams |
| `leagues` | Stores league information |
| `sports` | Stores sport definitions and metadata |

---

## Odds Tables

| Table Name | Function |
|------------|----------|
| `odds_snapshots` | Stores odds snapshots at specific times |
| `bookmaker_odds` | Stores betting odds information |
| `bookmakers` | Stores betting odds information |
| `canonical_bookmakers` | Stores canonical bookmaker data |

---

## Canonical Tables

| Table Name | Function |
|------------|----------|
| `canonical_entities` | Stores canonical/normalized entity data |
| `canonical_events` | Stores canonical/normalized entity data |

---

## Sport-Specific Tables

| Table Name | Function |
|------------|----------|
| `f1_teams` | Formula 1 data table |
| `f1_tracks` | Formula 1 data table |
| `f1_persons` | Formula 1 data table |
| `f1_races` | Formula 1 data table |
| `f1_rosters` | Formula 1 data table |
| `f1_results` | Formula 1 data table |
| `cricket_insights_final` | Cricket-specific table |

---

## Cache Tables

| Table Name | Function |
|------------|----------|
| `rapidapi_cache` | Caches external API responses |
| `rapidapi_quota_usage` | Caches external API responses |

---

## Migration/Backup Tables

| Table Name | Function |
|------------|----------|
| `_migration_log` | Migration/backup table |
| `predictions_raw_backup_phase3` | Migration/backup table |
| `ai_predictions_backup_phase3` | Migration/backup table |
| `direct1x2_prediction_final_backup_phase3` | Migration/backup table |
| `predictions_filtered_backup_phase3` | Migration/backup table |

---

## API Tables

| Table Name | Function |
|------------|----------|
| `api_raw` | Stores raw API responses |

---

## Sync Tables

| Table Name | Function |
|------------|----------|
| `sport_sync` | Tracks data synchronization status |

---

## User Tables

| Table Name | Function |
|------------|----------|
| `profiles` | Stores user profile data (RLS enabled) |

---

## Cricket Tables

| Table Name | Function |
|------------|----------|
| `cricket_insights_final` | Stores cricket-specific insights |

---

**Note:** Only `profiles` table has RLS enabled in development. All other tables are public.
