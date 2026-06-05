'use strict';

const coreVerificationController = require('../core/verificationController');

async function verify(context = {}) {
    const snapshot = {
        ...coreVerificationController.getSnapshot(),
        verificationContext: context && typeof context === 'object' ? context : null
    };

    if (context && typeof context === 'object') {
        if (context.pipelineStatus || context.enrichmentStatus || context.quotaStatus || context.apiHealth || context.dbHealth) {
            return coreVerificationController.evaluate(context);
        }
        if (context.signal) {
            return coreVerificationController.evaluate({
                pipelineStatus: context.signal
            });
        }
    }

    return snapshot;
}

module.exports = {
    verificationController: {
        verify,
        getSnapshot: () => coreVerificationController.getSnapshot(),
        getHistory: () => coreVerificationController.getHistory(),
        enforce: (evaluationState) => coreVerificationController.enforce(evaluationState)
    }
};
