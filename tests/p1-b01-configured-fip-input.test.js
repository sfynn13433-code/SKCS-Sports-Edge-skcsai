'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');


/*
 * E2E-001F TEST DATABASE ISOLATION
 *
 * Scout owns Neon.
 * Edge owns Supabase.
 * This test must not contact either live database.
 */

const http = require('node:http');
const https = require('node:https');

const isolationCounters = {
  database_connection_attempts: 0,
  database_query_attempts: 0,
  network_attempts: 0
};

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
};

const blockedEnvironment = {
  NODE_ENV: 'test',

  DATABASE_URL:
    'postgresql://e2e001f-blocked:e2e001f-blocked@127.0.0.1:1/e2e001f',

  SUPABASE_URL:
    'http://127.0.0.1:1',

  SUPABASE_SERVICE_ROLE_KEY:
    'E2E001F_BLOCKED_SERVICE_ROLE_KEY',

  SUPABASE_KEY:
    'E2E001F_BLOCKED_SUPABASE_KEY',

  SUPABASE_ANON_KEY:
    'E2E001F_BLOCKED_ANON_KEY'
};

for (
  const [name, value] of
  Object.entries(blockedEnvironment)
) {
  process.env[name] = value;
}

function controlledIsolationError(
  code,
  message
) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function blockDatabaseConnection() {
  isolationCounters.database_connection_attempts += 1;

  throw controlledIsolationError(
    'E2E001F_DATABASE_CONNECTION_BLOCKED',
    'A database connection was attempted during an isolated unit test.'
  );
}

function blockDatabaseQuery() {
  isolationCounters.database_query_attempts += 1;

  throw controlledIsolationError(
    'E2E001F_DATABASE_QUERY_BLOCKED',
    'A database query was attempted during an isolated unit test.'
  );
}

function blockNetworkOperation() {
  isolationCounters.network_attempts += 1;

  throw controlledIsolationError(
    'E2E001F_NETWORK_OPERATION_BLOCKED',
    'A network operation was attempted during an isolated unit test.'
  );
}

const originalNetworkFunctions = {
  httpRequest: http.request,
  httpGet: http.get,
  httpsRequest: https.request,
  httpsGet: https.get,
  fetch: global.fetch
};

http.request = blockNetworkOperation;
http.get = blockNetworkOperation;
https.request = blockNetworkOperation;
https.get = blockNetworkOperation;

global.fetch = async () => {
  return blockNetworkOperation();
};

const blockedPool = {
  connect: blockDatabaseConnection,
  query: blockDatabaseQuery,

  end() {
    return undefined;
  },

  on() {
    return undefined;
  }
};

const blockedDatabaseExports = {
  pool: blockedPool,
  query: blockDatabaseQuery,
  withTransaction: blockDatabaseQuery
};

function installRepositoryModuleStub(relativePath) {
  const resolved =
    require.resolve(relativePath);

  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: blockedDatabaseExports,
    children: [],
    paths: []
  };
}

/*
 * E2E-001F VERIFICATION CONTROLLER STUB
 *
 * aiPipeline imports this production controller, whose module startup
 * hydrates a system-health snapshot from the Edge database.
 *
 * This unit test does not exercise verification-controller behaviour,
 * so the controller is replaced before aiPipeline is loaded.
 */
function installPlainModuleStub(
  relativePath,
  exportsValue
) {
  const resolved =
    require.resolve(relativePath);

  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
    children: [],
    paths: []
  };
}

installPlainModuleStub(
  '../backend/core/verificationController.js',
  Object.freeze({})
);

installRepositoryModuleStub('../backend/database.js');
installRepositoryModuleStub('../backend/db.js');

test.after(() => {
  assert.equal(
    isolationCounters.database_connection_attempts,
    0,
    'No database connection may be attempted'
  );

  assert.equal(
    isolationCounters.database_query_attempts,
    0,
    'No database query may be attempted'
  );

  assert.equal(
    isolationCounters.network_attempts,
    0,
    'No network operation may be attempted'
  );

  http.request =
    originalNetworkFunctions.httpRequest;

  http.get =
    originalNetworkFunctions.httpGet;

  https.request =
    originalNetworkFunctions.httpsRequest;

  https.get =
    originalNetworkFunctions.httpsGet;

  global.fetch =
    originalNetworkFunctions.fetch;

  for (
    const [name, value] of
    Object.entries(originalEnvironment)
  ) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  console.log(
    'E2E-001F DATABASE CONNECTION ATTEMPTS: ' +
    isolationCounters.database_connection_attempts
  );

  console.log(
    'E2E-001F DATABASE QUERY ATTEMPTS: ' +
    isolationCounters.database_query_attempts
  );

  console.log(
    'E2E-001F NETWORK ATTEMPTS: ' +
    isolationCounters.network_attempts
  );
});

const aiPipeline = require('../backend/services/aiPipeline');

const {
  resolveConfiguredPredictionInput
} = aiPipeline.__test;

function validEnvelope(id) {
  return {
    match_info: {
      match_id: id,
      sport: 'football'
    },
    sharp_odds: {
      home: 2.1,
      draw: 3.2,
      away: 3.5
    },
    contextual_intelligence: {},
    metadata: {
      sports_truth_origin: 'SCOUT_FIP',
      fip_id: id
    }
  };
}

function validFip(id) {
  return {
    fip_id: id
  };
}

test('configured provider path remains active when fip_envelopes is absent', async () => {
  let providerCalls = 0;

  const result = await resolveConfiguredPredictionInput(
    {},
    {
      getPredictionInputs: async () => {
        providerCalls += 1;
        return {
          mode: 'live',
          predictions: [{ match_id: 'provider-1' }]
        };
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.source, 'configured_provider');
  assert.equal(providerCalls, 1);
  assert.equal(result.predictions.length, 1);
  assert.equal(result.intake_results, null);
});

test('valid FIP batch bypasses provider input and emits only mapped envelopes', async () => {
  let providerCalls = 0;
  const receivedRawFips = [];
  const firstFip = validFip('FIP-1');
  const secondFip = validFip('FIP-2');

  const result = await resolveConfiguredPredictionInput(
    {
      fip_envelopes: [firstFip, secondFip],
      governed_mode: 'PROOF_FIXTURE',
      caller: 'P1-B01-test',
      received_at: '2026-07-12T12:00:00.000Z'
    },
    {
      getPredictionInputs: async () => {
        providerCalls += 1;
        throw new Error('provider path must not be called');
      },
      receiveValidatedFip: (rawFip) => {
        receivedRawFips.push(rawFip);
        return {
          accepted: true,
          result: 'ACCEPTED',
          envelope: validEnvelope(rawFip.fip_id),
          evidence: {
            fip_id: rawFip.fip_id
          }
        };
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'scout_fip');
  assert.equal(result.source, 'scout_fip');
  assert.equal(providerCalls, 0);
  assert.equal(receivedRawFips[0], firstFip);
  assert.equal(receivedRawFips[1], secondFip);
  assert.deepEqual(result.predictions, [
    validEnvelope('FIP-1'),
    validEnvelope('FIP-2')
  ]);
  assert.notEqual(result.predictions[0], firstFip);
  assert.notEqual(result.predictions[1], secondFip);
});

test('one rejected FIP rejects the complete batch atomically', async () => {
  let providerCalls = 0;
  let intakeCalls = 0;

  const result = await resolveConfiguredPredictionInput(
    {
      fip_envelopes: [
        validFip('FIP-GOOD'),
        validFip('FIP-BAD'),
        validFip('FIP-GOOD-2')
      ],
      governed_mode: 'PROOF_FIXTURE',
      caller: 'P1-B01-test',
      received_at: '2026-07-12T12:00:00.000Z'
    },
    {
      getPredictionInputs: async () => {
        providerCalls += 1;
        throw new Error('provider path must not be called');
      },
      receiveValidatedFip: (rawFip) => {
        intakeCalls += 1;

        if (rawFip.fip_id === 'FIP-BAD') {
          return {
            accepted: false,
            result: 'REJECTED',
            rejection_code: 'TEST_REJECTION',
            envelope: null
          };
        }

        return {
          accepted: true,
          result: 'ACCEPTED',
          envelope: validEnvelope(rawFip.fip_id)
        };
      }
    }
  );

  assert.equal(providerCalls, 0);
  assert.equal(intakeCalls, 3);
  assert.equal(result.ok, false);
  assert.equal(result.response.accepted, false);
  assert.equal(result.response.batch_rejected, true);
  assert.equal(result.response.rejection_code, 'FIP_BATCH_REJECTED');
  assert.deepEqual(result.response.inserted, []);
  assert.deepEqual(result.response.filtered, []);
  assert.deepEqual(result.response.details.rejected_indexes, [1]);
  assert.equal(result.response.intake_results.length, 3);
});

test('rejects malformed FIP batch request contracts', async () => {
  const cases = [
    {
      name: 'non-array',
      options: {
        fip_envelopes: {},
        governed_mode: 'PROOF_FIXTURE',
        caller: 'test'
      },
      code: 'FIP_BATCH_INVALID'
    },
    {
      name: 'empty',
      options: {
        fip_envelopes: [],
        governed_mode: 'PROOF_FIXTURE',
        caller: 'test'
      },
      code: 'FIP_BATCH_SIZE_INVALID'
    },
    {
      name: 'oversized',
      options: {
        fip_envelopes: Array.from(
          { length: 101 },
          (_, index) => validFip(`FIP-${index}`)
        ),
        governed_mode: 'PROOF_FIXTURE',
        caller: 'test'
      },
      code: 'FIP_BATCH_SIZE_INVALID'
    },
    {
      name: 'malformed item',
      options: {
        fip_envelopes: [null],
        governed_mode: 'PROOF_FIXTURE',
        caller: 'test'
      },
      code: 'FIP_BATCH_ITEM_INVALID'
    },
    {
      name: 'wrong governed mode',
      options: {
        fip_envelopes: [validFip('FIP-1')],
        governed_mode: 'AUTHORIZED_PRODUCTION',
        caller: 'test'
      },
      code: 'FIP_GOVERNED_MODE_INVALID'
    },
    {
      name: 'blank caller',
      options: {
        fip_envelopes: [validFip('FIP-1')],
        governed_mode: 'PROOF_FIXTURE',
        caller: '   '
      },
      code: 'FIP_CALLER_INVALID'
    }
  ];

  for (const testCase of cases) {
    let providerCalls = 0;
    let intakeCalls = 0;

    const result = await resolveConfiguredPredictionInput(
      testCase.options,
      {
        getPredictionInputs: async () => {
          providerCalls += 1;
          throw new Error('provider path must not be called');
        },
        receiveValidatedFip: () => {
          intakeCalls += 1;
          throw new Error('intake must not run for invalid request contract');
        }
      }
    );

    assert.equal(
      result.response.rejection_code,
      testCase.code,
      testCase.name
    );
    assert.equal(providerCalls, 0, testCase.name);
    assert.equal(intakeCalls, 0, testCase.name);
  }
});
