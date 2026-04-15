const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, 'backend');

// Files we are hunting for
const targets = ['server.js', 'server-express.js', 'db.js', 'database.js'];
const usageCounts = {
    'server.js': 0,
    'server-express.js': 0,
    'db.js': 0,
    'database.js': 0
};

// Function to recursively find all JS files
function getAllJSFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        try {
            if (fs.statSync(filePath).isDirectory()) {
                // Skip archive and node_modules
                if (!filePath.includes('_archive') && !filePath.includes('node_modules')) {
                    getAllJSFiles(filePath, fileList);
                }
            } else if (filePath.endsWith('.js')) {
                fileList.push(filePath);
            }
        } catch (e) {
            // Skip files we can't access
        }
    }
    return fileList;
}

// 1. Check which server is your main start script
console.log('--- 🔍 1. PACKAGE.JSON STARTUP CHECK ---');
try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const startScript = pkg.scripts && pkg.scripts.start ? pkg.scripts.start : 'Not found';
    console.log(`Your app officially starts using: ${startScript}`);
} catch (e) {
    console.log('Could not read package.json');
}

// 2. Check which files are being imported by the rest of the codebase
console.log('\n--- 🔍 2. CODEBASE IMPORT CHECK ---');
const allFiles = getAllJSFiles(BACKEND_DIR);

allFiles.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for require('./db') or require('../database') etc.
        if (content.includes(`require('./db')`) || content.includes(`require('../db')`)) usageCounts['db.js']++;
        if (content.includes(`require('./database')`) || content.includes(`require('../database')`)) usageCounts['database.js']++;
        
        // Server files aren't usually imported, but we'll check just in case
        if (content.includes(`require('./server')`) || content.includes(`require('../server')`)) usageCounts['server.js']++;
        if (content.includes(`require('./server-express')`) || content.includes(`require('../server-express')`)) usageCounts['server-express.js']++;
    } catch (e) {
        // Skip files we can't read
    }
});

console.log('How many times each file is used by other files in your backend:');
console.table(usageCounts);

// 3. Check render.yaml for startup command
console.log('\n--- 🔍 3. RENDER CONFIG CHECK ---');
try {
    const renderYaml = fs.readFileSync(path.join(__dirname, 'render.yaml'), 'utf8');
    if (renderYaml.includes('server-express.js')) {
        console.log('render.yaml: Uses server-express.js ✅');
    } else if (renderYaml.includes('server.js')) {
        console.log('render.yaml: Uses server.js');
    } else {
        console.log('render.yaml: No server file found');
    }
} catch (e) {
    console.log('Could not read render.yaml');
}

console.log('\n--- 🔍 4. FILE EXISTENCE CHECK ---');
targets.forEach(target => {
    const filePath = path.join(BACKEND_DIR, target);
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`${target}: EXISTS (${stats.size} bytes)`);
    } else {
        console.log(`${target}: NOT FOUND`);
    }
});

console.log('\n✅ Scan complete. Share these results to make the final call!');
