const axios = require('axios');

class FootballAdapter {
  constructor() {
    this.apiKey = process.env.API_FOOTBALL_KEY;
    this.baseUrl = 'https://v3.football.api-sports.io';
  }

  async fetchFixtures(startDate, endDate) {
    try {
      const response = await axios.get(`${this.baseUrl}/fixtures`, {
        params: {
          league: 39, // Premier League
          season: 2026,
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0]
        },
        headers: {
          'x-apisports-key': this.apiKey
        }
      });

      return response.data.response.map(match => ({
        id_event: `FOOTBALL_${match.league.id}_${match.fixture.id}`,
        sport: 'football',
        league_id: `LEAGUE_${match.league.id}`,
        home_team_id: `TEAM_${match.teams.home.id}`,
        away_team_id: `TEAM_${match.teams.away.id}`,
        start_time: match.fixture.date,
        raw_json: match,
        odds: match.odds || null
      }));
    } catch (error) {
      console.error('Football adapter error:', error.message);
      throw error;
    }
  }
}

module.exports = new FootballAdapter();
