const axios = require('axios');

// External scheduler to trigger Supabase Edge Function
async function triggerScheduledSync() {
  try {
    console.log('Triggering scheduled fixture sync...');
    
    const edgeFunctionUrl = process.env.SUPABASE_EDGE_FUNCTION_URL || 'https://skcsai-z8cd.onrender.com/functions/v1/scheduled-fixture-sync';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    }
    
    const response = await axios.post(edgeFunctionUrl, {}, {
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes
    });
    
    console.log('Scheduled sync response:', response.data);
    
    // Check if response indicates success
    if (response.data.success) {
      console.log(`✅ Scheduled sync completed successfully`);
      console.log(`   Publish Run ID: ${response.data.publishRunId}`);
      console.log(`   Results: ${JSON.stringify(response.data.results, null, 2)}`);
    } else {
      console.log('❌ Scheduled sync failed:', response.data);
    }
    
  } catch (error) {
    console.error('Failed to trigger scheduled sync:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run if this script is executed directly
if (require.main === module) {
  console.log('SKCS AI - External Scheduler');
  console.log('Triggering scheduled fixture sync...');
  
  triggerScheduledSync()
    .then(() => {
      console.log('Scheduled sync completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Scheduled sync failed:', error.message);
      process.exit(1);
    });
}

module.exports = { triggerScheduledSync };
