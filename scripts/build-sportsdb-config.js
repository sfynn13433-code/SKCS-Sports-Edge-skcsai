"use strict";
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const API_KEY = process.env.THESPORTSDB_API_KEY || process.env.TSDB_API_KEY || "3";
const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(API_KEY)}`;
const RAW_SPORTS_FILE = path.resolve(__dirname, "..", "public", "data", "all_sports_raw.json");
const CONFIG_FILE = path.resolve(__dirname, "..", "src", "data", "sportsdb-leagues.json");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SPORT_CODE_MAP = {
  "Soccer": "Football (Soccer)",
  "American Football": "NFL",
  "Basketball": "NBA",
  "Ice Hockey": "NHL",
  "Baseball": "MLB",
  "MMA": "MMA (UFC)",
  "Boxing": "Boxing",
  "Motorsport": "F1",
  "Tennis": "Tennis",
  "Cricket": "Cricket",
  "eSports": "eSports",
  "Golf": "Golf",
  "Australian Football": "AFL",
  "Rugby Union": "Rugby",
  "Rugby League": "Rugby",
  "Volleyball": "Volleyball",
  "Handball": "Handball",
  "Formula E": "Formula E",
  "Athletics": "Athletics",
  "Cycling": "Cycling",
  "Darts": "Darts",
  "Snooker": "Snooker",
  "Table Tennis": "Table Tennis",
  "Badminton": "Badminton",
  "Hockey": "Hockey",
  "Lacrosse": "Lacrosse",
  "Netball": "Netball",
  "Squash": "Squash",
  "Swimming": "Swimming",
};

const FEATURED_LEAGUES = new Set([
  '4328',
  '4335',
  '4332',
  '4329',
  '4334',
  '4391',
  '4387',
  '4380',
  '4424',
  '4443',
  '4370',
  '4358',
  '4359',
  '4487',
  '4519',
  '4480',
  '4481',
  '4485',
  '4504',
  '4333',
  '4354',
  '4414',
  '4371',
]);

const CURRENT_YEAR = new Date().getFullYear();

function shouldSkipByName(leagueName) {
  const name = (leagueName || '').trim();
  if (!name) return true;
  if (name.startsWith('_')) return true;
  const dead = /Defunct|Teams|Clubs|Friendlies|Exhibition|Legends|All Stars|Test/i;
  return dead.test(name);
}

function isActiveSeason(sport, currentSeason) {
  if (!currentSeason) return true;
  const s = String(currentSeason);
  const yr = String(CURRENT_YEAR);
  const yrPrev = String(CURRENT_YEAR - 1);
  const yearRound = new Set(['Tennis', 'Golf', 'Cricket', 'eSports', 'Boxing', 'MMA']);
  const looksRecent = s.includes(yr) || s.includes(yrPrev);
  if (looksRecent) return true;
  return yearRound.has(sport);
}

function getPriority(leagueName, country, sport, currentSeason) {
  if (shouldSkipByName(leagueName)) return 'skip';
  if (!isActiveSeason(sport, currentSeason)) return 'skip';

  const n = (leagueName || '').toLowerCase();
  const c = (country || '').toLowerCase();

  if (sport === 'Soccer') {
    if (
      n.includes('premier league') ||
      n.includes('la liga') ||
      (n.includes('serie a') && !n.includes('b')) ||
      n.includes('bundesliga') ||
      n.includes('ligue 1') ||
      n.includes('champions league') ||
      n.includes('europa league')
    ) return 'high';
    if (
      n.includes('eredivisie') ||
      n.includes('primeira liga') ||
      n.includes('mls') ||
      n.includes('brasileir') ||
      n.includes('libertadores')
    ) return 'medium';
  }

  if (sport === 'American Football') {
    if (n.includes('nfl') || n.includes('xfl') || n.includes('ufl') || n.includes('cfl')) return 'high';
    if (n.includes('europe') || n.includes('european')) return 'medium';
  }

  if (sport === 'Basketball' && (n.includes('nba') || n.includes('euroleague'))) return 'high';
  if (sport === 'Ice Hockey' && (n.includes('nhl') || n.includes('khl'))) return 'high';
  if (sport === 'Baseball' && (n.includes('mlb') || n.includes('npb'))) return 'high';

  if (sport === 'MMA' && (n.includes('ufc') || n.includes('bellator') || n.includes('pfl'))) return 'high';
  if (sport === 'Boxing' && (n.includes('wbc') || n.includes('wba') || n.includes('ibf') || n.includes('wbo'))) return 'medium';

  if (sport === 'Motorsport' && (n.includes('formula 1') || n === 'f1' || n.includes('f1'))) return 'high';
  if (sport === 'Formula E') return 'high';

  if (sport === 'Tennis' && (/(^|\b)(atp|wta)(\b|$)/.test(n) || n.includes('grand slam'))) return 'high';

  if (sport === 'Cricket' && /(ipl|big bash|the hundred|psl|cpl|bpl|t20 blast|icc)/i.test(n)) return 'high';

  if ((sport === 'Rugby Union' || sport === 'Rugby') && /(six nations|premiership|urc|super rugby|top 14|heineken)/i.test(n)) return 'high';
  if (sport === 'Rugby League' && /(nrl|super league)/i.test(n)) return 'high';

  if (sport === 'eSports' && /(lck|lec|lcs|cdl|esl|blast|msi|worlds)/i.test(n)) return 'high';

  if (sport === 'Golf' && /(pga|european tour|dp world|liv)/i.test(n)) return 'high';

  if (sport === 'Australian Football' && /(afl)/i.test(n)) return 'high';

  return 'low';
}



async function main() {
  const sportsUrl = `${BASE_URL}/all_sports.php`;
  const sportsRes = await axios.get(sportsUrl, { timeout: 45000 });
  const sportsPayload = sportsRes.data || {};
  let sports = Array.isArray(sportsPayload.sports) ? sportsPayload.sports : [];

  fs.mkdirSync(path.dirname(RAW_SPORTS_FILE), { recursive: true });
  fs.writeFileSync(RAW_SPORTS_FILE, JSON.stringify(sports, null, 2));
  console.log(`Sports list from API: ${sports.length} sports`);

  if (sports.length < 10) {
    console.log('Free tier returned limited sports. Using fallback list to cover all 16+ codes.');
    const FALLBACK_SPORTS = [
      'Soccer', 'American Football', 'Basketball', 'Baseball', 'Ice Hockey',
      'MMA', 'Boxing', 'Motorsport', 'Tennis', 'Cricket', 'eSports', 'Golf',
      'Australian Football', 'Rugby Union', 'Rugby League', 'Volleyball',
      'Handball', 'Formula E', 'Athletics', 'Cycling', 'Darts', 'Snooker',
      'Table Tennis', 'Badminton', 'Hockey', 'Lacrosse', 'Netball', 'Squash',
      'Swimming'
    ];
    sports = FALLBACK_SPORTS.map((name) => ({ strSport: name }));
  }

  const config = { sports: {}, _meta: { generated: new Date().toISOString(), source: "TheSportsDB free tier" } };
  let totalLeagues = 0;

  for (const s of sports) {
    const rawSportName = s.strSport || "Other";
    const sportCode = SPORT_CODE_MAP[rawSportName] || rawSportName;

    if (!config.sports[sportCode]) {
      config.sports[sportCode] = { rawSport: rawSportName, leagues: [] };
    }

    const leagueUrl = `${BASE_URL}/search_all_leagues.php?s=${encodeURIComponent(rawSportName)}`;
    try {
      const leagueRes = await axios.get(leagueUrl, { timeout: 45000 });
      const leaguePayload = leagueRes.data || {};
      const leagues = Array.isArray(leaguePayload.countries)
        ? leaguePayload.countries
        : (Array.isArray(leaguePayload.countrys) ? leaguePayload.countrys : []);
      for (const lg of leagues) {
        const id = String(lg.idLeague || '').trim();
        if (!/^\d+$/.test(id) || id === '0') continue;

        let priority;
        if (FEATURED_LEAGUES.has(id)) {
          priority = 'high';
        } else {
          priority = getPriority(lg.strLeague, lg.strCountry, rawSportName, lg.strCurrentSeason || '');
        }
        if (priority === 'skip') continue;

        config.sports[sportCode].leagues.push({
          id,
          name: lg.strLeague || "",
          alternate: lg.strLeagueAlternate || "",
          country: lg.strCountry || "",
          priority,
        });
      }
      totalLeagues += leagues.length;
    } catch (err) {
      // skip errors per sport to continue building config
    }

    await delay(2500);
  }

  const order = { high: 0, medium: 1, low: 2 };
  for (const k of Object.keys(config.sports)) {
    config.sports[k].leagues.sort((a, b) => (order[a.priority] - order[b.priority]) || a.name.localeCompare(b.name));
  }

  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(JSON.stringify({ ok: true, sports: Object.keys(config.sports).length, totalLeagues, out: CONFIG_FILE }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
