const fs = require('fs');
const path = require('path');

function mapTableDependencies() {
  console.log('=== MAPPING TABLE DEPENDENCIES AND CODE REFERENCES ===\n');
  
  // Tables we plan to merge
  const targetTables = [
    'cricket_fixtures',
    'fixtures', 
    'predictions_raw',
    'predictions_filtered',
    'ai_predictions',
    'tier_rules',
    'cricket_market_rules'
  ];
  
  // Directories to search
  const searchDirs = [
    './backend',
    './scripts',
    './public',
    './docs'
  ];
  
  const dependencies = {};
  
  // Initialize dependency map
  targetTables.forEach(table => {
    dependencies[table] = {
      directReferences: [],
      indirectReferences: [],
      apiEndpoints: [],
      services: [],
      frontendFiles: [],
      criticality: 'HIGH'
    };
  });
  
  // Search for table references in code
  console.log('=== SEARCHING FOR TABLE REFERENCES ===\n');
  
  searchDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Directory ${dir} does not exist, skipping...`);
      return;
    }
    
    console.log(`\nSearching in ${dir}...`);
    
    // Get all JavaScript/JSON files
    const files = getAllFiles(dir, ['.js', '.json', '.html', '.md']);
    
    files.forEach(filePath => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative('.', filePath);
        
        targetTables.forEach(table => {
          // Check for direct table references
          const directPatterns = [
            `FROM ${table}`,
            `FROM ${table}`,
            `INSERT INTO ${table}`,
            `UPDATE ${table}`,
            `DELETE FROM ${table}`,
            `CREATE TABLE ${table}`,
            `DROP TABLE ${table}`,
            `"${table}"`,
            `'${table}'`,
            `\`${table}\``
          ];
          
          directPatterns.forEach(pattern => {
            if (content.includes(pattern)) {
              dependencies[table].directReferences.push({
                file: relativePath,
                pattern: pattern,
                line: findLineNumber(content, pattern)
              });
            }
          });
          
          // Check for indirect references (through variables, functions)
          if (content.toLowerCase().includes(table.toLowerCase()) && 
              !content.includes(pattern) && 
              !relativePath.includes('node_modules')) {
            dependencies[table].indirectReferences.push({
              file: relativePath,
              context: getContext(content, table)
            });
          }
          
          // Check for API endpoints that might use these tables
          if (content.includes('/api/') && content.toLowerCase().includes(table.toLowerCase())) {
            dependencies[table].apiEndpoints.push({
              file: relativePath,
              endpoints: extractApiEndpoints(content)
            });
          }
          
          // Categorize by file type
          if (relativePath.startsWith('backend/services/')) {
            dependencies[table].services.push(relativePath);
          } else if (relativePath.startsWith('public/')) {
            dependencies[table].frontendFiles.push(relativePath);
          }
        });
        
      } catch (error) {
        console.log(`Error reading ${filePath}: ${error.message}`);
      }
    });
  });
  
  // Print dependency analysis
  console.log('\n=== DEPENDENCY ANALYSIS RESULTS ===\n');
  
  targetTables.forEach(table => {
    const deps = dependencies[table];
    
    console.log(`\n🔍 TABLE: ${table}`);
    console.log(`   Criticality: ${deps.criticality}`);
    console.log(`   Direct References: ${deps.directReferences.length}`);
    console.log(`   Indirect References: ${deps.indirectReferences.length}`);
    console.log(`   API Endpoints: ${deps.apiEndpoints.length}`);
    console.log(`   Services: ${deps.services.length}`);
    console.log(`   Frontend Files: ${deps.frontendFiles.length}`);
    
    if (deps.directReferences.length > 0) {
      console.log(`\n   📋 DIRECT REFERENCES:`);
      deps.directReferences.forEach(ref => {
        console.log(`      - ${ref.file}:${ref.line} - ${ref.pattern}`);
      });
    }
    
    if (deps.indirectReferences.length > 0) {
      console.log(`\n   🔗 INDIRECT REFERENCES:`);
      deps.indirectReferences.forEach(ref => {
        console.log(`      - ${ref.file} - ${ref.context.substring(0, 100)}...`);
      });
    }
    
    if (deps.apiEndpoints.length > 0) {
      console.log(`\n   🌐 API ENDPOINTS:`);
      deps.apiEndpoints.forEach(endpoint => {
        console.log(`      - ${endpoint.file}`);
        endpoint.endpoints.forEach(ep => console.log(`        * ${ep}`));
      });
    }
    
    if (deps.services.length > 0) {
      console.log(`\n   ⚙️  SERVICES:`);
      deps.services.forEach(service => {
        console.log(`      - ${service}`);
      });
    }
    
    if (deps.frontendFiles.length > 0) {
      console.log(`\n   🎨 FRONTEND FILES:`);
      deps.frontendFiles.forEach(file => {
        console.log(`      - ${file}`);
      });
    }
  });
  
  // Generate migration risk assessment
  console.log('\n=== MIGRATION RISK ASSESSMENT ===\n');
  
  const riskAssessment = {
    highRisk: [],
    mediumRisk: [],
    lowRisk: []
  };
  
  targetTables.forEach(table => {
    const deps = dependencies[table];
    let riskLevel = 'LOW';
    let riskFactors = [];
    
    if (deps.directReferences.length > 10) {
      riskLevel = 'HIGH';
      riskFactors.push('High number of direct references');
    } else if (deps.directReferences.length > 5) {
      riskLevel = 'MEDIUM';
      riskFactors.push('Moderate number of direct references');
    }
    
    if (deps.services.length > 3) {
      riskLevel = 'HIGH';
      riskFactors.push('Used by multiple backend services');
    }
    
    if (deps.apiEndpoints.length > 0) {
      riskLevel = 'HIGH';
      riskFactors.push('Referenced in API endpoints');
    }
    
    if (deps.frontendFiles.length > 0) {
      riskFactors.push('Referenced in frontend code');
    }
    
    const assessment = {
      table: table,
      riskLevel: riskLevel,
      riskFactors: riskFactors,
      totalReferences: deps.directReferences.length + deps.indirectReferences.length,
      criticalFiles: [...deps.services, ...deps.apiEndpoints.map(ep => ep.file)]
    };
    
    if (riskLevel === 'HIGH') {
      riskAssessment.highRisk.push(assessment);
    } else if (riskLevel === 'MEDIUM') {
      riskAssessment.mediumRisk.push(assessment);
    } else {
      riskAssessment.lowRisk.push(assessment);
    }
  });
  
  console.log('🔴 HIGH RISK TABLES:');
  riskAssessment.highRisk.forEach(risk => {
    console.log(`   - ${risk.table}: ${risk.riskFactors.join(', ')}`);
    console.log(`     Critical files: ${risk.criticalFiles.join(', ')}`);
  });
  
  console.log('\n🟡 MEDIUM RISK TABLES:');
  riskAssessment.mediumRisk.forEach(risk => {
    console.log(`   - ${risk.table}: ${risk.riskFactors.join(', ')}`);
  });
  
  console.log('\n🟢 LOW RISK TABLES:');
  riskAssessment.lowRisk.forEach(risk => {
    console.log(`   - ${risk.table}: ${risk.riskFactors.join(', ')}`);
  });
  
  // Save dependency map
  const dependencyMap = {
    tables: targetTables,
    dependencies: dependencies,
    riskAssessment: riskAssessment,
    migrationStrategy: generateMigrationStrategy(dependencies, riskAssessment)
  };
  
  const mapPath = './table-dependency-map.json';
  fs.writeFileSync(mapPath, JSON.stringify(dependencyMap, null, 2));
  
  console.log(`\n📄 Dependency map saved to: ${mapPath}`);
  
  return dependencyMap;
}

// Helper functions
function getAllFiles(dir, extensions) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.includes('node_modules') && !item.startsWith('.')) {
        traverse(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  traverse(dir);
  return files;
}

function findLineNumber(content, pattern) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(pattern)) {
      return i + 1;
    }
  }
  return 0;
}

function getContext(content, searchTerm) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(searchTerm.toLowerCase())) {
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 3);
      return lines.slice(start, end).join(' ').trim();
    }
  }
  return '';
}

function extractApiEndpoints(content) {
  const endpoints = [];
  const patterns = [
    /app\.get\('([^']+)'/g,
    /app\.post\('([^']+)'/g,
    /router\.get\('([^']+)'/g,
    /router\.post\('([^']+)'/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      endpoints.push(match[1]);
    }
  });
  
  return endpoints;
}

function generateMigrationStrategy(dependencies, riskAssessment) {
  const strategy = {
    phases: [],
    precautions: [],
    rollbackPlan: []
  };
  
  // Generate phases based on risk
  const lowRiskFirst = riskAssessment.lowRisk.map(r => r.table);
  const mediumRiskNext = riskAssessment.mediumRisk.map(r => r.table);
  const highRiskLast = riskAssessment.highRisk.map(r => r.table);
  
  strategy.phases = [
    {
      phase: 1,
      tables: lowRiskFirst,
      description: 'Low-risk table consolidations',
      estimatedTime: '2-4 hours'
    },
    {
      phase: 2,
      tables: mediumRiskNext,
      description: 'Medium-risk table consolidations',
      estimatedTime: '4-6 hours'
    },
    {
      phase: 3,
      tables: highRiskLast,
      description: 'High-risk table consolidations',
      estimatedTime: '6-8 hours'
    }
  ];
  
  strategy.precautions = [
    'Create full database backups before each phase',
    'Test in staging environment before production',
    'Update all code references before dropping tables',
    'Monitor application performance during migration',
    'Have rollback procedures ready for each phase'
  ];
  
  strategy.rollbackPlan = [
    'Restore tables from backups',
    'Revert code changes',
    'Restart application services',
    'Verify all functionality works'
  ];
  
  return strategy;
}

// Run the dependency mapping
mapTableDependencies();
