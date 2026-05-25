/**
 * \ud83d\udea8 CRITICAL RATE LIMIT WARNING \ud83d\udea8
 * API-Sports Subscription Limit: 100 Requests / Day.
 * INTERNAL HARD CAP: 90 Requests / Day (Safety Buffer Active).
 * DO NOT fetch directly from the frontend.
 */

require('dotenv').config();

const apiSportsUrls = {
    football: 'https://v3.football.api-sports.io',
    basketball: 'https://v1.basketball.api-sports.io',
    rugby: 'https://v1.rugby.api-sports.io',
    baseball: 'https://v1.baseball.api-sports.io',
    hockey: 'https://v1.hockey.api-sports.io',
    afl: 'https://v1.afl.api-sports.io',
    formula1: 'https://v1.formula-1.api-sports.io',
    mma: 'https://v1.mma.api-sports.io',
    volleyball: 'https://v1.volleyball.api-sports.io',
    handball: 'https://v1.handball.api-sports.io',
    american_football: 'https://v1.american-football.api-sports.io',
    tennis: 'https://v1.tennis.api-sports.io',
    cricket: 'https://v1.cricket.api-sports.io'
    // Extend with additional sport endpoints as needed
};

module.exports = {
    // The strict internal safety limit
    DAILY_HARD_CAP: 90,

    apiSportsHeaders: {
        'x-apisports-key': process.env.X_APISPORTS_KEY,
        'x-apisports-host': ''
    },

    apiSportsUrls
};
