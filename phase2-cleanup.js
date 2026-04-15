const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const ARCHIVE_DIR = path.join(ROOT_DIR, '_archive');

// Define specific archive subdirectories
const dirs = {
    images: path.join(ARCHIVE_DIR, 'root_images'),
    backend: path.join(ARCHIVE_DIR, 'backend_legacy'),
    public: path.join(ARCHIVE_DIR, 'public_legacy'),
    sql: path.join(ARCHIVE_DIR, 'sql_legacy'),
    docs: path.join(ARCHIVE_DIR, 'docs_legacy')
};

// Ensure archive directories exist
Object.values(dirs).forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function safeMove(source, destination) {
    if (fs.existsSync(source)) {
        fs.renameSync(source, destination);
        console.log(`✅ Moved: ${path.basename(source)} -> ${path.basename(path.dirname(destination))}/`);
    } else {
        console.log(`⚠️ Skipped: ${path.basename(source)} (File not found)`);
    }
}

console.log('\n--- 🔴 HIGH PRIORITY CLEANUP ---');

// 1. Duplicate Images (Root)
const rootImages = [
    'about-bg.jpg', 'hero-page.jpg', 'language.jpg', 'login.jpg', 'windrawwin.jpg',
    'about-bg.webp', 'hero-page.webp'
];
rootImages.forEach(img => {
    // Only move if it actually exists in public/ to be safe
    if (fs.existsSync(path.join(ROOT_DIR, 'public', img))) {
        safeMove(path.join(ROOT_DIR, img), path.join(dirs.images, img));
    }
});

// 2. Misplaced SQL / Legacy Public
safeMove(path.join(ROOT_DIR, 'sql', 'index.html'), path.join(dirs.sql, 'index.html'));
safeMove(path.join(ROOT_DIR, 'public', 'language-switch.html'), path.join(dirs.public, 'language-switch.html'));

// 3. Backend Duplicates - BE CAREFUL with these
// Check if they're actually duplicates or have different content
const serverExpressPath = path.join(ROOT_DIR, 'backend', 'server-express.js');
const serverPath = path.join(ROOT_DIR, 'backend', 'server.js');
const dbPath = path.join(ROOT_DIR, 'backend', 'db.js');
const databasePath = path.join(ROOT_DIR, 'backend', 'database.js');
const configBackendPath = path.join(ROOT_DIR, 'backend', 'config.js');

if (fs.existsSync(serverExpressPath) && fs.existsSync(serverPath)) {
    const expressSize = fs.statSync(serverExpressPath).size;
    const serverSize = fs.statSync(serverPath).size;
    if (expressSize === serverSize) {
        safeMove(serverPath, path.join(dirs.backend, 'server.js'));
    } else {
        console.log(`⚠️ server.js differs from server-express.js - keeping both for now`);
    }
}

if (fs.existsSync(databasePath) && fs.existsSync(dbPath)) {
    const dbSize = fs.existsSync(databasePath) ? fs.statSync(databasePath).size : 0;
    const dbFileSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    if (dbSize === dbFileSize) {
        safeMove(dbPath, path.join(dirs.backend, 'db.js'));
    } else {
        console.log(`⚠️ db.js differs from database.js - keeping both for now`);
    }
}

// Check config.js before moving
if (fs.existsSync(configBackendPath)) {
    const configSrc = path.join(ROOT_DIR, 'backend', 'config');
    if (fs.existsSync(configSrc)) {
        console.log(`⚠️ backend/config/ directory exists - keeping backend/config.js for reference`);
    } else {
        safeMove(configBackendPath, path.join(dirs.backend, 'config.js'));
    }
}

console.log('\n--- 🟡 MEDIUM PRIORITY CLEANUP ---');

// 4. Consolidate Documentation
const legacyDocs = [
    'DEBUG_REPORT.md', 'DEPLOYMENT_READY.md', 'DEPLOYMENT_STATUS.md', 
    'FIXES_APPLIED.md', 'FIXES_VERIFICATION_REPORT.md', 'FRONTEND_CORS_OPTIMIZATION.md', 
    'INGESTION_STATUS_REPORT.md', 'URGENT_DEPLOY_GUIDE.md', 'URGENT_RENDER_FIX.md', 
    'RENDER_DEPLOY_INSTRUCTIONS.md', 'ENV_SETUP_GUIDE.md', 'API_SETUP.md'
];

legacyDocs.forEach(doc => {
    safeMove(path.join(ROOT_DIR, doc), path.join(dirs.docs, doc));
});

// Move specific nested docs
safeMove(path.join(ROOT_DIR, 'docs', 'CheckoutNotice.tsx'), path.join(dirs.docs, 'CheckoutNotice.tsx'));
safeMove(path.join(ROOT_DIR, 'docs', 'cloud-run-job-deployment.md'), path.join(dirs.docs, 'cloud-run-job-deployment.md'));
safeMove(path.join(ROOT_DIR, 'docs', 'google-cloud-soccer-refresh.md'), path.join(dirs.docs, 'google-cloud-soccer-refresh.md'));
safeMove(path.join(ROOT_DIR, 'docs', 'service-account-region-setup.md'), path.join(dirs.docs, 'service-account-region-setup.md'));

// 5. Handle backend scripts .env carefully
const backendEnvPath = path.join(ROOT_DIR, 'backend', 'scripts', '.env');
const rootEnvPath = path.join(ROOT_DIR, '.env');

if (fs.existsSync(backendEnvPath)) {
    if (!fs.existsSync(rootEnvPath)) {
        // Safe to just move it
        safeMove(backendEnvPath, rootEnvPath);
        console.log(`✅ Moved: backend/scripts/.env -> Root .env`);
    } else {
        // Don't overwrite the existing root .env
        safeMove(backendEnvPath, path.join(ARCHIVE_DIR, '.env.backend_scripts_backup'));
        console.log(`⚠️ Note: Root .env already exists. Moved backend/scripts/.env to archive as backup.`);
    }
}

console.log('\n🎉 Phase 2 Quarantine Complete.');
