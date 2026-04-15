'use strict';

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'backend', 'routes');

// Files to analyze
const routeFiles = [
    'predictions.js',
    'chat.js',
    'debug.js',
    'vip.js',
    'pipeline.js',
    'accuracy.js',
    'user.js'
];

// Tables we care about
const TABLES = [
    'predictions_final', 'predictions_filtered', 'predictions_raw',
    'normalized_fixtures', 'predictions_stage_1', 'predictions_stage_2', 'predictions_stage_3',
    'subscription_plans', 'scheduling_logs', 'prediction_publish_runs',
    'events', 'canonical_events', 'canonical_entities'
];

console.log('═'.repeat(70));
console.log('   API ROUTES DATABASE ACCESS ANALYSIS');
console.log('═'.repeat(70) + '\n');

for (const file of routeFiles) {
    const filePath = path.join(routesDir, file);
    if (!fs.existsSync(filePath)) continue;
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log(`\n📁 ${file}`);
    console.log('─'.repeat(60));
    
    // Find all table references
    const tableRefs = {};
    for (const table of TABLES) {
        const regex = new RegExp(`(?:from|into|update|delete\\s+from|join)\\s+['"\`]?${table}['"\`]?`, 'gi');
        const matches = content.match(regex);
        if (matches) {
            tableRefs[table] = matches.length;
        }
    }
    
    // Find Supabase queries
    const supabaseRefs = [];
    const supabasePattern = /\.from\(['"\`]([^'"\`]+)['"\`]\)/g;
    let match;
    while ((match = supabasePattern.exec(content)) !== null) {
        supabaseRefs.push(match[1]);
    }
    
    // Find SQL queries
    const sqlRefs = [];
    const sqlPattern = /pool\.query\(|await\s+db\.|await\s+query\(/g;
    while ((match = sqlPattern.exec(content)) !== null) {
        sqlRefs.push('SQL query');
    }
    
    // Find plan visibility usage
    const hasVisibilityCheck = content.includes('plan_visibility') || content.includes('planVisibility');
    const hasSubscriptionCheck = content.includes('subscription') || content.includes('subscription_plan');
    
    // Report
    if (Object.keys(tableRefs).length > 0 || supabaseRefs.length > 0) {
        console.log('   Tables accessed:');
        for (const [table, count] of Object.entries(tableRefs)) {
            console.log(`     - ${table}: ${count} references`);
        }
        
        if (supabaseRefs.length > 0) {
            const uniqueSupabase = [...new Set(supabaseRefs)];
            console.log('   Supabase queries:');
            uniqueSupabase.forEach(t => console.log(`     - ${t}`));
        }
        
        console.log('   SQL queries: ' + sqlRefs.length);
        console.log('   Visibility filtering: ' + (hasVisibilityCheck ? '✅' : '❌'));
        console.log('   Subscription logic: ' + (hasSubscriptionCheck ? '✅' : '❌'));
    } else {
        console.log('   (No database access)');
    }
}

console.log('\n' + '═'.repeat(70));
console.log('   SUMMARY: ROUTES NEEDING UPDATES');
console.log('═'.repeat(70));

// Check for routes that access predictions_final but don't filter by visibility
const predictionsPath = path.join(routesDir, 'predictions.js');
if (fs.existsSync(predictionsPath)) {
    const content = fs.readFileSync(predictionsPath, 'utf8');
    
    const hasPredictionsFinal = content.includes('predictions_final');
    const hasVisibilityFilter = content.includes('plan_visibility');
    const hasSubscriptionPlans = content.includes('subscription_plans');
    
    console.log('\n📁 predictions.js:');
    console.log(`   Accesses predictions_final: ${hasPredictionsFinal ? '✅' : '❌'}`);
    console.log(`   Filters by plan_visibility: ${hasVisibilityFilter ? '✅' : '❌'}`);
    console.log(`   Uses subscription_plans: ${hasSubscriptionPlans ? '✅' : '❌'}`);
    
    if (hasPredictionsFinal && !hasVisibilityFilter) {
        console.log('\n   ⚠️  NEEDS UPDATE: Add visibility filtering to predictions_final queries');
    }
}

console.log('\n' + '═'.repeat(70));
