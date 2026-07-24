'use strict';

const button = document.getElementById('run-button');
const status = document.getElementById('status');
const summary = document.getElementById('summary');
const timeline = document.getElementById('timeline');

function addSummary(label, value) {
  const term = document.createElement('dt');
  term.textContent = label;
  const detail = document.createElement('dd');
  detail.textContent = value == null ? '—' : String(value);
  summary.append(term, detail);
}

function render(payload) {
  summary.replaceChildren();
  timeline.replaceChildren();
  addSummary('Source package', payload.source_package?.selected_role || 'None');
  addSummary('Hash / integrity', payload.source_package ? 'Verified exact bytes' : 'Not available');
  addSummary('Intake result', payload.ok && payload.result === 'HOLD' ? 'HOLD' : payload.ok ? 'ACCEPTED' : 'FAILED');
  addSummary('Prediction', payload.prediction?.prediction || 'ABSTENTION');
  addSummary('Normal filter', payload.filters?.find((row) => row.tier === 'normal')?.is_valid ? 'Completed' : 'Not completed');
  addSummary('Deep filter', payload.filters?.find((row) => row.tier === 'deep')?.is_valid ? 'Completed' : 'Not completed');
  addSummary('Safety counters', `provider=${payload.safety?.provider_fallback_calls ?? 0}, network=${payload.safety?.network_calls ?? 0}, writes=${payload.safety?.production_database_write ? 1 : 0}`);
  status.textContent = payload.result === 'HOLD'
    ? `HOLD — ${payload.code || 'CANONICAL SCOUT FIP NOT PRESENT'}`
    : payload.ok ? 'PASS — LOCAL CONTROLLED PROOF' : `FAIL — ${payload.code || 'UNKNOWN'}`;
  for (const entry of payload.timeline || []) {
    const item = document.createElement('li');
    item.textContent = `${entry.stage}: ${entry.status} — ${entry.message}`;
    timeline.append(item);
  }
}

button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Running verified local handoff…';
  try {
    const response = await fetch('/api/run', { method: 'POST' });
    render(await response.json());
  } catch (_error) {
    status.textContent = 'FAIL — local laboratory request failed';
  } finally {
    button.disabled = false;
  }
});
