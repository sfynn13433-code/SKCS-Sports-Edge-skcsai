/**
 * SEM-GOV-001D-UI2 governed static mock fixtures.
 * Public DTO shape only — no API, database, or prediction fields.
 */
(function (global) {
  'use strict';

  var DAY_TOKENS = [
    'TODAY',
    'DAY_2',
    'DAY_3',
    'DAY_4',
    'DAY_5',
    'DAY_6',
    'DAY_7',
    'DAY_8'
  ];

  var DAY_USER_LABELS = {
    TODAY: 'Today',
    DAY_2: 'Day 2',
    DAY_3: 'Day 3',
    DAY_4: 'Day 4',
    DAY_5: 'Day 5',
    DAY_6: 'Day 6',
    DAY_7: 'Day 7',
    DAY_8: 'Day 8'
  };

  var STATE_LABELS = {
    VISIBLE: 'Listed',
    UNDER_REVIEW: 'Under Review',
    HELD: 'On Hold',
    ELIMINATED: 'Not Publishing',
    FINAL_APPROVED: 'Review Complete',
    CANCELLED: 'Cancelled',
    POSTPONED: 'Postponed',
    ARCHIVED: 'Archived'
  };

  var STAGE_LABELS = {
    ADMITTED: 'Fixture Admitted',
    EVIDENCE_REVIEW: 'Evidence Review',
    CONTEXT_REVIEW: 'Context Review',
    STABILITY_REVIEW: 'Stability Review',
    PUBLICATION_REVIEW: 'Publication Review',
    FINAL_DECISION: 'Final Decision'
  };

  var STAGE_SEQUENCE = [
    'ADMITTED',
    'EVIDENCE_REVIEW',
    'CONTEXT_REVIEW',
    'STABILITY_REVIEW',
    'PUBLICATION_REVIEW',
    'FINAL_DECISION'
  ];

  var SYSTEM_STATUS_TEXT = 'Ready';

  function badgeFor(team) {
    var parts = String(team).trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return String(team).slice(0, 2).toUpperCase();
  }

  function funnelForDay(day) {
    var base = {
      TODAY: { admitted: 42, evidence: 35, context: 28, stability: 18, publication: 9, final: 4 },
      DAY_2: { admitted: 48, evidence: 40, context: 32, stability: 20, publication: 11, final: 5 },
      DAY_3: { admitted: 55, evidence: 46, context: 38, stability: 24, publication: 12, final: 6 },
      DAY_4: { admitted: 62, evidence: 52, context: 42, stability: 28, publication: 14, final: 7 },
      DAY_5: { admitted: 70, evidence: 58, context: 46, stability: 32, publication: 16, final: 8 },
      DAY_6: { admitted: 78, evidence: 64, context: 50, stability: 36, publication: 18, final: 9 },
      DAY_7: { admitted: 86, evidence: 72, context: 56, stability: 40, publication: 20, final: 10 },
      DAY_8: { admitted: 500, evidence: 420, context: 350, stability: 220, publication: 90, final: 40 }
    };
    var row = base[day] || base.TODAY;
    var admitted = row.admitted;
    return STAGE_SEQUENCE.map(function (stage, index) {
      var keys = ['admitted', 'evidence', 'context', 'stability', 'publication', 'final'];
      var count = row[keys[index]];
      return {
        stage: stage,
        label: STAGE_LABELS[stage],
        sequence: index + 1,
        count: count,
        percent: admitted ? Math.round((count / admitted) * 100) : 0
      };
    });
  }

  function movementForDay(day) {
    var map = {
      TODAY: { newToDay: 8, movedFromPrevious: 12, eliminated: 3, held: 2, approved: 1, cancelledPostponed: 1 },
      DAY_2: { newToDay: 10, movedFromPrevious: 14, eliminated: 4, held: 2, approved: 2, cancelledPostponed: 1 },
      DAY_3: { newToDay: 12, movedFromPrevious: 16, eliminated: 5, held: 3, approved: 2, cancelledPostponed: 2 },
      DAY_4: { newToDay: 14, movedFromPrevious: 18, eliminated: 5, held: 3, approved: 3, cancelledPostponed: 2 },
      DAY_5: { newToDay: 16, movedFromPrevious: 20, eliminated: 6, held: 4, approved: 3, cancelledPostponed: 2 },
      DAY_6: { newToDay: 18, movedFromPrevious: 22, eliminated: 6, held: 4, approved: 4, cancelledPostponed: 3 },
      DAY_7: { newToDay: 20, movedFromPrevious: 24, eliminated: 7, held: 5, approved: 4, cancelledPostponed: 3 },
      DAY_8: { newToDay: 120, movedFromPrevious: 380, eliminated: 45, held: 12, approved: 8, cancelledPostponed: 3 }
    };
    return map[day] || map.TODAY;
  }

  function narrativeForDay(day) {
    var m = movementForDay(day);
    var label = DAY_USER_LABELS[day] || day;
    return [
      m.newToDay + ' fixtures entered the review window on ' + label + ' (static mock).',
      m.movedFromPrevious + ' fixtures moved from the previous day in this demonstration.',
      m.eliminated + ' fixtures were eliminated during governed review.',
      m.held + ' fixtures are on hold pending additional context.',
      m.approved + ' fixtures reached final review completion in the mock dataset.'
    ];
  }

  function timeline(eventKey, fromState, toState, label, occurredAt) {
    return {
      event_key: eventKey,
      from_state: fromState,
      to_state: toState,
      display_label: label,
      occurred_at: occurredAt
    };
  }

  var fixtures = [
    {
      public_fixture_id: 'fx-kaizer-orlando-today',
      sport: 'football',
      home_team: 'Kaizer Chiefs',
      away_team: 'Orlando Pirates',
      competition: 'Premier Soccer League',
      kickoff_at: '2026-07-14T17:30:00+02:00',
      timezone: 'Africa/Johannesburg',
      day_label: 'TODAY',
      lifecycle_state: 'VISIBLE',
      lifecycle_state_label: 'Listed',
      lifecycle_stage: 'ADMITTED',
      lifecycle_stage_label: 'Fixture Admitted',
      evidence_fresh_at: '2026-07-14T08:15:00+02:00',
      updated_at: '2026-07-14T09:00:00+02:00',
      archived: false,
      detail_available: true,
      status_summary: 'Fixture admitted to the active review window.',
      publication_eligible: null,
      venue: 'FNB Stadium',
      country: 'South Africa',
      lifecycle_timeline: [
        timeline('ev-admit', null, 'VISIBLE', 'Fixture listed', '2026-07-14T06:00:00+02:00')
      ]
    },
    {
      public_fixture_id: 'fx-sundowns-supersport-today',
      sport: 'football',
      home_team: 'Mamelodi Sundowns',
      away_team: 'SuperSport United',
      competition: 'Premier Soccer League',
      kickoff_at: '2026-07-14T19:00:00+02:00',
      timezone: 'Africa/Johannesburg',
      day_label: 'TODAY',
      lifecycle_state: 'UNDER_REVIEW',
      lifecycle_state_label: 'Under Review',
      lifecycle_stage: 'EVIDENCE_REVIEW',
      lifecycle_stage_label: 'Evidence Review',
      evidence_fresh_at: '2026-07-14T07:45:00+02:00',
      updated_at: '2026-07-14T09:30:00+02:00',
      archived: false,
      detail_available: true,
      status_summary: 'Governed evidence checks are in progress.',
      publication_eligible: false,
      venue: 'Loftus Versfeld',
      country: 'South Africa',
      lifecycle_timeline: [
        timeline('ev-admit', null, 'VISIBLE', 'Fixture listed', '2026-07-13T18:00:00+02:00'),
        timeline('ev-review', 'VISIBLE', 'UNDER_REVIEW', 'Review started', '2026-07-14T07:00:00+02:00')
      ]
    },
    {
      public_fixture_id: 'fx-ajax-ct-city-today',
      sport: 'football',
      home_team: 'Ajax Cape Town',
      away_team: 'Cape Town City',
      competition: 'Premier Soccer League',
      kickoff_at: '2026-07-14T20:00:00+02:00',
      timezone: 'Africa/Johannesburg',
      day_label: 'TODAY',
      lifecycle_state: 'HELD',
      lifecycle_state_label: 'On Hold',
      lifecycle_stage: 'CONTEXT_REVIEW',
      lifecycle_stage_label: 'Context Review',
      evidence_fresh_at: '2026-07-14T06:30:00+02:00',
      updated_at: '2026-07-14T08:45:00+02:00',
      archived: false,
      detail_available: true,
      status_summary: 'Review paused pending additional context.',
      publication_eligible: false,
      hold_category_public: 'Awaiting squad confirmation',
      venue: 'Athlone Stadium',
      country: 'South Africa',
      lifecycle_timeline: [
        timeline('ev-admit', null, 'VISIBLE', 'Fixture listed', '2026-07-13T12:00:00+02:00'),
        timeline('ev-hold', 'UNDER_REVIEW', 'HELD', 'Placed on hold', '2026-07-14T08:00:00+02:00')
      ]
    },
    {
      public_fixture_id: 'fx-liverpool-city-day2',
      sport: 'football',
      home_team: 'Liverpool',
      away_team: 'Manchester City',
      competition: 'Premier League',
      kickoff_at: '2026-07-15T16:30:00+02:00',
      timezone: 'Africa/Johannesburg',
      day_label: 'DAY_2',
      lifecycle_state: 'FINAL_APPROVED',
      lifecycle_state_label: 'Review Complete',
      lifecycle_stage: 'FINAL_DECISION',
      lifecycle_stage_label: 'Final Decision',
      evidence_fresh_at: '2026-07-14T10:00:00+02:00',
      updated_at: '2026-07-14T10:15:00+02:00',
      archived: false,
      detail_available: true,
      status_summary: 'Required checks completed. Any insight remains informational and not guaranteed.',
      publication_eligible: true,
      venue: 'Anfield',
      country: 'England',
      lifecycle_timeline: [
        timeline('ev-admit', null, 'VISIBLE', 'Fixture listed', '2026-07-12T08:00:00+02:00'),
        timeline('ev-final', 'UNDER_REVIEW', 'FINAL_APPROVED', 'Review complete', '2026-07-14T10:00:00+02:00')
      ]
    },
    {
      public_fixture_id: 'fx-arsenal-chelsea-day2',
      sport: 'football',
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      competition: 'Premier League',
      kickoff_at: '2026-07-15T18:00:00+02:00',
      timezone: 'Africa/Johannesburg',
      day_label: 'DAY_2',
      lifecycle_state: 'ELIMINATED',
      lifecycle_state_label: 'Not Publishing',
      lifecycle_stage: 'PUBLICATION_REVIEW',
      lifecycle_stage_label: 'Publication Review',
      evidence_fresh_at: '2026-07-14T09:20:00+02:00',
      updated_at: '2026-07-14T09:45:00+02:00',
      archived: false,
      detail_available: true,
      status_summary: 'Fixture will not receive a published insight under current review.',
      publication_eligible: false,
      elimination_category_public: 'Publication criteria not met',
      venue: 'Emirates Stadium',
      country: 'England',
      lifecycle_timeline: [
        timeline('ev-elim', 'UNDER_REVIEW', 'ELIMINATED', 'Not publishing', '2026-07-14T09:30:00+02:00')
      ]
    },
    {
      public_fixture_id: 'fx-elclasico-day3',
      sport: 'football',
      home_team: 'Barcelona',
      away_team: 'Real Madrid',
      competition: 'La Liga',
      kickoff_at: '2026-07-16T21:00:00+02:00',
      timezone: 'Africa/Johannesburg',
      day_label: 'DAY_3',
      lifecycle_state: 'POSTPONED',
      lifecycle_state_label: 'Postponed',
      evidence_fresh_at: '2026-07-14T08:00:00+02:00',
      updated_at: '2026-07-14T08:30:00+02:00',
      archived: false,
      detail_available: true,
      status_summary: 'Fixture delayed; awaiting updated kickoff time.',
      publication_eligible: false,
      venue: 'Camp Nou',
      country: 'Spain',
      lifecycle_timeline: [
        timeline('ev-postpone', 'VISIBLE', 'POSTPONED', 'Fixture postponed', '2026-07-14T08:00:00+02:00')
      ]
    },
    {
      public_fixture_id: 'fx-inter-milan-day3',
      sport: 'football',
      home_team: 'Inter Milan',
      away_team: 'AC Milan',
      competition: 'Serie A',
      kickoff_at: '2026-07-16T20:45:00+02:00',
      timezone: 'Africa/Johannesburg',
      day_label: 'DAY_3',
      lifecycle_state: 'CANCELLED',
      lifecycle_state_label: 'Cancelled',
      evidence_fresh_at: '2026-07-14T07:00:00+02:00',
      updated_at: '2026-07-14T07:30:00+02:00',
      archived: false,
      detail_available: true,
      status_summary: 'Match is not expected to proceed.',
      publication_eligible: false,
      venue: 'San Siro',
      country: 'Italy',
      lifecycle_timeline: [
        timeline('ev-cancel', 'VISIBLE', 'CANCELLED', 'Fixture cancelled', '2026-07-14T07:00:00+02:00')
      ]
    },
    {
      public_fixture_id: 'fx-bafana-nigeria-day4',
      sport: 'football',
      home_team: 'Bafana Bafana',
      away_team: 'Nigeria',
      competition: 'AFCON Qualifier',
      kickoff_at: '2026-07-17T15:00:00+02:00',
      timezone: 'Africa/Johannesburg',
      day_label: 'DAY_4',
      lifecycle_state: 'VISIBLE',
      lifecycle_state_label: 'Listed',
      evidence_fresh_at: '2026-07-14T09:00:00+02:00',
      updated_at: '2026-07-14T09:10:00+02:00',
      archived: false,
      detail_available: true,
      status_summary: 'Fixture listed in the active window.',
      venue: 'FNB Stadium',
      country: 'South Africa',
      lifecycle_timeline: [
        timeline('ev-admit', null, 'VISIBLE', 'Fixture listed', '2026-07-14T08:00:00+02:00')
      ]
    },
    {
      public_fixture_id: 'fx-psg-marseille-day5',
      sport: 'football',
      home_team: 'Paris Saint-Germain',
      away_team: 'Marseille',
      competition: 'Ligue 1',
      kickoff_at: '2026-07-18T21:00:00+02:00',
      timezone: 'Africa/Johannesburg',
      day_label: 'DAY_5',
      lifecycle_state: 'UNDER_REVIEW',
      lifecycle_state_label: 'Under Review',
      lifecycle_stage: 'STABILITY_REVIEW',
      lifecycle_stage_label: 'Stability Review',
      evidence_fresh_at: '2026-07-14T08:30:00+02:00',
      updated_at: '2026-07-14T09:00:00+02:00',
      archived: false,
      detail_available: true,
      status_summary: 'Stability checks underway.',
      publication_eligible: false,
      venue: 'Parc des Princes',
      country: 'France',
      lifecycle_timeline: []
    },
    {
      public_fixture_id: 'fx-stellenbosch-chippa-day6',
      sport: 'football',
      home_team: 'Stellenbosch FC',
      away_team: 'Chippa United',
      competition: 'Premier Soccer League',
      kickoff_at: '2026-07-19T15:30:00+02:00',
      timezone: 'Africa/Johannesburg',
      day_label: 'DAY_6',
      lifecycle_state: 'VISIBLE',
      lifecycle_state_label: 'Listed',
      evidence_fresh_at: '2026-07-14T08:00:00+02:00',
      updated_at: '2026-07-14T08:20:00+02:00',
      archived: false,
      detail_available: true,
      status_summary: 'Fixture listed for Day 6.',
      venue: 'Danie Craven Stadium',
      country: 'South Africa',
      lifecycle_timeline: []
    },
    {
      public_fixture_id: 'fx-bayern-dortmund-day7',
      sport: 'football',
      home_team: 'Bayern Munich',
      away_team: 'Borussia Dortmund',
      competition: 'Bundesliga',
      kickoff_at: '2026-07-20T18:30:00+02:00',
      timezone: 'Africa/Johannesburg',
      day_label: 'DAY_7',
      lifecycle_state: 'VISIBLE',
      lifecycle_state_label: 'Listed',
      evidence_fresh_at: '2026-07-14T07:50:00+02:00',
      updated_at: '2026-07-14T08:00:00+02:00',
      archived: false,
      detail_available: true,
      status_summary: 'Fixture listed for Day 7.',
      venue: 'Allianz Arena',
      country: 'Germany',
      lifecycle_timeline: []
    },
    {
      public_fixture_id: 'fx-archived-derby',
      sport: 'football',
      home_team: 'Moroka Swallows',
      away_team: 'Golden Arrows',
      competition: 'Premier Soccer League',
      kickoff_at: '2026-07-10T15:00:00+02:00',
      timezone: 'Africa/Johannesburg',
      day_label: 'TODAY',
      lifecycle_state: 'ARCHIVED',
      lifecycle_state_label: 'Archived',
      lifecycle_stage: 'FINAL_DECISION',
      lifecycle_stage_label: 'Final Decision',
      evidence_fresh_at: '2026-07-10T14:00:00+02:00',
      updated_at: '2026-07-11T00:05:00+02:00',
      archived: true,
      detail_available: true,
      status_summary: 'Fixture left the active window and is retained in history.',
      publication_eligible: false,
      venue: 'Dobsonville Stadium',
      country: 'South Africa',
      lifecycle_timeline: [
        timeline('ev-archive', 'FINAL_APPROVED', 'ARCHIVED', 'Archived', '2026-07-11T00:05:00+02:00')
      ]
    }
  ];

  fixtures.forEach(function (fx) {
    fx.home_badge = badgeFor(fx.home_team);
    fx.away_badge = badgeFor(fx.away_team);
    if (!fx.competition_country && fx.country) {
      fx.competition_country = fx.country;
    }
  });

  global.SportsMatchHubMock = {
    DAY_TOKENS: DAY_TOKENS,
    DAY_USER_LABELS: DAY_USER_LABELS,
    STATE_LABELS: STATE_LABELS,
    STAGE_LABELS: STAGE_LABELS,
    STAGE_SEQUENCE: STAGE_SEQUENCE,
    SYSTEM_STATUS_TEXT: SYSTEM_STATUS_TEXT,
    TIMEZONE: 'Africa/Johannesburg',
    fixtures: fixtures,
    getLifecycleFunnel: function (day) {
      return funnelForDay(day);
    },
    getMovementSummary: function (day) {
      return movementForDay(day);
    },
    getDayNarrative: function (day) {
      return narrativeForDay(day);
    },
    getFixtureById: function (id) {
      for (var i = 0; i < fixtures.length; i += 1) {
        if (fixtures[i].public_fixture_id === id) return fixtures[i];
      }
      return null;
    },
    getCompetitions: function () {
      var set = {};
      fixtures.forEach(function (fx) {
        set[fx.competition] = true;
      });
      return Object.keys(set).sort();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
