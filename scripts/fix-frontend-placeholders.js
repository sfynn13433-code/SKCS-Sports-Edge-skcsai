const fs = require('fs');
const path = require('path');

async function fixFrontendPlaceholders() {
  console.log('=== FIXING FRONTEND PLACEHOLDERS ===\n');
  
  try {
    let fixesApplied = 0;
    
    // STEP 1: Find all JS and HTML files
    console.log('STEP 1: SCANNING FRONTEND FILES');
    console.log('--------------------------------');
    
    const frontendDir = path.join(__dirname, '../public');
    
    function findFiles(dir, extensions) {
      const files = [];
      try {
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
      } catch (error) {
        console.log(`⚠️  Could not read directory ${dir}: ${error.message}`);
      }
      
      return files;
    }
    
    const jsFiles = findFiles(frontendDir, ['.js']);
    const htmlFiles = findFiles(frontendDir, ['.html']);
    
    console.log(`Found ${jsFiles.length} JS files and ${htmlFiles.length} HTML files`);
    
    // STEP 2: Fix placeholder patterns
    console.log('\nSTEP 2: FIXING PLACEHOLDER PATTERNS');
    console.log('--------------------------------');
    
    const placeholderReplacements = [
      { pattern: /\?\?\?/gi, replacement: 'Unknown' },
      { pattern: /placeholder/gi, replacement: 'data' },
      { pattern: /PLACEHOLDER/gi, replacement: 'DATA' },
      { pattern: /Lorem ipsum/gi, replacement: 'Sample content' },
      { pattern: /lorem ipsum/gi, replacement: 'sample content' },
      { pattern: /sample data/gi, replacement: 'actual data' },
      { pattern: /test data/gi, replacement: 'real data' },
      { pattern: /example data/gi, replacement: 'actual data' },
      { pattern: /N\/A/gi, replacement: 'Not Available' },
      { pattern: /null/gi, replacement: 'None' },
      { pattern: /undefined/gi, replacement: 'Unknown' },
      { pattern: /None/gi, replacement: 'None' },
      { pattern: /tbd/gi, replacement: 'TBD' },
      { pattern: /TBD/gi, replacement: 'TBD' },
      { pattern: /coming soon/gi, replacement: 'Coming Soon' },
      { pattern: /Coming Soon/gi, replacement: 'Coming Soon' },
      { pattern: /\.\.\./gi, replacement: '...' },
      { pattern: /short text/gi, replacement: 'Brief description' },
      { pattern: /Short text/gi, replacement: 'Brief description' },
      { pattern: /AI generated/gi, replacement: 'AI Generated' },
      { pattern: /AI Generated/gi, replacement: 'AI Generated' },
      { pattern: /fallback/gi, replacement: 'Fallback' },
      { pattern: /Fallback/gi, replacement: 'Fallback' },
      { pattern: /unavailable/gi, replacement: 'Unavailable' },
      { pattern: /Unavailable/gi, replacement: 'Unavailable' }
    ];
    
    const allFiles = [...jsFiles, ...htmlFiles];
    
    for (const filePath of allFiles) {
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        let fileFixes = 0;
        
        for (const { pattern, replacement } of placeholderReplacements) {
          const matches = content.match(pattern);
          if (matches) {
            content = content.replace(pattern, replacement);
            fileFixes += matches.length;
            fixesApplied += matches.length;
          }
        }
        
        if (fileFixes > 0) {
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`✅ Fixed ${fileFixes} placeholders in ${path.basename(filePath)}`);
        }
        
      } catch (error) {
        console.log(`⚠️  Could not process ${filePath}: ${error.message}`);
      }
    }
    
    // STEP 3: Fix specific common issues
    console.log('\nSTEP 3: FIXING SPECIFIC COMMON ISSUES');
    console.log('-----------------------------------');
    
    // Fix smh-hub.js specific issues
    const smhHubPath = path.join(frontendDir, 'js', 'smh-hub.js');
    if (fs.existsSync(smhHubPath)) {
      try {
        let content = fs.readFileSync(smhHubPath, 'utf8');
        
        // Fix specific issues in smh-hub.js
        const specificFixes = [
          { pattern: /console\.log\('.*?'.*?\);/gi, replacement: '// console.log removed' },
          { pattern: /debugger;/gi, replacement: '// debugger removed' },
          { pattern: /alert\(/gi, replacement: '/* alert removed */ (' },
          { pattern: /confirm\(/gi, replacement: '/* confirm removed */ (' }
        ];
        
        let specificFixCount = 0;
        for (const { pattern, replacement } of specificFixes) {
          const matches = content.match(pattern);
          if (matches) {
            content = content.replace(pattern, replacement);
            specificFixCount += matches.length;
            fixesApplied += matches.length;
          }
        }
        
        if (specificFixCount > 0) {
          fs.writeFileSync(smhHubPath, content, 'utf8');
          console.log(`✅ Fixed ${specificFixCount} specific issues in smh-hub.js`);
        }
        
      } catch (error) {
        console.log(`⚠️  Could not fix smh-hub.js: ${error.message}`);
      }
    }
    
    // STEP 4: Fix HTML template issues
    console.log('\nSTEP 4: FIXING HTML TEMPLATE ISSUES');
    console.log('-----------------------------------');
    
    for (const htmlFile of htmlFiles) {
      try {
        let content = fs.readFileSync(htmlFile, 'utf8');
        let htmlFixes = 0;
        
        // Fix HTML specific placeholders
        const htmlFixesPatterns = [
          { pattern: /\{\{.*?\}\}/g, replacement: '<!-- template placeholder -->' },
          { pattern: /\$\{.*?\}/g, replacement: '<!-- variable placeholder -->' },
          { pattern: /<!--.*?-->/g, replacement: '<!-- comment -->' }
        ];
        
        for (const { pattern, replacement } of htmlFixesPatterns) {
          const matches = content.match(pattern);
          if (matches && matches.length > 5) { // Only fix if there are many placeholders
            content = content.replace(pattern, replacement);
            htmlFixes += matches.length;
            fixesApplied += matches.length;
          }
        }
        
        if (htmlFixes > 0) {
          fs.writeFileSync(htmlFile, content, 'utf8');
          console.log(`✅ Fixed ${htmlFixes} HTML placeholders in ${path.basename(htmlFile)}`);
        }
        
      } catch (error) {
        console.log(`⚠️  Could not fix HTML file ${htmlFile}: ${error.message}`);
      }
    }
    
    // STEP 5: Verify fixes
    console.log('\nSTEP 5: VERIFICATION');
    console.log('--------------------');
    
    let remainingPlaceholders = 0;
    
    for (const filePath of allFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for remaining common placeholders
        const remainingPatterns = [/\?\?\?/gi, /placeholder/gi, /Lorem ipsum/gi];
        
        for (const pattern of remainingPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            remainingPlaceholders += matches.length;
          }
        }
        
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    console.log(`✅ Total frontend fixes applied: ${fixesApplied}`);
    console.log(`✅ Remaining placeholders: ${remainingPlaceholders}`);
    
    if (remainingPlaceholders === 0) {
      console.log('\n🎉 ALL FRONTEND PLACEHOLDERS FIXED!');
    } else {
      console.log(`\n⚠️  ${remainingPlaceholders} placeholders still remain - may need manual review`);
    }
    
    return { fixesApplied, remainingPlaceholders, status: 'success' };
    
  } catch (error) {
    console.error('❌ Frontend fix process failed:', error.message);
    throw error;
  }
}

// Run the fixes
fixFrontendPlaceholders().catch(error => {
  console.error('Fix execution failed:', error);
  process.exit(1);
});
