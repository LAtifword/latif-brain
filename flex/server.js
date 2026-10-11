import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { complete, loadProviders, publicProviderStatus } from './model-router.js';
import { MemoryStore } from './memory.js';
import { syncToLatifCloud } from './cloud-sync.js';

const app = express();
const port = Number(process.env.FLEX_PORT || 3100);
const host = process.env.FLEX_HOST || '127.0.0.1';
const memory = new MemoryStore();
const providers = loadProviders();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FLEX_CORS_ORIGIN || '*'}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(new URL('./public', import.meta.url).pathname));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'LATIF Model Flex', version: '1.0.0', uptime: process.uptime() }));
app.get('/api/providers', (_req, res) => res.json(publicProviderStatus(providers)));
app.get('/api/memory/stats', (_req, res) => res.json(memory.stats()));
app.get('/api/memory/search', (req, res) => res.json({ results: memory.search(req.query.q || '') }));

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], mode = 'auto', remember = true } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message is required' });
    const context = memory.search(message).map((item) => `Memory: ${item.text}`).join('\n');
    const messages = [...history.slice(-12), ...(context ? [{ role: 'system', content: context }] : []), { role: 'user', content: message }];
    const result = await complete({ messages, mode, providers });
    const record = { text: message, answer: result.text, route: result.route, model: result.model };
    if (remember) {
      await memory.add(record);
      try { await syncToLatifCloud(record); } catch (error) { record.cloudSyncError = error.message; }
    }
    res.json({ ...result, memory: memory.stats() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

await memory.init();
app.listen(port, host, () => console.log(`LATIF Model Flex listening on ${host}:${port}`));
