/**
 * TagWeightOptimizer — src/ml/TagWeightOptimizer.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #14: Bayesian Tag Weight Optimization
 *
 * Optimizes card drop tag weights per mode for:
 *   - learning gains (knowledge mastery improvement per run)
 *   - retention (win streak + engagement signals)
 *   - fairness (balanced difficulty across player skill levels)
 *
 * Weights are LOCKED per season for competitive integrity.
 * Season hash is published — weights cannot silently drift mid-season.
 */

import { fnv32Hex } from '../engine/antiCheat';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OptimizationObjective = 'LEARNING' | 'RETENTION' | 'FAIRNESS';

export type GameMode = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM';

export interface TagWeightConfig {
  tag:    string;
  weight: number;   // 0.1 – 3.0 multiplier on base drop rate
}

export interface ModeTagWeights {
  mode:       GameMode;
  seasonId:   string;
  objective:  OptimizationObjective;
  weights:    TagWeightConfig[];
  /** FNV hash of the weights array — bound into proof chain */
  weightsHash: string;
  lockedAt:   number;   // Unix ms — once set, no changes allowed
  isLocked:   boolean;
}

export interface WeightUpdateSignal {
  tag:              string;
  masteryDeltaAvg:  number;   // avg mastery gain/loss across players using this tag
  retentionDelta:   number;   // +1 = retained players, -1 = lost players
  fairnessScore:    number;   // 0–1 (1 = fair across skill tiers)
  sampleSize:       number;   // number of runs this signal is derived from
}

// ─── Bayesian Update ──────────────────────────────────────────────────────────
// Thompson sampling approximation:
// Each tag has a Beta distribution prior on "is this weight optimal"
// We update the distribution based on observed signals

interface TagPrior {
  alpha: number;   // successes (positive learning/retention)
  beta:  number;   // failures
}

function thompsonSample(prior: TagPrior): number {
  // Beta distribution mean: alpha / (alpha + beta)
  // We use the mean rather than sampling to stay deterministic
  return prior.alpha / (prior.alpha + prior.beta);
}

function updatePrior(prior: TagPrior, signal: WeightUpdateSignal): TagPrior {
  // Weight update signal into success/failure counts
  const learningSuccess  = signal.masteryDeltaAvg > 0 ? signal.sampleSize * signal.masteryDeltaAvg * 2 : 0;
  const learningFailure  = signal.masteryDeltaAvg < 0 ? signal.sampleSize * Math.abs(signal.masteryDeltaAvg) * 2 : 0;
  const retentionSuccess = signal.retentionDelta > 0 ? signal.sampleSize * signal.retentionDelta : 0;
  const retentionFailure = signal.retentionDelta < 0 ? signal.sampleSize * Math.abs(signal.retentionDelta) : 0;
  const fairnessSuccess  = signal.sampleSize * signal.fairnessScore;
  const fairnessFailure  = signal.sampleSize * (1 - signal.fairnessScore);

  return {
    alpha: prior.alpha + learningSuccess + retentionSuccess + fairnessSuccess,
    beta:  prior.beta  + learningFailure + retentionFailure + fairnessFailure,
  };
}

// ─── Weight Bounds ────────────────────────────────────────────────────────────

const WEIGHT_MIN = 0.1;
const WEIGHT_MAX = 3.0;
const WEIGHT_DEFAULT = 1.0;

function clampWeight(w: number): number {
  return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, w));
}

// Map thompson sample (0–1) to weight range (0.1–3.0)
function scoreToWeight(score: number): number {
  return clampWeight(WEIGHT_MIN + score * (WEIGHT_MAX - WEIGHT_MIN));
}

// ─── Season-Locked Default Weights ───────────────────────────────────────────
// Season 0 weights — tuned for balanced learning across all modes

const SEASON0_BASE_WEIGHTS: TagWeightConfig[] = [
  { tag: 'cashflow_management',  weight: 1.4 },
  { tag: 'leverage_risk',        weight: 1.2 },
  { tag: 'diversification',      weight: 1.1 },
  { tag: 'obligation_coverage',  weight: 1.3 },
  { tag: 'opportunity_cost',     weight: 1.0 },
  { tag: 'tax_efficiency',       weight: 0.9 },
  { tag: 'insurance_timing',     weight: 1.0 },
  { tag: 'market_timing',        weight: 1.1 },
  { tag: 'network_effects',      weight: 0.8 },
  { tag: 'behavioral_bias',      weight: 1.5 },   // highest — bias is the core lesson
  { tag: 'due_diligence',        weight: 1.0 },
  { tag: 'liquidity_management', weight: 1.2 },
];

// ─── Optimizer ────────────────────────────────────────────────────────────────

export class TagWeightOptimizer {
  private priors = new Map<string, TagPrior>();
  private currentWeights: Map<string, number>;
  private locked = false;
  private lockedAt = 0;

  constructor(
    private seasonId:   string,
    private mode:       GameMode,
    private objective:  OptimizationObjective,
    baseWeights:        TagWeightConfig[] = SEASON0_BASE_WEIGHTS,
  ) {
    this.currentWeights = new Map(baseWeights.map(w => [w.tag, w.weight]));
    // Initialize priors from base weights
    for (const w of baseWeights) {
      const score = (w.weight - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN);
      this.priors.set(w.tag, {
        alpha: 2 + score * 8,   // prior belief based on initial weight
        beta:  2 + (1 - score) * 8,
      });
    }
  }

  // ── Signal Ingestion ─────────────────────────────────────────────────────────

  ingestSignal(signal: WeightUpdateSignal): void {
    if (this.locked) {
      console.warn('[TagWeightOptimizer] Season is locked — signal rejected');
      return;
    }
    if (signal.sampleSize < 50) return;  // minimum sample size for update

    const prior = this.priors.get(signal.tag) ?? { alpha: 2, beta: 2 };
    const updated = updatePrior(prior, signal);
    this.priors.set(signal.tag, updated);

    // Recompute weight from updated prior
    const score = thompsonSample(updated);
    this.currentWeights.set(signal.tag, scoreToWeight(score));
  }

  ingestBatch(signals: WeightUpdateSignal[]): void {
    for (const s of signals) this.ingestSignal(s);
  }

  // ── Weight Access ─────────────────────────────────────────────────────────────

  getWeight(tag: string): number {
    return this.currentWeights.get(tag) ?? WEIGHT_DEFAULT;
  }

  getAllWeights(): TagWeightConfig[] {
    return Array.from(this.currentWeights.entries()).map(([tag, weight]) => ({
      tag,
      weight: Math.round(weight * 1000) / 1000,  // 3dp precision
    }));
  }

  // ── Season Lock ───────────────────────────────────────────────────────────────

  /**
   * Lock weights for the season. After lock, no updates accepted.
   * Returns the locked ModeTagWeights with hash for proof chain.
   */
  lockForSeason(): ModeTagWeights {
    if (this.locked) {
      throw new Error('[TagWeightOptimizer] Already locked');
    }
    this.locked    = true;
    this.lockedAt  = Date.now();

    const weights    = this.getAllWeights();
    const weightsHash = buildWeightsHash(this.seasonId, this.mode, weights);

    return {
      mode:        this.mode,
      seasonId:    this.seasonId,
      objective:   this.objective,
      weights,
      weightsHash,
      lockedAt:    this.lockedAt,
      isLocked:    true,
    };
  }

  isLocked(): boolean { return this.locked; }

  /**
   * Validate that a given ModeTagWeights bundle has not been tampered with.
   */
  static verify(bundle: ModeTagWeights): boolean {
    const expected = buildWeightsHash(bundle.seasonId, bundle.mode, bundle.weights);
    return expected === bundle.weightsHash;
  }
}

// ─── Hash ─────────────────────────────────────────────────────────────────────

export function buildWeightsHash(
  seasonId: string,
  mode:     GameMode,
  weights:  TagWeightConfig[],
): string {
  const sorted    = weights.slice().sort((a, b) => a.tag.localeCompare(b.tag));
  const canonical = JSON.stringify({ seasonId, mode, weights: sorted });
  return `TW-${fnv32Hex(canonical)}`;
}

// ─── Season 0 Locked Defaults ─────────────────────────────────────────────────
// These are pre-locked — import directly for production use

export function buildSeason0LockedWeights(mode: GameMode): ModeTagWeights {
  const opt = new TagWeightOptimizer('SEASON_0', mode, 'LEARNING', SEASON0_BASE_WEIGHTS);
  return opt.lockForSeason();
}