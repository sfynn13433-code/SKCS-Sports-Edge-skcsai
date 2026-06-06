'use strict';

const { query } = require('../db');

const BATCH_SIZE = Math.max(5, Number(process.env.SEMANTIC_VIOLATION_BATCH_SIZE || 20));
const FLUSH_INTERVAL_MS = Math.max(1000, Number(process.env.SEMANTIC_VIOLATION_FLUSH_MS || 5000));

const queue = [];
let flushPromise = null;
let flushTimer = null;
let loggerDisabled = false;
let disableReason = null;

function isMissingTableError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('semantic_violations') && message.includes('does not exist');
}

function disableLogger(reason) {
    if (loggerDisabled) return;
    loggerDisabled = true;
    disableReason = reason;
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
    queue.length = 0;
    console.warn('[SemanticViolationLogger] Disabled:', reason);
}

function ensureTimer() {
    if (loggerDisabled || flushTimer) return;
    flushTimer = setInterval(() => {
        void flushViolations('interval');
    }, FLUSH_INTERVAL_MS);
    if (typeof flushTimer.unref === 'function') {
        flushTimer.unref();
    }
}

function toJsonValue(value) {
    if (value === undefined) return null;
    return value;
}

function normalizeViolation(input = {}) {
    return {
        pipeline: String(input.pipeline || 'unknown').trim() || 'unknown',
        violation_type: String(input.violation_type || input.rule_id || 'UNKNOWN_VIOLATION').trim(),
        severity: String(input.severity || 'warning').trim().toLowerCase(),
        rule_id: String(input.rule_id || 'UNKNOWN_RULE').trim(),
        field_path: input.field_path == null ? null : String(input.field_path).trim(),
        raw_value: toJsonValue(input.raw_value ?? null),
        context: input.context && typeof input.context === 'object' ? input.context : {},
        game_id: Number.isFinite(Number(input.game_id)) ? Number(input.game_id) : null,
        message: String(input.message || '').trim(),
        resolved: input.resolved === true,
        occurred_at: input.occurred_at || new Date().toISOString()
    };
}

async function flushViolations(reason = 'manual') {
    if (loggerDisabled) {
        return { inserted: 0, reason, disabled: true, disableReason };
    }
    ensureTimer();
    if (flushPromise) return flushPromise;
    if (queue.length === 0) return { inserted: 0, reason };

    const batch = queue.splice(0, queue.length);
    flushPromise = (async () => {
        const columns = [
            'pipeline',
            'violation_type',
            'severity',
            'rule_id',
            'field_path',
            'raw_value',
            'context',
            'game_id',
            'message',
            'resolved',
            'occurred_at'
        ];

        const values = [];
        const placeholders = batch.map((entry, index) => {
            const offset = index * columns.length;
            values.push(
                entry.pipeline,
                entry.violation_type,
                entry.severity,
                entry.rule_id,
                entry.field_path,
                JSON.stringify(entry.raw_value),
                JSON.stringify(entry.context),
                entry.game_id,
                entry.message,
                entry.resolved,
                entry.occurred_at
            );
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}::jsonb, $${offset + 7}::jsonb, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`;
        });

        try {
            await query(
                `INSERT INTO public.semantic_violations (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`,
                values
            );
            return { inserted: batch.length, reason };
        } catch (error) {
            if (isMissingTableError(error)) {
                disableLogger('semantic_violations table missing — apply migration or restart after dbBootstrap');
                return { inserted: 0, reason, error, disabled: true };
            }
            console.error('[SemanticViolationLogger] Bulk flush failed:', error.message);
            return { inserted: 0, reason, error };
        } finally {
            flushPromise = null;
        }
    })();

    return flushPromise;
}

async function logViolation(input = {}) {
    if (loggerDisabled) {
        return { queued: false, disabled: true, disableReason };
    }
    ensureTimer();
    const entry = normalizeViolation(input);
    queue.push(entry);
    if (queue.length >= BATCH_SIZE) {
        return flushViolations('threshold');
    }
    return { queued: true, queueSize: queue.length };
}

function getQueuedViolationCount() {
    return queue.length;
}

module.exports = {
    flushViolations,
    getQueuedViolationCount,
    logViolation
};
