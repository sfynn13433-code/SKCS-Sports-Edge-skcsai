// Adapter registry for dynamic loading
const footballAdapter = require('./footballAdapter');
const f1Adapter = require('./f1Adapter');
const tennisAdapter = require('./tennisAdapter');

// Placeholder adapters for other sports (to be implemented)
const basketballAdapter = {
  async fetchFixtures(startDate, endDate) {
    throw new Error('Basketball adapter not yet implemented');
  }
};

const cricketAdapter = {
  async fetchFixtures(startDate, endDate) {
    throw new Error('Cricket adapter not yet implemented');
  }
};

const rugbyAdapter = {
  async fetchFixtures(startDate, endDate) {
    throw new Error('Rugby adapter not yet implemented');
  }
};

const golfAdapter = {
  async fetchFixtures(startDate, endDate) {
    throw new Error('Golf adapter not yet implemented');
  }
};

const boxingAdapter = {
  async fetchFixtures(startDate, endDate) {
    throw new Error('Boxing adapter not yet implemented');
  }
};

const mmaAdapter = {
  async fetchFixtures(startDate, endDate) {
    throw new Error('MMA adapter not yet implemented');
  }
};

const baseballAdapter = {
  async fetchFixtures(startDate, endDate) {
    throw new Error('Baseball adapter not yet implemented');
  }
};

const americanFootballAdapter = {
  async fetchFixtures(startDate, endDate) {
    throw new Error('American Football adapter not yet implemented');
  }
};

const hockeyAdapter = {
  async fetchFixtures(startDate, endDate) {
    throw new Error('Hockey adapter not yet implemented');
  }
};

const horseRacingAdapter = {
  async fetchFixtures(startDate, endDate) {
    throw new Error('Horse Racing adapter not yet implemented');
  }
};

const dartsAdapter = {
  async fetchFixtures(startDate, endDate) {
    throw new Error('Darts adapter not yet implemented');
  }
};

const volleyballAdapter = {
  async fetchFixtures(startDate, endDate) {
    throw new Error('Volleyball adapter not yet implemented');
  }
};

// Adapter registry
const adapters = {
  footballAdapter,
  f1Adapter,
  tennisAdapter,
  basketballAdapter,
  cricketAdapter,
  rugbyAdapter,
  golfAdapter,
  boxingAdapter,
  mmaAdapter,
  baseballAdapter,
  americanFootballAdapter,
  hockeyAdapter,
  horseRacingAdapter,
  dartsAdapter,
  volleyballAdapter
};

function loadAdapter(adapterName) {
  const adapter = adapters[adapterName];
  if (!adapter) {
    throw new Error(`Adapter ${adapterName} not found`);
  }
  return adapter;
}

module.exports = {
  loadAdapter,
  adapters
};
