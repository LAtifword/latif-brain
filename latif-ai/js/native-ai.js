/* LATIF GX — Native embedded AI bridge. No HTTP server, Ollama, Termux, or port configuration. */
(function () {
  "use strict";

  const pending = new Map();
  let currentRequestId = null;

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

  window.LatifNativeAI = {
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
})();
