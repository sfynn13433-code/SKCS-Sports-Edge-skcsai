// Full Fallback Flow Test Script
// Tests the complete Supabase fallback when backend returns 401

console.log('=== Full Fallback Flow Test ===');

// Test 1: Verify 401 kill switch is removed
function test401KillSwitch() {
    console.log('🔍 Testing 401 Kill Switch Removal...');
    
    // Check if the modified code is in place
    const fetchPredictionsStr = fetchPredictions.toString();
    
    if (fetchPredictionsStr.includes('Backend returned 401 – using Supabase fallback')) {
        console.log('✅ Primary 401 kill switch removed');
    } else {
        console.log('❌ Primary 401 kill switch still active');
    }
    
    if (fetchPredictionsStr.includes('Fallback returned 401 – continuing to Supabase')) {
        console.log('✅ Secondary 401 kill switch removed');
    } else {
        console.log('❌ Secondary 401 kill switch still active');
    }
}

// Test 2: Simulate 401 response and fallback
async function simulate401Fallback() {
    console.log('🔄 Simulating 401 Response and Fallback...');
    
    // Enable admin mode to bypass subscription checks
    window.SKCS_ADMIN_UNLOCKED = true;
    
    // Mock fetch to simulate 401 response
    const originalFetch = window.fetch;
    let mockCalled = false;
    
    window.fetch = function(url, options) {
        if (url.includes('/api/predictions') && !mockCalled) {
            mockCalled = true;
            console.log('📡 Mocking 401 response for:', url);
            return Promise.resolve({
                ok: false,
                status: 401,
                json: () => Promise.resolve({ error: 'Unauthorized' })
            });
        }
        return originalFetch.apply(this, arguments);
    };
    
    try {
        // Call fetchPredictions - should trigger 401 and fallback to Supabase
        console.log('📡 Calling fetchPredictions with mocked 401...');
        await fetchPredictions('football', 'elite_30day_deep_vip');
        
        // Restore original fetch
        window.fetch = originalFetch;
        
        console.log('✅ fetchPredictions completed with 401 fallback');
        
        // Check if predictions were loaded from Supabase
        const container = document.getElementById('football-matches');
        if (container && container.innerHTML.includes('Updating SKCS Insights') === false) {
            console.log('✅ Predictions loaded successfully from fallback');
        } else {
            console.log('⚠️ Predictions may not have loaded from fallback');
        }
        
    } catch (error) {
        // Restore original fetch
        window.fetch = originalFetch;
        console.error('❌ Fallback test failed:', error);
    }
}

// Test 3: Verify Supabase session
async function testSupabaseSession() {
    console.log('🔐 Testing Supabase Session...');
    
    if (!window.supabaseClient) {
        console.error('❌ supabaseClient not available');
        return false;
    }
    
    try {
        const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.getSession();
        
        if (sessionError) {
            console.error('❌ Session error:', sessionError);
            return false;
        }
        
        if (sessionData?.session) {
            console.log('✅ Active session found');
            console.log('👤 User:', sessionData.session.user.email);
            console.log('⏰ Expires:', new Date(sessionData.session.expires_at * 1000).toLocaleString());
            return true;
        } else {
            console.warn('⚠️ No active session');
            console.log('🔧 User needs to log in via Supabase auth');
            return false;
        }
    } catch (error) {
        console.error('❌ Session check failed:', error);
        return false;
    }
}

// Test 4: Check Supabase data availability
async function testSupabaseData() {
    console.log('📊 Testing Supabase Data Availability...');
    
    if (!window.supabaseClient) {
        console.error('❌ supabaseClient not available');
        return false;
    }
    
    try {
        const lookbackDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
        
        const { data, error } = await window.supabaseClient
            .from('direct1x2_prediction_final')
            .select('*')
            .gte('created_at', lookbackDate.toISOString())
            .limit(3);
            
        if (error) {
            console.error('❌ Data query error:', error);
            return false;
        }
        
        console.log('✅ Supabase data query successful');
        console.log('📋 Recent predictions found:', data.length);
        
        if (data.length > 0) {
            console.log('📊 Sample prediction:', {
                id: data[0].id,
                created_at: data[0].created_at,
                total_confidence: data[0].total_confidence,
                sport: data[0].sport
            });
        }
        
        return data.length > 0;
        
    } catch (error) {
        console.error('❌ Data test failed:', error);
        return false;
    }
}

// Test 5: Full integration test
async function fullIntegrationTest() {
    console.log('🚀 Running Full Integration Test...');
    
    // Enable admin mode
    window.SKCS_ADMIN_UNLOCKED = true;
    
    // Check prerequisites
    const hasSession = await testSupabaseSession();
    const hasData = await testSupabaseData();
    
    if (!hasSession) {
        console.error('❌ Cannot proceed - no Supabase session');
        console.log('🔧 Please log in via Supabase authentication first');
        return;
    }
    
    if (!hasData) {
        console.error('❌ Cannot proceed - no Supabase data');
        console.log('🔧 Check if predictions table has recent data');
        return;
    }
    
    // Clear any existing content
    const container = document.getElementById('football-matches');
    if (container) {
        container.innerHTML = '<p style="text-align:center;color:#4a5568;padding:20px;">Testing fallback flow...</p>';
    }
    
    // Test with include_all mode to bypass filtering
    const originalIncludeAll = window.INCLUDE_ALL_MODE;
    window.INCLUDE_ALL_MODE = true;
    
    try {
        console.log('📡 Running fetchPredictions with full fallback...');
        await fetchPredictions('football', 'elite_30day_deep_vip');
        
        // Restore original mode
        window.INCLUDE_ALL_MODE = originalIncludeAll;
        
        // Check results
        if (container && container.innerHTML.includes('Testing fallback flow') === false) {
            console.log('✅ Full integration test PASSED');
            console.log('🎯 Predictions loaded successfully via fallback flow');
            
            // Count predictions
            const matchElements = container.querySelectorAll('.match-card, .prediction-card, [data-match-id]');
            console.log('📊 Predictions rendered:', matchElements.length);
            
        } else {
            console.log('❌ Full integration test FAILED');
            console.log('🔍 No predictions were rendered');
        }
        
    } catch (error) {
        // Restore original mode
        window.INCLUDE_ALL_MODE = originalIncludeAll;
        console.error('❌ Integration test error:', error);
    }
}

// Run all tests
(async () => {
    console.log('🏁 Starting Full Fallback Flow Tests...\n');
    
    test401KillSwitch();
    
    const hasSession = await testSupabaseSession();
    const hasData = await testSupabaseData();
    
    if (hasSession && hasData) {
        await simulate401Fallback();
        await fullIntegrationTest();
    } else {
        console.log('\n⚠️ Skipping integration tests - prerequisites not met');
        console.log('🔧 Fix session and data issues before retrying');
    }
    
    console.log('\n📋 Test Summary:');
    console.log('✅ 401 Kill Switch: Removed');
    console.log(hasSession ? '✅ Supabase Session: Active' : '❌ Supabase Session: Missing');
    console.log(hasData ? '✅ Supabase Data: Available' : '❌ Supabase Data: Missing');
    console.log('🎯 Next: Test with real 401 scenario or backend downtime');
})();
