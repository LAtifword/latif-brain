/**
 * Inference Parameters - Kimi K2.6 recommended settings
 * Source: https://github.com/MoonshotAI/Kimi-K2
 */
export const INFERENCE_PARAMS = {
    /**
     * Kimi K2.6 recommended defaults
     */
    kimiK2: {
        temperature: 0.6,
        maxTokens: 4096,
        topP: 0.9,
        topK: null,
        repetitionPenalty: 1.0,
        stopSequences: [],
        // Kimi K2.6 specific
        thinking: { type: 'disabled' }, // Enable for reasoning mode
    },

    /**
     * Local model defaults (Ollama/Qwen)
     */
    local: {
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.9,
        topK: 40,
        repetitionPenalty: 1.1,
        stopSequences: []
    },

    /**
     * Creative mode
     */
    creative: {
        temperature: 0.9,
        maxTokens: 4096,
        topP: 0.95,
        topK: 50,
        repetitionPenalty: 1.0
    },

    /**
     * Precise/accurate mode
     */
    precise: {
        temperature: 0.3,
        maxTokens: 2048,
        topP: 0.5,
        topK: 20,
        repetitionPenalty: 1.2
    },

    /**
     * Coding mode
     */
    coding: {
        temperature: 0.4,
        maxTokens: 4096,
        topP: 0.8,
        topK: 30,
        repetitionPenalty: 1.1,
        stopSequences: ['```']
    },

    /**
     * Agent mode (tool use)
     */
    agent: {
        temperature: 0.5,
        maxTokens: 2048,
        topP: 0.85,
        topK: 40,
        repetitionPenalty: 1.0
    }
};

/**
 * Get params by preset name
 */
export function getParams(preset = 'kimiK2') {
    return INFERENCE_PARAMS[preset] || INFERENCE_PARAMS.kimiK2;
}

/**
 * Merge custom options with preset
 */
export function mergeParams(preset, custom = {}) {
    return { ...getParams(preset), ...custom };
}

export default INFERENCE_PARAMS;
