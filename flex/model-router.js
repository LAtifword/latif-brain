import OpenAI from 'openai';

const DEFAULT_SYSTEM = `You are LATIF Flex, a practical personal AI agent. Be concise, accurate, and action-oriented. Prefer local context and avoid unnecessary model calls. If a request needs a tool, explain the missing capability instead of pretending it was executed. Never reveal API keys or internal configuration.`;

function providerFromEnv(prefix, fallback = {}) {
  return {
    name: process.env[`${prefix}_NAME`] || fallback.name || prefix.toLowerCase(),
    apiKey: process.env[`${prefix}_API_KEY`],
    baseURL: process.env[`${prefix}_BASE_URL`],
    model: process.env[`${prefix}_MODEL`],
  };
}

export function loadProviders() {
  return {
    cheap: providerFromEnv('FLEX_CHEAP', { name: 'cheap' }),
    primary: providerFromEnv('FLEX_PRIMARY', { name: 'primary' }),
    local: providerFromEnv('FLEX_LOCAL', { name: 'local' }),
  };
}

export function classifyTask(text = '') {
  const normalized = text.toLowerCase();
  const long = text.length > 3500;
  const complex = /\b(debug|architect|architecture|security|legal|medical|financial|deploy|production|research|analy[sz]e|compare|refactor|multi[- ]step|deep|reason|خطة|حلل|قارن|برمج|أمن|بحث)\b/i.test(normalized);
  const simple = /\b(hello|hi|summari[sz]e|rewrite|translate|extract|list|format|تلخيص|ترجم|لخص|نسق)\b/i.test(normalized);
  if (complex || long) return 'primary';
  if (simple || text.length < 600) return 'cheap';
  return 'primary';
}

function clientFor(provider) {
  if (!provider.apiKey || !provider.model) {
    throw new Error(`Provider ${provider.name} is not configured. Set FLEX_*_API_KEY and FLEX_*_MODEL.`);
  }
  return new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL || undefined });
}

export async function complete({ messages, mode = 'auto', providers = loadProviders(), temperature = 0.2 }) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const route = mode === 'auto' ? classifyTask(lastUser) : mode;
  const provider = providers[route] || providers.cheap;
  const client = clientFor(provider);
  const response = await client.chat.completions.create({
    model: provider.model,
    temperature,
    messages: [{ role: 'system', content: DEFAULT_SYSTEM }, ...messages],
  });
  return {
    text: response.choices?.[0]?.message?.content || '',
    route,
    provider: provider.name,
    model: provider.model,
    usage: response.usage || null,
  };
}

export function publicProviderStatus(providers = loadProviders()) {
  return Object.fromEntries(Object.entries(providers).map(([key, value]) => [key, {
    name: value.name,
    model: value.model || null,
    baseURL: value.baseURL || null,
    configured: Boolean(value.apiKey && value.model),
  }]));
}
