#!/usr/bin/env python3
"""
Prepare a voice-cloning reference clip for the audiobook pipeline.

XTTS v2 (used by generate_audiobook.py) clones best from a clean,
single-speaker sample roughly 6-30 seconds long: no music, no background
noise, no overlapping speech. This script converts an arbitrary input
recording (e.g. an .m4a voice memo) into a trimmed, normalized mono WAV
suitable for use as --voice in generate_audiobook.py.

Requires ffmpeg on PATH.

Usage:
    python prepare_reference_voice.py input.m4a reference.wav \
        --start 00:00:05 --duration 20
"""
import argparse
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Source recording (any ffmpeg-readable format)")
    parser.add_argument("output", help="Output WAV path, e.g. reference.wav")
    parser.add_argument("--start", default="00:00:00", help="Start offset (HH:MM:SS), default 0")
    parser.add_argument("--duration", type=float, default=20.0,
                         help="Clip length in seconds (6-30 recommended, default 20)")
    parser.add_argument("--sample-rate", type=int, default=22050)
    args = parser.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH. Install it and re-run.")

    if not (6 <= args.duration <= 30):
        print(f"Warning: {args.duration}s is outside the 6-30s XTTS-recommended range.",
              file=sys.stderr)

    cmd = [
        "ffmpeg", "-y",
        "-i", args.input,
        "-ss", args.start,
        "-t", str(args.duration),
        "-ac", "1",
        "-ar", str(args.sample_rate),
        "-af", "loudnorm",
        args.output,
    ]
    subprocess.run(cmd, check=True)
    print(f"Wrote reference clip: {args.output}")
    print("Listen to it before running the full pipeline -- a noisy or "
          "clipped reference produces a noisy or clipped cloned voice.")


if __name__ == "__main__":
    main()
