/**
 * ToolCaller - Handles tool calling with validation, execution, and error recovery
 * Compatible with Kimi K2 / OpenAI function calling format
 */
export class ToolCaller {
    constructor(toolMap = {}) {
        this.toolMap = toolMap;
        this.executionLog = [];
        this.maxIterations = 10;
    }

    /**
     * Register a tool implementation
     */
    register(name, handler) {
        this.toolMap[name] = handler;
    }

    /**
     * Register multiple tools
     */
    registerAll(tools) {
        Object.assign(this.toolMap, tools);
    }

    /**
     * Execute a single tool call
     */
    async execute(toolCall) {
        const name = toolCall.function?.name || toolCall.name;
        let args;

        try {
            args = JSON.parse(toolCall.function?.arguments || toolCall.arguments || '{}');
        } catch {
            args = {};
        }

        const entry = {
            id: toolCall.id || `tool_${Date.now()}`,
            name,
            args,
            startTime: Date.now(),
            result: null,
            error: null
        };

        try {
            const handler = this.toolMap[name];
            if (!handler) {
                throw new Error(`Tool "${name}" not registered`);
            }

            entry.result = await handler(args);
            entry.success = true;
        } catch (error) {
            entry.error = error.message;
            entry.success = false;
            entry.result = { error: error.message };
        }

        entry.endTime = Date.now();
        entry.duration = entry.endTime - entry.startTime;
        this.executionLog.push(entry);

        return entry;
    }

    /**
     * Execute multiple tool calls in parallel
     */
    async executeAll(toolCalls) {
        const promises = toolCalls.map(tc => this.execute(tc));
        return Promise.all(promises);
    }

    /**
     * Build tool result messages for conversation
     */
    buildToolMessages(toolCalls, results) {
        const messages = [];

        // Add assistant's tool_calls message
        messages.push({
            role: 'assistant',
            content: null,
            tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: {
                    name: tc.function?.name || tc.name,
                    arguments: tc.function?.arguments || JSON.stringify(tc.arguments || {})
                }
            }))
        });

        // Add tool results
        for (const result of results) {
            messages.push({
                role: 'tool',
                tool_call_id: result.id,
                name: result.name,
                content: JSON.stringify(result.result)
            });
        }

        return messages;
    }

    /**
     * Run full tool-calling loop (Kimi K2 style)
     */
    async runLoop(adapter, messages, tools, options = {}) {
        const conversation = [...messages];
        let iterations = 0;
        const maxIterations = options.maxIterations || this.maxIterations;

        while (iterations < maxIterations) {
            iterations++;

            const response = await adapter.chat(conversation, {
                ...options,
                tools,
                tool_choice: 'auto'
            });

            const choice = response.choices[0];

            if (choice.finish_reason !== 'tool_calls') {
                return {
                    finalResponse: response,
                    conversation,
                    iterations,
                    toolCalls: this.executionLog
                };
            }

            // Execute tools
            const toolCalls = choice.message.tool_calls;
            const results = await this.executeAll(toolCalls);

            // Add to conversation
            conversation.push(choice.message);
            const toolMessages = this.buildToolMessages(toolCalls, results);
            conversation.push(...toolMessages);
        }

        // Max iterations reached
        const finalResponse = await adapter.chat(conversation, options);
        return {
            finalResponse,
            conversation,
            iterations,
            toolCalls: this.executionLog,
            maxIterationsReached: true
        };
    }

    getLog() {
        return this.executionLog;
    }

    clearLog() {
        this.executionLog = [];
    }
}

export default ToolCaller;
