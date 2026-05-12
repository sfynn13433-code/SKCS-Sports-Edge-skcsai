const axios = require('axios');

class F1Adapter {
  constructor() {
    this.baseUrl = 'https://api.openf1.org';
  }

  async fetchFixtures(startDate, endDate) {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/races`, {
        params: {
          season: 2026,
          date_gt: startDate.toISOString().split('T')[0],
          date_lt: endDate.toISOString().split('T')[0]
        }
      });

      return response.data.map(race => ({
        id_event: `F1_${race.season}_${race.round}`,
        sport: 'f1',
        league_id: 'LEAGUE_F1',
        home_team_id: 'F1_GRID', // Placeholder for multi-participant sports
        away_team_id: null,
        start_time: race.date,
        raw_json: {
          race,
          participants: race.results || [] // Will be populated closer to race time
        }
      }));
    } catch (error) {
      console.error('F1 adapter error:', error.message);
      throw error;
    }
  }
}

module.exports = new F1Adapter();
