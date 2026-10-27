#!/usr/bin/env python3
"""
prepare_text.py — Turn the source .docx manuscript into a clean, structured
narration script for text-to-speech.

Output:
  - build/segments.json : ordered list of {kind, text, pause_after} segments
  - build/narration.txt : human-readable flattened script (for proofreading)

Segment "kind" drives pacing (pause length) and, later, could drive voice
switching (e.g. a different voice for the "confession" interludes).

Pure standard library — no third-party dependencies — so it runs anywhere.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

# Pause lengths (seconds) inserted AFTER a segment of each kind.
PAUSE = {
    "title": 1.2,
    "subtitle": 0.9,
    "author": 1.0,
    "dedication": 0.6,
    "part": 1.4,
    "part_en": 0.2,
    "chapter": 1.1,
    "heading": 0.9,
    "confession": 1.0,
    "divider": 1.3,
    "epigraph": 1.0,
    "body": 0.55,
}

DECOR_ONLY = re.compile(r"^[\s❧✦✧★☆•·—–\-]+$")


def read_paragraphs(docx_path: str):
    z = zipfile.ZipFile(docx_path)
    root = ET.fromstring(z.read("word/document.xml").decode("utf-8"))
    paras = []
    for p in root.iter(f"{W}p"):
        txt = "".join(t.text for t in p.iter(f"{W}t") if t.text).strip()
        if txt:
            paras.append(txt)
    return paras


def classify(idx: int, line: str) -> str:
    if DECOR_ONLY.match(line):
        return "divider"
    if line.startswith("«") and line.endswith("»"):
        return "epigraph"
    if re.match(r"^الجزء\s", line):
        return "part"
    if line in ("Exposition", "Confrontation", "Judgment"):
        return "part_en"
    if re.match(r"^الفصل\s", line):
        return "chapter"
    if re.match(r"^اعتراف\s+رقم", line):
        return "confession"
    if idx == 0:
        return "title"
    # Short standalone lines near the front are headings / dedication lines.
    if len(line) < 25:
        return "heading"
    return "body"


def build_segments(paras):
    segments = []
    for i, line in enumerate(paras):
        kind = classify(i, line)
        if kind == "divider":
            # Drop the glyph, keep only its pause.
            segments.append({"kind": "divider", "text": "", "pause_after": PAUSE["divider"]})
            continue
        # espeak reads « » and — acceptably, but normalise stray whitespace.
        text = re.sub(r"\s+", " ", line).strip()
        segments.append({"kind": kind, "text": text, "pause_after": PAUSE.get(kind, PAUSE["body"])})
    return segments


def main():
    docx = sys.argv[1] if len(sys.argv) > 1 else "text/source.docx"
    outdir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("build")
    outdir.mkdir(parents=True, exist_ok=True)

    paras = read_paragraphs(docx)
    segments = build_segments(paras)

    (outdir / "segments.json").write_text(
        json.dumps(segments, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    with (outdir / "narration.txt").open("w", encoding="utf-8") as f:
        for s in segments:
            if s["text"]:
                f.write(f"[{s['kind']}] {s['text']}\n")
            else:
                f.write(f"[{s['kind']}]\n")

    spoken = [s for s in segments if s["text"]]
    chars = sum(len(s["text"]) for s in spoken)
    print(f"paragraphs read : {len(paras)}")
    print(f"segments        : {len(segments)} ({len(spoken)} spoken, "
          f"{len(segments) - len(spoken)} dividers)")
    print(f"characters       : {chars}")
    from collections import Counter
    print("by kind         :", dict(Counter(s['kind'] for s in segments)))


if __name__ == "__main__":
    main()
