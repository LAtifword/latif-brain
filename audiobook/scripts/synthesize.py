#!/usr/bin/env python3
"""
synthesize.py — Render build/segments.json to a single narration WAV.

Default engine is espeak-ng (fully offline, ships with the Piper bundle). The
engine is deliberately pluggable: swap `synth_espeak` for a cloud voice-clone
call (see scripts/voice_clone_engine.md) to get natural, reference-matched
narration without touching the rest of the pipeline.

Usage:
  python3 synthesize.py [build_dir] [out_wav]

Env:
  ESPEAK_BIN   path to espeak-ng            (default: ../../bin/piper/espeak-ng)
  ESPEAK_PATH  dir containing espeak-ng-data (default: ../../bin/piper)
  FFMPEG_BIN   path to ffmpeg               (default: ffmpeg on PATH)
  VOICE        espeak voice                 (default: ar)
  WPM          words per minute             (default: 135)
  PITCH        espeak pitch 0-99            (default: 42)
"""
import json
import os
import subprocess
import sys
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_BIN = HERE.parents[1] / "bin"  # <repo>/bin if present

ESPEAK_BIN = os.environ.get("ESPEAK_BIN", str(REPO_BIN / "piper" / "espeak-ng"))
ESPEAK_PATH = os.environ.get("ESPEAK_PATH", str(REPO_BIN / "piper"))
FFMPEG_BIN = os.environ.get("FFMPEG_BIN", "ffmpeg")
VOICE = os.environ.get("VOICE", "ar")
WPM = os.environ.get("WPM", "135")
PITCH = os.environ.get("PITCH", "42")

SR = 22050  # espeak-ng default sample rate (Hz), mono, 16-bit


def synth_espeak(text: str, out_wav: Path):
    """Render one text segment to a WAV with espeak-ng (offline)."""
    cmd = [
        ESPEAK_BIN, f"--path={ESPEAK_PATH}",
        "-v", VOICE, "-s", WPM, "-p", PITCH,
        "-w", str(out_wav),
    ]
    # Feed text on stdin to avoid shell-escaping issues with Arabic.
    subprocess.run(cmd, input=text.encode("utf-8"), check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def write_silence(out_wav: Path, seconds: float):
    frames = int(SR * seconds)
    with wave.open(str(out_wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"\x00\x00" * frames)


def main():
    build = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "build"
    out_wav = Path(sys.argv[2]) if len(sys.argv) > 2 else build / "narration.wav"
    segdir = build / "segments"
    segdir.mkdir(parents=True, exist_ok=True)

    segments = json.loads((build / "segments.json").read_text(encoding="utf-8"))

    # Cache silence clips by rounded duration.
    silence_cache = {}

    def silence(sec):
        key = round(sec, 2)
        if key not in silence_cache:
            p = segdir / f"sil_{int(key*100):04d}.wav"
            write_silence(p, key)
            silence_cache[key] = p
        return silence_cache[key]

    concat_list = []
    for i, seg in enumerate(segments):
        if seg["text"]:
            seg_wav = segdir / f"seg_{i:04d}.wav"
            synth_espeak(seg["text"], seg_wav)
            concat_list.append(seg_wav)
        pause = seg.get("pause_after", 0.5)
        if pause > 0:
            concat_list.append(silence(pause))
        if (i + 1) % 25 == 0:
            print(f"  synthesized {i + 1}/{len(segments)} segments")

    # Write ffmpeg concat manifest and stitch losslessly (same format throughout).
    manifest = build / "concat.txt"
    manifest.write_text(
        "".join(f"file '{p.as_posix()}'\n" for p in concat_list), encoding="utf-8"
    )
    subprocess.run(
        [FFMPEG_BIN, "-y", "-f", "concat", "-safe", "0", "-i", str(manifest),
         "-c", "copy", str(out_wav)],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )

    # Report duration.
    with wave.open(str(out_wav), "rb") as w:
        dur = w.getnframes() / w.getframerate()
    print(f"narration written: {out_wav}  ({dur/60:.1f} min)")


if __name__ == "__main__":
    main()
