'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function source(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
}

test('scheduler mutation routes use only the canonical scheduler middleware', () => {
    const text = source('backend/routes/scheduler.js');

    for (const declaration of [
        "router.post('/trigger-fixture-sync', requireSchedulerSecret",
        "router.post('/trigger-context-enrichment', requireSchedulerSecret",
        "router.post('/trigger-sportsrc-health', requireSchedulerSecret",
        "router.post('/trigger-ai-pipeline', requireSchedulerSecret"
    ]) {
        assert.ok(text.includes(declaration), declaration);
    }

    assert.doesNotMatch(text, /requireAdminKey/);
    assert.doesNotMatch(text, /x-admin-key/);
});

test('pipeline run-full accepts only the scheduler credential boundary', () => {
    const text = source('backend/routes/pipeline.js');

    assert.ok(text.includes("router.post('/run-full', requireSchedulerSecret, runFullHandler)"));
    assert.ok(text.includes("router.get('/run-full', requireSchedulerSecret, runFullHandler)"));
    assert.doesNotMatch(text, /requirePipelineTriggerKey/);
    assert.doesNotMatch(text, /SKCS_REFRESH_KEY/);
    assert.doesNotMatch(text, /req\.headers\[['"]x-api-key['"]\]/);
});

test('cricket cron routes reject query-string credentials', () => {
    const text = source('backend/routes/cricketCron.js');

    for (const declaration of [
        "router.get('/cricket/cricbuzz', requireSchedulerSecret",
        "router.get('/cricket/cricapi/daily', requireSchedulerSecret",
        "router.get('/cricket/cricapi/live', requireSchedulerSecret"
    ]) {
        assert.ok(text.includes(declaration), declaration);
    }

    assert.doesNotMatch(text, /req\.query\.secret/);
    assert.doesNotMatch(text, /verifyCronSecret/);
});

test('server mutation endpoints are scheduler-secret protected', () => {
    const text = source('backend/server-express.js');

    assert.ok(
        text.includes(
            "app.post('/api/pipeline/trigger', requireSchedulerSecret, express.json({ limit: '10mb' })"
        )
    );
    assert.ok(
        text.includes(
            "app.post('/api/internal/fetch-fixtures', requireSchedulerSecret"
        )
    );
    assert.match(text, /const \{ publishRunId \} = req\.body \|\| \{\}/);
});

test('canonical scheduler middleware remains header-only and fail-closed', () => {
    const text = source('backend/utils/auth.js');

    assert.match(text, /requireSchedulerSecret = createSecretMiddleware/);
    assert.match(text, /environmentVariable: 'CRON_SECRET'/);
    assert.match(text, /headerNames: \['x-cron-secret'\]/);
    assert.doesNotMatch(text, /req\.query\.secret/);
    assert.doesNotMatch(text, /startsWith\(['"]\/api\/cron/);
});
