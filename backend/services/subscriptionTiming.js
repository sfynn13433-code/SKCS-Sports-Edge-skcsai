'use strict';

const moment = require('moment-timezone');
const { getPlan } = require('../config/subscriptionPlans');

const TIMEZONE = 'Africa/Johannesburg';
const DAY_ZERO_CUTOFF_MINUTE_OF_DAY = (11 * 60) + 59; // 11:59 AM SAST
const DAY_ZERO_LITE_HOUR = 17;
const SAFE_BETTING_LEAD_MINUTES = 60;

const DAY_ZERO_STATUSES = new Set(['day_zero_bonus', 'day_zero_lite']);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'day_zero_bonus', 'day_zero_lite']);

function parseSastMoment(input) {
    if (!input) return null;
    const parsed = moment(input).tz(TIMEZONE);
    return parsed.isValid() ? parsed : null;
}

function requireSastMoment(input, label) {
    const parsed = parseSastMoment(input);
    if (!parsed) {
        throw new Error(`${label || 'date'} is invalid`);
    }
    return parsed;
}

function calculateSubscriptionStart(paymentDate, hasUsedDayZero = false) {
    const paymentMoment = requireSastMoment(paymentDate, 'paymentDate');
    const hour = paymentMoment.hour();
    const minute = paymentMoment.minute();
    const minuteOfDay = (hour * 60) + minute;
    const joinedAfterCutoff = minuteOfDay > DAY_ZERO_CUTOFF_MINUTE_OF_DAY;

    let status = 'active';
    let officialStartTime = paymentMoment.clone();

    if (!hasUsedDayZero && joinedAfterCutoff) {
        officialStartTime = paymentMoment.clone().add(1, 'day').startOf('day');
        status = hour < DAY_ZERO_LITE_HOUR ? 'day_zero_bonus' : 'day_zero_lite';
    }

    return {
        status,
        officialStartTime: officialStartTime.toDate(),
        officialStartTimeIso: officialStartTime.toISOString(),
        officialStartTimeSast: officialStartTime.format(),
        paymentTimestamp: paymentMoment.toDate(),
        paymentTimestampIso: paymentMoment.toISOString(),
        paymentTimestampSast: paymentMoment.format(),
        currentHourSast: hour,
        currentMinuteSast: minute,
        joinedAfterCutoff,
        proRataDirectFreePercent: joinedAfterCutoff ? 50 : 0,
        timezone: TIMEZONE
    };
}

function calculateExpirationTime(officialStartTime, durationDays) {
    const officialStart = requireSastMoment(officialStartTime, 'officialStartTime');
    const safeDuration = Number.isFinite(Number(durationDays)) ? Number(durationDays) : 0;
    return officialStart.clone().add(safeDuration, 'days').toDate();
}

function resolveEffectiveSubscriptionState(subscription, now = new Date()) {
    if (!subscription) return null;

    const paymentTimestamp = parseSastMoment(subscription.payment_timestamp || subscription.paymentTimestamp);
    const officialStartTime = parseSastMoment(subscription.official_start_time || subscription.officialStartTime);
    const expirationTime = parseSastMoment(subscription.expiration_time || subscription.expirationTime);
    const currentTime = requireSastMoment(now, 'now');
    const storedStatus = String(subscription.status || 'active').trim().toLowerCase();

    let effectiveStatus = storedStatus;

    if (effectiveStatus !== 'cancelled' && expirationTime && !currentTime.isBefore(expirationTime)) {
        effectiveStatus = 'expired';
    } else if (DAY_ZERO_STATUSES.has(effectiveStatus) && officialStartTime && !currentTime.isBefore(officialStartTime)) {
        effectiveStatus = 'active';
    }

    return {
        storedStatus,
        effectiveStatus,
        paymentTimestamp: paymentTimestamp ? paymentTimestamp.toDate() : null,
        paymentTimestampIso: paymentTimestamp ? paymentTimestamp.toISOString() : null,
        paymentTimestampSast: paymentTimestamp ? paymentTimestamp.format() : null,
        officialStartTime: officialStartTime ? officialStartTime.toDate() : null,
        officialStartTimeIso: officialStartTime ? officialStartTime.toISOString() : null,
        officialStartTimeSast: officialStartTime ? officialStartTime.format() : null,
        expirationTime: expirationTime ? expirationTime.toDate() : null,
        expirationTimeIso: expirationTime ? expirationTime.toISOString() : null,
        expirationTimeSast: expirationTime ? expirationTime.format() : null,
        dayZeroAccess: DAY_ZERO_STATUSES.has(storedStatus) ? storedStatus.replace('day_zero_', '') : 'none',
        timezone: TIMEZONE
    };
}

function buildSubscriptionContext({ profile = null, subscription = null, now = new Date() }) {
    const base = {
        subscription_status: profile?.subscription_status || 'inactive',
        is_test_user: profile?.is_test_user || false,
        plan_id: profile?.plan_id || null,
        plan_tier: profile?.plan_tier || null,
        plan_expires_at: profile?.plan_expires_at || null,
        payment_timestamp: null,
        official_start_time: null,
        subscription_record_status: null,
        day_zero_access: 'none',
        pro_rata_direct_free_percent: 0
    };

    if (!subscription) {
        return base;
    }

    const resolved = resolveEffectiveSubscriptionState(subscription, now);
    const planId = subscription.tier_id || profile?.plan_id || null;
    const plan = getPlan(planId);

    return {
        ...base,
        subscription_status: resolved?.effectiveStatus || base.subscription_status,
        plan_id: planId,
        plan_tier: plan?.tier || profile?.plan_tier || null,
        plan_expires_at: resolved?.expirationTimeIso || base.plan_expires_at,
        payment_timestamp: resolved?.paymentTimestampIso || null,
        official_start_time: resolved?.officialStartTimeIso || null,
        subscription_record_status: resolved?.storedStatus || null,
        day_zero_access: resolved?.dayZeroAccess || 'none',
        pro_rata_direct_free_percent: Number(subscription?.pro_rata_direct_free_percent || 0)
    };
}

function formatSastDateTime(input) {
    const parsed = parseSastMoment(input);
    return parsed ? parsed.format('YYYY-MM-DD HH:mm:ss [SAST]') : null;
}

function getFixtureKickoff(fixture) {
    const value =
        fixture?.kickoff ||
        fixture?.commence_time ||
        fixture?.match_date ||
        fixture?.metadata?.kickoff ||
        fixture?.metadata?.kickoff_time ||
        fixture?.metadata?.match_time ||
        null;

    return parseSastMoment(value);
}

function getAvailableFixturesForUser(userPaymentTimestamp, fixtures) {
    const paymentMoment = parseSastMoment(userPaymentTimestamp);
    if (!paymentMoment) return [];

    const safeBettingTime = paymentMoment.clone().add(SAFE_BETTING_LEAD_MINUTES, 'minutes');
    const rows = Array.isArray(fixtures) ? fixtures : [];

    return rows.filter((fixture) => {
        const kickoff = getFixtureKickoff(fixture);
        return kickoff ? kickoff.isAfter(safeBettingTime) : false;
    });
}

function getPredictionSectionType(prediction) {
    const rawType = String(prediction?.section_type || prediction?.type || '').trim().toLowerCase();
    if (!rawType || rawType === 'single') {
        const firstMatch = Array.isArray(prediction?.matches) ? prediction.matches[0] : null;
        const market = String(firstMatch?.market || '').trim().toLowerCase();
        if (market === '1x2' || market === 'match_result' || market === 'double_chance') {
            return 'direct';
        }
        return 'secondary';
    }
    if (rawType === 'acca') return 'acca_6match';
    return rawType;
}

function isDirect1x2Prediction(prediction) {
    if (getPredictionSectionType(prediction) !== 'direct') return false;
    const firstMatch = Array.isArray(prediction?.matches) ? prediction.matches[0] : null;
    const market = String(firstMatch?.market || '').trim().toLowerCase();
    return market === '1x2' || market === 'match_result';
}

function filterPredictionsForSubscriptionAccess(predictions, subscriptionContext) {
    const rows = Array.isArray(predictions) ? predictions : [];
    const status = String(subscriptionContext?.subscription_status || '').trim().toLowerCase();

    if (!DAY_ZERO_STATUSES.has(status)) {
        return rows;
    }

    const paymentTimestamp = subscriptionContext?.payment_timestamp;
    const freeDirectPercent = Number(subscriptionContext?.pro_rata_direct_free_percent || 50);

    const eligibleDirect = rows.filter((prediction) => {
        if (!isDirect1x2Prediction(prediction)) {
            return false;
        }

        const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
        if (matches.length === 0) return false;

        const availableMatches = getAvailableFixturesForUser(paymentTimestamp, matches);
        return availableMatches.length === matches.length;
    });

    const ratio = Math.max(0, Math.min(100, freeDirectPercent));
    const freeCount = eligibleDirect.length > 0
        ? Math.max(1, Math.floor((eligibleDirect.length * ratio) / 100))
        : 0;
    return eligibleDirect.slice(0, freeCount);
}

module.exports = {
    ACTIVE_SUBSCRIPTION_STATUSES,
    DAY_ZERO_STATUSES,
    DAY_ZERO_CUTOFF_MINUTE_OF_DAY,
    SAFE_BETTING_LEAD_MINUTES,
    TIMEZONE,
    buildSubscriptionContext,
    calculateExpirationTime,
    calculateSubscriptionStart,
    filterPredictionsForSubscriptionAccess,
    formatSastDateTime,
    getAvailableFixturesForUser,
    resolveEffectiveSubscriptionState
};
