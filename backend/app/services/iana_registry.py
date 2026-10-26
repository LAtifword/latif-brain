"""Read-only IANA registry lookup. No network requests or command execution."""
import csv
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "iana"
ALLOWED = {"service-names-port-numbers", "protocol-numbers", "media-types"}

def search_registry(term: str, registry: str = "service-names-port-numbers", limit: int = 50):
    if registry not in ALLOWED:
        raise ValueError("Unsupported registry")
    term = term.strip().casefold()
    if not term or len(term) > 120:
        return []
    path = DATA_DIR / (registry + ".csv")
    if not path.is_file():
        return []
    results = []
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            if term in " ".join(str(v) for v in row.values()).casefold():
                results.append(row)
                if len(results) >= min(max(limit, 1), 100):
                    break
    return results
