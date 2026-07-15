'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const START_HEAD =
  'cce4d5bb6fea669d01856e4425ba2af804f3724a';

const EXPECTED_GATES = {
  scout_edge_marriage_gate: 'BLOCKED',
  unified_lifecycle_governor: 'BLOCKED',
  supabase_storage_gate: 'BLOCKED'
};

const NEXT_ACTION =
  'ESEC-001-C1 PASS WITH CRITICAL BLOCKERS. Next separately authorize ESEC-001-I1 fail-closed authentication and subscriber-boundary remediation: remove unconditional JWT admin/subscription bypasses, disable the public legacy user key, replace cron path bypasses with explicit authenticated scheduler credentials, protect mutation routes, remove startup test writes, and seal service-role/Scout M2M credential isolation. Do not execute E2E proof or clear any runtime gate.';

const PATHS = {
  ledger: 'control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json',
  register:
    'control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json',
  backlog: 'control-center/EDGE_PROJECT_BACKLOG.md',
  dependencyMap:
    'control-center/EDGE_PROJECT_DEPENDENCY_MAP.md',

  supabaseJwt: 'backend/middleware/supabaseJwt.js',
  roleAuth: 'backend/utils/auth.js',
  server: 'backend/server-express.js',
  composition:
    'backend/services/governedFipIntakeComposition.js',
  publicConfig: 'public/js/config.js',
  envExample: '.env.example',

  serviceRoleMigration:
    'supabase/migrations/20260822000008_service_role_rls_policies.sql',

  fipEvidenceMigration:
    'supabase/migrations/20261011000001_sem_gov_001d_ui3_i8_fip_intake_evidence.sql',

  controlledApply:
    'reports/ui3-i10/controlled-apply-result.json',

  report:
    'reports/esec-001/security-boundary-inspection.json',

  packet:
    'control-center/ESEC-001_C1_SECURITY_BOUNDARY_INSPECTION_AND_CONTRACT.v1.md',

  packageJson: 'package.json'
};

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(
    absolute(relativePath),
    'utf8'
  );
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function writeJson(relativePath, value) {
  const filePath = absolute(relativePath);

  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  });

  fs.writeFileSync(
    filePath,
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  );
}

function getTask(ledger, taskId) {
  const task = ledger.tasks.find(
    (entry) => entry.task_id === taskId
  );

  assert.ok(task, `${taskId} missing from ledger`);
  return task;
}

test(
  'ESEC-001-C1 seals the current security boundary as PARTIAL with critical blockers',
  () => {
    const ledger = readJson(PATHS.ledger);
    const register = readJson(PATHS.register);
    const packageJson = readJson(PATHS.packageJson);
    const controlledApply =
      readJson(PATHS.controlledApply);

    const esec = getTask(ledger, 'ESEC-001');
    const e2e = getTask(ledger, 'E2E-001');

    assert.deepEqual(
      {
        scout_edge_marriage_gate:
          ledger.scout_edge_marriage_gate,
        unified_lifecycle_governor:
          ledger.unified_lifecycle_governor,
        supabase_storage_gate:
          ledger.supabase_storage_gate
      },
      EXPECTED_GATES
    );

    assert.equal(esec.status, 'PARTIAL');
    assert.equal(e2e.status, 'BLOCKED');
    assert.equal(esec.next_action, NEXT_ACTION);

    const project = register.projects.find(
      (entry) => entry.project_id === 'ESEC-001'
    );

    assert.ok(project);
    assert.equal(project.current_status, 'PARTIAL');
    assert.equal(project.next_action, NEXT_ACTION);

    assert.equal(
      read(PATHS.backlog).includes(NEXT_ACTION),
      true
    );

    const dependencyMap =
      read(PATHS.dependencyMap);

    assert.match(
      dependencyMap,
      /## ESEC-001 — Subscriber and Security Boundary[\s\S]*?Status: PARTIAL/
    );

    const jwtSource = read(PATHS.supabaseJwt);
    const roleSource = read(PATHS.roleAuth);
    const serverSource = read(PATHS.server);
    const compositionSource =
      read(PATHS.composition);
    const publicConfig =
      read(PATHS.publicConfig);
    const envExample =
      read(PATHS.envExample);
    const serviceRoleMigration =
      read(PATHS.serviceRoleMigration);
    const fipEvidenceMigration =
      read(PATHS.fipEvidenceMigration);

    const bypassStart = jwtSource.indexOf(
      '[TESTING] Bypassing subscription resolution for testing'
    );

    const realProfileLookup = jwtSource.indexOf(
      'let profile = await getProfileById'
    );

    assert.notEqual(bypassStart, -1);
    assert.equal(realProfileLookup > bypassStart, true);

    const jwtBypassSection = jwtSource.slice(
      bypassStart,
      realProfileLookup
    );

    assert.match(
      jwtBypassSection,
      /is_admin:\s*true/
    );

    assert.match(
      jwtBypassSection,
      /role:\s*'admin'/
    );

    assert.match(
      jwtBypassSection,
      /return next\(\)/
    );

    const subscriptionStart = jwtSource.indexOf(
      'function requireActiveSubscription'
    );

    assert.notEqual(subscriptionStart, -1);

    const subscriptionSection =
      jwtSource.slice(subscriptionStart);

    assert.match(
      subscriptionSection,
      /Subscription check bypassed for testing/
    );

    assert.match(
      subscriptionSection,
      /Original logic \(commented out for testing\)/
    );

    assert.match(
      roleSource,
      /ALLOW_LEGACY_USER_KEY \|\| 'true'/
    );

    assert.match(
      roleSource,
      /skcs_user_12345/
    );

    assert.match(
      roleSource,
      /requestPath\.startsWith\('\/api\/cron\/'\)/
    );

    assert.match(
      publicConfig,
      /USER_API_KEY[\s\S]*skcs_user_12345/
    );

    assert.match(
      publicConfig,
      /SUPABASE_ANON_KEY/
    );

    assert.match(
      serverSource,
      /app\.post\('\/api\/pipeline\/trigger', async/
    );

    assert.match(
      serverSource,
      /app\.post\('\/api\/internal\/fetch-fixtures', async/
    );

    assert.match(
      serverSource,
      /SUPABASE_SERVICE_ROLE_KEY/
    );

    assert.match(
      serverSource,
      /\|\| process\.env\.SUPABASE_ANON_KEY/
    );

    assert.match(
      serverSource,
      /FORCE_BOOT_TEST/
    );

    assert.match(
      envExample,
      /SUPABASE_SERVICE_ROLE_KEY=your_/
    );

    assert.match(
      envExample,
      /SUPABASE_KEY=your_/
    );

    assert.match(
      envExample,
      /SUPABASE_SERVICE_KEY=your_/
    );

    assert.match(
      envExample,
      /SERVICE_ROLE_KEY=your_/
    );

    assert.match(
      compositionSource,
      /assertDependency\('secretResolver'/
    );

    assert.match(
      compositionSource,
      /assertDependency\('nonceStore'/
    );

    assert.match(
      serviceRoleMigration,
      /TO service_role USING \(true\) WITH CHECK \(true\)/
    );

    assert.match(
      fipEvidenceMigration,
      /ENABLE ROW LEVEL SECURITY/
    );

    assert.doesNotMatch(
      fipEvidenceMigration,
      /CREATE POLICY/
    );

    assert.equal(
      Array.isArray(
        controlledApply.postApply.policies
      ),
      true
    );

    assert.equal(
      controlledApply.postApply.policies.length,
      0
    );

    assert.equal(
      packageJson.scripts[
        'test:esec-001-c1'
      ],
      'node --test tests/esec-001-c1-security-boundary.test.js'
    );

    const findings = [
      {
        id: 'AUTH-001',
        severity: 'CRITICAL',
        state: 'OPEN',
        title:
          'Validated Supabase JWT is unconditionally promoted to admin',
        requiredRepair:
          'Remove testing branch and derive roles only from governed server-side profile and authorization data.'
      },
      {
        id: 'SUB-001',
        severity: 'CRITICAL',
        state: 'OPEN',
        title:
          'Active-subscription enforcement always passes',
        requiredRepair:
          'Restore fail-closed subscription checks with explicit admin and test-user policy.'
      },
      {
        id: 'KEY-001',
        severity: 'CRITICAL',
        state: 'OPEN',
        title:
          'Legacy shared user key is public and enabled by backend default',
        requiredRepair:
          'Default legacy-key support off and remove the shared key from public assets.'
      },
      {
        id: 'CRON-001',
        severity: 'CRITICAL',
        state: 'OPEN',
        title:
          'Cron path prefixes bypass role authorization',
        requiredRepair:
          'Require a dedicated scheduler credential using constant-time comparison and explicit route middleware.'
      },
      {
        id: 'ROUTE-001',
        severity: 'CRITICAL',
        state: 'OPEN',
        title:
          'Mutation-capable pipeline and internal fixture routes lack explicit authentication',
        requiredRepair:
          'Mount explicit admin or scheduler middleware before request handling.'
      },
      {
        id: 'DB-001',
        severity: 'HIGH',
        state: 'OPEN',
        title:
          'Server startup performs FORCE_BOOT_TEST writes using a privileged-key preference chain',
        requiredRepair:
          'Remove automatic test writes and prohibit anon-key fallback for privileged database operations.'
      },
      {
        id: 'RLS-001',
        severity: 'HIGH',
        state: 'OPEN',
        title:
          'New RLS-enabled proof tables have zero explicit policies',
        requiredRepair:
          'Seal server-only ownership or implement least-privilege policies in a separately approved migration packet.'
      },
      {
        id: 'CRED-001',
        severity: 'HIGH',
        state: 'OPEN',
        title:
          'Service-role, subscriber, scheduler and Scout M2M credential boundaries are not operationally separated',
        requiredRepair:
          'Define distinct ownership, purpose, rotation, storage and revocation laws for every credential class.'
      }
    ];

    const criticalCount = findings.filter(
      (finding) =>
        finding.severity === 'CRITICAL'
    ).length;

    const highCount = findings.filter(
      (finding) =>
        finding.severity === 'HIGH'
    ).length;

    assert.equal(findings.length, 8);
    assert.equal(criticalCount, 5);
    assert.equal(highCount, 3);

    const report = {
      task: 'ESEC-001',
      miniProject: 'ESEC-001-C1',
      operation:
        'SECURITY_BOUNDARY_INSPECTION_AND_CONTRACT',
      startHead: START_HEAD,
      generatedAt:
        '2026-07-15T00:00:00.000Z',

      result: 'PASS_WITH_CRITICAL_BLOCKERS',
      decision:
        'SECURITY_BOUNDARY_INSPECTED_REMEDIATION_REQUIRED',

      codeRequired: true,
      esec001Status: 'PARTIAL',
      e2e001Status: 'BLOCKED',
      fullMarriageProofDecision: 'HOLD',

      findingCount: findings.length,
      criticalFindingCount: criticalCount,
      highFindingCount: highCount,
      findings,

      credentialClasses: {
        supabaseAnonKey:
          'PUBLIC_CLIENT_IDENTIFIER_NOT_SERVICE_SECRET',
        supabaseServiceRole:
          'SERVER_ONLY_PRIVILEGED_SECRET',
        subscriberJwt:
          'END_USER_IDENTITY_TOKEN',
        adminApiKey:
          'SERVER_VALIDATED_OPERATOR_SECRET',
        schedulerSecret:
          'SERVER_TO_SERVER_SCHEDULER_SECRET',
        scoutM2MHmacSecret:
          'SCOUT_TO_EDGE_INTEGRATION_SECRET'
      },

      secretValuesRecorded: false,
      externalConnections: 0,
      runtimeFilesChanged: [],
      sqlFilesChanged: [],
      migrationsApplied: false,
      credentialsChanged: false,

      runtimeRemediationAuthorized: false,
      e2eExecutionAuthorized: false,
      scoutTransportAuthorized: false,
      gateClearanceAuthorized: false,

      nextAuthorizedMiniProject: {
        id: 'ESEC-001-I1',
        mode:
          'FAIL_CLOSED_AUTHENTICATION_AND_CREDENTIAL_BOUNDARY_REMEDIATION',
        separatelyAuthorized: false
      },

      currentRuntimeGates: {
        ...EXPECTED_GATES
      },

      preservedUntrackedDirectories: [
        'evidence/',
        'evidence-home1-scratch/'
      ],

      nextAction: NEXT_ACTION
    };

    writeJson(PATHS.report, report);

    const findingRows = findings.map(
      (finding) =>
        `| ${finding.id} | ${finding.severity} | ${finding.state} | ${finding.title} |`
    );

    const packet = [
      '# ESEC-001-C1 — Security Boundary Inspection and Contract',
      '',
      '| Field | Value |',
      '|---|---|',
      `| Start HEAD | \`${START_HEAD}\` |`,
      '| Code required | **YES** |',
      '| Result | **PASS WITH CRITICAL BLOCKERS** |',
      '| ESEC-001 | **PARTIAL** |',
      '| E2E-001 | **BLOCKED** |',
      '| Full marriage proof | **HOLD** |',
      '| Runtime remediation authorized | **NO** |',
      '| External connections | **0** |',
      '| Secret values recorded | **NO** |',
      '',
      '## Findings',
      '',
      '| ID | Severity | State | Finding |',
      '|---|---|---|---|',
      ...findingRows,
      '',
      '## Credential-class law',
      '',
      '- Supabase anon key: public client identifier, not a service secret.',
      '- Supabase service-role key: privileged server-only secret.',
      '- Subscriber JWT: end-user identity token; never sufficient by itself for admin privilege.',
      '- Admin API key: operator secret validated only by server middleware.',
      '- Scheduler secret: dedicated server-to-server credential; never authorized by path alone.',
      '- Scout HMAC secret: dedicated Scout-to-Edge integration secret with rotation and replay protection.',
      '',
      '## Preserved blocks',
      '',
      '- `scout_edge_marriage_gate`: **BLOCKED**',
      '- `unified_lifecycle_governor`: **BLOCKED**',
      '- `supabase_storage_gate`: **BLOCKED**',
      '',
      '## Next mini-project',
      '',
      '**ESEC-001-I1 — Fail-Closed Authentication and Credential-Boundary Remediation.**',
      '',
      'ESEC-001-I1 requires separate authorization. This inspection does not change runtime code, credentials, SQL, migrations, routes, deployment, Scout transport, or gates.',
      '',
      '## Decision',
      '',
      '**PASS WITH CRITICAL BLOCKERS — ESEC REMAINS PARTIAL AND E2E REMAINS BLOCKED.**',
      ''
    ].join('\n');

    fs.mkdirSync(
      path.dirname(absolute(PATHS.packet)),
      { recursive: true }
    );

    fs.writeFileSync(
      absolute(PATHS.packet),
      packet,
      'utf8'
    );
  }
);
