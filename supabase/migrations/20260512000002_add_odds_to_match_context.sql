-- Add odds JSONB column to match_context_data table for storing structured odds data
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'match_context_data'
    ) THEN
        ALTER TABLE match_context_data 
        ADD COLUMN IF NOT EXISTS odds JSONB DEFAULT '{}'::JSONB;
        
        -- Create GIN index for efficient JSONB queries on odds data
        CREATE INDEX IF NOT EXISTS idx_match_context_odds_gin 
        ON match_context_data USING GIN (odds);
        
        -- Create partial index for fixtures that have odds data
        CREATE INDEX IF NOT EXISTS idx_match_context_odds_not_null 
        ON match_context_data (id_event) 
        WHERE odds IS NOT NULL AND odds != '{}'::JSONB;
        
        RAISE NOTICE 'Added odds JSONB column to match_context_data table';
    ELSE
        RAISE WARNING 'match_context_data table does not exist - skipping odds column addition';
    END IF;
END
$$;

-- Add comment to document the odds column structure
COMMENT ON COLUMN match_context_data.odds IS 'Structured odds data from multiple bookmakers. Format: {"bookmaker_key": {"market": {"home": X.XX, "draw": X.XX, "away": X.XX}, "over_under": {"2.5": {"over": X.XX, "under": X.XX}}}';
