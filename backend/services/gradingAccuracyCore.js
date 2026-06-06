'use strict';

const ACCURACY_ROW_QUALITY_SQL = `
    pa.prediction_final_id IS NOT NULL
    AND (
        EXISTS (SELECT 1 FROM direct1x2_prediction_final pf0 WHERE pf0.id = pa.prediction_final_id)
        OR pa.resolution_status IN ('won', 'lost', 'void', 'unsupported')
    )
    AND NULLIF(TRIM(pa.home_team), '') IS NOT NULL
    AND NULLIF(TRIM(pa.away_team), '') IS NOT NULL
    AND LOWER(TRIM(pa.home_team)) NOT IN ('unknown', 'unknown home', 'unknown away', 'home team', 'away team', 'tbd', 'n/a')
    AND LOWER(TRIM(pa.away_team)) NOT IN ('unknown', 'unknown home', 'unknown away', 'home team', 'away team', 'tbd', 'n/a')
`;

const PUBLISHED_ROW_QUALITY_SQL = `
    pf.home_team IS NOT NULL
    AND pf.away_team IS NOT NULL
    AND LOWER(pf.home_team) NOT IN ('unknown', 'unknown home', 'unknown away', 'home team', 'away team', 'tbd', 'n/a')
    AND LOWER(pf.away_team) NOT IN ('unknown', 'unknown home', 'unknown away', 'home team', 'away team', 'tbd', 'n/a')
    AND COALESCE(pf.sport, 'Football') <> 'unknown'
`;

function startOfWeekUtc(now = new Date()) {
    const current = new Date(now);
    const day = current.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    current.setUTCDate(current.getUTCDate() + diffToMonday);
    current.setUTCHours(0, 0, 0, 0);
    return current;
}

function formatWeekKey(date) {
    const year = date.getUTCFullYear();
    const week = getWeekNumber(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function normalizeTierKey(value) {
    const key = String(value || '').trim().toLowerCase();
    return key === 'deep' || key === 'elite' ? 'elite' : 'core';
}

function normalizeTypeKey(value) {
    const key = String(value || '').trim().toLowerCase();
    if (key === 'same_match') return 'same_match';
    if (key === 'secondary') return 'secondary';
    if (key === 'multi') return 'multi';
    if (key === 'mega_acca_12' || key === 'acca_6match' || key === 'acca') return 'acca';
    return 'direct';
}

function humanizeTypeKey(key) {
    const labels = {
        direct: 'Direct Markets (1X2)',
        secondary: 'Analytical Insights',
        multi: 'Double Chance & Specials',
        same_match: 'Same Match',
        acca: 'ACCA'
    };
    return labels[key] || String(key || 'Unknown');
}

function buildEmptyStats() {
    return { wins: 0, losses: 0, graded: 0, pending: 0, void: 0, unsupported: 0, winRate: 0 };
}

function finalizeStats(stats) {
    const graded = Number(stats.graded) || 0;
    const wins = Number(stats.wins) || 0;
    return {
        ...stats,
        winRate: graded > 0 ? Math.round((wins / graded) * 100) : 0
    };
}

function determineProductStatus(rows) {
    if (rows.some((row) => row.resolution_status === 'lost')) return 'lost';
    if (rows.length > 0 && rows.every((row) => row.resolution_status === 'won')) return 'won';
    if (rows.some((row) => row.resolution_status === 'void')) return 'void';
    if (rows.some((row) => row.resolution_status === 'unsupported')) return 'unsupported';
    return 'pending';
}

function normalizeTeamKey(value) {
    return String(value || '').trim().toLowerCase();
}

function buildFixtureKey(row) {
    if (row?.event_id) {
        return `event:${row.event_id}`;
    }
    const home = normalizeTeamKey(row?.home_team);
    const away = normalizeTeamKey(row?.away_team);
    const fixtureDate = String(row?.fixture_date || '').slice(0, 10);
    return `teams:${home}|${away}|${fixtureDate}`;
}

function buildAccuracyDedupKey(row) {
    const fixtureKey = buildFixtureKey(row);
    const tierKey = normalizeTierKey(row?.prediction_tier);
    const typeKey = normalizeTypeKey(row?.prediction_type);
    const market = String(row?.market || '1X2').trim().toLowerCase();
    const outcome = String(row?.predicted_outcome || '').trim().toLowerCase();
    const matchIndex = Number.isFinite(Number(row?.prediction_match_index))
        ? Number(row.prediction_match_index)
        : 0;
    return `${fixtureKey}|${tierKey}|${typeKey}|${market}|${outcome}|${matchIndex}`;
}

function deduplicateAccuracyRows(accuracyRows = []) {
    const map = new Map();

    for (const row of accuracyRows) {
        const key = buildAccuracyDedupKey(row);
        const existing = map.get(key);
        if (!existing) {
            map.set(key, row);
            continue;
        }

        const existingTime = new Date(existing.evaluated_at || 0).getTime();
        const rowTime = new Date(row.evaluated_at || 0).getTime();
        const existingId = Number(existing.id || existing.prediction_final_id || 0);
        const rowId = Number(row.id || row.prediction_final_id || 0);

        if (rowTime > existingTime || (rowTime === existingTime && rowId > existingId)) {
            map.set(key, row);
        }
    }

    return Array.from(map.values());
}

function countUniqueFixtures(accuracyRows = []) {
    return new Set(accuracyRows.map((row) => buildFixtureKey(row))).size;
}

function aggregateAccuracyRows(accuracyRows, options = {}) {
    const rawRowCount = Array.isArray(accuracyRows) ? accuracyRows.length : 0;
    const dedupedRows = options.skipDedup ? accuracyRows : deduplicateAccuracyRows(accuracyRows);
    const overall = {
        winRate: 0,
        wins: 0,
        losses: 0,
        total: dedupedRows.length,
        graded: 0,
        pending: 0,
        void: 0,
        unsupported: 0,
        missingEvent: 0
    };

    for (const row of dedupedRows) {
        if (row.resolution_status === 'won') {
            overall.wins += 1;
            overall.graded += 1;
        } else if (row.resolution_status === 'lost') {
            overall.losses += 1;
            overall.graded += 1;
        } else if (row.resolution_status === 'void') {
            overall.void += 1;
        } else if (row.resolution_status === 'unsupported') {
            overall.unsupported += 1;
        } else {
            overall.pending += 1;
        }

        if (!row.result_source || String(row.event_status || '').toLowerCase() === 'missing') {
            overall.missingEvent += 1;
        }
    }
    overall.winRate = overall.graded > 0 ? Math.round((overall.wins / overall.graded) * 100) : 0;
    overall.uniqueFixtures = countUniqueFixtures(dedupedRows);
    overall.rawRowCount = rawRowCount;
    overall.duplicatesRemoved = Math.max(0, rawRowCount - dedupedRows.length);

    const products = new Map();
    for (const row of dedupedRows) {
        if (!products.has(row.prediction_final_id)) {
            products.set(row.prediction_final_id, []);
        }
        products.get(row.prediction_final_id).push(row);
    }

    const byTierMap = new Map();
    const byTypeMap = new Map();
    const tierTypeMap = new Map();
    const bySportMap = new Map();

    for (const rows of products.values()) {
        const sample = rows[0];
        const tierKey = normalizeTierKey(sample.prediction_tier);
        const typeKey = normalizeTypeKey(sample.prediction_type);
        const productStatus = determineProductStatus(rows);

        if (!byTierMap.has(tierKey)) {
            byTierMap.set(tierKey, { tier: tierKey, ...buildEmptyStats() });
        }
        if (!byTypeMap.has(typeKey)) {
            byTypeMap.set(typeKey, { type: humanizeTypeKey(typeKey), typeKey, ...buildEmptyStats() });
        }
        const tierTypeKey = `${tierKey}:${typeKey}`;
        if (!tierTypeMap.has(tierTypeKey)) {
            tierTypeMap.set(tierTypeKey, { tier: tierKey, typeKey, type: humanizeTypeKey(typeKey), ...buildEmptyStats() });
        }

        const statTargets = [byTierMap.get(tierKey), byTypeMap.get(typeKey), tierTypeMap.get(tierTypeKey)];
        for (const stats of statTargets) {
            if (productStatus === 'won') {
                stats.wins += 1;
                stats.graded += 1;
            } else if (productStatus === 'lost') {
                stats.losses += 1;
                stats.graded += 1;
            } else if (productStatus === 'void') {
                stats.void += 1;
            } else if (productStatus === 'unsupported') {
                stats.unsupported += 1;
            } else {
                stats.pending += 1;
            }
        }
    }

    for (const row of dedupedRows) {
        const sportKey = String(row.sport || '').toLowerCase() || 'unknown';
        if (!bySportMap.has(sportKey)) {
            bySportMap.set(sportKey, { sport: sportKey, ...buildEmptyStats() });
        }
        const stats = bySportMap.get(sportKey);
        if (row.resolution_status === 'won') {
            stats.wins += 1;
            stats.graded += 1;
        } else if (row.resolution_status === 'lost') {
            stats.losses += 1;
            stats.graded += 1;
        } else if (row.resolution_status === 'void') {
            stats.void += 1;
        } else if (row.resolution_status === 'unsupported') {
            stats.unsupported += 1;
        } else {
            stats.pending += 1;
        }
    }

    const tierTypeBreakdown = Array.from(byTierMap.keys()).map((tierKey) => ({
        tier: tierKey,
        wins: byTierMap.get(tierKey)?.wins || 0,
        losses: byTierMap.get(tierKey)?.losses || 0,
        pending: byTierMap.get(tierKey)?.pending || 0,
        types: ['direct', 'secondary', 'multi', 'same_match', 'acca'].map((typeKey) => ({
            ...(tierTypeMap.get(`${tierKey}:${typeKey}`) || { typeKey, type: humanizeTypeKey(typeKey), ...buildEmptyStats() }),
            typeKey
        }))
    }));

    const losses = dedupedRows
        .filter((row) => row.resolution_status === 'lost')
        .map((row) => ({
            match: `${row.home_team || 'Unknown'} vs ${row.away_team || 'Unknown'}`,
            sport: row.sport,
            tier: normalizeTierKey(row.prediction_tier),
            predictionType: humanizeTypeKey(normalizeTypeKey(row.prediction_type)),
            predictionTypeKey: normalizeTypeKey(row.prediction_type),
            market: row.market,
            confidence: row.confidence,
            predictedOutcome: row.predicted_outcome,
            actualResult: row.actual_result,
            eventStatus: row.event_status,
            scoreline: Number.isFinite(Number(row.actual_home_score)) && Number.isFinite(Number(row.actual_away_score))
                ? `${row.actual_home_score}-${row.actual_away_score}`
                : null,
            halftimeScoreline: Number.isFinite(Number(row.actual_home_score_ht)) && Number.isFinite(Number(row.actual_away_score_ht))
                ? `${row.actual_home_score_ht}-${row.actual_away_score_ht}`
                : null,
            reasonSummary: row.loss_reason_summary,
            factors: Array.isArray(row.loss_factors) ? row.loss_factors : [],
            evaluatedAt: row.evaluated_at
        }));

    const weeklyMap = new Map();
    for (const row of dedupedRows) {
        const fixtureDate = row.fixture_date ? new Date(row.fixture_date) : null;
        if (!fixtureDate || Number.isNaN(fixtureDate.getTime())) continue;
        const weekStart = startOfWeekUtc(fixtureDate).toISOString().slice(0, 10);
        if (!weeklyMap.has(weekStart)) {
            weeklyMap.set(weekStart, { weekStart, week: formatWeekKey(fixtureDate), wins: 0, losses: 0, accuracy: 0, reasons: [] });
        }
        const entry = weeklyMap.get(weekStart);
        if (row.resolution_status === 'won') {
            entry.wins += 1;
        } else if (row.resolution_status === 'lost') {
            entry.losses += 1;
            if (row.loss_reason_summary) {
                entry.reasons.push(row.loss_reason_summary);
            }
        }
    }
    const weekly = Array.from(weeklyMap.values())
        .map((entry) => ({
            ...entry,
            accuracy: entry.wins + entry.losses > 0 ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100) : 0,
            reasons: Array.from(new Set(entry.reasons)).slice(0, 3)
        }))
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    return {
        overall,
        byTier: Array.from(byTierMap.values()).map(finalizeStats),
        byType: Array.from(byTypeMap.values()).map(finalizeStats),
        tierTypeBreakdown: tierTypeBreakdown.map((entry) => ({
            ...entry,
            types: entry.types.map(finalizeStats)
        })),
        bySport: Array.from(bySportMap.values()).map(finalizeStats),
        weekly,
        losses
    };
}

module.exports = {
    ACCURACY_ROW_QUALITY_SQL,
    PUBLISHED_ROW_QUALITY_SQL,
    startOfWeekUtc,
    formatWeekKey,
    normalizeTierKey,
    normalizeTypeKey,
    humanizeTypeKey,
    buildEmptyStats,
    finalizeStats,
    deduplicateAccuracyRows,
    countUniqueFixtures,
    aggregateAccuracyRows
};
