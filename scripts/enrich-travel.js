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

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

async function getEventDetails(idEvent, tsdbKey, eventCache) {
  const k = String(idEvent || "").trim();
  if (!k) return null;
  if (eventCache[k]) return eventCache[k];
  const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(tsdbKey)}/lookupevent.php?id=${encodeURIComponent(k)}`;
  try {
    const res = await axios.get(url, { timeout: 25000 });
    const data = res.data || {};
    const ev = Array.isArray(data.events) && data.events.length ? data.events[0] : null;
    if (ev) eventCache[k] = ev;
    await delay(300);
    return ev;
  } catch {
    return null;
  }
}

async function getVenueCoords(venueId, venueCache, tsdbKey) {
  const k = String(venueId || "").trim();
  if (!k) return null;
  if (venueCache[k]) return venueCache[k];
  const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(tsdbKey)}/lookupvenue.php?id=${encodeURIComponent(k)}`;
  try {
    const res = await axios.get(url, { timeout: 25000 });
    const data = res.data || {};
    const v = Array.isArray(data.venues) && data.venues.length ? data.venues[0] : null;
    if (!v || !v.strLatitude || !v.strLongitude) return null;
    const coords = { lat: parseFloat(v.strLatitude), lon: parseFloat(v.strLongitude), name: v.strVenue || null };
    venueCache[k] = coords;
    await delay(300);
    return coords;
  } catch {
    return null;
  }
}

function collectLeagueEvents(cacheObj) {
  if (!cacheObj || typeof cacheObj !== "object") return [];
  const leagues = cacheObj.leagues || {};
  const all = [];
  for (const lid of Object.keys(leagues)) {
    const arr = leagues[lid] && Array.isArray(leagues[lid].events) ? leagues[lid].events : [];
    for (const e of arr) all.push(e);
  }
  return all;
}

function findTeamMatchesBefore(allEvents, teamName, beforeTs) {
  const tn = normTeamName(teamName);
  const pool = allEvents.filter((e) => e && e.strHomeTeam && e.strAwayTeam);
  const withTime = pool.map((e) => ({
    ev: e,
    t: parseIso(e.dateEvent, e.strTime, e.strTimestamp),
  })).filter((x) => x.t && x.t < beforeTs && (sameTeam(x.ev.strHomeTeam, tn) || sameTeam(x.ev.strAwayTeam, tn)));
  withTime.sort((a, b) => b.t - a.t);
  return withTime;
}

async function main() {
  const date = getArg("date") || new Date().toISOString().slice(0, 10);
  const inFile = getArg("in") || path.join("public", "data", `injuries-${date}.json`);
  const outFile = getArg("out") || path.join("public", "data", `travel-${date}.json`);
  const tsdbKey = process.env.THESPORTSDB_API_KEY || process.env.TSDB_API_KEY || "3";

  if (!fs.existsSync(inFile)) {
    console.error(JSON.stringify({ ok: false, error: `Input file not found: ${inFile}` }, null, 2));
    process.exit(1);
  }

  let input = JSON.parse(fs.readFileSync(inFile, "utf8"));
  const fixtures = Array.isArray(input.events) ? input.events : Array.isArray(input) ? input : [];

  const teamFormCachePath = path.resolve(__dirname, "..", "public", "data", "team-form-cache.json");
  let teamFormCache = {};
  if (fs.existsSync(teamFormCachePath)) {
    try { teamFormCache = JSON.parse(fs.readFileSync(teamFormCachePath, "utf8")); } catch { teamFormCache = {}; }
  }
  const allPast = collectLeagueEvents(teamFormCache);

  const venueCachePath = path.resolve(__dirname, "..", "public", "data", "venue-cache.json");
  let venueCache = {};
  if (fs.existsSync(venueCachePath)) {
    try { venueCache = JSON.parse(fs.readFileSync(venueCachePath, "utf8")); } catch { venueCache = {}; }
  }

  const eventCachePath = path.resolve(__dirname, "..", "public", "data", "event-details-cache.json");
  let eventCache = {};
  if (fs.existsSync(eventCachePath)) {
    try { eventCache = JSON.parse(fs.readFileSync(eventCachePath, "utf8")); } catch { eventCache = {}; }
  }

  const todayTs = parseIso(date, null, null);
  const out = [];

  for (const f of fixtures) {
    const idEvent = String(f.id || f.idEvent || "").trim();
    let todayVenueId = f.idVenue || null;
    if (!todayVenueId && idEvent) {
      const ev = await getEventDetails(idEvent, tsdbKey, eventCache);
      todayVenueId = ev && ev.idVenue ? ev.idVenue : null;
    }
    const todayCoords = todayVenueId ? await getVenueCoords(todayVenueId, venueCache, tsdbKey) : null;

    const travel = {};
    for (const side of ["home", "away"]) {
      const teamName = side === "home" ? (f.home_team || f.strHomeTeam) : (f.away_team || f.strAwayTeam);
      const mlist = findTeamMatchesBefore(allPast, teamName, todayTs);
      const last = mlist.length ? mlist[0] : null;
      let restDays = null;
      let travelKm = null;
      let lastVenueName = null;
      let cumulative7 = null;

      if (last) {
        restDays = Math.floor((todayTs - last.t) / (1000 * 60 * 60 * 24));
        const lastIdVenue = last.ev.idVenue || null;
        let lastCoords = null;
        if (lastIdVenue) lastCoords = await getVenueCoords(lastIdVenue, venueCache, tsdbKey);
        else if (last.ev.idEvent) {
          const evd = await getEventDetails(last.ev.idEvent, tsdbKey, eventCache);
          if (evd && evd.idVenue) lastCoords = await getVenueCoords(evd.idVenue, venueCache, tsdbKey);
        }
        if (lastCoords && todayCoords) {
          travelKm = Math.round(haversine(lastCoords.lat, lastCoords.lon, todayCoords.lat, todayCoords.lon));
          lastVenueName = lastCoords.name || null;
        }
        const weekAgoTs = todayTs - 7 * 24 * 60 * 60 * 1000;
        let cum = 0;
        let prevCoords = lastCoords;
        let prevTs = last.t;
        for (let i = 1; i < mlist.length; i += 1) {
          const e = mlist[i];
          if (e.t < weekAgoTs) break;
          let eCoords = null;
          const eIdVenue = e.ev.idVenue || null;
          if (eIdVenue) eCoords = await getVenueCoords(eIdVenue, venueCache, tsdbKey);
          else if (e.ev.idEvent) {
            const evd2 = await getEventDetails(e.ev.idEvent, tsdbKey, eventCache);
            if (evd2 && evd2.idVenue) eCoords = await getVenueCoords(evd2.idVenue, venueCache, tsdbKey);
          }
          if (prevCoords && eCoords) cum += haversine(eCoords.lat, eCoords.lon, prevCoords.lat, prevCoords.lon);
          prevCoords = eCoords || prevCoords;
          prevTs = e.t;
        }
        if (prevCoords && todayCoords) cum += haversine(prevCoords.lat, prevCoords.lon, todayCoords.lat, todayCoords.lon);
        cumulative7 = cum ? Math.round(cum) : null;
      }

      travel[side] = {
        rest_days: restDays,
        travel_km: travelKm,
        cumulative_7d_km: cumulative7,
        last_match_date: last ? last.ev.dateEvent || null : null,
        last_venue: lastVenueName,
        fatigue_flag: restDays != null && restDays <= 3 && travelKm != null && travelKm >= 300,
      };
    }

    out.push({ ...f, travel });
    await delay(100);
  }

  fs.mkdirSync(path.dirname(eventCachePath), { recursive: true });
  fs.writeFileSync(eventCachePath, JSON.stringify(eventCache, null, 2));
  fs.writeFileSync(venueCachePath, JSON.stringify(venueCache, null, 2));

  const outAbs = path.resolve(process.cwd(), outFile);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, JSON.stringify({ ok: true, date, total: out.length, events: out }, null, 2));
  console.log(JSON.stringify({ ok: true, date, out: outAbs }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
