'use strict';

const express = require('express');
const axios = require('axios');
const router = express.Router();

const { requireSupabaseUser, requireActiveSubscription } = require('../middleware/supabaseJwt');
const { fetchWithCache, isCacheWallReady } = require('../services/apiCacheService');
const { getDivanscoreConfig } = require('../services/divanscoreService');

function flagOn(name, def = false) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  if (!v) return !!def;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

router.get('/divanscore/teams/get-statistics', requireSupabaseUser, requireActiveSubscription, async (req, res) => {
  try {
    if (flagOn('DISABLE_DIVANSCORE', false) || !flagOn('ENABLE_DIVANSCORE', true)) {
      return res.status(503).json({ ok: false, error: 'provider_disabled', provider: 'divanscore' });
    }

    const cfg = getDivanscoreConfig();
    if (!cfg.ok) {
      return res.status(503).json({ ok: false, error: 'config_error', details: 'DIVANSCORE host/base/key missing' });
    }

    const headers = {
      'x-rapidapi-host': cfg.host,
      'x-rapidapi-key': cfg.key,
      'Content-Type': 'application/json'
    };

    const endpointUrl = `${cfg.baseUrl}/teams/get-statistics`;
    const params = { ...req.query };

    const perMinuteLimit = Number(process.env.DIVANSCORE_RPM_LIMIT || 10);
    const dailyLimit = Number(process.env.DIVANSCORE_DAILY_LIMIT || 15);
    const cacheMinutes = Number(process.env.DIVANSCORE_CACHE_MINUTES || 30);

    const debug = ['1','true','yes','on'].includes(String(params.debugHeaders || params.debug || '').toLowerCase());
    if (debug) {
      try {
        const response = await axios.get(endpointUrl, { headers, params, timeout: cfg.timeoutMs, validateStatus: () => true });
        const h = response?.headers || {};
        const pick = (name) => h[name] ?? h[String(name).toLowerCase()] ?? null;
        res.setHeader('x-skcs-rapid-region', pick('x-rapidapi-region') || 'unknown');
        res.setHeader('x-skcs-rapid-request-id', pick('x-rapidapi-request-id') || 'unknown');
        res.setHeader('x-skcs-rl-requests-limit', pick('x-ratelimit-requests-limit') || '');
        res.setHeader('x-skcs-rl-requests-remaining', pick('x-ratelimit-requests-remaining') || '');
        res.setHeader('x-skcs-rl-requests-reset', pick('x-ratelimit-requests-reset') || '');
        res.setHeader('x-skcs-rl-hard-limit', pick('x-ratelimit-rapid-free-plans-hard-limit-limit') || '');
        res.setHeader('x-skcs-rl-hard-remaining', pick('x-ratelimit-rapid-free-plans-hard-limit-remaining') || '');
        res.setHeader('x-skcs-rl-hard-reset', pick('x-ratelimit-rapid-free-plans-hard-limit-reset') || '');
        return res.status(response.status || 200).json({ ok: response.status >= 200 && response.status < 300, provider: 'divanscore', data: response.data, rateLimit: {
          region: pick('x-rapidapi-region') || null,
          requestId: pick('x-rapidapi-request-id') || null,
          requestsLimit: pick('x-ratelimit-requests-limit') || null,
          requestsRemaining: pick('x-ratelimit-requests-remaining') || null,
          requestsReset: pick('x-ratelimit-requests-reset') || null,
          hardLimit: pick('x-ratelimit-rapid-free-plans-hard-limit-limit') || null,
          hardRemaining: pick('x-ratelimit-rapid-free-plans-hard-limit-remaining') || null,
          hardReset: pick('x-ratelimit-rapid-free-plans-hard-limit-reset') || null
        }});
      } catch (err) {
        return res.status(502).json({ ok: false, error: 'upstream_error_debug', details: String(err.message || 'error') });
      }
    }

    let payload = null;
    if (isCacheWallReady()) {
      payload = await fetchWithCache('divanscore', endpointUrl, headers, params, cacheMinutes, { perMinuteLimit, dailyLimit });
    } else {
      const response = await axios.get(endpointUrl, { headers, params, timeout: cfg.timeoutMs });
      payload = response.data;
    }

    if (!payload) {
      return res.status(502).json({ ok: false, error: 'upstream_error_or_cache_blocked' });
    }

    return res.json({ ok: true, provider: 'divanscore', data: payload });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'internal_error', details: String(err.message || 'error') });
  }
});

module.exports = router;
