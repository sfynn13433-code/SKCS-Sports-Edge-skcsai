'use strict';

require('dotenv').config();

const { withTransaction, query, pool } = require('../backend/db');
const {
    isCompetitionAllowedForSport,
    normalizeRequestedSport,
    COMPETITION_ALLOWLIST_SPORTS
} = require('../backend/services/dataProvider');

const TARGET_SPORTS = Array.from(COMPETITION_ALLOWLIST_SPORTS || []).sort();
const CHUNK_SIZE = 500;

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function firstMatch(matches) {
    if (Array.isArray(matches) && matches.length > 0 && matches[0] && typeof matches[0] === 'object') {
        return matches[0];
    }
    return null;
}

function normalizeSportFromPredictionRow(row) {
    const match0 = firstMatch(row?.matches);
    return normalizeRequestedSport(
        row?.sport
        || match0?.sport
        || match0?.metadata?.sport
        || match0?.sport_key
        || match0?.metadata?.sport_key
        || ''
    );
}

function normalizeSportFromCanonicalRow(row) {
    return normalizeRequestedSport(row?.sport || '');
}

function buildRowLikeFromPrediction(row) {
    const match0 = firstMatch(row?.matches) || {};
    const metadata = match0?.metadata && typeof match0.metadata === 'object' ? match0.metadata : {};
    const rawProviderData =
        (match0?.raw_provider_data && typeof match0.raw_provider_data === 'object' ? match0.raw_provider_data : null)
        || (metadata?.raw_provider_data && typeof metadata.raw_provider_data === 'object' ? metadata.raw_provider_data : null);

    return {
        sport: normalizeSportFromPredictionRow(row),
        league: match0?.league || metadata?.league || metadata?.competition || metadata?.tournament || null,
        competition: match0?.competition || metadata?.competition || null,
        tournament: match0?.tournament || metadata?.tournament || null,
        raw_provider_data: rawProviderData
    };
}

function buildRowLikeFromCanonical(row) {
    return {
        sport: normalizeSportFromCanonicalRow(row),
        league: row?.competition_name || null,
        competition: row?.competition_name || null,
        tournament: row?.competition_name || null,
        raw_provider_data: row?.raw_provider_data && typeof row.raw_provider_data === 'object'
            ? row.raw_provider_data
            : null
    };
}

function extractProviderEventId(rawProviderData) {
    const raw = rawProviderData && typeof rawProviderData === 'object' ? rawProviderData : {};
    const direct =
        raw?.fixture?.id
        || raw?.game?.id
        || raw?.fight?.id
        || raw?.race?.id
        || raw?.id
        || null;
    if (direct === null || typeof direct === 'undefined') return null;
    const text = String(direct).trim();
    return text || null;
}

function extractFixtureIdFromPrediction(row) {
    const match0 = firstMatch(row?.matches) || {};
    const metadata = match0?.metadata && typeof match0.metadata === 'object' ? match0.metadata : {};
    const rawProviderData =
        (match0?.raw_provider_data && typeof match0.raw_provider_data === 'object' ? match0.raw_provider_data : null)
        || (metadata?.raw_provider_data && typeof metadata.raw_provider_data === 'object' ? metadata.raw_provider_data : null);
    const fromMatch = String(match0?.fixture_id || match0?.match_id || '').trim();
    if (fromMatch) return fromMatch;
    return extractProviderEventId(rawProviderData);
}

function chunked(values, size = CHUNK_SIZE) {
    const out = [];
    for (let i = 0; i < values.length; i += size) {
        out.push(values.slice(i, i + size));
    }
    return out;
}

async function deleteByIdText(client, tableName, ids) {
    if (!ids.length) return 0;
    let deleted = 0;
    const chunks = chunked(ids.map((id) => String(id).trim()).filter(Boolean));
    for (const part of chunks) {
        const res = await client.query(
            `DELETE FROM ${tableName} WHERE id::text = ANY($1::text[])`,
            [part]
        );
        deleted += Number(res.rowCount || 0);
    }
    return deleted;
}

async function loadPredictionRows() {
    const res = await query(
        `
        SELECT id, sport, matches
        FROM direct1x2_prediction_final
        WHERE COALESCE(
            NULLIF(BTRIM(LOWER(sport)), ''),
            NULLIF(BTRIM(LOWER(matches->0->>'sport')), ''),
            NULLIF(BTRIM(LOWER(matches->0->'metadata'->>'sport')), '')
        ) = ANY($1::text[])
        `,
        [TARGET_SPORTS]
    );
    return toArray(res.rows);
}

async function loadCanonicalRows() {
    const res = await query(
        `
        SELECT id, sport, competition_name, raw_provider_data
        FROM canonical_events
        WHERE LOWER(BTRIM(sport)) = ANY($1::text[])
        `,
        [TARGET_SPORTS]
    );
    return toArray(res.rows);
}

async function runCleanup() {
    console.log('[cleanup] Starting competition allowlist cleanup...');
    console.log(`[cleanup] Target sports: ${TARGET_SPORTS.join(', ')}`);

    const predictionRows = await loadPredictionRows();
    const canonicalRows = await loadCanonicalRows();

    const predictionsToDelete = [];
    const canonicalToDelete = [];
    const eventIdsToDelete = new Set();

    for (const row of predictionRows) {
        const rowSport = normalizeSportFromPredictionRow(row);
        if (!rowSport || !TARGET_SPORTS.includes(rowSport)) continue;
        const rowLike = buildRowLikeFromPrediction(row);
        const allowed = isCompetitionAllowedForSport(rowSport, rowLike);
        if (allowed) continue;
        predictionsToDelete.push(String(row.id));
        const fixtureId = extractFixtureIdFromPrediction(row);
        if (fixtureId) {
            eventIdsToDelete.add(fixtureId);
            eventIdsToDelete.add(`${rowSport}:${fixtureId}`);
        }
    }

    for (const row of canonicalRows) {
        const rowSport = normalizeSportFromCanonicalRow(row);
        if (!rowSport || !TARGET_SPORTS.includes(rowSport)) continue;
        const rowLike = buildRowLikeFromCanonical(row);
        const allowed = isCompetitionAllowedForSport(rowSport, rowLike);
        if (allowed) continue;
        canonicalToDelete.push(String(row.id));
        const fixtureId = extractProviderEventId(rowLike.raw_provider_data);
        if (fixtureId) {
            eventIdsToDelete.add(fixtureId);
            eventIdsToDelete.add(`${rowSport}:${fixtureId}`);
        }
    }

    const summary = {
        inspected: {
            direct1x2_prediction_final: predictionRows.length,
            canonical_events: canonicalRows.length
        },
        toDelete: {
            direct1x2_prediction_final: predictionsToDelete.length,
            canonical_events: canonicalToDelete.length,
            events_by_id: eventIdsToDelete.size
        },
        deleted: {
            direct1x2_prediction_final: 0,
            canonical_events: 0,
            events: 0
        }
    };

    console.log('[cleanup] Planned deletions:', summary.toDelete);

    await withTransaction(async (client) => {
        summary.deleted.direct1x2_prediction_final = await deleteByIdText(
            client,
            'direct1x2_prediction_final',
            predictionsToDelete
        );
        summary.deleted.canonical_events = await deleteByIdText(
            client,
            'canonical_events',
            canonicalToDelete
        );
        summary.deleted.events = await deleteByIdText(
            client,
            'events',
            Array.from(eventIdsToDelete)
        );
    });

    console.log('[cleanup] Completed:', summary.deleted);
    return summary;
}

if (require.main === module) {
    runCleanup()
        .then((result) => {
            console.log('[cleanup][result]', JSON.stringify(result, null, 2));
            process.exit(0);
        })
        .catch((error) => {
            console.error('[cleanup][fatal]', error && error.stack ? error.stack : error.message);
            process.exit(1);
        })
        .finally(async () => {
            try {
                await pool.end();
            } catch (_err) {
                // noop
            }
        });
}

module.exports = { runCleanup };
