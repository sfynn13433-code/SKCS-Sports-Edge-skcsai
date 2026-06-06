'use strict';

const { normalizeStatus } = require('../../semantic-layer/registry');

function toStringId(value) {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function normalizeOddsComparison(raw = {}, context = {}) {
    const quotes = [];
    const markets = raw.markets && typeof raw.markets === 'object' ? raw.markets : {};

    for (const [marketKey, outcomes] of Object.entries(markets)) {
        if (!outcomes || typeof outcomes !== 'object') continue;
        for (const [outcomeCode, bookMap] of Object.entries(outcomes)) {
            if (!bookMap || typeof bookMap !== 'object') continue;
            for (const [bookmakerSlug, quote] of Object.entries(bookMap)) {
                if (!quote || typeof quote !== 'object') continue;
                quotes.push({
                    lane: 'enrichment',
                    market_key: marketKey,
                    outcome_code: outcomeCode,
                    bookmaker_slug: bookmakerSlug,
                    odds_decimal: toNumberOrNull(quote.odds),
                    previous_decimal_odds: toNumberOrNull(quote.previous_decimal_odds),
                    is_max_quote: quote.is_max_quote === true,
                    outcome_name: quote.outcome_name != null ? String(quote.outcome_name) : null,
                    provider_event_id: toStringId(context.eventId),
                    provider: 'bzzoiro'
                });
            }
        }
    }

    return {
        schema_version: 'skcs:bzzoiro:odds-comparison:v1',
        provider_event_id: toStringId(context.eventId),
        quotes,
        verification: quotes.map((q) => ({
            outcome_code: q.outcome_code,
            outcome_name: q.outcome_name,
            bookmaker_slug: q.bookmaker_slug
        }))
    };
}

function normalizePolymarket(raw = {}, context = {}) {
    const rows = [];
    const markets = raw.markets && typeof raw.markets === 'object' ? raw.markets : {};

    for (const [marketKey, outcomes] of Object.entries(markets)) {
        if (!outcomes || typeof outcomes !== 'object') continue;
        for (const [outcomeCode, quote] of Object.entries(outcomes)) {
            if (!quote || typeof quote !== 'object') continue;
            rows.push({
                lane: 'enrichment',
                market_key: marketKey,
                outcome_code: outcomeCode,
                implied_probability: toNumberOrNull(quote.implied_probability),
                decimal_odds: toNumberOrNull(quote.decimal_odds),
                provider_event_id: toStringId(context.eventId),
                provider: 'bzzoiro'
            });
        }
    }

    return {
        schema_version: 'skcs:bzzoiro:polymarket:v1',
        provider_event_id: toStringId(context.eventId),
        markets: rows
    };
}

function normalizePlayers(players = [], lane) {
    return (Array.isArray(players) ? players : []).map((player) => {
        const row = {
            provider_player_id: toStringId(player?.player_id),
            lane: 'enrichment'
        };
        const aiScore = toNumberOrNull(player?.ai_score);
        if (aiScore !== null) {
            row.ai_score = aiScore;
            row.lane = 'verification';
        }
        return row;
    });
}

function normalizeLineups(raw = {}, context = {}) {
    const lineupStatus = raw.lineup_status != null ? String(raw.lineup_status) : null;
    const side = (key) => {
        const block = raw.lineups?.[key] || {};
        return {
            formation: block.formation != null ? String(block.formation) : null,
            players: normalizePlayers(block.players, 'enrichment'),
            substitutes: normalizePlayers(block.substitutes, 'enrichment')
        };
    };

    const enrichment = {
        schema_version: 'skcs:bzzoiro:lineups:v1',
        provider_event_id: toStringId(context.eventId),
        lineup_status: lineupStatus,
        status_normalized: normalizeStatus(lineupStatus),
        updated_at: raw.updated_at != null ? String(raw.updated_at) : null,
        home: side('home'),
        away: side('away'),
        unavailable_players: (Array.isArray(raw.unavailable_players) ? raw.unavailable_players : []).map((p) => ({
            provider_player_id: toStringId(p?.player_id),
            reason: p?.reason != null ? String(p.reason) : null,
            lane: 'enrichment'
        }))
    };

    const verification = {
        beta: raw.beta === true,
        confidence: toNumberOrNull(raw.confidence),
        restricted_ml_fields: true
    };

    return { enrichment, verification };
}

module.exports = {
    normalizeLineups,
    normalizeOddsComparison,
    normalizePolymarket
};
