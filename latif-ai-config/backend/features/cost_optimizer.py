"""
Cost Optimization Layer - Token counting, smart routing, and cost tracking
Optimizes inference costs and routing decisions based on model performance
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


@dataclass
class TokenMetrics:
    """Token usage metrics"""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost: float


@dataclass
class ModelPerformance:
    """Model performance metrics"""
    model_name: str
    avg_latency_ms: float
    cost_per_1k_tokens: float
    quality_score: float  # 0-1
    availability: float  # 0-1


class TokenCounter:
    """Intelligent token counting for various models"""

    # Approximate token ratios for common models
    TOKEN_RATIOS = {
        "llama2": 1.0,  # baseline
        "mistral": 1.0,
        "neural-chat": 1.1,
        "dolphin-mixtral": 0.9,
        "openchat": 1.0,
    }

    COST_PER_1K_TOKENS = {
        "gpt-4": {"prompt": 0.03, "completion": 0.06},
        "gpt-3.5-turbo": {"prompt": 0.0005, "completion": 0.0015},
        "claude-opus": {"prompt": 0.015, "completion": 0.075},
        "claude-sonnet": {"prompt": 0.003, "completion": 0.015},
        "llama2": {"prompt": 0.0001, "completion": 0.0001},  # local
    }

    @staticmethod
    def estimate_tokens(text: str, model: str = "llama2") -> int:
        """Estimate token count using word-based heuristic"""
        words = len(text.split())
        # Rough estimate: ~4 chars per token
        chars = len(text)
        token_estimate = max(words // 4, chars // 4)

        ratio = TokenCounter.TOKEN_RATIOS.get(model, 1.0)
        return max(1, int(token_estimate * ratio))

    @staticmethod
    def calculate_cost(
        prompt_tokens: int,
        completion_tokens: int,
        model: str = "llama2"
    ) -> float:
        """Calculate inference cost"""
        costs = TokenCounter.COST_PER_1K_TOKENS.get(model, {"prompt": 0, "completion": 0})

        prompt_cost = (prompt_tokens / 1000) * costs.get("prompt", 0)
        completion_cost = (completion_tokens / 1000) * costs.get("completion", 0)

        return prompt_cost + completion_cost

    @staticmethod
    def get_token_metrics(
        prompt: str,
        response: str,
        model: str = "llama2"
    ) -> TokenMetrics:
        """Get complete token metrics"""
        prompt_tokens = TokenCounter.estimate_tokens(prompt, model)
        completion_tokens = TokenCounter.estimate_tokens(response, model)
        total_tokens = prompt_tokens + completion_tokens
        cost = TokenCounter.calculate_cost(prompt_tokens, completion_tokens, model)

        return TokenMetrics(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cost=cost
        )


class CostOptimizer:
    """Optimize inference costs through smart routing"""

    def __init__(self):
        self.model_performance: Dict[str, ModelPerformance] = {}
        self.usage_history: List[Dict[str, Any]] = []
        self.cost_threshold = 1.0  # Alert threshold in dollars
        self._initialize_models()

    def _initialize_models(self):
        """Initialize with default model performance profiles"""
        models = [
            ModelPerformance("llama2", 200, 0.0001, 0.75, 0.99),
            ModelPerformance("mistral", 150, 0.00015, 0.82, 0.98),
            ModelPerformance("neural-chat", 180, 0.0001, 0.70, 0.97),
            ModelPerformance("dolphin-mixtral", 250, 0.0002, 0.88, 0.95),
            ModelPerformance("gpt-3.5-turbo", 50, 0.0015, 0.80, 0.99),
            ModelPerformance("claude-sonnet", 80, 0.015, 0.90, 0.99),
        ]

        for model in models:
            self.model_performance[model.model_name] = model

    def calculate_efficiency_score(
        self,
        model_name: str,
        required_quality: float = 0.7
    ) -> float:
        """Calculate efficiency score (lower is better)"""
        if model_name not in self.model_performance:
            return float('inf')

        perf = self.model_performance[model_name]

        if perf.quality_score < required_quality:
            return float('inf')

        # Score = cost per 1k tokens / quality
        efficiency = perf.cost_per_1k_tokens / max(perf.quality_score, 0.1)
        efficiency *= (1 / perf.availability)  # Penalize unavailability

        return efficiency

    def select_optimal_model(
        self,
        available_models: List[str],
        required_quality: float = 0.7,
        budget_per_request: Optional[float] = None
    ) -> str:
        """Select model with best cost-quality balance"""
        valid_models = [
            m for m in available_models
            if m in self.model_performance and
               self.model_performance[m].quality_score >= required_quality
        ]

        if not valid_models:
            # Fallback to highest quality
            return max(available_models, key=lambda m: self.model_performance.get(m, ModelPerformance(m, 0, 0, 0, 0)).quality_score)

        if budget_per_request:
            affordable = [
                m for m in valid_models
                if self.model_performance[m].cost_per_1k_tokens <= budget_per_request
            ]
            if affordable:
                valid_models = affordable

        # Return model with best efficiency
        return min(valid_models, key=lambda m: self.calculate_efficiency_score(m, required_quality))

    def record_usage(
        self,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        latency_ms: float,
        quality_score: float
    ) -> Dict[str, Any]:
        """Record token usage and update metrics"""
        cost = TokenCounter.calculate_cost(prompt_tokens, completion_tokens, model)
        total_tokens = prompt_tokens + completion_tokens

        usage = {
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "cost": cost,
            "latency_ms": latency_ms,
            "quality_score": quality_score
        }

        self.usage_history.append(usage)

        # Update model performance (exponential moving average)
        if model in self.model_performance:
            perf = self.model_performance[model]
            alpha = 0.1  # Smoothing factor

            perf.avg_latency_ms = (alpha * latency_ms) + ((1 - alpha) * perf.avg_latency_ms)
            perf.quality_score = (alpha * quality_score) + ((1 - alpha) * perf.quality_score)

        return usage

    def get_cost_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get cost summary for time period"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_usage = [
            u for u in self.usage_history
            if datetime.fromisoformat(u["timestamp"]) > cutoff_time
        ]

        total_cost = sum(u["cost"] for u in recent_usage)
        total_tokens = sum(u["total_tokens"] for u in recent_usage)
        avg_latency = sum(u["latency_ms"] for u in recent_usage) / len(recent_usage) if recent_usage else 0

        model_breakdown = {}
        for usage in recent_usage:
            model = usage["model"]
            if model not in model_breakdown:
                model_breakdown[model] = {"cost": 0, "tokens": 0, "count": 0}

            model_breakdown[model]["cost"] += usage["cost"]
            model_breakdown[model]["tokens"] += usage["total_tokens"]
            model_breakdown[model]["count"] += 1

        return {
            "period_hours": hours,
            "total_cost": total_cost,
            "total_tokens": total_tokens,
            "total_requests": len(recent_usage),
            "avg_latency_ms": avg_latency,
            "cost_per_1k_tokens": (total_cost / total_tokens * 1000) if total_tokens > 0 else 0,
            "model_breakdown": model_breakdown,
            "alert": total_cost > self.cost_threshold
        }

    async def optimize_prompt(self, prompt: str, max_tokens: Optional[int] = None) -> str:
        """Optimize prompt to reduce token count"""
        # Simple optimizations
        optimized = prompt

        # Remove excessive whitespace
        optimized = " ".join(optimized.split())

        # Remove redundant phrases
        redundant_phrases = [
            "please ", "kindly ", "could you ", "would you ",
            "can you ", "thank you", "thanks for "
        ]
        for phrase in redundant_phrases:
            optimized = optimized.replace(phrase, "").replace(phrase.upper(), "")

        # Truncate if needed
        if max_tokens:
            estimated = TokenCounter.estimate_tokens(optimized)
            if estimated > max_tokens:
                # Truncate to roughly 80% of max to leave room
                target_chars = int(len(optimized) * (max_tokens * 0.8) / estimated)
                optimized = optimized[:target_chars].rsplit(" ", 1)[0] + "..."

        return optimized.strip()

    def get_performance_report(self) -> Dict[str, Any]:
        """Generate performance report for all models"""
        report = {}

        for model_name, perf in self.model_performance.items():
            report[model_name] = {
                "avg_latency_ms": perf.avg_latency_ms,
                "cost_per_1k_tokens": perf.cost_per_1k_tokens,
                "quality_score": perf.quality_score,
                "availability": perf.availability,
                "efficiency_score": self.calculate_efficiency_score(model_name)
            }

        return report


# Global optimizer instance
cost_optimizer = CostOptimizer()
