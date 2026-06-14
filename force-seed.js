require('dotenv').config({ path: require('path').resolve(__dirname, 'backend', '.env') });
const { runBootstrap } = require('./backend/dbBootstrap');

async function forceSeed() {
    console.log('Forcing DB Bootstrap seed...');
    try {
        await runBootstrap();
        console.log('✅ Seed complete.');
    } catch (e) {
        console.error('❌ Seed failed:', e);
    }
    process.exit(0);
}
forceSeed();
