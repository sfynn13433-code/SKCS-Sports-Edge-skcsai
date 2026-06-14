// config.js
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

module.exports = {
    DATA_MODE: process.env.DATA_MODE || 'live',
    BYPASS_PIPELINE_FILTERS: process.env.BYPASS_PIPELINE_FILTERS === 'true' || false,
    REQUIRE_SHARP_ODDS: process.env.REQUIRE_SHARP_ODDS === 'true' || false,
    // Feature flag for dual-read transitional mode (read from relational tables with JSONB fallback)
    USE_RELATIONAL_TABLES: process.env.USE_RELATIONAL_TABLES === 'true' || false,
    database: {
        url: process.env.DATABASE_URL,
    },
    supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
    },
    // Original RapidAPI key – used for other RapidAPI services
    rapidApiKey: process.env.RAPIDAPI_KEY,
    
    // Dedicated API‑Sports key – used ONLY for sports data
    apiSportsKey: process.env.X_APISPORTS_KEY,
    
    oddsApiKey: process.env.ODDS_API_KEY,
    sportsOddsApiKey: process.env.SPORTS_ODDS_API_KEY,
    // Provider-specific keys with legacy fallback to SPORTS_DB_KEY.
    theSportsDbKey: process.env.THESPORTSDB_KEY || process.env.SPORTS_DB_KEY,
    sportsDataIoKey: process.env.SPORTSDATA_IO_KEY || process.env.SPORTS_DB_KEY,
    // Legacy shared key kept for backward compatibility during migration.
    sportsDbKey: process.env.SPORTS_DB_KEY,
    sportsDataOrgToken: process.env.X_AUTH_TOKEN,
    cricketDataApiKey: process.env.CRICKETDATA_API_KEY,
    bzzoiroApiToken: process.env.BZZOIRO_API_TOKEN,
    bigBallsDataApiKey: process.env.BIG_BALLS_DATA_API_KEY || process.env.BBS_API_KEY,
    bigBallsBaseUrl: process.env.BIG_BALLS_BASE_URL,
    soccerDataApiKey: process.env.SOCCER_DATA_API_KEY || process.env.SOCCERDATA_API_TOKEN,
    soccerDataBaseUrl: process.env.SOCCER_DATA_BASE_URL,
    newsApi: {
        apiKey: process.env.NEWSAPI_KEY,
        dailyLimit: Number(process.env.NEWSAPI_DAILY_CALL_LIMIT) || 95,
    },
    
    // SportSRC API key for Provider Health Layer & Data Ingestion
    sportSrcApiKey: process.env.SPORTSRC_API_KEY,
    
    // AI Providers for EdgeMind insights (priority: Groq > Dolphin > Template)
    groq: {
        apiKey: process.env.GROQ_API_KEY || process.env.GROQ_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        timeout: 30000,
    },
    // Local Dolphin/Llama AI server (fallback when Groq unavailable)
    dolphin: {
        url: process.env.DOLPHIN_URL || 'http://127.0.0.1:8080',
        timeout: Number(process.env.DOLPHIN_TIMEOUT) || 120000,
        maxTokens: Number(process.env.DOLPHIN_MAX_TOKENS) || 512,
        temperature: Number(process.env.DOLPHIN_TEMPERATURE) || 0.3,
    },
    
    maxPredictionsPerDay: 500,
    deepTierConfidenceThreshold: 75,
    jwtSecret: process.env.JWT_SECRET,
    tiers: {
        normal4:  { daily: 50,  deep: false },
        normal9:  { daily: 100, deep: false },
        normal14: { daily: 150, deep: false },
        normal30: { daily: 300, deep: false },
        deep4:    { daily: 75,  deep: true },
        deep9:    { daily: 150, deep: true },
        deep14:   { daily: 225, deep: true },
        deep30:   { daily: 500, deep: true }
    }
};
