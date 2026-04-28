'use strict';

const axios = require('axios');

const RAPID_KEY = process.env.RAPIDAPI_KEY;
const HOST = process.env.RAPIDAPI_HOST_CRICBUZZ;
const ALLOWED_FEEDS = new Set(['upcoming', 'recent']);
const DEFAULT_FEED = 'upcoming';

function validateCricketMatch(match) {
    const info = match?.matchInfo;
    if (!info) return false;
    
    if (info.team1?.teamName && info.team2?.teamName) {
        return true;
    }
    return false;
}

function normalizeFeed(feed) {
    return String(feed || '').trim().toLowerCase();
}

async function fetchCricbuzzMatches(options = {}) {
    if (!RAPID_KEY || !HOST) {
        console.error('Cricbuzz: Missing RAPIDAPI_KEY or RAPIDAPI_HOST_CRICBUZZ');
        return null;
    }

    const feed = normalizeFeed(options.feed || DEFAULT_FEED);
    if (!ALLOWED_FEEDS.has(feed)) {
        throw new Error(
            `Cricbuzz feed "${feed}" is not allowed. Policy: no live calls for prediction ingestion; use one of: ${Array.from(ALLOWED_FEEDS).join(', ')}`
        );
    }

    try {
        const res = await axios.get(
            `https://cricbuzz-cricket.p.rapidapi.com/matches/v1/${feed}`,
            {
                headers: {
                    'x-rapidapi-key': RAPID_KEY,
                    'x-rapidapi-host': HOST
                },
                timeout: 10000
            }
        );

        console.log(`Cricbuzz API (${feed}) response status:`, res.status);
        return res.data;
    } catch (err) {
        console.error(`Cricbuzz ${feed} fetch failed:`, err.response?.status || err.message);
        return null;
    }
}

function normalizeCricbuzzData(data) {
    if (!data?.typeMatches) {
        console.warn('Cricbuzz: No typeMatches in response');
        return [];
    }

    const matches = [];

    data.typeMatches.forEach(type => {
        type.seriesMatches?.forEach(series => {
            const wrapper = series.seriesAdWrapper;
            if (!wrapper?.matches) return;

            wrapper.matches.forEach(match => {
                if (!validateCricketMatch(match)) return;
                
                const info = match.matchInfo;
                const score = match.matchScore;

                matches.push({
                    match_id: info.matchId,
                    sport: 'cricket',
                    league: info.seriesName,
                    match_desc: info.matchDesc,
                    match_format: info.matchFormat || 'T20',
                    start_time: new Date(parseInt(info.startDate)),
                    status: info.state,
                    team1: info.team1.teamName,
                    team2: info.team2.teamName,
                    team1_runs: score?.team1Score?.inngs1?.runs || null,
                    team2_runs: score?.team2Score?.inngs1?.runs || null,
                    raw: match
                });
            });
        });
    });

    console.log(`Cricbuzz normalized: ${matches.length} valid matches`);
    return matches;
}

module.exports = {
    fetchCricbuzzMatches,
    normalizeCricbuzzData,
    validateCricketMatch
};
