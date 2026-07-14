'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createGovernedFipIntakeComposition
} = require(
  '../backend/services/governedFipIntakeComposition'
);

function baseDeps(overrides = {}) {
  return {
    db: {
      query: async () => ({
        rows: []
      }),

      withTransaction: async (fn) =>
        fn({
          query: async () => ({
            rows: [],
            rowCount: 0
          })
        })
    },

    gateReader: {
      readGates: async () => ({
        scoutEdgeMarriageGate:
          'BLOCKED',
        supabaseStorageGate:
          'BLOCKED',
        unifiedLifecycleGovernor:
          'BLOCKED'
      })
    },

    governor: {
      REJECTION_CODES: {
        LIFECYCLE_FEATURE_DISABLED:
          'LIFECYCLE_FEATURE_DISABLED'
      },

      evaluateGovernorGate:
        async () => ({
          allowed: false,
          code: 'BLOCKED'
        })
    },

    clock: {
      now: () =>
        '2026-07-14T12:00:00.000Z'
    },

    intakeIdGenerator: () =>
      'intake-test',

    secretResolver: {
      getSecretForCaller:
        async () => 'test-secret'
    },

    nonceStore: {
      hasNonce: async () => false,
      reserveNonce: async () => {}
    },

    featureFlagEnabled: false,

    ...overrides
  };
}

test(
  'composition requires explicit dependencies',
  () => {
    assert.throws(
      () =>
        createGovernedFipIntakeComposition(),
      /db/
    );
  }
);

test(
  'composition remains fail-closed by default',
  () => {
    const composition =
      createGovernedFipIntakeComposition(
        baseDeps()
      );

    assert.equal(
      composition.activation
        .featureFlagEnabled,
      false
    );

    assert.equal(
      composition.activation
        .productionRouteMounted,
      false
    );

    assert.equal(
      composition.activation
        .migrationsApplied,
      false
    );
  }
);

test(
  'composition exposes the governed intake components',
  () => {
    const composition =
      createGovernedFipIntakeComposition(
        baseDeps()
      );

    assert.equal(
      typeof composition
        .receiveValidatedFip,
      'function'
    );

    assert.equal(
      typeof composition.components
        .authenticator.authorizeCaller,
      'function'
    );

    assert.equal(
      typeof composition.components
        .identityResolver
        .resolveScoutFixtureId,
      'function'
    );

    assert.equal(
      typeof composition.components
        .displayMetadataPersistence
        .upsertFromValidatedIntake,
      'function'
    );

    assert.equal(
      typeof composition.components
        .evidenceRecorder
        .recordIntakeEvidence,
      'function'
    );
  }
);

test(
  'disabled feature rejects before database work',
  async () => {
    let queryCalls = 0;
    let transactionCalls = 0;

    const deps = baseDeps({
      db: {
        query: async () => {
          queryCalls += 1;

          return {
            rows: []
          };
        },

        withTransaction: async () => {
          transactionCalls += 1;

          throw new Error(
            'must not run'
          );
        }
      }
    });

    const composition =
      createGovernedFipIntakeComposition(
        deps
      );

    const result =
      await composition
        .receiveValidatedFip({}, {});

    assert.equal(result.accepted, false);
    assert.equal(queryCalls, 0);
    assert.equal(transactionCalls, 0);
  }
);

test(
  'module creates no route and performs no network access',
  () => {
    const composition =
      createGovernedFipIntakeComposition(
        baseDeps()
      );

    assert.equal(
      Object.hasOwn(
        composition,
        'router'
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        composition,
        'listen'
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        composition,
        'fetch'
      ),
      false
    );
  }
);
