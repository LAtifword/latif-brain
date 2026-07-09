# LATIF GX — Changelog

## V3 — Premium (current)
First release treated as the permanent application foundation, not a
prototype — every change from here targets scalability, reliability, and
maintainability, per the LATIF GX V3 production brief.

- **Modular architecture**: extracted state, persistence, RAG, tool
  calling, and backend abstraction out of `app.js` into `js/ai-core.js` —
  a real separation between "data model + AI capability" and "UI wiring."
- **Calendar & Reminders**: month-grid view of conversation activity
  (click a day to filter history), plus once/daily/weekly scheduled
  prompts with Notification support (`js/calendar.js`).
- **Multimodal expansion**: audio file attachments are transcribed via the
  whisper.cpp backend (same pipeline as live voice recording), not just
  live mic input.
- **Smarter default system prompt**: instructs best-effort interpretation
  of incomplete/ambiguous requests over blocking clarification questions,
  and offers concrete options only when genuinely ambiguous.
- **Production hygiene**: `package.json`, `CHANGELOG.md`, version bumped
  to 3.0.0 everywhere (`manifest.json`, about screen).
- **Premium feature-gating stub**: `isPremiumUnlocked()` in `js/ai-core.js`
  — a deliberate no-op pass-through. No monetization business rules (price,
  what's gated, trial logic) exist yet; this just gives a single call site
  to wire real gating into once those rules are defined.

## V2 — Real AI capability + Android 16 shell
- Multi-backend: Ollama or llama.cpp's OpenAI-compatible server.
- Tool calling (calculator, time, system stats, memory search) — Ollama only.
- RAG for attachments: chunk + embed + top-k retrieval instead of raw dumps.
- Long-term memory, structured JSON output, per-chat model pin.
- Android 16 shell alignment: predictive back gesture, large-screen/
  foldable two-pane layout, Material You dynamic color bridge.
- Fixed a shader bug (inverted vignette + opaque mod shaders) that the new
  large-screen layout exposed.

## V1 — GX mod system
- Opera GX's real public mod schema (`mod.payload`: theme HSL, wallpaper,
  shaders, sound events) — not a custom flat format.
- 17-event procedural audio engine (13 browser_sounds + 4 keyboard_sounds),
  zero shipped assets.
- WebGL shader FX overlay (scanline/vignette/grain), Off/Low/Med/High.
- Termux system monitor (`backend/stats.py`) and whisper.cpp voice backend
  (`backend/transcribe.py`).
- PWA installability: real icon set, service worker.
- Three bundled mods: Underwave, Synthwave, Matrix Green.
