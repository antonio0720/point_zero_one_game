/**
 * ModelProofChain — src/ml/ModelProofChain.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #8: ModelPackHash — bind ML model version into proof chain
 *
 * Any ML system affecting scoring, matchmaking, or opponent behavior
 * is declared as a ModelPack. Its hash is bound into the run proof bundle.
 * This prevents silent model drift from breaking competitive legitimacy.
 */

import { fnv32Hex } from '../engine/antiCheat';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModelRole =
  | 'INTELLIGENCE'       // PlayerModelEngine
  | 'KNOWLEDGE_TRACER'   // KnowledgeTracer
  | 'HATER_BOT'          // HaterBotController
  | 'GHOST_GENERATOR'    // PhantomGhostEngine
  | 'DIVERGENCE'         // DivergenceEngine
  | 'TRUST_SIM'          // TrustSimulator
  | 'ANOMALY_DETECTOR'   // BehavioralAnomalyDetector
  | 'RECOMMENDER'        // CardRecommender
  | 'TAG_OPTIMIZER';     // TagWeightOptimizer

export interface ModelPack {
  role:       ModelRole;
  modelId:    string;    // e.g. "player-model-v1.2"
  version:    string;
  /** SHA256 or FNV hash of model weights file — from server manifest */
  weightsHash: string;
  /** Runtime config that affects outputs */
  config:     Record<string, number | string | boolean>;
  /** Unix timestamp when this pack was released */
  releasedAt: number;
}

export interface ModelProofBundle {
  runId:         string;
  runSeed:       number;
  seasonId:      string;
  rulePackHash:  string;
  modelPacks:    ModelPack[];
  /** Composite hash of all model packs — single value for proof chain */
  bundleHash:    string;
  createdAt:     number;
}

// ─── Hash Builder ─────────────────────────────────────────────────────────────

export function buildModelPackHash(pack: Omit<ModelPack, 'weightsHash'> & { weightsHash?: string }): string {
  const canonical = JSON.stringify({
    role:    pack.role,
    id:      pack.modelId,
    ver:     pack.version,
    weights: pack.weightsHash ?? 'unverified',
    cfg:     pack.config,
  });
  return `MP-${fnv32Hex(canonical)}`;
}

export function buildBundleHash(packs: ModelPack[]): string {
  const sorted = packs.slice().sort((a, b) => a.role.localeCompare(b.role));
  const canonical = sorted.map(p => buildModelPackHash(p)).join('|');
  return `MPB-${fnv32Hex(canonical)}`;
}

export function createModelProofBundle(
  runId:        string,
  runSeed:      number,
  seasonId:     string,
  rulePackHash: string,
  packs:        ModelPack[],
): ModelProofBundle {
  return {
    runId,
    runSeed,
    seasonId,
    rulePackHash,
    modelPacks: packs,
    bundleHash: buildBundleHash(packs),
    createdAt:  Date.now(),
  };
}

// ─── Default Packs (Season 0 client-side models) ──────────────────────────────

export const SEASON0_MODEL_PACKS: ModelPack[] = [
  {
    role: 'INTELLIGENCE', modelId: 'player-model-heuristic', version: '1.0.0',
    weightsHash: 'deterministic-no-weights',
    config: { bankruptcyWeight: 0.4, pressureWeight: 0.2 },
    releasedAt: new Date('2026-01-01').getTime(),
  },
  {
    role: 'KNOWLEDGE_TRACER', modelId: 'bkt-v1', version: '1.0.0',
    weightsHash: 'bkt-params-1.0.0',
    config: { learnRate: 0.18, forgetRate: 0.02, slipRate: 0.10, guessRate: 0.08 },
    releasedAt: new Date('2026-01-01').getTime(),
  },
  {
    role: 'HATER_BOT', modelId: 'rule-constrained-v1', version: '1.0.0',
    weightsHash: 'deterministic-no-weights',
    config: { burstCap: 12000, critCooldown: 48, churnCeiling: 0.72 },
    releasedAt: new Date('2026-01-01').getTime(),
  },
  {
    role: 'GHOST_GENERATOR', modelId: 'style-cluster-v1', version: '1.0.0',
    weightsHash: 'legend-styles-1.0.0',
    config: { styles: 5, cordThreshold: 780 },
    releasedAt: new Date('2026-01-01').getTime(),
  },
  {
    role: 'ANOMALY_DETECTOR', modelId: 'ensemble-v1', version: '1.0.0',
    weightsHash: 'deterministic-no-weights',
    config: { humanMinResponseMs: 80, maxPlaysPerSec: 3, windowSize: 8 },
    releasedAt: new Date('2026-01-01').getTime(),
  },
];