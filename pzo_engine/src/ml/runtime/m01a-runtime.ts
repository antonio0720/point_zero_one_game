// pzo_engine/src/ml/runtime/m01a-runtime.ts
// Density6 LLC · Point Zero One · Confidential
//
// Runtime glue: loads/initializes weights, applies queued feedback (online learning),
// and provides prediction.

import { HashFunction } from '../../integrity/hash-function';
import { canonicalJson } from './canonical-json';
import { buildFeatureSchemaHashPayload, type FeatureSchema } from './feature-schema';
import { clamp } from './math';
import { logisticPredict, logisticUpdate, type OnlineLogisticConfig } from './online-logistic';
import { MLStore } from '../../persistence/ml-store';

export type M01ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

export type M01AModelState = {
  ml_id: 'M01A';
  tier: M01ATier;
  rulesetVersion: string;
  modelVersion: string;
  featureSchemaHash: string;
  weights: number[];
  step: number;
};

export const M01A_SCHEMA: FeatureSchema = {
  name: 'M01A',
  version: 'v1',
  features: [
    'bias',
    'timeline_len_log',
    'unique_action_ratio',
    'dup_signature_ratio',
    'fast_burst_ratio',
    'missing_ts_ratio',
    'tick_snaps_present',
    'tick_gap_flag',
    'dup_tick_hash_ratio',
    'net_worth_jump_rate',
    'shield_jump_rate',
    'hater_heat_jump_rate',
    'macro_regime_missing',
  ],
};

export const M01A_DEFAULT_WEIGHTS_V1: readonly number[] = [
  // bias and feature weights (tamper-probability model)
  // Starts conservative; learning tightens quickly with feedback.
  -1.20,  // bias (leans toward "not tampered")
   0.10,  // timeline_len_log
  -0.35,  // unique_action_ratio
   1.15,  // dup_signature_ratio
   0.95,  // fast_burst_ratio
   0.35,  // missing_ts_ratio
  -0.10,  // tick_snaps_present
   1.20,  // tick_gap_flag
   1.35,  // dup_tick_hash_ratio
   1.10,  // net_worth_jump_rate
   0.95,  // shield_jump_rate
   0.70,  // hater_heat_jump_rate
   0.20,  // macro_regime_missing
];

export const M01A_ONLINE_CFG: OnlineLogisticConfig = {
  learningRate: 0.035,
  l2: 0.0005,
  weightClampAbs: 3.0,
  maxAbsGrad: 2.0,
};

export function computeM01AFeatureSchemaHash(): string {
  const hf = new HashFunction();
  const payload = buildFeatureSchemaHashPayload(M01A_SCHEMA);
  return hf.sha256(`pzo:ml:feature_schema:${payload}`).slice(0, 32);
}

export function loadOrInitM01AModel(params: {
  tier: M01ATier;
  rulesetVersion: string;
  modelVersion: string;
  featureSchemaHash: string;
}): M01AModelState {
  const store = new MLStore();
  const row = store.getLatestModel('M01A', params.tier, params.rulesetVersion);

  if (!row) {
    const weights = [...M01A_DEFAULT_WEIGHTS_V1];
    const created = store.upsertModel({
      ml_id: 'M01A',
      tier: params.tier,
      ruleset_version: params.rulesetVersion,
      model_version: params.modelVersion,
      feature_schema_hash: params.featureSchemaHash,
      weights_json: canonicalJson(weights),
      step: 0,
    });

    return {
      ml_id: 'M01A',
      tier: params.tier,
      rulesetVersion: params.rulesetVersion,
      modelVersion: created.model_version,
      featureSchemaHash: created.feature_schema_hash,
      weights,
      step: created.step,
    };
  }

  const parsed = safeParseNumberArray(row.weights_json, M01A_DEFAULT_WEIGHTS_V1.length);
  return {
    ml_id: 'M01A',
    tier: params.tier,
    rulesetVersion: row.ruleset_version,
    modelVersion: row.model_version,
    featureSchemaHash: row.feature_schema_hash,
    weights: parsed,
    step: row.step,
  };
}

export function applyQueuedFeedbackAndPersist(params: {
  model: M01AModelState;
  maxBatch?: number;
}): M01AModelState {
  const store = new MLStore();
  const maxBatch = params.maxBatch ?? 32;

  const pending = store.fetchUnappliedFeedback('M01A', params.model.tier, maxBatch);
  if (pending.length === 0) return params.model;

  // Online updates require features; we train only when a matching observation exists.
  // We keep this strictly deterministic: feedback processed in ascending id order.
  // If an observation is missing, we still mark applied to prevent infinite replays.
  const db = (store as any).db as any; // private; used only for a targeted query in-process

  const getObs = db.prepare(
    `
    SELECT features_json
    FROM ml_observations
    WHERE ml_id = 'M01A' AND tier = ? AND run_id = ? AND tick_index = ?
    ORDER BY id DESC
    LIMIT 1
    `,
  );

  let weights = [...params.model.weights];
  let step = params.model.step;

  const appliedIds: number[] = [];

  for (const fb of pending) {
    const obs = getObs.get(params.model.tier, fb.run_id, fb.tick_index) as { features_json?: string } | undefined;

    if (obs?.features_json) {
      const x = safeParseNumberArray(obs.features_json, weights.length);
      weights = logisticUpdate(weights, x, fb.label, M01A_ONLINE_CFG);
      step += 1;
    }

    appliedIds.push(fb.id);
  }

  store.markFeedbackApplied(appliedIds);

  // Persist updated weights snapshot
  const updatedRow = store.upsertModel({
    ml_id: 'M01A',
    tier: params.model.tier,
    ruleset_version: params.model.rulesetVersion,
    model_version: params.model.modelVersion,
    feature_schema_hash: params.model.featureSchemaHash,
    weights_json: canonicalJson(weights),
    step,
  });

  return {
    ...params.model,
    weights,
    step: updatedRow.step,
  };
}

export function predictTamperProbability(model: M01AModelState, x: readonly number[], heuristicAnomaly: number): number {
  // Combine ML probability with heuristic anomaly (bounded).
  // heuristicAnomaly boosts suspicion but cannot force certainty.
  const baseP = logisticPredict(model.weights, x);
  const boosted = clamp(baseP + (heuristicAnomaly * 0.35), 0.001, 0.999);
  return boosted;
}

function safeParseNumberArray(json: string, expectedLen: number): number[] {
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [...M01A_DEFAULT_WEIGHTS_V1].slice(0, expectedLen);
    const out = new Array<number>(expectedLen).fill(0);
    for (let i = 0; i < expectedLen; i++) {
      const n = Number(v[i] ?? 0);
      out[i] = Number.isFinite(n) ? n : 0;
    }
    return out;
  } catch {
    return [...M01A_DEFAULT_WEIGHTS_V1].slice(0, expectedLen);
  }
}