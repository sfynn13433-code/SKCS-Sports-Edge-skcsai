// /src/services/contextIntelligence/aiPipeline.js
const { createClient } = require('@supabase/supabase-js');
const enrichFixtureWithContextCore = require('./aiPipeline_core');

const SCOUT_FIP_ORIGIN = 'SCOUT_FIP';

// Initialize Supabase (Ensure these are set in your Cloud Run environment variables)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

function isAuthoritativeScoutFipContext(fixture) {
  const origin =
    fixture?.metadata?.sports_truth_origin
    || fixture?.match_info?.sports_truth_origin
    || null;

  return origin === SCOUT_FIP_ORIGIN;
}

function hasSuppliedContextualIntelligence(fixture) {
  const context = fixture?.contextual_intelligence;

  return Boolean(
    context
    && typeof context === 'object'
    && !Array.isArray(context)
    && Object.keys(context).length > 0
  );
}

async function persistFixtureContextCache(fixtureId, contextPayload) {
  if (!supabase || !fixtureId) {
    return;
  }

  try {
    const { error: upsertError } = await supabase
      .from('fixture_context_cache')
      .upsert({
        fixture_id: fixtureId,
        context_payload: contextPayload,
        updated_at: new Date().toISOString()
      }, { onConflict: 'fixture_id' });

    if (upsertError) {
      console.error(
        `[SKCS Edge] Supabase Cache Upsert Failed for ${fixtureId}:`,
        upsertError.message
      );
    }
  } catch (upsertErr) {
    console.error(
      `[SKCS Edge] Supabase Cache Upsert Failed for ${fixtureId}:`,
      upsertErr.message
    );
  }
}

async function getCachedContext(fixture) {
  const fixtureId = fixture?.match_info?.match_id || fixture?.match_id || fixture?.id;
  const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

  if (
    isAuthoritativeScoutFipContext(fixture)
    && hasSuppliedContextualIntelligence(fixture)
  ) {
    return enrichFixtureWithContextCore(fixture);
  }

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
    await persistFixtureContextCache(fixtureId, enrichedData.contextSignals);

    return enrichedData;

  } catch (err) {
    console.error(`[SKCS Edge] Cache Wrapper Error for ${fixtureId || 'unknown'}:`, err.message);
    // Failsafe: If DB drops, run the core pipeline anyway so the app doesn't crash
    return await enrichFixtureWithContextCore(fixture);
  }
}

module.exports = getCachedContext;
module.exports.__test = {
  SCOUT_FIP_ORIGIN,
  isAuthoritativeScoutFipContext,
  hasSuppliedContextualIntelligence,
  persistFixtureContextCache
};
