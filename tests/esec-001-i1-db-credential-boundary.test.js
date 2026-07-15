'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(
    path.join(ROOT, relativePath),
    'utf8'
  );
}

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(
    start,
    -1,
    `Missing start marker: ${startMarker}`
  );

  assert.notEqual(
    end,
    -1,
    `Missing end marker: ${endMarker}`
  );

  return source.slice(start, end);
}

const server = read('backend/server-express.js');
const aiPipeline = read('backend/services/aiPipeline.js');
const packageJson = JSON.parse(read('package.json'));

test('DB-001 removes automatic startup database writes', () => {
  assert.doesNotMatch(
    server,
    /FORCE_BOOT_TEST|boot-force-insert/
  );
});

test('public direct-insights client is anon-only', () => {
  const clientBlock = extractBetween(
    server,
    'const DIRECT_INSIGHTS_READ_SUPABASE_URL',
    "app.disable('x-powered-by');"
  );

  const routeBlock = extractBetween(
    server,
    "app.get('/api/direct-insights'",
    '// TIER 2:'
  );

  assert.match(
    clientBlock,
    /process\.env\.SUPABASE_ANON_KEY/
  );

  assert.doesNotMatch(
    clientBlock,
    /SUPABASE_SERVICE_ROLE_KEY|process\.env\.SUPABASE_KEY/
  );

  assert.match(
    clientBlock,
    /directInsightsReadSupabase/
  );

  assert.match(
    routeBlock,
    /directInsightsReadSupabase/
  );

  assert.doesNotMatch(
    routeBlock,
    /directInsightsWriteSupabase|SUPABASE_SERVICE_ROLE_KEY/
  );
});

test('AI pipeline persistence client is service-role-only', () => {
  const clientBlock = extractBetween(
    aiPipeline,
    'const DIRECT_INSIGHTS_WRITE_SUPABASE_URL',
    'function normalizeSport'
  );

  assert.match(
    clientBlock,
    /process\.env\.SUPABASE_SERVICE_ROLE_KEY/
  );

  assert.doesNotMatch(
    clientBlock,
    /SUPABASE_ANON_KEY|process\.env\.SUPABASE_KEY/
  );

  assert.match(
    aiPipeline,
    /saveContextData\(directInsightsWriteSupabase,/
  );

  assert.match(
    aiPipeline,
    /saveDirectInsight\(directInsightsWriteSupabase,/
  );

  assert.doesNotMatch(
    aiPipeline,
    /\bdirectInsightsSupabase\b/
  );
});

test('package exposes the complete ESEC-001-I1 proof command', () => {
  assert.equal(
    packageJson.scripts['test:esec-001-i1'],
    'node --test tests/esec-001-i1-auth-boundary.test.js tests/esec-001-i1-browser-auth-boundary.test.js tests/esec-001-i1-legacy-cron-boundary.test.js tests/esec-001-i1-scheduler-caller-boundary.test.js tests/esec-001-i1-scheduler-route-boundary.test.js tests/esec-001-i1-db-credential-boundary.test.js tests/esec-001-i1-governance.test.js'
  );
});
