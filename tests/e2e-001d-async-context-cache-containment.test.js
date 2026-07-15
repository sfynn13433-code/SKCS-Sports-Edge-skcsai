'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');

function repositoryPath(relativePath) {
  return path.resolve(root, relativePath);
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

function clearRepositoryModule(relativePath) {
  delete require.cache[require.resolve(repositoryPath(relativePath))];
}

const contextCacheWrapper = require('../backend/src/services/contextIntelligence/aiPipeline');
const {
  SCOUT_FIP_ORIGIN,
  isAuthoritativeScoutFipContext,
  hasSuppliedContextualIntelligence
} = contextCacheWrapper.__test;

test('authoritative Scout FIP context is detected from envelope metadata', () => {
  const fixture = {
    match_info: {
      match_id: 'SCOUT-1',
      sports_truth_origin: SCOUT_FIP_ORIGIN
    },
    contextual_intelligence: {
      form_note: 'canonical scout context'
    }
  };

  assert.equal(isAuthoritativeScoutFipContext(fixture), true);
  assert.equal(hasSuppliedContextualIntelligence(fixture), true);
});

test('configured provider fixtures do not bypass the cache wrapper', () => {
  const fixture = {
    match_info: {
      match_id: 'PROVIDER-1'
    },
    contextual_intelligence: {
      weather: null
    }
  };

  assert.equal(isAuthoritativeScoutFipContext(fixture), false);
});

test('scout FIP pipeline completes without late fixture_context_cache access', async (t) => {
  const fixtureCacheOps = {
    during: 0,
    after: 0
  };

  let pipelineReturned = false;
  const unhandledRejections = [];
  const uncaughtExceptions = [];

  const onUnhandledRejection = (reason) => {
    unhandledRejections.push(reason);
  };

  const onUncaughtException = (error) => {
    uncaughtExceptions.push(error);
  };

  process.on('unhandledRejection', onUnhandledRejection);
  process.on('uncaughtException', onUncaughtException);

  t.after(() => {
    process.off('unhandledRejection', onUnhandledRejection);
    process.off('uncaughtException', onUncaughtException);
  });

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

  const memoryStore = {
    predictions_raw: [],
    predictions_filtered: []
  };

  function trackFixtureCacheOp() {
    if (pipelineReturned) {
      fixtureCacheOps.after += 1;
    } else {
      fixtureCacheOps.during += 1;
    }
  }

  function createQueryBuilder(tableName) {
    const table = String(tableName || '');

    const builder = {
      eq() {
        return builder;
      },

      single() {
        return builder;
      },

      async then(resolve, reject) {
        try {
          if (table === 'fixture_context_cache') {
            trackFixtureCacheOp();
          }

          return resolve({ data: null, error: { message: 'cache_miss' } });
        } catch (error) {
          return reject(error);
        }
      }
    };

    return builder;
  }

  const fakeSupabase = {
    from(tableName) {
      const table = String(tableName || '');

      if (table === 'tier_rules') {
        return {
          select() {
            return Promise.resolve({
              data: JSON.parse(JSON.stringify(tierRules)),
              error: null
            });
          }
        };
      }

      if (table === 'fixture_context_cache') {
        return {
          select() {
            trackFixtureCacheOp();
            return createQueryBuilder(table);
          },

          upsert() {
            trackFixtureCacheOp();
            return Promise.resolve({ error: null });
          }
        };
      }

      return {
        select() {
          return Promise.resolve({ data: null, error: null });
        }
      };
    }
  };

  installResolvedModuleStub(require.resolve('@supabase/supabase-js'), {
    createClient() {
      return fakeSupabase;
    }
  });

  installRepositoryModuleStub('backend/db.js', {
    async query() {
      return { rows: [], rowCount: 0 };
    },

    async withTransaction(work) {
      const client = {
        async query(text, params = []) {
          const sql = String(text || '').replace(/\s+/g, ' ').trim();

          if (/insert\s+into\s+predictions_raw/i.test(sql)) {
            let metadata = params[7];

            if (typeof metadata === 'string') {
              try {
                metadata = JSON.parse(metadata);
              } catch (_error) {
                metadata = { raw_metadata: metadata };
              }
            }

            const row = {
              id: 900000201,
              match_id: params[0],
              sport: params[1],
              market: params[2],
              prediction: params[3],
              confidence: params[4],
              volatility: params[5],
              odds: params[6],
              metadata,
              created_at: new Date().toISOString()
            };

            memoryStore.predictions_raw.push(row);

            return { rows: [row], rowCount: 1 };
          }

          if (/select\s+\*\s+from\s+predictions_raw\s+where\s+id\s*=\s*\$1/i.test(sql)) {
            const id = Number(params[0]);
            const row = memoryStore.predictions_raw.find(
              (item) => Number(item.id) === id
            ) || null;

            return {
              rows: row ? [row] : [],
              rowCount: row ? 1 : 0
            };
          }

          if (/insert\s+into\s+predictions_filtered/i.test(sql)) {
            const row = {
              id: 910000201 + memoryStore.predictions_filtered.length,
              raw_id: Number(params[0]),
              tier: String(params[1] || ''),
              is_valid: Boolean(params[2]),
              reject_reason: params[3] || null,
              is_watchlist: Boolean(params[4]),
              created_at: new Date().toISOString()
            };

            memoryStore.predictions_filtered.push(row);

            return { rows: [row], rowCount: 1 };
          }

          return { rows: [], rowCount: 0 };
        }
      };

      return work(client);
    },

    pool: {
      async connect() {
        throw new Error('pool access blocked');
      }
    }
  });

  installRepositoryModuleStub('backend/services/dataProvider.js', {
    async getPredictionInputs() {
      throw new Error('provider fallback blocked');
    }
  });

  installRepositoryModuleStub('backend/services/contextIngestionService.js', {
    async safeFetch() {
      throw new Error('external context blocked');
    },
    async getInjuries() {
      throw new Error('external injuries blocked');
    },
    async getH2H() {
      throw new Error('external h2h blocked');
    },
    async getWeather() {
      throw new Error('external weather blocked');
    },
    async getTeamNewsContext() {
      throw new Error('external news blocked');
    }
  });

  installRepositoryModuleStub('backend/services/saveContextData.js', {
    async saveContextData() {
      throw new Error('context persistence blocked');
    }
  });

  installRepositoryModuleStub('backend/services/saveDirectInsights.js', {
    async saveDirectInsight() {
      throw new Error('direct insight persistence blocked');
    }
  });

  clearRepositoryModule('backend/src/services/contextIntelligence/aiPipeline');
  clearRepositoryModule('backend/services/aiPipeline');

  const {
    FIP_SCHEMA_VERSION,
    HASH_ALGORITHM,
    SCOUT_FIP_ORIGIN: FIP_ORIGIN,
    PROOF_FIXTURE_MODE,
    computeFipHash
  } = require('../backend/services/fipIntakeService');

  const aiPipeline = require('../backend/services/aiPipeline');

  const now = new Date();
  const kickoff = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  const fipId = `E2E-001D-TEST-${now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;

  const fip = {
    fip_schema_version: FIP_SCHEMA_VERSION,
    fip_id: fipId,
    proof_mode: PROOF_FIXTURE_MODE,
    sports_truth_origin: FIP_ORIGIN,
    validation: {
      status: 'VALIDATED',
      algorithm: HASH_ALGORITHM,
      hash: '',
      validated_at: now.toISOString()
    },
    fixture: {
      fixture_id: fipId,
      match_id: fipId,
      sport: 'football',
      home_team: 'Scout Async Home FC',
      away_team: 'Scout Async Away FC',
      kickoff_time: kickoff.toISOString(),
      competition: 'Scout Async League',
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
        form_note: 'canonical scout async containment context',
        injury_note: null,
        weather: null
      },
      scout_profile_version: 'e2e-001d-test-v1'
    },
    metadata: {
      sports_truth_origin: FIP_ORIGIN,
      source: FIP_ORIGIN,
      execution_scope: 'TEST_ASYNC_CONTAINMENT'
    }
  };

  fip.validation.hash = computeFipHash(fip);

  const runtimeResult = await aiPipeline.runPipelineFromConfiguredDataMode({
    fip_envelopes: [fip],
    governed_mode: PROOF_FIXTURE_MODE,
    caller: 'E2E-001D-ASYNC-CONTAINMENT-TEST',
    received_at: now.toISOString()
  });

  pipelineReturned = true;

  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(fixtureCacheOps.during, 0);
  assert.equal(fixtureCacheOps.after, 0);
  assert.equal(memoryStore.predictions_raw.length, 1);
  assert.equal(memoryStore.predictions_filtered.length, 2);
  assert.equal(runtimeResult.mode, 'scout_fip');
  assert.equal(runtimeResult.inserted.length, 1);
  assert.equal(runtimeResult.filtered_valid, 2);
  assert.equal(runtimeResult.filtered_invalid, 0);
  assert.equal(
    runtimeResult.inserted[0].metadata?.match_context?.contextual_intelligence?.form_note,
  'canonical scout async containment context'
  );
  assert.equal(unhandledRejections.length, 0);
  assert.equal(uncaughtExceptions.length, 0);
});
