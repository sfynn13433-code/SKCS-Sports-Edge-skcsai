'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'reports');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'execution-spine-compliance-map.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'execution-spine-compliance-map.md');

const EXCLUDE_DIRS = new Set([
    '.git',
    'node_modules',
    'terminals',
    'agent-transcripts',
    'coverage',
    'dist',
    'build'
]);

const SCAN_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.json', '.md']);
const SOURCE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx']);
const SPINE_IMPLEMENTATION_FILES = new Set([
    'backend/core/executionPipeline.js',
    'backend/core/verificationController.js',
    'backend/semantic-layer/preflightSimulator.js',
    'backend/semantic-layer/gatekeeperAdapter.js',
    'backend/semantic-layer/governanceGatekeeper.js',
    'backend/semantic-layer/verificationController.js',
    'backend/semantic-layer/controlPlaneEvaluator.js',
    'backend/semantic-layer/decisionFingerprintService.js',
    'backend/semantic-layer/errorMemoryLayer.js',
    'backend/services/systemTruthLogger.js',
    'backend/services/pipelineMetricsService.js',
    'backend/services/semanticDriftSummaryService.js',
    'backend/services/aiPipeline.js',
    'backend/services/aiProvider.js',
    'backend/services/aiScoring.js',
    'backend/services/thesportsdbPipeline.js',
    'refresh-ai-insights.js',
    'scripts/publish-cricbuzz-cricket.js',
    'test-ai-insights.js',
    'check-recent-predictions.js'
]);

const RULES = [
    { id: 'wrapped_execute_operation', label: 'Wrapped execution spine', pattern: /\bexecuteOperation\s*\(/g },
    { id: 'direct_cron_schedule', label: 'Direct cron scheduling', pattern: /\bcron\.schedule\s*\(/g },
    { id: 'direct_ai_call_generateInsight', label: 'Direct AI insight call', pattern: /\bgenerateInsight\s*\(/g },
    { id: 'direct_ai_call_dolphin', label: 'Direct Dolphin call', pattern: /\banalyzeWithDolphin\s*\(/g },
    { id: 'direct_ai_call_generateEdgeMindInsight', label: 'Direct EdgeMind generation call', pattern: /\bgenerateEdgeMindInsight\s*\(/g },
    { id: 'direct_ai_call_runPipelineForMatches', label: 'Direct AI pipeline call', pattern: /\brunPipelineForMatches\s*\(/g },
    { id: 'direct_ai_call_runPipelineFromConfiguredDataMode', label: 'Configured pipeline call', pattern: /\brunPipelineFromConfiguredDataMode\s*\(/g },
    { id: 'direct_ai_call_rebuildFinalOutputs', label: 'Final rebuild call', pattern: /\brebuildFinalOutputs\s*\(/g },
    { id: 'direct_pipeline_entry_sync', label: 'Direct sync pipeline call', pattern: /\bsyncDailyFixtures\s*\(/g },
    { id: 'direct_pipeline_entry_enrich', label: 'Direct enrichment call', pattern: /\benrichMatchContext\s*\(/g },
    { id: 'direct_pipeline_entry_insight', label: 'Direct insight generation call', pattern: /\bgenerateEdgeMindInsight\s*\(/g },
    { id: 'direct_pipeline_entry_syncSports', label: 'Direct syncService call', pattern: /\bsyncSports\s*\(/g },
    { id: 'direct_pipeline_entry_syncAllSports', label: 'Direct syncAllSports call', pattern: /\bsyncAllSports\s*\(/g },
    { id: 'direct_pipeline_entry_refreshMetrics', label: 'Direct health refresh call', pattern: /\brefreshPipelineHealthState\s*\(/g },
    { id: 'direct_pipeline_entry_publishCricket', label: 'Direct cricket publish call', pattern: /\bpublishCricbuzzCricket\s*\(/g },
    { id: 'raw_insert', label: 'Raw SQL insert', pattern: /\bINSERT\s+INTO\b/gi },
    { id: 'raw_update', label: 'Raw SQL update', pattern: /\bUPDATE\s+\w+/gi },
    { id: 'raw_delete', label: 'Raw SQL delete', pattern: /\bDELETE\s+FROM\b/gi }
];

function walk(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (EXCLUDE_DIRS.has(entry.name)) {
            continue;
        }

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath, files);
            continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        if (SCAN_EXTENSIONS.has(ext)) {
            files.push(fullPath);
        }
    }

    return files;
}

function toRelative(filePath) {
    return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const findings = [];

    for (const rule of RULES) {
        const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const index = match.index;
            const lineNumber = content.slice(0, index).split(/\r?\n/).length;
            findings.push({
                ruleId: rule.id,
                label: rule.label,
                line: lineNumber,
                excerpt: lines[lineNumber - 1]?.trim() || ''
            });
        }
    }

    const hasWrapper = /\bexecuteOperation\s*\(/.test(content);
    const isSourceFile = SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
    const bypassCandidate = isSourceFile
        && !hasWrapper
        && !SPINE_IMPLEMENTATION_FILES.has(toRelative(filePath))
        && findings.some((finding) => finding.ruleId.startsWith('direct_pipeline_entry_') || finding.ruleId.startsWith('direct_ai_call_'));
    return {
        file: toRelative(filePath),
        hasWrapper,
        bypassCandidate,
        findings
    };
}

function buildReport(results) {
    const summary = {
        filesScanned: results.length,
        filesWithFindings: results.filter((r) => r.findings.length > 0).length,
        wrappedFiles: results.filter((r) => r.hasWrapper).length,
        bypassCandidates: results.filter((r) => r.bypassCandidate).length,
        directCrons: 0,
        directAICalls: 0,
        directPipelineEntries: 0,
        rawSqlWrites: 0
    };

    for (const result of results) {
        for (const finding of result.findings) {
            if (finding.ruleId === 'direct_cron_schedule') summary.directCrons += 1;
            if (finding.ruleId === 'direct_ai_call_generateInsight' || finding.ruleId === 'direct_ai_call_dolphin') summary.directAICalls += 1;
            if (
                finding.ruleId === 'direct_pipeline_entry_sync'
                || finding.ruleId === 'direct_pipeline_entry_enrich'
                || finding.ruleId === 'direct_pipeline_entry_insight'
            ) {
                summary.directPipelineEntries += 1;
            }
            if (finding.ruleId === 'raw_insert' || finding.ruleId === 'raw_update' || finding.ruleId === 'raw_delete') {
                summary.rawSqlWrites += 1;
            }
        }
    }

    const markdown = [
        '# SKCS Execution Spine Compliance Map',
        '',
        '## Summary',
        `- Files scanned: ${summary.filesScanned}`,
        `- Files with findings: ${summary.filesWithFindings}`,
        `- Files already using \`executeOperation\`: ${summary.wrappedFiles}`,
        `- Bypass candidates without wrapper: ${summary.bypassCandidates}`,
        `- Direct cron schedules: ${summary.directCrons}`,
        `- Direct AI calls: ${summary.directAICalls}`,
        `- Direct pipeline entry calls: ${summary.directPipelineEntries}`,
        `- Raw SQL write surfaces: ${summary.rawSqlWrites}`,
        '',
        '## Findings',
        ...results.flatMap((result) => {
            if (result.findings.length === 0) {
                return [];
            }

            return [
                `### ${result.file}`,
                `- Wrapped with \`executeOperation\`: ${result.hasWrapper ? 'yes' : 'no'}`,
                `- Bypass candidate: ${result.bypassCandidate ? 'yes' : 'no'}`,
                ...result.findings.map((finding) => `- ${finding.label} at line ${finding.line}: \`${finding.excerpt}\``),
                ''
            ];
        })
    ].join('\n');

    return { summary, markdown };
}

function main() {
    const files = walk(ROOT);
    const results = files.map(analyzeFile);
    const report = buildReport(results);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify({
        generatedAt: new Date().toISOString(),
        summary: report.summary,
        results
    }, null, 2));
    fs.writeFileSync(OUTPUT_MD, report.markdown);

    console.log(JSON.stringify({
        ok: true,
        json: path.relative(ROOT, OUTPUT_JSON),
        markdown: path.relative(ROOT, OUTPUT_MD),
        summary: report.summary
    }, null, 2));
}

if (require.main === module) {
    main();
}

