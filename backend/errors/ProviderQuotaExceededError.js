'use strict';

class ProviderQuotaExceededError extends Error {
    constructor(provider, sport, message) {
        super(message || `Provider quota exceeded: ${provider}`);
        this.name = 'ProviderQuotaExceededError';
        this.provider = provider || 'unknown';
        this.sport = sport || 'unknown';
        this.code = 'provider_quota_exceeded';
    }
}

module.exports = ProviderQuotaExceededError;
