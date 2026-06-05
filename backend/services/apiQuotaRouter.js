'use strict';

/**
 * Central API governance: sport enablement, provider budgets, blocked-call observability.
 * All external HTTP calls should pass through reserveApiCall().
 */

const { consumeQuota } = require('./providerQuotaService');
const { shouldAllowOddsCall } = require('./oddsBudgetService');
const { recordBlockedCall, getBlockedCallsSummary } = require('./blockedApiCallsLog');
const {
    SPORT_FAMILIES,
    PROVIDER_REGISTRY_BASE,
    apiSportsProviderKey,
    normalizeProviderKey,
    getProviderConfig,
    getFamilyForProvider
} = require('./apiQuotaRouterProviders');

function normalizeSportKey(sport) {
    const key = String(sport || '').trim().toLowerCase();
    if (!key) return 'unknown';
    if (key === 'soccer' || key.startsWith('soccer_')) return 'football';
    if (key === 'american_football' || key === 'american football' || key.startsWith('americanfootball_')) return 'nfl';
    if (key === 'icehockey' || key === 'ice hockey' || key.startsWith('icehockey_')) return 'hockey';
    if (key.startsWith('basketball_')) return 'basketball';
    if (key.startsWith('baseball_')) return 'baseball';
    if (key.startsWith('rugbyunion_')) return 'rugby';
    if (key.startsWith('aussierules_')) return 'afl';
    if (key.startsWith('mma_')) return 'mma';
    return key;
}

function parseEnabledSports() {
    const raw = String(
        process.env.SKCS_ENABLED_SPORTS ||
        process.env.ENABLED_SPORTS ||
        'football'
    ).trim();
    return raw
        .split(',')
        .map((s) => normalizeSportKey(s))
        .filter(Boolean);
}

function isProductionRuntime() {
    return (
        String(process.env.NODE_ENV || '').toLowerCase() === 'production' ||
        String(process.env.DATA_MODE || '').toLowerCase() === 'live'
    );
}

function isSportIngestionEnabled(sport) {
    const key = normalizeSportKey(sport);
    const enabledSports = parseEnabledSports();

    if (key === 'cricket') {
        const flag = String(process.env.CRICKET_INGESTION_ENABLED || '').trim().toLowerCase();
        if (flag === '1' || flag === 'true' || flag === 'yes') return true;
        if (flag === '0' || flag === 'false' || flag === 'no') return false;
        if (isProductionRuntime()) return false;
        return enabledSports.includes('cricket');
    }

    if (enabledSports.length === 0) return key === 'football';
    return enabledSports.includes(key);
}

function resolveProviderKey(provider, sport) {
    if (provider) return normalizeProviderKey(provider);
    return apiSportsProviderKey(normalizeSportKey(sport));
}

async function emitBlocked(blocked) {
    console.warn('[apiQuotaRouter] blocked', JSON.stringify(blocked));
    await recordBlockedCall({
        sport: blocked.sport,
        provider: blocked.provider,
        reason: blocked.reason,
        source: blocked.source,
        units: blocked.units || 1,
        metadata: {
            scope: blocked.scope,
            limit: blocked.limit,
            used: blocked.used,
            expectedSport: blocked.expectedSport,
            error: blocked.error
        }
    });
    return blocked;
}

function logAllowed(meta) {
    if (String(process.env.API_QUOTA_ROUTER_VERBOSE || '').trim() === '1') {
        console.log('[apiQuotaRouter] allowed', JSON.stringify(meta));
    }
}

async function reserveApiCall({ sport, provider, units = 1, source = null } = {}) {
    const sportKey = normalizeSportKey(sport);
    const providerKey = resolveProviderKey(provider, sportKey);
    const callUnits = Math.max(1, Number(units) || 1);

    if (!isSportIngestionEnabled(sportKey)) {
        return emitBlocked({
            allowed: false,
            reason: 'sport_ingestion_disabled',
            sport: sportKey,
            provider: providerKey,
            source,
            units: callUnits
        });
    }

    const config = getProviderConfig(providerKey);
    if (!config) {
        logAllowed({ allowed: true, reason: 'untracked_provider', sport: sportKey, provider: providerKey, source });
        return { allowed: true, reason: 'untracked_provider', sport: sportKey, provider: providerKey, source };
    }

    const configFamily = getFamilyForProvider(providerKey);
    if (configFamily && configFamily !== sportKey && sportKey !== 'unknown') {
        const familyAllowed = isSportIngestionEnabled(configFamily);
        if (!familyAllowed) {
            return emitBlocked({
                allowed: false,
                reason: 'provider_family_disabled',
                sport: sportKey,
                provider: providerKey,
                expectedSport: configFamily,
                source,
                units: callUnits
            });
        }
    }

    if (config.usesOddsBudget) {
        const budget = shouldAllowOddsCall();
        if (!budget.allowed) {
            return emitBlocked({
                allowed: false,
                reason: budget.reason || 'odds_budget_blocked',
                sport: sportKey,
                provider: providerKey,
                source,
                units: callUnits,
                metadata: budget
            });
        }
        logAllowed({ allowed: true, reason: 'odds_budget_ok', sport: sportKey, provider: providerKey, source });
        return {
            allowed: true,
            reason: 'ok',
            sport: sportKey,
            provider: providerKey,
            source,
            units: callUnits,
            usesOddsBudget: true
        };
    }

    if (!config.dailyLimit && !config.perMinuteLimit) {
        logAllowed({ allowed: true, reason: 'unlimited_provider', sport: sportKey, provider: providerKey, source });
        return { allowed: true, reason: 'ok', sport: sportKey, provider: providerKey, source, units: callUnits };
    }

    try {
        for (let i = 0; i < callUnits; i += 1) {
            const quota = await consumeQuota(config.providerName, {
                dailyLimit: config.dailyLimit,
                perMinuteLimit: config.perMinuteLimit
            });
            if (!quota.allowed) {
                return emitBlocked({
                    allowed: false,
                    reason: 'provider_quota_exceeded',
                    sport: sportKey,
                    provider: providerKey,
                    source,
                    units: callUnits,
                    scope: quota.scope,
                    limit: quota.limit,
                    used: quota.used
                });
            }
        }

        const allowed = {
            allowed: true,
            reason: 'ok',
            sport: sportKey,
            provider: providerKey,
            source,
            units: callUnits
        };
        logAllowed(allowed);
        return allowed;
    } catch (err) {
        const failClosed = config.failClosed !== false;
        if (failClosed) {
            return emitBlocked({
                allowed: false,
                reason: 'quota_ledger_unavailable',
                sport: sportKey,
                provider: providerKey,
                source,
                units: callUnits,
                error: err.message
            });
        }
        return {
            allowed: true,
            reason: 'quota_ledger_bypass',
            sport: sportKey,
            provider: providerKey,
            source,
            warning: err.message
        };
    }
}

function assertSportPipelineAllowed(sport, meta = {}) {
    if (isSportIngestionEnabled(sport)) {
        return { allowed: true, sport: normalizeSportKey(sport), ...meta };
    }
    const blocked = {
        allowed: false,
        reason: 'sport_ingestion_disabled',
        sport: normalizeSportKey(sport),
        ...meta
    };
    void emitBlocked({
        ...blocked,
        provider: meta.provider || 'pipeline',
        source: meta.pipeline || meta.source || 'assertSportPipelineAllowed'
    });
    return blocked;
}

function getGovernanceSnapshot() {
    return {
        production: isProductionRuntime(),
        enabledSports: parseEnabledSports(),
        cricketIngestionEnabled: isSportIngestionEnabled('cricket'),
        sportFamilies: SPORT_FAMILIES,
        registeredProviders: Object.keys(PROVIDER_REGISTRY_BASE)
    };
}

module.exports = {
    SPORT_FAMILIES,
    PROVIDER_REGISTRY: PROVIDER_REGISTRY_BASE,
    normalizeSportKey,
    parseEnabledSports,
    isProductionRuntime,
    isSportIngestionEnabled,
    resolveProviderKey,
    apiSportsProviderKey,
    reserveApiCall,
    assertSportPipelineAllowed,
    getProviderConfig,
    getBlockedCallsSummary,
    getGovernanceSnapshot
};
