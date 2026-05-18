'use strict';

const axios = require('axios');
const db = require('../backend/db');

function arg(name, def = null) {
  const prefix = `--${name}=`;
  const hit = process.argv.find(a => a.startsWith(prefix));
  if (!hit) return def;
  const v = hit.slice(prefix.length);
  if (v === '' && def !== null) return def;
  return v;
}

function toInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : d;
}

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(url, params = {}, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await axios.get(url, {
        params,
        timeout: 20000,
        headers: { 'Accept-Encoding': 'gzip, deflate' }
      });
      return res.data;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      const retriable = !status || status >= 500 || status === 429;
      if (i < attempts - 1 && retriable) {
        const delay = 800 * Math.pow(2, i);
        console.warn(`[fetchJSON] Attempt ${i + 1} failed (${status || err.code || err.message}); retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

async function upsertTrack(client, track) {
  const key = track.key || slugify(track.name);
  const { rows } = await client.query(
    `insert into public.f1_tracks(key, name, city, country_code)
     values($1,$2,$3,$4)
     on conflict (key) do update set name=excluded.name, city=excluded.city, country_code=excluded.country_code, updated_at=now()
     returning id`,
    [key, track.name || key, track.city || null, track.country_code || null]
  );
  return rows[0].id;
}

async function upsertTeam(client, team) {
  const key = team.key || slugify(team.name);
  const { rows } = await client.query(
    `insert into public.f1_teams(key, name, country_code)
     values($1,$2,$3)
     on conflict (key) do update set name=excluded.name, country_code=excluded.country_code, updated_at=now()
     returning id`,
    [key, team.name || key, team.country_code || null]
  );
  return rows[0].id;
}

function splitName(full) {
  const s = String(full || '').trim();
  if (!s) return { first_name: null, last_name: null };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: null };
  return { first_name: parts.slice(0, -1).join(' '), last_name: parts.slice(-1).join('') };
}

async function upsertPerson(client, person) {
  const key = person.key || slugify([person.first_name, person.last_name].filter(Boolean).join('-') || person.name || person.code);
  const names = person.first_name || person.last_name ? person : splitName(person.name);
  const { rows } = await client.query(
    `insert into public.f1_persons(key, first_name, last_name, code, date_of_birth, country_code)
     values($1,$2,$3,$4,$5,$6)
     on conflict (key) do update set first_name=excluded.first_name, last_name=excluded.last_name, code=excluded.code, date_of_birth=coalesce(excluded.date_of_birth, public.f1_persons.date_of_birth), country_code=excluded.country_code, updated_at=now()
     returning id`,
    [
      key,
      names.first_name || null,
      names.last_name || null,
      person.code || null,
      person.date_of_birth || null,
      person.country_code || null
    ]
  );
  return rows[0].id;
}

async function upsertRace(client, race) {
  const { rows } = await client.query(
    `insert into public.f1_races(season, round, name, date, track_id, status, raw_json)
     values($1,$2,$3,$4,$5,$6,$7)
     on conflict (season, round) do update set name=excluded.name, date=excluded.date, track_id=coalesce(excluded.track_id, public.f1_races.track_id), status=excluded.status, raw_json=excluded.raw_json, updated_at=now()
     returning id`,
    [
      toInt(race.season),
      toInt(race.round),
      race.name,
      race.date ? new Date(race.date) : null,
      race.track_id || null,
      race.status || null,
      race.raw_json || {}
    ]
  );
  return rows[0].id;
}

async function upsertRoster(client, season, team_id, person_id, car_number) {
  await client.query(
    `insert into public.f1_rosters(season, team_id, person_id, car_number)
     values($1,$2,$3,$4)
     on conflict (season, team_id, person_id) do update set car_number=excluded.car_number, updated_at=now()`,
    [toInt(season), team_id, person_id, car_number || null]
  );
}

async function upsertResult(client, result) {
  await client.query(
    `insert into public.f1_results(race_id, position, person_id, team_id, laps, time_text, time_ms, status)
     values($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (race_id, person_id) do update set position=excluded.position, team_id=coalesce(excluded.team_id, public.f1_results.team_id), laps=excluded.laps, time_text=excluded.time_text, time_ms=excluded.time_ms, status=excluded.status, updated_at=now()`,
    [
      result.race_id,
      toInt(result.position),
      result.person_id || null,
      result.team_id || null,
      toInt(result.laps),
      result.time_text || null,
      toInt(result.time_ms),
      result.status || null
    ]
  );
}

async function ingestFromOpenF1(season) {
  const baseUrl = 'https://api.openf1.org/v1';
  const s = toInt(season) || new Date().getUTCFullYear();
  const client = db.pool;

  let races = [];
  // Try multiple endpoints/param names
  const candidates = [
    `${baseUrl}/races?year=${s}`,
    `${baseUrl}/races?season=${s}`,
    `${baseUrl}/sessions?year=${s}&session=Race`
  ];
  let source = null;
  for (const url of candidates) {
    try {
      const data = await fetchJSON(url, {}, 2);
      if (Array.isArray(data) && data.length) {
        races = data;
        source = url;
        break;
      }
    } catch (e) {
      // continue to next candidate
    }
  }
  if (!races.length) {
    throw new Error('OpenF1 races/sessions endpoint not available');
  }

  let roundCounter = 0;
  for (const r of races) {
    const seasonNum = toInt(r.season || r.year) || s;
    const roundNum = toInt(r.round) || (++roundCounter);
    const raceName = r.name || r.race_name || r.event_name || r.session_name || `Grand Prix ${roundNum}`;

    // Track
    const circuit = r.circuit || r.track || {};
    const circuitName = circuit.name || circuit.circuitName || circuit.long_name || r.circuit_name || r.circuit_short_name || 'Unknown Circuit';
    const city = circuit.location || circuit.city || r.location || r.city || null;
    const country = circuit.country_code || circuit.country || r.country_code || r.country || null;
    const track = {
      key: circuit.id || circuit.circuitId || slugify(circuitName),
      name: circuitName,
      city,
      country_code: country
    };
    const track_id = await upsertTrack(client, track);

    // Race
    const date = r.date || r.start_time || r.start_date || r.session_start_time || null;
    const race_id = await upsertRace(client, {
      season: seasonNum,
      round: roundNum,
      name: raceName,
      date,
      track_id,
      status: r.status || r.state || r.session_status || null,
      raw_json: { ...r, _source: source }
    });

    // Results optional — OpenF1 schema varies; skip if not present
    const results = r.results || r.classification || [];
    for (const row of Array.isArray(results) ? results : []) {
      const drv = row.driver || row.Driver || row.pilot || {};
      const team = row.team || row.Constructor || row.constructor || {};

      const person = {
        key: drv.id || drv.driverId || drv.code || slugify([drv.givenName, drv.familyName].filter(Boolean).join('-') || drv.name),
        first_name: drv.givenName || drv.first_name || null,
        last_name: drv.familyName || drv.last_name || null,
        code: drv.code || null,
        date_of_birth: drv.dateOfBirth || drv.dob || null,
        country_code: drv.nationality_code || drv.nationality || null,
        name: drv.name || [drv.givenName, drv.familyName].filter(Boolean).join(' ').trim()
      };
      const person_id = await upsertPerson(client, person);

      const teamName = team.name || team.constructorName || team.team_name || team.shortName || null;
      const team_id = teamName ? await upsertTeam(client, { key: team.id || team.constructorId || slugify(teamName), name: teamName }) : null;

      await upsertResult(client, {
        race_id,
        position: row.position || row.pos || null,
        person_id,
        team_id,
        laps: row.laps || null,
        time_text: row.Time?.time || row.time || row.result_time || null,
        time_ms: row.Time?.millis || row.time_ms || null,
        status: row.status || row.result || null
      });

      if (seasonNum && team_id && person_id) {
        await upsertRoster(client, seasonNum, team_id, person_id, row.number || row.car_number || drv.number || null);
      }
    }
  }
}

async function ingestSample(season) {
  const s = toInt(season) || new Date().getUTCFullYear();
  const client = db.pool;

  const track_id = await upsertTrack(client, {
    key: 'albert-park',
    name: 'Albert Park Circuit',
    city: 'Melbourne',
    country_code: 'AU'
  });

  const race_id = await upsertRace(client, {
    season: s,
    round: 1,
    name: 'Australian Grand Prix',
    date: `${s}-03-17T05:00:00Z`,
    track_id,
    status: 'completed',
    raw_json: { sample: true }
  });

  const p1 = await upsertPerson(client, {
    key: 'max-verstappen',
    first_name: 'Max',
    last_name: 'Verstappen',
    code: 'VER',
    date_of_birth: '1997-09-30',
    country_code: 'NL'
  });
  const p2 = await upsertPerson(client, {
    key: 'sergio-perez',
    first_name: 'Sergio',
    last_name: 'Perez',
    code: 'PER',
    date_of_birth: '1990-01-26',
    country_code: 'MX'
  });

  const tRedBull = await upsertTeam(client, { key: 'red-bull', name: 'Red Bull Racing', country_code: 'AT' });

  await upsertRoster(client, s, tRedBull, p1, '1');
  await upsertRoster(client, s, tRedBull, p2, '11');

  await upsertResult(client, {
    race_id,
    position: 1,
    person_id: p1,
    team_id: tRedBull,
    laps: 58,
    time_text: '1:32:09.143',
    time_ms: 5529143,
    status: 'Finished'
  });
  await upsertResult(client, {
    race_id,
    position: 2,
    person_id: p2,
    team_id: tRedBull,
    laps: 58,
    time_text: '+12.345s',
    time_ms: null,
    status: 'Finished'
  });
}

// -------- formula1.db (GitHub fixtures) ----------
function normalizeKey(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

async function fetchText(url, attempts = 3) {
  let err;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await axios.get(url, { responseType: 'text', timeout: 20000, headers: { 'Accept': 'text/plain' } });
      return res.data;
    } catch (e) {
      err = e;
      const delay = 600 * Math.pow(2, i);
      console.warn(`[fetchText] ${url} failed (${e?.response?.status || e.message}); retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw err;
}

function parseCircuitsTxt(txt) {
  const circuits = [];
  const lines = String(txt || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = line.match(/^([^,]+),\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    const rest = m[2].trim();
    // rest like: "Grand Prix Australia (Melbourne Circuit)|GP Australia, AUS, Melbourne, au"
    const parts = rest.split(',');
    const namePart = parts[0] || '';
    const city = (parts[2] || '').trim() || null;
    const country_code = (parts[3] || parts[1] || '').trim().toLowerCase() || null;
    const fullName = namePart.split('|')[0].trim();
    circuits.push({ key, name: fullName, city, country_code });
  }
  return circuits;
}

function parseDriversTxt(txt) {
  const drivers = [];
  const lines = String(txt || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    // examples: "Sebastian Vettel|S. Vettel|Vettel,  3 Jul 1987, VET,  Heppenheim | Hesse,  de"
    const firstComma = line.indexOf(',');
    if (firstComma === -1) continue;
    const nameBlock = line.slice(0, firstComma).trim();
    const rest = line.slice(firstComma + 1).split(',').map(s => s.trim());
    const dob = rest[0] && /\d/.test(rest[0]) ? rest[0] : null;
    const code = rest.find(t => t.length === 3 && /^[A-Z]{3}$/.test(t)) || null;
    const country_code = (rest[rest.length - 1] || '').toLowerCase() || null;
    const aliases = nameBlock.split('|').map(s => s.trim()).filter(Boolean);
    const primary = aliases[0] || nameBlock;
    let first_name = null, last_name = null;
    const partsName = primary.split(/\s+/);
    if (partsName.length === 1) {
      first_name = primary; last_name = null;
    } else {
      first_name = partsName.slice(0, -1).join(' ');
      last_name = partsName.slice(-1).join('');
    }
    drivers.push({ key: slugify(primary), name: primary, first_name, last_name, code, date_of_birth: dob ? new Date(dob) : null, country_code, aliases });
  }
  return drivers;
}

function parseTeamsTxt(txt) {
  const teams = [];
  const lines = String(txt || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = line.match(/^(.+?),\s*([a-z]{2})\s*$/i);
    if (!m) continue;
    const nameBlock = m[1].trim();
    const country_code = m[2].toLowerCase();
    const aliases = nameBlock.split('|').map(s => s.trim()).filter(Boolean);
    const primary = aliases[0] || nameBlock;
    teams.push({ key: slugify(primary), name: primary, country_code, aliases });
  }
  return teams;
}

async function listSeasonRaceFiles(season) {
  const s = toInt(season);
  const apiUrl = `https://api.github.com/repos/opensport/formula1.db/contents/${s}?ref=master`;
  try {
    const res = await axios.get(apiUrl, { timeout: 20000, headers: { 'Accept': 'application/vnd.github+json' } });
    const items = Array.isArray(res.data) ? res.data : [];
    return items.filter(it => /gp-.*\.txt$/i.test(it.name)).map(it => ({ name: it.name, download_url: it.download_url || `https://raw.githubusercontent.com/opensport/formula1.db/master/${s}/${it.name}` }));
  } catch (e) {
    // Fallback: scrape HTML directory listing
    const html = await fetchText(`https://github.com/opensport/formula1.db/tree/master/${s}`);
    const files = [];
    const re = /href=\"[^\"]*\/${s}\/([0-9]{2}-gp-[^\"]+?\.txt)\"/gi;
    let m;
    while ((m = re.exec(html))) {
      const name = m[1];
      files.push({ name, download_url: `https://raw.githubusercontent.com/opensport/formula1.db/master/${s}/${name}` });
    }
    return files;
  }
}

function parseRaceFile(text) {
  const out = { name: null, round: null, date: null, results: [] };
  const lines = String(text || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const header = line.replace(/^#\s*/, '');
    if (!out.name && /grand prix/i.test(header) && /round\s+\d+/i.test(header)) {
      // e.g. Grand Prix Monaco 2013 -  Round 6 of 19
      out.name = header.replace(/\s*-\s*Round.+$/i, '').trim();
      const rm = header.match(/round\s+(\d+)/i);
      if (rm) out.round = toInt(rm[1]);
      continue;
    }
    if (!out.date && /^-\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/.test(header)) {
      // e.g. - 26 May 2013 / Race
      const dm = header.match(/-\s*(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/);
      if (dm) {
        const d = new Date(dm[1]);
        if (!isNaN(d)) out.date = d.toISOString();
      }
      continue;
    }
    // Results lines: start with a number or 'Ret'
    if (/^(\d+|Ret|DNS|DSQ)\b/.test(line)) {
      const posM = line.match(/^(\d+)/);
      const position = posM ? toInt(posM[1]) : null;
      // Try to split columns by two-or-more spaces
      const cols = line.replace(/^\d+\s+/, '').split(/\s{2,}/);
      // Expect: [Driver, Team, Laps, TimeOrStatus]
      const driverName = (cols[0] || '').trim();
      const teamName = (cols[1] || '').trim();
      const laps = toInt((cols[2] || '').trim());
      const timeOrStatus = (cols[3] || '').trim();
      out.results.push({ position, driverName, teamName, laps, timeOrStatus });
    }
  }
  return out;
}

async function ingestFromFormula1Db(season) {
  const s = toInt(season) || 2013;
  const client = db.pool;

  // Load dictionaries
  const [circuitsTxt, driversTxt, teamsTxt] = await Promise.all([
    fetchText('https://raw.githubusercontent.com/opensport/formula1.db/master/circuits.txt'),
    fetchText('https://raw.githubusercontent.com/opensport/formula1.db/master/drivers.txt'),
    fetchText('https://raw.githubusercontent.com/opensport/formula1.db/master/teams.txt')
  ]);
  const circuits = parseCircuitsTxt(circuitsTxt);
  const drivers = parseDriversTxt(driversTxt);
  const teams = parseTeamsTxt(teamsTxt);

  const circuitByName = new Map(circuits.map(c => [normalizeKey(c.name), c]));
  const driversByNorm = new Map();
  for (const d of drivers) {
    const names = [d.name, ...(d.aliases || [])];
    for (const n of names) driversByNorm.set(normalizeKey(n), d);
  }
  const teamsByNorm = new Map();
  for (const t of teams) {
    const names = [t.name, ...(t.aliases || [])];
    for (const n of names) teamsByNorm.set(normalizeKey(n), t);
  }

  // Upsert circuits base
  const trackIdCache = new Map();
  for (const c of circuits) {
    const id = await upsertTrack(client, c);
    trackIdCache.set(normalizeKey(c.name), id);
  }

  const files = await listSeasonRaceFiles(s);
  // Keep files ordered by leading number (round)
  files.sort((a, b) => {
    const am = a.name.match(/^(\d{2})/); const bm = b.name.match(/^(\d{2})/);
    return toInt((am && am[1]) || 0) - toInt((bm && bm[1]) || 0);
  });

  let roundCounter = 0;
  for (const file of files) {
    const raw = await fetchText(file.download_url);
    const parsed = parseRaceFile(raw);
    const round = parsed.round || (++roundCounter);
    const raceName = parsed.name || file.name.replace(/\.txt$/,'');
    const trackNorm = normalizeKey(raceName.replace(/\d{4}.*/, '').replace(/grand prix/i, '').trim());
    let track_id = trackIdCache.get(normalizeKey(raceName));
    if (!track_id) {
      // Try fuzzy by city or short name
      const guess = circuitByName.get(normalizeKey(`Grand Prix ${trackNorm}`)) || null;
      if (guess) {
        track_id = await upsertTrack(client, guess);
      } else {
        // Fallback: create track with race name
        track_id = await upsertTrack(client, { key: slugify(raceName), name: raceName, city: null, country_code: null });
      }
      trackIdCache.set(normalizeKey(raceName), track_id);
    }

    const race_id = await upsertRace(client, {
      season: s,
      round,
      name: raceName,
      date: parsed.date || null,
      track_id,
      status: 'completed',
      raw_json: { source: 'formula1.db', file: file.name }
    });

    for (const row of parsed.results) {
      const drvMeta = driversByNorm.get(normalizeKey(row.driverName)) || { key: slugify(row.driverName), name: row.driverName };
      const teamMeta = teamsByNorm.get(normalizeKey(row.teamName)) || { key: slugify(row.teamName), name: row.teamName };

      const person_id = await upsertPerson(client, drvMeta);
      const team_id = await upsertTeam(client, teamMeta);

      await upsertResult(client, {
        race_id,
        position: row.position || null,
        person_id,
        team_id,
        laps: row.laps || null,
        time_text: row.timeOrStatus || null,
        time_ms: null,
        status: /\+|:/.test(row.timeOrStatus || '') ? 'Finished' : (row.timeOrStatus || null)
      });

      await upsertRoster(client, s, team_id, person_id, null);
    }
  }
}

async function ingestFromErgast(season) {
  const s = toInt(season) || new Date().getUTCFullYear();
  const bases = ['https://ergast.com/api/f1', 'http://ergast.com/api/f1'];
  const client = db.pool;

  let races = [];
  let baseOk = null;
  for (const base of bases) {
    try {
      const cal = await fetchJSON(`${base}/${s}.json`, { limit: 100 });
      races = cal?.MRData?.RaceTable?.Races || [];
      baseOk = base;
      break;
    } catch (e) {
      console.warn(`[Ergast] Calendar fetch failed on ${base}: ${e?.message}`);
    }
  }
  if (!baseOk) {
    throw new Error('Ergast calendar unavailable on all mirrors');
  }

  for (const r of races) {
    const circuit = r?.Circuit || {};
    const loc = circuit?.Location || {};
    const trackName = circuit?.circuitName || 'Unknown Circuit';
    const track = {
      key: circuit?.circuitId || slugify(trackName),
      name: trackName,
      city: loc?.locality || null,
      country_code: loc?.country || null
    };
    const track_id = await upsertTrack(client, track);

    const when = r?.date ? (r?.time ? `${r.date}T${r.time}` : `${r.date}T00:00:00Z`) : null;
    await upsertRace(client, {
      season: s,
      round: toInt(r?.round),
      name: r?.raceName || 'Grand Prix',
      date: when,
      track_id,
      status: null,
      raw_json: r
    });
  }

  // 2) Results for the season (all rounds)
  let resRaces = [];
  for (const base of bases) {
    try {
      const resData = await fetchJSON(`${base}/${s}/results.json`, { limit: 2000 });
      resRaces = resData?.MRData?.RaceTable?.Races || [];
      break;
    } catch (e) {
      console.warn(`[Ergast] Results fetch failed on ${base}: ${e?.message}`);
    }
  }

  for (const rr of resRaces) {
    const round = toInt(rr?.round);
    const raceRow = await client.query(
      'select id from public.f1_races where season=$1 and round=$2 limit 1',
      [s, round]
    );
    const race_id = raceRow?.rows?.[0]?.id || null;
    if (!race_id) continue;

    const results = rr?.Results || [];
    for (const row of results) {
      const drv = row?.Driver || {};
      const con = row?.Constructor || {};

      const person = {
        key: drv?.driverId || drv?.code || slugify([drv?.givenName, drv?.familyName].filter(Boolean).join('-') || drv?.permanentNumber || ''),
        first_name: drv?.givenName || null,
        last_name: drv?.familyName || null,
        code: drv?.code || drv?.permanentNumber || null,
        date_of_birth: drv?.dateOfBirth || null,
        country_code: drv?.nationality || null,
        name: [drv?.givenName, drv?.familyName].filter(Boolean).join(' ').trim()
      };
      const person_id = await upsertPerson(client, person);

      const teamName = con?.name || null;
      const team_id = teamName
        ? await upsertTeam(client, { key: con?.constructorId || slugify(teamName), name: teamName, country_code: con?.nationality || null })
        : null;

      let pos = toInt(row?.position);
      if (!Number.isFinite(pos)) {
        const t = String(row?.positionText || '').trim();
        const maybe = Number(t);
        pos = Number.isFinite(maybe) ? Math.floor(maybe) : null;
      }

      await upsertResult(client, {
        race_id,
        position: pos,
        person_id,
        team_id,
        laps: toInt(row?.laps),
        time_text: row?.Time?.time || row?.status || null,
        time_ms: toInt(row?.Time?.millis),
        status: row?.status || null
      });

      if (s && team_id && person_id) {
        await upsertRoster(client, s, team_id, person_id, row?.number || drv?.permanentNumber || null);
      }
    }
  }
}

async function main() {
  const season = toInt(arg('season')) || new Date().getUTCFullYear();
  const source = String(arg('source', 'openf1')).toLowerCase();

  console.log(`[F1 Import] start source=${source} season=${season}`);

  try {
    if (source === 'ergast') {
      await ingestFromErgast(season);
    } else if (source === 'openf1') {
      // Try OpenF1 first; on failure, fall back to Ergast schedule/results
      try {
        await ingestFromOpenF1(season);
      } catch (err) {
        console.warn(`[F1 Import] OpenF1 failed (${err?.message}). Falling back to Ergast...`);
        await ingestFromErgast(season);
      }
    } else if (source === 'sample') {
      await ingestSample(season);
    } else if (source === 'formula1db' || source === 'fixtures' || source === 'github') {
      await ingestFromFormula1Db(season);
    } else {
      // Unknown source → use robust default (Ergast)
      await ingestFromErgast(season);
    }

    console.log('[F1 Import] done');
    process.exit(0);
  } catch (err) {
    console.error('[F1 Import] failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  console.error('[F1 Import] This importer is disabled in this deployment. No action taken.');
  process.exit(1);
}
