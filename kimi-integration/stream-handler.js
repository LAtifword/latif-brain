/**
 * StreamHandler - Manages streaming responses with buffering and formatting
 */
export class StreamHandler {
    constructor(options = {}) {
        this.buffer = '';
        this.onToken = options.onToken || (() => {});
        this.onToolCall = options.onToolCall || (() => {});
        this.onDone = options.onDone || (() => {});
        this.onError = options.onError || (() => {});
        this.onMeta = options.onMeta || (() => {});
    }

    /**
     * Process a stream from KimiAdapter
     */
    async process(stream) {
        try {
            for await (const chunk of stream) {
                switch (chunk.type) {
                    case 'meta':
                        this.onMeta(chunk);
                        break;
                    case 'token':
                        this.buffer += chunk.content;
                        this.onToken(chunk.content, this.buffer);
                        break;
                    case 'tool_call':
                        this.onToolCall(chunk.data);
                        break;
                    case 'done':
                        this.onDone(this.buffer);
                        return this.buffer;
                    case 'error':
                        this.onError(chunk.error);
                        throw new Error(chunk.error);
                }
            }
            return this.buffer;
        } catch (error) {
            this.onError(error.message);
            throw error;
        }
    }

    /**
     * Create a simple streaming chat function
     */
    static async streamChat(adapter, messages, options = {}) {
        const tokens = [];

        const handler = new StreamHandler({
            onToken: (token) => {
                tokens.push(token);
                if (options.onToken) options.onToken(token);
                if (!options.silent) process.stdout.write(token);
            },
            onMeta: (meta) => {
                if (options.onMeta) options.onMeta(meta);
            },
            onToolCall: (data) => {
                if (options.onToolCall) options.onToolCall(data);
            },
            onDone: (fullText) => {
                if (options.onDone) options.onDone(fullText);
            },
            onError: (error) => {
                if (options.onError) options.onError(error);
            }
        });

        const stream = adapter.streamChat(messages, options);
        return handler.process(stream);
    }
}

export default StreamHandler;
