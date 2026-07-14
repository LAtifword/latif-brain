/* ════════════════════════════════════════════════════════════════
   LATIF AI — Server Auto-Detection
   Automatically discovers and connects to local model servers
   No external APIs, 100% local inference
   ════════════════════════════════════════════════════════════════ */
"use strict";

const ServerAutoDetect = (() => {
  const CACHE_DURATION = 60000; // 1 minute cache
  const DETECTION_TIMEOUT = 2000; // 2 second timeout per port

  const COMMON_SERVERS = [
    { name: "Ollama (default)", host: "127.0.0.1", port: 11434, backend: "ollama", apiPath: "/api/tags" },
    { name: "Ollama (Wi-Fi)", host: "192.168.1.1", port: 11434, backend: "ollama", apiPath: "/api/tags" },
    { name: "llama.cpp (OpenAI)", host: "127.0.0.1", port: 8000, backend: "openai", apiPath: "/v1/models" },
    { name: "llama.cpp (Alt)", host: "127.0.0.1", port: 8080, backend: "openai", apiPath: "/v1/models" },
  ];

  let detectionCache = null;
  let cacheTime = 0;

  async function checkServer(host, port, backend, apiPath) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DETECTION_TIMEOUT);

      const url = `http://${host}:${port}${apiPath}`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) return null;

      const data = await response.json();

      // Validate response format
      if (backend === "ollama" && data.models && Array.isArray(data.models)) {
        return {
          host,
          port,
          backend,
          name: `Ollama @ ${host}:${port}`,
          models: data.models.map((m) => m.name || m),
          lastChecked: Date.now(),
        };
      } else if (backend === "openai" && data.data && Array.isArray(data.data)) {
        return {
          host,
          port,
          backend,
          name: `llama.cpp @ ${host}:${port}`,
          models: data.data.map((m) => m.id || m.name || m),
          lastChecked: Date.now(),
        };
      }

      return null;
    } catch (err) {
      return null;
    }
  }

  async function detectAvailableServers() {
    const now = Date.now();

    // Return cached results if fresh
    if (detectionCache && (now - cacheTime) < CACHE_DURATION) {
      return detectionCache;
    }

    const checks = COMMON_SERVERS.map((srv) =>
      checkServer(srv.host, srv.port, srv.backend, srv.apiPath)
    );

    const results = await Promise.all(checks);
    detectionCache = results.filter((r) => r !== null);
    cacheTime = now;

    return detectionCache;
  }

  function getBestServer(servers) {
    if (!servers || servers.length === 0) return null;

    // Prefer Ollama (127.0.0.1) > others > Wi-Fi addresses
    return servers.sort((a, b) => {
      const scoreA = a.host === "127.0.0.1" ? 10 : a.host === "localhost" ? 9 : 0;
      const scoreB = b.host === "127.0.0.1" ? 10 : b.host === "localhost" ? 9 : 0;
      return scoreB - scoreA;
    })[0];
  }

  async function autoConnect() {
    const servers = await detectAvailableServers();
    const best = getBestServer(servers);

    if (!best) {
      return {
        success: false,
        error: "No local model servers found. Install Ollama from https://ollama.ai",
        servers: [],
      };
    }

    return {
      success: true,
      server: best,
      servers: servers,
    };
  }

  async function tryConnectWithCache() {
    // First try to use cached settings if they exist and are still valid
    const cachedHost = localStorage.getItem("latif_host");
    const cachedPort = localStorage.getItem("latif_port");

    if (cachedHost && cachedPort) {
      const backend = localStorage.getItem("latif_backend") || "ollama";
      const apiPath = backend === "ollama" ? "/api/tags" : "/v1/models";

      const result = await checkServer(cachedHost, cachedPort, backend, apiPath);
      if (result) {
        return {
          success: true,
          server: result,
          usedCache: true,
        };
      }
    }

    // Fall back to auto-detection
    return autoConnect();
  }

  function clearCache() {
    detectionCache = null;
    cacheTime = 0;
  }

  async function getModels(host, port, backend) {
    const apiPath = backend === "ollama" ? "/api/tags" : "/v1/models";
    const url = `http://${host}:${port}${apiPath}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DETECTION_TIMEOUT);

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) return [];

      const data = await response.json();

      if (backend === "ollama" && data.models) {
        return data.models.map((m) => m.name || m);
      } else if (backend === "openai" && data.data) {
        return data.data.map((m) => m.id || m.name || m);
      }

      return [];
    } catch (err) {
      return [];
    }
  }

  return {
    detectAvailableServers,
    autoConnect,
    tryConnectWithCache,
    getBestServer,
    getModels,
    clearCache,
    COMMON_SERVERS,
  };
})();
