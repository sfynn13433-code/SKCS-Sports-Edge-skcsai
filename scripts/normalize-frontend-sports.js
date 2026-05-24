const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'public/data/vip-stress-saturday.json',
  'public/data/team-form-2026-05-17.json',
  'public/data/travel-2026-05-17.json',
  'public/data/injuries-2026-05-17.json',
  'public/data/importance-2026-05-17.json',
  'public/data/team-form-cache.json'
];

const sportReplacements = [
  { from: '"sport": "football"', to: '"sport": "Football"' },
  { from: '"sport": "basketball"', to: '"sport": "Basketball"' },
  { from: '"sport": "cricket"', to: '"sport": "Cricket"' },
  { from: '"sport": "rugby"', to: '"sport": "Rugby"' },
  { from: '"sport": "tennis"', to: '"sport": "Tennis"' },
  { from: '"sport": "mma"', to: '"sport": "MMA"' },
  { from: '"sport": "afl"', to: '"sport": "AFL"' },
  { from: '"sport": "volleyball"', to: '"sport": "Volleyball"' },
  { from: '"sport": "handball"', to: '"sport": "Handball"' },
  { from: '"sport": "hockey"', to: '"sport": "NHL"' },
  { from: '"sport": "baseball"', to: '"sport": "MLB"' },
  { from: '"sport": "nfl"', to: '"sport": "NFL"' },
  { from: '"sport": "American Football"', to: '"sport": "NFL"' },
  { from: '"sport": "Australian Football"', to: '"sport": "AFL"' },
  { from: '"strSport": "American Football"', to: '"strSport": "NFL"' },
  { from: '"strSport": "Australian Football"', to: '"strSport": "AFL"' }
];

console.log('=== NORMALIZING FRONTEND JSON SPORT VALUES ===\n');

for (const filePath of filesToUpdate) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${filePath} - file not found`);
    continue;
  }
  
  console.log(`Processing ${filePath}...`);
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let changes = 0;
    
    for (const replacement of sportReplacements) {
      const regex = new RegExp(replacement.from.replace(/"/g, '\\"'), 'g');
      const matches = content.match(regex);
      if (matches) {
        content = content.replace(regex, replacement.to);
        changes += matches.length;
        console.log(`  ${replacement.from} → ${replacement.to}: ${matches.length} occurrences`);
      }
    }
    
    if (changes > 0) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`  Total changes: ${changes}\n`);
    } else {
      console.log(`  No changes needed\n`);
    }
  } catch (error) {
    console.error(`  Error processing ${filePath}: ${error.message}\n`);
  }
}

console.log('=== NORMALIZATION COMPLETE ===');
