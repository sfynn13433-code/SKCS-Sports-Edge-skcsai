'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'services', 'accaBuilder.js');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// =========================================================================
// PATCH 1: Add insightEngine imports to the require block
// =========================================================================
const insightRequireIdx = lines.findIndex(l => l.includes("require('../utils/accaLogicEngine')"));
if (insightRequireIdx === -1) {
    console.error('Could not find accaLogicEngine require');
    process.exit(1);
}

const newImport = `const {
    calculateTrueComboConfidence,
    calculateTicketCompoundProbability,
    filterExpiredFixtures,
    selectAccaLegs,
    MIN_CONFIDENCE,
    MAX_CONFIDENCE,
    FAMILY_CAPS_6,
    FAMILY_CAPS_12,
    BUILD_ORDER,
    ALLOWED_FAMILIES,
    normalizeMarketFamily,
    isValidConfidence,
} = require('../utils/accaLogicEngine');
const {
    filterUpcomingFixtures,
    stableFixtureKey,
    normalizeInsightFamily,
    validateAndNormalizeMarket,
    isBannedMarket,
    isValidConfidence: isValidConfidenceIE,
    weeklyTeamLock,
    reserveTeamsWeekly,
    extractTeamCompetitionPairs,
    startOfWeekUtc,
    endOfWeekUtc,
    validateMarketDiversity,
    verifyProbabilityIntegrity,
    MIN_LEG_CONFIDENCE,
    MAX_LEG_CONFIDENCE,
    MIN_FAMILIES_PER_CARD,
    getCardDescriptor,
    getFamilyCaps,
} = require('../utils/insightEngine');`;

// Find the existing require block and replace it
const existingRequireStart = insightRequireIdx;
const existingRequireEnd = lines.findIndex((l, i) => i > existingRequireStart && l.includes('} = require'));

if (existingRequireEnd === -1) {
    // The require is on a single line, insert after it
    lines.splice(existingRequireStart + 1, 0, '', ...newImport.split('\n'));
} else {
    // Multi-line require block — replace it
    const closingIdx = lines.findIndex((l, i) => i > existingRequireStart && l.trim().startsWith('}'));
    if (closingIdx !== -1) {
        lines.splice(existingRequireStart, closingIdx - existingRequireStart + 1, ...newImport.split('\n'));
    }
}

console.log('Patch 1: Added insightEngine imports');

// =========================================================================
// PATCH 2: Replace finalizeAccumulatorRow with SKCS-law version
// =========================================================================
const finalizeIdx = lines.findIndex(l => l.startsWith('function finalizeAccumulatorRow'));
const hasMixedIdx = lines.findIndex((l, i) => i > finalizeIdx && l.startsWith('function hasMixedSportCoverage'));

if (finalizeIdx === -1 || hasMixedIdx === -1) {
    console.error('Could not find finalizeAccumulatorRow boundaries');
    console.error('finalizeIdx:', finalizeIdx, 'hasMixedIdx:', hasMixedIdx);
    process.exit(1);
}

console.log(`Patch 2: Found finalizeAccumulatorRow at lines ${finalizeIdx + 1}-${hasMixedIdx}`);

const newFinalizeFn = `function finalizeAccumulatorRow(legs, options = {}) {
    const profile = String(options.profile || 'mixed_sport');
    const minLegConfidenceFloor = Number(options.minLegConfidenceFloor || (MIN_CONFIDENCE || 80));
    const isMega = options.isMega === true;
    const legCount = Number(legs?.length || 0);
    const ticketLabel = legCount >= 12 ? '12 MATCH MEGA ACCA' : '6 MATCH ACCA';

    // SKCS LAW: Compute diversity breakdown
    const diversityBreakdown = {};
    legs.forEach((leg) => {
        const marketType = String(leg?.market || leg?.metadata?.market || leg?.type || '').toLowerCase();
        const family = normalizeMarketFamily(marketType) || normalizeInsightFamily(marketType) || 'other';
        if (family && family !== 'other') {
            diversityBreakdown[family] = (diversityBreakdown[family] || 0) + 1;
        }
    });

    const payloadLegs = legs.map((leg) => {
        const finalLeg = toFinalMatchPayload(leg);
        finalLeg.metadata = {
            ...(finalLeg.metadata || {}),
            sport_type: getSportTypeLabel(finalLeg.sport),
            acca_profile: profile,
            acca_profile_label: profile === 'football_only' ? 'Football ACCA' : 'Mixed Sport ACCA',
            acca_ticket_label: ticketLabel,
            min_leg_confidence_floor: minLegConfidenceFloor,
            market_family: normalizeMarketFamily(leg?.market || leg?.metadata?.market || '') || 'other',
        };
        if (isMega) {
            finalLeg.metadata.mega_acca_leg = true;
        }
        return finalLeg;
    });

    const averageLegConfidence = computeTotalConfidence(payloadLegs);
    // SKCS LAW: Strict multiplication for total
    const totalConfidence = computeCompoundConfidence(payloadLegs);
    const totalTicketProbability = totalConfidence.toFixed(2) + '%';

    const payloadLegsWithConfidenceMeta = payloadLegs.map((leg) => ({
        ...leg,
        metadata: {
            ...(leg.metadata || {}),
            display_label: ticketLabel,
            average_leg_confidence: averageLegConfidence,
            compound_ticket_confidence: totalConfidence,
            total_ticket_probability_display: totalTicketProbability,
            diversity_breakdown: { ...diversityBreakdown },
        }
    }));

    return {
        match_id: payloadLegsWithConfidenceMeta.map((leg) => leg.match_id).filter(Boolean).join('|'),
        matches: payloadLegsWithConfidenceMeta,
        total_confidence: totalConfidence,
        total_ticket_probability: totalConfidence,
        totalTicketProbability: totalTicketProbability,
        ticket_label: ticketLabel,
        display_label: ticketLabel,
        average_leg_confidence: averageLegConfidence,
        diversity_breakdown: diversityBreakdown,
        family_count: Object.keys(diversityBreakdown).length,
        risk_level: isMega ? 'safe' : riskLevelFromConfidence(totalConfidence)
    };
}

`;

lines.splice(finalizeIdx, hasMixedIdx - finalizeIdx, ...newFinalizeFn.split('\n'));

console.log('Patch 2: Replaced finalizeAccumulatorRow with SKCS law version');

// =========================================================================
// PATCH 3: Update buildFinalForTier diagnostics to include SKCS law checks
// =========================================================================
const diagStartIdx = lines.findIndex(l => l.includes('TEMPORARY DIAGNOSTICS'));
if (diagStartIdx !== -1) {
    const diagEndIdx = lines.findIndex((l, i) => i > diagStartIdx && l.includes('END TEMPORARY DIAGNOSTICS'));
    if (diagEndIdx !== -1) {
        const newDiagnostics = `        // TEMPORARY DIAGNOSTICS: SKCS ACCA Engine Law enforcement
        const allAccaCards = [...accaRows, ...megaAccaRows];
        const allFixtureKeys = [];
        const allTeamPairs = [];
        let cardsWithFakeMath = 0;
        let duplicateTeamsWeekly = 0;
        let bannedMarketsTotal = 0;
        let familyCapsEnforcedTotal = 0;

        const cardDiagnostics = allAccaCards.map((card) => {
            const cardMatches = card.matches || [];
            const fixtureKeys = cardMatches.map((m) => m.match_id).filter(Boolean);
            allFixtureKeys.push(...fixtureKeys);

            // Collect team pairs for weekly lock check
            for (const m of cardMatches) {
                const pairs = extractTeamCompetitionPairs(m);
                allTeamPairs.push(...pairs);
            }

            const avgConf = Number(card.average_leg_confidence || 0);
            const totalConf = Number(card.total_confidence || 0);
            const isHonest = totalConf <= avgConf || avgConf === 0;
            if (!isHonest) cardsWithFakeMath++;

            const diversity = card.diversity_breakdown || cardMatches[0]?.metadata?.diversity_breakdown || {};
            const familyCount = Object.keys(diversity).filter(k => diversity[k] > 0).length;

            return {
                type: card.type,
                legs: cardMatches.length,
                avgConfidence: avgConf,
                totalConfidence: totalConf,
                honest: isHonest,
                displayLabel: card.display_label || card.ticket_label || 'UNKNOWN',
                familyCount,
                diversityBreakdown: diversity,
            };
        });

        const uniqueFixtureKeys = new Set(allFixtureKeys);
        const duplicateFixtureCount = allFixtureKeys.length - uniqueFixtureKeys.size;

        // Weekly team lock check
        const teamCompMap = new Map();
        for (const { team, competition } of allTeamPairs) {
            if (!team || !competition) continue;
            if (!teamCompMap.has(team)) teamCompMap.set(team, new Set());
            if (teamCompMap.get(team).has(competition)) {
                duplicateTeamsWeekly++;
            }
            teamCompMap.get(team).add(competition);
        }

        console.log('[accaBuilder DIAGNOSTICS] tier=%s', t);
        console.log('[accaBuilder DIAGNOSTICS] raw_fixtures_in=%s upcoming_after_filter=%s', valid.length, perSportLimited.length);
        console.log('[accaBuilder DIAGNOSTICS] acca_cards_built=%s duplicate_fixture_keys=%s duplicate_teams_weekly=%s cards_with_fake_math=%s', allAccaCards.length, duplicateFixtureCount, duplicateTeamsWeekly, cardsWithFakeMath);
        console.log('[accaBuilder DIAGNOSTICS] avg_vs_total=%s', JSON.stringify(cardDiagnostics.map(c => ({ legs: c.legs, avg: c.avgConfidence, total: c.totalConfidence, honest: c.honest, families: c.familyCount }))));
        console.log('[accaBuilder DIAGNOSTICS] card_details=%s', JSON.stringify(cardDiagnostics));
        // END TEMPORARY DIAGNOSTICS`;

        lines.splice(diagStartIdx, diagEndIdx - diagStartIdx + 1, ...newDiagnostics.split('\n'));
        console.log('Patch 3: Updated diagnostics with SKCS law checks');
    }
}

// =========================================================================
// Write the patched file
// =========================================================================
content = lines.join('\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('\\nAll patches applied successfully');
console.log('New line count:', content.split('\n').length);
