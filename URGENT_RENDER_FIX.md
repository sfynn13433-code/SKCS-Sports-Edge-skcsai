# URGENT: Add DATA_MODE Environment Variable to Render

## THE PROBLEM

Your Render backend is running in **TEST MODE** instead of **LIVE MODE**.

This means:
- ❌ It's using HARDCODED test data (April 5th fixtures)
- ❌ It's NOT fetching live fixtures from API-Sports
- ❌ All predictions are stale test data

## THE FIX

### Step 1: Go to Render Dashboard
1. Open: https://dashboard.render.com
2. Log in
3. Click on your `skcsai-z8cd` service

### Step 2: Add Environment Variable
1. Click the **Environment** tab
2. Scroll down to **Environment Variables**
3. Click **Add Environment Variable**
4. Add:
   - **Key:** `DATA_MODE`
   - **Value:** `live`
5. Click **Save**

### Step 3: Redeploy
1. Go to the **Manual Deploy** section (or wait for auto-deploy)
2. Click **Deploy Latest Commit**
3. Wait for deployment to complete (2-5 minutes)

### Step 4: Verify
Once deployed, the sync will use LIVE API data instead of test data.

## WHAT TO EXPECT

After redeployment:
1. Old April 5th test data will be gone
2. New predictions will use **TODAY's** fixtures from API-Sports
3. You should see current April 8th+ matches

## VERIFICATION COMMAND

After redeployment completes, the next sync will use live data automatically.

## WHY THIS HAPPENED

The `DATA_MODE` environment variable was missing from Render.
When missing, the code defaults to `'test'` mode (see `backend/config.js`):
```javascript
DATA_MODE: process.env.DATA_MODE || 'test'
```

This caused the sync service to use `buildTestData()` which returns 8 hardcoded test fixtures instead of fetching from live APIs.

## FIX APPLIED

✅ Added `DATA_MODE=live` to `backend/.env` (local development)
✅ Added `DATA_MODE=live` to `render.yaml` (deployment config)
✅ Pushed to GitHub

## REMAINING ACTION

⚠️ **YOU MUST MANUALLY ADD `DATA_MODE=live` IN RENDER DASHBOARD**

This cannot be automated until the new render.yaml is deployed.
