/**
 * Example Plugin for LATIF-NI
 * Place in: kimi-integration/plugins/my-plugin/index.js
 */

export default {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'Example plugin demonstrating the plugin system',
    author: 'Mohamed Latif',

    // Tool schemas (OpenAI format)
    tools: [
        {
            type: 'function',
            function: {
                name: 'greet',
                description: 'Greet someone by name',
                parameters: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: { type: 'string', description: 'Person to greet' },
                        language: { type: 'string', description: 'Language: en or ar' }
                    }
                }
            }
        }
    ],

    // Tool implementations
    handlers: {
        greet: async ({ name, language = 'en' }) => {
            const greetings = {
                en: `Hello, ${name}! Welcome to LATIF-NI.`,
                ar: `مرحباً، ${name}! أهلاً بك في لطيف-ني.`
            };
            return { greeting: greetings[language] || greetings.en };
        }
    },

    // Lifecycle hooks
    hooks: {
        preChat: async (context) => {
            console.log(`[${this.name}] Pre-chat hook:`, context);
        },
        postChat: async (context) => {
            console.log(`[${this.name}] Post-chat hook:`, context);
        }
    }
};
