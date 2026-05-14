const fetch = require('node-fetch');
const config = require('../backend/config');

async function checkFrenchLeague() {
  try {
    console.log('Checking French Ligue 1 fixtures...\n');
    
    const THESPORTSDB_BASE_URL = `https://www.thesportsdb.com/api/v1/json/${config.theSportsDbKey || '3'}`;
    
    // Check May 17 fixtures
    const url = `${THESPORTSDB_BASE_URL}/eventsday.php?d=2026-05-17`;
    console.log('Fetching:', url);
    
    const response = await fetch(url);
    const text = await response.text();
    
    if (!response.ok) {
      console.log('API error:', response.status, text);
      return;
    }
    
    const data = JSON.parse(text);
    const events = data.events || data.event || [];
    console.log(`Total events for May 17: ${events.length}\n`);
    
    // Look for French matches
    const frenchMatches = events.filter(event => 
      event.strLeague && (
        event.strLeague.toLowerCase().includes('ligue 1') ||
        event.strLeague.toLowerCase().includes('france') ||
        event.strLeague.toLowerCase().includes('french')
      )
    );
    
    console.log(`French matches found: ${frenchMatches.length}`);
    frenchMatches.forEach(match => {
      console.log(`- ${match.strHomeTeam} vs ${match.strAwayTeam} (${match.strLeague})`);
      console.log(`  ID: ${match.idEvent}, Time: ${match.strTime}`);
    });
    
    // Also look for Lorient or Havre specifically
    const targetMatches = events.filter(event => 
      (event.strHomeTeam && event.strHomeTeam.toLowerCase().includes('lorient')) ||
      (event.strAwayTeam && event.strAwayTeam.toLowerCase().includes('lorient')) ||
      (event.strHomeTeam && event.strHomeTeam.toLowerCase().includes('havre')) ||
      (event.strAwayTeam && event.strAwayTeam.toLowerCase().includes('havre'))
    );
    
    console.log(`\nTarget matches (Lorient/Havre): ${targetMatches.length}`);
    targetMatches.forEach(match => {
      console.log(`- ${match.strHomeTeam} vs ${match.strAwayTeam} (${match.strLeague})`);
      console.log(`  ID: ${match.idEvent}, Date: ${match.dateEvent}, Time: ${match.strTime}`);
    });
    
    if (targetMatches.length === 0) {
      console.log('\n❌ FC Lorient vs Le Havre AC not found in TheSportsDB for May 17');
      console.log('This match might not be available in TheSportsDB free tier');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkFrenchLeague();
