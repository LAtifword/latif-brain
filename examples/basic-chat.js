/**
 * LATIF Basic Chat Example
 * Simple example showing how to use LATIF API for chat
 */

const LATIF = require('@latif/sdk');

async function main() {
  // Initialize LATIF
  const latif = new LATIF.Client({
    apiKey: process.env.LATIF_API_KEY,
    baseURL: 'http://localhost:8080'
  });

  // Simple chat
  console.log('=== LATIF Basic Chat Example ===\n');

  const messages = [
    { role: 'user', content: 'What is machine learning?' }
  ];

  console.log('Sending message...');
  const response = await latif.chat.send({
    messages,
    model: 'qwen2.5:1.5b',
    params: { temperature: 0.7 }
  });

  console.log('Response received:\n');
  console.log(response.content);
  console.log(`\nTokens used: ${response.tokens.total}`);

  // Multi-turn conversation
  console.log('\n=== Multi-turn Conversation ===\n');

  const conversation = [
    { role: 'user', content: 'What is AI?' },
    { role: 'assistant', content: 'AI is artificial intelligence...' },
    { role: 'user', content: 'Can you explain neural networks?' }
  ];

  const response2 = await latif.chat.send({
    messages: conversation,
    model: 'qwen2.5:1.5b'
  });

  console.log('Assistant:', response2.content);

  // Streaming response
  console.log('\n=== Streaming Response ===\n');

  const stream = await latif.chat.stream({
    messages: [{ role: 'user', content: 'Write a short poem about AI' }],
    model: 'qwen2.5:1.5b'
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.content);
    }
  }
  console.log('\n');
}

main().catch(console.error);
