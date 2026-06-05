'use strict';

const express = require('express');
const axios = require('axios');
const router = express.Router();

const { requireSupabaseUser, requireActiveSubscription } = require('../middleware/supabaseJwt');
const { requireRole } = require('../utils/auth');
const { fetchWithCache, isCacheWallReady } = require('../services/apiCacheService');
const { getMetrxConfig } = require('../services/metrxFactoryService');
const { consumeQuota } = require('../services/providerQuotaService');
const { refreshPipelineHealthState } = require('../services/pipelineMetricsService');
const { executeOperation } = require('../core/executionPipeline');

function flagOn(name, defaultVal = false) {
    const v = String(process.env[name] || '').trim().toLowerCase();
    if (!v) return !!defaultVal;
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function hasEliteAccess(user) {
    if (!user) return false;
    if (user.is_admin === true || user.isAdmin === true || user.is_test_user === true) return true;
    const tiers = Array.isArray(user.access_tiers) ? user.access_tiers.map(String) : [];
    return tiers.includes('vip') || tiers.includes('elite');
}

router.get('/metrx', requireSupabaseUser, requireActiveSubscription, async (req, res) => {
    try {
        const disabled = flagOn('DISABLE_METRX_FACTORY', false);
        const enabled = flagOn('ENABLE_METRX_FACTORY', true);
        if (disabled || !enabled) {
            return res.status(503).json({ ok: false, error: 'provider_disabled', provider: 'metrx_factory' });
        }

        if (!hasEliteAccess(req.user)) {
            return res.status(403).json({ ok: false, error: 'elite_or_vip_required' });
        }

        const cfg = getMetrxConfig();
        if (!cfg.ok) {
            return res.status(503).json({ ok: false, error: cfg.error || 'config_error', details: cfg.message || null });
        }

        const endpointUrl = `${cfg.baseURL}/v1/match-metrics`;
        const headers = {
            'x-rapidapi-host': cfg.host,
            'x-rapidapi-key': cfg.key,
            'Content-Type': 'application/json'
        };

        const params = { ...req.query };
        const cacheMinutes = 3;
        const dailyLimit = Number(process.env.METRX_FACTORY_DAILY_LIMIT || 100);

        const debug = ['1', 'true', 'yes', 'on'].includes(String(params.debugHeaders || params.forwardHeaders || params.debug || '').toLowerCase());
        if (debug) {
            try {
                const q = await consumeQuota('metrx_factory', { dailyLimit });
                if (!q.allowed) {
                    return res.status(429).json({ ok: false, error: 'quota_exceeded', scope: q.scope, limit: q.limit, used: q.used });
                }
                const response = await axios.get(endpointUrl, { headers, params, timeout: 15000, validateStatus: () => true });
                const h = response?.headers || {};
                // Forward selected provider headers with skcs prefix
                const pick = (name) => h[name] ?? h[String(name).toLowerCase()] ?? null;
                res.setHeader('x-skcs-rapid-region', pick('x-rapidapi-region') || 'unknown');
                res.setHeader('x-skcs-rapid-request-id', pick('x-rapidapi-request-id') || 'unknown');
                res.setHeader('x-skcs-rl-requests-limit', pick('x-ratelimit-requests-limit') || '');
                res.setHeader('x-skcs-rl-requests-remaining', pick('x-ratelimit-requests-remaining') || '');
                res.setHeader('x-skcs-rl-requests-reset', pick('x-ratelimit-requests-reset') || '');
                res.setHeader('x-skcs-rl-hard-limit', pick('x-ratelimit-rapid-free-plans-hard-limit-limit') || '');
                res.setHeader('x-skcs-rl-hard-remaining', pick('x-ratelimit-rapid-free-plans-hard-limit-remaining') || '');
                res.setHeader('x-skcs-rl-hard-reset', pick('x-ratelimit-rapid-free-plans-hard-limit-reset') || '');
                return res.status(response.status || 200).json({
                    ok: response.status >= 200 && response.status < 300,
                    provider: 'metrx_factory',
                    data: response.data,
                    rateLimit: {
                        region: pick('x-rapidapi-region') || null,
                        requestId: pick('x-rapidapi-request-id') || null,
                        requestsLimit: pick('x-ratelimit-requests-limit') || null,
                        requestsRemaining: pick('x-ratelimit-requests-remaining') || null,
                        requestsReset: pick('x-ratelimit-requests-reset') || null,
                        hardLimit: pick('x-ratelimit-rapid-free-plans-hard-limit-limit') || null,
                        hardRemaining: pick('x-ratelimit-rapid-free-plans-hard-limit-remaining') || null,
                        hardReset: pick('x-ratelimit-rapid-free-plans-hard-limit-reset') || null
                    }
                });
            } catch (err) {
                return res.status(502).json({ ok: false, error: 'upstream_error_debug', details: String(err.message || 'error') });
            }
        }

        let payload = null;
        if (isCacheWallReady()) {
            payload = await fetchWithCache('metrx_factory', endpointUrl, headers, params, cacheMinutes, { dailyLimit });
        } else {
            const q = await consumeQuota('metrx_factory', { dailyLimit });
            if (!q.allowed) {
                return res.status(429).json({ ok: false, error: 'quota_exceeded', scope: q.scope, limit: q.limit, used: q.used });
            }
            const response = await axios.get(endpointUrl, { headers, params, timeout: 15000 });
            payload = response.data;
        }

        if (!payload) {
            return res.status(502).json({ ok: false, error: 'upstream_error_or_cache_blocked' });
        }

        return res.json({ ok: true, provider: 'metrx_factory', data: payload });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'internal_error', details: String(err.message || 'error') });
    }
});

router.get('/pipeline-health', requireRole('admin'), async (_req, res) => {
    try {
        const report = await executeOperation({
            operation: 'metrics.pipeline-health',
            caller: 'backend/routes/metrics.js',
            payload: { source: 'api' },
            execute: async () => refreshPipelineHealthState({ source: 'api' })
        });
        if (report?.success === false) {
            return res.status(503).json({
                ok: false,
                error: report.reason || report.error || 'pipeline_health_blocked',
                traceId: report.traceId || report.trace_id || null
            });
        }
        return res.json({
            ok: true,
            feed: report.result?.feed,
            summary: report.result?.summary,
            snapshot: report.result?.snapshot
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'internal_error', details: String(err.message || 'error') });
    }
});

module.exports = router;
