'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const governor = require('../backend/services/lifecycleGovernor');
const {
  DOMAIN_CODES,
  FORBIDDEN_PERSISTENCE_FIELDS,
  buildDisplayMetadataIdempotencyKey,
  createFixtureDisplayMetadataPersistenceService
} = require('../backend/services/fixtureDisplayMetadataPersistenceService');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql'
);

const FIXTURE_UID = '11111111-1111-4111-8111-111111111111';
const KICKOFF = new Date('2026-07-20T18:00:00.000Z');

function authorizedReader() {
  return {
    async readLifecycleGovernorGate() {
      return {
        unifiedLifecycleGovernor: 'APPROVED',
        scoutEdgeMarriageGate: 'BLOCKED',
        supabaseStorageGate: 'BLOCKED',
        source: 'EDGE_BUILD_CONTROL_LEDGER.v1.json'
      };
    }
  };
}

function blockedReader() {
  return {
    async readLifecycleGovernorGate() {
      return {
        unifiedLifecycleGovernor: 'BLOCKED',
        scoutEdgeMarriageGate: 'BLOCKED',
        supabaseStorageGate: 'BLOCKED',
        source: 'EDGE_BUILD_CONTROL_LEDGER.v1.json'
      };
    }
  };
}

function intakeDto(overrides = {}) {
  const fipId = overrides.fipId || 'fip-001';
  const fipValidationHash = overrides.fipValidationHash || 'hash-abc';
  const fipSchemaVersion = overrides.fipSchemaVersion || '1.0.0';
  const idempotencyKey =
    overrides.idempotencyKey ||
    buildDisplayMetadataIdempotencyKey({ fipId, fipValidationHash, fipSchemaVersion });

  return {
    fixtureUid: FIXTURE_UID,
    sport: 'football',
    scoutFixtureId: 'scout-fixture-1',
    fipId,
    fipSchemaVersion,
    fipValidationHash,
    intakeId: 'intake-001',
    homeTeamScoutId: 'team-home-scout',
    awayTeamScoutId: 'team-away-scout',
    competitionId: 'comp-1',
    competitionName: 'Premier League',
    kickoffAt: overrides.kickoffAt || KICKOFF,
    timezone: 'Africa/Johannesburg',
    homeTeamName: 'Home FC',
    awayTeamName: 'Away FC',
    venue: overrides.venue,
    country: overrides.country,
    homeTeamEmblemRef: overrides.homeTeamEmblemRef,
    awayTeamEmblemRef: overrides.awayTeamEmblemRef,
    metadataFreshAt: overrides.metadataFreshAt || new Date('2026-07-14T12:00:00.000Z'),
    idempotencyKey,
    ...overrides
  };
}

class MemoryDisplayMetadataStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.lifecycle = new Map();
    this.display = new Map();
    this.queryLog = [];
    this.failNext = null;
  }

  snapshot() {
    return {
      lifecycle: new Map(this.lifecycle),
      display: new Map(this.display)
    };
  }

  restore(snapshot) {
    this.lifecycle = snapshot.lifecycle;
    this.display = snapshot.display;
  }

  log(sql) {
    this.queryLog.push(String(sql).replace(/\s+/g, ' ').trim());
  }

  seedLifecycle(fixtureUid = FIXTURE_UID) {
    this.lifecycle.set(fixtureUid, { fixture_uid: fixtureUid });
  }

  async runQuery(sql, params = []) {
    this.log(sql);
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      throw err;
    }

    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (
      normalized.includes('FROM fixture_lifecycle_current') &&
      normalized.includes('WHERE fixture_uid')
    ) {
      const row = this.lifecycle.get(params[0]);
      return { rows: row ? [{ fixture_uid: row.fixture_uid }] : [], rowCount: row ? 1 : 0 };
    }

    if (
      normalized.includes('FROM fixture_display_metadata') &&
      normalized.includes('WHERE fixture_uid')
    ) {
      const row = this.display.get(params[0]);
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }

    if (normalized.startsWith('INSERT INTO fixture_display_metadata')) {
      if (this.display.has(params[0])) {
        const err = new Error('duplicate fixture');
        err.code = '23505';
        err.constraint = 'fixture_display_metadata_pkey';
        throw err;
      }
      const duplicateKey = [...this.display.values()].find(
        (r) => r.idempotency_key === params[7]
      );
      if (duplicateKey) {
        const err = new Error('duplicate idempotency');
        err.code = '23505';
        err.constraint = 'fixture_display_metadata_idempotency_unique';
        throw err;
      }
      this.display.set(params[0], {
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
        created_at: new Date(),
        updated_at: new Date()
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith('UPDATE fixture_display_metadata') && params.length === 20) {
      const row = this.display.get(params[0]);
      if (!row) {
        return { rows: [], rowCount: 0 };
      }
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
      row.updated_at = new Date();
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith('UPDATE fixture_display_metadata') && params.length === 3) {
      const row = this.display.get(params[0]);
      if (!row) {
        return { rows: [], rowCount: 0 };
      }
      row.lifecycle_closed_at = params[1];
      row.purge_eligible_at = params[2];
      row.updated_at = new Date();
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

function createMockDb(store) {
  const client = {
    async query(sql, params) {
      return store.runQuery(sql, params);
    }
  };

  return {
    store,
    client,
    calls: { withTransaction: 0, query: 0 },
    async withTransaction(fn) {
      this.calls.withTransaction += 1;
      const snapshot = store.snapshot();
      try {
        return await fn(client);
      } catch (err) {
        store.restore(snapshot);
        throw err;
      }
    },
    async query(sql, params) {
      this.calls.query += 1;
      return client.query(sql, params);
    }
  };
}

function createService(overrides = {}) {
  const store = overrides.store || new MemoryDisplayMetadataStore();
  if (overrides.seedLifecycle !== false) {
    store.seedLifecycle(overrides.fixtureUid || FIXTURE_UID);
  }
  const db = overrides.db || createMockDb(store);
  return {
    store,
    db,
    service: createFixtureDisplayMetadataPersistenceService({
      db,
      governor,
      gateReader: overrides.gateReader || authorizedReader(),
      featureFlagEnabled: overrides.featureFlagEnabled ?? true,
      clock: { now: () => overrides.now || new Date('2026-07-14T10:00:00.000Z') }
    })
  };
}

test('missing dependencies fail at factory creation', () => {
  assert.throws(
    () => createFixtureDisplayMetadataPersistenceService({}),
    /Missing required dependency: db/
  );
  assert.throws(
    () =>
      createFixtureDisplayMetadataPersistenceService({
        db: { withTransaction: async () => {}, query: async () => ({ rows: [] }) },
        gateReader: authorizedReader(),
        clock: { now: () => new Date() }
      }),
    /Missing required dependency: governor/
  );
});

test('blocked gate causes zero DB calls', async () => {
  const { db, service } = createService({ gateReader: blockedReader() });
  const result = await service.upsertFromValidatedIntake(intakeDto());
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.DISPLAY_METADATA_GATE_BLOCKED);
  assert.equal(db.calls.withTransaction, 0);
  assert.equal(db.calls.query, 0);
});

test('disabled feature causes zero DB calls', async () => {
  const { db, service } = createService({ featureFlagEnabled: false });
  const result = await service.upsertFromValidatedIntake(intakeDto());
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.DISPLAY_METADATA_FEATURE_DISABLED);
  assert.equal(db.calls.withTransaction, 0);
  assert.equal(db.calls.query, 0);
});

test('forbidden payload field causes zero DB calls', async () => {
  const { db, service } = createService();
  const dto = intakeDto({ fip_body: '{"forbidden":true}' });
  const result = await service.upsertFromValidatedIntake(dto);
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
  assert.equal(db.calls.withTransaction, 0);
  assert.ok(FORBIDDEN_PERSISTENCE_FIELDS.has('fip_body'));
});

test('invalid DTO causes zero DB calls', async () => {
  const { db, service } = createService();
  const result = await service.upsertFromValidatedIntake(intakeDto({ sport: 'cricket' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
  assert.equal(db.calls.withTransaction, 0);
});

test('deterministic SHA-256 idempotency key', () => {
  const key = buildDisplayMetadataIdempotencyKey({
    fipId: 'fip-1',
    fipValidationHash: 'hash-1',
    fipSchemaVersion: '1.0'
  });
  const expected = crypto
    .createHash('sha256')
    .update('fip-1|hash-1|1.0', 'utf8')
    .digest('hex');
  assert.equal(key, expected);
  assert.equal(key.length, 64);
});

test('mismatched supplied idempotency key rejects before DB', async () => {
  const { db, service } = createService();
  const result = await service.upsertFromValidatedIntake(
    intakeDto({ idempotencyKey: 'not-the-real-key' })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
  assert.equal(db.calls.withTransaction, 0);
});

test('missing lifecycle parent returns LIFECYCLE_MISSING', async () => {
  const store = new MemoryDisplayMetadataStore();
  const { service } = createService({ store, seedLifecycle: false });
  const result = await service.upsertFromValidatedIntake(intakeDto());
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.DISPLAY_METADATA_LIFECYCLE_MISSING);
});

test('first validated intake inserts', async () => {
  const { store, service } = createService();
  const result = await service.upsertFromValidatedIntake(intakeDto());
  assert.equal(result.ok, true);
  assert.equal(result.action, 'INSERT');
  assert.equal(store.display.size, 1);
  assert.equal(store.display.get(FIXTURE_UID).fixture_uid, FIXTURE_UID);
});

test('same idempotency key returns NO_OP', async () => {
  const { service } = createService();
  const dto = intakeDto();
  const first = await service.upsertFromValidatedIntake(dto);
  assert.equal(first.ok, true);
  const second = await service.upsertFromValidatedIntake(dto);
  assert.equal(second.ok, true);
  assert.equal(second.action, 'NO_OP');
});

test('same key with conflicting provenance rejects', async () => {
  const store = new MemoryDisplayMetadataStore();
  store.seedLifecycle();
  const dto = intakeDto();
  const key = buildDisplayMetadataIdempotencyKey({
    fipId: dto.fipId,
    fipValidationHash: dto.fipValidationHash,
    fipSchemaVersion: dto.fipSchemaVersion
  });
  store.display.set(FIXTURE_UID, {
    fixture_uid: FIXTURE_UID,
    sport: 'football',
    scout_fixture_id: 'scout-fixture-1',
    fip_id: 'corrupt-fip',
    fip_schema_version: dto.fipSchemaVersion,
    fip_validation_hash: dto.fipValidationHash,
    intake_id: 'intake-001',
    idempotency_key: key,
    home_team_scout_id: 'team-home-scout',
    away_team_scout_id: 'team-away-scout',
    competition_id: 'comp-1',
    competition_name: 'Premier League',
    kickoff_at: KICKOFF,
    timezone: 'Africa/Johannesburg',
    home_team_name: 'Home FC',
    away_team_name: 'Away FC',
    venue: null,
    country: null,
    home_team_emblem_ref: null,
    away_team_emblem_ref: null,
    metadata_fresh_at: new Date('2026-07-14T12:00:00.000Z')
  });
  const { service } = createService({ store });
  const conflict = await service.upsertFromValidatedIntake(dto);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, DOMAIN_CODES.DISPLAY_METADATA_PROVENANCE_CONFLICT);
});

test('newer metadata replaces display and provenance fields', async () => {
  const { store, service } = createService();
  await service.upsertFromValidatedIntake(intakeDto({ homeTeamName: 'Old Home' }));
  const newer = await service.upsertFromValidatedIntake(
    intakeDto({
      fipId: 'fip-002',
      fipValidationHash: 'hash-new',
      homeTeamName: 'New Home',
      metadataFreshAt: new Date('2026-07-15T12:00:00.000Z')
    })
  );
  assert.equal(newer.ok, true);
  assert.equal(newer.action, 'UPDATE');
  assert.equal(store.display.get(FIXTURE_UID).home_team_name, 'New Home');
  assert.equal(store.display.get(FIXTURE_UID).fip_id, 'fip-002');
});

test('equal or older metadata rejects as stale', async () => {
  const { service } = createService();
  const fresh = new Date('2026-07-15T12:00:00.000Z');
  await service.upsertFromValidatedIntake(intakeDto({ metadataFreshAt: fresh }));
  const equal = await service.upsertFromValidatedIntake(
    intakeDto({
      fipId: 'fip-002',
      fipValidationHash: 'hash-new',
      metadataFreshAt: fresh
    })
  );
  assert.equal(equal.ok, false);
  assert.equal(equal.code, DOMAIN_CODES.DISPLAY_METADATA_STALE_UPDATE);

  const older = await service.upsertFromValidatedIntake(
    intakeDto({
      fipId: 'fip-003',
      fipValidationHash: 'hash-older',
      metadataFreshAt: new Date('2026-07-14T12:00:00.000Z')
    })
  );
  assert.equal(older.ok, false);
  assert.equal(older.code, DOMAIN_CODES.DISPLAY_METADATA_STALE_UPDATE);
});

test('required identity remains tied to fixture_uid', async () => {
  const { store, service } = createService();
  await service.upsertFromValidatedIntake(intakeDto());
  await service.upsertFromValidatedIntake(
    intakeDto({
      fipId: 'fip-002',
      fipValidationHash: 'hash-new',
      metadataFreshAt: new Date('2026-07-16T12:00:00.000Z')
    })
  );
  assert.equal(store.display.size, 1);
  assert.equal(store.display.get(FIXTURE_UID).fixture_uid, FIXTURE_UID);
});

test('retention sync calculates exactly +30 days', async () => {
  const { store, service } = createService();
  await service.upsertFromValidatedIntake(intakeDto());
  const closedAt = new Date('2026-07-20T20:00:00.000Z');
  const result = await service.synchronizeRetentionFromLifecycle({
    fixtureUid: FIXTURE_UID,
    lifecycleClosedAt: closedAt
  });
  assert.equal(result.ok, true);
  const row = store.display.get(FIXTURE_UID);
  assert.equal(row.lifecycle_closed_at.getTime(), closedAt.getTime());
  const expectedPurge = closedAt.getTime() + 30 * 24 * 60 * 60 * 1000;
  assert.equal(row.purge_eligible_at.getTime(), expectedPurge);
});

test('invalid retention timestamp rejects null closure', async () => {
  const { service } = createService();
  await service.upsertFromValidatedIntake(intakeDto());
  const result = await service.synchronizeRetentionFromLifecycle({
    fixtureUid: FIXTURE_UID,
    lifecycleClosedAt: null
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
});

test('unknown fixture read returns NOT_FOUND', async () => {
  const { service } = createService();
  const result = await service.getByFixtureUid('22222222-2222-4222-8222-222222222222');
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.DISPLAY_METADATA_NOT_FOUND);
});

test('database errors map to governed domain codes', async () => {
  const store = new MemoryDisplayMetadataStore();
  store.seedLifecycle();
  store.failNext = Object.assign(new Error('db down'), { code: 'ECONNREFUSED' });
  const { service } = createService({ store });
  const result = await service.upsertFromValidatedIntake(intakeDto());
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.DISPLAY_METADATA_PERSISTENCE_UNAVAILABLE);
});

test('upsert transaction query count stays within I4 bound', async () => {
  const store = new MemoryDisplayMetadataStore();
  store.seedLifecycle();
  const { service } = createService({ store });
  store.queryLog = [];
  await service.upsertFromValidatedIntake(intakeDto());
  const transactionalQueries = store.queryLog.length;
  assert.ok(transactionalQueries <= 4, `expected <=4 queries, got ${transactionalQueries}`);
  assert.ok(!store.queryLog.some((q) => /\bSELECT \*/i.test(q)));
});

test('migration SQL creates only fixture_display_metadata with FK CASCADE checks indexes RLS', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.fixture_display_metadata/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(sql, /REFERENCES public\.fixture_lifecycle_current/);
  assert.match(sql, /CHECK \(sport = 'football'\)/);
  assert.match(sql, /CHECK \(timezone = 'Africa\/Johannesburg'\)/);
  assert.match(sql, /UNIQUE \(idempotency_key\)/);
  assert.match(sql, /idx_fixture_display_metadata_purge/);
  assert.match(sql, /idx_fixture_display_metadata_kickoff/);
  assert.match(sql, /idx_fixture_display_metadata_competition/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /DROP TABLE IF EXISTS public\.fixture_display_metadata/);
  assert.doesNotMatch(sql, /CREATE POLICY/i);
  assert.doesNotMatch(sql, /JSONB/i);
  assert.doesNotMatch(sql, /fip_body/i);
  const createTables = sql.match(/CREATE TABLE/g) || [];
  assert.equal(createTables.length, 1);
});

test('migration remains unapplied in repository closure', () => {
  assert.ok(fs.existsSync(MIGRATION_PATH));
  const packetNote = 'AUTHOR ONLY — NOT APPLIED';
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  assert.match(sql, /NOT APPLIED/i);
  assert.ok(packetNote);
});
