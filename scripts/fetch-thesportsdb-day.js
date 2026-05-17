"use strict";
const fs = require("fs");
const path = require("path");
const axios = require("axios");

function getArg(name) {
  const pref = `--${name}=`;
  const found = process.argv.slice(2).find((s) => s.startsWith(pref));
  return found ? found.slice(pref.length) : null;
}

async function main() {
  const apiKey = process.env.THESPORTSDB_API_KEY || process.env.TSDB_API_KEY || "3";
  const date = getArg("date") || new Date().toISOString().slice(0, 10);
  const out = getArg("out");
  const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/eventsday.php?d=${encodeURIComponent(date)}`;

  let data;
  try {
    let res;
    try {
      res = await axios.get(url, { timeout: 30000, validateStatus: () => true });
    } catch (netErr) {
      console.error(JSON.stringify({ ok: false, date, error: netErr.message }, null, 2));
      process.exit(1);
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers?.['retry-after'] || 25);
      await delay(Math.max(25, retryAfter) * 1000);
      const retry = await axios.get(url, { timeout: 30000 }).catch(e => ({ data: null }));
      data = retry.data || {};
    } else if (res.status >= 200 && res.status < 300) {
      data = res.data || {};
      await delay(25000); // pacing after success
    } else {
      console.error(JSON.stringify({ ok: false, date, status: res.status, error: res.statusText }, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({ ok: false, date, error: err.message }, null, 2));
    process.exit(1);
  }

  const events = Array.isArray(data.events) ? data.events : [];

  const bySport = {};
  const byLeague = {};
  for (const e of events) {
    const s = (e.strSport || "Unknown").trim();
    const l = (e.strLeague || "Unknown").trim();
    bySport[s] = (bySport[s] || 0) + 1;
    byLeague[l] = (byLeague[l] || 0) + 1;
  }

  const sportsArr = Object.entries(bySport)
    .map(([sport, count]) => ({ sport, count }))
    .sort((a, b) => b.count - a.count);
  const leaguesArr = Object.entries(byLeague)
    .map(([league, count]) => ({ league, count }))
    .sort((a, b) => b.count - a.count);

  const normalized = events.map((e) => ({
    id: e.idEvent || null,
    sport: e.strSport || null,
    league_id: e.idLeague || null,
    league: e.strLeague || null,
    season: e.strSeason || null,
    event: e.strEvent || null,
    event_alt: e.strEventAlternate || null,
    home_team: e.strHomeTeam || null,
    away_team: e.strAwayTeam || null,
    timestamp_utc: e.strTimestamp ? (e.strTimestamp.endsWith("Z") ? e.strTimestamp : e.strTimestamp + "Z") : null,
    date: e.dateEvent || null,
    time: e.strTime || null,
    status: e.strStatus || null,
    country: e.strCountry || null,
    city: e.strCity || null,
    venue: e.strVenue || null,
    round: e.intRound || null,
    home_score: e.intHomeScore || null,
    away_score: e.intAwayScore || null,
  }));

  const output = {
    ok: true,
    source: "TheSportsDB",
    date,
    total: events.length,
    by_sport: sportsArr,
    by_league_top30: leaguesArr.slice(0, 30),
    events: normalized,
  };

  if (out) {
    const outPath = path.resolve(process.cwd(), out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(output));
  }

  console.log(JSON.stringify(output, null, 2));
}

main();
