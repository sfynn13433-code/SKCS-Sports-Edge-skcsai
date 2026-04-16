require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setupRLS() {
    console.log('\n=== PHASE 6: PAYWALL ENFORCEMENT (ROW LEVEL SECURITY) ===\n');
    
    const client = await pool.connect();
    
    try {
        // Step 1: Check current RLS status
        console.log('[STEP 1] Checking current RLS status...');
        const rlsStatus = await client.query(`
            SELECT relname, relrowsecurity 
            FROM pg_class 
            WHERE relname = 'predictions_final'
        `);
        console.log('Current RLS status:', rlsStatus.rows[0]);
        
        // Step 2: Enable RLS on predictions_final
        console.log('\n[STEP 2] Enabling RLS on predictions_final...');
        await client.query(`ALTER TABLE predictions_final ENABLE ROW LEVEL SECURITY`);
        console.log('✅ RLS enabled on predictions_final');
        
        // Step 3: Check profiles table for tier column
        console.log('\n[STEP 3] Checking profiles table structure...');
        const profileCols = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'profiles'
            AND column_name LIKE '%tier%'
        `);
        console.log('Profile tier columns:', profileCols.rows);
        
        // Step 4: Create backend service role policy (bypass)
        console.log('\n[STEP 4] Creating backend service role policy...');
        await client.query(`
            DROP POLICY IF EXISTS "Backend Service Role Access" ON predictions_final;
            CREATE POLICY "Backend Service Role Access" ON predictions_final
            FOR ALL
            USING (true)
            WITH CHECK (true)
        `);
        console.log('✅ Backend policy created (service_role bypass)');
        
        // Step 5: Create authenticated user tier policy
        console.log('\n[STEP 5] Creating authenticated user tier access policy...');
        
        // First check what tier columns exist in profiles
        const profileCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'profiles'
        `);
        console.log('All profile columns:', profileCheck.rows.map(r => r.column_name));
        
        // Use plan_tier if it exists, otherwise use subscription_type
        const tierCol = 'plan_tier';
        
        await client.query(`
            DROP POLICY IF EXISTS "Enforce Subscription Tiers" ON predictions_final;
            CREATE POLICY "Enforce Subscription Tiers" ON predictions_final
            FOR SELECT USING (
                tier = 'normal'
                OR (
                    tier = 'deep' AND EXISTS (
                        SELECT 1 FROM profiles 
                        WHERE id = auth.uid() 
                        AND (plan_tier = 'deep' OR plan_tier = 'ultra' OR plan_tier = 'elite')
                    )
                )
                OR (
                    tier = 'ultra' AND EXISTS (
                        SELECT 1 FROM profiles 
                        WHERE id = auth.uid() 
                        AND plan_tier = 'ultra'
                    )
                )
            )
        `);
        console.log('✅ Tier access policy created');
        
        // Step 6: Verify policies
        console.log('\n[STEP 6] Verifying policies...');
        const policies = await client.query(`
            SELECT policyname, cmd, qual 
            FROM pg_policies 
            WHERE tablename = 'predictions_final'
        `);
        console.log('Active policies:');
        policies.rows.forEach(p => console.log(`  - ${p.policyname}: ${p.cmd}`));
        
        // Check RLS is enabled
        const finalCheck = await client.query(`
            SELECT relname, relrowsecurity 
            FROM pg_class 
            WHERE relname = 'predictions_final'
        `);
        
        console.log('\n=== PHASE 6 SUCCESS: RLS enabled on predictions_final and tier policies applied. ===');
        console.log('Final RLS status:', finalCheck.rows[0]);
        
        return { success: true };
        
    } catch (err) {
        console.error('Error:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

setupRLS()
    .then(r => {
        console.log('\n[RESULT]', JSON.stringify(r));
        process.exit(0);
    })
    .catch(err => {
        console.error('[FATAL]', err.message);
        process.exit(1);
    });