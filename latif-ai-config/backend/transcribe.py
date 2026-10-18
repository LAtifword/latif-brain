"""
LATIF AI — Offline Arabic/English STT backend (run in Termux)

Wraps whisper.cpp so the app's Voice Backend (js/voice-backend.js) can
transcribe fully offline instead of relying on the browser's Web Speech
API (which uses Google's cloud speech service on Android).

Build whisper.cpp first (Termux):
    pkg install -y git cmake clang make ffmpeg
    git clone --depth 1 https://github.com/ggerganov/whisper.cpp
    cd whisper.cpp
    bash ./models/download-ggml-model.sh small     # or medium/large-v3 for better Arabic
    cmake -S . -B build -DGGML_NO_OPENMP=ON
    cmake --build build -j"$(nproc)"

Configure the paths below (or override via environment variables), then:
    pip install -r requirements.txt
    uvicorn transcribe:app --host 127.0.0.1 --port 8001
"""
import os
import subprocess
import tempfile

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="LATIF AI Voice Backend (whisper.cpp)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

WHISPER_BIN = os.environ.get("WHISPER_BIN", os.path.expanduser("~/whisper.cpp/build/bin/whisper-cli"))
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", os.path.expanduser("~/whisper.cpp/models/ggml-small.bin"))
WHISPER_LANG = os.environ.get("WHISPER_LANG", "auto")  # "ar" forces Arabic, "auto" detects


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    with tempfile.TemporaryDirectory() as tmp:
        in_path = os.path.join(tmp, "in.webm")
        wav_path = os.path.join(tmp, "out.wav")
        out_prefix = os.path.join(tmp, "out")

        with open(in_path, "wb") as f:
            f.write(await audio.read())

        # whisper.cpp expects 16kHz mono WAV; browsers record WebM/Opus.
        subprocess.run(
            ["ffmpeg", "-y", "-i", in_path, "-ar", "16000", "-ac", "1", wav_path],
            check=True, capture_output=True,
        )
        subprocess.run(
            [WHISPER_BIN, "-m", WHISPER_MODEL, "-f", wav_path, "-l", WHISPER_LANG,
             "-otxt", "-of", out_prefix, "-nt"],
            check=True, capture_output=True,
        )

        txt_path = out_prefix + ".txt"
        text = ""
        if os.path.exists(txt_path):
            with open(txt_path, encoding="utf-8") as f:
                text = f.read().strip()

        return {"text": text}


@app.get("/health")
def health():
    return {"ok": True, "model": WHISPER_MODEL, "lang": WHISPER_LANG}
