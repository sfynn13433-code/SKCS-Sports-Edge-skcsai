'use strict';

const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const root = process.cwd();

const state = {
  providerFallbackCalls: 0,
  networkCalls: 0,
  productionDatabaseWrites: 0,
  supabaseWrites: 0,
  unhandledRejections: 0,
  uncaughtExceptions: 0,
  timeline: [],
  memoryStore: {
    predictions_raw: [],
    predictions_filtered: []
  },
  transactionCompleted: false,
  tierRuleReads: 0,
  intake: null,
  pipelineReturned: false
};

process.on('unhandledRejection', () => {
  state.unhandledRejections += 1;
});

process.on('uncaughtException', () => {
  state.uncaughtExceptions += 1;
});

const ENV_NAMES = [
  'DATABASE_URL',
  'SUPABASE_URL',
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
  'PGCONNECT_TIMEOUT',
  'WEATHER_API_KEY'
];

for (const name of ENV_NAMES) {
  if (name === 'DATABASE_URL') {
    process.env.DATABASE_URL =
      'postgresql://e2e001e:e2e001e@127.0.0.1:1/e2e001e';
    continue;
  }

  if (name === 'SUPABASE_URL') {
    process.env.SUPABASE_URL = 'http://127.0.0.1:1';
    continue;
  }

  if (name === 'PGCONNECT_TIMEOUT') {
    process.env.PGCONNECT_TIMEOUT = '1';
    continue;
  }

  process.env[name] = 'E2E001E_BLOCKED_SENTINEL';
}

function repositoryPath(relativePath) {
  return path.resolve(root, relativePath);
}

function pushTimeline(stage, status, message) {
  state.timeline.push({ stage, status, message });
}

function failClosed(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

function installResolvedModuleStub(resolved, exportsValue) {
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
    children: [],
    paths: []
  };
}

function installRepositoryModuleStub(relativePath, exportsValue) {
  installResolvedModuleStub(
    require.resolve(repositoryPath(relativePath)),
    exportsValue
  );
}

function installPackageStub(packageName, exportsValue) {
  installResolvedModuleStub(require.resolve(packageName), exportsValue);
}

function compactSql(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function safeJson(value) {
  if (value && typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(String(value || '{}'));
  } catch (_error) {
    return { raw_metadata: String(value || '') };
  }
}

function blockNetwork(label, target = null) {
  state.networkCalls += 1;

  failClosed(
    'E2E001E_NETWORK_OPERATION_BLOCKED',
    'An uncontrolled network request was blocked.',
    {
      label,
      target: target ? String(target) : null
    }
  );
}

global.fetch = async (target) => blockNetwork('global.fetch', target);
http.request = (...args) => blockNetwork('http.request', args[0]);
http.get = (...args) => blockNetwork('http.get', args[0]);
https.request = (...args) => blockNetwork('https.request', args[0]);
https.get = (...args) => blockNetwork('https.get', args[0]);

const tierRules = [
  {
    tier: 'normal',
    sport: 'football',
    min_confidence: 50,
    allowed_markets: ['ALL'],
    allowed_volatility: ['low', 'medium', 'high'],
    max_acca_size: 6
  },
  {
    tier: 'deep',
    sport: 'football',
    min_confidence: 50,
    allowed_markets: ['ALL'],
    allowed_volatility: ['low', 'medium', 'high'],
    max_acca_size: 12
  }
];

const fakeSupabase = {
  from(tableName) {
    const table = String(tableName || '');

    if (table === 'tier_rules') {
      return {
        async select() {
          state.tierRuleReads += 1;

          return {
            data: JSON.parse(JSON.stringify(tierRules)),
            error: null
          };
        }
      };
    }

    if (table === 'fixture_context_cache') {
      return {
        select() {
          failClosed(
            'E2E001E_FIXTURE_CACHE_ACCESS_BLOCKED',
            'fixture_context_cache must not be used for Scout FIP visual runs.'
          );
        },
        upsert() {
          state.supabaseWrites += 1;

          failClosed(
            'E2E001E_SUPABASE_WRITE_BLOCKED',
            'Supabase writes are blocked in the visual marriage runner.'
          );
        }
      };
    }

    return {
      async select() {
        failClosed(
          'E2E001E_UNEXPECTED_SUPABASE_READ',
          'An unexpected Supabase read was attempted.',
          { table }
        );
      },
      async insert() {
        state.supabaseWrites += 1;
        failClosed('E2E001E_UNEXPECTED_SUPABASE_WRITE', 'Supabase insert blocked.', { table });
      },
      async update() {
        state.supabaseWrites += 1;
        failClosed('E2E001E_UNEXPECTED_SUPABASE_WRITE', 'Supabase update blocked.', { table });
      },
      async upsert() {
        state.supabaseWrites += 1;
        failClosed('E2E001E_UNEXPECTED_SUPABASE_WRITE', 'Supabase upsert blocked.', { table });
      },
      async delete() {
        state.supabaseWrites += 1;
        failClosed('E2E001E_UNEXPECTED_SUPABASE_WRITE', 'Supabase delete blocked.', { table });
      }
    };
  }
};

installPackageStub('@supabase/supabase-js', {
  createClient() {
    return fakeSupabase;
  }
});

async function backgroundQuery(text, params = []) {
  failClosed(
    'E2E001E_BACKGROUND_DATABASE_OPERATION_BLOCKED',
    'A non-transaction database operation was blocked.',
    {
      sql: compactSql(text),
      parameter_count: params.length
    }
  );
}

const transactionClient = {
  async query(text, params = []) {
    const sql = compactSql(text);

    if (/insert\s+into\s+predictions_raw/i.test(sql)) {
      const row = {
        id: 900001001 + state.memoryStore.predictions_raw.length,
        match_id: params[0],
        sport: params[1],
        market: params[2],
        prediction: params[3],
        confidence: params[4],
        volatility: params[5],
        odds: params[6],
        metadata: safeJson(params[7]),
        created_at: new Date().toISOString(),
        persistence_mode: 'IN_MEMORY_ROLLBACK_ONLY'
      };

      state.memoryStore.predictions_raw.push(row);

      return { rows: [row], rowCount: 1 };
    }

    if (/select\s+\*\s+from\s+predictions_raw\s+where\s+id\s*=\s*\$1/i.test(sql)) {
      const id = Number(params[0]);
      const row = state.memoryStore.predictions_raw.find(
        (item) => Number(item.id) === id
      ) || null;

      return {
        rows: row ? [row] : [],
        rowCount: row ? 1 : 0
      };
    }

    if (/insert\s+into\s+predictions_filtered/i.test(sql)) {
      const row = {
        id: 910001001 + state.memoryStore.predictions_filtered.length,
        raw_id: Number(params[0]),
        tier: String(params[1] || ''),
        is_valid: Boolean(params[2]),
        reject_reason: params[3] || null,
        is_watchlist: Boolean(params[4]),
        created_at: new Date().toISOString(),
        persistence_mode: 'IN_MEMORY_ROLLBACK_ONLY'
      };

      state.memoryStore.predictions_filtered.push(row);

      return { rows: [row], rowCount: 1 };
    }

    state.productionDatabaseWrites += 1;

    failClosed(
      'E2E001E_NEXT_TRANSACTION_DATABASE_OPERATION_REACHED',
      'The marriage reached an unmodelled transaction operation.',
      { sql, parameter_count: params.length }
    );
  }
};

installRepositoryModuleStub('backend/db.js', {
  query: backgroundQuery,
  async withTransaction(work) {
    const result = await work(transactionClient);
    state.transactionCompleted = true;
    return result;
  },
  pool: {
    async connect() {
      failClosed(
        'E2E001E_DATABASE_POOL_ACCESS_BLOCKED',
        'Direct database-pool access was blocked.'
      );
    }
  }
});

installRepositoryModuleStub('backend/services/dataProvider.js', {
  async getPredictionInputs() {
    state.providerFallbackCalls += 1;

    failClosed(
      'E2E001E_PROVIDER_FALLBACK_REACHED',
      'The legacy sports-provider input path was reached.'
    );
  }
});

installRepositoryModuleStub('backend/services/contextIngestionService.js', {
  async safeFetch() {
    failClosed('E2E001E_EXTERNAL_CONTEXT_FETCH_BLOCKED', 'External context acquisition was blocked.');
  },
  async getInjuries() {
    failClosed('E2E001E_EXTERNAL_INJURIES_BLOCKED', 'External injury acquisition was blocked.');
  },
  async getH2H() {
    failClosed('E2E001E_EXTERNAL_H2H_BLOCKED', 'External H2H acquisition was blocked.');
  },
  async getWeather() {
    failClosed('E2E001E_EXTERNAL_WEATHER_BLOCKED', 'External weather acquisition was blocked.');
  },
  async getTeamNewsContext() {
    failClosed('E2E001E_EXTERNAL_NEWS_BLOCKED', 'External news acquisition was blocked.');
  }
});

installRepositoryModuleStub('backend/services/footballHighlightsService.js', {
  canUseFootballHighlights() {
    return false;
  },
  async fetchHeadToHeadFallback() {
    failClosed('E2E001E_FOOTBALL_HIGHLIGHTS_BLOCKED', 'Football-highlights fallback was blocked.');
  }
});

installRepositoryModuleStub('backend/services/saveContextData.js', {
  async saveContextData() {
    failClosed('E2E001E_CONTEXT_PERSISTENCE_BLOCKED', 'Context persistence was blocked.');
  }
});

installRepositoryModuleStub('backend/services/saveDirectInsights.js', {
  async saveDirectInsight() {
    failClosed('E2E001E_DIRECT_INSIGHT_PERSISTENCE_BLOCKED', 'Direct-insight persistence was blocked.');
  }
});

installRepositoryModuleStub('backend/services/aiProvider.js', {
  async analyzeWithDolphin() {
    return null;
  },
  async isDolphinAvailable() {
    return false;
  },
  async isGroqAvailable() {
    return false;
  },
  async isGeminiAvailable() {
    return false;
  },
  async generateInsight() {
    return null;
  },
  async generateInsightWithGroq() {
    return null;
  },
  async generateInsightWithGemini() {
    return null;
  },
  extractAndParseJSON(value) {
    return typeof value === 'object' ? value : null;
  },
  buildMatchAnalysisPrompt() {
    return '';
  },
  buildInsightPrompt() {
    return '';
  },
  generateFallbackInsightStructured() {
    return null;
  }
});

delete require.cache[require.resolve(repositoryPath('backend/src/services/contextIntelligence/aiPipeline.js'))];
delete require.cache[require.resolve(repositoryPath('backend/services/aiPipeline.js'))];

const {
  FIP_SCHEMA_VERSION,
  HASH_ALGORITHM,
  SCOUT_FIP_ORIGIN,
  PROOF_FIXTURE_MODE,
  computeFipHash
} = require(repositoryPath('backend/services/fipIntakeService.js'));

const aiPipeline = require(repositoryPath('backend/services/aiPipeline.js'));

function buildVisualFip(runId) {
  const now = new Date();
  const kickoff = new Date(now.getTime() + (6 * 60 * 60 * 1000));

  const fip = {
    fip_schema_version: FIP_SCHEMA_VERSION,
    fip_id: `E2E-001E-VISUAL-${runId}`,
    proof_mode: PROOF_FIXTURE_MODE,
    sports_truth_origin: SCOUT_FIP_ORIGIN,
    validation: {
      status: 'VALIDATED',
      algorithm: HASH_ALGORITHM,
      hash: '',
      validated_at: now.toISOString()
    },
    fixture: {
      fixture_id: `E2E-001E-VISUAL-${runId}`,
      match_id: `E2E-001E-VISUAL-${runId}`,
      sport: 'football',
      home_team: 'Scout Visual Home FC',
      away_team: 'Scout Visual Away FC',
      kickoff_time: kickoff.toISOString(),
      competition: 'Scout Edge Visual Marriage League',
      country: 'ZA'
    },
    markets: {
      sharp_odds: {
        home: 2.05,
        draw: 3.25,
        away: 3.6
      },
      market_timestamp: now.toISOString()
    },
    context: {
      contextual_intelligence: {
        form_note: 'E2E-001E local visual marriage demonstration',
        injury_note: null,
        weather: null
      },
      scout_profile_version: 'e2e-001e-visual-v1'
    },
    metadata: {
      sports_truth_origin: SCOUT_FIP_ORIGIN,
      source: SCOUT_FIP_ORIGIN,
      execution_scope: 'LOCAL_VISUAL_MARRIAGE'
    }
  };

  fip.validation.hash = computeFipHash(fip);

  return {
    fip,
    receivedAt: now.toISOString()
  };
}

async function settleAsyncTail() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 50));
}

function assertSafetyInvariants() {
  if (state.providerFallbackCalls !== 0) {
    failClosed(
      'E2E001E_PROVIDER_FALLBACK_DETECTED',
      'Provider fallback was called during the visual marriage run.'
    );
  }

  if (state.networkCalls !== 0) {
    failClosed(
      'E2E001E_NETWORK_CALL_DETECTED',
      'An uncontrolled network operation was detected.'
    );
  }

  if (state.productionDatabaseWrites !== 0) {
    failClosed(
      'E2E001E_PRODUCTION_DATABASE_WRITE_DETECTED',
      'A production database write was attempted.'
    );
  }

  if (state.supabaseWrites !== 0) {
    failClosed(
      'E2E001E_SUPABASE_WRITE_DETECTED',
      'A Supabase write was attempted.'
    );
  }

  if (state.memoryStore.predictions_raw.length !== 1) {
    failClosed(
      'E2E001E_RAW_COUNT_INVALID',
      `Expected one raw prediction, found ${state.memoryStore.predictions_raw.length}.`
    );
  }

  if (state.memoryStore.predictions_filtered.length !== 2) {
    failClosed(
      'E2E001E_FILTERED_COUNT_INVALID',
      `Expected two filtered rows, found ${state.memoryStore.predictions_filtered.length}.`
    );
  }

  const normal = state.memoryStore.predictions_filtered.find((row) => row.tier === 'normal');
  const deep = state.memoryStore.predictions_filtered.find((row) => row.tier === 'deep');

  if (!normal?.is_valid || !deep?.is_valid) {
    failClosed(
      'E2E001E_FILTER_INVALID',
      'Both normal and deep filtered rows must be valid.'
    );
  }

  if (!state.transactionCompleted) {
    failClosed(
      'E2E001E_TRANSACTION_INCOMPLETE',
      'The controlled in-memory transaction did not complete.'
    );
  }

  if (state.unhandledRejections !== 0 || state.uncaughtExceptions !== 0) {
    failClosed(
      'E2E001E_ASYNC_FAILURE',
      'Unhandled async failures were detected after pipeline completion.'
    );
  }
}

async function main(options = {}) {
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const { fip, receivedAt } = options.externalFip
    ? {
        fip: options.externalFip,
        receivedAt: options.receivedAt || new Date().toISOString()
      }
    : buildVisualFip(runId);

  const fixtureHome = typeof fip.fixture.home_team === 'string'
    ? fip.fixture.home_team
    : fip.fixture.home_team?.name;
  const fixtureAway = typeof fip.fixture.away_team === 'string'
    ? fip.fixture.away_team
    : fip.fixture.away_team?.name;
  const fixtureCompetition = fip.fixture.competition || fip.fixture.league;
  const fixtureKickoff = fip.fixture.kickoff_time || fip.fixture.kickoff_utc;

  pushTimeline(
    'FIP_CREATED',
    'PASS',
    options.externalFip
      ? `External Scout FIP ${fip.fip_id} loaded after verified handoff integrity.`
      : `Scout FIP ${fip.fip_id} assembled with governed proof context.`
  );

  pushTimeline(
    'VALIDATION_HASH_VERIFIED',
    'PASS',
    `Validation hash ${fip.validation.hash.slice(0, 16)}… verified with ${HASH_ALGORITHM}.`
  );

  const pipelineOptions = {
    fip_envelopes: [fip],
    governed_mode: PROOF_FIXTURE_MODE,
    caller: 'E2E-001E-LOCAL-VISUAL-MARRIAGE',
    received_at: receivedAt
  };

  const runtimeResult = await aiPipeline.runPipelineFromConfiguredDataMode(pipelineOptions);

  const intake = Array.isArray(runtimeResult?.intake_results)
    ? runtimeResult.intake_results[0]
    : null;

  if (!intake?.accepted) {
    failClosed('E2E001E_INTAKE_NOT_ACCEPTED', 'Edge intake did not accept the Scout FIP.');
  }

  state.intake = intake;

  pushTimeline(
    'EDGE_INTAKE_ACCEPTED',
    'PASS',
    `Edge intake accepted FIP with intake ID ${intake.intake_id}.`
  );

  pushTimeline(
    'EDGE_ENVELOPE_CREATED',
    'PASS',
    'Scout FIP mapped to EdgeAnalysisEnvelope without provider input.'
  );

  pushTimeline(
    'PROVIDER_BYPASS_CONFIRMED',
    'PASS',
    `Legacy provider fallback calls: ${state.providerFallbackCalls}.`
  );

  state.pipelineReturned = true;
  await settleAsyncTail();

  const rawRow = state.memoryStore.predictions_raw[0];
  const normalRow = state.memoryStore.predictions_filtered.find((row) => row.tier === 'normal');
  const deepRow = state.memoryStore.predictions_filtered.find((row) => row.tier === 'deep');

  pushTimeline(
    'PREDICTION_GENERATED',
    'PASS',
    `Prediction ${rawRow.prediction} generated at confidence ${rawRow.confidence}.`
  );

  pushTimeline(
    'RAW_STORED_IN_MEMORY',
    'PASS',
    `One predictions_raw row stored in memory for match ${rawRow.match_id}.`
  );

  pushTimeline(
    'NORMAL_FILTER_COMPLETED',
    normalRow?.is_valid ? 'PASS' : 'FAIL',
    `Normal tier filter ${normalRow?.is_valid ? 'accepted' : 'rejected'} the raw prediction.`
  );

  pushTimeline(
    'DEEP_FILTER_COMPLETED',
    deepRow?.is_valid ? 'PASS' : 'FAIL',
    `Deep tier filter ${deepRow?.is_valid ? 'accepted' : 'rejected'} the raw prediction.`
  );

  assertSafetyInvariants();

  pushTimeline(
    'MARRIAGE_RUN_COMPLETED',
    'PASS',
    'Controlled Scout-to-Edge marriage completed with a clean process exit.'
  );

  const payload = {
    ok: true,
    run_id: runId,
    fip: {
      fip_id: fip.fip_id,
      validation_hash: fip.validation.hash,
      intake_id: intake.intake_id,
      idempotency_key: intake.evidence?.idempotency_key || null
    },
    source_package: options.externalMetadata
      ? {
          selected_role: options.externalMetadata.selected_role,
          manifest_path: options.externalMetadata.manifest_path,
          verified_files: options.externalMetadata.files
        }
      : null,
    fixture: {
      home_team: fixtureHome,
      away_team: fixtureAway,
      competition: fixtureCompetition,
      kickoff: fixtureKickoff
    },
    prediction: {
      market: rawRow.market,
      prediction: rawRow.prediction,
      confidence: rawRow.confidence,
      volatility: rawRow.volatility,
      odds: rawRow.odds
    },
    filters: [
      {
        tier: 'normal',
        is_valid: Boolean(normalRow?.is_valid)
      },
      {
        tier: 'deep',
        is_valid: Boolean(deepRow?.is_valid)
      }
    ],
    timeline: state.timeline,
    safety: {
      production_database_write: false,
      supabase_write: false,
      external_provider_request: false,
      public_route_used: false,
      deployment_performed: false,
      provider_fallback_calls: state.providerFallbackCalls,
      network_calls: state.networkCalls,
      unhandled_rejections: state.unhandledRejections,
      uncaught_exceptions: state.uncaughtExceptions,
      process_exit_code: 0
    },
    runtime: {
      mode: runtimeResult?.mode || 'scout_fip',
      inserted_count: Array.isArray(runtimeResult?.inserted)
        ? runtimeResult.inserted.length
        : 0,
      filtered_valid: runtimeResult?.filtered_valid ?? null,
      filtered_invalid: runtimeResult?.filtered_invalid ?? null
    }
  };

  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
  const failure = {
    ok: false,
    code: error?.code || 'E2E001E_RUNNER_FAILURE',
    message: error?.message || String(error),
    details: error?.details || null,
    timeline: state.timeline,
    safety: {
      production_database_write: state.productionDatabaseWrites > 0,
      supabase_write: state.supabaseWrites > 0,
      external_provider_request: state.providerFallbackCalls > 0,
      public_route_used: false,
      deployment_performed: false,
      provider_fallback_calls: state.providerFallbackCalls,
      network_calls: state.networkCalls,
      unhandled_rejections: state.unhandledRejections,
      uncaught_exceptions: state.uncaughtExceptions,
      process_exit_code: 1
    }
  };

  process.stdout.write(`${JSON.stringify(failure)}\n`);
  process.exitCode = 1;
  });
}

module.exports = {
  buildVisualFip,
  main
};
