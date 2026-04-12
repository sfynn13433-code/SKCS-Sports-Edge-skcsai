function getStabilitySignal(teamContext) {
  const { coachConflict, execInstability, playerLegalIssues, fanViolence } = teamContext;

  let risk = 0;
  if (coachConflict) risk += 0.4;
  if (execInstability) risk += 0.3;
  if (playerLegalIssues.length > 0) risk += 0.3;
  if (fanViolence) risk += 0.5;

  return {
    stability_risk: Math.min(risk, 1),
    meta: { coachConflict, execInstability, playerLegalIssues, fanViolence }
  };
}
module.exports = getStabilitySignal;
