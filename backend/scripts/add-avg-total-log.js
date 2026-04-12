'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'services', 'accaBuilder.js');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the END TEMPORARY DIAGNOSTICS comment and insert the avg_vs_total log before it
const endIdx = lines.findIndex(l => l.includes('// END TEMPORARY DIAGNOSTICS'));

if (endIdx === -1) {
    console.error('Could not find END TEMPORARY DIAGNOSTICS');
    process.exit(1);
}

console.log(`Inserting avg_vs_total log before line ${endIdx + 1}`);

const avgVsTotalLog = `        const avgVsTotal = allAccaCards.map((c) => ({ legs: (c.matches || []).length, avg: Number(c.average_leg_confidence || 0), total: Number(c.total_confidence || 0) }));
        console.log('[accaBuilder DIAGNOSTICS] avg_vs_total=%s', JSON.stringify(avgVsTotal));`;

lines.splice(endIdx, 0, avgVsTotalLog);
content = lines.join('\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('avg_vs_total diagnostic inserted successfully');
console.log('New line count:', content.split('\n').length);
