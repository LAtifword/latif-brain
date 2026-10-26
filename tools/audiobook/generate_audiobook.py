#!/usr/bin/env python3
"""
Generate a narrated audiobook from the chapter text files in book/ using a
cloned voice, via Coqui's open-source XTTS v2 model (supports Arabic and
zero-shot voice cloning from a short reference clip).

This does the actual speech synthesis -- it needs a machine with internet
access (to download the ~2GB XTTS v2 model on first run) and, ideally, a
GPU. It does not run inside network-restricted sandboxes.

Setup:
    pip install -r tools/audiobook/requirements.txt
    python tools/audiobook/prepare_reference_voice.py my_voice.m4a reference.wav

Usage:
    python tools/audiobook/generate_audiobook.py \
        --voice reference.wav \
        --book-dir tools/audiobook/book \
        --out out/audiobook \
        --language ar

    # Only chapters 1-3, e.g. to sanity-check quality before committing to
    # a multi-hour run over the whole book:
    python tools/audiobook/generate_audiobook.py --voice reference.wav \
        --book-dir tools/audiobook/book --out out/audiobook --chapters 1-3

Output: one WAV file per chapter in --out (out/01.wav, out/02.wav, ...),
plus a concatenated out/audiobook_full.wav. Re-running skips chapters/
chunks that were already rendered, so an interrupted run can resume.
"""
import argparse
import json
import os
import re
import sys
import wave

CHUNK_MAX_CHARS = 280  # conservative for XTTS v2's ~400 token limit, Arabic
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?؟])\s+")


def load_manifest(book_dir):
    with open(os.path.join(book_dir, "manifest.json"), encoding="utf-8") as f:
        return json.load(f)


def parse_chapter_range(spec, total):
    if not spec:
        return list(range(1, total + 1))
    result = set()
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            lo, hi = part.split("-")
            result.update(range(int(lo), int(hi) + 1))
        else:
            result.add(int(part))
    return sorted(n for n in result if 1 <= n <= total)


def split_into_chunks(text, max_chars=CHUNK_MAX_CHARS):
    """Split chapter text into TTS-safe chunks on paragraph/sentence bounds."""
    chunks = []
    for para in text.split("\n\n"):
        para = para.strip()
        if not para:
            continue
        if len(para) <= max_chars:
            chunks.append(para)
            continue
        sentences = SENTENCE_SPLIT_RE.split(para)
        buf = ""
        for sent in sentences:
            candidate = (buf + " " + sent).strip() if buf else sent
            if len(candidate) > max_chars and buf:
                chunks.append(buf)
                buf = sent
            else:
                buf = candidate
        if buf:
            chunks.append(buf)
    return chunks


def concat_wavs(paths, out_path):
    if not paths:
        return
    with wave.open(paths[0], "rb") as first:
        params = first.getparams()
    with wave.open(out_path, "wb") as out:
        out.setparams(params)
        for p in paths:
            with wave.open(p, "rb") as w:
                out.writeframes(w.readframes(w.getnframes()))


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                      formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--voice", required=True,
                         help="Reference WAV clip of the voice to clone (6-30s, clean, mono)")
    parser.add_argument("--book-dir", default=os.path.join(os.path.dirname(__file__), "book"))
    parser.add_argument("--out", required=True, help="Output directory")
    parser.add_argument("--language", default="ar", help="XTTS language code (default: ar)")
    parser.add_argument("--chapters", default=None,
                         help='Subset to render, e.g. "1-3,7" (default: all)')
    parser.add_argument("--model", default="tts_models/multilingual/multi-dataset/xtts_v2")
    parser.add_argument("--skip-full-concat", action="store_true",
                         help="Don't build the combined audiobook_full.wav at the end")
    args = parser.parse_args()

    if not os.path.isfile(args.voice):
        sys.exit(f"Reference voice clip not found: {args.voice}")

    manifest = load_manifest(args.book_dir)
    sections = manifest["sections"]
    chapter_nums = parse_chapter_range(args.chapters, len(sections))

    try:
        from TTS.api import TTS
    except ImportError:
        sys.exit(
            "Coqui TTS is not installed. Run:\n"
            "    pip install -r tools/audiobook/requirements.txt\n"
            "This step requires internet access to install the package and "
            "download the XTTS v2 model weights."
        )

    os.makedirs(args.out, exist_ok=True)
    tts = TTS(args.model)

    chapter_wav_paths = []
    for n in chapter_nums:
        section = sections[n - 1]
        chapter_id = section["file"].replace(".txt", "")
        chapter_out = os.path.join(args.out, f"{chapter_id}.wav")
        title = (section["part"] + " -- " if section["part"] else "") + section["heading"]

        if os.path.exists(chapter_out):
            print(f"[{chapter_id}] already rendered, skipping ({title})")
            chapter_wav_paths.append(chapter_out)
            continue

        print(f"[{chapter_id}] {title}")
        with open(os.path.join(args.book_dir, section["file"]), encoding="utf-8") as f:
            text = f.read()

        chunks = split_into_chunks(text)
        chunk_dir = os.path.join(args.out, f"_{chapter_id}_chunks")
        os.makedirs(chunk_dir, exist_ok=True)

        chunk_paths = []
        for i, chunk in enumerate(chunks):
            chunk_path = os.path.join(chunk_dir, f"{i:04d}.wav")
            chunk_paths.append(chunk_path)
            if os.path.exists(chunk_path):
                continue
            print(f"  chunk {i + 1}/{len(chunks)} ({len(chunk)} chars)")
            tts.tts_to_file(
                text=chunk,
                speaker_wav=args.voice,
                language=args.language,
                file_path=chunk_path,
            )

        concat_wavs(chunk_paths, chapter_out)
        chapter_wav_paths.append(chapter_out)
        print(f"  -> {chapter_out}")

    if not args.skip_full_concat and len(chapter_wav_paths) == len(sections):
        full_path = os.path.join(args.out, "audiobook_full.wav")
        concat_wavs(chapter_wav_paths, full_path)
        print(f"Full audiobook: {full_path}")
    elif not args.skip_full_concat:
        print("Rendered a subset of chapters; skipping combined audiobook_full.wav "
              "(pass --chapters covering the whole book, or omit --chapters, to build it).")


if __name__ == "__main__":
    main()
