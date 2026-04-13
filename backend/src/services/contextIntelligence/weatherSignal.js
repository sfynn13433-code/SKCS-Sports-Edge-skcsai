const axios = require('axios');

function toRisk(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

function inferRiskFromSummary(summary) {
  const key = String(summary || '').toLowerCase();
  if (!key) return null;
  if (key.includes('storm') || key.includes('heavy rain') || key.includes('snow')) return 0.75;
  if (key.includes('rain') || key.includes('wind') || key.includes('poor pitch')) return 0.45;
  if (key.includes('clear') || key.includes('sun') || key.includes('ideal')) return 0.1;
  return null;
}

async function getWeatherSignal(weatherOrLocation, locationOrKickoff, maybeKickoff) {
  const hasStructuredWeather = weatherOrLocation && typeof weatherOrLocation === 'object' && !Array.isArray(weatherOrLocation);
  if (hasStructuredWeather) {
    const structured = weatherOrLocation;
    const structuredRisk = toRisk(
      structured.risk ?? structured.weather_risk ?? structured.severity ?? inferRiskFromSummary(structured.summary || structured.condition)
    );

    if (structuredRisk !== null) {
      return {
        weather_risk: structuredRisk,
        meta: {
          ...structured,
          status: 'normalized_context'
        }
      };
    }
  }

  const stadiumLocation = hasStructuredWeather ? locationOrKickoff : weatherOrLocation;
  const kickoffTime = hasStructuredWeather ? maybeKickoff : locationOrKickoff;

  try {
    if (!stadiumLocation || !kickoffTime) {
      return {
        weather_risk: 0,
        meta: { status: 'unavailable', reason: 'missing location/kickoff' }
      };
    }

    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return {
        weather_risk: 0,
        meta: { status: 'unavailable', reason: 'WEATHER_API_KEY missing' }
      };
    }

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
    console.warn(`[SKCS Edge] Weather API failed for ${stadiumLocation || 'unknown venue'}:`, error.message);
    return {
      weather_risk: 0,
      meta: { status: 'failed', reason: 'API timeout/error' }
    };
  }
}
module.exports = getWeatherSignal;
