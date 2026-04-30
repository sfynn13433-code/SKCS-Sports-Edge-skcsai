'use strict';

require('dotenv').config();

const {
    refreshDailyCache,
    refreshLiveScores
} = require('../backend/services/cricApiCacheService');

function parseArgValue(args, key, fallback = null) {
    const prefix = `--${key}=`;
    const hit = args.find((arg) => arg.startsWith(prefix));
    if (!hit) return fallback;
    return hit.slice(prefix.length).trim();
}

async function main() {
    const args = process.argv.slice(2);
    const mode = String(parseArgValue(args, 'mode', 'daily') || 'daily').toLowerCase();

    if (mode === 'live') {
        const result = await refreshLiveScores({
            liveLimit: parseArgValue(args, 'liveLimit', null)
        });
        console.log(JSON.stringify({ ok: true, mode, result }, null, 2));
        return;
    }

    const result = await refreshDailyCache({
        featuredLimit: parseArgValue(args, 'featuredLimit', null),
        seriesLimit: parseArgValue(args, 'seriesLimit', null)
    });
    console.log(JSON.stringify({ ok: true, mode: 'daily', result }, null, 2));
}

main().catch((error) => {
    console.error(JSON.stringify({
        ok: false,
        error: error.message
    }, null, 2));
    process.exit(1);
});

