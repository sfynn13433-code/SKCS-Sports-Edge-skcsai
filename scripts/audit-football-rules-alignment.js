'use strict';

const fs = require('fs');
const path = require('path');
const { FOOTBALL_RULES } = require('../backend/config/footballRules');

const ROOT = path.resolve(__dirname, '..');

function readFileSafe(relPath) {
    const absPath = path.join(ROOT, relPath);
    try {
        return fs.readFileSync(absPath, 'utf8');
    } catch (_) {
        return null;
    }
}

function exists(relPath) {
    return fs.existsSync(path.join(ROOT, relPath));
}

function extractTierRowsFromSql(sqlText) {
    if (!sqlText) return [];
    const rows = [];
    const regex = /\(\s*'([^']+)'\s*,\s*(\d+(?:\.\d+)?)\s*,\s*'\["ALL"\]'::jsonb\s*,\s*(\d+)/g;
    let match = regex.exec(sqlText);
    while (match) {
        rows.push({
            tier: match[1],
            min_confidence: Number(match[2]),
            max_acca_size: Number(match[3])
        });
        match = regex.exec(sqlText);
    }
    return rows;
}

function extractTierRowsFromBootstrap(jsText) {
    if (!jsText) return [];
    const rows = [];
    const regex = /'([^']+)'\s*,\s*(\d+(?:\.\d+)?)\s*,\s*'\["ALL"\]'::jsonb\s*,\s*(\d+)/g;
    let match = regex.exec(jsText);
    while (match) {
        if (match[1] === 'normal' || match[1] === 'deep') {
            rows.push({
                tier: match[1],
                min_confidence: Number(match[2]),
                max_acca_size: Number(match[3])
            });
        }
        match = regex.exec(jsText);
    }
    return rows;
}

function findFirstNumberByPattern(text, pattern) {
    if (!text) return null;
    const m = text.match(pattern);
    if (!m) return null;
    const value = Number(m[1]);
    return Number.isFinite(value) ? value : null;
}

function main() {
    const importantFiles = [
        'backend/apiClients.js',
        'backend/services/dataProvider.js',
        'backend/services/rapidApiWaterfall.js',
        'scripts/fetch-live-fixtures.js',
        'backend/services/direct1x2Builder.js',
        'backend/services/direct1x2Engine.js',
        'backend/utils/secondaryMarketSelector.js',
        'backend/services/filterEngine.js',
        'backend/services/aiPipeline.js',
        'backend/services/marketIntelligence.js',
        'backend/utils/accaLogicEngine.js',
        'backend/services/accaBuilder.js',
        'backend/routes/predictions.js',
        'backend/dbBootstrap.js',
        'sql/tier_rules.sql',
        'backend/config.js',
        'public/index.html',
        'public/direct-markets.html',
        'scripts/build-acca.js'
    ];

    console.log('=== SKCS Football Rules Alignment Audit ===\n');
    console.log('Canonical FOOTBALL_RULES:');
    console.log(JSON.stringify(FOOTBALL_RULES, null, 2));
    console.log('');

    console.log('Important file presence:');
    const filePresence = importantFiles.map((relPath) => ({
        file: relPath,
        exists: exists(relPath)
    }));
    filePresence.forEach((entry) => {
        console.log(`- ${entry.exists ? '[OK]' : '[MISSING]'} ${entry.file}`);
    });

    console.log('\nKnown drift areas:');

    const tierSql = readFileSafe('sql/tier_rules.sql');
    const bootstrap = readFileSafe('backend/dbBootstrap.js');
    const sqlRows = extractTierRowsFromSql(tierSql);
    const bootstrapRows = extractTierRowsFromBootstrap(bootstrap);
    const tierDrift = {
        sqlRows,
        bootstrapRows,
        mismatch: JSON.stringify(sqlRows) !== JSON.stringify(bootstrapRows)
    };
    console.log(`1. sql/tier_rules.sql vs dbBootstrap.js seed mismatch: ${tierDrift.mismatch ? 'DRIFT DETECTED' : 'ALIGNED'}`);
    console.log(`   sql rows: ${JSON.stringify(sqlRows)}`);
    console.log(`   dbBootstrap rows: ${JSON.stringify(bootstrapRows)}`);

    const accaBuilder = readFileSafe('backend/services/accaBuilder.js');
    const buildAccaScript = readFileSafe('scripts/build-acca.js');
    const accaDuplication = Boolean(accaBuilder && buildAccaScript);
    console.log(`2. accaBuilder.js vs scripts/build-acca.js duplication: ${accaDuplication ? 'PRESENT (needs human governance)' : 'NOT DETECTED'}`);

    const secondarySelector = readFileSafe('backend/utils/secondaryMarketSelector.js');
    const secondaryGatekeeper = readFileSafe('scripts/secondary-market-gatekeeper.js');
    const secondaryGovernanceDup = Boolean(secondarySelector && secondaryGatekeeper);
    console.log(`3. secondary market governance duplication: ${secondaryGovernanceDup ? 'PRESENT (service + script rulesets)' : 'NOT DETECTED'}`);

    const indexHtml = readFileSafe('public/index.html');
    const mi = readFileSafe('backend/services/marketIntelligence.js');
    const uiMinConfidence = findFirstNumberByPattern(indexHtml, /const\s+minConfidence\s*=\s*[^?;:]*\?\s*(\d+)/);
    const backendAccaMin = findFirstNumberByPattern(mi, /const\s+ACCA_CONFIDENCE_MIN\s*=\s*(\d+)/);
    const confidenceFloorMismatch =
        Number.isFinite(uiMinConfidence)
        && Number.isFinite(backendAccaMin)
        && uiMinConfidence !== backendAccaMin;
    console.log(`4. confidence floor mismatch across UI/backend: ${confidenceFloorMismatch ? 'DRIFT DETECTED' : 'ALIGNED/UNKNOWN'}`);
    console.log(`   UI minConfidence sample: ${uiMinConfidence}`);
    console.log(`   Backend ACCA_CONFIDENCE_MIN sample: ${backendAccaMin}`);

    const syncService = readFileSafe('backend/services/syncService.js');
    const aiPipeline = readFileSafe('backend/services/aiPipeline.js');
    const accaBuilderText = readFileSafe('backend/services/accaBuilder.js');
    const phaseHits = [
        ['backend/services/syncService.js', (syncService?.match(/phase_1_football_only/g) || []).length],
        ['backend/services/aiPipeline.js', (aiPipeline?.match(/phase_1_football_only/g) || []).length],
        ['backend/services/accaBuilder.js', (accaBuilderText?.match(/phase_1_football_only/g) || []).length]
    ];
    const phaseDrift = phaseHits.some(([, count]) => count === 0) && phaseHits.some(([, count]) => count > 0);
    console.log(`5. phase_1_football_only comment drift: ${phaseDrift ? 'DRIFT DETECTED' : 'CONSISTENT OR NOT PRESENT'}`);
    phaseHits.forEach(([file, count]) => {
        console.log(`   ${file}: ${count} hit(s)`);
    });

    console.log('\nAudit complete. No files modified by this script.');
}

main();
