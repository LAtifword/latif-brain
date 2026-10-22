#!/usr/bin/env python3
"""Split a verified GGUF into APK-friendly embedded asset chunks."""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit("usage: chunk_model.py MODEL.gguf OUTPUT_ASSET_DIR")

src = Path(sys.argv[1])
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

chunk_size = 512 * 1024 * 1024  # 512 MiB; every ZIP entry stays comfortably below 2/4 GiB limits.
expected = "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"

digest = hashlib.sha256()
parts = 0
total = 0
with src.open("rb") as f:
    while True:
        block = f.read(chunk_size)
        if not block:
            break
        digest.update(block)
        total += len(block)
        (out / f"model-{parts:03d}.ggufpart").write_bytes(block)
        parts += 1

actual = digest.hexdigest()
if actual != expected:
    raise SystemExit(f"model SHA256 mismatch: {actual} != {expected}")

(out / "MODEL-MANIFEST.txt").write_text(
    f"sha256={actual}\nsize={total}\nparts={parts}\n",
    encoding="utf-8",
)
print(f"chunked {total} bytes into {parts} parts; sha256={actual}")
