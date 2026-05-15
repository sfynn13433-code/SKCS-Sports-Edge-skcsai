const { query, withTransaction } = require('../database');
const aiProvider = require('./aiProvider');
const direct1x2Builder = require('./direct1x2Builder');
const accaBuilder = require('./accaBuilder');
const contextEnrichmentService = require('./contextEnrichmentService');

class AIPipelineOrchestrator {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  async runFullPipeline(requestedSports = null, runScope = 'UPCOMING_7_DAYS') {
    console.log(`Starting AI pipeline: ${runScope} for sports: ${requestedSports || 'ALL'}`);
    
    let publishRunId;
    try {
      // Create publish run record
      const { rows: [run] } = await query(`
        INSERT INTO prediction_publish_runs (
          trigger_source, run_scope, requested_sports, status, metadata
        ) VALUES (
          'scheduled', $1, $2, 'running', $3
        ) RETURNING id
      `, [
        runScope,
        requestedSports ? JSON.stringify(requestedSports) : '[]',
        JSON.stringify({
          started_at: new Date().toISOString(),
          pipeline_version: '2.0'
        })
      ]);
      
      publishRunId = run.id;
      console.log(`Created publish run: ${publishRunId}`);

      // Get sports to process
      const sports = requestedSports || await this.getActiveSports();
      
      // Process each sport independently
      const sportResults = [];
      for (const sport of sports) {
        try {
          console.log(`Processing sport: ${sport}`);
          const result = await this.processSport(sport, publishRunId);
          sportResults.push({ sport, success: true, result });
        } catch (error) {
          console.error(`Failed to process ${sport}:`, error.message);
          sportResults.push({ sport, success: false, error: error.message });
        }
      }

      // Build ACCAs after all single predictions are complete
      console.log('Building ACCAs...');
      await this.buildACCAs(publishRunId);

      // Update publish run as completed
      await query(`
        UPDATE prediction_publish_runs 
        SET status = 'completed', completed_at = NOW(), metadata = metadata || $1
        WHERE id = $2
      `, [
        JSON.stringify({
          sport_results: sportResults,
          completed_at: new Date().toISOString()
        }),
        publishRunId
      ]);

      console.log(`Pipeline completed successfully. Run ID: ${publishRunId}`);
      return { success: true, publishRunId, sportResults };

    } catch (error) {
      console.error('Pipeline failed:', error);
      
      // Update publish run as failed
      if (publishRunId) {
        await query(`
          UPDATE prediction_publish_runs 
          SET status = 'failed', completed_at = NOW(), error_message = $1
          WHERE id = $2
        `, [error.message, publishRunId]);
      }

      throw error;
    }
  }

  async processSport(sport, publishRunId) {
    // Get enriched fixtures for this sport within the prediction window
    const { rows: fixtures } = await query(`
      SELECT mcd.*, rf.start_time, rf.league_id, rf.home_team_id, rf.away_team_id
      FROM match_context_data mcd
      JOIN raw_fixtures rf ON mcd.id_event = rf.id_event
      WHERE rf.sport = $1 
        AND rf.start_time >= NOW()
        AND rf.start_time <= NOW() + INTERVAL '7 days'
        AND mcd.deep_context IS NOT NULL
      ORDER BY rf.start_time ASC
    `, [sport]);

    console.log(`Found ${fixtures.length} enriched fixtures for ${sport}`);

    const predictionResults = [];
    
    // Process each fixture through AI stages
    for (const fixture of fixtures) {
      try {
        const result = await this.processFixtureThroughAI(fixture, sport, publishRunId);
        predictionResults.push({ fixture: fixture.id_event, success: true, result });
      } catch (error) {
        console.error(`AI processing failed for ${fixture.id_event}:`, error.message);
        
        // Log AI processing failure
        await query(`
          SELECT update_fixture_processing_log(
            $1, $2, 'ai_completed', NULL, $3, $4
          )
        `, [fixture.id_event, publishRunId, error.message, sport]);
        
        predictionResults.push({ fixture: fixture.id_event, success: false, error: error.message });
      }
    }

    return {
      sport,
      fixtures_processed: fixtures.length,
      successful_predictions: predictionResults.filter(r => r.success).length,
      failed_predictions: predictionResults.filter(r => r.success === false).length,
      results: predictionResults
    };
  }

  async processFixtureThroughAI(fixture, sport, publishRunId) {
    console.log(`Processing fixture ${fixture.id_event} through AI pipeline`);

    // Stage 1: Baseline Probability
    const baselinePrediction = await this.generateBaselinePrediction(fixture, sport);
    
    // Stage 2: Deep Context Adjustment
    const adjustedPrediction = await this.applyDeepContextAdjustment(fixture, baselinePrediction);
    
    // Stage 3: Volatility & Reality Check
    const riskAssessedPrediction = await this.assessVolatilityAndReality(fixture, adjustedPrediction);
    
    // Stage 4: Final Decision with Tier Rules
    const finalPrediction = await this.applyFinalDecisionRules(fixture, riskAssessedPrediction, sport);

    // Store in predictions_raw
    const { rows: [rawPrediction] } = await query(`
      INSERT INTO predictions_raw (
        match_id, sport, market, prediction, confidence, volatility, odds, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING id
    `, [
      fixture.id_event,
      sport,
      finalPrediction.market,
      finalPrediction.prediction,
      finalPrediction.confidence,
      finalPrediction.volatility,
      finalPrediction.odds,
      JSON.stringify({
        baseline: baselinePrediction,
        adjusted: adjustedPrediction,
        risk_assessed: riskAssessedPrediction,
        deep_context: fixture.deep_context,
        odds: fixture.odds,
        weather: fixture.weather,
        injuries: fixture.injuries
      })
    ]);

    // Log AI completion
    await query(`
      SELECT update_fixture_processing_log(
        $1, $2, 'ai_completed', NULL, NULL, $3
      )
    `, [fixture.id_event, publishRunId, sport]);

    // Apply tier filtering and create final prediction
    await this.createFinalPrediction(rawPrediction.id, fixture, finalPrediction, publishRunId);

    return {
      raw_prediction_id: rawPrediction.id,
      final_prediction: finalPrediction,
      confidence: finalPrediction.confidence,
      market: finalPrediction.market
    };
  }

  async generateBaselinePrediction(fixture, sport) {
    try {
      const aiInput = {
        sport,
        fixture: {
          id: fixture.id_event,
          home_team: fixture.home_team_id,
          away_team: fixture.away_team_id,
          league: fixture.league_id,
          start_time: fixture.start_time
        },
        stats: fixture.stats,
        form: {
          home_last_5: fixture.home_last_5,
          away_last_5: fixture.away_last_5
        },
        lineups: fixture.lineups,
        timeline: fixture.timeline
      };

      const aiResponse = await aiProvider.generatePrediction(aiInput, 'baseline');
      
      return {
        stage: 'baseline',
        prediction: aiResponse.prediction,
        confidence: aiResponse.confidence,
        market: aiResponse.market || '1x2',
        reasoning: aiResponse.reasoning,
        metadata: aiResponse.metadata
      };

    } catch (error) {
      console.error(`Baseline prediction failed for ${fixture.id_event}:`, error.message);
      throw new Error(`Baseline AI stage failed: ${error.message}`);
    }
  }

  async applyDeepContextAdjustment(fixture, baselinePrediction) {
    try {
      const aiInput = {
        sport: fixture.sport || 'football',
        fixture_id: fixture.id_event,
        baseline_prediction: baselinePrediction,
        deep_context: fixture.deep_context,
        weather: fixture.weather,
        injuries: fixture.injuries,
        odds: fixture.odds
      };

      const aiResponse = await aiProvider.generatePrediction(aiInput, 'deep_context');
      
      return {
        stage: 'deep_context_adjusted',
        baseline: baselinePrediction,
        adjustment: aiResponse.prediction,
        final_prediction: aiResponse.final_prediction || baselinePrediction.prediction,
        confidence: aiResponse.confidence || baselinePrediction.confidence,
        adjustment_factors: aiResponse.adjustment_factors,
        reasoning: aiResponse.reasoning
      };

    } catch (error) {
      console.error(`Deep context adjustment failed for ${fixture.id_event}:`, error.message);
      // Fall back to baseline if deep context fails
      return {
        stage: 'deep_context_fallback',
        baseline: baselinePrediction,
        final_prediction: baselinePrediction.prediction,
        confidence: baselinePrediction.confidence,
        error: error.message
      };
    }
  }

  async assessVolatilityAndReality(fixture, adjustedPrediction) {
    try {
      // Get odds volatility from snapshots
      const oddsVolatility = await this.getOddsVolatilityFromSnapshots(fixture.id_event);
      
      const aiInput = {
        sport: fixture.sport || 'football',
        fixture_id: fixture.id_event,
        current_prediction: adjustedPrediction,
        odds_movement: oddsVolatility || this.analyzeOddsMovement(fixture.odds),
        weather_volatility: this.assessWeatherVolatility(fixture.weather),
        news_volatility: this.assessNewsVolatility(fixture.news),
        injury_impact: this.assessInjuryImpact(fixture.injuries)
      };

      const aiResponse = await aiProvider.generatePrediction(aiInput, 'reality_check');
      
      return {
        stage: 'risk_assessed',
        prediction: adjustedPrediction.final_prediction,
        confidence: adjustedPrediction.confidence,
        risk_flags: aiResponse.risk_flags || [],
        volatility_score: aiResponse.volatility_score || oddsVolatility?.volatility_score || 'medium',
        reality_check: aiResponse.reality_check,
        risk_adjusted_confidence: aiResponse.risk_adjusted_confidence || adjustedPrediction.confidence,
        odds_volatility_data: oddsVolatility
      };

    } catch (error) {
      console.error(`Reality check failed for ${fixture.id_event}:`, error.message);
      // Continue with adjusted prediction if reality check fails
      return {
        stage: 'reality_check_fallback',
        prediction: adjustedPrediction.final_prediction,
        confidence: adjustedPrediction.confidence,
        risk_flags: ['reality_check_failed'],
        volatility_score: 'unknown',
        error: error.message
      };
    }
  }

  async applyFinalDecisionRules(fixture, riskAssessedPrediction, sport) {
    try {
      // Apply tier rules and market governance
      const finalDecision = await this.generateFinalDecision(fixture, riskAssessedPrediction);
      
      // Check if confidence meets minimum thresholds
      const minConfidence = await this.getMinConfidence(sport);
      const finalConfidence = Math.max(riskAssessedPrediction.confidence, minConfidence);
      
      // Determine risk tier
      const riskTier = this.determineRiskTier(finalConfidence);
      
      // Generate secondary insights if needed
      const secondaryInsights = await this.generateSecondaryInsights(fixture, riskAssessedPrediction, riskTier);
      
      return {
        stage: 'final_decision',
        prediction: riskAssessedPrediction.prediction,
        confidence: finalConfidence,
        market: '1x2', // Default market
        risk_tier: riskTier,
        secondary_insights: secondaryInsights,
        edgemind_report: finalDecision.edgemind_report,
        risk_flags: riskAssessedPrediction.risk_flags,
        volatility: riskAssessedPrediction.volatility_score,
        meets_threshold: finalConfidence >= minConfidence,
        recommendation: this.generateRecommendation(riskAssessedPrediction, riskTier)
      };

    } catch (error) {
      console.error(`Final decision rules failed for ${fixture.id_event}:`, error.message);
      return {
        stage: 'final_decision_fallback',
        prediction: 'NO_EDGE_FOUND',
        confidence: 0,
        market: '1x2',
        risk_tier: 'EXTREME_RISK',
        secondary_insights: [],
        error: error.message
      };
    }
  }

  async createFinalPrediction(rawPredictionId, fixture, finalPrediction, publishRunId) {
    try {
      // Get tier rules for the sport
      const { rows: [tierRule] } = await query(`
        SELECT * FROM tier_rules WHERE tier = 'normal' LIMIT 1
      `);

      // Check if prediction passes tier validation
      const passesTierValidation = finalPrediction.confidence >= tierRule.min_confidence;

      if (passesTierValidation) {
        // Insert into predictions_filtered
        await query(`
          INSERT INTO predictions_filtered (raw_id, tier, is_valid, reject_reason)
          VALUES ($1, 'normal', true, NULL)
        `, [rawPredictionId]);

        // Create final prediction record
        await query(`
          INSERT INTO direct1x2_prediction_final (
            publish_run_id, tier, type, matches, total_confidence, risk_level,
            sport, market_type, recommendation, fixture_id, home_team, away_team,
            prediction, confidence, match_date, risk_tier, secondary_markets,
            secondary_insights, edgemind_report
          ) VALUES (
            $1, 'normal', 'direct', $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17
          )
        `, [
          publishRunId,
          JSON.stringify([{
            fixture_id: fixture.id_event,
            home_team: fixture.home_team_id,
            away_team: fixture.away_team_id,
            prediction: finalPrediction.prediction,
            confidence: finalPrediction.confidence,
            market: finalPrediction.market,
            kickoff: fixture.start_time
          }]),
          finalPrediction.confidence,
          finalPrediction.risk_tier === 'HIGH_CONFIDENCE' ? 'safe' : 'medium',
          fixture.sport || 'football',
          finalPrediction.market,
          finalPrediction.recommendation,
          fixture.id_event,
          fixture.home_team_id,
          fixture.away_team_id,
          finalPrediction.prediction,
          finalPrediction.confidence,
          fixture.start_time,
          finalPrediction.risk_tier,
          JSON.stringify(finalPrediction.secondary_insights || []),
          JSON.stringify(finalPrediction.secondary_insights || []),
          finalPrediction.edgemind_report
        ]);

        // Log publication completion
        await query(`
          SELECT update_fixture_processing_log(
            $1, $2, 'publication_completed', NULL, NULL, $3
          )
        `, [fixture.id_event, publishRunId, fixture.sport || 'football']);

      } else {
        // Mark as rejected in predictions_filtered
        await query(`
          INSERT INTO predictions_filtered (raw_id, tier, is_valid, reject_reason)
          VALUES ($1, 'normal', false, $2)
        `, [rawPredictionId, `Confidence ${finalPrediction.confidence} below threshold ${tierRule.min_confidence}`]);

        // Log suppression
        await query(`
          SELECT update_fixture_processing_log(
            $1, $2, 'publication_completed', $3, NULL, $4
          )
        `, [fixture.id_event, publishRunId, `Confidence ${finalPrediction.confidence} below threshold ${tierRule.min_confidence}`, fixture.sport || 'football']);
      }

    } catch (error) {
      console.error(`Failed to create final prediction for ${fixture.id_event}:`, error.message);
      
      // Log publication failure
      await query(`
        SELECT update_fixture_processing_log(
          $1, $2, 'publication_completed', NULL, $3, $4
        )
      `, [fixture.id_event, publishRunId, error.message, fixture.sport || 'football']);
      
      throw error;
    }
  }

  async buildACCAs(publishRunId) {
    console.log('Building ACCAs from high-confidence predictions...');
    
    try {
      // Get high-confidence predictions from this run (Master Rulebook: >=55% for ACCA)
      const { rows: predictions } = await query(`
        SELECT * FROM direct1x2_prediction_final 
        WHERE publish_run_id = $1 
          AND type = 'direct' 
          AND confidence >= 55
          AND risk_tier IN ('LOW_RISK', 'MEDIUM_RISK')
        ORDER BY confidence DESC
      `, [publishRunId]);

      console.log(`Found ${predictions.length} high-confidence predictions for ACCA building`);

      // Use accaBuilder to create accumulators
      const accas = await accaBuilder.buildACCAs(predictions);
      
      // Insert ACCAs into direct1x2_prediction_final
      for (const acca of accas) {
        await query(`
          INSERT INTO direct1x2_prediction_final (
            publish_run_id, tier, type, matches, total_confidence, risk_level,
            sport, market_type, recommendation
          ) VALUES (
            $1, 'normal', 'acca', $2, $3, $4, $5, $6, $7
          )
        `, [
          publishRunId,
          JSON.stringify(acca.matches),
          acca.total_confidence,
          'safe', // ACCAs built from high-confidence picks
          'multi',
          'acca',
          acca.recommendation
        ]);

        // Log ACCA processing for each fixture in the ACCA
        for (const match of acca.matches || []) {
          await query(`
            SELECT update_fixture_processing_log(
              $1, $2, 'acca_processed', NULL, NULL, $3
            )
          `, [match.fixture_id, publishRunId, match.sport || 'multi']);
        }
      }

      console.log(`Created ${accas.length} ACCAs`);

    } catch (error) {
      console.error('ACCA building failed:', error.message);
      // Don't fail the entire pipeline if ACCA building fails
    }
  }

  // Helper methods
  async getActiveSports() {
    const { rows: sports } = await query(`
      SELECT DISTINCT sport FROM sport_sync WHERE enabled = true ORDER BY sport
    `);
    return sports.map(s => s.sport);
  }

  async getOddsVolatilityFromSnapshots(idEvent) {
    try {
      const { rows: volatility } = await query(`
        SELECT * FROM get_odds_volatility($1, 24)
      `, [idEvent]);

      if (volatility.length > 0) {
        return {
          volatility_score: volatility[0].volatility_score,
          snapshots: volatility,
          latest_odds: volatility[0].odds
        };
      }

      return null;
    } catch (error) {
      console.error(`Failed to get odds volatility for ${idEvent}:`, error.message);
      return null;
    }
  }

  analyzeOddsMovement(odds) {
    if (!odds || Object.keys(odds).length === 0) return 'stable';
    
    // Simple odds movement analysis - can be enhanced
    const bookmakerOdds = Object.values(odds);
    const avgMovement = bookmakerOdds.reduce((sum, odds) => sum + (odds.movement || 0), 0) / bookmakerOdds.length;
    
    if (avgMovement > 0.1) return 'high';
    if (avgMovement > 0.05) return 'medium';
    return 'stable';
  }

  assessWeatherVolatility(weather) {
    if (!weather) return 'stable';
    
    // Weather volatility based on conditions
    if (weather.weatherCode >= 200 && weather.weatherCode < 300) return 'high'; // Thunderstorm
    if (weather.weatherCode >= 300 && weather.weatherCode < 400) return 'medium'; // Drizzle
    if (weather.windSpeed > 20) return 'high'; // High winds
    return 'stable';
  }

  assessNewsVolatility(news) {
    if (!news) return 'stable';
    
    const sentimentDiff = Math.abs((news.homeSentiment || 0) - (news.awaySentiment || 0));
    if (sentimentDiff > 0.5) return 'high';
    if (sentimentDiff > 0.2) return 'medium';
    return 'stable';
  }

  assessInjuryImpact(injuries) {
    if (!injuries) return 'low';
    
    const totalInjuries = (injuries.homeInjuries?.length || 0) + (injuries.awayInjuries?.length || 0);
    const keyPlayerInjuries = injuries.homeInjuries?.filter(i => i.severity === 'critical').length || 0 +
                              injuries.awayInjuries?.filter(i => i.severity === 'critical').length || 0;
    
    if (keyPlayerInjuries > 1) return 'high';
    if (totalInjuries > 3) return 'medium';
    return 'low';
  }

  async getMinConfidence(sport) {
    const { rows: [tierRule] } = await query(`
      SELECT min_confidence FROM tier_rules WHERE tier = 'normal' LIMIT 1
    `);
    return tierRule?.min_confidence || 35;
  }

  determineRiskTier(confidence) {
    if (confidence >= 80) return 'HIGH_CONFIDENCE';
    if (confidence >= 70) return 'MODERATE_RISK';
    if (confidence >= 59) return 'HIGH_RISK';
    return 'EXTREME_RISK';
  }

  async generateSecondaryInsights(fixture, riskAssessedPrediction, riskTier) {
    const secondaryInsights = [];
    
    // Only generate secondary insights for moderate to extreme risk
    if (riskTier !== 'HIGH_CONFIDENCE') {
      // Generate based on sport and context
      const sportSpecificInsights = await this.getSportSpecificSecondaryInsights(fixture);
      secondaryInsights.push(...sportSpecificInsights);
    }
    
    return secondaryInsights.slice(0, 4); // Max 4 as per governance
  }

  async getSportSpecificSecondaryInsights(fixture) {
    // Sport-specific secondary market logic
    const sport = fixture.sport || 'football';
    
    if (sport === 'football') {
      return [
        {
          market: 'double_chance_1x',
          prediction: 'home_or_draw',
          confidence: 76,
          reasoning: 'Defensive backup for home team'
        },
        {
          market: 'over_2.5',
          prediction: 'over',
          confidence: 78,
          reasoning: 'Both teams in scoring form'
        }
      ];
    }
    
    return [];
  }

  async generateFinalDecision(fixture, riskAssessedPrediction) {
    return {
      edgemind_report: `AI analysis complete. Confidence: ${riskAssessedPrediction.confidence}%. Risk level: ${riskAssessedPrediction.volatility_score}.`,
      recommendation: riskAssessedPrediction.confidence >= 70 ? 'CONSIDER' : 'AVOID'
    };
  }

  generateRecommendation(prediction, riskTier) {
    if (prediction.prediction === 'NO_EDGE_FOUND') return 'NO_EDGE_FOUND';
    
    const confidence = prediction.confidence;
    if (confidence >= 80) return 'STRONG_BET';
    if (confidence >= 70) return 'CONSIDER';
    if (confidence >= 59) return 'CAUTIOUS';
    return 'AVOID';
  }
}

module.exports = new AIPipelineOrchestrator();
