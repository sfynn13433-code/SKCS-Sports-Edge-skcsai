'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  DOMAIN_CODES,
  buildSigningPayload,
  computeSignature,
  computeSubmittedBodyHash,
  createHmacM2MAuthenticator
} = require(
  '../backend/services/fipIntakeM2MAuthenticator'
);

function makeDeps(overrides = {}) {
  const used = new Set();

  return {
    secretResolver: {
      async getSecretForCaller(caller) {
        return caller === 'scout-runtime'
          ? 'test-secret'
          : null;
      }
    },

    nonceStore: {
      async hasNonce({
        callerIdentityRef,
        nonce
      }) {
        return used.has(
          `${callerIdentityRef}:${nonce}`
        );
      },

      async reserveNonce({
        callerIdentityRef,
        nonce
      }) {
        used.add(
          `${callerIdentityRef}:${nonce}`
        );
      }
    },

    clock: {
      now: () =>
        '2026-07-14T12:00:00.000Z'
    },

    ...overrides
  };
}

function signedContext(overrides = {}) {
  const values = {
    callerIdentityRef: 'scout-runtime',
    governedMode: 'PROOF_FIXTURE',
    timestamp: '2026-07-14T12:00:00.000Z',
    nonce: 'nonce-1234567890',
    bodyHash: crypto
      .createHash('sha256')
      .update('body')
      .digest('hex'),
    ...overrides
  };

  values.signature = computeSignature({
    secret: 'test-secret',
    signingPayload: buildSigningPayload(values)
  });

  return {
    caller: values.callerIdentityRef,
    governedMode: values.governedMode,
    submittedBodyHash: values.bodyHash,
    context: {
      auth: {
        timestamp: values.timestamp,
        nonce: values.nonce,
        bodyHash: values.bodyHash,
        signature: values.signature
      }
    }
  };
}

test(
  'factory requires dependencies',
  () => {
    assert.throws(
      () => createHmacM2MAuthenticator(),
      /secretResolver/
    );
  }
);

test(
  'accepts a valid bounded HMAC context',
  async () => {
    const auth =
      createHmacM2MAuthenticator(makeDeps());

    const result =
      await auth.authorizeCaller(
        signedContext()
      );

    assert.equal(result.authorized, true);
    assert.equal(
      result.authentication,
      'HMAC_SHA256'
    );
  }
);

test(
  'computes the submitted-body hash deterministically',
  () => {
    const first = {
      fixture: {
        away: 'Away FC',
        home: 'Home FC'
      },
      fip_id: 'fip-001'
    };

    const sameDifferentKeyOrder = {
      fip_id: 'fip-001',
      fixture: {
        home: 'Home FC',
        away: 'Away FC'
      }
    };

    assert.equal(
      computeSubmittedBodyHash(first),
      computeSubmittedBodyHash(
        sameDifferentKeyOrder
      )
    );
  }
);

test(
  'rejects a signed body-hash mismatch before nonce inspection or reservation',
  async () => {
    let secretCalls = 0;
    let nonceLookupCalls = 0;
    let nonceReservationCalls = 0;

    const auth =
      createHmacM2MAuthenticator({
        secretResolver: {
          async getSecretForCaller() {
            secretCalls += 1;
            return 'test-secret';
          }
        },

        nonceStore: {
          async hasNonce() {
            nonceLookupCalls += 1;
            return false;
          },

          async reserveNonce() {
            nonceReservationCalls += 1;
          }
        },

        clock: {
          now: () =>
            '2026-07-14T12:00:00.000Z'
        }
      });

    const input = signedContext();

    input.submittedBodyHash =
      input.submittedBodyHash ===
      'f'.repeat(64)
        ? 'e'.repeat(64)
        : 'f'.repeat(64);

    const result =
      await auth.authorizeCaller(input);

    assert.equal(result.authorized, false);

    assert.equal(
      result.code,
      DOMAIN_CODES
        .FIP_AUTH_BODY_HASH_MISMATCH
    );

    assert.equal(secretCalls, 0);
    assert.equal(nonceLookupCalls, 0);
    assert.equal(nonceReservationCalls, 0);
  }
);

test(
  'rejects a missing actual submitted-body hash',
  async () => {
    const auth =
      createHmacM2MAuthenticator(makeDeps());

    const input = signedContext();
    delete input.submittedBodyHash;

    const result =
      await auth.authorizeCaller(input);

    assert.equal(result.authorized, false);

    assert.equal(
      result.code,
      DOMAIN_CODES.FIP_AUTH_CONTEXT_INVALID
    );
  }
);

test(
  'rejects unknown callers',
  async () => {
    const auth =
      createHmacM2MAuthenticator(makeDeps());

    const input = signedContext({
      callerIdentityRef: 'unknown'
    });

    const result =
      await auth.authorizeCaller(input);

    assert.equal(
      result.authorized,
      false
    );

    assert.equal(
      result.code,
      DOMAIN_CODES.FIP_AUTH_CALLER_UNKNOWN
    );
  }
);

test(
  'rejects invalid signatures',
  async () => {
    const auth =
      createHmacM2MAuthenticator(makeDeps());

    const input = signedContext();

    input.context.auth.signature =
      '0'.repeat(64);

    const result =
      await auth.authorizeCaller(input);

    assert.equal(
      result.code,
      DOMAIN_CODES.FIP_AUTH_SIGNATURE_INVALID
    );
  }
);

test(
  'rejects stale timestamps',
  async () => {
    const auth =
      createHmacM2MAuthenticator(makeDeps());

    const result =
      await auth.authorizeCaller(
        signedContext({
          timestamp:
            '2026-07-14T11:40:00.000Z'
        })
      );

    assert.equal(
      result.code,
      DOMAIN_CODES.FIP_AUTH_TIMESTAMP_INVALID
    );
  }
);

test(
  'rejects nonce replay',
  async () => {
    const auth =
      createHmacM2MAuthenticator(makeDeps());

    const input = signedContext();

    const first =
      await auth.authorizeCaller(input);

    assert.equal(first.authorized, true);

    const replay =
      await auth.authorizeCaller(input);

    assert.equal(
      replay.code,
      DOMAIN_CODES.FIP_AUTH_REPLAY_DETECTED
    );
  }
);
