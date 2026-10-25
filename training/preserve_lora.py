#!/usr/bin/env python3
"""Preserve an existing LATIF NI LoRA run without retraining.

Run in Colab after mounting Google Drive:
  python training/preserve_lora.py --destination /content/drive/MyDrive/LATIF-NI/runs
No GitHub token, remote upload, or training required.
"""
import argparse
import hashlib
import json
import shutil
import time
from pathlib import Path

def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def preserve(source, destination, evaluation, manifest):
    source, destination = Path(source), Path(destination)
    required = ("adapter_model.safetensors", "adapter_config.json")
    missing = [n for n in required if not (source / n).is_file()]
    if missing:
        raise FileNotFoundError(f"Missing trained adapter files: {missing}; do not rerun training blindly")
    if not destination.parent.is_dir():
        raise FileNotFoundError(f"Destination parent unavailable: {destination.parent} (mount persistent storage first)")
    if destination.exists():
        raise FileExistsError(f"Destination exists; choose a new run ID to avoid overwriting: {destination}")
    staging = destination.with_name(destination.name + ".incomplete")
    if staging.exists():
        raise FileExistsError(f"Staging directory exists: {staging}")
    staging.mkdir()
    try:
        shutil.copytree(source, staging / "adapter")
        for path, name in ((Path(evaluation), "evaluation.json"), (Path(manifest), "dataset_manifest.json")):
            if path.is_file():
                shutil.copy2(path, staging / name)
        files = sorted(p for p in staging.rglob("*") if p.is_file())
        report = {"status": "copied_and_verified", "base_model": "Qwen/Qwen2.5-0.5B-Instruct",
                  "files": [{"path": str(p.relative_to(staging)), "bytes": p.stat().st_size,
                             "sha256": sha256(p)} for p in files]}
        (staging / "backup_manifest.json").write_text(json.dumps(report, indent=2) + "\n")
        for item in report["files"]:
            target = staging / item["path"]
            if sha256(target) != item["sha256"]:
                raise IOError(f"Checksum verification failed: {target}")
        staging.rename(destination)
        return report
    except Exception:
        # Preserve staging files for recovery, rather than deleting potentially useful data.
        raise

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--source", default="artifacts/lora")
    p.add_argument("--destination", required=True)
    p.add_argument("--evaluation", default="artifacts/evaluation.json")
    p.add_argument("--manifest", default="training/data/manifest.json")
    args = p.parse_args()
    result = preserve(args.source, args.destination, args.evaluation, args.manifest)
    print(json.dumps({"destination": args.destination, **result}, indent=2))
