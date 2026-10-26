# LATIF NI Termux offline app

Run the standalone Python standard-library app with `python3 latif_ni.py`. It serves a mobile chat UI on http://127.0.0.1:7860, launches the already compiled `~/latif-ni-runtime/llama.cpp/build/bin/llama-server` with an available full GGUF, and proxies chat to the local OpenAI-compatible API on 127.0.0.1:8080.

Requirements: Python 3, an existing compiled llama-server, and a converted **full** Qwen2 GGUF. It intentionally does not pretend that the existing merged `model.safetensors` is directly loadable by llama.cpp. Set `LATIF_NI_MODEL=/absolute/path/to/model.gguf` to select a model; otherwise it discovers GGUF files larger than 100 MB under the existing Termux runtime, LATIF-BRAIN 2/models and Download.

No Gradio, FastAPI, torch or network API dependency. No network listener outside localhost. Conversations are kept only in the browser tab.

## Verified
- Python syntax compilation and localhost UI / health endpoint smoke tests in a Linux environment.
- Not tested on the user's Android device or with the user's trained GGUF (not yet available in accessible connected storage).

## Known blocker
The user's merged model is at `/storage/emulated/0/LATIF-BRAIN 2/models/latif-qwen-merged/model.safetensors`. Convert that model to GGUF before inference can work. The training notebook `training/LATIF_NI_Train_LoRA.ipynb` documents the merged model and an archive previously saved to Google Drive; that archive has not been retrieved from the connected account.