require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class MigrationRunner {
  constructor() {
    this.connectionString = process.env.DATABASE_URL;
    this.pool = new Pool({
      connectionString: this.connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }

  async runMigrations() {
    console.log('Running SKCS AI Pipeline Migrations...');
    
    try {
      await this.pool.connect();
      
      // Allow passing migration filenames as CLI args; otherwise run defaults
      const args = process.argv.slice(2).filter(Boolean);
      let migrations;
      if (args.length > 0) {
        migrations = args.map((p) => path.basename(p));
      } else {
        // Default small set plus DB rule alignment
        migrations = [
          '20260512000003_create_sport_sync_table.sql',
          '20260512000004_create_upsert_raw_fixture_rpc.sql',
          '20260512000005_create_context_enrichment_trigger.sql',
          '20260718000001_db_rule_alignment_75_55_30.sql'
        ];
      }
      
      for (const migration of migrations) {
        await this.runMigration(migration);
      }
      
      console.log('✅ All migrations completed successfully');
      
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    } finally {
      await this.pool.end();
    }
  }

  async runMigration(filename) {
    console.log(`Running migration: ${filename}`);
    
    const migrationPath = path.join(__dirname, '../supabase/migrations', filename);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await this.pool.query(sql);
    console.log(`✅ Completed: ${filename}`);
  }
}

// Run if executed directly
if (require.main === module) {
  const runner = new MigrationRunner();
  runner.runMigrations()
    .then(() => {
      console.log('Migrations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = MigrationRunner;
