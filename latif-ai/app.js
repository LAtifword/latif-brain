/* ════════════════════════════════════════════════════════════════
   LATIF AI — Local Edition
   100% on-device via Ollama. No API keys, no cloud.
   ════════════════════════════════════════════════════════════════ */

(function () {
"use strict";

/* State, persistence, RAG, tool calling, and backend abstraction now live
   in js/ai-core.js (loaded before this file) as part of LATIF GX V3's
   modular architecture — `State`, `baseUrl()`, `saveState()`, `saveChats()`,
   `getEndpoint()`, `buildRequestBody()`, `TOOLS`, `executeTool()`, etc. are
   all defined there and resolved here via the shared global scope. */

const PERF_PRESETS = {
  fast:     { ctx: 2048, predict: 256,  temp: 0.6, hint: "Fast: 2K context, up to 256 tokens. Best responsiveness on this device." },
  balanced: { ctx: 4096, predict: 512,  temp: 0.7, hint: "Balanced: 4K context, up to 512 tokens per reply. Good mix of speed and depth on this device." },
  quality:  { ctx: 8192, predict: 1024, temp: 0.8, hint: "Quality: 8K context, up to 1024 tokens. Noticeably slower on CPU — best for shorter, careful tasks." },
};
function applyPerfPreset(name, persist = true) {
  const p = PERF_PRESETS[name];
  if (!p) return;
  State.perfMode = name;
  State.numCtx = p.ctx;
  State.numPredict = p.predict;
  State.temperature = p.temp;
  if (persist) saveState();
}

function vibrate(ms) {
  if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (_) {} }
}

/* ───────── DOM REFS ───────── */
const $ = (id) => document.getElementById(id);
const chatScroll = $("chatScroll");
const messagesEl = $("messages");
const welcomeScreen = $("welcomeScreen");
const promptInput = $("promptInput");
const btnSend = $("btnSend");
const btnStop = $("btnStop");
const toastEl = $("toast");

/* ───────── TOAST ───────── */
let toastTimer;
function toast(msg, ms = 2200) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
}

/* ───────── THEME ───────── */
function applyTheme() {
  document.documentElement.setAttribute("data-theme", State.theme);
  document.querySelectorAll(".seg-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.theme === State.theme)
  );
}

/* ───────── MARKDOWN RENDER ───────── */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
let codeBlockCounter = 0;
function renderMarkdown(raw) {
  let text = raw;
  const codeBlocks = [];
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const id = "cb" + (++codeBlockCounter);
    const label = lang || "text";
    codeBlocks.push(
      `<div class="code-bar"><span>${escapeHtml(label)}</span><button class="code-copy-btn" data-code-id="${id}"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>Copy</button></div>` +
      `<code id="${id}" class="lang-${label}">${escapeHtml(code.trim())}</code>`
    );
    return `\u0000CODE${idx}\u0000`;
  });
  text = escapeHtml(text);
  // tables (simple GFM-style)
  text = text.replace(/((?:^\|.*\|\s*$\n?)+)/gm, (block) => {
    const lines = block.trim().split("\n").filter((l) => l.trim());
    if (lines.length < 2 || !/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(lines[1])) return block;
    const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const head = cells(lines[0]);
    const rows = lines.slice(2).map(cells);
    let html = "<table><thead><tr>" + head.map((h) => `<th>${h}</th>`).join("") + "</tr></thead><tbody>";
    rows.forEach((r) => { html += "<tr>" + r.map((c) => `<td>${c}</td>`).join("") + "</tr>"; });
    html += "</tbody></table>";
    return html;
  });
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  text = text.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  text = text.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  text = text.replace(/^&gt; ?(.+)$/gm, "<blockquote>$1</blockquote>");
  text = text.replace(/(<blockquote>[\s\S]*?<\/blockquote>\n?)+/g, (m) =>
    m.replace(/<\/blockquote>\n?<blockquote>/g, "<br/>"));
  text = text.replace(/^(---|\*\*\*|___)$/gm, "<hr/>");
  text = text.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  text = text.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  text = text.replace(/^\d+\.\s(.+)$/gm, "<li>$1</li>");
  text = text.replace(/\n\n/g, "<br/><br/>");
  text = text.replace(/\n/g, "<br/>");
  text = text.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => `<pre>${codeBlocks[i]}</pre>`);
  return text;
}
function bindCodeCopyButtons(scope) {
  scope.querySelectorAll(".code-copy-btn").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const codeEl = document.getElementById(btn.dataset.codeId);
      if (!codeEl) return;
      navigator.clipboard.writeText(codeEl.textContent).then(() => {
        btn.classList.add("copied");
        const original = btn.innerHTML;
        btn.innerHTML = "✓ Copied";
        setTimeout(() => { btn.classList.remove("copied"); btn.innerHTML = original; }, 1400);
      });
    });
  });
}
function isArabic(str) {
  return /[\u0600-\u06FF]/.test(str);
}

/* ───────── CHAT MODEL ───────── */
function newChatId() {
  return "c" + Date.now() + Math.random().toString(36).slice(2, 7);
}
function createChat() {
  const id = newChatId();
  State.chats[id] = {
    id, title: "New chat", messages: [], pinned: false, createdAt: Date.now(),
  };
  State.activeChat = id;
  saveChats();
  return id;
}
function getChat() {
  if (!State.activeChat || !State.chats[State.activeChat]) {
    createChat();
  }
  return State.chats[State.activeChat];
}
function deleteChat(id) {
  delete State.chats[id];
  saveChats();
  if (State.activeChat === id) {
    State.activeChat = null;
    renderWelcome();
  }
  renderHistory();
}

/* ───────── RENDER MESSAGES ───────── */
function renderWelcome() {
  messagesEl.innerHTML = "";
  welcomeScreen.style.display = "flex";
}
function renderChat(id) {
  const chat = State.chats[id];
  if (!chat) return;
  State.activeChat = id;
  messagesEl.innerHTML = "";
  if (chat.messages.length === 0) {
    welcomeScreen.style.display = "flex";
  } else {
    welcomeScreen.style.display = "none";
    chat.messages.forEach((m) => appendMessageDOM(m.role, m.content, m.images, false));
  }
  renderHistory();
  closeDrawer();
  scrollToBottom();
}
function scrollToBottom() {
  requestAnimationFrame(() => { chatScroll.scrollTop = chatScroll.scrollHeight; });
}

function appendMessageDOM(role, content, images, animate = true) {
  welcomeScreen.style.display = "none";
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;

  if (role === "ai") {
    const avRow = document.createElement("div");
    avRow.className = "ai-avatar-row";
    avRow.innerHTML = `<div class="ai-avatar">L</div><div class="ai-name">LATIF AI</div>`;
    row.appendChild(avRow);
  }

  if (images && images.length) {
    const thumbRow = document.createElement("div");
    thumbRow.className = "attached-thumb-row";
    images.forEach((src) => {
      const img = document.createElement("img");
      img.className = "attached-thumb";
      img.src = src.startsWith("data:") ? src : `data:image/png;base64,${src}`;
      thumbRow.appendChild(img);
    });
    row.appendChild(thumbRow);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (isArabic(content)) bubble.setAttribute("dir", "rtl");
  bubble.innerHTML = renderMarkdown(content);
  bindCodeCopyButtons(bubble);
  row.appendChild(bubble);

  if (role === "ai") {
    const actions = document.createElement("div");
    actions.className = "msg-actions";
    actions.innerHTML = `
      <button class="maction" data-act="like" title="Good response"><svg viewBox="0 0 24 24"><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zm3 9h8.5a2 2 0 0 0 2-1.6l1.2-6A2 2 0 0 0 19.7 10H14l.9-4.5A1.8 1.8 0 0 0 13.2 3a1.6 1.6 0 0 0-1.4.8L8 10v10z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg></button>
      <button class="maction" data-act="dislike" title="Bad response"><svg viewBox="0 0 24 24"><path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1zm-3-9H5.5a2 2 0 0 0-2 1.6l-1.2 6A2 2 0 0 0 4.3 14H10l-.9 4.5A1.8 1.8 0 0 0 10.8 21a1.6 1.6 0 0 0 1.4-.8L16 14V4z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg></button>
      <button class="maction" data-act="regen" title="Regenerate"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M21 3v6h-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <button class="maction" data-act="copy" title="Copy"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="1.8" fill="none"/></svg></button>
      <button class="maction" data-act="speak" title="Read aloud"><svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><path d="M19 8a6 6 0 0 1 0 8M16 10.5a2.5 2.5 0 0 1 0 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg></button>
    `;
    row.appendChild(actions);

    actions.addEventListener("click", (e) => {
      const btn = e.target.closest(".maction");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "copy") {
        navigator.clipboard.writeText(content).then(() => toast("Copied to clipboard"));
        btn.classList.add("spin");
        setTimeout(() => btn.classList.remove("spin"), 600);
      } else if (act === "like") {
        btn.classList.toggle("active-like");
        row.querySelector('[data-act="dislike"]').classList.remove("active-dislike");
      } else if (act === "dislike") {
        btn.classList.toggle("active-dislike");
        row.querySelector('[data-act="like"]').classList.remove("active-like");
      } else if (act === "regen") {
        regenerateLast();
      } else if (act === "speak") {
        speakText(content);
      }
    });
  }

  messagesEl.appendChild(row);
  if (animate) scrollToBottom();
  return { row, bubble };
}

let currentUtterance = null;
function pickVoiceFor(lang) {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (!voices.length) return null;
  const want = lang.startsWith("ar") ? "ar" : "en";
  return voices.find((v) => v.lang.toLowerCase().startsWith(want)) || null;
}
function speakText(text, opts = {}) {
  if (!("speechSynthesis" in window)) { toast("Speech not supported"); return; }
  window.speechSynthesis.cancel();
  const clean = text.replace(/[*#`_~|]/g, "").replace(/<[^>]+>/g, "");
  if (!clean.trim()) { if (opts.onend) opts.onend(); return; }
  const lang = opts.lang || (isArabic(clean) ? "ar-SA" : "en-US");
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = lang;
  utter.rate = opts.rate || 1;
  const v = pickVoiceFor(lang);
  if (v) utter.voice = v;
  if (opts.onstart) utter.onstart = opts.onstart;
  if (opts.onend) utter.onend = opts.onend;
  utter.onerror = () => { if (opts.onend) opts.onend(); };
  currentUtterance = utter;
  window.speechSynthesis.speak(utter);
}
function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/* ───────── HISTORY (SIDEBAR) ───────── */
function renderHistory(filter = "") {
  const list = $("historyList");
  list.innerHTML = "";
  const chats = Object.values(State.chats)
    .filter((c) => c.messages.length > 0)
    .filter((c) => !filter || c.title.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));

  if (chats.length === 0) {
    list.innerHTML = `<div class="history-empty">No conversations yet</div>`;
    return;
  }
  chats.forEach((c) => {
    const item = document.createElement("button");
    item.className = "history-item" + (c.id === State.activeChat ? " active" : "");
    item.innerHTML = `${c.pinned ? '<span class="h-pin">📌</span>' : ""}<span class="h-title">${escapeHtml(c.title)}</span>`;
    item.addEventListener("click", () => renderChat(c.id));
    item.addEventListener("contextmenu", (e) => { e.preventDefault(); openMsgMenuFor(c.id); });
    let pressTimer;
    item.addEventListener("touchstart", () => { pressTimer = setTimeout(() => openMsgMenuFor(c.id), 500); });
    item.addEventListener("touchend", () => clearTimeout(pressTimer));
    list.appendChild(item);
  });
}

let msgMenuTargetId = null;
function openMsgMenuFor(id) {
  msgMenuTargetId = id;
  $("msgMenu").classList.add("open");
}

/* ───────── OLLAMA API ───────── */
async function fetchModels() {
  try {
    const res = await fetch(`${baseUrl()}/api/tags`, { method: "GET" });
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    State.models = data.models || [];
    setServerStatus(true);
    populateModelLists();
    if (!State.model && State.models.length) {
      State.model = State.models[0].name;
      saveState();
    }
    updateModelLabel();
    return true;
  } catch (e) {
    setServerStatus(false);
    $("modelList").innerHTML = `<div class="dd-empty">⚠ Cannot reach Ollama at ${baseUrl()}.<br/>Check Connection &amp; Settings.</div>`;
    $("currentModelLabel").textContent = "offline";
    return false;
  }
}

function setServerStatus(online) {
  const dot = $("serverDot");
  dot.classList.toggle("online", online);
  dot.classList.toggle("offline", !online);
  $("serverPillText").textContent = `${State.host}:${State.port}`;
}

function populateModelLists() {
  const list = $("modelList");
  const select = $("settingsModelSelect");
  if (!State.models.length) {
    list.innerHTML = `<div class="dd-empty">No models found. Run <code>ollama pull gemma2</code> on your server.</div>`;
    select.innerHTML = `<option>No models found</option>`;
    return;
  }
  list.innerHTML = "";
  select.innerHTML = "";
  const chat = State.activeChat ? State.chats[State.activeChat] : null;
  const pinEl = $("modelPinChat");
  const activeModel = (pinEl && pinEl.checked && chat && chat.model) || State.model;
  State.models.forEach((m) => {
    const sizeGB = (m.size / 1e9).toFixed(1);
    const item = document.createElement("button");
    item.className = "dd-model-item" + (m.name === activeModel ? " active" : "");
    item.innerHTML = `<div class="dd-model-icon">${m.name[0].toUpperCase()}</div>
      <div class="dd-model-meta"><div class="dd-model-name">${m.name}</div><div class="dd-model-size">${sizeGB} GB</div></div>
      ${m.name === activeModel ? '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ""}`;
    item.addEventListener("click", () => {
      if (pinEl && pinEl.checked && chat) {
        chat.model = m.name;
        saveChats();
        toast(`${m.name} pinned to this chat`);
      } else {
        State.model = m.name;
        saveState();
        toast(`Switched to ${m.name}`);
      }
      updateModelLabel();
      populateModelLists();
      closeDropdowns();
    });
    list.appendChild(item);

    const opt = document.createElement("option");
    opt.value = m.name;
    opt.textContent = `${m.name} (${sizeGB} GB)`;
    if (m.name === State.model) opt.selected = true;
    select.appendChild(opt);
  });
}

function updateModelLabel() {
  const chat = State.activeChat ? State.chats[State.activeChat] : null;
  const shown = (chat && chat.model) || State.model;
  $("currentModelLabel").textContent = shown ? shown.split(":")[0] + (chat && chat.model ? " 📌" : "") : "no model";
}

/* ───────── SEND MESSAGE / STREAM ───────── */
async function sendMessage(voiceOpts, overrideText) {
  const text = (overrideText !== undefined ? overrideText : promptInput.value).trim();
  if (!text && State.attachments.length === 0) return;
  if (State.isGenerating) return;
  if (!State.model) { toast("No model selected — open settings"); return; }

  const chat = getChat();
  const images = State.attachments.filter((a) => a.type === "image").map((a) => a.base64);
  const fileAttachments = State.attachments.filter((a) => a.type === "file");
  const fileText = fileAttachments
    .map((a) => `\n\n[Attached file: ${a.name}]\n${a.content}`)
    .join("");

  const fullText = text + fileText;
  chat.messages.push({ role: "user", content: fullText, images: images.length ? images : undefined, queryText: text });
  if (chat.title === "New chat") {
    chat.title = text.slice(0, 48) || "Image conversation";
  }
  saveChats();
  renderHistory();

  appendMessageDOM("user", fullText, images.length ? images : null);
  if (overrideText === undefined) { promptInput.value = ""; autoGrow(); }
  clearAttachments();
  updateSendBtn();

  // Index newly-attached files for retrieval (RAG) before asking the model —
  // silently no-ops if RAG is off, backend isn't Ollama, or no embedding model is pulled.
  if (fileAttachments.length) {
    await Promise.all(fileAttachments.map((a) => ragIndexFile(chat, a.name, a.content)));
  }

  await streamResponse(chat, voiceOpts);
}

async function regenerateLast() {
  const chat = getChat();
  if (State.isGenerating) return;
  // remove the last AI message if present
  const last = chat.messages[chat.messages.length - 1];
  if (last && last.role === "assistant") {
    chat.messages.pop();
    saveChats();
    renderChat(chat.id);
  }
  await streamResponse(chat);
}

async function streamResponse(chat, voiceOpts) {
  State.isGenerating = true;
  toggleSendStop(true);

  const { row, bubble } = appendMessageDOM("ai", "", null, true);
  bubble.innerHTML = `<div class="typing-row"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;

  let systemContent = State.systemPrompt;
  if (State.memory && State.memory.length) {
    systemContent += "\n\nLong-term memory about the user (use only if relevant):\n- " + State.memory.join("\n- ");
  }
  const msgs = [{ role: "system", content: systemContent }];
  chat.messages.forEach((m) => {
    const entry = { role: m.role === "user" ? "user" : "assistant", content: m.content };
    if (m.images && m.images.length) entry.images = m.images;
    msgs.push(entry);
  });

  // RAG: swap the latest user turn's content for a retrieval-augmented version.
  if (State.ragEnabled && chat.rag && chat.rag.length) {
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === "user") { lastUserIdx = i; break; } }
    if (lastUserIdx >= 0) {
      const lastChatMsg = [...chat.messages].reverse().find((m) => m.role === "user");
      const query = (lastChatMsg && lastChatMsg.queryText) || msgs[lastUserIdx].content;
      const ctx = await ragContextFor(chat, query);
      if (ctx) msgs[lastUserIdx] = { ...msgs[lastUserIdx], content: `${query}\n\n[Relevant context retrieved from attached files]\n${ctx}` };
    }
  }

  const model = chat.model || State.model;
  State.abortCtrl = new AbortController();
  let acc = "";
  let firstChunk = true;
  let pendingFrame = null;
  function scheduleRender() {
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null;
      bubble.setAttribute("dir", isArabic(acc) ? "rtl" : "ltr");
      bubble.innerHTML = renderMarkdown(acc);
      scrollToBottom();
    });
  }

  try {
    // Tool calling: opt-in, one non-streaming pre-check round.
    if (State.toolsEnabled) {
      const precheck = await fetch(`${baseUrl()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: State.abortCtrl.signal,
        body: JSON.stringify(buildRequestBody(model, msgs, { stream: false, tools: TOOLS })),
      });
      if (precheck.ok) {
        const data = await precheck.json();
        const toolCalls = data.message && data.message.tool_calls;
        if (toolCalls && toolCalls.length) {
          msgs.push({ role: "assistant", content: data.message.content || "", tool_calls: toolCalls });
          for (const call of toolCalls) {
            const fn = call.function || {};
            let args = {};
            try { args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : (fn.arguments || {}); } catch (_) {}
            const result = await executeTool(fn.name, args);
            msgs.push({ role: "tool", content: String(result) });
          }
        }
      }
    }

    const res = await fetchWithRetry(`${baseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: State.abortCtrl.signal,
      body: JSON.stringify(buildRequestBody(model, msgs)),
    }, 2);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Cache response if non-streaming and successful
    if (!State.stream && res.ok) {
      const resClone = res.clone();
      const data = await resClone.json();
      const responseText = data.message?.content || "";
      OfflineCacheInstance.saveChatResponse(msgs, model, responseText).catch(err => console.warn("Cache save failed:", err));
    }

    if (State.stream && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.message && json.message.content) {
              if (firstChunk) { bubble.innerHTML = ""; firstChunk = false; }
              acc += json.message.content;
              scheduleRender();
            }
            if (json.done) {
              finalizeResponse(chat, acc, row, bubble, voiceOpts);
            }
          } catch (_) { /* partial json, ignore */ }
        }
      }
      if (acc) finalizeResponse(chat, acc, row, bubble, voiceOpts, true);
    } else {
      const data = await res.json();
      acc = data.message?.content || "(no response)";
      bubble.setAttribute("dir", isArabic(acc) ? "rtl" : "ltr");
      bubble.innerHTML = renderMarkdown(acc);
      finalizeResponse(chat, acc, row, bubble, voiceOpts);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      bubble.innerHTML = renderMarkdown(acc || "_Generation stopped._");
      if (acc) finalizeResponse(chat, acc, row, bubble, voiceOpts, true);
      else if (voiceOpts && voiceOpts.onDone) voiceOpts.onDone("");
    } else {
      // Try offline cache fallback
      if (!State.serverAvailable && msgs.length > 1) {
        const lastUserMsg = msgs[msgs.length - 1]?.content || "";
        const cached = await OfflineCacheInstance.searchCache(lastUserMsg, model);

        if (cached && cached.length > 0) {
          const cachedResponse = cached[0].responseText;
          const timestamp = new Date(cached[0].timestamp).toLocaleTimeString();

          const disclamer = `**[📴 OFFLINE MODE]** Showing cached response from ${timestamp} — this may not reflect current context or recent changes.\n\n`;
          acc = disclamer + cachedResponse;

          bubble.setAttribute("dir", isArabic(acc) ? "rtl" : "ltr");
          bubble.innerHTML = renderMarkdown(acc);
          finalizeResponse(chat, acc, row, bubble, voiceOpts);
          toast("Serving from offline cache");
          if (voiceOpts && voiceOpts.onDone) voiceOpts.onDone(acc);
          return;
        }
      }

      // No cache available or server might be online
      bubble.innerHTML = `<span style="color:var(--red)">⚠ Connection error: ${escapeHtml(err.message)}<br/><br/>Make sure your Ollama server is running and reachable at <code>${escapeHtml(baseUrl())}</code>.</span>`;
      toast("Failed to reach local model server");
      if (voiceOpts && voiceOpts.onDone) voiceOpts.onDone("");
    }
  } finally {
    State.isGenerating = false;
    toggleSendStop(false);
  }
}

function finalizeResponse(chat, content, row, bubble, voiceOpts, force) {
  // avoid double push on repeated done:true frames
  if (row.dataset.finalized) return;
  row.dataset.finalized = "1";
  chat.messages.push({ role: "assistant", content });
  saveChats();
  if (bubble) {
    bubble.setAttribute("dir", isArabic(content) ? "rtl" : "ltr");
    bubble.innerHTML = renderMarkdown(content);
    bindCodeCopyButtons(bubble);
  }
  if (voiceOpts && voiceOpts.onDone) {
    voiceOpts.onDone(content);
  } else if (State.autoSpeak) {
    speakText(content);
  }
}

function toggleSendStop(generating) {
  btnSend.style.display = generating ? "none" : "flex";
  btnStop.style.display = generating ? "flex" : "none";
}

$("btnStop").addEventListener("click", () => {
  if (State.abortCtrl) State.abortCtrl.abort();
});

/* ───────── ATTACHMENTS ───────── */
function clearAttachments() {
  State.attachments = [];
  $("attachPreview").innerHTML = "";
}
function renderAttachPreview() {
  const wrap = $("attachPreview");
  wrap.innerHTML = "";
  State.attachments.forEach((a, idx) => {
    const item = document.createElement("div");
    item.className = "attach-preview-item";
    if (a.type === "image") {
      item.innerHTML = `<img src="data:image/png;base64,${a.base64}" /><button class="attach-remove">✕</button>`;
    } else {
      item.innerHTML = `<div class="chip">📄<br/>${escapeHtml(a.name.slice(0, 10))}</div><button class="attach-remove">✕</button>`;
    }
    item.querySelector(".attach-remove").addEventListener("click", () => {
      State.attachments.splice(idx, 1);
      renderAttachPreview();
      updateSendBtn();
    });
    wrap.appendChild(item);
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

$("fileInput").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    if (file.type.startsWith("image/")) {
      const base64 = await readFileAsBase64(file);
      State.attachments.push({ type: "image", base64, name: file.name });
    } else if (file.type.startsWith("audio/")) {
      // V3: multimodal — transcribe an uploaded audio file via the whisper.cpp
      // backend (same endpoint as the live-recording Voice Backend control).
      const whisperUrl = localStorage.getItem("latif_whisper_url") || "http://127.0.0.1:8001";
      toast(`Transcribing ${file.name}…`);
      try {
        const form = new FormData();
        form.append("audio", file, file.name);
        const res = await fetch(whisperUrl.replace(/\/$/, "") + "/transcribe", { method: "POST", body: form });
        if (!res.ok) throw new Error("bad status");
        const data = await res.json();
        const text = (data.text || "").trim();
        if (text) {
          State.attachments.push({ type: "file", content: text.slice(0, 20000), name: `${file.name} (transcript)` });
        } else {
          toast(`No speech detected in ${file.name}`);
        }
      } catch (_) {
        toast(`Couldn't transcribe ${file.name} — is backend/transcribe.py running? (Settings → Voice Backend)`);
      }
    } else {
      try {
        const content = await readFileAsText(file);
        State.attachments.push({ type: "file", content: content.slice(0, 20000), name: file.name });
      } catch {
        toast(`Could not read ${file.name}`);
      }
    }
  }
  renderAttachPreview();
  updateSendBtn();
  closeAttachSheet();
  e.target.value = "";
});

/* ───────── INPUT BEHAVIOR ───────── */
function autoGrow() {
  promptInput.style.height = "auto";
  promptInput.style.height = Math.min(promptInput.scrollHeight, 140) + "px";
}
function updateSendBtn() {
  const has = promptInput.value.trim().length > 0 || State.attachments.length > 0;
  btnSend.disabled = !has;
}
promptInput.addEventListener("input", () => { autoGrow(); updateSendBtn(); });
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
btnSend.addEventListener("click", sendMessage);

/* ───────── VOICE INPUT ───────── */
let recognizing = false;
let recognition = null;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.onresult = (e) => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    promptInput.value = text;
    autoGrow();
    updateSendBtn();
  };
  recognition.onend = () => { recognizing = false; $("btnMic").classList.remove("active-like"); };
}
$("btnMic").addEventListener("click", () => {
  if (!recognition) { toast("Voice input not supported on this browser"); return; }
  if (recognizing) { recognition.stop(); return; }
  try {
    recognition.lang = "ar-SA";
    recognition.start();
    recognizing = true;
    toast("Listening…", 1200);
  } catch (e) { /* already started */ }
});

/* ───────── VOICE CONVERSATION MODE (immersive) ───────── */
const voiceOverlay = $("voiceOverlay");
const orbCore = $("orbCore");
const voiceStatus = $("voiceStatus");
const voiceTranscript = $("voiceTranscript");
const btnVoiceToggle = $("btnVoiceToggle");

const VoiceMode = {
  active: false,
  paused: false,
  vRecognition: null,
  silenceTimer: null,
  interimText: "",
  detectedLang: "ar-SA",
};

function setVoiceState(state, statusText) {
  voiceOverlay.dataset.state = state;
  if (statusText) voiceStatus.textContent = statusText;
}

function buildVoiceRecognition() {
  if (!SpeechRecognition) return null;
  const r = new SpeechRecognition();
  r.continuous = true;
  r.interimResults = true;
  r.lang = State.voiceLang === "auto" ? VoiceMode.detectedLang : State.voiceLang;

  r.onresult = (e) => {
    let interim = "", final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t; else interim += t;
    }
    VoiceMode.interimText = (VoiceMode.interimText + " " + final).trim();
    const shown = (VoiceMode.interimText + " " + interim).trim();
    voiceTranscript.textContent = shown;
    voiceTranscript.setAttribute("dir", isArabic(shown) ? "rtl" : "ltr");
    if (State.voiceLang === "auto" && shown.length > 4) {
      VoiceMode.detectedLang = isArabic(shown) ? "ar-SA" : "en-US";
    }
    clearTimeout(VoiceMode.silenceTimer);
    VoiceMode.silenceTimer = setTimeout(() => {
      if (VoiceMode.interimText.trim()) commitVoiceTranscript();
    }, 1100);
  };
  r.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    setVoiceState("idle", "Tap to speak");
    toast("Voice recognition error: " + e.error);
  };
  r.onend = () => {
    if (VoiceMode.active && !VoiceMode.paused && voiceOverlay.dataset.state === "listening") {
      try { r.start(); } catch (_) {}
    }
  };
  return r;
}

function startVoiceListening() {
  if (!SpeechRecognition) { toast("Voice input not supported on this browser/WebView"); return; }
  if (State.isGenerating) return;
  stopSpeaking();
  VoiceMode.interimText = "";
  voiceTranscript.textContent = "";
  if (!VoiceMode.vRecognition) VoiceMode.vRecognition = buildVoiceRecognition();
  VoiceMode.vRecognition.lang = State.voiceLang === "auto" ? VoiceMode.detectedLang : State.voiceLang;
  try { VoiceMode.vRecognition.start(); } catch (_) {}
  setVoiceState("listening", "Listening…");
  btnVoiceToggle.classList.add("listening");
  vibrate(15);
}

function stopVoiceListening() {
  if (VoiceMode.vRecognition) { try { VoiceMode.vRecognition.stop(); } catch (_) {} }
  clearTimeout(VoiceMode.silenceTimer);
  btnVoiceToggle.classList.remove("listening");
}

function commitVoiceTranscript() {
  const text = VoiceMode.interimText.trim();
  VoiceMode.interimText = "";
  if (!text) return;
  stopVoiceListening();
  setVoiceState("thinking", "Thinking…");
  voiceTranscript.textContent = text;
  sendMessage({ onDone: onVoiceReplyReady }, text);
}

function onVoiceReplyReady(content) {
  if (!VoiceMode.active) return;
  if (!content || !content.trim()) { setVoiceState("idle", "Tap to speak"); return; }
  setVoiceState("speaking", "Speaking…");
  voiceTranscript.textContent = content.replace(/[#*`>]/g, "").slice(0, 220);
  speakText(content, {
    lang: VoiceMode.detectedLang,
    onstart: () => vibrate(10),
    onend: () => {
      if (!VoiceMode.active || VoiceMode.paused) { setVoiceState("idle", "Tap to speak"); return; }
      startVoiceListening();
    },
  });
}

function openVoiceMode() {
  if (!State.model) { toast("No model selected — open settings"); return; }
  VoiceMode.active = true;
  VoiceMode.paused = false;
  voiceOverlay.classList.add("open");
  $("btnVoiceAutoSpeak").classList.toggle("active", true);
  startVoiceListening();
}
function closeVoiceMode() {
  VoiceMode.active = false;
  stopVoiceListening();
  stopSpeaking();
  if (State.abortCtrl && State.isGenerating) State.abortCtrl.abort();
  voiceOverlay.classList.remove("open");
  setVoiceState("idle", "Tap to speak");
}

$("btnVoiceMode").addEventListener("click", openVoiceMode);
$("btnVoiceClose").addEventListener("click", closeVoiceMode);
$("btnVoiceKeyboard").addEventListener("click", closeVoiceMode);

$("btnVoiceToggle").addEventListener("click", () => {
  const state = voiceOverlay.dataset.state;
  if (state === "speaking") { stopSpeaking(); startVoiceListening(); return; }
  if (state === "listening") {
    VoiceMode.paused = true;
    stopVoiceListening();
    setVoiceState("idle", "Tap to speak");
    return;
  }
  VoiceMode.paused = false;
  startVoiceListening();
});

$("voiceLangToggle").addEventListener("click", () => {
  const order = ["auto", "ar-SA", "en-US"];
  const idx = (order.indexOf(State.voiceLang) + 1) % order.length;
  State.voiceLang = order[idx];
  saveState();
  $("voiceLangToggle").textContent = State.voiceLang === "auto" ? "AUTO" : State.voiceLang === "ar-SA" ? "العربية" : "ENGLISH";
  document.querySelectorAll('#voiceLangSeg .seg-btn').forEach((b) => b.classList.toggle("active", b.dataset.lang === State.voiceLang));
  toast("Voice language: " + State.voiceLang);
  if (VoiceMode.active && voiceOverlay.dataset.state === "listening") { stopVoiceListening(); startVoiceListening(); }
});

$("btnVoiceAutoSpeak").addEventListener("click", (e) => {
  State.autoSpeak = !State.autoSpeak;
  saveState();
  e.currentTarget.classList.toggle("active", State.autoSpeak);
  toast(State.autoSpeak ? "Auto-speak on" : "Auto-speak off");
});

setVoiceState("idle", "Tap to speak");

/* ───────── SUGGESTION CHIPS ───────── */
document.querySelectorAll(".suggest-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    promptInput.value = chip.dataset.prompt + " ";
    autoGrow();
    updateSendBtn();
    promptInput.focus();
  });
});

/* ───────── DRAWER ───────── */
const drawer = $("drawer");
const drawerBackdrop = $("drawerBackdrop");
function openDrawer() { drawer.classList.add("open"); drawerBackdrop.classList.add("open"); }
function closeDrawer() { drawer.classList.remove("open"); drawerBackdrop.classList.remove("open"); }
$("btnMenu").addEventListener("click", openDrawer);
$("btnCloseDrawer").addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);

$("drawerNewChat").addEventListener("click", () => {
  createChat();
  renderWelcome();
  renderHistory();
  closeDrawer();
});
$("btnNewChat").addEventListener("click", () => {
  createChat();
  renderWelcome();
  renderHistory();
});
$("searchChats").addEventListener("input", (e) => renderHistory(e.target.value));

/* ───────── DROPDOWNS ───────── */
function closeDropdowns() {
  $("modelDropdown").classList.remove("open");
  $("msgMenu").classList.remove("open");
}
$("modelPicker").addEventListener("click", () => {
  $("msgMenu").classList.remove("open");
  $("modelDropdown").classList.toggle("open");
  fetchModels();
});
$("btnMsgMenu").addEventListener("click", () => {
  $("modelDropdown").classList.remove("open");
  msgMenuTargetId = State.activeChat;
  $("msgMenu").classList.toggle("open");
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#modelDropdown") && !e.target.closest("#modelPicker")) {
    $("modelDropdown").classList.remove("open");
  }
  if (!e.target.closest("#msgMenu") && !e.target.closest("#btnMsgMenu")) {
    $("msgMenu").classList.remove("open");
  }
});
$("btnRefreshModels").addEventListener("click", () => { fetchModels(); toast("Refreshed model list"); });
$("modelPinChat").addEventListener("change", populateModelLists);

/* message menu actions */
$("actDelete").addEventListener("click", () => {
  if (msgMenuTargetId) deleteChat(msgMenuTargetId);
  closeDropdowns();
});
$("actPin").addEventListener("click", () => {
  const c = State.chats[msgMenuTargetId];
  if (c) { c.pinned = !c.pinned; saveChats(); renderHistory(); toast(c.pinned ? "Pinned" : "Unpinned"); }
  closeDropdowns();
});
$("actRename").addEventListener("click", () => {
  const c = State.chats[msgMenuTargetId];
  if (c) {
    const name = prompt("Rename conversation", c.title);
    if (name && name.trim()) { c.title = name.trim(); saveChats(); renderHistory(); }
  }
  closeDropdowns();
});
$("actShare").addEventListener("click", () => {
  const c = State.chats[msgMenuTargetId];
  if (!c) return;
  const text = c.messages.map((m) => `${m.role === "user" ? "You" : "LATIF AI"}: ${m.content}`).join("\n\n");
  if (navigator.share) {
    navigator.share({ title: c.title, text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => toast("Conversation copied to clipboard"));
  }
  closeDropdowns();
});
$("actExport").addEventListener("click", () => {
  const c = State.chats[msgMenuTargetId];
  if (!c) return;
  const text = c.messages.map((m) => `${m.role === "user" ? "You" : "LATIF AI"}: ${m.content}`).join("\n\n");
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${c.title.replace(/[^\w\-]+/g, "_")}.txt`;
  a.click();
  closeDropdowns();
});

/* ───────── ATTACH SHEET ───────── */
const attachSheet = $("attachSheet");
const attachBackdrop = $("attachBackdrop");
function openAttachSheet() { attachSheet.classList.add("open"); attachBackdrop.classList.add("open"); }
function closeAttachSheet() { attachSheet.classList.remove("open"); attachBackdrop.classList.remove("open"); }
$("btnPlus").addEventListener("click", openAttachSheet);
attachBackdrop.addEventListener("click", closeAttachSheet);
$("attachFiles").addEventListener("click", () => { $("fileInput").removeAttribute("capture"); $("fileInput").accept = ".txt,.md,.csv,.json,.pdf,image/*,audio/*"; $("fileInput").click(); });
$("attachImage").addEventListener("click", () => { $("fileInput").removeAttribute("capture"); $("fileInput").accept = "image/*"; $("fileInput").click(); });
$("attachCamera").addEventListener("click", () => { $("fileInput").accept = "image/*"; $("fileInput").setAttribute("capture", "environment"); $("fileInput").click(); });
$("rowSystemPrompt").addEventListener("click", () => { closeAttachSheet(); openSettings(); setTimeout(() => $("systemPromptInput").focus(), 350); });
$("rowParams").addEventListener("click", () => { closeAttachSheet(); openSettings(); });
$("rowClearCtx").addEventListener("click", () => {
  const chat = getChat();
  chat.messages = [];
  chat.title = "New chat";
  saveChats();
  renderChat(chat.id);
  closeAttachSheet();
  toast("Context cleared");
});

/* ───────── SETTINGS MODAL ───────── */
const settingsModal = $("settingsModal");
const settingsBackdrop = $("settingsBackdrop");
function openSettings() {
  $("srvHost").value = State.host;
  $("srvPort").value = State.port;
  $("systemPromptInput").value = State.systemPrompt;
  $("tempSlider").value = State.temperature; $("tempVal").textContent = State.temperature;
  $("ctxSlider").value = State.numCtx; $("ctxVal").textContent = State.numCtx;
  $("topPSlider").value = State.topP; $("topPVal").textContent = State.topP;
  $("predictSlider").value = State.numPredict; $("predictVal").textContent = State.numPredict;
  $("keepAliveSelect").value = State.keepAlive;
  $("streamToggle").checked = State.stream;
  $("autoSpeakToggle").checked = State.autoSpeak;
  document.querySelectorAll("#perfSeg .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.perf === State.perfMode));
  $("perfHint").textContent = (PERF_PRESETS[State.perfMode] || PERF_PRESETS.balanced).hint;
  document.querySelectorAll("#voiceLangSeg .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === State.voiceLang));
  document.querySelectorAll("#backendSeg .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.backend === State.backend));
  $("openaiUrlRow").style.display = State.backend === "openai" ? "flex" : "none";
  $("openaiUrl").value = State.openaiUrl;
  $("ragToggle").checked = State.ragEnabled;
  $("embedModel").value = State.embedModel;
  $("embedModelRow").style.display = State.ragEnabled ? "block" : "none";
  $("toolsToggle").checked = State.toolsEnabled;
  $("jsonModeToggle").checked = State.jsonMode;
  renderMemoryList();
  applyTheme();
  populateModelLists();
  settingsModal.classList.add("open");
  settingsBackdrop.classList.add("open");
  closeDrawer();
}
function closeSettings() {
  settingsModal.classList.remove("open");
  settingsBackdrop.classList.remove("open");
}
$("drawerSettingsTop").addEventListener("click", openSettings);
$("btnUserSettings").addEventListener("click", openSettings);
$("serverPill").addEventListener("click", openSettings);
$("btnCloseSettings").addEventListener("click", closeSettings);
settingsBackdrop.addEventListener("click", closeSettings);

$("btnTestConn").addEventListener("click", async () => {
  State.host = $("srvHost").value.trim() || "127.0.0.1";
  State.port = $("srvPort").value.trim() || "11434";
  saveState();
  const statusEl = $("connStatus");
  statusEl.className = "conn-status show";
  statusEl.textContent = "Connecting…";
  const ok = await fetchModels();
  if (ok) {
    statusEl.className = "conn-status show ok";
    statusEl.textContent = `✓ Connected — ${State.models.length} model(s) found`;
  } else {
    statusEl.className = "conn-status show fail";
    statusEl.textContent = `✗ Could not reach ${baseUrl()}. Is Ollama running? Try: OLLAMA_HOST=0.0.0.0 ollama serve`;
  }
});

$("settingsModelSelect").addEventListener("change", (e) => {
  State.model = e.target.value;
  saveState();
  updateModelLabel();
  populateModelLists();
});
$("systemPromptInput").addEventListener("change", (e) => { State.systemPrompt = e.target.value; saveState(); });
$("tempSlider").addEventListener("input", (e) => { State.temperature = parseFloat(e.target.value); $("tempVal").textContent = e.target.value; saveState(); });
$("ctxSlider").addEventListener("input", (e) => { State.numCtx = parseInt(e.target.value); $("ctxVal").textContent = e.target.value; saveState(); });
$("topPSlider").addEventListener("input", (e) => { State.topP = parseFloat(e.target.value); $("topPVal").textContent = e.target.value; saveState(); });
$("predictSlider").addEventListener("input", (e) => { State.numPredict = parseInt(e.target.value); $("predictVal").textContent = e.target.value; saveState(); });
$("keepAliveSelect").addEventListener("change", (e) => { State.keepAlive = e.target.value; saveState(); });
$("streamToggle").addEventListener("change", (e) => { State.stream = e.target.checked; saveState(); });
$("autoSpeakToggle").addEventListener("change", (e) => { State.autoSpeak = e.target.checked; saveState(); });

/* ───────── V3: RAG / Tools / Memory settings wiring ───────── */
$("ragToggle").addEventListener("change", (e) => {
  State.ragEnabled = e.target.checked;
  saveState();
  $("embedModelRow").style.display = State.ragEnabled ? "block" : "none";
});
$("embedModel").addEventListener("change", (e) => { State.embedModel = e.target.value.trim() || "nomic-embed-text"; saveState(); });
$("toolsToggle").addEventListener("change", (e) => { State.toolsEnabled = e.target.checked; saveState(); toast(e.target.checked ? "Tool calling on" : "Tool calling off"); });
$("jsonModeToggle").addEventListener("change", (e) => { State.jsonMode = e.target.checked; saveState(); });

function renderMemoryList() {
  const list = $("memoryList");
  if (!State.memory.length) {
    list.innerHTML = `<div class="gxd-memory-empty">No memories yet.</div>`;
    return;
  }
  list.innerHTML = State.memory.map((m, i) =>
    `<div class="gxd-memory-item"><span>${escapeHtml(m)}</span><button data-idx="${i}">✕</button></div>`
  ).join("");
  list.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      State.memory.splice(parseInt(btn.dataset.idx, 10), 1);
      saveState();
      renderMemoryList();
    });
  });
}
function addMemory() {
  const input = $("memoryInput");
  const val = input.value.trim();
  if (!val) return;
  State.memory.push(val);
  saveState();
  input.value = "";
  renderMemoryList();
}
$("btnMemoryAdd").addEventListener("click", addMemory);
$("memoryInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addMemory(); } });

document.querySelectorAll("#perfSeg .seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    applyPerfPreset(btn.dataset.perf);
    document.querySelectorAll("#perfSeg .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
    $("perfHint").textContent = PERF_PRESETS[btn.dataset.perf].hint;
    $("tempSlider").value = State.temperature; $("tempVal").textContent = State.temperature;
    $("ctxSlider").value = State.numCtx; $("ctxVal").textContent = State.numCtx;
    $("predictSlider").value = State.numPredict; $("predictVal").textContent = State.numPredict;
    toast(`Performance: ${btn.textContent.trim()}`);
  });
});
document.querySelectorAll("#voiceLangSeg .seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    State.voiceLang = btn.dataset.lang;
    saveState();
    document.querySelectorAll("#voiceLangSeg .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
  });
});

document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    State.theme = btn.dataset.theme;
    saveState();
    applyTheme();
  });
});

$("btnWipeData").addEventListener("click", () => {
  if (confirm("Delete all conversations? This cannot be undone.")) {
    State.chats = {};
    State.activeChat = null;
    saveChats();
    renderHistory();
    renderWelcome();
    closeSettings();
    toast("All conversations cleared");
  }
});

/* ───────── V3: Offline Cache UI ───────── */
async function updateCacheDisplay() {
  try {
    const stats = await OfflineCacheInstance.getCacheSize();
    $("cacheSizeDisplay").textContent = stats.sizeKB > 0
      ? `${stats.sizeKB} KB`
      : "—";
    $("cacheCountDisplay").textContent = String(stats.entryCount);
  } catch (err) {
    console.warn("Cache display update failed:", err);
  }
}

$("btnViewCacheStats").addEventListener("click", async () => {
  try {
    const stats = await OfflineCacheInstance.getCacheStats();
    $("cacheTotalSize").textContent = `${stats.totalSizeKB} KB`;
    $("cacheTotalEntries").textContent = String(stats.entryCount);
    $("cacheOldestEntry").textContent = stats.oldestEntry
      ? new Date(stats.oldestEntry).toLocaleDateString()
      : "—";
    $("cacheNewestEntry").textContent = stats.newestEntry
      ? new Date(stats.newestEntry).toLocaleDateString()
      : "—";

    const entries = await OfflineCacheInstance.getRecentEntries(10);
    if (entries.length === 0) {
      $("cacheEntryList").innerHTML = '<div class="cache-empty">No cached responses yet</div>';
    } else {
      $("cacheEntryList").innerHTML = entries.map((e) => `
        <div class="cache-entry">
          <div class="entry-model">${escapeHtml(e.modelName)}</div>
          <div class="entry-query">${escapeHtml(e.queryText.substring(0, 60))}</div>
          <div class="entry-date">${new Date(e.timestamp).toLocaleDateString()}</div>
        </div>
      `).join("");
    }

    $("cacheStatsModal").classList.add("open");
    $("cacheStatsBackdrop").classList.add("open");
  } catch (err) {
    toast("Failed to load cache stats: " + err.message);
  }
});

$("btnCloseCacheStats").addEventListener("click", () => {
  $("cacheStatsModal").classList.remove("open");
  $("cacheStatsBackdrop").classList.remove("open");
});

$("btnClearCache").addEventListener("click", async () => {
  if (confirm("Clear all cached responses? This cannot be undone.")) {
    try {
      await OfflineCacheInstance.clearCache();
      await updateCacheDisplay();
      toast("✓ Cache cleared");
    } catch (err) {
      toast("✗ Failed to clear cache: " + err.message);
    }
  }
});

// Update cache display on init and periodically
updateCacheDisplay();
setInterval(updateCacheDisplay, 60000);

/* ───────── INIT ───────── */
async function init() {
  applyTheme();
  renderHistory();
  if (State.activeChat && State.chats[State.activeChat] && State.chats[State.activeChat].messages.length) {
    renderChat(State.activeChat);
  } else {
    renderWelcome();
  }
  await autoDetectServer();
  fetchModels();
  updateSendBtn();
  $("voiceLangToggle").textContent = State.voiceLang === "auto" ? "AUTO" : State.voiceLang === "ar-SA" ? "العربية" : "ENGLISH";
  if ("speechSynthesis" in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
  setInterval(() => { if (!State.isGenerating) fetchModels(); }, 30000);
}

document.addEventListener("DOMContentLoaded", init);
if (document.readyState !== "loading") init();

/* ───────── V3: minimal exports for js/calendar.js & ai-core.js network detection ───────── */
window.renderChat = renderChat;
window.closeDrawerGlobal = closeDrawer;
window.sendMessageFromReminder = (promptText) => sendMessage(undefined, promptText);
window.fetchModels = fetchModels;
window.setServerStatus = setServerStatus;

})();
