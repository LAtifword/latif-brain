# AgentOS backend

FastAPI service behind the AgentOS mobile app. See the root
[ARCHITECTURE.md](../ARCHITECTURE.md) for the full design; this file is
just setup + API reference.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install llama-cpp-python   # optional, needed for real inference
cp /path/to/your-model.gguf data/models/
uvicorn app.main:app --host 0.0.0.0 --port 8765 --reload
```

Config is env-driven (see `app/core/config.py`), all prefixed `AGENTOS_`:
`AGENTOS_HOST`, `AGENTOS_PORT`, `AGENTOS_DEFAULT_MODEL_PATH`,
`AGENTOS_LLM_CONTEXT_SIZE`, `AGENTOS_LLM_MAX_NEW_TOKENS`.

## Tests

```bash
pip install -r requirements.txt  # includes pytest, httpx
pytest
```

(Not run in the sandboxed environment this backend was authored in — see
the root README's "Verification status" section.)

## API reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/system/health` | Liveness check |
| GET | `/api/system/stats` | Real CPU/RAM/disk/GPU-presence snapshot |
| GET | `/api/system/summary` | Agents running / total |
| WS | `/api/system/ws` | Live-push system stats (~every 2s) |
| GET | `/api/agents` | All 9 agents with real status |
| GET | `/api/agents/{id}` | One agent |
| POST | `/api/chat/conversations?title=` | Create a chat conversation |
| GET | `/api/chat/conversations` | List conversations |
| GET | `/api/chat/conversations/{id}/messages` | Message history |
| WS | `/api/chat/ws/{conversation_id}` | Send `{"content": str}`, receive `{"type": "token"\|"done"\|"error", ...}` frames |
| GET | `/api/models` | Local GGUF files + RAM estimate |
| GET | `/api/models/status` | Engine/model load status |
| POST | `/api/models/load?path=` | Load a GGUF (defaults to first found) |
| POST | `/api/models/unload` | Free the loaded model |
| GET | `/api/activity` | Recent activity log |
| GET | `/api/auth/status` | Whether a PIN is configured |
| POST | `/api/auth/pin` | Set the local PIN (bcrypt-hashed server-side) |
| POST | `/api/auth/pin/verify` | Verify a PIN |

Interactive docs (Swagger UI) are available at `/docs` once the server is
running.
