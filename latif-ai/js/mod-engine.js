/* ════════════════════════════════════════════════════════════════
   LATIF AI — GX MOD ENGINE
   Opera GX-style mod system: manifest-driven theming, live wallpaper,
   WebGL shader background, procedural soundscape, glassmorphism + depth.

   Public API (also on window):
     LATIF.loadMod(name)      → load a mod package from /mods/<name>/manifest.json
     LATIF.unloadMod()        → revert to the app's native theme
     LATIF.listMods()         → array of registered mod ids
     LATIF.setSound(on)       → enable/disable the soundscape engine
     LATIF.setAmbient(on)     → enable/disable background ambient
     LATIF.toggleFocus()      → toggle Focus Mode (dim + contrast)
     window.loadLATIFMod(n)   → alias for LATIF.loadMod (blueprint compat)
   ════════════════════════════════════════════════════════════════ */

(function () {
"use strict";

/* Mods that ship with the app. Add an id here + a folder under /mods/. */
const REGISTRY = ["underwave", "synthwave"];

const LS = {
  mod:     "latif_gx_mod",       // "" = native theme
  sound:   "latif_gx_sound",     // "true"/"false"
  ambient: "latif_gx_ambient",   // "true"/"false"
  focus:   "latif_gx_focus",     // "true"/"false"
};

class LATIFModEngine {
  constructor() {
    this.currentMod = null;
    this.modName = null;
    this.audioCtx = null;
    this.masterGain = null;
    this.ambientNodes = null;
    this.soundBuffers = new Map();   // url -> AudioBuffer (or "synth")
    this.soundEnabled  = localStorage.getItem(LS.sound)   !== "false";
    this.ambientEnabled = localStorage.getItem(LS.ambient) === "true";
    this.shader = null;              // { raf, gl, canvas }
    this.wallpaperScript = null;
    this._uiBound = false;
    this._audioUnlocked = false;
  }

  base(file) { return `mods/${this.modName}/${file}`; }

  /* ───────── LOAD / UNLOAD ───────── */
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
    this.currentMod = manifest;
    this.modName = name;

    this.injectTheme(manifest.theme || {});
    this.injectTypography(manifest.typography || {});
    this.injectEffects(manifest.effects || {});
    document.documentElement.classList.add("gx-active");
    document.documentElement.setAttribute("data-gx-mod", name);

    this.loadWallpaper(manifest.wallpaper);
    this.initShaders(manifest.shaders);
    this.prepareSounds(manifest.sounds || {});
    this.bindUISounds();

    localStorage.setItem(LS.mod, name);
    this.applyFocus(localStorage.getItem(LS.focus) === "true");
    this._emit("modloaded", { name, manifest });
    return manifest;
  }

  unloadMod() {
    this._teardownVisuals();
    this.stopAmbient();
    const root = document.documentElement;
    root.classList.remove("gx-active");
    root.removeAttribute("data-gx-mod");
    // Clear injected custom props
    [...root.style].filter((p) => p.startsWith("--gx-")).forEach((p) => root.style.removeProperty(p));
    root.style.removeProperty("--gx-vignette-shadow");
    document.body.style.removeProperty("font-family");
    this.currentMod = null;
    this.modName = null;
    localStorage.setItem(LS.mod, "");
    this._emit("modunloaded", {});
  }

  _teardownVisuals() {
    if (this.shader) {
      cancelAnimationFrame(this.shader.raf);
      if (this.shader.canvas) this.shader.canvas.remove();
      this.shader = null;
    }
    const wp = document.getElementById("gx-live-wallpaper");
    if (wp) wp.remove();
    if (window.__gxWallpaperStop) { try { window.__gxWallpaperStop(); } catch (_) {} window.__gxWallpaperStop = null; }
    if (this.wallpaperScript) { this.wallpaperScript.remove(); this.wallpaperScript = null; }
  }

  /* ───────── THEME / TYPOGRAPHY / EFFECTS ───────── */
  injectTheme(theme) {
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, val]) => {
      root.style.setProperty(`--gx-${key.replace(/_/g, "-")}`, val);
    });
  }

  injectTypography(typo) {
    const root = document.documentElement;
    if (typo.font_family) {
      root.style.setProperty("--gx-font-family", typo.font_family);
      document.body.style.fontFamily = typo.font_family;
    }
    if (typo.font_size_scale) {
      root.style.setProperty("--gx-font-scale", String(typo.font_size_scale));
    }
  }

  injectEffects(fx) {
    const root = document.documentElement;
    if (fx.glass_blur)     root.style.setProperty("--gx-blur", fx.glass_blur);
    if (fx.glass_opacity != null) root.style.setProperty("--gx-opacity", String(fx.glass_opacity));
    if (fx.vignette != null)      root.style.setProperty("--gx-vignette", String(fx.vignette));
    if (fx.glow_intensity != null) root.style.setProperty("--gx-glow-intensity", String(fx.glow_intensity));
    if (fx.animation_speed != null) root.style.setProperty("--gx-anim-speed", String(fx.animation_speed));
    const v = fx.vignette != null ? fx.vignette : 0.4;
    root.style.setProperty("--gx-vignette-shadow", `inset 0 0 200px rgba(0,0,0,${v})`);
  }

  /* ───────── LIVE WALLPAPER ───────── */
  loadWallpaper(wallpaper) {
    if (!wallpaper) return;
    if (wallpaper.type === "live" && wallpaper.source) {
      const script = document.createElement("script");
      script.src = this.base(wallpaper.source);
      script.dataset.gx = "wallpaper";
      script.onerror = () => console.warn("[GX] wallpaper script failed to load");
      document.head.appendChild(script);
      this.wallpaperScript = script;
    } else if (wallpaper.type === "video" && wallpaper.source) {
      const video = document.createElement("video");
      video.id = "gx-live-wallpaper";
      video.src = this.base(wallpaper.source);
      video.autoplay = video.loop = video.muted = video.playsInline = true;
      video.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;pointer-events:none;";
      document.body.prepend(video);
    }
  }

  /* ───────── WEBGL SHADER BACKGROUND ───────── */
  initShaders(shaders) {
    if (!shaders) return;
    const src = shaders.midnight || shaders.main || Object.values(shaders).find((v) => typeof v === "string" && v.endsWith(".frag"));
    if (!src) return;
    const canvas = document.createElement("canvas");
    canvas.id = "gx-shader-bg";
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;";
    document.body.prepend(canvas);
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) { console.warn("[GX] WebGL unavailable — skipping shader"); canvas.remove(); return; }
    const intensity = shaders.intensity != null ? shaders.intensity : 0.7;
    fetch(this.base(src)).then((r) => r.text())
      .then((frag) => this._runShader(gl, canvas, frag, intensity))
      .catch((e) => { console.warn("[GX] shader fetch failed:", e.message); canvas.remove(); });
  }

  _runShader(gl, canvas, fragSource, intensity) {
    const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const compile = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("[GX] shader compile error:", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, fragSource);
    if (!vs || !fs) { canvas.remove(); return; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn("[GX] link error"); canvas.remove(); return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const pLoc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes  = gl.getUniformLocation(prog, "u_resolution");
    const uInt  = gl.getUniformLocation(prog, "u_intensity");

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      canvas.width  = Math.floor(canvas.clientWidth  * dpr) || window.innerWidth;
      canvas.height = Math.floor(canvas.clientHeight * dpr) || window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const start = performance.now();
    const state = { raf: 0, gl, canvas };
    const draw = () => {
      const t = (performance.now() - start) / 1000;
      if (uTime) gl.uniform1f(uTime, t);
      if (uRes)  gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uInt)  gl.uniform1f(uInt, intensity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      state.raf = requestAnimationFrame(draw);
    };
    draw();
    this.shader = state;
  }

  /* ───────── SOUNDSCAPE (Web Audio, procedural fallback) ───────── */
  ensureAudio() {
    if (this.audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.audioCtx = new Ctx();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 0.6;
    this.masterGain.connect(this.audioCtx.destination);
  }

  _unlockAudioOnce() {
    if (this._audioUnlocked) return;
    this.ensureAudio();
    if (this.audioCtx && this.audioCtx.state === "suspended") this.audioCtx.resume();
    this._audioUnlocked = true;
    if (this.ambientEnabled && this.currentMod && this.currentMod.sounds && this.currentMod.sounds.ambient) {
      this.startAmbient(this.currentMod.sounds.ambient);
    }
  }

  prepareSounds(sounds) {
    this._sounds = sounds;
    // No eager preloading — files are fetched lazily on first play (and any
    // missing file is cached as a synth fallback). This keeps a mod silent at
    // load time and avoids 404 noise when a mod ships without binary audio.
  }

  async _preload(url) {
    if (this.soundBuffers.has(url)) return this.soundBuffers.get(url);
    this.ensureAudio();
    if (!this.audioCtx) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("missing");
      const arr = await res.arrayBuffer();
      const buf = await this.audioCtx.decodeAudioData(arr);
      this.soundBuffers.set(url, buf);
      return buf;
    } catch (_) {
      this.soundBuffers.set(url, "synth");   // mark as synth fallback
      return "synth";
    }
  }

  bindUISounds() {
    // Unlock audio + play UI sounds — bound once, driven by manifest each time.
    const gesture = () => this._unlockAudioOnce();
    if (!this._uiBound) {
      document.addEventListener("pointerdown", gesture, { once: false });
      document.addEventListener("click", (e) => {
        if (!this.soundEnabled) return;
        const el = e.target.closest("button, .suggest-chip, .seg-btn, .dd-item, .attach-row, .history-item, [data-sound-click]");
        if (el) this.play("click");
      }, true);
      document.addEventListener("pointerover", (e) => {
        if (!this.soundEnabled) return;
        const el = e.target.closest && e.target.closest("button, a, .suggest-chip, [data-sound-hover]");
        if (el) this.play("hover", 0.12);
      }, true);
      // typing tick
      document.addEventListener("keydown", (e) => {
        if (!this.soundEnabled) return;
        const t = e.target;
        if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT") && e.key.length === 1) {
          this.play("typing", 0.08);
        }
      }, true);
      this._uiBound = true;
    }
  }

  play(kind, gainScale = 0.3) {
    if (!this.soundEnabled) return;
    this.ensureAudio();
    if (!this.audioCtx) return;
    if (this.audioCtx.state === "suspended") this.audioCtx.resume();
    const file = this._sounds && this._sounds[kind];
    const url = file ? this.base(file) : null;
    let buf = url ? this.soundBuffers.get(url) : "synth";
    // First time we see this url: kick off a lazy load, play synth for now.
    if (url && buf === undefined) { this._preload(url).catch(() => {}); buf = "synth"; }
    if (buf && buf !== "synth") {
      const src = this.audioCtx.createBufferSource();
      const g = this.audioCtx.createGain();
      g.gain.value = gainScale;
      src.buffer = buf; src.connect(g); g.connect(this.masterGain); src.start();
    } else {
      this._synth(kind, gainScale);
    }
  }

  // Procedural UI blips so a mod works with zero binary audio assets.
  _synth(kind, gainScale) {
    const ac = this.audioCtx, now = ac.currentTime;
    const theme = { click: [520, 0.06, "triangle"], hover: [760, 0.04, "sine"],
                    typing: [300, 0.03, "square"], notification: [880, 0.18, "sine"] }[kind]
                  || [440, 0.06, "sine"];
    const [freq, dur, type] = theme;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.6), now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gainScale, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(now); osc.stop(now + dur + 0.02);
  }

  /* ───────── AMBIENT ───────── */
  async startAmbient(file) {
    this.ensureAudio();
    if (!this.audioCtx) return;
    if (this.audioCtx.state === "suspended") await this.audioCtx.resume();
    this.stopAmbient();
    const url = file ? this.base(file) : null;
    let buf = url ? await this._preload(url) : "synth";
    if (buf && buf !== "synth") {
      const src = this.audioCtx.createBufferSource();
      const g = this.audioCtx.createGain();
      src.buffer = buf; src.loop = true;
      g.gain.value = 0.18;
      src.connect(g); g.connect(this.masterGain); src.start();
      this.ambientNodes = { stop: () => { try { src.stop(); } catch (_) {} } };
    } else {
      this.ambientNodes = this._synthAmbient();
    }
  }

  // Soft evolving drone pad as ambient fallback.
  _synthAmbient() {
    const ac = this.audioCtx;
    const g = ac.createGain(); g.gain.value = 0.05; g.connect(this.masterGain);
    const oscs = [110, 164.81, 220].map((f, i) => {
      const o = ac.createOscillator();
      o.type = i === 2 ? "sine" : "triangle";
      o.frequency.value = f;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03;
      const lfoGain = ac.createGain(); lfoGain.gain.value = 2;
      lfo.connect(lfoGain); lfoGain.connect(o.frequency);
      o.connect(g); o.start(); lfo.start();
      return { o, lfo };
    });
    return { stop: () => oscs.forEach(({ o, lfo }) => { try { o.stop(); lfo.stop(); } catch (_) {} }) };
  }

  stopAmbient() {
    if (this.ambientNodes) { this.ambientNodes.stop(); this.ambientNodes = null; }
  }

  /* ───────── TOGGLES ───────── */
  setSound(on) {
    this.soundEnabled = !!on;
    localStorage.setItem(LS.sound, String(this.soundEnabled));
    if (on) this._unlockAudioOnce();
  }
  setAmbient(on) {
    this.ambientEnabled = !!on;
    localStorage.setItem(LS.ambient, String(this.ambientEnabled));
    if (on) {
      this._unlockAudioOnce();
      if (this.currentMod && this.currentMod.sounds) this.startAmbient(this.currentMod.sounds.ambient);
    } else {
      this.stopAmbient();
    }
  }
  applyFocus(on) {
    document.documentElement.classList.toggle("gx-focus-mode", !!on);
    localStorage.setItem(LS.focus, String(!!on));
  }
  toggleFocus() {
    const on = !document.documentElement.classList.contains("gx-focus-mode");
    this.applyFocus(on);
    return on;
  }

  listMods() { return REGISTRY.slice(); }

  _emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent("gx:" + name, { detail })); } catch (_) {}
  }
}

/* ───────── BOOTSTRAP ───────── */
const engine = new LATIFModEngine();
window.LATIF = {
  engine,
  loadMod:   (n) => engine.loadMod(n),
  unloadMod: () => engine.unloadMod(),
  listMods:  () => engine.listMods(),
  setSound:  (v) => engine.setSound(v),
  setAmbient:(v) => engine.setAmbient(v),
  toggleFocus: () => engine.toggleFocus(),
  isSoundOn: () => engine.soundEnabled,
  isAmbientOn: () => engine.ambientEnabled,
  isFocusOn: () => document.documentElement.classList.contains("gx-focus-mode"),
  currentMod: () => engine.modName,
};
window.loadLATIFMod = (n) => engine.loadMod(n);   // blueprint-compatible alias

// Auto-apply the last selected mod on startup (default: underwave).
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem(LS.mod);
  const initial = saved === null ? "underwave" : saved;   // first run → underwave
  if (initial) engine.loadMod(initial);
});

})();
