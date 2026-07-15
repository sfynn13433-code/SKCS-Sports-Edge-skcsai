'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MIGRATIONS,
  ALL_TABLES,
  loadAndVerifyMigrations,
  validatePreApply,
  validatePostApply
} = require(
  '../scripts/apply-ui3-i10-controlled-migrations'
);

test(
  'controlled apply seals three migrations',
  () => {
    assert.equal(
      MIGRATIONS.length,
      3
    );

    assert.deepEqual(
      MIGRATIONS.map(
        (migration) => migration.id
      ),
      [
        '20261008000001',
        '20261010000001',
        '20261011000001'
      ]
    );
  }
);

test(
  'controlled apply expects eight tables',
  () => {
    assert.equal(
      ALL_TABLES.length,
      8
    );
  }
);

test(
  'migration files match readiness hashes',
  () => {
    const migrations =
      loadAndVerifyMigrations();

    assert.equal(
      migrations.length,
      3
    );

    for (const migration of migrations) {
      assert.match(
        migration.sha256,
        /^[a-f0-9]{64}$/
      );
    }
  }
);

test(
  'pre-apply blocks an existing target table',
  () => {
    assert.throws(
      () =>
        validatePreApply({
          tables: [
            {
              table_name:
                'fixture_lifecycle_current'
            }
          ]
        }),
      /already exist/
    );
  }
);

test(
  'post-apply requires all tables and RLS',
  () => {
    assert.throws(
      () =>
        validatePostApply({
          tables: [],
          indexes: [],
          constraints: [],
          policies: []
        }),
      /Missing tables/
    );
  }
);

test(
  'post-apply accepts complete protected schema',
  () => {
    validatePostApply({
      tables:
        ALL_TABLES.map(
          (tableName) => ({
            table_name: tableName,
            rls_enabled: true
          })
        ),

      indexes: [
        {
          index_name:
            'idx_fip_intake_evidence_accepted_idempotency'
        }
      ],

      constraints: [
        {
          constraint_name:
            'fixture_display_metadata_idempotency_unique'
        }
      ],

      policies: []
    });
  }
);
