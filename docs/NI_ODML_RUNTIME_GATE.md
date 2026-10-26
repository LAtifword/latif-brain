# LATIF NI — recovered ODML model runtime gate

## Evidence (Moto G85, Android 16, arm64-v8a)
- Source: /storage/emulated/0/B/weights (1).bin, 1,782,710,272 bytes; keep on device.
- TFL3 FlatBuffer; one subgraph; 579 tensors; 32 transformer layers; 0 TFLite operators, inputs and outputs.
- Metadata externally stored: LlmParameters at 131072 (73 bytes), SentencePiece model at 131328 (4240703 bytes), backend at 4372224 (3 bytes: gpu).
- The existing LATIF NI Android module uses LiteRT-LM 0.17.0 and bundles a Qwen3 0.6B .litertlm model. Do not pass the legacy .bin to LiteRT-LM without a verified conversion.

## Runtime compatibility decision
Google documents com.google.mediapipe:tasks-genai:0.10.27 for its legacy Android LLM Inference API and .bin model support. This is the first candidate to test this ODML package, not a guarantee of support. LiteRT-LM is the preferred runtime for modern .litertlm models, but it is a different format. The legacy API is maintenance-only.

## Isolated acceptance test
1. Add a separate diagnostic Android Activity (not the production NI engine) with MediaPipe tasks-genai.
2. Use Android Storage Access Framework to select the existing model file. Copy to app-private storage **only if** the API requires a directly readable filesystem path; check free space first and warn that this duplicates 1.78 GB. Prefer a file descriptor when supported.
3. Initialize LlmInference with a small token budget on a background thread. Record exception class, message, device GPU driver, elapsed time, and peak RSS.
4. If initialization succeeds, generate a deterministic short prompt; capture response, token count and latency.
5. Never call this a supported model or integrate into NI until real device tests pass.
6. Keep the existing Qwen3 model unchanged as fallback.

## Sources
- https://developers.google.com/edge/mediapipe/solutions/genai/llm_inference/android
- https://developers.google.com/edge/litert-lm/android

## Gate status
**NOT TESTED.** No Android probe APK built yet; no model inference performed. This document is an implementation decision and acceptance specification, not proof of runtime compatibility.
