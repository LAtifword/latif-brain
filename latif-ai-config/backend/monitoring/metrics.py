"""
Metrics Collector
Gathers system and application metrics
"""

import logging
import psutil
from typing import Dict, Any
from datetime import datetime
import time

logger = logging.getLogger(__name__)

class MetricsCollector:
    """Collects and reports metrics"""

    def __init__(self):
        self.start_time = time.time()
        self.request_count = 0
        self.error_count = 0
        self.total_processing_time = 0

    async def initialize(self):
        """Initialize metrics collector"""
        logger.info("Initializing Metrics Collector...")

    async def collect(self) -> Dict[str, Any]:
        """Collect current metrics"""

        process = psutil.Process()
        cpu_percent = process.cpu_percent(interval=0.1)
        memory_info = process.memory_info()
        memory_percent = process.memory_percent()

        uptime = time.time() - self.start_time
        avg_request_time = (
            self.total_processing_time / self.request_count
            if self.request_count > 0
            else 0
        )

        # Calculate requests per minute
        minutes_elapsed = max(uptime / 60, 1)
        requests_per_minute = int(self.request_count / minutes_elapsed)

        return {
            "cpu_percent": cpu_percent,
            "memory_percent": memory_percent,
            "memory_mb": memory_info.rss / 1024 / 1024,
            "requests_per_minute": requests_per_minute,
            "uptime_seconds": int(uptime),
            "active_agents": 0,
            "active_workflows": 0,
            "error_rate": (
                (self.error_count / self.request_count * 100)
                if self.request_count > 0
                else 0
            ),
            "avg_response_time": avg_request_time,
            "timestamp": datetime.now().isoformat()
        }

    async def record_request(self, processing_time: float, success: bool = True):
        """Record request metrics"""
        self.request_count += 1
        self.total_processing_time += processing_time

        if not success:
            self.error_count += 1

    async def get_summary(self) -> Dict[str, Any]:
        """Get metrics summary"""
        return await self.collect()
