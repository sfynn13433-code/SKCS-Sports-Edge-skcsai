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

function parseSeasonYear(dateStr, seasonStr) {
  if (seasonStr) {
    const m = String(seasonStr).match(/(\d{4})(?:\s*[-/]\s*(\d{4}))?/);
    if (m) return Number(m[1]);
  }
  const d = new Date(dateStr || Date.now());
  const y = d.getUTCFullYear();
  const mth = d.getUTCMonth() + 1;
  if (mth <= 6) return y;
  return y;
}

async function fetchAPIFixtureList(date, leagueId, season, apiKey) {
  const url = `https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(date)}&league=${encodeURIComponent(leagueId)}&season=${encodeURIComponent(season)}`;
  const res = await axios.get(url, { timeout: 30000, headers: { "x-apisports-key": apiKey } });
  const data = res.data || {};
  return Array.isArray(data.response) ? data.response : [];
}

async function fetchAPILineups(fixtureId, apiKey) {
  const url = `https://v3.football.api-sports.io/fixtures/lineups?fixture=${encodeURIComponent(fixtureId)}`;
  const res = await axios.get(url, { timeout: 30000, headers: { "x-apisports-key": apiKey } });
  const data = res.data || {};
  return Array.isArray(data.response) ? data.response : [];
}

async function fetchTSDBEvent(eventId, tsdbKey) {
  const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(tsdbKey)}/lookupevent.php?id=${encodeURIComponent(eventId)}`;
  const res = await axios.get(url, { timeout: 30000 });
  const data = res.data || {};
  return Array.isArray(data.events) && data.events.length ? data.events[0] : null;
}

function parseTSDBLineups(ev) {
  if (!ev) return null;
  const homeFormation = ev.strHomeFormation || null;
  const awayFormation = ev.strAwayFormation || null;
  const split = (s) => String(s || "").split(/;|,|\n|\r/g).map((x) => x.trim()).filter(Boolean).map((name) => ({ name, number: null, position: null }));
  const homePlayers = []
    .concat(split(ev.strHomeLineupGoalkeeper).map((p) => ({ ...p, position: "GK" })))
    .concat(split(ev.strHomeLineupDefense).map((p) => ({ ...p, position: "DF" })))
    .concat(split(ev.strHomeLineupMidfield).map((p) => ({ ...p, position: "MF" })))
    .concat(split(ev.strHomeLineupForward).map((p) => ({ ...p, position: "FW" })));
  const awayPlayers = []
    .concat(split(ev.strAwayLineupGoalkeeper).map((p) => ({ ...p, position: "GK" })))
    .concat(split(ev.strAwayLineupDefense).map((p) => ({ ...p, position: "DF" })))
    .concat(split(ev.strAwayLineupMidfield).map((p) => ({ ...p, position: "MF" })))
    .concat(split(ev.strAwayLineupForward).map((p) => ({ ...p, position: "FW" })));
  const homeSubs = split(ev.strHomeLineupSubstitutes);
  const awaySubs = split(ev.strAwayLineupSubstitutes);
  if (!homePlayers.length && !awayPlayers.length && ev.strLineup) {
    try { return JSON.parse(ev.strLineup); } catch {}
  }
  if (!homePlayers.length && !awayPlayers.length) return null;
  return { home: { formation: homeFormation, players: homePlayers, substitutes: homeSubs }, away: { formation: awayFormation, players: awayPlayers, substitutes: awaySubs } };
}

async function main() {
  const date = getArg("date") || new Date().toISOString().slice(0, 10);
  const inFile = getArg("in");
  const outFile = getArg("out") || path.join("public", "data", `lineups-${date}.json`);
  const apiKey = process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY || process.env.X_APIFOOTBALL_KEY || "";
  const tsdbKey = process.env.THESPORTSDB_API_KEY || process.env.TSDB_API_KEY || "3";

  let input;
  if (inFile) {
    const p = path.resolve(process.cwd(), inFile);
    input = JSON.parse(fs.readFileSync(p, "utf8"));
  } else {
    const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(tsdbKey)}/eventsday.php?d=${encodeURIComponent(date)}`;
    const res = await axios.get(url, { timeout: 30000 });
    input = res.data || {};
  }
  const fixtures = Array.isArray(input.events) ? input.events : Array.isArray(input) ? input : [];

  const LEAGUE_MAP = {
    "4328": 39,
    "4335": 140,
    "4332": 135,
    "4329": 78,
    "4334": 61,
  };

  const byLeague = new Map();
  const soccerFixtures = fixtures.filter((f) => {
    const sport = f.sport || f.strSport || "";
    const isSoccer = /soccer/i.test(sport) || (f.league && /league|liga|serie|bundesliga|ligue/i.test(f.league));
    const lid = String(f.league_id || f.idLeague || "").trim();
    return isSoccer && LEAGUE_MAP[lid];
  });

  for (const f of soccerFixtures) {
    const lid = String(f.league_id || f.idLeague).trim();
    if (!byLeague.has(lid)) byLeague.set(lid, []);
    byLeague.get(lid).push(f);
  }

  const apifLeagueFixtures = new Map();
  for (const [lid, list] of byLeague.entries()) {
    const apifL = LEAGUE_MAP[lid];
    const season = parseSeasonYear(date, list[0]?.season || "");
    if (!apiKey) { apifLeagueFixtures.set(lid, []); continue; }
    try {
      const rows = await fetchAPIFixtureList(date, apifL, season, apiKey);
      apifLeagueFixtures.set(lid, rows);
    } catch { apifLeagueFixtures.set(lid, []); }
    await delay(800);
  }

  const out = [];
  for (const f of fixtures) {
    const lid = String(f.league_id || f.idLeague || "").trim();
    const eventId = String(f.id || f.idEvent || "").trim();
    let lineups = null;

    if (soccerFixtures.includes(f)) {
      const apifRows = apifLeagueFixtures.get(lid) || [];
      const hName = f.home_team || f.strHomeTeam || "";
      const aName = f.away_team || f.strAwayTeam || "";
      let apifFixture = null;
      for (const r of apifRows) {
        const hn = r?.teams?.home?.name || "";
        const an = r?.teams?.away?.name || "";
        if ((sameTeam(hn, hName) && sameTeam(an, aName)) || (sameTeam(hn, aName) && sameTeam(an, hName))) {
          apifFixture = r; break;
        }
      }
      if (apifFixture) {
        try {
          const lineupResp = await fetchAPILineups(apifFixture.fixture?.id, apiKey);
          if (Array.isArray(lineupResp) && lineupResp.length) {
            const formatted = { home: null, away: null };
            for (const t of lineupResp) {
              const teamData = {
                formation: t.formation || null,
                players: Array.isArray(t.startXI) ? t.startXI.map((p) => ({ name: p.player?.name || null, number: p.player?.number || null, position: p.player?.pos || null })) : [],
                substitutes: Array.isArray(t.substitutes) ? t.substitutes.map((p) => ({ name: p.player?.name || null, number: p.player?.number || null, position: p.player?.pos || null })) : [],
              };
              if (sameTeam(t.team?.name, hName)) formatted.home = teamData; else if (sameTeam(t.team?.name, aName)) formatted.away = teamData;
            }
            if (formatted.home && formatted.away) lineups = formatted;
          }
        } catch {}
        await delay(700);
      }
    }

    if (!lineups && eventId) {
      try {
        const ev = await fetchTSDBEvent(eventId, tsdbKey);
        const tsdb = parseTSDBLineups(ev);
        if (tsdb) lineups = tsdb;
      } catch {}
      await delay(500);
    }

    out.push({ ...f, lineups: lineups || null });
  }

  const outAbs = path.resolve(process.cwd(), outFile);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, JSON.stringify({ ok: true, date, total: out.length, events: out }, null, 2));
  console.log(JSON.stringify({ ok: true, date, out: outAbs }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
