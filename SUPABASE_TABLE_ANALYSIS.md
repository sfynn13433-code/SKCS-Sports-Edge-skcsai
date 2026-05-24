# Supabase Table Analysis Report

**Generated:** 2026-05-24T08:24:25.691Z

## Summary

- **Total Tables:** 81
- **Tables with RLS Enabled:** 1
- **Tables with RLS Policies:** 5
- **Tables with Indexes:** 73
- **Tables with Constraints:** 73
- **Tables with Triggers:** 6

## _migration_log

**Function:** Migration/backup table

**Statistics:**
- Row Count: 0
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (2)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| filename | text | No | - | - | - | - |
| applied_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (1)

**_migration_log_pkey**
- Type: btree
- Columns: filename
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**_migration_log_pkey** (PRIMARY KEY)

---

## acca_rules

**Function:** Defines ACCA (accumulator) rules

**Statistics:**
- Row Count: 8
- Estimated Size: 128 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 2
- Triggers: 0

### Columns (3)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('acca_rules_id_seq'::regclass) | - | 64 | - |
| rule_name | text | No | - | - | - | - |
| rule_value | jsonb | No | - | - | - | - |

### Indexes (2)

**acca_rules_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**acca_rules_rule_name_key**
- Type: btree
- Columns: rule_name
- Unique: Yes

### Constraints (2)

**acca_rules_pkey** (PRIMARY KEY)

**acca_rules_rule_name_key** (UNIQUE)

---

## ai_predictions

**Function:** Prediction-related table

**Statistics:**
- Row Count: 33
- Estimated Size: 272 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 2
- Triggers: 0

### Columns (6)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| match_id | text | No | - | - | - | - |
| confidence_score | integer | Yes | - | - | 32 | - |
| edgemind_feedback | text | Yes | - | - | - | - |
| value_combos | jsonb | Yes | - | - | - | - |
| same_match_builder | jsonb | Yes | - | - | - | - |
| updated_at | timestamp without time zone | Yes | now() | - | - | - |

### Indexes (1)

**ai_predictions_pkey**
- Type: btree
- Columns: match_id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**ai_predictions_match_id_fkey** (FOREIGN KEY)

**ai_predictions_pkey** (PRIMARY KEY)

---

## ai_predictions_backup_phase3

**Function:** Prediction-related table

**Statistics:**
- Row Count: 9
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 0
- Constraints: 0
- Triggers: 0

### Columns (6)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| match_id | text | Yes | - | - | - | - |
| confidence_score | integer | Yes | - | - | 32 | - |
| edgemind_feedback | text | Yes | - | - | - | - |
| value_combos | jsonb | Yes | - | - | - | - |
| same_match_builder | jsonb | Yes | - | - | - | - |
| updated_at | timestamp without time zone | Yes | - | - | - | - |

---

## api_raw

**Function:** General purpose table

**Statistics:**
- Row Count: 78
- Estimated Size: 72 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (5)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('api_raw_id_seq'::regclass) | - | 64 | - |
| source | text | No | - | - | - | - |
| endpoint | text | No | - | - | - | - |
| fetched_at | timestamp without time zone | Yes | now() | - | - | - |
| payload | jsonb | No | - | - | - | - |

### Indexes (1)

**api_raw_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**api_raw_pkey** (PRIMARY KEY)

---

## bookmaker_odds

**Function:** Stores betting odds information

**Statistics:**
- Row Count: 0
- Estimated Size: 64 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 7
- Constraints: 4
- Triggers: 1

### Columns (9)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('bookmaker_odds_id_seq'::regclass) | - | 64 | - |
| id_event | text | No | - | - | - | - |
| bookmaker_key | text | No | - | - | - | - |
| market_type | text | No | - | - | - | - |
| selection | text | No | - | - | - | - |
| odds | numeric | No | - | - | - | - |
| snapshot_at | timestamp with time zone | No | now() | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (7)

**bookmaker_odds_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_bookmaker_odds_bookmaker**
- Type: btree
- Columns: bookmaker_key

**idx_bookmaker_odds_event**
- Type: btree
- Columns: id_event

**idx_bookmaker_odds_event_bookmaker**
- Type: btree
- Columns: id_event, bookmaker_key

**idx_bookmaker_odds_market**
- Type: btree
- Columns: market_type

**idx_bookmaker_odds_snapshot**
- Type: btree
- Columns: snapshot_at

**uq_bookmaker_odds**
- Type: btree
- Columns: id_event, bookmaker_key, market_type, selection, snapshot_at
- Unique: Yes

### Constraints (4)

**bookmaker_odds_bookmaker_key_fkey** (FOREIGN KEY)

**bookmaker_odds_pkey** (PRIMARY KEY)

**fk_bookmaker_odds_fixture** (FOREIGN KEY)

**uq_bookmaker_odds** (UNIQUE)

### Triggers (1)

**trg_bookmaker_odds_updated_at**
- Enabled: Yes

---

## bookmakers

**Function:** Stores betting odds information

**Statistics:**
- Row Count: 22
- Estimated Size: 32 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (2)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| bookmaker_key | text | No | - | - | - | - |
| title | text | No | - | - | - | - |

### Indexes (1)

**bookmakers_pkey**
- Type: btree
- Columns: bookmaker_key
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**bookmakers_pkey** (PRIMARY KEY)

---

## canonical_bookmakers

**Function:** Stores canonical bookmaker data

**Statistics:**
- Row Count: 22
- Estimated Size: 32 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (5)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| bookmaker_key | text | No | - | - | - | - |
| title | text | No | - | - | - | - |
| is_active | boolean | Yes | true | - | - | - |
| priority_order | integer | Yes | 99 | - | 32 | - |
| provider_id | text | Yes | - | - | - | - |

### Indexes (1)

**canonical_bookmakers_pkey**
- Type: btree
- Columns: bookmaker_key
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**canonical_bookmakers_pkey** (PRIMARY KEY)

---

## canonical_entities

**Function:** Stores canonical/normalized entity data

**Statistics:**
- Row Count: 1716
- Estimated Size: 384 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 2
- Triggers: 0

### Columns (7)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | uuid | No | gen_random_uuid() | - | - | - |
| sport | character varying | No | - | 50 | - | - |
| provider_id | character varying | No | - | 100 | - | - |
| name | character varying | No | - | 255 | - | - |
| country | character varying | Yes | - | 100 | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |
| updated_at | timestamp with time zone | Yes | now() | - | - | - |

### Indexes (2)

**canonical_entities_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**canonical_entities_provider_id_sport_key**
- Type: btree
- Columns: sport, provider_id
- Unique: Yes

### Constraints (2)

**canonical_entities_pkey** (PRIMARY KEY)

**canonical_entities_provider_id_sport_key** (UNIQUE)

---

## canonical_events

**Function:** Stores event-related data

**Statistics:**
- Row Count: 7259
- Estimated Size: 22 MB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 3
- Triggers: 0

### Columns (12)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | uuid | No | gen_random_uuid() | - | - | - |
| sport | character varying | No | - | 50 | - | - |
| competition_name | character varying | No | - | 255 | - | - |
| season | character varying | No | - | 50 | - | - |
| start_time_utc | timestamp with time zone | No | - | - | - | - |
| status | character varying | No | - | 50 | - | - |
| home_entity_id | uuid | Yes | - | - | - | - |
| away_entity_id | uuid | Yes | - | - | - | - |
| raw_provider_data | jsonb | Yes | - | - | - | - |
| provider_name | character varying | Yes | - | 100 | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |
| updated_at | timestamp with time zone | Yes | now() | - | - | - |

### Indexes (2)

**canonical_events_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_events_sport_time**
- Type: btree
- Columns: sport, start_time_utc

### Constraints (3)

**canonical_events_away_entity_id_fkey** (FOREIGN KEY)

**canonical_events_home_entity_id_fkey** (FOREIGN KEY)

**canonical_events_pkey** (PRIMARY KEY)

---

## context_intelligence_cache

**Function:** Stores context/enrichment data

**Statistics:**
- Row Count: 0
- Estimated Size: 32 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 3
- Constraints: 2
- Triggers: 0

### Columns (8)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('context_intelligence_cache_id_seq'::regclass) | - | 64 | - |
| cache_key | text | No | - | - | - | - |
| fixture_id | text | Yes | - | - | - | - |
| payload | jsonb | No | '{}'::jsonb | - | - | - |
| last_verified | timestamp with time zone | No | now() | - | - | - |
| expires_at | timestamp with time zone | No | (now() + '03:00:00'::interval) | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (3)

**context_intelligence_cache_cache_key_key**
- Type: btree
- Columns: cache_key
- Unique: Yes

**context_intelligence_cache_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_context_intelligence_cache_expires_at**
- Type: btree
- Columns: expires_at

### Constraints (2)

**context_intelligence_cache_cache_key_key** (UNIQUE)

**context_intelligence_cache_pkey** (PRIMARY KEY)

---

## cricket_fixtures

**Function:** Stores cricket match fixtures

**Statistics:**
- Row Count: 17
- Estimated Size: 216 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 5
- Constraints: 2
- Triggers: 0

### Columns (16)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('cricket_fixtures_id_seq'::regclass) | - | 64 | - |
| provider | text | No | 'cricbuzz'::text | - | - | - |
| provider_match_id | text | No | - | - | - | - |
| sport | text | No | 'cricket'::text | - | - | - |
| match_format | text | No | 'unknown'::text | - | - | - |
| competition | text | Yes | - | - | - | - |
| home_team | text | No | - | - | - | - |
| away_team | text | No | - | - | - | - |
| venue | text | Yes | - | - | - | - |
| country | text | Yes | - | - | - | - |
| start_time | timestamp with time zone | Yes | - | - | - | - |
| status | text | Yes | - | - | - | - |
| raw_status | text | Yes | - | - | - | - |
| raw_payload | jsonb | Yes | '{}'::jsonb | - | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |
| updated_at | timestamp with time zone | Yes | now() | - | - | - |

### Indexes (5)

**cricket_fixtures_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**cricket_fixtures_provider_provider_match_id_key**
- Type: btree
- Columns: provider, provider_match_id
- Unique: Yes

**idx_cricket_fixtures_format**
- Type: btree
- Columns: match_format

**idx_cricket_fixtures_provider_match**
- Type: btree
- Columns: provider, provider_match_id

**idx_cricket_fixtures_start_time**
- Type: btree
- Columns: start_time

### Constraints (2)

**cricket_fixtures_pkey** (PRIMARY KEY)

**cricket_fixtures_provider_provider_match_id_key** (UNIQUE)

---

## cricket_fixtures_backup_phase1

**Function:** Stores cricket match fixtures

**Statistics:**
- Row Count: 17
- Estimated Size: 40 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 0
- Constraints: 0
- Triggers: 0

### Columns (16)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | Yes | - | - | 64 | - |
| provider | text | Yes | - | - | - | - |
| provider_match_id | text | Yes | - | - | - | - |
| sport | text | Yes | - | - | - | - |
| match_format | text | Yes | - | - | - | - |
| competition | text | Yes | - | - | - | - |
| home_team | text | Yes | - | - | - | - |
| away_team | text | Yes | - | - | - | - |
| venue | text | Yes | - | - | - | - |
| country | text | Yes | - | - | - | - |
| start_time | timestamp with time zone | Yes | - | - | - | - |
| status | text | Yes | - | - | - | - |
| raw_status | text | Yes | - | - | - | - |
| raw_payload | jsonb | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | - | - | - | - |
| updated_at | timestamp with time zone | Yes | - | - | - | - |

---

## cricket_insights_final

**Function:** Cricket-specific table

**Statistics:**
- Row Count: 79
- Estimated Size: 704 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 9
- Constraints: 4
- Triggers: 0

### Columns (38)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('cricket_insights_final_id_seq'::regclass) | - | 64 | - |
| fixture_id | bigint | Yes | - | - | 64 | - |
| provider | text | No | 'cricbuzz'::text | - | - | - |
| provider_match_id | text | No | - | - | - | - |
| sport | text | No | 'cricket'::text | - | - | - |
| match_format | text | No | 'unknown'::text | - | - | - |
| competition | text | Yes | - | - | - | - |
| home_team | text | No | - | - | - | - |
| away_team | text | No | - | - | - | - |
| venue | text | Yes | - | - | - | - |
| start_time | timestamp with time zone | Yes | - | - | - | - |
| status | text | Yes | - | - | - | - |
| market_group | text | No | - | - | - | - |
| market_key | text | No | - | - | - | - |
| market_label | text | No | - | - | - | - |
| selection | text | Yes | - | - | - | - |
| line | numeric | Yes | - | - | - | - |
| over_under | text | Yes | - | - | - | - |
| confidence | numeric | No | 0 | - | - | - |
| confidence_band | text | Yes | - | - | - | - |
| risk_tier | text | Yes | - | - | - | - |
| recommendation_status | text | No | 'pending_analysis'::text | - | - | - |
| tier | text | No | 'normal'::text | - | - | - |
| plan_visibility | jsonb | Yes | '["core", "elite", "vip"]'::jsonb | - | - | - |
| acca_eligible | boolean | No | false | - | - | - |
| acca_reason | text | Yes | - | - | - | - |
| volatility_score | numeric | Yes | 0 | - | - | - |
| weather_risk | numeric | Yes | 0 | - | - | - |
| lineup_risk | numeric | Yes | 0 | - | - | - |
| toss_risk | numeric | Yes | 0 | - | - | - |
| format_risk | numeric | Yes | 0 | - | - | - |
| reasoning | text | Yes | - | - | - | - |
| edgemind_summary | text | Yes | - | - | - | - |
| pipeline_data | jsonb | Yes | '{}'::jsonb | - | - | - |
| metadata | jsonb | Yes | '{}'::jsonb | - | - | - |
| expires_at | timestamp with time zone | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |
| updated_at | timestamp with time zone | Yes | now() | - | - | - |

### Indexes (9)

**cricket_insights_final_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_cricket_insights_acca**
- Type: btree
- Columns: acca_eligible

**idx_cricket_insights_confidence**
- Type: btree
- Columns: confidence

**idx_cricket_insights_format**
- Type: btree
- Columns: match_format

**idx_cricket_insights_market**
- Type: btree
- Columns: market_key

**idx_cricket_insights_provider_match**
- Type: btree
- Columns: provider, provider_match_id

**idx_cricket_insights_sport**
- Type: btree
- Columns: sport

**idx_cricket_insights_start_time**
- Type: btree
- Columns: start_time

**uniq_cricket_insights_market**
- Type: btree
- Columns: provider, provider_match_id, market_key
- Unique: Yes

### Constraints (4)

**cricket_insights_final_confidence_check** (CHECK)

**cricket_insights_final_fixture_id_fkey** (FOREIGN KEY)

**cricket_insights_final_over_under_check** (CHECK)

**cricket_insights_final_pkey** (PRIMARY KEY)

---

## cricket_market_rules

**Function:** Defines market-specific rules

**Statistics:**
- Row Count: 45
- Estimated Size: 48 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 2
- Triggers: 0

### Columns (16)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('cricket_market_rules_id_seq'::regclass) | - | 64 | - |
| market_key | text | No | - | - | - | - |
| market_group | text | No | - | - | - | - |
| allowed_formats | ARRAY | No | ARRAY['t20'::text, 'odi'::text, 'test'::text] | - | - | - |
| min_display_confidence | numeric | No | 60 | - | - | - |
| strong_confidence | numeric | No | 70 | - | - | - |
| elite_confidence | numeric | No | 80 | - | - | - |
| acca_min_confidence | numeric | Yes | - | - | - | - |
| acca_allowed | boolean | No | false | - | - | - |
| requires_confirmed_lineup | boolean | No | false | - | - | - |
| requires_toss | boolean | No | false | - | - | - |
| display_only | boolean | No | false | - | - | - |
| volatility_level | text | No | 'medium'::text | - | - | - |
| notes | text | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |
| updated_at | timestamp with time zone | Yes | now() | - | - | - |

### Indexes (2)

**cricket_market_rules_market_key_key**
- Type: btree
- Columns: market_key
- Unique: Yes

**cricket_market_rules_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**cricket_market_rules_market_key_key** (UNIQUE)

**cricket_market_rules_pkey** (PRIMARY KEY)

---

## cricket_market_rules_backup_phase2

**Function:** Defines market-specific rules

**Statistics:**
- Row Count: 45
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 0
- Constraints: 0
- Triggers: 0

### Columns (16)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | Yes | - | - | 64 | - |
| market_key | text | Yes | - | - | - | - |
| market_group | text | Yes | - | - | - | - |
| allowed_formats | ARRAY | Yes | - | - | - | - |
| min_display_confidence | numeric | Yes | - | - | - | - |
| strong_confidence | numeric | Yes | - | - | - | - |
| elite_confidence | numeric | Yes | - | - | - | - |
| acca_min_confidence | numeric | Yes | - | - | - | - |
| acca_allowed | boolean | Yes | - | - | - | - |
| requires_confirmed_lineup | boolean | Yes | - | - | - | - |
| requires_toss | boolean | Yes | - | - | - | - |
| display_only | boolean | Yes | - | - | - | - |
| volatility_level | text | Yes | - | - | - | - |
| notes | text | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | - | - | - | - |
| updated_at | timestamp with time zone | Yes | - | - | - | - |

---

## debug_published

**Function:** Admin/debug table

**Statistics:**
- Row Count: 21
- Estimated Size: 176 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 3
- Constraints: 1
- Triggers: 0

### Columns (7)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('debug_published_id_seq'::regclass) | - | 64 | - |
| publish_run_id | bigint | Yes | - | - | 64 | - |
| tier | text | Yes | - | - | - | - |
| sport | text | Yes | - | - | - | - |
| candidate | jsonb | No | - | - | - | - |
| rejection_metadata | jsonb | No | '{}'::jsonb | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (3)

**debug_published_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_debug_published_created_at**
- Type: btree
- Columns: created_at

**idx_debug_published_sport**
- Type: btree
- Columns: sport

### Constraints (1)

**debug_published_pkey** (PRIMARY KEY)

---

## direct1x2_prediction_final

**Function:** Stores final/published predictions for display

**Statistics:**
- Row Count: 543
- Estimated Size: 30 MB
- RLS Enabled: ❌ No
- RLS Policies: 2
- Indexes: 6
- Constraints: 8
- Triggers: 2

### Columns (23)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('direct1x2_prediction_final_id_seq'::regclass) | - | 64 | - |
| publish_run_id | bigint | Yes | - | - | 64 | - |
| tier | text | No | - | - | - | - |
| type | text | No | - | - | - | - |
| matches | jsonb | No | - | - | - | - |
| total_confidence | numeric | No | - | - | - | - |
| risk_level | text | No | - | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| plan_visibility | jsonb | No | '[]'::jsonb | - | - | - |
| sport | text | Yes | - | - | - | - |
| market_type | text | Yes | - | - | - | - |
| recommendation | text | Yes | - | - | - | - |
| expires_at | timestamp with time zone | Yes | - | - | - | - |
| edgemind_report | text | Yes | - | - | - | - |
| secondary_insights | jsonb | No | '[]'::jsonb | - | - | - |
| fixture_id | text | Yes | - | - | - | - |
| home_team | text | Yes | - | - | - | - |
| away_team | text | Yes | - | - | - | - |
| prediction | text | Yes | - | - | - | - |
| confidence | numeric | Yes | - | - | - | - |
| match_date | timestamp with time zone | Yes | - | - | - | - |
| risk_tier | USER-DEFINED | Yes | - | - | - | - |
| secondary_markets | jsonb | No | '[]'::jsonb | - | - | - |

### RLS Policies (2)

**Public read access for direct1x2**
- Permissive: Yes
- Roles: {public}
- Command: SELECT
- Using: `true`

**Enable read access for all users**
- Permissive: Yes
- Roles: {public}
- Command: SELECT
- Using: `true`

### Indexes (6)

**direct1x2_prediction_final_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_direct1x2_match_date**
- Type: btree
- Columns: match_date

**idx_direct1x2_risk_tier**
- Type: btree
- Columns: risk_tier

**idx_predictions_final_publish_run_id**
- Type: btree
- Columns: publish_run_id

**uq_predictions_final_fallback_simple_by_fixture**
- Type: btree
- Columns: tier, type, sport, market_type, fixture_id
- Unique: Yes

**uq_predictions_final_fallback_simple_no_fixture**
- Type: btree
- Columns: tier, type, sport, market_type, home_team, away_team, match_date
- Unique: Yes

### Constraints (8)

**confidence_range** (CHECK)

**direct1x2_prediction_final_pkey** (PRIMARY KEY)

**direct1x2_prediction_final_publish_run_id_fkey** (FOREIGN KEY)

**direct1x2_prediction_final_risk_level_check** (CHECK)

**direct1x2_prediction_final_tier_check** (CHECK)

**direct1x2_prediction_final_type_check** (CHECK)

**predictions_final_type_check** (CHECK)

**secondary_markets_length** (CHECK)

### Triggers (2)

**enforce_secondary_allowlist**
- Enabled: Yes

**trg_sync_secondary_markets**
- Enabled: Yes

---

## direct1x2_prediction_final_backup_phase3

**Function:** Stores final/published predictions for display

**Statistics:**
- Row Count: 1
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 0
- Constraints: 0
- Triggers: 0

### Columns (23)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | Yes | - | - | 64 | - |
| publish_run_id | bigint | Yes | - | - | 64 | - |
| tier | text | Yes | - | - | - | - |
| type | text | Yes | - | - | - | - |
| matches | jsonb | Yes | - | - | - | - |
| total_confidence | numeric | Yes | - | - | - | - |
| risk_level | text | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | - | - | - | - |
| plan_visibility | jsonb | Yes | - | - | - | - |
| sport | text | Yes | - | - | - | - |
| market_type | text | Yes | - | - | - | - |
| recommendation | text | Yes | - | - | - | - |
| expires_at | timestamp with time zone | Yes | - | - | - | - |
| edgemind_report | text | Yes | - | - | - | - |
| secondary_insights | jsonb | Yes | - | - | - | - |
| fixture_id | text | Yes | - | - | - | - |
| home_team | text | Yes | - | - | - | - |
| away_team | text | Yes | - | - | - | - |
| prediction | text | Yes | - | - | - | - |
| confidence | numeric | Yes | - | - | - | - |
| match_date | timestamp with time zone | Yes | - | - | - | - |
| risk_tier | USER-DEFINED | Yes | - | - | - | - |
| secondary_markets | jsonb | Yes | - | - | - | - |

---

## direct_1x2_insights

**Function:** General purpose table

**Statistics:**
- Row Count: 670
- Estimated Size: 168 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (10)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | uuid | No | gen_random_uuid() | - | - | - |
| match_id | text | Yes | - | - | - | - |
| sport | text | Yes | 'football'::text | - | - | - |
| outcome | text | Yes | - | - | - | - |
| confidence | integer | Yes | - | - | 32 | - |
| tier | text | Yes | - | - | - | - |
| volatility | numeric | Yes | - | - | - | - |
| secondary_required | boolean | Yes | - | - | - | - |
| acca_eligible | boolean | Yes | - | - | - | - |
| created_at | timestamp without time zone | Yes | now() | - | - | - |

### Indexes (1)

**direct_1x2_insights_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**direct_1x2_insights_pkey** (PRIMARY KEY)

---

## direct_1x2_stages

**Function:** General purpose table

**Statistics:**
- Row Count: 4003
- Estimated Size: 656 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (8)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | uuid | No | gen_random_uuid() | - | - | - |
| match_id | text | Yes | - | - | - | - |
| stage_number | integer | Yes | - | - | 32 | - |
| stage_label | text | Yes | - | - | - | - |
| home_prob | numeric | Yes | - | - | - | - |
| draw_prob | numeric | Yes | - | - | - | - |
| away_prob | numeric | Yes | - | - | - | - |
| created_at | timestamp without time zone | Yes | now() | - | - | - |

### Indexes (1)

**direct_1x2_stages_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**direct_1x2_stages_pkey** (PRIMARY KEY)

---

## event_injuries

**Function:** Stores event-related data

**Statistics:**
- Row Count: 0
- Estimated Size: 48 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 5
- Constraints: 1
- Triggers: 1

### Columns (11)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('event_injuries_id_seq'::regclass) | - | 64 | - |
| id_event | text | No | - | - | - | - |
| player_name | text | No | - | - | - | - |
| team_name | text | Yes | - | - | - | - |
| injury_type | text | Yes | - | - | - | - |
| status | text | Yes | - | - | - | - |
| severity | text | Yes | - | - | - | - |
| return_date | date | Yes | - | - | - | - |
| reported_at | timestamp with time zone | Yes | - | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (5)

**event_injuries_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_event_injuries_event**
- Type: btree
- Columns: id_event

**idx_event_injuries_player**
- Type: btree
- Columns: player_name

**idx_event_injuries_status**
- Type: btree
- Columns: status

**idx_event_injuries_team**
- Type: btree
- Columns: team_name

### Constraints (1)

**event_injuries_pkey** (PRIMARY KEY)

### Triggers (1)

**trg_event_injuries_updated_at**
- Enabled: Yes

---

## event_injury_snapshots

**Function:** Stores injury snapshots for events

**Statistics:**
- Row Count: 346
- Estimated Size: 536 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 4
- Constraints: 2
- Triggers: 0

### Columns (15)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('event_injury_snapshots_id_seq'::regclass) | - | 64 | - |
| event_id | text | No | - | - | - | - |
| sport | text | No | - | - | - | - |
| fixture_provider_id | bigint | Yes | - | - | 64 | - |
| fixture_date | date | Yes | - | - | - | - |
| kickoff_time | timestamp with time zone | Yes | - | - | - | - |
| team_provider_id | text | Yes | - | - | - | - |
| team_name | text | Yes | - | - | - | - |
| player_provider_id | text | Yes | - | - | - | - |
| player_name | text | Yes | - | - | - | - |
| status_type | text | Yes | - | - | - | - |
| status_reason | text | Yes | - | - | - | - |
| source | text | No | 'API-SPORTS'::text | - | - | - |
| raw_payload | jsonb | No | '{}'::jsonb | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (4)

**event_injury_snapshots_event_id_team_provider_id_player_pro_key**
- Type: btree
- Columns: event_id, team_provider_id, player_provider_id, status_type, status_reason
- Unique: Yes

**event_injury_snapshots_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_event_injury_snapshots_event_id**
- Type: btree
- Columns: event_id

**idx_event_injury_snapshots_fixture_date**
- Type: btree
- Columns: fixture_date

### Constraints (2)

**event_injury_snapshots_event_id_team_provider_id_player_pro_key** (UNIQUE)

**event_injury_snapshots_pkey** (PRIMARY KEY)

---

## event_news_scores

**Function:** Stores news snapshots for events

**Statistics:**
- Row Count: 0
- Estimated Size: 48 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 5
- Constraints: 3
- Triggers: 0

### Columns (10)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('event_news_scores_id_seq'::regclass) | - | 64 | - |
| id_event | text | No | - | - | - | - |
| source | text | Yes | - | - | - | - |
| headline | text | Yes | - | - | - | - |
| sentiment_score | numeric | Yes | - | - | - | - |
| sentiment_label | text | Yes | - | - | - | - |
| keywords | ARRAY | Yes | - | - | - | - |
| relevance_score | numeric | Yes | - | - | - | - |
| published_at | timestamp with time zone | Yes | - | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (5)

**event_news_scores_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_event_news_scores_event**
- Type: btree
- Columns: id_event

**idx_event_news_scores_published**
- Type: btree
- Columns: published_at

**idx_event_news_scores_relevance**
- Type: btree
- Columns: relevance_score

**idx_event_news_scores_sentiment**
- Type: btree
- Columns: sentiment_label

### Constraints (3)

**event_news_scores_pkey** (PRIMARY KEY)

**event_news_scores_relevance_score_check** (CHECK)

**event_news_scores_sentiment_score_check** (CHECK)

---

## event_news_snapshots

**Function:** Stores news snapshots for events

**Statistics:**
- Row Count: 108
- Estimated Size: 376 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 5
- Constraints: 2
- Triggers: 0

### Columns (24)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('event_news_snapshots_id_seq'::regclass) | - | 64 | - |
| event_id | text | No | - | - | - | - |
| sport | text | No | - | - | - | - |
| fixture_date | date | Yes | - | - | - | - |
| kickoff_time | timestamp with time zone | Yes | - | - | - | - |
| team_name | text | No | - | - | - | - |
| opponent_name | text | Yes | - | - | - | - |
| signal_type | text | No | - | - | - | - |
| signal_label | text | Yes | - | - | - | - |
| signal_strength | double precision | Yes | - | - | 53 | - |
| relevance_score | double precision | Yes | - | - | 53 | - |
| sentiment_score | double precision | Yes | - | - | 53 | - |
| evidence_keywords | ARRAY | No | '{}'::text[] | - | - | - |
| article_title | text | No | - | - | - | - |
| article_summary | text | Yes | - | - | - | - |
| article_url | text | Yes | - | - | - | - |
| source_name | text | Yes | - | - | - | - |
| source_url | text | Yes | - | - | - | - |
| published_at | timestamp with time zone | Yes | - | - | - | - |
| query_text | text | Yes | - | - | - | - |
| source | text | No | 'google-news-rss'::text | - | - | - |
| raw_payload | jsonb | No | '{}'::jsonb | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (5)

**event_news_snapshots_event_id_team_name_signal_type_article_key**
- Type: btree
- Columns: event_id, team_name, signal_type, article_title, article_url
- Unique: Yes

**event_news_snapshots_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_event_news_snapshots_event_id**
- Type: btree
- Columns: event_id

**idx_event_news_snapshots_fixture_date**
- Type: btree
- Columns: fixture_date

**idx_event_news_snapshots_team_name**
- Type: btree
- Columns: team_name

### Constraints (2)

**event_news_snapshots_event_id_team_name_signal_type_article_key** (UNIQUE)

**event_news_snapshots_pkey** (PRIMARY KEY)

---

## event_odds_snapshots

**Function:** Stores odds snapshots at specific times

**Statistics:**
- Row Count: 0
- Estimated Size: 24 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 1
- Triggers: 0

### Columns (5)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('event_odds_snapshots_id_seq'::regclass) | - | 64 | - |
| id_event | text | No | - | - | - | - |
| snapshot_at | timestamp with time zone | No | now() | - | - | - |
| odds | jsonb | No | - | - | - | - |
| source | text | Yes | - | - | - | - |

### Indexes (2)

**event_odds_snapshots_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_eos_event_time**
- Type: btree
- Columns: id_event, snapshot_at

### Constraints (1)

**event_odds_snapshots_pkey** (PRIMARY KEY)

---

## event_weather_snapshots

**Function:** Stores weather snapshots for events

**Statistics:**
- Row Count: 48
- Estimated Size: 208 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 3
- Constraints: 2
- Triggers: 0

### Columns (21)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('event_weather_snapshots_id_seq'::regclass) | - | 64 | - |
| event_id | text | No | - | - | - | - |
| sport | text | No | - | - | - | - |
| fixture_date | date | Yes | - | - | - | - |
| kickoff_time | timestamp with time zone | Yes | - | - | - | - |
| venue_name | text | Yes | - | - | - | - |
| venue_city | text | Yes | - | - | - | - |
| venue_country | text | Yes | - | - | - | - |
| latitude | double precision | Yes | - | - | 53 | - |
| longitude | double precision | Yes | - | - | 53 | - |
| resolved_timezone | text | Yes | - | - | - | - |
| temperature_c | double precision | Yes | - | - | 53 | - |
| precipitation_mm | double precision | Yes | - | - | 53 | - |
| wind_speed_kmh | double precision | Yes | - | - | 53 | - |
| weather_code | integer | Yes | - | - | 32 | - |
| weather_summary | text | Yes | - | - | - | - |
| source | text | No | 'open-meteo'::text | - | - | - |
| geocode_payload | jsonb | No | '{}'::jsonb | - | - | - |
| raw_payload | jsonb | No | '{}'::jsonb | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (3)

**event_weather_snapshots_event_id_key**
- Type: btree
- Columns: event_id
- Unique: Yes

**event_weather_snapshots_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_event_weather_snapshots_fixture_date**
- Type: btree
- Columns: fixture_date

### Constraints (2)

**event_weather_snapshots_event_id_key** (UNIQUE)

**event_weather_snapshots_pkey** (PRIMARY KEY)

---

## events

**Function:** Stores event-related data

**Statistics:**
- Row Count: 15302
- Estimated Size: 3056 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 2
- Triggers: 0

### Columns (9)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | text | No | - | - | - | - |
| sport_key | text | Yes | - | - | - | - |
| commence_time | timestamp with time zone | No | - | - | - | - |
| home_team | text | No | - | - | - | - |
| away_team | text | No | - | - | - | - |
| created_at | timestamp with time zone | Yes | timezone('utc'::text, now()) | - | - | - |
| status | text | Yes | - | - | - | - |
| home_score | integer | Yes | - | - | 32 | - |
| away_score | integer | Yes | - | - | 32 | - |

### Indexes (2)

**events_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_events_status_commence**
- Type: btree
- Columns: commence_time, status

### Constraints (2)

**events_pkey** (PRIMARY KEY)

**events_sport_key_fkey** (FOREIGN KEY)

---

## f1_persons

**Function:** Stores team/player entity data

**Statistics:**
- Row Count: 2
- Estimated Size: 48 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 2
- Triggers: 0

### Columns (9)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('f1_persons_id_seq'::regclass) | - | 64 | - |
| key | text | No | - | - | - | - |
| first_name | text | Yes | - | - | - | - |
| last_name | text | Yes | - | - | - | - |
| code | text | Yes | - | - | - | - |
| date_of_birth | date | Yes | - | - | - | - |
| country_code | text | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |
| updated_at | timestamp with time zone | Yes | now() | - | - | - |

### Indexes (2)

**f1_persons_key_key**
- Type: btree
- Columns: key
- Unique: Yes

**f1_persons_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**f1_persons_key_key** (UNIQUE)

**f1_persons_pkey** (PRIMARY KEY)

---

## f1_races

**Function:** Formula 1 data table

**Statistics:**
- Row Count: 1
- Estimated Size: 64 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 3
- Constraints: 3
- Triggers: 0

### Columns (10)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('f1_races_id_seq'::regclass) | - | 64 | - |
| season | integer | No | - | - | 32 | - |
| round | integer | Yes | - | - | 32 | - |
| name | text | No | - | - | - | - |
| date | timestamp with time zone | Yes | - | - | - | - |
| track_id | bigint | Yes | - | - | 64 | - |
| status | text | Yes | - | - | - | - |
| raw_json | jsonb | Yes | '{}'::jsonb | - | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |
| updated_at | timestamp with time zone | Yes | now() | - | - | - |

### Indexes (3)

**f1_races_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**f1_races_season_round_key**
- Type: btree
- Columns: season, round
- Unique: Yes

**idx_f1_races_season_date**
- Type: btree
- Columns: season, date

### Constraints (3)

**f1_races_pkey** (PRIMARY KEY)

**f1_races_season_round_key** (UNIQUE)

**f1_races_track_id_fkey** (FOREIGN KEY)

---

## f1_results

**Function:** Formula 1 data table

**Statistics:**
- Row Count: 2
- Estimated Size: 64 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 3
- Constraints: 5
- Triggers: 0

### Columns (11)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('f1_results_id_seq'::regclass) | - | 64 | - |
| race_id | bigint | Yes | - | - | 64 | - |
| position | integer | Yes | - | - | 32 | - |
| person_id | bigint | Yes | - | - | 64 | - |
| team_id | bigint | Yes | - | - | 64 | - |
| laps | integer | Yes | - | - | 32 | - |
| time_text | text | Yes | - | - | - | - |
| time_ms | bigint | Yes | - | - | 64 | - |
| status | text | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |
| updated_at | timestamp with time zone | Yes | now() | - | - | - |

### Indexes (3)

**f1_results_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**f1_results_race_id_person_id_key**
- Type: btree
- Columns: race_id, person_id
- Unique: Yes

**idx_f1_results_race**
- Type: btree
- Columns: race_id

### Constraints (5)

**f1_results_person_id_fkey** (FOREIGN KEY)

**f1_results_pkey** (PRIMARY KEY)

**f1_results_race_id_fkey** (FOREIGN KEY)

**f1_results_race_id_person_id_key** (UNIQUE)

**f1_results_team_id_fkey** (FOREIGN KEY)

---

## f1_rosters

**Function:** Formula 1 data table

**Statistics:**
- Row Count: 2
- Estimated Size: 48 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 4
- Triggers: 0

### Columns (7)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('f1_rosters_id_seq'::regclass) | - | 64 | - |
| season | integer | No | - | - | 32 | - |
| team_id | bigint | Yes | - | - | 64 | - |
| person_id | bigint | Yes | - | - | 64 | - |
| car_number | text | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |
| updated_at | timestamp with time zone | Yes | now() | - | - | - |

### Indexes (2)

**f1_rosters_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**f1_rosters_season_team_id_person_id_key**
- Type: btree
- Columns: season, team_id, person_id
- Unique: Yes

### Constraints (4)

**f1_rosters_person_id_fkey** (FOREIGN KEY)

**f1_rosters_pkey** (PRIMARY KEY)

**f1_rosters_season_team_id_person_id_key** (UNIQUE)

**f1_rosters_team_id_fkey** (FOREIGN KEY)

---

## f1_teams

**Function:** Stores team/player entity data

**Statistics:**
- Row Count: 1
- Estimated Size: 48 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 2
- Triggers: 0

### Columns (6)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('f1_teams_id_seq'::regclass) | - | 64 | - |
| key | text | No | - | - | - | - |
| name | text | No | - | - | - | - |
| country_code | text | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |
| updated_at | timestamp with time zone | Yes | now() | - | - | - |

### Indexes (2)

**f1_teams_key_key**
- Type: btree
- Columns: key
- Unique: Yes

**f1_teams_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**f1_teams_key_key** (UNIQUE)

**f1_teams_pkey** (PRIMARY KEY)

---

## f1_tracks

**Function:** Formula 1 data table

**Statistics:**
- Row Count: 1
- Estimated Size: 48 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 2
- Triggers: 0

### Columns (7)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('f1_tracks_id_seq'::regclass) | - | 64 | - |
| key | text | No | - | - | - | - |
| name | text | No | - | - | - | - |
| city | text | Yes | - | - | - | - |
| country_code | text | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |
| updated_at | timestamp with time zone | Yes | now() | - | - | - |

### Indexes (2)

**f1_tracks_key_key**
- Type: btree
- Columns: key
- Unique: Yes

**f1_tracks_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**f1_tracks_key_key** (UNIQUE)

**f1_tracks_pkey** (PRIMARY KEY)

---

## fixture_context_cache

**Function:** Stores match/fixture information

**Statistics:**
- Row Count: 0
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (3)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| fixture_id | text | No | - | - | - | - |
| context_payload | jsonb | No | - | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (1)

**fixture_context_cache_pkey**
- Type: btree
- Columns: fixture_id
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**fixture_context_cache_pkey** (PRIMARY KEY)

---

## fixture_processing_log

**Function:** Stores match/fixture information

**Statistics:**
- Row Count: 0
- Estimated Size: 32 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 3
- Constraints: 3
- Triggers: 0

### Columns (13)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('fixture_processing_log_id_seq'::regclass) | - | 64 | - |
| id_event | text | No | - | - | - | - |
| sport | text | No | - | - | - | - |
| publish_run_id | integer | Yes | - | - | 32 | - |
| ingestion_started_at | timestamp with time zone | Yes | - | - | - | - |
| ingestion_completed_at | timestamp with time zone | Yes | - | - | - | - |
| enrichment_completed_at | timestamp with time zone | Yes | - | - | - | - |
| ai_completed_at | timestamp with time zone | Yes | - | - | - | - |
| publication_completed_at | timestamp with time zone | Yes | - | - | - | - |
| acca_processed_at | timestamp with time zone | Yes | - | - | - | - |
| suppression_reason | text | Yes | - | - | - | - |
| failure_reason | text | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |

### Indexes (3)

**fixture_processing_log_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**idx_fpl_id_event**
- Type: btree
- Columns: id_event, publish_run_id

**uq_fpl_event_run**
- Type: btree
- Columns: id_event, publish_run_id
- Unique: Yes

### Constraints (3)

**fixture_processing_log_pkey** (PRIMARY KEY)

**fixture_processing_log_publish_run_id_fkey** (FOREIGN KEY)

**uq_fpl_event_run** (UNIQUE)

---

## fixtures

**Function:** Stores match/fixture information

**Statistics:**
- Row Count: 1
- Estimated Size: 48 kB
- RLS Enabled: ❌ No
- RLS Policies: 1
- Indexes: 2
- Constraints: 2
- Triggers: 0

### Columns (9)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('fixtures_id_seq'::regclass) | - | 64 | - |
| fixture_id | text | Yes | - | - | - | - |
| sport | text | Yes | - | - | - | - |
| league | text | Yes | - | - | - | - |
| home_team | text | Yes | - | - | - | - |
| away_team | text | Yes | - | - | - | - |
| start_time | timestamp without time zone | Yes | - | - | - | - |
| raw_data | jsonb | Yes | - | - | - | - |
| created_at | timestamp without time zone | Yes | now() | - | - | - |

### RLS Policies (1)

**Public read access for fixtures**
- Permissive: Yes
- Roles: {public}
- Command: SELECT
- Using: `true`

### Indexes (2)

**fixtures_fixture_id_key**
- Type: btree
- Columns: fixture_id
- Unique: Yes

**fixtures_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**fixtures_fixture_id_key** (UNIQUE)

**fixtures_pkey** (PRIMARY KEY)

---

## fixtures_backup_phase1

**Function:** Backup table for fixtures

**Statistics:**
- Row Count: 1
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 0
- Constraints: 0
- Triggers: 0

### Columns (9)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | Yes | - | - | 64 | - |
| fixture_id | text | Yes | - | - | - | - |
| sport | text | Yes | - | - | - | - |
| league | text | Yes | - | - | - | - |
| home_team | text | Yes | - | - | - | - |
| away_team | text | Yes | - | - | - | - |
| start_time | timestamp without time zone | Yes | - | - | - | - |
| raw_data | jsonb | Yes | - | - | - | - |
| created_at | timestamp without time zone | Yes | - | - | - | - |

---

## fixtures_unified

**Function:** Stores match/fixture information

**Statistics:**
- Row Count: 17
- Estimated Size: 96 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 2
- Triggers: 0

### Columns (16)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | integer | No | nextval('fixtures_unified_id_seq'::regclass) | - | 32 | - |
| provider | character varying | Yes | 'manual'::character varying | 50 | - | - |
| provider_match_id | character varying | Yes | - | 50 | - | - |
| sport | character varying | No | 'football'::character varying | 20 | - | - |
| match_format | character varying | Yes | - | 20 | - | - |
| competition | character varying | Yes | - | 200 | - | - |
| home_team | character varying | No | - | 100 | - | - |
| away_team | character varying | No | - | 100 | - | - |
| venue | character varying | Yes | - | 200 | - | - |
| country | character varying | Yes | - | 100 | - | - |
| start_time | timestamp without time zone | Yes | - | - | - | - |
| status | character varying | Yes | - | 50 | - | - |
| raw_status | character varying | Yes | - | 50 | - | - |
| raw_payload | jsonb | Yes | - | - | - | - |
| created_at | timestamp without time zone | Yes | now() | - | - | - |
| updated_at | timestamp without time zone | Yes | now() | - | - | - |

### Indexes (2)

**fixtures_unified_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**fixtures_unified_provider_match_id_sport_key**
- Type: btree
- Columns: provider_match_id, sport
- Unique: Yes

### Constraints (2)

**fixtures_unified_pkey** (PRIMARY KEY)

**fixtures_unified_provider_match_id_sport_key** (UNIQUE)

---

## injuries

**Function:** General purpose table

**Statistics:**
- Row Count: 0
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 2
- Triggers: 0

### Columns (8)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | integer | No | nextval('injuries_id_seq'::regclass) | - | 32 | - |
| team_id | integer | Yes | - | - | 32 | - |
| player_name | text | Yes | - | - | - | - |
| injury_type | text | Yes | - | - | - | - |
| severity | text | Yes | - | - | - | - |
| status | text | Yes | - | - | - | - |
| expected_return | date | Yes | - | - | - | - |
| created_at | timestamp without time zone | Yes | CURRENT_TIMESTAMP | - | - | - |

### Indexes (1)

**injuries_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**injuries_pkey** (PRIMARY KEY)

**injuries_team_id_fkey** (FOREIGN KEY)

---

## leagues

**Function:** Stores league information

**Statistics:**
- Row Count: 26
- Estimated Size: 32 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (6)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | integer | No | nextval('leagues_id_seq'::regclass) | - | 32 | - |
| sport | text | No | - | - | - | - |
| name | text | No | - | - | - | - |
| api_source | text | Yes | - | - | - | - |
| api_league_id | text | Yes | - | - | - | - |
| created_at | timestamp without time zone | Yes | CURRENT_TIMESTAMP | - | - | - |

### Indexes (1)

**leagues_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**leagues_pkey** (PRIMARY KEY)

---

## market_rules_unified

**Function:** Defines market-specific rules

**Statistics:**
- Row Count: 47
- Estimated Size: 80 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 2
- Triggers: 0

### Columns (24)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | integer | No | nextval('market_rules_unified_id_seq'::regclass) | - | 32 | - |
| tier | character varying | No | - | 50 | - | - |
| sport | character varying | Yes | 'all'::character varying | 20 | - | - |
| rule_type | character varying | No | - | 50 | - | - |
| market_key | character varying | Yes | - | 100 | - | - |
| market_group | character varying | Yes | - | 50 | - | - |
| rule_config | jsonb | No | - | - | - | - |
| min_confidence | numeric | Yes | - | - | 5 | 2 |
| max_confidence | numeric | Yes | - | - | 5 | 2 |
| strong_confidence | numeric | Yes | - | - | 5 | 2 |
| elite_confidence | numeric | Yes | - | - | 5 | 2 |
| acca_min_confidence | numeric | Yes | - | - | 5 | 2 |
| acca_allowed | boolean | Yes | true | - | - | - |
| max_predictions | integer | Yes | - | - | 32 | - |
| features | jsonb | Yes | - | - | - | - |
| allowed_formats | ARRAY | Yes | - | - | - | - |
| requires_confirmed_lineup | boolean | Yes | false | - | - | - |
| requires_toss | boolean | Yes | false | - | - | - |
| display_only | boolean | Yes | false | - | - | - |
| volatility_level | character varying | Yes | - | 20 | - | - |
| notes | text | Yes | - | - | - | - |
| is_active | boolean | Yes | true | - | - | - |
| created_at | timestamp without time zone | Yes | now() | - | - | - |
| updated_at | timestamp without time zone | Yes | now() | - | - | - |

### Indexes (2)

**market_rules_unified_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**market_rules_unified_tier_sport_rule_type_market_key_key**
- Type: btree
- Columns: tier, sport, rule_type, market_key
- Unique: Yes

### Constraints (2)

**market_rules_unified_pkey** (PRIMARY KEY)

**market_rules_unified_tier_sport_rule_type_market_key_key** (UNIQUE)

---

## match_context_data

**Function:** Stores match/fixture information

**Statistics:**
- Row Count: 34
- Estimated Size: 1368 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 2
- Triggers: 0

### Columns (11)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id_event | text | No | - | - | - | - |
| lineups | jsonb | Yes | - | - | - | - |
| stats | jsonb | Yes | - | - | - | - |
| timeline | jsonb | Yes | - | - | - | - |
| home_last_5 | jsonb | Yes | - | - | - | - |
| away_last_5 | jsonb | Yes | - | - | - | - |
| updated_at | timestamp without time zone | Yes | now() | - | - | - |
| deep_context | jsonb | No | '{}'::jsonb | - | - | - |
| odds | jsonb | Yes | - | - | - | - |
| injuries | jsonb | Yes | '{}'::jsonb | - | - | - |
| match_id | text | Yes | - | - | - | - |

### Indexes (1)

**match_context_data_pkey**
- Type: btree
- Columns: id_event
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**match_context_data_id_event_fkey** (FOREIGN KEY)

**match_context_data_pkey** (PRIMARY KEY)

---

## matches

**Function:** Stores match/fixture information

**Statistics:**
- Row Count: 0
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 4
- Triggers: 0

### Columns (9)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | integer | No | nextval('matches_id_seq1'::regclass) | - | 32 | - |
| league_id | integer | Yes | - | - | 32 | - |
| home_team_id | integer | Yes | - | - | 32 | - |
| away_team_id | integer | Yes | - | - | 32 | - |
| match_date | timestamp without time zone | Yes | - | - | - | - |
| status | text | Yes | - | - | - | - |
| home_score | integer | Yes | - | - | 32 | - |
| away_score | integer | Yes | - | - | 32 | - |
| created_at | timestamp without time zone | Yes | CURRENT_TIMESTAMP | - | - | - |

### Indexes (1)

**matches_pkey1**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (4)

**matches_away_team_id_fkey** (FOREIGN KEY)

**matches_home_team_id_fkey** (FOREIGN KEY)

**matches_league_id_fkey** (FOREIGN KEY)

**matches_pkey1** (PRIMARY KEY)

---

## news_mentions

**Function:** General purpose table

**Statistics:**
- Row Count: 0
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 2
- Triggers: 0

### Columns (9)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | integer | No | nextval('news_mentions_id_seq'::regclass) | - | 32 | - |
| team_id | integer | Yes | - | - | 32 | - |
| source | text | Yes | - | - | - | - |
| title | text | Yes | - | - | - | - |
| content | text | Yes | - | - | - | - |
| sentiment_score | real | Yes | - | - | 24 | - |
| relevance_score | real | Yes | - | - | 24 | - |
| published_at | timestamp without time zone | Yes | - | - | - | - |
| created_at | timestamp without time zone | Yes | CURRENT_TIMESTAMP | - | - | - |

### Indexes (1)

**news_mentions_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**news_mentions_pkey** (PRIMARY KEY)

**news_mentions_team_id_fkey** (FOREIGN KEY)

---

## normalized_fixtures

**Function:** Normalized fixture data

**Statistics:**
- Row Count: 0
- Estimated Size: 48 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 5
- Constraints: 2
- Triggers: 0

### Columns (26)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('normalized_fixtures_id_seq'::regclass) | - | 64 | - |
| sport | character varying | No | - | 50 | - | - |
| provider_fixture_id | character varying | No | - | 255 | - | - |
| provider_name | character varying | Yes | 'the_odds_api'::character varying | 100 | - | - |
| home_team | character varying | No | - | 255 | - | - |
| away_team | character varying | No | - | 255 | - | - |
| league_id | character varying | Yes | - | 100 | - | - |
| league_name | character varying | Yes | - | 255 | - | - |
| season | character varying | Yes | - | 50 | - | - |
| venue | character varying | Yes | - | 255 | - | - |
| kickoff_utc | timestamp with time zone | No | - | - | - | - |
| kickoff_sast | timestamp with time zone | No | - | - | - | - |
| match_date_sast | date | No | - | - | - | - |
| match_time_sast | time without time zone | No | - | - | - | - |
| is_same_day | boolean | Yes | false | - | - | - |
| is_within_2h | boolean | Yes | false | - | - | - |
| is_acca_eligible | boolean | Yes | true | - | - | - |
| is_same_match_eligible | boolean | Yes | true | - | - | - |
| is_multi_eligible | boolean | Yes | true | - | - | - |
| status | character varying | Yes | 'scheduled'::character varying | 50 | - | - |
| confidence_score | real | Yes | - | - | 24 | - |
| volatility_level | character varying | Yes | 'medium'::character varying | 20 | - | - |
| metadata_json | jsonb | Yes | '{}'::jsonb | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |
| last_sync_at | timestamp with time zone | Yes | - | - | - | - |

### Indexes (5)

**idx_normalized_fixtures_kickoff_utc**
- Type: btree
- Columns: kickoff_utc

**idx_normalized_fixtures_sport_date**
- Type: btree
- Columns: sport, match_date_sast

**idx_normalized_fixtures_status**
- Type: btree
- Columns: status

**normalized_fixtures_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**normalized_fixtures_sport_provider_fixture_id_key**
- Type: btree
- Columns: sport, provider_fixture_id
- Unique: Yes

### Constraints (2)

**normalized_fixtures_pkey** (PRIMARY KEY)

**normalized_fixtures_sport_provider_fixture_id_key** (UNIQUE)

---

## odds_snapshots

**Function:** Stores odds snapshots at specific times

**Statistics:**
- Row Count: 0
- Estimated Size: 24 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 3
- Triggers: 0

### Columns (7)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | uuid | No | gen_random_uuid() | - | - | - |
| event_id | text | Yes | - | - | - | - |
| bookmaker_key | text | Yes | - | - | - | - |
| market_key | text | No | - | - | - | - |
| last_update | timestamp with time zone | No | - | - | - | - |
| outcomes | jsonb | No | - | - | - | - |
| recorded_at | timestamp with time zone | Yes | timezone('utc'::text, now()) | - | - | - |

### Indexes (2)

**idx_odds_snapshots_event_market**
- Type: btree
- Columns: event_id, market_key, last_update

**odds_snapshots_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (3)

**odds_snapshots_bookmaker_key_fkey** (FOREIGN KEY)

**odds_snapshots_event_id_fkey** (FOREIGN KEY)

**odds_snapshots_pkey** (PRIMARY KEY)

---

## prediction_core

**Function:** Prediction-related table

**Statistics:**
- Row Count: 0
- Estimated Size: 64 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 7
- Constraints: 2
- Triggers: 1

### Columns (13)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('prediction_core_id_seq'::regclass) | - | 64 | - |
| fixture_id | text | No | - | - | - | - |
| home_team | text | No | - | - | - | - |
| away_team | text | No | - | - | - | - |
| sport | text | No | - | - | - | - |
| market_type | text | No | - | - | - | - |
| prediction | text | No | - | - | - | - |
| confidence | numeric | No | - | - | - | - |
| match_date | timestamp with time zone | No | - | - | - | - |
| risk_tier | USER-DEFINED | No | - | - | - | - |
| matches | jsonb | No | '[]'::jsonb | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (7)

**idx_prediction_core_confidence**
- Type: btree
- Columns: confidence

**idx_prediction_core_fixture**
- Type: btree
- Columns: fixture_id

**idx_prediction_core_match_date**
- Type: btree
- Columns: match_date

**idx_prediction_core_risk_tier**
- Type: btree
- Columns: risk_tier

**idx_prediction_core_sport**
- Type: btree
- Columns: sport

**idx_prediction_core_teams**
- Type: btree
- Columns: home_team, away_team

**prediction_core_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**prediction_core_confidence_check** (CHECK)

**prediction_core_pkey** (PRIMARY KEY)

### Triggers (1)

**trg_prediction_core_updated_at**
- Enabled: Yes

---

## prediction_insights

**Function:** Stores AI-generated insights and analysis

**Statistics:**
- Row Count: 0
- Estimated Size: 32 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 3
- Constraints: 3
- Triggers: 1

### Columns (8)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('prediction_insights_id_seq'::regclass) | - | 64 | - |
| prediction_id | bigint | No | - | - | 64 | - |
| edgemind_report | text | Yes | - | - | - | - |
| secondary_insights | jsonb | No | '[]'::jsonb | - | - | - |
| recommendation | text | Yes | - | - | - | - |
| analysis_summary | text | Yes | - | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (3)

**idx_prediction_insights_prediction**
- Type: btree
- Columns: prediction_id

**prediction_insights_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**prediction_insights_prediction_id_key**
- Type: btree
- Columns: prediction_id
- Unique: Yes

### Constraints (3)

**prediction_insights_pkey** (PRIMARY KEY)

**prediction_insights_prediction_id_fkey** (FOREIGN KEY)

**prediction_insights_prediction_id_key** (UNIQUE)

### Triggers (1)

**trg_prediction_insights_updated_at**
- Enabled: Yes

---

## prediction_metadata

**Function:** Prediction-related table

**Statistics:**
- Row Count: 0
- Estimated Size: 56 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 6
- Constraints: 7
- Triggers: 0

### Columns (9)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('prediction_metadata_id_seq'::regclass) | - | 64 | - |
| prediction_id | bigint | No | - | - | 64 | - |
| publish_run_id | bigint | Yes | - | - | 64 | - |
| tier | text | No | - | - | - | - |
| type | text | No | - | - | - | - |
| total_confidence | numeric | No | - | - | - | - |
| risk_level | text | No | - | - | - | - |
| metadata | jsonb | No | '{}'::jsonb | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (6)

**idx_prediction_metadata_prediction**
- Type: btree
- Columns: prediction_id

**idx_prediction_metadata_publish_run**
- Type: btree
- Columns: publish_run_id

**idx_prediction_metadata_tier**
- Type: btree
- Columns: tier

**idx_prediction_metadata_type**
- Type: btree
- Columns: type

**prediction_metadata_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**prediction_metadata_prediction_id_key**
- Type: btree
- Columns: prediction_id
- Unique: Yes

### Constraints (7)

**prediction_metadata_pkey** (PRIMARY KEY)

**prediction_metadata_prediction_id_fkey** (FOREIGN KEY)

**prediction_metadata_prediction_id_key** (UNIQUE)

**prediction_metadata_publish_run_id_fkey** (FOREIGN KEY)

**prediction_metadata_risk_level_check** (CHECK)

**prediction_metadata_tier_check** (CHECK)

**prediction_metadata_type_check** (CHECK)

---

## prediction_publication

**Function:** Prediction-related table

**Statistics:**
- Row Count: 0
- Estimated Size: 48 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 5
- Constraints: 3
- Triggers: 1

### Columns (8)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('prediction_publication_id_seq'::regclass) | - | 64 | - |
| prediction_id | bigint | No | - | - | 64 | - |
| plan_visibility | jsonb | No | '[]'::jsonb | - | - | - |
| expires_at | timestamp with time zone | Yes | - | - | - | - |
| is_active | boolean | No | true | - | - | - |
| published_at | timestamp with time zone | No | now() | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (5)

**idx_prediction_publication_active**
- Type: btree
- Columns: is_active

**idx_prediction_publication_expires**
- Type: btree
- Columns: expires_at

**idx_prediction_publication_prediction**
- Type: btree
- Columns: prediction_id

**prediction_publication_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**prediction_publication_prediction_id_key**
- Type: btree
- Columns: prediction_id
- Unique: Yes

### Constraints (3)

**prediction_publication_pkey** (PRIMARY KEY)

**prediction_publication_prediction_id_fkey** (FOREIGN KEY)

**prediction_publication_prediction_id_key** (UNIQUE)

### Triggers (1)

**trg_prediction_publication_updated_at**
- Enabled: Yes

---

## prediction_publish_runs

**Function:** Prediction-related table

**Statistics:**
- Row Count: 193
- Estimated Size: 312 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 3
- Constraints: 2
- Triggers: 0

### Columns (11)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('prediction_publish_runs_id_seq'::regclass) | - | 64 | - |
| trigger_source | text | No | 'manual'::text | - | - | - |
| requested_sports | ARRAY | No | ARRAY[]::text[] | - | - | - |
| run_scope | text | No | 'all'::text | - | - | - |
| status | text | No | 'running'::text | - | - | - |
| notes | text | Yes | - | - | - | - |
| error_message | text | Yes | - | - | - | - |
| metadata | jsonb | No | '{}'::jsonb | - | - | - |
| started_at | timestamp with time zone | No | now() | - | - | - |
| completed_at | timestamp with time zone | Yes | - | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (3)

**idx_prediction_publish_runs_completed_at**
- Type: btree
- Columns: completed_at

**idx_prediction_publish_runs_status**
- Type: btree
- Columns: status

**prediction_publish_runs_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**prediction_publish_runs_pkey** (PRIMARY KEY)

**prediction_publish_runs_status_check** (CHECK)

---

## prediction_results

**Function:** Prediction-related table

**Statistics:**
- Row Count: 8
- Estimated Size: 32 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 2
- Triggers: 0

### Columns (12)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('prediction_results_id_seq'::regclass) | - | 64 | - |
| match_id | text | No | - | - | - | - |
| sport | text | No | - | - | - | - |
| prediction_type | text | No | - | - | - | - |
| market | text | No | - | - | - | - |
| prediction | text | No | - | - | - | - |
| actual_outcome | text | Yes | - | - | - | - |
| status | text | No | - | - | - | - |
| confidence | real | Yes | - | - | 24 | - |
| odds | real | Yes | - | - | 24 | - |
| settled_at | timestamp with time zone | Yes | - | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (1)

**prediction_results_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**prediction_results_pkey** (PRIMARY KEY)

**prediction_results_status_check** (CHECK)

---

## prediction_secondary_markets

**Function:** Stores secondary market predictions

**Statistics:**
- Row Count: 0
- Estimated Size: 40 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 4
- Constraints: 3
- Triggers: 0

### Columns (9)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('prediction_secondary_markets_id_seq'::regclass) | - | 64 | - |
| prediction_id | bigint | No | - | - | 64 | - |
| market | text | No | - | - | - | - |
| prediction | text | No | - | - | - | - |
| confidence | numeric | No | - | - | - | - |
| odds | numeric | Yes | - | - | - | - |
| label | text | Yes | - | - | - | - |
| metadata | jsonb | Yes | '{}'::jsonb | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (4)

**idx_prediction_secondary_markets_confidence**
- Type: btree
- Columns: confidence

**idx_prediction_secondary_markets_market**
- Type: btree
- Columns: market

**idx_prediction_secondary_markets_prediction**
- Type: btree
- Columns: prediction_id

**prediction_secondary_markets_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (3)

**prediction_secondary_markets_confidence_check** (CHECK)

**prediction_secondary_markets_pkey** (PRIMARY KEY)

**prediction_secondary_markets_prediction_id_fkey** (FOREIGN KEY)

---

## predictions_accuracy

**Function:** Tracks prediction accuracy metrics

**Statistics:**
- Row Count: 0
- Estimated Size: 128 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 4
- Constraints: 2
- Triggers: 0

### Columns (30)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('predictions_accuracy_id_seq'::regclass) | - | 64 | - |
| prediction_final_id | bigint | No | - | - | 64 | - |
| publish_run_id | bigint | Yes | - | - | 64 | - |
| prediction_match_index | integer | No | - | - | 32 | - |
| event_id | text | Yes | - | - | - | - |
| sport | text | No | - | - | - | - |
| prediction_tier | text | Yes | - | - | - | - |
| prediction_type | text | Yes | - | - | - | - |
| confidence | numeric | Yes | - | - | - | - |
| market | text | No | - | - | - | - |
| predicted_outcome | text | No | - | - | - | - |
| prediction_source | text | Yes | - | - | - | - |
| result_source | text | Yes | - | - | - | - |
| home_team | text | Yes | - | - | - | - |
| away_team | text | Yes | - | - | - | - |
| fixture_date | date | Yes | - | - | - | - |
| actual_result | text | Yes | - | - | - | - |
| event_status | text | Yes | - | - | - | - |
| resolution_status | text | Yes | - | - | - | - |
| is_correct | boolean | Yes | - | - | - | - |
| actual_home_score | numeric | Yes | - | - | - | - |
| actual_away_score | numeric | Yes | - | - | - | - |
| actual_home_score_ht | numeric | Yes | - | - | - | - |
| actual_away_score_ht | numeric | Yes | - | - | - | - |
| loss_reason_summary | text | Yes | - | - | - | - |
| loss_factors | jsonb | No | '[]'::jsonb | - | - | - |
| evaluation_notes | text | Yes | - | - | - | - |
| diagnostic_context | jsonb | Yes | - | - | - | - |
| raw_result | jsonb | Yes | - | - | - | - |
| evaluated_at | timestamp with time zone | Yes | - | - | - | - |

### Indexes (4)

**idx_predictions_accuracy_fixture_date**
- Type: btree
- Columns: fixture_date

**idx_predictions_accuracy_sport_date**
- Type: btree
- Columns: sport, fixture_date

**predictions_accuracy_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**predictions_accuracy_prediction_final_id_prediction_match_i_key**
- Type: btree
- Columns: prediction_final_id, prediction_match_index
- Unique: Yes

### Constraints (2)

**predictions_accuracy_pkey** (PRIMARY KEY)

**predictions_accuracy_prediction_final_id_prediction_match_i_key** (UNIQUE)

---

## predictions_filtered

**Function:** Stores final/published predictions for display

**Statistics:**
- Row Count: 126824
- Estimated Size: 18 MB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 3
- Constraints: 4
- Triggers: 0

### Columns (6)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('predictions_filtered_id_seq'::regclass) | - | 64 | - |
| raw_id | bigint | No | - | - | 64 | - |
| tier | text | No | - | - | - | - |
| is_valid | boolean | No | - | - | - | - |
| reject_reason | text | Yes | - | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (3)

**idx_predictions_filtered_tier**
- Type: btree
- Columns: tier

**predictions_filtered_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**predictions_filtered_raw_id_tier_key**
- Type: btree
- Columns: raw_id, tier
- Unique: Yes

### Constraints (4)

**predictions_filtered_pkey** (PRIMARY KEY)

**predictions_filtered_raw_id_fkey** (FOREIGN KEY)

**predictions_filtered_raw_id_tier_key** (UNIQUE)

**predictions_filtered_tier_check** (CHECK)

---

## predictions_filtered_backup_phase3

**Function:** Stores final/published predictions for display

**Statistics:**
- Row Count: 118498
- Estimated Size: 10 MB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 0
- Constraints: 0
- Triggers: 0

### Columns (6)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | Yes | - | - | 64 | - |
| raw_id | bigint | Yes | - | - | 64 | - |
| tier | text | Yes | - | - | - | - |
| is_valid | boolean | Yes | - | - | - | - |
| reject_reason | text | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | - | - | - | - |

---

## predictions_raw

**Function:** Stores raw AI predictions before processing

**Statistics:**
- Row Count: 64551
- Estimated Size: 78 MB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (10)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('predictions_raw_id_seq'::regclass) | - | 64 | - |
| match_id | text | No | - | - | - | - |
| sport | text | No | - | - | - | - |
| market | text | No | - | - | - | - |
| prediction | text | No | - | - | - | - |
| confidence | real | No | - | - | 24 | - |
| volatility | text | No | - | - | - | - |
| odds | real | Yes | - | - | 24 | - |
| metadata | jsonb | No | '{}'::jsonb | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (1)

**predictions_raw_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**predictions_raw_pkey** (PRIMARY KEY)

---

## predictions_raw_backup_phase3

**Function:** Stores raw AI predictions before processing

**Statistics:**
- Row Count: 60404
- Estimated Size: 37 MB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 0
- Constraints: 0
- Triggers: 0

### Columns (10)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | Yes | - | - | 64 | - |
| match_id | text | Yes | - | - | - | - |
| sport | text | Yes | - | - | - | - |
| market | text | Yes | - | - | - | - |
| prediction | text | Yes | - | - | - | - |
| confidence | real | Yes | - | - | 24 | - |
| volatility | text | Yes | - | - | - | - |
| odds | real | Yes | - | - | 24 | - |
| metadata | jsonb | Yes | - | - | - | - |
| created_at | timestamp with time zone | Yes | - | - | - | - |

---

## predictions_stage_1

**Function:** Stores intermediate prediction pipeline stages

**Statistics:**
- Row Count: 0
- Estimated Size: 112 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 3
- Triggers: 0

### Columns (12)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('predictions_stage_1_id_seq'::regclass) | - | 64 | - |
| fixture_id | bigint | Yes | - | - | 64 | - |
| sport | character varying | No | - | 50 | - | - |
| market_type | character varying | No | - | 100 | - | - |
| recommendation | character varying | No | - | 255 | - | - |
| confidence | real | No | - | - | 24 | - |
| risk_level | character varying | Yes | 'medium'::character varying | 20 | - | - |
| baseline_probability | real | Yes | - | - | 24 | - |
| implied_odds | real | Yes | - | - | 24 | - |
| market_efficiency_score | real | Yes | - | - | 24 | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| expires_at | timestamp with time zone | Yes | - | - | - | - |

### Indexes (1)

**predictions_stage_1_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (3)

**predictions_stage_1_confidence_check** (CHECK)

**predictions_stage_1_fixture_id_fkey** (FOREIGN KEY)

**predictions_stage_1_pkey** (PRIMARY KEY)

---

## predictions_stage_2

**Function:** Stores intermediate prediction pipeline stages

**Statistics:**
- Row Count: 0
- Estimated Size: 8192 bytes
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 3
- Triggers: 0

### Columns (14)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('predictions_stage_2_id_seq'::regclass) | - | 64 | - |
| stage_1_id | bigint | Yes | - | - | 64 | - |
| fixture_id | bigint | Yes | - | - | 64 | - |
| adjusted_confidence | real | Yes | - | - | 24 | - |
| confidence_adjustment | real | Yes | 0 | - | 24 | - |
| team_form_impact | real | Yes | - | - | 24 | - |
| injury_impact | real | Yes | - | - | 24 | - |
| suspension_impact | real | Yes | - | - | 24 | - |
| home_advantage_impact | real | Yes | - | - | 24 | - |
| weather_impact | real | Yes | - | - | 24 | - |
| deep_analysis_score | real | Yes | - | - | 24 | - |
| volatility_adjustment | real | Yes | - | - | 24 | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| expires_at | timestamp with time zone | Yes | - | - | - | - |

### Indexes (1)

**predictions_stage_2_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (3)

**predictions_stage_2_adjusted_confidence_check** (CHECK)

**predictions_stage_2_fixture_id_fkey** (FOREIGN KEY)

**predictions_stage_2_pkey** (PRIMARY KEY)

---

## predictions_stage_3

**Function:** Stores intermediate prediction pipeline stages

**Statistics:**
- Row Count: 0
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 3
- Triggers: 0

### Columns (13)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('predictions_stage_3_id_seq'::regclass) | - | 64 | - |
| stage_2_id | bigint | Yes | - | - | 64 | - |
| fixture_id | bigint | Yes | - | - | 64 | - |
| final_confidence | real | Yes | - | - | 24 | - |
| validation_score | real | Yes | - | - | 24 | - |
| news_sentiment_impact | real | Yes | - | - | 24 | - |
| travel_fatigue_impact | real | Yes | - | - | 24 | - |
| schedule_congestion_impact | real | Yes | - | - | 24 | - |
| external_factors | jsonb | Yes | '{}'::jsonb | - | - | - |
| risk_flags | jsonb | Yes | '[]'::jsonb | - | - | - |
| volatility_score | real | Yes | 0.5 | - | 24 | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| expires_at | timestamp with time zone | Yes | - | - | - | - |

### Indexes (1)

**predictions_stage_3_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (3)

**predictions_stage_3_final_confidence_check** (CHECK)

**predictions_stage_3_fixture_id_fkey** (FOREIGN KEY)

**predictions_stage_3_pkey** (PRIMARY KEY)

---

## predictions_unified

**Function:** Prediction-related table

**Statistics:**
- Row Count: 10
- Estimated Size: 176 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 6
- Constraints: 2
- Triggers: 0

### Columns (20)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | integer | No | nextval('predictions_unified_id_seq'::regclass) | - | 32 | - |
| match_id | character varying | No | - | 50 | - | - |
| home_team | character varying | No | - | 100 | - | - |
| away_team | character varying | No | - | 100 | - | - |
| prediction | character varying | No | - | 50 | - | - |
| confidence | numeric | No | - | - | 5 | 2 |
| status | character varying | Yes | 'raw'::character varying | 20 | - | - |
| filter_reason | text | Yes | - | - | - | - |
| metadata | jsonb | Yes | - | - | - | - |
| ai_model | character varying | Yes | - | 50 | - | - |
| sport | character varying | Yes | 'football'::character varying | 20 | - | - |
| market_type | character varying | Yes | '1x2'::character varying | 50 | - | - |
| processing_stage | character varying | Yes | 'stage_1'::character varying | 20 | - | - |
| matches | jsonb | Yes | - | - | - | - |
| edgemind_report | text | Yes | - | - | - | - |
| secondary_insights | jsonb | Yes | - | - | - | - |
| secondary_markets | jsonb | Yes | - | - | - | - |
| total_confidence | numeric | Yes | - | - | 5 | 2 |
| created_at | timestamp without time zone | Yes | now() | - | - | - |
| updated_at | timestamp without time zone | Yes | now() | - | - | - |

### Indexes (6)

**idx_predictions_unified_match_id**
- Type: btree
- Columns: match_id

**idx_predictions_unified_sport**
- Type: btree
- Columns: sport

**idx_predictions_unified_stage**
- Type: btree
- Columns: processing_stage

**idx_predictions_unified_status**
- Type: btree
- Columns: status

**predictions_unified_match_id_status_processing_stage_key**
- Type: btree
- Columns: match_id, status, processing_stage
- Unique: Yes

**predictions_unified_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**predictions_unified_match_id_status_processing_stage_key** (UNIQUE)

**predictions_unified_pkey** (PRIMARY KEY)

---

## profiles

**Function:** General purpose table

**Statistics:**
- Row Count: 1
- Estimated Size: 32 kB
- RLS Enabled: ✅ Yes
- RLS Policies: 6
- Indexes: 1
- Constraints: 2
- Triggers: 0

### Columns (8)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | uuid | No | - | - | - | - |
| email | text | Yes | - | - | - | - |
| subscription_status | text | Yes | 'inactive'::text | - | - | - |
| created_at | timestamp with time zone | Yes | now() | - | - | - |
| is_test_user | boolean | Yes | false | - | - | - |
| plan_id | text | Yes | - | - | - | - |
| plan_tier | text | Yes | - | - | - | - |
| plan_expires_at | timestamp without time zone | Yes | - | - | - | - |

### RLS Policies (6)

**Users can view own profile**
- Permissive: Yes
- Roles: {public}
- Command: SELECT
- Using: `(auth.uid() = id)`

**Users can insert own profile**
- Permissive: Yes
- Roles: {public}
- Command: INSERT
- With Check: `(auth.uid() = id)`

**Users can update own profile**
- Permissive: Yes
- Roles: {public}
- Command: UPDATE
- Using: `(auth.uid() = id)`

**profiles_select_own**
- Permissive: Yes
- Roles: {authenticated}
- Command: SELECT
- Using: `(auth.uid() = id)`

**profiles_update_own**
- Permissive: Yes
- Roles: {authenticated}
- Command: UPDATE
- Using: `(auth.uid() = id)`
- With Check: `(auth.uid() = id)`

**profiles_insert_own**
- Permissive: Yes
- Roles: {authenticated}
- Command: INSERT
- With Check: `(auth.uid() = id)`

### Indexes (1)

**profiles_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**profiles_id_fkey** (FOREIGN KEY)

**profiles_pkey** (PRIMARY KEY)

---

## rapidapi_cache

**Function:** Stores context/enrichment data

**Statistics:**
- Row Count: 50
- Estimated Size: 248 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 4
- Constraints: 1
- Triggers: 0

### Columns (4)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| cache_key | text | No | - | - | - | - |
| provider_name | text | No | - | - | - | - |
| payload | jsonb | No | - | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (4)

**idx_rapidapi_cache_provider**
- Type: btree
- Columns: provider_name

**idx_rapidapi_cache_provider_name**
- Type: btree
- Columns: provider_name

**idx_rapidapi_cache_updated_at**
- Type: btree
- Columns: updated_at

**rapidapi_cache_pkey**
- Type: btree
- Columns: cache_key
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**rapidapi_cache_pkey** (PRIMARY KEY)

---

## rapidapi_quota_usage

**Function:** Caches external API responses

**Statistics:**
- Row Count: 0
- Estimated Size: 32 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 3
- Constraints: 3
- Triggers: 0

### Columns (6)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('rapidapi_quota_usage_id_seq'::regclass) | - | 64 | - |
| provider_name | text | No | - | - | - | - |
| window_type | text | No | - | - | - | - |
| window_start | timestamp with time zone | No | - | - | - | - |
| usage_count | integer | No | 0 | - | 32 | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (3)

**idx_quota_provider_window**
- Type: btree
- Columns: provider_name, window_type, window_start

**rapidapi_quota_usage_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**rapidapi_quota_usage_provider_name_window_type_window_start_key**
- Type: btree
- Columns: provider_name, window_type, window_start
- Unique: Yes

### Constraints (3)

**rapidapi_quota_usage_pkey** (PRIMARY KEY)

**rapidapi_quota_usage_provider_name_window_type_window_start_key** (UNIQUE)

**rapidapi_quota_usage_window_type_check** (CHECK)

---

## raw_fixtures

**Function:** Raw fixture data from external APIs

**Statistics:**
- Row Count: 43
- Estimated Size: 3488 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (9)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id_event | text | No | - | - | - | - |
| sport | text | Yes | - | - | - | - |
| league_id | text | Yes | - | - | - | - |
| home_team_id | text | Yes | - | - | - | - |
| away_team_id | text | Yes | - | - | - | - |
| start_time | timestamp with time zone | Yes | - | - | - | - |
| status | text | Yes | - | - | - | - |
| raw_json | jsonb | Yes | - | - | - | - |
| updated_at | timestamp without time zone | Yes | now() | - | - | - |

### Indexes (1)

**raw_fixtures_pkey**
- Type: btree
- Columns: id_event
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**raw_fixtures_pkey** (PRIMARY KEY)

---

## scheduler_run_locks

**Function:** Manages scheduler locks

**Statistics:**
- Row Count: 0
- Estimated Size: 24 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 2
- Triggers: 0

### Columns (3)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('scheduler_run_locks_id_seq'::regclass) | - | 64 | - |
| publish_window | text | No | - | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (2)

**scheduler_run_locks_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**scheduler_run_locks_publish_window_key**
- Type: btree
- Columns: publish_window
- Unique: Yes

### Constraints (2)

**scheduler_run_locks_pkey** (PRIMARY KEY)

**scheduler_run_locks_publish_window_key** (UNIQUE)

---

## scheduling_logs

**Function:** General purpose table

**Statistics:**
- Row Count: 15
- Estimated Size: 64 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 3
- Constraints: 1
- Triggers: 0

### Columns (14)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('scheduling_logs_id_seq'::regclass) | - | 64 | - |
| schedule_type | character varying | No | - | 50 | - | - |
| window_start | timestamp with time zone | No | - | - | - | - |
| window_end | timestamp with time zone | No | - | - | - | - |
| fixtures_imported | integer | Yes | 0 | - | 32 | - |
| fixtures_normalized | integer | Yes | 0 | - | 32 | - |
| predictions_generated | integer | Yes | 0 | - | 32 | - |
| predictions_filtered | integer | Yes | 0 | - | 32 | - |
| status | character varying | Yes | 'running'::character varying | 20 | - | - |
| error_message | text | Yes | - | - | - | - |
| started_at | timestamp with time zone | No | now() | - | - | - |
| completed_at | timestamp with time zone | Yes | - | - | - | - |
| duration_ms | integer | Yes | - | - | 32 | - |
| metadata | jsonb | Yes | '{}'::jsonb | - | - | - |

### Indexes (3)

**idx_scheduling_logs_started_at**
- Type: btree
- Columns: started_at

**idx_scheduling_logs_status**
- Type: btree
- Columns: status

**scheduling_logs_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**scheduling_logs_pkey** (PRIMARY KEY)

---

## secondary_market_allowlist

**Function:** General purpose table

**Statistics:**
- Row Count: 32
- Estimated Size: 32 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (3)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| market_key | text | No | - | - | - | - |
| category | text | No | - | - | - | - |
| is_active | boolean | Yes | true | - | - | - |

### Indexes (1)

**secondary_market_allowlist_pkey**
- Type: btree
- Columns: market_key
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**secondary_market_allowlist_pkey** (PRIMARY KEY)

---

## sport_sync

**Function:** General purpose table

**Statistics:**
- Row Count: 0
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (3)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| sport | text | No | - | - | - | - |
| enabled | boolean | No | true | - | - | - |
| last_sync_at | timestamp with time zone | Yes | - | - | - | - |

### Indexes (1)

**sport_sync_pkey**
- Type: btree
- Columns: sport
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**sport_sync_pkey** (PRIMARY KEY)

---

## sports

**Function:** Stores sport definitions and metadata

**Statistics:**
- Row Count: 59
- Estimated Size: 64 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (7)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| sport_key | text | No | - | - | - | - |
| sport_group | text | No | - | - | - | - |
| title | text | No | - | - | - | - |
| description | text | Yes | - | - | - | - |
| active | boolean | Yes | true | - | - | - |
| has_outrights | boolean | Yes | false | - | - | - |
| updated_at | timestamp with time zone | Yes | timezone('utc'::text, now()) | - | - | - |

### Indexes (1)

**sports_pkey**
- Type: btree
- Columns: sport_key
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**sports_pkey** (PRIMARY KEY)

---

## subscription_plans

**Function:** Defines subscription plan tiers and features

**Statistics:**
- Row Count: 8
- Estimated Size: 64 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 2
- Triggers: 0

### Columns (10)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| plan_id | character varying | No | - | 100 | - | - |
| name | character varying | No | - | 255 | - | - |
| tier | character varying | No | - | 20 | - | - |
| duration_days | integer | No | - | - | 32 | - |
| price | numeric | No | - | - | 10 | 2 |
| daily_allocations | jsonb | No | - | - | - | - |
| capabilities | jsonb | No | - | - | - | - |
| active | boolean | Yes | true | - | - | - |
| created_at | timestamp with time zone | No | now() | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (1)

**subscription_plans_pkey**
- Type: btree
- Columns: plan_id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**subscription_plans_pkey** (PRIMARY KEY)

**subscription_plans_tier_check** (CHECK)

---

## subscriptions

**Function:** Stores user subscription information

**Statistics:**
- Row Count: 0
- Estimated Size: 24 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 3
- Constraints: 1
- Triggers: 0

### Columns (10)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | uuid | No | gen_random_uuid() | - | - | - |
| user_id | uuid | No | - | - | - | - |
| tier_id | character varying | No | - | 50 | - | - |
| status | USER-DEFINED | No | - | - | - | - |
| payment_timestamp | timestamp with time zone | No | now() | - | - | - |
| official_start_time | timestamp with time zone | No | - | - | - | - |
| expiration_time | timestamp with time zone | No | - | - | - | - |
| join_after_cutoff | boolean | No | false | - | - | - |
| pro_rata_direct_free_percent | integer | No | 0 | - | 32 | - |
| created_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (3)

**idx_subscriptions_status**
- Type: btree
- Columns: status

**idx_subscriptions_user_payment**
- Type: btree
- Columns: user_id, payment_timestamp

**subscriptions_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**subscriptions_pkey** (PRIMARY KEY)

---

## table_lifecycle_registry

**Function:** General purpose table

**Statistics:**
- Row Count: 13
- Estimated Size: 352 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 2
- Triggers: 0

### Columns (6)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| table_name | text | No | - | - | - | - |
| lifecycle_state | text | No | - | - | - | - |
| is_active | boolean | No | true | - | - | - |
| owner_component | text | Yes | - | - | - | - |
| notes | text | Yes | - | - | - | - |
| updated_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (1)

**table_lifecycle_registry_pkey**
- Type: btree
- Columns: table_name
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**table_lifecycle_registry_lifecycle_state_check** (CHECK)

**table_lifecycle_registry_pkey** (PRIMARY KEY)

---

## team_stats

**Function:** Stores team statistics

**Statistics:**
- Row Count: 0
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 2
- Triggers: 0

### Columns (12)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | integer | No | nextval('team_stats_id_seq'::regclass) | - | 32 | - |
| team_id | integer | Yes | - | - | 32 | - |
| season | text | Yes | - | - | - | - |
| matches_played | integer | Yes | - | - | 32 | - |
| wins | integer | Yes | - | - | 32 | - |
| draws | integer | Yes | - | - | 32 | - |
| losses | integer | Yes | - | - | 32 | - |
| goals_for | integer | Yes | - | - | 32 | - |
| goals_against | integer | Yes | - | - | 32 | - |
| points | integer | Yes | - | - | 32 | - |
| form_rating | real | Yes | - | - | 24 | - |
| created_at | timestamp without time zone | Yes | CURRENT_TIMESTAMP | - | - | - |

### Indexes (1)

**team_stats_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**team_stats_pkey** (PRIMARY KEY)

**team_stats_team_id_fkey** (FOREIGN KEY)

---

## team_week_locks

**Function:** Manages weekly data locks for teams

**Statistics:**
- Row Count: 270
- Estimated Size: 112 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 2
- Constraints: 3
- Triggers: 0

### Columns (8)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | bigint | No | nextval('team_week_locks_id_seq'::regclass) | - | 64 | - |
| week_key | text | No | - | - | - | - |
| team_key | text | No | - | - | - | - |
| competition_key | text | No | - | - | - | - |
| publish_run_id | bigint | Yes | - | - | 64 | - |
| source_type | text | Yes | - | - | - | - |
| source_tier | text | Yes | - | - | - | - |
| locked_at | timestamp with time zone | No | now() | - | - | - |

### Indexes (2)

**team_week_locks_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

**team_week_locks_week_key_team_key_competition_key_key**
- Type: btree
- Columns: week_key, team_key, competition_key
- Unique: Yes

### Constraints (3)

**team_week_locks_pkey** (PRIMARY KEY)

**team_week_locks_publish_run_id_fkey** (FOREIGN KEY)

**team_week_locks_week_key_team_key_competition_key_key** (UNIQUE)

---

## teams

**Function:** Stores team/player entity data

**Statistics:**
- Row Count: 0
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 1
- Constraints: 2
- Triggers: 0

### Columns (7)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | integer | No | nextval('teams_id_seq'::regclass) | - | 32 | - |
| league_id | integer | Yes | - | - | 32 | - |
| name | text | No | - | - | - | - |
| short_name | text | Yes | - | - | - | - |
| country | text | Yes | - | - | - | - |
| venue | text | Yes | - | - | - | - |
| created_at | timestamp without time zone | Yes | CURRENT_TIMESTAMP | - | - | - |

### Indexes (1)

**teams_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (2)

**teams_league_id_fkey** (FOREIGN KEY)

**teams_pkey** (PRIMARY KEY)

---

## tier_rules

**Function:** Defines tier-based rules and restrictions

**Statistics:**
- Row Count: 2
- Estimated Size: 96 kB
- RLS Enabled: ❌ No
- RLS Policies: 1
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (5)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| tier | text | No | - | - | - | - |
| min_confidence | real | No | - | - | 24 | - |
| allowed_markets | jsonb | No | - | - | - | - |
| max_acca_size | integer | No | - | - | 32 | - |
| allowed_volatility | jsonb | No | - | - | - | - |

### RLS Policies (1)

**Allow public read tiers**
- Permissive: Yes
- Roles: {public}
- Command: SELECT
- Using: `true`

### Indexes (1)

**tier_rules_pkey**
- Type: btree
- Columns: tier
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**tier_rules_pkey** (PRIMARY KEY)

---

## tier_rules_backup_phase2

**Function:** Defines tier-based rules and restrictions

**Statistics:**
- Row Count: 2
- Estimated Size: 16 kB
- RLS Enabled: ❌ No
- RLS Policies: 0
- Indexes: 0
- Constraints: 0
- Triggers: 0

### Columns (5)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| tier | text | Yes | - | - | - | - |
| min_confidence | real | Yes | - | - | 24 | - |
| allowed_markets | jsonb | Yes | - | - | - | - |
| max_acca_size | integer | Yes | - | - | 32 | - |
| allowed_volatility | jsonb | Yes | - | - | - | - |

---

## zz_archive_matches

**Function:** Archived historical fixtures

**Statistics:**
- Row Count: 5
- Estimated Size: 128 kB
- RLS Enabled: ❌ No
- RLS Policies: 1
- Indexes: 1
- Constraints: 1
- Triggers: 0

### Columns (11)

| Column | Type | Nullable | Default | Max Length | Precision | Scale |
|--------|------|----------|---------|------------|-----------|-------|
| id | integer | No | nextval('matches_id_seq'::regclass) | - | 32 | - |
| home_team | text | Yes | - | - | - | - |
| away_team | text | Yes | - | - | - | - |
| match_name | timestamp without time zone | Yes | - | - | - | - |
| status | text | Yes | - | - | - | - |
| home_goals | integer | Yes | - | - | 32 | - |
| away_goals | integer | Yes | - | - | 32 | - |
| home_form | integer | Yes | - | - | 32 | - |
| away_form | integer | Yes | - | - | 32 | - |
| league | text | Yes | - | - | - | - |
| sport | text | Yes | 'football'::text | - | - | - |

### RLS Policies (1)

**Allow public read matches**
- Permissive: Yes
- Roles: {public}
- Command: SELECT
- Using: `true`

### Indexes (1)

**matches_pkey**
- Type: btree
- Columns: id
- Unique: Yes
- Primary Key: Yes

### Constraints (1)

**matches_pkey** (PRIMARY KEY)

---

