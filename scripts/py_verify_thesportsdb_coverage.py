#!/usr/bin/env python3
import os, sys, json, argparse, urllib.parse, urllib.request, time

def getenv_many(*names, default=""):
    for name in names:
        val = os.getenv(name)
        if val and str(val).strip():
            return str(val).strip()
    return default

def mask_key(value):
    v = str(value or "").strip()
    if not v:
        return "missing"
    return (v[:4] + "..." + v[-4:]) if len(v) > 8 else (v[:2] + "***")

def get_json(base, path, params=None, timeout=30, min_delay_sec=25):
    qs = urllib.parse.urlencode(params or {})
    url = f"{base}{path}{'?' if qs else ''}{qs}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            data = resp.read()
            payload = json.loads(data.decode("utf-8"))
            # Provider pacing: wait after every successful call
            time.sleep(min_delay_sec)
            return payload
    except urllib.error.HTTPError as e:
        # Respect Retry-After on 429
        if e.code == 429:
            retry_after = e.headers.get('Retry-After')
            try:
                delay = int(retry_after)
            except Exception:
                delay = min_delay_sec
            time.sleep(max(min_delay_sec, delay))
            # single retry after backoff
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                data = resp.read()
                payload = json.loads(data.decode("utf-8"))
                time.sleep(min_delay_sec)
                return payload
        raise

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=time.strftime("%Y-%m-%d"))
    parser.add_argument("--out", default="")
    args = parser.parse_args()

    key = getenv_many("THESPORTSDB_KEY", "THESPORTSDB_API_KEY", "SPORTS_DB_KEY", "TSDB_API_KEY", default="3")
    base = f"https://www.thesportsdb.com/api/v1/json/{urllib.parse.quote(key)}"

    # 1) List all sports
    sports_payload = get_json(base, "/all_sports.php")
    sports = [s.get("strSport") for s in (sports_payload.get("sports") or []) if s.get("strSport")] \
             or ["Soccer", "Basketball", "Baseball", "Ice Hockey", "American Football", "Rugby", "Tennis", "Cricket", "Motorsport", "MMA"]

    # 2) Day events per sport
    day_counts = []
    for s in sports:
        try:
            data = get_json(base, "/eventsday.php", {"d": args.date, "s": s})
            n = len(data.get("events") or [])
            day_counts.append({"sport": s, "today": n})
        except Exception as e:
            day_counts.append({"sport": s, "today": 0, "error": str(e)})

    # 3) Upcoming for a representative league set (from project config)
    league_ids = [
        "4328", "4332", "4331", "4335", "4334",  # Football top 5
        "4387",                 # NBA
        "4424",                 # MLB
        "4380",                 # NHL
        "4391"                  # NFL
    ]
    next_counts = []
    for lid in league_ids:
        try:
            data = get_json(base, "/eventsnextleague.php", {"id": lid})
            n = len(data.get("events") or [])
            next_counts.append({"league_id": lid, "upcoming": n})
        except Exception as e:
            next_counts.append({"league_id": lid, "upcoming": 0, "error": str(e)})

    summary = {
        "ok": True,
        "key_masked": mask_key(key),
        "date": args.date,
        "sports_checked": len(sports),
        "by_sport_today": sorted(day_counts, key=lambda r: r.get("today", 0), reverse=True),
        "by_league_upcoming": next_counts
    }

    if args.out:
        out_path = os.path.abspath(args.out)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)

    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    main()
