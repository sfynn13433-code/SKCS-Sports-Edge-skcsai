'use strict';

const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..', 'backend');

// All tables from database
const ALL_TABLES = [
    'acca_rules', 'api_raw', 'apisports_raw', 'bookmakers', 'canonical_entities',
    'canonical_events', 'context_intelligence_cache', 'cricket_raw', 'debug_published',
    'event_injury_snapshots', 'event_news_snapshots', 'event_weather_snapshots',
    'events', 'fixture_context_cache', 'injuries', 'injury_reports', 'leagues',
    'matches', 'news_mentions', 'odds_raw', 'odds_snapshots', 'players',
    'prediction_publish_runs', 'prediction_results', 'predictions', 'predictions_accuracy',
    'predictions_filtered', 'predictions_final', 'predictions_raw', 'profiles',
    'rapidapi_cache', 'rapidapi_raw', 'sports', 'sports_fixtures', 'team_stats',
    'teams', 'test', 'tier_rules', 'users'
];

// Expected tables from schema_refactor.sql
const EXPECTED_FROM_SCHEMA = [
    'normalized_fixtures', 'predictions_stage_1', 'predictions_stage_2',
    'predictions_stage_3', 'predictions_final', 'subscription_plans',
    'prediction_results', 'scheduling_logs'
];

function findCodeReferences() {
    const references = {};
    const files = [];
    
    // Find all JS files
    function walkDir(dir) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    walkDir(fullPath);
                }
            } else if (entry.name.endsWith('.js')) {
                files.push(fullPath);
            }
        }
    }
    
    walkDir(path.join(backendDir, 'routes'));
    walkDir(path.join(backendDir, 'services'));
    walkDir(path.join(backendDir, 'utils'));
    walkDir(path.join(backendDir, 'config'));
    walkDir(path.join(backendDir, 'middleware'));
    walkDir(path.join(backendDir, 'scripts'));
    
    // Also check SQL files
    const sqlDir = path.join(__dirname, '..', 'sql');
    if (fs.existsSync(sqlDir)) {
        const sqlFiles = fs.readdirSync(sqlDir);
        for (const f of sqlFiles) {
            if (f.endsWith('.sql')) {
                files.push(path.join(sqlDir, f));
            }
        }
    }
    
    console.log(`Found ${files.length} files to scan\n`);
    
    // Initialize references
    for (const table of ALL_TABLES) {
        references[table] = {
            files: [],
            insertCount: 0,
            selectCount: 0,
            updateCount: 0,
            deleteCount: 0
        };
    }
    
    // Scan each file
    for (const file of files) {
        let content;
        try {
            content = fs.readFileSync(file, 'utf8');
        } catch (e) {
            continue;
        }
        
        const relativePath = path.relative(process.cwd(), file);
        
        for (const table of ALL_TABLES) {
            // Patterns to detect SQL operations
            const patterns = [
                { regex: new RegExp(`from\\s+['"\`]{${table}}['"\`]`, 'gi'), type: 'select' },
                { regex: new RegExp(`into\\s+['"\`]{${table}}['"\`]`, 'gi'), type: 'insert' },
                { regex: new RegExp(`update\\s+['"\`]{${table}}['"\`]`, 'gi'), type: 'update' },
                { regex: new RegExp(`delete\\s+from\\s+['"\`]{${table}}['"\`]`, 'gi'), type: 'delete' },
                { regex: new RegExp(`\\.from\\(['"\`]${table}['"\`]\\)`, 'g'), type: 'supabase' },
                { regex: new RegExp(`\\.into\\(['"\`]${table}['"\`]\\)`, 'g'), type: 'supabase' },
                { regex: new RegExp(`supabase\\.from\\(['"\`]${table}['"\`]\\)`, 'g'), type: 'supabase' }
            ];
            
            for (const p of patterns) {
                const matches = content.match(p.regex);
                if (matches) {
                    references[table].files.push(relativePath);
                    if (p.type === 'insert' || p.type === 'supabase') {
                        references[table].insertCount += matches.length;
                    }
                    if (p.type === 'select') {
                        references[table].selectCount += matches.length;
                    }
                    if (p.type === 'update') {
                        references[table].updateCount += matches.length;
                    }
                    if (p.type === 'delete') {
                        references[table].deleteCount += matches.length;
                    }
                }
            }
        }
    }
    
    return references;
}

function analyzeResults(references, rowCounts) {
    console.log('=== TABLE USAGE ANALYSIS ===\n');
    
    const categories = {
        'WORKING (code + data)': [],
        'ORPHANED (data, no code)': [],
        'EMPTY (code, no data)': [],
        'BROKEN (code, no data, no FK)': [],
        'DEPRECATED (no code, no data)': []
    };
    
    for (const table of ALL_TABLES) {
        const ref = references[table];
        const hasCode = ref.files.length > 0;
        const hasData = (rowCounts[table] || 0) > 0;
        const totalOps = ref.insertCount + ref.selectCount + ref.updateCount + ref.deleteCount;
        
        const entry = {
            table,
            files: ref.files,
            operations: totalOps,
            rowCount: rowCounts[table]
        };
        
        if (hasCode && hasData) {
            categories['WORKING (code + data)'].push(entry);
        } else if (hasData && !hasCode) {
            categories['ORPHANED (data, no code)'].push(entry);
        } else if (hasCode && !hasData) {
            categories['EMPTY (code, no data)'].push(entry);
        } else {
            categories['DEPRECATED (no code, no data)'].push(entry);
        }
    }
    
    // Print results
    for (const [category, items] of Object.entries(categories)) {
        console.log(`\n${category}: ${items.length} tables`);
        console.log('─'.repeat(50));
        
        for (const item of items.sort((a, b) => b.rowCount - a.rowCount)) {
            console.log(`\n  ${item.table}`);
            console.log(`    Rows: ${item.rowCount}`);
            console.log(`    Code refs: ${item.files.length}, Ops: ${item.operations}`);
            if (item.files.length > 0) {
                const uniqueFiles = [...new Set(item.files)];
                uniqueFiles.slice(0, 3).forEach(f => console.log(`      - ${f}`));
                if (uniqueFiles.length > 3) {
                    console.log(`      ... and ${uniqueFiles.length - 3} more`);
                }
            }
        }
    }
    
    // Check for schema_refactor tables that don't exist
    console.log('\n\n=== SCHEMA REFACTOR TABLES CHECK ===');
    console.log('(Tables defined in sql/schema_refactor.sql that should exist)\n');
    
    const MISSING_SCHEMA_TABLES = EXPECTED_FROM_SCHEMA.filter(t => !ALL_TABLES.includes(t));
    if (MISSING_SCHEMA_TABLES.length > 0) {
        console.log('MISSING TABLES (defined in schema but not in DB):');
        MISSING_SCHEMA_TABLES.forEach(t => console.log(`  - ${t}`));
    } else {
        console.log('All schema_refactor tables exist in database!');
    }
    
    // Check for new tables not in schema
    console.log('\n\nEXTRA TABLES (in DB but not in schema_refactor):');
    const EXTRA_TABLES = ALL_TABLES.filter(t => !EXPECTED_FROM_SCHEMA.includes(t));
    EXTRA_TABLES.forEach(t => console.log(`  - ${t}`));
}

const rowCounts = {
    acca_rules: 4, api_raw: 78, apisports_raw: 0, bookmakers: 22,
    canonical_entities: 1716, canonical_events: 137, context_intelligence_cache: 0,
    cricket_raw: 0, debug_published: 0, event_injury_snapshots: 346,
    event_news_snapshots: 108, event_weather_snapshots: 48, events: 260,
    fixture_context_cache: 0, injuries: 0, injury_reports: 0, leagues: 26,
    matches: 5, news_mentions: 0, odds_raw: 0, odds_snapshots: 60,
    players: 0, prediction_publish_runs: 73, prediction_results: 0,
    predictions: 0, predictions_accuracy: 0, predictions_filtered: 2244,
    predictions_final: 48, predictions_raw: 1122, profiles: 1,
    rapidapi_cache: 1, rapidapi_raw: 0, sports: 92, sports_fixtures: 0,
    team_stats: 0, teams: 0, test: 1, tier_rules: 2, users: 0
};

const references = findCodeReferences();
analyzeResults(references, rowCounts);
