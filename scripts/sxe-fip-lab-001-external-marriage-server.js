'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = Number(process.env.SXE_FIP_LAB_001_PORT || 3110);
const ROOT = path.resolve(__dirname, '..');
const TOOL_DIR = path.join(ROOT, 'local-tools', 'sxe-fip-lab-001');
const RUNNER = path.join(ROOT, 'scripts', 'sxe-fip-lab-001-external-marriage-runner.js');
const DEFAULT_MANIFEST = process.env.SXE_HANDOFF_MANIFEST_PATH || null;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

function parseManifestArg(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--manifest');
  return index === -1 ? DEFAULT_MANIFEST : argv[index + 1];
}

function assertStartupGuards(host = HOST) {
  if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production') {
    throw new Error('SXE-FIP-LAB-001 local server cannot start in production mode.');
  }

  if (host !== HOST) {
    throw new Error('SXE-FIP-LAB-001 local server must bind only to 127.0.0.1.');
  }

  return host;
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendStatic(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'content-type': MIME_TYPES[extension] || 'application/octet-stream',
    'content-length': body.length
  });
  res.end(body);
}

function parseRunnerOutput(stdout) {
  const lines = String(stdout || '').trim().split(/\r?\n/).reverse();
  const jsonLine = lines.find((line) => line.trim().startsWith('{'));
  if (!jsonLine) {
    throw new Error('External marriage runner returned no JSON output.');
  }
  return JSON.parse(jsonLine);
}

function runExternalMarriage(manifestPath) {
  return new Promise((resolve, reject) => {
    if (!manifestPath) {
      resolve({
        ok: true,
        result: 'HOLD',
        decision: 'HOLD',
        code: 'SXE_HANDOFF_MANIFEST_REQUIRED',
        message: 'A verified local handoff manifest is required.'
      });
      return;
    }

    const child = spawn(process.execPath, [RUNNER, '--manifest', manifestPath], {
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', reject);
    child.on('close', (code) => {
      try {
        const payload = parseRunnerOutput(stdout);
        if (code !== 0) {
          const error = new Error(payload.message || 'External marriage runner failed.');
          error.code = payload.code || 'SXE_EXTERNAL_MARRIAGE_RUN_FAILED';
          error.details = { code, stderr, payload };
          reject(error);
          return;
        }
        resolve(payload);
      } catch (error) {
        error.details = { ...(error.details || {}), code, stderr };
        reject(error);
      }
    });
  });
}

function startServer(options = {}) {
  const host = options.host || HOST;
  const port = options.port ?? PORT;
  const manifestPath = options.manifestPath || parseManifestArg();
  assertStartupGuards(host);
  let runInProgress = false;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${HOST}:${port}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'sxe-fip-lab-001-external-marriage-server',
        bind: HOST,
        production_authorized: false,
        public_route_used: false,
        manifest_configured: Boolean(manifestPath),
        run_in_progress: runInProgress
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/run') {
      if (runInProgress) {
        sendJson(res, 409, {
          ok: false,
          code: 'SXE_EXTERNAL_RUN_ALREADY_IN_PROGRESS',
          message: 'An external marriage run is already in progress.'
        });
        return;
      }

      runInProgress = true;
      try {
        sendJson(res, 200, await runExternalMarriage(manifestPath));
      } catch (error) {
        sendJson(res, 500, {
          ok: false,
          code: error.code || 'SXE_EXTERNAL_SERVER_FAILURE',
          message: error.message,
          timeline: error.details?.payload?.timeline || []
        });
      } finally {
        runInProgress = false;
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      sendStatic(res, path.join(TOOL_DIR, 'index.html'));
      return;
    }

    if (req.method === 'GET') {
      const relative = url.pathname.replace(/^\/+/, '');
      const filePath = path.resolve(TOOL_DIR, relative);
      if (
        !relative
        || relative.includes('..')
        || !filePath.startsWith(TOOL_DIR)
        || !fs.existsSync(filePath)
        || fs.statSync(filePath).isDirectory()
      ) {
        sendJson(res, 404, { ok: false, message: 'Not found.' });
        return;
      }
      sendStatic(res, filePath);
      return;
    }

    sendJson(res, 405, { ok: false, message: 'Method not allowed.' });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      resolve({
        server,
        host,
        port: server.address().port,
        baseUrl: `http://${host}:${server.address().port}`,
        manifestPath
      });
    });
  });
}

if (require.main === module) {
  startServer()
    .then(({ baseUrl }) => {
      console.log(`SXE-FIP-LAB-001 external visual laboratory: ${baseUrl}`);
      console.log('LOCAL CONTROLLED TEST — NOT PRODUCTION');
    })
    .catch((error) => {
      console.error(error.message || String(error));
      process.exitCode = 1;
    });
}

module.exports = {
  HOST,
  PORT,
  assertStartupGuards,
  parseRunnerOutput,
  runExternalMarriage,
  startServer
};
