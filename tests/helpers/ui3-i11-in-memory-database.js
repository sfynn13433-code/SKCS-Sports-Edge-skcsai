'use strict';

function cloneValue(value) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)])
    );
  }

  return value;
}

function toSerializable(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toSerializable(item)])
    );
  }

  return value;
}

function normalizeSql(sql) {
  return String(sql || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function createInMemoryDatabase({
  fixtureUid,
  scoutFixtureId,
  now = '2026-07-15T10:00:00.000Z'
}) {
  if (!fixtureUid || !scoutFixtureId) {
    throw new TypeError('fixtureUid and scoutFixtureId are required.');
  }

  const state = {
    fixtureIdentityAliases: [
      {
        alias_namespace: 'scout_fixture_id',
        alias_value: scoutFixtureId,
        fixture_uid: fixtureUid
      }
    ],
    fixtureLifecycleCurrent: [
      {
        fixture_uid: fixtureUid
      }
    ],
    fixtureDisplayMetadata: [],
    fipIntakeEvidence: [],
    queryLog: [],
    transactionCount: 0,
    committedTransactionCount: 0,
    rolledBackTransactionCount: 0,
    externalConnectionCount: 0,
    nextEvidenceId: 1
  };

  const writeCounts = {
    fixtureDisplayMetadata: 0,
    fipIntakeEvidence: 0
  };

  function result(rows = [], rowCount = rows.length) {
    return {
      rows: cloneValue(rows),
      rowCount
    };
  }

  function recordQuery(sql, params) {
    state.queryLog.push({
      sql: normalizeSql(sql),
      params: toSerializable(params || [])
    });
  }

  function findMetadataByFixtureUid(uid) {
    return state.fixtureDisplayMetadata.filter(
      (row) => row.fixture_uid === uid
    );
  }

  function findAcceptedEvidenceByIdempotencyKey(key) {
    return state.fipIntakeEvidence.filter(
      (row) =>
        row.idempotency_key === key &&
        row.outcome === 'ACCEPTED'
    );
  }

  function buildMetadataInsertRow(params) {
    return {
      fixture_uid: params[0],
      sport: params[1],
      scout_fixture_id: params[2],
      fip_id: params[3],
      fip_schema_version: params[4],
      fip_validation_hash: params[5],
      intake_id: params[6],
      idempotency_key: params[7],
      home_team_scout_id: params[8],
      away_team_scout_id: params[9],
      competition_id: params[10],
      competition_name: params[11],
      kickoff_at: params[12],
      timezone: params[13],
      home_team_name: params[14],
      away_team_name: params[15],
      venue: params[16],
      country: params[17],
      home_team_emblem_ref: params[18],
      away_team_emblem_ref: params[19],
      metadata_fresh_at: params[20],
      lifecycle_closed_at: null,
      purge_eligible_at: null,
      created_at: new Date(now),
      updated_at: new Date(now)
    };
  }

  function applyMetadataUpdate(row, params) {
    row.scout_fixture_id = params[1];
    row.fip_id = params[2];
    row.fip_schema_version = params[3];
    row.fip_validation_hash = params[4];
    row.intake_id = params[5];
    row.idempotency_key = params[6];
    row.home_team_scout_id = params[7];
    row.away_team_scout_id = params[8];
    row.competition_id = params[9];
    row.competition_name = params[10];
    row.kickoff_at = params[11];
    row.timezone = params[12];
    row.home_team_name = params[13];
    row.away_team_name = params[14];
    row.venue = params[15];
    row.country = params[16];
    row.home_team_emblem_ref = params[17];
    row.away_team_emblem_ref = params[18];
    row.metadata_fresh_at = params[19];
    row.updated_at = new Date(now);
  }

  function buildEvidenceInsertRow(params) {
    const suffix = String(state.nextEvidenceId).padStart(12, '0');
    const evidenceId = `00000000-0000-4000-8000-${suffix}`;
    state.nextEvidenceId += 1;

    return {
      evidence_id: evidenceId,
      intake_id: params[0],
      fip_id: params[1],
      fip_schema_version: params[2],
      fip_validation_hash: params[3],
      scout_fixture_id: params[4],
      fixture_uid: params[5],
      scout_run_id: params[6],
      received_at: params[7],
      validated_at: params[8],
      outcome: params[9],
      rejection_code: params[10],
      governed_mode: params[11],
      caller_identity_ref: params[12],
      idempotency_key: params[13],
      recorded_at: params[14],
      purge_eligible_at: params[15]
    };
  }

  async function query(sql, params = []) {
    const normalized = normalizeSql(sql);
    recordQuery(sql, params);

    if (
      normalized.startsWith('select') &&
      normalized.includes('from fixture_identity_aliases')
    ) {
      const [namespace, aliasValue] = params;
      const rows = state.fixtureIdentityAliases.filter(
        (row) =>
          row.alias_namespace === namespace &&
          row.alias_value === aliasValue
      );
      return result(rows.map((row) => ({ fixture_uid: row.fixture_uid })));
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from fixture_lifecycle_current')
    ) {
      const [uid] = params;
      const rows = state.fixtureLifecycleCurrent.filter(
        (row) => row.fixture_uid === uid
      );
      return result(rows.map((row) => ({ fixture_uid: row.fixture_uid })));
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from fixture_display_metadata')
    ) {
      const [uid] = params;
      return result(findMetadataByFixtureUid(uid));
    }

    if (normalized.startsWith('insert into fixture_display_metadata')) {
      const row = buildMetadataInsertRow(params);
      state.fixtureDisplayMetadata.push(row);
      writeCounts.fixtureDisplayMetadata += 1;
      return result([], 1);
    }

    if (normalized.startsWith('update fixture_display_metadata')) {
      const [uid] = params;
      const rows = findMetadataByFixtureUid(uid);
      if (rows.length !== 1) {
        return result([], 0);
      }

      applyMetadataUpdate(rows[0], params);
      writeCounts.fixtureDisplayMetadata += 1;
      return result([], 1);
    }

    if (normalized.startsWith('insert into fip_intake_evidence')) {
      const incomingOutcome = params[9];
      const incomingKey = params[13];
      if (
        incomingOutcome === 'ACCEPTED' &&
        findAcceptedEvidenceByIdempotencyKey(incomingKey).length > 0
      ) {
        const error = new Error('accepted evidence idempotency duplicate');
        error.code = '23505';
        error.constraint = 'fip_intake_evidence_accepted_idempotency_unique';
        throw error;
      }

      const row = buildEvidenceInsertRow(params);
      state.fipIntakeEvidence.push(row);
      writeCounts.fipIntakeEvidence += 1;
      return result([{ evidence_id: row.evidence_id }], 1);
    }

    if (
      normalized.startsWith('select') &&
      normalized.includes('from fip_intake_evidence') &&
      normalized.includes("outcome = 'accepted'")
    ) {
      const [key] = params;
      return result(findAcceptedEvidenceByIdempotencyKey(key));
    }

    throw new Error(`Unhandled in-memory SQL: ${normalized}`);
  }

  async function withTransaction(work) {
    state.transactionCount += 1;

    const snapshot = {
      fixtureDisplayMetadata: cloneValue(state.fixtureDisplayMetadata),
      fipIntakeEvidence: cloneValue(state.fipIntakeEvidence),
      nextEvidenceId: state.nextEvidenceId,
      metadataWriteCount: writeCounts.fixtureDisplayMetadata,
      evidenceWriteCount: writeCounts.fipIntakeEvidence
    };

    try {
      const value = await work({ query });
      state.committedTransactionCount += 1;
      return value;
    } catch (error) {
      state.fixtureDisplayMetadata = snapshot.fixtureDisplayMetadata;
      state.fipIntakeEvidence = snapshot.fipIntakeEvidence;
      state.nextEvidenceId = snapshot.nextEvidenceId;
      writeCounts.fixtureDisplayMetadata = snapshot.metadataWriteCount;
      writeCounts.fipIntakeEvidence = snapshot.evidenceWriteCount;
      state.rolledBackTransactionCount += 1;
      throw error;
    }
  }

  function getTableCounts() {
    return {
      fixture_identity_aliases: state.fixtureIdentityAliases.length,
      fixture_lifecycle_current: state.fixtureLifecycleCurrent.length,
      fixture_display_metadata: state.fixtureDisplayMetadata.length,
      fip_intake_evidence: state.fipIntakeEvidence.length
    };
  }

  function getWriteCounts() {
    return {
      fixture_display_metadata: writeCounts.fixtureDisplayMetadata,
      fip_intake_evidence: writeCounts.fipIntakeEvidence
    };
  }

  function snapshot() {
    return toSerializable({
      tables: {
        fixture_identity_aliases: state.fixtureIdentityAliases,
        fixture_lifecycle_current: state.fixtureLifecycleCurrent,
        fixture_display_metadata: state.fixtureDisplayMetadata,
        fip_intake_evidence: state.fipIntakeEvidence
      },
      tableCounts: getTableCounts(),
      writeCounts: getWriteCounts(),
      transactionCount: state.transactionCount,
      committedTransactionCount: state.committedTransactionCount,
      rolledBackTransactionCount: state.rolledBackTransactionCount,
      externalConnectionCount: state.externalConnectionCount,
      queryCount: state.queryLog.length,
      queryLog: state.queryLog
    });
  }

  return {
    query,
    withTransaction,
    getTableCounts,
    getWriteCounts,
    snapshot
  };
}

module.exports = {
  createInMemoryDatabase,
  normalizeSql,
  cloneValue,
  toSerializable
};
