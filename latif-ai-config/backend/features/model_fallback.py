"""
Model Fallback Chains - Intelligent fallback strategy for model selection
Automatically routes to alternative models based on availability and performance
"""

import logging
from typing import Dict, List, Optional, Tuple, Callable, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import asyncio

logger = logging.getLogger(__name__)


@dataclass
class ModelStatus:
    """Status of a single model"""
    name: str
    available: bool = True
    last_check: float = field(default_factory=lambda: 0)
    error_count: int = 0
    success_count: int = 0
    avg_latency_ms: float = 0.0
    last_error: Optional[str] = None
    check_interval: int = 60  # seconds

    def is_healthy(self) -> bool:
        """Check if model is healthy"""
        if not self.available:
            return False

        # Consider unhealthy if error rate > 20%
        total = self.success_count + self.error_count
        if total > 10:
            error_rate = self.error_count / total
            if error_rate > 0.2:
                return False

        return True

    def get_health_score(self) -> float:
        """Calculate health score (0-1)"""
        if not self.available:
            return 0.0

        total = self.success_count + self.error_count
        if total == 0:
            return 0.5

        success_rate = self.success_count / total
        latency_factor = max(0, 1 - (self.avg_latency_ms / 1000))  # Penalize high latency
        error_factor = 1 - min(0.5, self.error_count / total)

        return (success_rate * 0.5 + latency_factor * 0.3 + error_factor * 0.2)


class ModelFallbackChain:
    """Manages fallback chain for model selection"""

    def __init__(self):
        self.models: Dict[str, ModelStatus] = {}
        self.chains: Dict[str, List[str]] = {}  # Chain name -> [model1, model2, ...]
        self.health_checks: Dict[str, Callable] = {}  # Model -> health check function
        self.last_full_check = 0
        self.check_interval = 60

    def register_model(self, name: str, health_check_fn: Optional[Callable] = None) -> None:
        """Register a model and optional health check function"""
        self.models[name] = ModelStatus(name)
        if health_check_fn:
            self.health_checks[name] = health_check_fn
        logger.info(f"Registered model: {name}")

    def create_chain(self, chain_name: str, model_order: List[str]) -> None:
        """Create a fallback chain"""
        self.chains[chain_name] = model_order
        logger.info(f"Created fallback chain '{chain_name}': {' -> '.join(model_order)}")

    async def check_model_health(self, model_name: str) -> bool:
        """Check if model is healthy"""
        if model_name not in self.models:
            return False

        # Run health check if available
        if model_name in self.health_checks:
            try:
                is_healthy = self.health_checks[model_name]()
                if hasattr(is_healthy, '__await__'):
                    is_healthy = await is_healthy
                self.models[model_name].available = is_healthy
                self.models[model_name].last_check = asyncio.get_event_loop().time()
                return is_healthy
            except Exception as e:
                logger.warning(f"Health check failed for {model_name}: {e}")
                self.models[model_name].available = False
                self.models[model_name].last_error = str(e)
                return False

        return self.models[model_name].available

    async def select_model(
        self,
        chain_name: str,
        min_quality: float = 0.5
    ) -> Optional[str]:
        """
        Select best available model from chain

        Returns: Model name or None if none available
        """
        if chain_name not in self.chains:
            logger.warning(f"Fallback chain not found: {chain_name}")
            return None

        chain = self.chains[chain_name]

        # Check all models in chain
        for model_name in chain:
            is_healthy = await self.check_model_health(model_name)

            if is_healthy:
                health_score = self.models[model_name].get_health_score()
                if health_score >= min_quality:
                    logger.info(f"Selected model from '{chain_name}': {model_name} (health: {health_score:.2%})")
                    return model_name

        logger.warning(f"No healthy model found in chain '{chain_name}'")
        return None

    def record_request(
        self,
        model_name: str,
        success: bool,
        latency_ms: float,
        error: Optional[str] = None
    ) -> None:
        """Record request result for model"""
        if model_name not in self.models:
            return

        model = self.models[model_name]

        if success:
            model.success_count += 1
            # Update average latency with exponential moving average
            alpha = 0.3
            model.avg_latency_ms = alpha * latency_ms + (1 - alpha) * model.avg_latency_ms
        else:
            model.error_count += 1
            model.last_error = error

    async def check_all_models(self) -> Dict[str, bool]:
        """Check health of all registered models"""
        results = {}
        for model_name in self.models:
            results[model_name] = await self.check_model_health(model_name)
        self.last_full_check = asyncio.get_event_loop().time()
        return results

    def get_status(self, model_name: Optional[str] = None) -> Dict[str, Any]:
        """Get status of model(s)"""
        if model_name:
            if model_name not in self.models:
                return {"error": f"Model {model_name} not found"}

            model = self.models[model_name]
            return {
                "name": model.name,
                "available": model.available,
                "healthy": model.is_healthy(),
                "health_score": model.get_health_score(),
                "success_count": model.success_count,
                "error_count": model.error_count,
                "avg_latency_ms": model.avg_latency_ms,
                "last_error": model.last_error
            }
        else:
            return {
                model_name: {
                    "available": model.available,
                    "healthy": model.is_healthy(),
                    "health_score": model.get_health_score()
                }
                for model_name, model in self.models.items()
            }

    def get_chain_status(self, chain_name: str) -> Dict[str, Any]:
        """Get status of entire fallback chain"""
        if chain_name not in self.chains:
            return {"error": f"Chain {chain_name} not found"}

        chain = self.chains[chain_name]
        status = {}

        for model_name in chain:
            if model_name in self.models:
                model = self.models[model_name]
                status[model_name] = {
                    "position": chain.index(model_name),
                    "available": model.available,
                    "healthy": model.is_healthy(),
                    "health_score": model.get_health_score(),
                    "avg_latency_ms": model.avg_latency_ms
                }

        return {"chain": chain_name, "models": status}


# Preset chains for common scenarios
class FallbackChainPresets:
    """Preset fallback chains"""

    @staticmethod
    def create_quality_chain() -> Dict[str, List[str]]:
        """Chain prioritizing quality (larger models first)"""
        return {
            "quality": ["dolphin-mixtral", "mistral", "neural-chat", "llama2"],
        }

    @staticmethod
    def create_speed_chain() -> Dict[str, List[str]]:
        """Chain prioritizing speed (faster models first)"""
        return {
            "speed": ["neural-chat", "llama2", "mistral", "dolphin-mixtral"],
        }

    @staticmethod
    def create_balanced_chain() -> Dict[str, List[str]]:
        """Chain balancing quality and speed"""
        return {
            "balanced": ["mistral", "neural-chat", "llama2", "dolphin-mixtral"],
        }

    @staticmethod
    def create_cost_chain() -> Dict[str, List[str]]:
        """Chain prioritizing cost efficiency"""
        return {
            "cost": ["llama2", "neural-chat", "mistral", "dolphin-mixtral"],
        }

    @staticmethod
    def create_all_chains() -> Dict[str, List[str]]:
        """Get all preset chains"""
        return {
            **FallbackChainPresets.create_quality_chain(),
            **FallbackChainPresets.create_speed_chain(),
            **FallbackChainPresets.create_balanced_chain(),
            **FallbackChainPresets.create_cost_chain(),
        }


# Global fallback manager
fallback_manager = ModelFallbackChain()

# Initialize with preset chains
for chain_name, models in FallbackChainPresets.create_all_chains().items():
    fallback_manager.create_chain(chain_name, models)
    for model in models:
        if model not in fallback_manager.models:
            fallback_manager.register_model(model)
