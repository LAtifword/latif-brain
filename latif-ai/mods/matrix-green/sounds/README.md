# Mod sound assets

Drop optional audio files here to give a mod real recorded sound:

| manifest key   | file             | when it plays              |
|----------------|------------------|----------------------------|
| `ambient`      | `ambient.mp3`    | looping background music    |
| `click`        | `click.mp3`      | any button / control press  |
| `hover`        | `hover.mp3`      | hovering buttons & links    |
| `typing`       | `typing.mp3`     | key press in the composer   |
| `notification` | `notify.mp3`     | reserved for alerts         |

**No files required.** If a file is missing, the mod engine
(`js/mod-engine.js`) synthesizes the sound procedurally with the Web Audio
API — short oscillator blips for UI events and a soft evolving drone for
ambient — so every mod works out of the box with zero binary assets.

Formats: any browser-decodable audio (`.mp3`, `.ogg`, `.wav`, `.webm`).
Keep UI one-shots short (< 200 ms) and quiet; the engine mixes them at low gain.
