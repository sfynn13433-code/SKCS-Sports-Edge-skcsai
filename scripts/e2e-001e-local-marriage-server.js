'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execSync } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = Number(process.env.E2E_001E_PORT || 3099);
const REQUIRED_HEAD = 'bd36c6e1ce2a60a355d7cad66cf049106892c8f0';
const RUN_TIMEOUT_MS = Number(process.env.E2E_001E_RUN_TIMEOUT_MS || 120000);
const ROOT = path.resolve(__dirname, '..');
const TOOL_DIR = path.join(ROOT, 'local-tools', 'e2e-001e');
const RUNNER_PATH = path.join(ROOT, 'scripts', 'e2e-001e-local-marriage-runner.js');

const ALLOWED_IMPLEMENTATION_PATHS = new Set([
  'scripts/e2e-001e-local-marriage-server.js',
  'scripts/e2e-001e-local-marriage-runner.js',
  'scripts/sxe-fip-lab-001-external-fip-loader.js',
  'scripts/sxe-fip-lab-001-external-marriage-runner.js',
  'scripts/sxe-fip-lab-001-external-marriage-server.js',
  'local-tools/e2e-001e/index.html',
  'local-tools/e2e-001e/app.js',
  'local-tools/e2e-001e/styles.css',
  'local-tools/sxe-fip-lab-001/index.html',
  'local-tools/sxe-fip-lab-001/app.js',
  'local-tools/sxe-fip-lab-001/styles.css',
  'tests/e2e-001e-local-visual-marriage.test.js',
  'tests/sxe-fip-lab-001-external-fip-loader.test.js',
  'tests/sxe-fip-lab-001-external-marriage.test.js',
  'tests/sxe-fip-lab-001-visual.test.js',
  'control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json',
  'control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json',
  'control-center/EDGE_PROJECT_BACKLOG.md',
  'control-center/EDGE_PROJECT_DEPENDENCY_MAP.md',
  'package.json'
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

let runInProgress = false;

function git(command) {
  return execSync(command, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function readRepositoryHead() {
  return git('git rev-parse HEAD');
}

function assertStartupGuards(requestedHost = HOST) {
  if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production') {
    throw new Error('E2E-001E local marriage server cannot start in production mode.');
  }

  if (requestedHost !== '127.0.0.1') {
    throw new Error('E2E-001E local marriage server must bind only to 127.0.0.1.');
  }

  const head = readRepositoryHead();

  if (head === REQUIRED_HEAD) {
    assertWorktreeScope();
    return head;
  }

  const changedSince = git(`git diff --name-only ${REQUIRED_HEAD}..HEAD`)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (
    changedSince.length > 0
    && changedSince.every((entry) => ALLOWED_IMPLEMENTATION_PATHS.has(entry))
  ) {
    assertWorktreeScope();
    return head;
  }

  throw new Error(
    `Repository HEAD ${head} is not approved for the E2E-001E local marriage server.`
  );
}

function normalizeStatusPath(line) {
  return String(line || '')
    .replace(/^(?:\?\?|[ MADRCU?!]{1,2})\s+/, '')
    .trim();
}

function isAllowedWorktreeEntry(entry) {
  if (!entry || entry === 'evidence/' || entry === 'evidence-home1-scratch/') {
    return true;
  }

  if (ALLOWED_IMPLEMENTATION_PATHS.has(entry)) {
    return true;
  }

  if (
    entry === 'local-tools/'
    || entry.startsWith('local-tools/e2e-001e/')
    || entry.startsWith('local-tools/sxe-fip-lab-001/')
  ) {
    return true;
  }

  return false;
}

function assertWorktreeScope() {
  const statusLines = git('git status --short')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const unexpected = statusLines.filter((line) => {
    const entry = normalizeStatusPath(line);
    return !isAllowedWorktreeEntry(entry);
  });

  if (unexpected.length > 0) {
    throw new Error(
      `Worktree contains changes outside the approved E2E-001E scope: ${unexpected.join(', ')}`
    );
  }
}

function sendJson(res, statusCode, payload) {
  const body = `${JSON.stringify(payload)}\n`;
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;

      if (total > 1024) {
        reject(new Error('Request body is not accepted.'));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', reject);
  });
}

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);

  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': 'no-store'
  });
  res.end(content);
}

function buildChildEnvironment() {
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://e2e001e:e2e001e@127.0.0.1:1/e2e001e',
    SUPABASE_URL: 'http://127.0.0.1:1',
    PGCONNECT_TIMEOUT: '1'
  };

  const blockedNames = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_KEY',
    'SUPABASE_ANON_KEY',
    'RAPIDAPI_KEY',
    'X_APISPORTS_KEY',
    'ODDS_API_KEY',
    'SPORTS_ODDS_API_KEY',
    'THESPORTSDB_KEY',
    'SPORTS_DB_KEY',
    'SPORTSDATA_IO_KEY',
    'X_AUTH_TOKEN',
    'CRICKETDATA_API_KEY',
    'BIG_BALLS_DATA_API_KEY',
    'BBS_API_KEY',
    'SPORTSRC_API_KEY',
    'SOCCER_DATA_API_KEY',
    'SOCCERDATA_API_TOKEN',
    'NEWSAPI_KEY',
    'WEATHER_API_KEY'
  ];

  for (const name of blockedNames) {
    env[name] = 'E2E001E_BLOCKED_SENTINEL';
  }

  return env;
}

function parseRunnerOutput(stdout) {
  const lines = String(stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('Runner produced no JSON output.');
  }

  const payload = JSON.parse(lines[lines.length - 1]);

  if (!payload || typeof payload !== 'object') {
    throw new Error('Runner output was not a JSON object.');
  }

  return payload;
}

function validateRunnerPayload(payload) {
  if (payload.ok !== true) {
    const error = new Error(payload.message || 'Controlled marriage run failed.');
    error.code = payload.code || 'E2E001E_RUN_FAILED';
    error.details = payload;
    throw error;
  }

  if (payload.safety?.provider_fallback_calls !== 0) {
    throw new Error('Provider fallback was called during the visual marriage run.');
  }

  if (payload.safety?.network_calls !== 0) {
    throw new Error('An uncontrolled network operation occurred.');
  }

  if (payload.safety?.production_database_write !== false) {
    throw new Error('A production database write was attempted.');
  }

  if (payload.safety?.supabase_write !== false) {
    throw new Error('A Supabase write was attempted.');
  }

  if (payload.safety?.unhandled_rejections !== 0 || payload.safety?.uncaught_exceptions !== 0) {
    throw new Error('Unhandled async failures occurred during the visual marriage run.');
  }

  if (payload.runtime?.inserted_count !== 1) {
    throw new Error('Expected exactly one raw prediction row.');
  }

  if (!Array.isArray(payload.filters) || payload.filters.length !== 2) {
    throw new Error('Expected exactly two filtered rows.');
  }

  if (!payload.filters.every((row) => row.is_valid === true)) {
    throw new Error('Both filtered tiers must be valid.');
  }
}

function runControlledMarriage() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [RUNNER_PATH], {
      cwd: ROOT,
      env: buildChildEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill('SIGTERM');
      reject(new Error('Controlled marriage run timed out.'));
    }, RUN_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      try {
        const payload = parseRunnerOutput(stdout);

        if (code !== 0 && payload.ok !== true) {
          const error = new Error(payload.message || 'Runner exited with a failure.');
          error.code = payload.code || 'E2E001E_CHILD_EXIT_FAILURE';
          error.details = { exitCode: code, stderr, payload };
          reject(error);
          return;
        }

        if (code !== 0) {
          reject(new Error(`Runner exited with code ${code}.`));
          return;
        }

        validateRunnerPayload(payload);
        resolve(payload);
      } catch (error) {
        error.details = {
          ...(error.details || {}),
          exitCode: code,
          stderr
        };
        reject(error);
      }
    });
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'e2e-001e-local-marriage-server',
      bind: `${HOST}:${PORT}`,
      repository_head: readRepositoryHead(),
      production_authorized: false,
      marriage_gate_cleared: false,
      run_in_progress: runInProgress
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/run') {
    const body = await readBody(req).catch(() => '');

    if (body.trim().length > 0) {
      sendJson(res, 400, {
        ok: false,
        code: 'E2E001E_REQUEST_BODY_REJECTED',
        message: 'This endpoint does not accept a request body.'
      });
      return;
    }

    if (runInProgress) {
      sendJson(res, 409, {
        ok: false,
        code: 'E2E001E_RUN_ALREADY_IN_PROGRESS',
        message: 'A controlled marriage run is already in progress.'
      });
      return;
    }

    runInProgress = true;

    try {
      const payload = await runControlledMarriage();
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        code: error.code || 'E2E001E_RUN_FAILED',
        message: error.message || 'Controlled marriage run failed.',
        timeline: error.details?.payload?.timeline || error.details?.timeline || []
      });
    } finally {
      runInProgress = false;
    }

    return;
  }

  if (req.method === 'GET' && pathname === '/') {
    serveStaticFile(res, path.join(TOOL_DIR, 'index.html'));
    return;
  }

  if (req.method === 'GET') {
    const relative = pathname.replace(/^\/+/, '');

    if (!relative || relative.includes('..')) {
      sendJson(res, 404, { ok: false, message: 'Not found.' });
      return;
    }

    const filePath = path.join(TOOL_DIR, relative);

    if (!filePath.startsWith(TOOL_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      sendJson(res, 404, { ok: false, message: 'Not found.' });
      return;
    }

    serveStaticFile(res, filePath);
    return;
  }

  sendJson(res, 405, { ok: false, message: 'Method not allowed.' });
}

function startServer(options = {}) {
  const host = options.host || HOST;
  const port = options.port || PORT;
  const repositoryHead = assertStartupGuards(host);

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      sendJson(res, 500, {
        ok: false,
        code: 'E2E001E_SERVER_FAILURE',
        message: error.message || 'Server failure.'
      });
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);

    server.listen(port, host, () => {
      resolve({
        server,
        host,
        port,
        repositoryHead,
        baseUrl: `http://${host}:${port}`
      });
    });
  });
}

if (require.main === module) {
  startServer()
    .then(({ baseUrl, repositoryHead }) => {
      console.log('');
      console.log('=== E2E-001E LOCAL VISUAL MARRIAGE SERVER ===');
      console.log(`URL: ${baseUrl}`);
      console.log(`HEAD: ${repositoryHead}`);
      console.log('LOCAL CONTROLLED TEST — NOT PRODUCTION');
      console.log('');
      console.log('Press Ctrl+C to stop.');
    })
    .catch((error) => {
      console.error('');
      console.error('=== E2E-001E SERVER STARTUP FAILED ===');
      console.error(error.message || String(error));
      process.exitCode = 1;
    });
}

module.exports = {
  HOST,
  PORT,
  REQUIRED_HEAD,
  ALLOWED_IMPLEMENTATION_PATHS,
  assertStartupGuards,
  startServer,
  runControlledMarriage,
  buildChildEnvironment,
  parseRunnerOutput,
  validateRunnerPayload
};
