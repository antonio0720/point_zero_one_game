/**
 * RunEmbedder — src/ml/RunEmbedder.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #13: Run Embeddings → Skill Signature
 *
 * Computes a fixed-dimension skill signature vector from run outcomes.
 * Used for:
 *   - Cognitive-style matchmaking (not just ELO)
 *   - Surfacing closest strategic rivals
 *   - Recommending ghosts targeting weakest signature dimensions
 */

import type { WindowMastery } from './WindowMasteryTracker';
import type { KnowledgeState } from './KnowledgeTracer';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RunEmbeddingInput {
  grade:              string;
  totalScore:         number;
  survived:           boolean;
  cashflowRatio:      number;
  netWorthGrowthPct:  number;
  resilienceScore:    number;
  disciplineScore:    number;
  riskMgmtScore:      number;
  biasActivations:    number;
  biasesCleared:      number;
  windowMastery:      WindowMastery[];
  knowledgeStates:    KnowledgeState[];
  portfolioHhi:       number;
  hubrisPeak:         number;
  mode:               string;
}

export interface SkillSignature {
  /** 12-dimensional embedding vector */
  vector:     number[];
  dimensions: SkillDimension[];
  /** Cosine similarity range: 0–1 (1 = identical style) */
  styleId:    string;
}

export interface SkillDimension {
  name:    string;
  value:   number;    // 0–1
  label:   string;
  percentile?: number; // set during matchmaking comparison
}

// ─── Embedding Dimensions ─────────────────────────────────────────────────────
// 12 dimensions — fixed for all modes, mode-specific dims get 0 if N/A

const DIM_NAMES = [
  'cashflow_efficiency',
  'wealth_building',
  'resilience',
  'discipline',
  'risk_management',
  'window_timing',
  'knowledge_breadth',
  'bias_resistance',
  'portfolio_diversity',
  'hubris_control',
  'pressure_performance',
  'recovery_ability',
] as const;

export type DimName = typeof DIM_NAMES[number];

function clamp(v: number): number { return Math.max(0, Math.min(1, v)); }

// ─── Embedding Computation ────────────────────────────────────────────────────

export function computeRunEmbedding(input: RunEmbeddingInput): SkillSignature {
  const avgWindowMastery = input.windowMastery.length > 0
    ? input.windowMastery.reduce((s, w) => s + w.masteryPct / 100, 0) / input.windowMastery.length
    : 0;

  const avgKnowledgeMastery = input.knowledgeStates.length > 0
    ? input.knowledgeStates.reduce((s, k) => s + k.mastery, 0) / input.knowledgeStates.length
    : 0;

  const biasResistance = input.biasActivations > 0
    ? input.biasesCleared / input.biasActivations
    : 1.0;

  const vector: number[] = [
    clamp(input.cashflowRatio / 3),                         // cashflow_efficiency
    clamp(input.netWorthGrowthPct / 300),                   // wealth_building
    clamp(input.resilienceScore / 1000),                    // resilience
    clamp(input.disciplineScore / 1000),                    // discipline
    clamp(input.riskMgmtScore / 1000),                      // risk_management
    clamp(avgWindowMastery),                                // window_timing
    clamp(avgKnowledgeMastery),                             // knowledge_breadth
    clamp(biasResistance),                                  // bias_resistance
    clamp(1 - input.portfolioHhi),                          // portfolio_diversity
    clamp(1 - input.hubrisPeak / 100),                      // hubris_control
    clamp((input.totalScore / 1000) * (input.survived ? 1 : 0.5)), // pressure_performance
    input.survived ? 1.0 : 0.2,                             // recovery_ability
  ];

  const dimensions: SkillDimension[] = DIM_NAMES.map((name, i) => ({
    name,
    value: vector[i],
    label: formatLabel(name, vector[i]),
  }));

  const styleId = computeStyleId(vector);

  return { vector, dimensions, styleId };
}

function formatLabel(dim: DimName, value: number): string {
  const tier = value >= 0.8 ? 'Elite' : value >= 0.6 ? 'Strong' : value >= 0.4 ? 'Average' : value >= 0.2 ? 'Weak' : 'Critical';
  return `${tier} ${dim.replace(/_/g, ' ')}`;
}

function computeStyleId(vector: number[]): string {
  let h = 2166136261;
  for (const v of vector) {
    const b = Math.round(v * 100);
    h ^= b;
    h = Math.imul(h, 16777619);
  }
  return `SS-${(h >>> 0).toString(16).padStart(8, '0')}`;
}

// ─── Similarity + Matchmaking ─────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

export function findClosestRivals(
  playerSig:    SkillSignature,
  candidates:   Array<{ playerId: string; signature: SkillSignature }>,
  topN = 3,
): Array<{ playerId: string; similarity: number; weakestSharedDim: string }> {
  return candidates
    .map(c => ({
      playerId:         c.playerId,
      similarity:       cosineSimilarity(playerSig.vector, c.signature.vector),
      weakestSharedDim: findWeakestShared(playerSig, c.signature),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

function findWeakestShared(a: SkillSignature, b: SkillSignature): string {
  let minVal = 1;
  let minDim = '';
  for (let i = 0; i < Math.min(a.dimensions.length, b.dimensions.length); i++) {
    const avg = (a.dimensions[i].value + b.dimensions[i].value) / 2;
    if (avg < minVal) { minVal = avg; minDim = a.dimensions[i].name; }
  }
  return minDim;
}