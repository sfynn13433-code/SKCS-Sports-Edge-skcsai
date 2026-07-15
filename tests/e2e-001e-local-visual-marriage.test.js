'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const serverModule = require('../scripts/e2e-001e-local-marriage-server');
const {
  HOST,
  PORT,
  REQUIRED_HEAD,
  assertStartupGuards,
  startServer,
  runControlledMarriage,
  parseRunnerOutput,
  validateRunnerPayload
} = serverModule;

const ROOT = path.resolve(__dirname, '..');
const TOOL_DIR = path.join(ROOT, 'local-tools', 'e2e-001e');
const PAGE_HTML = fs.readFileSync(path.join(TOOL_DIR, 'index.html'), 'utf8');

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch (_error) {
    json = null;
  }

  return { response, json, text };
}

test('server binds only to 127.0.0.1', () => {
  assert.equal(HOST, '127.0.0.1');
});

test('production mode startup is rejected', () => {
  const previous = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = 'production';

    assert.throws(
      () => assertStartupGuards('127.0.0.1'),
      /cannot start in production mode/i
    );
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test('page contains the required title, warning and button', () => {
  assert.match(PAGE_HTML, /SKCS SCOUT × EDGE/i);
  assert.match(PAGE_HTML, /Controlled Marriage Laboratory/i);
  assert.match(PAGE_HTML, /LOCAL CONTROLLED TEST — NOT PRODUCTION/i);
  assert.match(PAGE_HTML, /RUN A NEW MARRIAGE TEST/i);
});

test('health endpoint reports production_authorized false', async (t) => {
  const instance = await startServer({ port: 0 });
  t.after(() => new Promise((resolve) => instance.server.close(resolve)));

  const { response, json } = await fetchJson(`${instance.baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.equal(json.production_authorized, false);
  assert.equal(json.marriage_gate_cleared, false);
  assert.match(json.repository_head, /^[0-9a-f]{40}$/);
});

test('run endpoint launches an isolated child process and returns structured success', async (t) => {
  const instance = await startServer({ port: 0 });
  t.after(() => new Promise((resolve) => instance.server.close(resolve)));

  const { response, json } = await fetchJson(`${instance.baseUrl}/api/run`, {
    method: 'POST'
  });

  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.safety.provider_fallback_calls, 0);
  assert.equal(json.safety.network_calls, 0);
  assert.equal(json.safety.production_database_write, false);
  assert.equal(json.safety.supabase_write, false);
  assert.equal(json.safety.unhandled_rejections, 0);
  assert.equal(json.safety.uncaught_exceptions, 0);
  assert.equal(json.safety.process_exit_code, 0);
  assert.equal(json.runtime.inserted_count, 1);
  assert.equal(json.filters.length, 2);
  assert.equal(json.filters[0].is_valid, true);
  assert.equal(json.filters[1].is_valid, true);
  assert.match(json.fip.fip_id, /^E2E-001E-VISUAL-/);
  assert.match(json.prediction.prediction, /home_win|away_win|draw/);
});

test('runner module can be executed directly as an isolated child process', async () => {
  const payload = await runControlledMarriage();

  validateRunnerPayload(payload);
  assert.equal(payload.ok, true);
  assert.equal(payload.filters.length, 2);
});

test('simultaneous duplicate runs are rejected safely', async (t) => {
  const instance = await startServer({ port: 0 });
  t.after(() => new Promise((resolve) => instance.server.close(resolve)));

  const firstRun = fetch(`${instance.baseUrl}/api/run`, { method: 'POST' });
  await new Promise((resolve) => setTimeout(resolve, 75));

  const { response, json } = await fetchJson(`${instance.baseUrl}/api/run`, {
    method: 'POST'
  });

  assert.equal(response.status, 409);
  assert.equal(json.code, 'E2E001E_RUN_ALREADY_IN_PROGRESS');

  const firstResult = await firstRun;
  await firstResult.text();
});

test('runner output parser rejects invalid JSON', () => {
  assert.throws(
    () => parseRunnerOutput(''),
    /no JSON output/i
  );
});

test('repository head guard accepts the approved E2E-001D base head', () => {
  const head = assertStartupGuards('127.0.0.1');
  assert.match(head, /^[0-9a-f]{40}$/);
  assert.equal(head, REQUIRED_HEAD);
});

test('default visual server port is 3099', () => {
  assert.equal(PORT, 3099);
});
