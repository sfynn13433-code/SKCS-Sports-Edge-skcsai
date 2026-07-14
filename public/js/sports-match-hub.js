/**
 * SEM-GOV-001D-UI2 — Static Sports Match Hub controller (mock data only).
 */
(function () {
  'use strict';

  var mock = window.SportsMatchHubMock;
  if (!mock) return;

  var DEBOUNCE_MS = 300;
  var MIN_SEARCH = 2;
  var searchTimer = null;
  var lastFocusedCard = null;

  var els = {};

  function qs(id) {
    return document.getElementById(id);
  }

  function parseParams() {
    return new URLSearchParams(window.location.search);
  }

  function readState() {
    var params = parseParams();
    return {
      day: params.get('day') || 'TODAY',
      lifecycle: params.get('state') || '',
      competition: params.get('competition') || '',
      q: params.get('q') || '',
      archive: params.get('archive') || 'active',
      uiState: params.get('uiState') || 'normal',
      detail: params.get('detail') || ''
    };
  }

  function writeState(patch, replaceDetail) {
    var params = parseParams();
    Object.keys(patch).forEach(function (key) {
      var val = patch[key];
      if (val === '' || val === null || val === undefined) {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    if (replaceDetail === false) {
      params.delete('detail');
    }
    var query = params.toString();
    var url = query ? '?' + query : window.location.pathname;
    history.replaceState(null, '', url);
  }

  function sastParts(date) {
    var fmt = new Intl.DateTimeFormat('en-ZA', {
      timeZone: mock.TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      weekday: 'short'
    });
    var parts = fmt.formatToParts(date);
    var map = {};
    parts.forEach(function (p) {
      map[p.type] = p.value;
    });
    return map;
  }

  function sastOffsetDate(offsetDays) {
    var now = new Date();
    var parts = sastParts(now);
    var base = new Date(
      parts.year + '-' + parts.month + '-' + parts.day + 'T12:00:00+02:00'
    );
    base.setDate(base.getDate() + offsetDays);
    return base;
  }

  function dayTokenOffset(token) {
    if (token === 'TODAY') return 0;
    var m = /^DAY_(\d+)$/.exec(token);
    return m ? parseInt(m[1], 10) - 1 : 0;
  }

  function formatTabDate(token) {
    var d = sastOffsetDate(dayTokenOffset(token));
    var parts = sastParts(d);
    return parts.day + ' ' + parts.month;
  }

  function formatKickoff(iso) {
    var d = new Date(iso);
    return new Intl.DateTimeFormat('en-ZA', {
      timeZone: mock.TIMEZONE,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d) + ' SAST';
  }

  function formatShortTime(iso) {
    var d = new Date(iso);
    return new Intl.DateTimeFormat('en-ZA', {
      timeZone: mock.TIMEZONE,
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
  }

  function announce(message, priority) {
    var live = els.statusLive;
    if (!live) return;
    live.setAttribute('aria-live', priority || 'polite');
    live.textContent = '';
    window.setTimeout(function () {
      live.textContent = message;
    }, 10);
  }

  function filterFixtures(state) {
    var list = mock.fixtures.filter(function (fx) {
      if (fx.day_label !== state.day) return false;
      if (state.archive === 'active' && fx.archived) return false;
      if (state.archive === 'archived' && !fx.archived) return false;
      if (state.lifecycle && fx.lifecycle_state !== state.lifecycle) return false;
      if (state.competition && fx.competition !== state.competition) return false;
      if (state.q.length >= MIN_SEARCH) {
        var hay = (fx.home_team + ' ' + fx.away_team).toLowerCase();
        if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
      }
      return true;
    });
    return list.sort(function (a, b) {
      return a.kickoff_at.localeCompare(b.kickoff_at);
    });
  }

  function stateClass(code) {
    return 'lifecycle-badge lifecycle-badge--' + String(code || '').toLowerCase().replace(/_/g, '-');
  }

  function renderDayTabs(state) {
    var container = els.dayTabs;
    if (!container) return;
    container.innerHTML = '';
    mock.DAY_TOKENS.forEach(function (token, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day-tab' + (state.day === token ? ' day-tab--active' : '');
      btn.setAttribute('role', 'tab');
      btn.id = 'day-tab-' + token;
      btn.setAttribute('aria-selected', state.day === token ? 'true' : 'false');
      btn.setAttribute('aria-controls', 'fixture-panel');
      btn.setAttribute('tabindex', state.day === token ? '0' : '-1');
      btn.dataset.day = token;
      btn.innerHTML =
        '<span class="day-tab__label">' +
        escapeHtml(mock.DAY_USER_LABELS[token]) +
        '</span><span class="day-tab__date">' +
        escapeHtml(formatTabDate(token)) +
        '</span>';
      btn.addEventListener('click', function () {
        writeState({ day: token, detail: '' }, false);
        render();
        btn.focus();
      });
      container.appendChild(btn);
    });
    container.onkeydown = function (ev) {
      var tabs = Array.prototype.slice.call(container.querySelectorAll('[role="tab"]'));
      var idx = tabs.findIndex(function (t) {
        return t.getAttribute('aria-selected') === 'true';
      });
      if (idx < 0) return;
      var next = idx;
      if (ev.key === 'ArrowRight') next = Math.min(tabs.length - 1, idx + 1);
      else if (ev.key === 'ArrowLeft') next = Math.max(0, idx - 1);
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = tabs.length - 1;
      else return;
      ev.preventDefault();
      tabs[next].click();
      tabs[next].scrollIntoView({ inline: 'nearest', block: 'nearest' });
    };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderFilterChips(state) {
    var chips = els.filterChips;
    if (!chips) return;
    chips.innerHTML = '';
    var active = [];
    if (state.lifecycle) {
      active.push({ key: 'state', label: mock.STATE_LABELS[state.lifecycle] || state.lifecycle });
    }
    if (state.competition) active.push({ key: 'competition', label: state.competition });
    if (state.q.length >= MIN_SEARCH) active.push({ key: 'q', label: 'Team: ' + state.q });
    if (state.archive !== 'active') active.push({ key: 'archive', label: state.archive });
    active.forEach(function (chip) {
      var span = document.createElement('span');
      span.className = 'filter-chip';
      span.textContent = chip.label;
      chips.appendChild(span);
    });
    if (els.clearFilters) {
      els.clearFilters.hidden = active.length === 0;
    }
  }

  function syncFilterControls(state) {
    if (els.lifecycleFilter) {
      els.lifecycleFilter.value = state.lifecycle || '';
    }
    if (els.competitionFilter) {
      els.competitionFilter.value = state.competition || '';
    }
    if (els.teamSearch && document.activeElement !== els.teamSearch) {
      els.teamSearch.value = state.q;
    }
    if (els.archiveFilter) {
      els.archiveFilter.value = state.archive;
    }
    if (els.uiStateSelect) {
      els.uiStateSelect.value = state.uiState;
    }
  }

  function renderFixtureCard(fx) {
    var card = document.createElement('article');
    card.className = 'fixture-card fixture-card--' + fx.lifecycle_state.toLowerCase().replace(/_/g, '-');
    card.setAttribute('data-fixture-id', fx.public_fixture_id);

    var stageHint = '';
    if (
      (fx.lifecycle_state === 'UNDER_REVIEW' || fx.lifecycle_state === 'HELD') &&
      fx.lifecycle_stage_label
    ) {
      stageHint =
        '<p class="fixture-card__stage-hint">' + escapeHtml(fx.lifecycle_stage_label) + '</p>';
    }

    card.innerHTML =
      '<div class="fixture-card__header">' +
      '<span class="' +
      stateClass(fx.lifecycle_state) +
      '" aria-label="Status: ' +
      escapeHtml(fx.lifecycle_state_label) +
      '">' +
      escapeHtml(fx.lifecycle_state_label) +
      '</span>' +
      '</div>' +
      '<h3 class="fixture-card__teams">' +
      escapeHtml(fx.home_team) +
      ' <span class="fixture-card__vs">vs</span> ' +
      escapeHtml(fx.away_team) +
      '</h3>' +
      '<p class="fixture-card__competition">' +
      escapeHtml(fx.competition) +
      '</p>' +
      '<p class="fixture-card__kickoff"><time datetime="' +
      escapeHtml(fx.kickoff_at) +
      '">' +
      escapeHtml(formatKickoff(fx.kickoff_at)) +
      '</time></p>' +
      '<p class="fixture-card__day">' +
      escapeHtml(mock.DAY_USER_LABELS[fx.day_label] || fx.day_label) +
      '</p>' +
      stageHint +
      '<p class="fixture-card__summary">' +
      escapeHtml(fx.status_summary || '') +
      '</p>' +
      '<p class="fixture-card__freshness">Updated <time datetime="' +
      escapeHtml(fx.updated_at) +
      '">' +
      escapeHtml(formatShortTime(fx.updated_at)) +
      '</time></p>' +
      '<button type="button" class="fixture-card__action btn btn--primary">View fixture</button>';

    var btn = card.querySelector('.fixture-card__action');
    btn.addEventListener('click', function () {
      lastFocusedCard = btn;
      writeState({ detail: fx.public_fixture_id });
      render();
    });
    return card;
  }

  function renderPanelContent(state) {
    var panel = els.fixturePanel;
    if (!panel) return;

    panel.innerHTML = '';
    panel.setAttribute('role', 'tabpanel');
    panel.id = 'fixture-panel';
    panel.setAttribute('aria-labelledby', 'day-tab-' + state.day);

    if (state.detail) {
      renderDetail(state);
      return;
    }

    var ui = state.uiState;

    if (ui === 'loading') {
      panel.appendChild(stateBlock('Loading fixtures…', 'Fetching governed mock fixture data.', null, 'polite'));
      return;
    }
    if (ui === 'refresh') {
      panel.appendChild(stateBlock('Updating…', 'Refreshing fixture list.', null, 'polite'));
      return;
    }
    if (ui === 'unavailable') {
      panel.appendChild(
        stateBlock(
          'Sports Match Hub is temporarily unavailable.',
          'Static demonstration only. Retry reloads the page.',
          { label: 'Retry', action: function () { window.location.reload(); } },
          'assertive'
        )
      );
      return;
    }
    if (ui === 'lifecycle_unavailable') {
      panel.appendChild(
        stateBlock(
          'Lifecycle status temporarily unavailable',
          'Status labels could not be loaded in this demonstration.',
          { label: 'Retry', action: function () { writeState({ uiState: 'normal' }); render(); } },
          'assertive'
        )
      );
      return;
    }
    if (ui === 'no_data') {
      panel.appendChild(
        stateBlock(
          'Fixture status coming soon',
          'Production lifecycle data is not connected in UI2.',
          { label: 'Home', action: function () { window.location.href = 'index.html'; } },
          'polite'
        )
      );
      return;
    }
    if (ui === 'error') {
      panel.appendChild(
        stateBlock(
          'Something went wrong',
          'An unexpected error occurred in this static demonstration.',
          { label: 'Retry', action: function () { writeState({ uiState: 'normal' }); render(); } },
          'assertive'
        )
      );
      return;
    }

    if (ui === 'empty') {
      panel.appendChild(
        stateBlock(
          'No fixtures for ' + formatTabDate(state.day),
          'This day has no mock fixtures in the static dataset.',
          { label: 'Choose another day', action: function () { writeState({ day: 'DAY_2' }); render(); } },
          'polite'
        )
      );
      return;
    }

    var fixtures = filterFixtures(state);

    if (ui === 'no_match' || (fixtures.length === 0 && (state.lifecycle || state.competition || state.q))) {
      panel.appendChild(
        stateBlock(
          'No fixtures match filters',
          'Try clearing filters or choosing another day.',
          { label: 'Clear filters', action: clearAllFilters },
          'polite'
        )
      );
      return;
    }

    if (fixtures.length === 0) {
      panel.appendChild(
        stateBlock(
          'No fixtures for ' + formatTabDate(state.day),
          'This day has no mock fixtures in the static dataset.',
          { label: 'Choose another day', action: function () { writeState({ day: 'DAY_2' }); render(); } },
          'polite'
        )
      );
      return;
    }

    if (ui === 'stale') {
      var banner = document.createElement('div');
      banner.className = 'stale-banner';
      banner.setAttribute('role', 'status');
      banner.textContent =
        'Showing last updated ' + formatShortTime(fixtures[0].updated_at) + ' SAST — status may change.';
      panel.appendChild(banner);
    }

    var grid = document.createElement('div');
    grid.className = 'fixture-grid';
    grid.setAttribute('role', 'list');
    fixtures.forEach(function (fx) {
      var card = renderFixtureCard(fx);
      card.setAttribute('role', 'listitem');
      grid.appendChild(card);
    });
    panel.appendChild(grid);

    if (els.resultCount) {
      els.resultCount.textContent = fixtures.length + ' fixture' + (fixtures.length === 1 ? '' : 's');
    }
    if (els.freshness) {
      var latest = fixtures.reduce(function (a, b) {
        return a.updated_at > b.updated_at ? a : b;
      });
      els.freshness.innerHTML =
        'Last updated <time datetime="' +
        escapeHtml(latest.updated_at) +
        '">' +
        escapeHtml(formatShortTime(latest.updated_at)) +
        '</time> SAST';
    }
  }

  function stateBlock(heading, message, primary, livePriority) {
    var wrap = document.createElement('div');
    wrap.className = 'ui-state-block';
    wrap.setAttribute('role', livePriority === 'assertive' ? 'alert' : 'status');
    wrap.innerHTML =
      '<h2 class="ui-state-block__heading">' +
      escapeHtml(heading) +
      '</h2><p class="ui-state-block__message">' +
      escapeHtml(message) +
      '</p>';
    if (primary) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--primary';
      btn.textContent = primary.label;
      btn.addEventListener('click', primary.action);
      wrap.appendChild(btn);
    }
    announce(heading + '. ' + message, livePriority);
    return wrap;
  }

  function renderDetail(state) {
    var fx = mock.getFixtureById(state.detail);
    var panel = els.fixturePanel;
    if (!fx) {
      panel.appendChild(stateBlock('Fixture not found', 'The selected fixture is not in the mock dataset.', {
        label: 'Back to list',
        action: closeDetail
      }));
      return;
    }

    var dialog = document.createElement('div');
    dialog.className = 'fixture-detail';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'fixture-detail-title');

    var stages = ['ADMITTED', 'EVIDENCE_REVIEW', 'CONTEXT_REVIEW', 'STABILITY_REVIEW', 'PUBLICATION_REVIEW', 'FINAL_DECISION'];
    var stepper = '<ol class="stage-stepper" aria-label="Lifecycle stages">';
    stages.forEach(function (st) {
      var active = fx.lifecycle_stage === st ? ' stage-stepper__item--active' : '';
      var done = stages.indexOf(st) < stages.indexOf(fx.lifecycle_stage || '') ? ' stage-stepper__item--done' : '';
      stepper +=
        '<li class="stage-stepper__item' +
        active +
        done +
        '"><span>' +
        escapeHtml(mock.STAGE_LABELS[st]) +
        '</span></li>';
    });
    stepper += '</ol>';

    var timelineHtml = '';
    if (fx.lifecycle_timeline && fx.lifecycle_timeline.length) {
      timelineHtml = '<ol class="fixture-detail__timeline">';
      fx.lifecycle_timeline.forEach(function (ev) {
        timelineHtml +=
          '<li><time datetime="' +
          escapeHtml(ev.occurred_at) +
          '">' +
          escapeHtml(formatShortTime(ev.occurred_at)) +
          '</time> — ' +
          escapeHtml(ev.display_label) +
          '</li>';
      });
      timelineHtml += '</ol>';
    }

    var pub =
      fx.publication_eligible === true
        ? 'Publication may be available when live data connects. Informational only — not guaranteed.'
        : fx.publication_eligible === false
          ? 'Not eligible for publication under current review.'
          : 'Publication eligibility will be shown when review progresses.';

    dialog.innerHTML =
      '<button type="button" class="fixture-detail__close btn btn--ghost" id="detail-close">Back to fixtures</button>' +
      '<h2 id="fixture-detail-title" class="fixture-detail__title">' +
      escapeHtml(fx.home_team) +
      ' vs ' +
      escapeHtml(fx.away_team) +
      '</h2>' +
      '<p class="fixture-detail__competition">' +
      escapeHtml(fx.competition) +
      '</p>' +
      '<p class="fixture-detail__kickoff"><time datetime="' +
      escapeHtml(fx.kickoff_at) +
      '">' +
      escapeHtml(formatKickoff(fx.kickoff_at)) +
      '</time></p>' +
      '<p class="fixture-detail__day">' +
      escapeHtml(mock.DAY_USER_LABELS[fx.day_label]) +
      '</p>' +
      '<span class="' +
      stateClass(fx.lifecycle_state) +
      '">' +
      escapeHtml(fx.lifecycle_state_label) +
      '</span>' +
      stepper +
      '<p class="fixture-detail__summary">' +
      escapeHtml(fx.status_summary) +
      '</p>' +
      '<p class="fixture-detail__pub">' +
      escapeHtml(pub) +
      '</p>' +
      (fx.hold_category_public
        ? '<p class="fixture-detail__category"><strong>Hold:</strong> ' +
          escapeHtml(fx.hold_category_public) +
          '</p>'
        : '') +
      (fx.elimination_category_public
        ? '<p class="fixture-detail__category"><strong>Category:</strong> ' +
          escapeHtml(fx.elimination_category_public) +
          '</p>'
        : '') +
      '<p class="fixture-detail__freshness">Evidence fresh <time datetime="' +
      escapeHtml(fx.evidence_fresh_at) +
      '">' +
      escapeHtml(formatShortTime(fx.evidence_fresh_at)) +
      '</time>; updated <time datetime="' +
      escapeHtml(fx.updated_at) +
      '">' +
      escapeHtml(formatShortTime(fx.updated_at)) +
      '</time></p>' +
      timelineHtml;

    panel.appendChild(dialog);
    var closeBtn = dialog.querySelector('#detail-close');
    closeBtn.focus();
    closeBtn.addEventListener('click', closeDetail);
    dialog.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeDetail();
    });
  }

  function closeDetail() {
    writeState({ detail: '' }, false);
    render();
    if (lastFocusedCard) lastFocusedCard.focus();
  }

  function clearAllFilters() {
    writeState({ state: '', competition: '', q: '', archive: 'active' }, false);
    render();
    announce('Filters cleared', 'polite');
  }

  function populateCompetitions() {
    if (!els.competitionFilter) return;
    var current = els.competitionFilter.value;
    els.competitionFilter.innerHTML = '<option value="">All competitions</option>';
    mock.getCompetitions().forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      els.competitionFilter.appendChild(opt);
    });
    els.competitionFilter.value = current;
  }

  function bindEvents() {
    if (els.lifecycleFilter) {
      els.lifecycleFilter.addEventListener('change', function () {
        writeState({ lifecycle: els.lifecycleFilter.value }, false);
        render();
      });
    }
    if (els.competitionFilter) {
      els.competitionFilter.addEventListener('change', function () {
        writeState({ competition: els.competitionFilter.value }, false);
        render();
      });
    }
    if (els.archiveFilter) {
      els.archiveFilter.addEventListener('change', function () {
        writeState({ archive: els.archiveFilter.value }, false);
        render();
      });
    }
    if (els.teamSearch) {
      els.teamSearch.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          var q = els.teamSearch.value.trim();
          writeState({ q: q.length >= MIN_SEARCH ? q : '' }, false);
          render();
        }, DEBOUNCE_MS);
      });
    }
    if (els.clearFilters) {
      els.clearFilters.addEventListener('click', clearAllFilters);
    }
    if (els.uiStateSelect) {
      els.uiStateSelect.addEventListener('change', function () {
        writeState({ uiState: els.uiStateSelect.value, detail: '' }, false);
        render();
      });
    }
    if (els.filterToggle) {
      els.filterToggle.addEventListener('click', function () {
        els.filterSheet.classList.toggle('filter-sheet--open');
        var open = els.filterSheet.classList.contains('filter-sheet--open');
        els.filterToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    if (els.navToggle) {
      els.navToggle.addEventListener('click', function () {
        els.siteNav.classList.toggle('site-nav--open');
        var open = els.siteNav.classList.contains('site-nav--open');
        els.navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
  }

  function render() {
    var state = readState();
    if (mock.DAY_TOKENS.indexOf(state.day) === -1) {
      state.day = 'TODAY';
      writeState({ day: 'TODAY' }, false);
    }
    renderDayTabs(state);
    syncFilterControls(state);
    renderFilterChips(state);
    renderPanelContent(state);
    if (els.contextDate) {
      els.contextDate.textContent = formatTabDate(state.day);
    }
  }

  function init() {
    els.dayTabs = qs('day-tabs');
    els.fixturePanel = qs('fixture-panel');
    els.lifecycleFilter = qs('filter-lifecycle');
    els.competitionFilter = qs('filter-competition');
    els.teamSearch = qs('filter-team');
    els.archiveFilter = qs('filter-archive');
    els.filterChips = qs('filter-chips');
    els.clearFilters = qs('clear-filters');
    els.resultCount = qs('result-count');
    els.freshness = qs('freshness-indicator');
    els.statusLive = qs('status-announcer');
    els.uiStateSelect = qs('ui-state-demo');
    els.filterToggle = qs('filter-toggle');
    els.filterSheet = qs('filter-sheet');
    els.navToggle = qs('nav-toggle');
    els.siteNav = qs('site-nav');
    els.contextDate = qs('sast-context-date');

    populateCompetitions();
    bindEvents();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
