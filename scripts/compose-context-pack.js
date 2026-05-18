"use strict";
const fs = require("fs");
const path = require("path");

function getArg(name) {
  const p = `--${name}=`;
  const f = process.argv.slice(2).find((s) => s.startsWith(p));
  return f ? f.slice(p.length) : null;
}

function readJsonIfExists(p) {
  try {
    if (!p) return null;
    if (!fs.existsSync(p)) return null;
    const txt = fs.readFileSync(p, "utf8");
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function toId(e) {
  const v = e && (e.id || e.idEvent || null);
  return v != null ? String(v).trim() : null;
}

function indexById(arr) {
  const out = new Map();
  for (const e of Array.isArray(arr) ? arr : []) {
    const k = toId(e);
    if (k) out.set(k, e);
  }
  return out;
}

function listEvents(obj) {
  if (!obj) return [];
  if (Array.isArray(obj.events)) return obj.events;
  if (Array.isArray(obj)) return obj;
  return [];
}

function pickBaseEvent(id, sources) {
  const order = ["importance", "travel", "injuries", "h2h", "form", "day"];
  for (const key of order) {
    const e = sources[key].get(id);
    if (e) return JSON.parse(JSON.stringify(e));
  }
  return { id };
}

function overlay(target, src, field) {
  if (!src) return;
  const val = src[field];
  if (val === undefined) return;
  target[field] = val;
}

async function main() {
  const date = getArg("date") || new Date().toISOString().slice(0, 10);
  const outRel = getArg("out") || path.join("public", "data", `context-pack-${date}.json`);
  const baseDir = process.cwd();

  const files = {
    importance: path.resolve(baseDir, path.join("public", "data", `importance-${date}.json`)),
    travel: path.resolve(baseDir, path.join("public", "data", `travel-${date}.json`)),
    injuries: path.resolve(baseDir, path.join("public", "data", `injuries-${date}.json`)),
    h2h: path.resolve(baseDir, path.join("public", "data", `h2h-${date}.json`)),
    form: path.resolve(baseDir, path.join("public", "data", `team-form-${date}.json`)),
    day: path.resolve(baseDir, path.join("public", "data", `tsdb-day-${date}.json`))
  };

  const raw = {
    importance: readJsonIfExists(files.importance),
    travel: readJsonIfExists(files.travel),
    injuries: readJsonIfExists(files.injuries),
    h2h: readJsonIfExists(files.h2h),
    form: readJsonIfExists(files.form),
    day: readJsonIfExists(files.day)
  };

  const idx = {
    importance: indexById(listEvents(raw.importance)),
    travel: indexById(listEvents(raw.travel)),
    injuries: indexById(listEvents(raw.injuries)),
    h2h: indexById(listEvents(raw.h2h)),
    form: indexById(listEvents(raw.form)),
    day: indexById(listEvents(raw.day))
  };

  const ids = new Set();
  for (const key of Object.keys(idx)) {
    for (const k of idx[key].keys()) ids.add(k);
  }

  const merged = [];
  for (const id of ids) {
    const base = pickBaseEvent(id, idx);

    const fromForm = idx.form.get(id) || idx.h2h.get(id) || idx.injuries.get(id) || idx.travel.get(id) || idx.importance.get(id);
    if (fromForm && fromForm.team_form) overlay(base, fromForm, "team_form");

    const fromH2H = idx.h2h.get(id) || idx.injuries.get(id) || idx.travel.get(id) || idx.importance.get(id);
    if (fromH2H && fromH2H.h2h) overlay(base, fromH2H, "h2h");

    const fromInj = idx.injuries.get(id) || idx.travel.get(id) || idx.importance.get(id);
    if (fromInj && fromInj.availability) overlay(base, fromInj, "availability");

    const fromTravel = idx.travel.get(id) || idx.importance.get(id);
    if (fromTravel && fromTravel.travel) overlay(base, fromTravel, "travel");

    const fromImp = idx.importance.get(id);
    if (fromImp && fromImp.pressure) overlay(base, fromImp, "pressure");

    merged.push(base);
  }

  const outAbs = path.resolve(baseDir, outRel);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, JSON.stringify({ ok: true, date, total: merged.length, events: merged }, null, 2));

  const used = Object.keys(raw).filter((k) => !!raw[k]);
  const missing = Object.keys(raw).filter((k) => !raw[k]);
  console.log(JSON.stringify({ ok: true, date, out: outAbs, sources_used: used, sources_missing: missing, total: merged.length }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
