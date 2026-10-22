#!/usr/bin/env python3
"""Compatibility shim for llama.cpp Android binding inside WebToApp.

The pinned host resolves kotlinx-coroutines 1.7.3. The current llama.cpp Android
sample uses Dispatchers.IO.limitedParallelism(1), which is not available to the
compiler on this dependency graph. SIGMA already serializes all inference through
SigmaRuntime's mutex, so Dispatchers.IO preserves correctness without requiring a
new coroutine dependency or a second executor.
"""
from __future__ import annotations

import sys
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else "work/web-to-app").resolve()
path = root / "vendor/llama.cpp/examples/llama.android/lib/src/main/java/com/arm/aichat/internal/InferenceEngineImpl.kt"
text = path.read_text(encoding="utf-8")
old = "private val llamaDispatcher = Dispatchers.IO.limitedParallelism(1)"
new = "private val llamaDispatcher = Dispatchers.IO"
count = text.count(old)
if count != 1:
    raise SystemExit(f"expected exactly one llama dispatcher anchor, found {count}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Applied SIGMA llama coroutine compatibility shim")
