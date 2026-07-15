'use strict';

const crypto = require('node:crypto');

const {
  stableStringify
} = require('./fipIntakeService');

const DOMAIN_CODES = Object.freeze({
  FIP_INTAKE_UNAUTHORIZED: 'FIP_INTAKE_UNAUTHORIZED',
  FIP_AUTH_CONTEXT_INVALID: 'FIP_AUTH_CONTEXT_INVALID',
  FIP_AUTH_TIMESTAMP_INVALID: 'FIP_AUTH_TIMESTAMP_INVALID',
  FIP_AUTH_REPLAY_DETECTED: 'FIP_AUTH_REPLAY_DETECTED',
  FIP_AUTH_SIGNATURE_INVALID: 'FIP_AUTH_SIGNATURE_INVALID',
  FIP_AUTH_CALLER_UNKNOWN: 'FIP_AUTH_CALLER_UNKNOWN',
  FIP_AUTH_BODY_HASH_MISMATCH:
    'FIP_AUTH_BODY_HASH_MISMATCH'
});

const DEFAULT_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const HEX_SHA256_RE = /^[a-f0-9]{64}$/i;
const NONCE_RE = /^[A-Za-z0-9._:-]{16,128}$/;

function assertDependency(name, value) {
  if (value === null || value === undefined) {
    throw new TypeError(`Missing required dependency: ${name}`);
  }
}

function reject(code, message) {
  return {
    authorized: false,
    code,
    message
  };
}

function accept(extra = {}) {
  return {
    authorized: true,
    ...extra
  };
}

function toEpochMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

function computeSubmittedBodyHash(submittedBody) {
  const serialized = stableStringify(submittedBody);

  if (typeof serialized !== 'string') {
    throw new TypeError(
      'Submitted FIP body cannot be deterministically serialized.'
    );
  }

  return crypto
    .createHash('sha256')
    .update(serialized, 'utf8')
    .digest('hex');
}

function buildSigningPayload({
  callerIdentityRef,
  governedMode,
  timestamp,
  nonce,
  bodyHash
}) {
  return [
    String(callerIdentityRef || '').trim(),
    String(governedMode || '').trim(),
    String(timestamp || '').trim(),
    String(nonce || '').trim(),
    String(bodyHash || '').trim().toLowerCase()
  ].join('\n');
}

function computeSignature({ secret, signingPayload }) {
  return crypto
    .createHmac('sha256', String(secret))
    .update(String(signingPayload), 'utf8')
    .digest('hex');
}

function createHmacM2MAuthenticator(deps = {}) {
  assertDependency('secretResolver', deps.secretResolver);
  assertDependency('nonceStore', deps.nonceStore);
  assertDependency('clock', deps.clock);

  const maxClockSkewMs =
    Number.isFinite(deps.maxClockSkewMs) && deps.maxClockSkewMs > 0
      ? deps.maxClockSkewMs
      : DEFAULT_MAX_CLOCK_SKEW_MS;

  async function authorizeCaller({
    caller,
    governedMode,
    submittedBodyHash,
    context = {}
  }) {
    const callerIdentityRef = String(caller || '').trim();
    const mode = String(governedMode || '').trim();
    const auth = context.auth;

    if (
      !callerIdentityRef ||
      !mode ||
      !auth ||
      typeof auth !== 'object'
    ) {
      return reject(
        DOMAIN_CODES.FIP_AUTH_CONTEXT_INVALID,
        'Bounded machine-authentication context is required.'
      );
    }

    const timestampText = String(auth.timestamp || '').trim();
    const nonce = String(auth.nonce || '').trim();
    const bodyHash = String(auth.bodyHash || '').trim().toLowerCase();
    const signature = String(auth.signature || '').trim().toLowerCase();
    const actualSubmittedBodyHash = String(
      submittedBodyHash || ''
    )
      .trim()
      .toLowerCase();

    if (
      !timestampText ||
      !NONCE_RE.test(nonce) ||
      !HEX_SHA256_RE.test(bodyHash) ||
      !HEX_SHA256_RE.test(signature)
    ) {
      return reject(
        DOMAIN_CODES.FIP_AUTH_CONTEXT_INVALID,
        'Authentication metadata is malformed.'
      );
    }

    if (!HEX_SHA256_RE.test(actualSubmittedBodyHash)) {
      return reject(
        DOMAIN_CODES.FIP_AUTH_CONTEXT_INVALID,
        'Actual submitted-body hash is required.'
      );
    }

    if (
      !constantTimeEqual(
        bodyHash,
        actualSubmittedBodyHash
      )
    ) {
      return reject(
        DOMAIN_CODES.FIP_AUTH_BODY_HASH_MISMATCH,
        'Authentication body hash does not match the actual submitted FIP payload.'
      );
    }

    const timestampMs = toEpochMillis(timestampText);
    const nowMs = toEpochMillis(deps.clock.now());

    if (timestampMs === null || nowMs === null) {
      return reject(
        DOMAIN_CODES.FIP_AUTH_TIMESTAMP_INVALID,
        'Authentication timestamp is invalid.'
      );
    }

    if (Math.abs(nowMs - timestampMs) > maxClockSkewMs) {
      return reject(
        DOMAIN_CODES.FIP_AUTH_TIMESTAMP_INVALID,
        'Authentication timestamp is outside the allowed replay window.'
      );
    }

    const secret =
      await deps.secretResolver.getSecretForCaller(callerIdentityRef);

    if (!secret) {
      return reject(
        DOMAIN_CODES.FIP_AUTH_CALLER_UNKNOWN,
        'Caller identity is not registered.'
      );
    }

    const alreadyUsed = await deps.nonceStore.hasNonce({
      callerIdentityRef,
      nonce
    });

    if (alreadyUsed) {
      return reject(
        DOMAIN_CODES.FIP_AUTH_REPLAY_DETECTED,
        'Authentication nonce has already been used.'
      );
    }

    const signingPayload = buildSigningPayload({
      callerIdentityRef,
      governedMode: mode,
      timestamp: timestampText,
      nonce,
      bodyHash
    });

    const expectedSignature = computeSignature({
      secret,
      signingPayload
    });

    if (!constantTimeEqual(expectedSignature, signature)) {
      return reject(
        DOMAIN_CODES.FIP_AUTH_SIGNATURE_INVALID,
        'Authentication signature is invalid.'
      );
    }

    await deps.nonceStore.reserveNonce({
      callerIdentityRef,
      nonce,
      expiresAt: new Date(
        timestampMs + maxClockSkewMs
      ).toISOString()
    });

    return accept({
      callerIdentityRef,
      governedMode: mode,
      authentication: 'HMAC_SHA256',
      bodyHash
    });
  }

  return {
    authorizeCaller
  };
}

module.exports = {
  DOMAIN_CODES,
  DEFAULT_MAX_CLOCK_SKEW_MS,
  buildSigningPayload,
  computeSignature,
  computeSubmittedBodyHash,
  constantTimeEqual,
  createHmacM2MAuthenticator
};
