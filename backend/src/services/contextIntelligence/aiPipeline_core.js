const getWeatherSignal = require('./weatherSignal');
const getAvailabilitySignal = require('./availabilitySignal');
const getDisciplineSignal = require('./disciplineSignal');
const getStabilitySignal = require('./stabilitySignal');

async function enrichFixtureWithContext(fixture) {
  const weather = await getWeatherSignal(fixture.location, fixture.kickoffTime);
  const availability = getAvailabilitySignal(fixture.teamData);
  const discipline = getDisciplineSignal(fixture.teamDiscipline);
  const stability = getStabilitySignal(fixture.teamContext);
  return {
    ...fixture,
    contextSignals: { ...weather, ...availability, ...discipline, ...stability },
    context_status: 'enriched'
  };
}
module.exports = enrichFixtureWithContext;
