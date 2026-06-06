'use strict';

const CANONICAL_STATUS = Object.freeze({
    FINAL: 'Final',
    LIVE: 'InProgress',
    BREAK: 'Break',
    POSTPONED: 'Postponed',
    SCHEDULED: 'Scheduled',
    UNKNOWN: 'Unknown'
});

const STATUS_ALIASES = Object.freeze({
    final: CANONICAL_STATUS.FINAL,
    ft: CANONICAL_STATUS.FINAL,
    fulltime: CANONICAL_STATUS.FINAL,
    complete: CANONICAL_STATUS.FINAL,
    completed: CANONICAL_STATUS.FINAL,
    ended: CANONICAL_STATUS.FINAL,
    closed: CANONICAL_STATUS.FINAL,

    inprogress: CANONICAL_STATUS.LIVE,
    live: CANONICAL_STATUS.LIVE,
    playing: CANONICAL_STATUS.LIVE,
    ongoing: CANONICAL_STATUS.LIVE,
    '1h': CANONICAL_STATUS.LIVE,
    '2h': CANONICAL_STATUS.LIVE,

    break: CANONICAL_STATUS.BREAK,
    ht: CANONICAL_STATUS.BREAK,
    halftime: CANONICAL_STATUS.BREAK,
    'half-time': CANONICAL_STATUS.BREAK,
    period1: CANONICAL_STATUS.BREAK,

    postponed: CANONICAL_STATUS.POSTPONED,
    cancelled: CANONICAL_STATUS.POSTPONED,
    canceled: CANONICAL_STATUS.POSTPONED,
    suspended: CANONICAL_STATUS.POSTPONED,
    awarded: CANONICAL_STATUS.FINAL,

    scheduled: CANONICAL_STATUS.SCHEDULED,
    ns: CANONICAL_STATUS.SCHEDULED,
    tbd: CANONICAL_STATUS.SCHEDULED,
    'not started': CANONICAL_STATUS.SCHEDULED,
    upcoming: CANONICAL_STATUS.SCHEDULED,
    pregame: CANONICAL_STATUS.SCHEDULED,
    delayed: CANONICAL_STATUS.SCHEDULED
});

const CONTEXT_POLICY = Object.freeze({
    injuries: true,
    h2h: true,
    weather: false,
    news: false
});

const CANONICAL_ID_FIELDS = Object.freeze([
    'GameId',
    'gameId',
    'game_id',
    'match_id',
    'fixture_id',
    'provider_game_id'
]);

const STATUS_FIELDS = Object.freeze([
    'status',
    'gameStatus',
    'state',
    'liveStatus',
    'period',
    'statusText',
    'shortStatusText'
]);

function normalizeStatus(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return CANONICAL_STATUS.UNKNOWN;
    if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
    if (key.includes('final')) return CANONICAL_STATUS.FINAL;
    if (key.includes('half') || key === 'break' || key === 'ht') return CANONICAL_STATUS.BREAK;
    if (key.includes('live') || key.includes('progress') || key.includes('inprogress')) return CANONICAL_STATUS.LIVE;
    if (key.includes('postpon') || key.includes('cancel') || key.includes('suspend')) return CANONICAL_STATUS.POSTPONED;
    return CANONICAL_STATUS.UNKNOWN;
}

function normalizePeriodState(value) {
    const normalized = normalizeStatus(value);
    if (normalized === CANONICAL_STATUS.BREAK) {
        return 'Period1';
    }
    if (normalized === CANONICAL_STATUS.FINAL) {
        return 'Final';
    }
    if (normalized === CANONICAL_STATUS.LIVE) {
        return 'Live';
    }
    if (normalized === CANONICAL_STATUS.POSTPONED) {
        return 'Postponed';
    }
    return 'Unknown';
}

function isContextAllowed(key) {
    return CONTEXT_POLICY[String(key || '').trim().toLowerCase()] === true;
}

module.exports = {
    CANONICAL_ID_FIELDS,
    CANONICAL_STATUS,
    CONTEXT_POLICY,
    STATUS_FIELDS,
    STATUS_ALIASES,
    isContextAllowed,
    normalizePeriodState,
    normalizeStatus
};
