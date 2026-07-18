/* ════════════════════════════════════════════════════════════════
   LATIF AI — GX MODS settings wiring (v2)
   Standalone (runs after app.js + mod-engine.js + audio/fx engines).
   Populates the "GX Mods" panel, Shader FX intensity, ambient/focus
   toggles, and the "LATIF Corner" quick-prompt panel — all without
   touching app.js.
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

function hslCss(o) { return o ? `hsl(${o.h},${o.s}%,${o.l}%)` : "#fa1e4e"; }

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

async function renderModGrid() {
  const grid = $("modGrid");
  if (!grid || !window.LATIF) return;
  const active = window.LATIF.currentMod();

  grid.innerHTML = "";
  grid.appendChild(card({
    id: "", name: "None (native theme)", desc: "Use LATIF's built-in themes",
    primary: "#C8A84B", accent: "#D4782A",
  }, active === null || active === ""));

  for (const id of window.LATIF.listMods()) {
    const m = await loadManifest(id);
    const payload = m && m.mod && m.mod.payload;
    const theme = (payload && payload.theme && payload.theme.dark) || {};
    grid.appendChild(card({
      id,
      name: (m && m.name) || id,
      desc: (m && m.description) || "",
      primary: hslCss(theme.gx_accent),
      accent: hslCss(theme.gx_accent_2 || theme.gx_accent),
    }, active === id));
  }
}

function renderToggles() {
  const aT = $("gxAmbientToggle"), fT = $("gxFocusToggle");
  if (aT && window.LATIF) aT.checked = window.LATIF.isAmbientOn();
  if (fT && window.LATIF) fT.checked = window.LATIF.isFocusOn();
  const fxSeg = $("fxSeg");
  if (fxSeg && window.LATIF_FX) {
    fxSeg.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.fx === window.LATIF_FX.getLevel()));
  }
}

async function render() { await renderModGrid(); renderToggles(); }

function wireCorner() {
  const chips = $("cornerChips");
  if (!chips) return;
  const prompts = [
    ["✍️ فقرة فلسفية", "اكتب لي فقرة افتتاحية فلسفية بأسلوب كافكا"],
    ["📋 Summarize", "Summarize this in 3 bullet points:"],
    ["💡 اشرح ببساطة", "اشرح لي هذا المفهوم بطريقة بسيطة:"],
    ["🌱 Brainstorm", "Help me brainstorm ideas for:"],
    ["🐞 Debug", "Help me debug this error:"],
    ["🔤 ترجم", "ترجم هذا النص إلى العربية:"],
  ];
  chips.innerHTML = prompts.map(([label, val]) =>
    `<button class="gxd-corner-chip" data-prompt="${esc(val)}">${esc(label)}</button>`).join("");
  chips.addEventListener("click", (e) => {
    const btn = e.target.closest(".gxd-corner-chip");
    if (!btn) return;
    const input = $("promptInput");
    if (!input) return;
    input.value = btn.dataset.prompt + " ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    $("btnCloseDrawer") && $("btnCloseDrawer").click();
  });
}

function wireDynamicColor() {
  const toggle = $("dynColorToggle");
  const swatch = $("dynColorSwatch");
  if (!toggle || !window.LATIF_ANDROID) return;
  toggle.checked = window.LATIF_ANDROID.isDynamicColorOn();
  const hex = localStorage.getItem("latif_dynamic_color_hex");
  if (swatch) swatch.style.background = hex || "linear-gradient(135deg,#C8A84B,#D4782A)";
  toggle.addEventListener("change", (e) => {
    window.LATIF_ANDROID.enableDynamicColor(e.target.checked);
    toast(e.target.checked
      ? (hex ? "Using system dynamic color" : "Enabled — waiting for the app shell to report a color")
      : "Dynamic color off");
  });
}

function wire() {
  const aT = $("gxAmbientToggle"), fT = $("gxFocusToggle");
  if (aT) aT.addEventListener("change", (e) => {
    window.LATIF.setAmbient(e.target.checked);
    toast(e.target.checked ? "Adaptive background music on" : "Background music off");
  });
  if (fT) fT.addEventListener("change", (e) => {
    window.LATIF.engine.applyFocus(e.target.checked);
    toast(e.target.checked ? "Focus mode on" : "Focus mode off");
  });

  const fxSeg = $("fxSeg");
  if (fxSeg) {
    fxSeg.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.LATIF_FX.setLevel(btn.dataset.fx);
        fxSeg.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
        toast(`Shader FX: ${btn.textContent.trim()}`);
      });
    });
  }

  window.addEventListener("gx:fxautodrop", (e) => {
    toast(`Shader FX auto-lowered to ${e.detail.level} (low fps)`);
    renderToggles();
  });

  wireCorner();
  wireDynamicColor();

  const modal = $("settingsModal");
  if (modal) {
    new MutationObserver(() => { if (modal.classList.contains("open")) render(); })
      .observe(modal, { attributes: true, attributeFilter: ["class"] });
  }
  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
else wire();

})();
