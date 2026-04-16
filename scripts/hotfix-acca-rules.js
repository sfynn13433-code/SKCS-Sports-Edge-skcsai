require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const client = await pool.connect();
    
    // Step 1: Wipe old rules and insert strict rules
    console.log('[STEP 1] Updating acca_rules table...');
    
    await client.query('DELETE FROM acca_rules');
    
    // Use proper JSON string format
    await client.query(`INSERT INTO acca_rules (rule_name, rule_value) VALUES ('exact_legs_6', '"6"')`);
    await client.query(`INSERT INTO acca_rules (rule_name, rule_value) VALUES ('exact_legs_12', '"12"')`);
    await client.query(`INSERT INTO acca_rules (rule_name, rule_value) VALUES ('6fold_tier', '"normal"')`);
    await client.query(`INSERT INTO acca_rules (rule_name, rule_value) VALUES ('12fold_tier', '"deep"')`);
    
    const rules = await client.query('SELECT * FROM acca_rules');
    console.log('New acca_rules:', JSON.stringify(rules.rows, null, 2));
    
    // Step 2: Delete old dummy accas from predictions_final
    console.log('\n[STEP 2] Purging old dummy accas...');
    
    const deleted = await client.query("DELETE FROM predictions_final WHERE type = 'acca' AND recommendation IN ('Safe Double', 'Medium Acca 3-Fold') RETURNING id");
    console.log(`Deleted ${deleted.rowCount} old accas`);
    
    client.release();
    await pool.end();
    process.exit(0);
})();