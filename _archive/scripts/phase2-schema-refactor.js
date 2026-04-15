'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

console.log('=== PHASE 2: SCHEMA REFACTOR (SAFE) ===\n');

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function executePhase2() {
    const results = [];
    
    // Helper to check if table exists
    async function tableExists(name) {
        const res = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = $1
        `, [name]);
        return res.rows.length > 0;
    }

    // 1. Create normalized_fixtures
    console.log('STEP 1: Creating normalized_fixtures...');
    if (!(await tableExists('normalized_fixtures'))) {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS normalized_fixtures (
                id BIGSERIAL PRIMARY KEY,
                sport VARCHAR(50) NOT NULL,
                provider_fixture_id VARCHAR(255) NOT NULL,
                provider_name VARCHAR(100) DEFAULT 'the_odds_api',
                home_team VARCHAR(255) NOT NULL,
                away_team VARCHAR(255) NOT NULL,
                league_id VARCHAR(100),
                league_name VARCHAR(255),
                season VARCHAR(50),
                venue VARCHAR(255),
                kickoff_utc TIMESTAMPTZ NOT NULL,
                kickoff_sast TIMESTAMPTZ NOT NULL,
                match_date_sast DATE NOT NULL,
                match_time_sast TIME NOT NULL,
                is_same_day BOOLEAN DEFAULT FALSE,
                is_within_2h BOOLEAN DEFAULT FALSE,
                is_acca_eligible BOOLEAN DEFAULT TRUE,
                is_same_match_eligible BOOLEAN DEFAULT TRUE,
                is_multi_eligible BOOLEAN DEFAULT TRUE,
                status VARCHAR(50) DEFAULT 'scheduled',
                confidence_score REAL,
                volatility_level VARCHAR(20) DEFAULT 'medium',
                metadata_json JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_sync_at TIMESTAMPTZ,
                UNIQUE(sport, provider_fixture_id)
            )
        `);
        console.log('   ✓ Created normalized_fixtures');
        results.push('normalized_fixtures created');
        
        // Create indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_normalized_fixtures_sport_date ON normalized_fixtures(sport, match_date_sast)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_normalized_fixtures_kickoff_utc ON normalized_fixtures(kickoff_utc)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_normalized_fixtures_status ON normalized_fixtures(status)`);
        console.log('   ✓ Created indexes');
    } else {
        console.log('   ℹ normalized_fixtures already exists');
    }

    // 2. Create prediction stage tables
    console.log('\nSTEP 2: Creating prediction stage tables...');
    
    const stageTables = [
        { name: 'predictions_stage_1', cols: `
            id BIGSERIAL PRIMARY KEY,
            fixture_id BIGINT REFERENCES normalized_fixtures(id) ON DELETE CASCADE,
            sport VARCHAR(50) NOT NULL,
            market_type VARCHAR(100) NOT NULL,
            recommendation VARCHAR(255) NOT NULL,
            confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
            risk_level VARCHAR(20) DEFAULT 'medium',
            baseline_probability REAL,
            implied_odds REAL,
            market_efficiency_score REAL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ
        `},
        { name: 'predictions_stage_2', cols: `
            id BIGSERIAL PRIMARY KEY,
            stage_1_id BIGINT,
            fixture_id BIGINT REFERENCES normalized_fixtures(id) ON DELETE CASCADE,
            adjusted_confidence REAL CHECK (adjusted_confidence >= 0 AND adjusted_confidence <= 100),
            confidence_adjustment REAL DEFAULT 0,
            team_form_impact REAL,
            injury_impact REAL,
            suspension_impact REAL,
            home_advantage_impact REAL,
            weather_impact REAL,
            deep_analysis_score REAL,
            volatility_adjustment REAL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ
        `},
        { name: 'predictions_stage_3', cols: `
            id BIGSERIAL PRIMARY KEY,
            stage_2_id BIGINT,
            fixture_id BIGINT REFERENCES normalized_fixtures(id) ON DELETE CASCADE,
            final_confidence REAL CHECK (final_confidence >= 0 AND final_confidence <= 100),
            validation_score REAL,
            news_sentiment_impact REAL,
            travel_fatigue_impact REAL,
            schedule_congestion_impact REAL,
            external_factors JSONB DEFAULT '{}',
            risk_flags JSONB DEFAULT '[]',
            volatility_score REAL DEFAULT 0.5,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ
        `}
    ];
    
    for (const tbl of stageTables) {
        if (!(await tableExists(tbl.name))) {
            await pool.query(`CREATE TABLE IF NOT EXISTS ${tbl.name} (${tbl.cols})`);
            console.log(`   ✓ Created ${tbl.name}`);
            results.push(`${tbl.name} created`);
        } else {
            console.log(`   ℹ ${tbl.name} already exists`);
        }
    }

    // 3. Create subscription_plans
    console.log('\nSTEP 3: Creating subscription_plans...');
    if (!(await tableExists('subscription_plans'))) {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subscription_plans (
                plan_id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                tier VARCHAR(20) NOT NULL CHECK (tier IN ('core', 'elite')),
                duration_days INTEGER NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                daily_allocations JSONB NOT NULL,
                capabilities JSONB NOT NULL,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        console.log('   ✓ Created subscription_plans table');
        
        // Insert seed data
        await pool.query(`
            INSERT INTO subscription_plans (plan_id, name, tier, duration_days, price, daily_allocations, capabilities) VALUES
            ('core_4day_sprint', '4-Day Sprint', 'core', 4, 3.99,
             '{"monday":{"direct":6,"secondary":4,"multi":2,"same_match":2,"acca_6match":1},"tuesday":{"direct":6,"secondary":4,"multi":2,"same_match":2,"acca_6match":1},"wednesday":{"direct":8,"secondary":5,"multi":3,"same_match":2,"acca_6match":1},"thursday":{"direct":8,"secondary":5,"multi":3,"same_match":2,"acca_6match":1},"friday":{"direct":10,"secondary":6,"multi":3,"same_match":3,"acca_6match":2},"saturday":{"direct":15,"secondary":8,"multi":5,"same_match":5,"acca_6match":3},"sunday":{"direct":12,"secondary":7,"multi":4,"same_match":4,"acca_6match":2}}'::JSONB,
             '{"daily_multiplier":0.4,"chatbot_daily_limit":10,"acca_eligibility":"restricted","sports_coverage":["football","basketball","tennis","cricket"],"market_access":["1X2","double_chance","over_2_5","btts_yes"]}'::JSONB
            ),
            ('core_9day_run', '9-Day Run', 'core', 9, 7.99,
             '{"monday":{"direct":8,"secondary":5,"multi":3,"same_match":3,"acca_6match":1},"tuesday":{"direct":8,"secondary":5,"multi":3,"same_match":3,"acca_6match":1},"wednesday":{"direct":10,"secondary":6,"multi":4,"same_match":3,"acca_6match":2},"thursday":{"direct":10,"secondary":6,"multi":4,"same_match":3,"acca_6match":2},"friday":{"direct":12,"secondary":8,"multi":4,"same_match":4,"acca_6match":2},"saturday":{"direct":18,"secondary":10,"multi":6,"same_match":6,"acca_6match":4},"sunday":{"direct":14,"secondary":9,"multi":5,"same_match":5,"acca_6match":3}}'::JSONB,
             '{"daily_multiplier":0.5,"chatbot_daily_limit":15,"acca_eligibility":"restricted","sports_coverage":["football","basketball","cricket","rugby","baseball"],"market_access":["1X2","double_chance","over_2_5","btts_yes","over_1_5"]}'::JSONB
            ),
            ('core_14day_pro', '14-Day Pro', 'core', 14, 14.99,
             '{"monday":{"direct":9,"secondary":6,"multi":4,"same_match":4,"acca_6match":2},"tuesday":{"direct":9,"secondary":6,"multi":4,"same_match":4,"acca_6match":2},"wednesday":{"direct":12,"secondary":8,"multi":5,"same_match":4,"acca_6match":2},"thursday":{"direct":12,"secondary":8,"multi":5,"same_match":4,"acca_6match":2},"friday":{"direct":15,"secondary":10,"multi":5,"same_match":5,"acca_6match":3},"saturday":{"direct":22,"secondary":12,"multi":8,"same_match":8,"acca_6match":5},"sunday":{"direct":18,"secondary":11,"multi":6,"same_match":6,"acca_6match":3}}'::JSONB,
             '{"daily_multiplier":0.7,"chatbot_daily_limit":20,"acca_eligibility":"restricted","sports_coverage":["football","basketball","cricket","rugby","baseball","hockey"],"market_access":["1X2","double_chance","over_2_5","btts_yes","over_1_5","under_2_5"]}'::JSONB
            ),
            ('core_30day_limitless', '30-Day Limitless', 'core', 30, 34.99,
             '{"monday":{"direct":10,"secondary":8,"multi":5,"same_match":5,"acca_6match":3},"tuesday":{"direct":10,"secondary":8,"multi":5,"same_match":5,"acca_6match":3},"wednesday":{"direct":15,"secondary":10,"multi":7,"same_match":6,"acca_6match":4},"thursday":{"direct":15,"secondary":10,"multi":7,"same_match":6,"acca_6match":4},"friday":{"direct":20,"secondary":12,"multi":8,"same_match":8,"acca_6match":5},"saturday":{"direct":30,"secondary":15,"multi":10,"same_match":10,"acca_6match":8},"sunday":{"direct":25,"secondary":14,"multi":9,"same_match":9,"acca_6match":6}}'::JSONB,
             '{"daily_multiplier":1.0,"chatbot_daily_limit":30,"acca_eligibility":"full","sports_coverage":["football","basketball","cricket","rugby","baseball","hockey","volleyball","mma","formula1","afl","handball"],"market_access":"all"}'::JSONB
            ),
            ('elite_4day_deep_dive', '4-Day Deep Dive', 'elite', 4, 9.99,
             '{"monday":{"direct":8,"secondary":5,"multi":3,"same_match":3,"acca_6match":1},"tuesday":{"direct":8,"secondary":5,"multi":3,"same_match":3,"acca_6match":1},"wednesday":{"direct":10,"secondary":7,"multi":4,"same_match":3,"acca_6match":2},"thursday":{"direct":10,"secondary":7,"multi":4,"same_match":3,"acca_6match":2},"friday":{"direct":14,"secondary":8,"multi":5,"same_match":5,"acca_6match":3},"saturday":{"direct":20,"secondary":12,"multi":8,"same_match":8,"acca_6match":5},"sunday":{"direct":16,"secondary":10,"multi":6,"same_match":6,"acca_6match":4}}'::JSONB,
             '{"daily_multiplier":1.0,"chatbot_daily_limit":25,"acca_eligibility":"full","deep_analysis_weighting":true,"sports_coverage":"all","market_access":"all"}'::JSONB
            ),
            ('elite_9day_deep_strike', '9-Day Deep Strike', 'elite', 9, 19.99,
             '{"monday":{"direct":10,"secondary":7,"multi":4,"same_match":4,"acca_6match":2},"tuesday":{"direct":10,"secondary":7,"multi":4,"same_match":4,"acca_6match":2},"wednesday":{"direct":14,"secondary":9,"multi":6,"same_match":5,"acca_6match":3},"thursday":{"direct":14,"secondary":9,"multi":6,"same_match":5,"acca_6match":3},"friday":{"direct":18,"secondary":11,"multi":7,"same_match":7,"acca_6match":4},"saturday":{"direct":28,"secondary":15,"multi":10,"same_match":10,"acca_6match":7},"sunday":{"direct":22,"secondary":13,"multi":8,"same_match":8,"acca_6match":5}}'::JSONB,
             '{"daily_multiplier":1.0,"chatbot_daily_limit":35,"acca_eligibility":"full","deep_analysis_weighting":true,"sports_coverage":"all","market_access":"all"}'::JSONB
            ),
            ('elite_14day_deep_pro', '14-Day Deep Pro', 'elite', 14, 39.99,
             '{"monday":{"direct":12,"secondary":9,"multi":6,"same_match":6,"acca_6match":3},"tuesday":{"direct":12,"secondary":9,"multi":6,"same_match":6,"acca_6match":3},"wednesday":{"direct":18,"secondary":12,"multi":8,"same_match":7,"acca_6match":4},"thursday":{"direct":18,"secondary":12,"multi":8,"same_match":7,"acca_6match":4},"friday":{"direct":22,"secondary":15,"multi":10,"same_match":10,"acca_6match":6},"saturday":{"direct":35,"secondary":20,"multi":14,"same_match":14,"acca_6match":10},"sunday":{"direct":28,"secondary":18,"multi":12,"same_match":12,"acca_6match":8}}'::JSONB,
             '{"daily_multiplier":1.0,"chatbot_daily_limit":50,"acca_eligibility":"full","deep_analysis_weighting":true,"elite_only_filtering":true,"sports_coverage":"all","market_access":"all"}'::JSONB
            ),
            ('elite_30day_deep_vip', '30-Day Deep VIP', 'elite', 30, 59.99,
             '{"monday":{"direct":15,"secondary":12,"multi":8,"same_match":8,"acca_6match":5},"tuesday":{"direct":15,"secondary":12,"multi":8,"same_match":8,"acca_6match":5},"wednesday":{"direct":22,"secondary":15,"multi":10,"same_match":10,"acca_6match":7},"thursday":{"direct":22,"secondary":15,"multi":10,"same_match":10,"acca_6match":7},"friday":{"direct":30,"secondary":18,"multi":12,"same_match":12,"acca_6match":10},"saturday":{"direct":45,"secondary":25,"multi":18,"same_match":18,"acca_6match":15},"sunday":{"direct":35,"secondary":22,"multi":15,"same_match":15,"acca_6match":12}}'::JSONB,
             '{"daily_multiplier":1.0,"chatbot_daily_limit":150,"acca_eligibility":"full","deep_analysis_weighting":true,"elite_only_filtering":true,"sports_coverage":"all","market_access":"all","priority_support":true,"historical_data_depth":"unlimited"}'::JSONB
            )
            ON CONFLICT (plan_id) DO NOTHING
        `);
        console.log('   ✓ Inserted subscription plans');
        results.push('subscription_plans created and seeded');
    } else {
        console.log('   ℹ subscription_plans already exists');
    }

    // 4. Create scheduling_logs
    console.log('\nSTEP 4: Creating scheduling_logs...');
    if (!(await tableExists('scheduling_logs'))) {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS scheduling_logs (
                id BIGSERIAL PRIMARY KEY,
                schedule_type VARCHAR(50) NOT NULL,
                window_start TIMESTAMPTZ NOT NULL,
                window_end TIMESTAMPTZ NOT NULL,
                fixtures_imported INTEGER DEFAULT 0,
                fixtures_normalized INTEGER DEFAULT 0,
                predictions_generated INTEGER DEFAULT 0,
                predictions_filtered INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'running',
                error_message TEXT,
                started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                completed_at TIMESTAMPTZ,
                duration_ms INTEGER,
                metadata JSONB DEFAULT '{}'
            )
        `);
        console.log('   ✓ Created scheduling_logs');
        results.push('scheduling_logs created');
    } else {
        console.log('   ℹ scheduling_logs already exists');
    }

    // 5. Create views
    console.log('\nSTEP 5: Creating views...');
    
    await pool.query(`
        CREATE OR REPLACE VIEW active_predictions_by_sport AS
        SELECT 
            sport,
            tier,
            COUNT(*) as prediction_count,
            AVG(total_confidence) as avg_confidence,
            MAX(total_confidence) as max_confidence,
            MIN(total_confidence) as min_confidence
        FROM predictions_final
        WHERE expires_at > NOW() OR expires_at IS NULL
        GROUP BY sport, tier
        ORDER BY sport, tier
    `).catch(() => console.log('   ℹ view may already exist'));
    console.log('   ✓ Created active_predictions_by_sport view');

    // 6. Summary
    console.log('\n' + '═'.repeat(50));
    console.log('PHASE 2 COMPLETE');
    console.log('═'.repeat(50));
    console.log('\nNew tables created:');
    console.log('   - normalized_fixtures (for SAST timezone handling)');
    console.log('   - predictions_stage_1/2/3 (3-stage pipeline)');
    console.log('   - subscription_plans (with seed data)');
    console.log('   - scheduling_logs (pipeline logs)');
    console.log('   - active_predictions_by_sport (view)');
    console.log('\n✓ Ready to proceed with Phase 3 (cleanup)');

    await pool.end();
}

executePhase2().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
