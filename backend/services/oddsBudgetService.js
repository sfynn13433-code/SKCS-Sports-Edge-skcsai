'use strict';

const DEFAULT_MONTHLY_LIMIT = 500;

const usageState = {
    monthKey: '',
    dayKey: '',
    usedThisMonth: 0,
    usedToday: 0,
    providerRemaining: null,
    providerUsed: null
};

function clampInt(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, Math.floor(n)));
}

function getNow() {
    return new Date();
}

function getMonthKey(date = getNow()) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function getDayKey(date = getNow()) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().slice(0, 10);
}

function daysInCurrentMonth(date = getNow()) {
    const d = date instanceof Date ? date : new Date(date);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

function getMonthlyLimit() {
    return clampInt(process.env.ODDS_API_MONTHLY_LIMIT || DEFAULT_MONTHLY_LIMIT, 1, 100000);
}

function ensurePeriodState(date = getNow()) {
    const monthKey = getMonthKey(date);
    const dayKey = getDayKey(date);

    if (usageState.monthKey !== monthKey) {
        usageState.monthKey = monthKey;
        usageState.dayKey = dayKey;
        usageState.usedThisMonth = 0;
        usageState.usedToday = 0;
        usageState.providerRemaining = null;
        usageState.providerUsed = null;
        return;
    }

    if (usageState.dayKey !== dayKey) {
        usageState.dayKey = dayKey;
        usageState.usedToday = 0;
    }
}

function computeDailyAllowance(date = getNow()) {
    ensurePeriodState(date);
    const monthlyLimit = getMonthlyLimit();
    const daysInMonth = daysInCurrentMonth(date);
    const dayOfMonth = (date instanceof Date ? date : new Date(date)).getUTCDate();
    const daysRemainingIncludingToday = Math.max(1, daysInMonth - dayOfMonth + 1);

    const baseDaily = Math.floor(monthlyLimit / daysInMonth);
    const bonusDays = monthlyLimit % daysInMonth;
    const staticDailyLimitToday = baseDaily + (dayOfMonth <= bonusDays ? 1 : 0);

    const providerSynced = Number.isFinite(usageState.providerUsed) || Number.isFinite(usageState.providerRemaining);
    const providerRemaining = Number.isFinite(usageState.providerRemaining)
        ? usageState.providerRemaining
        : Math.max(0, monthlyLimit - usageState.usedThisMonth);
    const dynamicDailyLimitToday = Math.floor(providerRemaining / daysRemainingIncludingToday);
    const dailyLimitToday = providerSynced
        ? Math.max(0, dynamicDailyLimitToday)
        : Math.max(0, staticDailyLimitToday);
    const remainingToday = Math.max(0, dailyLimitToday - usageState.usedToday);
    const remainingMonth = providerSynced
        ? providerRemaining
        : Math.max(0, monthlyLimit - usageState.usedThisMonth);

    return {
        monthlyLimit,
        daysInMonth,
        dayOfMonth,
        daysRemainingIncludingToday,
        providerSynced,
        staticDailyLimitToday,
        dynamicDailyLimitToday,
        dailyLimitToday,
        remainingToday,
        remainingMonth
    };
}

function shouldAllowOddsCall() {
    const now = getNow();
    const allowance = computeDailyAllowance(now);

    if (allowance.remainingMonth <= 0) {
        return {
            allowed: false,
            reason: 'monthly_budget_reached',
            ...allowance
        };
    }

    if (usageState.providerRemaining !== null && usageState.providerRemaining <= 0) {
        return {
            allowed: false,
            reason: 'provider_quota_reached',
            ...allowance
        };
    }

    if (allowance.remainingToday <= 0) {
        return {
            allowed: false,
            reason: 'daily_budget_reached',
            ...allowance
        };
    }

    return {
        allowed: true,
        reason: 'ok',
        ...allowance
    };
}

function consumeOddsCallSlot() {
    ensurePeriodState(getNow());
    usageState.usedThisMonth += 1;
    usageState.usedToday += 1;
}

function toNumericHeader(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function applyOddsProviderHeaders(headers = {}) {
    ensurePeriodState(getNow());
    const used = toNumericHeader(headers['x-requests-used']);
    const remaining = toNumericHeader(headers['x-requests-remaining']);

    if (used !== null) {
        usageState.providerUsed = used;
        if (used > usageState.usedThisMonth) {
            usageState.usedThisMonth = used;
        }
    }

    if (remaining !== null) {
        usageState.providerRemaining = remaining;
    }
}

function getOddsBudgetStatus() {
    const allowance = computeDailyAllowance(getNow());
    return {
        ...allowance,
        usedToday: usageState.usedToday,
        usedThisMonth: usageState.usedThisMonth,
        providerRemaining: usageState.providerRemaining,
        providerUsed: usageState.providerUsed
    };
}

module.exports = {
    shouldAllowOddsCall,
    consumeOddsCallSlot,
    applyOddsProviderHeaders,
    getOddsBudgetStatus
};
