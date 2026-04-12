'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'services', 'accaBuilder.js');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// =========================================================================
// PATCH 1: Update require block to add new insightEngine exports
// =========================================================================
const insightReqIdx = lines.findIndex(l => l.includes("require('../utils/insightEngine')"));
if (insightReqIdx === -1) {
    console.error('Cannot find insightEngine require');
    process.exit(1);
}

const newReqs = `const {
    filterUpcomingFixtures,
    stableFixtureKey,
    normalizeInsightFamily,
    validateAndNormalizeMarket,
    isBannedMarket,
    isValidConfidence: isValidConfidenceIE,
    isTeamLockedForWeek,
    lockTeamsForWeek,
    normalizeTeamName,
    normalizeCompetitionKey,
    getWeekKey,
    exceedsCardOverlapLimit,
    getCardFixtureKeySet,
    countSetOverlap,
    rotateCandidatePool,
    initMegaDiagnostics,
    resolveMegaZeroReason,
    validateMarketDiversity,
    verifyProbabilityIntegrity,
    MIN_LEG_CONFIDENCE,
    MAX_LEG_CONFIDENCE,
    MIN_FAMILIES_PER_CARD,
    getCardDescriptor,
    getFamilyCaps,
} = require('../utils/insightEngine');`;

// Find and replace the existing insightEngine require block
let reqStart = -1, reqEnd = -1;
for (let i = insightReqIdx; i >= 0; i--) {
    if (lines[i].includes('const {')) { reqStart = i; break; }
}
for (let i = insightReqIdx; i < lines.length; i++) {
    if (lines[i].trim().startsWith('} = require')) { reqEnd = i; break; }
}

if (reqStart === -1 || reqEnd === -1) {
    console.error('Cannot find require block boundaries');
    console.error('reqStart:', reqStart, 'reqEnd:', reqEnd);
    process.exit(1);
}

lines.splice(reqStart, reqEnd - reqStart + 1, ...newReqs.split('\n'));
console.log('Patch 1: Updated require block with new exports');

// =========================================================================
// PATCH 2: Replace the 6-leg + Mega ACCA build loops with proper publish flow
// =========================================================================
// Find the start of "1. 6-LEG ACCA LAYER" and the end before "return {"
const acca6LayerIdx = lines.findIndex(l => l.includes('1. 6-LEG ACCA LAYER'));
const returnIdx = lines.findIndex((l, i) => i > acca6LayerIdx && l.trim() === 'return {');

if (acca6LayerIdx === -1 || returnIdx === -1) {
    console.error('Cannot find ACCA layer boundaries');
    process.exit(1);
}

console.log(`Found ACCA layer at line ${acca6LayerIdx + 1}, return at line ${returnIdx + 1}`);

const newBuildFlow = `        // ---------------------------------------------------------------------
        // SKCS LAW: ACCA PUBLISH FLOW (uniqueness + team lock + pool rotation)
        // ---------------------------------------------------------------------
        const accaRows = [];
        const megaAccaRows = [];
        const publishedCards = [];
        const usedFixtureKeys = new Set();
        const usedTeamsWeekly = new Map();

        // Start with filtered candidate pool
        let candidatePool = filterAvailablePredictions(accaMarketCandidates, globalUsedFixtures, weekLockedTeamCompetitionMap, runTeamCompetitionMap);

        // Mega diagnostics
        const megaDiagnostics = initMegaDiagnostics();
        megaDiagnostics.mega_candidate_fixtures_before_filter = candidatePool.length;

        // Build plan: 4 x 6-leg + 1 x 12-leg
        const buildPlan = [
            { type: 'acca_6match', legCount: 6 },
            { type: 'acca_6match', legCount: 6 },
            { type: 'acca_6match', legCount: 6 },
            { type: 'acca_6match', legCount: 6 },
            { type: 'mega_acca_12', legCount: 12 },
        ];

        for (const step of buildPlan) {
            // Build candidate card from current pool
            const selections = step.legCount === 12
                ? buildMegaAcca12Candidates(candidatePool, {
                    maxRows: 1,
                    minLegConfidence: ACCA_MIN_LEG_CONFIDENCE,
                    globalUsedFixtures,
                    expiryCutoff: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)),
                })
                : buildAcca6Candidates(candidatePool, step.legCount === 6 ? categoryBuildCaps.acca_6match : 1, {
                    minLegConfidence: ACCA_MIN_LEG_CONFIDENCE,
                    globalUsedFixtures,
                });

            if (!selections || selections.length === 0) {
                if (step.legCount === 12) {
                    megaDiagnostics.mega_rejected_for_insufficient_legs += 1;
                    console.log('[accaBuilder] %s: no candidates from pool (pool_size=%s)', step.type, candidatePool.length);
                }
                continue;
            }

            const candidateRow = selections[0];

            // SKCS LAW: Card overlap rejection
            const overlapResult = exceedsCardOverlapLimit(candidateRow, publishedCards);
            if (overlapResult.reject) {
                if (step.legCount === 12) megaDiagnostics.mega_rejected_for_duplicate_overlap += 1;
                console.log('[accaBuilder] %s: card rejected for fixture overlap=%s with %s', step.type, overlapResult.overlap, overlapResult.comparedAgainst);
                continue;
            }

            // SKCS LAW: Weekly team lock check on this card
            let teamLockViolation = false;
            for (const m of (candidateRow.matches || [])) {
                const fixtureLike = {
                    home_team: m.home_team,
                    away_team: m.away_team,
                    homeTeam: m.home_team,
                    awayTeam: m.away_team,
                    competition: m.metadata?.competition || m.metadata?.league,
                    league: m.metadata?.league,
                    tournament: m.metadata?.tournament,
                    startTime: m.commence_time || m.match_date || m.metadata?.match_time,
                    kickoff: m.commence_time || m.match_date || m.metadata?.match_time,
                    date: m.commence_time || m.match_date,
                };
                if (isTeamLockedForWeek(fixtureLike, usedTeamsWeekly)) {
                    teamLockViolation = true;
                    if (step.legCount === 12) megaDiagnostics.mega_rejected_for_weekly_team_lock += 1;
                    break;
                }
            }
            if (teamLockViolation) {
                console.log('[accaBuilder] %s: card rejected by weekly team lock', step.type);
                continue;
            }

            // Accept the card
            reservePredictionFixtures(candidateRow, globalUsedFixtures);
            reservePredictionTeams(candidateRow, runTeamCompetitionMap);

            // Lock teams for weekly reuse prevention
            for (const m of (candidateRow.matches || [])) {
                const fixtureLike = {
                    home_team: m.home_team,
                    away_team: m.away_team,
                    homeTeam: m.home_team,
                    awayTeam: m.away_team,
                    competition: m.metadata?.competition || m.metadata?.league,
                    league: m.metadata?.league,
                    tournament: m.metadata?.tournament,
                    startTime: m.commence_time || m.match_date || m.metadata?.match_time,
                    kickoff: m.commence_time || m.match_date || m.metadata?.match_time,
                    date: m.commence_time || m.match_date,
                };
                lockTeamsForWeek(fixtureLike, usedTeamsWeekly);
                const key = m.match_id;
                if (key) usedFixtureKeys.add(key);
            }

            publishedCards.push(candidateRow);

            const inserted = await insertFinalRow({
                publish_run_id: publishRunId,
                tier: t,
                type: step.type,
                matches: candidateRow.matches,
                total_confidence: candidateRow.total_confidence,
                risk_level: candidateRow.risk_level,
            }, client);

            if (step.legCount === 12) {
                megaAccaRows.push(inserted);
                megaDiagnostics.mega_final_cards_built += 1;
            } else {
                accaRows.push(inserted);
            }

            // SKCS LAW: Rotate candidate pool
            candidatePool = rotateCandidatePool(candidatePool, usedFixtureKeys, usedTeamsWeekly);
            console.log('[accaBuilder] %s: card accepted, remaining_pool=%s', step.type, candidatePool.length);
        }

        // Resolve mega zero reason
        if (megaDiagnostics.mega_final_cards_built === 0) {
            megaDiagnostics.mega_zero_reason = resolveMegaZeroReason(megaDiagnostics);
        }

        console.log('[accaBuilder] 6-LEG: published=%s', accaRows.length);
        console.log('[accaBuilder] MEGA: published=%s zero_reason=%s', megaAccaRows.length, megaDiagnostics.mega_zero_reason || 'n/a');

`;

lines.splice(acca6LayerIdx, returnIdx - acca6LayerIdx, ...newBuildFlow.split('\n'));
console.log('Patch 2: Replaced build flow with proper publish cycle');

// =========================================================================
// PATCH 3: Update diagnostics block
// =========================================================================
const diagIdx = lines.findIndex(l => l.includes('TEMPORARY DIAGNOSTICS'));
if (diagIdx !== -1) {
    const diagEndIdx = lines.findIndex((l, i) => i > diagIdx && l.includes('END TEMPORARY DIAGNOSTICS'));
    if (diagEndIdx !== -1) {
        const newDiag = `        // TEMPORARY DIAGNOSTICS: SKCS ACCA Engine Law
        const allAccaCards = [...accaRows, ...megaAccaRows];
        let cardsWithFakeMath = 0;
        const cardDiagnostics = allAccaCards.map((card) => {
            const avgConf = Number(card.average_leg_confidence || 0);
            const totalConf = Number(card.total_confidence || 0);
            const isHonest = totalConf <= avgConf || avgConf === 0;
            if (!isHonest) cardsWithFakeMath++;
            return {
                type: card.type,
                legs: (card.matches || []).length,
                avgConfidence: avgConf,
                totalConfidence: totalConf,
                honest: isHonest,
                displayLabel: card.display_label || card.ticket_label || 'UNKNOWN',
            };
        });

        // Card overlap analysis across all published cards
        const pubCardSets = publishedCards.map(c => getCardFixtureKeySet(c));
        let maxOverlapFound = 0;
        for (let i = 0; i < pubCardSets.length; i++) {
            for (let j = i + 1; j < pubCardSets.length; j++) {
                if (pubCardSets[i].size !== pubCardSets[j].size) continue; // only same-type comparison
                const o = countSetOverlap(pubCardSets[i], pubCardSets[j]);
                if (o > maxOverlapFound) maxOverlapFound = o;
            }
        }

        console.log('[accaBuilder DIAGNOSTICS] tier=%s raw_fixtures_in=%s upcoming_after_filter=%s', t, valid.length, perSportLimited.length);
        console.log('[accaBuilder DIAGNOSTICS] acca_cards_built=%s mega_cards_built=%s cards_with_fake_math=%s', accaRows.length, megaAccaRows.length, cardsWithFakeMath);
        console.log('[accaBuilder DIAGNOSTICS] published_card_overlap_counts max_overlap=%s', maxOverlapFound);
        console.log('[accaBuilder DIAGNOSTICS] weekly_team_lock_hits=%s', megaDiagnostics.mega_rejected_for_weekly_team_lock);
        console.log('[accaBuilder DIAGNOSTICS] duplicate_card_rejections=see_per_step_logs_above');
        console.log('[accaBuilder DIAGNOSTICS] remaining_candidate_pool_after_each_publish=see_per_step_logs_above');
        console.log('[accaBuilder DIAGNOSTICS] mega_candidate_fixtures_before_filter=%s', megaDiagnostics.mega_candidate_fixtures_before_filter);
        console.log('[accaBuilder DIAGNOSTICS] mega_rejected_for_weekly_team_lock=%s', megaDiagnostics.mega_rejected_for_weekly_team_lock);
        console.log('[accaBuilder DIAGNOSTICS] mega_rejected_for_family_caps=%s', megaDiagnostics.mega_rejected_for_family_caps);
        console.log('[accaBuilder DIAGNOSTICS] mega_rejected_for_duplicate_overlap=%s', megaDiagnostics.mega_rejected_for_duplicate_overlap);
        console.log('[accaBuilder DIAGNOSTICS] mega_rejected_for_confidence_floor=%s', megaDiagnostics.mega_rejected_for_confidence_floor);
        console.log('[accaBuilder DIAGNOSTICS] mega_final_cards_built=%s', megaDiagnostics.mega_final_cards_built);
        console.log('[accaBuilder DIAGNOSTICS] mega_zero_reason=%s', megaDiagnostics.mega_zero_reason || 'n/a');
        console.log('[accaBuilder DIAGNOSTICS] avg_vs_total=%s', JSON.stringify(cardDiagnostics));
        // END TEMPORARY DIAGNOSTICS`;

        lines.splice(diagIdx, diagEndIdx - diagIdx + 1, ...newDiag.split('\n'));
        console.log('Patch 3: Updated diagnostics');
    }
}

// =========================================================================
// Write
// =========================================================================
content = lines.join('\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('\nAll patches applied. New line count:', content.split('\n').length);
