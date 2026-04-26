'use strict';

const axios = require('axios');

const RAPID_KEY = process.env.RAPIDAPI_KEY;
const HOST = process.env.RAPIDAPI_HOST_CRICBUZZ;

async function fetchCricbuzzMatches() {
  try {
    const res = await axios.get(
      'https://cricbuzz-cricket.p.rapidapi.com/matches/v1/live',
      {
        headers: {
          'x-rapidapi-key': RAPID_KEY,
          'x-rapidapi-host': HOST
        },
        timeout: 10000
      }
    );
    return res.data;
  } catch (err) {
    console.error('Cricbuzz fetch failed:', err.response?.status || err.message);
    return null;
  }
}

function normalizeCricbuzzData(data) {
  if (!data?.typeMatches) return [];

  const matches = [];

  data.typeMatches.forEach(type => {
    type.seriesMatches?.forEach(series => {
      const wrapper = series.seriesAdWrapper;
      if (!wrapper?.matches) return;

      wrapper.matches.forEach(match => {
        const info = match.matchInfo;
        const score = match.matchScore;

        matches.push({
          match_id: info.matchId,
          sport: 'cricket',
          league: info.seriesName,
          match_desc: info.matchDesc,
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

  return matches;
}

module.exports = {
  fetchCricbuzzMatches,
  normalizeCricbuzzData
};