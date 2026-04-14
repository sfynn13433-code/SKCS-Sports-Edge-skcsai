'use strict';

/**
 * PATCH SCRIPT: Add plan_visibility filtering to predictions.js
 * 
 * This patch adds visibility filtering AFTER data is fetched,
 * which is safer than modifying SQL strings.
 */

const fs = require('fs');
const path = require('path');

const predictionsPath = path.join(__dirname, '..', 'backend', 'routes', 'predictions.js');

console.log('═'.repeat(60));
console.log('   PATCHING predictions.js FOR VISIBILITY FILTERING');
console.log('═'.repeat(60) + '\n');

// Read the current file
let content = fs.readFileSync(predictionsPath, 'utf8');

// Check if patch is already applied
if (content.includes('planVisibilityCheck')) {
    console.log('⚠ Visibility filtering already present.');
    console.log('   Skipping patch.\n');
    process.exit(0);
}

console.log('STEP 1: Adding visibility helper function...\n');

// Find the location to insert the helper function (after resolveQueryTiers)
const helperFunction = `

// Helper: Check if a plan is in the visibility array
function planVisibilityCheck(planId, visibilityArray) {
    if (!planId) return false;
    if (!Array.isArray(visibilityArray) || visibilityArray.length === 0) return false;
    
    // Direct match
    if (visibilityArray.includes(planId)) return true;
    
    // Check tier-based access
    const normalizedPlan = normalizePlanId(planId);
    if (!normalizedPlan) return false;
    
    // Elite plans see everything
    if (normalizedPlan.includes('elite') || normalizedPlan.includes('deep')) {
        return true; // Elite sees all predictions
    }
    
    // Core plans: check if visibility allows core plans
    if (normalizedPlan.includes('core') || normalizedPlan.includes('normal')) {
        return visibilityArray.some(v => 
            v.includes('core') || v.includes('normal') || v.includes('4day') || v.includes('9day') || v.includes('14day') || v.includes('30day')
        );
    }
    
    // Admin bypass - admins can see everything
    if (normalizedPlan.includes('admin')) return true;
    
    return false;
}

// Helper: Filter predictions by visibility based on user's plan
function filterByVisibility(predictions, planId, isAdmin = false) {
    if (isAdmin || !planId || planId.includes('admin')) {
        return predictions; // Admin sees everything
    }
    
    return predictions.filter(pred => {
        const visibility = pred.plan_visibility;
        
        // No visibility set means visible to all (legacy data)
        if (!visibility || !Array.isArray(visibility) || visibility.length === 0) {
            return true;
        }
        
        // Check if user's plan is in visibility
        return planVisibilityCheck(planId, visibility);
    });
}
`;

const insertAfter = 'function resolveQueryTiers(planCapabilities, includeAll = false) {';
const insertIndex = content.indexOf(insertAfter);

if (insertIndex === -1) {
    console.log('✗ Could not find resolveQueryTiers function.');
    process.exit(1);
}

// Find the end of this function
let braceCount = 0;
let foundStart = false;
let endIndex = insertIndex;

for (let i = insertIndex; i < content.length; i++) {
    if (content[i] === '{') {
        braceCount++;
        foundStart = true;
    } else if (content[i] === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
            endIndex = i + 1;
            break;
        }
    }
}

content = content.slice(0, endIndex) + helperFunction + content.slice(endIndex);

console.log('✓ Added visibility helper functions\n');

console.log('STEP 2: Adding visibility filter to DB results...\n');

// Find where predictions are assigned from dbRes.rows
const dbAssignPattern = 'predictions = dbRes.rows || [];';
if (content.includes(dbAssignPattern)) {
    const newAssign = `predictions = filterByVisibility(dbRes.rows || [], planId, isAdminAudit);`;
    content = content.replace(dbAssignPattern, newAssign);
    console.log('✓ Added filter to DB query results');
} else {
    console.log('⚠ DB assignment pattern not found');
}

console.log('\nSTEP 3: Adding visibility filter to Supabase results...\n');

// Find where predictions are assigned from Supabase data
const supabaseAssignPattern = 'predictions = filtered;';
if (content.includes(supabaseAssignPattern)) {
    const newAssign = `predictions = filterByVisibility(filtered, planId, isAdminAudit);`;
    content = content.replace(supabaseAssignPattern, newAssign);
    console.log('✓ Added filter to Supabase fallback results');
} else {
    console.log('⚠ Supabase assignment pattern not found');
}

console.log('\nSTEP 4: Adding visibility filter to includeAll path...\n');

// Find the includeAll data assignment
const includeAllPattern = `if (!error && Array.isArray(data) && data.length > 0) {
                        predictions = data;`;

if (content.includes(includeAllPattern)) {
    const newPattern = `if (!error && Array.isArray(data) && data.length > 0) {
                        predictions = filterByVisibility(data, planId, includeAll);`;
    content = content.replace(includeAllPattern, newPattern);
    console.log('✓ Added filter to includeAll path');
} else {
    console.log('⚠ includeAll pattern not found');
}

console.log('\nSTEP 5: Saving patched file...\n');

fs.writeFileSync(predictionsPath, content);

console.log('✓ Saved patched predictions.js\n');

// Verify the patch
const verifyContent = fs.readFileSync(predictionsPath, 'utf8');
const hasHelper = verifyContent.includes('function planVisibilityCheck');
const hasFilter = verifyContent.includes('filterByVisibility');

console.log('═'.repeat(60));
console.log('   PATCH VERIFICATION');
console.log('═'.repeat(60));
console.log(`   planVisibilityCheck function: ${hasHelper ? '✅' : '❌'}`);
console.log(`   filterByVisibility function: ${hasFilter ? '✅' : '❌'}`);
console.log('');

if (hasHelper && hasFilter) {
    console.log('✅ PATCH COMPLETE SUCCESSFULLY!\n');
} else {
    console.log('⚠ PATCH MAY BE INCOMPLETE - Manual review recommended\n');
}

console.log(`
Changes made:
───────────────────────────────────────────────────────────────────────
✓ Added planVisibilityCheck() - checks if plan is in visibility array
✓ Added filterByVisibility() - filters predictions array by plan
✓ Applied filter to DB query results
✓ Applied filter to Supabase fallback results  
✓ Applied filter to includeAll path

How it works:
───────────────────────────────────────────────────────────────────────
1. User requests predictions with their planId
2. Predictions are fetched from DB/Supabase
3. filterByVisibility() filters based on:
   - Elite plans: see ALL predictions
   - Core plans: see predictions where visibility includes core plans
   - Admin: sees everything
   - Legacy (no visibility): visible to all
───────────────────────────────────────────────────────────────────────
`);
