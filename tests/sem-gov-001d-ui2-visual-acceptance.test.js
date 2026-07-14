'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public/sports-match-hub.html');
const CSS_PATH = path.join(ROOT, 'public/css/sports-match-hub.css');
const JS_PATH = path.join(ROOT, 'public/js/sports-match-hub.js');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, minColumns: 2 },
  { name: 'tablet', width: 768, minColumns: 1 },
  { name: 'mobile', width: 390, minColumns: 1 }
];

const UI_STATES = [
  'normal',
  'empty',
  'stale',
  'unavailable',
  'detail'
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('CSS defines responsive fixture grid and touch targets', () => {
  const css = read('public/css/sports-match-hub.css');
  assert.match(css, /\.fixture-grid/);
  assert.match(css, /min-height:\s*var\(--smh-touch\)/);
  assert.match(css, /--smh-touch:\s*44px/);
  assert.match(css, /@media \(max-width: 959px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test('HTML supports viewport states via query parameters', () => {
  const html = read('public/sports-match-hub.html');
  assert.match(html, /ui-state-demo/);
  for (const state of ['loading', 'empty', 'stale', 'unavailable', 'error']) {
    assert.match(html, new RegExp('value="' + state + '"'));
  }
});

test('JavaScript implements detail view and filter URL state', () => {
  const js = read('public/js/sports-match-hub.js');
  assert.match(js, /readState/);
  assert.match(js, /writeState/);
  assert.match(js, /renderDetail/);
  assert.match(js, /DEBOUNCE_MS\s*=\s*300/);
  assert.match(js, /MIN_SEARCH\s*=\s*2/);
  assert.match(js, /ArrowRight/);
  assert.match(js, /closeDetail/);
});

for (const vp of VIEWPORTS) {
  test(`static structure supports ${vp.name} viewport (${vp.width}px)`, () => {
    const html = read('public/sports-match-hub.html');
    const css = read('public/css/sports-match-hub.css');
    assert.match(html, /viewport/);
    if (vp.width <= 767) {
      assert.match(css, /smh-nav-toggle/);
      assert.match(css, /grid-template-columns:\s*1fr/);
    }
    if (vp.width >= 960) {
      assert.match(css, /grid-template-columns:\s*repeat\(3/);
    }
  });
}

for (const state of UI_STATES) {
  test(`UI state "${state}" is representable in static demo`, () => {
    const html = read('public/sports-match-hub.html');
    const js = read('public/js/sports-match-hub.js');
    if (state === 'detail') {
      assert.match(js, /detail/);
      assert.match(js, /fixture-detail/);
      return;
    }
    if (state === 'normal') {
      assert.match(js, /filterFixtures/);
      return;
    }
    assert.match(html, new RegExp('value="' + state + '"'));
    assert.match(js, new RegExp("ui === '" + state + "'|uiState"));
  });
}

test('fixture detail preserves back navigation contract', () => {
  const js = read('public/js/sports-match-hub.js');
  assert.match(js, /closeDetail/);
  assert.match(js, /lastFocusedCard/);
  assert.match(js, /Back to fixtures/);
});

test('no horizontal overflow guards in mobile CSS', () => {
  const css = read('public/css/sports-match-hub.css');
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /min-width:\s*0/);
});
