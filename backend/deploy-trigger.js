'use strict';

require('dotenv').config();

function normalizeHost(value) {
    if (!value) return null;
    return String(value).trim().replace(/\/+$/, '');
}

function parseTimeoutMs(value, fallbackMs = 20000) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
    return Math.floor(parsed);
}

async function main() {
    const host = normalizeHost(
        process.env.SKCS_TRIGGER_HOST ||
        process.env.SKCS_REFRESH_HOST ||
        process.env.RENDER_EXTERNAL_URL ||
        'https://skcsai.onrender.com'
    );
    const apiKey = process.env.ADMIN_API_KEY || process.env.SKCS_REFRESH_KEY || process.env.CRON_SECRET;

    if (!host) {
        throw new Error('Missing backend host. Set SKCS_TRIGGER_HOST, SKCS_REFRESH_HOST, or RENDER_EXTERNAL_URL.');
    }
    if (!apiKey) {
        throw new Error('Missing ADMIN_API_KEY (or SKCS_REFRESH_KEY).');
    }

    const url = new URL('/api/pipeline/run-full', host);
    const timeoutMs = parseTimeoutMs(process.env.TRIGGER_TIMEOUT_MS, 20000);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    let response;
    try {
        response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'content-type': 'application/json'
            },
            signal: abort.signal,
            body: JSON.stringify({
                source: 'weekly_rolling_scrape'
            })
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
        throw new Error(`run-full trigger failed with status ${response.status}: ${JSON.stringify(payload)}`);
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
            ? `Upstream timeout after ${parseTimeoutMs(process.env.TRIGGER_TIMEOUT_MS, 20000)}ms`
            : error.message
    }));
    process.exit(1);
});
