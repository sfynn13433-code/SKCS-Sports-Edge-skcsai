const db = require('../backend/db');
const fs = require('fs');
const path = require('path');

async function auditPlaceholdersAndInsights() {
  console.log('=== COMPREHENSIVE AUDIT: PLACEHOLDERS & MISSING INSIGHTS ===\n');
  
  const issues = {
    placeholders: [],
    missingInsights: [],
    emptyFields: [],
    templateText: [],
    brokenData: []
  };
  
  try {
    // STEP 1: Scan all prediction tables for placeholders
    console.log('STEP 1: SCANNING PREDICTION TABLES FOR PLACEHOLDERS');
    console.log('---------------------------------------------------');
    
    const predictionTables = [
      'direct1x2_prediction_final',
      'predictions_unified',
      'predictions_raw_backup_phase3',
      'predictions_filtered_backup_phase3',
      'ai_predictions_backup_phase3'
    ];
    
    const placeholderPatterns = [
      'placeholder',
      'PLACEHOLDER',
      'Lorem ipsum',
      'lorem ipsum',
      'sample',
      'SAMPLE',
      'test',
      'TEST',
      'example',
      'EXAMPLE',
      'N/A',
      'null',
      'undefined',
      'None',
      'none',
      'TBD',
      'tbd',
      'coming soon',
      'Coming Soon',
      '...',
      '???',
      '???',
      'short text',
      'Short text',
      'AI generated',
      'AI Generated',
      'fallback',
      'Fallback',
      'unavailable',
      'Unavailable'
    ];
    
    for (const tableName of predictionTables) {
      try {
        // Check if table exists
        const tableCheck = await db.query(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_name = '${tableName}'
        `);
        
        if (tableCheck.rows[0].count === 0) {
          console.log(`⚠️  Table ${tableName} does not exist`);
          continue;
        }
        
        // Get sample data
        const sampleResult = await db.query(`SELECT * FROM ${tableName} LIMIT 10`);
        
        if (sampleResult.rows.length === 0) {
          console.log(`ℹ️  Table ${tableName} is empty`);
          continue;
        }
        
        console.log(`\n🔍 Scanning ${tableName} (${sampleResult.rows.length} records):`);
        
        for (const row of sampleResult.rows) {
          for (const [key, value] of Object.entries(row)) {
            if (value !== null && value !== undefined) {
              const stringValue = String(value).toLowerCase();
              
              // Check for placeholders
              for (const pattern of placeholderPatterns) {
                if (stringValue.includes(pattern.toLowerCase())) {
                  issues.placeholders.push({
                    table: tableName,
                    id: row.id || 'unknown',
                    field: key,
                    value: value,
                    pattern: pattern
                  });
                }
              }
              
              // Check for empty/invalid insights
              if (key.includes('insight') || key.includes('context') || key.includes('reasoning')) {
                if (stringValue === '' || stringValue === 'null' || stringValue === 'undefined' || stringValue === 'n/a') {
                  issues.missingInsights.push({
                    table: tableName,
                    id: row.id || 'unknown',
                    field: key,
                    value: value
                  });
                }
              }
            } else {
              // Check for null/undefined critical fields
              if (['prediction', 'confidence', 'home_team', 'away_team'].includes(key)) {
                issues.emptyFields.push({
                  table: tableName,
                  id: row.id || 'unknown',
                  field: key,
                  value: value
                });
              }
            }
          }
        }
        
        const placeholderCount = issues.placeholders.filter(p => p.table === tableName).length;
        const missingInsightsCount = issues.missingInsights.filter(i => i.table === tableName).length;
        const emptyFieldsCount = issues.emptyFields.filter(e => e.table === tableName).length;
        
        console.log(`   Placeholders: ${placeholderCount}`);
        console.log(`   Missing insights: ${missingInsightsCount}`);
        console.log(`   Empty critical fields: ${emptyFieldsCount}`);
        
      } catch (error) {
        console.log(`❌ Error scanning ${tableName}: ${error.message}`);
      }
    }
    
    // STEP 2: Check frontend files for placeholders
    console.log('\nSTEP 2: SCANNING FRONTEND FILES FOR PLACEHOLDERS');
    console.log('---------------------------------------------------');
    
    const frontendDir = path.join(__dirname, '../public');
    const frontendFiles = [];
    
    function findFiles(dir, extensions) {
      const files = [];
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          files.push(...findFiles(fullPath, extensions));
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
      
      return files;
    }
    
    try {
      const jsFiles = findFiles(frontendDir, ['.js']);
      const htmlFiles = findFiles(frontendDir, ['.html']);
      
      console.log(`Found ${jsFiles.length} JS files and ${htmlFiles.length} HTML files`);
      
      for (const filePath of [...jsFiles, ...htmlFiles]) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          for (const pattern of placeholderPatterns) {
            const regex = new RegExp(pattern, 'gi');
            const matches = content.match(regex);
            
            if (matches) {
              issues.templateText.push({
                file: filePath,
                pattern: pattern,
                count: matches.length
              });
            }
          }
        } catch (error) {
          console.log(`⚠️  Could not read ${filePath}: ${error.message}`);
        }
      }
      
      console.log(`Frontend placeholder issues: ${issues.templateText.length}`);
      
    } catch (error) {
      console.log(`❌ Error scanning frontend: ${error.message}`);
    }
    
    // STEP 3: Check specific sporting codes and insights
    console.log('\nSTEP 3: ANALYZING SPORTING CODES & INSIGHTS');
    console.log('---------------------------------------------------');
    
    try {
      // Get all unique sports/market types
      const sportsResult = await db.query(`
        SELECT DISTINCT sport, COUNT(*) as count 
        FROM direct1x2_prediction_final 
        WHERE sport IS NOT NULL 
        GROUP BY sport
      `);
      
      console.log('Sports distribution:');
      sportsResult.rows.forEach(row => {
        console.log(`  ${row.sport}: ${row.count} predictions`);
      });
      
      // Check insights quality by sport
      for (const sportRow of sportsResult.rows) {
        const sport = sportRow.sport;
        
        const insightsResult = await db.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN edgemind_report IS NULL OR edgemind_report = '' THEN 1 END) as missing_edgemind,
            COUNT(CASE WHEN secondary_insights IS NULL OR secondary_insights = '{}' THEN 1 END) as missing_secondary,
            COUNT(CASE WHEN context_insights IS NULL OR context_insights = '{}' THEN 1 END) as missing_context
          FROM direct1x2_prediction_final 
          WHERE sport = $1
        `, [sport]);
        
        const insights = insightsResult.rows[0];
        
        if (insights.missing_edgemind > 0 || insights.missing_secondary > 0 || insights.missing_context > 0) {
          issues.brokenData.push({
            sport: sport,
            total: insights.total,
            missing_edgemind: insights.missing_edgemind,
            missing_secondary: insights.missing_secondary,
            missing_context: insights.missing_context
          });
        }
        
        console.log(`  ${sport} insights: ${insights.total - insights.missing_edgemind}/${insights.total} have edgemind reports`);
      }
      
    } catch (error) {
      console.log(`❌ Error analyzing sporting codes: ${error.message}`);
    }
    
    // STEP 4: Generate comprehensive report
    console.log('\nSTEP 4: COMPREHENSIVE ISSUE REPORT');
    console.log('---------------------------------------------------');
    
    console.log(`\n📊 SUMMARY OF ISSUES FOUND:`);
    console.log(`   Database placeholders: ${issues.placeholders.length}`);
    console.log(`   Missing insights: ${issues.missingInsights.length}`);
    console.log(`   Empty critical fields: ${issues.emptyFields.length}`);
    console.log(`   Frontend template placeholders: ${issues.templateText.length}`);
    console.log(`   Broken sports data: ${issues.brokenData.length}`);
    
    if (issues.placeholders.length > 0) {
      console.log(`\n🚨 PLACEHOLDER ISSUES (${issues.placeholders.length}):`);
      issues.placeholders.slice(0, 10).forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue.table}.${issue.field}: "${issue.value}" (${issue.pattern})`);
      });
      if (issues.placeholders.length > 10) {
        console.log(`   ... and ${issues.placeholders.length - 10} more`);
      }
    }
    
    if (issues.missingInsights.length > 0) {
      console.log(`\n🚨 MISSING INSIGHTS (${issues.missingInsights.length}):`);
      issues.missingInsights.slice(0, 10).forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue.table}.${issue.field}: "${issue.value}"`);
      });
      if (issues.missingInsights.length > 10) {
        console.log(`   ... and ${issues.missingInsights.length - 10} more`);
      }
    }
    
    if (issues.brokenData.length > 0) {
      console.log(`\n🚨 BROKEN SPORTS DATA (${issues.brokenData.length}):`);
      issues.brokenData.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue.sport}: ${issue.missing_edgemind} missing edgemind, ${issue.missing_secondary} missing secondary`);
      });
    }
    
    // Save detailed report
    const reportPath = './placeholders-and-insights-audit.json';
    fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    return issues;
    
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
    throw error;
  }
}

// Run the audit
auditPlaceholdersAndInsights().catch(error => {
  console.error('Audit execution failed:', error);
  process.exit(1);
});
