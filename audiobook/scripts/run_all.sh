#!/usr/bin/env bash
#
# run_all.sh — End-to-end audiobook build: docx -> narration -> mixed MP3.
#
# Run from the audiobook/ directory (or any dir; paths are resolved relative to
# this script). Assumes fetch_tools.sh has been run, or that ffmpeg / espeak-ng
# are already on PATH and pointed to via the env vars below.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
BIN="$(cd "$ROOT/.." && pwd)/bin"

export FFMPEG_BIN="${FFMPEG_BIN:-$BIN/ffmpeg}"
export ESPEAK_BIN="${ESPEAK_BIN:-$BIN/piper/espeak-ng}"
export ESPEAK_PATH="${ESPEAK_PATH:-$BIN/piper}"
export LD_LIBRARY_PATH="${LD_LIBRARY_PATH:-}:$BIN/piper"

SRC="${1:-$ROOT/text/source.docx}"
MUSIC="${2:-$ROOT/assets/background_music.mp3}"
OUT="${3:-$ROOT/output/yawm_al_qiyamah_audiobook.mp3}"

echo "== 1/3 prepare text =="
python3 "$HERE/prepare_text.py" "$SRC" "$ROOT/build"

echo "== 2/3 synthesize narration =="
python3 "$HERE/synthesize.py" "$ROOT/build" "$ROOT/build/narration.wav"

echo "== 3/3 mix with music =="
bash "$HERE/mix.sh" "$ROOT/build/narration.wav" "$MUSIC" "$OUT"

echo "done -> $OUT"
