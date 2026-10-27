# Upgrading to a natural, voice-matched narration

The offline pipeline uses **espeak-ng**, which is robotic. It's a placeholder so
the whole book + music pipeline is proven end-to-end. To get natural narration
that matches `assets/voice_reference.mp3`, swap the synthesis engine. The rest of
the pipeline (text prep, pausing, music mixing, loudness) stays exactly the same.

You only replace **one function**: `synth_espeak(text, out_wav)` in
`synthesize.py`. Any engine that turns a short Arabic string into a WAV works.

## Why it couldn't run in the web/remote session
The Claude Code web environment used here was network-locked to GitHub only:
the Hugging Face Space invoke API was disabled, `pip`/`apt` were blocked, and
neural voice model files sat behind blocked hosts. Run the options below from a
normal machine (or a Claude Code session with open network) instead.

## Option A — ElevenLabs (best cloning, paid API)
1. Create an Instant Voice Clone from `assets/voice_reference.mp3` in the
   ElevenLabs dashboard; note the `voice_id`.
2. Replace `synth_espeak`:
   ```python
   import requests, os
   def synth_espeak(text, out_wav):  # same signature; now cloud-backed
       vid = os.environ["ELEVEN_VOICE_ID"]
       r = requests.post(
           f"https://api.elevenlabs.io/v1/text-to-speech/{vid}",
           headers={"xi-api-key": os.environ["ELEVEN_API_KEY"]},
           json={"text": text, "model_id": "eleven_multilingual_v2"},
       )
       r.raise_for_status()
       mp3 = out_wav.with_suffix(".mp3"); mp3.write_bytes(r.content)
       # normalise to the pipeline's 22050 Hz mono WAV
       import subprocess
       subprocess.run([os.environ.get("FFMPEG_BIN","ffmpeg"),"-y","-i",str(mp3),
                       "-ar","22050","-ac","1",str(out_wav)], check=True)
   ```
   Segments are already <300 chars, well within request limits.

## Option B — Chatterbox-Multilingual (open weights, Arabic + cloning)
`ResembleAI/chatterbox` multilingual supports Arabic (`language_id="ar"`) and
reference-audio styling. On a machine with a GPU:
```bash
pip install chatterbox-tts
```
```python
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
model = ChatterboxMultilingualTTS.from_pretrained(device="cuda")
def synth_espeak(text, out_wav):
    wav = model.generate(text, language_id="ar",
                         audio_prompt_path="assets/voice_reference.mp3")
    import torchaudio; torchaudio.save(str(out_wav), wav, model.sr)
```
Then resample to 22050 Hz mono if you want to keep the silence-concat lossless.

## Option C — XTTS-v2 (open weights, cloning)
`coqui/XTTS-v2` clones from a few seconds of reference and speaks Arabic. Same
pattern: load model, `tts.tts_to_file(text, speaker_wav=reference, language="ar")`.

## Tuning tips
- Keep the reference clip clean (5–20 s, no music) — `assets/voice_reference.mp3`
  is already voice-only.
- Match output to 22050 Hz mono WAV so `synthesize.py`'s lossless concat works;
  otherwise change the concat step to re-encode.
- Chapter/part/confession segments are tagged in `build/segments.json` if you
  want to vary voice or add emphasis per structural role.
