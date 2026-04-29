'use strict';

require('dotenv').config({ path: 'backend/.env' });

const { URL } = require('url');

async function main() {
    const base = String(
        process.env.SKCS_BACKEND_URL
        || process.env.RENDER_EXTERNAL_URL
        || process.env.BACKEND_URL
        || 'http://127.0.0.1:10000'
    ).trim();

    const secret = String(process.env.CRON_SECRET || process.env.REFRESH_KEY || '').trim();
    if (!secret) {
        throw new Error('Missing CRON_SECRET/REFRESH_KEY for grade trigger.');
    }

    const sport = String(process.argv.find((arg) => arg.startsWith('--sport='))?.split('=')[1] || 'football').trim();
    const date = String(process.argv.find((arg) => arg.startsWith('--date='))?.split('=')[1] || '').trim();

    const url = new URL('/api/grade-predictions', base);
    url.searchParams.set('secret', secret);
    url.searchParams.set('sport', sport);
    if (date) url.searchParams.set('date', date);

    const response = await fetch(url.toString(), { method: 'POST', headers: { 'content-type': 'application/json' } });
    const text = await response.text();
    let payload = null;
    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        payload = { raw: text };
    }

    if (!response.ok) {
        throw new Error(`grade trigger failed with status ${response.status}: ${JSON.stringify(payload)}`);
    }

    console.log(JSON.stringify({ ok: true, status: response.status, payload }, null, 2));
}

main().catch((error) => {
    console.error('[trigger-grade] failed:', error.message);
    process.exit(1);
});
