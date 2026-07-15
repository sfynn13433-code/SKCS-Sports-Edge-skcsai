'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CRON_ROUTES = [
    "/api/cron/sync-live",
    "/api/cron/tier1-stage1-bootstrap",
    "/api/cron/sync-standard",
    "/api/cron/sync-deep",
    "/api/cron/sync-simple",
    "/api/cron/sync-full",
    "/api/cron/cricket-daily-fixtures",
    "/api/cron/trigger-master-pipeline"
];

function source(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
}

test('all legacy server cron routes use canonical scheduler middleware', () => {
    const text = source('backend/server-express.js');

    for (const route of CRON_ROUTES) {
        const getDeclaration = "app.get('" + route + "', requireSchedulerSecret,";
        const postDeclaration = "app.post('" + route + "', requireSchedulerSecret,";

        assert.ok(
            text.includes(getDeclaration) || text.includes(postDeclaration),
            route
        );
    }
});

test('server cron authentication contains no query-string or local verifier path', () => {
    const text = source('backend/server-express.js');

    assert.doesNotMatch(text, /verifyCronSecret/);
    assert.doesNotMatch(text, /req\.query\.secret/);
    assert.doesNotMatch(text, /headerSecret\s*\|\|\s*querySecret/);
    assert.doesNotMatch(text, /skcs_super_secret_cron_key_2026/);
});

test('cron diagnostic caller is fail-closed and contains no embedded credential', () => {
    const text = source('scripts/test-cron.js');

    assert.match(text, /String\(process\.env\.CRON_SECRET \|\| ''\)\.trim\(\)/);
    assert.match(text, /if \(!CRON_SECRET\)/);
    assert.match(text, /'x-cron-secret': CRON_SECRET/);
    assert.doesNotMatch(text, /skcs_super_secret_cron_key_2026/);
    assert.doesNotMatch(text, /[?&]secret=/);
});

test('cricket deployment caller is already aligned to the canonical header', () => {
    const text = source('backend/deploy-trigger-cricket.js');

    assert.match(text, /String\(process\.env\.CRON_SECRET \|\| ''\)\.trim\(\)/);
    assert.match(text, /'x-cron-secret': cronSecret/);
    assert.doesNotMatch(text, /[?&]secret=/);
    assert.doesNotMatch(text, /x-api-key/i);
});
