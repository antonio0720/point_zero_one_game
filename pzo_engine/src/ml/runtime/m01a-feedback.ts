// pzo_engine/src/ml/runtime/m01a-feedback.ts
// Density6 LLC · Point Zero One · Confidential
//
// Feedback ingestion for day-1 learning.
// Call this when server-side integrity pipeline produces a definitive label,
// or when a human review verdict is recorded.

import { MLStore } from '../../persistence/ml-store';

export type M01AFeedbackLabel = 'VERIFIED' | 'TAMPERED';

export function recordM01AFeedback(params: {
  runId: string;
  tickIndex: number;
  label: M01AFeedbackLabel;
  source: 'system' | 'human' | 'appeal';
  tier?: 'baseline' | 'sequence_dl' | 'policy_rl';
}): void {
  const store = new MLStore();
  const tier = params.tier ?? 'baseline';
  const label01: 0|1 = params.label === 'TAMPERED' ? 1 : 0;
  store.enqueueFeedback('M01A', tier, params.runId, params.tickIndex, label01, params.source);
}