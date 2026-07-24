'use strict';

const {
  loadExternalScoutFip
} = require('./sxe-fip-lab-001-external-fip-loader');

function parseManifestArg(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--manifest');
  return index === -1 ? undefined : argv[index + 1];
}

function holdPayloadFromLoader(loaded, manifestPath) {
  const details = loaded.details || {};
  return {
    ok: true,
    result: 'HOLD',
    decision: 'HOLD',
    code: loaded.code,
    message: loaded.message,
    source_package: {
      manifest_path: manifestPath || process.env.SXE_HANDOFF_MANIFEST_PATH || parseManifestArg(),
      declared_roles: details.declared_roles || [],
      selected_role: null
    },
    prediction: null,
    filters: [],
    missing_canonical_fields: details.missing_fields
      || details.internal_missing_fields
      || [],
    timeline: [
      {
        stage: 'EXTERNAL_SCOUT_FIP_INTAKE',
        status: 'HOLD',
        message: loaded.message
      },
      {
        stage: 'PREDICTION_ABSTAINED',
        status: 'PASS',
        message: 'No prediction was attempted because intake did not reach READY.'
      }
    ],
    safety: {
      production_database_write: false,
      supabase_write: false,
      external_provider_request: false,
      public_route_used: false,
      deployment_performed: false,
      full_fip_persisted: false,
      provider_fallback_calls: 0,
      network_calls: 0,
      scout_neon_calls: 0,
      marriage_invocations: 0,
      process_exit_code: 0
    }
  };
}

function holdPayload(error) {
  const details = error.details || {};
  return {
    ok: true,
    result: 'HOLD',
    decision: 'HOLD',
    code: error.code || 'SXE_EXTERNAL_FIP_HOLD',
    message: error.message,
    source_package: {
      manifest_path: process.env.SXE_HANDOFF_MANIFEST_PATH || parseManifestArg(),
      declared_roles: details.declared_roles || [],
      selected_role: null
    },
    prediction: null,
    filters: [],
    missing_canonical_fields: details.missing_fields
      || details.internal_missing_fields
      || [],
    timeline: [
      {
        stage: 'EXTERNAL_SCOUT_FIP_INTAKE',
        status: 'HOLD',
        message: error.message
      },
      {
        stage: 'PREDICTION_ABSTAINED',
        status: 'PASS',
        message: 'No prediction was attempted because intake did not reach READY.'
      }
    ],
    safety: {
      production_database_write: false,
      supabase_write: false,
      external_provider_request: false,
      public_route_used: false,
      deployment_performed: false,
      full_fip_persisted: false,
      provider_fallback_calls: 0,
      network_calls: 0,
      scout_neon_calls: 0,
      marriage_invocations: 0,
      process_exit_code: 0
    }
  };
}

async function defaultRunMarriage({ externalFip, externalMetadata, receivedAt }) {
  const { main: runIsolatedPipeline } = require('./e2e-001e-local-marriage-runner');
  return runIsolatedPipeline({
    externalFip,
    externalMetadata,
    receivedAt
  });
}

async function runMarriageFlow(options = {}) {
  const manifestPath = options.manifestPath || parseManifestArg();
  const loadFn = options.loadExternalScoutFip || loadExternalScoutFip;
  const marryFn = options.runMarriage || defaultRunMarriage;

  const loaded = loadFn({
    manifestPath,
    allowedRoot: options.allowedRoot,
    now: options.now
  });

  if (loaded.result !== 'READY') {
    const payload = holdPayloadFromLoader(loaded, manifestPath);
    return payload;
  }

  const marriageResult = await marryFn({
    externalFip: loaded.canonical_fip,
    externalMetadata: loaded.metadata,
    receivedAt: (options.now instanceof Date ? options.now : new Date()).toISOString(),
    verification: loaded.verification
  });

  if (marriageResult && typeof marriageResult === 'object') {
    marriageResult.safety = {
      ...(marriageResult.safety || {}),
      marriage_invocations: 1
    };
  }

  return marriageResult;
}

async function main() {
  try {
    const payload = await runMarriageFlow({
      manifestPath: parseManifestArg()
    });
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(holdPayload(error))}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      result: 'FAIL',
      code: error.code || 'SXE_EXTERNAL_MARRIAGE_RUNNER_FAILURE',
      message: error.message
    })}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  holdPayload,
  holdPayloadFromLoader,
  runMarriageFlow,
  defaultRunMarriage,
  main,
  parseManifestArg
};
