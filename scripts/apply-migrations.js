/**
 * Apply Supabase Migrations Directly
 * 
 * This script applies SQL migration files to the database directly,
 * bypassing the need for the Supabase CLI.
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../backend/database');

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');

async function applyMigrations() {
    console.log('=== Applying Supabase Migrations ===\n');

    try {
        // Only apply the new architectural migrations (20260822000001-20260822000004)
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql') && f.startsWith('20260822'))
            .sort(); // Sort by filename to ensure correct order

        console.log(`Found ${files.length} new architectural migration files\n`);

        // Check which migrations have already been applied
        // We'll use a simple tracking table
        await query(`
            CREATE TABLE IF NOT EXISTS _migration_log (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        const appliedResult = await query('SELECT filename FROM _migration_log ORDER BY filename');
        const appliedFiles = new Set(appliedResult.rows.map(r => r.filename));

        console.log(`Already applied: ${appliedFiles.size} migrations\n`);

        let appliedCount = 0;
        let skippedCount = 0;

        for (const file of files) {
            if (appliedFiles.has(file)) {
                console.log(`⏭  Skipping ${file} (already applied)`);
                skippedCount++;
                continue;
            }

            console.log(`📝 Applying ${file}...`);

            const filePath = path.join(MIGRATIONS_DIR, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            try {
                // Execute the entire migration file as a single statement
                // PostgreSQL can handle multiple statements in one query via pg-pool
                await query(sql);

                // Log the migration as applied
                await query('INSERT INTO _migration_log (filename) VALUES ($1)', [file]);

                console.log(`✅ Applied ${file}\n`);
                appliedCount++;
            } catch (error) {
                console.error(`❌ Failed to apply ${file}:`, error.message);
                console.error('Error details:', error);
                throw error;
            }
        }

        console.log('\n=== Migration Summary ===');
        console.log(`✅ Applied: ${appliedCount}`);
        console.log(`⏭  Skipped: ${skippedCount}`);
        console.log(`📊 Total: ${files.length}`);

        if (appliedCount > 0) {
            console.log('\n✅ Migrations applied successfully!');
        } else {
            console.log('\nℹ️  All migrations already up to date');
        }

        return true;

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        throw error;
    }
}

// Run migrations
if (require.main === module) {
    applyMigrations()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error('Migration script error:', error);
            process.exit(1);
        });
}

module.exports = { applyMigrations };
