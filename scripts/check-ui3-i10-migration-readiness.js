'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '..');

const MIGRATIONS = Object.freeze([
  {
    id: '20261008000001',
    path: 'supabase/migrations/20261008000001_sem_gov_001b_lifecycle_persistence.sql',
    tables: [
      'fixture_lifecycle_current',
      'fixture_identity_aliases',
      'fixture_lifecycle_transition_events',
      'fixture_lifecycle_rollover_events',
      'lifecycle_daily_admission_counters',
      'lifecycle_admission_idempotency'
    ],
    requiresRls: true
  },
  {
    id: '20261010000001',
    path: 'supabase/migrations/20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql',
    tables: ['fixture_display_metadata'],
    requiresRls: true
  },
  {
    id: '20261011000001',
    path: 'supabase/migrations/20261011000001_sem_gov_001d_ui3_i8_fip_intake_evidence.sql',
    tables: ['fip_intake_evidence'],
    requiresRls: true
  }
]);

function sha256(text) {
  return crypto
    .createHash('sha256')
    .update(text, 'utf8')
    .digest('hex');
}

function readMigration(definition) {
  const absolutePath = path.join(ROOT, definition.path);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing migration: ${definition.path}`);
  }

  const sql = fs.readFileSync(absolutePath, 'utf8');

  return {
    ...definition,
    absolutePath,
    sql,
    sha256: sha256(sql)
  };
}

function countCreateTables(sql) {
  return (
    sql.match(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi
    ) || []
  ).length;
}

function migrationEnablesRls(sql, table) {
  const pattern = new RegExp(
    `alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`,
    'i'
  );

  return pattern.test(sql);
}

function inspectStaticMigrations() {
  const migrations = MIGRATIONS.map(readMigration);
  const findings = [];

  for (const migration of migrations) {
    const createCount = countCreateTables(migration.sql);

    if (createCount !== migration.tables.length) {
      findings.push({
        severity: 'BLOCKER',
        code: 'CREATE_TABLE_COUNT_MISMATCH',
        migration: migration.path,
        expected: migration.tables.length,
        actual: createCount
      });
    }

    for (const table of migration.tables) {
      const createPattern = new RegExp(
        `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\b`,
        'i'
      );

      if (!createPattern.test(migration.sql)) {
        findings.push({
          severity: 'BLOCKER',
          code: 'EXPECTED_TABLE_NOT_CREATED',
          migration: migration.path,
          table
        });
      }

      if (
        migration.requiresRls &&
        !migrationEnablesRls(migration.sql, table)
      ) {
        findings.push({
          severity: 'BLOCKER',
          code: 'RLS_NOT_ENABLED_IN_MIGRATION',
          migration: migration.path,
          table
        });
      }
    }

    if (/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(
      migration.sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
    )) {
      findings.push({
        severity: 'BLOCKER',
        code: 'DESTRUCTIVE_SQL_FOUND',
        migration: migration.path
      });
    }
  }

  return {
    migrations: migrations.map((migration) => ({
      id: migration.id,
      path: migration.path,
      sha256: migration.sha256,
      tables: migration.tables
    })),
    findings
  };
}

async function tableInventory(client) {
  const targetTables = MIGRATIONS.flatMap(
    (migration) => migration.tables
  );

  const result = await client.query(
    `
      SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        pg_total_relation_size(c.oid) AS total_bytes
      FROM pg_class c
      JOIN pg_namespace n
        ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname = ANY($1::text[])
      ORDER BY c.relname
    `,
    [targetTables]
  );

  return result.rows;
}

async function databaseSnapshot(client) {
  const [
    databaseSize,
    extensionResult,
    migrationHistoryResult,
    inventory
  ] = await Promise.all([
    client.query(
      `SELECT pg_database_size(current_database()) AS bytes`
    ),

    client.query(
      `
        SELECT extname
        FROM pg_extension
        WHERE extname = 'pgcrypto'
      `
    ),

    client.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'supabase_migrations'
            AND table_name = 'schema_migrations'
        ) AS exists
      `
    ),

    tableInventory(client)
  ]);

  let migrationHistory = [];

  if (migrationHistoryResult.rows[0]?.exists) {
    const history = await client.query(
      `
        SELECT version
        FROM supabase_migrations.schema_migrations
        WHERE version = ANY($1::text[])
        ORDER BY version
      `,
      [MIGRATIONS.map((migration) => migration.id)]
    );

    migrationHistory = history.rows.map(
      (row) => String(row.version)
    );
  }

  return {
    databaseBytes: Number(databaseSize.rows[0]?.bytes || 0),
    pgcryptoInstalled:
      extensionResult.rows.length === 1,
    migrationHistoryTableExists:
      Boolean(migrationHistoryResult.rows[0]?.exists),
    migrationHistory,
    targetTableInventory: inventory
  };
}

function evaluateLiveSnapshot(snapshot) {
  const findings = [];

  if (!snapshot.pgcryptoInstalled) {
    findings.push({
      severity: 'WARNING',
      code: 'PGCRYPTO_NOT_CURRENTLY_INSTALLED',
      message:
        'Lifecycle migration contains CREATE EXTENSION IF NOT EXISTS pgcrypto.'
    });
  }

  if (snapshot.targetTableInventory.length > 0) {
    findings.push({
      severity: 'BLOCKER',
      code: 'TARGET_TABLE_COLLISION',
      tables: snapshot.targetTableInventory.map(
        (row) => row.table_name
      )
    });
  }

  if (snapshot.migrationHistory.length > 0) {
    findings.push({
      severity: 'BLOCKER',
      code: 'TARGET_MIGRATION_ALREADY_RECORDED',
      versions: snapshot.migrationHistory
    });
  }

  return findings;
}

function redactConnectionTarget(connectionString) {
  try {
    const parsed = new URL(connectionString);

    return {
      protocol: parsed.protocol,
      host: parsed.hostname,
      port: parsed.port || null,
      database: parsed.pathname.replace(/^\//, '') || null
    };
  } catch {
    return {
      protocol: null,
      host: 'UNPARSEABLE',
      port: null,
      database: null
    };
  }
}

async function runLiveInspection(connectionString) {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 5_000,
    ssl: {
      rejectUnauthorized: false
    },
    application_name:
      'sem-gov-001d-ui3-i10-readiness'
  });

  try {
    const client = await pool.connect();

    try {
      await client.query(
        `SET statement_timeout = '15000ms'`
      );

      await client.query(
        `SET default_transaction_read_only = on`
      );

      await client.query('BEGIN READ ONLY');

      try {
        const snapshot =
          await databaseSnapshot(client);

        await client.query('COMMIT');

        return snapshot;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  const staticResult = inspectStaticMigrations();

  const report = {
    task: 'SEM-GOV-001D-UI3-I10',
    mode: 'READINESS_ONLY',
    generatedAt: new Date().toISOString(),
    static: staticResult,
    live: null,
    decision: 'HOLD'
  };

  const staticBlockers =
    staticResult.findings.filter(
      (finding) => finding.severity === 'BLOCKER'
    );

  const connectionString =
    process.env.DATABASE_URL || '';

  if (!connectionString) {
    report.live = {
      inspected: false,
      reason: 'DATABASE_URL_NOT_SET'
    };
  } else {
    report.live = {
      inspected: true,
      connectionTarget:
        redactConnectionTarget(connectionString),
      snapshot:
        await runLiveInspection(connectionString)
    };

    report.live.findings =
      evaluateLiveSnapshot(report.live.snapshot);
  }

  const liveBlockers =
    report.live?.findings?.filter(
      (finding) => finding.severity === 'BLOCKER'
    ) || [];

  if (
    staticBlockers.length === 0 &&
    report.live?.inspected === true &&
    liveBlockers.length === 0
  ) {
    report.decision = 'PASS';
  }

  const outputDirectory = path.join(
    ROOT,
    'reports',
    'ui3-i10'
  );

  fs.mkdirSync(outputDirectory, {
    recursive: true
  });

  const outputPath = path.join(
    outputDirectory,
    'migration-readiness.json'
  );

  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  console.log(
    JSON.stringify(
      {
        decision: report.decision,
        report: path.relative(ROOT, outputPath),
        staticBlockers:
          staticBlockers.map(
            (finding) => finding.code
          ),
        liveBlockers:
          liveBlockers.map(
            (finding) => finding.code
          )
      },
      null,
      2
    )
  );

  process.exitCode =
    report.decision === 'PASS' ? 0 : 2;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      JSON.stringify(
        {
          decision: 'ERROR',
          code: 'UI3_I10_READINESS_ERROR',
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
  sha256,
  countCreateTables,
  migrationEnablesRls,
  inspectStaticMigrations,
  evaluateLiveSnapshot,
  redactConnectionTarget
};
