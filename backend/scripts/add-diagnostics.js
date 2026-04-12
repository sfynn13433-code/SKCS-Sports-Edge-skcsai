'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'services', 'accaBuilder.js');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the console.log line for the build summary and the return statement after it
const logLineIdx = lines.findIndex(l => l.includes("console.log('[accaBuilder] tier=%s week_locked="));
const returnIdx = lines.findIndex((l, i) => i > logLineIdx && l.trim() === 'return {');

if (logLineIdx === -1 || returnIdx === -1) {
    console.error('Could not find insertion points');
    console.error('logLineIdx:', logLineIdx, 'returnIdx:', returnIdx);
    process.exit(1);
}

console.log(`Inserting diagnostics between lines ${logLineIdx + 1} and ${returnIdx + 1}`);

const diagnosticsBlock = `
        // TEMPORARY DIAGNOSTICS: Stabilization pass — remove after one clean deploy cycle
        const allAccaCards = [...accaRows, ...megaAccaRows];
        const allFixtureKeys = [];
        let cardsWithFakeMath = 0;
        const cardDiagnostics = allAccaCards.map((card) => {
            const cardMatches = card.matches || [];
            const fixtureKeys = cardMatches.map((m) => m.match_id).filter(Boolean);
            allFixtureKeys.push(...fixtureKeys);
            const avgConf = Number(card.average_leg_confidence || 0);
            const totalConf = Number(card.total_confidence || 0);
            const isHonest = totalConf <= avgConf || avgConf === 0;
            if (!isHonest) cardsWithFakeMath++;
            return {
                type: card.type,
                legs: cardMatches.length,
                avgConfidence: avgConf,
                totalConfidence: totalConf,
                honest: isHonest,
                displayLabel: card.display_label || card.ticket_label || 'UNKNOWN',
                diversityBreakdown: card.diversity_breakdown || null,
            };
        });
        const uniqueFixtureKeys = new Set(allFixtureKeys);
        const duplicateFixtureCount = allFixtureKeys.length - uniqueFixtureKeys.size;

        console.log('[accaBuilder DIAGNOSTICS] tier=%s', t);
        console.log('[accaBuilder DIAGNOSTICS] raw_fixtures_in=%s upcoming_after_filter=%s', valid.length, perSportLimited.length);
        console.log('[accaBuilder DIAGNOSTICS] acca_cards_built=%s duplicate_fixture_keys=%s cards_with_fake_math=%s', allAccaCards.length, duplicateFixtureCount, cardsWithFakeMath);
        console.log('[accaBuilder DIAGNOSTICS] card_details=%s', JSON.stringify(cardDiagnostics));
        // END TEMPORARY DIAGNOSTICS
`;

// Insert before the return statement
lines.splice(returnIdx, 0, diagnosticsBlock);
content = lines.join('\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Diagnostics block inserted successfully');
console.log('New line count:', content.split('\n').length);
