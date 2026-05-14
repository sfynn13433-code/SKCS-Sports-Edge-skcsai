const { createClient } = require('@supabase/supabase-js');

async function analyzeSupabaseTables() {
  console.log('=== COMPREHENSIVE SUPABASE TABLE ANALYSIS ===\n');
  
  try {
    // Connect to Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    console.log('✅ Connected to Supabase');
    
    // Step 1: Get all table information
    console.log('\n=== STEP 1: RETRIEVING ALL TABLES ===');
    
    // Get table names from information_schema
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');
    
    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      return;
    }
    
    const tableNames = tables.map(t => t.table_name).sort();
    console.log(`Found ${tableNames.length} tables:`);
    tableNames.forEach((name, i) => console.log(`${i + 1}. ${name}`));
    
    // Step 2: Get column information for each table
    console.log('\n=== STEP 2: ANALYZING TABLE STRUCTURES ===');
    
    const tableSchemas = {};
    
    for (const tableName of tableNames) {
      try {
        const { data: columns, error: columnsError } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable, column_default')
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .order('ordinal_position');
        
        if (columnsError) {
          console.error(`Error fetching columns for ${tableName}:`, columnsError);
          continue;
        }
        
        tableSchemas[tableName] = {
          columns: columns,
          columnCount: columns.length,
          columnNames: columns.map(c => c.column_name)
        };
        
        console.log(`\n${tableName} (${columns.length} columns):`);
        columns.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
        });
        
      } catch (error) {
        console.error(`Error analyzing table ${tableName}:`, error.message);
      }
    }
    
    // Step 3: Identify potential duplicates and similarities
    console.log('\n=== STEP 3: IDENTIFYING DUPLICATES & SIMILARITIES ===');
    
    const duplicateGroups = [];
    const similarGroups = [];
    
    // Check for exact column name matches
    for (let i = 0; i < tableNames.length; i++) {
      for (let j = i + 1; j < tableNames.length; j++) {
        const table1 = tableNames[i];
        const table2 = tableNames[j];
        
        const cols1 = tableSchemas[table1].columnNames.sort();
        const cols2 = tableSchemas[table2].columnNames.sort();
        
        // Check for exact column match
        if (JSON.stringify(cols1) === JSON.stringify(cols2)) {
          duplicateGroups.push([table1, table2]);
          console.log(`\n🔄 EXACT DUPLICATE COLUMNS: ${table1} ↔ ${table2}`);
          console.log(`   Columns: ${cols1.join(', ')}`);
        }
        // Check for high similarity (>70% overlap)
        else {
          const intersection = cols1.filter(col => cols2.includes(col));
          const union = [...new Set([...cols1, ...cols2])];
          const similarity = intersection.length / union.length;
          
          if (similarity > 0.7) {
            similarGroups.push({
              tables: [table1, table2],
              similarity: similarity,
              commonColumns: intersection,
              uniqueToTable1: cols1.filter(col => !cols2.includes(col)),
              uniqueToTable2: cols2.filter(col => !cols1.includes(col))
            });
            console.log(`\n🔗 HIGH SIMILARITY (${(similarity * 100).toFixed(1)}%): ${table1} ↔ ${table2}`);
            console.log(`   Common: ${intersection.join(', ')}`);
            console.log(`   Unique to ${table1}: ${cols1.filter(col => !cols2.includes(col)).join(', ') || 'none'}`);
            console.log(`   Unique to ${table2}: ${cols2.filter(col => !cols1.includes(col)).join(', ') || 'none'}`);
          }
        }
      }
    }
    
    // Step 4: Analyze rule tables specifically
    console.log('\n=== STEP 4: RULE TABLE ANALYSIS ===');
    
    const ruleTables = tableNames.filter(name => 
      name.includes('rule') || name.includes('config') || name.includes('setting')
    );
    
    console.log(`Found ${ruleTables.length} rule-related tables:`);
    ruleTables.forEach(name => console.log(`  - ${name}`));
    
    // Analyze each rule table
    for (const ruleTable of ruleTables) {
      console.log(`\n📋 Analyzing ${ruleTable}:`);
      
      try {
        // Get sample data
        const { data: sampleData, error: sampleError } = await supabase
          .from(ruleTable)
          .select('*')
          .limit(5);
        
        if (sampleError) {
          console.log(`   ❌ Error: ${sampleError.message}`);
          continue;
        }
        
        console.log(`   📊 Sample rows: ${sampleData.length}`);
        sampleData.forEach((row, i) => {
          console.log(`   ${i + 1}. ${JSON.stringify(row, null, 2).substring(0, 200)}...`);
        });
        
        // Check for rule conflicts
        if (ruleTable.includes('tier') || ruleTable.includes('subscription')) {
          console.log(`   🎯 Tier/Subscription rules detected`);
          
          // Look for conflicting rules
          const { data: rules, error: rulesError } = await supabase
            .from(ruleTable)
            .select('*');
          
          if (!rulesError && rules.length > 0) {
            // Check for duplicate tier names
            const tierCounts = {};
            rules.forEach(rule => {
              const tier = rule.tier || rule.plan || rule.subscription_tier || 'unknown';
              tierCounts[tier] = (tierCounts[tier] || 0) + 1;
            });
            
            const duplicates = Object.entries(tierCounts).filter(([tier, count]) => count > 1);
            if (duplicates.length > 0) {
              console.log(`   ⚠️  DUPLICATE TIERS: ${duplicates.map(([tier, count]) => `${tier} (${count} entries)`).join(', ')}`);
            }
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Analysis error: ${error.message}`);
      }
    }
    
    // Step 5: Identify merge opportunities
    console.log('\n=== STEP 5: MERGE OPPORTUNITIES ===');
    
    const mergeOpportunities = [];
    
    // Check for tables that could be merged
    similarGroups.forEach(group => {
      const [table1, table2] = group.tables;
      
      // Criteria for safe merge:
      // 1. High similarity (>80%)
      // 2. No conflicting primary keys
      // 3. Compatible data types
      // 4. Similar naming patterns
      
      if (group.similarity > 0.8) {
        const namePattern = table1.split('_')[0];
        const similarNaming = table2.startsWith(namePattern);
        
        if (similarNaming) {
          mergeOpportunities.push({
            tables: group.tables,
            confidence: group.similarity,
            reason: 'High similarity + similar naming pattern',
            suggestedName: namePattern + '_merged',
            risks: []
          });
          
          console.log(`\n🔀 MERGE OPPORTUNITY: ${table1} + ${table2}`);
          console.log(`   Confidence: ${(group.similarity * 100).toFixed(1)}%`);
          console.log(`   Reason: High similarity + similar naming`);
          console.log(`   Suggested name: ${namePattern}_merged`);
        }
      }
    });
    
    // Step 6: Check for orphaned/unused tables
    console.log('\n=== STEP 6: ORPHANED TABLES ANALYSIS ===');
    
    // Check for tables with no data
    const emptyTables = [];
    
    for (const tableName of tableNames) {
      try {
        const { data: countData, error: countError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (!countError) {
          if (countData === null || countData.length === 0) {
            emptyTables.push(tableName);
            console.log(`📭 EMPTY TABLE: ${tableName}`);
          }
        }
      } catch (error) {
        console.log(`❌ Error checking ${tableName}: ${error.message}`);
      }
    }
    
    // Step 7: Generate comprehensive report
    console.log('\n=== COMPREHENSIVE ANALYSIS REPORT ===');
    
    const report = {
      summary: {
        totalTables: tableNames.length,
        duplicateGroups: duplicateGroups.length,
        similarGroups: similarGroups.length,
        ruleTables: ruleTables.length,
        mergeOpportunities: mergeOpportunities.length,
        emptyTables: emptyTables.length
      },
      duplicates: duplicateGroups,
      similarities: similarGroups,
      ruleTables: ruleTables,
      mergeOpportunities: mergeOpportunities,
      emptyTables: emptyTables,
      recommendations: []
    };
    
    // Generate recommendations
    console.log('\n📋 RECOMMENDATIONS:');
    
    if (duplicateGroups.length > 0) {
      report.recommendations.push('URGENT: Resolve exact duplicate tables to prevent data inconsistency');
      console.log('1. URGENT: Resolve exact duplicate tables to prevent data inconsistency');
    }
    
    if (mergeOpportunities.length > 0) {
      report.recommendations.push('Consider merging highly similar tables to reduce complexity');
      console.log('2. Consider merging highly similar tables to reduce complexity');
      mergeOpportunities.forEach((opp, i) => {
        console.log(`   ${i + 1}. Merge ${opp.tables[0]} + ${opp.tables[1]} → ${opp.suggestedName}`);
      });
    }
    
    if (emptyTables.length > 0) {
      report.recommendations.push('Review and potentially remove empty tables');
      console.log('3. Review and potentially remove empty tables');
      emptyTables.forEach(table => console.log(`   - ${table}`));
    }
    
    if (ruleTables.length > 3) {
      report.recommendations.push('Consolidate rule tables to prevent conflicts');
      console.log('4. Consolidate rule tables to prevent conflicts');
    }
    
    // Save detailed report
    const fs = require('fs');
    const reportPath = './supabase-table-analysis-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    return report;
    
  } catch (error) {
    console.error('Analysis failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

analyzeSupabaseTables();
