function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (key === 'true' || key === 'yes' || key === '1') return true;
    if (key === 'false' || key === 'no' || key === '0') return false;
  }
  return fallback;
}

function moralePenalty(morale) {
  if (morale === null || morale === undefined) return 0;
  const n = Number(morale);
  if (Number.isFinite(n)) {
    const normalized = n > 1 ? Math.max(0, Math.min(1, n / 100)) : Math.max(0, Math.min(1, n));
    return Math.max(0, 0.35 - (normalized * 0.35));
  }
  const key = String(morale).toLowerCase();
  if (key.includes('poor') || key.includes('low')) return 0.32;
  if (key.includes('high') || key.includes('excellent')) return 0.05;
  return 0.15;
}

function getStabilitySignal(teamContextOrMorale, coachConflictArg, boardInstabilityArg, incidentsArg) {
  const legacyShape = teamContextOrMorale && typeof teamContextOrMorale === 'object' && !Array.isArray(teamContextOrMorale)
    && (
      Object.prototype.hasOwnProperty.call(teamContextOrMorale, 'coachConflict')
      || Object.prototype.hasOwnProperty.call(teamContextOrMorale, 'execInstability')
      || Object.prototype.hasOwnProperty.call(teamContextOrMorale, 'playerLegalIssues')
      || Object.prototype.hasOwnProperty.call(teamContextOrMorale, 'fanViolence')
    );

  const coachConflict = legacyShape
    ? toBoolean(teamContextOrMorale.coachConflict, false)
    : toBoolean(coachConflictArg, false);
  const execInstability = legacyShape
    ? toBoolean(teamContextOrMorale.execInstability, false)
    : toBoolean(boardInstabilityArg, false);
  const playerLegalIssues = legacyShape
    ? toArray(teamContextOrMorale.playerLegalIssues)
    : toArray(incidentsArg);
  const fanViolence = legacyShape
    ? toBoolean(teamContextOrMorale.fanViolence, false)
    : false;
  const morale = legacyShape
    ? teamContextOrMorale.morale
    : teamContextOrMorale;

  let risk = 0;
  if (coachConflict) risk += 0.4;
  if (execInstability) risk += 0.3;
  if (playerLegalIssues.length > 0) risk += 0.3;
  if (fanViolence) risk += 0.5;
  risk += moralePenalty(morale);

  return {
    stability_risk: Math.min(risk, 1),
    meta: {
      coachConflict,
      execInstability,
      playerLegalIssues,
      fanViolence,
      morale
    }
  };
}
module.exports = getStabilitySignal;
