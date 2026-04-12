function adjustProbability(p_base, signals) {
  const weights = {
    availability_risk: 0.40,
    stability_risk: 0.35,
    discipline_risk: 0.15,
    weather_risk: 0.10
  };

  let totalRiskPenalty = 0;
  for (const [key, value] of Object.entries(signals)) {
    if (weights[key]) {
      totalRiskPenalty += weights[key] * value;
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
