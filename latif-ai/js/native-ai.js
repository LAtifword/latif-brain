/* LATIF GX — Native embedded AI compatibility layer.
   The existing GX code can keep speaking its Ollama-style protocol, but all calls are
   intercepted inside the WebView and executed by the native in-process Android engine. */
(function () {
  "use strict";

  const pending = new Map();
  let currentRequestId = null;
  const originalFetch = window.fetch.bind(window);

  function bridge() {
    try {
      return window.LATIF_AI && window.LATIF_AI.isAvailable && window.LATIF_AI.isAvailable()
        ? window.LATIF_AI
        : null;
    } catch (_) {
      return null;
    }
  }

  function parseJson(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  function hashEmbedding(text, dims = 384) {
    const out = new Array(dims).fill(0);
    const normalized = String(text || "").normalize("NFKC").toLowerCase();
    const tokens = normalized.match(/[\p{L}\p{N}_]+/gu) || [];
    for (const token of tokens) {
      let h = 2166136261;
      for (let i = 0; i < token.length; i++) {
        h ^= token.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      const idx = (h >>> 0) % dims;
      out[idx] += 1;
      if (token.length > 3) {
        const idx2 = ((h >>> 7) ^ (h << 5)) >>> 0;
        out[idx2 % dims] += 0.5;
      }
    }
    let norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0));
    if (!norm) norm = 1;
    return out.map((v) => v / norm);
  }

  function requestParts(body) {
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const system = messages.filter((m) => m.role === "system").map((m) => m.content || "").join("\n\n");
    return {
      messages: messages.filter((m) => m.role !== "system"),
      systemPrompt: system,
      maxTokens: Number(body.options?.num_predict || 512),
      temperature: Number(body.options?.temperature ?? 0.7),
      topP: Number(body.options?.top_p ?? 0.9),
    };
  }

  window.LATIF_NATIVE_AI_CALLBACKS = {
    onChunk(requestId, chunk) {
      const item = pending.get(requestId);
      if (!item) return;
      item.text += chunk || "";
      if (item.onChunk) item.onChunk(chunk || "", item.text);
    },
    onDone(requestId, fullText) {
      const item = pending.get(requestId);
      if (!item) return;
      pending.delete(requestId);
      if (currentRequestId === requestId) currentRequestId = null;
      item.resolve(fullText || item.text || "");
    },
    onError(requestId, message) {
      const item = pending.get(requestId);
      if (!item) return;
      pending.delete(requestId);
      if (currentRequestId === requestId) currentRequestId = null;
      item.reject(new Error(message || "Embedded AI error"));
    },
    onStatus(raw) {
      window.dispatchEvent(new CustomEvent("latif-native-ai-status", {
        detail: parseJson(raw, { state: "unknown" }),
      }));
    },
  };

  const NativeAI = window.LatifNativeAI = {
    isAvailable() { return !!bridge(); },
    modelLabel() {
      const b = bridge();
      return b ? b.modelLabel() : "";
    },
    status() {
      const b = bridge();
      return b ? parseJson(b.status(), { state: "unavailable", ready: false }) : { state: "unavailable", ready: false };
    },
    deviceStats() {
      const b = bridge();
      return b ? parseJson(b.deviceStats(), {}) : {};
    },
    async waitUntilReady(timeoutMs = 120000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const s = this.status();
        if (s.ready) return s;
        if (s.state === "error") throw new Error(s.detail || "Embedded model failed to load");
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error("Embedded model initialization timed out");
    },
    chat(messages, options = {}, onChunk) {
      const b = bridge();
      if (!b) return Promise.reject(new Error("Embedded AI bridge unavailable"));
      const requestId = `gx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      currentRequestId = requestId;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject, onChunk, text: "" });
        const accepted = b.chat(
          requestId,
          JSON.stringify(messages || []),
          options.systemPrompt || "",
          Number(options.maxTokens || 512),
          Number(options.temperature ?? 0.7),
          Number(options.topP ?? 0.9),
        );
        if (!accepted && pending.has(requestId)) {
          pending.delete(requestId);
          reject(new Error("Embedded AI rejected the request"));
        }
      });
    },
    cancelCurrent() {
      const b = bridge();
      if (!b || !currentRequestId) return false;
      return !!b.cancel(currentRequestId);
    },
  };

  async function nativeFetch(input, init = {}) {
    const b = bridge();
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (!b) return originalFetch(input, init);

    if (/\/api\/tags(?:\?|$)/.test(url)) {
      const s = NativeAI.status();
      return jsonResponse({
        models: [{
          name: NativeAI.modelLabel() || "LATIF Embedded AI",
          size: Number(s.modelBytes || 0),
          modified_at: new Date().toISOString(),
          details: { format: "LiteRT-LM", quantization_level: "INT4", family: "qwen3" },
        }],
      });
    }

    if (/\/api\/embeddings(?:\?|$)/.test(url)) {
      const body = parseJson(init.body || "{}", {});
      return jsonResponse({ embedding: hashEmbedding(body.prompt || body.input || "") });
    }

    if (/\/stats(?:\?|$)/.test(url)) {
      const s = NativeAI.deviceStats();
      return jsonResponse({
        cpu_percent: s.cpuPercent,
        memory_percent: s.ramPercent,
        battery_percent: s.batteryPercent,
        temperature_c: s.temperatureC,
        gpu_percent: s.gpuPercent,
        ai_backend: s.aiBackend,
        model: s.model,
      });
    }

    if (/\/api\/chat(?:\?|$)/.test(url)) {
      const body = parseJson(init.body || "{}", {});

      // Existing GX performs a non-streaming tool preflight before the real turn.
      // Native tool providers are being integrated independently; avoid a duplicate generation here.
      if (body.tools && body.stream === false) {
        return jsonResponse({ message: { role: "assistant", content: "", tool_calls: [] }, done: true });
      }

      const parts = requestParts(body);
      if (body.stream === false) {
        try {
          const text = await NativeAI.chat(parts.messages, parts);
          return jsonResponse({ message: { role: "assistant", content: text }, done: true });
        } catch (err) {
          return jsonResponse({ error: err.message || String(err) }, 500);
        }
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          NativeAI.chat(parts.messages, parts, (chunk) => {
            const frame = JSON.stringify({ message: { role: "assistant", content: chunk }, done: false }) + "\n";
            controller.enqueue(encoder.encode(frame));
          }).then(() => {
            controller.enqueue(encoder.encode(JSON.stringify({ message: { role: "assistant", content: "" }, done: true }) + "\n"));
            controller.close();
          }).catch((err) => {
            controller.error(err);
          });
        },
        cancel() {
          NativeAI.cancelCurrent();
        },
      });
      return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
    }

    return originalFetch(input, init);
  }

  window.fetch = nativeFetch;

  function refreshEmbeddedUi() {
    const s = NativeAI.status();
    const modelLabel = NativeAI.modelLabel() || "Embedded AI";
    const welcome = document.querySelector(".welcome-sub");
    if (welcome) welcome.textContent = "100% standalone on-device AI — no server, no Termux, no API key.";
    const ddTitle = document.querySelector("#modelDropdown .dd-title");
    if (ddTitle) ddTitle.textContent = "Embedded On-Device Model";
    const serverText = document.getElementById("serverPillText");
    if (serverText) serverText.textContent = s.ready ? `${modelLabel} · ${s.backend}` : (s.detail || "Loading embedded model…");
    const current = document.getElementById("currentModelLabel");
    if (current && (!current.textContent || /offline|connecting/i.test(current.textContent))) current.textContent = s.ready ? modelLabel : "loading local brain…";

    ["srvHost", "srvPort", "btnTestConn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = true;
        el.style.opacity = "0.45";
      }
    });
  }

  refreshEmbeddedUi();
  window.addEventListener("latif-native-ai-status", () => {
    refreshEmbeddedUi();
    if (window.fetchModels) window.fetchModels();
  });
  setInterval(refreshEmbeddedUi, 1000);
  setTimeout(() => { if (window.fetchModels) window.fetchModels(); }, 50);
})();
