function getAvailabilitySignal(teamData) {
  const { injuries, suspensions, expectedXI } = teamData;

  const keyAbsences = injuries.filter(p => p.isKeyPlayer).length + suspensions.filter(p => p.isKeyPlayer).length;
  const squadAbsences = injuries.filter(p => !p.isKeyPlayer).length + suspensions.filter(p => !p.isKeyPlayer).length;

  let risk = 0;

  if (keyAbsences >= 3) risk += 0.8;
  else if (keyAbsences === 2) risk += 0.5;
  else if (keyAbsences === 1) risk += 0.25;

  if (squadAbsences > 4) risk += 0.2;
  if (expectedXI.reliability < 0.6) risk += 0.3;

  return {
    availability_risk: Math.min(risk, 1),
    meta: { keyAbsences, squadAbsences, reliability: expectedXI.reliability }
  };
}
module.exports = getAvailabilitySignal;
