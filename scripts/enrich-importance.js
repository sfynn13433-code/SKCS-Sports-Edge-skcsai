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

function computeGenericPressure(fixture) {
  const round = String(fixture.intRound || fixture.round || "");
  const isKnockout = /playoff|final|semi|quarter|cup|knockout/i.test(round) || /cup|playoff/i.test(fixture.strLeague || "");
  if (isKnockout) return { score: 90, reason: "Playoff / knockout match" };
  const rn = parseInt(round, 10);
  if (!Number.isNaN(rn) && rn >= 30) return { score: 40, reason: "End of season" };
  return { score: 10, reason: "Regular season" };
}

function pickRowForPosition(table, pos) {
  return table.find((r) => {
    const rp = parseInt(r.intRank || r.intPosition || r.intPlace || r.position, 10);
    return rp === pos;
  });
}

function findTeamRow(table, teamName) {
  const tn = normTeamName(teamName);
  let row = table.find((r) => sameTeam(r.strTeam || r.teamname || r.team, tn));
  if (row) return row;
  row = table.find((r) => normTeamName(r.strTeam || r.teamname || r.team) === tn);
  return row || null;
}

function computeSoccerPressure(teamName, table, formLast5) {
  const row = findTeamRow(table, teamName);
  if (!row) return null;

  const totalTeams = table.length || 20;
  const position = parseInt(row.intRank || row.intPosition, 10) || 0;
  const points = parseInt(row.intPoints || row.points, 10) || 0;
  const played = parseInt(row.intPlayed || row.played, 10) || 0;

  const defaultTotal = 38;
  const gamesRemaining = Math.max(0, defaultTotal - played);

  const relegationLinePos = Math.max(1, totalTeams - 3);
  const relRow = pickRowForPosition(table, relegationLinePos);
  const safetyPoints = relRow ? (parseInt(relRow.intPoints || relRow.points, 10) || 40) : 40;
  const pointsToSafety = safetyPoints - points;

  const clRow = pickRowForPosition(table, 4);
  const elRow = pickRowForPosition(table, 6);
  const clPoints = clRow ? (parseInt(clRow.intPoints || clRow.points, 10) || 70) : 70;
  const elPoints = elRow ? (parseInt(elRow.intPoints || elRow.points, 10) || 60) : 60;

  let score = 0;
  const reasons = [];

  if (position >= relegationLinePos) {
    score += 90;
    reasons.push("Relegation battle");
  } else if (pointsToSafety <= 6 && gamesRemaining <= 5) {
    score += 70;
    reasons.push(`${pointsToSafety} points from safety`);
  }

  if (position <= 3 && gamesRemaining <= 10) {
    score += 80;
    reasons.push("Title race");
  }

  if (position <= 6 && points >= elPoints - 5) {
    score += 60;
    reasons.push("European qualification");
  }

  if (formLast5) {
    const wins = (String(formLast5).match(/W/g) || []).length;
    if (wins >= 4) {
      score += 15;
      reasons.push("Strong form");
    } else if (wins <= 1 && pointsToSafety > 0) {
      score += 10;
      reasons.push("Poor form, must improve");
    }
  }

  return { score: Math.min(100, score), reason: reasons.join("; ") || "Mid-table" };
}

async function getStandings(leagueId, season, cache, tsdbKey) {
  const lid = String(leagueId || "").trim();
  const sea = String(season || "").trim();
  if (!cache[lid]) cache[lid] = {};
  if (cache[lid][sea]) return cache[lid][sea];
  const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(tsdbKey)}/lookuptable.php?l=${encodeURIComponent(lid)}&s=${encodeURIComponent(sea)}`;
  try {
    const res = await axios.get(url, { timeout: 30000 });
    const data = res.data || {};
    const table = Array.isArray(data.table) ? data.table : [];
    cache[lid][sea] = table;
    await delay(400);
    return table;
  } catch {
    return [];
  }
}

async function main() {
  const date = getArg("date") || new Date().toISOString().slice(0, 10);
  const inFile = getArg("in") || path.join("public", "data", `travel-${date}.json`);
  const outFile = getArg("out") || path.join("public", "data", `importance-${date}.json`);
  const tsdbKey = process.env.THESPORTSDB_API_KEY || process.env.TSDB_API_KEY || "3";

  if (!fs.existsSync(inFile)) {
    console.error(JSON.stringify({ ok: false, error: `Input file not found: ${inFile}` }, null, 2));
    process.exit(1);
  }

  const configPath = path.resolve(__dirname, "..", "src", "data", "sportsdb-leagues.json");
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const soccerLeagueIds = new Set(((cfg.sports && cfg.sports["Football (Soccer)"] && cfg.sports["Football (Soccer)"].leagues) || []).map((l) => String(l.id)));

  let input = JSON.parse(fs.readFileSync(inFile, "utf8"));
  const fixtures = Array.isArray(input.events) ? input.events : Array.isArray(input) ? input : [];

  const standingsCachePath = path.resolve(__dirname, "..", "public", "data", "standings-cache.json");
  let standingsCache = {};
  if (fs.existsSync(standingsCachePath)) {
    try { standingsCache = JSON.parse(fs.readFileSync(standingsCachePath, "utf8")); } catch { standingsCache = {}; }
  }

  const out = [];
  for (const f of fixtures) {
    const lid = String(f.league_id || f.idLeague || "").trim();
    const season = String(f.season || f.strSeason || "").trim() || `${new Date(date).getUTCFullYear()}-${new Date(date).getUTCFullYear() + 1}`;
    let homePressure = null;
    let awayPressure = null;

    if (soccerLeagueIds.has(lid)) {
      const table = await getStandings(lid, season, standingsCache, tsdbKey);
      if (table && table.length) {
        homePressure = computeSoccerPressure(f.home_team || f.strHomeTeam, table, f.team_form && f.team_form.home && f.team_form.home.last5);
        awayPressure = computeSoccerPressure(f.away_team || f.strAwayTeam, table, f.team_form && f.team_form.away && f.team_form.away.last5);
      }
    }

    if (!homePressure) homePressure = computeGenericPressure(f);
    if (!awayPressure) awayPressure = computeGenericPressure(f);

    out.push({ ...f, pressure: { home: homePressure, away: awayPressure } });
  }

  fs.mkdirSync(path.dirname(standingsCachePath), { recursive: true });
  fs.writeFileSync(standingsCachePath, JSON.stringify(standingsCache, null, 2));

  const outAbs = path.resolve(process.cwd(), outFile);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, JSON.stringify({ ok: true, date, total: out.length, events: out }, null, 2));
  console.log(JSON.stringify({ ok: true, date, out: outAbs }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
