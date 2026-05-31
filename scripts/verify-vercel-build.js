'use strict';

/**
 * Local preflight for Vercel: install (ignore native scripts) + build.
 */

const { execSync } = require('child_process');

function run(cmd) {
    console.log(`\n> ${cmd}\n`);
    execSync(cmd, { stdio: 'inherit', env: process.env });
}

try {
    run('npm install --ignore-scripts');
    run('npm run build');
    console.log('\n[verify-vercel-build] OK — matches vercel.json install + build\n');
} catch (err) {
    console.error('\n[verify-vercel-build] FAILED\n');
    process.exit(1);
}
