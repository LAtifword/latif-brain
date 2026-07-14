# Roadmap

The original brief for AgentOS describes a very large product — a full
offline AI operating system with nine agents, a visual workflow builder,
a plugin marketplace, ASR/TTS pipelines, video/music generation, and an
embedded on-device backend. That is realistically months of work across
multiple specialists, not something one pass can deliver as real, working
code. This roadmap tracks it honestly in stages, building on the working
foundation already in this repo (orchestrator, Chat Agent, dashboard,
system monitor, model manager).

## Done

- [x] FastAPI backend skeleton: config, SQLite schema, orchestrator, REST +
      WebSocket API layer.
- [x] Real system monitor (CPU/RAM/disk via `psutil`, GPU presence check).
- [x] Model manager: GGUF discovery, RAM estimation, llama.cpp load/unload,
      honest "engine unavailable" reporting when `llama-cpp-python` isn't
      installed.
- [x] Chat Agent: streaming local inference, conversation memory in SQLite.
- [x] Flutter dashboard matching the reference layout, wired to real data.
- [x] Flutter chat screen with real token streaming.
- [x] Agent directory reporting true `online` / `offline` / `not_implemented`
      status per agent.
- [x] Local PIN auth (bcrypt hash server-side).

## Next up (agents, roughly in order of reuse-ability from Chat Agent)

- [ ] **Code Agent** — reuses the Chat Agent's inference plumbing with a
      code-focused system prompt, plus sandboxed shell execution for
      running tests and a Git integration layer.
- [ ] **Project Agent** — task/roadmap CRUD backed by new SQLite tables;
      doesn't need a model at all to be useful, good next target.
- [ ] **Book Agent** — long-form generation with chapter-level memory;
      needs a context-compression strategy since GGUF context windows are
      finite.
- [ ] **Design Agent** — Flutter widget/theme generation; realistically
      needs either a code-tuned local model or a structured template
      system rather than freeform generation.
- [ ] **Audio Agent** — whisper.cpp integration for transcription, Silero
      VAD, speaker diarization. Different native dependency footprint than
      llama.cpp; will need its own model-manager-style component.
- [ ] **Music Agent** — MIDI/lyrics generation; smallest realistic scope
      is lyrics-only via the existing LLM, deferring audio synthesis.
- [ ] **Video Agent** — storyboard/scene planning text generation is
      reachable soon; actual video generation is a much larger native
      dependency (diffusion models, ffmpeg pipeline) and should be scoped
      separately.
- [ ] **Aircraft Agent** — flight-calculation and maintenance-reference
      tooling; needs a defined data source (no invented aviation data).

## Platform work

- [ ] RAG / knowledge base: embeddings + a vector store (FAISS or
      ChromaDB) + document ingestion (PDF/DOCX/etc.) — needed before any
      agent can meaningfully answer "about this document."
- [ ] Workflow builder (visual node editor) — depends on having at least
      3-4 real agents to make node connections meaningful.
- [ ] Plugin system / marketplace.
- [ ] Embed the backend inside the Android app itself (Chaquopy or
      python-for-android) instead of requiring a separately-run process —
      the single biggest gap between "client that talks to a local
      backend" and "AI operating system that lives entirely on the
      phone."
- [ ] Biometric unlock (in addition to PIN), encrypted-at-rest chat
      history.
- [ ] CI: GitHub Actions running `pytest` (backend) and
      `flutter analyze && flutter test` (mobile) on every PR — the tests
      exist but were never run in the sandboxed environment this repo was
      first built in; wiring CI is how that gets caught going forward.

## Explicitly not started

Everything above that has no checkbox ticked is genuinely not implemented.
If the dashboard or agents screen shows an agent as anything other than
"Planned," that reflects real backend state — not aspiration.
