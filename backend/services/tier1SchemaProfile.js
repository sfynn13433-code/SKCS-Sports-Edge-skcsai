'use strict';

const TIER1_SCHEMA_PROFILES = Object.freeze({
    Football: Object.freeze({
        timeline_markers: Object.freeze(['H1', 'H2', 'ET', 'PEN']),
        scoring_events: Object.freeze(['goals', 'yellow_cards', 'red_cards', 'substitutions'])
    }),
    Basketball: Object.freeze({
        timeline_markers: Object.freeze(['Q1', 'Q2', 'Q3', 'Q4', 'OT1']),
        scoring_events: Object.freeze(['points', 'three_pointers', 'free_throws'])
    }),
    Rugby: Object.freeze({
        timeline_markers: Object.freeze(['H1', 'H2', 'ET']),
        scoring_events: Object.freeze(['tries', 'conversions', 'penalty_kicks', 'drop_goals'])
    }),
    MMA: Object.freeze({
        timeline_markers: Object.freeze(['R1', 'R2', 'R3', 'R4', 'R5']),
        scoring_events: Object.freeze(['knockdowns', 'takedowns', 'submission_attempts']),
        resolution_codes: Object.freeze(['KO_TKO', 'SUB', 'U_DEC', 'S_DEC', 'M_DEC', 'DRAW'])
    })
});

function normalizeTier1Sport(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return '';
    if (key === 'soccer' || key === 'association football' || key === 'football') return 'Football';
    if (key === 'basketball_nba' || key === 'nba' || key === 'basketball') return 'Basketball';
    if (key === 'rugby union' || key === 'rugby league' || key === 'rugby') return 'Rugby';
    if (key === 'mixed martial arts' || key === 'mma') return 'MMA';
    if (key === 'nfl' || key === 'american_football') return 'NFL';
    if (key === 'mlb' || key === 'baseball') return 'MLB';
    if (key === 'nhl' || key === 'hockey') return 'NHL';
    if (key === 'f1' || key === 'formula1') return 'F1';
    if (key === 'afl') return 'AFL';
    if (key === 'volleyball') return 'Volleyball';
    if (key === 'handball') return 'Handball';
    if (key === 'golf') return 'Golf';
    if (key === 'boxing') return 'Boxing';
    if (key === 'tennis') return 'Tennis';
    if (key === 'cricket') return 'Cricket';
    if (key === 'esports') return 'Esports';
    if (key === 'darts') return 'Darts';
    return key;
}

function buildTier1SchemaProfile(sport) {
    const normalized = normalizeTier1Sport(sport);
    return TIER1_SCHEMA_PROFILES[normalized] || null;
}

function mergeTier1SchemaIntoContext(baseContext, sport) {
    const profile = buildTier1SchemaProfile(sport);
    if (!profile) return baseContext && typeof baseContext === 'object' ? baseContext : {};

    const source = baseContext && typeof baseContext === 'object' ? baseContext : {};
    return {
        ...source,
        tier1_schema_profile: {
            sport: normalizeTier1Sport(sport),
            ...profile
        }
    };
}

module.exports = {
    TIER1_SCHEMA_PROFILES,
    normalizeTier1Sport,
    buildTier1SchemaProfile,
    mergeTier1SchemaIntoContext
};
