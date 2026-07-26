"""
LATIF GX Advanced Features Package
Includes: Vector DB, Structured Outputs, Cost Optimization, Semantic Caching,
Rate Limiting, and Model Fallback Chains
"""

from .vector_db import VectorDatabaseManager, vector_db, InMemoryVectorDB, Embedding
from .structured_output import (
    StructuredOutputManager,
    OutputFormat,
    FunctionDefinition,
    FunctionParameter,
    JSONSchema,
    output_manager
)
from .cost_optimizer import (
    CostOptimizer,
    TokenCounter,
    TokenMetrics,
    ModelPerformance,
    cost_optimizer
)
from .semantic_cache import (
    SemanticCache,
    PromptCache,
    SimpleEmbedding,
    CacheEntry,
    semantic_cache,
    prompt_cache
)
from .rate_limiter import (
    AdaptiveRateLimiter,
    RateLimitQuota,
    TokenBucket,
    SlidingWindowCounter,
    rate_limiter,
    default_quota
)
from .model_fallback import (
    ModelFallbackChain,
    ModelStatus,
    FallbackChainPresets,
    fallback_manager
)

__all__ = [
    # Vector DB
    "VectorDatabaseManager",
    "vector_db",
    "InMemoryVectorDB",
    "Embedding",
    # Structured Output
    "StructuredOutputManager",
    "OutputFormat",
    "FunctionDefinition",
    "FunctionParameter",
    "JSONSchema",
    "output_manager",
    # Cost Optimization
    "CostOptimizer",
    "TokenCounter",
    "TokenMetrics",
    "ModelPerformance",
    "cost_optimizer",
    # Semantic Caching
    "SemanticCache",
    "PromptCache",
    "SimpleEmbedding",
    "CacheEntry",
    "semantic_cache",
    "prompt_cache",
    # Rate Limiting
    "AdaptiveRateLimiter",
    "RateLimitQuota",
    "TokenBucket",
    "SlidingWindowCounter",
    "rate_limiter",
    "default_quota",
    # Model Fallback
    "ModelFallbackChain",
    "ModelStatus",
    "FallbackChainPresets",
    "fallback_manager",
]
