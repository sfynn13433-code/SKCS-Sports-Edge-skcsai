'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

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
