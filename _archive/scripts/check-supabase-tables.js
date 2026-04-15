'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

let connStr = process.env.DATABASE_URL;
if (connStr && connStr.includes('db.ghzjntdvaptuxfpvhybb.supabase.co')) {
    connStr = connStr
        .replace('db.ghzjntdvaptuxfpvhybb.supabase.co:5432', 'aws-1-eu-central-1.pooler.supabase.com:6543')
        .replace('postgres:', 'postgres.ghzjntdvaptuxfpvhybb:');
    if (!connStr.includes('pgbouncer=')) {
        connStr += (connStr.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }
}

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
});

async function checkTables() {
    console.log('=== CHECKING SUPABASE TABLES ===\n');
    
    // 1. Get all tables in public schema
    const tables = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    `);
    
    console.log('1. TABLES IN PUBLIC SCHEMA:', tables.rows.length);
    tables.rows.forEach(t => console.log('   -', t.table_name));
    
    // 2. Get table row counts
    console.log('\n2. TABLE ROW COUNTS:');
    for (const row of tables.rows) {
        try {
            const count = await pool.query(`SELECT COUNT(*) as cnt FROM "${row.table_name}"`);
            console.log(`   ${row.table_name}: ${count.rows[0].cnt} rows`);
        } catch (e) {
            console.log(`   ${row.table_name}: ERROR - ${e.message}`);
        }
    }
    
    // 3. Check for orphaned foreign keys
    console.log('\n3. CHECKING FOREIGN KEY CONSTRAINTS:');
    const fks = await pool.query(`
        SELECT
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        ORDER BY tc.table_name;
    `);
    
    fks.rows.forEach(fk => {
        console.log(`   ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });
    
    // 4. Check for functions/triggers
    console.log('\n4. DATABASE FUNCTIONS/TRIGGERS:');
    const funcs = await pool.query(`
        SELECT routine_name, routine_type
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        ORDER BY routine_name
    `);
    funcs.rows.forEach(f => console.log(`   ${f.routine_type}: ${f.routine_name}`));
    
    // 5. Check views
    console.log('\n5. VIEWS:');
    const views = await pool.query(`
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
        ORDER BY table_name
    `);
    if (views.rows.length === 0) {
        console.log('   (none)');
    } else {
        views.rows.forEach(v => console.log(`   - ${v.table_name}`));
    }
    
    // 6. Check indexes
    console.log('\n6. INDEXES:');
    const indexes = await pool.query(`
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
    `);
    indexes.rows.forEach(i => console.log(`   ${i.tablename}: ${i.indexname}`));
    
    await pool.end();
}

checkTables().catch(e => {
    console.error('FATAL ERROR:', e.message);
    pool.end();
});
