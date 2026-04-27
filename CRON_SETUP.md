# Cricket Cron Setup Instructions

## cron-job.org Configuration

After deploying to Render, create the cron-job.org job with these settings:

### URL
```
https://YOUR-RENDER-BACKEND.onrender.com/api/cron/cricket/cricbuzz?secret=YOUR_CRON_SECRET
```

Replace:
- `YOUR-RENDER-BACKEND` with your actual Render backend URL
- `YOUR_CRON_SECRET` with your actual CRON_SECRET environment variable

### Schedule
**Every day at 00:01 SAST**

#### Timezone Options:
1. **Preferred**: Select timezone `Africa/Johannesburg` and set time to `00:01`
2. **UTC Only**: Set time to `22:01 UTC` (since 00:01 SAST = 22:01 UTC previous day)

### HTTP Method
```
GET
```

### Timeout
```
60 seconds
```

### Expected Success Response
```json
{
  "ok": true,
  "job": "cricbuzz-cricket-daily-publish",
  "started_at": "2026-04-27T22:01:00.000Z",
  "finished_at": "2026-04-27T22:01:18.000Z",
  "result": {
    "fixturesFetched": 13,
    "fixturesInserted": 13,
    "insightsPublished": 42,
    "skipped": 0,
    "errors": 0
  }
}
```

## Security Notes

- **DO NOT** place the RapidAPI key in cron-job.org
- **ONLY** use CRON_SECRET for authentication
- The RapidAPI key must remain in Render environment variables

## Render Environment Variables

Ensure these exist in your Render backend environment:

```bash
# Required for Cricbuzz API
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_HOST_CRICBUZZ=cricbuzz-cricket.p.rapidapi.com

# Required for cron security
CRON_SECRET=your_long_random_secret

# Database connection
DATABASE_URL=your_supabase_database_url

# Optional (for future use)
RAPIDAPI_HOST_CRICKETAPI3=cricketapi3.p.rapidapi.com
```

## Testing the Cron Endpoint

### Unauthorized Test (should fail):
```bash
curl "http://localhost:3000/api/cron/cricket/cricbuzz"
```
Expected: HTTP 401 with `{"ok": false, "error": "Unauthorized cron request"}`

### Authorized Test:
```bash
curl "http://localhost:3000/api/cron/cricket/cricbuzz?secret=YOUR_CRON_SECRET"
```
Expected: HTTP 200 with success response

## Troubleshooting

1. **401 Error**: Check that CRON_SECRET matches between Render and cron-job.org
2. **404 Error**: Verify the cron endpoint is properly deployed
3. **500 Error**: Check Render logs for script execution errors
4. **No Data**: Verify RapidAPI credentials are valid and not rate-limited

## Manual Script Execution

The script can still be run manually:
```bash
cd /path/to/project
node scripts/publish-cricbuzz-cricket.js
```

This is useful for testing outside the cron schedule.
