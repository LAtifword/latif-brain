#!/usr/bin/env bash
#
# fetch_tools.sh — Download the self-contained binaries the offline pipeline
# needs (static ffmpeg + the Piper bundle, which also provides espeak-ng and
# its data). Everything is pulled from GitHub release assets, so it works even
# in locked-down environments where only github.com is reachable.
#
# Installs into ../../bin (i.e. <repo>/bin) by default; override with BIN_DIR.
set -euo pipefail

BIN_DIR="${BIN_DIR:-$(cd "$(dirname "$0")/../.." && pwd)/bin}"
mkdir -p "$BIN_DIR"
cd "$BIN_DIR"

echo "==> installing into $BIN_DIR"

if [ ! -x "$BIN_DIR/ffmpeg" ]; then
  echo "==> ffmpeg (static)"
  curl -sSL -o ffmpeg \
    "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64"
  chmod +x ffmpeg
fi
"$BIN_DIR/ffmpeg" -version | head -1

if [ ! -x "$BIN_DIR/piper/espeak-ng" ]; then
  echo "==> piper bundle (provides espeak-ng + espeak-ng-data + onnxruntime)"
  curl -sSL -o piper.tar.gz \
    "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz"
  tar xzf piper.tar.gz
  rm -f piper.tar.gz
  chmod +x piper/piper piper/espeak-ng
fi
echo "espeak-ng $("$BIN_DIR/piper/espeak-ng" --version 2>/dev/null | head -1)"

echo
echo "Done. Before running the pipeline, export:"
echo "  export FFMPEG_BIN=$BIN_DIR/ffmpeg"
echo "  export ESPEAK_BIN=$BIN_DIR/piper/espeak-ng"
echo "  export ESPEAK_PATH=$BIN_DIR/piper"
echo "  export LD_LIBRARY_PATH=$BIN_DIR/piper"
