# LATIF AI — Architecture & WebToApp Packaging

What was built, mapped to each stage of the GX build report, plus exactly
how to drop this into a **WebToApp** (Android Studio WebView wrapper)
project.

## Stage-by-stage mapping

| Report stage | Shipped as |
|---|---|
| **1. Core shell / GX visual parity** | `css/gx-design.css` — real GX tokens (`#fa1e4e` accent, angular `clip-path` panels, glow borders, scanline overlay, Underwave animated backdrop, hex pattern, LATIF Corner). Layered on top of the existing mobile-first shell (topbar/drawer/input) rather than a desktop sidebar rail — this app targets a phone, so the rail concept became the drawer + Corner panel instead. |
| **2. GX Mods engine** | `js/mod-engine.js` (v2) — consumes Opera's real `mod.payload` schema (theme HSL, wallpaper, shaders, sounds). See `MODS.md` for the full schema and the 3 bundled mods. |
| **3. Audio + Shaders** | `js/audio-engine.js` — all 13 `browser_sounds` + 4 `keyboard_sounds` events, procedural Web Audio synthesis with zero shipped assets, adaptive `background_music` (vertical remixing). `js/fx-shader.js` — WebGL scanline/vignette/aberration/grain overlay, Off/Low/Med/High, fps-based auto-fallback to CSS-only. |
| **4. Live monitor + Voice** | `backend/stats.py` (FastAPI, Termux) → `js/stats-gauges.js` renders radial CPU/RAM/battery/Ollama-VRAM gauges in Settings → System Monitor, hidden gracefully if the backend isn't running. `backend/transcribe.py` (whisper.cpp wrapper) → `js/voice-backend.js` adds an offline Arabic/English "Record & Transcribe" control alongside the existing browser Web Speech mic. |
| **5. Packaging** | `manifest.json` (installable PWA: 192/512/maskable icons, `display: standalone`), `sw.js` (cache-first shell, network-passthrough for local APIs), `backend/start-latif.sh` (Termux:Boot autostart for Ollama + both backends). |

`app.js` is **never modified** — every new behavior (mods, sounds, shaders,
gauges, voice backend, corner panel) is wired externally via `document`
listeners on existing element ids/classes. This keeps the original chat/
streaming/settings logic byte-identical and easy to diff against upstream.

## File tree

```
latif-ai/
  index.html  style.css  app.js          (app.js untouched)
  manifest.json  sw.js  icon.svg
  icons/            192, 512, maskable-512 PNGs
  css/
    gx-design.css     always-on GX shell (tokens, panels, scanline, corner, gauges)
    gx-mods.css       mod theme → native token remap + glass/depth
  js/
    mod-engine.js     Opera-schema mod loader
    audio-engine.js   17 sound events, procedural + file playback
    fx-shader.js      WebGL FX overlay
    gx-settings.js    Settings panel wiring (mods/FX/ambient/focus/corner)
    stats-gauges.js   Termux monitor polling + gauges
    voice-backend.js  whisper.cpp record/transcribe control
  mods/
    underwave/  synthwave/  matrix-green/     (manifest + wallpaper.js + shader)
  backend/
    stats.py  transcribe.py  requirements.txt  start-latif.sh
  MODS.md  ARCHITECTURE.md
```

## WebToApp packaging

1. Copy the **entire contents** of `latif-ai/` into your WebToApp project's
   `app/src/main/assets/www/` folder (keep the same relative structure —
   `css/`, `js/`, `mods/`, `icons/` must sit next to `index.html`).
2. In `AndroidManifest.xml`, request:
   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.RECORD_AUDIO" />
   <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
   ```
3. **Secure-context requirement (important):** service workers and
   `getUserMedia` (mic input) only work in a *secure context*. Loading
   `assets/www/index.html` via a bare `file://` URL is **not** secure and
   silently breaks the service worker + mic recording. Use
   `WebViewAssetLoader` to serve the assets from
   `https://appassets.androidplatform.net/assets/www/...` instead — this is
   the standard WebToApp pattern and Chrome/WebView treats it as secure.
4. Enable JavaScript, DOM storage, and mixed content as needed:
   ```kotlin
   webView.settings.javaScriptEnabled = true
   webView.settings.domStorageEnabled = true
   ```
5. Grant the mic permission programmatically — override
   `WebChromeClient.onPermissionRequest` to grant `RESOURCE_AUDIO_CAPTURE`
   after the user accepts the Android runtime permission prompt (needed for
   both the built-in Web Speech mic and the whisper "Record & Transcribe"
   control).
6. Backend URLs (`http://127.0.0.1:11434` for Ollama, `:8000` for
   `stats.py`, `:8001` for `transcribe.py`) assume Termux services are
   already running on the **same device** — see `backend/start-latif.sh`
   for autostart via Termux:Boot. These are Settings-configurable, so a
   remote LAN backend (or, later, a real internet-hosted API once you move
   off Termux) works by just changing the host/port fields — no code
   changes required.

## What changes when you go from "local testing" to "internet + offline"

Nothing in this architecture is Termux-specific at the protocol level:
`js/mod-engine.js`, `audio-engine.js`, `fx-shader.js` have no network
dependency at all (fully offline). The three things that talk to a backend
— Ollama chat (`app.js`), System Monitor (`stats-gauges.js`), and whisper
voice (`voice-backend.js`) — all read their target URL from a Settings
field persisted to `localStorage`. Swapping Termux's `127.0.0.1` for a real
hosted endpoint later is a Settings change, not a rebuild.
