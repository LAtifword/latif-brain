# Audiobook generation ("العين التي بقيت مفتوحة")

Pipeline to turn the novel manuscript into a narrated audiobook using a
cloned voice, built from the manuscript and voice memo supplied for this
book.

## What's here

- `book/` -- the novel, split into 22 sections (foreword, 20 chapters,
  afterword) and extracted cleanly from the source .docx. `book/manifest.json`
  lists each section's title, part grouping, and word count (~13.8k words
  total, ~1.5-2 hours of narration at a typical audiobook pace).
- `prepare_reference_voice.py` -- trims/normalizes a source recording into
  the short, clean reference clip XTTS v2 needs for voice cloning.
- `generate_audiobook.py` -- runs the actual text-to-speech synthesis,
  chapter by chapter, using the cloned voice.
- `requirements.txt` -- Python dependencies for the above.

## Why this wasn't rendered to audio automatically

Generating the audio requires running an open-source voice-cloning TTS
model (Coqui XTTS v2 -- chosen because it supports Arabic and can clone a
voice from a short reference sample, unlike most closed commercial APIs
which don't offer a good Arabic-cloning path). That model is a ~2GB
download and synthesis is compute-heavy (GPU strongly recommended for a
book-length run).

The environment this pipeline was built in has no general internet
access (only a small allowlist for package registries/GitHub needed for
this session itself) and no audio/TTS engine installed, so the model
could not be downloaded or run here. The code is real and complete, not a
stub -- it just needs to be run somewhere with internet + compute, e.g.
your own machine, a cloud GPU box, or a Claude Code session configured
with broader network access.

The voice memo provided for cloning was **not** committed to this
repository -- a person's voice sample is biometric data and shouldn't
live in git history. Export/convert it locally instead (see below).

## Running it

```bash
pip install -r tools/audiobook/requirements.txt

# 1. Prepare a clean reference clip from your voice recording
#    (6-30s, single speaker, no music/noise -- pick the cleanest segment)
python tools/audiobook/prepare_reference_voice.py \
    /path/to/your/voice-recording.m4a reference.wav \
    --start 00:00:05 --duration 20

# 2. Sanity-check on one chapter first
python tools/audiobook/generate_audiobook.py \
    --voice reference.wav \
    --out out/audiobook \
    --chapters 1

# 3. Listen to out/audiobook/01.wav. If it sounds right, render the rest
#    (safe to re-run -- already-rendered chapters/chunks are skipped):
python tools/audiobook/generate_audiobook.py \
    --voice reference.wav \
    --out out/audiobook
```

This produces `out/audiobook/01.wav` .. `22.wav` and a combined
`out/audiobook/audiobook_full.wav` once every chapter has been rendered.

`out/` is git-ignored -- rendered audio (and any local reference voice
clip) stays out of version control.
