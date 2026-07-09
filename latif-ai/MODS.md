# LATIF AI — GX Mod System

An Opera GX–style, manifest-driven theming layer for the LATIF AI web app.
A single `manifest.json` per mod restyles the **entire** app — colors, live
wallpaper, WebGL shader glow, glassmorphism, dynamic depth, and sounds — with
zero changes to the core app code.

## Try it

Serve the folder over HTTP (mods are loaded with `fetch`, so `file://` won't work):

```bash
cd latif-ai
python3 -m http.server 8099
# open http://127.0.0.1:8099
```

The last-used mod auto-applies on startup (first run → **Underwave**).
Switch or disable mods from **Connection & Settings → GX Mods**.

## Console API

```js
loadLATIFMod('synthwave');   // load a mod by folder name
LATIF.unloadMod();           // back to the app's native theme
LATIF.listMods();            // ['underwave', 'synthwave']
LATIF.setSound(true);        // UI interaction sounds
LATIF.setAmbient(true);      // looping background soundscape
LATIF.toggleFocus();         // dim chrome, sharpen the conversation
LATIF.currentMod();          // active mod id, or null
```

## Anatomy of a mod

```
mods/<name>/
├── manifest.json      # THE core file — theme, wallpaper, shader, sounds, effects
├── wallpaper.js       # live <canvas> background (self-cleans via window.__gxWallpaperStop)
├── shaders/*.frag     # WebGL fragment shader (uniforms: u_time, u_resolution, u_intensity)
└── sounds/*.mp3       # optional — procedurally synthesized if absent
```

### How the theme reaches the whole UI

The engine (`js/mod-engine.js`) reads `manifest.theme` and injects `--gx-*`
custom properties onto `:root`, then adds `class="gx-active"` to `<html>`.
`css/gx-mods.css` **remaps** those onto the app's native design tokens
(`--bg`, `--surface*`, `--gold`, `--text`, …), so existing panels, buttons,
bubbles, drawer and modal all restyle at once — and revert instantly when the
mod is unloaded.

### Registering a new mod

1. Create `mods/mymod/manifest.json` (copy an existing one).
2. Add optional `wallpaper.js` and `shaders/*.frag`.
3. Add the folder name to the `REGISTRY` array at the top of
   `js/mod-engine.js` so it shows up in Settings.

### Sounds

Every sound key in the manifest works **without** binary assets: if the file
is missing, the engine synthesizes it with the Web Audio API (short oscillator
blips for UI events, a soft evolving drone for ambient). Drop real `.mp3`/`.ogg`
files into `sounds/` to override. Audio unlocks on the first user gesture per
browser autoplay rules.

## Bundled mods

| Mod        | Vibe                                             |
|------------|--------------------------------------------------|
| Underwave  | Deep midnight, hot-pink & cyan glow, particle mesh |
| Synthwave  | Retro sunset, magenta/orange neon horizon grid   |
