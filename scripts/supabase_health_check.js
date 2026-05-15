// Supabase Health Check Script
// Paste this directly into DevTools on a page where supabaseClient is initialised

console.log('=== Supabase Health Check ===');

// Check 1: Verify supabaseClient is available
if (!window.supabaseClient) {
    console.error('❌ window.supabaseClient is undefined');
    console.log('🔧 Check: supabase-init.js loaded and SUPABASE_URL configured');
} else {
    console.log('✅ window.supabaseClient is available');
}

// Check 2: Verify SUPABASE_URL and anon key are configured
if (!window.SUPABASE_URL) {
    console.error('❌ window.SUPABASE_URL is not defined');
    console.log('🔧 Check: config.js or inline script before DOMContentLoaded');
} else {
    console.log('✅ SUPABASE_URL:', window.SUPABASE_URL);
}

if (!window.SUPABASE_ANON_KEY) {
    console.error('❌ window.SUPABASE_ANON_KEY is not defined');
    console.log('🔧 Check: config.js or inline script before DOMContentLoaded');
} else {
    console.log('✅ SUPABASE_ANON_KEY is configured');
}

// Check 3: Test Supabase connectivity and permissions
async function testSupabaseConnection() {
    if (!window.supabaseClient) {
        console.log('⏭️ Skipping Supabase test - client not available');
        return;
    }

    try {
        console.log('🔍 Testing Supabase connection...');
        
        // Test 1: Basic connectivity
        const { data: basicData, error: basicError } = await window.supabaseClient
            .from('direct1x2_prediction_final')
            .select('*')
            .limit(1);
            
        console.log('📊 Basic test results:');
        console.log('  Data rows:', basicData?.length || 0);
        console.log('  Error:', basicError);
        
        if (basicError) {
            if (basicError.code === '42501' || basicError.message.includes('permission denied') || basicError.message.includes('rls_or_auth_denied')) {
                console.error('❌ RLS Permission Denied');
                console.log('🔧 Fix: Create RLS policy or temporarily disable RLS');
                console.log('💡 SQL: CREATE POLICY "Allow authenticated select" ON direct1x2_prediction_final FOR SELECT USING (auth.role() = \'authenticated\');');
                console.log('💡 Or: ALTER TABLE direct1x2_prediction_final DISABLE ROW LEVEL SECURITY;');
            } else {
                console.error('❌ Other Supabase error:', basicError);
            }
        } else {
            console.log('✅ Supabase connectivity OK');
            console.log('✅ RLS permissions OK');
        }
        
        // Test 2: Check authentication status
        const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.getSession();
        
        console.log('🔐 Authentication status:');
        if (sessionError) {
            console.error('❌ Session error:', sessionError);
        } else if (sessionData?.session) {
            console.log('✅ User authenticated:', sessionData.session.user.email);
            console.log('✅ Session expires:', new Date(sessionData.session.expires_at * 1000).toLocaleString());
        } else {
            console.warn('⚠️ No active session - user not logged in');
            console.log('🔧 Fix: User needs to log in via Supabase auth');
        }
        
        // Test 3: Test with recent predictions
        const lookbackDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
        const { data: recentData, error: recentError } = await window.supabaseClient
            .from('direct1x2_prediction_final')
            .select('*')
            .gte('created_at', lookbackDate.toISOString())
            .limit(5);
            
        console.log('📅 Recent predictions test:');
        console.log('  Recent rows:', recentData?.length || 0);
        console.log('  Error:', recentError);
        
        if (recentData && recentData.length > 0) {
            console.log('✅ Recent data available');
            console.log('📋 Sample prediction:', {
                id: recentData[0].id,
                created_at: recentData[0].created_at,
                total_confidence: recentData[0].total_confidence,
                sport: recentData[0].sport
            });
        } else {
            console.warn('⚠️ No recent predictions found');
            console.log('🔧 Check: Data exists in table and created_at filters are correct');
        }
        
    } catch (error) {
        console.error('❌ Supabase test failed:', error);
    }
}

// Check 4: Test fetchPredictions fallback flow
async function testFetchPredictionsFallback() {
    console.log('🔄 Testing fetchPredictions fallback flow...');
    
    // Set admin mode to bypass subscription checks
    window.SKCS_ADMIN_UNLOCKED = true;
    
    // Test the function if it exists
    if (typeof fetchPredictions === 'function') {
        try {
            console.log('📡 Calling fetchPredictions with admin mode...');
            await fetchPredictions('football', 'elite_30day_deep_vip');
            console.log('✅ fetchPredictions completed');
        } catch (error) {
            console.error('❌ fetchPredictions error:', error);
        }
    } else {
        console.warn('⚠️ fetchPredictions function not found');
    }
}

// Run all tests
(async () => {
    await testSupabaseConnection();
    await testFetchPredictionsFallback();
    
    console.log('\n=== Summary ===');
    console.log('📋 If all tests pass, the Supabase fallback should work');
    console.log('📋 If RLS permission denied, implement the suggested SQL policies');
    console.log('📋 If no session, ensure user is logged in via Supabase auth');
    console.log('📋 If no data, check table exists and has recent predictions');
})();
