const { query } = require('../backend/db');
const fs = require('fs');

async function analyzeSupabaseTables() {
  console.log('=== COMPREHENSIVE SUPABASE TABLE ANALYSIS ===\n');
  
  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      total_tables: 0,
      tables_with_rls: 0,
      tables_with_policies: 0,
      tables_with_indexes: 0,
      tables_with_constraints: 0,
      tables_with_triggers: 0
    },
    tables: {}
  };

  try {
    // Get all tables in public schema
    console.log('Step 1: Retrieving all tables...');
    const { rows: tables } = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`Found ${tables.length} tables\n`);

    for (const table of tables) {
      const tableName = table.table_name;
      console.log(`Analyzing: ${tableName}`);

      const tableInfo = {
        name: tableName,
        columns: [],
        rls_enabled: false,
        rls_policies: [],
        indexes: [],
        constraints: [],
        triggers: [],
        row_count: 0,
        estimated_size: '0 bytes',
        function: 'Unknown'
      };

      // Get columns
      const { rows: columns } = await query(`
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
        AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      tableInfo.columns = columns.map(col => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        default: col.column_default,
        max_length: col.character_maximum_length,
        precision: col.numeric_precision,
        scale: col.numeric_scale
      }));

      // Check RLS status
      const { rows: rlsStatus } = await query(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = $1
        AND relnamespace = 'public'::regnamespace
      `, [tableName]);

      if (rlsStatus.length > 0) {
        tableInfo.rls_enabled = rlsStatus[0].relrowsecurity;
        if (tableInfo.rls_enabled) {
          report.summary.tables_with_rls++;
        }
      }

      // Get RLS policies
      const { rows: policies } = await query(`
        SELECT 
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = $1
      `, [tableName]);

      tableInfo.rls_policies = policies.map(p => ({
        name: p.policyname,
        permissive: p.permissive,
        roles: p.roles,
        command: p.cmd,
        using: p.qual,
        with_check: p.with_check
      }));

      if (policies.length > 0) {
        report.summary.tables_with_policies++;
      }

      // Get indexes
      const { rows: indexes } = await query(`
        SELECT 
          i.relname as index_name,
          a.attname as column_name,
          am.amname as index_type,
          ix.indisunique as is_unique,
          ix.indisprimary as is_primary
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_am am ON i.relam = am.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relname = $1
        AND t.relnamespace = 'public'::regnamespace
        ORDER BY i.relname, a.attnum
      `, [tableName]);

      // Group indexes by name
      const indexMap = {};
      indexes.forEach(idx => {
        if (!indexMap[idx.index_name]) {
          indexMap[idx.index_name] = {
            name: idx.index_name,
            columns: [],
            type: idx.index_type,
            unique: idx.is_unique,
            primary: idx.is_primary
          };
        }
        indexMap[idx.index_name].columns.push(idx.column_name);
      });

      tableInfo.indexes = Object.values(indexMap);
      if (tableInfo.indexes.length > 0) {
        report.summary.tables_with_indexes++;
      }

      // Get constraints
      const { rows: constraints } = await query(`
        SELECT 
          con.conname as constraint_name,
          con.contype as constraint_type,
          CASE con.contype
            WHEN 'c' THEN 'CHECK'
            WHEN 'f' THEN 'FOREIGN KEY'
            WHEN 'p' THEN 'PRIMARY KEY'
            WHEN 'u' THEN 'UNIQUE'
            WHEN 'x' THEN 'EXCLUSION'
          END as constraint_type_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = $1
        AND rel.relnamespace = 'public'::regnamespace
      `, [tableName]);

      tableInfo.constraints = constraints.map(c => ({
        name: c.constraint_name,
        type: c.constraint_type_name
      }));

      if (tableInfo.constraints.length > 0) {
        report.summary.tables_with_constraints++;
      }

      // Get triggers
      const { rows: triggers } = await query(`
        SELECT 
          tgname as trigger_name,
          tgenabled as trigger_enabled
        FROM pg_trigger
        JOIN pg_class ON pg_class.oid = tgrelid
        WHERE pg_class.relname = $1
        AND pg_class.relnamespace = 'public'::regnamespace
        AND NOT tgisinternal
      `, [tableName]);

      tableInfo.triggers = triggers.map(t => ({
        name: t.trigger_name,
        enabled: t.trigger_enabled === 'O'
      }));

      if (tableInfo.triggers.length > 0) {
        report.summary.tables_with_triggers++;
      }

      // Get row count
      try {
        const { rows: countResult } = await query(`
          SELECT COUNT(*) as count
          FROM "${tableName}"
        `);
        tableInfo.row_count = parseInt(countResult[0].count);
      } catch (error) {
        tableInfo.row_count = 'Error: ' + error.message;
      }

      // Get estimated size
      try {
        const { rows: sizeResult } = await query(`
          SELECT pg_size_pretty(pg_total_relation_size($1::regclass)) as size
        `, [tableName]);
        tableInfo.estimated_size = sizeResult[0].size;
      } catch (error) {
        tableInfo.estimated_size = 'Unknown';
      }

      // Determine function based on table name and columns
      tableInfo.function = determineTableFunction(tableName, tableInfo.columns);

      report.tables[tableName] = tableInfo;
      report.summary.total_tables++;
    }

    // Save JSON report
    const jsonPath = './supabase-table-analysis.json';
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\nJSON report saved to: ${jsonPath}`);

    // Generate markdown report
    const markdownReport = generateMarkdownReport(report);
    const mdPath = './SUPABASE_TABLE_ANALYSIS.md';
    fs.writeFileSync(mdPath, markdownReport);
    console.log(`Markdown report saved to: ${mdPath}`);

    console.log('\n=== ANALYSIS COMPLETE ===');
    console.log(`Total tables: ${report.summary.total_tables}`);
    console.log(`Tables with RLS enabled: ${report.summary.tables_with_rls}`);
    console.log(`Tables with RLS policies: ${report.summary.tables_with_policies}`);
    console.log(`Tables with indexes: ${report.summary.tables_with_indexes}`);
    console.log(`Tables with constraints: ${report.summary.tables_with_constraints}`);
    console.log(`Tables with triggers: ${report.summary.tables_with_triggers}`);

  } catch (error) {
    console.error('Analysis failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

function determineTableFunction(tableName, columns) {
  const colNames = columns.map(c => c.name.toLowerCase()).join(' ');
  
  // Prediction tables
  if (tableName.includes('prediction') || tableName.includes('prediction_')) {
    if (tableName.includes('raw')) return 'Stores raw AI predictions before processing';
    if (tableName.includes('final') || tableName.includes('filtered')) return 'Stores final/published predictions for display';
    if (tableName.includes('stage')) return 'Stores intermediate prediction pipeline stages';
    if (tableName.includes('accuracy')) return 'Tracks prediction accuracy metrics';
    if (tableName.includes('secondary')) return 'Stores secondary market predictions';
    if (tableName.includes('insights')) return 'Stores AI-generated insights and analysis';
    return 'Prediction-related table';
  }

  // Fixture/Match tables
  if (tableName.includes('fixture') || tableName.includes('match')) {
    if (tableName.includes('cricket')) return 'Stores cricket match fixtures';
    if (tableName.includes('backup')) return 'Backup table for fixtures';
    if (tableName.includes('archive')) return 'Archived historical fixtures';
    if (tableName.includes('normalized')) return 'Normalized fixture data';
    if (tableName.includes('raw')) return 'Raw fixture data from external APIs';
    return 'Stores match/fixture information';
  }

  // Subscription tables
  if (tableName.includes('subscription') || tableName.includes('plan')) {
    if (tableName.includes('plan')) return 'Defines subscription plan tiers and features';
    return 'Stores user subscription information';
  }

  // Context/Enrichment tables
  if (tableName.includes('context') || tableName.includes('enrich') || tableName.includes('cache')) {
    if (tableName.includes('injury')) return 'Stores injury data for teams/players';
    if (tableName.includes('travel')) return 'Stores travel distance data for teams';
    if (tableName.includes('importance')) return 'Stores match importance ratings';
    if (tableName.includes('form')) return 'Stores team form statistics';
    if (tableName.includes('h2h')) return 'Stores head-to-head match history';
    if (tableName.includes('lineup')) return 'Stores team lineups';
    if (tableName.includes('news')) return 'Stores news mentions and sentiment';
    if (tableName.includes('weather')) return 'Stores weather conditions for events';
    return 'Stores context/enrichment data';
  }

  // Rule/Config tables
  if (tableName.includes('rule') || tableName.includes('config') || tableName.includes('setting')) {
    if (tableName.includes('tier')) return 'Defines tier-based rules and restrictions';
    if (tableName.includes('market')) return 'Defines market-specific rules';
    if (tableName.includes('acca')) return 'Defines ACCA (accumulator) rules';
    if (tableName.includes('cricket')) return 'Defines cricket-specific market rules';
    return 'Stores configuration rules';
  }

  // Admin/Debug tables
  if (tableName.includes('admin') || tableName.includes('debug') || tableName.includes('scheduler')) {
    if (tableName.includes('sync')) return 'Tracks data synchronization status';
    if (tableName.includes('pipeline')) return 'Tracks pipeline health and metrics';
    if (tableName.includes('suppression')) return 'Tracks suppressed predictions/reasons';
    if (tableName.includes('volume')) return 'Tracks daily volume metrics';
    if (tableName.includes('processing')) return 'Tracks processing times';
    if (tableName.includes('failure')) return 'Tracks recent failures';
    if (tableName.includes('lock')) return 'Manages scheduler locks';
    if (tableName.includes('log')) return 'Stores scheduling/processing logs';
    return 'Admin/debug table';
  }

  // Entity tables
  if (tableName.includes('team') || tableName.includes('player') || tableName.includes('person')) {
    if (tableName.includes('stat')) return 'Stores team statistics';
    if (tableName.includes('week_lock')) return 'Manages weekly data locks for teams';
    return 'Stores team/player entity data';
  }

  // Odds tables
  if (tableName.includes('odd') || tableName.includes('bookmaker')) {
    if (tableName.includes('snapshot')) return 'Stores odds snapshots at specific times';
    if (tableName.includes('canonical')) return 'Stores canonical bookmaker data';
    return 'Stores betting odds information';
  }

  // Event tables
  if (tableName.includes('event')) {
    if (tableName.includes('injury')) return 'Stores injury snapshots for events';
    if (tableName.includes('weather')) return 'Stores weather snapshots for events';
    if (tableName.includes('news')) return 'Stores news snapshots for events';
    if (tableName.includes('odds')) return 'Stores odds snapshots for events';
    return 'Stores event-related data';
  }

  // Sport-specific tables
  if (tableName.includes('f1_')) {
    return 'Formula 1 data table';
  }
  if (tableName.includes('cricket_')) {
    return 'Cricket-specific table';
  }

  // Cache tables
  if (tableName.includes('cache') || tableName.includes('rapidapi')) {
    return 'Caches external API responses';
  }

  // Canonical tables
  if (tableName.includes('canonical')) {
    return 'Stores canonical/normalized entity data';
  }

  // Migration tables
  if (tableName.includes('migration') || tableName.includes('backup')) {
    return 'Migration/backup table';
  }

  // League tables
  if (tableName.includes('league')) {
    return 'Stores league information';
  }

  // Sport table
  if (tableName === 'sports') {
    return 'Stores sport definitions and metadata';
  }

  // Default
  return 'General purpose table';
}

function generateMarkdownReport(report) {
  let md = `# Supabase Table Analysis Report\n\n`;
  md += `**Generated:** ${report.generated_at}\n\n`;
  md += `## Summary\n\n`;
  md += `- **Total Tables:** ${report.summary.total_tables}\n`;
  md += `- **Tables with RLS Enabled:** ${report.summary.tables_with_rls}\n`;
  md += `- **Tables with RLS Policies:** ${report.summary.tables_with_policies}\n`;
  md += `- **Tables with Indexes:** ${report.summary.tables_with_indexes}\n`;
  md += `- **Tables with Constraints:** ${report.summary.tables_with_constraints}\n`;
  md += `- **Tables with Triggers:** ${report.summary.tables_with_triggers}\n\n`;

  const tableNames = Object.keys(report.tables).sort();

  for (const tableName of tableNames) {
    const table = report.tables[tableName];
    
    md += `## ${tableName}\n\n`;
    md += `**Function:** ${table.function}\n\n`;
    md += `**Statistics:**\n`;
    md += `- Row Count: ${table.row_count}\n`;
    md += `- Estimated Size: ${table.estimated_size}\n`;
    md += `- RLS Enabled: ${table.rls_enabled ? '✅ Yes' : '❌ No'}\n`;
    md += `- RLS Policies: ${table.rls_policies.length}\n`;
    md += `- Indexes: ${table.indexes.length}\n`;
    md += `- Constraints: ${table.constraints.length}\n`;
    md += `- Triggers: ${table.triggers.length}\n\n`;

    md += `### Columns (${table.columns.length})\n\n`;
    md += `| Column | Type | Nullable | Default | Max Length | Precision | Scale |\n`;
    md += `|--------|------|----------|---------|------------|-----------|-------|\n`;
    
    for (const col of table.columns) {
      md += `| ${col.name} | ${col.type} | ${col.nullable ? 'Yes' : 'No'} | ${col.default || '-'} | ${col.max_length || '-'} | ${col.precision || '-'} | ${col.scale || '-'} |\n`;
    }
    md += `\n`;

    if (table.rls_policies.length > 0) {
      md += `### RLS Policies (${table.rls_policies.length})\n\n`;
      for (const policy of table.rls_policies) {
        md += `**${policy.name}**\n`;
        md += `- Permissive: ${policy.permissive ? 'Yes' : 'No'}\n`;
        md += `- Roles: ${policy.roles || 'All'}\n`;
        md += `- Command: ${policy.command}\n`;
        if (policy.using) md += `- Using: \`${policy.using}\`\n`;
        if (policy.with_check) md += `- With Check: \`${policy.with_check}\`\n`;
        md += `\n`;
      }
    }

    if (table.indexes.length > 0) {
      md += `### Indexes (${table.indexes.length})\n\n`;
      for (const idx of table.indexes) {
        md += `**${idx.name}**\n`;
        md += `- Type: ${idx.type}\n`;
        md += `- Columns: ${idx.columns.join(', ')}\n`;
        if (idx.unique) md += `- Unique: Yes\n`;
        if (idx.primary) md += `- Primary Key: Yes\n`;
        md += `\n`;
      }
    }

    if (table.constraints.length > 0) {
      md += `### Constraints (${table.constraints.length})\n\n`;
      for (const constraint of table.constraints) {
        md += `**${constraint.name}** (${constraint.type})\n`;
        md += `\n`;
      }
    }

    if (table.triggers.length > 0) {
      md += `### Triggers (${table.triggers.length})\n\n`;
      for (const trigger of table.triggers) {
        md += `**${trigger.name}**\n`;
        md += `- Enabled: ${trigger.enabled ? 'Yes' : 'No'}\n`;
        md += `\n`;
      }
    }

    md += `---\n\n`;
  }

  return md;
}

analyzeSupabaseTables();
