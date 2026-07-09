# LATIF AI — GX Mod System (v2)

A manifest-driven theming layer that consumes **Opera GX's real, public mod
schema** (`opera-gaming/gxmods`), so real GX mod folders are structurally
compatible. A mod restyles the entire app — theme, live wallpaper, WebGL
shader, and 17 sound events — from a single `manifest.json`.

## Try it

Serve the folder over HTTP (mods load via `fetch`, so `file://` won't work):

```bash
cd latif-ai
python3 -m http.server 8099
# open http://127.0.0.1:8099
```

The last-used mod auto-applies on startup (first run → **Underwave**).
Switch mods, Shader FX intensity, background music and Focus Mode from
**Connection & Settings**.

## Console API

```js
loadLATIFMod('matrix-green');   // load a mod by folder name
LATIF.unloadMod();              // back to the app's native theme
LATIF.listMods();               // ['underwave','synthwave','matrix-green']
LATIF.currentMod();             // active mod id, or null
LATIF.setAmbient(true);         // adaptive background music
LATIF_FX.setLevel('high');      // 'off' | 'low' | 'med' | 'high'
LATIF_AUDIO.play('IMPORTANT_CLICK');
```

## Anatomy of a mod (Opera's real schema)

```
mods/<name>/
├── manifest.json
│   {
│     "name", "description", "developer": {"name"}, "manifest_version": 3, "version",
│     "mod": {
│       "license", "schema_version": 1,
│       "payload": {
│         "theme": {
│           "dark":  { "gx_accent": {h,s,l}, "gx_secondary_base": {h,s,l}, "gx_accent_2": {h,s,l} },
│           "light": { ... same shape ... }
│         },
│         "wallpaper": { "dark": {...}, "light": {...} },
│         "shaders": { "<label>": { "path": "shaders/x.frag" } },
│         "background_music": ["music/track.mp3", ...],
│         "browser_sounds": { "CLICK": [...], "HOVER": [...], ... },   // 13 events
│         "keyboard_sounds": { "TYPING_LETTER": [...], ... },          // 4 events
│         "page_styles": []
│       }
│     }
│   }
├── wallpaper.js       # LATIF extension: live <canvas> wallpaper (see below)
└── shaders/*.frag     # GLSL fragment shader (NOT SkSL — see caveat below)
```

`gx_accent_2` is a **LATIF extension** (a secondary accent color; Opera's
schema only defines one accent). Every `browser_sounds`/`keyboard_sounds`
entry is optional — an absent key or empty array falls back to **procedural
synthesis** (Web Audio oscillators/noise), so a mod works with zero shipped
audio. An explicit `""` entry in an array means silence, matching Opera's
own semantics.

### Theme → whole-app remap

`js/mod-engine.js` converts the active variant's HSL into `--gx-*-color`
CSS custom properties on `<html>`, and `css/gx-mods.css` remaps those onto
the app's native tokens (`--bg`, `--gold`, `--text`, …) — so every existing
panel, button, bubble, drawer and modal restyles at once, dark/light aware
(a `MutationObserver` re-applies the correct variant whenever you flip the
app's Dark/Light/AMOLED theme toggle).

### Wallpaper

Opera's own shape works (`image` PNG, or `video` `.webm` + `first_frame`
poster). LATIF adds a `"type": "live"` variant pointing at a `wallpaper.js`
script that paints a `<canvas id="gx-live-wallpaper">` — this is how the
bundled mods ship rich animated backgrounds with **zero binary assets**.

### Shaders

Real Opera GX shaders are **SkSL** (`-opera-shader(url(...))`), which is
Opera-internal and can't run in a standalone web app. LATIF mods ship plain
**GLSL ES fragment shaders** instead (uniforms: `u_time`, `u_resolution`,
`u_intensity`), rendered by `js/fx-shader.js` as a full-screen overlay.
Porting a real GX community shader means translating `iChunk.eval()`-style
SkSL calls to `texture2D`/procedural GLSL by hand.

### Sound event mapping

LATIF has no literal browser tabs, so the 3 tab events map to chat
lifecycle, and `LIMITER_ON/OFF` maps to Focus Mode:

| Opera event         | LATIF trigger                              |
|----------------------|---------------------------------------------|
| `CLICK`              | any button / menu item / mod card           |
| `HOVER` / `HOVER_UP`  | pointer enter/leave on interactive elements  |
| `IMPORTANT_CLICK`    | Send, Test Connection                        |
| `FEATURE_SWITCH_ON/OFF` | any settings toggle switch                |
| `SWITCH_TOGGLE`      | segmented control buttons (theme, perf mode) |
| `LEVEL_UPGRADE`      | Performance preset stepped up (Fast→Quality) |
| `LIMITER_ON/OFF`     | Focus Mode toggled on/off                    |
| `TAB_INSERT`         | New chat created                             |
| `TAB_CLOSE`          | Chat deleted                                 |
| `TAB_SLASH`          | Switching to a chat in history               |
| `TYPING_LETTER/SPACE/BACKSPACE/ENTER` | keystrokes in any text field |

All bindings are plain `document`-level DOM listeners in
`js/audio-engine.js` — `app.js` is never modified or required to expose
anything, so it stays byte-identical to the original app for easy diffing.

### Registering a new mod

1. Create `mods/mymod/manifest.json` (copy an existing one).
2. Add optional `wallpaper.js` and `shaders/*.frag`.
3. Add the folder name to the `REGISTRY` array at the top of
   `js/mod-engine.js`.

## Bundled mods

| Mod          | Vibe                                                  |
|--------------|--------------------------------------------------------|
| Underwave    | Opera GX's current design language — violet, crimson & cyan glow |
| Synthwave    | Retro sunset — magenta/orange neon horizon grid        |
| Matrix Green | Phosphor-green falling code rain on near-black         |
