const cron = require('node-cron');
const axios = require('axios');

class ExternalScheduler {
  constructor() {
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:10000';
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  start() {
    console.log('Starting SKCS AI External Scheduler...');
    
    // Schedule fixture sync every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('Running scheduled fixture sync...');
      await this.triggerFixtureSync();
    }, {
      scheduled: true,
      timezone: 'Africa/Johannesburg'
    });

    // Schedule context enrichment every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      console.log('Running scheduled context enrichment...');
      await this.triggerContextEnrichment();
    }, {
      scheduled: true,
      timezone: 'Africa/Johannesburg'
    });

    // Schedule AI pipeline every 4 hours
    cron.schedule('0 */4 * * *', async () => {
      console.log('Running scheduled AI pipeline...');
      await this.triggerAIPipeline();
    }, {
      scheduled: true,
      timezone: 'Africa/Johannesburg'
    });

    // Schedule full pipeline daily at 2 AM SAST
    cron.schedule('0 2 * * *', async () => {
      console.log('Running daily full pipeline...');
      await this.triggerFullPipeline();
    }, {
      scheduled: true,
      timezone: 'Africa/Johannesburg'
    });

    console.log('Scheduler started successfully');
  }

  async triggerFixtureSync() {
    try {
      const response = await axios.post(`${this.backendUrl}/api/scheduler/trigger-fixture-sync`, {}, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minutes
      });
      
      console.log('Fixture sync result:', response.data);
    } catch (error) {
      console.error('Fixture sync failed:', error.message);
    }
  }

  async triggerContextEnrichment() {
    try {
      const response = await axios.post(`${this.backendUrl}/api/scheduler/trigger-context-enrichment`, {}, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 600000 // 10 minutes
      });
      
      console.log('Context enrichment result:', response.data);
    } catch (error) {
      console.error('Context enrichment failed:', error.message);
    }
  }

  async triggerAIPipeline() {
    try {
      const response = await axios.post(`${this.backendUrl}/api/scheduler/trigger-ai-pipeline`, {
        runScope: 'UPCOMING_7_DAYS'
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 600000 // 10 minutes
      });
      
      console.log('AI pipeline result:', response.data);
    } catch (error) {
      console.error('AI pipeline failed:', error.message);
    }
  }

  async triggerFullPipeline() {
    try {
      // Trigger fixture sync first
      console.log('Step 1: Triggering fixture sync...');
      await this.triggerFixtureSync();
      
      // Wait 2 minutes for fixtures to be ingested
      await new Promise(resolve => setTimeout(resolve, 120000));
      
      // Trigger context enrichment
      console.log('Step 2: Triggering context enrichment...');
      await this.triggerContextEnrichment();
      
      // Wait 5 minutes for enrichment
      await new Promise(resolve => setTimeout(resolve, 300000));
      
      // Trigger AI pipeline
      console.log('Step 3: Triggering AI pipeline...');
      await this.triggerAIPipeline();
      
      console.log('Full pipeline completed');
    } catch (error) {
      console.error('Full pipeline failed:', error.message);
    }
  }

  async healthCheck() {
    try {
      const response = await axios.get(`${this.backendUrl}/api/scheduler/health`, {
        timeout: 10000
      });
      
      return {
        status: 'healthy',
        backend: response.data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Start scheduler if this file is run directly
if (require.main === module) {
  const scheduler = new ExternalScheduler();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down scheduler...');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('Shutting down scheduler...');
    process.exit(0);
  });
  
  scheduler.start();
  
  // Log initial health check
  setTimeout(async () => {
    const health = await scheduler.healthCheck();
    console.log('Initial health check:', health);
  }, 5000);
}

module.exports = ExternalScheduler;
