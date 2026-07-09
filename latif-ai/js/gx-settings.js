/* ════════════════════════════════════════════════════════════════
   LATIF AI — GX MODS settings wiring
   Standalone (runs after app.js). Populates the "GX Mods" panel and
   toggles in the Settings modal without touching the core app IIFE.
   ════════════════════════════════════════════════════════════════ */
(function () {
"use strict";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function toast(msg, ms = 2000) {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), ms);
}

const manifestCache = {};
async function loadManifest(name) {
  if (manifestCache[name]) return manifestCache[name];
  try {
    const res = await fetch(`mods/${name}/manifest.json`, { cache: "no-cache" });
    const m = await res.json();
    manifestCache[name] = m;
    return m;
  } catch (_) { return null; }
}

function card(info, isActive) {
  const btn = document.createElement("button");
  btn.className = "mod-card" + (isActive ? " active" : "");
  btn.innerHTML =
    `<span class="mod-swatch" style="background:linear-gradient(135deg,${info.primary},${info.accent})"></span>
     <span class="mod-meta"><span class="mod-name">${esc(info.name)}</span>
       <span class="mod-desc">${esc(info.desc)}</span></span>
     <svg class="mod-check" width="18" height="18" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  btn.addEventListener("click", async () => {
    if (info.id) await window.LATIF.loadMod(info.id);
    else window.LATIF.unloadMod();
    render();
    toast(info.id ? `Mod: ${info.name}` : "Native theme restored");
  });
  return btn;
}

async function render() {
  const grid = $("modGrid");
  if (!grid || !window.LATIF) return;
  const active = window.LATIF.currentMod();

  const sT = $("gxSoundToggle"), aT = $("gxAmbientToggle"), fT = $("gxFocusToggle");
  if (sT) sT.checked = window.LATIF.isSoundOn();
  if (aT) aT.checked = window.LATIF.isAmbientOn();
  if (fT) fT.checked = window.LATIF.isFocusOn();

  grid.innerHTML = "";
  grid.appendChild(card({
    id: "", name: "None (native theme)", desc: "Use LATIF's built-in themes",
    primary: "#C8A84B", accent: "#D4782A",
  }, active === null || active === ""));

  for (const id of window.LATIF.listMods()) {
    const m = await loadManifest(id);
    const t = (m && m.theme) || {};
    grid.appendChild(card({
      id,
      name: (m && m.name) || id,
      desc: (m && m.description) || "",
      primary: t.primary_color || "#FA1E4E",
      accent: t.accent_color || "#00D4AA",
    }, active === id));
  }
}

function wire() {
  const sT = $("gxSoundToggle"), aT = $("gxAmbientToggle"), fT = $("gxFocusToggle");
  if (sT) sT.addEventListener("change", (e) => {
    window.LATIF.setSound(e.target.checked);
    toast(e.target.checked ? "Interface sounds on" : "Interface sounds off");
  });
  if (aT) aT.addEventListener("change", (e) => {
    window.LATIF.setAmbient(e.target.checked);
    toast(e.target.checked ? "Ambient soundscape on" : "Ambient off");
  });
  if (fT) fT.addEventListener("change", (e) => {
    window.LATIF.engine.applyFocus(e.target.checked);
    toast(e.target.checked ? "Focus mode on" : "Focus mode off");
  });

  // Re-render the panel whenever the Settings modal opens.
  const modal = $("settingsModal");
  if (modal) {
    new MutationObserver(() => {
      if (modal.classList.contains("open")) render();
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
  }
  render();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wire);
} else {
  wire();
}

})();
