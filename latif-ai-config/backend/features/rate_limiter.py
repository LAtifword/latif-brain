"""
Advanced Rate Limiting & Quota Management
Token bucket algorithm, sliding window, adaptive limiting
"""

import logging
import time
from typing import Dict, Optional, Tuple
from dataclasses import dataclass, field
from collections import deque
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


@dataclass
class RateLimitQuota:
    """Rate limit quota configuration"""
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    requests_per_day: int = 10000
    concurrent_requests: int = 10
    tokens_per_minute: int = 90000  # For token counting
    burst_size: int = 5  # Allow burst beyond rate


class TokenBucket:
    """Token bucket rate limiter"""

    def __init__(self, capacity: float, refill_rate: float):
        """
        Args:
            capacity: Maximum tokens
            refill_rate: Tokens per second
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = capacity
        self.last_refill = time.time()

    def _refill(self):
        """Refill tokens based on elapsed time"""
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

    def consume(self, tokens: float = 1.0) -> bool:
        """Try to consume tokens"""
        self._refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    def get_available_tokens(self) -> float:
        """Get available tokens"""
        self._refill()
        return self.tokens


class SlidingWindowCounter:
    """Sliding window rate limiter"""

    def __init__(self, window_size_seconds: int, max_requests: int):
        self.window_size = window_size_seconds
        self.max_requests = max_requests
        self.requests = deque()

    def record_request(self) -> None:
        """Record a request"""
        self.requests.append(time.time())

    def is_allowed(self) -> bool:
        """Check if request is allowed"""
        now = time.time()

        # Remove old requests outside window
        while self.requests and self.requests[0] < now - self.window_size:
            self.requests.popleft()

        return len(self.requests) < self.max_requests

    def get_remaining(self) -> int:
        """Get remaining requests in current window"""
        now = time.time()
        while self.requests and self.requests[0] < now - self.window_size:
            self.requests.popleft()
        return self.max_requests - len(self.requests)


class AdaptiveRateLimiter:
    """Adaptive rate limiter that adjusts based on system load"""

    def __init__(self, quota: RateLimitQuota):
        self.quota = quota
        self.clients: Dict[str, Dict] = {}

        # Token buckets for different time windows
        self.global_bucket = TokenBucket(quota.requests_per_minute, quota.requests_per_minute / 60)
        self.minute_counter = SlidingWindowCounter(60, quota.requests_per_minute)
        self.hour_counter = SlidingWindowCounter(3600, quota.requests_per_hour)
        self.day_counter = SlidingWindowCounter(86400, quota.requests_per_day)

        self.current_concurrent = 0
        self.max_concurrent = quota.concurrent_requests

    def _get_client_state(self, client_id: str) -> Dict:
        """Get or create client state"""
        if client_id not in self.clients:
            self.clients[client_id] = {
                "token_bucket": TokenBucket(self.quota.requests_per_minute, self.quota.requests_per_minute / 60),
                "minute_counter": SlidingWindowCounter(60, self.quota.requests_per_minute),
                "hour_counter": SlidingWindowCounter(3600, self.quota.requests_per_hour),
                "day_counter": SlidingWindowCounter(86400, self.quota.requests_per_day),
                "concurrent": 0,
                "blocked_until": None,
                "violation_count": 0
            }
        return self.clients[client_id]

    def check_rate_limit(
        self,
        client_id: str,
        tokens: int = 1,
        endpoint: Optional[str] = None
    ) -> Tuple[bool, Optional[float], Dict[str, any]]:
        """
        Check if request is allowed

        Returns:
            (allowed, retry_after_seconds, remaining_quota)
        """
        state = self._get_client_state(client_id)

        # Check if client is temporarily blocked
        if state["blocked_until"] and time.time() < state["blocked_until"]:
            retry_after = state["blocked_until"] - time.time()
            return False, retry_after, {}

        # Global rate limit check
        if not self.global_bucket.consume(tokens):
            retry_after = 60 / self.quota.requests_per_minute
            return False, retry_after, {}

        # Per-client checks
        if not state["token_bucket"].consume(tokens):
            retry_after = 60 / self.quota.requests_per_minute
            return False, retry_after, {}

        if not state["minute_counter"].is_allowed():
            retry_after = 60
            state["violation_count"] += 1
            if state["violation_count"] >= 3:
                state["blocked_until"] = time.time() + 300  # 5 minute block
            return False, retry_after, {}

        if not state["hour_counter"].is_allowed():
            retry_after = 3600
            return False, retry_after, {}

        if not state["day_counter"].is_allowed():
            retry_after = 86400
            return False, retry_after, {}

        # Concurrent request limit
        if self.current_concurrent >= self.max_concurrent:
            return False, 1.0, {}

        # Record request
        state["minute_counter"].record_request()
        state["hour_counter"].record_request()
        state["day_counter"].record_request()
        self.current_concurrent += 1

        # Return remaining quota
        remaining = {
            "minute": state["minute_counter"].get_remaining(),
            "hour": state["hour_counter"].get_remaining(),
            "day": state["day_counter"].get_remaining(),
            "concurrent": self.max_concurrent - self.current_concurrent
        }

        return True, None, remaining

    def release_request(self, client_id: str) -> None:
        """Release a concurrent request"""
        if self.current_concurrent > 0:
            self.current_concurrent -= 1

        if client_id in self.clients:
            self.clients[client_id]["violation_count"] = max(0, self.clients[client_id]["violation_count"] - 1)

    def get_client_quota(self, client_id: str) -> Dict[str, any]:
        """Get client's current quota usage"""
        state = self._get_client_state(client_id)

        return {
            "client_id": client_id,
            "minute_remaining": state["minute_counter"].get_remaining(),
            "hour_remaining": state["hour_counter"].get_remaining(),
            "day_remaining": state["day_counter"].get_remaining(),
            "concurrent_available": self.max_concurrent - state["concurrent"],
            "blocked_until": state["blocked_until"],
            "violation_count": state["violation_count"]
        }

    def get_global_stats(self) -> Dict[str, any]:
        """Get global rate limiter statistics"""
        return {
            "current_concurrent": self.current_concurrent,
            "max_concurrent": self.max_concurrent,
            "global_minute_tokens": self.global_bucket.get_available_tokens(),
            "quota": {
                "requests_per_minute": self.quota.requests_per_minute,
                "requests_per_hour": self.quota.requests_per_hour,
                "requests_per_day": self.quota.requests_per_day,
                "tokens_per_minute": self.quota.tokens_per_minute
            },
            "total_clients": len(self.clients),
            "blocked_clients": sum(
                1 for state in self.clients.values()
                if state["blocked_until"] and time.time() < state["blocked_until"]
            )
        }

    def reset_client(self, client_id: str) -> None:
        """Reset client quota"""
        if client_id in self.clients:
            del self.clients[client_id]
            logger.info(f"Reset quota for client: {client_id}")

    def cleanup_expired_blocks(self) -> int:
        """Remove expired client blocks"""
        now = time.time()
        cleaned = 0

        for client_id, state in list(self.clients.items()):
            if state["blocked_until"] and now > state["blocked_until"]:
                state["blocked_until"] = None
                cleaned += 1

        return cleaned


# Global rate limiter instance
default_quota = RateLimitQuota()
rate_limiter = AdaptiveRateLimiter(default_quota)
