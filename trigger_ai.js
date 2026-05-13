const axios = require('axios');

const API_URL = 'https://skcs-sports-edge-skcsai.onrender.com/api/refresh-predictions';
const API_KEY = 'SUMMER_SKCSAI_738913'; // Replace with your actual ADMIN_API_KEY

async function triggerRefresh() {
  try {
    console.log('Sending POST request to:', API_URL);
    console.log('Using API Key:', API_KEY === 'YOUR_ADMIN_API_KEY' ? 'NOT SET - Please update the script' : 'SET');
    
    const response = await axios.post(API_URL, {}, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log('\n✅ Server Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received:', error.message);
    } else {
      console.error('Request setup error:', error.message);
    }
  }
}

triggerRefresh();
