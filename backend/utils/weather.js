'use strict';

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const weatherCache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function getWeatherDescription(code, windSpeed) {
    if (code >= 61) return 'Rain';
    if (code >= 51) return 'Light Rain';
    if (code >= 45) return 'Cloudy';
    if (code >= 3) return 'Partly Cloudy';
    if (windSpeed > 20) return 'Windy';
    return 'Clear';
}

function getWeatherEmoji(description) {
    const emojiMap = {
        'Rain': '\uD83C\uDF27\uFE0F',
        'Light Rain': '\uD83C\uDF26\uFE0F',
        'Cloudy': '\u2601\uFE0F',
        'Partly Cloudy': '\u26C5',
        'Windy': '\uD83C\uDF2C\uFE0F',
        'Clear': '\u2600\uFE0F'
    };
    return emojiMap[description] || '\u2600\uFE0F';
}

async function getWeather(latitude, longitude, kickoffTimestamp) {
    if (!latitude || !longitude) {
        return { description: 'Unknown', temp: null, wind: null, rain: null, emoji: '\u2753' };
    }

    const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const now = Date.now();
    
    if (weatherCache.has(cacheKey)) {
        const cached = weatherCache.get(cacheKey);
        if (now - cached.timestamp < CACHE_TTL_MS) {
            return cached.data;
        }
    }

    try {
        const dateStr = new Date(kickoffTimestamp).toISOString().split('T')[0];
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,rain,wind_speed_10m,weather_code&timezone=Africa/Johannesburg&start=${dateStr}&end=${dateStr}`;
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Open-Meteo API error: ${res.status}`);
        
        const data = await res.json();
        
        if (!data.hourly || !data.hourly.time || data.hourly.time.length === 0) {
            return { description: 'Unavailable', temp: null, wind: null, rain: null, emoji: '\u2753' };
        }

        const kickoffHour = new Date(kickoffTimestamp).getHours();
        const hourIndex = Math.min(Math.max(0, kickoffHour), data.hourly.time.length - 1);
        
        const weatherCode = data.hourly.weather_code?.[hourIndex] ?? 0;
        const temp = data.hourly.temperature_2m?.[hourIndex];
        const wind = data.hourly.wind_speed_10m?.[hourIndex];
        const rain = data.hourly.rain?.[hourIndex];
        
        const description = getWeatherDescription(weatherCode, wind);
        const emoji = getWeatherEmoji(description);

        const result = {
            description,
            temp: temp !== undefined ? Math.round(temp) : null,
            wind: wind !== undefined ? Math.round(wind) : null,
            rain: rain !== undefined ? rain.toFixed(1) : null,
            emoji,
            code: weatherCode,
            fetchedAt: new Date().toISOString()
        };

        weatherCache.set(cacheKey, { data: result, timestamp: now });
        console.log(`[Weather] Fetched for ${latitude},${longitude}: ${description} ${temp}\u00B0C`);
        
        return result;
    } catch (err) {
        console.error(`[Weather] Failed to fetch weather:`, err.message);
        return { description: 'Unavailable', temp: null, wind: null, rain: null, emoji: '\u2753' };
    }
}

async function enrichWithWeather(predictions) {
    const enriched = [];
    
    for (const pred of predictions) {
        try {
            const match = pred.fixture || pred.match || {};
            const meta = match.metadata || {};
            
            const lat = meta.latitude || meta.lat || match.latitude || match.lat;
            const lon = meta.longitude || meta.lon || match.longitude || match.lon;
            const kickoffTime = match.commence_time || match.kickoff || match.start_time || match.date;
            
            if (lat && lon && kickoffTime) {
                const weather = await getWeather(lat, lon, kickoffTime);
                pred.weather = weather;
            } else {
                pred.weather = { description: 'Unknown', temp: null, wind: null, rain: null, emoji: '\u2753' };
            }
        } catch (err) {
            console.warn(`[Weather] Error enriching prediction:`, err.message);
            pred.weather = { description: 'Unavailable', temp: null, wind: null, rain: null, emoji: '\u2753' };
        }
        
        enriched.push(pred);
    }
    
    return enriched;
}

module.exports = { getWeather, enrichWithWeather };
