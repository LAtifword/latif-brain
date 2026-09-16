/* LATIF NI — standalone native AI controller.
   Replaces demo replies, fake metrics, and toast-only agent actions with the embedded Android model. */
(function () {
  "use strict";

  const pending = new Map();
  const STORAGE_HISTORY = "latif_ni_chat_history_v2";
  const STORAGE_PROJECTS = "latif_ni_projects_v2";
  const STORAGE_CONTEXT = "latif_ni_upload_context_v2";
  let currentRequestId = null;
  let activeMode = "chat";
  let activeAgent = "Chat Agent";
  let chatHistory = loadJson(STORAGE_HISTORY, []);
  let uploadContext = localStorage.getItem(STORAGE_CONTEXT) || "";

  const AGENTS = [
    ["Chat Agent", "AI Assistant", "💬", "You are LATIF NI's general AI assistant. Be concise, practical, and multilingual."],
    ["Code Agent", "Dev Assistant", "💻", "You are LATIF NI's senior software engineering agent. Produce correct, maintainable code and explain important tradeoffs."],
    ["Design Agent", "UI/UX Creator", "🎨", "You are LATIF NI's product and UI/UX design agent. Focus on usable interfaces, flows, accessibility, and implementation-ready decisions."],
    ["Planner Agent", "Goal Decomposer", "🧭", "You are LATIF NI's planner. Break goals into executable steps, dependencies, risks, and completion criteria."],
    ["Research Agent", "Knowledge Analyst", "🔎", "You are LATIF NI's research agent. Analyze the supplied local context carefully, distinguish facts from assumptions, and synthesize findings."],
    ["Executor Agent", "Task Operator", "⚡", "You are LATIF NI's execution agent. Convert a plan into concrete outputs, commands, drafts, code, or structured task results."],
    ["Critic Agent", "Quality Reviewer", "🧪", "You are LATIF NI's critic. Audit outputs for correctness, missing requirements, edge cases, and contradictions, then propose fixes."],
    ["Memory Agent", "Context Curator", "🧠", "You are LATIF NI's memory agent. Extract durable facts, decisions, project state, and reusable context from the conversation."],
    ["Data Agent", "Structured Analyst", "📊", "You are LATIF NI's data agent. Turn raw information into structured summaries, comparisons, tables, calculations, and actionable insights."],
  ];

  const WORKSPACE_PROMPTS = {
    chat: "You are LATIF NI, a private standalone AI command center running entirely on this Android device.",
    novel: "You are LATIF NI's Arabic Novel workspace. Help plan, draft, edit, and analyze Arabic literary fiction with strong continuity, voice, character logic, and prose craft.",
    proposal: "You are LATIF NI's Proposal workspace. Build professional event, business, technical, and commercial proposals with clear scope, deliverables, assumptions, pricing structure, and risks.",
    voice: "You are LATIF NI's Voice workspace. Keep responses conversational and suitable for spoken interaction.",
  };

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch (_) { return fallback; }
  }

  function bridge() {
    try {
      return window.LATIF_AI && window.LATIF_AI.isAvailable && window.LATIF_AI.isAvailable()
        ? window.LATIF_AI : null;
    } catch (_) { return null; }
  }

  function parseJson(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function esc(text) {
    const div = document.createElement("div");
    div.textContent = String(text ?? "");
    return div.innerHTML;
  }

  window.LATIF_NATIVE_AI_CALLBACKS = {
    onChunk(requestId, chunk) {
      const p = pending.get(requestId);
      if (!p) return;
      p.text += chunk || "";
      p.onChunk?.(chunk || "", p.text);
    },
    onDone(requestId, fullText) {
      const p = pending.get(requestId);
      if (!p) return;
      pending.delete(requestId);
      if (currentRequestId === requestId) currentRequestId = null;
      p.resolve(fullText || p.text || "");
    },
    onError(requestId, message) {
      const p = pending.get(requestId);
      if (!p) return;
      pending.delete(requestId);
      if (currentRequestId === requestId) currentRequestId = null;
      p.reject(new Error(message || "Embedded AI error"));
    },
    onStatus(raw) {
      window.dispatchEvent(new CustomEvent("latif-native-ai-status", { detail: parseJson(raw, {}) }));
    },
  };

  const NativeAI = {
    status() { const b = bridge(); return b ? parseJson(b.status(), {}) : { ready: false, state: "unavailable" }; },
    modelLabel() { const b = bridge(); return b ? b.modelLabel() : "Embedded AI"; },
    deviceStats() { const b = bridge(); return b ? parseJson(b.deviceStats(), {}) : {}; },
    async waitUntilReady(timeoutMs = 120000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const s = this.status();
        if (s.ready) return s;
        if (s.state === "error") throw new Error(s.detail || "Embedded model failed to initialize");
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error("Embedded model initialization timed out");
    },
    chat(messages, systemPrompt, onChunk) {
      const b = bridge();
      if (!b) return Promise.reject(new Error("Embedded AI bridge unavailable"));
      const requestId = `ni-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      currentRequestId = requestId;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject, onChunk, text: "" });
        const ok = b.chat(requestId, JSON.stringify(messages), systemPrompt, 768, 0.65, 0.9);
        if (!ok && pending.has(requestId)) {
          pending.delete(requestId);
          reject(new Error("Embedded AI rejected the request"));
        }
      });
    },
  };
  window.LatifNativeAI = NativeAI;

  function systemPrompt() {
    const agent = AGENTS.find((a) => a[0] === activeAgent);
    let prompt = `${WORKSPACE_PROMPTS[activeMode] || WORKSPACE_PROMPTS.chat}\n\n${agent ? agent[3] : AGENTS[0][3]}`;
    if (uploadContext) prompt += `\n\nLOCAL USER FILE CONTEXT:\n${uploadContext.slice(0, 30000)}`;
    return prompt;
  }

  function renderHistory() {
    const messages = document.getElementById("chatMessages");
    if (!messages) return;
    messages.innerHTML = `<div class="chat-message"><div class="chat-avatar ai">A</div><div><div class="chat-bubble ai">LATIF NI standalone AI is ready. Active agent: ${esc(activeAgent)}.</div><div class="chat-time">Local</div></div></div>`;
    for (const item of chatHistory.slice(-40)) {
      appendBubble(item.role, item.content, false);
    }
    messages.scrollTop = messages.scrollHeight;
  }

  function appendBubble(role, content, animate = true) {
    const messages = document.getElementById("chatMessages");
    if (!messages) return null;
    const wrap = document.createElement("div");
    wrap.className = `chat-message${role === "user" ? " user" : ""}`;
    if (animate) wrap.style.animation = "slideIn 0.3s ease";
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    wrap.innerHTML = role === "user"
      ? `<div class="chat-avatar user">L</div><div><div class="chat-bubble user">${esc(content)}</div><div class="chat-time">${time}</div></div>`
      : `<div class="chat-avatar ai">A</div><div><div class="chat-bubble ai">${esc(content)}</div><div class="chat-time">${time}</div></div>`;
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
    return wrap.querySelector(".chat-bubble");
  }

  window.sendMessage = async function () {
    const input = document.getElementById("chatInput");
    const text = (input?.value || "").trim();
    if (!text) return;
    input.value = "";
    if (window.navigateTo) window.navigateTo("chat");

    appendBubble("user", text);
    chatHistory.push({ role: "user", content: text });
    const aiBubble = appendBubble("assistant", "Loading embedded model…");

    try {
      const ready = await NativeAI.waitUntilReady();
      if (aiBubble) aiBubble.textContent = `Thinking locally on ${ready.backend || "device"}…`;
      let acc = "";
      const reply = await NativeAI.chat(chatHistory, systemPrompt(), (_chunk, full) => {
        acc = full;
        if (aiBubble) aiBubble.textContent = full;
        const messages = document.getElementById("chatMessages");
        if (messages) messages.scrollTop = messages.scrollHeight;
      });
      const finalText = reply || acc || "";
      if (aiBubble) aiBubble.textContent = finalText;
      chatHistory.push({ role: "assistant", content: finalText });
      chatHistory = chatHistory.slice(-60);
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(chatHistory));
      addActivity(`${activeAgent} completed a local inference turn`, "🧠");
    } catch (err) {
      if (aiBubble) aiBubble.textContent = `Local AI error: ${err.message || err}`;
    }
  };

  window.sendSuggestion = function (text) {
    const input = document.getElementById("chatInput");
    if (input) input.value = text;
    window.navigateTo?.("chat");
    window.sendMessage();
  };

  window.openWorkspace = function (type) {
    activeMode = WORKSPACE_PROMPTS[type] ? type : "chat";
    activeAgent = type === "novel" ? "Research Agent" : type === "proposal" ? "Planner Agent" : "Chat Agent";
    window.navigateTo?.("chat");
    window.showToast?.(`${type === "chat" ? "Universal Chat" : type.charAt(0).toUpperCase() + type.slice(1)} workspace active`, "🚀");
    const input = document.getElementById("chatInput");
    if (input) input.placeholder = `Ask ${activeAgent} in ${activeMode} workspace…`;
  };

  function createProject() {
    const name = prompt("Project name");
    if (!name || !name.trim()) return;
    const projects = loadJson(STORAGE_PROJECTS, []);
    projects.push({ id: Date.now(), name: name.trim(), createdAt: Date.now() });
    localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(projects.slice(-50)));
    addActivity(`Project created: ${name.trim()}`, "📁");
    window.showToast?.(`Project “${name.trim()}” created locally`, "📁");
  }

  function uploadFile() {
    let input = document.getElementById("latifNiNativeUpload");
    if (!input) {
      input = document.createElement("input");
      input.type = "file";
      input.id = "latifNiNativeUpload";
      input.accept = ".txt,.md,.json,.csv,.html,.js,.ts,.py,.kt,.java,.xml,text/*";
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          uploadContext = `[${file.name}]\n${String(reader.result || "").slice(0, 30000)}`;
          localStorage.setItem(STORAGE_CONTEXT, uploadContext);
          addActivity(`Loaded local file: ${file.name}`, "📄");
          window.showToast?.(`${file.name} added to local AI context`, "📄");
        };
        reader.readAsText(file);
        input.value = "";
      });
    }
    input.click();
  }

  function startVoiceInput() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      window.showToast?.("Bundled speech model not installed in this build; voice control hidden until the native ASR module is packaged.", "🎤");
      return;
    }
    const r = new Recognition();
    r.lang = "ar-SA";
    r.interimResults = false;
    r.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript || "";
      const input = document.getElementById("chatInput");
      if (input) input.value = text;
      window.sendMessage();
    };
    r.start();
  }

  window.quickAction = function (type) {
    if (type === "chat") {
      chatHistory = [];
      localStorage.setItem(STORAGE_HISTORY, "[]");
      renderHistory();
      window.navigateTo?.("chat");
      return;
    }
    if (type === "upload") return uploadFile();
    if (type === "project") return createProject();
    if (type === "voice") return startVoiceInput();
    if (type === "tools") return window.navigateTo?.("tools");
    if (type === "settings") {
      const s = NativeAI.status();
      window.showToast?.(`${NativeAI.modelLabel()} · ${s.ready ? s.backend + " ready" : s.detail || s.state}`, "⚙️");
    }
  };

  function installAgents() {
    const list = document.querySelector("#page-agents .agents-list");
    if (!list) return;
    list.innerHTML = "";
    for (const [name, role, icon] of AGENTS) {
      const item = document.createElement("div");
      item.className = "agent-item";
      item.innerHTML = `<div class="agent-avatar" style="background:rgba(139,92,246,.12)">${icon}</div><div class="agent-info"><div class="agent-name">${esc(name)}</div><div class="agent-role">${esc(role)}</div></div><div class="agent-status"><span class="agent-status-dot"></span> Local</div>`;
      item.onclick = () => {
        activeAgent = name;
        window.navigateTo?.("chat");
        const input = document.getElementById("chatInput");
        if (input) input.placeholder = `Ask ${name}…`;
        window.showToast?.(`${name} active`, icon);
      };
      list.appendChild(item);
    }

    const statusCards = document.querySelectorAll(".system-status .status-card");
    if (statusCards[1]) {
      const value = statusCards[1].querySelector(".status-value");
      const sub = statusCards[1].querySelector(".status-sub");
      if (value) value.innerHTML = `${AGENTS.length}<small>/${AGENTS.length}</small>`;
      if (sub) sub.textContent = "Embedded role agents";
    }
    const profileStats = document.querySelectorAll(".profile-stat-value");
    if (profileStats[0]) profileStats[0].textContent = String(AGENTS.length);
  }

  function installToolActions() {
    document.querySelectorAll("#page-tools .tool-card").forEach((card) => {
      const name = card.querySelector(".tool-name")?.textContent?.trim() || "";
      if (["Image", "Voice", "Transcribe"].includes(name)) {
        // Do not leave visible demo controls. They return when their dedicated bundled engines are added.
        card.style.display = "none";
        return;
      }
      card.onclick = () => {
        const prompts = {
          "Text Gen": "Write or rewrite the following text professionally: ",
          "Code": "Act as a senior software engineer and help with: ",
          "Translate": "Translate accurately between Arabic and English. Text: ",
        };
        activeAgent = name === "Code" ? "Code Agent" : "Chat Agent";
        window.navigateTo?.("chat");
        const input = document.getElementById("chatInput");
        if (input) {
          input.value = prompts[name] || "Help me with: ";
          input.focus();
        }
      };
    });
  }

  function replaceExternalIcons() {
    const map = {
      "fa-home": "⌂", "fa-th-large": "▦", "fa-robot": "🤖", "fa-comments": "💬",
      "fa-tools": "🛠", "fa-cog": "⚙", "fa-brain": "🧠", "fa-book": "📚",
      "fa-project-diagram": "🔀", "fa-puzzle-piece": "🧩", "fa-info-circle": "ⓘ",
      "fa-search": "⌕", "fa-bell": "🔔", "fa-user": "●",
    };
    document.querySelectorAll("i.fas").forEach((el) => {
      const cls = Array.from(el.classList).find((c) => map[c]);
      if (cls) {
        el.textContent = map[cls];
        el.className = "";
        el.style.fontStyle = "normal";
      }
    });
  }

  function updateTelemetry() {
    const s = NativeAI.deviceStats();
    const cpu = document.getElementById("cpuVal");
    const ram = document.getElementById("ramVal");
    if (cpu && Number.isFinite(Number(s.cpuPercent)) && Number(s.cpuPercent) >= 0) cpu.textContent = `${Math.round(s.cpuPercent)}%`;
    if (ram && Number.isFinite(Number(s.ramPercent))) ram.textContent = `${Math.round(s.ramPercent)}%`;

    const statusCard = document.querySelector(".system-status .status-card .status-value");
    if (statusCard) {
      const model = NativeAI.status();
      statusCard.textContent = model.ready ? `${model.backend} Ready` : "Initializing";
    }

    updateChart("chart3", Number(s.cpuPercent));
    updateChart("chart4", Number(s.ramPercent));
  }

  const chartHistory = { chart3: [], chart4: [] };
  function updateChart(id, value) {
    if (!Number.isFinite(value) || value < 0) return;
    const arr = chartHistory[id];
    arr.push(value);
    while (arr.length > 12) arr.shift();
    const root = document.getElementById(id);
    if (!root) return;
    root.innerHTML = arr.map((v) => `<div class="chart-bar" style="height:${Math.max(5, Math.min(100, v))}%"></div>`).join("");
  }

  function addActivity(text, icon) {
    const section = document.querySelector(".activity-section");
    if (!section) return;
    const item = document.createElement("div");
    item.className = "activity-item";
    item.innerHTML = `<div class="activity-icon purple">${icon}</div><div class="activity-info"><div class="activity-title">${esc(text)}</div><div class="activity-meta">Just now · on-device</div></div>`;
    section.insertBefore(item, section.children[1] || null);
    const activities = section.querySelectorAll(".activity-item");
    for (let i = 5; i < activities.length; i++) activities[i].remove();
  }

  function boot() {
    replaceExternalIcons();
    installAgents();
    installToolActions();
    renderHistory();
    const version = document.querySelector(".sidebar-version");
    if (version) version.textContent = "LATIF NI v2 · Standalone Embedded AI";
    const loading = document.querySelector(".loading-text");
    if (loading) loading.textContent = "Loading embedded local AI…";
    updateTelemetry();
    setInterval(updateTelemetry, 2000);
    window.addEventListener("latif-native-ai-status", updateTelemetry);
  }

  boot();
})();
