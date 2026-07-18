export function createMockContext() {
  return {
    models: [],
    memory: new Map(),
    tools: new Map()
  };
}

export function createMockMessage(content) {
  return {
    role: 'user',
    content,
    timestamp: Date.now()
  };
}

export async function waitFor(condition, timeout = 1000) {
  const start = Date.now();
  while (!condition() && Date.now() - start < timeout) {
    await new Promise(r => setTimeout(r, 10));
  }
  if (!condition()) throw new Error('Timeout waiting for condition');
}
