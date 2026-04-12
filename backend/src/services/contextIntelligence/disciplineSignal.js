function getDisciplineSignal(teamDiscipline) {
  const { redCards, yellowCardThreats, bans } = teamDiscipline;

  let risk = 0;
  if (bans.length > 0) risk += 0.5;
  if (yellowCardThreats.length >= 3) risk += 0.3;
  if (redCards.last5Games >= 2) risk += 0.2;

  return {
    discipline_risk: Math.min(risk, 1),
    meta: { bans, yellowCardThreats }
  };
}
module.exports = getDisciplineSignal;
