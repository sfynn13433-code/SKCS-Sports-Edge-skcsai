'use strict';

/**
 * Install versioned git hooks into .git/hooks (local machine only).
 * Does not modify git config and does not use GitHub Actions.
 *
 * Run once per clone: npm run install:hooks
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, '.githooks');
const TARGET_DIR = path.join(ROOT, '.git', 'hooks');

function main() {
    if (!fs.existsSync(SOURCE_DIR)) {
        console.error('[install:hooks] Missing .githooks directory.');
        process.exit(1);
    }

    if (!fs.existsSync(TARGET_DIR)) {
        console.error('[install:hooks] .git/hooks not found. Run this inside a git repository.');
        process.exit(1);
    }

    const hookFiles = fs.readdirSync(SOURCE_DIR).filter((name) => {
        const src = path.join(SOURCE_DIR, name);
        return fs.statSync(src).isFile();
    });

    if (hookFiles.length === 0) {
        console.error('[install:hooks] No hook files found in .githooks/.');
        process.exit(1);
    }

    for (const name of hookFiles) {
        const src = path.join(SOURCE_DIR, name);
        const dest = path.join(TARGET_DIR, name);
        fs.copyFileSync(src, dest);
        if (process.platform !== 'win32') {
            fs.chmodSync(dest, 0o755);
        }
        console.log(`[install:hooks] Installed ${name}`);
    }

    console.log('');
    console.log('Local git hooks installed.');
    console.log('- Runs only on this computer');
    console.log('- No GitHub Actions billing');
    console.log('- Checks rule-related staged files before commit');
}

if (require.main === module) {
    main();
}
