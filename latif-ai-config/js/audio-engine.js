/* ════════════════════════════════════════════════════════════════
   LATIF AI — AUDIO ENGINE
   Implements Opera GX's full sound-event surface:
     13 browser_sounds: CLICK, HOVER, HOVER_UP, IMPORTANT_CLICK,
       FEATURE_SWITCH_ON/OFF, LEVEL_UPGRADE, LIMITER_ON/OFF,
       SWITCH_TOGGLE, TAB_INSERT, TAB_CLOSE, TAB_SLASH
     4 keyboard_sounds: TYPING_LETTER, TYPING_SPACE, TYPING_BACKSPACE, TYPING_ENTER
   Every event works with ZERO shipped audio assets — procedural
   Web Audio synthesis is the default; a mod's manifest can override
   any event with real files (arrays of URLs, played in sequence).

   LATIF has no literal browser tabs, so tab events map to chat
   lifecycle:  TAB_INSERT = new chat, TAB_CLOSE = delete chat,
   TAB_SLASH = switch chat.  LIMITER_ON/OFF maps to Focus Mode.
   All bindings are pure DOM listeners on existing element ids/classes
   — app.js is never touched or required to expose anything.
   ════════════════════════════════════════════════════════════════ */

(function () {
"use strict";

const LS_MUSIC = "latif_gx_music_on";

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.musicNodes = null;
    this.musicEnabled = localStorage.getItem(LS_MUSIC) === "true";
    this.fileCache = new Map();      // url -> AudioBuffer | "missing"
    this.eventFiles = {};            // event name -> [urls] (from active mod)
    this.modBase = "";
    this.activity = 0;               // 0..1, drives adaptive music intensity
    this._activityDecay = null;
    this._bound = false;
  }

  ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.ratio.value = 8;
    this.master.connect(limiter); limiter.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);
  }

  unlock() {
    this.ensure();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    if (this.musicEnabled) this.startMusic();
  }

  /* ───────── configure from an active mod's manifest ───────── */
  configure(payload, base) {
    this.modBase = base || "";
    this.eventFiles = {};
    const b = (payload && payload.browser_sounds) || {};
    const k = (payload && payload.keyboard_sounds) || {};
    Object.assign(this.eventFiles, b, k);
    this._musicFiles = (payload && payload.background_music) || [];
    this.stopMusic();
    if (this.musicEnabled) this.startMusic();
  }

  reset() {
    this.eventFiles = {};
    this._musicFiles = [];
    this.modBase = "";
    this.stopMusic();
  }

  /* ───────── file resolution + playback ───────── */
  async _resolve(url) {
    if (this.fileCache.has(url)) return this.fileCache.get(url);
    this.ensure();
    if (!this.ctx) return "missing";
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("404");
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.fileCache.set(url, buf);
      return buf;
    } catch (_) {
      this.fileCache.set(url, "missing");
      return "missing";
    }
  }

  _pickFileFor(event) {
    const list = this.eventFiles[event];
    if (!list || !list.length) return undefined;   // absent/empty → synth
    const entry = list[Math.floor(Math.random() * list.length)];
    if (entry === "") return null;                 // explicit empty string → silence
    return this.modBase + entry;
  }

  async play(event, gainScale = 0.3) {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    this._bumpActivity();

    const file = this._pickFileFor(event);
    if (file === null) return;                      // mod explicitly silenced this event
    if (file) {
      const buf = await this._resolve(file);
      if (buf && buf !== "missing") {
        const src = this.ctx.createBufferSource();
        const g = this.ctx.createGain(); g.gain.value = gainScale;
        src.buffer = buf; src.connect(g); g.connect(this.master); src.start();
        return;
      }
    }
    this._synth(event, gainScale);
  }

  _bumpActivity() {
    this.activity = Math.min(1, this.activity + 0.12);
    clearTimeout(this._activityDecay);
    this._activityDecay = setTimeout(() => this._decayActivity(), 400);
    this._applyMusicIntensity();
  }
  _decayActivity() {
    this.activity = Math.max(0, this.activity - 0.15);
    this._applyMusicIntensity();
    if (this.activity > 0) this._activityDecay = setTimeout(() => this._decayActivity(), 400);
  }
  _applyMusicIntensity() {
    if (!this.musicGain) return;
    const target = this.musicEnabled ? 0.05 + this.activity * 0.09 : 0;
    this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.5);
  }

  /* ───────── procedural recipes (report §4) ───────── */
  _synth(event, gainScale) {
    const ac = this.ctx, now = ac.currentTime;
    const g = ac.createGain();
    g.connect(this.master);

    const tone = (freq, dur, type, decayTo) => {
      const osc = ac.createOscillator();
      osc.type = type; osc.frequency.setValueAtTime(freq, now);
      if (decayTo) osc.frequency.exponentialRampToValueAtTime(decayTo, now + dur);
      const eg = ac.createGain();
      eg.gain.setValueAtTime(0.0001, now);
      eg.gain.exponentialRampToValueAtTime(gainScale, now + 0.004);
      eg.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(eg); eg.connect(this.master);
      osc.start(now); osc.stop(now + dur + 0.02);
    };
    const noiseBurst = (dur, freq, q) => {
      const len = Math.max(1, Math.floor(ac.sampleRate * dur));
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource(); src.buffer = buf;
      const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = q || 1;
      const eg = ac.createGain();
      eg.gain.setValueAtTime(gainScale, now);
      eg.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(bp); bp.connect(eg); eg.connect(this.master);
      src.start(now); src.stop(now + dur + 0.02);
    };

    switch (event) {
      case "CLICK":              noiseBurst(0.025, 1500, 1.2); break;
      case "HOVER":               tone(660, 0.03, "sine", 880); break;
      case "HOVER_UP":            tone(880, 0.03, "sine", 660); break;
      case "IMPORTANT_CLICK":     tone(660, 0.06, "triangle", 990); setTimeout(() => tone(990, 0.08, "triangle", 1320), 40); break;
      case "FEATURE_SWITCH_ON":   tone(400, 0.09, "triangle", 800); break;
      case "FEATURE_SWITCH_OFF":  tone(800, 0.09, "triangle", 300); break;
      case "SWITCH_TOGGLE":       tone(500, 0.07, "square", 650); break;
      case "LEVEL_UPGRADE":       [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.12, "triangle"), i * 70)); break;
      case "LIMITER_ON":          tone(300, 0.14, "sawtooth", 150); break;
      case "LIMITER_OFF":         tone(150, 0.14, "sawtooth", 300); break;
      case "TAB_INSERT":          noiseBurst(0.05, 2200, 1.4); tone(880, 0.05, "sine", 1200); break;
      case "TAB_CLOSE":           noiseBurst(0.05, 900, 1.4); tone(600, 0.06, "sine", 300); break;
      case "TAB_SLASH":           noiseBurst(0.03, 1800, 2); break;
      case "TYPING_LETTER":       tone(180 + Math.random() * 80, 0.02, "square", 140); break;
      case "TYPING_SPACE":        noiseBurst(0.02, 500, 1); break;
      case "TYPING_BACKSPACE":    tone(220, 0.025, "square", 120); break;
      case "TYPING_ENTER":        tone(440, 0.05, "triangle", 660); break;
      default:                    tone(440, 0.05, "sine"); break;
    }
  }

  /* ───────── adaptive background music (vertical remixing) ───────── */
  async startMusic() {
    this.ensure();
    if (!this.ctx) return;
    this.stopMusic();
    const files = this._musicFiles || [];
    if (files.length) {
      const sources = [];
      for (const f of files.slice(0, 4)) {
        const buf = await this._resolve(this.modBase + f);
        if (buf && buf !== "missing") {
          const src = this.ctx.createBufferSource();
          src.buffer = buf; src.loop = true;
          src.connect(this.musicGain); src.start();
          sources.push(src);
        }
      }
      if (sources.length) { this.musicNodes = { stop: () => sources.forEach((s) => { try { s.stop(); } catch (_) {} }) }; return; }
    }
    this.musicNodes = this._synthMusic();
  }

  _synthMusic() {
    const ac = this.ctx;
    const notes = [110, 146.83, 164.81, 220];
    const oscs = notes.map((f, i) => {
      const o = ac.createOscillator();
      o.type = i % 2 ? "sine" : "triangle";
      o.frequency.value = f;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.04 + i * 0.02;
      const lfoGain = ac.createGain(); lfoGain.gain.value = 1.5;
      lfo.connect(lfoGain); lfoGain.connect(o.frequency);
      o.connect(this.musicGain); o.start(); lfo.start();
      return { o, lfo };
    });
    return { stop: () => oscs.forEach(({ o, lfo }) => { try { o.stop(); lfo.stop(); } catch (_) {} }) };
  }

  stopMusic() { if (this.musicNodes) { this.musicNodes.stop(); this.musicNodes = null; } }

  setMusic(on) {
    this.musicEnabled = !!on;
    localStorage.setItem(LS_MUSIC, String(this.musicEnabled));
    if (on) { this.unlock(); this.startMusic(); } else { this.stopMusic(); }
  }

  /* ───────── DOM bindings (event → sound), independent of app.js ───────── */
  bind() {
    if (this._bound) return;
    this._bound = true;
    const on = (target, type, handler, opts) => document.addEventListener(type, handler, opts);

    // Unlock audio on first gesture anywhere.
    document.addEventListener("pointerdown", () => this.unlock(), { once: true });

    on(document, "click", (e) => {
      const t = e.target;
      if (t.closest("#btnNewChat, #drawerNewChat")) return this.play("TAB_INSERT");
      if (t.closest("#actDelete")) return this.play("TAB_CLOSE");
      if (t.closest("#btnSend, #btnTestConn")) return this.play("IMPORTANT_CLICK");
      if (t.closest(".history-item")) return this.play("TAB_SLASH");
      if (t.closest(".seg-btn")) return this.play("SWITCH_TOGGLE");
      if (t.closest("button, .suggest-chip, .dd-item, .dd-model-item, .attach-row, .mod-card, .gxd-corner-chip")) return this.play("CLICK");
    }, true);

    on(document, "pointerover", (e) => {
      const t = e.target.closest && e.target.closest("button, a, .suggest-chip, .history-item");
      if (t) this.play("HOVER", 0.1);
    }, true);
    on(document, "pointerup", (e) => {
      const t = e.target.closest && e.target.closest("button, a, .suggest-chip");
      if (t) this.play("HOVER_UP", 0.08);
    }, true);

    on(document, "change", (e) => {
      const t = e.target;
      if (t.matches('input[type="checkbox"]')) {
        if (t.id === "gxFocusToggle") return this.play(t.checked ? "LIMITER_ON" : "LIMITER_OFF");
        this.play(t.checked ? "FEATURE_SWITCH_ON" : "FEATURE_SWITCH_OFF");
      }
    }, true);

    on(document, "keydown", (e) => {
      const t = e.target;
      if (!(t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT"))) return;
      if (e.key === "Enter") return this.play("TYPING_ENTER", 0.15);
      if (e.key === "Backspace") return this.play("TYPING_BACKSPACE", 0.12);
      if (e.key === " ") return this.play("TYPING_SPACE", 0.1);
      if (e.key.length === 1) return this.play("TYPING_LETTER", 0.09);
    }, true);

    // Perf preset step-up → LEVEL_UPGRADE
    const order = ["fast", "balanced", "quality"];
    on(document, "click", (e) => {
      const btn = e.target.closest && e.target.closest("#perfSeg .seg-btn");
      if (!btn) return;
      const prev = document.querySelector("#perfSeg .seg-btn.active");
      const prevIdx = prev ? order.indexOf(prev.dataset.perf) : -1;
      const nextIdx = order.indexOf(btn.dataset.perf);
      if (nextIdx > prevIdx) setTimeout(() => this.play("LEVEL_UPGRADE"), 10);
    }, true);
  }
}

const engine = new AudioEngine();
engine.bind();

window.LATIF_AUDIO = {
  engine,
  play: (event, gain) => engine.play(event, gain),
  setMusic: (on) => engine.setMusic(on),
  isMusicOn: () => engine.musicEnabled,
  unlock: () => engine.unlock(),
};

})();
