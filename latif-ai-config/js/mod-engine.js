/* ════════════════════════════════════════════════════════════════
   LATIF AI — GX MOD ENGINE v2
   Consumes Opera GX's REAL public mod schema (opera-gaming/gxmods):

     {
       name, description, developer:{name}, icons:{"512":...},
       manifest_version: 3, version,
       mod: {
         license, schema_version: 1,
         payload: {
           theme: { dark:{gx_accent:{h,s,l}, gx_secondary_base:{h,s,l},
                          gx_accent_2?:{h,s,l}},           // gx_accent_2 = LATIF extension
                    light:{ ... same shape ... } },
           wallpaper: { dark:{...}, light:{...} },
           shaders: { "<name>": { path, animation? } },     // GLSL, not SkSL — see MODS.md
           browser_sounds: { CLICK:[...], HOVER:[...], ... },  // 13 events
           keyboard_sounds: { TYPING_LETTER:[...], ... },      // 4 events
           background_music: [...],
           page_styles: [...]                               // not applicable offline; ignored
         }
       }
     }

   wallpaper.<variant> supports Opera's own shape (image / video +
   first_frame) PLUS a LATIF extension: {"type":"live","source":"x.js"}
   for a scripted <canvas> wallpaper — real GX mod zips still work,
   LATIF mods can additionally ship zero-asset animated wallpapers.

   Theme HSL is remapped onto the app's native design tokens (--bg,
   --gold, --text, …) via css/gx-mods.css so the WHOLE existing UI
   restyles, then layered with glass/depth as before.
   ════════════════════════════════════════════════════════════════ */

(function () {
"use strict";

const REGISTRY = ["underwave", "synthwave", "matrix-green"]; // mods/<id>/manifest.json

const LS = {
  mod:     "latif_gx_mod",
  focus:   "latif_gx_focus",
};

function hsl(o, fallback) {
  if (!o) return fallback;
  return `hsl(${o.h}, ${o.s}%, ${o.l}%)`;
}
function hslShift(o, dl) {
  if (!o) return null;
  const l = Math.max(0, Math.min(100, o.l + dl));
  return `hsl(${o.h}, ${o.s}%, ${l}%)`;
}
function isLightTheme() {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light";
}

class LATIFModEngine {
  constructor() {
    this.manifest = null;
    this.modName = null;
    this.payload = null;
    this._themeObserver = null;
  }

  base(file) { return `mods/${this.modName}/${file}`; }

  async loadMod(name) {
    if (!name) return this.unloadMod();
    let manifest;
    try {
      const res = await fetch(`mods/${name}/manifest.json`, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = await res.json();
    } catch (e) {
      console.warn(`[GX] Could not load mod "${name}":`, e.message);
      this._emit("moderror", { name, error: e.message });
      return null;
    }

    this._teardownVisuals();
    this.manifest = manifest;
    this.modName = name;
    this.payload = (manifest.mod && manifest.mod.payload) || {};

    document.documentElement.classList.add("gx-active");
    document.documentElement.setAttribute("data-gx-mod", name);

    this.applyThemeVariant();
    this._watchThemeVariant();
    this.loadWallpaper(this.payload.wallpaper);
    this.applyShader(this.payload.shaders);

    if (window.LATIF_AUDIO) window.LATIF_AUDIO.engine.configure(this.payload, `mods/${name}/`);

    localStorage.setItem(LS.mod, name);
    this._emit("modloaded", { name, manifest });
    return manifest;
  }

  unloadMod() {
    this._teardownVisuals();
    this._unwatchThemeVariant();
    const root = document.documentElement;
    root.classList.remove("gx-active");
    root.removeAttribute("data-gx-mod");
    [...root.style].filter((p) => p.startsWith("--gx-")).forEach((p) => root.style.removeProperty(p));
    this.manifest = null; this.modName = null; this.payload = null;
    if (window.LATIF_AUDIO) window.LATIF_AUDIO.engine.reset();
    if (window.LATIF_FX) window.LATIF_FX.engine.setModShader(null);
    localStorage.setItem(LS.mod, "");
    this._emit("modunloaded", {});
  }

  _teardownVisuals() {
    const wp = document.getElementById("gx-live-wallpaper");
    if (wp) wp.remove();
    if (window.__gxWallpaperStop) { try { window.__gxWallpaperStop(); } catch (_) {} window.__gxWallpaperStop = null; }
    if (this._wallpaperScript) { this._wallpaperScript.remove(); this._wallpaperScript = null; }
  }

  /* ───────── theme: dark/light HSL → native design tokens ───────── */
  applyThemeVariant() {
    if (!this.payload || !this.payload.theme) return;
    const variant = isLightTheme() ? "light" : "dark";
    const t = this.payload.theme[variant] || this.payload.theme.dark || {};
    const accent = t.gx_accent;
    const base = t.gx_secondary_base;
    const accent2 = t.gx_accent_2; // LATIF extension — secondary accent, optional

    const root = document.documentElement;
    if (accent) root.style.setProperty("--gx-accent-color", hsl(accent));
    if (accent2) root.style.setProperty("--gx-accent2-color", hsl(accent2));
    if (base) {
      root.style.setProperty("--gx-bg-color", hsl(base));
      root.style.setProperty("--gx-bg-elev-color", hslShift(base, 6));
      root.style.setProperty("--gx-bg-deep-color", hslShift(base, -8));
      root.style.setProperty("--gx-surface-color", hslAlpha(base, 6, 0.6));
      const dark = base.l < 50;
      root.style.setProperty("--gx-text-color", dark ? "hsl(0,0%,90%)" : "hsl(260,15%,15%)");
      root.style.setProperty("--gx-text2-color", dark ? "hsl(0,0%,70%)" : "hsl(260,10%,40%)");
      root.style.setProperty("--gx-border-color", accent ? hslAlpha(accent, 0, 0.30) : "rgba(255,255,255,.08)");
      root.style.setProperty("--gx-glow-color", accent ? hslAlpha(accent, 0, 0.35) : "rgba(250,30,78,.3)");
    }
  }

  _watchThemeVariant() {
    this._unwatchThemeVariant();
    this._themeObserver = new MutationObserver(() => this.applyThemeVariant());
    this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  _unwatchThemeVariant() {
    if (this._themeObserver) { this._themeObserver.disconnect(); this._themeObserver = null; }
  }

  /* ───────── wallpaper: Opera image/video shape + LATIF "live" extension ───────── */
  loadWallpaper(wallpaper) {
    if (!wallpaper) return;
    const variant = isLightTheme() ? "light" : "dark";
    const w = wallpaper[variant] || wallpaper.dark || wallpaper.light;
    if (!w) return;

    if (w.type === "live" && w.source) {
      const script = document.createElement("script");
      script.src = this.base(w.source);
      document.head.appendChild(script);
      this._wallpaperScript = script;
    } else if (w.image && /\.(webm|mp4)$/i.test(w.image)) {
      const video = document.createElement("video");
      video.id = "gx-live-wallpaper";
      video.src = this.base(w.image);
      if (w.first_frame) video.poster = this.base(w.first_frame);
      video.autoplay = video.loop = video.muted = video.playsInline = true;
      video.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;pointer-events:none;";
      document.body.prepend(video);
    } else if (w.image) {
      const img = document.createElement("img");
      img.id = "gx-live-wallpaper";
      img.src = this.base(w.image);
      img.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;pointer-events:none;";
      document.body.prepend(img);
    }
  }

  /* ───────── shader: first entry in payload.shaders drives the FX overlay ───────── */
  applyShader(shaders) {
    if (!window.LATIF_FX) return;
    if (!shaders || !Object.keys(shaders).length) { window.LATIF_FX.engine.setModShader(null); return; }
    const first = Object.values(shaders)[0];
    if (!first || !first.path) return;
    fetch(this.base(first.path)).then((r) => r.text())
      .then((src) => window.LATIF_FX.engine.setModShader(src))
      .catch(() => window.LATIF_FX.engine.setModShader(null));
  }

  listMods() { return REGISTRY.slice(); }

  _emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent("gx:" + name, { detail })); } catch (_) {}
  }
}

function hslAlpha(o, dl, a) {
  if (!o) return `rgba(250,30,78,${a})`;
  const l = Math.max(0, Math.min(100, o.l + dl));
  return `hsla(${o.h}, ${o.s}%, ${l}%, ${a})`;
}

/* ───────── BOOTSTRAP ───────── */
const engine = new LATIFModEngine();
window.LATIF = {
  engine,
  loadMod:   (n) => engine.loadMod(n),
  unloadMod: () => engine.unloadMod(),
  listMods:  () => engine.listMods(),
  currentMod: () => engine.modName,
  isSoundOn:   () => !!(window.LATIF_AUDIO), // sound is always available; kept for UI compat
  isAmbientOn: () => !!(window.LATIF_AUDIO && window.LATIF_AUDIO.isMusicOn()),
  setSound:  () => {},                        // per-event mute not exposed yet; reserved
  setAmbient:(v) => window.LATIF_AUDIO && window.LATIF_AUDIO.setMusic(v),
  isFocusOn: () => document.documentElement.classList.contains("gx-focus-mode"),
  toggleFocus: () => engine.applyFocus ? engine.applyFocus() : null,
};
window.loadLATIFMod = (n) => engine.loadMod(n);

engine.applyFocus = function (on) {
  const val = on === undefined ? !document.documentElement.classList.contains("gx-focus-mode") : !!on;
  document.documentElement.classList.toggle("gx-focus-mode", val);
  localStorage.setItem(LS.focus, String(val));
  return val;
};

document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem(LS.mod);
  const initial = saved === null ? "underwave" : saved;
  if (initial) engine.loadMod(initial);
  if (localStorage.getItem(LS.focus) === "true") document.documentElement.classList.add("gx-focus-mode");
});

})();
