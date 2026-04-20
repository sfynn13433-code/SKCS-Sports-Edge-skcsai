'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const express      = require('express');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const cors         = require('cors');
const morgan       = require('morgan');
const { spawn }    = require('child_process');
const moment       = require('moment-timezone');
const path         = require('path');
const config       = require('./config');
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
const { runLiveSync }       = require('../scripts/fetch-live-fixtures');
const {
    calculateExpirationTime,
    calculateSubscriptionStart,
    formatSastDateTime
} = require('./services/subscriptionTiming');

const { getPlanCapabilities, filterPredictionsForPlan } = require('./config/subscriptionMatrix');
const { normalizeFixtureDate, getPredictionWindow, isFixtureEligibleForPrediction } = require('./utils/dateNormalization');

void bootstrap().catch(err => console.error('[startup] bootstrap failed:', err.message));

const WEEKLY_ROLLING_SCRAPE_CRON = '0 2 * * 1'; // Monday 02:00 UTC = 04:00 SAST
const ACCA_ROLLING_SYNC_CRON = '0 */4 * * *';
const CORE_MARKET_ROLLING_SYNC_CRON = '0 */2 * * *';
const ROLLING_SYNC_TIMEZONE = 'Africa/Johannesburg';
const ROLLING_CUTOFF_HOUR = 11;
const ROLLING_CUTOFF_MINUTE = 59;

let rollingSyncInProgress = false;

cron.schedule(WEEKLY_ROLLING_SCRAPE_CRON, () => {
    console.log('[cron] Triggering weekly global 7-day rolling scrape (04:00 SAST / 02:00 UTC)');
    void syncAllSports().catch(err => console.error('[cron] Weekly rolling scrape failed:', err));
}, { timezone: 'UTC' });

function isWithinRollingWindow(nowMoment = moment.tz(ROLLING_SYNC_TIMEZONE)) {
    const hour = nowMoment.hour();
    const minute = nowMoment.minute();
    return hour < ROLLING_CUTOFF_HOUR || (hour === ROLLING_CUTOFF_HOUR && minute <= ROLLING_CUTOFF_MINUTE);
}

async function runRollingSync(label) {
    const now = moment.tz(ROLLING_SYNC_TIMEZONE);
    if (!isWithinRollingWindow(now)) {
        console.log(`[cron] ${label}: skipped (${now.format()} outside 00:00-11:59 SAST rolling window)`);
        return;
    }
    if (rollingSyncInProgress) {
        console.log(`[cron] ${label}: skipped (another rolling sync is in progress)`);
        return;
    }

    rollingSyncInProgress = true;
    try {
        console.log(`[cron] ${label}: starting rolling sync at ${now.format()} SAST`);
        await syncAllSports();
        console.log(`[cron] ${label}: rolling sync completed`);
    } catch (err) {
        console.error(`[cron] ${label}: rolling sync failed`, err.message);
    } finally {
        rollingSyncInProgress = false;
    }
}

cron.schedule(ACCA_ROLLING_SYNC_CRON, () => {
    void runRollingSync('ACCA-4h');
}, { timezone: ROLLING_SYNC_TIMEZONE });

cron.schedule(CORE_MARKET_ROLLING_SYNC_CRON, () => {
    void runRollingSync('DIRECT-SAME-DOUBLECHANCE-2h');
}, { timezone: ROLLING_SYNC_TIMEZONE });

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
const vipRouter         = require('./routes/vip');
const direct1x2Router   = require('./routes/direct1x2');
const refreshAIRouter   = require('./routes/refresh-ai');

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
    env: process.env.NODE_ENV || 'development',
    marker_deploy: 'test-' + Date.now()
  });
});

app.get('/api/billing-status', (_req, res) => {
    const billing_enabled = String(process.env.BILLING_ENABLED || 'false').toLowerCase() === 'true';
    const subscription_open = String(process.env.SUBSCRIPTION_OPEN || 'true').toLowerCase() !== 'false';

    res.status(200).json({
        billing_enabled,
        subscription_open,
        currency: 'GBP',
        policy: {
            pro_rata: 'Join after 11:59 AM SAST and receive 50% of today\'s Direct 1x2 matches free. Full paid cycle starts at 00:00 midnight.',
            refunds: 'All sales are final. No refunds are processed after activation.'
        }
    });
});

app.post('/api/select-plan', requireSupabaseUser, async (req, res) => {
    try {
        const tierId = String(req.body?.tier_id || '').trim();
        if (!tierId) {
            return res.status(400).json({ error: 'tier_id is required' });
        }

        const plan = getPlan(tierId);
        if (!plan) {
            return res.status(400).json({ error: 'Invalid plan selected' });
        }

        const billingEnabled = String(process.env.BILLING_ENABLED || 'false').toLowerCase() === 'true';
        const subscriptionOpen = String(process.env.SUBSCRIPTION_OPEN || 'true').toLowerCase() !== 'false';
        if (!billingEnabled && !subscriptionOpen) {
            return res.status(403).json({
                requires_payment: true,
                message: 'Billing is not live yet. Access is currently limited to approved accounts or staging mode.'
            });
        }

        const userId = req.user?.id;
        const email = req.user?.email || null;
        if (!userId) {
            return res.status(401).json({ error: 'User session is invalid' });
        }

        const hasUsedDayZero = await hasUsedDayZeroForUser(userId);
        const start = calculateSubscriptionStart(new Date(), hasUsedDayZero);
        const expirationTime = calculateExpirationTime(start.officialStartTime, plan.days);

        const subscription = await createSubscriptionRecord({
            user_id: userId,
            tier_id: tierId,
            status: start.status,
            payment_timestamp: start.paymentTimestamp,
            official_start_time: start.officialStartTime,
            expiration_time: expirationTime,
            join_after_cutoff: start.joinedAfterCutoff,
            pro_rata_direct_free_percent: start.proRataDirectFreePercent
        });

        await upsertProfile({
            id: userId,
            email,
            subscription_status: start.status,
            is_test_user: false,
            plan_id: tierId,
            plan_tier: plan.tier,
            plan_expires_at: expirationTime.toISOString()
        });

        return res.status(200).json({
            success: true,
            tier_id: tierId,
            tier_name: tierId,
            status: start.status,
            official_start_time: start.officialStartTimeIso,
            payment_timestamp: start.paymentTimestampIso,
            expires_at: expirationTime.toISOString(),
            join_after_cutoff: start.joinedAfterCutoff,
            pro_rata_direct_free_percent: start.proRataDirectFreePercent,
            policy: {
                pro_rata: 'Join after 11:59 AM SAST and receive 50% of today\'s Direct 1x2 matches free. Full paid cycle starts at 00:00 midnight.',
                refunds: 'All sales are final. Once paid and activated, no refund requests are processed.'
            },
            subscription
        });
    } catch (err) {
        console.error('[select-plan] error:', err);
        return res.status(500).json({ error: 'Failed to activate plan', details: err.message });
    }
});

app.get('/', (_req, res) => {
  res.redirect('/index.html');
});

app.get('/subscribe', (req, res) => {
  const params = new URLSearchParams();
  if (req.query?.locked !== undefined) {
    params.set('locked', String(req.query.locked));
  }
  if (req.query?.message !== undefined) {
    params.set('message', String(req.query.message));
  }
  const query = params.toString();
  res.redirect(`/subscribe/index.html${query ? `?${query}` : ''}`);
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
app.use('/api/admin', refreshAIRouter);
app.use('/api/chat', chatRouter);
app.use('/api/edgemind', chatRouter);
app.use('/api/accuracy', accuracyRouter);
app.use('/api/vip', vipRouter);
app.use('/api/direct-1x2', direct1x2Router);

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

// Debug endpoint to check API-Sports connectivity and trigger sync with detailed output
app.get('/api/debug/sync-test', requireRefreshKey, async (req, res) => {
    try {
        const { APISportsClient } = require('./apiClients');
        const client = new APISportsClient();
        const today = new Date().toISOString().slice(0, 10);
        const windowEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        // Compute season year inline (same logic as syncService)
        const now = new Date();
        const month = now.getUTCMonth() + 1;
        const year = now.getUTCFullYear();
        const seasonYear = month >= 8 ? year : year - 1;

        const debug = {
            timestamp: new Date().toISOString(),
            config: {
                hasApiSportsKey: !!process.env.X_APISPORTS_KEY,
                hasOddsApiKey: !!process.env.ODDS_API_KEY,
                dataMode: config.DATA_MODE || 'test (default)',
                seasonYear: String(seasonYear),
                dateRange: `${today} to ${windowEnd}`,
            },
            apiTest: {}
        };

        // Test football API
        try {
            const footballKeys = client.getKeysForSport('football');
            debug.apiTest.football = {
                keysFound: footballKeys.length,
                test: `EPL league 39, season ${seasonYear}`,
            };

            if (footballKeys.length > 0) {
                const data = await client.getFixtures('39', String(seasonYear), { from: today, to: windowEnd }, 'football');
                debug.apiTest.football.result = data ? {
                    results: data.results || 0,
                    errors: data.errors || null,
                    fixtureCount: data.response ? data.response.length : 0,
                } : 'request_failed';
            } else {
                debug.apiTest.football.result = 'no_keys_configured';
            }
        } catch (err) {
            debug.apiTest.football = { error: err.message };
        }

        res.json({ ok: true, debug });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
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

// ============================================================
// TIERED CRON SYNC ENDPOINTS
// External cron jobs should hit these at different intervals
// ============================================================

const { fetchWithWaterfall } = require('./utils/rapidApiWaterfall');
const { pool } = require('./database');

const CRON_SECRET = process.env.CRON_SECRET || 'skcs_super_secret_cron_key_2026';

// Allow secret via header OR query parameter for easier cron-job.org configuration
function verifyCronSecret(req, res, next) {
    const headerSecret = req.headers['x-cron-secret'];
    const querySecret = req.query.secret;
    
    const validSecret = headerSecret || querySecret;
    
    if (!validSecret || validSecret !== CRON_SECRET) {
        console.warn(`[cron-auth] Rejected: missing or invalid secret from ${req.ip}`);
        console.warn(`[cron-auth] Header: '${headerSecret}', Query: '${querySecret}', Expected: '${CRON_SECRET}'`);
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    next();
}

// ADMIN: Force reset tier rules to minimal (accept ALL)
app.get('/api/admin/reset-tier-rules', async (_req, res) => {
    try {
        await query(`
            INSERT INTO tier_rules (tier, min_confidence, allowed_markets, max_acca_size, allowed_volatility)
            VALUES
                ('normal', 1, '["ALL"]'::jsonb, 100, '["low","medium","high"]'::jsonb),
                ('deep', 1, '["ALL"]'::jsonb, 100, '["low","medium","high"]'::jsonb)
            ON CONFLICT (tier) DO UPDATE SET
                min_confidence = 1,
                allowed_markets = '["ALL"]'::jsonb,
                max_acca_size = 100,
                allowed_volatility = '["low","medium","high"]'::jsonb;
        `);
        res.json({ ok: true, message: 'Tier rules reset to minimal' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// TIER 1: LIVE SYNC -> Run every 5 minutes
// Uses the main pipeline from fetch-live-fixtures.js with Master League filtering
app.get('/api/cron/sync-live', verifyCronSecret, async (req, res) => {
    console.log('[cron/sync-live] Starting tier-1 live sync...');
    
    const debugInfo = {
        hasApiKey: !!process.env.X_APISPORTS_KEY,
        hasDbUrl: !!process.env.DATABASE_URL
    };
    console.log('[cron/sync-live] Config check:', debugInfo);
    
    try {
        const result = await runLiveSync();
        
        // Return simple summary instead of full data dump (fixes Cron-job.org 64KB limit)
        const summary = {
            status: 'ok',
            success: result.success,
            fixtures: result.fixtures || 0,
            upserted: result.upserted || 0,
            eventsUpserted: result.eventsUpserted || 0,
            aiTokensSaved: result.aiTokensSaved || 0
        };
        
        console.log('[cron/sync-live] Result:', JSON.stringify(summary));
        res.json(summary);
        
    } catch (err) {
        console.error('[cron/sync-live] Failed:', err.message, err.stack);
        res.json({ status: 'error', message: err.message });
    }
});

// TIER 2: STANDARD SYNC (Hits Tier 2 APIs) -> Run every 60 minutes
// Hits AllSportsApi, Cricbuzz, Sofascore for general fixture generation
// and injury updates for the upcoming week.
app.get('/api/cron/sync-standard', verifyCronSecret, async (req, res) => {
    console.log('[cron/sync-standard] Starting tier-2 standard sync...');
    
    try {
        const fixtures = await fetchWithWaterfall('/v1/fixtures', { sport: 'soccer' }, 'TIER_2', 10000);
        
        if (fixtures && fixtures.data) {
            const data = Array.isArray(fixtures.data) ? fixtures.data : fixtures.data.response || [];
            console.log(`[cron/sync-standard] Fetched ${data.length} fixtures via ${fixtures.host}`);
            
            const client = await pool.connect();
            let upserted = 0;
            
            try {
                for (const f of data.slice(0, 100)) {
                    const matchId = String(f.id || f.fixture?.id || '');
                    if (matchId) {
                        await client.query(`
                            INSERT INTO direct1x2_prediction_final (tier, type, matches, sport, market_type, recommendation, created_at)
                            VALUES ('standard', 'direct', $1::jsonb, 'football', '1X2', $2, NOW())
                            ON CONFLICT DO UPDATE SET
                                matches = EXCLUDED.matches
                        `, [{
                            fixture_id: matchId,
                            home_team: f.home_team || f.teams?.home?.name,
                            away_team: f.away_team || f.teams?.away?.name,
                            date: f.date || f.fixture?.date,
                            metadata: { source: fixtures.host }
                        }, `vs`]);
                        
                        upserted++;
                    }
                }
            } finally {
                client.release();
            }
            
            console.log(`[cron/sync-standard] Completed: ${upserted} fixtures upserted`);
        }
        
        res.json({ message: 'Standard sync complete', status: 'ok' });
        
    } catch (err) {
        console.error('[cron/sync-standard] Failed:', err.message);
        res.status(500).json({ error: 'Standard sync failed' });
    }
});

// TIER 3: DEEP SYNC (Hits Tier 3 APIs) -> Run every 24 hours (Midnight)
// Hits Football News API, MMA, F1 for deep EdgeMind context.
// Saves summaries to Supabase so the AI has context for the day.
app.get('/api/cron/sync-deep', verifyCronSecret, async (req, res) => {
    console.log('[cron/sync-deep] Starting tier-3 deep sync...');
    
    try {
        const newsData = await fetchWithWaterfall('/v1/news', { query: 'football match analysis' }, 'TIER_3', 15000);
        
        if (newsData && newsData.data) {
            const articles = Array.isArray(newsData.data) ? newsData.data : newsData.data.results || [];
            console.log(`[cron/sync-deep] Fetched ${articles.length} news articles via ${newsData.host}`);
            
            const client = await pool.connect();
            let saved = 0;
            
            try {
                for (const article of articles.slice(0, 20)) {
                    const title = article.title || article.headline || '';
                    const summary = article.description || article.summary || '';
                    
                    if (title) {
                        await client.query(`
                            INSERT INTO direct1x2_prediction_final (tier, type, matches, sport, market_type, recommendation, edgemind_report, created_at)
                            VALUES ('deep', 'context', '[]'::jsonb, 'football', 'news', $1, $2, NOW())
                            ON CONFLICT DO NOTHING
                        `, [title, summary.substring(0, 500)]);
                        
                        saved++;
                    }
                }
            } finally {
                client.release();
            }
            
            console.log(`[cron/sync-deep] Completed: ${saved} articles saved`);
        }
        
        // Return simple summary (fixes Cron-job.org 64KB limit)
        res.json({ status: 'ok', articlesSaved: saved });
        
    } catch (err) {
        console.error('[cron/sync-deep] Failed:', err.message);
        res.json({ status: 'error', message: err.message });
    }
});

// SIMPLE SYNC - No validation, direct insert
app.get('/api/cron/sync-simple', verifyCronSecret, async (req, res) => {
    console.log('[cron/sync-simple] Starting simple sync (no validation)...');
    
    const scriptPath = path.join(__dirname, '..', 'scripts', 'simple-sync.js');
    
    try {
        await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [scriptPath], {
                env: { ...process.env },
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 10 * 60 * 1000
            });
            
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (chunk) => { stdout += chunk; });
            child.stderr.on('data', (chunk) => { stderr += chunk; });
            
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Script exited with code ${code}: ${stderr || stdout}`));
            });
            
            child.on('error', reject);
        });
        
        console.log('[cron/sync-simple] Completed');
        res.json({ message: 'Simple sync complete', status: 'ok' });
        
    } catch (err) {
        console.error('[cron/sync-simple] Failed:', err.message);
        res.status(500).json({ error: 'Simple sync failed' });
    }
});

// FULL PIPELINE SYNC (Uses the main fetch-live-fixtures.js script)
app.get('/api/cron/sync-full', verifyCronSecret, async (req, res) => {
    console.log('[cron/sync-full] Starting full pipeline sync...');
    
    try {
        const scriptPath = path.join(__dirname, '..', 'scripts', 'fetch-live-fixtures.js');
        
        await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [scriptPath], {
                env: { ...process.env },
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 15 * 60 * 1000
            });
            
            child.stdout.on('data', (chunk) => { process.stdout.write(chunk); });
            child.stderr.on('data', (chunk) => { process.stderr.write(chunk); });
            
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Script exited with code ${code}`));
            });
            
            child.on('error', reject);
        });
        
        console.log('[cron/sync-full] Completed');
        res.json({ message: 'Full sync complete', status: 'ok' });
        
    } catch (err) {
        console.error('[cron/sync-full] Failed:', err.message);
        res.status(500).json({ error: 'Full sync failed' });
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
