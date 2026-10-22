/**
 * LATIF JavaScript SDK
 */

export class LatifClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'http://localhost:8080';
    this.apiKey = options.apiKey;
    this.timeout = options.timeout || 30000;
  }

  async chat(messages, model) {
    return this.request('/api/chat', { messages, model });
  }

  async *chatStream(messages, model) {
    const response = await fetch(`${this.baseURL}/api/chat/stream`, {
      method: 'POST',
      body: JSON.stringify({ messages, model })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            yield JSON.parse(line.slice(6));
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async request(path, body) {
    const response = await fetch(`${this.baseURL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }
}

export default LatifClient;
