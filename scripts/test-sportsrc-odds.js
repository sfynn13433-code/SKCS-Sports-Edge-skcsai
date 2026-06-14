const axios = require('axios');

async function testOdds() {
    const apiKey = "9f4cdf502cd01fe0dc7ef944d6d31259";
    try {
        console.log("Fetching SportSRC Odds...");
        const res = await axios.get("https://api.sportsrc.org/v2/?type=odds&category=football", {
            headers: { "X-API-KEY": apiKey }
        });
        
        console.log("\n✅ SUCCESS! Response received:");
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.log("\n❌ FAILED:");
        if (e.response) {
            console.log("Status:", e.response.status);
            console.log("Data:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.log(e.message);
        }
    }
}

testOdds();
