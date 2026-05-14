const db = require('../backend/db');

async function analyzePostgresTables() {
  console.log('=== COMPREHENSIVE POSTGRES TABLE ANALYSIS ===\n');
  
  try {
    console.log('✅ Connected to PostgreSQL database');
    
    // Step 1: Get all table information
    console.log('\n=== STEP 1: RETRIEVING ALL TABLES ===');
    
    const tablesResult = await db.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const tableNames = tablesResult.rows.map(t => t.table_name);
    console.log(`Found ${tableNames.length} tables:`);
    tableNames.forEach((name, i) => console.log(`${i + 1}. ${name}`));
    
    // Step 2: Get column information for each table
    console.log('\n=== STEP 2: ANALYZING TABLE STRUCTURES ===');
    
    const tableSchemas = {};
    
    for (const tableName of tableNames) {
      try {
        const columnsResult = await db.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        
        tableSchemas[tableName] = {
          columns: columnsResult.rows,
          columnCount: columnsResult.rows.length,
          columnNames: columnsResult.rows.map(c => c.column_name)
        };
        
        console.log(`\n${tableName} (${columnsResult.rows.length} columns):`);
        columnsResult.rows.forEach(col => {
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
      name.includes('rule') || name.includes('config') || name.includes('setting') || name.includes('tier') || name.includes('subscription')
    );
    
    console.log(`Found ${ruleTables.length} rule-related tables:`);
    ruleTables.forEach(name => console.log(`  - ${name}`));
    
    // Analyze each rule table
    for (const ruleTable of ruleTables) {
      console.log(`\n📋 Analyzing ${ruleTable}:`);
      
      try {
        // Get sample data
        const sampleResult = await db.query(`
          SELECT *
          FROM ${ruleTable}
          LIMIT 5
        `);
        
        console.log(`   📊 Sample rows: ${sampleResult.rows.length}`);
        sampleResult.rows.forEach((row, i) => {
          console.log(`   ${i + 1}. ${JSON.stringify(row, null, 2).substring(0, 200)}...`);
        });
        
        // Check for rule conflicts
        if (ruleTable.includes('tier') || ruleTable.includes('subscription')) {
          console.log(`   🎯 Tier/Subscription rules detected`);
          
          // Look for conflicting rules
          const rulesResult = await db.query(`
            SELECT *
            FROM ${ruleTable}
          `);
          
          if (rulesResult.rows.length > 0) {
            // Check for duplicate tier names
            const tierCounts = {};
            rulesResult.rows.forEach(rule => {
              const tier = rule.tier || rule.plan || rule.subscription_tier || rule.name || 'unknown';
              tierCounts[tier] = (tierCounts[tier] || 0) + 1;
            });
            
            const duplicates = Object.entries(tierCounts).filter(([tier, count]) => count > 1);
            if (duplicates.length > 0) {
              console.log(`   ⚠️  DUPLICATE TIERS: ${duplicates.map(([tier, count]) => `${tier} (${count} entries)`).join(', ')}`);
            }
            
            // Check for conflicting volatility settings
            const volatilitySettings = {};
            rulesResult.rows.forEach(rule => {
              if (rule.allowed_volatility || rule.volatility_levels) {
                const tier = rule.tier || rule.plan || rule.name || 'unknown';
                const volatility = rule.allowed_volatility || rule.volatility_levels;
                volatilitySettings[tier] = volatility;
              }
            });
            
            console.log(`   📊 Volatility settings:`, volatilitySettings);
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
        const countResult = await db.query(`
          SELECT COUNT(*) as count
          FROM ${tableName}
        `);
        
        if (parseInt(countResult.rows[0].count) === 0) {
          emptyTables.push(tableName);
          console.log(`📭 EMPTY TABLE: ${tableName}`);
        }
      } catch (error) {
        console.log(`❌ Error checking ${tableName}: ${error.message}`);
      }
    }
    
    // Step 7: Check for data duplication across tables
    console.log('\n=== STEP 7: DATA DUPLICATION ANALYSIS ===');
    
    // Look for similar data patterns across tables
    const dataDuplication = [];
    
    // Check for fixture/prediction data duplication
    const fixtureTables = tableNames.filter(name => 
      name.includes('fixture') || name.includes('prediction') || name.includes('match')
    );
    
    console.log(`\n📊 Analyzing ${fixtureTables.length} fixture/prediction tables for data duplication:`);
    
    for (let i = 0; i < fixtureTables.length; i++) {
      for (let j = i + 1; j < fixtureTables.length; j++) {
        const table1 = fixtureTables[i];
        const table2 = fixtureTables[j];
        
        try {
          // Check for overlapping match IDs
          const overlapResult = await db.query(`
            SELECT COUNT(*) as overlap_count
            FROM (
              SELECT match_id FROM ${table1} WHERE match_id IS NOT NULL
              INTERSECT
              SELECT match_id FROM ${table2} WHERE match_id IS NOT NULL
            ) as overlap
          `);
          
          const overlapCount = parseInt(overlapResult.rows[0].overlap_count);
          if (overlapCount > 0) {
            dataDuplication.push({
              tables: [table1, table2],
              overlapCount: overlapCount,
              type: 'match_id'
            });
            console.log(`   🔄 DATA OVERLAP: ${table1} ↔ ${table2} (${overlapCount} shared match_ids)`);
          }
          
        } catch (error) {
          console.log(`   ❌ Error checking overlap between ${table1} and ${table2}: ${error.message}`);
        }
      }
    }
    
    // Step 8: Generate comprehensive report
    console.log('\n=== COMPREHENSIVE ANALYSIS REPORT ===');
    
    const report = {
      summary: {
        totalTables: tableNames.length,
        duplicateGroups: duplicateGroups.length,
        similarGroups: similarGroups.length,
        ruleTables: ruleTables.length,
        mergeOpportunities: mergeOpportunities.length,
        emptyTables: emptyTables.length,
        dataDuplication: dataDuplication.length
      },
      tables: tableNames,
      duplicates: duplicateGroups,
      similarities: similarGroups,
      ruleTables: ruleTables,
      mergeOpportunities: mergeOpportunities,
      emptyTables: emptyTables,
      dataDuplication: dataDuplication,
      recommendations: []
    };
    
    // Generate recommendations
    console.log('\n📋 RECOMMENDATIONS:');
    
    if (duplicateGroups.length > 0) {
      report.recommendations.push('URGENT: Resolve exact duplicate tables to prevent data inconsistency');
      console.log('1. URGENT: Resolve exact duplicate tables to prevent data inconsistency');
      duplicateGroups.forEach((group, i) => {
        console.log(`   ${i + 1}. ${group[0]} ↔ ${group[1]} - Choose one and migrate data`);
      });
    }
    
    if (dataDuplication.length > 0) {
      report.recommendations.push('URGENT: Resolve data duplication across fixture/prediction tables');
      console.log('2. URGENT: Resolve data duplication across fixture/prediction tables');
      dataDuplication.forEach((dup, i) => {
        console.log(`   ${i + 1}. ${dup.tables[0]} ↔ ${dup.tables[1]} - ${dup.overlapCount} shared records`);
      });
    }
    
    if (mergeOpportunities.length > 0) {
      report.recommendations.push('Consider merging highly similar tables to reduce complexity');
      console.log('3. Consider merging highly similar tables to reduce complexity');
      mergeOpportunities.forEach((opp, i) => {
        console.log(`   ${i + 1}. Merge ${opp.tables[0]} + ${opp.tables[1]} → ${opp.suggestedName}`);
      });
    }
    
    if (emptyTables.length > 0) {
      report.recommendations.push('Review and potentially remove empty tables');
      console.log('4. Review and potentially remove empty tables');
      emptyTables.forEach(table => console.log(`   - ${table}`));
    }
    
    if (ruleTables.length > 3) {
      report.recommendations.push('Consolidate rule tables to prevent conflicts');
      console.log('5. Consolidate rule tables to prevent conflicts');
    }
    
    // Save detailed report
    const fs = require('fs');
    const reportPath = './postgres-table-analysis-report.json';
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

analyzePostgresTables();
