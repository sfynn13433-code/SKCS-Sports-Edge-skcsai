const axios = require('axios');

class TennisAdapter {
  constructor() {
    this.apiKey = process.env.SPORTRADAR_KEY;
    this.baseUrl = 'https://api.sportradar.com/tennis/trial/v4';
  }

  async fetchFixtures(startDate, endDate) {
    try {
      const response = await axios.get(`${this.baseUrl}/schedules`, {
        params: {
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0]
        },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      const fixtures = [];
      response.data.schedules.forEach(tournament => {
        tournament.sport_events.forEach(event => {
          fixtures.push({
            id_event: `TENNIS_${event.id}`,
            sport: 'tennis',
            league_id: `LEAGUE_${tournament.tournament.id}`,
            home_team_id: `PLAYER_${event.competitors[0]?.id}`,
            away_team_id: `PLAYER_${event.competitors[1]?.id}`,
            start_time: event.scheduled,
            raw_json: event
          });
        });
      });

      return fixtures;
    } catch (error) {
      console.error('Tennis adapter error:', error.message);
      throw error;
    }
  }
}

module.exports = new TennisAdapter();
