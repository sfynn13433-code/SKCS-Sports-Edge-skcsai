'use strict';

const STAGE_KEYS = Object.freeze([
    'fetched_count',
    'normalized_count',
    'enriched_count',
    'market_scored_count',
    'post_conflict_count',
    'post_validation_count',
    'candidate_count',
    'published_count',
    'ui_query_count'
]);

const REJECTION_KEYS = Object.freeze([
    'legacy_schema_reject',
    'missing_odds',
    'missing_context',
    'low_confidence',
    'conflict_reject',
    'consistency_reject',
    'weekly_lock_reject',
    'validation_reject',
    'publish_skip',
    'ui_filter_exclude',
    'sport_key_mismatch',
    'plan_id_mismatch',
    'date_window_exclude'
]);

const runs = new Map();
const runOrder = [];
let activeRunId = null;

function nowIso() {
    return new Date().toISOString();
}

function toKey(value, fallback = 'unknown') {
    const raw = String(value || '').trim();
    if (!raw) return fallback;

    const lower = raw.toLowerCase();
    if (lower === 'soccer' || lower === 'football' || lower.startsWith('soccer_')) return 'Football';
    if (lower === 'nba' || lower === 'basketball' || lower.startsWith('basketball_')) return 'Basketball';
    if (lower === 'nfl' || lower === 'american_football' || lower.startsWith('americanfootball_')) return 'NFL';
    if (lower === 'nhl' || lower === 'hockey' || lower.startsWith('icehockey_')) return 'NHL';
    if (lower === 'mlb' || lower === 'baseball' || lower.startsWith('baseball_')) return 'MLB';
    if (lower === 'rugby' || lower.startsWith('rugbyunion_')) return 'Rugby';
    if (lower === 'afl' || lower.startsWith('aussierules_')) return 'AFL';
    if (lower === 'volleyball') return 'Volleyball';
    if (lower === 'handball') return 'Handball';
    if (lower === 'f1' || lower === 'formula1') return 'F1';
    if (lower === 'mma') return 'MMA';
    if (lower === 'golf') return 'Golf';
    if (lower === 'boxing') return 'Boxing';
    if (lower === 'tennis') return 'Tennis';
    if (lower === 'cricket') return 'Cricket';
    if (lower === 'esports') return 'Esports';
    if (lower === 'darts') return 'Darts';

    return raw;
}

function makeStageCounters() {
    return STAGE_KEYS.reduce((acc, key) => {
        acc[key] = 0;
        return acc;
    }, {});
}

function makeRejectionCounters() {
    return REJECTION_KEYS.reduce((acc, key) => {
        acc[key] = 0;
        return acc;
    }, {});
}

function makeSportTracker(sport) {
    return {
        sport: toKey(sport),
        stages: makeStageCounters(),
        rejections: makeRejectionCounters(),
        fallback_metrics: {
            pre_fallback_count: 0,
            post_fallback_count: 0,
            post_validation_after_fallback_count: 0
        },
        sport_normalization_map: {},
        latest_rejections: [],
        updated_at: nowIso()
    };
}

function makeRun(runId, metadata = {}) {
    return {
        run_id: runId,
        started_at: nowIso(),
        ended_at: null,
        status: 'running',
        metadata: { ...metadata },
        sports: {},
        sport_normalization_map: {},
        updated_at: nowIso()
    };
}

function getRun(runId) {
    if (runId && runs.has(runId)) return runs.get(runId);
    if (activeRunId && runs.has(activeRunId)) return runs.get(activeRunId);

    const implicitRunId = `implicit_${Date.now()}`;
    return startRun({ run_id: implicitRunId, implicit: true });
}

function ensureSportTracker(run, sport) {
    const sportKey = toKey(sport);
    if (!run.sports[sportKey]) {
        run.sports[sportKey] = makeSportTracker(sportKey);
    }
    return run.sports[sportKey];
}

function touchRun(run) {
    run.updated_at = nowIso();
}

function stageAdd(options = {}) {
    const stage = toKey(options.stage, '');
    if (!STAGE_KEYS.includes(stage)) return;

    const run = getRun(options.run_id);
    const tracker = ensureSportTracker(run, options.sport);
    const count = Number.isFinite(Number(options.count)) ? Number(options.count) : 1;
    tracker.stages[stage] += count;
    tracker.updated_at = nowIso();
    touchRun(run);
}

function stageSet(options = {}) {
    const stage = toKey(options.stage, '');
    if (!STAGE_KEYS.includes(stage)) return;

    const run = getRun(options.run_id);
    const tracker = ensureSportTracker(run, options.sport);
    const count = Number.isFinite(Number(options.count)) ? Number(options.count) : 0;
    tracker.stages[stage] = count;
    tracker.updated_at = nowIso();
    touchRun(run);
}

function rejectionAdd(options = {}) {
    const bucket = toKey(options.bucket, '');
    if (!REJECTION_KEYS.includes(bucket)) return;

    const run = getRun(options.run_id);
    const tracker = ensureSportTracker(run, options.sport);
    const count = Number.isFinite(Number(options.count)) ? Number(options.count) : 1;
    tracker.rejections[bucket] += count;
    tracker.latest_rejections.push({
        timestamp: nowIso(),
        bucket,
        reason: options.reason || null,
        metadata: options.metadata || null
    });
    if (tracker.latest_rejections.length > 200) {
        tracker.latest_rejections = tracker.latest_rejections.slice(-200);
    }
    tracker.updated_at = nowIso();
    touchRun(run);
}

function recordSportNormalization(options = {}) {
    const run = getRun(options.run_id);
    const sportKey = toKey(options.sport || options.canonical_sport);
    const tracker = ensureSportTracker(run, sportKey);

    const providerSport = toKey(options.provider_sport, 'unknown_provider_sport');
    const canonicalSport = toKey(options.canonical_sport, sportKey);

    if (!tracker.sport_normalization_map[providerSport]) {
        tracker.sport_normalization_map[providerSport] = {};
    }
    tracker.sport_normalization_map[providerSport][canonicalSport] = (
        Number(tracker.sport_normalization_map[providerSport][canonicalSport] || 0) + 1
    );

    if (!run.sport_normalization_map[providerSport]) {
        run.sport_normalization_map[providerSport] = {};
    }
    run.sport_normalization_map[providerSport][canonicalSport] = (
        Number(run.sport_normalization_map[providerSport][canonicalSport] || 0) + 1
    );

    tracker.updated_at = nowIso();
    touchRun(run);
}

function recordFallback(options = {}) {
    const run = getRun(options.run_id);
    const tracker = ensureSportTracker(run, options.sport);
    const preCount = Number.isFinite(Number(options.pre_fallback_count)) ? Number(options.pre_fallback_count) : 0;
    const postCount = Number.isFinite(Number(options.post_fallback_count)) ? Number(options.post_fallback_count) : 0;
    const postValidation = Number.isFinite(Number(options.post_validation_after_fallback_count))
        ? Number(options.post_validation_after_fallback_count)
        : 0;

    tracker.fallback_metrics.pre_fallback_count += preCount;
    tracker.fallback_metrics.post_fallback_count += postCount;
    tracker.fallback_metrics.post_validation_after_fallback_count += postValidation;
    tracker.updated_at = nowIso();
    touchRun(run);
}

function startRun(options = {}) {
    const runId = String(options.run_id || `sync_${Date.now()}`);
    const run = makeRun(runId, options.metadata || {});
    runs.set(runId, run);
    runOrder.push(runId);
    if (runOrder.length > 50) {
        const removed = runOrder.shift();
        if (removed && removed !== runId) runs.delete(removed);
    }
    activeRunId = runId;
    return run;
}

function finishRun(options = {}) {
    const run = getRun(options.run_id);
    run.status = options.status || 'completed';
    run.ended_at = nowIso();
    if (options.metadata && typeof options.metadata === 'object') {
        run.metadata = { ...run.metadata, ...options.metadata };
    }
    touchRun(run);
    return getRunSnapshot(run.run_id);
}

function getRunSnapshot(runId) {
    const run = runId ? runs.get(runId) : getRun(activeRunId);
    if (!run) return null;
    return JSON.parse(JSON.stringify(run));
}

function getLatestRunSnapshot() {
    const latestRunId = runOrder.length ? runOrder[runOrder.length - 1] : null;
    return latestRunId ? getRunSnapshot(latestRunId) : null;
}

function getSportSnapshot(options = {}) {
    const run = getRun(options.run_id);
    const sportKey = toKey(options.sport);
    const tracker = run.sports[sportKey] || makeSportTracker(sportKey);
    return JSON.parse(JSON.stringify(tracker));
}

function getLatestRejections(options = {}) {
    const snapshot = getSportSnapshot(options);
    const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 10;
    return snapshot.latest_rejections.slice(-Math.max(1, limit)).reverse();
}

module.exports = {
    STAGE_KEYS,
    REJECTION_KEYS,
    startRun,
    finishRun,
    stageAdd,
    stageSet,
    rejectionAdd,
    recordSportNormalization,
    recordFallback,
    getRunSnapshot,
    getLatestRunSnapshot,
    getSportSnapshot,
    getLatestRejections
};
