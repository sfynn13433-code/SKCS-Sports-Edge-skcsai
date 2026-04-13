function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (key === 'true' || key === 'yes' || key === '1' || key === 'confirmed') return true;
    if (key === 'false' || key === 'no' || key === '0' || key === 'unconfirmed') return false;
  }
  return fallback;
}

function isKeyAbsence(player) {
  if (!player || typeof player !== 'object') return false;
  if (player.isKeyPlayer === true) return true;
  const role = String(player.role || player.position || '').toLowerCase();
  return role.includes('striker') || role.includes('goalkeeper') || role.includes('captain');
}

function resolveReliability(expectedLineups, confirmedLineups, lineupConfirmed, fallbackReliability) {
  if (typeof fallbackReliability === 'number' && Number.isFinite(fallbackReliability)) {
    return Math.max(0, Math.min(1, fallbackReliability));
  }
  if (lineupConfirmed) return 0.98;
  if (toArray(confirmedLineups).length > 0) return 0.92;
  if (toArray(expectedLineups).length > 0) return 0.72;
  return 0.56;
}

function getAvailabilitySignal(teamDataOrInjuries, suspensionsArg, expectedLineupsArg, confirmedLineupsArg, lineupConfirmedArg) {
  const legacyShape = teamDataOrInjuries && typeof teamDataOrInjuries === 'object' && !Array.isArray(teamDataOrInjuries)
    && (teamDataOrInjuries.injuries || teamDataOrInjuries.suspensions || teamDataOrInjuries.expectedXI);

  const injuries = legacyShape ? toArray(teamDataOrInjuries.injuries) : toArray(teamDataOrInjuries);
  const suspensions = legacyShape ? toArray(teamDataOrInjuries.suspensions) : toArray(suspensionsArg);
  const expectedLineups = legacyShape
    ? toArray(teamDataOrInjuries.expectedLineups || teamDataOrInjuries.expected_lineups)
    : toArray(expectedLineupsArg);
  const confirmedLineups = legacyShape
    ? toArray(teamDataOrInjuries.confirmedLineups || teamDataOrInjuries.confirmed_lineups)
    : toArray(confirmedLineupsArg);
  const legacyReliability = legacyShape && typeof teamDataOrInjuries.expectedXI?.reliability === 'number'
    ? Number(teamDataOrInjuries.expectedXI.reliability)
    : null;
  const lineupConfirmed = legacyShape
    ? toBoolean(teamDataOrInjuries.lineup_confirmed, confirmedLineups.length > 0)
    : toBoolean(lineupConfirmedArg, confirmedLineups.length > 0);

  const keyAbsences = injuries.filter(isKeyAbsence).length + suspensions.filter(isKeyAbsence).length;
  const squadAbsences = injuries.filter((p) => !isKeyAbsence(p)).length + suspensions.filter((p) => !isKeyAbsence(p)).length;
  const reliability = resolveReliability(expectedLineups, confirmedLineups, lineupConfirmed, legacyReliability);

  let risk = 0;

  if (keyAbsences >= 3) risk += 0.8;
  else if (keyAbsences === 2) risk += 0.5;
  else if (keyAbsences === 1) risk += 0.25;

  if (squadAbsences > 4) risk += 0.2;
  if (reliability < 0.6) risk += 0.3;
  if (!lineupConfirmed) risk += 0.18;

  return {
    availability_risk: Math.min(risk, 1),
    meta: {
      keyAbsences,
      squadAbsences,
      reliability,
      lineup_confirmed: lineupConfirmed,
      expected_lineups_count: expectedLineups.length,
      confirmed_lineups_count: confirmedLineups.length
    }
  };
}
module.exports = getAvailabilitySignal;
