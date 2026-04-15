'use strict';

require('dotenv').config();
const { pool } = require('../backend/database');

async function fixSportData() {
    console.log('[Fix] Updating predictions to set sport from metadata...');
    
    const client = await pool.connect();
    
    try {
        const result = await client.query(`
            SELECT id, matches 
            FROM predictions_final 
            WHERE tier IS NULL
            LIMIT 20
        `);
        
        console.log(`[Fix] Found ${result.rows.length} predictions with null tier`);
        
        let updated = 0;
        
        for (const row of result.rows) {
            try {
                const matches = Array.isArray(row.matches) ? row.matches : [];
                const firstMatch = matches[0] || {};
                const sport = firstMatch.metadata?.sport || firstMatch.sport || 'football';
                
                await client.query(`
                    UPDATE predictions_final 
                    SET tier = 'normal'
                    WHERE id = $1
                `, [row.id]);
                
                updated++;
            } catch (e) {
                console.error(`[Fix] Error updating id ${row.id}:`, e.message);
            }
        }
        
        console.log(`[Fix] Updated ${updated} predictions`);
        
        const stats = await client.query(`
            SELECT tier, type, COUNT(*) as count 
            FROM predictions_final 
            GROUP BY tier, type
            ORDER BY tier, type
        `);
        
        console.log('\n[Stats]:');
        console.table(stats.rows);
        
    } finally {
        client.release();
    }
}

fixSportData().catch(console.error);
