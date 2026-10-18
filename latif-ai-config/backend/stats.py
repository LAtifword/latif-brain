"""
LATIF AI — System Monitor backend (run in Termux)

Exposes live CPU / RAM / battery / Ollama VRAM stats for the app's
Settings -> System Monitor gauges (js/stats-gauges.js polls GET /stats).

Install (Termux):
    pkg install python termux-api
    pip install -r requirements.txt

Run:
    uvicorn stats:app --host 127.0.0.1 --port 8000

Requires the Termux:API app installed + termux-api package for battery
readings; CPU/RAM come straight from /proc, no extra permissions needed.
"""
import json
import subprocess
import time

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="LATIF AI System Monitor")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # the app is served from file/localhost inside a WebView
    allow_methods=["GET"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://localhost:11434"


def read_cpu():
    with open("/proc/stat") as f:
        parts = f.readline().split()[1:]
    nums = list(map(int, parts))
    idle = nums[3] + nums[4]
    total = sum(nums)
    return idle, total


def cpu_percent(prev, cur):
    idle = cur[0] - prev[0]
    total = cur[1] - prev[1]
    return 0.0 if total <= 0 else round(100 * (1 - idle / total), 1)


def read_mem():
    m = {}
    for line in open("/proc/meminfo"):
        k, v = line.split(":")
        m[k] = int(v.strip().split()[0])
    total = m["MemTotal"]
    avail = m.get("MemAvailable", m.get("MemFree", 0))
    used = total - avail
    pct = 0.0 if total == 0 else round(100 * used / total, 1)
    return pct, total // 1024, used // 1024


def read_battery():
    try:
        out = subprocess.check_output(["termux-battery-status"], timeout=5)
        b = json.loads(out)
        return {"level": b.get("percentage"), "temperature": b.get("temperature"), "status": b.get("status")}
    except Exception:
        return {"level": None}


async def read_ollama_ps():
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{OLLAMA_URL}/api/ps", timeout=3)
            return r.json().get("models", [])
    except Exception:
        return []


@app.get("/stats")
async def stats():
    prev = read_cpu()
    time.sleep(0.2)
    cur = read_cpu()
    mem_pct, mem_total_mb, mem_used_mb = read_mem()
    return {
        "cpu": cpu_percent(prev, cur),
        "mem_pct": mem_pct,
        "mem_total_mb": mem_total_mb,
        "mem_used_mb": mem_used_mb,
        "battery": read_battery(),
        "ollama": await read_ollama_ps(),
    }


@app.get("/health")
def health():
    return {"ok": True}
