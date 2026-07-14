/* ════════════════════════════════════════════════════════════════
   LATIF AI — SHADER FX OVERLAY
   Full-screen WebGL fragment-shader pass: scanlines + vignette +
   chromatic aberration + grain. A mod may supply its own GLSL path
   via manifest payload.shaders (first entry wins); otherwise a
   built-in combined CRT/GX effect runs.

   NOT Opera's SkSL — SkSL is Opera-internal (`-opera-shader`) and
   can't run in a standalone web app. LATIF mods ship plain GLSL ES
   fragment shaders instead; porting a real GX community shader means
   translating `iChunk.eval()`-style SkSL calls to `texture2D` calls.

   Intensity: Off / Low / Med / High (persisted). Auto-drops one level
   if measured fps stays under ~40 for 2s, and disables entirely with
   a pure-CSS scanline fallback if WebGL is unavailable.
   ════════════════════════════════════════════════════════════════ */

(function () {
"use strict";

const LS_INTENSITY = "latif_gx_fx";
const LEVELS = ["off", "low", "med", "high"];
const INTENSITY_VALUE = { off: 0, low: 0.35, med: 0.7, high: 1.0 };

// Pure procedural overlay (scanline + grain + vignette) — this pass has no
// scene texture to sample, it just darkens/adds noise atop the real UI below.
const OVERLAY_FRAG = `
precision mediump float;
uniform float u_time;
uniform vec2  u_resolution;
uniform float u_intensity;

float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  float scan = 0.08 * sin(uv.y * u_resolution.y * 3.14159) ;
  float grain = (hash(uv * u_resolution.xy + u_time) - 0.5) * 0.06;
  // Darken toward the EDGES, not the center — this is an overlay blended on
  // top of real UI content, so whatever sits at screen-center (chat text,
  // and especially the large-screen two-pane main content) must stay legible.
  float vig = smoothstep(0.35, 0.9, length(uv - 0.5));

  float darken = (abs(scan) * 0.5 + abs(grain) * 0.5 + vig * 0.35) * u_intensity;
  gl_FragColor = vec4(vec3(0.0), clamp(darken, 0.0, 0.6));
}
`;

class ShaderFX {
  constructor() {
    this.level = localStorage.getItem(LS_INTENSITY) || "med";
    this.canvas = null; this.gl = null; this.raf = 0;
    this.customSrc = null;
    this._fpsWindow = []; this._lastT = 0;
    this._cssOnly = false;
  }

  setLevel(level) {
    if (!LEVELS.includes(level)) return;
    this.level = level;
    localStorage.setItem(LS_INTENSITY, level);
    document.documentElement.classList.toggle("gxd-fx-off", level === "off");
    if (level === "off") { this._teardown(); return; }
    this._start();
  }

  setModShader(src) {
    this.customSrc = src || null;
    if (this.level !== "off") this._start();
  }

  _teardown() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.canvas) { this.canvas.remove(); this.canvas = null; this.gl = null; }
  }

  _start() {
    this._teardown();
    const canvas = document.createElement("canvas");
    canvas.id = "gx-fx-canvas";
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:5;pointer-events:none;mix-blend-mode:normal;";
    document.body.appendChild(canvas);
    this.canvas = canvas;

    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true }) ||
               canvas.getContext("experimental-webgl", { alpha: true });
    if (!gl) { this._cssFallback(); return; }
    this.gl = gl;
    this._cssOnly = false;
    document.documentElement.classList.remove("gxd-fx-css-only");

    const src = this.customSrc || OVERLAY_FRAG;
    if (!this._compile(gl, src)) {
      // Custom mod shader failed to compile — fall back to the built-in overlay.
      if (src !== OVERLAY_FRAG) this._compile(gl, OVERLAY_FRAG);
    }
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._loop();
  }

  _cssFallback() {
    this._teardown();
    this._cssOnly = true;
    document.documentElement.classList.add("gxd-fx-css-only");
    const overlay = document.getElementById("gxdScanlineOverlay");
    if (overlay) overlay.classList.add("on");
  }

  _compile(gl, fragSrc) {
    const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const mk = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("[GX-FX] shader compile error:", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = mk(gl.VERTEX_SHADER, VERT);
    const fs = mk(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const pLoc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

    this.prog = prog;
    this.uTime = gl.getUniformLocation(prog, "u_time");
    this.uRes  = gl.getUniformLocation(prog, "u_resolution");
    this.uInt  = gl.getUniformLocation(prog, "u_intensity");
    this.start = performance.now();
    return true;
  }

  _resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width  = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  _loop() {
    const gl = this.gl;
    if (!gl) return;
    const now = performance.now();
    if (this._lastT) {
      const fps = 1000 / (now - this._lastT);
      this._fpsWindow.push(fps);
      if (this._fpsWindow.length > 90) this._fpsWindow.shift();
      if (this._fpsWindow.length === 90) {
        const avg = this._fpsWindow.reduce((a, b) => a + b, 0) / 90;
        if (avg < 40) this._autoDrop();
      }
    }
    this._lastT = now;

    const t = (now - this.start) / 1000;
    gl.uniform1f(this.uTime, t);
    gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uInt, INTENSITY_VALUE[this.level] || 0.7);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.raf = requestAnimationFrame(() => this._loop());
  }

  _autoDrop() {
    const idx = LEVELS.indexOf(this.level);
    if (idx > 1) { // don't auto-drop below "low"
      this.setLevel(LEVELS[idx - 1]);
      window.dispatchEvent(new CustomEvent("gx:fxautodrop", { detail: { level: this.level } }));
    }
    this._fpsWindow = [];
  }
}

const fx = new ShaderFX();
window.LATIF_FX = {
  engine: fx,
  setLevel: (l) => fx.setLevel(l),
  getLevel: () => fx.level,
  levels: LEVELS,
};

document.addEventListener("DOMContentLoaded", () => {
  if (fx.level !== "off") fx.setLevel(fx.level);
});

})();
