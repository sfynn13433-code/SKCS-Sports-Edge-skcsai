const http = require('http');

async function testAIPredictions542703() {
  console.log('=== TESTING /api/ai-predictions/542703 ENDPOINT ===\n');
  
  try {
    // Test the exact endpoint that's failing
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/ai-predictions/542703',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    console.log('Testing endpoint:', `http://${options.hostname}:${options.port}${options.path}`);
    
    const req = http.request(options, (res) => {
      console.log(`Response Status: ${res.statusCode}`);
      console.log(`Response Headers:`, res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response Body:', data);
        
        if (res.statusCode === 200) {
          try {
            const jsonData = JSON.parse(data);
            console.log('\n✅ Success! Parsed response:');
            console.log('- Success:', jsonData.success);
            console.log('- Data keys:', jsonData.data ? Object.keys(jsonData.data) : 'No data');
            if (jsonData.data) {
              console.log('- Match ID:', jsonData.data.match_id || jsonData.data.id);
              console.log('- Home Team:', jsonData.data.home_team);
              console.log('- Away Team:', jsonData.data.away_team);
              console.log('- Confidence:', jsonData.data.confidence || jsonData.data.total_confidence);
            }
          } catch (parseError) {
            console.log('❌ JSON Parse Error:', parseError.message);
          }
        } else {
          console.log(`\n❌ HTTP Error: ${res.statusCode}`);
          console.log('Response:', data);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Request Error:', error.message);
    });
    
    req.setTimeout(10000, () => {
      console.log('❌ Request timeout');
      req.destroy();
    });
    
    req.end();
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    // Wait for the request to complete
    setTimeout(() => {
      process.exit(0);
    }, 12000);
  }
}

testAIPredictions542703();
