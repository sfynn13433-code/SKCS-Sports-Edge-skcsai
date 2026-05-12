-- Create upsert_raw_fixture RPC function for idempotent fixture insertion
CREATE OR REPLACE FUNCTION upsert_raw_fixture(
    p_id_event TEXT,
    p_sport TEXT,
    p_league_id TEXT,
    p_home_team_id TEXT,
    p_away_team_id TEXT,
    p_start_time TIMESTAMPTZ,
    p_raw_json JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE(
    action TEXT,
    id_event TEXT,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    v_existing_count INTEGER;
    v_action TEXT;
BEGIN
    -- Check if fixture exists
    SELECT COUNT(*) INTO v_existing_count
    FROM raw_fixtures
    WHERE id_event = p_id_event;
    
    IF v_existing_count = 0 THEN
        -- Insert new fixture
        INSERT INTO raw_fixtures (
            id_event,
            sport,
            league_id,
            home_team_id,
            away_team_id,
            start_time,
            raw_json,
            updated_at
        ) VALUES (
            p_id_event,
            p_sport,
            p_league_id,
            p_home_team_id,
            p_away_team_id,
            p_start_time,
            p_raw_json,
            NOW()
        );
        v_action := 'INSERTED';
        
        -- Trigger context enrichment for new fixture
        PERFORM pg_notify('context_enrichment_request', 
            json_build_object(
                'id_event', p_id_event,
                'sport', p_sport,
                'action', 'enrich'
            )::text
        );
        
    ELSE
        -- Update existing fixture (preserve created_at, update payload)
        UPDATE raw_fixtures
        SET 
            sport = p_sport,
            league_id = p_league_id,
            home_team_id = p_home_team_id,
            away_team_id = p_away_team_id,
            start_time = p_start_time,
            raw_json = p_raw_json,
            updated_at = NOW()
        WHERE id_event = p_id_event;
        v_action := 'UPDATED';
        
        -- Trigger context enrichment for updated fixture
        PERFORM pg_notify('context_enrichment_request', 
            json_build_object(
                'id_event', p_id_event,
                'sport', p_sport,
                'action', 'update'
            )::text
        );
    END IF;
    
    -- Return result
    RETURN QUERY
    SELECT 
        v_action,
        p_id_event,
        COALESCE(updated_at, NOW()) as created_at
    FROM raw_fixtures
    WHERE id_event = p_id_event;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in upsert_raw_fixture for %: %', p_id_event, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION upsert_raw_fixture TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_raw_fixture TO service_role;

-- Create helper function for batch upserts
CREATE OR REPLACE FUNCTION upsert_raw_fixtures_batch(
    p_fixtures JSONB
)
RETURNS TABLE(
    action TEXT,
    id_event TEXT,
    created_at TIMESTAMPTZ,
    error_message TEXT
) AS $$
DECLARE
    v_fixture JSONB;
    v_result RECORD;
BEGIN
    -- Process each fixture in the batch
    FOR v_fixture IN SELECT * FROM jsonb_array_elements(p_fixtures)
    LOOP
        BEGIN
            -- Call single upsert for each fixture
            SELECT * INTO v_result
            FROM upsert_raw_fixture(
                v_fixture->>'id_event',
                v_fixture->>'sport',
                v_fixture->>'league_id',
                v_fixture->>'home_team_id',
                v_fixture->>'away_team_id',
                (v_fixture->>'start_time')::TIMESTAMPTZ,
                v_fixture->'raw_json'
            );
            
            RETURN QUERY
            SELECT 
                v_result.action,
                v_result.id_event,
                v_result.created_at,
                NULL::TEXT as error_message;
                
        EXCEPTION
            WHEN OTHERS THEN
                RETURN QUERY
                SELECT 
                    'ERROR' as action,
                    v_fixture->>'id_event' as id_event,
                    NULL::TIMESTAMPTZ as created_at,
                    SQLERRM as error_message;
        END;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions for batch function
GRANT EXECUTE ON FUNCTION upsert_raw_fixtures_batch TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_raw_fixtures_batch TO service_role;
