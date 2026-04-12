'use strict';

/**
 * Patch accaBuilder.js to fix:
 * 1. Card-level similarity rejection
 * 2. Weekly team lock enforcement across cards
 * 3. Candidate pool rotation after each card
 * 4. Mega ACCA diagnostics
 * 5. Required logging
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'services', 'accaBuilder.js');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// =========================================================================
// PATCH 1: Add card similarity + team lock utilities before buildFinalForTier
// =========================================================================
const buildFinalIdx = lines.findIndex(l => l.startsWith('async function buildFinalForTier'));
if (buildFinalIdx === -1) {
    console.error('Could not find buildFinalForTier');
    process.exit(1);
}

console.log(`Found buildFinalForTier at line ${buildFinalIdx + 1}`);

const newUtilities = `
/**
 * SKCS LAW: Card similarity rejection.
 * Two cards sharing more than N fixtures are duplicates and must be rejected.
 */
function countFixtureOverlap(cardA, cardB) {
    const keysA = new Set((cardA.matches || []).map(m => m.match_id || '').filter(Boolean));
    const keysB = (cardB.matches || []).map(m => m.match_id || '').filter(Boolean);
    let overlap = 0;
    for (const key of keysB) {
        if (keysA.has(key)) overlap++;
    }
    return overlap;
}

function isDuplicateCard(newCard, publishedCards, legCount) {
    // 6-leg: reject if overlap > 2 (need min 4 unique fixtures)
    // 12-leg: reject if overlap > 4 (need min 8 unique fixtures)
    const maxOverlap = legCount >= 12 ? 4 : 2;
    for (const pub of publishedCards) {
        if (countFixtureOverlap(newCard, pub) > maxOverlap) return true;
    }
    return false;
}

/**
 * SKCS LAW: Extract all team names from a card.
 */
function getTeamsFromCard(card) {
    const teams = new Set();
    for (const m of (card.matches || [])) {
        const meta = m.metadata || {};
        const home = String(m.home_team || meta.home_team || '').trim().toLowerCase();
        const away = String(m.away_team || meta.away_team || '').trim().toLowerCase();
        if (home) teams.add(home);
        if (away) teams.add(away);
    }
    return teams;
}

/**
 * SKCS LAW: Get competition key from a card.
 */
function getCompetitionFromCard(card) {
    const comps = new Set();
    for (const m of (card.matches || [])) {
        const meta = m.metadata || {};
        const comp = String(meta.competition || meta.league || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        if (comp) comps.add(comp);
    }
    return comps;
}

/**
 * SKCS LAW: Check if a candidate's teams conflict with weekly lock.
 * Returns true if the candidate has ANY team already used in the same competition this week.
 */
function candidateViolatesWeeklyLock(candidate, usedTeamsWeekly) {
    const meta = candidate.metadata || {};
    const comp = String(meta.competition || meta.league || candidate.league || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const home = String(candidate.home_team || meta.home_team || '').trim().toLowerCase();
    const away = String(candidate.away_team || meta.away_team || '').trim().toLowerCase();

    // Check home team
    if (home) {
        const compKey = \`\${comp}::\${home}\`;
        if (usedTeamsWeekly.has(compKey)) return true;
    }
    // Check away team
    if (away) {
        const compKey = \`\${comp}::\${away}\`;
        if (usedTeamsWeekly.has(compKey)) return true;
    }
    return false;
}

/**
 * SKCS LAW: Lock teams from a published card into weekly lock map.
 */
function lockTeamsFromCard(card, usedTeamsWeekly) {
    for (const m of (card.matches || [])) {
        const meta = m.metadata || {};
        const comp = String(meta.competition || meta.league || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const home = String(m.home_team || meta.home_team || '').trim().toLowerCase();
        const away = String(m.away_team || meta.away_team || '').trim().toLowerCase();
        if (home) usedTeamsWeekly.add(\`\${comp}::\${home}\`);
        if (away) usedTeamsWeekly.add(\`\${comp}::\${away}\`);
    }
}

/**
 * SKCS LAW: Remove used fixture keys from candidate pool.
 */
function removeUsedFixturesFromPool(pool, usedKeys) {
    return pool.filter(c => {
        const ids = getAccaCandidateFixtureIds(c);
        return ids.length > 0 && !ids.some(id => usedKeys.has(id));
    });
}

`;

lines.splice(buildFinalIdx, 0, ...newUtilities.split('\n'));
console.log('Patch 1: Added card similarity + team lock utilities');

// =========================================================================
// PATCH 2: Update 6-leg ACCA build loop with card uniqueness, team lock, pool rotation
// =========================================================================
// Find the 6-leg ACCA section
const acca6Idx = lines.findIndex(l => l.includes('// 1. 6-LEG ACCA LAYER'));
if (acca6Idx === -1) {
    console.error('Could not find 6-LEG ACCA section');
    process.exit(1);
}

console.log(`Found 6-leg ACCA section at line ${acca6Idx + 1}`);

// Find the entire 6-leg block from "const accaRows = [];" to before "// 2. THE MEGA ACCA"
const accaRowsIdx = lines.findIndex((l, i) => i > acca6Idx && l.includes('const accaRows = [];'));
const megaIdx = lines.findIndex((l, i) => i > accaRowsIdx && l.includes('// 2. THE MEGA ACCA'));

if (accaRowsIdx === -1 || megaIdx === -1) {
    console.error('Could not find 6-leg block boundaries');
    process.exit(1);
}

const newAcca6Block = `        // ---------------------------------------------------------------------
        // 1. 6-LEG ACCA LAYER (SKCS LAW: uniqueness + team lock + pool rotation)
        // ---------------------------------------------------------------------
        const accaRows = [];
        let accaPublishedKeys = new Set();
        let accaPublishedCards = [];
        let accaUsedTeamsWeekly = new Set(); // "competition::team" keys
        let duplicateCardRejections = 0;
        let weeklyTeamLockHits = 0;
        let remainingPoolForAcca = filterAvailablePredictions(accaMarketCandidates, globalUsedFixtures, weekLockedTeamCompetitionMap, runTeamCompetitionMap);

        const accaSelections = buildAcca6Candidates(
            remainingPoolForAcca,
            categoryBuildCaps.acca_6match,
            {
                minLegConfidence: ACCA_MIN_LEG_CONFIDENCE,
                globalUsedFixtures
            }
        );

        for (const row of accaSelections) {
            // SKCS LAW: Check card similarity
            if (isDuplicateCard(row, accaPublishedCards, 6)) {
                duplicateCardRejections++;
                console.log('[accaBuilder] 6-LEG: card rejected for fixture overlap with existing card');
                continue;
            }

            // SKCS LAW: Check weekly team lock
            const teamsInCard = getTeamsFromCard(row);
            let teamConflict = false;
            for (const m of (row.matches || [])) {
                const meta = m.metadata || {};
                const comp = String(meta.competition || meta.league || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
                const home = String(m.home_team || meta.home_team || '').trim().toLowerCase();
                const away = String(m.away_team || meta.away_team || '').trim().toLowerCase();
                if (home && accaUsedTeamsWeekly.has(\`\${comp}::\${home}\`)) { teamConflict = true; break; }
                if (away && accaUsedTeamsWeekly.has(\`\${comp}::\${away}\`)) { teamConflict = true; break; }
            }
            if (teamConflict) {
                weeklyTeamLockHits++;
                console.log('[accaBuilder] 6-LEG: card rejected by weekly team lock');
                continue;
            }

            // Accept the card
            reservePredictionFixtures(row, globalUsedFixtures);
            reservePredictionTeams(row, runTeamCompetitionMap);
            lockTeamsFromCard(row, accaUsedTeamsWeekly);
            accaPublishedCards.push(row);
            accaPublishedKeys = new Set([...accaPublishedKeys, ...row.matches.map(m => m.match_id).filter(Boolean)]);

            const inserted = await insertFinalRow({
                publish_run_id: publishRunId,
                tier: t,
                type: 'acca_6match',
                matches: row.matches,
                total_confidence: row.total_confidence,
                risk_level: row.risk_level
            }, client);
            accaRows.push(inserted);

            // SKCS LAW: Rotate candidate pool - remove used fixtures
            remainingPoolForAcca = removeUsedFixturesFromPool(remainingPoolForAcca, accaPublishedKeys);
            console.log('[accaBuilder] 6-LEG: card accepted, remaining pool size=%s', remainingPoolForAcca.length);
        }

        console.log('[accaBuilder] 6-LEG: published=%s duplicate_rejections=%s team_lock_hits=%s',
            accaRows.length, duplicateCardRejections, weeklyTeamLockHits);

`;

lines.splice(accaRowsIdx, megaIdx - accaRowsIdx, ...newAcca6Block.split('\n'));
console.log('Patch 2: Updated 6-leg ACCA build with uniqueness + team lock + pool rotation');

// =========================================================================
// PATCH 3: Update Mega ACCA build with full diagnostics
// =========================================================================
const megaRowsIdx = lines.findIndex((l, i) => i > megaIdx && l.includes('const megaAccaRows = [];'));
const multiIdx = lines.findIndex((l, i) => i > megaRowsIdx && l.includes('// 3. MULTI LAYER'));

if (megaRowsIdx === -1 || multiIdx === -1) {
    console.error('Could not find Mega ACCA block boundaries');
    process.exit(1);
}

const newMegaBlock = `        // ---------------------------------------------------------------------
        // 2. THE MEGA ACCA RESERVATION LAYER (SKCS LAW: full diagnostics)
        // ---------------------------------------------------------------------
        const megaAccaRows = [];
        let megaPublishedKeys = new Set();
        let megaPublishedCards = [];
        let megaUsedTeamsWeekly = new Set();
        let megaDuplicateRejections = 0;
        let megaTeamLockHits = 0;
        let megaCandidatePoolBefore = filterAvailablePredictions(accaMarketCandidates, globalUsedFixtures, weekLockedTeamCompetitionMap, runTeamCompetitionMap);

        console.log('[accaBuilder MEGA] candidate_fixtures_before_filter=%s', megaCandidatePoolBefore.length);

        const megaSelections = buildMegaAcca12Candidates(
            megaCandidatePoolBefore,
            {
                maxRows: categoryBuildCaps.mega_acca_12,
                minLegConfidence: ACCA_MIN_LEG_CONFIDENCE,
                globalUsedFixtures,
                expiryCutoff: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000))
            }
        );

        console.log('[accaBuilder MEGA] candidate_fixtures_after_filter=%s mega_selections_built=%s', megaCandidatePoolBefore.length, megaSelections.length);

        for (const row of megaSelections) {
            // SKCS LAW: Card similarity check
            if (isDuplicateCard(row, megaPublishedCards, 12)) {
                megaDuplicateRejections++;
                console.log('[accaBuilder MEGA: card rejected for fixture overlap');
                continue;
            }

            // SKCS LAW: Weekly team lock
            let teamConflict = false;
            for (const m of (row.matches || [])) {
                const meta = m.metadata || {};
                const comp = String(meta.competition || meta.league || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
                const home = String(m.home_team || meta.home_team || '').trim().toLowerCase();
                const away = String(m.away_team || meta.away_team || '').trim().toLowerCase();
                if (home && megaUsedTeamsWeekly.has(\`\${comp}::\${home}\`)) { teamConflict = true; break; }
                if (away && megaUsedTeamsWeekly.has(\`\${comp}::\${away}\`)) { teamConflict = true; break; }
            }
            if (teamConflict) {
                megaTeamLockHits++;
                console.log('[accaBuilder MEGA: card rejected by weekly team lock');
                continue;
            }

            // Accept
            reservePredictionFixtures(row, globalUsedFixtures);
            reservePredictionTeams(row, runTeamCompetitionMap);
            lockTeamsFromCard(row, megaUsedTeamsWeekly);
            megaPublishedCards.push(row);
            megaPublishedKeys = new Set([...megaPublishedKeys, ...row.matches.map(m => m.match_id).filter(Boolean)]);

            const inserted = await insertFinalRow({
                publish_run_id: publishRunId,
                tier: t,
                type: 'mega_acca_12',
                matches: row.matches,
                total_confidence: row.total_confidence,
                risk_level: row.risk_level
            }, client);
            megaAccaRows.push(inserted);

            megaCandidatePoolBefore = removeUsedFixturesFromPool(megaCandidatePoolBefore, megaPublishedKeys);
        }

        if (megaAccaRows.length === 0) {
            console.log('[accaBuilder MEGA] zero_cards_built - diagnostics:');
            console.log('[accaBuilder MEGA] mega_candidate_fixtures_before_filter=%s', megaCandidatePoolBefore.length);
            console.log('[accaBuilder MEGA] mega_selections_attempted=%s', megaSelections.length);
            console.log('[accaBuilder MEGA] mega_rejected_for_duplicate_overlap=%s', megaDuplicateRejections);
            console.log('[accaBuilder MEGA] mega_rejected_for_weekly_team_lock=%s', megaTeamLockHits);
            console.log('[accaBuilder MEGA] mega_final_cards_built=%s', megaAccaRows.length);
        }

        console.log('[accaBuilder MEGA: published=%s duplicate_rejections=%s team_lock_hits=%s',
            megaAccaRows.length, megaDuplicateRejections, megaTeamLockHits);

`;

lines.splice(megaRowsIdx, multiIdx - megaRowsIdx, ...newMegaBlock.split('\n'));
console.log('Patch 3: Updated Mega ACCA with full diagnostics');

// =========================================================================
// PATCH 4: Update diagnostics block to include new fields
// =========================================================================
const diagIdx = lines.findIndex(l => l.includes('TEMPORARY DIAGNOSTICS'));
if (diagIdx !== -1) {
    const diagEndIdx = lines.findIndex((l, i) => i > diagIdx && l.includes('END TEMPORARY DIAGNOSTICS'));
    if (diagEndIdx !== -1) {
        const newDiag = `        // TEMPORARY DIAGNOSTICS: SKCS ACCA Engine Law enforcement
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

        // Card overlap analysis
        const publishedCardKeys = allAccaCards.map(c => new Set((c.matches || []).map(m => m.match_id || '').filter(Boolean)));
        let maxOverlapFound = 0;
        for (let i = 0; i < publishedCardKeys.length; i++) {
            for (let j = i + 1; j < publishedCardKeys.length; j++) {
                let overlap = 0;
                for (const key of publishedCardKeys[i]) {
                    if (publishedCardKeys[j].has(key)) overlap++;
                }
                if (overlap > maxOverlapFound) maxOverlapFound = overlap;
            }
        }

        console.log('[accaBuilder DIAGNOSTICS] tier=%s', t);
        console.log('[accaBuilder DIAGNOSTICS] raw_fixtures_in=%s upcoming_after_filter=%s', valid.length, perSportLimited.length);
        console.log('[accaBuilder DIAGNOSTICS] acca_cards_built=%s duplicate_fixture_keys=%s duplicate_teams_weekly=%s cards_with_fake_math=%s', allAccaCards.length, duplicateFixtureCount, duplicateTeamsWeekly, cardsWithFakeMath);
        console.log('[accaBuilder DIAGNOSTICS] published_card_overlap_counts max_overlap=%s', maxOverlapFound);
        console.log('[accaBuilder DIAGNOSTICS] duplicate_card_rejections_6leg=%s weekly_team_lock_hits_6leg=%s', typeof duplicateCardRejections !== 'undefined' ? duplicateCardRejections : 0, typeof weeklyTeamLockHits !== 'undefined' ? weeklyTeamLockHits : 0);
        console.log('[accaBuilder DIAGNOSTICS] mega_zero_reason=%s', megaAccaRows.length === 0 ? 'see_mega_diagnostics_above' : 'n/a');
        console.log('[accaBuilder DIAGNOSTICS] avg_vs_total=%s', JSON.stringify(cardDiagnostics.map(c => ({ legs: c.legs, avg: c.avgConfidence, total: c.totalConfidence, honest: c.honest, families: c.familyCount }))));
        console.log('[accaBuilder DIAGNOSTICS] card_details=%s', JSON.stringify(cardDiagnostics));
        // END TEMPORARY DIAGNOSTICS`;

        lines.splice(diagIdx, diagEndIdx - diagIdx + 1, ...newDiag.split('\n'));
        console.log('Patch 4: Updated diagnostics with card overlap + new fields');
    }
}

// =========================================================================
// Write
// =========================================================================
content = lines.join('\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('\nAll card-uniqueness patches applied');
console.log('New line count:', content.split('\n').length);
