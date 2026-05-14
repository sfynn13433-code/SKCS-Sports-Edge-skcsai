// Unified Rules Service
// Provides access to rules across all sports with backward compatibility

const db = require('../db');

class UnifiedRulesService {
  /**
   * Get rules by tier and sport
   * @param {string} tier - Tier name (core, elite, vip)
   * @param {string} sport - Sport type ('all', 'cricket', 'football')
   * @param {string} ruleType - Rule type ('volatility', 'markets', 'all')
   * @returns {Promise<Array>} Array of rules
   */
  static async getRules(tier, sport = 'all', ruleType = 'all') {
    let query = 'SELECT * FROM market_rules_unified WHERE tier = $1 AND is_active = true';
    const params = [tier];
    
    if (sport !== 'all') {
      query += ` AND sport = $${params.length + 1}`;
      params.push(sport);
    }
    
    if (ruleType !== 'all') {
      query += ` AND rule_type = $${params.length + 1}`;
      params.push(ruleType);
    }
    
    query += ' ORDER BY created_at';
    
    try {
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting rules:', error);
      throw error;
    }
  }
  
  /**
   * Get volatility rules for a tier
   * @param {string} tier - Tier name
   * @param {string} sport - Sport type
   * @returns {Promise<Object>} Volatility rule object
   */
  static async getVolatilityRules(tier, sport = 'all') {
    const rules = await this.getRules(tier, sport, 'volatility');
    return rules[0] || null;
  }
  
  /**
   * Get market rules for a tier and sport
   * @param {string} tier - Tier name
   * @param {string} sport - Sport type
   * @returns {Promise<Array>} Array of market rules
   */
  static async getMarketRules(tier, sport) {
    return this.getRules(tier, sport, 'markets');
  }
  
  /**
   * Get tier rules (backward compatibility)
   * @param {string} tier - Tier name
   * @returns {Promise<Object>} Tier rule object
   */
  static async getTierRules(tier) {
    const query = 'SELECT * FROM tier_rules_view WHERE tier = $1';
    
    try {
      const result = await db.query(query, [tier]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting tier rules:', error);
      throw error;
    }
  }
  
  /**
   * Get cricket market rules (backward compatibility)
   * @returns {Promise<Array>} Array of cricket market rules
   */
  static async getCricketMarketRules() {
    const query = 'SELECT * FROM cricket_market_rules_view ORDER BY market_key';
    
    try {
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting cricket market rules:', error);
      throw error;
    }
  }
}

module.exports = UnifiedRulesService;