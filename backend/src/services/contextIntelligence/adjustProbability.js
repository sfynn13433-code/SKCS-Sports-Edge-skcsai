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
        totalRiskPenalty += weights[key] * Math.max(0, Math.min(1, normalized));
      }
    }
  }

  // Proportional Decay: Max penalty of 1.0 reduces baseline probability by up to 35%
  const MAX_PENALTY_FACTOR = 0.35;
  const applied_penalty = totalRiskPenalty * MAX_PENALTY_FACTOR;

  // Decay the base probability
  let p_adj = p_base * (1 - applied_penalty);

  // Enforce strict mathematical boundaries (10% to 95%)
  return Number(Math.min(Math.max(p_adj, 0.10), 0.95).toFixed(3));
}
module.exports = adjustProbability;
