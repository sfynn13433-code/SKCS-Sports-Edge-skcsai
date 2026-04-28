'use strict';

require('dotenv').config();

function normalizeHost(value) {
    if (!value) return null;
    return String(value).trim().replace(/\/+$/, '');
}

function parseTimeoutMs(value, fallbackMs = 30000) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
    return Math.floor(parsed);
}

async function main() {
    const host = normalizeHost(
        process.env.SKCS_TRIGGER_HOST ||
        process.env.SKCS_REFRESH_HOST ||
        process.env.RENDER_EXTERNAL_URL ||
        'https://skcs-sports-edge-skcsai.onrender.com'
    );
    const cronSecret = String(process.env.CRON_SECRET || '').trim();

    if (!host) {
        throw new Error('Missing backend host. Set SKCS_TRIGGER_HOST, SKCS_REFRESH_HOST, or RENDER_EXTERNAL_URL.');
    }
    if (!cronSecret) {
        throw new Error('Missing CRON_SECRET.');
    }

    const url = new URL('/api/cron/cricket-daily-fixtures', host);
    const timeoutMs = parseTimeoutMs(process.env.CRICKET_TRIGGER_TIMEOUT_MS, 30000);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    let response;
    try {
        response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'x-cron-secret': cronSecret
            },
            signal: abort.signal
        });
    } finally {
        clearTimeout(timer);
    }

    const text = await response.text();
    let payload = null;
    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        payload = { raw: text };
    }

    if (!response.ok) {
        throw new Error(`cricket daily trigger failed with status ${response.status}: ${JSON.stringify(payload)}`);
    }

    console.log(JSON.stringify({
        ok: true,
        status: response.status,
        target: url.toString(),
        payload
    }));
}

main().catch((error) => {
    const isAbort = error?.name === 'AbortError' || String(error?.message || '').toLowerCase().includes('aborted');
    console.error(JSON.stringify({
        ok: false,
        error: isAbort
            ? `Upstream timeout after ${parseTimeoutMs(process.env.CRICKET_TRIGGER_TIMEOUT_MS, 30000)}ms`
            : error.message
    }));
    process.exit(1);
});
