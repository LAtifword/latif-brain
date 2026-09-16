# SIGMA Desktop — Windows x64

SIGMA Desktop is the Windows workstation edition of SIGMA. The core AI path is local-first and does not require an API key, login, cloud inference, or a server.

## Runtime architecture

- UI / workstation shell: desktop application layer
- Local LLM: llama.cpp-compatible GGUF runtime
- Acceleration: CUDA when packaged/available, Vulkan as broad GPU path, CPU fallback
- Agent layer: local tool registry for workspace/files, project execution, documents and persistent memory
- Model storage: bundled release payload or validated local model directory
- Network: optional tool only; never required for core inference

## Release contract

The Windows release must pass an offline acceptance test: disconnect networking, launch SIGMA, load its packaged model, complete a chat turn, execute an allowed local workspace operation, restart the app, and retain local memory.

## Build direction

The Windows CI target produces an x64 release bundle and installer. GPU backends are selected at runtime; failure of a GPU backend must fall back rather than make SIGMA unusable.
