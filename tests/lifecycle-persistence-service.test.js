'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const governor = require('../backend/services/lifecycleGovernor');
const {
  DOMAIN_CODES,
  createLifecyclePersistenceService,
  buildAdmissionIdempotencyKey
} = require('../backend/services/lifecyclePersistenceService');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20261008000001_sem_gov_001b_lifecycle_persistence.sql'
);

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

function futureKickoff(evaluationTime) {
  return new Date(evaluationTime.getTime() + 2 * 60 * 60 * 1000);
}

function admissionInput(overrides = {}) {
  const evaluationTime = overrides.evaluationTime || new Date('2026-07-14T10:00:00.000Z');
  return {
    sport: 'football',
    kickoffAt: overrides.kickoffAt || futureKickoff(evaluationTime),
    evaluationTime,
    aliasNamespace: overrides.aliasNamespace || 'fip_id',
    aliasValue: overrides.aliasValue || `fip-${crypto.randomUUID()}`,
    sourceSystem: 'scout',
    sourceActor: 'governor',
    reasonCategory: 'APPROVED',
    ...overrides
  };
}

class MemoryLifecycleStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.current = new Map();
    this.aliases = new Map();
    this.events = [];
    this.idempotency = new Map();
    this.counters = new Map();
    this.rollovers = new Map();
    this.queryLog = [];
    this.failNext = null;
  }

  snapshot() {
    return {
      current: new Map(this.current),
      aliases: new Map(this.aliases),
      events: [...this.events],
      idempotency: new Map(this.idempotency),
      counters: new Map(
        [...this.counters.entries()].map(([key, value]) => [key, { ...value }])
      ),
      rollovers: new Map(this.rollovers)
    };
  }

  restore(snapshot) {
    this.current = snapshot.current;
    this.aliases = snapshot.aliases;
    this.events = snapshot.events;
    this.idempotency = snapshot.idempotency;
    this.counters = snapshot.counters;
    this.rollovers = snapshot.rollovers;
  }

  log(sql) {
    this.queryLog.push(String(sql).replace(/\s+/g, ' ').trim());
  }

  aliasKey(namespace, value) {
    return `${namespace}::${value}`;
  }

  async runQuery(sql, params = []) {
    this.log(sql);
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      throw err;
    }

    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('SELECT fixture_uid FROM fixture_identity_aliases')) {
      const key = this.aliasKey(params[0], params[1]);
      const row = this.aliases.get(key);
      return { rows: row ? [{ fixture_uid: row.fixture_uid }] : [], rowCount: row ? 1 : 0 };
    }

    if (normalized.startsWith('SELECT admission_idempotency_key')) {
      const row = this.idempotency.get(params[0]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    if (normalized.startsWith('INSERT INTO lifecycle_daily_admission_counters')) {
      const date = params[0];
      if (!this.counters.has(date)) {
        this.counters.set(date, {
          admission_date_sast: date,
          admitted_count: 0,
          ceiling: params[1],
          transition_version: 1
        });
      }
      return { rows: [], rowCount: 0 };
    }

    if (normalized.includes('FROM lifecycle_daily_admission_counters') && normalized.includes('FOR UPDATE')) {
      const row = this.counters.get(params[0]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    if (normalized.startsWith('UPDATE lifecycle_daily_admission_counters')) {
      const row = this.counters.get(params[0]);
      if (!row || row.admitted_count >= row.ceiling) {
        return { rows: [], rowCount: 0 };
      }
      row.admitted_count += 1;
      row.transition_version += 1;
      row.last_fixture_uid = params[1];
      row.last_idempotency_key = params[2];
      return { rows: [{ admitted_count: row.admitted_count, ceiling: row.ceiling }], rowCount: 1 };
    }

    if (normalized.startsWith('INSERT INTO fixture_lifecycle_current')) {
      this.current.set(params[0], {
        fixture_uid: params[0],
        sport: params[1],
        lifecycle_state: params[2],
        lifecycle_stage: params[3],
        day_label: params[4],
        kickoff_at: params[5],
        engine_stage: params[6],
        publication_eligible: params[7],
        hold_category: params[8],
        elimination_category: params[9],
        evidence_fresh_at: params[10],
        scout_fip_id: params[11],
        scout_validation_hash: params[12],
        transition_version: params[13],
        archive_closed_at: params[14]
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith('INSERT INTO fixture_identity_aliases')) {
      const key = this.aliasKey(params[1], params[2]);
      if (this.aliases.has(key)) {
        const err = new Error('duplicate alias');
        err.code = '23505';
        err.constraint = 'fixture_identity_aliases_unique_ns_value';
        throw err;
      }
      this.aliases.set(key, { fixture_uid: params[0] });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith('INSERT INTO fixture_lifecycle_transition_events')) {
      const fixtureUid = params[1];
      const idempotencyKey = params[13];
      const duplicate = this.events.find(
        (e) => e.fixture_uid === fixtureUid && e.idempotency_key === idempotencyKey
      );
      if (duplicate) {
        const err = new Error('duplicate event');
        err.code = '23505';
        err.constraint = 'fixture_lifecycle_transition_events_idempotency_uniq';
        throw err;
      }
      const eventId = crypto.randomUUID();
      this.events.push({
        event_id: eventId,
        fixture_uid: fixtureUid,
        transition_version: params[2],
        idempotency_key: idempotencyKey
      });
      return { rows: [{ event_id: eventId }], rowCount: 1 };
    }

    if (normalized.startsWith('INSERT INTO lifecycle_admission_idempotency')) {
      if (this.idempotency.has(params[0])) {
        const err = new Error('duplicate idempotency');
        err.code = '23505';
        err.constraint = 'lifecycle_admission_idempotency_pkey';
        throw err;
      }
      this.idempotency.set(params[0], {
        admission_idempotency_key: params[0],
        fixture_uid: params[1],
        admission_date_sast: params[2],
        outcome: params[3]
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith('SELECT fixture_uid, sport, lifecycle_state')) {
      const row = this.current.get(params[0]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    if (normalized.startsWith('UPDATE fixture_lifecycle_current')) {
      const row = this.current.get(params[0]);
      if (!row || Number(row.transition_version) !== Number(params[14])) {
        return { rows: [], rowCount: 0 };
      }
      row.lifecycle_state = params[2];
      row.lifecycle_stage = params[3];
      row.day_label = params[4];
      row.transition_version = Number(row.transition_version) + 1;
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith('INSERT INTO fixture_lifecycle_rollover_events')) {
      if (this.rollovers.has(params[1])) {
        const err = new Error('duplicate rollover');
        err.code = '23505';
        err.constraint = 'fixture_lifecycle_rollover_events_rollover_key';
        throw err;
      }
      const rolloverId = crypto.randomUUID();
      this.rollovers.set(params[1], { rollover_id: rolloverId, rollover_key: params[1] });
      return { rows: [{ rollover_id: rolloverId }], rowCount: 1 };
    }

    if (normalized.startsWith('SELECT rollover_id, rollover_key')) {
      const rows = [...this.rollovers.values()].sort((a, b) => (a.rollover_key < b.rollover_key ? 1 : -1));
      return { rows: rows.slice(0, 1), rowCount: rows.length ? 1 : 0 };
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
  const store = overrides.store || new MemoryLifecycleStore();
  const db = overrides.db || createMockDb(store);
  return {
    store,
    db,
    service: createLifecyclePersistenceService({
      db,
      governor,
      gateReader: overrides.gateReader || authorizedReader(),
      featureFlagEnabled: overrides.featureFlagEnabled ?? true,
      uuidGenerator: { v4: () => overrides.uuid || crypto.randomUUID() },
      clock: { now: () => overrides.now || new Date('2026-07-14T10:00:00.000Z') },
      admissionCeiling: overrides.admissionCeiling
    })
  };
}

test('blocked gate causes zero withTransaction calls', async () => {
  const { db, service } = createService({ gateReader: blockedReader() });
  const result = await service.admitFixture(admissionInput());
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.LIFECYCLE_GATE_BLOCKED);
  assert.equal(db.calls.withTransaction, 0);
  assert.equal(db.calls.query, 0);
});

test('feature disabled causes zero DB calls', async () => {
  const { db, service } = createService({ featureFlagEnabled: false });
  const result = await service.admitFixture(admissionInput());
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.LIFECYCLE_FEATURE_DISABLED);
  assert.equal(db.calls.withTransaction, 0);
});

test('unsupported sport causes zero DB calls', async () => {
  const { db, service } = createService();
  const result = await service.admitFixture(admissionInput({ sport: 'cricket' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.SPORT_NOT_ACTIVE);
  assert.equal(db.calls.withTransaction, 0);
});

test('invalid admission window causes zero DB calls', async () => {
  const evaluationTime = new Date('2026-07-14T10:00:00.000Z');
  const { db, service } = createService({ now: evaluationTime });
  const result = await service.admitFixture(
    admissionInput({
      evaluationTime,
      kickoffAt: new Date('2026-08-01T10:00:00.000Z')
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.FIXTURE_OUTSIDE_ADMISSION_WINDOW);
  assert.equal(db.calls.withTransaction, 0);
});

test('first admission writes fixture and increments counter once', async () => {
  const fixedUuid = '11111111-1111-4111-8111-111111111111';
  const { store, service } = createService({ uuid: fixedUuid });
  const result = await service.admitFixture(admissionInput({ aliasValue: 'fip-001' }));
  assert.equal(result.ok, true);
  assert.equal(result.fixtureUid, fixedUuid);
  assert.equal(result.reused, false);
  assert.equal(result.admittedCount, 1);
  assert.equal(store.current.size, 1);
  assert.equal(store.idempotency.size, 1);
  const date = governor.formatSastDateKey(new Date('2026-07-14T10:00:00.000Z'));
  assert.equal(store.counters.get(date).admitted_count, 1);
});

test('existing alias returns fixture without counter increment', async () => {
  const { store, service } = createService();
  const first = await service.admitFixture(admissionInput({ aliasValue: 'fip-same' }));
  assert.equal(first.ok, true);
  const before = store.counters.values().next().value.admitted_count;
  const second = await service.admitFixture(admissionInput({ aliasValue: 'fip-same' }));
  assert.equal(second.ok, true);
  assert.equal(second.reused, true);
  assert.equal(second.fixtureUid, first.fixtureUid);
  const after = store.counters.values().next().value.admitted_count;
  assert.equal(after, before);
});

test('duplicate idempotency returns prior fixture without increment', async () => {
  const { store, service } = createService();
  const input = admissionInput({ aliasValue: 'fip-dup' });
  const first = await service.admitFixture(input);
  assert.equal(first.ok, true);
  store.aliases.delete(store.aliasKey(input.aliasNamespace, input.aliasValue));
  const before = store.counters.values().next().value.admitted_count;
  const second = await service.admitFixture(input);
  assert.equal(second.ok, true);
  assert.equal(second.reused, true);
  assert.equal(second.fixtureUid, first.fixtureUid);
  assert.equal(store.counters.values().next().value.admitted_count, before);
});

test('alternate alias for existing fixture consumes no slot', async () => {
  const fixtureUid = '22222222-2222-4222-8222-222222222222';
  const { store, service } = createService({ uuid: fixtureUid });
  const first = await service.admitFixture(admissionInput({ aliasNamespace: 'fip_id', aliasValue: 'a1' }));
  assert.equal(first.ok, true);
  store.aliases.set(store.aliasKey('scout_fixture_id', 'a2'), { fixture_uid: fixtureUid });
  const before = store.counters.values().next().value.admitted_count;
  const second = await service.admitFixture(
    admissionInput({ aliasNamespace: 'scout_fixture_id', aliasValue: 'a2' })
  );
  assert.equal(second.ok, true);
  assert.equal(second.reused, true);
  assert.equal(store.counters.values().next().value.admitted_count, before);
});

test('alias conflict rolls back via domain code', async () => {
  const store = new MemoryLifecycleStore();
  const db = createMockDb(store);
  const original = store.runQuery.bind(store);
  store.runQuery = async (sql, params) => {
    if (String(sql).includes('INSERT INTO fixture_identity_aliases')) {
      const err = new Error('duplicate alias');
      err.code = '23505';
      err.constraint = 'fixture_identity_aliases_unique_ns_value';
      throw err;
    }
    return original(sql, params);
  };
  const { service } = createService({ store, db });
  const result = await service.admitFixture(admissionInput({ aliasValue: 'conflict' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.FIXTURE_ALIAS_CONFLICT);
  assert.equal(store.current.size, 0);
  assert.equal(store.counters.size, 0);
});

test('failed current insert consumes no slot', async () => {
  const store = new MemoryLifecycleStore();
  const db = createMockDb(store);
  const original = store.runQuery.bind(store);
  store.runQuery = async (sql, params) => {
    if (String(sql).includes('INSERT INTO fixture_lifecycle_current')) {
      throw new Error('insert failed');
    }
    return original(sql, params);
  };
  const { service } = createService({ store, db });
  const result = await service.admitFixture(admissionInput({ aliasValue: 'fail-current' }));
  assert.equal(result.ok, false);
  assert.equal(store.counters.size, 0);
});

test('failed transition insert consumes no slot', async () => {
  const store = new MemoryLifecycleStore();
  const db = createMockDb(store);
  const original = store.runQuery.bind(store);
  store.runQuery = async (sql, params) => {
    if (String(sql).includes('INSERT INTO fixture_lifecycle_transition_events')) {
      throw new Error('event failed');
    }
    return original(sql, params);
  };
  const { service } = createService({ store, db });
  const result = await service.admitFixture(admissionInput({ aliasValue: 'fail-event' }));
  assert.equal(result.ok, false);
  assert.equal(store.current.size, 0);
});

test('failed idempotency insert consumes no slot', async () => {
  const store = new MemoryLifecycleStore();
  const db = createMockDb(store);
  const original = store.runQuery.bind(store);
  store.runQuery = async (sql, params) => {
    if (String(sql).includes('INSERT INTO lifecycle_admission_idempotency')) {
      throw new Error('idem failed');
    }
    return original(sql, params);
  };
  const { service } = createService({ store, db });
  const result = await service.admitFixture(admissionInput({ aliasValue: 'fail-idem' }));
  assert.equal(result.ok, false);
  assert.equal(store.current.size, 0);
});

test('failed counter increment rolls back admission writes', async () => {
  const store = new MemoryLifecycleStore();
  const db = createMockDb(store);
  const original = store.runQuery.bind(store);
  store.runQuery = async (sql, params) => {
    if (String(sql).startsWith('UPDATE lifecycle_daily_admission_counters')) {
      return { rows: [], rowCount: 0 };
    }
    return original(sql, params);
  };
  const { service } = createService({ store, db });
  const result = await service.admitFixture(admissionInput({ aliasValue: 'fail-counter' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.DAILY_ADMISSION_CAP_REACHED);
});

test('admission 50 succeeds and 51 fails', async () => {
  const store = new MemoryLifecycleStore();
  const date = governor.formatSastDateKey(new Date('2026-07-14T10:00:00.000Z'));
  store.counters.set(date, { admission_date_sast: date, admitted_count: 49, ceiling: 50, transition_version: 1 });
  const { service } = createService({ store });
  const fiftieth = await service.admitFixture(admissionInput({ aliasValue: 'cap-50' }));
  assert.equal(fiftieth.ok, true);
  assert.equal(fiftieth.admittedCount, 50);
  const fiftyFirst = await service.admitFixture(admissionInput({ aliasValue: 'cap-51' }));
  assert.equal(fiftyFirst.ok, false);
  assert.equal(fiftyFirst.code, DOMAIN_CODES.DAILY_ADMISSION_CAP_REACHED);
});

test('new SAST date uses separate counter row', async () => {
  const store = new MemoryLifecycleStore();
  const { service } = createService({ store });
  const day1 = await service.admitFixture(
    admissionInput({
      evaluationTime: new Date('2026-07-14T10:00:00.000Z'),
      aliasValue: 'day1'
    })
  );
  assert.equal(day1.ok, true);
  const day2 = await service.admitFixture(
    admissionInput({
      evaluationTime: new Date('2026-07-15T10:00:00.000Z'),
      aliasValue: 'day2'
    })
  );
  assert.equal(day2.ok, true);
  assert.equal(store.counters.size, 2);
});

test('counter state unavailable fails closed', async () => {
  const store = new MemoryLifecycleStore();
  const db = createMockDb(store);
  const original = store.runQuery.bind(store);
  store.runQuery = async (sql, params) => {
    if (String(sql).includes('FOR UPDATE')) {
      return { rows: [], rowCount: 0 };
    }
    return original(sql, params);
  };
  const { service } = createService({ store, db });
  const result = await service.admitFixture(admissionInput({ aliasValue: 'no-counter' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.ADMISSION_CAP_STATE_UNAVAILABLE);
});

test('ceiling above 50 rejected at service construction', () => {
  assert.throws(
    () =>
      createLifecyclePersistenceService({
        db: { withTransaction: async () => {} },
        governor,
        gateReader: authorizedReader(),
        featureFlagEnabled: true,
        uuidGenerator: { v4: () => crypto.randomUUID() },
        clock: { now: () => new Date() },
        admissionCeiling: 51
      }),
    /ADMISSION_CEILING_INVALID/
  );
});

test('sequential admissions cannot exceed ceiling under mocked counter state', async () => {
  const store = new MemoryLifecycleStore();
  const date = governor.formatSastDateKey(new Date('2026-07-14T10:00:00.000Z'));
  store.counters.set(date, {
    admission_date_sast: date,
    admitted_count: 48,
    ceiling: 50,
    transition_version: 1
  });
  const { service } = createService({ store });
  const fortyNinth = await service.admitFixture(admissionInput({ aliasValue: 'seq-49' }));
  const fiftieth = await service.admitFixture(admissionInput({ aliasValue: 'seq-50' }));
  const fiftyFirst = await service.admitFixture(admissionInput({ aliasValue: 'seq-51' }));
  assert.equal(fortyNinth.ok, true);
  assert.equal(fiftieth.ok, true);
  assert.equal(fiftyFirst.ok, false);
  assert.equal(fiftyFirst.code, DOMAIN_CODES.DAILY_ADMISSION_CAP_REACHED);
  assert.equal(store.counters.get(date).admitted_count, 50);
});

test('applyTransition commits event and projection atomically', async () => {
  const fixtureUid = '33333333-3333-4333-8333-333333333333';
  const store = new MemoryLifecycleStore();
  store.current.set(fixtureUid, {
    fixture_uid: fixtureUid,
    sport: 'football',
    lifecycle_state: 'VISIBLE',
    lifecycle_stage: 'ADMITTED',
    day_label: 'TODAY',
    kickoff_at: new Date('2026-07-15T12:00:00.000Z'),
    engine_stage: null,
    publication_eligible: false,
    hold_category: null,
    elimination_category: null,
    evidence_fresh_at: null,
    scout_fip_id: null,
    scout_validation_hash: null,
    transition_version: 1,
    archive_closed_at: null
  });
  const { service } = createService({ store });
  const result = await service.applyTransition({
    fixtureUid,
    requested: {
      to_state: 'UNDER_REVIEW',
      to_stage: 'EVIDENCE_REVIEW',
      reason_category: 'APPROVED',
      source_actor: 'governor'
    }
  });
  assert.equal(result.ok, true);
  assert.equal(store.events.length, 1);
  assert.equal(store.current.get(fixtureUid).lifecycle_state, 'UNDER_REVIEW');
  assert.equal(store.current.get(fixtureUid).transition_version, 2);
});

test('duplicate transition event maps to LIFECYCLE_DUPLICATE_EVENT', async () => {
  const fixtureUid = '44444444-4444-4444-8444-444444444444';
  const evaluationTime = new Date('2026-07-14T12:00:00.000Z');
  const event = governor.buildTransitionEvent({
    fixtureUid,
    transitionVersion: 2,
    fromState: 'VISIBLE',
    toState: 'UNDER_REVIEW',
    fromStage: 'ADMITTED',
    toStage: 'EVIDENCE_REVIEW',
    reasonCategory: 'APPROVED',
    sourceActor: 'governor',
    occurredAt: evaluationTime
  });
  const { store, db, service } = createService();
  const first = await service.appendTransitionEvent(db.client, { event });
  assert.equal(first.ok, true);
  const duplicate = await service.appendTransitionEvent(db.client, { event });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, DOMAIN_CODES.LIFECYCLE_DUPLICATE_EVENT);
});

test('stale version maps to LIFECYCLE_STALE_VERSION', async () => {
  const fixtureUid = '55555555-5555-4555-8555-555555555555';
  const store = new MemoryLifecycleStore();
  store.current.set(fixtureUid, {
    fixture_uid: fixtureUid,
    sport: 'football',
    lifecycle_state: 'VISIBLE',
    lifecycle_stage: 'ADMITTED',
    day_label: 'TODAY',
    kickoff_at: new Date('2026-07-15T12:00:00.000Z'),
    engine_stage: null,
    publication_eligible: false,
    hold_category: null,
    elimination_category: null,
    evidence_fresh_at: null,
    scout_fip_id: null,
    scout_validation_hash: null,
    transition_version: 1,
    archive_closed_at: null
  });
  const db = createMockDb(store);
  const original = store.runQuery.bind(store);
  store.runQuery = async (sql, params) => {
    if (String(sql).startsWith('UPDATE fixture_lifecycle_current')) {
      return { rows: [], rowCount: 0 };
    }
    return original(sql, params);
  };
  const { service } = createService({ store, db });
  const result = await service.applyTransition({
    fixtureUid,
    requested: {
      to_state: 'UNDER_REVIEW',
      reason_category: 'APPROVED',
      source_actor: 'governor'
    }
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.LIFECYCLE_STALE_VERSION);
});

test('failed projection update rolls back with no partial state from service response', async () => {
  const fixtureUid = '66666666-6666-4666-8666-666666666666';
  const store = new MemoryLifecycleStore();
  store.current.set(fixtureUid, {
    fixture_uid: fixtureUid,
    sport: 'football',
    lifecycle_state: 'VISIBLE',
    lifecycle_stage: 'ADMITTED',
    day_label: 'TODAY',
    kickoff_at: new Date('2026-07-15T12:00:00.000Z'),
    engine_stage: null,
    publication_eligible: false,
    hold_category: null,
    elimination_category: null,
    evidence_fresh_at: null,
    scout_fip_id: null,
    scout_validation_hash: null,
    transition_version: 1,
    archive_closed_at: null
  });
  const db = createMockDb(store);
  const original = store.runQuery.bind(store);
  store.runQuery = async (sql, params) => {
    if (String(sql).startsWith('UPDATE fixture_lifecycle_current')) {
      return { rows: [], rowCount: 0 };
    }
    return original(sql, params);
  };
  const { service } = createService({ store, db });
  const result = await service.applyTransition({
    fixtureUid,
    requested: {
      to_state: 'UNDER_REVIEW',
      reason_category: 'APPROVED',
      source_actor: 'governor'
    }
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.LIFECYCLE_STALE_VERSION);
  assert.equal(store.events.length, 0);
  assert.equal(store.current.get(fixtureUid).lifecycle_state, 'VISIBLE');
});

test('fixture_uid remains immutable across alias reuse', async () => {
  const uid = '77777777-7777-4777-8777-777777777777';
  const { service } = createService({ uuid: uid });
  const first = await service.admitFixture(admissionInput({ aliasValue: 'immutable-1' }));
  const second = await service.admitFixture(admissionInput({ aliasValue: 'immutable-1' }));
  assert.equal(first.fixtureUid, uid);
  assert.equal(second.fixtureUid, uid);
});

test('raw FIP body field rejected before DB', async () => {
  const { db, service } = createService();
  const result = await service.admitFixture(admissionInput({ fip_body: { huge: true } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.LIFECYCLE_INPUT_INVALID);
  assert.equal(db.calls.withTransaction, 0);
});

test('service module does not import backend/database.js', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'backend/services/lifecyclePersistenceService.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"]\.\.\/database['"]\)/);
  assert.doesNotMatch(source, /predictions_raw|direct1x2_prediction_final|fixture_context_cache/);
});

test('rollover duplicate maps to ROLLOVER_ALREADY_APPLIED', async () => {
  const { store, db, service } = createService();
  const first = await service.appendRolloverEvent(db.client, {
    rollover: {
      rollover_key: '2026-07-14',
      snapshot: { carried: 1 }
    }
  });
  assert.equal(first.ok, true);
  const second = await service.appendRolloverEvent(db.client, {
    rollover: {
      rollover_key: '2026-07-14',
      snapshot: { carried: 2 }
    }
  });
  assert.equal(second.ok, false);
  assert.equal(second.code, DOMAIN_CODES.ROLLOVER_ALREADY_APPLIED);
});

test('oversized rollover snapshot fails before DB write', async () => {
  const { store, db, service } = createService();
  const huge = { data: 'x'.repeat(3000) };
  const check = service.validateRolloverSnapshot(huge);
  assert.equal(check.ok, false);
  assert.equal(check.code, DOMAIN_CODES.LIFECYCLE_ROLLOVER_SNAPSHOT_TOO_LARGE);
  const before = store.queryLog.length;
  const result = await service.appendRolloverEvent(db.client, {
    rollover: { rollover_key: '2026-07-15', snapshot: huge }
  });
  assert.equal(result.ok, false);
  assert.equal(store.queryLog.length, before);
});

test('admission query count remains bounded and avoids SELECT *', async () => {
  const { store, service } = createService();
  await service.admitFixture(admissionInput({ aliasValue: 'bounded-queries' }));
  assert.ok(store.queryLog.length <= 12);
  for (const sql of store.queryLog) {
    assert.doesNotMatch(sql, /SELECT \*/i);
  }
});

test('migration defines six approved lifecycle tables only', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  const tables = [
    'fixture_lifecycle_current',
    'fixture_identity_aliases',
    'fixture_lifecycle_transition_events',
    'fixture_lifecycle_rollover_events',
    'lifecycle_daily_admission_counters',
    'lifecycle_admission_idempotency'
  ];
  for (const table of tables) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
  }
  assert.doesNotMatch(sql, /predictions_raw|direct1x2_prediction_final|fixture_context_cache/);
  assert.match(sql, /ROLLBACK/i);
  assert.match(sql, /ceiling <= 50/);
  assert.match(sql, /UNIQUE \(fixture_uid, idempotency_key\)/);
});

test('package scripts do not invoke migration apply', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const scripts = Object.values(pkg.scripts || {}).join('\n');
  assert.doesNotMatch(scripts, /supabase db push|supabase migration up|migrate:apply/i);
});

test('buildAdmissionIdempotencyKey is deterministic', () => {
  const kickoff = new Date('2026-07-15T15:30:00.000Z');
  const a = buildAdmissionIdempotencyKey({
    sport: 'football',
    aliasNamespace: 'fip_id',
    aliasValue: 'abc',
    kickoffAt: kickoff,
    admissionDateSast: '2026-07-14'
  });
  const b = buildAdmissionIdempotencyKey({
    sport: 'football',
    aliasNamespace: 'fip_id',
    aliasValue: 'abc',
    kickoffAt: kickoff,
    admissionDateSast: '2026-07-14'
  });
  assert.equal(a, b);
  assert.equal(a.length, 64);
});
