"""Dependency-free reward tests and conditional Torch gradient tests."""

import math
import unittest

from tools.grpo.advantages import normalize_grouped_rewards, normalize_rewards_by_prompt


class AdvantageTests(unittest.TestCase):
    def test_image_formula(self):
        a = normalize_grouped_rewards([[1, 2, 3]])[0]
        self.assertAlmostEqual(sum(a), 0.0, places=7)
        self.assertAlmostEqual(sum(x*x for x in a) / 3, 1.0, places=6)
        self.assertLess(a[0], 0)
        self.assertGreater(a[-1], 0)

    def test_group_is_its_own_baseline(self):
        a, b = normalize_grouped_rewards([[1, 3], [101, 103]])
        for x, y in zip(a, b):
            self.assertAlmostEqual(x, y)
        self.assertAlmostEqual(a[0], -1, places=6)
        self.assertAlmostEqual(a[1], 1, places=6)

    def test_zero_variance(self):
        self.assertEqual(normalize_grouped_rewards([[5, 5, 5]]), [[0, 0, 0]])

    def test_near_zero_variance(self):
        self.assertEqual(normalize_grouped_rewards([[2, 2 + 1e-12]], epsilon=1e-6), [[0, 0]])

    def test_flat_interleaved_prompt_ids(self):
        result = normalize_rewards_by_prompt([1, 30, 3, 10], ["a", "b", "a", "b"])
        self.assertAlmostEqual(result[0], -1, places=6)
        self.assertAlmostEqual(result[1], 1, places=6)
        self.assertAlmostEqual(result[2], 1, places=6)
        self.assertAlmostEqual(result[3], -1, places=6)

    def test_invalid_groups(self):
        for group in ([], [1], [1, float('nan')], [0, float('inf')], [True, 1], ["1", 2]):
            with self.subTest(group=group), self.assertRaises((ValueError, TypeError)):
                normalize_grouped_rewards([group])
        with self.assertRaises(ValueError):
            normalize_grouped_rewards([])
        with self.assertRaises(ValueError):
            normalize_rewards_by_prompt([1, 2], ["a"])
        with self.assertRaises(ValueError):
            normalize_rewards_by_prompt([1, 2], ["a", "b"])
        with self.assertRaises(TypeError):
            normalize_rewards_by_prompt([1, 2], [[1], [1]])
        for eps in (0, -1, float('nan'), float('inf')):
            with self.assertRaises(ValueError):
                normalize_grouped_rewards([[1, 2]], epsilon=eps)


try:
    import torch
    from tools.grpo.torch_loss import grpo_loss
except ImportError:
    torch = None


@unittest.skipIf(torch is None, "PyTorch not installed; optional gradient checks skipped")
class TorchLossTests(unittest.TestCase):
    def test_reward_direction_and_finite_gradients(self):
        logp = torch.zeros((1, 2, 2), requires_grad=True)
        old = torch.zeros_like(logp).detach()
        reward = torch.tensor([[10., 0.]])
        mask = torch.tensor([[[1, 1], [1, 1]]], dtype=torch.bool)
        loss = grpo_loss(logp, old, reward, mask)
        self.assertAlmostEqual(loss.item(), 0.0, places=5)
        loss.backward()
        self.assertTrue(torch.isfinite(logp.grad).all().item())
        self.assertTrue((logp.grad[0, 0] < 0).all().item())
        self.assertTrue((logp.grad[0, 1] > 0).all().item())

    def test_clipped_positive_reward_has_zero_gradient_beyond_clip(self):
        logp = torch.tensor([[[1.0], [0.0]]], requires_grad=True)
        reward = torch.tensor([[1., 0.]])
        mask = torch.ones_like(logp, dtype=torch.bool)
        grpo_loss(logp, torch.zeros_like(logp), reward, mask).backward()
        self.assertAlmostEqual(logp.grad[0, 0, 0].item(), 0.0, places=7)

    def test_zero_variance_no_reward_gradient(self):
        logp = torch.zeros((2, 3, 2), requires_grad=True)
        mask = torch.ones_like(logp, dtype=torch.bool)
        loss = grpo_loss(logp, torch.zeros_like(logp), torch.ones((2,3)), mask)
        loss.backward()
        self.assertAlmostEqual(loss.item(), 0.0)
        self.assertEqual(int(torch.count_nonzero(logp.grad).item()), 0)

    def test_kl_nonnegative_and_gradient(self):
        logp = torch.tensor([[[0.5], [0.1]]], requires_grad=True)
        old = logp.detach().clone()
        ref = torch.zeros_like(logp)
        mask = torch.ones_like(logp, dtype=torch.bool)
        loss = grpo_loss(logp, old, torch.ones((1,2)), mask,
                         reference_log_probs=ref, kl_beta=0.5)
        self.assertGreater(loss.item(), 0.0)
        loss.backward()
        self.assertTrue(torch.isfinite(logp.grad).all().item())

    def test_masks_and_invalid_shapes(self):
        logp = torch.zeros((1, 2, 2), requires_grad=True)
        rewards = torch.tensor([[0., 1.]])
        mask = torch.tensor([[[1,0],[0,1]]], dtype=torch.bool)
        self.assertTrue(torch.isfinite(grpo_loss(logp, logp.detach(), rewards, mask)))
        with self.assertRaises(ValueError):
            grpo_loss(logp, logp.detach(), rewards, torch.zeros_like(mask))
        with self.assertRaises(ValueError):
            grpo_loss(logp, logp.detach(), rewards, mask, kl_beta=0.1)
        with self.assertRaises(ValueError):
            grpo_loss(logp, logp.detach(), torch.tensor([[1., 2., 3.]]), mask)
        with self.assertRaises(ValueError):
            grpo_loss(logp, logp.detach(), rewards, mask, clip_epsilon=0)


if __name__ == "__main__":
    unittest.main()
