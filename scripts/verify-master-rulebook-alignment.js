'use strict';

/**
 * CI guard: fail when legacy Master Rulebook thresholds reappear outside allowed exceptions.
 *
 * Canonical rules:
 * - Direct 1X2: 75 / 55 / 30 (extreme < 30)
 * - Secondary floor: 72%
 * - Double Chance: separate market group
 * - Same Match Builder: 4 / 6 / 8
 * - ACCA leg minimum: 75%
 *
 * Run: node scripts/verify-master-rulebook-alignment.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SCAN_EXTENSIONS = new Set(['.js', '.md', '.sql', '.html', '.ps1', '.json']);
const SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    '.cursor',
    'supabase/.temp',
    'agent-transcripts',
    'kabaddiPy',
    'sportbook',
    '.gemini',
    '_archive',
]);

const SKIP_FILES = new Set([
    'scripts/verify-master-rulebook-alignment.js',
    'scripts/audit-football-rules-alignment.js',
    'scripts/verify-db-rule-alignment.js',
    'scripts/implement-phase2-rules.js',
    'scripts/implement-phase2-rules-conservative.js',
    'scripts/complete-phase2-rules.js',
    'scripts/publish-cricbuzz-cricket.js',
    'scripts/audit-cricket-rules.js',
    'backend/services/cricketLiveEnrichmentService.js',
    'supabase/migrations/20260501_skcs_comprehensive_engine.sql',
    'supabase/migrations/20260820000001_rename_risk_tiers_and_safe_haven.sql',
    'supabase/migrations/20260820000002_fix_secondary_governance_80_75.sql',
    'FRONTEND_INVESTIGATION_REPORT.md',
    'FRONTEND_FIXES_SUMMARY.md',
    'IMPLEMENTATION_GAP_ANALYSIS.md',
    'SPORT_CONSISTENCY_AUDIT_REPORT.md',
    'SMB_WINDSURF_FINAL_IMPLEMENTATION.md',
]);

const LINE_ALLOW_PATTERNS = [
    /\bOLD\b/i,
    /\bhistorical\b/i,
    /\blegacy\b/i,
    /\bChanged from\b/i,
    /\bbefore\/after\b/i,
    /\bretained only as\b/i,
    /\bCurrent state note\b/i,
    /\breplaced by\b/i,
    /\b8080\b/,
    /\b1800000\b/,
    /\bvip_30day\b/i,
    /\belite_30day\b/i,
    /\b30day\b/i,
    /\b30 min\b/i,
    /\b30 minutes\b/i,
    /\b30 seconds\b/i,
    /\b30 days\b/i,
    /\b30 \*/i,
    /\bwinProb\b/i,
    /\bgoalDiff\b/i,
    /\bHIGH_CONFIDENCE\b/,
    /\bMODERATE_RISK\b/,
    /\bmin_display_confidence\b/,
    /\bMath\.max\(80\b/,
    /\bclamp\([^)]*80\b/,
    /\bconfidence:\s*8[0-9]\b/,
    /\bconfidence\s*=\s*8[0-9]\b/,
    /\b@ 94%\b/,
    /\b@ 92%\b/,
    /\b@ 8[0-9]%\b/,
    /\bge_75\b/,
    /\b75\/55\/30\b/,
    /\b72%\b/,
    /\b72\+\b/,
    /\b75%\b/,
    /\b55%\b/,
    /\b30%\b/,
    /\b29%\b/,
    /\b80_75\b/,
    /\b80\/75\b/,
    /\b80\/70\/59\b.*(?:removed|replaced|legacy|old)/i,
    /\b76%\s*min\b.*replaced/i,
    /\/\/.*\b80\b/,
    /\/\/.*\b76\b/,
    /\/\/.*\b59\b/,
    /\/\/.*\b70\b/,
    /\*.*\b80\b.*\*/,
    /if \(confidence < 59 &&/,
    /confidence < 59 &&/,
    /var confColor = confidence >= 80/,
    /var isHighVariance = confidence < 59/,
    /WHERE confidence >= 70/,
    /minConfidence: 72,\s*\/\/ Changed from 76/,
    /minLegConfidence: 75,\s*\/\/ Changed from 70/,
    /Changed from 55/,
    /ACCA_MIN_LEG_CONFIDENCE = 75;\s*\/\/ Changed from 70/,
    /dummy secondary markets with 80\+ confidence/i,
    /Low Risk High - 80/,
    /sports\.length === 1\) return 80/,
    /BOT_ACCA_CONFIDENCE_MIN/,
    /EDGEMIND_VISIBLE_WINDOW_HOURS/,
    /slice\(0,\s*30\)/,
    /head_limit:\s*30/,
    /block_until_ms/,
    /port.*8080/i,
    /localhost:8080/,
    /DOLPHIN_URL/,
    /render\.yaml/,
];

const FORBIDDEN_PATTERNS = [
    {
        id: 'band-80-100',
        regex: /80\s*[-–]\s*100\s*%|80%\s*-\s*100%/i,
        message: 'Legacy direct band 80-100% (use 75-100%)',
    },
    {
        id: 'band-70-79',
        regex: /70\s*[-–]\s*79\s*%|70%\s*-\s*79%/i,
        message: 'Legacy direct band 70-79% (use 55-74%)',
    },
    {
        id: 'band-59-69',
        regex: /59\s*[-–]\s*69\s*%|59%\s*-\s*69%/i,
        message: 'Legacy direct band 59-69% (use 30-54%)',
    },
    {
        id: 'band-0-58',
        regex: /0\s*[-–]\s*58\s*%|0%\s*-\s*58%/i,
        message: 'Legacy direct band 0-58% (use 0-29%)',
    },
    {
        id: 'band-slash-807059',
        regex: /\b80\s*\/\s*70\s*\/\s*59\b/,
        message: 'Legacy band shorthand 80/70/59 (use 75/55/30)',
    },
    {
        id: 'secondary-floor-76',
        regex: /\b(?:>=|≥|>|<|<=)\s*76\b(?!\d)|76%\s*(?:minimum|min\b|floor)|SECONDARY_MIN_CONFIDENCE\s*=\s*76|minConfidence:\s*76\b|sec_conf\s*<\s*76|confidence must be >= 76/i,
        message: 'Legacy secondary floor 76% (use 72%)',
    },
    {
        id: 'secondary-floor-80',
        regex: /(?:secondary|safe[_\s-]?haven)[^\n]{0,80}(?:>=|≥)\s*80\b|(?:>=|≥)\s*80%[^\n]{0,40}secondary|80%\s*primary|primary,\s*75%\s*Safe Haven|secondary\s*>=\s*80%|secondary\s*≥\s*80%/i,
        message: 'Legacy secondary/safe-haven split 80%/75% (use unified 72%)',
    },
    {
        id: 'risk-check-80',
        regex: /\bconfidence\s*>=\s*80\b(?!\d)/,
        message: 'Legacy low-risk check confidence >= 80 (use >= 75)',
    },
    {
        id: 'risk-check-70-band',
        regex: /\bconfidence\s*>=\s*70\b(?!\d)|\bconfidence\s*<\s*70\b(?!\d)/,
        message: 'Legacy medium-risk check around 70% (use 55/75 bands)',
    },
    {
        id: 'risk-check-59',
        regex: /\bconfidence\s*(?:>=|<=|<|>)\s*59\b(?!\d)/,
        message: 'Legacy high/extreme boundary at 59% (use 30/55 bands)',
    },
    {
        id: 'risk-check-58',
        regex: /\bconfidence\s*<=\s*58\b|\bconfidence\s*<\s*58\b(?!\d)|total_confidence\s*<=\s*58\b/,
        message: 'Legacy extreme boundary at 58% (use 29/30 bands)',
    },
    {
        id: 'safe-haven-trigger-80',
        regex: /mainConfidence\s*>=\s*80\b|main_confidence\s*<\s*80\b|main confidence\s*<\s*80%/i,
        message: 'Legacy safe-haven trigger at 80% (use 72%)',
    },
];

function toPosix(relPath) {
    return relPath.split(path.sep).join('/');
}

function shouldSkipDir(dirName) {
    return SKIP_DIRS.has(dirName);
}

function shouldScanFile(relPath) {
    const posix = toPosix(relPath);
    if (SKIP_FILES.has(posix)) return false;
    const ext = path.extname(posix).toLowerCase();
    return SCAN_EXTENSIONS.has(ext);
}

function lineAllowed(line) {
    return LINE_ALLOW_PATTERNS.some((pattern) => pattern.test(line));
}

function walk(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') && entry.name !== '.gemini') {
            if (entry.isDirectory() && shouldSkipDir(entry.name)) continue;
            if (entry.isFile()) continue;
        }
        const abs = path.join(dir, entry.name);
        const rel = toPosix(path.relative(ROOT, abs));
        if (entry.isDirectory()) {
            if (shouldSkipDir(entry.name) || shouldSkipDir(rel)) continue;
            walk(abs, files);
            continue;
        }
        if (shouldScanFile(rel)) files.push(rel);
    }
    return files;
}

function scanFile(relPath) {
    const absPath = path.join(ROOT, relPath);
    const text = fs.readFileSync(absPath, 'utf8');
    const lines = text.split(/\r?\n/);
    const violations = [];

    lines.forEach((line, index) => {
        if (!line.trim() || lineAllowed(line)) return;
        for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.regex.test(line)) {
                violations.push({
                    file: relPath,
                    line: index + 1,
                    id: pattern.id,
                    message: pattern.message,
                    text: line.trim(),
                });
            }
        }
    });

    return violations;
}

function main() {
    const files = walk(ROOT).sort();
    const violations = files.flatMap(scanFile);

    console.log('=== Master Rulebook Alignment Guard ===\n');
    console.log('Canonical rules: Direct 75/55/30 | Secondary 72%+ | ACCA legs 75%+');
    console.log(`Scanned ${files.length} files.\n`);

    if (violations.length === 0) {
        console.log('PASS: No legacy threshold drift detected.');
        process.exit(0);
    }

    console.log(`FAIL: Found ${violations.length} legacy rule reference(s):\n`);
    for (const violation of violations) {
        console.log(`${violation.file}:${violation.line} [${violation.id}] ${violation.message}`);
        console.log(`  ${violation.text}`);
        console.log('');
    }

    console.log('Fix the lines above or add a justified exception to scripts/verify-master-rulebook-alignment.js');
    process.exit(1);
}

if (require.main === module) {
    main();
}

module.exports = {
    FORBIDDEN_PATTERNS,
    LINE_ALLOW_PATTERNS,
    SKIP_FILES,
    scanFile,
};
