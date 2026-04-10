'use strict';

require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const cors         = require('cors');
const morgan       = require('morgan');
const { spawn }    = require('child_process');
const moment       = require('moment-timezone');
const path         = require('path');
const { query }            = require('./db');
const { requireRole }        = require('./utils/auth');
const {
    createSubscriptionRecord,
    hasUsedDayZeroForUser,
    upsertProfile
} = require('./database');
const { getPlan }           = require('./config/subscriptionPlans');
const { requireSupabaseUser } = require('./middleware/supabaseJwt');
const cron         = require('node-cron');
const { syncAllSports, syncSports }      = require('./services/syncService');
const { bootstrap }          = require('./dbBootstrap');
const {
    calculateExpirationTime,
    calculateSubscriptionStart,
    formatSastDateTime
} = require('./services/subscriptionTiming');

const { getPlanCapabilities, filterPredictionsForPlan } = require('./config/subscriptionMatrix');
const { normalizeFixtureDate, getPredictionWindow, isFixtureEligibleForPrediction } = require('./utils/dateNormalization');

void bootstrap().catch(err => console.error('[startup] bootstrap failed:', err.message));

const WEEKLY_ROLLING_SCRAPE_CRON = '0 2 * * 1'; // Monday 02:00 UTC = 04:00 SAST

cron.schedule(WEEKLY_ROLLING_SCRAPE_CRON, () => {
    console.log('[cron] Triggering weekly global 7-day rolling scrape (04:00 SAST / 02:00 UTC)');
    void syncAllSports().catch(err => console.error('[cron] Weekly rolling scrape failed:', err));
}, { timezone: 'UTC' });

function warnEnv(name) {
    if (!process.env[name] || String(process.env[name]).trim().length === 0) {
        console.warn(`[env] warning: ${name} is not set`);
    }
}
warnEnv('DATABASE_URL');
warnEnv('ADMIN_API_KEY');
warnEnv('USER_API_KEY');
warnEnv('GEMINI_API_KEY');

const predictionsRouter = require('./routes/predictions');
const pipelineRouter    = require('./routes/pipeline');
const debugRouter       = require('./routes/debug');
const userRouter        = require('./routes/user');
const chatRouter        = require('./routes/chat');
const accuracyRouter    = require('./routes/accuracy');

const app = express();

app.disable('x-powered-by');

const configuredOrigins = String(process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "https://skcsaiedge.onrender.com",
  "https://skcsai-z8cd.onrender.com",
  "https://skcs-sports-edge-skcsai.onrender.com",
  "https://skcs-sports-edge.github.io",
  "https://skcsaisports.vercel.app",
  "https://skcsai.vercel.app",
  "https://skcs-sports-edge-skcsai.vercel.app",
  "https://skcs.co.za",
  "https://www.skcs.co.za",
  "https://skcsaisports-5ltic8509-stephens-projects-e3dd898a.vercel.app",
  "https://skcsaisports-6x2zcgjq1-stephens-projects-e3dd898a.vercel.app",
  "https://skcsaisports-o200aflsl-stephens-projects-e3dd898a.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174"
]);

for (const origin of configuredOrigins) {
  allowedOrigins.add(origin);
}

if (process.env.RENDER_EXTERNAL_URL) {
  try {
    const u = new URL(process.env.RENDER_EXTERNAL_URL);
    allowedOrigins.add(u.origin);
  } catch { /* ignore invalid URL */ }
}

function isAllowedVercelPreview(origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'https:') return false;

    return (
      hostname === 'skcsaisports.vercel.app' ||
      hostname === 'skcsai.vercel.app' ||
      hostname === 'skcs-sports-edge-skcsai.vercel.app' ||
      /^skcsaisports-[a-z0-9-]+\.vercel\.app$/i.test(hostname) ||
      /^skcsai-[a-z0-9-]+\.vercel\.app$/i.test(hostname) ||
      /^skcs-sports-edge-skcsai(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(hostname)
    );
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, cb) {
    if (!origin || allowedOrigins.has(origin) || isAllowedVercelPreview(origin)) {
      return cb(null, true);
    }
    cb(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true
};

app.use(cors(corsOptions));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});

app.use(globalLimiter);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://*.supabase.co', 'https://api.odds.p.rapidapi.com', 'https://v3.football.api-sports.io'],
      fontSrc: ["'self'", 'data:', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com']
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
}

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor(process.uptime()),
    env: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (_req, res) => {
  res.redirect('/index.html');
});

async function proxyOdds(req, res) {
  if (!process.env.ODDS_API_KEY) {
    return res.status(503).json({ error: 'Odds API not configured' });
  }

  const target = `https://api.the-odds-api.com/v4${req.path}`;
  const params = { ...req.query, apiKey: process.env.ODDS_API_KEY };

  try {
    const axios = require('axios');
    const response = await axios.get(target, { params, timeout: 10000 });
    res.json(response.data);
  } catch (err) {
    console.error('[odds-proxy] error:', err.message);
    res.status(502).json({ error: 'Upstream error', details: err.message });
  }
}

app.use('/api/proxy/odds', proxyOdds);

app.use('/api/predictions', predictionsRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/debug', debugRouter);
app.use('/api/user', userRouter);
app.use('/api/chat', chatRouter);
app.use('/api/edgemind', chatRouter);
app.use('/api/accuracy', accuracyRouter);

// --- Cloud Scheduler endpoints -------------------------------------------------
// These match the URLs documented in docs/google-cloud-soccer-refresh.md
// and expected by the skcs-football-refresh / skcs-football-grade scheduler jobs.

function requireRefreshKey(req, res, next) {
    const key = req.headers['x-api-key'];
    const refreshKey = process.env.SKCS_REFRESH_KEY;
    const adminKey   = process.env.ADMIN_API_KEY;

    if (!key) {
        return res.status(401).json({ error: 'Missing API key' });
    }
    if ((refreshKey && key === refreshKey) || (adminKey && key === adminKey)) {
        return next();
    }
    return res.status(403).json({ error: 'Invalid API key' });
}

app.post('/api/refresh-predictions', requireRefreshKey, (req, res) => {
    const sport = req.query.sport || req.body?.sport || null;
    const label = `scheduler refresh${sport ? ` (${sport})` : ''}`;
    console.log(`[scheduler] ${label} triggered — starting in background`);

    // Respond immediately so the caller doesn't timeout
    res.status(202).json({
        ok: true,
        message: `${label} started in background`,
        note: 'Sync is running asynchronously. Check /api/predictions in a few minutes for fresh data.'
    });

    // Run the sync in the background — unhandled errors are logged but won't crash the server
    (async () => {
        try {
            const result = sport
                ? await syncSports({ sports: sport })
                : await syncAllSports();

            console.log(`[scheduler] ${label} completed:`, JSON.stringify({
                totalMatchesProcessed: result?.totalMatchesProcessed || 0,
                perSport: result?.perSport || [],
                errors: result?.errors || [],
                rebuiltFinalOutputs: result?.rebuiltFinalOutputs || false
            }));
        } catch (err) {
            console.error(`[scheduler] ${label} failed:`, err.message);
            console.error(`[scheduler] ${label} stack:`, err.stack);
        }
    })();
});

app.post('/api/grade-predictions', requireRefreshKey, async (req, res) => {
    const sport     = req.query.sport || req.body?.sport || 'football';
    const dateParam = req.query.date  || req.body?.date  || null;

    // Default to yesterday in Africa/Johannesburg
    const gradeDate = dateParam
        || moment().tz('Africa/Johannesburg').subtract(1, 'day').format('YYYY-MM-DD');

    console.log(`[scheduler] grading ${sport} for ${gradeDate}`);

    const scriptPath = path.join(__dirname, '..', 'scripts', 'track-prediction-accuracy.js');
    const args = [`--sport=${sport}`, `--date=${gradeDate}`];

    try {
        const result = await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [scriptPath, ...args], {
                env:   { ...process.env },
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 25 * 60 * 1000   // 25 minutes
            });

            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (chunk) => { stdout += chunk; });
            child.stderr.on('data', (chunk) => { stderr += chunk; });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    reject(new Error(`Grading script exited with code ${code}: ${stderr || stdout}`));
                }
            });

            child.on('error', reject);
        });

        // Try to parse the JSON summary the script prints on success
        let summary = null;
        try {
            const lines = result.stdout.trim().split('\n');
            for (let i = lines.length - 1; i >= 0; i--) {
                if (lines[i].trim().startsWith('{')) {
                    summary = JSON.parse(lines.slice(i).join('\n'));
                    break;
                }
            }
        } catch { /* ignore parse errors */ }

        res.status(200).json({
            ok: true,
            message: `Grading completed for ${sport} on ${gradeDate}`,
            gradeDate,
            sport,
            summary,
            raw: result.stdout.slice(-2000)
        });
    } catch (err) {
        console.error(`[scheduler] grading failed:`, err.message);
        res.status(500).json({ ok: false, error: err.message, gradeDate, sport });
    }
});

// --- Error handler -------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server-express] listening on ${PORT}`);
});
