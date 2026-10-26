# SIGMA Standalone Android

This directory drives the SIGMA standalone APK build.

## Product invariant

SIGMA's core intelligence must work with no API key, no account, no remote inference endpoint, no local HTTP model server, and no first-run model download. The model weights and inference runtime are packaged into the APK. Internet access remains an optional app/tool capability for browsing and user-directed network work; it is not a dependency of the LLM.

## Pinned foundations

- Host/agent framework: `shiaho777/web-to-app` @ `eafd07e4c6aa488f123f82eae37f6799a0cb03d4`
- Local inference: `ggml-org/llama.cpp` tag `v0.4.1`
- Main model: `Qwen/Qwen3-4B-GGUF` / `Qwen3-4B-Q4_K_M.gguf`
- Model SHA-256: `7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5`

## Architecture

`Compose UI -> existing AgentEngine/ToolRegistry -> SigmaLocalProvider -> llama.cpp Android JNI -> embedded GGUF`

There is no loopback model server. The llama.cpp Android binding is loaded in-process through JNI. Each agent inference request resets the native conversation context using the binding's system-prompt path, then supplies the current agent transcript and tool schemas. Tool requests are returned to the existing WebToApp agent engine as native `LlmEvent.ToolCall*` events.

The GGUF is split into multiple `.ggufpart` assets at build time to avoid relying on a single multi-gigabyte ZIP entry. `SigmaModelStore` reconstructs the file into app-private storage on first local-model use, verifies the complete SHA-256, and only then atomically publishes the model file. This extraction is local; it performs no network I/O.

## Build

The GitHub Actions workflow `.github/workflows/sigma-standalone.yml` performs a clean reproducible build from the pinned upstream sources, verifies the model hash, applies the SIGMA overlay, builds ARM64 native inference, audits the resulting APK, and uploads transport-sized APK parts plus checksums.

The installed artifact is still one APK. The output is split only for CI artifact transport when necessary; concatenating the parts recreates the byte-identical APK.
