'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Pool } = require('pg');

const TIMEOUT_MS = 12000;

function toErrorMessage(error) {
  if (!error) return 'unknown error';
  if (error.response) {
    const status = error.response.status;
    const payload = typeof error.response.data === 'string'
      ? error.response.data.slice(0, 180)
      : JSON.stringify(error.response.data || {}).slice(0, 180);
    return `http_${status} ${payload}`;
  }
  return String(error.message || error);
}

function parseGeminiError(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.slice(0, 240);
  if (data.error?.message) return String(data.error.message).slice(0, 240);
  if (data.message) return String(data.message).slice(0, 240);
  return JSON.stringify(data).slice(0, 240);
}

function isSet(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

function resolveEnvValue(preferredName, fallbackName) {
  if (isSet(preferredName)) {
    return { keyName: preferredName, keyValue: String(process.env[preferredName]).trim() };
  }
  if (fallbackName && isSet(fallbackName)) {
    return { keyName: fallbackName, keyValue: String(process.env[fallbackName]).trim() };
  }
  return null;
}

async function testSupabase() {
  const name = 'SUPABASE_URL + SUPABASE_ANON_KEY';
  if (!isSet('SUPABASE_URL') || !isSet('SUPABASE_ANON_KEY')) {
    return { name, status: 'missing', detail: 'SUPABASE_URL or SUPABASE_ANON_KEY is not set' };
  }

  const baseUrl = String(process.env.SUPABASE_URL).replace(/\/+$/, '');
  const authUrl = `${baseUrl}/auth/v1/settings`;
  const restUrl = `${baseUrl}/rest/v1/`;
  try {
    const authResponse = await axios.get(authUrl, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY
      },
      timeout: TIMEOUT_MS,
      validateStatus: () => true
    });

    if (!(authResponse.status >= 200 && authResponse.status < 300)) {
      if (authResponse.status === 401 || authResponse.status === 403) {
        return { name, status: 'invalid', detail: `auth settings status ${authResponse.status}` };
      }
      return { name, status: 'warning', detail: `auth settings status ${authResponse.status}` };
    }

    const restResponse = await axios.get(restUrl, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`
      },
      timeout: TIMEOUT_MS,
      validateStatus: () => true
    });

    if (restResponse.status >= 200 && restResponse.status < 300) {
      return { name, status: 'ok', detail: `auth settings ${authResponse.status}, rest ${restResponse.status}` };
    }
    if (restResponse.status === 401 || restResponse.status === 403) {
      const hint = String(restResponse.data?.hint || restResponse.data?.message || '').toLowerCase();
      if (hint.includes('service_role')) {
        return {
          name,
          status: 'ok_limited',
          detail: `auth settings ${authResponse.status}; anon key works but rest root requires service_role`
        };
      }
      return { name, status: 'invalid', detail: `rest status ${restResponse.status} (unauthorized)` };
    }
    return { name, status: 'warning', detail: `auth settings ${authResponse.status}, rest ${restResponse.status}` };
  } catch (error) {
    return { name, status: 'error', detail: toErrorMessage(error) };
  }
}

async function testDatabaseUrl() {
  const name = 'DATABASE_URL';
  if (!isSet('DATABASE_URL')) {
    return { name, status: 'missing', detail: 'DATABASE_URL is not set' };
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8000
  });

  try {
    const result = await pool.query('select 1 as ok');
    return { name, status: 'ok', detail: `query succeeded (${result.rows?.[0]?.ok})` };
  } catch (error) {
    return { name, status: 'invalid', detail: toErrorMessage(error) };
  } finally {
    await pool.end().catch(() => {});
  }
}

async function testApiSportsKey() {
  const name = 'X_APISPORTS_KEY';
  if (!isSet('X_APISPORTS_KEY')) {
    return { name, status: 'missing', detail: 'X_APISPORTS_KEY is not set' };
  }

  try {
    const response = await axios.get('https://v3.football.api-sports.io/status', {
      headers: { 'x-apisports-key': process.env.X_APISPORTS_KEY },
      timeout: TIMEOUT_MS,
      validateStatus: () => true
    });

    if (response.status >= 200 && response.status < 300) {
      return { name, status: 'ok', detail: `status ${response.status}` };
    }
    if (response.status === 401 || response.status === 403) {
      return { name, status: 'invalid', detail: `status ${response.status}` };
    }
    return { name, status: 'warning', detail: `status ${response.status}` };
  } catch (error) {
    return { name, status: 'error', detail: toErrorMessage(error) };
  }
}

async function testOddsApiKey() {
  const name = 'ODDS_API_KEY';
  if (!isSet('ODDS_API_KEY')) {
    return { name, status: 'missing', detail: 'ODDS_API_KEY is not set' };
  }

  try {
    const response = await axios.get('https://api.the-odds-api.com/v4/sports', {
      params: { apiKey: process.env.ODDS_API_KEY },
      timeout: TIMEOUT_MS,
      validateStatus: () => true
    });

    if (response.status >= 200 && response.status < 300) {
      return { name, status: 'ok', detail: `status ${response.status}` };
    }
    if (response.status === 401 || response.status === 403) {
      return { name, status: 'invalid', detail: `status ${response.status}` };
    }
    return { name, status: 'warning', detail: `status ${response.status}` };
  } catch (error) {
    return { name, status: 'error', detail: toErrorMessage(error) };
  }
}

async function testCricketDataKey() {
  const name = 'CRICKETDATA_API_KEY';
  if (!isSet('CRICKETDATA_API_KEY')) {
    return { name, status: 'missing', detail: 'CRICKETDATA_API_KEY is not set' };
  }

  try {
    const response = await axios.get('https://api.cricapi.com/v1/currentMatches', {
      params: { apikey: process.env.CRICKETDATA_API_KEY, offset: 0 },
      timeout: 30000,
      validateStatus: () => true
    });

    if (response.status >= 200 && response.status < 300) {
      return { name, status: 'ok', detail: `status ${response.status}` };
    }
    if (response.status === 401 || response.status === 403) {
      return { name, status: 'invalid', detail: `status ${response.status}` };
    }
    return { name, status: 'warning', detail: `status ${response.status}` };
  } catch (error) {
    return { name, status: 'error', detail: toErrorMessage(error) };
  }
}

async function testFootballDataToken() {
  const name = 'X_AUTH_TOKEN';
  if (!isSet('X_AUTH_TOKEN')) {
    return { name, status: 'missing', detail: 'X_AUTH_TOKEN is not set' };
  }

  try {
    const response = await axios.get('https://api.football-data.org/v4/competitions/PL/matches', {
      headers: { 'X-Auth-Token': process.env.X_AUTH_TOKEN },
      timeout: TIMEOUT_MS,
      validateStatus: () => true
    });

    if (response.status >= 200 && response.status < 300) {
      return { name, status: 'ok', detail: `status ${response.status}` };
    }
    if (response.status === 401 || response.status === 403) {
      return { name, status: 'invalid', detail: `status ${response.status}` };
    }
    return { name, status: 'warning', detail: `status ${response.status}` };
  } catch (error) {
    return { name, status: 'error', detail: toErrorMessage(error) };
  }
}

async function testTheSportsDbKey() {
  const name = 'THESPORTSDB_KEY';
  const resolved = resolveEnvValue('THESPORTSDB_KEY', 'SPORTS_DB_KEY');
  if (!resolved) {
    return {
      name,
      status: 'missing',
      detail: 'THESPORTSDB_KEY is not set (legacy fallback SPORTS_DB_KEY also missing)'
    };
  }

  try {
    const response = await axios.get(`https://www.thesportsdb.com/api/v1/json/${resolved.keyValue}/all_sports.php`, {
      timeout: TIMEOUT_MS,
      validateStatus: () => true
    });

    if (response.status >= 200 && response.status < 300) {
      const totalSports = Array.isArray(response.data?.sports) ? response.data.sports.length : 0;
      if (totalSports > 0) {
        return { name, status: 'ok', detail: `status ${response.status}; source=${resolved.keyName}; sports=${totalSports}` };
      }
      return { name, status: 'warning', detail: `status ${response.status}; source=${resolved.keyName}; unexpected payload` };
    }
    if (response.status === 401 || response.status === 403) {
      return { name, status: 'invalid', detail: `status ${response.status}; source=${resolved.keyName}` };
    }
    return { name, status: 'warning', detail: `status ${response.status}; source=${resolved.keyName}` };
  } catch (error) {
    return { name, status: 'error', detail: toErrorMessage(error) };
  }
}

async function testSportsDataIoKey() {
  const name = 'SPORTSDATA_IO_KEY';
  const resolved = resolveEnvValue('SPORTSDATA_IO_KEY', 'SPORTS_DB_KEY');
  if (!resolved) {
    return {
      name,
      status: 'missing',
      detail: 'SPORTSDATA_IO_KEY is not set (legacy fallback SPORTS_DB_KEY also missing)'
    };
  }

  try {
    const response = await axios.get('https://api.sportsdata.io/v3/soccer/scores/json/AreAnyGamesInProgress', {
      headers: { 'Ocp-Apim-Subscription-Key': resolved.keyValue },
      timeout: TIMEOUT_MS,
      validateStatus: () => true
    });

    if (response.status >= 200 && response.status < 300) {
      return { name, status: 'ok', detail: `status ${response.status}; source=${resolved.keyName}` };
    }
    if (response.status === 401 || response.status === 403) {
      return { name, status: 'invalid', detail: `status ${response.status}; source=${resolved.keyName}` };
    }
    if (response.status === 404) {
      return { name, status: 'warning', detail: `status 404; source=${resolved.keyName}; endpoint/resource unavailable` };
    }
    return { name, status: 'warning', detail: `status ${response.status}; source=${resolved.keyName}` };
  } catch (error) {
    return { name, status: 'error', detail: toErrorMessage(error) };
  }
}

async function testWeatherKey() {
  const name = 'WEATHER_API_KEY';
  if (!isSet('WEATHER_API_KEY')) {
    return { name, status: 'missing', detail: 'WEATHER_API_KEY is not set' };
  }

  try {
    const response = await axios.get('https://api.weatherapi.com/v1/current.json', {
      params: {
        key: process.env.WEATHER_API_KEY,
        q: 'London'
      },
      timeout: TIMEOUT_MS,
      validateStatus: () => true
    });

    if (response.status >= 200 && response.status < 300) {
      return { name, status: 'ok', detail: `status ${response.status}` };
    }
    if (response.status === 401 || response.status === 403) {
      return { name, status: 'invalid', detail: `status ${response.status}` };
    }
    return { name, status: 'warning', detail: `status ${response.status}` };
  } catch (error) {
    return { name, status: 'error', detail: toErrorMessage(error) };
  }
}

async function testGeminiKeyAndModels() {
  const name = 'GEMINI_API_KEY';
  if (!isSet('GEMINI_API_KEY')) {
    return { name, status: 'missing', detail: 'GEMINI_API_KEY is not set' };
  }

  const models = String(process.env.GEMINI_MODEL_CANDIDATES || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);

  const candidates = models.length
    ? models
    : [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

  const failed = [];
  for (const model of candidates) {
    try {
      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        {
          model,
          messages: [{ role: 'user', content: 'Reply with OK only.' }],
          max_tokens: 8,
          temperature: 0
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: TIMEOUT_MS,
          validateStatus: () => true
        }
      );

      if (response.status >= 200 && response.status < 300) {
        return {
          name,
          status: 'ok',
          detail: `working model: ${model}`,
          workingModel: model,
          failedModels: failed
        };
      }

      failed.push({
        model,
        status: response.status,
        error: parseGeminiError(response.data)
      });
    } catch (error) {
      failed.push({
        model,
        status: 'error',
        error: toErrorMessage(error)
      });
    }
  }

  return {
    name,
    status: 'invalid',
    detail: 'no tested Gemini model succeeded',
    workingModel: null,
    failedModels: failed
  };
}

async function probeRapidApiHost(host) {
  const key = String(process.env.X_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY || '').trim();
  try {
    const response = await axios.get(`https://${host}/`, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': host
      },
      timeout: 9000,
      validateStatus: () => true
    });

    const status = response.status;
    if (status >= 200 && status < 300) {
      return { status: 'ok', detail: `status ${status}` };
    }
    if (status === 401 || status === 403) {
      return { status: 'invalid', detail: `status ${status}` };
    }
    if (status === 429) {
      return { status: 'rate_limited', detail: `status ${status}` };
    }
    if (status === 404 || status === 405 || status === 400) {
      return { status: 'reachable', detail: `status ${status} (host reachable, endpoint unknown)` };
    }
    return { status: 'warning', detail: `status ${status}` };
  } catch (error) {
    return { status: 'error', detail: toErrorMessage(error) };
  }
}

async function testRapidApiHosts() {
  const name = 'RapidAPI host sweep';
  const rapidKey = String(process.env.X_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY || '').trim();
  if (!rapidKey) {
    return { name, status: 'missing', detail: 'X_RAPIDAPI_KEY/RAPIDAPI_KEY is not set', hostResults: [] };
  }

  const hostEnvNames = Object.keys(process.env)
    .filter((key) => key.startsWith('RAPIDAPI_HOST'))
    .sort();

  const hostEntries = hostEnvNames
    .map((envName) => ({ envName, host: String(process.env[envName] || '').trim() }))
    .filter((entry) => entry.host.length > 0);

  const hostResults = [];
  for (const entry of hostEntries) {
    const probe = await probeRapidApiHost(entry.host);
    hostResults.push({
      env: entry.envName,
      host: entry.host,
      status: probe.status,
      detail: probe.detail
    });
  }

  const counts = hostResults.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const majorFailures = (counts.invalid || 0) + (counts.error || 0);
  const status = majorFailures > 0 ? 'warning' : 'ok';

  return {
    name,
    status,
    detail: `hosts=${hostResults.length} ok=${counts.ok || 0} reachable=${counts.reachable || 0} invalid=${counts.invalid || 0} error=${counts.error || 0} rate_limited=${counts.rate_limited || 0}`,
    hostResults
  };
}

function configOnlyChecks() {
  const checks = [
    'ADMIN_API_KEY',
    'CRON_SECRET',
    'SPORTS_ODDS_API_KEY'
  ];
  return checks.map((name) => ({
    name,
    status: isSet(name) ? 'set_unverified' : 'missing',
    detail: isSet(name)
      ? 'set (no direct third-party endpoint in repo to validate this key by itself)'
      : `${name} is not set`
  }));
}

async function run() {
  const startedAt = new Date().toISOString();
  const results = [];

  results.push(await testSupabase());
  results.push(await testDatabaseUrl());
  results.push(await testApiSportsKey());
  results.push(await testOddsApiKey());
  results.push(await testCricketDataKey());
  results.push(await testFootballDataToken());
  results.push(await testTheSportsDbKey());
  results.push(await testSportsDataIoKey());
  results.push(await testWeatherKey());
  results.push(await testGeminiKeyAndModels());
  results.push(await testRapidApiHosts());
  results.push(...configOnlyChecks());

  const completedAt = new Date().toISOString();
  const report = {
    startedAt,
    completedAt,
    results
  };

  const outputDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `key-validation-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Report written: ${outputPath}`);
  for (const item of results) {
    console.log(`${item.name}: ${item.status} (${item.detail})`);
  }
}

run().catch((error) => {
  console.error('Key validation failed:', toErrorMessage(error));
  process.exitCode = 1;
});
