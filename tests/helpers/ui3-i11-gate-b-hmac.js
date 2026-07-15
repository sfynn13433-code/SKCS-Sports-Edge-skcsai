'use strict';

const crypto = require('node:crypto');

const {
  HASH_ALGORITHM,
  PROOF_FIXTURE_MODE,
  computeFipHash,
  stableStringify,
  buildIntakeId
} = require('../../backend/services/fipIntakeService');

const {
  buildSigningPayload,
  computeSignature
} = require('../../backend/services/fipIntakeM2MAuthenticator');

const TEST_NOW = '2026-07-15T10:00:00.000Z';
const TEST_KICKOFF = '2026-07-16T16:00:00.000Z';
const TEST_CALLER = 'scout-ui3-i11-gate-b-test';
const TEST_SECRET = 'ui3-i11-gate-b-test-secret-not-for-production';
const TEST_FIXTURE_UID = '11111111-1111-4111-8111-111111111111';
const TEST_SCOUT_FIXTURE_ID = 'scout-fixture-ui3-i11-gate-b-001';
const TEST_FIP_ID = 'scout-fip-ui3-i11-gate-b-001';

function deepClone(value) {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], value);
    } else {
      target[key] = deepClone(value);
    }
  }

  return target;
}

function buildCanonicalFip(overrides = {}) {
  const fip = {
    fip_id: TEST_FIP_ID,
    fip_schema_version: '1.0.0',
    validation: {
      status: 'VALIDATED',
      hash: '',
      hash_algorithm: HASH_ALGORITHM,
      validated_at: TEST_NOW
    },
    scout: {
      fixture_id: TEST_SCOUT_FIXTURE_ID
    },
    provenance: {
      scout_run_id: 'scout-run-ui3-i11-gate-b-001',
      source_system: 'SCOUT',
      assembled_at: '2026-07-15T09:58:00.000Z'
    },
    fixture: {
      sport: 'football',
      league_id: 'za-premier-division',
      league: 'South African Premier Division',
      kickoff_utc: TEST_KICKOFF,
      status: 'NS',
      home_team: {
        id: 'team-home-ui3-i11-001',
        name: 'Gate B Home FC'
      },
      away_team: {
        id: 'team-away-ui3-i11-001',
        name: 'Gate B Away FC'
      },
      country: 'ZA',
      venue: 'Gate B Test Stadium'
    },
    markets: {
      direct_1x2: {
        home: 2.1,
        draw: 3.25,
        away: 3.4
      },
      source: 'scout-governed-odds'
    },
    context: {
      contextual_intelligence: {
        weather: null,
        injuries: [],
        form: {
          home: {},
          away: {}
        }
      }
    }
  };

  deepMerge(fip, overrides);
  fip.validation.hash = '';
  fip.validation.hash = computeFipHash(fip);
  return fip;
}

function cloneModifyAndRehash(fipPayload, mutator) {
  const modified = deepClone(fipPayload);
  mutator(modified);
  modified.validation.hash = '';
  modified.validation.hash = computeFipHash(modified);
  return modified;
}

function computeSubmittedBodyHash(fipPayload) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(fipPayload), 'utf8')
    .digest('hex');
}

function signAuthenticationContext({
  fipPayload,
  bodyHashSource = fipPayload,
  callerIdentityRef = TEST_CALLER,
  governedMode = PROOF_FIXTURE_MODE,
  timestamp = TEST_NOW,
  nonce,
  secret = TEST_SECRET
}) {
  if (!nonce) {
    throw new TypeError('A deterministic test nonce is required.');
  }

  const bodyHash = computeSubmittedBodyHash(bodyHashSource);
  const signingPayload = buildSigningPayload({
    callerIdentityRef,
    governedMode,
    timestamp,
    nonce,
    bodyHash
  });

  const signature = computeSignature({
    secret,
    signingPayload
  });

  return {
    caller: callerIdentityRef,
    governedMode,
    receivedAt: timestamp,
    auth: {
      timestamp,
      nonce,
      bodyHash,
      signature
    }
  };
}

function createTestSecretResolver({
  callerIdentityRef = TEST_CALLER,
  secret = TEST_SECRET
} = {}) {
  return {
    async getSecretForCaller(caller) {
      return caller === callerIdentityRef ? secret : null;
    }
  };
}

function createInMemoryNonceStore() {
  const reserved = new Map();

  return {
    async hasNonce({ callerIdentityRef, nonce }) {
      return reserved.has(`${callerIdentityRef}:${nonce}`);
    },

    async reserveNonce({ callerIdentityRef, nonce, expiresAt }) {
      reserved.set(`${callerIdentityRef}:${nonce}`, {
        callerIdentityRef,
        nonce,
        expiresAt
      });
    },

    snapshot() {
      return Array.from(reserved.values()).map((entry) => ({ ...entry }));
    }
  };
}

function createInjectedTestGateReader() {
  const injectedGates = Object.freeze({
    scoutEdgeMarriageGate: 'CLEARED',
    supabaseStorageGate: 'CLEARED',
    unifiedLifecycleGovernor: 'CLEARED'
  });

  return {
    async readGates() {
      return { ...injectedGates };
    },

    snapshot() {
      return { ...injectedGates };
    }
  };
}

function createInjectedTestGovernor() {
  return {
    REJECTION_CODES: {
      LIFECYCLE_FEATURE_DISABLED: 'LIFECYCLE_FEATURE_DISABLED'
    },

    async evaluateGovernorGate({ featureFlagEnabled }) {
      if (featureFlagEnabled !== true) {
        return {
          allowed: false,
          code: 'LIFECYCLE_FEATURE_DISABLED'
        };
      }

      return {
        allowed: true,
        code: 'INJECTED_TEST_GATE_ALLOWED'
      };
    }
  };
}

function createTestClock() {
  return {
    now() {
      return TEST_NOW;
    }
  };
}

function createTestIntakeIdGenerator() {
  return ({ fipId, validationHash, receivedAt }) =>
    buildIntakeId({
      fipId,
      validationHash,
      receivedAt
    });
}

module.exports = {
  TEST_NOW,
  TEST_KICKOFF,
  TEST_CALLER,
  TEST_SECRET,
  TEST_FIXTURE_UID,
  TEST_SCOUT_FIXTURE_ID,
  TEST_FIP_ID,
  deepClone,
  deepMerge,
  buildCanonicalFip,
  cloneModifyAndRehash,
  computeSubmittedBodyHash,
  signAuthenticationContext,
  createTestSecretResolver,
  createInMemoryNonceStore,
  createInjectedTestGateReader,
  createInjectedTestGovernor,
  createTestClock,
  createTestIntakeIdGenerator
};
