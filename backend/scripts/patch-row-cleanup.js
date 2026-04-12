'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'services', 'accaBuilder.js');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// =========================================================================
// PATCH: Add row cleanup before inserting new rows
// Insert DELETE old rows right before the build plan loop
// =========================================================================
const buildPlanIdx = lines.findIndex(l => l.includes('Build plan: 4 x 6-leg'));
if (buildPlanIdx === -1) {
    console.error('Cannot find build plan line');
    process.exit(1);
}

console.log(`Found build plan at line ${buildPlanIdx + 1}`);

const cleanupBlock = `        // SKCS LAW: Clean stale rows for this tier before publishing new ones
        // This prevents old duplicates from accumulating in predictions_final
        await client.query(
            'DELETE FROM predictions_final WHERE tier = $1',
            [t]
        );
        console.log('[accaBuilder] Cleaned stale rows for tier=%s', t);

`;

lines.splice(buildPlanIdx, 0, ...cleanupBlock.split('\n'));
console.log('Patch: Added stale row cleanup before build cycle');

content = lines.join('\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Done. New line count:', content.split('\n').length);
