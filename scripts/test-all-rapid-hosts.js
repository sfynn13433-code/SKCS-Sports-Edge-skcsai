require('dotenv').config({ path: 'backend/.env' });

const axios = require("axios");

const KEY = process.env.RAPIDAPI_KEY;

if (!KEY) {
  console.error("❌ RAPIDAPI_KEY not found");
  process.exit(1);
}

const hosts = [
  "sofascore.p.rapidapi.com",
  "flashlive-sports.p.rapidapi.com",
  "free-api-live-football-data.p.rapidapi.com",
  "livescore6.p.rapidapi.com",
  "allsportsapi2.p.rapidapi.com",
  "sport-api1.p.rapidapi.com"
];

const endpoints = [
  "/v1/competitions",
  "/v1/fixtures?sport=soccer",
  "/fixtures/live",
  "/v1/matches/live",
  "/v1/fixtures?sport=soccer",
  "/v1/odds"
];

async function testHost(host, endpoint) {
  try {
    const url = `https://${host}${endpoint}`;
    const res = await axios.get(url, {
      headers: {
        "x-rapidapi-key": KEY,
        "x-rapidapi-host": host
      },
      timeout: 10000
    });

    console.log(`✅ ${host} WORKING → status ${res.status}`);
    return true;
  } catch (err) {
    if (err.response) {
      console.log(`❌ ${host} FAILED → ${err.response.status}`);
    } else {
      console.log(`❌ ${host} ERROR → ${err.message}`);
    }
    return false;
  }
}

(async () => {
  console.log("🔍 Testing RapidAPI hosts with real endpoints...\n");

  for (let i = 0; i < hosts.length; i++) {
    await testHost(hosts[i], endpoints[i]);
  }

  console.log("\n✅ Test complete");
})();