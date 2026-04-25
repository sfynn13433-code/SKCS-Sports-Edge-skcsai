'use strict';

const axios = require('axios');

const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';
const OPEN_WEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

function buildApiSportsHeaders() {
    const apiSportsKey = String(process.env.X_APISPORTS_KEY || '').trim();
    const rapidApiKey = String(
        process.env.X_RAPIDAPI_KEY
        || process.env.RAPIDAPI_KEY
        || ''
    ).trim();

    const headers = {};
    if (apiSportsKey) headers['x-apisports-key'] = apiSportsKey;
    if (rapidApiKey) headers['x-rapidapi-key'] = rapidApiKey;
    return headers;
}

async function getInjuries(fixtureId) {
    const id = String(fixtureId || '').trim();
    if (!id) return null;

    try {
        const res = await axios.get(
            `${API_SPORTS_BASE_URL}/injuries?fixture=${encodeURIComponent(id)}`,
            { headers: buildApiSportsHeaders(), timeout: 10000 }
        );
        return Array.isArray(res?.data?.response) ? res.data.response : null;
    } catch (_err) {
        return null;
    }
}

async function getH2H(team1, team2) {
    const homeId = String(team1 || '').trim();
    const awayId = String(team2 || '').trim();
    if (!homeId || !awayId) return null;

    try {
        const res = await axios.get(
            `${API_SPORTS_BASE_URL}/fixtures/headtohead?h2h=${encodeURIComponent(`${homeId}-${awayId}`)}`,
            { headers: buildApiSportsHeaders(), timeout: 10000 }
        );
        return Array.isArray(res?.data?.response) ? res.data.response : null;
    } catch (_err) {
        return null;
    }
}

async function getWeather(city) {
    const cityName = String(city || '').trim();
    const weatherApiKey = String(process.env.WEATHER_API_KEY || '').trim();
    if (!cityName || !weatherApiKey) return null;

    try {
        const res = await axios.get(
            `${OPEN_WEATHER_BASE_URL}?q=${encodeURIComponent(cityName)}&appid=${encodeURIComponent(weatherApiKey)}`,
            { timeout: 10000 }
        );
        return res?.data || null;
    } catch (_err) {
        return null;
    }
}

module.exports = {
    getInjuries,
    getH2H,
    getWeather
};
