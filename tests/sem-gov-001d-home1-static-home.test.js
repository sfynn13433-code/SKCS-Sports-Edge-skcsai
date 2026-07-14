'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

const HUB_FILES = [
  'public/sports-match-hub.html',
  'public/css/sports-match-hub.css',
  'public/js/sports-match-hub.js',
  'public/js/sports-match-hub-mock-data.js'
];

const REMOVED_HOME_IDS = [
  'skcs-chatbot',
  'portal-container',
  'interactive-pipeline-section',
  'contact-form',
  'user-experience',
  'skcsMatchDetailModal',
  'system-health-banner'
];

const REMOVED_SCRIPTS = [
  'smh-hub.js',
  'supabase-init.js',
  'ai-reasoning-display.js',
  'acca-builder.js',
  'vip-stress-dashboard.js',
  'system-health-banner.js',
  'user-experience-feedback.js'
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

test('HOME1 files exist and index references home-page assets only', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'public/css/home-page.css')));
  assert.ok(fs.existsSync(path.join(ROOT, 'public/js/home-page.js')));
  const html = read('public/index.html');
  assert.match(html, /home-page\.css/);
  assert.match(html, /home-page\.js/);
  assert.doesNotMatch(html, /sports-match-hub\.js/);
  assert.doesNotMatch(html, /smh-hub\.js/);
  assert.doesNotMatch(html, /\/api\//);
  assert.doesNotMatch(html, /supabase/i);
});

test('exactly one h1 and semantic landmarks exist', () => {
  const html = read('public/index.html');
  const h1count = (html.match(/<h1\b/gi) || []).length;
  assert.equal(h1count, 1);
  assert.match(html, /<header\b/);
  assert.match(html, /<nav\b/);
  assert.match(html, /<main\b/);
  assert.match(html, /<footer\b/);
});

test('approved five-item primary navigation with Home current', () => {
  const html = read('public/index.html');
  const nav = html.match(/<nav[^>]*id="home-nav"[\s\S]*?<\/nav>/i);
  assert.ok(nav);
  const block = nav[0];
  assert.match(block, /aria-current="page"[^>]*>Home|>Home<\/a>/);
  assert.match(block, /Sports Match Hub/);
  assert.match(block, /Match Intelligence/);
  assert.match(block, /Subscribe/);
  assert.match(block, /Login/);
  assert.doesNotMatch(block, /AI Pipeline/i);
  assert.doesNotMatch(block, /Insights/i);
  assert.doesNotMatch(block, /Framework/i);
  assert.doesNotMatch(block, /About/i);
  assert.doesNotMatch(block, /User Experience/i);
  assert.doesNotMatch(block, /Contact/i);
  assert.doesNotMatch(block, /Language/i);
});

test('hero CTAs and required sections exist', () => {
  const html = read('public/index.html');
  assert.match(html, /Open Sports Match Hub/);
  assert.match(html, /See How It Works/);
  assert.match(html, /id="how-it-works"/);
  assert.match(html, /id="hub-preview"/);
  assert.match(html, /id="lifecycle-stages"/);
  assert.match(html, /id="trust-principles"/);
  assert.match(html, /id="subscribe-cta"/);
  assert.match(html, /hero-page\.webp/);
});

test('three-step, hub preview, six stages and four trust principles', () => {
  const html = read('public/index.html');
  assert.equal((html.match(/<article class="home-card home-step"/g) || []).length, 3);
  assert.match(html, /home-preview__days/);
  assert.equal((html.match(/class="home-preview__counter"/g) || []).length, 3);
  assert.equal((html.match(/home-preview__table[\s\S]*?<tbody>[\s\S]*?<\/tr>/g) || []).length, 1);
  assert.equal((html.match(/<tr>/g) || []).length, 4);
  assert.match(html, /home-preview__edgemind/);
  assert.equal((html.match(/<li class="home-card home-stage"/g) || []).length, 6);
  assert.match(html, /Fixture Admitted/);
  assert.match(html, /Final Decision/);
  assert.equal((html.match(/<article class="home-card home-trust"/g) || []).length, 4);
});

test('footer retains company and legal information', () => {
  const html = read('public/index.html');
  assert.match(html, /SKCS AI SPORTS EDGE \(PTY\) LTD/i);
  assert.match(html, /2025\/918368\/07/);
  assert.match(html, /20 Lotus Road, Northdale/);
  assert.match(html, /Pietermaritzburg, KwaZulu-Natal, 3201/);
  assert.match(html, /South Africa/);
  assert.match(html, /terms\.html/);
  assert.match(html, /privacy\.html/);
  assert.match(html, /language-switch\.html/);
  assert.match(html, /info@skcs\.co\.za/);
  assert.match(html, /Informational analytics only/);
});

test('removed legacy home components are absent', () => {
  const html = read('public/index.html');
  for (const id of REMOVED_HOME_IDS) {
    assert.doesNotMatch(html, new RegExp('id="' + id + '"'));
  }
  assert.doesNotMatch(html, /<style[\s\S]*navbar/);
  assert.doesNotMatch(html, /hub-card/);
  assert.doesNotMatch(html, /chatbot-sidebar/);
});

test('removed script tags are absent from home', () => {
  const html = read('public/index.html');
  for (const script of REMOVED_SCRIPTS) {
    assert.doesNotMatch(html, new RegExp(script.replace(/\./g, '\\.')));
  }
  assert.doesNotMatch(html, /@supabase\/supabase-js/);
  assert.doesNotMatch(html, /js\/config\.js/);
});

test('home-page.js has no network, API or Supabase callers', () => {
  const js = read('public/js/home-page.js');
  assert.doesNotMatch(js, /\bfetch\s*\(/);
  assert.doesNotMatch(js, /XMLHttpRequest/);
  assert.doesNotMatch(js, /supabase/i);
  assert.doesNotMatch(js, /\/api\//);
});

test('Sports Match Hub files remain unchanged from HEAD', () => {
  for (const rel of HUB_FILES) {
    const diff = execSync('git diff HEAD -- ' + rel, {
      cwd: ROOT,
      encoding: 'utf8'
    });
    assert.equal(diff, '', `unexpected change in ${rel}`);
  }
});

test('HOME1 packet and ledger register TESTED with blocked gates', () => {
  const packet = read('control-center/SEM-GOV-001D-HOME1_HOME_PAGE_INFORMATION_ARCHITECTURE_AND_VISUAL_CONSOLIDATION.v1.md');
  assert.match(packet, /SEM-GOV-001D-HOME1/);
  assert.match(packet, /ac7f29b91cda992727eaa34800307f08e674e7f2/);
  assert.match(packet, /TESTED/);
  assert.match(packet, /NOT APPLIED/i);
  assert.match(packet, /UI3.*NOT STARTED/i);

  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((t) => t.task_id === 'SEM-GOV-001D-HOME1');
  assert.ok(task);
  assert.equal(task.status, 'TESTED');
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.equal(ledger.unified_lifecycle_governor, 'BLOCKED');
});

test('project register mirrors SEM-GOV-001D-HOME1', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((p) => p.project_id === 'SEM-GOV-001D-HOME1');
  assert.ok(project);
  assert.equal(project.current_status, 'TESTED');
});
