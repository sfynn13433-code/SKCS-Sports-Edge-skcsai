const fetch = require('node-fetch');

async function checkLeague(id) {
    const url = `https://v3.football.api-sports.io/leagues?id=${id}`;
    const res = await fetch(url, {
        headers: { 'x-apisports-key': 'SUMMER_SKCSAI_738913' } // Need real key but any will give auth error, let's see. Wait, API Sports is suspended due to quota.
    });
    console.log(await res.text());
}
checkLeague(15);
