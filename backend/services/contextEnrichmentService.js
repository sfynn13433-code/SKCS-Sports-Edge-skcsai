const { query } = require('../database');
const axios = require('axios');

class ContextEnrichmentService {
  constructor() {
    this.weatherApiKey = process.env.WEATHER_API_KEY;
    this.oddsApiKey = process.env.ODDS_API_KEY;
  }

  async processEnrichmentQueue() {
    try {
      // Get pending enrichment jobs ordered by priority
      const { rows: jobs } = await query(`
        UPDATE context_enrichment_queue 
        SET status = 'processing'
        WHERE id IN (
          SELECT id 
          FROM context_enrichment_queue 
          WHERE status = 'pending' 
          ORDER BY priority ASC, created_at ASC 
          LIMIT 10
        )
        RETURNING *;
      `);

      console.log(`Processing ${jobs.length} context enrichment jobs`);

      for (const job of jobs) {
        try {
          await this.enrichFixture(job.id_event, job.sport);
          
          // Mark as completed
          await query(`
            UPDATE context_enrichment_queue 
            SET status = 'completed', processed_at = NOW() 
            WHERE id = $1
          `, [job.id]);

        } catch (error) {
          console.error(`Failed to enrich ${job.id_event}:`, error.message);
          
          // Mark as failed
          await query(`
            UPDATE context_enrichment_queue 
            SET status = 'failed', error_message = $1, processed_at = NOW() 
            WHERE id = $2
          `, [error.message, job.id]);
        }
      }

    } catch (error) {
      console.error('Context enrichment queue error:', error);
    }
  }

  async enrichFixture(idEvent, sport) {
    console.log(`Enriching fixture ${idEvent} (${sport})`);

    // Get raw fixture data
    const { rows: fixtures } = await query(`
      SELECT * FROM raw_fixtures WHERE id_event = $1
    `, [idEvent]);

    if (fixtures.length === 0) {
      throw new Error(`Fixture ${idEvent} not found`);
    }

    const fixture = fixtures[0];

    // Check if context already exists and is fresh
    const { rows: existingContext } = await query(`
      SELECT mcd.*, cic.expires_at 
      FROM match_context_data mcd
      LEFT JOIN context_intelligence_cache cic ON mcd.id_event = cic.fixture_id
      WHERE mcd.id_event = $1 AND (cic.expires_at IS NULL OR cic.expires_at > NOW())
    `, [idEvent]);

    let contextData = existingContext[0] || {};

    // Enrich based on sport capabilities
    const enrichment = await this.getSportSpecificEnrichment(sport, fixture);

    // Fetch odds if supported
    if (this.supportsOdds(sport)) {
      enrichment.odds = await this.fetchOdds(idEvent, sport);
    }

    // Fetch weather if applicable
    if (this.supportsWeather(sport)) {
      enrichment.weather = await this.fetchWeather(fixture);
    }

    // Fetch injuries
    enrichment.injuries = await this.fetchInjuries(fixture);

    // Fetch recent form
    enrichment.form = await this.fetchRecentForm(fixture);

    // Fetch news sentiment
    enrichment.news = await this.fetchNewsSentiment(fixture);

    // Compute deep context
    enrichment.deep_context = await this.computeDeepContext(sport, fixture, enrichment);

    // Record odds snapshot if odds have changed
    if (enrichment.odds && Object.keys(enrichment.odds).length > 0) {
      await query(`
        INSERT INTO event_odds_snapshots (id_event, odds, source)
        VALUES ($1, $2, 'enrichment')
      `, [idEvent, JSON.stringify(enrichment.odds)]);
    }

    // Upsert match context
    await query(`
      INSERT INTO match_context_data (
        id_event, lineups, stats, timeline, 
        home_last_5, away_last_5, odds, deep_context, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW()
      )
      ON CONFLICT (id_event) 
      DO UPDATE SET 
        lineups = EXCLUDED.lineups,
        stats = EXCLUDED.stats,
        timeline = EXCLUDED.timeline,
        home_last_5 = EXCLUDED.home_last_5,
        away_last_5 = EXCLUDED.away_last_5,
        odds = EXCLUDED.odds,
        deep_context = EXCLUDED.deep_context,
        updated_at = NOW()
    `, [
      idEvent,
      enrichment.lineups || contextData.lineups || '{}',
      enrichment.stats || contextData.stats || '{}',
      enrichment.timeline || contextData.timeline || '{}',
      enrichment.form?.homeLast5 || contextData.home_last_5 || '[]',
      enrichment.form?.awayLast5 || contextData.away_last_5 || '[]',
      JSON.stringify(enrichment.odds || contextData.odds || {}),
      JSON.stringify(enrichment.deep_context || contextData.deep_context || {})
    ]);

    // Cache the enrichment result
    await this.cacheContext(idEvent, enrichment);

    // Create event snapshots for historical analysis
    await this.createEventSnapshots(idEvent, sport, enrichment);

    // Log enrichment completion via RPC (if publish_run_id is available)
    // This will be called from the orchestrator with the proper run_id
    console.log(`Successfully enriched ${idEvent}`);
  }

  async getSportSpecificEnrichment(sport, fixture) {
    const sportHandlers = {
      football: () => this.enrichFootballFixture(fixture),
      f1: () => this.enrichF1Fixture(fixture),
      tennis: () => this.enrichTennisFixture(fixture),
      basketball: () => this.enrichBasketballFixture(fixture),
      cricket: () => this.enrichCricketFixture(fixture)
    };

    const handler = sportHandlers[sport];
    return handler ? await handler() : {};
  }

  async enrichFootballFixture(fixture) {
    // Football-specific enrichment
    return {
      lineups: await this.fetchLineups(fixture),
      stats: await this.fetchTeamStats(fixture),
      timeline: await this.fetchMatchTimeline(fixture)
    };
  }

  async enrichF1Fixture(fixture) {
    // F1-specific enrichment (weather critical, track conditions)
    return {
      trackConditions: await this.fetchTrackConditions(fixture),
      weatherImpact: await this.computeWeatherImpact(fixture),
      tyreStrategy: await this.analyzeTyreStrategy(fixture)
    };
  }

  async enrichTennisFixture(fixture) {
    // Tennis-specific enrichment
    return {
      playerStats: await this.fetchPlayerStats(fixture),
      surfaceStats: await this.fetchSurfaceStats(fixture),
      headToHead: await this.fetchHeadToHead(fixture)
    };
  }

  async enrichBasketballFixture(fixture) {
    return {
      playerStats: await this.fetchBasketballPlayerStats(fixture),
      teamStats: await this.fetchBasketballTeamStats(fixture)
    };
  }

  async enrichCricketFixture(fixture) {
    return {
      pitchConditions: await this.fetchPitchConditions(fixture),
      playerForm: await this.fetchCricketPlayerForm(fixture),
      weatherImpact: await this.computeCricketWeatherImpact(fixture)
    };
  }

  async fetchOdds(idEvent, sport) {
    try {
      // Use canonical bookmakers for odds aggregation
      const { rows: bookmakers } = await query(`
        SELECT bookmaker_key, title, priority_order 
        FROM canonical_bookmakers 
        WHERE is_active = true 
        ORDER BY priority_order ASC
        LIMIT 5
      `);

      const oddsData = {};
      
      for (const bookmaker of bookmakers) {
        try {
          const odds = await this.fetchBookmakerOdds(bookmaker.bookmaker_key, idEvent, sport);
          if (odds) {
            oddsData[bookmaker.bookmaker_key] = odds;
          }
        } catch (error) {
          console.warn(`Failed to fetch odds from ${bookmaker.bookmaker_key}:`, error.message);
        }
      }

      return oddsData;

    } catch (error) {
      console.error(`Odds fetch error for ${idEvent}:`, error.message);
      return {};
    }
  }

  async fetchBookmakerOdds(bookmakerKey, idEvent, sport) {
    // Implementation would vary by bookmaker API
    // This is a placeholder for the actual API integration
    const bookmakerApis = {
      bet365: () => this.fetchBet365Odds(idEvent),
      betmgm: () => this.fetchBetMgmOdds(idEvent),
      draftkings: () => this.fetchDraftKingsOdds(idEvent)
      // Add other bookmakers as needed
    };

    const api = bookmakerApis[bookmakerKey];
    return api ? await api() : null;
  }

  async fetchWeather(fixture) {
    try {
      // Get venue location from teams table
      const { rows: venueData } = await query(`
        SELECT 
          ht.venue as home_venue,
          ht.country as home_country,
          at.venue as away_venue,
          at.country as away_country
        FROM raw_fixtures rf
        LEFT JOIN teams ht ON ht.name = rf.home_team_id
        LEFT JOIN teams at ON at.name = rf.away_team_id
        WHERE rf.id_event = $1
      `, [fixture.id_event]);

      if (venueData.length === 0) return null;

      const venue = venueData[0];
      const location = venue.home_venue || venue.home_country;

      if (!location) return null;

      // Call weather API
      const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
        params: {
          q: location,
          appid: this.weatherApiKey,
          units: 'metric'
        }
      });

      return {
        temperature: response.data.main.temp,
        humidity: response.data.main.humidity,
        windSpeed: response.data.wind.speed,
        weatherCode: response.data.weather[0].id,
        description: response.data.weather[0].description,
        location: location
      };

    } catch (error) {
      console.error('Weather fetch error:', error.message);
      return null;
    }
  }

  async fetchInjuries(fixture) {
    try {
      // This would integrate with sports injury APIs
      // For now, return placeholder data
      return {
        homeInjuries: await this.getTeamInjuries(fixture.home_team_id),
        awayInjuries: await this.getTeamInjuries(fixture.away_team_id)
      };
    } catch (error) {
      console.error('Injuries fetch error:', error.message);
      return { homeInjuries: [], awayInjuries: [] };
    }
  }

  async fetchRecentForm(fixture) {
    try {
      const { rows: form } = await query(`
        SELECT 
          home_team,
          away_team,
          home_score,
          away_score,
          match_date,
          status
        FROM matches 
        WHERE (home_team = $1 OR away_team = $1 OR home_team = $2 OR away_team = $2)
          AND match_date >= NOW() - INTERVAL '30 days'
          AND status = 'completed'
        ORDER BY match_date DESC
        LIMIT 10
      `, [fixture.home_team_id, fixture.away_team_id]);

      const homeLast5 = form.filter(m => m.home_team === fixture.home_team_id).slice(0, 5);
      const awayLast5 = form.filter(m => m.home_team === fixture.away_team_id).slice(0, 5);

      return { homeLast5, awayLast5 };

    } catch (error) {
      console.error('Form fetch error:', error.message);
      return { homeLast5: [], awayLast5: [] };
    }
  }

  async fetchNewsSentiment(fixture) {
    try {
      // This would integrate with news APIs for sentiment analysis
      return {
        homeSentiment: await this.getTeamSentiment(fixture.home_team_id),
        awaySentiment: await this.getTeamSentiment(fixture.away_team_id)
      };
    } catch (error) {
      console.error('News sentiment fetch error:', error.message);
      return { homeSentiment: 0, awaySentiment: 0 };
    }
  }

  async computeDeepContext(sport, fixture, enrichment) {
    const sportContextGenerators = {
      football: () => this.computeFootballDeepContext(fixture, enrichment),
      f1: () => this.computeF1DeepContext(fixture, enrichment),
      tennis: () => this.computeTennisDeepContext(fixture, enrichment)
    };

    const generator = sportContextGenerators[sport];
    return generator ? await generator() : {};
  }

  async computeFootballDeepContext(fixture, enrichment) {
    return {
      tacticalAnalysis: await this.analyzeTactics(fixture, enrichment),
      formMomentum: this.calculateFormMomentum(enrichment.form),
      weatherImpact: this.assessWeatherImpact(enrichment.weather),
      injuryImpact: this.assessInjuryImpact(enrichment.injuries),
      oddsMovement: this.analyzeOddsMovement(enrichment.odds)
    };
  }

  async computeF1DeepContext(fixture, enrichment) {
    return {
      trackAnalysis: await this.analyzeTrack(fixture),
      weatherConditions: enrichment.weather,
      tyreStrategy: enrichment.tyreStrategy,
      driverForm: await this.getDriverForm(fixture),
      teamPerformance: await this.getTeamPerformance(fixture)
    };
  }

  async cacheContext(idEvent, enrichment) {
    try {
      await query(`
        INSERT INTO context_intelligence_cache (
          cache_key, fixture_id, payload, expires_at
        ) VALUES (
          $1, $2, $3, NOW() + INTERVAL '3 hours'
        )
        ON CONFLICT (cache_key) 
        DO UPDATE SET 
          payload = EXCLUDED.payload,
          expires_at = EXCLUDED.expires_at,
          last_verified = NOW()
      `, [
        `context:${idEvent}`,
        idEvent,
        JSON.stringify(enrichment)
      ]);

    } catch (error) {
      console.error('Cache error:', error.message);
    }
  }

  async createEventSnapshots(idEvent, sport, enrichment) {
    try {
      // Create injury snapshot
      if (enrichment.injuries) {
        await this.createInjurySnapshot(idEvent, enrichment.injuries);
      }

      // Create weather snapshot
      if (enrichment.weather) {
        await this.createWeatherSnapshot(idEvent, enrichment.weather);
      }

      // Create news snapshot
      if (enrichment.news) {
        await this.createNewsSnapshot(idEvent, enrichment.news);
      }

    } catch (error) {
      console.error('Snapshot creation error:', error.message);
    }
  }

  supportsOdds(sport) {
    const oddsSupportedSports = ['football', 'basketball', 'tennis', 'baseball', 'american_football'];
    return oddsSupportedSports.includes(sport);
  }

  supportsWeather(sport) {
    const weatherDependentSports = ['football', 'f1', 'tennis', 'golf', 'cricket'];
    return weatherDependentSports.includes(sport);
  }

  // Placeholder methods for specific implementations
  async fetchLineups(fixture) { return {}; }
  async fetchTeamStats(fixture) { return {}; }
  async fetchMatchTimeline(fixture) { return {}; }
  async fetchTrackConditions(fixture) { return {}; }
  async computeWeatherImpact(fixture) { return {}; }
  async analyzeTyreStrategy(fixture) { return {}; }
  async fetchPlayerStats(fixture) { return {}; }
  async fetchSurfaceStats(fixture) { return {}; }
  async fetchHeadToHead(fixture) { return {}; }
  async fetchBasketballPlayerStats(fixture) { return {}; }
  async fetchBasketballTeamStats(fixture) { return {}; }
  async fetchPitchConditions(fixture) { return {}; }
  async fetchCricketPlayerForm(fixture) { return {}; }
  async computeCricketWeatherImpact(fixture) { return {}; }
  async analyzeTactics(fixture, enrichment) { return {}; }
  async calculateFormMomentum(form) { return {}; }
  async assessWeatherImpact(weather) { return {}; }
  async assessInjuryImpact(injuries) { return {}; }
  async analyzeOddsMovement(odds) { return {}; }
  async analyzeTrack(fixture) { return {}; }
  async getDriverForm(fixture) { return {}; }
  async getTeamPerformance(fixture) { return {}; }
  async getTeamInjuries(teamId) { return []; }
  async getTeamSentiment(teamId) { return 0; }
  async createInjurySnapshot(idEvent, injuries) { }
  async createWeatherSnapshot(idEvent, weather) { }
  async createNewsSnapshot(idEvent, news) { }
  async fetchBet365Odds(idEvent) { return null; }
  async fetchBetMgmOdds(idEvent) { return null; }
  async fetchDraftKingsOdds(idEvent) { return null; }
}

module.exports = new ContextEnrichmentService();
