'use strict';

const crypto = require('node:crypto');

function normalizeCredential(value) {
    return String(value || '').trim();
}

function constantTimeEqual(left, right) {
    const a = Buffer.from(normalizeCredential(left), 'utf8');
    const b = Buffer.from(normalizeCredential(right), 'utf8');

    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
        return false;
    }

    return crypto.timingSafeEqual(a, b);
}

function readCredentialHeader(req, headerNames) {
    for (const name of headerNames) {
        const value = normalizeCredential(req?.headers?.[name]);
        if (value) return value;
    }
    return '';
}

function createSecretMiddleware({
    environmentVariable,
    headerNames,
    credentialClass,
    missingHeaderMessage
}) {
    return (req, res, next) => {
        const expected = normalizeCredential(process.env[environmentVariable]);
        if (!expected) {
            console.error(
                `[AUTH] ${credentialClass} rejected: ${environmentVariable} is not configured.`
            );
            return res.status(503).json({
                error: `${credentialClass} authentication is not configured`
            });
        }

        const provided = readCredentialHeader(req, headerNames);
        if (!provided) {
            return res.status(401).json({
                error: missingHeaderMessage
            });
        }

        if (!constantTimeEqual(provided, expected)) {
            return res.status(403).json({
                error: `Invalid ${credentialClass.toLowerCase()} credential`
            });
        }

        req.authContext = Object.freeze({
            credentialClass,
            authenticated: true
        });

        return next();
    };
}

const requireAdminKey = createSecretMiddleware({
    environmentVariable: 'ADMIN_API_KEY',
    headerNames: ['x-admin-key', 'x-api-key'],
    credentialClass: 'Admin',
    missingHeaderMessage: 'Missing admin credential'
});

const requireSchedulerSecret = createSecretMiddleware({
    environmentVariable: 'CRON_SECRET',
    headerNames: ['x-cron-secret'],
    credentialClass: 'Scheduler',
    missingHeaderMessage: 'Missing x-cron-secret header'
});

function requireRole(role) {
    if (role === 'admin') {
        return requireAdminKey;
    }

    if (role === 'user') {
        return (req, res, next) => {
            if (!req.user?.id) {
                return res.status(401).json({
                    error: 'Validated subscriber identity required'
                });
            }
            return next();
        };
    }

    throw new TypeError(`Unsupported role: ${role}`);
}

module.exports = {
    constantTimeEqual,
    requireAdminKey,
    requireRole,
    requireSchedulerSecret
};
