const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function getSchema() {
  try {
    console.log('Connecting to Supabase database...');
    
    // Get all tables
    const tablesRes = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log(`Found ${tablesRes.rows.length} tables`);
    
    // Get columns for each table
    const schema = {};
    for (const table of tablesRes.rows) {
      const columnsRes = await pool.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = '${table.table_name}'
        ORDER BY ordinal_position;
      `);
      
      schema[table.table_name] = {
        columns: columnsRes.rows
      };
    }
    
    // Get foreign keys
    const fkRes = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public';
    `);
    
    // Add foreign keys to schema
    for (const fk of fkRes.rows) {
      if (!schema[fk.table_name].foreignKeys) {
        schema[fk.table_name].foreignKeys = [];
      }
      schema[fk.table_name].foreignKeys.push({
        column: fk.column_name,
        referencesTable: fk.foreign_table_name,
        referencesColumn: fk.foreign_column_name
      });
    }
    
    console.log(JSON.stringify(schema, null, 2));
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await pool.end();
  }
}

getSchema();
