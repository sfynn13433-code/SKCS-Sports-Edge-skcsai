'use strict';

const {
  DOMAIN_CODES,
  PROOF_FIXTURE_MODE,
  validateCanonicalFipIntake,
  mapValidatedFipToD3Dto,
  mapToEdgeAnalysisEnvelope,
  buildIntakeId
} = require('./fipIntakeService');

function assertDependency(name, value) {
  if (value === null || value === undefined) {
    throw new TypeError(`Missing required dependency: ${name}`);
  }
}

function rejectAdapter(code, message, partial = {}) {
  return {
    accepted: false,
    result: 'REJECTED',
    rejection_code: code,
    message,
    evidence: partial.evidence || null,
    envelope: null,
    d3_result: null,
    persistence_result: null,
    canonical_fip: partial.canonical_fip || null,
    downstream_calls: partial.downstream_calls || {
      identity: 0,
      lifecycle: 0,
      d3: 0,
      evidence: partial.evidence_calls || 0
    }
  };
}

function acceptAdapter({
  evidence,
  envelope,
  canonicalFip,
  d3Dto,
  persistenceResult,
  downstreamCalls
}) {
  return {
    accepted: true,
    result: 'ACCEPTED',
    rejection_code: null,
    message: 'Governed FIP intake accepted by isolated adapter.',
    evidence,
    envelope,
    canonical_fip: canonicalFip,
    d3_dto: d3Dto,
    persistence_result: persistenceResult,
    downstream_calls: downstreamCalls
  };
}

function buildBoundedEvidenceRecord({
  intakeId,
  canonicalFip,
  fixtureUid,
  receivedAt,
  outcome,
  rejectionCode,
  governedMode,
  callerIdentityRef,
  idempotencyKey
}) {
  return {
    intakeId,
    fipId: canonicalFip?.fip_id || null,
    fipSchemaVersion: canonicalFip?.fip_schema_version || null,
    fipValidationHash: canonicalFip?.validation?.hash || null,
    scoutFixtureId: canonicalFip?.scout?.fixture_id || null,
    fixtureUid: fixtureUid || null,
    scoutRunId: canonicalFip?.provenance?.scout_run_id || null,
    receivedAt,
    validatedAt: canonicalFip?.validation?.validated_at || null,
    outcome,
    rejectionCode: rejectionCode || null,
    governedMode,
    callerIdentityRef,
    idempotencyKey
  };
}

async function invokeEvidenceRecorder(recorder, method, args) {
  if (!recorder || typeof recorder[method] !== 'function') {
    return null;
  }

  const result = await recorder[method](...args);

  if (method === 'findAcceptedByIdempotencyKey') {
    if (!result) {
      return null;
    }
    if (typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'ok')) {
      if (!result.ok) {
        const err = new Error(result.code || DOMAIN_CODES.FIP_INTAKE_EVIDENCE_UNAVAILABLE);
        err.code = result.code || DOMAIN_CODES.FIP_INTAKE_EVIDENCE_UNAVAILABLE;
        throw err;
      }
      return result.found ? result.record : null;
    }
    return result;
  }

  if (
    result &&
    typeof result === 'object' &&
    Object.prototype.hasOwnProperty.call(result, 'ok') &&
    result.ok === false
  ) {
    const err = new Error(result.code || DOMAIN_CODES.FIP_INTAKE_EVIDENCE_UNAVAILABLE);
    err.code = result.code || DOMAIN_CODES.FIP_INTAKE_EVIDENCE_UNAVAILABLE;
    throw err;
  }

  return result;
}

function createGovernedFipIntakeAdapter(deps = {}) {
  assertDependency('fipIntakeService', deps.fipIntakeService);
  assertDependency('fixtureIdentityResolver', deps.fixtureIdentityResolver);
  assertDependency('displayMetadataPersistence', deps.displayMetadataPersistence);
  assertDependency('evidenceRecorder', deps.evidenceRecorder);
  assertDependency('gateReader', deps.gateReader);
  assertDependency('authorizeCaller', deps.authorizeCaller);
  assertDependency('clock', deps.clock);
  assertDependency('intakeIdGenerator', deps.intakeIdGenerator);

  const validateIntake =
    deps.fipIntakeService.validateCanonicalFipIntake || validateCanonicalFipIntake;
  const mapD3 = deps.fipIntakeService.mapValidatedFipToD3Dto || mapValidatedFipToD3Dto;
  const mapEnvelope = deps.fipIntakeService.mapToEdgeAnalysisEnvelope || mapToEdgeAnalysisEnvelope;

  async function recordRejectedEvidenceSafely(record, downstreamCalls) {
    if (!record || !deps.evidenceRecorder?.recordIntakeEvidence) {
      return downstreamCalls;
    }

    try {
      await invokeEvidenceRecorder(deps.evidenceRecorder, 'recordIntakeEvidence', [record]);
      return {
        ...downstreamCalls,
        evidence: (downstreamCalls.evidence || 0) + 1
      };
    } catch (err) {
      return downstreamCalls;
    }
  }

  async function receiveValidatedFip(fipPayload, context = {}) {
    const downstreamCalls = {
      identity: 0,
      lifecycle: 0,
      d3: 0,
      evidence: 0
    };

    const receivedAt = context.receivedAt || deps.clock.now();
    const governedMode = context.governedMode || PROOF_FIXTURE_MODE;
    const callerIdentityRef = String(context.caller || '').trim();
    const maxFipBytes = context.maxFipBytes;

    if (deps.featureFlagEnabled === false) {
      return rejectAdapter(
        DOMAIN_CODES.FIP_FEATURE_DISABLED,
        'Governed FIP intake adapter is disabled.',
        { downstream_calls: downstreamCalls }
      );
    }

    const gates = await deps.gateReader.readGates();
    if (
      governedMode === 'AUTHORIZED_PRODUCTION' &&
      gates.scoutEdgeMarriageGate !== 'CLEARED'
    ) {
      return rejectAdapter(
        DOMAIN_CODES.FIP_MARRIAGE_GATE_BLOCKED,
        'Production intake blocked while marriage gate remains closed.',
        { downstream_calls: downstreamCalls }
      );
    }

    const auth = await deps.authorizeCaller({
      caller: callerIdentityRef,
      governedMode,
      gates,
      context
    });
    if (!auth?.authorized) {
      return rejectAdapter(
        auth?.code || DOMAIN_CODES.FIP_INTAKE_UNAUTHORIZED,
        auth?.message || 'Caller is not authorized for governed FIP intake.',
        { downstream_calls: downstreamCalls }
      );
    }

    const validation = validateIntake(fipPayload, {
      caller: callerIdentityRef,
      governedMode,
      receivedAt,
      scoutEdgeMarriageGate: gates.scoutEdgeMarriageGate,
      supabaseStorageGate: gates.supabaseStorageGate,
      maxFipBytes
    });

    if (!validation.accepted) {
      const canonical = validation.canonical_fip || null;
      const idempotencyKey = validation.evidence?.idempotency_key || null;
      const intakeId =
        validation.evidence?.intake_id ||
        buildIntakeId({
          fipId: canonical?.fip_id,
          validationHash: canonical?.validation?.hash,
          receivedAt
        });

      const rejectedCalls = await recordRejectedEvidenceSafely(
        buildBoundedEvidenceRecord({
          intakeId,
          canonicalFip: canonical,
          fixtureUid: null,
          receivedAt,
          outcome: 'REJECTED',
          rejectionCode: validation.rejection_code,
          governedMode,
          callerIdentityRef,
          idempotencyKey
        }),
        downstreamCalls
      );

      return {
        ...validation,
        downstream_calls: {
          identity: 0,
          lifecycle: 0,
          d3: 0,
          evidence: rejectedCalls.evidence
        }
      };
    }

    const canonical = validation.canonical_fip;
    const idempotencyKey = validation.idempotency_key;
    const intakeId =
      deps.intakeIdGenerator({
        fipId: canonical.fip_id,
        validationHash: canonical.validation.hash,
        receivedAt
      }) || validation.intake_id;

    if (deps.evidenceRecorder?.findAcceptedByIdempotencyKey) {
      const prior = await invokeEvidenceRecorder(
        deps.evidenceRecorder,
        'findAcceptedByIdempotencyKey',
        [idempotencyKey]
      );
      if (prior) {
        if (
          prior.fipValidationHash &&
          prior.fipValidationHash !== canonical.validation.hash
        ) {
          return rejectAdapter(
            DOMAIN_CODES.FIP_IDEMPOTENCY_DUPLICATE,
            'Duplicate idempotency key with conflicting validation hash.',
            { downstream_calls: downstreamCalls }
          );
        }

        return acceptAdapter({
          evidence: prior,
          envelope: mapEnvelope(canonical, validation.evidence),
          canonicalFip: canonical,
          d3Dto: null,
          persistenceResult: { ok: true, code: 'NO_OP', idempotent: true },
          downstreamCalls
        });
      }
    }

    downstreamCalls.identity += 1;
    const identity = await deps.fixtureIdentityResolver.resolveScoutFixtureId(
      canonical.scout.fixture_id
    );
    if (!identity.ok) {
      const rejectedCalls = await recordRejectedEvidenceSafely(
        buildBoundedEvidenceRecord({
          intakeId,
          canonicalFip: canonical,
          fixtureUid: null,
          receivedAt,
          outcome: 'REJECTED',
          rejectionCode: identity.code,
          governedMode,
          callerIdentityRef,
          idempotencyKey
        }),
        downstreamCalls
      );

      return rejectAdapter(
        identity.code,
        'Fixture identity could not be resolved.',
        {
          downstream_calls: {
            ...downstreamCalls,
            evidence: rejectedCalls.evidence
          }
        }
      );
    }

    downstreamCalls.lifecycle += 1;
    const lifecycle = await deps.fixtureIdentityResolver.confirmLifecycleParent(
      identity.fixtureUid
    );
    if (!lifecycle.ok) {
      const rejectedCalls = await recordRejectedEvidenceSafely(
        buildBoundedEvidenceRecord({
          intakeId,
          canonicalFip: canonical,
          fixtureUid: identity.fixtureUid,
          receivedAt,
          outcome: 'REJECTED',
          rejectionCode: lifecycle.code,
          governedMode,
          callerIdentityRef,
          idempotencyKey
        }),
        downstreamCalls
      );

      return rejectAdapter(
        lifecycle.code,
        'Lifecycle parent is missing for resolved fixture_uid.',
        {
          downstream_calls: {
            ...downstreamCalls,
            evidence: rejectedCalls.evidence
          }
        }
      );
    }

    const d3Mapped = mapD3(canonical, {
      fixtureUid: identity.fixtureUid,
      intakeId,
      idempotencyKey
    });
    if (!d3Mapped.ok) {
      return rejectAdapter(
        d3Mapped.code || DOMAIN_CODES.FIP_D3_MAP_FAILED,
        d3Mapped.message || 'D3 DTO mapping failed.',
        { downstream_calls: downstreamCalls, canonical_fip: canonical }
      );
    }

    downstreamCalls.d3 += 1;
    const persistence = await deps.displayMetadataPersistence.upsertFromValidatedIntake(
      d3Mapped.dto
    );
    if (!persistence?.ok) {
      return rejectAdapter(
        DOMAIN_CODES.FIP_PERSISTENCE_FAILED,
        'D3 persistence failed for validated intake.',
        {
          downstream_calls: downstreamCalls,
          canonical_fip: canonical
        }
      );
    }

    let envelope;
    try {
      envelope = mapEnvelope(canonical, validation.evidence);
    } catch (err) {
      return rejectAdapter(
        DOMAIN_CODES.FIP_ENVELOPE_MAP_FAILED,
        'EdgeAnalysisEnvelope mapping failed.',
        { downstream_calls: downstreamCalls, canonical_fip: canonical }
      );
    }

    const acceptedEvidence = buildBoundedEvidenceRecord({
      intakeId,
      canonicalFip: canonical,
      fixtureUid: identity.fixtureUid,
      receivedAt,
      outcome: 'ACCEPTED',
      rejectionCode: null,
      governedMode,
      callerIdentityRef,
      idempotencyKey
    });

    try {
      await deps.evidenceRecorder.recordIntakeEvidence(acceptedEvidence);
      downstreamCalls.evidence += 1;
    } catch (err) {
      return rejectAdapter(
        DOMAIN_CODES.FIP_INTAKE_EVIDENCE_UNAVAILABLE,
        'Accepted intake evidence could not be recorded.',
        { downstream_calls: downstreamCalls, canonical_fip: canonical }
      );
    }

    return acceptAdapter({
      evidence: acceptedEvidence,
      envelope,
      canonicalFip: canonical,
      d3Dto: d3Mapped.dto,
      persistenceResult: persistence,
      downstreamCalls
    });
  }

  return {
    receiveValidatedFip
  };
}

module.exports = {
  createGovernedFipIntakeAdapter,
  buildBoundedEvidenceRecord
};
