'use strict';

const { DOMAIN_CODES } = require('./fipIntakeService');

const ALIAS_NAMESPACE = 'scout_fixture_id';

const IDENTITY_SELECT_COLUMNS = 'fixture_uid';
const LIFECYCLE_SELECT_COLUMNS = 'fixture_uid';

function assertDependency(name, value) {
  if (value === null || value === undefined) {
    throw new TypeError(`Missing required dependency: ${name}`);
  }
}

function errResult(code, extra = {}) {
  return { ok: false, code, ...extra };
}

function okResult(extra = {}) {
  return { ok: true, ...extra };
}

function createFixtureIdentityResolver(deps = {}) {
  assertDependency('query', deps.query);

  const query = deps.query;

  async function resolveScoutFixtureId(scoutFixtureId) {
    const value = String(scoutFixtureId || '').trim();
    if (!value) {
      return errResult(DOMAIN_CODES.FIP_FIXTURE_IDENTITY_UNRESOLVED, {
        message: 'scout.fixture_id is required for identity resolution.'
      });
    }

    const result = await query(
      `SELECT ${IDENTITY_SELECT_COLUMNS}
       FROM fixture_identity_aliases
       WHERE alias_namespace = $1 AND alias_value = $2`,
      [ALIAS_NAMESPACE, value]
    );

    const rows = Array.isArray(result?.rows) ? result.rows : [];
    if (rows.length === 0) {
      return errResult(DOMAIN_CODES.FIP_FIXTURE_IDENTITY_UNRESOLVED, {
        scout_fixture_id: value
      });
    }

    if (rows.length > 1) {
      return errResult(DOMAIN_CODES.FIP_IDENTITY_INCONSISTENT, {
        scout_fixture_id: value,
        match_count: rows.length
      });
    }

    const fixtureUid = String(rows[0].fixture_uid || '').trim();
    if (!fixtureUid) {
      return errResult(DOMAIN_CODES.FIP_IDENTITY_INCONSISTENT, {
        scout_fixture_id: value
      });
    }

    if (fixtureUid === value) {
      return errResult(DOMAIN_CODES.FIP_IDENTITY_INCONSISTENT, {
        scout_fixture_id: value,
        reason: 'scout_fixture_id_must_not_equal_fixture_uid'
      });
    }

    return okResult({ fixtureUid, scoutFixtureId: value });
  }

  async function confirmLifecycleParent(fixtureUid) {
    const uid = String(fixtureUid || '').trim();
    if (!uid) {
      return errResult(DOMAIN_CODES.FIP_LIFECYCLE_PARENT_MISSING, {
        message: 'fixture_uid is required for lifecycle confirmation.'
      });
    }

    const result = await query(
      `SELECT ${LIFECYCLE_SELECT_COLUMNS}
       FROM fixture_lifecycle_current
       WHERE fixture_uid = $1`,
      [uid]
    );

    const rows = Array.isArray(result?.rows) ? result.rows : [];
    if (rows.length === 0) {
      return errResult(DOMAIN_CODES.FIP_LIFECYCLE_PARENT_MISSING, {
        fixture_uid: uid
      });
    }

    if (rows.length > 1) {
      return errResult(DOMAIN_CODES.FIP_IDENTITY_INCONSISTENT, {
        fixture_uid: uid,
        match_count: rows.length
      });
    }

    return okResult({ fixtureUid: uid });
  }

  async function resolveAndConfirm(scoutFixtureId) {
    const identity = await resolveScoutFixtureId(scoutFixtureId);
    if (!identity.ok) {
      return identity;
    }

    const lifecycle = await confirmLifecycleParent(identity.fixtureUid);
    if (!lifecycle.ok) {
      return lifecycle;
    }

    return okResult({
      fixtureUid: identity.fixtureUid,
      scoutFixtureId: identity.scoutFixtureId
    });
  }

  return {
    resolveScoutFixtureId,
    confirmLifecycleParent,
    resolveAndConfirm,
    ALIAS_NAMESPACE
  };
}

module.exports = {
  ALIAS_NAMESPACE,
  IDENTITY_SELECT_COLUMNS,
  LIFECYCLE_SELECT_COLUMNS,
  createFixtureIdentityResolver
};
