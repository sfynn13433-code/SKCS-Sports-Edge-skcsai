'use strict';

function isTruthy(value) {
    return value === true || String(value).trim().toLowerCase() === 'true';
}

function parseAllowlist(value) {
    return String(value || '')
        .split(',')
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean);
}

function run(context = {}) {
    const reasons = [];
    const warnings = [];
    const strictMode = isTruthy(context.strict_mode || process.env.SKCS_PIPELINE_STRICT);
    const caller = String(context.caller || context.source || context.operation || '').trim();
    const allowlist = parseAllowlist(context.allowedCallers || process.env.SKCS_PIPELINE_ALLOWED_CALLERS);
    const dryRun = isTruthy(context.dry_run || context.dryRun);

    if (!context || typeof context !== 'object') {
        reasons.push('Execution context must be an object.');
    }

    if (typeof context.execute !== 'function') {
        reasons.push('Missing execution function.');
    }

    if (!Object.prototype.hasOwnProperty.call(context, 'payload')) {
        reasons.push('Missing payload.');
    }

    if (strictMode && !caller) {
        reasons.push('Strict mode requires a known caller or operation.');
    }

    if (strictMode && allowlist.length > 0) {
        const normalizedCaller = caller.toLowerCase();
        const isAllowed = allowlist.some((item) => normalizedCaller === item || normalizedCaller.startsWith(item));
        if (!isAllowed) {
            reasons.push(`Caller "${caller || 'unknown'}" is not in the strict allowlist.`);
        }
    }

    if (dryRun) {
        warnings.push('Dry run mode enabled. No execution side effects should occur.');
    }

    return {
        allowed: reasons.length === 0,
        reason: reasons.length > 0 ? reasons.join(' ') : 'OK',
        warnings: [...warnings, ...(reasons.length > 0 ? reasons : [])],
        caller,
        strictMode,
        dryRun
    };
}

module.exports = {
    preflightSimulator: { run }
};
