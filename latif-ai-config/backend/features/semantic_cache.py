"""
Semantic Caching - Cache responses based on semantic similarity
Reduces redundant API calls for similar queries
"""

import hashlib
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Single cache entry with metadata"""
    key: str
    value: Any
    embedding: Optional[List[float]] = None
    timestamp: float = field(default_factory=time.time)
    ttl: int = 3600  # seconds
    hit_count: int = 0
    similarity_score: float = 0.0

    def is_expired(self) -> bool:
        """Check if cache entry has expired"""
        return (time.time() - self.timestamp) > self.ttl


class SimpleEmbedding:
    """Simple embedding generator for semantic similarity"""

    @staticmethod
    def embed_text(text: str) -> List[float]:
        """Generate simple embedding from text"""
        # Normalize text
        text = text.lower()

        # Character-level n-gram features
        embedding = {}
        n = 3
        for i in range(len(text) - n + 1):
            ngram = text[i:i+n]
            embedding[ngram] = embedding.get(ngram, 0) + 1

        # Convert to vector (sparse to dense)
        # Use hash bucketing for fixed size
        vector_size = 128
        vector = [0.0] * vector_size

        for ngram, count in embedding.items():
            hash_val = int(hashlib.md5(ngram.encode()).hexdigest(), 16)
            idx = hash_val % vector_size
            vector[idx] += count

        # Normalize
        magnitude = sum(v ** 2 for v in vector) ** 0.5
        if magnitude > 0:
            vector = [v / magnitude for v in vector]

        return vector

    @staticmethod
    def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity"""
        if len(vec1) != len(vec2) or len(vec1) == 0:
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = sum(a ** 2 for a in vec1) ** 0.5
        magnitude2 = sum(b ** 2 for b in vec2) ** 0.5

        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0

        return dot_product / (magnitude1 * magnitude2)


class SemanticCache:
    """Semantic cache for intelligent query deduplication"""

    def __init__(self, max_size: int = 1000, default_ttl: int = 3600):
        self.cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.embeddings: Dict[str, List[float]] = {}
        self.hits = 0
        self.misses = 0

    def _generate_key(self, query: str) -> str:
        """Generate cache key from query"""
        return hashlib.sha256(query.encode()).hexdigest()[:16]

    async def get_or_compute(
        self,
        query: str,
        compute_fn,
        similarity_threshold: float = 0.85,
        ttl: Optional[int] = None
    ) -> Tuple[Any, bool, Optional[float]]:
        """Get from cache or compute, with semantic matching"""
        # First check exact match
        key = self._generate_key(query)

        if key in self.cache:
            entry = self.cache[key]
            if not entry.is_expired():
                self.hits += 1
                entry.hit_count += 1
                logger.info(f"Cache hit for key: {key}")
                return entry.value, True, 1.0

        # Check semantic matches
        query_embedding = SimpleEmbedding.embed_text(query)
        best_match = None
        best_similarity = 0.0

        for cache_key, entry in list(self.cache.items()):
            if entry.is_expired():
                del self.cache[cache_key]
                if cache_key in self.embeddings:
                    del self.embeddings[cache_key]
                continue

            if cache_key in self.embeddings:
                similarity = SimpleEmbedding.cosine_similarity(
                    query_embedding,
                    self.embeddings[cache_key]
                )

                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = entry

        if best_match and best_similarity >= similarity_threshold:
            self.hits += 1
            best_match.hit_count += 1
            logger.info(f"Semantic cache hit with similarity: {best_similarity:.2%}")
            return best_match.value, True, best_similarity

        # Cache miss - compute value
        self.misses += 1
        logger.info(f"Cache miss for key: {key}")

        value = compute_fn() if not hasattr(compute_fn, '__await__') else (await compute_fn())

        # Store in cache
        entry = CacheEntry(
            key=key,
            value=value,
            embedding=query_embedding,
            ttl=ttl or self.default_ttl
        )

        # Evict oldest entry if at capacity
        if len(self.cache) >= self.max_size:
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k].timestamp)
            del self.cache[oldest_key]
            if oldest_key in self.embeddings:
                del self.embeddings[oldest_key]

        self.cache[key] = entry
        self.embeddings[key] = query_embedding

        return value, False, None

    def put(self, query: str, value: Any, ttl: Optional[int] = None) -> None:
        """Manually store value in cache"""
        key = self._generate_key(query)
        embedding = SimpleEmbedding.embed_text(query)

        entry = CacheEntry(
            key=key,
            value=value,
            embedding=embedding,
            ttl=ttl or self.default_ttl
        )

        if len(self.cache) >= self.max_size:
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k].timestamp)
            del self.cache[oldest_key]
            if oldest_key in self.embeddings:
                del self.embeddings[oldest_key]

        self.cache[key] = entry
        self.embeddings[key] = embedding

    def invalidate(self, query: Optional[str] = None) -> None:
        """Invalidate cache entry or entire cache"""
        if query:
            key = self._generate_key(query)
            if key in self.cache:
                del self.cache[key]
            if key in self.embeddings:
                del self.embeddings[key]
        else:
            self.cache.clear()
            self.embeddings.clear()

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0

        # Calculate memory estimate (rough)
        cache_size_bytes = sum(
            len(json.dumps(entry.value)) + len(embedding) * 8
            for entry, embedding in zip(self.cache.values(), self.embeddings.values())
        )

        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate_percent": hit_rate,
            "estimated_memory_kb": cache_size_bytes / 1024,
            "ttl_seconds": self.default_ttl
        }

    def cleanup_expired(self) -> int:
        """Remove expired entries"""
        expired_keys = [
            key for key, entry in self.cache.items()
            if entry.is_expired()
        ]

        for key in expired_keys:
            del self.cache[key]
            if key in self.embeddings:
                del self.embeddings[key]

        return len(expired_keys)


class PromptCache:
    """Dedicated cache for prompt completions"""

    def __init__(self):
        self.cache = SemanticCache(max_size=500, default_ttl=7200)

    async def get_completion(
        self,
        prompt: str,
        completion_fn,
        similarity_threshold: float = 0.80
    ) -> Tuple[str, bool]:
        """Get cached completion or generate new one"""
        value, hit, similarity = await self.cache.get_or_compute(
            prompt,
            completion_fn,
            similarity_threshold
        )
        return value, hit

    def clear(self) -> None:
        """Clear prompt cache"""
        self.cache.invalidate()

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return self.cache.get_stats()


# Global cache instances
semantic_cache = SemanticCache()
prompt_cache = PromptCache()
