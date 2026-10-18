# LATIF AI — Troubleshooting

## "Ollama/whisper work fine from Termux, but the app says it can't reach them"

This is the single most common issue with a WebView app talking to a local
server on the same phone, and it's **never** a bug in the app's request
code if `curl` from Termux succeeds at the exact same address — `curl`
doesn't enforce the two things browsers/WebViews do:

### 1. Android blocks plain `http://` traffic by default (cleartext blocking)

Since Android 9 (API 28), apps are blocked from making cleartext
(non-HTTPS) network requests **unless explicitly allowed** — and this
applies to `127.0.0.1`/`localhost` too, not just the public internet.
`curl` inside Termux isn't subject to this (it's Termux's own process, not
your packaged app's WebView), which is exactly why Termux can reach Ollama
directly while the app can't.

**Fix**: add `android/xml/network_security_config.xml` (included in this
project) to your Android Studio project at
`app/src/main/res/xml/network_security_config.xml`, then reference it in
`AndroidManifest.xml`:

```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ... >
```

This explicitly allows cleartext traffic to `127.0.0.1` and `localhost`
without weakening security for anything else the app talks to.

### 2. Ollama's CORS origin allowlist may not include your app's origin

Ollama only accepts browser requests from an allowlisted `Origin` header
(`OLLAMA_ORIGINS`). By default this includes `http://127.0.0.1:*` and
`file://*`, which covers most WebToApp setups — but if your project serves
the app via `WebViewAssetLoader` (`https://appassets.androidplatform.net/...`,
needed for service worker + mic support — see `ARCHITECTURE.md`), that
origin is **not** in Ollama's default allowlist and the request gets
silently blocked by the browser's CORS check.

**Fix** (quick test, no rebuild needed) — start Ollama with all origins allowed:

```bash
OLLAMA_ORIGINS=* ollama serve
```

If the app connects immediately after this, CORS was the cause — make this
permanent by adding `export OLLAMA_ORIGINS=*` to `~/.bashrc` (or wherever
you set env vars in Termux) so it's set on every `ollama serve`.

### 3. Quick diagnostic order

1. Run `OLLAMA_ORIGINS=* ollama serve` and retest — rules out CORS.
2. Add the network security config and rebuild — rules out cleartext blocking.
3. If still failing, confirm the phone running the APK is the **same**
   physical device as the one running Termux — `127.0.0.1` only works
   when both are on the same device. Testing the APK on an emulator while
   Termux runs on a physical phone will never work over `127.0.0.1`; use
   the phone's LAN IP in Settings → Ollama Server instead.

## "whisper transcription doesn't work"

The app's default whisper backend URL is `http://127.0.0.1:8001` (matching
`backend/transcribe.py`'s suggested port in its own docstring). **If you
started `uvicorn transcribe:app --port 8082` instead, update the URL field**
in Settings → Voice Backend to `http://127.0.0.1:8082` — this is a
Settings value, not a code default; no rebuild needed. Same cleartext/CORS
notes above apply to this endpoint too.
