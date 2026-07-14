'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ALIAS_NAMESPACE,
  createFixtureIdentityResolver
} = require('../backend/services/fixtureIdentityResolverService');
const { DOMAIN_CODES } = require('../backend/services/fipIntakeService');

const FIXTURE_UID = '11111111-1111-4111-8111-111111111111';
const SCOUT_FIXTURE_ID = 'scout-fixture-001';

function createMockQuery(handlers = {}) {
  const calls = [];
  async function query(sql, params) {
    calls.push({ sql, params });
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    for (const [prefix, handler] of Object.entries(handlers)) {
      if (normalized.startsWith(prefix)) {
        return handler(params, calls);
      }
    }
    return { rows: [] };
  }
  return { query, calls };
}

test('missing query dependency fails at factory construction', () => {
  assert.throws(() => createFixtureIdentityResolver({}), /Missing required dependency: query/);
});

test('scout.fixture_id resolves through alias namespace scout_fixture_id', async () => {
  const { query, calls } = createMockQuery({
    'SELECT fixture_uid FROM fixture_identity_aliases': () => ({
      rows: [{ fixture_uid: FIXTURE_UID }]
    }),
    'SELECT fixture_uid FROM fixture_lifecycle_current': () => ({
      rows: [{ fixture_uid: FIXTURE_UID }]
    })
  });
  const resolver = createFixtureIdentityResolver({ query });

  const identity = await resolver.resolveScoutFixtureId(SCOUT_FIXTURE_ID);
  assert.equal(identity.ok, true);
  assert.equal(identity.fixtureUid, FIXTURE_UID);
  assert.match(calls[0].sql, /fixture_identity_aliases/);
  assert.equal(calls[0].params[0], ALIAS_NAMESPACE);
  assert.equal(calls[0].params[1], SCOUT_FIXTURE_ID);
  assert.doesNotMatch(calls[0].sql, /\*/);
});

test('missing alias returns FIP_FIXTURE_IDENTITY_UNRESOLVED', async () => {
  const { query } = createMockQuery({
    'SELECT fixture_uid FROM fixture_identity_aliases': () => ({ rows: [] })
  });
  const resolver = createFixtureIdentityResolver({ query });
  const result = await resolver.resolveScoutFixtureId(SCOUT_FIXTURE_ID);
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.FIP_FIXTURE_IDENTITY_UNRESOLVED);
});

test('conflicting alias returns FIP_IDENTITY_INCONSISTENT', async () => {
  const { query } = createMockQuery({
    'SELECT fixture_uid FROM fixture_identity_aliases': () => ({
      rows: [{ fixture_uid: FIXTURE_UID }, { fixture_uid: '22222222-2222-4222-8222-222222222222' }]
    })
  });
  const resolver = createFixtureIdentityResolver({ query });
  const result = await resolver.resolveScoutFixtureId(SCOUT_FIXTURE_ID);
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.FIP_IDENTITY_INCONSISTENT);
});

test('scout.fixture_id is never used as fixture_uid', async () => {
  const { query } = createMockQuery({
    'SELECT fixture_uid FROM fixture_identity_aliases': () => ({
      rows: [{ fixture_uid: SCOUT_FIXTURE_ID }]
    })
  });
  const resolver = createFixtureIdentityResolver({ query });
  const result = await resolver.resolveScoutFixtureId(SCOUT_FIXTURE_ID);
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.FIP_IDENTITY_INCONSISTENT);
});

test('missing lifecycle parent returns FIP_LIFECYCLE_PARENT_MISSING', async () => {
  const { query } = createMockQuery({
    'SELECT fixture_uid FROM fixture_lifecycle_current': () => ({ rows: [] })
  });
  const resolver = createFixtureIdentityResolver({ query });
  const result = await resolver.confirmLifecycleParent(FIXTURE_UID);
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.FIP_LIFECYCLE_PARENT_MISSING);
});

test('resolveAndConfirm uses bounded query count', async () => {
  const { query, calls } = createMockQuery({
    'SELECT fixture_uid FROM fixture_identity_aliases': () => ({
      rows: [{ fixture_uid: FIXTURE_UID }]
    }),
    'SELECT fixture_uid FROM fixture_lifecycle_current': () => ({
      rows: [{ fixture_uid: FIXTURE_UID }]
    })
  });
  const resolver = createFixtureIdentityResolver({ query });
  const result = await resolver.resolveAndConfirm(SCOUT_FIXTURE_ID);
  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
});
