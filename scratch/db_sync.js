
require('dotenv').config();
const { query } = require('../backend/database');

async function syncDb() {
    console.log('Fetching sports from predictions_raw...');
    const resultRaw = await query('SELECT DISTINCT sport FROM predictions_raw');
    const sportsRaw = resultRaw.rows || resultRaw;
    console.log('predictions_raw sports:', Array.isArray(sportsRaw) ? sportsRaw.map(r => r.sport).join(', ') : sportsRaw);
    
    console.log('Fetching sports from leagues...');
    const resultLeagues = await query('SELECT DISTINCT sport FROM leagues');
    const sportsLeagues = resultLeagues.rows || resultLeagues;
    console.log('leagues sports:', Array.isArray(sportsLeagues) ? sportsLeagues.map(r => r.sport).join(', ') : sportsLeagues);
    
    process.exit(0);
}
syncDb().catch(e => { console.error(e); process.exit(1); });

