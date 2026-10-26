"""Fetch an allowlisted subset of authoritative IANA CSV exports."""
import urllib.request
from pathlib import Path

ROOT = "https://www.iana.org/assignments"
FILES = {
    "service-names-port-numbers": "service-names-port-numbers.csv",
    "protocol-numbers": "protocol-numbers-1.csv",
}
destination = Path(__file__).resolve().parents[1] / "data" / "iana"
destination.mkdir(parents=True, exist_ok=True)
for name, remote in FILES.items():
    url = f"{ROOT}/{name}/{remote}"
    req = urllib.request.Request(url, headers={"User-Agent": "LATIF-NI-IANA-sync/0.1"})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = response.read(15_000_001)
    if len(data) > 15_000_000 or not data.startswith((b"Service Name", b"Decimal")):
        raise RuntimeError(f"Unexpected registry format: {name}")
    (destination / f"{name}.csv").write_bytes(data)
    print(f"{name}: {len(data)} bytes")
