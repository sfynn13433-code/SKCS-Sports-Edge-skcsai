'use strict';

/**
 * SKCS Canonical Ingest Firewall — Phase -0.5
 * @see docs/canonical_ingest_firewall.spec.md
 */

const CANONICAL_FOOTBALL_PROVIDER = 'api-sports';

const REJECT = Object.freeze({
    INVALID_PROVIDER: 'invalid_provider',
    MISSING_PAYLOAD: 'missing_payload',
    MISSING_FIXTURE_ID: 'missing_fixture_id',
    MISSING_HOME_TEAM_ID: 'missing_home_team_id',
    MISSING_AWAY_TEAM_ID: 'missing_away_team_id',
    MISSING_GOALS: 'missing_goals',
    ODDS_API_SHAPE: 'odds_api_shape',
    NORMALIZED_WRAPPER: 'normalized_wrapper_without_apisports_core'
});

const ALLOWED_CANONICAL_PROVIDERS = new Set([CANONICAL_FOOTBALL_PROVIDER]);

function normalizeProviderKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/_+/g, '-');
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pickId(value) {
    if (value === null || typeof value === 'undefined') return null;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
    const s = String(value).trim();
    return s || null;
}

/**
 * True when payload looks like Odds API event (must NOT enter canonical).
 */
function isOddsApiEventShape(payload) {
    if (!isObject(payload)) return false;
    if (isObject(payload.fixture) && isObject(payload.teams)) return false;
    return Boolean(
        payload.bookmakers
        || payload.sport_key
        || (payload.home_team && payload.away_team && !payload.teams)
    );
}

/**
 * True when payload is API-Sports football fixture response element.
 */
function isApiSportsFixtureShape(payload) {
    if (!isObject(payload)) return false;
    if (isOddsApiEventShape(payload)) return false;

    const fixtureId = pickId(payload.fixture?.id);
    const homeId = pickId(payload.teams?.home?.id);
    const awayId = pickId(payload.teams?.away?.id);

    return Boolean(fixtureId && homeId && awayId);
}

function resolveCanonicalPayload(item) {
    if (!item) return null;

    if (isApiSportsFixtureShape(item)) {
        return item;
    }

    const raw = item.raw_provider_data;
    if (isApiSportsFixtureShape(raw)) {
        return raw;
    }

    if (isObject(raw) && isApiSportsFixtureShape(raw.fixture ? raw : null)) {
        return raw;
    }

    return raw || item;
}

function resolveProviderFromItem(item) {
    const explicit = normalizeProviderKey(item?.provider || item?.provider_name);
    if (ALLOWED_CANONICAL_PROVIDERS.has(explicit)) {
        return CANONICAL_FOOTBALL_PROVIDER;
    }

    const payload = resolveCanonicalPayload(item);
    if (isApiSportsFixtureShape(payload)) {
        return CANONICAL_FOOTBALL_PROVIDER;
    }

    return explicit || 'unknown';
}

function hasGoals(payload) {
    if (!isObject(payload?.goals)) return false;
    const home = payload.goals.home;
    const away = payload.goals.away;
    return home !== null && home !== undefined && away !== null && away !== undefined
        && String(home).trim() !== '' && String(away).trim() !== '';
}

/**
 * @param {object} payload - API-Sports fixture element
 * @param {{ requireGoals?: boolean }} [options]
 * @returns {{ accept: boolean, reason: string|null, fixtureId: string|null, homeTeamId: string|null, awayTeamId: string|null }}
 */
function validateCanonicalPayload(payload, options = {}) {
    const requireGoals = Boolean(options.requireGoals);

    if (!isObject(payload)) {
        return { accept: false, reason: REJECT.MISSING_PAYLOAD, fixtureId: null, homeTeamId: null, awayTeamId: null };
    }

    if (isOddsApiEventShape(payload)) {
        return { accept: false, reason: REJECT.ODDS_API_SHAPE, fixtureId: null, homeTeamId: null, awayTeamId: null };
    }

    const fixtureId = pickId(payload.fixture?.id);
    const homeTeamId = pickId(payload.teams?.home?.id);
    const awayTeamId = pickId(payload.teams?.away?.id);

    if (!fixtureId) {
        return { accept: false, reason: REJECT.MISSING_FIXTURE_ID, fixtureId: null, homeTeamId, awayTeamId };
    }
    if (!homeTeamId) {
        return { accept: false, reason: REJECT.MISSING_HOME_TEAM_ID, fixtureId, homeTeamId: null, awayTeamId };
    }
    if (!awayTeamId) {
        return { accept: false, reason: REJECT.MISSING_AWAY_TEAM_ID, fixtureId, homeTeamId, awayTeamId: null };
    }

    if (requireGoals && !hasGoals(payload)) {
        return { accept: false, reason: REJECT.MISSING_GOALS, fixtureId, homeTeamId, awayTeamId };
    }

    return { accept: true, reason: null, fixtureId, homeTeamId, awayTeamId };
}

function isAllowedCanonicalProvider(provider) {
    return ALLOWED_CANONICAL_PROVIDERS.has(normalizeProviderKey(provider));
}

/**
 * Gate a row before football_canonical_events upsert.
 * @param {object} item - sync row (raw or normalized)
 * @param {{ requireGoals?: boolean, sport?: string }} [options]
 */
function evaluateCanonicalIngest(item, options = {}) {
    const sportKey = String(options.sport || item?.sport || '').toLowerCase();
    const footballLike = !sportKey || sportKey === 'football' || sportKey === 'soccer' || sportKey.startsWith('soccer');

    if (!footballLike) {
        return {
            accept: false,
            reason: REJECT.INVALID_PROVIDER,
            provider: resolveProviderFromItem(item),
            payload: null
        };
    }

    const provider = resolveProviderFromItem(item);
    if (!isAllowedCanonicalProvider(provider)) {
        return {
            accept: false,
            reason: REJECT.INVALID_PROVIDER,
            provider,
            payload: resolveCanonicalPayload(item)
        };
    }

    const payload = resolveCanonicalPayload(item);
    const verdict = validateCanonicalPayload(payload, options);

    return {
        accept: verdict.accept,
        reason: verdict.reason,
        provider: CANONICAL_FOOTBALL_PROVIDER,
        payload,
        fixtureId: verdict.fixtureId,
        homeTeamId: verdict.homeTeamId,
        awayTeamId: verdict.awayTeamId
    };
}

function createEmptyFirewallStats() {
    return {
        accepted: 0,
        rejected: 0,
        byReason: {}
    };
}

function recordFirewallRejection(stats, reason) {
    stats.rejected += 1;
    const key = reason || 'unknown';
    stats.byReason[key] = (stats.byReason[key] || 0) + 1;
}

function recordFirewallAccept(stats) {
    stats.accepted += 1;
}

module.exports = {
    CANONICAL_FOOTBALL_PROVIDER,
    REJECT,
    ALLOWED_CANONICAL_PROVIDERS,
    normalizeProviderKey,
    isOddsApiEventShape,
    isApiSportsFixtureShape,
    resolveCanonicalPayload,
    validateCanonicalPayload,
    isAllowedCanonicalProvider,
    evaluateCanonicalIngest,
    createEmptyFirewallStats,
    recordFirewallRejection,
    recordFirewallAccept,
    hasGoals
};
