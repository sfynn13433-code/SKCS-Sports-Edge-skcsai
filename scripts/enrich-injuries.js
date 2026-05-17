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

function uniq(arr) { return Array.from(new Set(arr)); }

function confidenceFrom(text) {
  const t = (text || "").toLowerCase();
  if (/ruled out|out for|season-ending|torn|fracture|suspended/.test(t)) return "high";
  if (/doubt|doubtful|injury|knock|set to miss|could miss/.test(t)) return "medium";
  return "low";
}

async function fetchInjuryNews(team, date, key) {
  if (!key) return [];
  const dt = new Date(date + "T00:00:00Z");
  const from = new Date(dt.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const q = `"${team}" AND (injury OR "ruled out" OR doubtful OR suspended OR "out for")`;
  const url = "https://newsapi.org/v2/everything";
  try {
    const res = await axios.get(url, {
      timeout: 20000,
      headers: { "X-Api-Key": key },
      params: { q, from, language: "en", sortBy: "publishedAt", pageSize: 10 },
    });
    const data = res.data || {};
    return Array.isArray(data.articles) ? data.articles.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function simplifyArticles(arts) {
  const out = [];
  const seen = new Set();
  for (const a of arts) {
    const item = {
      headline: a.title || null,
      source: (a.source && a.source.name) || null,
      published: a.publishedAt ? String(a.publishedAt).split("T")[0] : null,
      url: a.url || null,
      confidence: confidenceFrom((a.title || "") + " " + (a.description || "")),
    };
    const key = JSON.stringify([item.headline, item.published, item.source]);
    if (!seen.has(key)) { seen.add(key); out.push(item); }
  }
  return out;
}

async function main() {
  const date = getArg("date") || new Date().toISOString().slice(0, 10);
  const inFile = getArg("in") || path.join("public", "data", `h2h-${date}.json`);
  const outFile = getArg("out") || path.join("public", "data", `injuries-${date}.json`);
  const NEWSAPI_KEY = process.env.NEWSAPI_KEY || process.env.X_NEWSAPI_KEY || "";

  if (!fs.existsSync(inFile)) {
    console.error(JSON.stringify({ ok: false, error: `Input file not found: ${inFile}` }, null, 2));
    process.exit(1);
  }

  let input = JSON.parse(fs.readFileSync(inFile, "utf8"));
  const fixtures = Array.isArray(input.events) ? input.events : Array.isArray(input) ? input : [];

  const teamNames = uniq(
    fixtures.flatMap((f) => [f.home_team || f.strHomeTeam, f.away_team || f.strAwayTeam])
            .filter(Boolean)
  );

  const cachePath = path.resolve(__dirname, "..", "public", "data", "news-injury-cache.json");
  let cache = {};
  if (fs.existsSync(cachePath)) {
    try { cache = JSON.parse(fs.readFileSync(cachePath, "utf8")); } catch { cache = {}; }
  }
  if (!cache || typeof cache !== "object") cache = {};
  if (cache.date !== date) cache = { date, teams: {} };
  if (!cache.teams) cache.teams = {};

  for (const team of teamNames) {
    const key = team.toLowerCase();
    if (!cache.teams[key]) {
      const arts = await fetchInjuryNews(team, date, NEWSAPI_KEY);
      cache.teams[key] = simplifyArticles(arts);
      await delay(600);
    }
  }

  const enriched = fixtures.map((f) => {
    const home = f.home_team || f.strHomeTeam || "";
    const away = f.away_team || f.strAwayTeam || "";
    const hReports = cache.teams[home.toLowerCase()] || [];
    const aReports = cache.teams[away.toLowerCase()] || [];
    return {
      ...f,
      availability: {
        home: { source: NEWSAPI_KEY ? "newsapi" : "none", reports: hReports },
        away: { source: NEWSAPI_KEY ? "newsapi" : "none", reports: aReports },
      },
    };
  });

  const outAbs = path.resolve(process.cwd(), outFile);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, JSON.stringify({ ok: true, date, total: enriched.length, events: enriched }, null, 2));

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));

  console.log(JSON.stringify({ ok: true, date, teams_queried: teamNames.length, out: outAbs, cache: cachePath }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
