export const SAMPLE_MESSAGES = [
  { role: 'user', content: 'Hello', timestamp: 1000 },
  { role: 'assistant', content: 'Hi there!', timestamp: 1100 }
];

export const SAMPLE_MODELS = [
  { name: 'qwen2.5:1.5b', contextWindow: 4096 },
  { name: 'llama2:7b', contextWindow: 4096 }
];

export const SAMPLE_KNOWLEDGE_GRAPH = {
  nodes: [
    { id: 'ai', type: 'concept', label: 'Artificial Intelligence' },
    { id: 'ml', type: 'concept', label: 'Machine Learning' }
  ],
  edges: [
    { source: 'ai', target: 'ml', type: 'includes' }
  ]
};
