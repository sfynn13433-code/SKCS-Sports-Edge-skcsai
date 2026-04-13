function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toRisk(value, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

function getDisciplineSignal(teamDisciplineOrSuspensions, disciplineRiskArg) {
  const legacyShape = teamDisciplineOrSuspensions && typeof teamDisciplineOrSuspensions === 'object' && !Array.isArray(teamDisciplineOrSuspensions)
    && (teamDisciplineOrSuspensions.redCards || teamDisciplineOrSuspensions.yellowCardThreats || teamDisciplineOrSuspensions.bans);

  const bans = legacyShape
    ? toArray(teamDisciplineOrSuspensions.bans)
    : toArray(teamDisciplineOrSuspensions);
  const yellowCardThreats = legacyShape
    ? toArray(teamDisciplineOrSuspensions.yellowCardThreats)
    : [];
  const redCards = legacyShape
    ? (teamDisciplineOrSuspensions.redCards || { last5Games: 0 })
    : { last5Games: 0 };
  const directRisk = legacyShape
    ? toRisk(teamDisciplineOrSuspensions.discipline_risk, null)
    : toRisk(disciplineRiskArg, null);

  let risk = 0;
  if (bans.length > 0) risk += 0.5;
  if (yellowCardThreats.length >= 3) risk += 0.3;
  if (Number(redCards.last5Games || 0) >= 2) risk += 0.2;
  if (directRisk !== null) risk = Math.max(risk, directRisk);

  return {
    discipline_risk: Math.min(risk, 1),
    meta: { bans, yellowCardThreats, redCards, directRisk }
  };
}
module.exports = getDisciplineSignal;
