"""Differentiable, clipped GRPO policy objective (requires PyTorch).

Input: one row per prompt, G completions per prompt, T completion tokens.
The rollout policy must supply detached `old_log_probs`; the optional frozen
reference policy supplies detached `reference_log_probs`. Log probabilities
must correspond to the generated completion token, not the full vocabulary.
"""

from __future__ import annotations

import torch


def grpo_loss(
    log_probs: torch.Tensor,
    old_log_probs: torch.Tensor,
    rewards: torch.Tensor,
    completion_mask: torch.Tensor,
    *,
    reference_log_probs: torch.Tensor | None = None,
    clip_epsilon: float = 0.2,
    kl_beta: float = 0.0,
    std_epsilon: float = 1e-8,
) -> torch.Tensor:
    """Return the token-masked, completion-mean clipped GRPO loss.

    Shapes: log_probs/old_log_probs/mask/reference [B, G, T]; rewards [B,G].
    Independent prompts receive equal weight and each completion contributes
    equally regardless of length. No optimizer, rollout, or reward model is
    implied or provided by this function.
    """
    if not (isinstance(log_probs, torch.Tensor) and
            isinstance(old_log_probs, torch.Tensor) and
            isinstance(rewards, torch.Tensor) and
            isinstance(completion_mask, torch.Tensor)):
        raise TypeError("all GRPO inputs must be PyTorch tensors")
    if log_probs.ndim != 3 or log_probs.shape != old_log_probs.shape or log_probs.shape != completion_mask.shape:
        raise ValueError("log_probs, old_log_probs, and completion_mask must have identical [B,G,T] shapes")
    batch, group, tokens = log_probs.shape
    if batch < 1 or group < 2 or tokens < 1 or rewards.shape != (batch, group):
        raise ValueError("require B>=1, G>=2, T>=1 and rewards [B,G]")
    if reference_log_probs is not None and (not isinstance(reference_log_probs, torch.Tensor)
                                            or reference_log_probs.shape != log_probs.shape):
        raise ValueError("reference_log_probs must match [B,G,T]")
    if not (0 < clip_epsilon < 1 and 0 <= kl_beta and std_epsilon > 0):
        raise ValueError("require 0<clip_epsilon<1, kl_beta>=0 and std_epsilon>0")
    if not all(map(lambda v: float('-inf') < float(v) < float('inf'),
                   (clip_epsilon, kl_beta, std_epsilon))):
        raise ValueError("hyperparameters must be finite")
    mask = completion_mask.to(dtype=torch.bool)
    if not mask.any(dim=-1).all().item():
        raise ValueError("every completion needs at least one valid token")
    if log_probs.device != old_log_probs.device or log_probs.device != rewards.device or log_probs.device != mask.device:
        raise ValueError("all tensors must reside on the same device")
    if reference_log_probs is not None and reference_log_probs.device != log_probs.device:
        raise ValueError("reference_log_probs must be on the same device")
    if not torch.isfinite(rewards).all().item():
        raise ValueError("rewards must be finite")
    if not torch.isfinite(log_probs[mask]).all().item() or not torch.isfinite(old_log_probs[mask]).all().item():
        raise ValueError("selected token log probabilities must be finite")
    if reference_log_probs is not None and not torch.isfinite(reference_log_probs[mask]).all().item():
        raise ValueError("selected reference log probabilities must be finite")

    # Reward normalization is independent per prompt and detached from gradient.
    reward_f = rewards.detach().to(dtype=log_probs.dtype)
    centers = reward_f.mean(dim=1, keepdim=True)
    stds = reward_f.std(dim=1, keepdim=True, unbiased=False)
    advantages = torch.where(stds > std_epsilon,
                             (reward_f - centers) / (stds + std_epsilon),
                             torch.zeros_like(reward_f))

    # Keep pads neutral even when their supplied log-probabilities are arbitrary.
    diff = torch.where(mask, log_probs - old_log_probs.detach(), torch.zeros_like(log_probs))
    ratios = torch.exp(diff)
    if not torch.isfinite(ratios[mask]).all().item():
        raise ValueError("policy ratio overflow; refresh stale rollout log-probabilities")
    advantage = advantages.unsqueeze(-1)
    unclipped = ratios * advantage
    clipped = torch.clamp(ratios, min=1.0-clip_epsilon, max=1.0+clip_epsilon) * advantage
    objective = torch.minimum(unclipped, clipped)

    if kl_beta > 0:
        if reference_log_probs is None:
            raise ValueError("positive KL coefficient requires reference_log_probs")
        delta = torch.where(mask, reference_log_probs.detach() - log_probs, torch.zeros_like(log_probs))
        # Common GRPO nonnegative KL estimator: exp(delta) - delta - 1.
        kl = torch.expm1(delta) - delta
        if not torch.isfinite(kl[mask]).all().item():
            raise ValueError("KL estimator overflow; verify reference log-probabilities")
        objective = objective - kl_beta * kl

    weights = mask.to(dtype=log_probs.dtype)
    per_completion = (objective * weights).sum(dim=-1) / weights.sum(dim=-1)
    return -per_completion.mean()
