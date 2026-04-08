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

const CRON_SLOTS_UTC = [
    { label: 'morning_cleanup', expr: '0 6 * * *' },
    { label: 'midday_setup', expr: '0 14 * * *' },
    { label: 'pregame_finalization', expr: '0 18 * * *' }
];

for (const slot of CRON_SLOTS_UTC) {
    cron.schedule(slot.expr, () => {
        console.log(`[cron] Triggering master sports sync: ${slot.label}`);
        void syncAllSports().catch(err => console.error(`[cron] Sync failed (${slot.label}):`, err));
    }, { timezone: 'UTC' });
}

function warnEnv(name) {
    if (!process.env[name] || String(process.env[name]).trim().length === 0) {
        console.warn(`[env] warning: ${name} is not set`);
    }
}
warnEnv('DATABASE_URL');
warnEnv('ADMIN_API_KEY');
warnEnv('USER_API_KEY');
warnEnv('OPENAI_KEY');

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
app.use('/api/accuracy', accuracyRouter);

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
