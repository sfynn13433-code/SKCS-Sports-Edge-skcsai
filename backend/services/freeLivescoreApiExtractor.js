'use strict';

function toStringOrNull(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

function toBooleanOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        if (value === 1) return true;
        if (value === 0) return false;
    }
    const text = String(value).trim().toLowerCase();
    if (!text) return null;
    if (['true', '1', 'yes', 'y'].includes(text)) return true;
    if (['false', '0', 'no', 'n'].includes(text)) return false;
    return null;
}

function pickFirstDefined(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return null;
}

function mapTeam(team) {
    const item = team && typeof team === 'object' ? team : {};
    return {
        provider_team_id: toStringOrNull(item.ID),
        name: toStringOrNull(item.Nm),
        country_name: toStringOrNull(item.CoNm),
        country_code: toStringOrNull(item.CoId),
        abbreviation: toStringOrNull(item.Abr),
        is_national: toBooleanOrNull(
            pickFirstDefined(item.Nat, item.national)
        ),
        image: toStringOrNull(item.Img),
        sport_id: toStringOrNull(item.Spid),
        raw_keys: Object.keys(item)
    };
}

function mapStage(stage) {
    const item = stage && typeof stage === 'object' ? stage : {};
    return {
        provider_stage_id: toStringOrNull(item.Sid),
        stage_name: toStringOrNull(item.Snm),
        stage_code: toStringOrNull(item.Scd),
        country_name: toStringOrNull(item.Cnm),
        country_id: toStringOrNull(item.Cid),
        country_code: toStringOrNull(item.Ccd),
        competition_id: toStringOrNull(item.CompId),
        competition_name: toStringOrNull(item.CompN),
        competition_display_country: toStringOrNull(item.CompD),
        competition_slug: toStringOrNull(
            pickFirstDefined(item.CompST, item.CompUrlName, item.Scu)
        ),
        sport_id: toStringOrNull(item.Spid),
        raw_keys: Object.keys(item)
    };
}

function mapCategory(category) {
    const item = category && typeof category === 'object' ? category : {};
    return {
        provider_category_id: toStringOrNull(item.Cid),
        name: toStringOrNull(item.Cnm),
        slug: toStringOrNull(
            pickFirstDefined(item.Scd, item.CnmT, item.Ccd)
        ),
        country_code: toStringOrNull(item.Ccd),
        sport_id: toStringOrNull(item.Spid),
        raw_keys: Object.keys(item)
    };
}

function extractFreeLivescoreSearch(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const response = source.response && typeof source.response === 'object' ? source.response : {};
    const teamsSource = Array.isArray(response.Teams) ? response.Teams : [];
    const stagesSource = Array.isArray(response.Stages) ? response.Stages : [];
    const categoriesSource = Array.isArray(response.Categories) ? response.Categories : [];
    const sortingSource = Array.isArray(response.Sorting) ? response.Sorting : [];

    const teams = teamsSource.map(mapTeam);
    const stages = stagesSource.map(mapStage);
    const categories = categoriesSource.map(mapCategory);

    return {
        status: toStringOrNull(source.status),
        raw_top_level_keys: Object.keys(source),
        response_keys: Object.keys(response),
        sorting: sortingSource.map((item) => toStringOrNull(item)).filter(Boolean),
        counts: {
            teams: teams.length,
            stages: stages.length,
            categories: categories.length
        },
        teams,
        stages,
        categories
    };
}

module.exports = {
    extractFreeLivescoreSearch
};
