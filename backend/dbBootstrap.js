'use strict';

const { query } = require('./db');

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

        await query(`
            CREATE TABLE IF NOT EXISTS predictions_final (
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
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'predictions_final_type_check'
                ) THEN
                    ALTER TABLE predictions_final DROP CONSTRAINT predictions_final_type_check;
                END IF;
            END
            $$;
        `);

        await query(`
            ALTER TABLE predictions_final
            ADD CONSTRAINT predictions_final_type_check
            CHECK (type IN ('single', 'acca', 'direct', 'secondary', 'multi', 'same_match', 'acca_6match', 'mega_acca_12'));
        `).catch((err) => {
            if (!String(err.message || '').includes('already exists')) throw err;
        });

        await query(`
            ALTER TABLE predictions_final
            ADD COLUMN IF NOT EXISTS publish_run_id bigint REFERENCES prediction_publish_runs(id) ON DELETE CASCADE;
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_predictions_final_publish_run_id
            ON predictions_final(publish_run_id);
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
            CREATE TABLE IF NOT EXISTS acca_rules (
                id bigserial PRIMARY KEY,
                rule_name text NOT NULL UNIQUE,
                rule_value jsonb NOT NULL
            );
        `);

        // Seed tier_rules
        await query(`
            INSERT INTO tier_rules (tier, min_confidence, allowed_markets, max_acca_size, allowed_volatility)
            VALUES
                ('normal', 50, '["ALL"]'::jsonb, 3, '["low","medium"]'::jsonb),
                ('deep', 60, '["ALL"]'::jsonb, 12, '["low"]'::jsonb)
            ON CONFLICT (tier) DO UPDATE SET
                min_confidence = EXCLUDED.min_confidence,
                allowed_markets = EXCLUDED.allowed_markets,
                max_acca_size = EXCLUDED.max_acca_size,
                allowed_volatility = EXCLUDED.allowed_volatility;
        `);

        // Seed acca_rules
        await query(`
            INSERT INTO acca_rules (rule_name, rule_value)
            VALUES
                ('no_same_match', 'true'::jsonb),
                ('no_conflicting_markets', 'true'::jsonb),
                ('max_per_match', '1'::jsonb),
                ('allow_high_volatility', 'false'::jsonb)
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

        await cleanupLegacyFixtureRows();

        console.log('[dbBootstrap] All tables and seed data verified.');
    } catch (err) {
        console.error('[dbBootstrap] Error:', err.message);
    }
}

module.exports = { bootstrap };
