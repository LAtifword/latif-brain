# Group-relative advantage normalization (GRPO training component)

This directory implements the **group-relative advantage formula** from the screenshot:

\[
A_i = \frac{r_i-\operatorname{mean}(r_1,\ldots,r_G)}
{\operatorname{std}(r_1,\ldots,r_G)+\varepsilon}
\]

Every group contains **two or more independent completions of the same prompt**. The mean and population standard deviation (`ddof=0`) are calculated **within that prompt**, never over the whole training batch. The small `epsilon` prevents division by zero. Constant-reward groups produce zero advantage (no policy-gradient learning signal).

## Tested building blocks

- `advantages.py`: numeric reward normalization, group isolation, input validation and zero-variance handling; uses **Python standard library only**.
- `torch_loss.py`: optional differentiable clipped GRPO surrogate with completion masks and optional nonnegative reference-policy KL penalty; requires PyTorch.
- `__main__.py`: minimal JSON stdin/stdout entry point for inspecting advantages without an ML installation.

```sh
printf '%s\n' '{"groups": [[1,2,3], [10,10,10]]}' | python -m tools.grpo
python -m unittest discover -s tools/grpo/tests -p 'test_*.py' -v
```

```python
import torch
from tools.grpo.torch_loss import grpo_loss

# Provided by an actual model rollout/training pipeline, NOT invented here:
# log_probs and old_log_probs: [B, G, T] selected completion-token logprobs
# rewards: [B, G] scored completions for the same prompt in each group
# completion_mask: [B, G, T] identifying valid generated tokens
loss = grpo_loss(log_probs, old_log_probs, rewards, completion_mask,
                 reference_log_probs=reference_log_probs,
                 clip_epsilon=0.2, kl_beta=0.01)
loss.backward()
optimizer.step()
```

The training system must separately generate sampled completions, score them with an audited reward function, log the **behavior-policy** token probabilities used during sampling, supply a frozen reference policy when KL is enabled, and manage gradient accumulation, rollouts, checkpoints, evaluation and rollback. Do not reuse current policy log probabilities as `old_log_probs` after a policy update. For sequence-level rewards, this implementation assigns the same normalized advantage to each valid token of its completion and then averages per completion; other GRPO variants use different length weighting and should be evaluated independently.

## Deployment boundaries

**This is training code, not a pre-trained or fine-tuned model.** Running the normalization CLI or importing the loss does not change any GGUF checkpoint. It cannot by itself increase inference speed, reasoning accuracy or context size. The local Android/Termux `llama.cpp` / Ollama inference services should **not** run this training step. If a future externally trained, evaluated and licensed checkpoint is compatible with the runtime, convert/quantize it separately and benchmark its real latency and quality on the device before switching models.

### Before claiming an upgrade

1. Verify model weights are trainable in the chosen framework; obtain a lawful training dataset and reliable reward criteria.
2. Train with a supported optimizer/environment (typically desktop or cloud GPU, not a phone CPU); record base checkpoint, seeds, training configuration and checkpoint hashes.
3. Evaluate against the unchanged model on a held-out set, including Arabic, tool-use, regressions, privacy, safety and hallucination metrics.
4. Only after quality and Android memory/thermal checks, export a compatible GGUF, deploy with a rollback path, and repeat local inference benchmarks.

No model was trained or replaced by this change. Other repositories only consuming local inference APIs need no copy of these training internals.
