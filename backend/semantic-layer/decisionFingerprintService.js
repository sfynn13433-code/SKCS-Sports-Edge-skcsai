'use strict';

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function buildDecisionFingerprint({ traceId, context, gate, health, result, verification, preflight, dryRun, strictMode, stageTimings }) {
    const rulesApplied = [];
    if (preflight?.strictMode) rulesApplied.push('strict_mode');
    if (gate?.mode) rulesApplied.push(`mode:${gate.mode}`);
    if (gate?.proceed === false) rulesApplied.push('gatekeeper_block');
    if (String(health?.state || verification?.state || '').toUpperCase() === 'DEGRADED') rulesApplied.push('degraded_state');
    if (String(health?.state || verification?.state || '').toUpperCase() === 'FAIL') rulesApplied.push('fail_state');
    if (dryRun) rulesApplied.push('dry_run');

    const dataSourcesUsed = safeArray(context?.data_sources_used || context?.dataSourcesUsed || context?.sources || [])
        .filter(Boolean)
        .map((value) => String(value));
    const semanticScore = Number.isFinite(Number(verification?.healthScore))
        ? Number(verification.healthScore)
        : (Number.isFinite(Number(health?.healthScore)) ? Number(health.healthScore) : null);

    return {
        traceId,
        trace_id: traceId,
        operation: context?.operation || context?.name || 'unknown',
        caller: context?.caller || context?.source || null,
        mode: gate?.mode || 'standard',
        proceed: gate?.proceed !== false,
        constraints: gate?.constraints || {},
        systemState: health?.state || verification?.state || 'UNKNOWN',
        controlState: health?.state || verification?.controlState || null,
        fallback_mode: gate?.mode === 'fallback' || verification?.actions?.useFallback === true,
        dry_run: dryRun === true,
        strict_mode: strictMode === true,
        data_sources_used: dataSourcesUsed,
        rules_applied: rulesApplied,
        semantic_score: semanticScore,
        stage_metrics: stageTimings || null,
        timestamp: new Date().toISOString(),
        payloadType: Array.isArray(context?.payload) ? 'array' : typeof context?.payload,
        resultType: Array.isArray(result) ? 'array' : typeof result,
        resultSummary: result && typeof result === 'object'
            ? {
                success: result.success === true,
                keys: Object.keys(result).slice(0, 20)
            }
            : null,
        verification_state: verification?.state || null,
        verification_reasons: safeArray(verification?.reasons),
        control_state: health?.controlState || verification?.controlState || null,
        preflight_reason: preflight?.reason || null
    };
}

module.exports = {
    buildDecisionFingerprint
};
