'use strict';

const { query } = require('./database');

async function cleanupLegacyFixtureRows() {
    const tableRes = await query(`SELECT to_regclass('public.fixtures') IS NOT NULL AS exists;`);
    const fixturesExists = Boolean(tableRes.rows?.[0]?.exists);
    if (!fixturesExists) {
        console.log('[dbBootstrap] fixtures table not found; skipped legacy schema cleanup.');
        return;
    }

    const columnRes = await query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'fixtures'
          AND column_name IN ('sharp_odds', 'contextual_intelligence', 'match_info');
    `);

    const columns = new Set((columnRes.rows || []).map((row) => String(row.column_name || '').toLowerCase()));
    const hasRequiredColumns =
        columns.has('sharp_odds')
        && columns.has('contextual_intelligence')
        && columns.has('match_info');

    if (!hasRequiredColumns) {
        console.log('[dbBootstrap] fixtures table missing MatchContext columns; skipped legacy schema cleanup.');
        return;
    }

    const deleteRes = await query(`
        DELETE FROM fixtures
        WHERE sharp_odds IS NULL
           OR contextual_intelligence IS NULL
           OR match_info IS NULL;
    `);

    console.log('[dbBootstrap] Legacy fixture cleanup deleted %s row(s).', Number(deleteRes.rowCount || 0));
}

async function ensureFinalPredictionsCompatibility() {
    await query(`
        CREATE TABLE IF NOT EXISTS direct1x2_prediction_final (
            id bigserial PRIMARY KEY,
            publish_run_id bigint REFERENCES prediction_publish_runs(id) ON DELETE CASCADE,
            tier text NOT NULL CHECK (tier IN ('normal', 'deep')),
            type text NOT NULL CHECK (type IN ('single', 'acca', 'direct', 'secondary', 'multi', 'same_match', 'acca_6match', 'mega_acca_12')),
            matches jsonb NOT NULL,
            total_confidence numeric NOT NULL,
            risk_level text NOT NULL CHECK (risk_level IN ('safe', 'medium')),
            created_at timestamptz NOT NULL DEFAULT now()
        );
    `);

    await query(`
        DROP VIEW IF EXISTS public.predictions_final;
    `);

    await query(`
        CREATE OR REPLACE VIEW public.predictions_final AS
        SELECT *
        FROM public.direct1x2_prediction_final;
    `);

    await query(`
        DROP VIEW IF EXISTS public.prediction_final;
    `);

    await query(`
        CREATE OR REPLACE VIEW public.prediction_final AS
        SELECT *
        FROM public.direct1x2_prediction_final;
    `);
}

async function markStalePublishRuns() {
    const staleWindowHours = Number(process.env.SKCS_STALE_RUN_HOURS || 2);
    const staleRuns = await query(
        `
        UPDATE prediction_publish_runs
        SET
            status = 'failed',
            completed_at = COALESCE(completed_at, NOW()),
            error_message = CASE
                WHEN COALESCE(error_message, '') = '' THEN
                    CONCAT('Auto-closed stale running publish run by bootstrap (> ', $1::text, 'h).')
                ELSE
                    error_message
            END
        WHERE status = 'running'
          AND started_at < NOW() - make_interval(hours => $1::int)
        RETURNING id;
        `,
        [staleWindowHours]
    );

    if (Number(staleRuns.rowCount || 0) > 0) {
        console.log('[dbBootstrap] Auto-closed %s stale running publish run(s).', Number(staleRuns.rowCount || 0));
    }
}

async function cleanupInvalidPublishedRows() {
    const directCleanupRes = await query(`
        DELETE FROM direct1x2_prediction_final pf
        WHERE COALESCE(NULLIF(TRIM(pf.home_team), ''), NULLIF(TRIM(pf.matches->0->>'home_team'), ''), NULLIF(TRIM(pf.matches->0->>'home_team_name'), '')) IS NULL
           OR COALESCE(NULLIF(TRIM(pf.away_team), ''), NULLIF(TRIM(pf.matches->0->>'away_team'), ''), NULLIF(TRIM(pf.matches->0->>'away_team_name'), '')) IS NULL
           OR LOWER(COALESCE(NULLIF(TRIM(pf.home_team), ''), NULLIF(TRIM(pf.matches->0->>'home_team'), ''), NULLIF(TRIM(pf.matches->0->>'home_team_name'), ''))) IN ('unknown', 'unknown home', 'unknown away', 'home team', 'away team', 'tbd', 'n/a')
           OR LOWER(COALESCE(NULLIF(TRIM(pf.away_team), ''), NULLIF(TRIM(pf.matches->0->>'away_team'), ''), NULLIF(TRIM(pf.matches->0->>'away_team_name'), ''))) IN ('unknown', 'unknown home', 'unknown away', 'home team', 'away team', 'tbd', 'n/a')
           OR LOWER(COALESCE(NULLIF(TRIM(pf.sport), ''), NULLIF(TRIM(pf.matches->0->>'sport'), ''))) IN ('', 'unknown');
    `);

    const accuracyCleanupRes = await query(`
        DELETE FROM predictions_accuracy pa
        WHERE pa.prediction_final_id IS NULL
           OR NOT EXISTS (
                SELECT 1
                FROM direct1x2_prediction_final pf
                WHERE pf.id = pa.prediction_final_id
           )
           OR NULLIF(TRIM(pa.home_team), '') IS NULL
           OR NULLIF(TRIM(pa.away_team), '') IS NULL
           OR LOWER(TRIM(pa.home_team)) IN ('unknown', 'unknown home', 'unknown away', 'home team', 'away team', 'tbd', 'n/a')
           OR LOWER(TRIM(pa.away_team)) IN ('unknown', 'unknown home', 'unknown away', 'home team', 'away team', 'tbd', 'n/a')
           OR LOWER(COALESCE(NULLIF(TRIM(pa.predicted_outcome), ''), '')) IN ('1x2', 'standard 6-fold');
    `);

    if (Number(directCleanupRes.rowCount || 0) > 0 || Number(accuracyCleanupRes.rowCount || 0) > 0) {
        console.log(
            '[dbBootstrap] Invalid published row cleanup removed direct=%s, accuracy=%s.',
            Number(directCleanupRes.rowCount || 0),
            Number(accuracyCleanupRes.rowCount || 0)
        );
    }
}

async function bootstrap() {
    console.log('[dbBootstrap] Ensuring tables and seed data exist...');

    try {
        // Create tables if they don't exist
        await query(`
            CREATE TABLE IF NOT EXISTS prediction_publish_runs (
                id bigserial PRIMARY KEY,
                trigger_source text NOT NULL DEFAULT 'manual',
                requested_sports text[] NOT NULL DEFAULT ARRAY[]::text[],
                run_scope text NOT NULL DEFAULT 'all',
                status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
                notes text,
                error_message text,
                metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                started_at timestamptz NOT NULL DEFAULT now(),
                completed_at timestamptz,
                created_at timestamptz NOT NULL DEFAULT now()
            );
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS predictions_raw (
                id bigserial PRIMARY KEY,
                match_id text NOT NULL,
                sport text NOT NULL,
                market text NOT NULL,
                prediction text NOT NULL,
                confidence numeric NOT NULL,
                volatility text NOT NULL,
                odds numeric,
                metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                created_at timestamptz NOT NULL DEFAULT now()
            );
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS predictions_filtered (
                id bigserial PRIMARY KEY,
                raw_id bigint NOT NULL REFERENCES predictions_raw(id) ON DELETE CASCADE,
                tier text NOT NULL CHECK (tier IN ('normal', 'deep')),
                is_valid boolean NOT NULL,
                reject_reason text,
                created_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE (raw_id, tier)
            );
        `);

        await ensureFinalPredictionsCompatibility();

        await query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'predictions_final_type_check'
                ) THEN
                    ALTER TABLE direct1x2_prediction_final DROP CONSTRAINT predictions_final_type_check;
                END IF;
            END
            $$;
        `);

        await query(`
            ALTER TABLE direct1x2_prediction_final
            ADD CONSTRAINT predictions_final_type_check
            CHECK (type IN ('single', 'acca', 'direct', 'secondary', 'multi', 'same_match', 'acca_6match', 'mega_acca_12'));
        `).catch((err) => {
            if (!String(err.message || '').includes('already exists')) throw err;
        });

        await query(`
            ALTER TABLE direct1x2_prediction_final
            ADD COLUMN IF NOT EXISTS publish_run_id bigint REFERENCES prediction_publish_runs(id) ON DELETE CASCADE;
        `);

        await query(`
            ALTER TABLE direct1x2_prediction_final
            ADD COLUMN IF NOT EXISTS plan_visibility jsonb NOT NULL DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS sport text,
            ADD COLUMN IF NOT EXISTS market_type text,
            ADD COLUMN IF NOT EXISTS recommendation text,
            ADD COLUMN IF NOT EXISTS expires_at timestamptz,
            ADD COLUMN IF NOT EXISTS edgemind_report text,
            ADD COLUMN IF NOT EXISTS secondary_insights jsonb NOT NULL DEFAULT '[]'::jsonb;
        `);

        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_type
                    WHERE typname = 'risk_tier_enum'
                ) THEN
                    CREATE TYPE risk_tier_enum AS ENUM (
                        'HIGH_CONFIDENCE',
                        'MODERATE_RISK',
                        'HIGH_RISK',
                        'EXTREME_RISK'
                    );
                END IF;
            END
            $$;
        `);

        await query(`
            ALTER TABLE direct1x2_prediction_final
            ADD COLUMN IF NOT EXISTS fixture_id text,
            ADD COLUMN IF NOT EXISTS home_team text,
            ADD COLUMN IF NOT EXISTS away_team text,
            ADD COLUMN IF NOT EXISTS prediction text,
            ADD COLUMN IF NOT EXISTS confidence numeric,
            ADD COLUMN IF NOT EXISTS match_date timestamptz,
            ADD COLUMN IF NOT EXISTS risk_tier risk_tier_enum,
            ADD COLUMN IF NOT EXISTS secondary_markets jsonb NOT NULL DEFAULT '[]'::jsonb;
        `);

        await query(`
            UPDATE direct1x2_prediction_final
            SET confidence = total_confidence
            WHERE confidence IS NULL
              AND total_confidence IS NOT NULL;
        `);

        await query(`
            UPDATE direct1x2_prediction_final
            SET
                fixture_id = COALESCE(
                    NULLIF(BTRIM(fixture_id), ''),
                    NULLIF(BTRIM(matches->0->>'fixture_id'), ''),
                    NULLIF(BTRIM(matches->0->>'match_id'), '')
                ),
                home_team = COALESCE(
                    NULLIF(BTRIM(home_team), ''),
                    NULLIF(BTRIM(matches->0->>'home_team'), ''),
                    NULLIF(BTRIM(matches->0->'metadata'->>'home_team'), ''),
                    NULLIF(BTRIM(matches->0->>'home_team_name'), '')
                ),
                away_team = COALESCE(
                    NULLIF(BTRIM(away_team), ''),
                    NULLIF(BTRIM(matches->0->>'away_team'), ''),
                    NULLIF(BTRIM(matches->0->'metadata'->>'away_team'), ''),
                    NULLIF(BTRIM(matches->0->>'away_team_name'), '')
                ),
                prediction = COALESCE(
                    NULLIF(BTRIM(prediction), ''),
                    NULLIF(BTRIM(matches->0->>'prediction'), ''),
                    NULLIF(BTRIM(recommendation), '')
                ),
                match_date = COALESCE(
                    match_date,
                    NULLIF(BTRIM(matches->0->>'match_date'), '')::timestamptz,
                    NULLIF(BTRIM(matches->0->>'commence_time'), '')::timestamptz,
                    NULLIF(BTRIM(matches->0->>'date'), '')::timestamptz,
                    created_at::timestamptz
                )
            WHERE
                fixture_id IS NULL
                OR home_team IS NULL
                OR away_team IS NULL
                OR prediction IS NULL
                OR match_date IS NULL;
        `);

        await query(`
            WITH latest_run AS (
                SELECT id
                FROM prediction_publish_runs
                WHERE status = 'completed'
                ORDER BY completed_at DESC NULLS LAST, id DESC
                LIMIT 1
            )
            UPDATE direct1x2_prediction_final pf
            SET publish_run_id = lr.id
            FROM latest_run lr
            WHERE pf.publish_run_id IS NULL
              AND lr.id IS NOT NULL;
        `);

        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'confidence_range'
                      AND conrelid = 'direct1x2_prediction_final'::regclass
                ) THEN
                    ALTER TABLE direct1x2_prediction_final
                    ADD CONSTRAINT confidence_range
                    CHECK (confidence BETWEEN 0 AND 100);
                END IF;
            END
            $$;
        `);

        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'secondary_markets_length'
                      AND conrelid = 'direct1x2_prediction_final'::regclass
                ) THEN
                    ALTER TABLE direct1x2_prediction_final
                    ADD CONSTRAINT secondary_markets_length
                    CHECK (jsonb_array_length(secondary_markets) <= 4);
                END IF;
            END
            $$;
        `);

        // Enforce Secondary Market Allowlist via DB Schema and Triggers
        await query(`
            CREATE TABLE IF NOT EXISTS secondary_market_allowlist (
                market_key TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE
            );
        `);

        await query(`
            INSERT INTO secondary_market_allowlist (market_key, category) VALUES
                ('double_chance_1x', 'Double Chance'),
                ('double_chance_x2', 'Double Chance'),
                ('double_chance_12', 'Double Chance'),
                ('draw_no_bet_home', 'Draw No Bet'),
                ('draw_no_bet_away', 'Draw No Bet'),
                ('over_0_5', 'Goals Totals'),
                ('over_1_5', 'Goals Totals'),
                ('over_2_5', 'Goals Totals'),
                ('over_3_5', 'Goals Totals'),
                ('under_2_5', 'Goals Totals'),
                ('under_3_5', 'Goals Totals'),
                ('under_4_5', 'Defensive'),
                ('home_over_0_5', 'Team Totals'),
                ('home_over_1_5', 'Team Totals'),
                ('away_over_0_5', 'Team Totals'),
                ('away_over_1_5', 'Team Totals'),
                ('btts_yes', 'BTTS'),
                ('btts_no', 'BTTS'),
                ('btts_over_2_5', 'BTTS'),
                ('btts_under_3_5', 'BTTS'),
                ('home_win_btts_yes', 'BTTS'),
                ('away_win_btts_yes', 'BTTS'),
                ('home_win_btts_no', 'BTTS'),
                ('away_win_btts_no', 'BTTS'),
                ('double_chance_over_1_5', 'Defensive'),
                ('double_chance_under_3_5', 'Defensive'),
                ('over_0_5_first_half', 'Half Markets'),
                ('under_1_5_first_half', 'Half Markets'),
                ('first_half_draw', 'Half Markets'),
                ('home_win_either_half', 'Half Markets'),
                ('away_win_either_half', 'Half Markets'),
                ('win_either_half', 'Half Markets')
            ON CONFLICT (market_key) DO NOTHING;
        `);

        await query(`
            CREATE OR REPLACE FUNCTION check_secondary_markets_allowlist()
            RETURNS TRIGGER AS $func$
            DECLARE
                market_element jsonb;
                market_str text;
                is_allowed boolean;
            BEGIN
                -- Only validate if secondary_markets is not empty
                IF jsonb_array_length(NEW.secondary_markets) > 0 THEN
                    FOR market_element IN SELECT * FROM jsonb_array_elements(NEW.secondary_markets)
                    LOOP
                        market_str := market_element->>'market';
                        
                        -- Dynamic pattern matching for allowed ranges (corners and cards)
                        IF market_str ~ '^corners_(over|under)_([6-9]|1[0-2])_5$' THEN
                            CONTINUE;
                        END IF;
                        IF market_str ~ '^(yellow_)?cards_(over|under)_[1-6]_5$' THEN
                            CONTINUE;
                        END IF;

                        -- Strict lookup in the allowlist table
                        SELECT EXISTS (
                            SELECT 1 FROM secondary_market_allowlist 
                            WHERE market_key = market_str AND is_active = true
                        ) INTO is_allowed;

                        IF NOT is_allowed THEN
                            RAISE EXCEPTION 'Secondary market "%" is not in the approved allowlist.', market_str;
                        END IF;
                    END LOOP;
                END IF;
                
                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql;
        `);

        await query(`
            DROP TRIGGER IF EXISTS enforce_secondary_allowlist ON direct1x2_prediction_final;
            CREATE TRIGGER enforce_secondary_allowlist
            BEFORE INSERT OR UPDATE ON direct1x2_prediction_final
            FOR EACH ROW
            EXECUTE FUNCTION check_secondary_markets_allowlist();
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_predictions_final_publish_run_id
            ON direct1x2_prediction_final(publish_run_id);
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_direct1x2_match_date
            ON direct1x2_prediction_final(match_date);
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_direct1x2_risk_tier
            ON direct1x2_prediction_final(risk_tier);
        `);

        await query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_predictions_final_live_direct_fixture_market
            ON direct1x2_prediction_final (
                LOWER(COALESCE(sport, '')),
                LOWER(COALESCE(market_type, '')),
                (CASE
                    WHEN jsonb_typeof(matches) = 'array'
                    THEN NULLIF(BTRIM(matches->0->>'fixture_id'), '')
                    ELSE NULL
                END)
            )
            WHERE LOWER(COALESCE(tier, '')) = 'normal'
              AND LOWER(COALESCE(type, '')) = 'direct'
              AND publish_run_id IS NULL
              AND (CASE
                    WHEN jsonb_typeof(matches) = 'array'
                    THEN NULLIF(BTRIM(matches->0->>'fixture_id'), '')
                    ELSE NULL
                END) IS NOT NULL;
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS tier_rules (
                tier text PRIMARY KEY CHECK (tier IN ('normal', 'deep')),
                min_confidence numeric NOT NULL,
                allowed_markets jsonb NOT NULL,
                max_acca_size integer NOT NULL,
                allowed_volatility jsonb NOT NULL
            );
        `);

        await query(`
            DELETE FROM tier_rules
            WHERE tier NOT IN ('normal', 'deep');
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS acca_rules (
                id bigserial PRIMARY KEY,
                rule_name text NOT NULL UNIQUE,
                rule_value jsonb NOT NULL
            );
        `);

        // Seed tier_rules (MINIMAL thresholds - accept ANY prediction)
        try {
            await query(`
                INSERT INTO tier_rules (tier, min_confidence, allowed_markets, max_acca_size, allowed_volatility)
                VALUES
                    ('normal', 1, '["ALL"]'::jsonb, 100, '["low","medium","high"]'::jsonb),
                    ('deep', 1, '["ALL"]'::jsonb, 100, '["low","medium","high"]'::jsonb)
                ON CONFLICT (tier) DO UPDATE SET
                    min_confidence = 1,
                    allowed_markets = '["ALL"]'::jsonb,
                    max_acca_size = 100,
                    allowed_volatility = '["low","medium","high"]'::jsonb;
            `);
        } catch (err) {
            console.log('[dbBootstrap] Skipping tier rules insert due to constraint:', err.message);
        }

        // Seed acca_rules (allow high volatility now)
        await query(`
            INSERT INTO acca_rules (rule_name, rule_value)
            VALUES
                ('no_same_match', 'true'::jsonb),
                ('no_conflicting_markets', 'true'::jsonb),
                ('max_per_match', '1'::jsonb),
                ('allow_high_volatility', 'true'::jsonb)
            ON CONFLICT (rule_name) DO UPDATE SET
                rule_value = EXCLUDED.rule_value;
        `);

        // Predictions accuracy (graded results)
        await query(`
            CREATE TABLE IF NOT EXISTS predictions_accuracy (
                id bigserial PRIMARY KEY,
                prediction_final_id bigint NOT NULL,
                publish_run_id bigint,
                prediction_match_index integer NOT NULL,
                event_id text,
                sport text NOT NULL,
                prediction_tier text,
                prediction_type text,
                confidence numeric,
                market text NOT NULL,
                predicted_outcome text NOT NULL,
                prediction_source text,
                result_source text,
                home_team text,
                away_team text,
                fixture_date date,
                actual_result text,
                event_status text,
                resolution_status text,
                is_correct boolean,
                actual_home_score numeric,
                actual_away_score numeric,
                actual_home_score_ht numeric,
                actual_away_score_ht numeric,
                loss_reason_summary text,
                loss_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
                evaluation_notes text,
                diagnostic_context jsonb,
                raw_result jsonb,
                evaluated_at timestamptz,
                UNIQUE (prediction_final_id, prediction_match_index)
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_predictions_accuracy_fixture_date
            ON predictions_accuracy(fixture_date)
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_predictions_accuracy_sport_date
            ON predictions_accuracy(sport, fixture_date)
        `);

        await query(`
            WITH latest_run AS (
                SELECT id
                FROM prediction_publish_runs
                WHERE status = 'completed'
                ORDER BY completed_at DESC NULLS LAST, id DESC
                LIMIT 1
            )
            UPDATE predictions_accuracy pa
            SET
                publish_run_id = COALESCE(pa.publish_run_id, lr.id),
                fixture_date = COALESCE(
                    pa.fixture_date,
                    (
                        COALESCE(
                            pa.evaluated_at,
                            NOW()
                        ) AT TIME ZONE 'Africa/Johannesburg'
                    )::date
                ),
                resolution_status = COALESCE(
                    pa.resolution_status,
                    CASE
                        WHEN pa.is_correct = TRUE THEN 'won'
                        WHEN pa.is_correct = FALSE THEN 'lost'
                        WHEN pa.actual_result IS NOT NULL THEN 'void'
                        ELSE 'pending'
                    END
                ),
                evaluated_at = COALESCE(pa.evaluated_at, NOW())
            FROM latest_run lr
            WHERE
                pa.publish_run_id IS NULL
                OR pa.fixture_date IS NULL
                OR pa.resolution_status IS NULL
                OR pa.evaluated_at IS NULL;
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS context_intelligence_cache (
                id bigserial PRIMARY KEY,
                cache_key text NOT NULL UNIQUE,
                fixture_id text,
                payload jsonb NOT NULL DEFAULT '{}'::jsonb,
                last_verified timestamptz NOT NULL DEFAULT now(),
                expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 hour'),
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_context_intelligence_cache_expires_at
            ON context_intelligence_cache(expires_at)
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS fixture_context_cache (
                fixture_id TEXT PRIMARY KEY,
                context_payload JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // Event context snapshot tables (used by grading script for loss diagnostics)
        await query(`
            CREATE TABLE IF NOT EXISTS event_injury_snapshots (
                id bigserial PRIMARY KEY,
                event_id text NOT NULL,
                team_name text NOT NULL,
                status_type text,
                status_reason text,
                player_name text,
                created_at timestamptz NOT NULL DEFAULT now()
            );
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS event_weather_snapshots (
                id bigserial PRIMARY KEY,
                event_id text NOT NULL,
                temperature_c numeric,
                precipitation_mm numeric,
                wind_speed_kmh numeric,
                weather_code integer,
                weather_summary text,
                created_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE (event_id)
            );
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS event_news_snapshots (
                id bigserial PRIMARY KEY,
                event_id text NOT NULL,
                team_name text NOT NULL,
                signal_type text,
                signal_label text,
                signal_strength text,
                relevance_score numeric,
                sentiment_score numeric,
                evidence_keywords jsonb,
                article_title text,
                article_url text,
                published_at timestamptz,
                created_at timestamptz NOT NULL DEFAULT now()
            );
        `);

        // Add deep_context column to match_context_data if it doesn't exist
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'match_context_data'
                    AND column_name = 'deep_context'
                ) THEN
                    ALTER TABLE match_context_data
                    ADD COLUMN deep_context jsonb NOT NULL DEFAULT '{}'::jsonb;
                END IF;
            END $$;
        `);

        // Add injuries column to match_context_data if it doesn't exist
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'match_context_data'
                    AND column_name = 'injuries'
                ) THEN
                    ALTER TABLE match_context_data
                    ADD COLUMN injuries jsonb DEFAULT '{}'::jsonb;
                END IF;
            END $$;
        `);

        // Add composite partial unique index for fallback predictions to prevent duplicates
        await query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_predictions_final_fallback
            ON direct1x2_prediction_final (
                LOWER(COALESCE(sport, '')),
                LOWER(COALESCE(type, '')),
                LOWER(COALESCE(tier, '')),
                LOWER(COALESCE(market_type, '')),
                LOWER(COALESCE(home_team, '')),
                LOWER(COALESCE(away_team, '')),
                COALESCE(matches->0->>'kickoff', created_at::date::text)
            )
            WHERE publish_run_id IS NULL;
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS debug_published (
                id bigserial PRIMARY KEY,
                publish_run_id bigint,
                tier text,
                sport text,
                candidate jsonb NOT NULL,
                rejection_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                created_at timestamptz NOT NULL DEFAULT now()
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_debug_published_created_at
            ON debug_published(created_at DESC);
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_debug_published_sport
            ON debug_published(sport);
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS table_lifecycle_registry (
                table_name text PRIMARY KEY,
                lifecycle_state text NOT NULL CHECK (lifecycle_state IN ('active', 'compatibility', 'legacy', 'archived')),
                is_active boolean NOT NULL DEFAULT true,
                owner_component text,
                notes text,
                updated_at timestamptz NOT NULL DEFAULT now()
            );
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS team_week_locks (
                id BIGSERIAL PRIMARY KEY,
                week_key TEXT NOT NULL,
                team_key TEXT NOT NULL,
                competition_key TEXT NOT NULL,
                publish_run_id BIGINT REFERENCES prediction_publish_runs(id) ON DELETE SET NULL,
                source_type TEXT,
                source_tier TEXT,
                locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (week_key, team_key, competition_key)
            );
        `);

        await query(`
            INSERT INTO table_lifecycle_registry (table_name, lifecycle_state, is_active, owner_component, notes)
            VALUES
                ('predictions_raw', 'active', true, 'pipeline', 'Primary raw prediction ingest table.'),
                ('predictions_filtered', 'active', true, 'pipeline', 'Tier validation output table.'),
                ('direct1x2_prediction_final', 'active', true, 'publish', 'Live published insights table.'),
                ('prediction_publish_runs', 'active', true, 'publish', 'Run tracking table for all publish flows.'),
                ('predictions_accuracy', 'active', true, 'grading', 'Prediction grading and outcomes table.'),
                ('team_week_locks', 'active', true, 'publish', 'Persistent single-use team/week lock table across publish runs.'),
                ('rapidapi_cache', 'active', true, 'ingest', 'RapidAPI payload cache wall table.'),
                ('scheduling_logs', 'active', true, 'scheduler', 'Scheduler telemetry table.'),
                ('predictions_final', 'compatibility', true, 'compatibility', 'Compatibility view that mirrors direct1x2_prediction_final.'),
                ('prediction_final', 'compatibility', true, 'compatibility', 'Legacy compatibility view that mirrors direct1x2_prediction_final.'),
                ('prediction_results', 'legacy', false, 'legacy', 'Legacy accuracy table replaced by predictions_accuracy.'),
                ('scheduler_run_locks', 'legacy', false, 'legacy', 'Legacy scheduler lock table not used by active cron routes.')
            ON CONFLICT (table_name) DO UPDATE SET
                lifecycle_state = EXCLUDED.lifecycle_state,
                is_active = EXCLUDED.is_active,
                owner_component = EXCLUDED.owner_component,
                notes = EXCLUDED.notes,
                updated_at = NOW();
        `);

        await cleanupLegacyFixtureRows();
        await markStalePublishRuns();
        await cleanupInvalidPublishedRows();

        console.log('[dbBootstrap] All tables and seed data verified.');
    } catch (err) {
        console.error('[dbBootstrap] Error:', err.message);
    }
}

module.exports = { bootstrap };
