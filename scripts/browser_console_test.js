// Browser Console Test for SMB v2.0
// Paste this into browser console to test Gulf in Class engine

console.log('=== SMB Gulf in Class Browser Test ===');

// Test data - Man City vs Sheffield United
const testMatch = {
    homeTeam: 'Manchester City',
    awayTeam: 'Sheffield United',
    homeTeamAlpha: 1.91,
    homeTeamBeta: 0.87,
    awayTeamAlpha: 0.61,
    awayTeamBeta: 1.64,
    gamma: 1.0,
    h2hSampleSize: 12,
    winProb: 0.82,
    availableMarkets: [
        'home_win', 'over_2_5', 'over_3_5', 'home_over_1_5_team_goals',
        'home_over_4_5_corners', 'home_over_6_5_corners', 'striker_1_sot',
        'opp_keeper_2_saves', 'opp_keeper_3_saves', 'lead_at_ht',
        'win_both_halves', 'home_clean_sheet', 'btts_no'
    ]
};

// Test Gulf calculation
if (typeof calculateGulfInClass === 'function') {
    const gulf = calculateGulfInClass(testMatch);
    console.log(`🔥 Gulf in Class: ${gulf.toFixed(2)}`);
    
    const maxLegs = getMaxLegsAllowed(testMatch);
    console.log(`📊 Max legs allowed: ${maxLegs}`);
    
    if (maxLegs === 8) {
        console.log('✅ Gulf in Class Detected - 8-leg tab unlocked!');
        console.log('🎯 Expected EdgeMind message: "Gulf in Class Detected. Expected goal difference >4.0. Extreme 8‑leg story unlocked."');
    } else if (maxLegs === 6) {
        console.log('⚡ Strong dominance detected - 6-leg tab unlocked!');
    } else {
        console.log('🔒 Limited dominance - lower leg count only');
    }
} else {
    console.log('❌ calculateGulfInClass function not found - check SMB implementation');
}

// Test SMB widget rendering
if (typeof renderSMBWidget === 'function') {
    const widget = renderSMBWidget(testMatch);
    console.log('🎛️ SMB Widget Structure:', widget);
    
    console.log(`📑 Tabs available: ${widget.tabs.length}`);
    widget.tabs.forEach(tab => {
        console.log(`  Tab ${tab.count}: ${tab.active ? 'ACTIVE' : 'DISABLED'} ${tab.disabled ? '(Greyed out)' : ''}`);
        if (tab.tooltip) console.log(`    Tooltip: "${tab.tooltip}"`);
    });
    
    if (widget.gulfUnlocked) {
        console.log('🚀 EdgeMind message should show Gulf unlock');
    }
} else {
    console.log('❌ renderSMBWidget function not found');
}

// Test contradiction validation
if (typeof validateSMBLegs === 'function') {
    console.log('\n🔍 Testing Contradiction Validation:');
    
    // Test 1: Valid combo
    const validCombo = [
        { type: 'match', market: 'home_win', confidence: 0.82 },
        { type: 'goals', market: 'over_2_5', confidence: 0.75 },
        { type: 'corners', market: 'home_over_4_5_corners', confidence: 0.68 },
        { type: 'player', market: 'striker_1_sot', confidence: 0.71 }
    ];
    
    const validResult = validateSMBLegs(validCombo, '1');
    console.log('✅ Valid combo result:', validResult.valid ? 'PASSED' : 'FAILED');
    
    // Test 2: Contradictory combo
    const contradictoryCombo = [
        { type: 'match', market: 'home_win', confidence: 0.82 },
        { type: 'match', market: 'away_clean_sheet', confidence: 0.45 }
    ];
    
    const contradictoryResult = validateSMBLegs(contradictoryCombo, '1');
    console.log('❌ Contradictory combo result:', contradictoryResult.valid ? 'FAILED' : 'PASSED');
    
    if (contradictoryResult.errors.length > 0) {
        console.log('🚫 Error message:', contradictoryResult.errors[0].message);
        console.log('💡 Suggestion:', contradictoryResult.suggestions[0]);
    }
} else {
    console.log('❌ validateSMBLegs function not found');
}

// Test SMB combo generation
if (typeof generatePrebuiltSMB === 'function') {
    console.log('\n🎲 Testing SMB Combo Generation:');
    
    for (let legs = 4; legs <= 8; legs += 2) {
        const combos = generatePrebuiltSMB(testMatch, legs);
        console.log(`📊 ${legs}-leg combos generated: ${combos.length}`);
        
        if (combos.length > 0) {
            combos.forEach((combo, index) => {
                console.log(`  Combo ${index + 1}: ${(combo.confidence * 100).toFixed(1)}% confidence, Tier ${combo.tier}`);
            });
        }
    }
} else {
    console.log('❌ generatePrebuiltSMB function not found');
}

// Test confidence calculation
if (typeof calculateSMBConfidence === 'function') {
    console.log('\n🧮 Testing SMB Confidence Calculation:');
    
    const testLegs = [
        { market: 'home_win', confidence: 0.82 },
        { market: 'over_2_5', confidence: 0.75 },
        { market: 'striker_1_sot', confidence: 0.71 }
    ];
    
    const jointConfidence = calculateSMBConfidence(testLegs, 12);
    console.log(`📈 Joint confidence for 3 legs: ${(jointConfidence * 100).toFixed(1)}%`);
    console.log(`🎯 Expected: ~${(0.82 * 0.75 * 0.71 * 100).toFixed(1)}% (independent) vs correlated result`);
} else {
    console.log('❌ calculateSMBConfidence function not found');
}

console.log('\n🏁 SMB Browser Console Test Complete!');
console.log('📋 Expected Results:');
console.log('  • Gulf in Class: ~2.60 (Man City vs Sheffield)');
console.log('  • Max legs: 6 (strong dominance)');
console.log('  • Contradiction validation: should block home_win + away_clean_sheet');
console.log('  • SMB combos: 4, 6, 8-leg variants generated');
console.log('  • Joint confidence: correlated calculation applied');
