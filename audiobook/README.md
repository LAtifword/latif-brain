# يوم القيامة — Audiobook build

Turns the manuscript **يوم القيامة** (a philosophical novel by محمد لطيف) into a
narrated audiobook with a background-music bed.

```
audiobook/
├── assets/
│   ├── background_music.mp3   # music bed (supplied)
│   └── voice_reference.mp3    # target voice for cloning (supplied)
├── text/
│   └── source.docx           # source manuscript
├── scripts/
│   ├── fetch_tools.sh        # pull static ffmpeg + espeak-ng (GitHub only)
│   ├── prepare_text.py       # docx -> structured segments.json
│   ├── synthesize.py         # segments -> narration.wav  (swappable engine)
│   ├── mix.sh                # narration + music -> final mp3
│   ├── run_all.sh            # the three steps above, end to end
│   └── voice_clone_engine.md # how to swap in a natural, voice-matched engine
├── build/                    # generated: segments.json, narration.wav, ...
└── output/
    └── yawm_al_qiyamah_audiobook.mp3   # finished audiobook
```

## Quick start

```bash
cd audiobook
bash scripts/fetch_tools.sh      # one-time: static ffmpeg + espeak-ng bundle
bash scripts/run_all.sh          # docx -> narration -> mixed mp3
# result: output/yawm_al_qiyamah_audiobook.mp3
```

## What each stage does

1. **prepare_text.py** — reads `text/source.docx` with the standard library
   (no dependencies), classifies each paragraph (title / part / chapter /
   confession / body / divider), strips decorative glyphs, and writes
   `build/segments.json` with a per-segment pause length that drives pacing.
2. **synthesize.py** — renders every segment to audio and stitches them with the
   structural pauses into one `build/narration.wav`. The engine is a single
   function (`synth_espeak`) — see below.
3. **mix.sh** — loops the music into a low bed, side-chain "ducks" it under the
   voice so speech stays clear, adds a music-only intro/outro with fades, and
   applies EBU R128 loudness normalization. Exports the final MP3.

## Voice quality — important

This build uses **espeak-ng**, which is **robotic** — it is a working
placeholder, not the uploaded reference voice. Producing natural narration that
matches `assets/voice_reference.mp3` requires a voice-cloning TTS engine, which
could not run in the locked-down web session used to build this (only GitHub was
reachable; cloud TTS and neural model downloads were blocked).

To upgrade to natural, reference-matched narration, replace the one
`synth_espeak` function per **`scripts/voice_clone_engine.md`** (ElevenLabs,
Chatterbox-Multilingual, or XTTS-v2). Nothing else in the pipeline changes.

## Tunables (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `WPM` | 135 | narration speed (words/min) |
| `PITCH` | 42 | espeak pitch 0–99 |
| `BED_VOL` | 0.22 | background-music level under the voice |
| `DUCK` | 8 | how hard the music ducks under speech |
| `INTRO` / `OUTRO` | 4 / 7 | music-only lead-in / tail seconds |
| `LUFS` | -16 | target integrated loudness |
