#!/usr/bin/env bash
#
# mix.sh — Mix a narration track with a looping background-music bed.
#
# Produces a finished audiobook MP3:
#   * music-only intro, then narration enters
#   * music looped for the whole book, held low and side-chain "ducked"
#     underneath the voice so speech always stays clear
#   * music-only outro with a fade-out
#   * EBU R128 loudness normalization for consistent playback volume
#
# Usage:
#   mix.sh <narration.wav> <music file> <output.mp3>
#
# Env (all optional):
#   FFMPEG_BIN  ffmpeg binary            (default: ffmpeg)
#   INTRO       music-only lead-in secs  (default: 4)
#   OUTRO       music-only tail secs     (default: 7)
#   BED_VOL     music bed gain 0-1       (default: 0.22)
#   DUCK        duck depth (ratio)       (default: 8)
#   LUFS        target loudness          (default: -16)
set -euo pipefail

NARR="${1:?narration wav required}"
MUSIC="${2:?music file required}"
OUT="${3:?output mp3 required}"

FFMPEG_BIN="${FFMPEG_BIN:-ffmpeg}"
INTRO="${INTRO:-4}"
OUTRO="${OUTRO:-7}"
BED_VOL="${BED_VOL:-0.22}"
DUCK="${DUCK:-8}"
LUFS="${LUFS:--16}"

# Narration duration (seconds) straight from the WAV header — no ffprobe needed.
NARR_DUR="$(python3 - "$NARR" <<'PY'
import sys, wave
with wave.open(sys.argv[1], "rb") as w:
    print(w.getnframes() / w.getframerate())
PY
)"
TOTAL="$(python3 -c "print($INTRO + $NARR_DUR + $OUTRO)")"
FADE_START="$(python3 -c "print($INTRO + $NARR_DUR)")"

echo "narration : ${NARR_DUR}s   total (with intro/outro): ${TOTAL}s"

# Filtergraph:
#  - voice  -> stereo/44.1k, delayed by INTRO so music opens alone
#  - music  -> looped (input flag), stereo/44.1k, trimmed to TOTAL, low bed gain
#  - duck   -> sidechaincompress keyed by the voice
#  - amix   -> normalize=0 keeps levels (no auto-attenuation), then loudnorm + fade
"$FFMPEG_BIN" -y \
  -i "$NARR" \
  -stream_loop -1 -i "$MUSIC" \
  -filter_complex "
    [0:a]aformat=sample_rates=44100:channel_layouts=stereo,
         adelay=${INTRO}s:all=1,apad[voc];
    [voc]asplit=2[voc_mix][voc_key];
    [1:a]aformat=sample_rates=44100:channel_layouts=stereo,
         atrim=0:${TOTAL},volume=${BED_VOL}[bed];
    [bed][voc_key]sidechaincompress=threshold=0.03:ratio=${DUCK}:attack=20:release=450[ducked];
    [voc_mix][ducked]amix=inputs=2:duration=first:normalize=0[mixed];
    [mixed]afade=t=in:st=0:d=2,
           afade=t=out:st=${FADE_START}:d=${OUTRO},
           loudnorm=I=${LUFS}:TP=-1.5:LRA=11,
           atrim=0:${TOTAL}[out]
  " \
  -map "[out]" -c:a libmp3lame -q:a 4 "$OUT"

echo "written: $OUT"
