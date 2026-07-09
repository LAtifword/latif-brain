/* ════════════════════════════════════════════════════════════════
   LATIF AI — AI CORE (state, persistence, RAG, tool calling, backend)
   ════════════════════════════════════════════════════════════════
   LATIF GX V3 — extracted from app.js as the first step of the V3
   "modular, maintainable" architecture goal: this file owns the app's
   data model and everything that talks to a model backend. app.js
   owns DOM rendering/wiring and reads/writes the SAME `State` object
   (declared here as a top-level — not IIFE-wrapped — binding, so it
   lives in the shared global lexical scope every classic <script> on
   this page can see; app.js's own IIFE resolves `State` via that
   outer scope exactly as it did when the object lived inline).

   Load this file BEFORE app.js.
   ════════════════════════════════════════════════════════════════ */
"use strict";

/* ───────── STATE ───────── */
const State = {
  host: localStorage.getItem("latif_host") || "127.0.0.1",
  port: localStorage.getItem("latif_port") || "11434",
  model: localStorage.getItem("latif_model") || "",
  models: [],
  systemPrompt: localStorage.getItem("latif_system") ||
    "You are LATIF AI (لطيف للذكاء الاصطناعي), a helpful, precise local AI assistant created by Latif Mohamed. " +
    "Respond in the user's language (Arabic or English). Be concise, accurate, and well-formatted using markdown. " +
    "When a request is incomplete, ambiguous, or contains typos, do NOT just ask the user to clarify — first make " +
    "your best-effort interpretation using the conversation so far and any stored memory, answer that interpretation, " +
    "and briefly state the assumption you made so the user can correct it in one reply. Only ask a direct clarifying " +
    "question when two or more interpretations are genuinely equally likely and getting it wrong would waste the " +
    "user's time; in that case offer the specific options rather than a generic \"please clarify\".",
  temperature: parseFloat(localStorage.getItem("latif_temp") || "0.7"),
  topP: parseFloat(localStorage.getItem("latif_topp") || "0.9"),
  numCtx: parseInt(localStorage.getItem("latif_ctx") || "4096"),
  numPredict: parseInt(localStorage.getItem("latif_predict") || "512"),
  keepAlive: localStorage.getItem("latif_keepalive") || "30m",
  perfMode: localStorage.getItem("latif_perf") || "balanced",
  voiceLang: localStorage.getItem("latif_voicelang") || "auto",
  autoSpeak: localStorage.getItem("latif_autospeak") === "true",
  stream: localStorage.getItem("latif_stream") !== "false",
  theme: localStorage.getItem("latif_theme") || "dark",
  chats: JSON.parse(localStorage.getItem("latif_chats") || "{}"),
  activeChat: null,
  attachments: [],
  isGenerating: false,
  abortCtrl: null,

  /* ── V3: auto-detection, offline caching ── */
  serverAvailable: false,
  lastKnownWorkingServer: localStorage.getItem("latif_last_working_server") || null,
  serverCheckInProgress: false,
  serverCheckTimestamp: 0,

  /* ── V3: RAG, tools, memory ── */
  embedModel: localStorage.getItem("latif_embed_model") || "nomic-embed-text",
  ragEnabled: localStorage.getItem("latif_rag") !== "false",
  toolsEnabled: localStorage.getItem("latif_tools") === "true",
  jsonMode: localStorage.getItem("latif_jsonmode") === "true",
  memory: JSON.parse(localStorage.getItem("latif_memory") || "[]"),
};

function baseUrl() {
  return `http://${State.host}:${State.port}`;
}

function saveState() {
  localStorage.setItem("latif_host", State.host);
  localStorage.setItem("latif_port", State.port);
  localStorage.setItem("latif_model", State.model);
  localStorage.setItem("latif_system", State.systemPrompt);
  localStorage.setItem("latif_temp", String(State.temperature));
  localStorage.setItem("latif_topp", String(State.topP));
  localStorage.setItem("latif_ctx", String(State.numCtx));
  localStorage.setItem("latif_predict", String(State.numPredict));
  localStorage.setItem("latif_keepalive", State.keepAlive);
  localStorage.setItem("latif_perf", State.perfMode);
  localStorage.setItem("latif_voicelang", State.voiceLang);
  localStorage.setItem("latif_autospeak", String(State.autoSpeak));
  localStorage.setItem("latif_stream", String(State.stream));
  localStorage.setItem("latif_theme", State.theme);
  localStorage.setItem("latif_embed_model", State.embedModel);
  localStorage.setItem("latif_rag", String(State.ragEnabled));
  localStorage.setItem("latif_tools", String(State.toolsEnabled));
  localStorage.setItem("latif_jsonmode", String(State.jsonMode));
  localStorage.setItem("latif_last_working_server", State.lastKnownWorkingServer || "");
  localStorage.setItem("latif_memory", JSON.stringify(State.memory));
}

function saveChats() {
  localStorage.setItem("latif_chats", JSON.stringify(State.chats));
}

/* ───────── RAG (retrieval over attached files) ───────── */
function ragChunkText(text) {
  const size = 700, overlap = 100, cap = 30;
  const chunks = [];
  let i = 0;
  while (i < text.length && chunks.length < cap) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}

async function ollamaEmbed(text) {
  try {
    const res = await fetch(`${baseUrl()}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: State.embedModel, prompt: text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.embedding || null;
  } catch (_) {
    return null;
  }
}

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return -1;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function ragIndexFile(chat, name, content) {
  if (!State.ragEnabled) return;
  const chunks = ragChunkText(content);
  chat.rag = chat.rag || [];
  for (const c of chunks) {
    const vec = await ollamaEmbed(c);
    if (!vec) break; // embedding model unavailable — fall back to the raw file dump already in the message
    chat.rag.push({ text: c, vec, source: name });
  }
  saveChats();
}

async function ragContextFor(chat, query) {
  if (!chat.rag || !chat.rag.length) return null;
  const qvec = await ollamaEmbed(query);
  if (!qvec) return null;
  const scored = chat.rag
    .map((c) => ({ ...c, score: cosineSim(qvec, c.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!scored.length || scored[0].score < 0) return null;
  return scored.map((s) => `[from ${s.source}]\n${s.text}`).join("\n---\n");
}

/* ───────── tool calling (Ollama backend only) ───────── */
const TOOLS = [
  { type: "function", function: { name: "get_current_time", description: "Get the current date and time on the user's device.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "calculate", description: "Evaluate a basic arithmetic expression (+ - * / parentheses, no variables).", parameters: { type: "object", properties: { expression: { type: "string", description: "e.g. (12+8)*3/4" } }, required: ["expression"] } } },
  { type: "function", function: { name: "system_stats", description: "Get live CPU/RAM/battery stats from the device's Termux monitor backend.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "memory_search", description: "Search LATIF's stored long-term memory facts about the user.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
];

function safeEvalExpr(expression) {
  // Minimal recursive-descent arithmetic parser (+ - * / parentheses) — no eval().
  const s = String(expression).replace(/\s+/g, "");
  let i = 0;
  const peek = () => s[i];
  function number() {
    const start = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    if (start === i) throw new Error("bad expression");
    return parseFloat(s.slice(start, i));
  }
  function factor() {
    if (peek() === "(") { i++; const v = expr(); if (peek() !== ")") throw new Error("bad expression"); i++; return v; }
    if (peek() === "-") { i++; return -factor(); }
    return number();
  }
  function term() {
    let v = factor();
    while (peek() === "*" || peek() === "/") { const op = s[i++]; const r = factor(); v = op === "*" ? v * r : v / r; }
    return v;
  }
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") { const op = s[i++]; const r = term(); v = op === "+" ? v + r : v - r; }
    return v;
  }
  const result = expr();
  if (i !== s.length) throw new Error("bad expression");
  return result;
}

async function executeTool(name, args) {
  try {
    switch (name) {
      case "get_current_time": return new Date().toString();
      case "calculate": return String(safeEvalExpr(args.expression || ""));
      case "system_stats": {
        const url = localStorage.getItem("latif_monitor_url") || "http://127.0.0.1:8000";
        const res = await fetch(url.replace(/\/$/, "") + "/stats");
        return JSON.stringify(await res.json());
      }
      case "memory_search": {
        const q = (args.query || "").toLowerCase();
        const hits = (State.memory || []).filter((m) => m.toLowerCase().includes(q));
        return hits.length ? hits.join("; ") : "No matching memory found.";
      }
      default: return "Unknown tool: " + name;
    }
  } catch (e) {
    return "Tool error: " + e.message;
  }
}

/* ───────── Ollama request builder ───────── */
function buildRequestBody(model, msgs, extra) {
  const body = {
    model, messages: msgs, stream: State.stream, keep_alive: State.keepAlive,
    options: { temperature: State.temperature, top_p: State.topP, num_ctx: State.numCtx, num_predict: State.numPredict },
  };
  if (State.jsonMode) body.format = "json";
  if (extra) Object.assign(body, extra);
  return body;
}

/* ───────── Network resilience: retry with exponential backoff ───────── */
async function fetchWithRetry(url, options, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
      if (res.ok) return res;
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
      return res;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

/* ───────── V3: intelligent server auto-detection with fallback chain ───────── */
async function probeServer(host, port) {
  try {
    const res = await fetch(`http://${host}:${port}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

async function autoDetectServer() {
  State.serverCheckInProgress = true;
  const now = Date.now();
  State.serverCheckTimestamp = now;

  const fallbackChain = [
    { host: State.host, port: State.port, name: "configured" },
    { host: "127.0.0.1", port: "11434", name: "127.0.0.1:11434" },
    { host: "localhost", port: "11434", name: "localhost:11434" },
  ];

  if (State.lastKnownWorkingServer) {
    const [host, port] = State.lastKnownWorkingServer.split(":");
    fallbackChain.push({ host, port, name: `last known (${State.lastKnownWorkingServer})` });
  }

  for (const candidate of fallbackChain) {
    if (await probeServer(candidate.host, candidate.port)) {
      State.serverAvailable = true;
      State.host = candidate.host;
      State.port = candidate.port;
      State.lastKnownWorkingServer = `${candidate.host}:${candidate.port}`;
      saveState();
      State.serverCheckInProgress = false;
      return true;
    }
  }

  State.serverAvailable = false;
  State.serverCheckInProgress = false;
  return false;
}

/* ───────── Network resilience: detect Wi-Fi changes ───────── */
window.addEventListener("online", async () => {
  console.log("[LATIF] Network online — re-checking Ollama server");
  const found = await autoDetectServer();
  if (found && window.fetchModels) {
    window.fetchModels();
  }
});

window.addEventListener("offline", () => {
  console.log("[LATIF] Network offline — switching to cache mode");
  State.serverAvailable = false;
  if (window.setServerStatus) {
    window.setServerStatus(false);
  }
});

/* ───────── V3: premium feature gating stub ─────────
   No monetization business rules exist yet (pricing, what's gated, trial
   logic) — this is intentionally a pass-through stub so future gating can
   be wired in at real call sites without guessing a pricing model now. */
function isPremiumUnlocked(_featureId) {
  return true;
}
