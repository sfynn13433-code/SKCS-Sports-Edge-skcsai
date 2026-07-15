'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function source(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
}

const TARGETS = [
    'public/js/config.js',
    'js/config.js',
    'public/js/smh-hub.js',
    'public/js/user-experience-feedback.js',
    'public/js/vip-stress-dashboard.js'
];

test('ESEC-001-I1 browser sources contain no shared user credential', () => {
    for (const file of TARGETS) {
        const text = source(file);
        assert.doesNotMatch(text, /skcs_user_12345/, file);
        assert.doesNotMatch(text, /USER_API_KEY/, file);
        assert.doesNotMatch(text, /userApiKey/, file);
        assert.doesNotMatch(text, /['"]x-api-key['"]/, file);
    }
});

test('protected browser calls use Supabase session Bearer tokens', () => {
    for (const file of [
        'public/js/smh-hub.js',
        'public/js/user-experience-feedback.js',
        'public/js/vip-stress-dashboard.js'
    ]) {
        const text = source(file);
        assert.match(text, /supabaseClient\.auth\.getSession\(\)/, file);
        assert.match(text, /Authorization/, file);
        assert.match(text, /Bearer /, file);
    }
});

test('public configuration exposes no application authentication secret', () => {
    for (const file of ['public/js/config.js', 'js/config.js']) {
        const text = source(file);
        assert.match(text, /SUPABASE_ANON_KEY/, file);
        assert.doesNotMatch(text, /API_KEY\s*=\s*window\.USER_API_KEY/, file);
        assert.doesNotMatch(text, /userApiKey\s*:/, file);
    }
});

test('VIP authentication failures cannot fall back to public payload data', () => {
    const text = source('public/js/vip-stress-dashboard.js');
    assert.match(text, /error\?\.code === 'AUTH_REQUIRED'/);
    assert.match(text, /message\.includes\('\(401\)'\)/);
    assert.match(text, /message\.includes\('\(403\)'\)/);

    const authGuard = text.indexOf("error?.code === 'AUTH_REQUIRED'");
    const fallback = text.indexOf("fetch('data/vip-stress-saturday.json')");
    assert.ok(authGuard >= 0 && fallback > authGuard);
});

test('Packet 1 auth boundary remains fail-closed', () => {
    const auth = source('backend/utils/auth.js');
    const jwt = source('backend/middleware/supabaseJwt.js');

    assert.doesNotMatch(auth, /skcs_user_12345/);
    assert.doesNotMatch(jwt, /skcs_user_12345/);
    assert.match(jwt, /requireActiveSubscription/);
});
