"use strict";
const fs = require("fs");
const path = require("path");
const axios = require("axios");

function getArg(name) {
  const p = `--${name}=`;
  const f = process.argv.slice(2).find((s) => s.startsWith(p));
  return f ? f.slice(p.length) : null;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

function computeTeamForm(pastEvents, teamName, k) {
  const tn = normTeamName(teamName);
  const games = (pastEvents || [])
    .filter((e) => e && e.strHomeTeam && e.strAwayTeam && e.intHomeScore != null && e.intAwayScore != null)
    .filter((e) => sameTeam(e.strHomeTeam, tn) || sameTeam(e.strAwayTeam, tn))
    .map((e) => ({
      t: parseIso(e.dateEvent, e.strTime, e.strTimestamp),
      h: e.strHomeTeam,
      a: e.strAwayTeam,
      hs: Number(e.intHomeScore),
      as: Number(e.intAwayScore),
    }))
    .sort((x, y) => y.t - x.t)
    .slice(0, k);

  let w = 0, d = 0, l = 0;
  let hw = 0, hd = 0, hl = 0, aw = 0, ad = 0, al = 0;
  let gf = 0, ga = 0;
  const last = [];
  for (const g of games) {
    const isHome = sameTeam(g.h, tn);
    const tgf = isHome ? g.hs : g.as;
    const tga = isHome ? g.as : g.hs;
    gf += tgf;
    ga += tga;
    if (tgf > tga) {
      w += 1; last.push("W"); if (isHome) hw += 1; else aw += 1;
    } else if (tgf === tga) {
      d += 1; last.push("D"); if (isHome) hd += 1; else ad += 1;
    } else {
      l += 1; last.push("L"); if (isHome) hl += 1; else al += 1;
    }
  }
  const n = games.length || 1;
  return {
    last5: last.join("-"),
    matches: games.length,
    goals_scored_avg: Number((gf / n).toFixed(2)),
    goals_conceded_avg: Number((ga / n).toFixed(2)),
    home_wins: hw,
    home_draws: hd,
    home_losses: hl,
    away_wins: aw,
    away_draws: ad,
    away_losses: al,
  };
}

async function main() {
  const apiKey = process.env.THESPORTSDB_API_KEY || process.env.TSDB_API_KEY || "3";
  const date = getArg("date") || new Date().toISOString().slice(0, 10);
  const inFile = getArg("in");
  const outFile = getArg("out") || path.join("public", "data", `team-form-${date}.json`);
  const cachePath = path.resolve(__dirname, "..", "public", "data", "team-form-cache.json");

  let input;
  if (inFile) {
    const p = path.resolve(process.cwd(), inFile);
    input = JSON.parse(fs.readFileSync(p, "utf8"));
  } else {
    const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/eventsday.php?d=${encodeURIComponent(date)}`;
    const res = await axios.get(url, { timeout: 30000 });
    const raw = res.data || {};
    const events = Array.isArray(raw.events) ? raw.events : [];
    input = { events: events.map((e) => ({
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
    })) };
  }

  let cache = {};
  if (fs.existsSync(cachePath)) {
    try { cache = JSON.parse(fs.readFileSync(cachePath, "utf8")); } catch {}
  }
  if (!cache || typeof cache !== "object") cache = {};
  if (cache.date !== date) cache = { date, leagues: {} };
  if (!cache.leagues) cache.leagues = {};

  const events = Array.isArray(input.events) ? input.events : [];
  const leagueSet = new Set(events.map((e) => String(e.league_id || "").trim()).filter((x) => x));

  const leagueEvents = {};
  for (const lid of leagueSet) {
    if (cache.leagues[lid] && Array.isArray(cache.leagues[lid].events)) {
      leagueEvents[lid] = cache.leagues[lid].events;
      continue;
    }
    const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/eventspastleague.php?id=${encodeURIComponent(lid)}`;
    try {
      const res = await axios.get(url, { timeout: 35000 });
      const data = res.data || {};
      const evs = Array.isArray(data.events) ? data.events : [];
      leagueEvents[lid] = evs;
      cache.leagues[lid] = { events: evs, fetchedAt: new Date().toISOString() };
    } catch (err) {
      leagueEvents[lid] = [];
    }
    await delay(1500);
  }

  const enriched = events.map((f) => {
    const lid = String(f.league_id || "").trim();
    const pool = leagueEvents[lid] || [];
    const home = computeTeamForm(pool, f.home_team, 5);
    const away = computeTeamForm(pool, f.away_team, 5);
    return { ...f, team_form: { home, away } };
  });

  const outAbs = path.resolve(process.cwd(), outFile);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, JSON.stringify({ ok: true, date, total: enriched.length, events: enriched }, null, 2));

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));

  console.log(JSON.stringify({ ok: true, date, out: outAbs, cache: cachePath, leagues_cached: leagueSet.size }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
