// Unified Predictions Service
// Provides access to predictions across all pipeline stages with backward compatibility

const db = require('../db');

class UnifiedPredictionsService {
  /**
   * Get predictions by status and sport
   * @param {string} status - 'raw', 'filtered', 'ai_generated', 'final', 'all'
   * @param {string} sport - 'football', 'cricket', 'all'
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Array of predictions
   */
  static async getPredictions(status = 'all', sport = 'all', options = {}) {
    let query = 'SELECT * FROM predictions_unified';
    const params = [];
    
    // Build WHERE clause
    const whereConditions = [];
    
    if (status !== 'all') {
      whereConditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    
    if (sport !== 'all') {
      whereConditions.push(`sport = $${params.length + 1}`);
      params.push(sport);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Add ordering
    query += ' ORDER BY created_at DESC';
    
    // Add limit if provided
    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }
    
    try {
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting predictions:', error);
      throw error;
    }
  }
  
  /**
   * Get raw predictions (backward compatibility)
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Array of raw predictions
   */
  static async getRawPredictions(options = {}) {
    return this.getPredictions('raw', 'all', options);
  }
  
  /**
   * Get filtered predictions (backward compatibility)
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Array of filtered predictions
   */
  static async getFilteredPredictions(options = {}) {
    return this.getPredictions('filtered', 'all', options);
  }
  
  /**
   * Get AI predictions (backward compatibility)
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Array of AI predictions
   */
  static async getAIPredictions(options = {}) {
    return this.getPredictions('ai_generated', 'all', options);
  }
  
  /**
   * Get final predictions
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Array of final predictions
   */
  static async getFinalPredictions(options = {}) {
    return this.getPredictions('final', 'all', options);
  }
  
  /**
   * Get prediction by match ID
   * @param {string} matchId - Match ID
   * @param {string} status - Prediction status
   * @returns {Promise<Object>} Prediction object
   */
  static async getPredictionByMatchId(matchId, status = 'final') {
    const query = 'SELECT * FROM predictions_unified WHERE match_id = $1 AND status = $2';
    
    try {
      const result = await db.query(query, [matchId, status]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting prediction by match ID:', error);
      throw error;
    }
  }
  
  /**
   * Add new prediction
   * @param {Object} prediction - Prediction data
   * @returns {Promise<Object>} Created prediction
   */
  static async addPrediction(prediction) {
    const query = `
      INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, metadata, ai_model, sport, market_type, processing_stage, matches, edgemind_report, secondary_insights, secondary_markets, total_confidence)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    
    const params = [
      prediction.match_id,
      prediction.home_team,
      prediction.away_team,
      prediction.prediction,
      prediction.confidence,
      prediction.status || 'raw',
      prediction.metadata,
      prediction.ai_model,
      prediction.sport || 'football',
      prediction.market_type || '1x2',
      prediction.processing_stage || 'stage_1',
      prediction.matches,
      prediction.edgemind_report,
      prediction.secondary_insights,
      prediction.secondary_markets,
      prediction.total_confidence
    ];
    
    try {
      const result = await db.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error adding prediction:', error);
      throw error;
    }
  }
  
  /**
   * Update prediction status
   * @param {string} matchId - Match ID
   * @param {string} newStatus - New status
   * @param {Object} updateData - Additional update data
   * @returns {Promise<Object>} Updated prediction
   */
  static async updatePredictionStatus(matchId, newStatus, updateData = {}) {
    const query = `
      UPDATE predictions_unified 
      SET status = $1, processing_stage = $2, updated_at = NOW()
      WHERE match_id = $3
      RETURNING *
    `;
    
    try {
      const result = await db.query(query, [newStatus, updateData.processing_stage || 'stage_2', matchId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating prediction status:', error);
      throw error;
    }
  }
  
  /**
   * Get predictions by processing stage
   * @param {string} stage - Processing stage
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Array of predictions
   */
  static async getPredictionsByStage(stage, options = {}) {
    let query = 'SELECT * FROM predictions_unified WHERE processing_stage = $1';
    const params = [stage];
    
    if (options.sport && options.sport !== 'all') {
      query += ' AND sport = $2';
      params.push(options.sport);
    }
    
    query += ' ORDER BY created_at DESC';
    
    try {
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting predictions by stage:', error);
      throw error;
    }
  }
}

module.exports = UnifiedPredictionsService;