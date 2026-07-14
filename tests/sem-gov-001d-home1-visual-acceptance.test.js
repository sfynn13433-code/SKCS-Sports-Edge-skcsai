'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('CSS defines dark shell, nowrap desktop nav and touch targets', () => {
  const css = read('public/css/home-page.css');
  assert.match(css, /body\.home-page/);
  assert.match(css, /--home-bg:\s*#/);
  assert.match(css, /\.home-nav[\s\S]*flex-wrap:\s*nowrap/);
  assert.match(css, /--home-touch:\s*44px/);
  assert.match(css, /min-height:\s*var\(--home-touch\)/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /background:\s*#fff/);
  assert.doesNotMatch(css, /#0d6efd/);
});

test('HTML has mobile menu control and one back-to-top button', () => {
  const html = read('public/index.html');
  assert.match(html, /id="home-nav-toggle"/);
  assert.match(html, /id="home-nav"/);
  assert.equal((html.match(/id="back-to-top"/g) || []).length, 1);
  assert.match(html, /aria-label="Back to top"/);
});

test('JavaScript implements mobile nav, smooth anchors and back to top', () => {
  const js = read('public/js/home-page.js');
  assert.match(js, /home-nav-toggle/);
  assert.match(js, /scrollIntoView/);
  assert.match(js, /back-to-top/);
  assert.match(js, /behavior:\s*'smooth'/);
});

test('responsive breakpoints exist for tablet and mobile', () => {
  const css = read('public/css/home-page.css');
  assert.match(css, /@media \(max-width: 959px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /\.home-nav--open/);
  assert.match(css, /\.home-nav-toggle/);
});

for (const vp of [
  { name: 'desktop', width: 1440 },
  { name: 'tablet', width: 768 },
  { name: 'mobile', width: 390 }
]) {
  test(`static structure supports ${vp.name} viewport (${vp.width}px)`, () => {
    const html = read('public/index.html');
    const css = read('public/css/home-page.css');
    assert.match(html, /viewport/);
    if (vp.width <= 767) {
      assert.match(css, /home-nav-toggle/);
      assert.match(css, /home-preview__table thead/);
    }
    if (vp.width >= 960) {
      assert.match(css, /grid-template-columns:\s*repeat\(3/);
      assert.match(css, /grid-template-columns:\s*repeat\(6/);
    }
  });
}

test('visual contract prevents legacy sprawl regression', () => {
  const html = read('public/index.html');
  const css = read('public/css/home-page.css');
  assert.doesNotMatch(html, /<style\b/);
  assert.doesNotMatch(html, /output\.css/);
  assert.doesNotMatch(html, /pipeline-section-dark/);
  assert.doesNotMatch(html, /framework-section/);
  assert.doesNotMatch(html, /about-section/);
  assert.doesNotMatch(html, /contact-section/);
  assert.match(css, /\.home-preview/);
  assert.match(css, /\.home-stages/);
  assert.match(css, /\.home-trust-grid/);
});
