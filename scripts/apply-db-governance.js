require('dotenv').config();
const { pool } = require('../backend/database');

async function applyGovernance() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        console.log('🧹 1. Purging old duplicate/placeholder insights from the database...');
        
        // Delete bad data from direct1x2_prediction_final
        const res1 = await client.query(`
            DELETE FROM direct1x2_prediction_final 
            WHERE edgemind_report LIKE '%projects at 58% confidence%'
               OR edgemind_report LIKE '%Stage 1 Baseline:%'
               OR edgemind_report LIKE '%projects % on DRAW.%'
               OR edgemind_report LIKE '%projects % on HOME WIN.%'
               OR edgemind_report LIKE '%projects % on AWAY WIN.%'
               OR (total_confidence <= 58 AND COALESCE(jsonb_array_length(secondary_insights), 0) < 4)
        `);
        console.log(`✅ Deleted ${res1.rowCount} bad placeholder rows from direct1x2_prediction_final`);

        // Delete bad data from predictions_final
        const res2 = await client.query(`
            DELETE FROM predictions_final
            WHERE type = 'direct' 
              AND (
                  (matches->0->'metadata'->>'reasoning') LIKE '%projects at 58% confidence%'
               OR (matches->0->'metadata'->>'reasoning') LIKE '%Stage 1 Baseline:%'
               OR (matches->0->'metadata'->>'reasoning') LIKE '%projects % on DRAW.%'
               OR (matches->0->'metadata'->>'reasoning') LIKE '%projects % on HOME WIN.%'
               OR (matches->0->'metadata'->>'reasoning') LIKE '%projects % on AWAY WIN.%'
              )
        `);
        console.log(`✅ Deleted ${res2.rowCount} bad placeholder rows from predictions_final`);

        console.log('🛡️ 2. Creating Strict Allowlist schema in Supabase...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS secondary_markets_allowlist (
                id SERIAL PRIMARY KEY,
                market_name VARCHAR(255) UNIQUE NOT NULL
            );
        `);

        const allowedMarkets = [
            'Double Chance 1X', 'Double Chance X2', 'Double Chance 12',
            'DC 1X', 'DC X2', 'DC 12', '1X', 'X2', '12',
            'Draw No Bet Home', 'Draw No Bet Away', 'DNB Home', 'DNB Away', 'Home DNB', 'Away DNB',
            'Over 0.5 Goals', 'Over 1.5 Goals', 'Over 2.5 Goals', 'Over 3.5 Goals',
            'Under 2.5 Goals', 'Under 3.5 Goals', 'O 0.5', 'O 1.5', 'O 2.5', 'O 3.5', 'U 2.5', 'U 3.5',
            'Home Over 0.5', 'Home Over 1.5', 'Away Over 0.5', 'Away Over 1.5',
            'Home O 0.5', 'Home O 1.5', 'Away O 0.5', 'Away O 1.5', 'Home Team Over 0.5', 'Away Team Over 0.5',
            'BTTS YES', 'BTTS NO', 'Both Teams To Score Yes', 'Both Teams To Score No',
            'BTTS & Over 2.5', 'BTTS & Under 3.5', 'BTTS + O2.5', 'BTTS + U3.5', 'Win & BTTS YES', 'Win & BTTS NO',
            'Under 4.5 Goals', 'Double Chance + Under 3.5', 'Double Chance + Over 1.5', 'DC + U3.5', 'DC + O1.5',
            'Over 0.5 First Half', 'Under 1.5 First Half', 'First Half Draw',
            'FH Over 0.5', 'FH Under 1.5', 'FH Draw', 'Home Win Either Half', 'Away Win Either Half',
            'Home Win 2nd Half', 'Away Win 2nd Half',
            'Over 6.5 Corners', 'Over 7.5 Corners', 'Over 8.5 Corners', 'Over 9.5 Corners', 'Over 10.5 Corners', 'Over 11.5 Corners', 'Over 12.5 Corners',
            'Under 7.5 Corners', 'Under 8.5 Corners', 'Under 9.5 Corners', 'Under 10.5 Corners', 'Under 11.5 Corners', 'Under 12.5 Corners',
            'Over 1.5 Yellow Cards', 'Over 2.5 Yellow Cards', 'Over 3.5 Yellow Cards', 'Over 4.5 Yellow Cards', 'Over 5.5 Yellow Cards', 'Over 6.5 Yellow Cards',
            'Under 1.5 Yellow Cards', 'Under 2.5 Yellow Cards', 'Under 3.5 Yellow Cards', 'Under 4.5 Yellow Cards', 'Under 5.5 Yellow Cards', 'Under 6.5 Yellow Cards',
            'double_chance_1x', 'double_chance_x2', 'double_chance_12', 'draw_no_bet_home', 'draw_no_bet_away',
            'over_1_5', 'over_2_5', 'over_3_5', 'under_2_5', 'under_3_5', 'under_4_5', 'btts_yes', 'btts_no',
            'corners_over_8_5', 'corners_over_9_5', 'corners_under_10_5', 'ht_draw', 'ht_home_win', 'ht_away_win'
        ];
        
        const values = allowedMarkets.map(m => `('${m.replace(/'/g, "''")}')`).join(',');
        await client.query(`
            INSERT INTO secondary_markets_allowlist (market_name) 
            VALUES ${values}
            ON CONFLICT DO NOTHING;
        `);

        console.log('⚙️ 3. Applying DB Triggers for Risk Framework Enforcement...');
        
        // Trigger for direct1x2_prediction_final
        await client.query(`
            CREATE OR REPLACE FUNCTION enforce_insight_rules() RETURNS TRIGGER AS $$
            DECLARE
                sec_record JSONB;
                sec_conf INT;
                sec_market TEXT;
                is_valid_market BOOLEAN;
            BEGIN
                IF NEW.total_confidence <= 58 THEN
                    IF NEW.secondary_insights IS NULL OR jsonb_array_length(NEW.secondary_insights) != 4 THEN
                        RAISE EXCEPTION 'DB_ENFORCEMENT: Extreme Risk (<=58%%) requires EXACTLY 4 secondary insights. Found: %', COALESCE(jsonb_array_length(NEW.secondary_insights), 0);
                    END IF;
                END IF;
                IF NEW.secondary_insights IS NOT NULL AND jsonb_array_length(NEW.secondary_insights) > 4 THEN
                    RAISE EXCEPTION 'DB_ENFORCEMENT: Strict limit of MAXIMUM 4 secondary insights exceeded.';
                END IF;
                IF NEW.secondary_insights IS NOT NULL AND jsonb_array_length(NEW.secondary_insights) > 0 THEN
                    FOR sec_record IN SELECT * FROM jsonb_array_elements(NEW.secondary_insights) LOOP
                        sec_conf := (sec_record->>'confidence')::INT;
                        sec_market := COALESCE(sec_record->>'prediction', sec_record->>'market', sec_record->>'label');
                        IF sec_conf < 76 THEN RAISE EXCEPTION 'DB_ENFORCEMENT: Secondary insight confidence must be >= 76%%. Found % for market %', sec_conf, sec_market; END IF;
                        SELECT EXISTS(SELECT 1 FROM secondary_markets_allowlist WHERE LOWER(REPLACE(market_name, '-', '')) = LOWER(REPLACE(sec_market, '-', '')) OR LOWER(REPLACE(market_name, '_', ' ')) = LOWER(REPLACE(sec_market, '_', ' '))) INTO is_valid_market;
                        IF NOT is_valid_market THEN RAISE EXCEPTION 'DB_ENFORCEMENT: Secondary market "%" is not in the strict allowlist.', sec_market; END IF;
                    END LOOP;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trigger_enforce_insight_rules ON direct1x2_prediction_final;
            CREATE TRIGGER trigger_enforce_insight_rules BEFORE INSERT OR UPDATE ON direct1x2_prediction_final FOR EACH ROW EXECUTE FUNCTION enforce_insight_rules();
        `);

        // Trigger for predictions_final
        await client.query(`
            CREATE OR REPLACE FUNCTION enforce_pf_rules() RETURNS TRIGGER AS $$
            DECLARE
                sec_record JSONB;
                sec_conf INT;
                sec_market TEXT;
                is_valid_market BOOLEAN;
                sec_array JSONB;
            BEGIN
                IF NEW.type = 'direct' THEN
                    sec_array := NEW.matches->0->'metadata'->'secondary_markets';
                    IF NEW.total_confidence <= 58 THEN
                        IF sec_array IS NULL OR jsonb_array_length(sec_array) != 4 THEN RAISE EXCEPTION 'DB_ENFORCEMENT: Extreme Risk (<=58%%) requires EXACTLY 4 secondary insights.'; END IF;
                    END IF;
                    IF sec_array IS NOT NULL AND jsonb_array_length(sec_array) > 4 THEN RAISE EXCEPTION 'DB_ENFORCEMENT: Strict limit of MAXIMUM 4 secondary insights exceeded.'; END IF;
                    IF sec_array IS NOT NULL AND jsonb_array_length(sec_array) > 0 THEN
                        FOR sec_record IN SELECT * FROM jsonb_array_elements(sec_array) LOOP
                            sec_conf := (sec_record->>'confidence')::INT;
                            sec_market := COALESCE(sec_record->>'prediction', sec_record->>'market', sec_record->>'label');
                            IF sec_conf < 76 THEN RAISE EXCEPTION 'DB_ENFORCEMENT: Secondary insight confidence must be >= 76%%. Found %', sec_conf; END IF;
                            SELECT EXISTS(SELECT 1 FROM secondary_markets_allowlist WHERE LOWER(REPLACE(market_name, '-', '')) = LOWER(REPLACE(sec_market, '-', '')) OR LOWER(REPLACE(market_name, '_', ' ')) = LOWER(REPLACE(sec_market, '_', ' '))) INTO is_valid_market;
                            IF NOT is_valid_market THEN RAISE EXCEPTION 'DB_ENFORCEMENT: Secondary market "%" is not in the strict allowlist.', sec_market; END IF;
                        END LOOP;
                    END IF;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trigger_enforce_pf_rules ON predictions_final;
            CREATE TRIGGER trigger_enforce_pf_rules BEFORE INSERT OR UPDATE ON predictions_final FOR EACH ROW EXECUTE FUNCTION enforce_pf_rules();
        `);

        await client.query('COMMIT');
        console.log('✅ DB Governance rules applied to Supabase successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ DB Governance failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

applyGovernance().then(() => process.exit(0));