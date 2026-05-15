const { query } = require('./backend/database');

async function checkTableColumns() {
    try {
        const result = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'direct1x2_prediction_final' 
            AND table_schema = 'public'
            ORDER BY ordinal_position
        `);
        
        console.log('Columns in direct1x2_prediction_final table:');
        result.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type}`);
        });
        
        // Also check if there's any data
        const dataCheck = await query(`
            SELECT COUNT(*) as count 
            FROM direct1x2_prediction_final
            LIMIT 1
        `);
        
        console.log(`\nTotal rows in direct1x2_prediction_final: ${dataCheck.rows[0].count}`);
        
        // Get sample data to understand structure
        if (dataCheck.rows[0].count > 0) {
            const sample = await query(`
                SELECT * FROM direct1x2_prediction_final 
                LIMIT 1
            `);
            
            console.log('\nSample data structure:');
            console.log(JSON.stringify(sample.rows[0], null, 2));
        }
        
    } catch (error) {
        console.error('Error checking table:', error.message);
    }
}

checkTableColumns();
