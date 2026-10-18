# LATIF Model Flex

LATIF Model Flex is a mobile-first, cost-aware agent gateway for Termux. It keeps routine work outside Manus and routes only complex tasks to a stronger provider. It is designed to handle ordinary chat, rewriting, translation, summarization, planning, document drafting, and lightweight analysis without spending Manus credits.

## Run on Termux

```bash
pkg update -y
pkg install -y nodejs git
cd ~/latif-brain
git pull
cp .env.flex.example .env.flex
nano .env.flex
set -a; . ./.env.flex; set +a
npm install
npm run flex
```

Open `http://127.0.0.1:3100` on the phone. Keep the process alive with `tmux`:

```bash
pkg install -y tmux
tmux new -s latif-flex
npm run flex
# Detach: Ctrl+B, then D
```

## Routing policy

- `auto` sends short routine requests to `FLEX_CHEAP`.
- Long, technical, security-sensitive, research, deployment, and multi-step requests go to `FLEX_PRIMARY`.
- `local` can be selected by API when a local OpenAI-compatible server is available.
- No Manus API or Manus credit is called by this gateway. A future Manus bridge should be explicit and opt-in.

## API

`POST /api/chat`

```json
{"message":"Summarize this text", "mode":"auto", "remember":true}
```

`GET /api/providers` shows configuration metadata only; secret values are never returned.

## Security

Never commit `.env.flex`, API keys, or `data/flex-memory.json`. Bind the service to localhost when using it only on the phone. If exposing it over Wi-Fi or LATIF-CLOUD, add HTTPS and real authentication before doing so.

## LATIF-CLOUD

Set `LATIF_CLOUD_URL` only after confirming the endpoint. Flex will POST memory records to `${LATIF_CLOUD_URL}/memory` using the optional bearer token. The adapter is disabled when the URL is empty.
