require('dotenv').config();
const { query } = require('../backend/database');

async function normalizeDb() {
    console.log('Normalizing sports in predictions_raw...');
    await query("UPDATE predictions_raw SET sport = 'basketball' WHERE sport = 'nba'");
    await query("UPDATE predictions_raw SET sport = 'nfl' WHERE sport = 'american_football'");
    await query("UPDATE predictions_raw SET sport = 'football' WHERE sport LIKE 'soccer_%'");
    
    console.log('Normalizing sports in leagues...');
    await query("UPDATE leagues SET sport = 'basketball' WHERE sport = 'nba'");
    await query("UPDATE leagues SET sport = 'nfl' WHERE sport = 'american_football'");
    await query("UPDATE leagues SET sport = 'football' WHERE sport LIKE 'soccer_%'");
    
    console.log('Normalizing match_context_data if exists...');
    try {
        await query("UPDATE match_context_data SET sport = 'basketball' WHERE sport = 'nba'");
        await query("UPDATE match_context_data SET sport = 'nfl' WHERE sport = 'american_football'");
        await query("UPDATE match_context_data SET sport = 'football' WHERE sport LIKE 'soccer_%'");
    } catch(e) {
        console.log('match_context_data table might not exist or no sport column. Skipping.');
    }
    
    console.log('Done.');
    process.exit(0);
}
normalizeDb().catch(e => { console.error(e); process.exit(1); });
