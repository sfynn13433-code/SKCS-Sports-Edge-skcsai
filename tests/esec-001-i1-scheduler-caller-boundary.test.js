'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function source(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
}

test('Vercel scheduler proxy validates Bearer CRON_SECRET and forwards dedicated header', () => {
    const text = source('api/pipeline/run-full.js');

    assert.match(text, /process\.env\.CRON_SECRET/);
    assert.match(text, /extractBearerToken\(req\)/);
    assert.match(text, /timingSafeEqual/);
    assert.match(text, /'x-cron-secret': cronSecret/);
    assert.doesNotMatch(text, /ADMIN_API_KEY/);
    assert.doesNotMatch(text, /SKCS_REFRESH_KEY/);
    assert.doesNotMatch(text, /x-api-key/i);
});

test('deployment trigger uses only CRON_SECRET', () => {
    const text = source('backend/deploy-trigger.js');

    assert.match(text, /process\.env\.CRON_SECRET/);
    assert.match(text, /'x-cron-secret': cronSecret/);
    assert.doesNotMatch(text, /ADMIN_API_KEY/);
    assert.doesNotMatch(text, /SKCS_REFRESH_KEY/);
    assert.doesNotMatch(text, /x-api-key/i);
});

test('external scheduler authenticates all protected mutation calls', () => {
    const text = source('scripts/external-scheduler.js');

    assert.match(text, /process\.env\.CRON_SECRET/);
    assert.match(text, /'x-cron-secret': this\.cronSecret/);
    assert.equal(
        (text.match(/headers: this\.schedulerHeaders\(\)/g) || []).length,
        3
    );
    assert.doesNotMatch(text, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('manual refresh separates admin and scheduler credential boundaries', () => {
    const text = source('scripts/trigger-refresh.js');

    assert.match(text, /process\.env\.ADMIN_API_KEY/);
    assert.match(text, /process\.env\.CRON_SECRET/);
    assert.match(text, /\{ 'x-admin-key': ADMIN_KEY \}/);
    assert.match(text, /\{ 'x-cron-secret': CRON_SECRET \}/);
    assert.match(text, /'x-cron-secret': CRON_SECRET/);
    assert.doesNotMatch(text, /x-api-key/i);
});

test('existing edge function carries scheduler credentials without activation changes', () => {
    const text = source('supabase/edge-functions/scheduled-fixture-sync/index.ts');

    assert.match(text, /Deno\.env\.get\("CRON_SECRET"\)/);
    assert.match(text, /if \(!cronSecret\)/);
    assert.equal(
        (text.match(/"x-cron-secret": cronSecret/g) || []).length,
        2
    );
    assert.doesNotMatch(text, /x-api-key/i);
    assert.doesNotMatch(text, /x-admin-key/i);
});

test('protected route and caller boundaries are aligned', () => {
    const routeSources = [
        source('backend/routes/scheduler.js'),
        source('backend/routes/pipeline.js'),
        source('backend/routes/cricketCron.js'),
        source('backend/server-express.js')
    ].join('\n');

    const packet3aSchedulerRoutes = [
        source('backend/routes/scheduler.js'),
        source('backend/routes/pipeline.js'),
        source('backend/routes/cricketCron.js')
    ].join('\n');

    assert.match(routeSources, /requireSchedulerSecret/);
    assert.doesNotMatch(packet3aSchedulerRoutes, /req\.query\.secret/);
    assert.doesNotMatch(routeSources, /requirePipelineTriggerKey/);
});
