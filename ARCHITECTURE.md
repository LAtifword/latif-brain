# Architecture

## Overview

```
┌─────────────────────┐        HTTP + WebSocket        ┌──────────────────────┐
│   mobile/ (Flutter)  │  ───────────────────────────▶  │  backend/ (FastAPI)  │
│   thin client, no    │  ◀───────────────────────────  │  owns all AI state   │
│   model access        │        JSON / token streams    │  and inference        │
└─────────────────────┘                                 └──────────────────────┘
                                                                   │
                                                                   ▼
                                                          local GGUF model
                                                          via llama.cpp
```

The mobile app never embeds a model or talks to llama.cpp directly. Every
capability — chat, system stats, agent status, model management, PIN auth
— is a backend endpoint. This keeps the door open to a desktop/web client
sharing the same backend later, and keeps the mobile app's job simple:
render real backend state, never invent it.

## Backend (`backend/app`)

Feature-ish layering, not framework-first:

- `core/` — `config.py` (env-driven settings, no external deps),
  `database.py` (SQLite schema + connection helper via `aiosqlite`),
  `orchestrator.py` (the one place that knows which agents are real vs.
  metadata-only and reports their live status), `security.py` (PIN
  hashing via `passlib`/bcrypt).
- `agents/` — `definitions.py` lists all 9 agents' metadata (id, name,
  category, capabilities, `implemented` flag). `chat_agent.py` is the one
  agent with a real implementation: it streams llama.cpp output
  token-by-token off the event loop (via a worker thread + `asyncio.Queue`
  bridge, since llama.cpp's Python bindings are synchronous/blocking).
- `services/` — `system_monitor.py` (real `psutil` CPU/RAM/disk, GPU
  presence via `nvidia-smi` detection — no invented utilization numbers),
  `model_manager.py` (scans `data/models/*.gguf`, lazily imports
  `llama_cpp` and reports honestly if it isn't installed, estimates RAM
  needed per model), `activity_log.py` / `conversation_repo.py` (SQLite
  persistence).
- `api/` — one router module per resource (`system`, `agents`, `chat`,
  `models`, `activity`, `auth`), each thin and calling into `services`/
  `agents`.
- `ws/manager.py` — a small broadcast `ConnectionManager` used for the
  live system-stats push channel (`/api/system/ws`); the chat WebSocket
  (`/api/chat/ws/{conversation_id}`) is one-connection-per-conversation
  rather than broadcast, since replies are per-user.

### Why agents are metadata + one real implementation, not 9 fakes

Faking 8 more agents behind the same chat model would violate the point of
the exercise — every "agent" would just be the LLM with a different system
prompt, indistinguishable from Chat Agent, and the dashboard would be
lying about what's running. Instead, `AGENT_DEFINITIONS` carries
`implemented: bool`, the orchestrator reports `not_implemented` truthfully,
and the mobile UI renders that as "Planned" rather than pretending.

## Mobile (`mobile/lib`)

Feature-first folders, each with `data/` (API clients), `models/` (plain
Dart classes with `fromJson`), and `presentation/` (widgets/screens):

- `core/` — theme (`app_theme.dart`: colors, `GlassCard`, `StatusDot`),
  `state/backend_config.dart` (the backend URL + live connection state,
  a `ChangeNotifier` provided app-wide via `provider`), `network/api_client.dart`
  (REST wrapper that turns failures into a typed `ApiException` instead of
  swallowing them), `storage/app_prefs.dart` (SharedPreferences: backend
  URL, onboarding flag, PIN-lock toggle).
- `features/dashboard` — the screen from the reference image, wired to
  real data: agent grid from `/api/agents`, CPU/RAM/disk rings and a
  rolling line chart fed by the `/api/system/ws` live stream (falls back
  to polling `/api/system/stats` if the socket can't connect), recent
  activity from `/api/activity`.
- `features/chat` — real token-streaming chat over
  `/api/chat/ws/{id}`, conversation history from REST, markdown rendering.
- `features/agents` — directory + detail screens showing each agent's
  real status and capabilities; only Chat Agent links through to a working
  chat session.
- `features/settings` — backend URL + connection test, local model list
  (from the backend, with real file sizes and RAM estimates), PIN setup.
- `features/connect` — first-run screen to point the app at a backend
  before anything else loads.

## Data model (SQLite)

`agents` (registry, currently unused at runtime — definitions live in
Python and are exposed via API; kept in schema for a future plugin/agent
marketplace), `conversations`, `messages`, `activity_log`, `local_models`,
`auth` (single-row PIN hash).

## Known simplifications (see ROADMAP.md for what's next)

- The backend is a normal Python process you run yourself (venv + uvicorn,
  or `run_dev.sh`) — it is **not yet embedded inside the Android APK**.
  The mobile app is a thin client pointed at wherever that process runs
  (same device via Termux, or another machine on your LAN), the same
  pattern as the original ollama-app this scaffold started from. Embedding
  via Chaquopy/python-for-android is a real, sizeable undertaking and is
  tracked as a roadmap item rather than faked.
- GPU stats are presence-only (`nvidia-smi` on PATH), not utilization —
  reporting a fake number felt worse than omitting it.
- No workflow builder, plugin marketplace, RAG/vector DB, or the 8
  non-chat agents yet. See ROADMAP.md.
