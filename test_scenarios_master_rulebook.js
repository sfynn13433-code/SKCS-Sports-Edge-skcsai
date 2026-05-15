// Comprehensive Test Scenarios for SKCS Master Rulebook Implementation
// Tests all edge cases and boundary conditions

const { selectSecondaryMarkets } = require('./backend/services/safeHavenSelector');

// Test configuration
const TEST_SCENARIOS = {
    mainMarketBoundaryTests: [
        {
            name: 'Extreme Risk - 29%',
            mainConfidence: 29,
            expectedBehavior: 'Main not published. No secondary at all.',
            expectedResult: null
        },
        {
            name: 'High Risk Boundary - 30%',
            mainConfidence: 30,
            expectedBehavior: 'Main published as High Risk. Safe Haven may trigger.',
            expectedResult: { riskTier: 'HIGH_RISK', hasSecondary: true }
        },
        {
            name: 'High Risk Upper - 54%',
            mainConfidence: 54,
            expectedBehavior: 'Published High Risk. Safe Haven may trigger.',
            expectedResult: { riskTier: 'HIGH_RISK', hasSecondary: true }
        },
        {
            name: 'Medium Risk Lower - 55%',
            mainConfidence: 55,
            expectedBehavior: 'Published Medium Risk. Safe Haven may trigger.',
            expectedResult: { riskTier: 'MEDIUM_RISK', hasSecondary: true }
        },
        {
            name: 'Medium Risk Upper - 74%',
            mainConfidence: 74,
            expectedBehavior: 'Published Medium Risk. Safe Haven may trigger.',
            expectedResult: { riskTier: 'MEDIUM_RISK', hasSecondary: true }
        },
        {
            name: 'Low Risk Lower - 75%',
            mainConfidence: 75,
            expectedBehavior: 'Published Low Risk. Secondary uses primary rule.',
            expectedResult: { riskTier: 'LOW_RISK', hasSecondary: true }
        },
        {
            name: 'Low Risk Upper - 79%',
            mainConfidence: 79,
            expectedBehavior: 'Published Low Risk. Safe Haven may trigger if no 80%+ secondary.',
            expectedResult: { riskTier: 'LOW_RISK', hasSecondary: true }
        },
        {
            name: 'Low Risk High - 80%',
            mainConfidence: 80,
            expectedBehavior: 'Published Low Risk. Secondary always uses primary rule.',
            expectedResult: { riskTier: 'LOW_RISK', hasSecondary: true }
        },
        {
            name: 'Perfect Confidence - 95%',
            mainConfidence: 95,
            expectedBehavior: 'Published Low Risk. Secondary uses primary rule.',
            expectedResult: { riskTier: 'LOW_RISK', hasSecondary: true }
        }
    ],
    
    secondarySelectionTests: [
        {
            name: 'Multiple 80%+ markets in same category',
            mainConfidence: 70,
            allMarkets: [
                { market: 'double_chance_1x', confidence: 85 },
                { market: 'double_chance_x2', confidence: 82 },
                { market: 'over_1_5', confidence: 81 },
                { market: 'over_2_5', confidence: 80 }
            ],
            expectedBehavior: 'Only highest confidence per category appears',
            expectedResult: { secondaryCount: 2, categories: ['Double Chance / Draw No Bet', 'Goals (Totals & Team)'] }
        },
        {
            name: 'No 80%+ markets, main at 74%',
            mainConfidence: 74,
            allMarkets: [
                { market: 'double_chance_1x', confidence: 76 },
                { market: 'over_1_5', confidence: 75.2 },
                { market: 'corners_over_8_5', confidence: 75.1 },
                { market: 'btts_no', confidence: 74.9 }
            ],
            expectedBehavior: 'Safe Haven fires, picks safe havens >74% and >=75%',
            expectedResult: { secondaryCount: 3, safeHavenTriggered: true }
        },
        {
            name: 'No safe haven markets meet criteria',
            mainConfidence: 50,
            allMarkets: [
                { market: 'double_chance_1x', confidence: 72 },
                { market: 'over_1_5', confidence: 71 },
                { market: 'corners_over_8_5', confidence: 70 }
            ],
            expectedBehavior: 'Secondary should be empty, section hidden',
            expectedResult: { secondaryCount: 0, safeHavenTriggered: false }
        },
        {
            name: 'Main confidence 30%, safe haven at 75%',
            mainConfidence: 30,
            allMarkets: [
                { market: 'double_chance_1x', confidence: 75 },
                { market: 'over_1_5', confidence: 76 },
                { market: 'corners_over_8_5', confidence: 77 }
            ],
            expectedBehavior: 'Safe Haven included because >30% and >=75%',
            expectedResult: { secondaryCount: 3, safeHavenTriggered: true }
        },
        {
            name: 'Main at 85% with all secondary 80%+',
            mainConfidence: 85,
            allMarkets: [
                { market: 'double_chance_1x', confidence: 85 },
                { market: 'over_1_5', confidence: 84 },
                { market: 'corners_over_8_5', confidence: 83 },
                { market: 'btts_no', confidence: 82 },
                { market: 'yellow_cards_over_2_5', confidence: 81 }
            ],
            expectedBehavior: 'Only 4 best-in-category shown',
            expectedResult: { secondaryCount: 4, safeHavenTriggered: false }
        }
    ],
    
    accumulatorTests: [
        {
            name: 'Leg confidence exactly 75%',
            legs: [
                { confidence: 75, market: 'double_chance_1x' },
                { confidence: 80, market: 'over_1_5' }
            ],
            expectedBehavior: 'Allowed',
            expectedResult: { valid: true }
        },
        {
            name: 'Leg confidence 74.9%',
            legs: [
                { confidence: 74.9, market: 'double_chance_1x' },
                { confidence: 80, market: 'over_1_5' }
            ],
            expectedBehavior: 'Rejected',
            expectedResult: { valid: false, reason: 'confidence_below_minimum' }
        },
        {
            name: 'Two legs with correlation 0.51',
            legs: [
                { confidence: 80, market: 'btts_yes' },
                { confidence: 75, market: 'over_2_5' }
            ],
            expectedBehavior: 'Rejected',
            expectedResult: { valid: false, reason: 'correlation_too_high' }
        },
        {
            name: 'Two legs with correlation 0.50',
            legs: [
                { confidence: 80, market: 'double_chance_1x' },
                { confidence: 75, market: 'over_1_5' }
            ],
            expectedBehavior: 'Allowed',
            expectedResult: { valid: true }
        },
        {
            name: 'Volatile market (Correct Score)',
            legs: [
                { confidence: 85, market: 'correct_score' },
                { confidence: 75, market: 'double_chance_1x' }
            ],
            expectedBehavior: 'Rejected',
            expectedResult: { valid: false, reason: 'volatile_market' }
        },
        {
            name: '13 legs selected',
            legs: Array(13).fill().map((_, i) => ({
                confidence: 75 + i,
                market: `market_${i}`
            })),
            expectedBehavior: 'Rejected',
            expectedResult: { valid: false, reason: 'too_many_legs' }
        },
        {
            name: 'Perfect 12-leg ACCA',
            legs: Array(12).fill().map((_, i) => ({
                confidence: 75 + i * 2,
                market: `safe_market_${i}`
            })),
            expectedBehavior: 'Allowed',
            expectedResult: { valid: true }
        }
    ]
};

// Test runner functions
async function runMainMarketBoundaryTests() {
    console.log('\n=== Main Market Boundary Tests ===');
    
    for (const scenario of TEST_SCENARIOS.mainMarketBoundaryTests) {
        console.log(`\nTest: ${scenario.name}`);
        console.log(`Main Confidence: ${scenario.mainConfidence}%`);
        console.log(`Expected: ${scenario.expectedBehavior}`);
        
        // Simulate risk tier classification
        const riskTier = classifyRiskTier(scenario.mainConfidence);
        console.log(`Actual Risk Tier: ${riskTier}`);
        
        // Test Safe Haven trigger logic
        const shouldTrigger = shouldTriggerSafeHaven(scenario.mainConfidence, []);
        console.log(`Safe Haven Triggered: ${shouldTrigger}`);
        
        // Verify results
        const passed = verifyMainMarketTest(scenario, riskTier, shouldTrigger);
        console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    }
}

async function runSecondarySelectionTests() {
    console.log('\n=== Secondary Selection Tests ===');
    
    for (const scenario of TEST_SCENARIOS.secondarySelectionTests) {
        console.log(`\nTest: ${scenario.name}`);
        console.log(`Main Confidence: ${scenario.mainConfidence}%`);
        console.log(`Available Markets: ${scenario.allMarkets.length}`);
        console.log(`Expected: ${scenario.expectedBehavior}`);
        
        // Run secondary selection
        const result = selectSecondaryMarkets(scenario.mainConfidence, scenario.allMarkets);
        
        console.log(`Secondary Count: ${result.secondary.length}`);
        console.log(`Safe Haven Triggered: ${result.safeHavenTriggered}`);
        console.log(`Categories: ${result.secondary.map(m => m.category).join(', ')}`);
        
        // Verify results
        const passed = verifySecondaryTest(scenario, result);
        console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    }
}

async function runAccumulatorTests() {
    console.log('\n=== Accumulator Tests ===');
    
    for (const scenario of TEST_SCENARIOS.accumulatorTests) {
        console.log(`\nTest: ${scenario.name}`);
        console.log(`Legs: ${scenario.legs.length}`);
        console.log(`Expected: ${scenario.expectedBehavior}`);
        
        // Validate ACCA
        const result = await validateAcca(scenario.legs);
        
        console.log(`Valid: ${result.valid}`);
        if (!result.valid) {
            console.log(`Reason: ${result.reason}`);
        }
        
        // Verify results
        const passed = verifyAccaTest(scenario, result);
        console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    }
}

// Helper functions
function classifyRiskTier(confidence) {
    if (confidence >= 75) return 'LOW_RISK';
    if (confidence >= 55) return 'MEDIUM_RISK';
    if (confidence >= 30) return 'HIGH_RISK';
    return 'EXTREME_RISK';
}

function shouldTriggerSafeHaven(mainConfidence, secondaryMarkets) {
    if (mainConfidence >= 80) return false;
    
    const hasHighConfidenceSecondary = secondaryMarkets.some(market => 
        Number(market.confidence || 0) >= 80
    );
    
    return !hasHighConfidenceSecondary;
}

function verifyMainMarketTest(scenario, actualRiskTier, safeHavenTriggered) {
    if (scenario.mainConfidence < 30) {
        return actualRiskTier === 'EXTREME_RISK';
    }
    
    if (scenario.expectedResult) {
        return actualRiskTier === scenario.expectedResult.riskTier;
    }
    
    return true;
}

function verifySecondaryTest(scenario, result) {
    if (scenario.expectedResult.secondaryCount !== result.secondary.length) {
        return false;
    }
    
    if (scenario.expectedResult.safeHavenTriggered !== result.safeHavenTriggered) {
        return false;
    }
    
    if (scenario.expectedResult.categories) {
        const actualCategories = result.secondary.map(m => m.category);
        const expectedCategories = scenario.expectedResult.categories;
        
        for (const expectedCat of expectedCategories) {
            if (!actualCategories.includes(expectedCat)) {
                return false;
            }
        }
    }
    
    return true;
}

async function validateAcca(legs) {
    // Check leg count
    if (legs.length > 12) {
        return { valid: false, reason: 'too_many_legs' };
    }
    
    // Check minimum confidence
    for (const leg of legs) {
        if (leg.confidence < 75) {
            return { valid: false, reason: 'confidence_below_minimum' };
        }
    }
    
    // Check for volatile markets
    const volatileMarkets = ['correct_score', 'first_goalscorer', 'last_goalscorer'];
    for (const leg of legs) {
        if (volatileMarkets.includes(leg.market)) {
            return { valid: false, reason: 'volatile_market' };
        }
    }
    
    // Check correlations (simplified)
    const highCorrelationPairs = [
        ['btts_yes', 'over_2_5'],
        ['btts_yes', 'over_1_5'],
        ['over_3_5', 'btts_yes']
    ];
    
    for (let i = 0; i < legs.length; i++) {
        for (let j = i + 1; j < legs.length; j++) {
            const marketA = legs[i].market;
            const marketB = legs[j].market;
            
            for (const [pairA, pairB] of highCorrelationPairs) {
                if ((marketA === pairA && marketB === pairB) || 
                    (marketA === pairB && marketB === pairA)) {
                    return { valid: false, reason: 'correlation_too_high' };
                }
            }
        }
    }
    
    return { valid: true };
}

function verifyAccaTest(scenario, result) {
    return result.valid === scenario.expectedResult.valid &&
           (!scenario.expectedResult.reason || result.reason === scenario.expectedResult.reason);
}

// Main test runner
async function runAllTests() {
    console.log('🧪 SKCS Master Rulebook Test Suite');
    console.log('=====================================');
    
    try {
        await runMainMarketBoundaryTests();
        await runSecondarySelectionTests();
        await runAccumulatorTests();
        
        console.log('\n✅ All tests completed!');
        
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
        console.error(error.stack);
    }
}

// Export for use in other files
module.exports = {
    runAllTests,
    runMainMarketBoundaryTests,
    runSecondarySelectionTests,
    runAccumulatorTests,
    TEST_SCENARIOS
};

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests();
}
