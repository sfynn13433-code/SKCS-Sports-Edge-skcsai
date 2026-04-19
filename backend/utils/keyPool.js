'use strict';

const fs = require('fs');
const path = require('path');

function toNonEmptyString(value) {
    const text = String(value || '').trim();
    return text.length ? text : '';
}

function uniqueNonEmpty(values) {
    const out = [];
    const seen = new Set();
    for (const raw of Array.isArray(values) ? values : []) {
        const value = toNonEmptyString(raw);
        if (!value || seen.has(value)) continue;
        seen.add(value);
        out.push(value);
    }
    return out;
}

function parseCommaSeparatedEnv(name) {
    const raw = toNonEmptyString(process.env[name]);
    if (!raw) return [];
    return raw
        .split(',')
        .map((part) => toNonEmptyString(part))
        .filter(Boolean);
}

function collectFromPrefixes(prefixes, maxSlots) {
    const out = [];
    for (const prefixRaw of Array.isArray(prefixes) ? prefixes : []) {
        const prefix = toNonEmptyString(prefixRaw);
        if (!prefix) continue;

        out.push(process.env[prefix]);
        for (let i = 1; i <= maxSlots; i += 1) {
            out.push(process.env[`${prefix}_${i}`]);
        }
    }
    return out;
}

function collectFromRegex(regex) {
    if (!(regex instanceof RegExp)) return [];
    const out = [];
    for (const key of Object.keys(process.env)) {
        if (!regex.test(key)) continue;
        out.push(process.env[key]);
    }
    return out;
}

function stripWrappingQuotes(value) {
    const text = toNonEmptyString(value);
    if (!text) return '';
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('\'') && text.endsWith('\''))) {
        return text.slice(1, -1).trim();
    }
    return text;
}

function parseDotenvLine(line) {
    const raw = String(line || '');
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;

    const cleaned = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eqIndex = cleaned.indexOf('=');
    if (eqIndex <= 0) return null;

    const key = cleaned.slice(0, eqIndex).trim();
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

    const valueRaw = cleaned.slice(eqIndex + 1);
    return {
        key,
        value: stripWrappingQuotes(valueRaw)
    };
}

function getDotenvCandidatePaths() {
    const root = process.cwd();
    const backendDir = path.join(root, 'backend');
    return uniqueNonEmpty([
        path.join(root, '.env'),
        path.join(root, '.env.local'),
        path.join(backendDir, '.env'),
        path.join(backendDir, '.env.local')
    ]);
}

function collectFromDotenvFilesByRegex(regex) {
    if (!(regex instanceof RegExp)) return [];
    const out = [];
    const files = getDotenvCandidatePaths();

    for (const filePath of files) {
        try {
            if (!fs.existsSync(filePath)) continue;
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split(/\r?\n/);
            for (const line of lines) {
                const parsed = parseDotenvLine(line);
                if (!parsed) continue;
                if (!regex.test(parsed.key)) continue;
                out.push(parsed.value);
            }
        } catch (_error) {
            // Ignore unreadable env files and continue with available sources.
        }
    }

    return out;
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPrefixedKeyRegex(prefixes) {
    const parts = uniqueNonEmpty(prefixes).map((prefix) => escapeRegex(prefix));
    if (!parts.length) return null;
    return new RegExp(`^(?:${parts.join('|')})(?:_\\d+)?$`, 'i');
}

function normalizeSportToken(sport) {
    const key = toNonEmptyString(sport).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!key) return '';

    const aliases = {
        nfl: 'american_football',
        nba: 'basketball',
        mlb: 'baseball',
        nhl: 'hockey',
        formula_1: 'formula1',
        formula1: 'formula1',
        american_football: 'american_football'
    };
    return aliases[key] || key;
}

function sportSpecificPrefixes(sport) {
    const token = normalizeSportToken(sport);
    if (!token) return [];

    const mapped = {
        football: 'API_FOOTBALL_KEY',
        basketball: 'API_BASKETBALL_KEY',
        baseball: 'API_BASEBALL_KEY',
        hockey: 'API_HOCKEY_KEY',
        rugby: 'API_RUGBY_KEY',
        american_football: 'API_NFL_KEY',
        volleyball: 'API_VOLLEYBALL_KEY',
        handball: 'API_HANDBALL_KEY',
        afl: 'API_AFL_KEY',
        mma: 'API_MMA_KEY',
        formula1: 'API_FORMULA1_KEY',
        cricket: 'API_CRICKET_KEY',
        tennis: 'API_TENNIS_KEY'
    };

    const generic = `API_${token.toUpperCase()}_KEY`;
    return uniqueNonEmpty([mapped[token], generic]);
}

function getPoolMaxSlots() {
    const n = Number(process.env.KEY_POOL_MAX_SLOTS || 200);
    if (!Number.isFinite(n)) return 200;
    return Math.max(1, Math.min(1000, Math.floor(n)));
}

function getApiSportsKeyPool(options = {}) {
    const maxSlots = getPoolMaxSlots();
    const sport = options.sport || '';
    const fallbackKeys = Array.isArray(options.fallbackKeys) ? options.fallbackKeys : [];
    const sportPrefixes = sportSpecificPrefixes(sport);
    const sportRegex = buildPrefixedKeyRegex(sportPrefixes);
    const genericRegex = /^(X_APISPORTS_KEY|X_API_SPORTS_KEY|API_SPORTS_KEY|APISPORTS_KEY)(?:_\d+)?$/i;

    const values = [
        ...collectFromPrefixes(sportPrefixes, maxSlots),
        ...collectFromPrefixes(['X_APISPORTS_KEY', 'X_API_SPORTS_KEY', 'API_SPORTS_KEY', 'APISPORTS_KEY'], maxSlots),
        ...collectFromRegex(genericRegex),
        ...collectFromDotenvFilesByRegex(genericRegex),
        ...(sportRegex ? collectFromRegex(sportRegex) : []),
        ...(sportRegex ? collectFromDotenvFilesByRegex(sportRegex) : []),
        ...parseCommaSeparatedEnv('APISPORTS_KEYS'),
        ...fallbackKeys
    ];

    return uniqueNonEmpty(values);
}

function getRapidApiKeyPool(options = {}) {
    const maxSlots = getPoolMaxSlots();
    const fallbackKeys = Array.isArray(options.fallbackKeys) ? options.fallbackKeys : [];
    const rapidRegex = /^(X_)?RAPIDAPI_KEY(?:_\d+)?$|^RAPID_API_KEY(?:_\d+)?$/i;

    const values = [
        ...collectFromPrefixes(['X_RAPIDAPI_KEY', 'RAPIDAPI_KEY', 'RAPID_API_KEY'], maxSlots),
        ...collectFromRegex(rapidRegex),
        ...collectFromDotenvFilesByRegex(rapidRegex),
        ...parseCommaSeparatedEnv('RAPIDAPI_KEYS'),
        ...parseCommaSeparatedEnv('X_RAPIDAPI_KEYS'),
        ...fallbackKeys
    ];

    return uniqueNonEmpty(values);
}

function maskKey(value) {
    const key = toNonEmptyString(value);
    if (!key) return 'missing';
    if (key.length <= 8) return `${key.slice(0, 2)}***`;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

module.exports = {
    getApiSportsKeyPool,
    getRapidApiKeyPool,
    maskKey
};
