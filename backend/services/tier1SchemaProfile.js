'use strict';

const TIER1_SCHEMA_PROFILES = Object.freeze({
    football: Object.freeze({
        timeline_markers: Object.freeze(['H1', 'H2', 'ET', 'PEN']),
        scoring_events: Object.freeze(['goals', 'yellow_cards', 'red_cards', 'substitutions'])
    }),
    basketball: Object.freeze({
        timeline_markers: Object.freeze(['Q1', 'Q2', 'Q3', 'Q4', 'OT1']),
        scoring_events: Object.freeze(['points', 'three_pointers', 'free_throws'])
    }),
    rugby: Object.freeze({
        timeline_markers: Object.freeze(['H1', 'H2', 'ET']),
        scoring_events: Object.freeze(['tries', 'conversions', 'penalty_kicks', 'drop_goals'])
    }),
    mma: Object.freeze({
        timeline_markers: Object.freeze(['R1', 'R2', 'R3', 'R4', 'R5']),
        scoring_events: Object.freeze(['knockdowns', 'takedowns', 'submission_attempts']),
        resolution_codes: Object.freeze(['KO_TKO', 'SUB', 'U_DEC', 'S_DEC', 'M_DEC', 'DRAW'])
    })
});

function normalizeTier1Sport(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return '';
    if (key === 'soccer') return 'football';
    if (key === 'association football') return 'football';
    if (key === 'basketball_nba' || key === 'nba') return 'basketball';
    if (key === 'rugby union' || key === 'rugby league') return 'rugby';
    if (key === 'mixed martial arts') return 'mma';
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
