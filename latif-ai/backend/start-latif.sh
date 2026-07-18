#!/data/data/com.termux/files/usr/bin/sh
# LATIF AI — Termux autostart script.
# Install once: put this file at ~/.termux/boot/start-latif (needs the
# Termux:Boot app) so backends come up automatically after a reboot.
# Also runnable manually: bash backend/start-latif.sh

termux-wake-lock

cd "$(dirname "$0")/.." || exit 1

# Ollama (LLM inference)
ollama serve >/dev/null 2>&1 &

# System monitor (CPU/RAM/battery/Ollama VRAM gauges)
cd backend || exit 1
uvicorn stats:app --host 127.0.0.1 --port 8000 >/dev/null 2>&1 &

# Offline voice transcription (only if whisper.cpp is built — see transcribe.py)
if [ -x "$HOME/whisper.cpp/build/bin/whisper-cli" ]; then
  uvicorn transcribe:app --host 127.0.0.1 --port 8001 >/dev/null 2>&1 &
fi

echo "LATIF AI backends started (ollama:11434, stats:8000, whisper:8001)."
