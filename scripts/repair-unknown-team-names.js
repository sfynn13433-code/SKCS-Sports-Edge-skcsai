'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TARGET_TYPES = new Set(['multi', 'same_match', 'acca', 'acca_6match', 'mega_acca_12']);

function isUnknownName(value) {
    const key = String(value || '').trim().toLowerCase();
    return !key
        || key === 'unknown'
        || key === 'unknown home'
        || key === 'unknown away'
        || key === 'home team'
        || key === 'away team'
        || key === 'tbd'
        || key === 'n/a';
}

function firstTeamName(value) {
    if (!value || typeof value !== 'object') return '';
    const raw = value.name
        || value.team_name
        || value.shortName
        || value.short_name
        || value.display_name
        || value.team
        || '';
    const normalized = String(raw || '').trim();
    return isUnknownName(normalized) ? '' : normalized;
}

function extractMatchToken(leg) {
    const candidates = [
        leg?.match_id,
        leg?.fixture_id,
        leg?.metadata?.event_id,
        leg?.metadata?.match_id
    ];
    for (const candidate of candidates) {
        const token = String(candidate || '').trim();
        if (token) return token;
    }
    return '';
}

function resolveFromCanonical(rawProviderData, side) {
    if (!rawProviderData || typeof rawProviderData !== 'object') return '';

    const fromStandard = side === 'home'
        ? firstTeamName(rawProviderData?.teams?.home)
            || firstTeamName(rawProviderData?.homeTeam)
            || firstTeamName(rawProviderData?.home)
            || firstTeamName(rawProviderData?.home_team)
        : firstTeamName(rawProviderData?.teams?.away)
            || firstTeamName(rawProviderData?.awayTeam)
            || firstTeamName(rawProviderData?.away)
            || firstTeamName(rawProviderData?.away_team);
    if (fromStandard) return fromStandard;

    const participants = Array.isArray(rawProviderData?.participants) ? rawProviderData.participants : [];
    for (const participant of participants) {
        const location = String(participant?.meta?.location || participant?.location || '').trim().toLowerCase();
        if (location !== side) continue;
        const fromParticipant = firstTeamName(participant);
        if (fromParticipant) return fromParticipant;
    }

    return '';
}

async function buildLookupMaps(client, tokens) {
    if (!tokens.length) {
        return { eventsById: new Map(), canonicalById: new Map() };
    }

    const [eventsRes, canonicalRes] = await Promise.all([
        client.query(
            `
            SELECT id::text AS id, home_team, away_team
            FROM events
            WHERE id::text = ANY($1::text[])
            `,
            [tokens]
        ),
        client.query(
            `
            SELECT id::text AS id, raw_provider_data
            FROM canonical_events
            WHERE id::text = ANY($1::text[])
            `,
            [tokens]
        )
    ]);

    const eventsById = new Map();
    for (const row of eventsRes.rows) {
        eventsById.set(String(row.id), {
            home_team: String(row.home_team || '').trim(),
            away_team: String(row.away_team || '').trim()
        });
    }

    const canonicalById = new Map();
    for (const row of canonicalRes.rows) {
        canonicalById.set(String(row.id), row.raw_provider_data || null);
    }

    return { eventsById, canonicalById };
}

async function repairUnknownTeamNames() {
    const client = await pool.connect();
    try {
        const rowsRes = await client.query(`
            SELECT id, type, matches
            FROM predictions_final
            WHERE LOWER(COALESCE(type, '')) IN ('multi', 'same_match', 'acca', 'acca_6match', 'mega_acca_12')
              AND EXISTS (
                SELECT 1
                FROM jsonb_array_elements(COALESCE(matches, '[]'::jsonb)) AS leg
                WHERE LOWER(COALESCE(leg->>'home_team', '')) IN ('unknown', 'unknown home', 'home team', 'tbd', 'n/a')
                   OR LOWER(COALESCE(leg->>'away_team', '')) IN ('unknown', 'unknown away', 'away team', 'tbd', 'n/a')
                   OR NULLIF(BTRIM(COALESCE(leg->>'home_team', '')), '') IS NULL
                   OR NULLIF(BTRIM(COALESCE(leg->>'away_team', '')), '') IS NULL
              )
            ORDER BY created_at DESC
        `);

        const rows = rowsRes.rows || [];
        const allTokens = new Set();
        for (const row of rows) {
            if (!TARGET_TYPES.has(String(row.type || '').trim().toLowerCase())) continue;
            const legs = Array.isArray(row.matches) ? row.matches : [];
            for (const leg of legs) {
                const token = extractMatchToken(leg);
                if (token) allTokens.add(token);
            }
        }

        const { eventsById, canonicalById } = await buildLookupMaps(client, Array.from(allTokens));

        let updatedRows = 0;
        let updatedLegs = 0;
        let unresolvedLegs = 0;

        for (const row of rows) {
            const legs = Array.isArray(row.matches) ? row.matches : [];
            let rowChanged = false;
            const nextLegs = legs.map((leg) => {
                const needsHome = isUnknownName(leg?.home_team);
                const needsAway = isUnknownName(leg?.away_team);
                if (!needsHome && !needsAway) return leg;

                const token = extractMatchToken(leg);
                const eventRow = token ? eventsById.get(token) : null;
                const canonicalRaw = token ? canonicalById.get(token) : null;

                const resolvedHome = !needsHome
                    ? String(leg.home_team || '').trim()
                    : (eventRow && !isUnknownName(eventRow.home_team) ? eventRow.home_team : resolveFromCanonical(canonicalRaw, 'home'));
                const resolvedAway = !needsAway
                    ? String(leg.away_team || '').trim()
                    : (eventRow && !isUnknownName(eventRow.away_team) ? eventRow.away_team : resolveFromCanonical(canonicalRaw, 'away'));

                if ((needsHome && !resolvedHome) || (needsAway && !resolvedAway)) {
                    unresolvedLegs++;
                    return leg;
                }

                const metadata = leg?.metadata && typeof leg.metadata === 'object' ? leg.metadata : {};
                const patched = {
                    ...leg,
                    home_team: resolvedHome || leg.home_team,
                    away_team: resolvedAway || leg.away_team,
                    home_team_name: resolvedHome || leg.home_team_name || '',
                    away_team_name: resolvedAway || leg.away_team_name || '',
                    metadata: {
                        ...metadata,
                        home_team: resolvedHome || metadata.home_team || null,
                        away_team: resolvedAway || metadata.away_team || null,
                        home_team_name: resolvedHome || metadata.home_team_name || null,
                        away_team_name: resolvedAway || metadata.away_team_name || null
                    }
                };

                rowChanged = true;
                updatedLegs++;
                return patched;
            });

            if (!rowChanged) continue;

            await client.query(
                `
                UPDATE predictions_final
                SET matches = $2::jsonb
                WHERE id = $1
                `,
                [row.id, JSON.stringify(nextLegs)]
            );
            updatedRows++;
        }

        console.log(
            '[repair-unknown-team-names] scanned_rows=%s updated_rows=%s updated_legs=%s unresolved_legs=%s',
            rows.length,
            updatedRows,
            updatedLegs,
            unresolvedLegs
        );
    } finally {
        client.release();
        await pool.end();
    }
}

repairUnknownTeamNames().catch(async (err) => {
    console.error('[repair-unknown-team-names] FAILED:', err.message);
    try { await pool.end(); } catch {}
    process.exit(1);
});
