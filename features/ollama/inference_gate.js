const { usesChatGpt } = require('../openai/routing');
const DISABLED_MESSAGE = 'General LLM inference is disabled to keep GPU capacity available. Tweet/X translation rendering remains enabled.';

class LlmInferenceDisabledError extends Error {
    constructor(message = DISABLED_MESSAGE) {
        super(message);
        this.name = 'LlmInferenceDisabledError';
        this.code = 'LLM_INFERENCE_DISABLED';
    }
}

function isGeneralLlmInferenceEnabled(task) {
    return usesChatGpt(task) || process.env.GENERAL_LLM_INFERENCE_ENABLED === 'true';
}

function assertGeneralLlmInferenceEnabled(task) {
    if (!isGeneralLlmInferenceEnabled(task)) {
        throw new LlmInferenceDisabledError();
    }
}

function getDisabledReply() {
    return 'General LLM features are disabled right now so the GPUs stay free. Tweet/X translation rendering is still available.';
}

module.exports = {
    DISABLED_MESSAGE,
    LlmInferenceDisabledError,
    assertGeneralLlmInferenceEnabled,
    getDisabledReply,
    isGeneralLlmInferenceEnabled,
};
