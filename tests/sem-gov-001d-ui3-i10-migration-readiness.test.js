'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MIGRATIONS,
  countCreateTables,
  migrationEnablesRls,
  inspectStaticMigrations,
  evaluateLiveSnapshot,
  redactConnectionTarget
} = require(
  '../scripts/check-ui3-i10-migration-readiness'
);

test(
  'migration order is lifecycle then D3 then evidence',
  () => {
    assert.deepEqual(
      MIGRATIONS.map((migration) => migration.id),
      [
        '20261008000001',
        '20261010000001',
        '20261011000001'
      ]
    );
  }
);

test(
  'expected migration table counts are sealed',
  () => {
    assert.equal(
      MIGRATIONS[0].tables.length,
      6
    );

    assert.equal(
      MIGRATIONS[1].tables.length,
      1
    );

    assert.equal(
      MIGRATIONS[2].tables.length,
      1
    );
  }
);

test(
  'table counter ignores non-create statements',
  () => {
    assert.equal(
      countCreateTables(`
        CREATE TABLE public.alpha (id integer);
        ALTER TABLE public.alpha ENABLE ROW LEVEL SECURITY;
      `),
      1
    );
  }
);

test(
  'RLS detector is table-specific',
  () => {
    const sql = `
      ALTER TABLE public.alpha
      ENABLE ROW LEVEL SECURITY;
    `;

    assert.equal(
      migrationEnablesRls(sql, 'alpha'),
      true
    );

    assert.equal(
      migrationEnablesRls(sql, 'beta'),
      false
    );
  }
);

test(
  'static inspection returns migration hashes',
  () => {
    const result =
      inspectStaticMigrations();

    assert.equal(
      result.migrations.length,
      3
    );

    for (const migration of result.migrations) {
      assert.match(
        migration.sha256,
        /^[a-f0-9]{64}$/
      );
    }
  }
);

test(
  'live snapshot blocks target-table collisions',
  () => {
    const findings =
      evaluateLiveSnapshot({
        pgcryptoInstalled: true,
        migrationHistory: [],
        targetTableInventory: [
          {
            table_name:
              'fixture_lifecycle_current'
          }
        ]
      });

    assert.equal(
      findings.some(
        (finding) =>
          finding.code ===
          'TARGET_TABLE_COLLISION'
      ),
      true
    );
  }
);

test(
  'live snapshot blocks prior migration history',
  () => {
    const findings =
      evaluateLiveSnapshot({
        pgcryptoInstalled: true,
        migrationHistory: [
          '20261008000001'
        ],
        targetTableInventory: []
      });

    assert.equal(
      findings.some(
        (finding) =>
          finding.code ===
          'TARGET_MIGRATION_ALREADY_RECORDED'
      ),
      true
    );
  }
);

test(
  'connection target redacts credentials',
  () => {
    const result =
      redactConnectionTarget(
        'postgresql://secret-user:secret-password@example.com:5432/example'
      );

    assert.equal(result.host, 'example.com');

    assert.equal(
      JSON.stringify(result).includes(
        'secret-password'
      ),
      false
    );

    assert.equal(
      JSON.stringify(result).includes(
        'secret-user'
      ),
      false
    );
  }
);
