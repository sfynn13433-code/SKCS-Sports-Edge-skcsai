# Weekly Global 7-Day Rolling Scrape

Schedule the full multi-sport scrape for Monday at 04:00 SAST (02:00 UTC):

- Cron expression: `0 2 * * 1`
- Target endpoint: `/api/pipeline/run-full`

## Linux crontab

```cron
0 2 * * 1 cd /path/to/SKCS-test/backend && /usr/bin/node deploy-trigger.js >> /var/log/skcs-weekly-scrape.log 2>&1
```

## Google Cloud Scheduler

```json
{
  "schedule": "0 2 * * 1",
  "timeZone": "Africa/Johannesburg",
  "description": "Initialize global multi-sport 7-day rolling scrape",
  "target": "/api/pipeline/run-full"
}
```

Use an admin API key in the request (`x-api-key`) so `/api/pipeline/run-full` is authorized.
