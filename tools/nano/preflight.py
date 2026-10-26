#!/usr/bin/env python3
"""Read-only preflight for downloaded Chrome Gemini Nano binaries.

This does NOT train or execute proprietary model weights. Exit 0 only for
recognized *container* signatures; runtime/training compatibility still
requires independent verification.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/storage/emulated/0/B")
KNOWN_SMALL_SHA256 = "bad5926061c8942fbed91b42266c76ac4d5b7e79d352a205466bf29950af0191"
EXPECTED_LARGE_SHA256 = "d7f18c99c451540bacafa09578f88f7428b0f316503b50e17f089eb0d4295fb1"

def inspect(name):
    path = ROOT / name
    if not path.is_file():
        return {"file": name, "status": "missing"}
    h = hashlib.sha256()
    with path.open("rb") as stream:
        header = stream.read(64)
        h.update(header)
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    digest = h.hexdigest()
    return {
        "file": name, "bytes": path.stat().st_size,
        "sha256": digest, "tflite_header": header[4:8] == b"TFL3",
        "gguf_header": header[:4] == b"GGUF",
        "matches_previous_audit": digest == (
            KNOWN_SMALL_SHA256 if name == "weights (1).bin" else EXPECTED_LARGE_SHA256
        ),
        "trainable": False,
        "reason": "No verified compatible trainable checkpoint, optimizer or runtime",
    }

def main():
    results = [inspect(name) for name in ("weights.bin", "weights (1).bin")]
    print(json.dumps({"models": results, "training_started": False,
                      "warning": "Container signature is not proof of runnable or trainable model"},
                     indent=2))
    return 0 if all(x.get("matches_previous_audit") for x in results) else 1

if __name__ == "__main__":
    raise SystemExit(main())
