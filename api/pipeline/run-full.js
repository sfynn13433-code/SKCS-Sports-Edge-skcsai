'use strict';

function normalizeHost(value) {
    if (!value) return null;
    return String(value).trim().replace(/\/+$/, '');
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed' });
        return;
    }

    const host = normalizeHost(
        process.env.SCHEDULE_TARGET_HOST ||
        process.env.SKCS_TRIGGER_HOST ||
        process.env.RENDER_EXTERNAL_URL
    );
    const apiKey = process.env.ADMIN_API_KEY || process.env.SKCS_REFRESH_KEY;

    if (!host || !apiKey) {
        res.status(500).json({
            ok: false,
            error: 'Missing scheduler target host or API key'
        });
        return;
    }

    const target = new URL('/api/pipeline/run-full', host);

    try {
        const upstream = await fetch(target.toString(), {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                source: 'vercel_cron'
            })
        });

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
        res.status(502).json({
            ok: false,
            error: error.message
        });
    }
};
