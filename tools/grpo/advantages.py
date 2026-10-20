"""Group-relative reward normalization for language-model RL training.

For rewards in a prompt's sampled completion group:
    A_i = (r_i - mean(group)) / (std_population(group) + epsilon)

Each prompt is normalized independently. This module has no ML dependency and
never updates weights. The optimizer and policy loss are separate concerns.
"""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Hashable, Sequence
from numbers import Real


def _validate_epsilon(epsilon: float) -> float:
    if isinstance(epsilon, bool) or not isinstance(epsilon, Real):
        raise TypeError("epsilon must be a finite positive real number")
    epsilon = float(epsilon)
    if not math.isfinite(epsilon) or epsilon <= 0:
        raise ValueError("epsilon must be finite and greater than zero")
    return epsilon


def _normalize_one(rewards: Sequence[float], epsilon: float) -> list[float]:
    if isinstance(rewards, (str, bytes)) or not isinstance(rewards, Sequence):
        raise TypeError("each group must be a sequence of numeric rewards")
    if len(rewards) < 2:
        raise ValueError("GRPO requires at least two completions per prompt")
    if any(isinstance(r, bool) or not isinstance(r, Real) for r in rewards):
        raise TypeError("rewards must be numeric (not booleans)")

    values = [float(r) for r in rewards]
    if not all(math.isfinite(v) for v in values):
        raise ValueError("rewards must all be finite")
    try:
        mean = math.fsum(values) / len(values)
        variance = math.fsum((v - mean) ** 2 for v in values) / len(values)
    except (OverflowError, ValueError) as exc:
        raise ValueError("reward magnitudes are too large") from exc
    if not math.isfinite(mean) or not math.isfinite(variance):
        raise ValueError("reward statistics overflowed")

    std = math.sqrt(variance)
    if std <= epsilon:
        # Equal (or numerically indistinguishable) rewards give no RL signal.
        return [0.0] * len(values)
    return [(value - mean) / (std + epsilon) for value in values]


def normalize_grouped_rewards(
    groups: Sequence[Sequence[float]], *, epsilon: float = 1e-8
) -> list[list[float]]:
    """Normalize rewards independently for each prompt's sampled completions.

    Uses population standard deviation (ddof=0). It intentionally requires
    explicit nested groups to prevent accidental cross-prompt normalization.
    """
    epsilon = _validate_epsilon(epsilon)
    if isinstance(groups, (str, bytes)) or not isinstance(groups, Sequence):
        raise TypeError("groups must be a sequence of reward sequences")
    if not groups:
        raise ValueError("at least one prompt group is required")
    return [_normalize_one(group, epsilon) for group in groups]


def normalize_rewards_by_prompt(
    rewards: Sequence[float], prompt_ids: Sequence[Hashable], *, epsilon: float = 1e-8
) -> list[float]:
    """Normalize a flat batch while preserving original completion order.

    `prompt_ids` must identify the source prompt for every sampled completion.
    The same ID must never be reused for distinct prompts within a batch.
    """
    epsilon = _validate_epsilon(epsilon)
    if isinstance(rewards, (str, bytes)) or not isinstance(rewards, Sequence):
        raise TypeError("rewards must be a sequence")
    if isinstance(prompt_ids, (str, bytes)) or not isinstance(prompt_ids, Sequence):
        raise TypeError("prompt_ids must be a sequence")
    if len(rewards) != len(prompt_ids) or not rewards:
        raise ValueError("rewards and prompt_ids must have equal nonzero length")

    buckets: dict[Hashable, list[int]] = defaultdict(list)
    for i, key in enumerate(prompt_ids):
        try:
            hash(key)
        except TypeError as exc:
            raise TypeError("prompt IDs must be hashable") from exc
        buckets[key].append(i)

    result = [0.0] * len(rewards)
    for positions in buckets.values():
        values = _normalize_one([rewards[i] for i in positions], epsilon)
        for i, advantage in zip(positions, values):
            result[i] = advantage
    return result
