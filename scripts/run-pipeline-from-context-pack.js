"use strict";
const fs = require("fs");
const path = require("path");

function getArg(name) {
  const p = `--${name}=`;
  const f = process.argv.slice(2).find((s) => s.startsWith(p));
  return f ? f.slice(p.length) : null;
}

function readJson(p) {
  const txt = fs.readFileSync(p, "utf8");
  return JSON.parse(txt);
}

const { executeOperation } = require(path.resolve(__dirname, "..", "backend", "core", "executionPipeline.js"));

function ensureZ(s) {
  if (!s) return null;
  return s.endsWith("Z") ? s : `${s}Z`;
}

function isoFromEvent(e) {
  if (e.timestamp_utc) return ensureZ(String(e.timestamp_utc));
  if (e.date && e.time) return `${e.date}T${e.time}Z`;
  if (e.date) return `${e.date}T00:00:00Z`;
  return null;
}

function mapSportForDeployment(sport) {
  const k = String(sport || "").trim().toLowerCase();
  if (k === "american football") return "NFL";
  if (k === "australian football") return "AFL";
  if (k === "football (soccer)" || k === "soccer" || k === "football") return "Football";
  return sport || null;
}

function buildBookmakersH2H(home, away) {
  const safeHome = String(home || "Home");
  const safeAway = String(away || "Away");
  return [
    {
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: safeHome, price: 1.95 },
            { name: "draw", price: 3.50 },
            { name: safeAway, price: 2.05 }
          ]
        }
      ]
    }
  ];
}

function injuriesFromAvailability(av, homeTeam, awayTeam) {
  const out = [];
  const h = av && av.home && Array.isArray(av.home.reports) ? av.home.reports : [];
  const a = av && av.away && Array.isArray(av.away.reports) ? av.away.reports : [];
  for (const r of h) out.push({ team: homeTeam || "home", ...r });
  for (const r of a) out.push({ team: awayTeam || "away", ...r });
  return out;
}

function travelFatigueFromTravel(tr) {
  if (!tr || typeof tr !== "object") return null;
  const h = tr.home || {};
  const a = tr.away || {};
  const flags = [];
  const evalSide = (side) => {
    const rd = Number.isFinite(side.rest_days) ? side.rest_days : null;
    const km = Number.isFinite(side.travel_km) ? side.travel_km : null;
    if (rd != null && km != null) {
      if (rd <= 2 && km >= 500) return 0.85;
      if (rd <= 3 && km >= 300) return 0.65;
    }
    return side.fatigue_flag ? 0.6 : null;
  };
  const hv = evalSide(h);
  const av = evalSide(a);
  if (hv != null) flags.push(hv);
  if (av != null) flags.push(av);
  if (!flags.length) return null;
  return Math.max.apply(null, flags);
}

function motivationFromPressure(p) {
  if (!p || typeof p !== "object") return null;
  const hs = Number.isFinite(p.home && p.home.score) ? p.home.score : null;
  const as = Number.isFinite(p.away && p.away.score) ? p.away.score : null;
  const vals = [];
  if (hs != null) vals.push(hs);
  if (as != null) vals.push(as);
  if (!vals.length) return null;
  const avg = vals.reduce((x, y) => x + y, 0) / vals.length;
  const n = Math.max(0, Math.min(100, avg)) / 100;
  return n;
}

async function main() {
  const date = getArg("date") || new Date().toISOString().slice(0, 10);
  const inFile = getArg("in") || path.join("public", "data", `context-pack-${date}.json`);
  const isDry = process.argv.slice(2).some((s) => s === "--dry");

  if (!fs.existsSync(inFile)) {
    console.error(JSON.stringify({ ok: false, error: `Input file not found: ${inFile}` }, null, 2));
    process.exit(1);
  }

  const payload = readJson(inFile);
  const events = Array.isArray(payload.events) ? payload.events : Array.isArray(payload) ? payload : [];

  const matches = events.map((e) => {
    const home = e.home_team || e.strHomeTeam || null;
    const away = e.away_team || e.strAwayTeam || null;
    return {
      sport: mapSportForDeployment(e.sport),
      match_info: {
        match_id: String(e.id || e.idEvent || "").trim() || null,
        league: e.league || e.strLeague || null,
        country: e.country || null,
        season: e.season || e.strSeason || null,
        kickoff: isoFromEvent(e),
        venue: e.venue || e.strVenue || null,
        timezone: null,
        home_team: home,
        away_team: away
      },
      sharp_odds: {},
      contextual_intelligence: {
        injuries: injuriesFromAvailability(e.availability, home, away),
        travel_fatigue: travelFatigueFromTravel(e.travel),
        motivation_factor: motivationFromPressure(e.pressure)
      },
      raw_provider_data: {
        ...e,
        bookmakers: buildBookmakersH2H(home, away)
      },
      telemetry: {
        run_id: `context_pack_${date}`,
        source: "context_pack",
        date
      }
    };
  });

  if (isDry) {
    const { buildMatchContext } = require(path.resolve(__dirname, "..", "backend", "services", "normalizerService.js"));
    const { scoreMatch } = require(path.resolve(__dirname, "..", "backend", "services", "aiScoring.js"));

    const outputs = [];
    for (const item of matches) {
      const ctx = buildMatchContext(item);
      if (!ctx) continue;
      const score = await scoreMatch(ctx);
      outputs.push({
        match_id: ctx.match_info?.match_id || null,
        sport: item.sport || null,
        league: ctx.match_info?.league || null,
        home_team: ctx.match_info?.home_team || null,
        away_team: ctx.match_info?.away_team || null,
        kickoff: ctx.match_info?.kickoff || null,
        prediction: score?.winner || null,
        confidence: score?.confidence || null,
        volatility: score?.volatility || null,
        source: score?.source || 'offline'
      });
    }

    const outFile = path.join("public", "data", `pipeline-dry-${date}.json`);
    const outAbs = path.resolve(process.cwd(), outFile);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, JSON.stringify({ ok: true, date, total: outputs.length, predictions: outputs }, null, 2));
    console.log(JSON.stringify({ ok: true, mode: 'dry', out: outAbs, total: outputs.length }, null, 2));
    return;
  }

  const { runPipelineForMatches } = require(path.resolve(__dirname, "..", "backend", "services", "aiPipeline.js"));

  try {
    const res = await executeOperation({
      operation: 'script.context-pack.pipeline',
      caller: 'scripts/run-pipeline-from-context-pack.js',
      payload: { date, matches: matches.length },
      execute: async () => runPipelineForMatches({ matches, telemetry: { run_id: `context_pack_${date}`, source: "context_pack" } })
    });
    console.log(JSON.stringify({ ok: true, mode: res?.result && res.result.mode, summary: res.result }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err && err.message ? err.message : String(err) }, null, 2));
    process.exit(1);
  }
}

main();
