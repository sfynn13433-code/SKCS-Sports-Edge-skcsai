const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runPipeline() {
    console.log('=== CHECKING UPCOMING FIXTURES ===');
    console.log('API Key Set:', !!process.env.X_APISPORTS_KEY);
    
    const axios = require('axios');
    const apiKey = process.env.X_APISPORTS_KEY;
    
    // Check upcoming for next 7 days
    for (let i = 0; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        try {
            const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
                params: { date: dateStr, league: 39 }, // England Premier League
                headers: { 'x-apisports-key': apiKey }
            });
            
            console.log(`${dateStr} - EPL: ${response.data.results} fixtures`);
            
            if (response.data.results > 0) {
                console.log('Sample:', JSON.stringify(response.data.response[0].teams, null, 2));
            }
            
        } catch (err) {
            console.log(`${dateStr} - Error:`, err.message);
        }
    }
    
    // Also try without league filter
    console.log('\n=== CHECKING ALL LEAGUES ===');
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
            params: { date: today },
            headers: { 'x-apisports-key': apiKey }
        });
        console.log(`Today ${today}: ${response.data.results} fixtures total`);
        
    } catch (err) {
        console.log('Error:', err.message);
    }
    
    await pool.end();
    process.exit(0);
}

runPipeline();