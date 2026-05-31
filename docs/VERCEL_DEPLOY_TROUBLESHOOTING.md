# Vercel deploy troubleshooting

## Error: `Provisioning integrations failed`

This happens **before** `npm install` / `npm run build`. Vercel is trying to attach or create a **marketplace integration** (Supabase, Neon, Upstash, etc.) and that step failed. Build time often shows **0ms**.

**This is not caused by** `apiQuotaRouter`, grading snapshot, or backend services in `backend/` — those never run on Vercel for this project.

### Fix (dashboard — no repo change required)

1. Open [Vercel Dashboard](https://vercel.com) → project **skcsaisports** (or `skcs-sports-edge-skcsai`).
2. Go to **Settings → Integrations** (or **Storage** / **Marketplace**).
3. Find linked integrations: **Supabase**, **Neon Postgres**, **Upstash**, etc.
4. For each failing one:
   - **Disconnect** from this project, **or**
   - Re-authenticate / renew access in the provider dashboard, **or**
   - If **Neon**: delete old `preview/*` branches (free plan branch limit blocks provisioning).
5. **Redeploy** (Deployments → … → Redeploy).

### SKCS does not need Supabase integration on Vercel

This frontend uses:

- `npm run build:supabase` → bundled `public/js/supabase-bundle.js`
- Auth keys via existing env vars / `public/js/config.js`
- API on **Render**, not Vercel serverless

Removing the Vercel **Supabase** marketplace integration is safe if env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY` or equivalents in the client) are already set under **Settings → Environment Variables**.

### If disconnect does not help

- Check [Vercel Status](https://www.vercel-status.com/)
- Vercel Support: mention `readyStateReason: Provisioning integrations failed`, project id from Settings
- Hobby plan with stuck legacy flags (`isUsingActiveCPU`, long function timeout) may need support to reset project backend settings

---

## What Vercel actually deploys

| Included | Excluded |
|----------|----------|
| `public/` static site | `backend/server-express.js` |
| `api/pipeline/run-full.js` (cron proxy) | `apiQuotaRouter`, grading snapshot, firewall |
| `npm run build` (supabase bundle + tailwind) | PostgreSQL / cron jobs on Render |

**Grading snapshot and API governance run on Render only.** The Accuracy Center calls `window.API_BASE_URL` (Render), not Vercel serverless.

## Most common failure causes

### 1. Native module compile during `npm install` (likely)

`package.json` includes `sqlite3` and `bcrypt` for the **Render backend**. Vercel runs `npm install` for every frontend deploy; native builds can fail on Vercel's Linux image.

**Fix (applied in `vercel.json`):**

```json
"installCommand": "npm install --ignore-scripts"
```

Vercel does not execute backend code — skipping install scripts is safe for the static + cron-proxy deploy.

### 2. Build command failure

Run locally:

```bash
npm run build
```

Must complete: `build:supabase` + `build:css`.

### 3. Cron function

Path: `/api/pipeline/run-full` → `api/pipeline/run-full.js` (proxies to Render; no backend imports).

### 4. NOT caused by recent backend services

These files are **not** bundled by Vercel unless imported from `api/`:

- `backend/services/apiQuotaRouter.js`
- `backend/services/gradingSnapshotService.js`
- `backend/services/canonicalIngestFirewall.js`

## If deploy still fails

Copy the **red error line** from Vercel → Deployment → Building. Typical patterns:

| Log text | Action |
|----------|--------|
| `Cannot find module` | Wrong path in `api/` only |
| `node-gyp` / `sqlite3` / `bcrypt` | Confirm `--ignore-scripts` in `vercel.json` |
| `Command failed: npm run build` | Run `npm run build` locally |
| `Cron` / plan limit | Check Vercel plan cron quota |

## Verify after green deploy

1. https://www.skcs.co.za loads
2. `public/js/supabase-bundle.js` present
3. Accuracy page calls Render: `/api/skcs/grading-snapshot` on `API_BASE_URL` (Render must be deployed separately)
