"""GRPO training utilities. No side effects on model weights or inference."""

from .advantages import normalize_grouped_rewards, normalize_rewards_by_prompt

__all__ = ["normalize_grouped_rewards", "normalize_rewards_by_prompt"]
