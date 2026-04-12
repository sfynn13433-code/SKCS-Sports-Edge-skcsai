const getWeatherSignal = require('./weatherSignal');
const getAvailabilitySignal = require('./availabilitySignal');
const getDisciplineSignal = require('./disciplineSignal');
const getStabilitySignal = require('./stabilitySignal');
const {
  buildContextCacheKey,
  getFreshContextCache,
  upsertContextCache
} = require('./cacheService');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeFixtureInput(fixture) {
  const kickoffTime =
    fixture.kickoffTime ||
    fixture.kickoff ||
    fixture.date ||
    fixture.match_time ||
    fixture.commence_time ||
    new Date().toISOString();

  const teamDataInput = fixture.teamData || {};
  const disciplineInput = fixture.teamDiscipline || {};
  const contextInput = fixture.teamContext || {};

  return {
    ...fixture,
    location:
      fixture.location ||
      fixture.stadiumLocation ||
      fixture.venue ||
      fixture.city ||
      fixture.metadata?.venue ||
      fixture.metadata?.city ||
      'London',
    kickoffTime: String(kickoffTime),
    fixture_id: fixture.match_id || fixture.fixture_id || fixture.id || null,
    teamData: {
      injuries: ensureArray(teamDataInput.injuries),
      suspensions: ensureArray(teamDataInput.suspensions),
      expectedXI: {
        reliability: Number(teamDataInput.expectedXI?.reliability)
      }
    },
    teamDiscipline: {
      redCards: {
        last5Games: Number(disciplineInput.redCards?.last5Games) || 0
      },
      yellowCardThreats: ensureArray(disciplineInput.yellowCardThreats),
      bans: ensureArray(disciplineInput.bans)
    },
    teamContext: {
      coachConflict: Boolean(contextInput.coachConflict),
      execInstability: Boolean(contextInput.execInstability),
      playerLegalIssues: ensureArray(contextInput.playerLegalIssues),
      fanViolence: Boolean(contextInput.fanViolence)
    }
  };
}

function normalizeSignalOutput(signal, key) {
  const value = Number(signal?.[key]);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function buildEmptyContextPayload(cacheKey) {
  const nowIso = new Date().toISOString();
  return {
    contextSignals: {
      weather_risk: 0,
      availability_risk: 0,
      discipline_risk: 0,
      stability_risk: 0
    },
    contextInsights: {
      weather: { status: 'unavailable' },
      availability: { keyAbsences: 0, squadAbsences: 0, reliability: 1 },
      discipline: { bans: [], yellowCardThreats: [] },
      stability: { coachConflict: false, execInstability: false, playerLegalIssues: [], fanViolence: false }
    },
    context_status: 'fallback',
    context_last_verified: nowIso,
    context_cache_key: cacheKey || null
  };
}

async function enrichFixtureWithContext(fixture) {
  const normalized = normalizeFixtureInput(fixture || {});
  const cacheKey = buildContextCacheKey(normalized);

  try {
    const cached = await getFreshContextCache(cacheKey);
    if (cached?.payload) {
      return {
        ...fixture,
        contextSignals: cached.payload.contextSignals || {},
        contextInsights: cached.payload.contextInsights || {},
        context_status: 'cached',
        context_last_verified: cached.last_verified || cached.payload.context_last_verified || null,
        context_cache_key: cacheKey
      };
    }
  } catch (err) {
    console.warn('[SKCS Edge] Context cache read failed:', err.message);
  }

  try {
    const weather = await getWeatherSignal(normalized.location, normalized.kickoffTime);
    const availability = getAvailabilitySignal({
      injuries: normalized.teamData.injuries,
      suspensions: normalized.teamData.suspensions,
      expectedXI: {
        reliability: Number.isFinite(normalized.teamData.expectedXI.reliability)
          ? normalized.teamData.expectedXI.reliability
          : 1
      }
    });
    const discipline = getDisciplineSignal(normalized.teamDiscipline);
    const stability = getStabilitySignal(normalized.teamContext);

    const contextSignals = {
      weather_risk: normalizeSignalOutput(weather, 'weather_risk'),
      availability_risk: normalizeSignalOutput(availability, 'availability_risk'),
      discipline_risk: normalizeSignalOutput(discipline, 'discipline_risk'),
      stability_risk: normalizeSignalOutput(stability, 'stability_risk')
    };

    const contextInsights = {
      weather: weather.meta || { status: 'unknown' },
      availability: availability.meta || {},
      discipline: discipline.meta || {},
      stability: stability.meta || {}
    };

    const context_last_verified = new Date().toISOString();
    const cachePayload = {
      contextSignals,
      contextInsights,
      context_status: 'enriched',
      context_last_verified
    };

    try {
      await upsertContextCache(cacheKey, normalized.fixture_id, cachePayload);
    } catch (err) {
      console.warn('[SKCS Edge] Context cache write failed:', err.message);
    }

    return {
      ...fixture,
      contextSignals,
      contextInsights,
      context_status: 'enriched',
      context_last_verified,
      context_cache_key: cacheKey
    };
  } catch (error) {
    console.warn('[SKCS Edge] Context enrich failed:', error.message);
    return {
      ...fixture,
      ...buildEmptyContextPayload(cacheKey),
      context_status: 'failed'
    };
  }
}
module.exports = enrichFixtureWithContext;
