'use strict';

const STAGES = [
  {
    key: 'FIP_CREATED',
    title: 'Scout FIP created'
  },
  {
    key: 'VALIDATION_HASH_VERIFIED',
    title: 'Validation hash verified'
  },
  {
    key: 'EDGE_INTAKE_ACCEPTED',
    title: 'Edge intake accepted'
  },
  {
    key: 'EDGE_ENVELOPE_CREATED',
    title: 'Edge analysis envelope created'
  },
  {
    key: 'PROVIDER_BYPASS_CONFIRMED',
    title: 'Legacy provider bypass confirmed'
  },
  {
    key: 'PREDICTION_GENERATED',
    title: 'Prediction generated'
  },
  {
    key: 'RAW_STORED_IN_MEMORY',
    title: 'Raw prediction stored in memory'
  },
  {
    key: 'NORMAL_FILTER_COMPLETED',
    title: 'Normal filter completed'
  },
  {
    key: 'DEEP_FILTER_COMPLETED',
    title: 'Deep filter completed'
  },
  {
    key: 'MARRIAGE_RUN_COMPLETED',
    title: 'Marriage run completed cleanly'
  }
];

const runButton = document.getElementById('run-button');
const runStatus = document.getElementById('run-status');
const timelineEl = document.getElementById('timeline');
const resultSection = document.getElementById('result-section');
const resultCards = document.getElementById('result-cards');
const failureSection = document.getElementById('failure-section');
const failureMessage = document.getElementById('failure-message');

let running = false;

function renderTimeline(stateMap = {}) {
  timelineEl.innerHTML = '';

  STAGES.forEach((stage, index) => {
    const state = stateMap[stage.key] || { status: 'WAITING', message: 'Waiting.' };
    const item = document.createElement('li');
    item.className = `timeline-item ${state.status.toLowerCase()}`;

    const statusClass =
      state.status === 'PASS'
        ? 'state-pass'
        : state.status === 'FAIL'
          ? 'state-fail'
          : state.status === 'RUNNING'
            ? 'state-running'
            : 'state-waiting';

    item.innerHTML = `
      <div class="timeline-index">${index + 1}</div>
      <div>
        <p class="timeline-title">${stage.title}</p>
        <p class="timeline-message">${state.message || ''}</p>
        <span class="timeline-state ${statusClass}">${state.status}</span>
      </div>
    `;

    timelineEl.appendChild(item);
  });
}

function setRunningState(isRunning) {
  running = isRunning;
  runButton.disabled = isRunning;
  runStatus.textContent = isRunning
    ? 'Scout is assembling a fresh governed FIP…'
    : 'Ready for another controlled marriage run.';
}

function hidePanels() {
  resultSection.classList.add('hidden');
  failureSection.classList.add('hidden');
  resultCards.innerHTML = '';
  failureMessage.textContent = '';
}

function addCard(label, value) {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <p class="card-label">${label}</p>
    <p class="card-value">${value ?? '—'}</p>
  `;
  resultCards.appendChild(card);
}

function timelineMapFromPayload(payload) {
  const map = {};

  for (const stage of STAGES) {
    map[stage.key] = {
      status: 'WAITING',
      message: 'Waiting.'
    };
  }

  for (const entry of payload.timeline || []) {
    map[entry.stage] = {
      status: entry.status,
      message: entry.message
    };
  }

  return map;
}

function renderSuccess(payload) {
  renderTimeline(timelineMapFromPayload(payload));

  resultSection.classList.remove('hidden');
  failureSection.classList.add('hidden');

  addCard('Fixture', `${payload.fixture.home_team} vs ${payload.fixture.away_team}`);
  addCard('Competition', payload.fixture.competition);
  addCard('Kickoff', new Date(payload.fixture.kickoff).toLocaleString());
  addCard('FIP ID', payload.fip.fip_id);
  addCard('Intake ID', payload.fip.intake_id);
  addCard('Validation Hash', payload.fip.validation_hash);
  addCard('Predicted Outcome', payload.prediction.prediction);
  addCard('Market', payload.prediction.market);
  addCard('Confidence', String(payload.prediction.confidence));
  addCard('Volatility', payload.prediction.volatility);
  addCard('Odds', payload.prediction.odds == null ? 'Not supplied' : String(payload.prediction.odds));
  addCard(
    'Normal Tier',
    payload.filters.find((row) => row.tier === 'normal')?.is_valid ? 'Valid' : 'Invalid'
  );
  addCard(
    'Deep Tier',
    payload.filters.find((row) => row.tier === 'deep')?.is_valid ? 'Valid' : 'Invalid'
  );
  addCard(
    'Safety Controls',
    [
      'No production database write',
      'No Supabase write',
      'No provider request',
      'No public route',
      'No deployment'
    ].join(' · ')
  );
}

function renderFailure(errorPayload) {
  const map = timelineMapFromPayload(errorPayload);

  for (const entry of errorPayload.timeline || []) {
    if (entry.status === 'FAIL') {
      map[entry.stage] = entry;
      break;
    }
  }

  const failedStage = (errorPayload.timeline || []).find((entry) => entry.status === 'FAIL');
  const stageTitle = failedStage
    ? STAGES.find((stage) => stage.key === failedStage.stage)?.title || failedStage.stage
    : 'Controlled marriage run';

  renderTimeline(map);

  failureSection.classList.remove('hidden');
  resultSection.classList.add('hidden');

  failureMessage.textContent = [
    `Failed stage: ${stageTitle}.`,
    `Code: ${errorPayload.code || 'E2E001E_RUN_FAILED'}.`,
    errorPayload.message || 'The controlled marriage run did not complete.'
  ].join(' ');
}

async function runMarriageTest() {
  if (running) {
    return;
  }

  hidePanels();
  setRunningState(true);

  const waitingMap = {};

  for (const stage of STAGES) {
    waitingMap[stage.key] = {
      status: 'WAITING',
      message: 'Waiting.'
    };
  }

  renderTimeline(waitingMap);

  try {
    const response = await fetch('/api/run', {
      method: 'POST'
    });

    const payload = await response.json();

    if (!response.ok || payload.ok !== true) {
      renderFailure(payload);
      return;
    }

    renderSuccess(payload);
  } catch (_error) {
    renderFailure({
      code: 'E2E001E_BROWSER_REQUEST_FAILED',
      message: 'The local marriage server could not complete the request.',
      timeline: []
    });
  } finally {
    setRunningState(false);
  }
}

runButton.addEventListener('click', () => {
  void runMarriageTest();
});

renderTimeline();
