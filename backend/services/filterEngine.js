'use strict';

const { withTransaction } = require('../db');
const { validateRawPredictionForInsert } = require('../utils/validation');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

function normalizeTier(tier) {
    if (tier === 'normal' || tier === 'deep' || tier === 'ultra') return tier;
    throw new Error(`Invalid tier: ${tier}`);
}

const SUPABASE_URL = String(process.env.SUPABASE_URL || config?.supabase?.url || '').trim();
const SUPABASE_KEY = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_KEY
    || process.env.SUPABASE_ANON_KEY
    || config?.supabase?.anonKey
    || ''
).trim();

const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
    : null;

function normalizeRuleArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        const text = value.trim();
        if (!text) return [];
        try {
            const parsed = JSON.parse(text);
            return Array.isArray(parsed) ? parsed : [text];
        } catch (_error) {
            return [text];
        }
    }
    return [];
}

function mapRuleRow(rule) {
    return {
        tier: normalizeTier(rule?.tier),
        min_confidence: Number(rule?.min_confidence),
        allowed_markets: normalizeRuleArray(rule?.allowed_markets),
        allowed_volatility: normalizeRuleArray(rule?.allowed_volatility),
        max_acca_size: Number(rule?.max_acca_size)
    };
}

async function fetchTierRulesMap() {
    if (!supabase) {
        throw new Error('CRITICAL: Failed to fetch tier_rules from database.');
    }

    const { data: tierRules, error: rulesError } = await supabase.from('tier_rules').select('*');
    if (rulesError || !tierRules) throw new Error('CRITICAL: Failed to fetch tier_rules from database.');

    const rulesMap = tierRules.reduce((acc, rule) => {
        const mapped = mapRuleRow(rule);
        acc[mapped.tier] = mapped;
        return acc;
    }, {});

    return rulesMap;
}

function getTierRules(tier, rulesMap) {
    const t = normalizeTier(tier);
    const rules = rulesMap?.[t];
    if (!rules) {
        throw new Error(`Missing tier_rules row for tier=${t}`);
    }
    if (!Number.isFinite(rules.min_confidence)) {
        throw new Error(`Invalid min_confidence in tier_rules for tier=${t}`);
    }
    if (!Array.isArray(rules.allowed_markets)) {
        throw new Error(`Invalid allowed_markets in tier_rules for tier=${t}`);
    }
    if (!Array.isArray(rules.allowed_volatility)) {
        throw new Error(`Invalid allowed_volatility in tier_rules for tier=${t}`);
    }

    return rules;
}

function isMarketAllowed(allowedMarkets, market) {
    if (!allowedMarkets) return false;
    if (Array.isArray(allowedMarkets) && allowedMarkets.length === 1 && allowedMarkets[0] === 'ALL') return true;
    if (!Array.isArray(allowedMarkets)) return false;
    return allowedMarkets.includes(market);
}

function isVolatilityAllowed(allowedVolatility, volatility) {
    if (!allowedVolatility) return false;
    if (!Array.isArray(allowedVolatility)) return false;
    return allowedVolatility.includes(volatility);
}

function buildRejectReason({ tier, reason, raw }) {
    return `[tier=${tier}] ${reason} (confidence=${raw.confidence}, market=${raw.market}, volatility=${raw.volatility})`;
}

function getMetadata(raw) {
    return raw && typeof raw.metadata === 'object' && raw.metadata !== null ? raw.metadata : {};
}

function parseMatchTime(raw) {
    const metadata = getMetadata(raw);
    const value = metadata.match_time || metadata.kickoff || metadata.kickoff_time || null;
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isTestPrediction(raw) {
    const metadata = getMetadata(raw);
    return metadata.data_mode === 'test';
}

function evaluateMetadataQuality(raw, tier) {
    if (isTestPrediction(raw)) {
        return { is_valid: true, reject_reason: null };
    }

    const metadata = getMetadata(raw);
    
    // Be more lenient with prediction source - allow both provider and ai_fallback
    const predictionSource = String(metadata.prediction_source || '').trim().toLowerCase();
    if (predictionSource && predictionSource !== 'provider' && predictionSource !== 'ai_fallback') {
        return {
            is_valid: false,
            reject_reason: buildRejectReason({ tier, reason: 'Invalid prediction source', raw })
        };
    }

    // League OR team names should be present (more lenient)
    if (typeof metadata.league !== 'string' || metadata.league.trim().length === 0) {
        // Allow if we have both team names
        if (metadata.home_team && metadata.away_team) {
            // Teams present, league missing is OK - continue checking
        } else {
            return {
                is_valid: false,
                reject_reason: buildRejectReason({ tier, reason: 'Missing league and team information', raw })
            };
        }
    }

    const kickoff = parseMatchTime(raw);
    
    // If no kickoff time, allow it (will be filtered later by isPublishablePrediction)
    if (!kickoff) {
        // No kickoff, but has confidence and valid source - allow through
        return { is_valid: true, reject_reason: null };
    }

    // EXTENDED stale cutoff: Allow matches up to 2 hours past kickoff
    // This accounts for live matches and slight delays
    const staleCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    if (kickoff < staleCutoff) {
        return {
            is_valid: false,
            reject_reason: buildRejectReason({ tier, reason: 'Kickoff time is too far in the past (>2 hours)', raw })
        };
    }

    return { is_valid: true, reject_reason: null };
}

async function upsertFilteredRow({ rawId, tier, isValid, rejectReason }, client) {
    const sql = `
        insert into predictions_filtered (raw_id, tier, is_valid, reject_reason)
        values ($1, $2, $3, $4)
        on conflict (raw_id, tier)
        do update set
            is_valid = excluded.is_valid,
            reject_reason = excluded.reject_reason,
            created_at = now()
        returning *;
    `;

    const res = await client.query(sql, [rawId, tier, isValid, rejectReason]);
    return res.rows[0];
}

function evaluateRawAgainstTier(raw, rules) {
    const tier = rules.tier;

    if (typeof raw.confidence !== 'number' || Number.isNaN(raw.confidence)) {
        return { is_valid: false, reject_reason: buildRejectReason({ tier, reason: 'Missing or non-numeric confidence', raw }) };
    }

    if (raw.confidence < rules.min_confidence) {
        return { is_valid: false, reject_reason: buildRejectReason({ tier, reason: `Confidence below min_confidence (${rules.min_confidence})`, raw }) };
    }

    if (!isMarketAllowed(rules.allowed_markets, raw.market)) {
        return { is_valid: false, reject_reason: buildRejectReason({ tier, reason: 'Market not allowed by tier_rules', raw }) };
    }

    if (!isVolatilityAllowed(rules.allowed_volatility, raw.volatility)) {
        return { is_valid: false, reject_reason: buildRejectReason({ tier, reason: 'Volatility not allowed by tier_rules', raw }) };
    }

    const metadataGate = evaluateMetadataQuality(raw, tier);
    if (!metadataGate.is_valid) {
        return metadataGate;
    }

    return { is_valid: true, reject_reason: null };
}

async function filterRawPrediction({ rawId, tier, rulesMap }, client) {
    const activeRulesMap = rulesMap || await fetchTierRulesMap();
    const rules = getTierRules(tier, activeRulesMap);

    const rawRes = await client.query('select * from predictions_raw where id = $1 limit 1;', [rawId]);
    if (!rawRes.rows.length) {
        throw new Error(`predictions_raw not found for id=${rawId}`);
    }

    const raw = rawRes.rows[0];
    validateRawPredictionForInsert(raw);

    const { is_valid, reject_reason } = evaluateRawAgainstTier(raw, rules);

    const filtered = await upsertFilteredRow({
        rawId,
        tier: rules.tier,
        isValid: is_valid,
        rejectReason: reject_reason
    }, client);

    console.log('[filterEngine] raw_id=%s tier=%s is_valid=%s reason=%s', rawId, rules.tier, is_valid, reject_reason);

    return filtered;
}

async function filterLatestRawBatch({ tier, limit = 500 }) {
    const normalizedTier = normalizeTier(tier);

    return withTransaction(async (client) => {
        const rulesMap = await fetchTierRulesMap();
        const rawRes = await client.query(
            'select id from predictions_raw order by created_at desc limit $1;',
            [limit]
        );

        const filtered = [];
        for (const row of rawRes.rows) {
            const out = await filterRawPrediction({ rawId: row.id, tier: normalizedTier, rulesMap }, client);
            filtered.push(out);
        }
        return filtered;
    });
}

module.exports = {
    getTierRules,
    filterRawPrediction,
    filterLatestRawBatch
};
