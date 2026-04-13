// /src/services/contextIntelligence/aiPipeline.js
const { createClient } = require('@supabase/supabase-js');
const enrichFixtureWithContextCore = require('./aiPipeline_core');

// Initialize Supabase (Ensure these are set in your Cloud Run environment variables)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

async function getCachedContext(fixture) {
  const fixtureId = fixture?.match_info?.match_id || fixture?.match_id || fixture?.id;
  const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

  try {
    if (!supabase || !fixtureId) {
      return await enrichFixtureWithContextCore(fixture);
    }

    // 1. Check Supabase for existing, unexpired context
    const { data, error } = await supabase
      .from('fixture_context_cache')
      .select('context_payload, updated_at')
      .eq('fixture_id', fixtureId)
      .single();

    if (!error && data) {
      const lastUpdated = new Date(data.updated_at).getTime();
      const now = Date.now();

      // If cache is valid, return it immediately and skip external APIs
      if (now - lastUpdated < CACHE_TTL_MS) {
        return {
          ...fixture,
          contextSignals: data.context_payload,
          context_status: 'cached'
        };
      }
    }

    // 2. Cache Miss or Expired: Fetch fresh data using the core pipeline
    const enrichedData = await enrichFixtureWithContextCore(fixture);

    // 3. Upsert the fresh data back into Supabase for the next user
    const { error: upsertError } = await supabase
      .from('fixture_context_cache')
      .upsert({
        fixture_id: fixtureId,
        context_payload: enrichedData.contextSignals,
        updated_at: new Date().toISOString()
      }, { onConflict: 'fixture_id' });

    if (upsertError) {
      console.error(`[SKCS Edge] Supabase Cache Upsert Failed for ${fixtureId}:`, upsertError.message);
    }

    return enrichedData;

  } catch (err) {
    console.error(`[SKCS Edge] Cache Wrapper Error for ${fixtureId || 'unknown'}:`, err.message);
    // Failsafe: If DB drops, run the core pipeline anyway so the app doesn't crash
    return await enrichFixtureWithContextCore(fixture);
  }
}

module.exports = getCachedContext;
