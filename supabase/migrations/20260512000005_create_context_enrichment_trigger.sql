-- Create trigger for automatic context enrichment
-- This trigger listens for NOTIFY events from upsert_raw_fixture

-- Create function to handle context enrichment requests
CREATE OR REPLACE FUNCTION handle_context_enrichment()
RETURNS TRIGGER AS $$
DECLARE
    v_id_event TEXT;
    v_sport TEXT;
    v_action TEXT;
BEGIN
    -- Parse the NOTIFY payload
    v_id_event := TG_ARGV[0];
    v_sport := TG_ARGV[1];
    v_action := TG_ARGV[2];

    -- Check if context already exists and is fresh (within last 3 hours)
    IF EXISTS (
        SELECT 1 
        FROM match_context_data mcd
        JOIN context_intelligence_cache cic ON mcd.id_event = cic.fixture_id
        WHERE mcd.id_event = v_id_event
          AND cic.expires_at > NOW()
    ) THEN
        -- Context is fresh, skip enrichment
        RETURN NULL;
    END IF;

    -- Insert or update context enrichment job
    INSERT INTO context_enrichment_queue (
        id_event,
        sport,
        action,
        status,
        created_at,
        priority
    ) VALUES (
        v_id_event,
        v_sport,
        v_action,
        'pending',
        NOW(),
        CASE 
            WHEN v_action = 'enrich' THEN 1
            WHEN v_action = 'update' THEN 2
            ELSE 3
        END
    ) ON CONFLICT (id_event) 
    DO UPDATE SET 
        action = EXCLUDED.action,
        status = 'pending',
        created_at = NOW(),
        priority = EXCLUDED.priority;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create context_enrichment_queue table if it doesn't exist
CREATE TABLE IF NOT EXISTS context_enrichment_queue (
    id SERIAL PRIMARY KEY,
    id_event TEXT NOT NULL UNIQUE,
    sport TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('enrich', 'update')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5)
);

-- Create indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_context_queue_status ON context_enrichment_queue(status, priority);
CREATE INDEX IF NOT EXISTS idx_context_queue_created ON context_enrichment_queue(created_at);

-- Create trigger for context enrichment (this will be called by application code)
-- Note: PostgreSQL triggers can't directly listen to NOTIFY, so we'll handle this in the application layer
