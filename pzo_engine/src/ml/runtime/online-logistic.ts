// pzo_engine/src/ml/runtime/online-logistic.ts
// Density6 LLC · Point Zero One · Confidential
//
// Online logistic regression (bounded) for day-1 learning.
// - Deterministic updates (fixed order, bounded step sizes)
// - L2 regularization
// - Weight clamps

import { clamp, dot, sigmoid } from './math';

export type OnlineLogisticConfig = {
  learningRate: number;      // e.g. 0.03
  l2: number;                // e.g. 0.0005
  weightClampAbs: number;    // e.g. 3.0
  maxAbsGrad: number;        // e.g. 2.0
};

export function logisticPredict(weights: readonly number[], x: readonly number[]): number {
  return sigmoid(dot(weights, x));
}

export function logisticUpdate(
  weights: readonly number[],
  x: readonly number[],
  label01: 0 | 1,
  cfg: OnlineLogisticConfig,
): number[] {
  const w = [...weights];
  const p = logisticPredict(w, x);
  const err = (label01 - p);

  for (let i = 0; i < w.length; i++) {
    const xi = x[i] ?? 0;
    // grad for log-loss: (label - p) * x
    let grad = err * xi;

    // L2 penalty (skip bias at i=0 if you want; here we regularize lightly but still deterministic)
    grad -= cfg.l2 * w[i];

    grad = clamp(grad, -cfg.maxAbsGrad, cfg.maxAbsGrad);

    w[i] = w[i] + cfg.learningRate * grad;
    w[i] = clamp(w[i], -cfg.weightClampAbs, cfg.weightClampAbs);
  }

  return w;
}