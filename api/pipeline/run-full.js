'use strict';

function normalizeHost(value) {
    if (!value) return null;
    return String(value).trim().replace(/\/+$/, '');
}

function extractBearerToken(req) {
    const headerValue = req.headers?.authorization || req.headers?.Authorization;
    if (!headerValue) return null;
    const match = String(headerValue).match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
}

function parseTimeoutMs(value, fallbackMs = 20000) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
    return Math.floor(parsed);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed' });
        return;
    }

    const host = normalizeHost(
        process.env.SCHEDULE_TARGET_HOST ||
        process.env.SKCS_TRIGGER_HOST ||
        process.env.RENDER_EXTERNAL_URL ||
        'https://skcsai.onrender.com'
    );
    const apiKey = (
        process.env.ADMIN_API_KEY ||
        process.env.SKCS_REFRESH_KEY ||
        extractBearerToken(req) ||
        req.headers?.['x-api-key'] ||
        req.headers?.['X-API-KEY']
    );

    if (!host || !apiKey) {
        res.status(500).json({
            ok: false,
            error: 'Missing scheduler API key'
        });
        return;
    }

    const target = new URL('/api/pipeline/run-full', host);
    const timeoutMs = parseTimeoutMs(process.env.TRIGGER_TIMEOUT_MS, 20000);
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);

    try {
        const upstream = await fetch(target.toString(), {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'content-type': 'application/json'
            },
            signal: abort.signal,
            body: JSON.stringify({
                source: 'vercel_cron'
            })
        });
        clearTimeout(timer);

        const text = await upstream.text();
        let payload;
        try {
            payload = text ? JSON.parse(text) : null;
        } catch {
            payload = { raw: text };
        }

        res.status(upstream.ok ? 200 : upstream.status).json({
            ok: upstream.ok,
            status: upstream.status,
            target: target.toString(),
            payload
        });
    } catch (error) {
        clearTimeout(timer);
        const timedOut = error?.name === 'AbortError';
        res.status(502).json({
            ok: false,
            error: timedOut
                ? `Upstream timeout after ${timeoutMs}ms`
                : error.message
        });
    }
};
