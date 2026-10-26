# AgentOS

An offline-first local AI platform: a Flutter Android client talking to a
self-hosted FastAPI backend that runs local language models via llama.cpp.
No cloud AI provider is used anywhere in this stack.

This repository implements a real, working slice of a much larger vision
(see [ROADMAP.md](ROADMAP.md)) rather than a mockup of the whole thing.
**What's implemented actually works end-to-end; what isn't implemented is
labeled "planned" in the UI and in the API instead of being faked.**

## What's real today

- **Backend** (`backend/`): FastAPI app with a SQLite-backed orchestrator,
  9 registered agents, a real system monitor (`psutil`), a GGUF model
  manager for llama.cpp, and a working **Chat Agent** with token-streaming
  inference over WebSocket and persisted conversation history.
- **Mobile app** (`mobile/`): Flutter (Material 3, dark cyberpunk-green
  glassmorphism UI) with a live Dashboard, a working Chat screen wired to
  the backend's streaming WebSocket, an Agents directory that reports each
  agent's *real* status (`online` / `offline` / `not_implemented`), and
  Settings for backend connection + local PIN.
- **8 of the 9 agents on the dashboard are metadata-only today** (Code,
  Design, Project, Audio, Video, Book, Music, Aircraft). They render as
  "Planned — not implemented yet" in the app rather than pretending to
  work. Building each one out is tracked in the roadmap.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full breakdown. In short:

```
mobile/   Flutter client (feature-first: dashboard, chat, agents, settings)
backend/  FastAPI service (core, agents, services, api, ws)
```

The mobile app is a thin client: it never talks to a model directly. Every
agent capability lives in the backend behind a REST/WebSocket API, so the
same backend could later serve a desktop or web client too.

## Running it

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Optional, for real GGUF inference (native build required):
#   pip install llama-cpp-python
# Drop a .gguf model into backend/data/models/ before starting the server.
uvicorn app.main:app --host 0.0.0.0 --port 8765 --reload
```

Or just run `backend/scripts/run_dev.sh`.

Without `llama-cpp-python` installed or a `.gguf` file present, the backend
still starts and serves the dashboard, agent registry, and system stats —
the Chat Agent honestly reports itself `offline` with a clear reason
instead of faking a reply.

### Mobile app

```bash
cd mobile
flutter pub get
flutter run
```

On first launch, enter the backend's URL (e.g. `http://<your-lan-ip>:8765`).
Android emulators reach a host machine at `http://10.0.2.2:8765`; a
physical device needs the backend reachable on the same network.

## Verification status (read before trusting "it works")

This was built in a sandboxed environment with **no outbound access to
PyPI, the Ubuntu package mirror, or any Flutter/Dart toolchain** — only a
small allowlist of hosts (e.g. GitHub) was reachable. As a result:

- The **backend** was written and reviewed carefully, and every file
  passes `python3 -m py_compile`, but the actual test suite in
  `backend/tests/` and a live `uvicorn` boot **could not be executed** in
  this session — there was no way to install FastAPI/uvicorn/etc.
  **Run `pytest` yourself before relying on it.**
- The **mobile app** could not be built, `flutter analyze`d, or run —
  there is no Flutter/Dart SDK in this environment. The code was
  hand-reviewed for structural correctness (balanced braces, consistent
  imports, known-stable Flutter APIs), but **run `flutter pub get` and
  `flutter analyze` yourself before trusting it compiles.**

Please treat this as "carefully written, not yet machine-verified" and
run the test/build steps above in an environment with normal network
access before shipping.

## Security

- Local PIN auth: PINs are hashed with bcrypt (`passlib`) server-side and
  never stored in plaintext on the client.
- The backend has no cloud egress — it only serves the LAN/localhost.
- `AndroidManifest.xml` allows cleartext traffic because the backend is
  expected to run on plain HTTP on a local network; if you expose it
  beyond your LAN, put TLS in front of it.

## Attribution

`mobile/android/` started from the Android/Gradle scaffold of
[JHubi1/ollama-app](https://github.com/JHubi1/ollama-app) (Apache License
2.0); the application code itself (`mobile/lib/`, all of `backend/`) is
new. No license file has been added to this repository yet — add one that
matches how you intend to distribute AgentOS.
