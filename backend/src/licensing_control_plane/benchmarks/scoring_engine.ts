/**
 * Benchmark Scoring Engine
 * backend/src/licensing_control_plane/benchmarks/scoring_engine.ts
 *
 * Spec: PZO_CS_T047
 * "Standardized scoring outputs; comparable metrics; produces BenchmarkOutputs + deltas."
 *
 * Scoring is deterministic given the same run snapshot. Every benchmark attempt
 * produces a ScoringResult with:
 *   - Absolute metric values (net worth, survival ticks, cord score, etc.)
 *   - Skill rubric evaluations against the benchmark's scoring profile
 *   - Delta comparisons against a baseline (pre-measurement or cohort average)
 *   - A composite proficiency grade (A–F) derived from weighted rubric dimensions
 *
 * The engine is pure — no database calls, no side effects. It receives a
 * RunSnapshot + ScoringProfile and returns a ScoringResult. Persistence is
 * handled by the benchmark_runner.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ProficiencyGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ScoringProfile {
  profileId: string;
  /** Weighted dimensions that sum to 1.0 */
  dimensions: ScoringDimension[];
  /** Grade thresholds — minimum composite score for each grade */
  gradeThresholds: { A: number; B: number; C: number; D: number };
  /** Version lock for comparability */
  version: string;
}

export interface ScoringDimension {
  name: string;
  /** Weight in [0, 1]; all weights must sum to 1.0 */
  weight: number;
  /** Metric key to read from RunSnapshot */
  metricKey: string;
  /** Direction: higher is better, or lower is better */
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  /** Normalization range */
  minValue: number;
  maxValue: number;
}

export interface RunSnapshot {
  runId: string;
  playerId: string;
  /** Final net worth at run end */
  finalNetWorth: number;
  /** Total ticks survived */
  survivalTicks: number;
  /** Peak net worth during the run */
  peakNetWorth: number;
  /** Final cord score (sovereignty) */
  cordScore: number;
  /** Shield integrity at run end (0-100) */
  shieldIntegrity: number;
  /** Pressure score at run end */
  pressureScore: number;
  /** Number of cascade chains completed */
  cascadeChains: number;
  /** Total cards played */
  cardsPlayed: number;
  /** Cards that produced positive outcomes */
  cardsEffective: number;
  /** Run outcome */
  outcome: 'SURVIVED' | 'BANKRUPT' | 'ABANDONED' | 'TIMED_OUT';
  /** Scenario ID this run was played on */
  scenarioId: string;
  /** Seed used for determinism */
  seed: string;
  /** Pinned ruleset version */
  rulesetId: string;
  /** Pinned episode/content version */
  episodeVersion: string;
  /** Arbitrary additional metrics */
  metrics: Record<string, number>;
}

export interface BaselineSnapshot {
  /** Average/target values for each metric key */
  metrics: Record<string, number>;
  /** Label (e.g., "pre-measurement", "cohort-average", "personal-best") */
  label: string;
}

export interface DimensionResult {
  name: string;
  rawValue: number;
  normalizedScore: number;
  weight: number;
  weightedScore: number;
  delta: number | null;
  deltaLabel: string | null;
}

export interface BenchmarkOutput {
  metricKey: string;
  label: string;
  value: number;
  unit: string;
}

export interface ScoringResult {
  runId: string;
  playerId: string;
  profileId: string;
  profileVersion: string;
  scenarioId: string;
  seed: string;
  rulesetId: string;
  episodeVersion: string;
  outcome: RunSnapshot['outcome'];
  /** Individual dimension scores */
  dimensions: DimensionResult[];
  /** Weighted composite score [0, 100] */
  compositeScore: number;
  /** Derived proficiency grade */
  grade: ProficiencyGrade;
  /** Standardized benchmark outputs for reporting */
  outputs: BenchmarkOutput[];
  /** Deltas against baseline (null if no baseline provided) */
  deltas: DeltaReport | null;
  /** ISO timestamp of scoring */
  scoredAt: string;
  /** Hash of inputs for tamper detection */
  inputHash: string;
}

export interface DeltaReport {
  baselineLabel: string;
  compositeScoreDelta: number;
  gradeDelta: number;
  dimensionDeltas: Array<{
    name: string;
    currentValue: number;
    baselineValue: number;
    delta: number;
    direction: 'IMPROVED' | 'DECLINED' | 'UNCHANGED';
  }>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GRADE_VALUES: Record<ProficiencyGrade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

const STANDARD_OUTPUTS: Array<{ metricKey: string; label: string; unit: string; snapshotField: keyof RunSnapshot }> = [
  { metricKey: 'final_net_worth', label: 'Final Net Worth', unit: 'USD', snapshotField: 'finalNetWorth' },
  { metricKey: 'survival_ticks', label: 'Survival Ticks', unit: 'ticks', snapshotField: 'survivalTicks' },
  { metricKey: 'peak_net_worth', label: 'Peak Net Worth', unit: 'USD', snapshotField: 'peakNetWorth' },
  { metricKey: 'cord_score', label: 'Cord Score', unit: 'pts', snapshotField: 'cordScore' },
  { metricKey: 'shield_integrity', label: 'Shield Integrity', unit: '%', snapshotField: 'shieldIntegrity' },
  { metricKey: 'pressure_score', label: 'Pressure Score', unit: 'pts', snapshotField: 'pressureScore' },
  { metricKey: 'cascade_chains', label: 'Cascade Chains', unit: 'count', snapshotField: 'cascadeChains' },
  { metricKey: 'cards_played', label: 'Cards Played', unit: 'count', snapshotField: 'cardsPlayed' },
  { metricKey: 'card_effectiveness', label: 'Card Effectiveness', unit: '%', snapshotField: 'cardsEffective' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCORING ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validate a scoring profile.
 * Weights must sum to 1.0 (±0.001 tolerance).
 */
export function validateProfile(profile: ScoringProfile): { valid: boolean; error?: string } {
  if (!profile.dimensions || profile.dimensions.length === 0) {
    return { valid: false, error: 'Scoring profile must have at least one dimension.' };
  }

  const weightSum = profile.dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (Math.abs(weightSum - 1.0) > 0.001) {
    return { valid: false, error: `Dimension weights sum to ${weightSum}, must equal 1.0.` };
  }

  for (const d of profile.dimensions) {
    if (d.weight <= 0) return { valid: false, error: `Dimension '${d.name}' has non-positive weight.` };
    if (d.minValue >= d.maxValue) return { valid: false, error: `Dimension '${d.name}' has invalid min/max range.` };
  }

  const { A, B, C, D } = profile.gradeThresholds;
  if (!(A > B && B > C && C > D && D >= 0)) {
    return { valid: false, error: 'Grade thresholds must be A > B > C > D >= 0.' };
  }

  return { valid: true };
}

/**
 * Resolve a metric value from the run snapshot.
 * Checks the snapshot's direct fields first, then falls back to the metrics bag.
 */
function resolveMetric(snapshot: RunSnapshot, metricKey: string): number {
  const fieldMap: Record<string, keyof RunSnapshot> = {
    final_net_worth: 'finalNetWorth',
    survival_ticks: 'survivalTicks',
    peak_net_worth: 'peakNetWorth',
    cord_score: 'cordScore',
    shield_integrity: 'shieldIntegrity',
    pressure_score: 'pressureScore',
    cascade_chains: 'cascadeChains',
    cards_played: 'cardsPlayed',
    cards_effective: 'cardsEffective',
  };

  const field = fieldMap[metricKey];
  if (field !== undefined) {
    const val = snapshot[field];
    if (typeof val === 'number') return val;
  }

  // Card effectiveness is a computed ratio
  if (metricKey === 'card_effectiveness') {
    return snapshot.cardsPlayed > 0 ? (snapshot.cardsEffective / snapshot.cardsPlayed) * 100 : 0;
  }

  return snapshot.metrics[metricKey] ?? 0;
}

/**
 * Normalize a raw metric value into [0, 100] based on dimension bounds and direction.
 */
function normalize(raw: number, dim: ScoringDimension): number {
  const clamped = Math.max(dim.minValue, Math.min(dim.maxValue, raw));
  const range = dim.maxValue - dim.minValue;
  if (range === 0) return 50;

  const ratio = (clamped - dim.minValue) / range;
  const normalized = dim.direction === 'HIGHER_IS_BETTER' ? ratio * 100 : (1 - ratio) * 100;
  return Math.round(normalized * 100) / 100;
}

/**
 * Assign a proficiency grade from a composite score.
 */
function assignGrade(compositeScore: number, thresholds: ScoringProfile['gradeThresholds']): ProficiencyGrade {
  if (compositeScore >= thresholds.A) return 'A';
  if (compositeScore >= thresholds.B) return 'B';
  if (compositeScore >= thresholds.C) return 'C';
  if (compositeScore >= thresholds.D) return 'D';
  return 'F';
}

/**
 * Compute a deterministic hash of the scoring inputs for tamper detection.
 * Uses FNV-1a for speed — not cryptographic, but sufficient for audit trails.
 */
function computeInputHash(snapshot: RunSnapshot, profile: ScoringProfile): string {
  const input = `${snapshot.runId}:${snapshot.seed}:${snapshot.rulesetId}:${snapshot.episodeVersion}:${profile.profileId}:${profile.version}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Score a benchmark run.
 *
 * Pure function — no side effects, no I/O.
 * Given a run snapshot, a scoring profile, and an optional baseline,
 * produces a complete ScoringResult with all dimensions, composite score,
 * grade, standardized outputs, and deltas.
 */
export function scoreRun(
  snapshot: RunSnapshot,
  profile: ScoringProfile,
  baseline?: BaselineSnapshot,
): ScoringResult {
  // Validate profile
  const validation = validateProfile(profile);
  if (!validation.valid) {
    throw new Error(`Invalid scoring profile: ${validation.error}`);
  }

  // Score each dimension
  const dimensions: DimensionResult[] = profile.dimensions.map((dim) => {
    const rawValue = resolveMetric(snapshot, dim.metricKey);
    const normalizedScore = normalize(rawValue, dim);
    const weightedScore = Math.round(normalizedScore * dim.weight * 100) / 100;

    let delta: number | null = null;
    let deltaLabel: string | null = null;
    if (baseline && baseline.metrics[dim.metricKey] !== undefined) {
      const baselineValue = baseline.metrics[dim.metricKey];
      delta = Math.round((rawValue - baselineValue) * 100) / 100;
      const pct = baselineValue !== 0 ? Math.round((delta / Math.abs(baselineValue)) * 10000) / 100 : 0;
      const sign = delta > 0 ? '+' : '';
      deltaLabel = `${sign}${delta} (${sign}${pct}%)`;
    }

    return { name: dim.name, rawValue, normalizedScore, weight: dim.weight, weightedScore, delta, deltaLabel };
  });

  // Composite score
  const compositeScore = Math.round(dimensions.reduce((sum, d) => sum + d.weightedScore, 0) * 100) / 100;

  // Grade
  const grade = assignGrade(compositeScore, profile.gradeThresholds);

  // Standardized outputs
  const outputs: BenchmarkOutput[] = STANDARD_OUTPUTS.map((spec) => ({
    metricKey: spec.metricKey,
    label: spec.label,
    value: resolveMetric(snapshot, spec.metricKey),
    unit: spec.unit,
  }));

  // Add any extra metrics from the snapshot's metrics bag
  for (const [key, value] of Object.entries(snapshot.metrics)) {
    if (!outputs.find((o) => o.metricKey === key)) {
      outputs.push({ metricKey: key, label: key, value, unit: 'raw' });
    }
  }

  // Deltas against baseline
  let deltas: DeltaReport | null = null;
  if (baseline) {
    const baselineComposite = computeBaselineComposite(profile, baseline);
    const baselineGrade = assignGrade(baselineComposite, profile.gradeThresholds);

    deltas = {
      baselineLabel: baseline.label,
      compositeScoreDelta: Math.round((compositeScore - baselineComposite) * 100) / 100,
      gradeDelta: GRADE_VALUES[grade] - GRADE_VALUES[baselineGrade],
      dimensionDeltas: profile.dimensions.map((dim) => {
        const current = resolveMetric(snapshot, dim.metricKey);
        const base = baseline.metrics[dim.metricKey] ?? 0;
        const d = Math.round((current - base) * 100) / 100;
        const isBetter = dim.direction === 'HIGHER_IS_BETTER' ? d > 0 : d < 0;
        return {
          name: dim.name,
          currentValue: current,
          baselineValue: base,
          delta: d,
          direction: d === 0 ? 'UNCHANGED' as const : isBetter ? 'IMPROVED' as const : 'DECLINED' as const,
        };
      }),
    };
  }

  return {
    runId: snapshot.runId,
    playerId: snapshot.playerId,
    profileId: profile.profileId,
    profileVersion: profile.version,
    scenarioId: snapshot.scenarioId,
    seed: snapshot.seed,
    rulesetId: snapshot.rulesetId,
    episodeVersion: snapshot.episodeVersion,
    outcome: snapshot.outcome,
    dimensions,
    compositeScore,
    grade,
    outputs,
    deltas,
    scoredAt: new Date().toISOString(),
    inputHash: computeInputHash(snapshot, profile),
  };
}

/**
 * Compute a composite score for a baseline snapshot (for delta comparison).
 */
function computeBaselineComposite(profile: ScoringProfile, baseline: BaselineSnapshot): number {
  let composite = 0;
  for (const dim of profile.dimensions) {
    const raw = baseline.metrics[dim.metricKey] ?? 0;
    const norm = normalize(raw, dim);
    composite += norm * dim.weight;
  }
  return Math.round(composite * 100) / 100;
}

/**
 * Compare two ScoringResults for the same benchmark definition.
 * Returns a delta summary suitable for pre/post measurement reporting.
 */
export function compareScoringResults(
  pre: ScoringResult,
  post: ScoringResult,
): DeltaReport {
  return {
    baselineLabel: `Run ${pre.runId} (pre-measurement)`,
    compositeScoreDelta: Math.round((post.compositeScore - pre.compositeScore) * 100) / 100,
    gradeDelta: GRADE_VALUES[post.grade] - GRADE_VALUES[pre.grade],
    dimensionDeltas: post.dimensions.map((postDim) => {
      const preDim = pre.dimensions.find((d) => d.name === postDim.name);
      const baseVal = preDim?.rawValue ?? 0;
      const delta = Math.round((postDim.rawValue - baseVal) * 100) / 100;
      return {
        name: postDim.name,
        currentValue: postDim.rawValue,
        baselineValue: baseVal,
        delta,
        direction: delta === 0 ? 'UNCHANGED' as const : delta > 0 ? 'IMPROVED' as const : 'DECLINED' as const,
      };
    }),
  };
}

/**
 * Create a default scoring profile with PZO's standard rubric.
 */
export function createDefaultScoringProfile(): ScoringProfile {
  return {
    profileId: 'pzo-default-v1',
    version: '1.0.0',
    dimensions: [
      { name: 'Financial Outcome', weight: 0.25, metricKey: 'final_net_worth', direction: 'HIGHER_IS_BETTER', minValue: -100000, maxValue: 500000 },
      { name: 'Survival Duration', weight: 0.20, metricKey: 'survival_ticks', direction: 'HIGHER_IS_BETTER', minValue: 0, maxValue: 1000 },
      { name: 'Sovereignty', weight: 0.20, metricKey: 'cord_score', direction: 'HIGHER_IS_BETTER', minValue: 0, maxValue: 100 },
      { name: 'Shield Management', weight: 0.15, metricKey: 'shield_integrity', direction: 'HIGHER_IS_BETTER', minValue: 0, maxValue: 100 },
      { name: 'Pressure Control', weight: 0.10, metricKey: 'pressure_score', direction: 'LOWER_IS_BETTER', minValue: 0, maxValue: 100 },
      { name: 'Card Effectiveness', weight: 0.10, metricKey: 'card_effectiveness', direction: 'HIGHER_IS_BETTER', minValue: 0, maxValue: 100 },
    ],
    gradeThresholds: { A: 85, B: 70, C: 55, D: 40 },
  };
}