'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '..');

const READINESS_REPORT =
  'reports/ui3-i10/migration-readiness.json';

const MIGRATIONS = Object.freeze([
  {
    id: '20261008000001',
    path:
      'supabase/migrations/' +
      '20261008000001_sem_gov_001b_lifecycle_persistence.sql',
    tables: [
      'fixture_lifecycle_current',
      'fixture_identity_aliases',
      'fixture_lifecycle_transition_events',
      'fixture_lifecycle_rollover_events',
      'lifecycle_daily_admission_counters',
      'lifecycle_admission_idempotency'
    ]
  },
  {
    id: '20261010000001',
    path:
      'supabase/migrations/' +
      '20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql',
    tables: [
      'fixture_display_metadata'
    ]
  },
  {
    id: '20261011000001',
    path:
      'supabase/migrations/' +
      '20261011000001_sem_gov_001d_ui3_i8_fip_intake_evidence.sql',
    tables: [
      'fip_intake_evidence'
    ]
  }
]);

const ALL_TABLES = MIGRATIONS.flatMap(
  (migration) => migration.tables
);

const ADVISORY_LOCK_KEY = 310110;

function sha256(text) {
  return crypto
    .createHash('sha256')
    .update(text, 'utf8')
    .digest('hex');
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(
      absolute(relativePath),
      'utf8'
    )
  );
}

function writeJson(relativePath, value) {
  const outputPath = absolute(relativePath);

  fs.mkdirSync(
    path.dirname(outputPath),
    { recursive: true }
  );

  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  );
}

function redactConnectionTarget(connectionString) {
  const parsed = new URL(connectionString);

  return {
    protocol: parsed.protocol,
    host: parsed.hostname,
    port: parsed.port || null,
    database:
      parsed.pathname.replace(/^\//, '') ||
      null
  };
}

function normalizeDdlConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);

    if (
      url.hostname.includes('pooler.supabase.com') &&
      (url.port === '6543' || url.port === '')
    ) {
      url.port = '5432';
    }

    return url.toString();
  } catch {
    return connectionString;
  }
}

function prepareMigrationSql(migration) {
  if (migration.id !== '20261008000001') {
    return migration.sql;
  }

  return migration.sql.replace(
    /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pgcrypto\s*;\s*/i,
    ''
  );
}

function loadAndVerifyMigrations() {
  const readiness =
    readJson(READINESS_REPORT);

  if (readiness.decision !== 'PASS') {
    throw new Error(
      'Readiness report is not PASS.'
    );
  }

  const readinessHashes = new Map(
    readiness.static.migrations.map(
      (migration) => [
        migration.id,
        migration.sha256
      ]
    )
  );

  return MIGRATIONS.map((definition) => {
    const sql = fs.readFileSync(
      absolute(definition.path),
      'utf8'
    );

    const actualHash = sha256(sql);
    const expectedHash =
      readinessHashes.get(definition.id);

    if (!expectedHash) {
      throw new Error(
        `Missing readiness hash for ${definition.id}.`
      );
    }

    if (actualHash !== expectedHash) {
      throw new Error(
        `Migration hash drift for ${definition.id}.`
      );
    }

    return {
      ...definition,
      sql,
      sha256: actualHash
    };
  });
}

async function inspectTables(client) {
  const result = await client.query(
    `
      SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        pg_total_relation_size(c.oid)
          AS total_bytes
      FROM pg_class c
      JOIN pg_namespace n
        ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname =
          ANY($1::text[])
      ORDER BY c.relname
    `,
    [ALL_TABLES]
  );

  return result.rows;
}

async function inspectIndexes(client) {
  const result = await client.query(
    `
      SELECT
        tablename AS table_name,
        indexname AS index_name,
        indexdef AS index_definition
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename =
          ANY($1::text[])
      ORDER BY tablename, indexname
    `,
    [ALL_TABLES]
  );

  return result.rows;
}

async function inspectConstraints(client) {
  const result = await client.query(
    `
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.table_name =
          ANY($1::text[])
      ORDER BY
        tc.table_name,
        tc.constraint_name
    `,
    [ALL_TABLES]
  );

  return result.rows;
}

async function inspectPolicies(client) {
  const result = await client.query(
    `
      SELECT
        tablename AS table_name,
        policyname AS policy_name,
        roles,
        cmd
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename =
          ANY($1::text[])
      ORDER BY tablename, policyname
    `,
    [ALL_TABLES]
  );

  return result.rows;
}

async function inspectDatabase(client) {
  const [
    sizeResult,
    tables,
    indexes,
    constraints,
    policies
  ] = await Promise.all([
    client.query(
      `
        SELECT
          pg_database_size(
            current_database()
          ) AS bytes
      `
    ),
    inspectTables(client),
    inspectIndexes(client),
    inspectConstraints(client),
    inspectPolicies(client)
  ]);

  return {
    databaseBytes:
      Number(
        sizeResult.rows[0]?.bytes || 0
      ),
    tables,
    indexes,
    constraints,
    policies
  };
}

function validatePreApply(snapshot) {
  if (snapshot.tables.length !== 0) {
    throw new Error(
      'One or more target tables already exist.'
    );
  }
}

function validatePostApply(snapshot) {
  const tableNames = new Set(
    snapshot.tables.map(
      (table) => table.table_name
    )
  );

  const missingTables =
    ALL_TABLES.filter(
      (table) => !tableNames.has(table)
    );

  if (missingTables.length > 0) {
    throw new Error(
      `Missing tables after apply: ` +
      missingTables.join(', ')
    );
  }

  const rlsMissing =
    snapshot.tables
      .filter(
        (table) =>
          table.rls_enabled !== true
      )
      .map(
        (table) => table.table_name
      );

  if (rlsMissing.length > 0) {
    throw new Error(
      `RLS missing after apply: ` +
      rlsMissing.join(', ')
    );
  }

  if (snapshot.policies.length !== 0) {
    throw new Error(
      'Unexpected public RLS policies exist.'
    );
  }

  const acceptedIndex =
    snapshot.indexes.find(
      (index) =>
        index.index_name ===
        'idx_fip_intake_evidence_accepted_idempotency'
    );

  if (!acceptedIndex) {
    throw new Error(
      'Accepted-idempotency index missing.'
    );
  }

  const d3Unique =
    snapshot.constraints.find(
      (constraint) =>
        constraint.constraint_name ===
        'fixture_display_metadata_idempotency_unique'
    );

  if (!d3Unique) {
    throw new Error(
      'D3 idempotency constraint missing.'
    );
  }
}

async function applyMigrations(
  client,
  migrations
) {
  for (const migration of migrations) {
    process.stdout.write(
      `Applying ${migration.id}...\n`
    );

    await client.query(prepareMigrationSql(migration));
  }
}

async function main() {
  if (
    process.env.UI3_I10_APPLY_CONFIRMED !==
    'YES'
  ) {
    throw new Error(
      'UI3_I10_APPLY_CONFIRMED=YES is required.'
    );
  }

  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required.'
    );
  }

  const migrations =
    loadAndVerifyMigrations();

  const pool = new Pool({
    connectionString: normalizeDdlConnectionString(
      connectionString
    ),
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 5_000,
    ssl: {
      rejectUnauthorized: false
    },
    application_name:
      'sem-gov-001d-ui3-i10-controlled-apply'
  });

  const startedAt =
    new Date().toISOString();

  const report = {
    task: 'SEM-GOV-001D-UI3-I10',
    operation:
      'GATE_B_CONTROLLED_APPLY',
    startedAt,
    connectionTarget:
      redactConnectionTarget(
        connectionString
      ),
    migrations:
      migrations.map(
        ({
          id,
          path: migrationPath,
          sha256: hash,
          tables
        }) => ({
          id,
          path: migrationPath,
          sha256: hash,
          tables
        })
      ),
    preApply: null,
    postApply: null,
    result: 'HOLD'
  };

  const client =
    await pool.connect();

  try {
    await client.query(
      `SET statement_timeout = '60000ms'`
    );

    await client.query(
      `
        SELECT pg_advisory_lock($1)
      `,
      [ADVISORY_LOCK_KEY]
    );

    report.preApply =
      await inspectDatabase(client);

    validatePreApply(report.preApply);

    writeJson(
      'reports/ui3-i10/' +
      'pre-apply-schema-snapshot.json',
      report.preApply
    );

    await client.query('BEGIN');

    try {
      await applyMigrations(
        client,
        migrations
      );

      report.postApply =
        await inspectDatabase(client);

      validatePostApply(
        report.postApply
      );

      await client.query('COMMIT');

      report.result = 'PASS';
      report.completedAt =
        new Date().toISOString();

      writeJson(
        'reports/ui3-i10/' +
        'post-apply-schema-snapshot.json',
        report.postApply
      );
    } catch (error) {
      await client.query('ROLLBACK');

      report.result = 'ROLLED_BACK';
      report.error = {
        message: error.message
      };

      throw error;
    }
  } finally {
    try {
      await client.query(
        `
          SELECT pg_advisory_unlock($1)
        `,
        [ADVISORY_LOCK_KEY]
      );
    } finally {
      client.release();
      await pool.end();

      writeJson(
        'reports/ui3-i10/' +
        'controlled-apply-result.json',
        report
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        result: report.result,
        tablesCreated:
          report.postApply.tables.length,
        beforeBytes:
          report.preApply.databaseBytes,
        afterBytes:
          report.postApply.databaseBytes,
        report:
          'reports/ui3-i10/' +
          'controlled-apply-result.json'
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      JSON.stringify(
        {
          result: 'ERROR',
          code:
            'UI3_I10_CONTROLLED_APPLY_FAILED',
          message: error.message
        },
        null,
        2
      )
    );

    process.exitCode = 1;
  });
}

module.exports = {
  MIGRATIONS,
  ALL_TABLES,
  sha256,
  loadAndVerifyMigrations,
  validatePreApply,
  validatePostApply
};
