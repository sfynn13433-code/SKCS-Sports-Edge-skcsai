'use strict';

const LEGACY_PUBLIC_USER_KEY = 'skcs_user_12345';

function parseKeyList(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function getAllowedUserKeys() {
    const keys = new Set();
    parseKeyList(process.env.USER_API_KEY).forEach((key) => keys.add(key));
    parseKeyList(process.env.USER_API_KEYS).forEach((key) => keys.add(key));

    const allowLegacy = String(process.env.ALLOW_LEGACY_USER_KEY || 'true').toLowerCase() !== 'false';
    if (allowLegacy) {
        keys.add(LEGACY_PUBLIC_USER_KEY);
    }

    return keys;
}

// We pull from process.env INSIDE the function to ensure we get the latest Render values
function requireRole(role) {
    return (req, res, next) => {
        const requestPath = req.originalUrl || req.path || '';
        if (requestPath.startsWith('/api/cron/') || requestPath.startsWith('/cron/')) {
            return next();
        }

        const key = req.headers['x-api-key'];

        // Get fresh values from environment
        const adminKey = process.env.ADMIN_API_KEY;
        const allowedUserKeys = getAllowedUserKeys();

        if (!key) {
            console.error(`[AUTH] Blocked: No x-api-key header provided.`);
            return res.status(401).json({ error: 'Missing API key' });
        }

        if (role === 'admin') {
            // Check if admin key exists in Env AND matches
            if (!adminKey || key !== adminKey) {
                console.error(`[AUTH] Admin Denied. Expected: ${adminKey ? 'Set' : 'MISSING IN RENDER'}`);
                return res.status(403).json({ error: 'Admin access required' });
            }
        }

        if (role === 'user') {
            // Users can be validated by user key OR admin key
            const isValidUser = allowedUserKeys.has(key) || (key === adminKey);
            if (!isValidUser) {
                console.error(`[AUTH] User Denied.`);
                return res.status(403).json({ error: 'User access required' });
            }
        }

        next();
    };
}

module.exports = {
    requireRole
};
