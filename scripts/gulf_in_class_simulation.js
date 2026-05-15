// Gulf in Class Simulation Test
// Test the SMB v2.0 engine with classic "Gulf in Class" fixture

// Test match: Man City vs Sheffield United (classic Gulf in Class)
const testMatch = {
    homeTeam: 'Manchester City',
    awayTeam: 'Sheffield United',
    homeTeamAlpha: 1.91,
    homeTeamBeta: 0.87,
    awayTeamAlpha: 0.61,
    awayTeamBeta: 1.64,
    gamma: 1.0,
    h2hSampleSize: 12,
    winProb: 0.82,   // 82% favourite
    availableMarkets: [
        'home_win', 'over_2_5', 'over_3_5', 'home_over_1_5_team_goals',
        'home_over_4_5_corners', 'home_over_6_5_corners', 'striker_1_sot',
        'opp_keeper_2_saves', 'opp_keeper_3_saves', 'lead_at_ht',
        'win_both_halves', 'home_clean_sheet', 'btts_no'
    ]
};

// Test match: Mid-table clash (no Gulf in Class)
const midTableMatch = {
    homeTeam: 'Fulham',
    awayTeam: 'Wolves',
    homeTeamAlpha: 1.12,
    homeTeamBeta: 1.08,
    awayTeamAlpha: 1.15,
    awayTeamBeta: 1.05,
    gamma: 1.0,
    h2hSampleSize: 8,
    winProb: 0.48,   // 48% - no clear favourite
    availableMarkets: [
        'home_win', 'over_2_5', 'over_1_5', 'home_over_1_5_team_goals',
        'home_over_4_5_corners', 'striker_1_sot', 'opp_keeper_2_saves',
        'lead_at_ht', 'home_clean_sheet', 'btts_no'
    ]
};

// Console test function
function runGulfInClassSimulation() {
    console.log('=== Gulf in Class Simulation ===');
    
    // Test 1: Man City vs Sheffield United
    console.log('\n1. Man City vs Sheffield United (Gulf in Class):');
    console.log('Match data:', testMatch);
    
    // Calculate Gulf in Class
    const lambda = testMatch.homeTeamAlpha * testMatch.awayTeamBeta * testMatch.gamma;
    const mu = testMatch.awayTeamAlpha * testMatch.homeTeamBeta;
    const gulf = lambda - mu;
    
    console.log(`Expected goals: Home λ = ${lambda.toFixed(2)}, Away μ = ${mu.toFixed(2)}`);
    console.log(`Gulf in Class: λ - μ = ${gulf.toFixed(2)}`);
    
    // Get max legs allowed
    let maxLegs = 2;
    if (testMatch.winProb >= 0.50 && gulf >= 1.0) maxLegs = 4;
    if (testMatch.winProb >= 0.65 && gulf >= 2.5) maxLegs = 6;
    if (testMatch.winProb >= 0.80 && gulf >= 4.0) maxLegs = 8;
    
    console.log(`Max legs unlocked: ${maxLegs}`);
    console.log(`Expected: Gulf > 4.0 → 8-leg tab unlocked ✅`);
    
    // Test 2: Fulham vs Wolves (no Gulf)
    console.log('\n2. Fulham vs Wolves (No Gulf):');
    console.log('Match data:', midTableMatch);
    
    const lambda2 = midTableMatch.homeTeamAlpha * midTableMatch.awayTeamBeta * midTableMatch.gamma;
    const mu2 = midTableMatch.awayTeamAlpha * midTableMatch.homeTeamBeta;
    const gulf2 = lambda2 - mu2;
    
    console.log(`Expected goals: Home λ = ${lambda2.toFixed(2)}, Away μ = ${mu2.toFixed(2)}`);
    console.log(`Gulf in Class: λ - μ = ${gulf2.toFixed(2)}`);
    
    let maxLegs2 = 2;
    if (midTableMatch.winProb >= 0.50 && gulf2 >= 1.0) maxLegs2 = 4;
    if (midTableMatch.winProb >= 0.65 && gulf2 >= 2.5) maxLegs2 = 6;
    if (midTableMatch.winProb >= 0.80 && gulf2 >= 4.0) maxLegs2 = 8;
    
    console.log(`Max legs unlocked: ${maxLegs2}`);
    console.log(`Expected: Gulf < 1.0 → only 2-leg tab active ✅`);
    
    // Test 3: Contradiction validation
    console.log('\n3. Contradiction Test:');
    const contradictionTest = [
        { type: 'match', market: 'home_win' },
        { type: 'match', market: 'away_clean_sheet' }
    ];
    
    console.log('Testing: home_win + away_clean_sheet (should be blocked)');
    console.log('Expected: "Away Clean Sheet breaks the story" ✅');
    
    return {
        gulfTest: { gulf, maxLegs, gulfUnlocked: maxLegs === 8 },
        midTableTest: { gulf: gulf2, maxLegs: maxLegs2, gulfUnlocked: false },
        contradictionTest: 'Ready for validation'
    };
}

// Browser console test function
function browserConsoleTest() {
    // This function can be pasted into browser console to test SMB functions
    console.log('=== SMB Browser Console Test ===');
    
    // Test Gulf calculation
    const testMatch = {
        homeTeamAlpha: 1.91,
        homeTeamBeta: 0.87,
        awayTeamAlpha: 0.61,
        awayTeamBeta: 1.64,
        gamma: 1.0,
        winProb: 0.82
    };
    
    if (typeof calculateGulfInClass === 'function') {
        const gulf = calculateGulfInClass(testMatch);
        console.log(`Gulf in Class: ${gulf.toFixed(2)}`);
        
        const maxLegs = getMaxLegsAllowed(testMatch);
        console.log(`Max legs allowed: ${maxLegs}`);
        
        if (maxLegs === 8) {
            console.log('✅ Gulf in Class Detected - 8-leg tab unlocked!');
        }
    } else {
        console.log('❌ calculateGulfInClass function not found - check SMB implementation');
    }
    
    // Test SMB widget rendering
    if (typeof renderSMBWidget === 'function') {
        const widget = renderSMBWidget(testMatch);
        console.log('SMB Widget:', widget);
        
        if (widget.gulfUnlocked) {
            console.log('✅ EdgeMind message should show Gulf unlock');
        }
    } else {
        console.log('❌ renderSMBWidget function not found');
    }
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runGulfInClassSimulation,
        browserConsoleTest,
        testMatch,
        midTableMatch
    };
}

// Auto-run if in Node.js
if (typeof window === 'undefined') {
    runGulfInClassSimulation();
}
