'use strict';

const express = require('express');
const { query } = require('../db');
const { rebuildFinalOutputs } = require('../services/aiPipeline');
const { requireRole } = require('../utils/auth');
const config = require('../config');
const { createClient } = require('@supabase/supabase-js');
const moment = require('moment-timezone');
const { isValidCombination } = require('../services/conflictEngine');

const { getPlanCapabilities, filterPredictionsForPlan, calculateDailyAllocations, getMegaAccaDailyAllocation } = require('../config/subscriptionMatrix');
const { getPredictionWindow } = require('../utils/dateNormalization');
const { areLegsCompatible } = require('../utils/marketConsistency');
const { getCardDescriptor } = require('../utils/insightEngine');
const { buildContextInsightsFromMetadata } = require('../utils/contextInsights');

const router = express.Router();

const SPORT_FILTER_MAP = {
    football: [
        'football',
        'soccer_epl',
        'soccer_england_efl_cup',
        'soccer_uefa_champs_league',
        'soccer_spain_la_liga',
        'soccer_germany_bundesliga',
        'soccer_italy_serie_a',
        'soccer_france_ligue_one',
        'soccer_uefa_europa_league'
    ],
    basketball: ['basketball', 'nba', 'basketball_nba', 'basketball_euroleague'],
    nfl: ['nfl', 'american_football', 'americanfootball_nfl'],
    rugby: ['rugby', 'rugbyunion_international', 'rugbyunion_six_nations'],
    hockey: ['hockey', 'icehockey_nhl'],
    baseball: ['baseball', 'baseball_mlb'],
    afl: ['afl', 'aussierules_afl'],
    mma: ['mma', 'mma_mixed_martial_arts'],
    formula1: ['formula1'],
    handball: ['handball'],
    volleyball: ['volleyball'],
    cricket: ['cricket']
};

function startOfWeekUtc(now = new Date()) {
    const current = new Date(now);
    const day = current.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    current.setUTCDate(current.getUTCDate() + diffToMonday);
    current.setUTCHours(0, 0, 0, 0);
    return current;
}

function normalizePredictionSportKey(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return 'unknown';
    if (key.startsWith('soccer_')) return 'football';
    if (key.startsWith('icehockey_')) return 'hockey';
    if (key.startsWith('basketball_')) return 'basketball';
    if (key.startsWith('americanfootball_')) return 'nfl';
    if (key.startsWith('baseball_')) return 'baseball';
    if (key.startsWith('rugbyunion_')) return 'rugby';
    if (key.startsWith('aussierules_')) return 'afl';
    if (key.startsWith('mma_')) return 'mma';
    return key;
}

function normalizeTierLabel(value) {
    const tier = String(value || '').trim().toLowerCase();
    if (!tier) return 'normal';
    if (tier === 'elite') return 'deep';
    if (tier === 'core') return 'normal';
    return tier;
}

function getSportFilterValues(sport) {
    const key = String(sport || '').trim().toLowerCase();
    if (!key) return [];
    return SPORT_FILTER_MAP[key] || [key];
}

// FIX 3: ACCA CLASSIFICATION - Trust explicit DB types and check team pairs
function inferSectionType(prediction) {
    const explicit = String(prediction?.section_type || prediction?.type || '').trim().toLowerCase();
    if (explicit && explicit !== 'prediction') return explicit;

    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    
    if (matches.length >= 12) return 'mega_acca_12';
    if (matches.length >= 6) return 'acca_6match';
    if (matches.length >= 2) {
        // Distinguish Same Match vs ACCA
        const teamPairs = new Set(matches.map(m => {
            const h = String(m?.home_team || m?.metadata?.home_team || '').trim().toLowerCase();
            const a = String(m?.away_team || m?.metadata?.away_team || '').trim().toLowerCase();
            return `${h}_${a}`;
        }));
        if (teamPairs.size === 1) return 'same_match';
        return 'multi';
    }

    const firstMarket = String(matches[0]?.market || '').trim().toLowerCase();
    if (matches.length === 1 && firstMarket && firstMarket !== '1x2' && firstMarket !== 'match_result') {
        return 'secondary';
    }
    return 'direct';
}

function predictionMatchesSport(prediction, sportFilterValues) {
    if (!Array.isArray(sportFilterValues) || sportFilterValues.length === 0) return true;
    const allowed = new Set(sportFilterValues.map(normalizePredictionSportKey));
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    if (matches.length === 0) return false;

    const sectionType = inferSectionType(prediction);
    if (sectionType.includes('acca') || sectionType === 'multi') {
        return matches.some((match) => allowed.has(normalizePredictionSportKey(match?.sport || '')));
    }

    return matches.every((match) => allowed.has(normalizePredictionSportKey(match?.sport || '')));
}

function extractTeamNames(predictions) {
    const names = new Set();
    for (const row of predictions) {
        const matches = Array.isArray(row.matches) ? row.matches : [];
        for (const m of matches) {
            const home = m?.home_team || m?.metadata?.home_team || null;
            const away = m?.away_team || m?.metadata?.away_team || null;
            if (home && String(home).trim()) names.add(String(home).trim());
            if (away && String(away).trim()) names.add(String(away).trim());
        }
    }
    return Array.from(names);
}

function buildPlayersByTeam(rows) {
    const map = new Map();
    for (const row of rows) {
        if (!map.has(row.team_id)) map.set(row.team_id, []);
        const list = map.get(row.team_id);
        if (list.length >= 3) continue;
        list.push({
            id: row.id,
            name: row.name,
            position: row.position,
            number: row.number,
            age: row.age,
            photo: row.photo
        });
    }
    return map;
}

function formatUtcDateTime(value) {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const year = String(parsed.getUTCFullYear()).slice(-2);
    const hours = String(parsed.getUTCHours()).padStart(2, '0');
    const minutes = String(parsed.getUTCMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function humanizeToken(value) {
    return String(value || '')
        .trim()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeMarketKey(value) {
    return String(value || '').trim().toLowerCase();
}

function humanizePredictionLabel(prediction, market) {
    const normalized = String(prediction || '').trim().toLowerCase();
    const marketKey = normalizeMarketKey(market);
    const explicit = {
        home_win: 'HOME WIN',
        away_win: 'AWAY WIN',
        draw: 'DRAW',
        over: 'OVER',
        under: 'UNDER',
        yes: 'YES',
        no: 'NO',
        '1x': 'DOUBLE CHANCE - 1X',
        x2: 'DOUBLE CHANCE - X2',
        '12': 'DOUBLE CHANCE - 12'
    };

    const goalLineMatch = marketKey.match(/^(over|under)_(\d+)_(\d+)$/);
    const cornersLineMatch = marketKey.match(/^corners_(over|under)_(\d+)_(\d+)$/);
    const yellowsLineMatch = marketKey.match(/^(over|under)_(\d+)_(\d+)_yellows$/);
    const comboDcBttsMatch = marketKey.match(/^combo_dc_(1x|x2|12)_btts_(yes|no)$/);
    const comboWinnerOuMatch = marketKey.match(/^combo_(home|away|draw)_and_(over|under)_2_5$/);
    const comboDcOuMatch = marketKey.match(/^combo_dc_(1x|x2|12)_and_(over|under)_(\d+)_(\d+)$/);
    const comboBttsOuMatch = marketKey.match(/^combo_btts_(yes|no)_and_(over|under)_(\d+)_(\d+)$/);
    const teamTotalMatch = marketKey.match(/^team_total_(home|away)_(over|under)_(\d+)_(\d+)$/);
    const htFtMatch = marketKey.match(/^ht_ft_(home|draw|away)_(home|draw|away)$/);
    if (goalLineMatch) {
        return `${goalLineMatch[1].toUpperCase()} ${goalLineMatch[2]}.${goalLineMatch[3]} GOALS`;
    }
    if (cornersLineMatch) {
        return `TOTAL CORNERS ${cornersLineMatch[1].toUpperCase()} ${cornersLineMatch[2]}.${cornersLineMatch[3]}`;
    }
    if (yellowsLineMatch) {
        return `YELLOW CARDS ${yellowsLineMatch[1].toUpperCase()} ${yellowsLineMatch[2]}.${yellowsLineMatch[3]}`;
    }
    if (comboDcBttsMatch) {
        return `DOUBLE CHANCE ${comboDcBttsMatch[1].toUpperCase()} + BTTS ${comboDcBttsMatch[2].toUpperCase()}`;
    }
    if (comboWinnerOuMatch) {
        return `${comboWinnerOuMatch[1].toUpperCase()} WIN + ${comboWinnerOuMatch[2].toUpperCase()} 2.5 GOALS`;
    }
    if (comboDcOuMatch) {
        return `DOUBLE CHANCE ${comboDcOuMatch[1].toUpperCase()} + ${comboDcOuMatch[2].toUpperCase()} ${comboDcOuMatch[3]}.${comboDcOuMatch[4]} GOALS`;
    }
    if (comboBttsOuMatch) {
        return `BTTS ${comboBttsOuMatch[1].toUpperCase()} + ${comboBttsOuMatch[2].toUpperCase()} ${comboBttsOuMatch[3]}.${comboBttsOuMatch[4]} GOALS`;
    }
    if (teamTotalMatch) {
        return `${teamTotalMatch[1].toUpperCase()} TEAM ${teamTotalMatch[2].toUpperCase()} ${teamTotalMatch[3]}.${teamTotalMatch[4]} GOALS`;
    }
    if (htFtMatch) {
        return `HT/FT ${htFtMatch[1].toUpperCase()}-${htFtMatch[2].toUpperCase()}`;
    }
    if (marketKey === 'btts_yes') return 'BTTS - YES';
    if (marketKey === 'btts_no') return 'BTTS - NO';
    if (marketKey.startsWith('draw_no_bet_')) return `DRAW NO BET - ${marketKey.replace('draw_no_bet_', '').toUpperCase()}`;
    if (marketKey === 'asian_handicap') return `ASIAN HANDICAP - ${String(prediction || '').toUpperCase()}`;
    if (marketKey === 'european_handicap') return `EUROPEAN HANDICAP - ${String(prediction || '').toUpperCase()}`;
    if (marketKey === 'corners_under') return 'TOTAL CORNERS UNDER';
    if (marketKey === 'corners_over') return 'TOTAL CORNERS OVER';
    if (marketKey.startsWith('double_chance_')) {
        return `DOUBLE CHANCE - ${marketKey.replace('double_chance_', '').toUpperCase()}`;
    }
    if (explicit[normalized]) return explicit[normalized];
    if (marketKey.includes('double_chance')) return `DOUBLE CHANCE - ${String(prediction || '').toUpperCase()}`;
    return String(prediction || '').toUpperCase();
}

function buildSecondaryMarketDescription(market, fallbackDescription = '') {
    const marketKey = normalizeMarketKey(market);
    const description = String(fallbackDescription || '').trim();
    if (marketKey === 'corners_under' || marketKey === 'corners_over') {
        return description || 'Total corners line unavailable from source';
    }
    return description;
}

function isDisplayFriendlySecondaryMarket(market) {
    const marketKey = normalizeMarketKey(market);
    return marketKey !== 'corners_under' && marketKey !== 'corners_over';
}

function isCompatibleSecondaryMarket(primaryMatch, secondaryMarket) {
    return areLegsCompatible(
        {
            market: primaryMatch?.market,
            prediction: primaryMatch?.prediction
        },
        {
            market: secondaryMarket?.market,
            prediction: secondaryMarket?.prediction
        }
    );
}

function dedupeSecondaryMarkets(items) {
    const seen = new Set();
    const out = [];

    for (const item of items) {
        const marketKey = normalizeMarketKey(item?.market);
        const predictionKey = String(item?.prediction || '').trim().toLowerCase();
        const key = `${marketKey}:${predictionKey}`;
        if (!marketKey || seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }

    return out;
}

// FIX 1: CROSSOVER BUG - Hard bind signatures to team names so generic API IDs never collide
function getFixtureSignature(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const firstMatch = matches[0] || {};
    
    const matchId = String(firstMatch?.match_id || prediction?.match_id || '').trim();
    const home = String(firstMatch?.home_team || firstMatch?.metadata?.home_team || prediction?.home_team || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const away = String(firstMatch?.away_team || firstMatch?.metadata?.away_team || prediction?.away_team || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (home && away && matchId) return `${matchId}_${home}_${away}`;
    if (home && away) return `no_id_${home}_${away}`;
    
    return matchId ? `id_only_${matchId}` : `unknown_${Math.random()}`;
}

function buildSecondaryMarketSummaryItem(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const firstMatch = matches[0] || {};
    return {
        market: firstMatch?.market || '',
        prediction: firstMatch?.prediction || '',
        confidence: normalizeConfidence(firstMatch?.confidence ?? prediction?.total_confidence ?? 0),
        description: buildSecondaryMarketDescription(firstMatch?.market, firstMatch?.metadata?.market_description || ''),
        label: humanizePredictionLabel(firstMatch?.prediction, firstMatch?.market)
    };
}

function buildSameMatchBuilder(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    return matches.slice(0, 6).map((match, index) => ({
        index: index + 1,
        market: humanizeToken(match?.market || ''),
        prediction: humanizePredictionLabel(match?.prediction, match?.market),
        confidence: normalizeConfidence(match?.confidence || 0)
    }));
}

function buildFallbackReasoning(prediction, relatedSecondaryMarkets = []) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const firstMatch = matches[0] || {};
    const metadata = firstMatch?.metadata || {};
    const homeTeam = firstMatch?.home_team || metadata?.home_team || 'Home Team';
    const awayTeam = firstMatch?.away_team || metadata?.away_team || 'Away Team';
    const league = metadata?.league || humanizeToken(firstMatch?.sport || '');
    const outcome = humanizePredictionLabel(firstMatch?.prediction, firstMatch?.market);
    const confidence = normalizeConfidence(firstMatch?.confidence ?? prediction?.total_confidence ?? 0);
    const backupSummary = relatedSecondaryMarkets
        .slice(0, 3)
        .map((market) => `${market.label} (${market.confidence}%)`)
        .join(', ');

    if (backupSummary) {
        return `${homeTeam} vs ${awayTeam} leans ${outcome} at ${confidence}% confidence in ${league}. Secondary coverage currently favours ${backupSummary}.`;
    }

    return `${homeTeam} vs ${awayTeam} leans ${outcome} at ${confidence}% confidence in ${league}.`;
}

function buildFallbackPipelineData(prediction, relatedSecondaryMarkets = []) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const firstMatch = matches[0] || {};
    const metadata = firstMatch?.metadata || {};
    const homeTeam = firstMatch?.home_team || metadata?.home_team || 'Home Team';
    const awayTeam = firstMatch?.away_team || metadata?.away_team || 'Away Team';
    const competition = metadata?.league || humanizeToken(firstMatch?.sport || '');
    const outcome = humanizePredictionLabel(firstMatch?.prediction, firstMatch?.market);
    const confidence = normalizeConfidence(firstMatch?.confidence ?? prediction?.total_confidence ?? 0);
    const volatility = humanizeToken(firstMatch?.volatility || prediction?.risk_level || 'medium');
    const backupSummary = relatedSecondaryMarkets
        .slice(0, 3)
        .map((market) => market.label)
        .join(', ');

    return {
        elite_6_stage: {
            stage_1_collection: `${competition} market inputs collected for ${homeTeam} vs ${awayTeam}.`,
            stage_2_baseline: `${outcome} is the leading baseline edge at ${confidence}% confidence.`,
            stage_3_context: backupSummary
                ? `Related secondary coverage is available: ${backupSummary}.`
                : 'No linked secondary coverage is currently attached to this fixture.',
            stage_4_reality: `${volatility} volatility profile on the published market set.`,
            stage_5_decision: `Primary market retained as ${outcome}.`,
            stage_6_final: `Final published edge remains ${outcome}.`
        },
        core_4_stage: {
            stage_1_baseline: `${outcome} is the leading baseline edge at ${confidence}% confidence.`,
            stage_2_context: backupSummary
                ? `Secondary coverage is available: ${backupSummary}.`
                : 'No linked secondary coverage is currently attached to this fixture.',
            stage_3_reality: `${volatility} volatility profile on the published market set.`,
            stage_4_final: `Final published edge remains ${outcome}.`
        }
    };
}

function attachRelatedPredictionArtifacts(predictions) {
    const secondaryBySig = new Map();
    const sameMatchBySig = new Map();

    for (const prediction of predictions) {
        const sig = getFixtureSignature(prediction);
        if (!sig || sig.startsWith('unknown_')) continue; 

        const sectionType = inferSectionType(prediction);
        if (sectionType === 'secondary') {
            if (!secondaryBySig.has(sig)) {
                secondaryBySig.set(sig, []);
            }
            secondaryBySig.get(sig).push(buildSecondaryMarketSummaryItem(prediction));
        } else if (sectionType === 'same_match') {
            sameMatchBySig.set(sig, buildSameMatchBuilder(prediction));
        }
    }

    return predictions.map((prediction) => {
        const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
        if (!matches.length) return prediction;

        const sectionType = inferSectionType(prediction);
        const sig = getFixtureSignature(prediction);
        const firstMatch = matches[0] || {};
        const remainingMatches = matches.slice(1);
        
        const relatedSecondaryMarkets = dedupeSecondaryMarkets(
            (secondaryBySig.get(sig) || [])
                .filter((market) => isCompatibleSecondaryMarket(firstMatch, market))
                .filter((market) => isDisplayFriendlySecondaryMarket(market.market))
        ).slice(0, 4);
        
        const relatedSameMatchBuilder = sameMatchBySig.get(sig) || [];
        const metadata = {
            ...(firstMatch?.metadata || {})
        };

        if (sectionType === 'direct') {
            metadata.secondary_markets = relatedSecondaryMarkets;
            if (!Array.isArray(metadata.same_match_builder) || metadata.same_match_builder.length === 0) {
                metadata.same_match_builder = relatedSameMatchBuilder;
            }
        }

        if (!String(metadata.reasoning || '').trim()) {
            metadata.reasoning = buildFallbackReasoning(prediction, relatedSecondaryMarkets);
        }

        if (!metadata.pipeline_data || typeof metadata.pipeline_data !== 'object') {
            metadata.pipeline_data = buildFallbackPipelineData(prediction, relatedSecondaryMarkets);
        }

        return {
            ...prediction,
            matches: [
                {
                    ...firstMatch,
                    metadata
                },
                ...remainingMatches
            ]
        };
    });
}

function normalizeConfidence(confidence) {
    if (typeof confidence !== 'number' || Number.isNaN(confidence)) return 0;
    return Math.max(0, Math.min(100, Math.round(confidence)));
}

function roundConfidence(value) {
    if (!Number.isFinite(Number(value))) return 0;
    return Math.round(Number(value) * 100) / 100;
}

function computeAverageLegConfidence(matches = []) {
    const values = (Array.isArray(matches) ? matches : [])
        .map((match) => Number(match?.confidence))
        .filter((value) => Number.isFinite(value));
    if (!values.length) return 0;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return roundConfidence(Math.max(0, Math.min(100, avg)));
}

function resolveAverageLegConfidence(prediction) {
    const explicit = Number(prediction?.average_leg_confidence);
    if (Number.isFinite(explicit)) {
        return roundConfidence(Math.max(0, Math.min(100, explicit)));
    }

    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    if (matches.length > 0) {
        const fromMetadata = Number(matches[0]?.metadata?.average_leg_confidence);
        if (Number.isFinite(fromMetadata)) {
            return roundConfidence(Math.max(0, Math.min(100, fromMetadata)));
        }
    }

    return computeAverageLegConfidence(matches);
}

function normalizeOdds(odds) {
    if (typeof odds !== 'number' || Number.isNaN(odds)) return null;
    return Math.max(1.01, Math.round(odds * 100) / 100);
}

function enrichMatchMetadata(match, prediction) {
    const sectionType = inferSectionType(prediction);
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const legCount = matches.length;

    // Use the standardized card descriptor for proper labeling
    const defaultTicketLabel = getCardDescriptor(legCount);
    const rawOutcome = String(prediction?.prediction || prediction?.label || '').trim();

    // Replace UNKNOWN or empty labels with the proper card descriptor
    const fallbackOutcome = !rawOutcome || rawOutcome.toUpperCase() === 'UNKNOWN' || rawOutcome.toUpperCase() === 'UNKNOWN PREDICTION'
        ? defaultTicketLabel
        : rawOutcome.toUpperCase();
    const fallbackReasoning = String(prediction?.reasoning || prediction?.model_reasoning || '').trim();
    const contextInsights = buildContextInsightsFromMetadata(match?.metadata?.context_intelligence || null);

    return {
        ...match,
        context_insights: contextInsights,
        prediction_details: {
            outcome: fallbackOutcome,
            reasoning: fallbackReasoning,
            card_label: defaultTicketLabel,
        }
    };
}

function parseMatchKickoff(match) {
    const value =
        match?.commence_time ||
        match?.match_date ||
        match?.metadata?.match_time ||
        match?.metadata?.kickoff ||
        match?.metadata?.kickoff_time ||
        null;

    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// FIX 2: OLD DATES BUG - Eject unparseable dates instead of blindly allowing them
function predictionMatchesWindow(prediction, windowStart, windowEnd) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    if (matches.length === 0) return false;

    let kickoffs = matches.map(parseMatchKickoff).filter(Boolean);

    if (kickoffs.length === 0) {
        // Fallback to record creation time if match date is completely missing
        const fallbackDate = new Date(prediction.created_at);
        if (isNaN(fallbackDate.getTime())) return false; // Strictly drop records with no valid timeframe
        kickoffs = [fallbackDate];
    }

    const sectionType = inferSectionType(prediction);
    if (sectionType.includes('acca') || sectionType === 'multi') {
        return kickoffs.some((kickoff) => kickoff >= windowStart && kickoff <= windowEnd);
    }

    return kickoffs.every((kickoff) => kickoff >= windowStart && kickoff <= windowEnd);
}

// Hard cutoff: reject any prediction whose earliest kickoff is more than 24 hours in the past
function predictionIsNotStale(prediction, now = new Date()) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    if (matches.length === 0) return false;

    const kickoffs = matches.map(parseMatchKickoff).filter(Boolean);
    if (kickoffs.length === 0) {
        // No parseable kickoff dates — use created_at as a safety net
        const created = new Date(prediction.created_at);
        if (isNaN(created.getTime())) return false;
        const hoursSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
        return hoursSinceCreation <= 48; // allow up to 48 hours since creation
    }

    const earliestKickoff = new Date(Math.min(...kickoffs.map(k => k.getTime())));
    const hoursInPast = (now.getTime() - earliestKickoff.getTime()) / (1000 * 60 * 60);
    return hoursInPast <= 24; // reject fixtures that kicked off more than 24 hours ago
}

function getPredictionPrimaryKickoff(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const kickoffs = matches
        .map((match) => parseMatchKickoff(match))
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime());

    return kickoffs[0] || null;
}

function comparePredictionsForDisplay(a, b, now = new Date()) {
    const kickoffA = getPredictionPrimaryKickoff(a);
    const kickoffB = getPredictionPrimaryKickoff(b);
    const upcomingA = kickoffA ? kickoffA >= now : false;
    const upcomingB = kickoffB ? kickoffB >= now : false;

    if (upcomingA !== upcomingB) {
        return upcomingA ? -1 : 1;
    }

    if (kickoffA && kickoffB) {
        if (upcomingA && upcomingB) {
            return kickoffA.getTime() - kickoffB.getTime();
        }
        return kickoffB.getTime() - kickoffA.getTime();
    }

    const createdA = new Date(a.created_at || 0).getTime();
    const createdB = new Date(b.created_at || 0).getTime();
    return createdB - createdA;
}

function enrichPredictionDetails(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const firstMatch = matches[0] || {};
    const firstMetadata = firstMatch?.metadata || {};
    const matchDetails = firstMatch?.prediction_details || {};
    const sectionType = inferSectionType(prediction);

    const fallbackOutcome =
        matchDetails.outcome ||
        firstMatch?.prediction ||
        prediction?.prediction ||
        sectionType ||
        prediction?.type ||
        '';
    const defaultTicketLabel = sectionType === 'mega_acca_12'
        ? '12 MATCH MEGA ACCA'
        : sectionType === 'acca_6match'
            ? '6 MATCH ACCA'
            : 'PREDICTION';
    const resolvedOutcome = String(fallbackOutcome || '').trim();
    const finalOutcome = !resolvedOutcome || resolvedOutcome.toUpperCase() === 'UNKNOWN'
        ? defaultTicketLabel
        : resolvedOutcome;

    const fallbackReasoning =
        matchDetails.reasoning ||
        firstMetadata.reasoning ||
        firstMetadata.model_reasoning ||
        prediction?.reasoning ||
        prediction?.model_reasoning ||
        '';
    const contextInsights = firstMatch?.context_insights || buildContextInsightsFromMetadata(firstMetadata?.context_intelligence || null);

    return {
        ...prediction,
        section_type: sectionType,
        ticket_label: defaultTicketLabel,
        average_leg_confidence: resolveAverageLegConfidence(prediction),
        context_insights: contextInsights,
        prediction_details: {
            ...(prediction?.prediction_details || {}),
            outcome: finalOutcome,
            reasoning: String(fallbackReasoning).trim(),
            context_status: contextInsights?.status || 'unavailable'
        }
    };
}

// FIX 3: ACCA WIPE BUG - Include team names so dedupe doesn't destroy un-ID'd accumulators
function buildPredictionSignature(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const legs = matches.map((match) => {
        const h = String(match?.home_team || match?.metadata?.home_team || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const a = String(match?.away_team || match?.metadata?.away_team || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        return `${h}_${a}_${normalizeMarketKey(match?.market)}_${String(match?.prediction || '').trim().toLowerCase()}`;
    }).join('|');

    return [
        String(prediction?.tier || '').trim().toLowerCase(),
        inferSectionType(prediction),
        legs
    ].join('::');
}

function dedupePredictions(predictions) {
    const seen = new Set();
    const out = [];

    for (const prediction of predictions) {
        const signature = buildPredictionSignature(prediction);
        if (!signature || seen.has(signature)) continue;
        seen.add(signature);
        out.push(prediction);
    }

    return out;
}

function filterConflictingSecondaryPredictions(predictions) {
    const directBySig = new Map();

    for (const prediction of predictions) {
        if (inferSectionType(prediction) !== 'direct') continue;
        const sig = getFixtureSignature(prediction);
        const firstMatch = Array.isArray(prediction?.matches) ? prediction.matches[0] : null;
        if (!sig || !firstMatch) continue;
        directBySig.set(sig, firstMatch);
    }

    return predictions.filter((prediction) => {
        if (inferSectionType(prediction) !== 'secondary') return true;
        const sig = getFixtureSignature(prediction);
        const firstMatch = Array.isArray(prediction?.matches) ? prediction.matches[0] : null;
        const directMatch = directBySig.get(sig);
        if (!sig || !firstMatch || !directMatch) return true;
        return isCompatibleSecondaryMarket(directMatch, firstMatch);
    });
}

function toConflictCheckLeg(match) {
    const marketKey = normalizeMarketKey(match?.market);
    const predictionKey = String(match?.prediction || '').trim().toLowerCase();
    if (!marketKey || !predictionKey) return null;

    if (marketKey === '1x2') {
        return { market: '1X2', prediction: predictionKey };
    }
    if (marketKey.startsWith('double_chance_')) {
        const mappedPrediction = predictionKey === '1x'
            ? 'home_or_draw'
            : predictionKey === 'x2'
                ? 'draw_or_away'
                : predictionKey === '12'
                    ? 'home_or_away'
                    : predictionKey;
        return { market: 'DOUBLE_CHANCE', prediction: mappedPrediction };
    }
    if (marketKey === 'under_1_5' || marketKey === 'over_1_5') {
        return { market: 'OVER_UNDER_1_5', prediction: predictionKey };
    }
    if (marketKey === 'under_2_5' || marketKey === 'over_2_5') {
        return { market: 'OVER_UNDER_2_5', prediction: predictionKey };
    }
    if (marketKey === 'btts_yes' || marketKey === 'btts_no') {
        return { market: 'BTTS', prediction: predictionKey === 'yes' ? 'yes' : 'no' };
    }

    return { market: marketKey.toUpperCase(), prediction: predictionKey };
}

function sanitizeSameMatchMatchesForDisplay(matches) {
    const out = [];

    for (const match of matches) {
        const prospective = [...out, match]
            .map(toConflictCheckLeg)
            .filter(Boolean);

        if (prospective.length > 0 && !isValidCombination(prospective)) {
            continue;
        }

        out.push(match);
    }

    return out;
}

function sanitizePredictionForDisplay(prediction) {
    if (inferSectionType(prediction) !== 'same_match') return prediction;

    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const sanitizedMatches = sanitizeSameMatchMatchesForDisplay(matches);
    if (!sanitizedMatches.length) return prediction;

    return {
        ...prediction,
        matches: sanitizedMatches
    };
}

async function getLatestRelevantPublishRunId(requestedSport) {
    const sportKey = normalizePredictionSportKey(requestedSport || '');

    if (!sportKey) {
        const latestRunRes = await query(
            `
            SELECT id
            FROM prediction_publish_runs
            WHERE status = 'completed'
              AND (
                requested_sports IS NULL
                OR cardinality(requested_sports) = 0
                OR 'all' = ANY(requested_sports)
              )
            ORDER BY id DESC
            LIMIT 1
            `
        );
        return latestRunRes.rows[0]?.id || null;
    }

    const latestRunRes = await query(
        `
        SELECT id
        FROM prediction_publish_runs
        WHERE status = 'completed'
          AND (
            requested_sports IS NULL
            OR cardinality(requested_sports) = 0
            OR 'all' = ANY(requested_sports)
            OR $1 = ANY(requested_sports)
          )
        ORDER BY
          CASE
            WHEN requested_sports IS NOT NULL AND $1 = ANY(requested_sports) THEN 0
            WHEN requested_sports IS NULL OR cardinality(requested_sports) = 0 OR 'all' = ANY(requested_sports) THEN 1
            ELSE 2
          END,
          id DESC
        LIMIT 1
        `,
        [sportKey]
    );
    return latestRunRes.rows[0]?.id || null;
}

async function getLatestPublishRunIdFromFinalTable() {
    const fallbackRunRes = await query(
        `
        SELECT publish_run_id
        FROM predictions_final
        WHERE publish_run_id IS NOT NULL
        ORDER BY publish_run_id DESC, created_at DESC
        LIMIT 1
        `
    );

    return fallbackRunRes.rows[0]?.publish_run_id || null;
}

// GET /api/predictions
// Default tier = deep (elite pool); subscription limits use /api/user/predictions
router.get('/', requireRole('user'), async (req, res) => {
    try {
        const planId = req.query.plan_id || 'elite_30day_deep_vip';
        const sport = req.query.sport;
        const sportFilterValues = getSportFilterValues(sport);
        
        let historyWindowDays = Number(req.query.history_days);
        if (isNaN(historyWindowDays)) {
            // Default: strict 24 hour history window to block old matches (e.g. 5 days old)
            historyWindowDays = 1; 
        } else {
            historyWindowDays = Math.max(0, Math.min(14, historyWindowDays));
        }
        
        const futureWindowDays = Math.max(1, Math.min(14, Number(req.query.window_days) || 7));

        console.log(`[PREDICTIONS] Request for Plan: ${planId}, Sport: ${sport || 'all'}`);

        // Get plan capabilities from subscription matrix
        const planCapabilities = getPlanCapabilities(planId);
        if (!planCapabilities) {
            return res.status(400).json({ error: 'Invalid plan ID' });
        }

        const now = new Date();
        let latestPublishRunId = await getLatestRelevantPublishRunId(sport);
        let publishRunSource = 'completed_publish_run';
        if (!latestPublishRunId) {
            latestPublishRunId = await getLatestPublishRunIdFromFinalTable();
            if (latestPublishRunId) {
                publishRunSource = 'predictions_final_fallback';
                console.warn('[predictions] No completed publish run found; using latest predictions_final publish_run_id:', latestPublishRunId);
            }
        }
        let predictions = [];
        try {
            if (!latestPublishRunId) {
                throw new Error(`No completed publish run found for sport=${sport || 'all'}`);
            }

            // Query ALL predictions with matching tier (don't restrict by publish_run_id).
            // The date windowing and subscription filtering below handles what the user sees.
            let queryStr = `
                SELECT pf.id, pf.publish_run_id, pf.tier, pf.type, pf.matches, pf.total_confidence, pf.risk_level, pf.created_at
                FROM predictions_final pf
                WHERE LOWER(COALESCE(pf.tier, 'normal')) = ANY($1::text[])
            `;
            const queryParams = [planCapabilities.tiers.map((tier) => String(tier).toLowerCase())];

            queryStr += ` ORDER BY created_at DESC LIMIT 2000;`;

            const dbRes = await query(queryStr, queryParams);
            predictions = dbRes.rows || [];
        } catch (dbErr) {
            console.error('[predictions] primary DB query failed, falling back to Supabase:', dbErr.message);
        }

        // If DB returned no predictions, attempt Supabase fallback (useful when Supabase is the source)
        try {
            if ((!predictions || predictions.length === 0) && config.supabase && config.supabase.url && config.supabase.anonKey) {
                console.log('[predictions] DB empty - attempting Supabase fallback');
                const sb = createClient(config.supabase.url, config.supabase.anonKey);
                const { data: runs, error: runsError } = await sb
                    .from('prediction_publish_runs')
                    .select('id, requested_sports')
                    .eq('status', 'completed')
                    .order('id', { ascending: false })
                    .limit(50);

                const latestSupabaseRun = !runsError && Array.isArray(runs)
                    ? runs.find((row) => {
                        const requested = Array.isArray(row.requested_sports) ? row.requested_sports.map(normalizePredictionSportKey) : [];
                        if (!sport) return requested.length === 0 || requested.includes('all');
                        return requested.length === 0 || requested.includes('all') || requested.includes(normalizePredictionSportKey(sport));
                    })
                    : null;

                const { data, error } = latestSupabaseRun
                    ? await sb
                        .from('predictions_final')
                        .select('*')
                        .eq('publish_run_id', latestSupabaseRun.id)
                        .order('created_at', { ascending: false })
                        .limit(2000)
                    : await sb
                        .from('predictions_final')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(2000);

                if (!latestSupabaseRun) {
                    console.warn('[predictions] Supabase has no completed publish run; using latest predictions_final rows');
                }

                if (!error && Array.isArray(data) && data.length > 0) {
                    // Filter Supabase rows by plan capabilities.
                    const allowedTiers = new Set(planCapabilities.tiers.map((tier) => normalizeTierLabel(tier)));
                    const filtered = data.filter((r) => {
                        try {
                            const rowTier = normalizeTierLabel(r.tier);
                            if (!allowedTiers.has(rowTier)) return false;
                            return true;
                        } catch (_e) {
                            return false;
                        }
                    });
                    predictions = filtered;
                } else if (error) {
                    console.warn('[predictions] Supabase fallback error:', error.message || error);
                }
            }
        } catch (fbErr) {
            console.warn('[predictions] Supabase fallback failed:', fbErr.message || fbErr);
        }

        const teamNames = extractTeamNames(predictions).map(n => n.toLowerCase());
        const teamInfoByName = new Map();

        if (teamNames.length > 0) {
            try {
                const teamRes = await query(
                    `
                    SELECT
                        t.id,
                        t.name,
                        NULL::text AS logo,
                        t.location AS country,
                        NULL::int AS league_id,
                        NULL::text AS league_name,
                        NULL::text AS league_country,
                        NULL::text AS league_season,
                        s.sport_key AS sport_id,
                        s.sport_key AS sport_slug,
                        s.title AS sport_name
                    FROM teams t
                    LEFT JOIN sports s ON s.sport_key = t.sport_key
                    WHERE LOWER(t.name) = ANY($1::text[])
                    `,
                    [teamNames]
                );

                const teamIds = [];
                for (const row of teamRes.rows) {
                    teamIds.push(row.id);
                }

                const playersByTeam = new Map();
                if (teamIds.length > 0) {
                    const playersRes = await query(
                        `
                        SELECT id, team_id, full_name AS name, NULL::int AS age, NULL::int AS number, position, NULL::text AS photo
                        FROM players
                        WHERE team_id = ANY($1::int[])
                        ORDER BY team_id, name ASC
                        `,
                        [teamIds]
                    );
                    const grouped = buildPlayersByTeam(playersRes.rows);
                    for (const [teamId, players] of grouped.entries()) {
                        playersByTeam.set(teamId, players);
                    }
                }

                for (const row of teamRes.rows) {
                    teamInfoByName.set(String(row.name).toLowerCase(), {
                        id: row.id,
                        name: row.name,
                        logo: row.logo,
                        country: row.country,
                        league: {
                            id: row.league_id,
                            name: row.league_name,
                            country: row.league_country,
                            season: row.league_season
                        },
                        sport: {
                            id: row.sport_id,
                            slug: row.sport_slug,
                            name: row.sport_name
                        },
                        players: playersByTeam.get(row.id) || []
                    });
                }
            } catch (enrichErr) {
                console.warn('[predictions] enrichment skipped:', enrichErr.message);
            }
        }

        const enrichedPredictions = predictions.map((row) => {
            const matches = Array.isArray(row.matches) ? row.matches : [];
            const enrichedMatches = matches.map((m) => {
                const home = m?.home_team || m?.metadata?.home_team || null;
                const away = m?.away_team || m?.metadata?.away_team || null;
                const homeKey = home ? String(home).toLowerCase() : null;
                const awayKey = away ? String(away).toLowerCase() : null;
                return {
                    ...enrichMatchMetadata(m, row),
                    home_team_info: homeKey ? (teamInfoByName.get(homeKey) || null) : null,
                    away_team_info: awayKey ? (teamInfoByName.get(awayKey) || null) : null
                };
            });
            return {
                ...row,
                matches: enrichedMatches
            };
        }).map(enrichPredictionDetails);
        const hydratedPredictions = attachRelatedPredictionArtifacts(
            filterConflictingSecondaryPredictions(dedupePredictions(enrichedPredictions))
                .map(sanitizePredictionForDisplay)
        );

        const windowStart = new Date(now.getTime() - historyWindowDays * 24 * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + futureWindowDays * 24 * 60 * 60 * 1000);

        const scopedPredictions = hydratedPredictions
            .filter((prediction) => predictionIsNotStale(prediction, now))
            .filter((prediction) => predictionMatchesWindow(prediction, windowStart, windowEnd))
            .filter((prediction) => predictionMatchesSport(prediction, sportFilterValues))
            .filter((prediction) => {
                if (inferSectionType(prediction) !== 'secondary') return true;
                const firstMatch = Array.isArray(prediction?.matches) ? prediction.matches[0] : null;
                return isDisplayFriendlySecondaryMarket(firstMatch?.market);
            })
            .sort((a, b) => comparePredictionsForDisplay(a, b, now));

        const planFilteredPredictions = filterPredictionsForPlan(
            scopedPredictions,
            planId,
            now,
            {
                enforceUniqueAssetWindow: false,
                subscriptionStart: req.user?.official_start_time || null
            }
        );
        const megaAccaDailyAllocation = getMegaAccaDailyAllocation(planId, now, {
            subscriptionStart: req.user?.official_start_time || null,
            predictions: scopedPredictions
        });
        const todayName = moment.tz('Africa/Johannesburg').format('dddd').toLowerCase();
        const dailyLimits = calculateDailyAllocations(planId, todayName);

        res.status(200).json({
            plan_id: planId,
            sport: sport || 'all',
            publish_run_source: publishRunSource,
            day: todayName,
            history_days: historyWindowDays,
            window_days: futureWindowDays,
            daily_limits: dailyLimits,
            plan_meta: {
                id: planCapabilities.plan_id,
                name: planCapabilities.name,
                tier: planCapabilities.tier,
                duration_days: planCapabilities.duration_days,
                mega_acca_allocation: planCapabilities.capabilities?.mega_acca_allocation || 0,
                mega_acca_daily_allocation: megaAccaDailyAllocation,
                mega_acca_constraints: planCapabilities.capabilities?.mega_acca_constraints || null,
                mega_acca_policy: planCapabilities.capabilities?.mega_acca_policy || null
            },
            count: planFilteredPredictions.length,
            predictions: planFilteredPredictions
        });
    } catch (err) {
        console.error('[predictions] Route Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Deterministic rebuild endpoint (useful for scheduled jobs)
router.post('/rebuild', requireRole('admin'), async (_req, res) => {
    try {
        console.log('[predictions] Manual rebuild of final outputs requested...');
        const result = await rebuildFinalOutputs();
        res.status(200).json({ ok: true, message: "Final outputs rebuilt successfully", data: result });
    } catch (err) {
        console.error('[predictions] rebuild error:', err);
        res.status(500).json({ error: 'Rebuild failed', details: err.message });
    }
});

// Clear test data from raw and filtered tables
router.post('/clear-test', requireRole('admin'), async (_req, res) => {
    try {
        console.log('[predictions] Clearing test data...');
        // Delete test data from predictions_filtered first (foreign key constraint)
        await query(`DELETE FROM predictions_filtered WHERE raw_id IN (SELECT id FROM predictions_raw WHERE metadata->>'data_mode' = 'test')`);
        // Delete test data from predictions_raw
        const rawResult = await query(`DELETE FROM predictions_raw WHERE metadata->>'data_mode' = 'test'`);
        // Clear predictions_final (will be rebuilt)
        await query(`DELETE FROM predictions_final`);
        res.status(200).json({ 
            ok: true, 
            message: "Test data cleared. Run /rebuild to regenerate final outputs.",
            deleted_raw: rawResult.rowCount 
        });
    } catch (err) {
        console.error('[predictions] clear-test error:', err);
        res.status(500).json({ error: 'Clear failed', details: err.message });
    }
});

module.exports = router;
