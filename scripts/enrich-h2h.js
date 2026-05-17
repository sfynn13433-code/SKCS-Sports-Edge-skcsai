"use strict";
const fs = require("fs");
const path = require("path");
const axios = require("axios");

function getArg(name) {
  const p = `--${name}=`;
  const f = process.argv.slice(2).find((s) => s.startsWith(p));
  return f ? f.slice(p.length) : null;
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function parseIso(dateStr, timeStr, ts) {
  if (ts) {
    const z = ts.endsWith("Z") ? ts : ts + "Z";
    const d = Date.parse(z);
    if (!Number.isNaN(d)) return d;
  }
  if (dateStr && timeStr) {
    const z = `${dateStr}T${timeStr}Z`;
    const d = Date.parse(z);
    if (!Number.isNaN(d)) return d;
  }
  if (dateStr) {
    const d = Date.parse(`${dateStr}T00:00:00Z`);
    if (!Number.isNaN(d)) return d;
  }
  return 0;
}

function normTeamName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/football club|footbal club|futbol club|f\.c\.|\bfc\b|\bsc\b|\bbc\b|\bcc\b/gi, "")
    .replace(/\bclub\b|\bthe\b/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameTeam(a, b) {
  const x = normTeamName(a);
  const y = normTeamName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length > 3 && (y.includes(x) || x.includes(y))) return true;
  return false;
}

function extractFixtures(input) {
  if (!input) return [];
  if (Array.isArray(input.events)) return input.events;
  if (Array.isArray(input)) return input;
  return [];
}

async function getLeaguePastEvents(lid, apiKey, cache) {
  if (cache && cache.leagues && cache.leagues[lid] && Array.isArray(cache.leagues[lid].events)) {
    return cache.leagues[lid].events;
  }
  const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/eventspastleague.php?id=${encodeURIComponent(lid)}`;
  try {
    const res = await axios.get(url, { timeout: 35000 });
    const data = res.data || {};
    const evs = Array.isArray(data.events) ? data.events : [];
    if (cache) {
      if (!cache.leagues) cache.leagues = {};
      cache.leagues[lid] = { events: evs, fetchedAt: new Date().toISOString() };
    }
    await delay(1200);
    return evs;
  } catch {
    return [];
  }
}

function computeH2H(pastEvents, homeTeam, awayTeam, k) {
  const h = normTeamName(homeTeam);
  const a = normTeamName(awayTeam);
  const pool = (pastEvents || []).filter((e) => e && e.strHomeTeam && e.strAwayTeam && e.intHomeScore != null && e.intAwayScore != null);
  const h2h = pool.filter((e) => (sameTeam(e.strHomeTeam, h) && sameTeam(e.strAwayTeam, a)) || (sameTeam(e.strHomeTeam, a) && sameTeam(e.strAwayTeam, h)))
    .map((e) => ({
      t: parseIso(e.dateEvent, e.strTime, e.strTimestamp),
      date: e.dateEvent || null,
      home: e.strHomeTeam || null,
      away: e.strAwayTeam || null,
      hs: Number(e.intHomeScore),
      as: Number(e.intAwayScore),
      venue: e.strVenue || null,
    }))
    .sort((x, y) => y.t - x.t)
    .slice(0, k);

  let homeWins = 0, awayWins = 0, draws = 0, homeGoals = 0, awayGoals = 0;
  for (const m of h2h) {
    const isHomeSide = sameTeam(m.home, h);
    const ourGF = isHomeSide ? m.hs : m.as;
    const ourGA = isHomeSide ? m.as : m.hs;
    if (ourGF > ourGA) homeWins += 1; else if (ourGF < ourGA) awayWins += 1; else draws += 1;
    homeGoals += ourGF;
    awayGoals += ourGA;
  }

  return {
    matches: h2h.map((m) => ({ date: m.date, home: m.home, away: m.away, score: `${m.hs}-${m.as}`, venue: m.venue })),
    summary: {
      total_matches: h2h.length,
      home_wins: homeWins,
      away_wins: awayWins,
      draws,
      home_goals: homeGoals,
      away_goals: awayGoals,
    },
  };
}

async function main() {
  const apiKey = process.env.THESPORTSDB_API_KEY || process.env.TSDB_API_KEY || "3";
  const date = getArg("date") || new Date().toISOString().slice(0, 10);
  const inFile = getArg("in");
  const outFile = getArg("out") || path.join("public", "data", `h2h-${date}.json`);
  const cachePath = path.resolve(__dirname, "..", "public", "data", "team-form-cache.json");

  let fixturesInput;
  if (inFile) {
    const p = path.resolve(process.cwd(), inFile);
    fixturesInput = JSON.parse(fs.readFileSync(p, "utf8"));
  } else {
    const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/eventsday.php?d=${encodeURIComponent(date)}`;
    const res = await axios.get(url, { timeout: 30000 });
    fixturesInput = res.data || {};
  }
  const fixtures = extractFixtures(fixturesInput);

  let cache = {};
  if (fs.existsSync(cachePath)) {
    try { cache = JSON.parse(fs.readFileSync(cachePath, "utf8")); } catch {}
  }
  if (!cache || typeof cache !== "object") cache = {};
  if (!cache.leagues) cache.leagues = {};

  const leagueSet = new Set(fixtures.map((e) => String((e.league_id || e.idLeague || "").toString().trim())).filter((x) => x));
  const leagueEvents = {};
  for (const lid of leagueSet) {
    leagueEvents[lid] = await getLeaguePastEvents(lid, apiKey, cache);
  }

  const enriched = fixtures.map((f) => {
    const lid = String((f.league_id || f.idLeague || "").toString().trim());
    const home = f.home_team || f.strHomeTeam || null;
    const away = f.away_team || f.strAwayTeam || null;
    const pool = leagueEvents[lid] || [];
    const h2h = (home && away) ? computeH2H(pool, home, away, 10) : { matches: [], summary: { total_matches: 0, home_wins: 0, away_wins: 0, draws: 0, home_goals: 0, away_goals: 0 } };
    return { ...f, h2h };
  });

  const outAbs = path.resolve(process.cwd(), outFile);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, JSON.stringify({ ok: true, date, total: enriched.length, events: enriched }, null, 2));

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));

  console.log(JSON.stringify({ ok: true, date, out: outAbs, leagues_cached: leagueSet.size }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
