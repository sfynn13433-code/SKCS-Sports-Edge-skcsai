const axios = require('axios');

async function getWeatherSignal(stadiumLocation, kickoffTime) {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    const response = await axios.get(`https://api.weatherapi.com/v1/forecast.json`, {
      params: { key: apiKey, q: stadiumLocation, dt: kickoffTime.split('T')[0] },
      timeout: 4500 // Failsafe timeout prevents Cloud Run hanging
    });

    const forecast = response.data.forecast.forecastday[0].hour.find(h => h.time.includes(kickoffTime.slice(11, 13)));
    if (!forecast) throw new Error("Hourly forecast data missing");

    const { temp_c, wind_kph, humidity, condition } = forecast;
    let risk = 0;

    // Sharpened thresholds for elite European pitches
    if (condition.text.toLowerCase().match(/rain|snow|storm/)) risk += 0.3;
    if (wind_kph > 35) risk += 0.4; // Wind severely disrupts xG models
    if (humidity > 90) risk += 0.2; // Amplifies late-game physical attrition
    if (temp_c < 2 || temp_c > 32) risk += 0.3;

    return {
      weather_risk: Math.min(risk, 1),
      meta: { temp_c, wind_kph, humidity, condition: condition.text, status: 'success' }
    };
  } catch (error) {
    console.warn(`[SKCS Edge] Weather API failed for ${stadiumLocation}:`, error.message);
    return {
      weather_risk: 0,
      meta: { status: 'failed', reason: 'API timeout/error' }
    };
  }
}
module.exports = getWeatherSignal;
