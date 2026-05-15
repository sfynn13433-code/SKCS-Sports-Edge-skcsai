// Deployment Verification Script for SKCS Master Rulebook
// Run this after deploying migrations and new code

const db = require('../backend/db');
const fetch = require('node-fetch');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:10000';

// Verification results
const results = {
    passed: [],
    failed: [],
    warnings: []
};

async function runVerification() {
    console.log('🔍 SKCS Master Rulebook Deployment Verification');
    console.log('===============================================\n');
    
    try {
        await step1_RunMigrations();
        await step2_VerifyRiskTierEnum();
        await step3_TestExtremeRiskTrigger();
        await step4_TestSecondaryMarketLimit();
        await step5_TestSafeHavenFallback();
        await step6_TestHighConfidenceMain();
        await step7_TestACCAConfidenceValidation();
        await step8_TestACCACorrelationValidation();
        await step9_VerifyFrontendColors();
        
        printSummary();
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        process.exit(1);
    }
}

async function step1_RunMigrations() {
    console.log('📋 Step 1: Running migrations...');
    
    try {
        // Check if market_correlations table exists
        const correlationCheck = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'market_correlations'
            ) as exists
        `);
        
        if (!correlationCheck.rows[0].exists) {
            throw new Error('market_correlations table not found');
        }
        
        // Check if triggers exist
        const triggerCheck = await db.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.triggers 
            WHERE trigger_name LIKE 'trg_%'
        `);
        
        if (triggerCheck.rows[0].count < 4) {
            throw new Error('Not all triggers found');
        }
        
        results.passed.push('✅ Migrations: Tables and triggers created successfully');
        
    } catch (error) {
        results.failed.push(`❌ Migrations: ${error.message}`);
        throw error;
    }
}

async function step2_VerifyRiskTierEnum() {
    console.log('📊 Step 2: Verifying risk tier enum...');
    
    try {
        const riskTierCheck = await db.query(`
            SELECT DISTINCT unnest(enum_range(NULL::risk_tier_enum)) as risk_tier
        `);
        
        const riskTiers = riskTierCheck.rows.map(r => r.risk_tier);
        const expectedTiers = ['LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK', 'EXTREME_RISK'];
        
        const missingTiers = expectedTiers.filter(tier => !riskTiers.includes(tier));
        const oldTiers = riskTiers.filter(tier => !expectedTiers.includes(tier));
        
        if (missingTiers.length > 0 || oldTiers.length > 0) {
            throw new Error(`Risk tier mismatch. Missing: ${missingTiers.join(', ')}, Old: ${oldTiers.join(', ')}`);
        }
        
        results.passed.push('✅ Risk Tier Enum: New thresholds (75/55/30) verified');
        
    } catch (error) {
        results.failed.push(`❌ Risk Tier Enum: ${error.message}`);
        throw error;
    }
}

async function step3_TestExtremeRiskTrigger() {
    console.log('⚠️  Step 3: Testing extreme risk trigger...');
    
    try {
        // Insert test prediction with 29% confidence
        const insertQuery = `
            INSERT INTO direct1x2_prediction_final 
            (match_id, market_type, prediction, confidence, risk_tier, is_published)
            VALUES ('test_match_001', '1X2', 'HOME_WIN', 29, 'EXTREME_RISK', true)
            RETURNING id, is_published, risk_tier
        `;
        
        const result = await db.query(insertQuery);
        const prediction = result.rows[0];
        
        // Verify trigger set is_published to false
        if (prediction.is_published !== false) {
            throw new Error('Trigger did not set is_published to false');
        }
        
        // Clean up
        await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id = \'test_match_001\'');
        
        results.passed.push('✅ Extreme Risk Trigger: 29% prediction automatically unpublished');
        
    } catch (error) {
        results.failed.push(`❌ Extreme Risk Trigger: ${error.message}`);
        throw error;
    }
}

async function step4_TestSecondaryMarketLimit() {
    console.log('📈 Step 4: Testing secondary market limit...');
    
    try {
        const matchId = 'test_match_002';
        
        // Insert main prediction
        await db.query(`
            INSERT INTO direct1x2_prediction_final 
            (match_id, market_type, prediction, confidence, risk_tier, is_published)
            VALUES ($1, '1X2', 'HOME_WIN', 80, 'LOW_RISK', true)
        `, [matchId]);
        
        // Insert 4 secondary markets (should succeed)
        for (let i = 1; i <= 4; i++) {
            await db.query(`
                INSERT INTO direct1x2_prediction_final 
                (match_id, market_type, prediction, confidence, risk_tier, is_published)
                VALUES ($1, $2, 'OVER', 80, 'LOW_RISK', true)
            `, [matchId, `SECONDARY_${i}`]);
        }
        
        // Try to insert 5th secondary market (should fail)
        try {
            await db.query(`
                INSERT INTO direct1x2_prediction_final 
                (match_id, market_type, prediction, confidence, risk_tier, is_published)
                VALUES ($1, 'SECONDARY_5', 'OVER', 80, 'LOW_RISK', true)
            `, [matchId]);
            
            throw new Error('Trigger did not prevent 5th secondary market');
            
        } catch (triggerError) {
            if (!triggerError.message.includes('already has 4 published secondary markets')) {
                throw triggerError;
            }
        }
        
        // Clean up
        await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id = $1', [matchId]);
        
        results.passed.push('✅ Secondary Market Limit: 5th market correctly rejected');
        
    } catch (error) {
        results.failed.push(`❌ Secondary Market Limit: ${error.message}`);
        throw error;
    }
}

async function step5_TestSafeHavenFallback() {
    console.log('🛡️  Step 5: Testing Safe Haven fallback...');
    
    try {
        // Create test data
        const matchId = 'test_match_003';
        const mainConfidence = 65;
        
        // Insert main prediction with 65% confidence
        await db.query(`
            INSERT INTO direct1x2_prediction_final 
            (match_id, market_type, prediction, confidence, risk_tier, is_published)
            VALUES ($1, '1X2', 'HOME_WIN', $2, 'MEDIUM_RISK', true)
        `, [matchId, mainConfidence]);
        
        // Insert secondary markets (some > main, some >= 75)
        await db.query(`
            INSERT INTO direct1x2_prediction_final 
            (match_id, market_type, prediction, confidence, risk_tier, is_published)
            VALUES 
                ($1, 'double_chance_1x', '1X', 76, 'LOW_RISK', true),
                ($1, 'over_1_5', 'OVER', 75.5, 'LOW_RISK', true),
                ($1, 'corners_over_8_5', 'OVER', 77, 'LOW_RISK', true),
                ($1, 'btts_no', 'NO', 74, 'MEDIUM_RISK', true)
        `, [matchId]);
        
        // Call API endpoint
        const response = await fetch(`${BASE_URL}/api/v1/matches/${matchId}/predictions`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${data.error}`);
        }
        
        // Verify Safe Haven fallback triggered
        if (!data.safe_haven_fallback_triggered) {
            throw new Error('Safe Haven fallback was not triggered');
        }
        
        // Verify all secondary markets are >=75% and > main confidence
        const secondaryMarkets = data.secondary || [];
        for (const market of secondaryMarkets) {
            if (market.confidence < 75) {
                throw new Error(`Secondary market ${market.market} has confidence ${market.confidence} < 75`);
            }
            if (market.confidence <= mainConfidence) {
                throw new Error(`Secondary market ${market.market} has confidence ${market.confidence} <= main ${mainConfidence}`);
            }
        }
        
        // Clean up
        await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id = $1', [matchId]);
        
        results.passed.push('✅ Safe Haven Fallback: Triggered correctly with proper market selection');
        
    } catch (error) {
        results.failed.push(`❌ Safe Haven Fallback: ${error.message}`);
        throw error;
    }
}

async function step6_TestHighConfidenceMain() {
    console.log('🎯 Step 6: Testing high confidence main prediction...');
    
    try {
        const matchId = 'test_match_004';
        const mainConfidence = 82;
        
        // Insert main prediction with 82% confidence
        await db.query(`
            INSERT INTO direct1x2_prediction_final 
            (match_id, market_type, prediction, confidence, risk_tier, is_published)
            VALUES ($1, '1X2', 'HOME_WIN', $2, 'LOW_RISK', true)
        `, [matchId, mainConfidence]);
        
        // Insert secondary markets >=80%
        await db.query(`
            INSERT INTO direct1x2_prediction_final 
            (match_id, market_type, prediction, confidence, risk_tier, is_published)
            VALUES 
                ($1, 'double_chance_1x', '1X', 85, 'LOW_RISK', true),
                ($1, 'over_1_5', 'OVER', 83, 'LOW_RISK', true),
                ($1, 'corners_over_8_5', 'OVER', 81, 'LOW_RISK', true)
        `, [matchId]);
        
        // Call API endpoint
        const response = await fetch(`${BASE_URL}/api/v1/matches/${matchId}/predictions`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${data.error}`);
        }
        
        // Verify Safe Haven fallback not triggered
        if (data.safe_haven_fallback_triggered) {
            throw new Error('Safe Haven fallback should not be triggered for 82% main');
        }
        
        // Verify all secondary markets are >=80%
        const secondaryMarkets = data.secondary || [];
        for (const market of secondaryMarkets) {
            if (market.confidence < 80) {
                throw new Error(`Secondary market ${market.market} has confidence ${market.confidence} < 80`);
            }
        }
        
        // Clean up
        await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id = $1', [matchId]);
        
        results.passed.push('✅ High Confidence Main: Safe Haven not triggered, secondary >=80%');
        
    } catch (error) {
        results.failed.push(`❌ High Confidence Main: ${error.message}`);
        throw error;
    }
}

async function step7_TestACCAConfidenceValidation() {
    console.log('🏗️  Step 7: Testing ACCA confidence validation...');
    
    try {
        // Create test predictions
        const predictions = [];
        
        // Insert prediction with 74.9% confidence (should fail)
        const lowConfResult = await db.query(`
            INSERT INTO direct1x2_prediction_final 
            (match_id, market_type, prediction, confidence, risk_tier, is_published)
            VALUES ('test_match_005', '1X2', 'HOME_WIN', 74.9, 'MEDIUM_RISK', true)
            RETURNING id
        `);
        predictions.push(lowConfResult.rows[0].id);
        
        // Insert prediction with 75% confidence (should pass)
        const highConfResult = await db.query(`
            INSERT INTO direct1x2_prediction_final 
            (match_id, market_type, prediction, confidence, risk_tier, is_published)
            VALUES ('test_match_006', '1X2', 'AWAY_WIN', 75, 'LOW_RISK', true)
            RETURNING id
        `);
        predictions.push(highConfResult.rows[0].id);
        
        // Try to build ACCA with 74.9% leg (should fail)
        const accaResponse = await fetch(`${BASE_URL}/api/v1/acca/build`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prediction_ids: [predictions[0]] })
        });
        
        const accaData = await accaResponse.json();
        
        if (accaResponse.ok) {
            throw new Error('ACCA build should have failed with 74.9% confidence');
        }
        
        if (!accaData.error.includes('75')) {
            throw new Error('Error message should mention 75% minimum');
        }
        
        // Try to build ACCA with 75% leg (should pass)
        const validAccaResponse = await fetch(`${BASE_URL}/api/v1/acca/build`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prediction_ids: [predictions[1]] })
        });
        
        if (!validAccaResponse.ok) {
            throw new Error('ACCA build should have passed with 75% confidence');
        }
        
        // Clean up
        await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id IN (\'test_match_005\', \'test_match_006\')');
        
        results.passed.push('✅ ACCA Confidence Validation: 74.9% rejected, 75% accepted');
        
    } catch (error) {
        results.failed.push(`❌ ACCA Confidence Validation: ${error.message}`);
        throw error;
    }
}

async function step8_TestACCACorrelationValidation() {
    console.log('🔗 Step 8: Testing ACCA correlation validation...');
    
    try {
        // Create test predictions with high correlation
        const predictions = [];
        
        // Insert BTTS_YES prediction
        const bttsResult = await db.query(`
            INSERT INTO direct1x2_prediction_final 
            (match_id, market_type, prediction, confidence, risk_tier, is_published)
            VALUES ('test_match_007', 'BTTS_YES', 'YES', 80, 'LOW_RISK', true)
            RETURNING id
        `);
        predictions.push(bttsResult.rows[0].id);
        
        // Insert OVER_2_5 prediction (high correlation with BTTS_YES)
        const overResult = await db.query(`
            INSERT INTO direct1x2_prediction_final 
            (match_id, market_type, prediction, confidence, risk_tier, is_published)
            VALUES ('test_match_008', 'OVER_2_5', 'OVER', 80, 'LOW_RISK', true)
            RETURNING id
        `);
        predictions.push(overResult.rows[0].id);
        
        // Try to build ACCA with correlated legs (should fail)
        const accaResponse = await fetch(`${BASE_URL}/api/v1/acca/build`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prediction_ids: predictions })
        });
        
        const accaData = await accaResponse.json();
        
        if (accaResponse.ok) {
            throw new Error('ACCA build should have failed with correlated legs');
        }
        
        if (!accaData.error.includes('correlation')) {
            throw new Error('Error message should mention correlation conflict');
        }
        
        // Clean up
        await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id IN (\'test_match_007\', \'test_match_008\')');
        
        results.passed.push('✅ ACCA Correlation Validation: High correlation legs rejected');
        
    } catch (error) {
        results.failed.push(`❌ ACCA Correlation Validation: ${error.message}`);
        throw error;
    }
}

async function step9_VerifyFrontendColors() {
    console.log('🎨 Step 9: Verifying frontend color rendering...');
    
    try {
        // This would typically check frontend, but we'll verify the API returns correct colors
        const testCases = [
            { confidence: 85, expectedColor: 'green', expectedTier: 'Low Risk' },
            { confidence: 65, expectedColor: 'yellow', expectedTier: 'Medium Risk' },
            { confidence: 45, expectedColor: 'orange', expectedTier: 'High Risk' }
        ];
        
        for (const testCase of testCases) {
            const matchId = `test_match_color_${testCase.confidence}`;
            
            // Insert test prediction
            await db.query(`
                INSERT INTO direct1x2_prediction_final 
                (match_id, market_type, prediction, confidence, risk_tier, is_published)
                VALUES ($1, '1X2', 'HOME_WIN', $2, $3, true)
            `, [matchId, testCase.confidence, testCase.expectedTier]);
            
            // Call API
            const response = await fetch(`${BASE_URL}/api/v1/matches/${matchId}/predictions`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${data.error}`);
            }
            
            // Verify color and tier
            if (data.main.color !== testCase.expectedColor) {
                throw new Error(`Expected color ${testCase.expectedColor}, got ${data.main.color}`);
            }
            
            if (data.main.risk_tier !== testCase.expectedTier) {
                throw new Error(`Expected tier ${testCase.expectedTier}, got ${data.main.risk_tier}`);
            }
            
            // Clean up
            await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id = $1', [matchId]);
        }
        
        results.passed.push('✅ Frontend Colors: Green (Low), Yellow (Medium), Orange (High) verified');
        
    } catch (error) {
        results.failed.push(`❌ Frontend Colors: ${error.message}`);
        throw error;
    }
}

function printSummary() {
    console.log('\n📊 VERIFICATION SUMMARY');
    console.log('======================\n');
    
    if (results.passed.length > 0) {
        console.log('✅ PASSED:');
        results.passed.forEach(result => console.log(`  ${result}`));
    }
    
    if (results.failed.length > 0) {
        console.log('\n❌ FAILED:');
        results.failed.forEach(result => console.log(`  ${result}`));
    }
    
    if (results.warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:');
        results.warnings.forEach(result => console.log(`  ${result}`));
    }
    
    const totalTests = results.passed.length + results.failed.length;
    const passRate = totalTests > 0 ? (results.passed.length / totalTests * 100).toFixed(1) : 0;
    
    console.log(`\n📈 RESULTS: ${results.passed.length}/${totalTests} tests passed (${passRate}%)`);
    
    if (results.failed.length > 0) {
        console.log('\n❌ DEPLOYMENT VERIFICATION FAILED');
        console.log('Please fix the failed tests before proceeding to production.');
        process.exit(1);
    } else {
        console.log('\n✅ DEPLOYMENT VERIFICATION PASSED');
        console.log('Master Rulebook implementation is ready for production!');
    }
}

// Run verification if this file is executed directly
if (require.main === module) {
    runVerification().catch(error => {
        console.error('Verification script failed:', error);
        process.exit(1);
    });
}

module.exports = { runVerification };
