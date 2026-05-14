// Unified Fixtures Service
// Provides access to fixtures across all sports with backward compatibility

const db = require('../db');

class UnifiedFixturesService {
  /**
   * Get fixtures by sport
   * @param {string} sport - 'football', 'cricket', 'all'
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Array of fixtures
   */
  static async getFixtures(sport = 'all', options = {}) {
    let query = 'SELECT * FROM fixtures_unified';
    const params = [];
    
    if (sport !== 'all') {
      query += ` WHERE sport = $${params.length + 1}`;
      params.push(sport);
    }
    
    // Add date filtering if provided
    if (options.dateFrom) {
      query += params.length > 0 ? ` AND start_time >= $${params.length + 1}` : ` WHERE start_time >= $${params.length + 1}`;
      params.push(options.dateFrom);
    }
    
    if (options.dateTo) {
      query += params.length > 0 ? ` AND start_time <= $${params.length + 1}` : ` WHERE start_time <= $${params.length + 1}`;
      params.push(options.dateTo);
    }
    
    // Add status filtering
    if (options.status) {
      query += params.length > 0 ? ` AND status = $${params.length + 1}` : ` WHERE status = $${params.length + 1}`;
      params.push(options.status);
    }
    
    query += ' ORDER BY start_time, created_at';
    
    // Add limit if provided
    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }
    
    try {
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting fixtures:', error);
      throw error;
    }
  }
  
  /**
   * Get cricket fixtures (backward compatibility)
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Array of cricket fixtures
   */
  static async getCricketFixtures(options = {}) {
    return this.getFixtures('cricket', options);
  }
  
  /**
   * Get football fixtures (backward compatibility)
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Array of football fixtures
   */
  static async getFootballFixtures(options = {}) {
    return this.getFixtures('football', options);
  }
  
  /**
   * Get fixture by provider match ID and sport
   * @param {string} providerMatchId - Provider match ID
   * @param {string} sport - Sport type
   * @returns {Promise<Object>} Fixture object
   */
  static async getFixtureByProviderId(providerMatchId, sport) {
    const query = 'SELECT * FROM fixtures_unified WHERE provider_match_id = $1 AND sport = $2';
    
    try {
      const result = await db.query(query, [providerMatchId, sport]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting fixture by provider ID:', error);
      throw error;
    }
  }
  
  /**
   * Add new fixture
   * @param {Object} fixture - Fixture data
   * @returns {Promise<Object>} Created fixture
   */
  static async addFixture(fixture) {
    const query = `
      INSERT INTO fixtures_unified (provider, provider_match_id, sport, match_format, competition, home_team, away_team, venue, country, start_time, status, raw_status, raw_payload)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const params = [
      fixture.provider || 'manual',
      fixture.provider_match_id,
      fixture.sport,
      fixture.match_format,
      fixture.competition,
      fixture.home_team,
      fixture.away_team,
      fixture.venue,
      fixture.country,
      fixture.start_time,
      fixture.status || 'upcoming',
      fixture.raw_status,
      fixture.raw_payload
    ];
    
    try {
      const result = await db.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error adding fixture:', error);
      throw error;
    }
  }
  
  /**
   * Get fixtures by competition
   * @param {string} competition - Competition name
   * @param {string} sport - Sport type
   * @returns {Promise<Array>} Array of fixtures
   */
  static async getFixturesByCompetition(competition, sport = 'all') {
    let query = 'SELECT * FROM fixtures_unified WHERE competition = $1';
    const params = [competition];
    
    if (sport !== 'all') {
      query += ` AND sport = $2`;
      params.push(sport);
    }
    
    query += ' ORDER BY start_time';
    
    try {
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting fixtures by competition:', error);
      throw error;
    }
  }
}

module.exports = UnifiedFixturesService;
