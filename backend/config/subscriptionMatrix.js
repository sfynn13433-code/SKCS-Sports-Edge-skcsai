'use strict';

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const PLAN_CATEGORIES = ['direct', 'secondary', 'multi', 'same_match', 'acca_6match'];
const EXTRA_PLAN_CATEGORIES = ['mega_acca_12'];

const FAMILY_BASELINES = {
    core: 'core_30day_limitless',
    elite: 'elite_30day_deep_vip'
};

const MEGA_ACCA_SIZE = 12;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DEFAULT_MEGA_ACCA_CONSTRAINTS = {
    min_leg_confidence: 80,
    sports_coverage: 'all',
    cricket_must_finish_before_expiry: true
};

const MEGA_ACCA_POLICY_BY_DURATION = {
    4: {
        cycle_days: 4,
        cycle_total_accas: 1,
        weekly_target_accas: 0,
        distribution_mode: 'fixed_three_legs_per_day',
        fixed_legs_per_day: 3
    },
    9: {
        cycle_days: 9,
        cycle_total_accas: 3,
        weekly_target_accas: 0,
        distribution_mode: 'fixture_volume_weighted'
    },
    14: {
        cycle_days: 14,
        cycle_total_accas: 6,
        weekly_target_accas: 0,
        distribution_mode: 'fixture_volume_weighted'
    },
    30: {
        cycle_days: 28,
        cycle_total_accas: 48,
        weekly_target_accas: 12,
        distribution_mode: 'weekly_fixture_volume_weighted'
    }
};

const SUBSCRIPTION_MATRIX = {
    core_4day_sprint: {
        plan_id: 'core_4day_sprint',
        name: '4-Day Sprint',
        tier: 'core',
        duration_days: 4,
        price: 3.99,
        chatbot_daily_limit: 10,
        sports_coverage: ['football', 'basketball', 'cricket', 'rugby', 'baseball'],
        market_access: ['1X2', 'double_chance', 'over_2_5', 'under_2_5', 'btts_yes'],
        mega_acca_allocation: 1,
        mega_acca_constraints: {
            min_leg_confidence: 80,
            sports_coverage: 'all',
            cricket_must_finish_before_expiry: true
        },
        daily_limits: {
            monday: { direct: 6, secondary: 4, multi: 2, same_match: 2, acca_6match: 1 },
            tuesday: { direct: 6, secondary: 4, multi: 2, same_match: 2, acca_6match: 1 },
            wednesday: { direct: 8, secondary: 5, multi: 3, same_match: 2, acca_6match: 1 },
            thursday: { direct: 8, secondary: 5, multi: 3, same_match: 2, acca_6match: 1 },
            friday: { direct: 10, secondary: 6, multi: 3, same_match: 3, acca_6match: 2 },
            saturday: { direct: 15, secondary: 8, multi: 5, same_match: 5, acca_6match: 3 },
            sunday: { direct: 12, secondary: 7, multi: 4, same_match: 4, acca_6match: 2 }
        }
    },
    core_9day_run: {
        plan_id: 'core_9day_run',
        name: '9-Day Run',
        tier: 'core',
        duration_days: 9,
        price: 7.99,
        chatbot_daily_limit: 15,
        sports_coverage: ['football', 'basketball', 'cricket', 'rugby', 'baseball', 'hockey'],
        market_access: ['1X2', 'double_chance', 'over_2_5', 'under_2_5', 'btts_yes', 'over_1_5'],
        mega_acca_allocation: 3,
        mega_acca_constraints: {
            min_leg_confidence: 80,
            sports_coverage: 'all',
            cricket_must_finish_before_expiry: true
        },
        daily_limits: {
            monday: { direct: 8, secondary: 5, multi: 3, same_match: 3, acca_6match: 1 },
            tuesday: { direct: 8, secondary: 5, multi: 3, same_match: 3, acca_6match: 1 },
            wednesday: { direct: 10, secondary: 6, multi: 4, same_match: 3, acca_6match: 2 },
            thursday: { direct: 10, secondary: 6, multi: 4, same_match: 3, acca_6match: 2 },
            friday: { direct: 12, secondary: 8, multi: 4, same_match: 4, acca_6match: 2 },
            saturday: { direct: 18, secondary: 10, multi: 6, same_match: 6, acca_6match: 4 },
            sunday: { direct: 14, secondary: 9, multi: 5, same_match: 5, acca_6match: 3 }
        }
    },
    core_14day_pro: {
        plan_id: 'core_14day_pro',
        name: '14-Day Pro',
        tier: 'core',
        duration_days: 14,
        price: 14.99,
        chatbot_daily_limit: 20,
        sports_coverage: ['football', 'basketball', 'cricket', 'rugby', 'baseball', 'hockey', 'volleyball'],
        market_access: ['1X2', 'double_chance', 'over_2_5', 'under_2_5', 'btts_yes', 'over_1_5'],
        mega_acca_allocation: 6,
        mega_acca_constraints: {
            min_leg_confidence: 80,
            sports_coverage: 'all',
            cricket_must_finish_before_expiry: true
        },
        daily_limits: {
            monday: { direct: 9, secondary: 6, multi: 4, same_match: 4, acca_6match: 2 },
            tuesday: { direct: 9, secondary: 6, multi: 4, same_match: 4, acca_6match: 2 },
            wednesday: { direct: 12, secondary: 8, multi: 5, same_match: 4, acca_6match: 2 },
            thursday: { direct: 12, secondary: 8, multi: 5, same_match: 4, acca_6match: 2 },
            friday: { direct: 15, secondary: 10, multi: 5, same_match: 5, acca_6match: 3 },
            saturday: { direct: 22, secondary: 12, multi: 8, same_match: 8, acca_6match: 5 },
            sunday: { direct: 18, secondary: 11, multi: 6, same_match: 6, acca_6match: 3 }
        }
    },
    core_30day_limitless: {
        plan_id: 'core_30day_limitless',
        name: '30-Day Limitless',
        tier: 'core',
        duration_days: 30,
        price: 34.99,
        chatbot_daily_limit: 30,
        sports_coverage: ['football', 'basketball', 'cricket', 'rugby', 'baseball', 'hockey', 'volleyball', 'mma', 'formula1', 'afl', 'handball'],
        market_access: 'all',
        mega_acca_allocation: 12,
        mega_acca_constraints: {
            min_leg_confidence: 80,
            sports_coverage: 'all',
            cricket_must_finish_before_expiry: true
        },
        daily_limits: {
            monday: { direct: 10, secondary: 8, multi: 5, same_match: 5, acca_6match: 3 },
            tuesday: { direct: 10, secondary: 8, multi: 5, same_match: 5, acca_6match: 3 },
            wednesday: { direct: 15, secondary: 10, multi: 7, same_match: 6, acca_6match: 4 },
            thursday: { direct: 15, secondary: 10, multi: 7, same_match: 6, acca_6match: 4 },
            friday: { direct: 20, secondary: 12, multi: 8, same_match: 8, acca_6match: 5 },
            saturday: { direct: 30, secondary: 15, multi: 10, same_match: 10, acca_6match: 8 },
            sunday: { direct: 25, secondary: 14, multi: 9, same_match: 9, acca_6match: 6 }
        }
    },
    elite_4day_deep_dive: {
        plan_id: 'elite_4day_deep_dive',
        name: '4-Day Deep Dive',
        tier: 'elite',
        duration_days: 4,
        price: 9.99,
        chatbot_daily_limit: 25,
        sports_coverage: 'all',
        market_access: 'all',
        mega_acca_allocation: 1,
        mega_acca_constraints: {
            min_leg_confidence: 80,
            sports_coverage: 'all',
            cricket_must_finish_before_expiry: true
        },
        daily_limits: {
            monday: { direct: 8, secondary: 5, multi: 3, same_match: 3, acca_6match: 1 },
            tuesday: { direct: 8, secondary: 5, multi: 3, same_match: 3, acca_6match: 1 },
            wednesday: { direct: 10, secondary: 7, multi: 4, same_match: 3, acca_6match: 2 },
            thursday: { direct: 10, secondary: 7, multi: 4, same_match: 3, acca_6match: 2 },
            friday: { direct: 14, secondary: 8, multi: 5, same_match: 5, acca_6match: 3 },
            saturday: { direct: 20, secondary: 12, multi: 8, same_match: 8, acca_6match: 5 },
            sunday: { direct: 16, secondary: 10, multi: 6, same_match: 6, acca_6match: 4 }
        }
    },
    elite_9day_deep_strike: {
        plan_id: 'elite_9day_deep_strike',
        name: '9-Day Deep Strike',
        tier: 'elite',
        duration_days: 9,
        price: 19.99,
        chatbot_daily_limit: 35,
        sports_coverage: 'all',
        market_access: 'all',
        mega_acca_allocation: 3,
        mega_acca_constraints: {
            min_leg_confidence: 80,
            sports_coverage: 'all',
            cricket_must_finish_before_expiry: true
        },
        daily_limits: {
            monday: { direct: 10, secondary: 7, multi: 4, same_match: 4, acca_6match: 2 },
            tuesday: { direct: 10, secondary: 7, multi: 4, same_match: 4, acca_6match: 2 },
            wednesday: { direct: 14, secondary: 9, multi: 6, same_match: 5, acca_6match: 3 },
            thursday: { direct: 14, secondary: 9, multi: 6, same_match: 5, acca_6match: 3 },
            friday: { direct: 18, secondary: 11, multi: 7, same_match: 7, acca_6match: 4 },
            saturday: { direct: 28, secondary: 15, multi: 10, same_match: 10, acca_6match: 7 },
            sunday: { direct: 22, secondary: 13, multi: 8, same_match: 8, acca_6match: 5 }
        }
    },
    elite_14day_deep_pro: {
        plan_id: 'elite_14day_deep_pro',
        name: '14-Day Deep Pro',
        tier: 'elite',
        duration_days: 14,
        price: 39.99,
        chatbot_daily_limit: 50,
        sports_coverage: 'all',
        market_access: 'all',
        mega_acca_allocation: 6,
        mega_acca_constraints: {
            min_leg_confidence: 80,
            sports_coverage: 'all',
            cricket_must_finish_before_expiry: true
        },
        daily_limits: {
            monday: { direct: 12, secondary: 9, multi: 6, same_match: 6, acca_6match: 3 },
            tuesday: { direct: 12, secondary: 9, multi: 6, same_match: 6, acca_6match: 3 },
            wednesday: { direct: 18, secondary: 12, multi: 8, same_match: 7, acca_6match: 4 },
            thursday: { direct: 18, secondary: 12, multi: 8, same_match: 7, acca_6match: 4 },
            friday: { direct: 22, secondary: 15, multi: 10, same_match: 10, acca_6match: 6 },
            saturday: { direct: 35, secondary: 20, multi: 14, same_match: 14, acca_6match: 10 },
            sunday: { direct: 28, secondary: 18, multi: 12, same_match: 12, acca_6match: 8 }
        }
    },
    elite_30day_deep_vip: {
        plan_id: 'elite_30day_deep_vip',
        name: '30-Day Deep VIP',
        tier: 'elite',
        duration_days: 30,
        price: 59.99,
        chatbot_daily_limit: 150,
        sports_coverage: 'all',
        market_access: 'all',
        mega_acca_allocation: 12,
        mega_acca_constraints: {
            min_leg_confidence: 80,
            sports_coverage: 'all',
            cricket_must_finish_before_expiry: true
        },
        daily_limits: {
            monday: { direct: 15, secondary: 12, multi: 8, same_match: 8, acca_6match: 5 },
            tuesday: { direct: 15, secondary: 12, multi: 8, same_match: 8, acca_6match: 5 },
            wednesday: { direct: 22, secondary: 15, multi: 10, same_match: 10, acca_6match: 7 },
            thursday: { direct: 22, secondary: 15, multi: 10, same_match: 10, acca_6match: 7 },
            friday: { direct: 30, secondary: 18, multi: 12, same_match: 12, acca_6match: 10 },
            saturday: { direct: 45, secondary: 25, multi: 18, same_match: 18, acca_6match: 15 },
            sunday: { direct: 35, secondary: 22, multi: 15, same_match: 15, acca_6match: 12 }
        }
    }
};

function normalizeDay(dayOfWeek) {
    return String(dayOfWeek || '').trim().toLowerCase();
}

function getTodayName(now = new Date()) {
    return now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();
}

function startOfUtcDay(input) {
    const source = input instanceof Date ? input : new Date(input);
    const date = Number.isNaN(source.getTime()) ? new Date() : source;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function resolveMegaPolicy(plan) {
    const duration = Number(plan?.duration_days || 0);
    const policy = MEGA_ACCA_POLICY_BY_DURATION[duration];
    if (!policy) {
        return {
            cycle_days: 0,
            cycle_total_accas: 0,
            weekly_target_accas: 0,
            distribution_mode: 'none'
        };
    }
    return {
        ...policy,
        legs_per_acca: MEGA_ACCA_SIZE
    };
}

function resolveMegaConstraints(plan) {
    return {
        ...DEFAULT_MEGA_ACCA_CONSTRAINTS,
        ...(plan?.mega_acca_constraints || {})
    };
}

function normalizeVolumeVector(rawVolumes, size) {
    const out = [];
    const source = Array.isArray(rawVolumes) ? rawVolumes : [];
    for (let i = 0; i < size; i++) {
        const n = Number(source[i]);
        out.push(Number.isFinite(n) && n > 0 ? n : 0);
    }
    return out;
}

function distributeUnitsByWeight(totalUnits, weights) {
    const units = Math.max(0, Math.floor(Number(totalUnits) || 0));
    if (units === 0) return weights.map(() => 0);

    const safeWeights = weights.map((weight) => {
        const n = Number(weight);
        return Number.isFinite(n) && n > 0 ? n : 0;
    });
    const sum = safeWeights.reduce((acc, value) => acc + value, 0);
    const effective = sum > 0 ? safeWeights : safeWeights.map(() => 1);
    const effectiveSum = effective.reduce((acc, value) => acc + value, 0) || 1;

    const seeded = effective.map((weight, index) => {
        const raw = (units * weight) / effectiveSum;
        const base = Math.floor(raw);
        return {
            index,
            base,
            remainder: raw - base,
            weight
        };
    });

    let remaining = units - seeded.reduce((acc, entry) => acc + entry.base, 0);
    seeded.sort((a, b) => {
        if (b.remainder !== a.remainder) return b.remainder - a.remainder;
        if (b.weight !== a.weight) return b.weight - a.weight;
        return a.index - b.index;
    });

    for (let i = 0; i < seeded.length && remaining > 0; i++) {
        seeded[i].base += 1;
        remaining -= 1;
    }

    seeded.sort((a, b) => a.index - b.index);
    return seeded.map((entry) => entry.base);
}

function legsToAccaTargets(legTargets) {
    const out = [];
    let cumulativeLegs = 0;
    let distributedAccas = 0;

    for (const legTarget of legTargets) {
        cumulativeLegs += Number(legTarget) || 0;
        const accasByNow = Math.floor(cumulativeLegs / MEGA_ACCA_SIZE);
        const todayAccas = Math.max(0, accasByNow - distributedAccas);
        out.push(todayAccas);
        distributedAccas = accasByNow;
    }

    return out;
}

function buildMegaDistribution(policy, fixtureVolumeByCycleDay = []) {
    const cycleDays = Number(policy?.cycle_days || 0);
    if (cycleDays <= 0) {
        return {
            cycle_days: 0,
            cycle_total_accas: 0,
            weekly_target_accas: 0,
            legs_per_acca: MEGA_ACCA_SIZE,
            daily_leg_targets: [],
            daily_acca_targets: []
        };
    }

    const volumes = normalizeVolumeVector(fixtureVolumeByCycleDay, cycleDays);
    let dailyLegTargets = Array(cycleDays).fill(0);

    if (policy.distribution_mode === 'fixed_three_legs_per_day') {
        dailyLegTargets = Array(cycleDays).fill(Number(policy.fixed_legs_per_day || 3));
    } else if (policy.distribution_mode === 'weekly_fixture_volume_weighted') {
        const weekSize = 7;
        const weeks = Math.floor(cycleDays / weekSize);
        const weeklyLegTarget = Number(policy.weekly_target_accas || 0) * MEGA_ACCA_SIZE;
        const weekBase = volumes.slice(0, weekSize);
        for (let week = 0; week < weeks; week++) {
            const start = week * weekSize;
            const windowWeights = volumes.slice(start, start + weekSize);
            const hasWindowSignal = windowWeights.some((value) => value > 0);
            const weights = hasWindowSignal ? windowWeights : weekBase;
            const allocated = distributeUnitsByWeight(weeklyLegTarget, weights);
            for (let i = 0; i < allocated.length; i++) {
                dailyLegTargets[start + i] = allocated[i];
            }
        }
    } else {
        const totalLegs = Number(policy.cycle_total_accas || 0) * MEGA_ACCA_SIZE;
        dailyLegTargets = distributeUnitsByWeight(totalLegs, volumes);
    }

    const dailyAccaTargets = legsToAccaTargets(dailyLegTargets);
    return {
        cycle_days: cycleDays,
        cycle_total_accas: Number(policy.cycle_total_accas || 0),
        weekly_target_accas: Number(policy.weekly_target_accas || 0),
        legs_per_acca: MEGA_ACCA_SIZE,
        daily_leg_targets: dailyLegTargets,
        daily_acca_targets: dailyAccaTargets
    };
}

function daySerialUtc(now = new Date()) {
    return Math.floor(startOfUtcDay(now).getTime() / MS_PER_DAY);
}

function fallbackCycleIndex(policy, now = new Date()) {
    const cycleDays = Number(policy?.cycle_days || 0);
    if (cycleDays <= 0) return 0;

    if (policy.distribution_mode === 'weekly_fixture_volume_weighted' && cycleDays % 7 === 0) {
        const today = startOfUtcDay(now);
        const dayOfWeek = today.getUTCDay();
        const mondayBasedDay = (dayOfWeek + 6) % 7;
        const weekSerial = Math.floor(daySerialUtc(today) / 7);
        const weekInCycle = ((weekSerial % 4) + 4) % 4;
        return (weekInCycle * 7) + mondayBasedDay;
    }

    const serial = daySerialUtc(now);
    return ((serial % cycleDays) + cycleDays) % cycleDays;
}

function resolveCycleIndex(policy, now = new Date(), subscriptionStart = null) {
    const cycleDays = Number(policy?.cycle_days || 0);
    if (cycleDays <= 0) return 0;

    const startCandidate = subscriptionStart ? startOfUtcDay(subscriptionStart) : null;
    if (!startCandidate || Number.isNaN(startCandidate.getTime())) {
        return fallbackCycleIndex(policy, now);
    }

    const deltaDays = Math.floor((startOfUtcDay(now).getTime() - startCandidate.getTime()) / MS_PER_DAY);
    const normalized = ((deltaDays % cycleDays) + cycleDays) % cycleDays;
    return normalized;
}

function calculateDailyAllocations(planId, dayOfWeek) {
    const plan = SUBSCRIPTION_MATRIX[planId];
    if (!plan) return null;
    return plan.daily_limits[normalizeDay(dayOfWeek)] || null;
}

function getPlanCapabilities(planId) {
    const plan = SUBSCRIPTION_MATRIX[planId];
    if (!plan) return null;
    const canonicalTier = plan.tier === 'elite' ? 'deep' : 'normal';
    const tierAliases = canonicalTier === 'deep'
        ? ['deep', 'elite']
        : ['normal', 'core'];
    const megaPolicy = resolveMegaPolicy(plan);
    const megaConstraints = resolveMegaConstraints(plan);
    const displayMegaAllocation = megaPolicy.weekly_target_accas > 0
        ? megaPolicy.weekly_target_accas
        : (megaPolicy.cycle_total_accas || Number(plan.mega_acca_allocation || 0));

    return {
        ...plan,
        baseline_plan_id: FAMILY_BASELINES[plan.tier],
        canonical_tier: canonicalTier,
        tiers: tierAliases,
        mega_acca_policy: megaPolicy,
        capabilities: {
            chatbot_daily_limit: plan.chatbot_daily_limit,
            sports_coverage: plan.sports_coverage,
            market_access: plan.market_access,
            plan_tier: plan.tier,
            mega_acca_allocation: displayMegaAllocation,
            mega_acca_constraints: megaConstraints,
            mega_acca_policy: megaPolicy
        }
    };
}

function getPlansByFamily(family) {
    return Object.values(SUBSCRIPTION_MATRIX).filter((plan) => plan.tier === family);
}

function getBaselinePlan(family = 'elite') {
    const baselinePlanId = FAMILY_BASELINES[family] || FAMILY_BASELINES.elite;
    return getPlanCapabilities(baselinePlanId);
}

function normalizeSportName(value) {
    const sport = String(value || '').trim().toLowerCase();
    if (!sport) return '';
    if (sport.startsWith('soccer_')) return 'football';
    if (sport.startsWith('icehockey_')) return 'hockey';
    if (sport.startsWith('basketball_')) return 'basketball';
    if (sport.startsWith('americanfootball_')) return 'nfl';
    if (sport.startsWith('baseball_')) return 'baseball';
    if (sport.startsWith('rugbyunion_')) return 'rugby';
    if (sport.startsWith('aussierules_')) return 'afl';
    if (sport.startsWith('mma_')) return 'mma';
    return sport;
}

function normalizeMarketName(value) {
    return String(value || '').trim().toLowerCase();
}

function getPlanAccessLevel(planId) {
    const key = String(planId || '').trim().toLowerCase();
    if (!key.startsWith('elite_')) return null;
    if (key.includes('deep_vip')) return 'vip';
    if (key.includes('deep_pro')) return 'pro';
    if (key.includes('deep_strike')) return 'strike';
    if (key.includes('deep_dive')) return 'deep_dive';
    return null;
}

function predictionAllowsPlanAccess(prediction, planId) {
    const accessLevel = getPlanAccessLevel(planId);
    if (!accessLevel) return true;

    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const tierAccessSets = matches
        .map((match) => match?.metadata?.tier_access)
        .filter((value) => Array.isArray(value) && value.length > 0);

    if (tierAccessSets.length === 0) return true;
    return tierAccessSets.every((allowed) => allowed.includes(accessLevel));
}

function getPredictionCategory(prediction) {
    const explicit = String(prediction?.section_type || prediction?.type || '').trim().toLowerCase();
    if (PLAN_CATEGORIES.includes(explicit) || EXTRA_PLAN_CATEGORIES.includes(explicit)) return explicit;

    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const uniqueMatchIds = new Set(matches.map((match) => String(match?.match_id || '').trim()).filter(Boolean));
    const firstMarket = normalizeMarketName(matches[0]?.market);

    if (matches.length > 1 && uniqueMatchIds.size === 1) return 'same_match';
    if (matches.length >= 12 || explicit === 'mega_acca_12') return 'mega_acca_12';
    if (matches.length >= 6 || explicit === 'acca') return 'acca_6match';
    if (matches.length >= 2) return 'multi';
    if (matches.length === 1 && firstMarket && firstMarket !== '1x2' && firstMarket !== 'match_result') return 'secondary';
    return 'direct';
}

function getPredictionSport(prediction) {
    const firstMatch = Array.isArray(prediction?.matches) && prediction.matches[0] ? prediction.matches[0] : {};
    return normalizeSportName(firstMatch.sport || firstMatch?.metadata?.sport || '');
}

function getPredictionMarket(prediction) {
    const firstMatch = Array.isArray(prediction?.matches) && prediction.matches[0] ? prediction.matches[0] : {};
    return normalizeMarketName(firstMatch.market || '');
}

function cloneWithSectionType(prediction, sectionType) {
    return {
        ...prediction,
        section_type: sectionType
    };
}

function getPredictionFixtureIds(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    return matches
        .map((match) => String(match?.match_id || '').trim())
        .filter(Boolean);
}

function parsePredictionKickoff(match) {
    const value =
        match?.commence_time ||
        match?.match_date ||
        match?.metadata?.match_time ||
        match?.metadata?.kickoff ||
        match?.metadata?.kickoff_time ||
        null;
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildFixtureVolumeByCycleDay(predictions, policy, now = new Date(), options = {}) {
    const cycleDays = Number(policy?.cycle_days || 0);
    if (cycleDays <= 0) return [];

    const volumes = Array(cycleDays).fill(0);
    const hasSubscriptionStart = Boolean(options.subscriptionStart);
    const cycleStart = hasSubscriptionStart ? startOfUtcDay(options.subscriptionStart) : startOfUtcDay(now);

    const rows = Array.isArray(predictions) ? predictions : [];
    for (const prediction of rows) {
        const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
        for (const match of matches) {
            const kickoff = parsePredictionKickoff(match);
            if (!kickoff) continue;

            let index;
            if (hasSubscriptionStart) {
                index = Math.floor((startOfUtcDay(kickoff).getTime() - cycleStart.getTime()) / MS_PER_DAY);
            } else {
                index = fallbackCycleIndex(policy, kickoff);
            }

            if (index >= 0 && index < cycleDays) {
                volumes[index] += 1;
            }
        }
    }

    if (volumes.some((value) => value > 0)) {
        return volumes;
    }

    return Array(cycleDays).fill(1);
}

function getMegaAccaDistributionForPlan(planId, now = new Date(), options = {}) {
    const plan = SUBSCRIPTION_MATRIX[planId];
    if (!plan) return null;
    const policy = resolveMegaPolicy(plan);
    if (!policy.cycle_total_accas) {
        return {
            policy,
            day_index: 0,
            daily_allocation: 0,
            daily_leg_targets: [],
            daily_acca_targets: []
        };
    }

    const fixtureVolumes = Array.isArray(options.fixtureVolumeByCycleDay)
        ? options.fixtureVolumeByCycleDay
        : buildFixtureVolumeByCycleDay(options.predictions, policy, now, options);

    const distribution = buildMegaDistribution(policy, fixtureVolumes);
    const dayIndex = resolveCycleIndex(policy, now, options.subscriptionStart);
    return {
        policy,
        day_index: dayIndex,
        daily_allocation: Number(distribution.daily_acca_targets[dayIndex] || 0),
        daily_leg_targets: distribution.daily_leg_targets,
        daily_acca_targets: distribution.daily_acca_targets
    };
}

function getMegaAccaDailyAllocation(planId, now = new Date(), options = {}) {
    const distribution = getMegaAccaDistributionForPlan(planId, now, options);
    return Number(distribution?.daily_allocation || 0);
}

function predictionSatisfiesMegaConstraints(prediction, plan, now) {
    const constraints = plan?.capabilities?.mega_acca_constraints;
    if (!constraints) return true;

    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    if (!matches.length) return false;
    if (matches.some((match) => Number(match?.confidence) < Number(constraints.min_leg_confidence || 0))) {
        return false;
    }

    if (!constraints.cricket_must_finish_before_expiry) return true;

    const expiry = new Date(now);
    expiry.setUTCDate(expiry.getUTCDate() + Number(plan.duration_days || 0));

    return matches.every((match) => {
        if (normalizeSportName(match?.sport || '') !== 'cricket') return true;
        const kickoff = parsePredictionKickoff(match);
        if (!kickoff) return false;
        const estimatedCompletion = new Date(kickoff.getTime() + (12 * 60 * 60 * 1000));
        return estimatedCompletion <= expiry;
    });
}

function enforceUniqueAssetWindow(predictions, plan, now) {
    const usedFixtureIds = new Set();
    const shaped = [];

    for (const prediction of predictions) {
        const category = getPredictionCategory(prediction);
        if (category === 'mega_acca_12' && !predictionSatisfiesMegaConstraints(prediction, plan, now)) {
            continue;
        }

        const fixtureIds = getPredictionFixtureIds(prediction);
        if (fixtureIds.length === 0) continue;
        if (fixtureIds.some((id) => usedFixtureIds.has(id))) continue;

        fixtureIds.forEach((id) => usedFixtureIds.add(id));
        shaped.push(prediction);
    }

    return shaped;
}

function filterPredictionsForPlan(predictions, planId, now = new Date(), options = {}) {
    const plan = getPlanCapabilities(planId);
    if (!plan) return [];

    const dayName = getTodayName(now);
    const dailyLimits = calculateDailyAllocations(planId, dayName);
    if (!dailyLimits) return [];

    let filtered = Array.isArray(predictions) ? predictions.slice() : [];

    if (Array.isArray(plan.capabilities.sports_coverage)) {
        const allowedSports = new Set(plan.capabilities.sports_coverage.map(normalizeSportName));
        filtered = filtered.filter((prediction) => allowedSports.has(getPredictionSport(prediction)));
    }

    if (Array.isArray(plan.capabilities.market_access)) {
        const allowedMarkets = new Set(plan.capabilities.market_access.map(normalizeMarketName));
        filtered = filtered.filter((prediction) => {
            const category = getPredictionCategory(prediction);
            if (category !== 'direct' && category !== 'secondary') return true;
            return allowedMarkets.has(getPredictionMarket(prediction));
        });
    }

    filtered = filtered.filter((prediction) => predictionAllowsPlanAccess(prediction, planId));

    const allCategories = [...PLAN_CATEGORIES, ...EXTRA_PLAN_CATEGORIES];
    const buckets = new Map(allCategories.map((category) => [category, []]));
    for (const prediction of filtered) {
        const category = getPredictionCategory(prediction);
        if (!buckets.has(category)) continue;
        buckets.get(category).push(cloneWithSectionType(prediction, category));
    }

    const megaDailyAllocation = getMegaAccaDailyAllocation(planId, now, {
        subscriptionStart: options.subscriptionStart || options.officialStartTime || null,
        fixtureVolumeByCycleDay: options.fixtureVolumeByCycleDay,
        predictions: filtered
    });

    const shaped = [];
    for (const category of PLAN_CATEGORIES) {
        const limit = dailyLimits[category] || 0;
        if (limit <= 0) continue;
        shaped.push(...buckets.get(category).slice(0, limit));
    }

    for (const category of EXTRA_PLAN_CATEGORIES) {
        const limit = category === 'mega_acca_12'
            ? megaDailyAllocation
            : 0;
        if (limit <= 0) continue;
        shaped.push(...buckets.get(category).slice(0, limit));
    }

    if (options.enforceUniqueAssetWindow === false) {
        return shaped;
    }

    return enforceUniqueAssetWindow(shaped, plan, now);
}

module.exports = {
    DAY_NAMES,
    PLAN_CATEGORIES,
    EXTRA_PLAN_CATEGORIES,
    SUBSCRIPTION_MATRIX,
    calculateDailyAllocations,
    getPlanCapabilities,
    filterPredictionsForPlan,
    getMegaAccaDailyAllocation,
    getMegaAccaDistributionForPlan,
    getPlanAccessLevel,
    getPlansByFamily,
    getBaselinePlan
};
