'use strict';

const FAILURE_THRESHOLD = Math.max(1, Number(process.env.PROVIDER_CB_FAILURE_THRESHOLD || 3));
const COOLDOWN_MS = Math.max(5_000, Number(process.env.PROVIDER_CB_COOLDOWN_MS || 5 * 60 * 1000));
const MAX_ENTRIES = Math.max(100, Number(process.env.PROVIDER_CB_MAX_ENTRIES || 3000));

const state = new Map();

function nowMs() {
    return Date.now();
}

function normalizeSignature(signature) {
    const value = String(signature || '').trim();
    return value || 'unknown';
}

function pruneIfNeeded() {
    if (state.size <= MAX_ENTRIES) return;
    const entries = Array.from(state.entries())
        .sort((a, b) => Number(a[1]?.updatedAt || 0) - Number(b[1]?.updatedAt || 0));
    const removeCount = Math.max(1, state.size - MAX_ENTRIES);
    for (let i = 0; i < removeCount; i += 1) {
        state.delete(entries[i][0]);
    }
}

function read(signature) {
    const key = normalizeSignature(signature);
    const current = state.get(key);
    if (!current) {
        return {
            key,
            failures: 0,
            blockedUntil: 0,
            lastStatus: null,
            updatedAt: nowMs()
        };
    }
    return current;
}

function write(record) {
    state.set(record.key, record);
    pruneIfNeeded();
}

function shouldAllow(signature) {
    const record = read(signature);
    if (!record.blockedUntil) return true;
    if (record.blockedUntil <= nowMs()) {
        record.blockedUntil = 0;
        record.failures = 0;
        record.updatedAt = nowMs();
        write(record);
        return true;
    }
    return false;
}

function recordFailure(signature, status) {
    const record = read(signature);
    record.failures = Number(record.failures || 0) + 1;
    record.lastStatus = status || null;
    record.updatedAt = nowMs();
    if (record.failures >= FAILURE_THRESHOLD) {
        record.blockedUntil = nowMs() + COOLDOWN_MS;
    }
    write(record);
    return {
        failures: record.failures,
        blockedUntil: record.blockedUntil
    };
}

function recordSuccess(signature) {
    const record = read(signature);
    record.failures = 0;
    record.blockedUntil = 0;
    record.lastStatus = 200;
    record.updatedAt = nowMs();
    write(record);
}

function snapshot() {
    const now = nowMs();
    return Array.from(state.entries()).map(([key, value]) => ({
        key,
        failures: Number(value.failures || 0),
        blocked: Number(value.blockedUntil || 0) > now,
        blocked_until: Number(value.blockedUntil || 0) || null,
        last_status: value.lastStatus || null,
        updated_at: Number(value.updatedAt || 0) || null
    }));
}

module.exports = {
    shouldAllow,
    recordFailure,
    recordSuccess,
    snapshot
};

