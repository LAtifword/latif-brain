import shutil
from datetime import datetime, timezone

import psutil

from app.services.model_manager import process_uptime_seconds

_gpu_checked = False
_gpu_available = False


def _detect_gpu() -> bool:
    """Best-effort, dependency-free GPU detection.

    Real detection (no faked utilization numbers): looks for an NVIDIA
    driver via `nvidia-smi` on PATH. Without a vendor SDK installed we can't
    safely report utilization, so GPU load is intentionally omitted from
    SystemStats rather than invented.
    """
    global _gpu_checked, _gpu_available
    if _gpu_checked:
        return _gpu_available
    _gpu_checked = True
    _gpu_available = shutil.which("nvidia-smi") is not None
    return _gpu_available


def collect_system_stats() -> dict:
    cpu_percent = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    return {
        "cpu_percent": round(cpu_percent, 1),
        "memory_percent": round(mem.percent, 1),
        "memory_used_mb": round(mem.used / (1024 * 1024), 1),
        "memory_total_mb": round(mem.total / (1024 * 1024), 1),
        "disk_percent": round(disk.percent, 1),
        "disk_used_gb": round(disk.used / (1024 ** 3), 2),
        "disk_total_gb": round(disk.total / (1024 ** 3), 2),
        "gpu_available": _detect_gpu(),
        "process_count": len(psutil.pids()),
        "uptime_seconds": round(process_uptime_seconds(), 1),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
