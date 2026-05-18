"use strict";
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const API_KEY = process.env.THESPORTSDB_API_KEY || process.env.TSDB_API_KEY || "3";
const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(API_KEY)}`;
const CONFIG_FILE = path.resolve(__dirname, "..", "src", "data", "sportsdb-leagues.json");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function pickHighOrFirst(entry) {
  if (!entry || !Array.isArray(entry.leagues) || entry.leagues.length === 0) return null;
  const high = entry.leagues.find((l) => l.priority === "high");
  return high || entry.leagues[0];
}

async function fetchJson(url) {
  const res = await axios.get(url, { timeout: 30000 });
  return res.data || {};
}

async function main() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error("Config file not found. Run npm run build-config first.");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  const sports = config.sports || {};
  const today = new Date().toISOString().slice(0, 10);

  const results = [];

  for (const [sportCode, entry] of Object.entries(sports)) {
    const league = pickHighOrFirst(entry);
    if (!league) {
      results.push({ sport: sportCode, league: "-", upcoming: 0, today: 0, status: "No leagues" });
      continue;
    }

    try {
      const nextUrl = `${BASE_URL}/eventsnextleague.php?id=${league.id}`;
      const next = await fetchJson(nextUrl);
      const upcoming = Array.isArray(next.events) ? next.events.length : 0;

      await delay(1200);

      const dayUrl = `${BASE_URL}/eventsday.php?d=${today}&s=${encodeURIComponent(entry.rawSport || sportCode)}`;
      const day = await fetchJson(dayUrl);
      const todayCount = Array.isArray(day.events) ? day.events.length : 0;

      results.push({ sport: sportCode, league: `${league.name} (${league.id})`, upcoming, today: todayCount, status: upcoming > 0 ? "✅" : "❌" });
    } catch (err) {
      results.push({ sport: sportCode, league: `${league.name} (${league.id})`, upcoming: 0, today: 0, status: `Error: ${err.message}` });
    }

    await delay(2500);
  }

  // Print markdown table for easy copy/paste
  console.log("| Sport Code | League Checked | Upcoming | Today | Status |");
  console.log("|------------|----------------|----------|-------|--------|");
  for (const r of results) {
    console.log(`| ${r.sport} | ${r.league} | ${r.upcoming} | ${r.today} | ${r.status} |`);
  }

  const allGood = results.every((r) => r.upcoming > 0);
  if (!allGood) {
    console.log("\nSome sports have zero upcoming events (❌). Consider adding supplemental sources.");
  } else {
    console.log("\nAll verified sports have upcoming events (✅). You can lock the config.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
