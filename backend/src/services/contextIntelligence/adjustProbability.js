function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeMarketKey(market) {
  return String(market || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .replace(/\./g, '_')
    .replace(/_+/g, '_');
}

function adjustmentToDelta(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return 0;
  if (Math.abs(n) <= 1) return n;
  return n / 100;
}

function resolveMarketAdjustment(market, marketAdjustments) {
  if (!marketAdjustments || typeof marketAdjustments !== 'object') return 0;

  const marketKey = String(market || '').trim();
  const normalizedMarket = normalizeMarketKey(marketKey);
  const directCandidates = [
    marketKey,
    marketKey.toLowerCase(),
    normalizedMarket,
    normalizedMarket.replace(/_(\d+)_(\d+)$/, '_$1.$2')
  ];

  for (const key of directCandidates) {
    if (Object.prototype.hasOwnProperty.call(marketAdjustments, key)) {
      return Number(marketAdjustments[key]) || 0;
    }
  }

  for (const [key, value] of Object.entries(marketAdjustments)) {
    if (normalizeMarketKey(key) === normalizedMarket) {
      return Number(value) || 0;
    }
  }

  return 0;
}

function applyMarketAdjustment(probability, market, marketAdjustments) {
  const baseProbability = Number(probability);
  if (!Number.isFinite(baseProbability)) return 0.1;

  const rawAdjustment = resolveMarketAdjustment(market, marketAdjustments);
  const adjustmentDelta = adjustmentToDelta(rawAdjustment);
  return Number(clamp(baseProbability + adjustmentDelta, 0.10, 0.95).toFixed(3));
}

function adjustProbability(p_base, signals) {
  const weights = {
    availability_risk: 0.40,
    stability_risk: 0.35,
    discipline_risk: 0.15,
    weather_risk: 0.10,
    travel_fatigue_risk: 0.08,
    fixture_congestion_risk: 0.08,
    derby_risk: 0.10,
    rotation_risk: 0.08,
    market_movement_risk: 0.05,
    lineup_uncertainty_risk: 0.10
  };

  let totalRiskPenalty = 0;
  for (const [key, value] of Object.entries(signals)) {
    if (weights[key]) {
      const normalized = Number(value);
      if (Number.isFinite(normalized)) {
        totalRiskPenalty += weights[key] * clamp(normalized, 0, 1);
      }
    }
  }

  // Proportional Decay: Max penalty of 1.0 reduces baseline probability by up to 35%
  const MAX_PENALTY_FACTOR = 0.35;
  const applied_penalty = totalRiskPenalty * MAX_PENALTY_FACTOR;

  // Decay the base probability
  let p_adj = p_base * (1 - applied_penalty);

  // Enforce strict mathematical boundaries (10% to 95%)
  return Number(clamp(p_adj, 0.10, 0.95).toFixed(3));
}

adjustProbability.applyMarketAdjustment = applyMarketAdjustment;
adjustProbability.resolveMarketAdjustment = resolveMarketAdjustment;
module.exports = adjustProbability;
