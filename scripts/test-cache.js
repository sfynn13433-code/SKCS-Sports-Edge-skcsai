require('dotenv').config();

const { fetchWithWaterfall } = require('../backend/utils/rapidApiWaterfall');

async function test() {
    console.log('\n=== TESTING CACHE SYSTEM ===\n');
    
    // First call - should miss cache
    console.log('\n--- FIRST CALL (expect CACHE MISS) ---');
    const result1 = await fetchWithWaterfall('/v1/news', { query: 'football' }, 'TIER_3', 15000);
    console.log('First call result:', result1 ? 'SUCCESS' : 'FAILED');
    
    // Second call - should hit cache
    console.log('\n--- SECOND CALL (expect CACHE HIT) ---');
    const result2 = await fetchWithWaterfall('/v1/news', { query: 'football' }, 'TIER_3', 15000);
    console.log('Second call result:', result2 ? 'SUCCESS' : 'FAILED');
    
    // Check cache table
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const cacheCount = await pool.query('SELECT COUNT(*) as cnt FROM rapidapi_cache');
    console.log('\nCache table count:', cacheCount.rows[0].cnt);
    await pool.end();
    
    process.exit(0);
}

test().catch(e => { console.error(e.message); process.exit(1); });