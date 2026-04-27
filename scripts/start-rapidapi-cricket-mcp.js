const { spawn } = require('child_process');

const key = process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY;

if (!key) {
    console.error('Missing RAPIDAPI_KEY or X_RAPIDAPI_KEY');
    process.exit(1);
}

const child = spawn(
    'npx',
    [
        'mcp-remote',
        'https://mcp.rapidapi.com',
        '--header',
        'x-api-host: cricketapi3.p.rapidapi.com',
        '--header',
        `x-api-key:${key}`
    ],
    {
        stdio: 'inherit',
        shell: process.platform === 'win32'
    }
);

child.on('exit', (code) => process.exit(code ?? 0));