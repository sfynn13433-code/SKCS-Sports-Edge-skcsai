'use strict';

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function pluralize(count, one, many) {
    return `${count} ${count === 1 ? one : many}`;
}

function toRiskLabel(riskValue) {
    const risk = toNumber(riskValue, 0);
    if (risk >= 0.7) return 'High Risk';
    if (risk >= 0.4) return 'Medium Risk';
    return 'Low Risk';
}

function buildWeatherLabel(weatherMeta = {}) {
    const status = String(weatherMeta.status || '').trim().toLowerCase();
    if (!status || status === 'failed' || status === 'unavailable') return 'Unavailable';

    const condition = String(weatherMeta.condition || 'Clear').trim();
    const temp = Number(weatherMeta.temp_c);
    if (Number.isFinite(temp)) {
        return `${condition}, ${Math.round(temp)}°C`;
    }
    return condition;
}

function buildInjuryBanLabel(availabilityMeta = {}, disciplineMeta = {}) {
    const keyAbsences = toNumber(availabilityMeta.keyAbsences, 0);
    const squadAbsences = toNumber(availabilityMeta.squadAbsences, 0);
    const bans = Array.isArray(disciplineMeta.bans) ? disciplineMeta.bans.length : 0;

    if (keyAbsences > 0) {
        const base = pluralize(keyAbsences, 'key player out', 'key players out');
        return bans > 0 ? `${base}, ${pluralize(bans, 'ban', 'bans')}` : base;
    }
    if (bans > 0) return `${pluralize(bans, 'active ban', 'active bans')}`;
    if (squadAbsences > 0) return `${pluralize(squadAbsences, 'squad absence', 'squad absences')}`;
    return 'No major absences';
}

function buildContextInsightsFromMetadata(contextIntelligence) {
    const payload = contextIntelligence && typeof contextIntelligence === 'object'
        ? contextIntelligence
        : {};
    const signals = payload.signals && typeof payload.signals === 'object' ? payload.signals : {};
    const insights = payload.insights && typeof payload.insights === 'object' ? payload.insights : {};
    const weatherMeta = insights.weather && typeof insights.weather === 'object' ? insights.weather : {};
    const availabilityMeta = insights.availability && typeof insights.availability === 'object' ? insights.availability : {};
    const disciplineMeta = insights.discipline && typeof insights.discipline === 'object' ? insights.discipline : {};
    const stabilityMeta = insights.stability && typeof insights.stability === 'object' ? insights.stability : {};
    const lastVerified = payload.last_verified || null;

    return {
        status: payload.status || 'unavailable',
        weather: {
            label: buildWeatherLabel(weatherMeta),
            risk: toNumber(signals.weather_risk, 0),
            temp_c: Number.isFinite(Number(weatherMeta.temp_c)) ? Number(weatherMeta.temp_c) : null,
            condition: weatherMeta.condition || null
        },
        injuries_bans: {
            label: buildInjuryBanLabel(availabilityMeta, disciplineMeta),
            key_absences: toNumber(availabilityMeta.keyAbsences, 0),
            squad_absences: toNumber(availabilityMeta.squadAbsences, 0),
            bans: Array.isArray(disciplineMeta.bans) ? disciplineMeta.bans.length : 0
        },
        stability: {
            label: toRiskLabel(signals.stability_risk),
            risk: toNumber(signals.stability_risk, 0),
            flags: {
                coach_conflict: Boolean(stabilityMeta.coachConflict),
                exec_instability: Boolean(stabilityMeta.execInstability),
                fan_violence: Boolean(stabilityMeta.fanViolence),
                legal_issues: Array.isArray(stabilityMeta.playerLegalIssues) ? stabilityMeta.playerLegalIssues.length : 0
            }
        },
        last_verified: lastVerified,
        chips: {
            weather: buildWeatherLabel(weatherMeta),
            injuries_bans: buildInjuryBanLabel(availabilityMeta, disciplineMeta),
            stability: toRiskLabel(signals.stability_risk),
            last_verified: lastVerified
        }
    };
}

module.exports = {
    buildContextInsightsFromMetadata,
    toRiskLabel
};
