module.exports = {
    football: {
        hasDraw: true,
        baseHomeAdvantage: 2.5,
        weatherImpactsGame: true
    },
    basketball: {
        hasDraw: false,
        baseHomeAdvantage: 4.0, // Higher home court advantage
        weatherImpactsGame: false // Played indoors
    },
    tennis: {
        hasDraw: false,
        baseHomeAdvantage: 0.0,
        weatherImpactsGame: true // Wind affects serve/lob
    },
    nfl: {
        hasDraw: true, // Ties exist but are rare
        baseHomeAdvantage: 3.0,
        weatherImpactsGame: true
    }
    // We will expand this as we activate the other sports
};
