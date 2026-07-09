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

**V1** kept `app.js` untouched — every behavior above wires externally via
`document` listeners. **V2** (below) intentionally breaks that rule where a
capability genuinely lives in the chat request/response loop (backend
switching, tool calling, RAG, memory) — there's no honest way to add real
model-facing capability without editing the function that builds the
request. Everything that's a pure shell/UI concern (Android 16 alignment,
Settings wiring) still stays external, same as V1.

---

# LATIF GX V2 — nowadays AI capability + Android 16 shell alignment

## What's new

| Area | What it does | Where |
|---|---|---|
| **Multi-backend** | Switch between Ollama and llama.cpp's OpenAI-compatible `llama-server`, per Settings — different endpoint, request shape, and SSE-vs-NDJSON stream parsing. | `app.js`: `getEndpoint()`, `buildRequestBody()` |
| **Tool calling** | 4 built-in tools (calculator, current time, live system stats via `backend/stats.py`, memory search) using Ollama's native tool-calling. One non-streaming pre-check round detects `tool_calls`, executes them locally, feeds results back, then streams the real answer. Ollama backend only; off by default. | `app.js`: `TOOLS`, `executeTool()`, `safeEvalExpr()` (a tiny hand-written arithmetic parser — no `eval()`) |
| **RAG for attachments** | Attached files are chunked (~700 chars, 100 overlap, capped at 30 chunks/file), embedded via `/api/embeddings`, and the top-4 most relevant chunks are retrieved per question — instead of dumping the whole file into context every turn. Silently falls back to the old raw-dump behavior if no embedding model is pulled. | `app.js`: `ragChunkText()`, `ollamaEmbed()`, `ragIndexFile()`, `ragContextFor()` |
| **Long-term memory** | User-editable list of facts, auto-injected into the system prompt on every request, persisted across all chats. | `app.js` Settings wiring + `State.memory` |
| **Structured JSON output** | One toggle → `format:"json"` (Ollama) or `response_format:{type:"json_object"}` (OpenAI-shape). | `buildRequestBody()` |
| **Per-chat model pin** | "Pin to this chat only" checkbox in the model dropdown — override the model for one conversation without changing the global default. | `app.js`: `chat.model`, `populateModelLists()` |
| **Predictive back gesture** | Every overlay (drawer, settings, attach sheet, voice mode, dropdowns) is closed by the system/gesture back button instead of exiting the app — modeled as one coalesced history entry (see caveat below), not a naive per-overlay stack, specifically because this app has compound transitions (opening Settings from the drawer closes the drawer as a side effect in the same tick) that break a 1:1 model. | `js/android16.js` |
| **Large-screen / foldable layout** | Persistent two-pane shell above ~840px width (tablets, unfolded foldables, Chromebooks) — Android 16 pushes large-screen support hard. | `css/gx-design.css` `@media (min-width: 840px)` + `js/android16.js` |
| **Material You dynamic color** | `window.LATIF_ANDROID.setDynamicColor(hex, hex2)` — the native shell calls this with the OS's wallpaper-derived accent (Android 12+); persists and reapplies across reloads. | `js/android16.js` + Settings toggle |

## A real bug this pass caught and fixed

The large-screen layout exposed a genuine bug in the V1 shader system: the
foreground FX overlay's vignette formula was inverted (darkened the
**center** of the screen instead of the edges), and the three bundled
mods' own shaders (`midnight.frag`, `sunset.frag`, `phosphor.frag`) output
`alpha=1.0` — fully **opaque** — which is correct for a background
wallpaper but wrong for a layer composited on top of real UI. Both bugs
were invisible in the narrow mobile layout (important content sits far
from the shader's geometric center) and became a full blackout the moment
main content moved toward screen-center in the new two-pane layout. Fixed:
vignette now darkens edges, and all mod shaders output a bounded,
translucent alpha (≤0.55) — the colored glow atmosphere already comes from
each mod's `wallpaper.js` layer behind everything; the foreground shader's
job is only the subtle scanline/grain/vignette texture.

## Completing predictive back on the native side

The JS-side history-stack in `js/android16.js` is the correct web-layer
contribution, but the actual **swipe-preview animation** is an
Activity-level surface that WebView doesn't get automatically. To finish
it in the WebToApp shell:

```xml
<!-- AndroidManifest.xml, inside <application> or the relevant <activity> -->
<application android:enableOnBackInvokedCallback="true" ...>
```

```kotlin
// In the Activity hosting the WebView
onBackPressedDispatcher.addCallback(this) {
    if (webView.canGoBack()) webView.goBack() else finish()
}
```

This delegates the OS predictive-back gesture to the WebView's own history
(which `js/android16.js` keeps populated with one entry per open overlay
layer), so the system's back-preview animation plays for real, and
`webView.goBack()` triggers our `popstate` handler to close whatever's open.

## Known scope limits (documented, not silently dropped)

- Tool calling and RAG currently require the **Ollama** backend (both use
  Ollama-specific endpoints — `tools` on `/api/chat`, `/api/embeddings`).
  Switching to the llama.cpp backend disables both; the Settings hints say so.
- Predictive back is a **single coalesced layer**, not a true multi-level
  back stack — pressing back closes whatever overlay is currently open, but
  doesn't reconstruct a specific prior overlay if several were opened and
  closed via side effects in between. This is an intentional, honest
  trade-off for robustness (see the bug write-up above for why a stricter
  per-overlay model broke).
- The tool-calling loop executes **at most one round** of tool calls per
  message (no recursive/chained tool use) to keep behavior predictable and
  bounded.

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
7. **Add `android/xml/network_security_config.xml`** (included in this
   project) at `app/src/main/res/xml/network_security_config.xml` and
   reference it via `android:networkSecurityConfig="@xml/network_security_config"`
   on `<application>`. Without this, Android blocks the app's cleartext
   `http://127.0.0.1:...` requests to Ollama/whisper by default (API 28+) —
   see `TROUBLESHOOTING.md` if the app can't reach servers that work fine
   from `curl` inside Termux.

## What changes when you go from "local testing" to "internet + offline"

Nothing in this architecture is Termux-specific at the protocol level:
`js/mod-engine.js`, `audio-engine.js`, `fx-shader.js` have no network
dependency at all (fully offline). The three things that talk to a backend
— Ollama chat (`app.js`), System Monitor (`stats-gauges.js`), and whisper
voice (`voice-backend.js`) — all read their target URL from a Settings
field persisted to `localStorage`. Swapping Termux's `127.0.0.1` for a real
hosted endpoint later is a Settings change, not a rebuild.

---

# LATIF GX V3 — modular architecture, calendar, multimodal

See `CHANGELOG.md` for the full list. Two things worth expanding on here:

## `js/ai-core.js` — the new data/AI layer

`app.js` is a self-invoking IIFE, so its `State` object and helper
functions were never reachable from other files. `js/ai-core.js` declares
`State`, `saveState()`, `saveChats()`, `baseUrl()`, the RAG pipeline, tool
calling, and backend abstraction as **top-level** (non-IIFE-wrapped)
declarations in their own `<script>`, loaded before `app.js`. Classic
`<script>` tags share one global lexical scope in a page, so `app.js`'s
IIFE resolves `State` etc. via that outer scope exactly as if they were
still declared inline — zero call-site changes, real file separation.
`js/calendar.js` uses the same mechanism to read chat data, plus three
explicit `window.*` exports at the bottom of `app.js` (`renderChat`,
`closeDrawerGlobal`, `sendMessageFromReminder`) for the handful of things
it needs to trigger back inside app.js's UI layer.

## Calendar & Reminders — honest scope

`js/calendar.js`'s month grid and scheduled prompts work well for what a
web page can actually guarantee: reminders fire **while LATIF is open**
(foreground or a backgrounded tab/PWA), via a `setInterval` check. A web
page cannot wake itself once fully closed — there is no workaround for
that at the JS layer. To make reminders fire even when the app is fully
closed, the WebToApp native shell needs to own the schedule instead:
`AlarmManager`/`WorkManager` sets a real OS alarm that either launches the
Activity with a deep-link (`latif://reminder?id=...`) for `calendar.js` to
pick up on load, or fires a native notification directly. This is future
native-side work, not something fixable from the web layer — documented
here so it isn't silently assumed to already work.
