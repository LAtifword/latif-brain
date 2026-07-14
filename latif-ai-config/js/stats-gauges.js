/* ════════════════════════════════════════════════════════════════
   LATIF AI — SYSTEM MONITOR (Termux backend gauges)
   Polls backend/stats.py (FastAPI, run in Termux) for CPU/RAM/battery
   and Ollama's loaded-model VRAM, rendering GX-style radial gauges in
   Settings → System Monitor. If the backend isn't reachable, shows a
   quiet hint instead of erroring — the app works fully without it.
   ════════════════════════════════════════════════════════════════ */
(function () {
"use strict";

const $ = (id) => document.getElementById(id);
const LS_URL = "latif_monitor_url";
let pollTimer = null;
let lastOk = false;

function gaugeSvg(pct, label, num) {
  const r = 30, c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct / 100)) * c;
  return `
    <div class="gxd-gauge">
      <svg viewBox="0 0 72 72">
        <circle class="gxd-gauge-track" cx="36" cy="36" r="${r}"></circle>
        <circle class="gxd-gauge-value" cx="36" cy="36" r="${r}"
          stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}"></circle>
      </svg>
      <div class="gxd-gauge-num">${num}</div>
      <div class="gxd-gauge-label">${label}</div>
    </div>`;
}

function render(data) {
  const body = $("monitorBody");
  if (!body) return;
  const cpu = data.cpu != null ? Math.round(data.cpu) : 0;
  const mem = data.mem_pct != null ? Math.round(data.mem_pct) : 0;
  const bat = data.battery && data.battery.level != null ? Math.round(data.battery.level) : null;

  let html = `<div class="gxd-gauges">
    ${gaugeSvg(cpu, "CPU", cpu + "%")}
    ${gaugeSvg(mem, "RAM", mem + "%")}
    ${bat != null ? gaugeSvg(bat, "Battery", bat + "%") : ""}
  </div>`;

  const models = data.ollama || [];
  if (models.length) {
    html += `<div class="gxd-monitor-hint" style="margin-top:10px;">Loaded: ${models.map((m) =>
      `${m.name || m.model || "model"} (${m.size_vram ? (m.size_vram / 1e9).toFixed(1) + " GB VRAM" : "—"})`
    ).join(", ")}</div>`;
  }
  body.innerHTML = html;
}

function renderOffline(hint) {
  const body = $("monitorBody");
  if (!body) return;
  body.innerHTML = `<div class="gxd-monitor-offline gxd-monitor-hint">⚠ ${hint}</div>`;
}

async function poll() {
  const input = $("monitorUrl");
  const url = (input ? input.value.trim() : "") || localStorage.getItem(LS_URL) || "http://127.0.0.1:8000";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(url.replace(/\/$/, "") + "/stats", { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    render(data);
    lastOk = true;
  } catch (_) {
    if (lastOk || !$("monitorBody").children.length) {
      renderOffline("Monitor backend not detected — run backend/stats.py in Termux to see live CPU/RAM/battery.");
    }
    lastOk = false;
  }
}

function wire() {
  const input = $("monitorUrl");
  const btn = $("btnMonitorRefresh");
  if (input) {
    const saved = localStorage.getItem(LS_URL);
    if (saved) input.value = saved;
    input.addEventListener("change", () => { localStorage.setItem(LS_URL, input.value.trim()); poll(); });
  }
  if (btn) btn.addEventListener("click", poll);

  const modal = $("settingsModal");
  if (modal) {
    new MutationObserver(() => {
      if (modal.classList.contains("open")) {
        poll();
        clearInterval(pollTimer);
        pollTimer = setInterval(poll, 2000);
      } else {
        clearInterval(pollTimer);
      }
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
else wire();

})();
