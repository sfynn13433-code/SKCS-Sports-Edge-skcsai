'use strict';

/**
 * PATCH SCRIPT: Add plan_visibility filtering to other routes
 */

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'backend', 'routes');

const routes = ['vip.js', 'debug.js', 'accuracy.js'];

console.log('═'.repeat(60));
console.log('   PATCHING OTHER ROUTES FOR VISIBILITY FILTERING');
console.log('═'.repeat(60) + '\n');

for (const route of routes) {
    const routePath = path.join(routesDir, route);
    if (!fs.existsSync(routePath)) {
        console.log(`⚠ ${route}: File not found, skipping`);
        continue;
    }
    
    let content = fs.readFileSync(routePath, 'utf8');
    
    // Check if already patched
    if (content.includes('planVisibilityCheck')) {
        console.log(`✓ ${route}: Already patched`);
        continue;
    }
    
    console.log(`\nProcessing ${route}...`);
    
    // Check if it accesses predictions_final
    if (!content.includes('predictions_final')) {
        console.log(`  ℹ ${route}: Does not access predictions_final, skipping`);
        continue;
    }
    
    // Add helper function near the top of the file
    const helperFunction = `
// Visibility filtering helpers
function planVisibilityCheck(planId, visibilityArray) {
    if (!planId || !Array.isArray(visibilityArray) || visibilityArray.length === 0) return false;
    if (visibilityArray.includes(planId)) return true;
    const normalizedPlan = normalizePlanId ? normalizePlanId(planId) : planId;
    if (!normalizedPlan) return false;
    if (normalizedPlan.includes('elite') || normalizedPlan.includes('deep')) return true;
    if (normalizedPlan.includes('core') || normalizedPlan.includes('normal')) {
        return visibilityArray.some(v => v.includes('core') || v.includes('normal') || v.includes('4day') || v.includes('9day') || v.includes('14day') || v.includes('30day'));
    }
    return false;
}

function filterByVisibility(predictions, planId, isAdmin = false) {
    if (isAdmin || !planId || planId.includes('admin')) return predictions;
    return predictions.filter(pred => {
        const visibility = pred.plan_visibility;
        if (!visibility || !Array.isArray(visibility) || visibility.length === 0) return true;
        return planVisibilityCheck(planId, visibility);
    });
}

`;
    
    // Try to insert after requires
    const requireMatch = content.match(/(const .+ = require\(.+\);?\n)/);
    if (requireMatch) {
        const insertIndex = requireMatch.index + requireMatch[0].length;
        content = content.slice(0, insertIndex) + helperFunction + content.slice(insertIndex);
        console.log(`  ✓ Added helper functions`);
    }
    
    // Try to add filtering where predictions array is assigned
    const patterns = [
        { old: 'predictions = data;', new: 'predictions = filterByVisibility(data, planId, isAdmin);' },
        { old: 'predictions = rows;', new: 'predictions = filterByVisibility(rows, planId, isAdmin);' },
        { old: 'const predictions = data;', new: 'const predictions = filterByVisibility(data, planId, isAdmin);' },
        { old: 'const predictions = rows;', new: 'const predictions = filterByVisibility(rows, planId, isAdmin);' },
    ];
    
    let patched = false;
    for (const p of patterns) {
        if (content.includes(p.old) && !content.includes(p.new)) {
            content = content.replace(p.old, p.new);
            console.log(`  ✓ Added filter (pattern: "${p.old}")`);
            patched = true;
            break;
        }
    }
    
    if (patched) {
        fs.writeFileSync(routePath, content);
        console.log(`  ✓ Saved ${route}`);
    } else {
        console.log(`  ⚠ Could not find prediction assignment pattern in ${route}`);
    }
}

console.log('\n' + '═'.repeat(60));
console.log('   PATCHING COMPLETE');
console.log('═'.repeat(60));
console.log(`
Summary:
───────────────────────────────────────────────────────────────────────
Added visibility filtering to routes that access predictions_final.
The filterByVisibility() function checks:
  - Elite plans: see ALL predictions
  - Core plans: see predictions with core visibility
  - Admin: sees everything
  - Legacy (no visibility): visible to all
───────────────────────────────────────────────────────────────────────
`);
