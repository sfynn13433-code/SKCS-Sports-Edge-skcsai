'use strict';

const { getQuotaState } = require('./providerQuotaService');

const SAFE_BUFFER = 0.1;

function normalizeSport(value) {
    return String(value || '').trim().toLowerCase();
}

async function buildFootballPlan(options = {}) {
    const state = await getQuotaState('api_sports_football');

    if (!state) {
        return {
            allowed: false,
            reason: 'NO_PROVIDER_STATE',
            remainingCalls: 0,
            leaguesAllowed: [],
            fallbackOnly: true,
            strategy: 'fallback-only'
        };
    }

    const dailyLimit = state.dailyLimit == null ? null : Number(state.dailyLimit);
    const perMinuteLimit = state.perMinuteLimit == null ? null : Number(state.perMinuteLimit);

    if (state.exhaustedToday || (dailyLimit !== null && state.remainingToday <= 0)) {
        return {
            allowed: false,
            reason: 'DAILY_CAP_EXHAUSTED',
            remainingCalls: 0,
            leaguesAllowed: [],
            fallbackOnly: true,
            strategy: 'fallback-only',
            rawState: state
        };
    }

    if (state.exhaustedPerMinute || (perMinuteLimit !== null && state.remainingPerMinute <= 0)) {
        return {
            allowed: false,
            reason: 'MINUTE_CAP_EXHAUSTED',
            remainingCalls: 0,
            leaguesAllowed: [],
            fallbackOnly: true,
            strategy: 'fallback-only',
            rawState: state
        };
    }

    const leagues = Array.isArray(options.leagues) ? options.leagues.filter(Boolean) : [];
    if (leagues.length === 0) {
        return {
            allowed: false,
            reason: 'NO_LEAGUES_CONFIGURED',
            remainingCalls: 0,
            leaguesAllowed: [],
            fallbackOnly: true,
            strategy: 'fallback-only',
            rawState: state
        };
    }

    const remainingToday = state.remainingToday == null ? Number.MAX_SAFE_INTEGER : state.remainingToday;
    const usableCalls = Math.max(0, Math.floor(remainingToday * (1 - SAFE_BUFFER)));
    const callsPerLeague = Math.max(1, Number(options.callsPerLeague) || 1);
    const minRequiredCalls = Math.max(1, Number(options.minRequiredCalls) || 1);
    const maxLeagues = Math.floor(usableCalls / callsPerLeague);
    const leaguesAllowed = leagues.slice(0, maxLeagues);
    const fallbackOnly = leaguesAllowed.length === 0 || usableCalls < minRequiredCalls;

    return {
        allowed: !fallbackOnly,
        reason: fallbackOnly ? 'INSUFFICIENT_BUDGET' : null,
        strategy: fallbackOnly ? 'fallback-only' : 'api-sports-primary',
        remainingCalls: state.remainingToday == null ? null : state.remainingToday,
        remainingPerMinute: state.remainingPerMinute,
        usableCalls,
        leaguesAllowed,
        fallbackOnly,
        rawState: state
    };
}

async function buildPlan(options = {}) {
    const sports = Array.isArray(options.sports)
        ? options.sports.map(normalizeSport).filter(Boolean)
        : [];

    const plan = {};

    if (sports.length === 0 || sports.includes('football')) {
        plan.football = await buildFootballPlan(options.football || {});
    }

    return plan;
}

module.exports = {
    buildPlan,
    buildFootballPlan
};
