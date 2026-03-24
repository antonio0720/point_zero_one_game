/**
 * Durable player conversational fingerprinting.
 */
import type {
  ChatPlayerModelAxis,
  ChatPlayerModelEvidence,
  ChatPlayerModelSnapshot,
  ChatPlayerModelVector,
} from '../../../../../shared/contracts/chat/player-model';
import { clamp01 as clampNovelty } from '../../../../../shared/contracts/chat/novelty';

export interface ChatPlayerModelServiceConfig {
  readonly maxEvidenceTail: number;
}

export const DEFAULT_CHAT_PLAYER_MODEL_SERVICE_CONFIG: ChatPlayerModelServiceConfig = Object.freeze({
  maxEvidenceTail: 128,
});

interface PlayerModelBucket {
  snapshot: ChatPlayerModelSnapshot;
}

export function now(): number { return Date.now(); }
function clamp01(value: number): number { return clampNovelty(value); }
export const clampPlayerModelValue: (value: number) => number = clamp01;

export function emptyVector(): ChatPlayerModelVector {
  return {
    impulsive01: 0.5,
    patient01: 0.5,
    greedy01: 0.5,
    defensive01: 0.5,
    bluffHeavy01: 0.5,
    literal01: 0.5,
    comebackProne01: 0.5,
    collapseProne01: 0.5,
    publicPerformer01: 0.5,
    silentOperator01: 0.5,
    procedureAware01: 0.5,
    careless01: 0.5,
    noveltySeeking01: 0.5,
    stabilitySeeking01: 0.5,
    rescueReliant01: 0.5,
  };
}

export function dominantAxes(vector: ChatPlayerModelVector): readonly ChatPlayerModelAxis[] {
  return [
    ['IMPULSIVE', vector.impulsive01],
    ['PATIENT', vector.patient01],
    ['GREEDY', vector.greedy01],
    ['DEFENSIVE', vector.defensive01],
    ['BLUFF_HEAVY', vector.bluffHeavy01],
    ['LITERAL', vector.literal01],
    ['COMEBACK_PRONE', vector.comebackProne01],
    ['COLLAPSE_PRONE', vector.collapseProne01],
    ['PUBLIC_PERFORMER', vector.publicPerformer01],
    ['SILENT_OPERATOR', vector.silentOperator01],
    ['PROCEDURE_AWARE', vector.procedureAware01],
    ['CARELESS', vector.careless01],
    ['NOVELTY_SEEKING', vector.noveltySeeking01],
    ['STABILITY_SEEKING', vector.stabilitySeeking01],
    ['RESCUE_RELIANT', vector.rescueReliant01],
  ]
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 4)
    .map(([axis]) => axis as ChatPlayerModelAxis);
}

export class ChatPlayerModelService {
  private readonly config: ChatPlayerModelServiceConfig;
  private readonly players = new Map<string, PlayerModelBucket>();

  public constructor(config: Partial<ChatPlayerModelServiceConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_CHAT_PLAYER_MODEL_SERVICE_CONFIG, ...config });
  }

  private ensure(playerId: string): PlayerModelBucket {
    const current = this.players.get(playerId);
    if (current) return current;
    const snapshot: ChatPlayerModelSnapshot = {
      profileId: `player-model:${playerId}`,
      playerId,
      createdAt: now(),
      updatedAt: now(),
      vector: emptyVector(),
      dominantAxes: dominantAxes(emptyVector()),
      evidenceTail: [],
      notes: [],
    };
    const bucket = { snapshot };
    this.players.set(playerId, bucket);
    return bucket;
  }

  public ingestEvidence(playerId: string, evidence: ChatPlayerModelEvidence): ChatPlayerModelSnapshot {
    const bucket = this.ensure(playerId);
    const vector = { ...bucket.snapshot.vector };
    const apply = (axis: keyof ChatPlayerModelVector, delta: number) => {
      vector[axis] = clamp01(vector[axis] * 0.72 + clamp01(vector[axis] + delta) * 0.28);
    };

    for (const axis of evidence.axes) {
      switch (axis) {
        case 'IMPULSIVE': apply('impulsive01', evidence.weight01 * 0.22); apply('patient01', -evidence.weight01 * 0.15); break;
        case 'PATIENT': apply('patient01', evidence.weight01 * 0.22); apply('impulsive01', -evidence.weight01 * 0.15); break;
        case 'GREEDY': apply('greedy01', evidence.weight01 * 0.20); apply('defensive01', -evidence.weight01 * 0.10); break;
        case 'DEFENSIVE': apply('defensive01', evidence.weight01 * 0.20); break;
        case 'BLUFF_HEAVY': apply('bluffHeavy01', evidence.weight01 * 0.20); apply('literal01', -evidence.weight01 * 0.10); break;
        case 'LITERAL': apply('literal01', evidence.weight01 * 0.18); break;
        case 'COMEBACK_PRONE': apply('comebackProne01', evidence.weight01 * 0.18); break;
        case 'COLLAPSE_PRONE': apply('collapseProne01', evidence.weight01 * 0.18); break;
        case 'PUBLIC_PERFORMER': apply('publicPerformer01', evidence.weight01 * 0.18); apply('silentOperator01', -evidence.weight01 * 0.10); break;
        case 'SILENT_OPERATOR': apply('silentOperator01', evidence.weight01 * 0.18); break;
        case 'PROCEDURE_AWARE': apply('procedureAware01', evidence.weight01 * 0.20); apply('careless01', -evidence.weight01 * 0.15); break;
        case 'CARELESS': apply('careless01', evidence.weight01 * 0.20); break;
        case 'NOVELTY_SEEKING': apply('noveltySeeking01', evidence.weight01 * 0.20); apply('stabilitySeeking01', -evidence.weight01 * 0.10); break;
        case 'STABILITY_SEEKING': apply('stabilitySeeking01', evidence.weight01 * 0.20); break;
        case 'RESCUE_RELIANT': apply('rescueReliant01', evidence.weight01 * 0.18); break;
      }
    }

    bucket.snapshot = {
      ...bucket.snapshot,
      updatedAt: evidence.createdAt,
      vector,
      dominantAxes: dominantAxes(vector),
      evidenceTail: [evidence, ...bucket.snapshot.evidenceTail].slice(0, this.config.maxEvidenceTail),
      notes: [
        `updated_from:${evidence.source}`,
        ...bucket.snapshot.notes,
      ].slice(0, 32),
    };
    return bucket.snapshot;
  }

  public getSnapshot(playerId: string): ChatPlayerModelSnapshot {
    return this.ensure(playerId).snapshot;
  }

  /** Bulk ingest an array of evidence entries for one player. Returns final snapshot. */
  public ingestBulk(playerId: string, evidences: readonly ChatPlayerModelEvidence[]): ChatPlayerModelSnapshot {
    let snapshot = this.ensure(playerId).snapshot;
    for (const evidence of evidences) {
      snapshot = this.ingestEvidence(playerId, evidence);
    }
    return snapshot;
  }

  /** Return all tracked player IDs. */
  public getPlayerIds(): readonly string[] {
    return Object.freeze([...this.players.keys()]);
  }

  /** Check if a player has any model data. */
  public hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  /** Clear model data for a specific player. */
  public clearPlayer(playerId: string): boolean {
    return this.players.delete(playerId);
  }

  /** Reset a player's vector to the neutral midpoint. */
  public resetVector(playerId: string): ChatPlayerModelSnapshot {
    const bucket = this.ensure(playerId);
    const neutral = emptyVector();
    bucket.snapshot = {
      ...bucket.snapshot,
      updatedAt: now(),
      vector: neutral,
      dominantAxes: dominantAxes(neutral),
      notes: ['vector_reset', ...bucket.snapshot.notes].slice(0, 32),
    };
    return bucket.snapshot;
  }

  /** Compare two player vectors and return axis-by-axis delta. */
  public compareVectors(playerIdA: string, playerIdB: string): PlayerModelVectorDelta {
    const a = this.ensure(playerIdA).snapshot.vector;
    const b = this.ensure(playerIdB).snapshot.vector;
    return computeVectorDelta(a, b);
  }

  /** Build a risk profile for a player based on their current model vector. */
  public buildRiskProfile(playerId: string): PlayerRiskProfile {
    return buildRiskProfile(this.ensure(playerId).snapshot);
  }

  /** Score model drift: how far has a player moved from their baseline vector over their evidence tail? */
  public computeDrift(playerId: string): PlayerModelDriftReport {
    return computeModelDrift(this.ensure(playerId).snapshot);
  }

  /** Compute cross-player similarity score based on vector proximity. */
  public computeSimilarity(playerIdA: string, playerIdB: string): PlayerModelSimilarityScore {
    const snapshotA = this.ensure(playerIdA).snapshot;
    const snapshotB = this.ensure(playerIdB).snapshot;
    return computeSimilarityScore(snapshotA, snapshotB);
  }

  /** Snapshot the full service state as a serializable archive. */
  public exportAll(): readonly ChatPlayerModelSnapshot[] {
    return Object.freeze([...this.players.values()].map((b) => b.snapshot));
  }

  /** Restore service from exported snapshots. Overwrites existing data for matched players. */
  public importAll(snapshots: readonly ChatPlayerModelSnapshot[]): void {
    for (const snapshot of snapshots) {
      this.players.set(snapshot.playerId, { snapshot });
    }
  }

  /** Return a ranked leaderboard of players by a specific axis. */
  public rankByAxis(axis: ChatPlayerModelAxis): readonly { playerId: string; score01: number }[] {
    const axisKey = axisToVectorKey(axis);
    if (!axisKey) return Object.freeze([]);
    const ranked = [...this.players.entries()]
      .map(([playerId, bucket]) => ({
        playerId,
        score01: bucket.snapshot.vector[axisKey],
      }))
      .sort((a, b) => b.score01 - a.score01);
    return Object.freeze(ranked);
  }

  /** Find players whose dominant axes include a specific axis. */
  public findPlayersWithDominantAxis(axis: ChatPlayerModelAxis): readonly string[] {
    return Object.freeze(
      [...this.players.entries()]
        .filter(([, bucket]) => bucket.snapshot.dominantAxes.includes(axis))
        .map(([playerId]) => playerId),
    );
  }

  /** Build a cohort summary across all tracked players. */
  public buildCohortSummary(): PlayerModelCohortSummary {
    const snapshots = [...this.players.values()].map((b) => b.snapshot);
    return buildCohortSummary(snapshots);
  }

  /** Compute confidence score: how stable is the model (evidence density, recency). */
  public computeConfidence(playerId: string): PlayerModelConfidenceScore {
    return computeConfidenceScore(this.ensure(playerId).snapshot);
  }

  /** Return the top N evidence entries by weight. */
  public topEvidence(playerId: string, n: number = 10): readonly ChatPlayerModelEvidence[] {
    const tail = this.ensure(playerId).snapshot.evidenceTail;
    return Object.freeze([...tail].sort((a, b) => b.weight01 - a.weight01).slice(0, n));
  }

  /** Check if a player has a polar axis dominance (two opposing axes both high — unstable signal). */
  public hasPolarDominance(playerId: string): boolean {
    const vector = this.ensure(playerId).snapshot.vector;
    return detectPolarDominance(vector);
  }

  /** Apply temporal decay to the player's vector — older signal fades toward neutral. */
  public applyTemporalDecay(playerId: string, decayRate: number = 0.02): ChatPlayerModelSnapshot {
    const bucket = this.ensure(playerId);
    const v = bucket.snapshot.vector;
    const decayed = decayVector(v, decayRate);
    bucket.snapshot = {
      ...bucket.snapshot,
      updatedAt: now(),
      vector: decayed,
      dominantAxes: dominantAxes(decayed),
      notes: [`temporal_decay:rate=${decayRate.toFixed(3)}`, ...bucket.snapshot.notes].slice(0, 32),
    };
    return bucket.snapshot;
  }

  /** Count total evidence entries across all players. */
  public totalEvidenceCount(): number {
    let total = 0;
    for (const bucket of this.players.values()) {
      total += bucket.snapshot.evidenceTail.length;
    }
    return total;
  }
}

// ============================================================================
// VECTOR UTILITIES
// ============================================================================

export function axisToVectorKey(axis: ChatPlayerModelAxis): keyof ChatPlayerModelVector | null {
  const MAP: Partial<Record<ChatPlayerModelAxis, keyof ChatPlayerModelVector>> = {
    IMPULSIVE: 'impulsive01',
    PATIENT: 'patient01',
    GREEDY: 'greedy01',
    DEFENSIVE: 'defensive01',
    BLUFF_HEAVY: 'bluffHeavy01',
    LITERAL: 'literal01',
    COMEBACK_PRONE: 'comebackProne01',
    COLLAPSE_PRONE: 'collapseProne01',
    PUBLIC_PERFORMER: 'publicPerformer01',
    SILENT_OPERATOR: 'silentOperator01',
    PROCEDURE_AWARE: 'procedureAware01',
    CARELESS: 'careless01',
    NOVELTY_SEEKING: 'noveltySeeking01',
    STABILITY_SEEKING: 'stabilitySeeking01',
    RESCUE_RELIANT: 'rescueReliant01',
  };
  return MAP[axis] ?? null;
}

export function decayVector(v: ChatPlayerModelVector, rate: number): ChatPlayerModelVector {
  const neutral = 0.5;
  const decay = (x: number) => clamp01(x + (neutral - x) * rate);
  return {
    impulsive01: decay(v.impulsive01),
    patient01: decay(v.patient01),
    greedy01: decay(v.greedy01),
    defensive01: decay(v.defensive01),
    bluffHeavy01: decay(v.bluffHeavy01),
    literal01: decay(v.literal01),
    comebackProne01: decay(v.comebackProne01),
    collapseProne01: decay(v.collapseProne01),
    publicPerformer01: decay(v.publicPerformer01),
    silentOperator01: decay(v.silentOperator01),
    procedureAware01: decay(v.procedureAware01),
    careless01: decay(v.careless01),
    noveltySeeking01: decay(v.noveltySeeking01),
    stabilitySeeking01: decay(v.stabilitySeeking01),
    rescueReliant01: decay(v.rescueReliant01),
  };
}

export function detectPolarDominance(v: ChatPlayerModelVector): boolean {
  const POLAR_PAIRS: [keyof ChatPlayerModelVector, keyof ChatPlayerModelVector][] = [
    ['impulsive01', 'patient01'],
    ['greedy01', 'defensive01'],
    ['bluffHeavy01', 'literal01'],
    ['publicPerformer01', 'silentOperator01'],
    ['noveltySeeking01', 'stabilitySeeking01'],
    ['comebackProne01', 'collapseProne01'],
    ['procedureAware01', 'careless01'],
  ];
  const POLAR_THRESHOLD = 0.68;
  return POLAR_PAIRS.some(([a, b]) => v[a] >= POLAR_THRESHOLD && v[b] >= POLAR_THRESHOLD);
}

// ============================================================================
// PLAYER RISK PROFILE
// ============================================================================

export interface PlayerRiskProfile {
  readonly playerId: string;
  readonly collapseRisk01: number;
  readonly bluffExposureRisk01: number;
  readonly churnRisk01: number;
  readonly escalationRisk01: number;
  readonly rescueDependency01: number;
  readonly overallRisk01: number;
  readonly riskLabel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export function buildRiskProfile(snapshot: ChatPlayerModelSnapshot): PlayerRiskProfile {
  const v = snapshot.vector;
  const collapseRisk01 = clamp01(v.collapseProne01 * 0.6 + v.rescueReliant01 * 0.4);
  const bluffExposureRisk01 = clamp01(v.bluffHeavy01 * 0.7 + (1 - v.literal01) * 0.3);
  const churnRisk01 = clamp01(v.impulsive01 * 0.5 + v.careless01 * 0.3 + (1 - v.stabilitySeeking01) * 0.2);
  const escalationRisk01 = clamp01(v.impulsive01 * 0.4 + v.greedy01 * 0.3 + (1 - v.patient01) * 0.3);
  const rescueDependency01 = clamp01(v.rescueReliant01 * 0.7 + v.collapseProne01 * 0.3);
  const overallRisk01 = clamp01(
    (collapseRisk01 + bluffExposureRisk01 + churnRisk01 + escalationRisk01 + rescueDependency01) / 5,
  );
  const riskLabel: PlayerRiskProfile['riskLabel'] =
    overallRisk01 >= 0.75 ? 'CRITICAL' :
    overallRisk01 >= 0.55 ? 'HIGH' :
    overallRisk01 >= 0.35 ? 'MEDIUM' : 'LOW';
  return Object.freeze({
    playerId: snapshot.playerId,
    collapseRisk01,
    bluffExposureRisk01,
    churnRisk01,
    escalationRisk01,
    rescueDependency01,
    overallRisk01,
    riskLabel,
  });
}

// ============================================================================
// VECTOR DELTA COMPARISON
// ============================================================================

export interface PlayerModelVectorDelta {
  readonly playerIdA: string;
  readonly playerIdB: string;
  readonly deltas: Readonly<Record<string, number>>;
  readonly totalDivergence01: number;
  readonly mostDivergentAxis: string;
  readonly mostAlignedAxis: string;
}

export function computeVectorDelta(
  a: ChatPlayerModelVector,
  b: ChatPlayerModelVector,
  playerIdA: string = '',
  playerIdB: string = '',
): PlayerModelVectorDelta {
  const keys = Object.keys(a) as (keyof ChatPlayerModelVector)[];
  const deltas: Record<string, number> = {};
  let maxDivergence = 0;
  let minDivergence = Infinity;
  let mostDivergentAxis = keys[0] as string;
  let mostAlignedAxis = keys[0] as string;

  for (const key of keys) {
    const delta = Math.abs(a[key] - b[key]);
    deltas[key] = delta;
    if (delta > maxDivergence) { maxDivergence = delta; mostDivergentAxis = key; }
    if (delta < minDivergence) { minDivergence = delta; mostAlignedAxis = key; }
  }

  const totalDivergence01 = clamp01(
    Object.values(deltas).reduce((s, d) => s + d, 0) / keys.length,
  );

  return Object.freeze({
    playerIdA,
    playerIdB,
    deltas: Object.freeze(deltas),
    totalDivergence01,
    mostDivergentAxis,
    mostAlignedAxis,
  });
}

// ============================================================================
// MODEL DRIFT DETECTION
// ============================================================================

export interface PlayerModelDriftReport {
  readonly playerId: string;
  readonly driftScore01: number;
  readonly axisChanges: readonly { axis: string; fromValue: number; toValue: number; change: number }[];
  readonly isUnstable: boolean;
  readonly driftLabel: 'STABLE' | 'DRIFTING' | 'SHIFTING' | 'VOLATILE';
}

export function computeModelDrift(snapshot: ChatPlayerModelSnapshot): PlayerModelDriftReport {
  const tail = snapshot.evidenceTail;
  if (tail.length < 2) {
    return Object.freeze({
      playerId: snapshot.playerId,
      driftScore01: 0,
      axisChanges: Object.freeze([]),
      isUnstable: false,
      driftLabel: 'STABLE',
    });
  }

  // Reconstruct approximate vector changes from evidence axes
  const axisWeightDeltas = new Map<string, { from: number; to: number }>();
  const currentVector = snapshot.vector;
  const keys = Object.keys(currentVector) as (keyof ChatPlayerModelVector)[];

  let totalDrift = 0;
  for (const key of keys) {
    const currentVal = currentVector[key];
    // Approximate past value using the earliest evidence's impact
    const earliestEvidence = tail[tail.length - 1];
    const axisName = key.replace('01', '').toUpperCase();
    const earlyHit = earliestEvidence.axes.some((a) =>
      axisToVectorKey(a) === key,
    );
    const fromValue = earlyHit
      ? clamp01(currentVal - earliestEvidence.weight01 * 0.15)
      : currentVal;
    const change = Math.abs(currentVal - fromValue);
    totalDrift += change;
    axisWeightDeltas.set(key, { from: fromValue, to: currentVal });
  }

  const driftScore01 = clamp01(totalDrift / keys.length * 3);
  const axisChanges = [...axisWeightDeltas.entries()]
    .map(([axis, { from: fromValue, to: toValue }]) => ({
      axis,
      fromValue,
      toValue,
      change: Math.abs(toValue - fromValue),
    }))
    .sort((a, b) => b.change - a.change)
    .slice(0, 5);

  const driftLabel: PlayerModelDriftReport['driftLabel'] =
    driftScore01 >= 0.6 ? 'VOLATILE' :
    driftScore01 >= 0.35 ? 'SHIFTING' :
    driftScore01 >= 0.15 ? 'DRIFTING' : 'STABLE';

  return Object.freeze({
    playerId: snapshot.playerId,
    driftScore01,
    axisChanges: Object.freeze(axisChanges),
    isUnstable: driftScore01 >= 0.35,
    driftLabel,
  });
}

// ============================================================================
// SIMILARITY SCORING
// ============================================================================

export interface PlayerModelSimilarityScore {
  readonly playerIdA: string;
  readonly playerIdB: string;
  readonly similarity01: number;
  readonly divergence01: number;
  readonly sharedDominantAxes: readonly ChatPlayerModelAxis[];
  readonly label: 'MIRROR' | 'ALIGNED' | 'MIXED' | 'DIVERGENT' | 'OPPOSITE';
}

export function computeSimilarityScore(
  snapshotA: ChatPlayerModelSnapshot,
  snapshotB: ChatPlayerModelSnapshot,
): PlayerModelSimilarityScore {
  const keys = Object.keys(snapshotA.vector) as (keyof ChatPlayerModelVector)[];
  let sumSquaredDiff = 0;
  for (const key of keys) {
    const diff = snapshotA.vector[key] - snapshotB.vector[key];
    sumSquaredDiff += diff * diff;
  }
  const divergence01 = clamp01(Math.sqrt(sumSquaredDiff / keys.length));
  const similarity01 = clamp01(1 - divergence01);

  const sharedDominantAxes = snapshotA.dominantAxes.filter((a) =>
    snapshotB.dominantAxes.includes(a),
  );

  const label: PlayerModelSimilarityScore['label'] =
    similarity01 >= 0.90 ? 'MIRROR' :
    similarity01 >= 0.72 ? 'ALIGNED' :
    similarity01 >= 0.48 ? 'MIXED' :
    similarity01 >= 0.25 ? 'DIVERGENT' : 'OPPOSITE';

  return Object.freeze({
    playerIdA: snapshotA.playerId,
    playerIdB: snapshotB.playerId,
    similarity01,
    divergence01,
    sharedDominantAxes: Object.freeze(sharedDominantAxes),
    label,
  });
}

// ============================================================================
// COHORT SUMMARY
// ============================================================================

export interface PlayerModelCohortSummary {
  readonly playerCount: number;
  readonly averageVector: ChatPlayerModelVector;
  readonly mostCommonDominantAxis: ChatPlayerModelAxis | null;
  readonly highestRiskAxis: keyof ChatPlayerModelVector;
  readonly cohortRiskLabel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly evidenceDensity: number;
}

export function buildCohortSummary(snapshots: readonly ChatPlayerModelSnapshot[]): PlayerModelCohortSummary {
  if (snapshots.length === 0) {
    return Object.freeze({
      playerCount: 0,
      averageVector: emptyVector(),
      mostCommonDominantAxis: null,
      highestRiskAxis: 'impulsive01' as keyof ChatPlayerModelVector,
      cohortRiskLabel: 'LOW',
      evidenceDensity: 0,
    });
  }

  const keys = Object.keys(emptyVector()) as (keyof ChatPlayerModelVector)[];
  const sumVector: Record<string, number> = {};
  for (const key of keys) sumVector[key] = 0;
  for (const snap of snapshots) {
    for (const key of keys) sumVector[key] += snap.vector[key];
  }
  const avgRecord: Record<string, number> = {};
  for (const key of keys) {
    avgRecord[key] = sumVector[key] / snapshots.length;
  }
  const averageVector: ChatPlayerModelVector = avgRecord as unknown as ChatPlayerModelVector;

  const axisCounts = new Map<ChatPlayerModelAxis, number>();
  for (const snap of snapshots) {
    for (const axis of snap.dominantAxes) {
      axisCounts.set(axis, (axisCounts.get(axis) ?? 0) + 1);
    }
  }
  let mostCommonDominantAxis: ChatPlayerModelAxis | null = null;
  let maxAxisCount = 0;
  for (const [axis, count] of axisCounts) {
    if (count > maxAxisCount) { maxAxisCount = count; mostCommonDominantAxis = axis; }
  }

  let highestRiskAxis: keyof ChatPlayerModelVector = 'impulsive01';
  let maxAvg = 0;
  for (const key of keys) {
    if (avgRecord[key] > maxAvg) {
      maxAvg = avgRecord[key];
      highestRiskAxis = key;
    }
  }

  const avgRisk = buildRiskProfile({ ...snapshots[0], vector: averageVector });
  const evidenceDensity = snapshots.reduce((s, snap) => s + snap.evidenceTail.length, 0) / snapshots.length;

  return Object.freeze({
    playerCount: snapshots.length,
    averageVector: Object.freeze(averageVector),
    mostCommonDominantAxis,
    highestRiskAxis,
    cohortRiskLabel: avgRisk.riskLabel,
    evidenceDensity,
  });
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

export interface PlayerModelConfidenceScore {
  readonly playerId: string;
  readonly confidence01: number;
  readonly evidenceCount: number;
  readonly evidenceRecency01: number;
  readonly vectorStability01: number;
  readonly label: 'SPARSE' | 'LOW' | 'MODERATE' | 'HIGH' | 'SATURATED';
}

export function computeConfidenceScore(snapshot: ChatPlayerModelSnapshot): PlayerModelConfidenceScore {
  const evidenceCount = snapshot.evidenceTail.length;
  const evidenceCountFactor = clamp01(evidenceCount / 64);

  const nowMs = Date.now();
  const latestEvidenceAt = snapshot.evidenceTail.length > 0
    ? snapshot.evidenceTail[0].createdAt
    : snapshot.createdAt;
  const ageMs = nowMs - latestEvidenceAt;
  const evidenceRecency01 = clamp01(1 - ageMs / (24 * 60 * 60 * 1000));

  // Vector stability: how far from the midpoint (0.5) are the values on average?
  const keys = Object.keys(snapshot.vector) as (keyof ChatPlayerModelVector)[];
  const avgDeviation = keys.reduce((s, k) => s + Math.abs(snapshot.vector[k] - 0.5), 0) / keys.length;
  const vectorStability01 = clamp01(1 - avgDeviation * 2);

  const confidence01 = clamp01(
    evidenceCountFactor * 0.45 +
    evidenceRecency01 * 0.35 +
    vectorStability01 * 0.20,
  );

  const label: PlayerModelConfidenceScore['label'] =
    evidenceCount === 0 ? 'SPARSE' :
    confidence01 >= 0.80 ? 'SATURATED' :
    confidence01 >= 0.60 ? 'HIGH' :
    confidence01 >= 0.35 ? 'MODERATE' : 'LOW';

  return Object.freeze({
    playerId: snapshot.playerId,
    confidence01,
    evidenceCount,
    evidenceRecency01,
    vectorStability01,
    label,
  });
}

// ============================================================================
// ARCHIVAL UTILITIES — For use by chat engine subsystems
// ============================================================================

/** Build a structured evidence entry from a transcript-based observation. */
export function buildTranscriptEvidence(
  evidenceId: string,
  playerId: string,
  axes: readonly ChatPlayerModelAxis[],
  weight01: number,
  summary: string,
): ChatPlayerModelEvidence {
  return Object.freeze({
    evidenceId,
    source: 'TRANSCRIPT' as const,
    summary: `[${playerId}] ${summary}`,
    axes: Object.freeze([...axes]),
    weight01: clamp01(weight01),
    createdAt: Date.now(),
  });
}

/** Build a structured evidence entry from a memory-based observation. */
export function buildMemoryEvidence(
  evidenceId: string,
  playerId: string,
  axes: readonly ChatPlayerModelAxis[],
  weight01: number,
  summary: string,
): ChatPlayerModelEvidence {
  return Object.freeze({
    evidenceId,
    source: 'MEMORY' as const,
    summary: `[${playerId}] ${summary}`,
    axes: Object.freeze([...axes]),
    weight01: clamp01(weight01),
    createdAt: Date.now(),
  });
}

/** Build a structured evidence entry from a scene-based observation. */
export function buildSceneEvidence(
  evidenceId: string,
  playerId: string,
  axes: readonly ChatPlayerModelAxis[],
  weight01: number,
  summary: string,
): ChatPlayerModelEvidence {
  return Object.freeze({
    evidenceId,
    source: 'SCENE' as const,
    summary: `[${playerId}] ${summary}`,
    axes: Object.freeze([...axes]),
    weight01: clamp01(weight01),
    createdAt: Date.now(),
  });
}

/** Return the vector axis label for display in overlays. */
export function axisLabel(axis: ChatPlayerModelAxis): string {
  const LABELS: Record<ChatPlayerModelAxis, string> = {
    IMPULSIVE: 'Impulsive',
    PATIENT: 'Patient',
    GREEDY: 'Greedy',
    DEFENSIVE: 'Defensive',
    BLUFF_HEAVY: 'Bluff Heavy',
    LITERAL: 'Literal',
    COMEBACK_PRONE: 'Comeback-Prone',
    COLLAPSE_PRONE: 'Collapse-Prone',
    PUBLIC_PERFORMER: 'Public Performer',
    SILENT_OPERATOR: 'Silent Operator',
    PROCEDURE_AWARE: 'Procedure-Aware',
    CARELESS: 'Careless',
    NOVELTY_SEEKING: 'Novelty Seeking',
    STABILITY_SEEKING: 'Stability Seeking',
    RESCUE_RELIANT: 'Rescue Reliant',
  };
  return LABELS[axis];
}

/** Build a compact fingerprint string for a player model snapshot. */
export function snapshotFingerprint(snapshot: ChatPlayerModelSnapshot): string {
  const keys = Object.keys(snapshot.vector) as (keyof ChatPlayerModelVector)[];
  const parts = keys.map((k) => `${k}=${snapshot.vector[k].toFixed(3)}`);
  return `${snapshot.playerId}@${snapshot.updatedAt}|${parts.join(',')}`;
}

/** Determine if two snapshots have meaningfully diverged (change above threshold). */
export function snapshotsHaveDiverged(
  before: ChatPlayerModelSnapshot,
  after: ChatPlayerModelSnapshot,
  threshold01: number = 0.08,
): boolean {
  const keys = Object.keys(before.vector) as (keyof ChatPlayerModelVector)[];
  for (const key of keys) {
    if (Math.abs(before.vector[key] - after.vector[key]) >= threshold01) return true;
  }
  return false;
}

/** Compute the scalar norm of a vector (distance from origin). */
export function vectorNorm(vector: ChatPlayerModelVector): number {
  const keys = Object.keys(vector) as (keyof ChatPlayerModelVector)[];
  return Math.sqrt(keys.reduce((s, k) => s + vector[k] * vector[k], 0));
}

/** Sort snapshots by overall risk, highest first. */
export function sortSnapshotsByRisk(
  snapshots: readonly ChatPlayerModelSnapshot[],
): readonly ChatPlayerModelSnapshot[] {
  return Object.freeze(
    [...snapshots].sort((a, b) => {
      const riskA = buildRiskProfile(a).overallRisk01;
      const riskB = buildRiskProfile(b).overallRisk01;
      return riskB - riskA;
    }),
  );
}

/** Group snapshots by their dominant axis label. */
export function groupSnapshotsByDominantAxis(
  snapshots: readonly ChatPlayerModelSnapshot[],
): Readonly<Partial<Record<ChatPlayerModelAxis, readonly ChatPlayerModelSnapshot[]>>> {
  const groups: Partial<Record<ChatPlayerModelAxis, ChatPlayerModelSnapshot[]>> = {};
  for (const snap of snapshots) {
    const top = snap.dominantAxes[0];
    if (!top) continue;
    if (!groups[top]) groups[top] = [];
    groups[top]!.push(snap);
  }
  const frozen: Partial<Record<ChatPlayerModelAxis, readonly ChatPlayerModelSnapshot[]>> = {};
  for (const [axis, group] of Object.entries(groups)) {
    frozen[axis as ChatPlayerModelAxis] = Object.freeze(group);
  }
  return Object.freeze(frozen);
}

/** Compute a "pressure" score representing how much a player is expected to act soon. */
export function computeActionPressure01(snapshot: ChatPlayerModelSnapshot): number {
  const v = snapshot.vector;
  return clamp01(
    v.impulsive01 * 0.35 +
    v.greedy01 * 0.20 +
    v.comebackProne01 * 0.20 +
    (1 - v.patient01) * 0.15 +
    (1 - v.silentOperator01) * 0.10,
  );
}

/** Compute a "volatility" score for how unpredictable the player's behaviour is. */
export function computeVolatility01(snapshot: ChatPlayerModelSnapshot): number {
  const v = snapshot.vector;
  return clamp01(
    v.impulsive01 * 0.30 +
    v.bluffHeavy01 * 0.20 +
    v.comebackProne01 * 0.15 +
    v.collapseProne01 * 0.15 +
    v.careless01 * 0.20,
  );
}

// ============================================================================
// MODULE CONSTANTS
// ============================================================================

export const CHAT_PLAYER_MODEL_MODULE_NAME = 'chat-player-model' as const;
export const CHAT_PLAYER_MODEL_MODULE_VERSION = '2026.03.23.v2' as const;

export const CHAT_PLAYER_MODEL_LAWS = Object.freeze([
  'All vector values must be clamped to [0, 1] at all times.',
  'Evidence tail is trimmed to maxEvidenceTail — oldest entries are dropped first.',
  'Vector updates use an EMA blend (0.72 old + 0.28 new) to prevent spike instability.',
  'Polar dominance detection does not suppress evidence — it is a diagnostic signal only.',
  'Temporal decay moves values toward 0.5 (neutral midpoint), never past it.',
  'Cohort summaries require at least one snapshot — empty input returns neutral output.',
  'Risk profiles are computed deterministically from the current vector — no state.',
  'Confidence scoring factors: evidence count (45%), recency (35%), stability (20%).',
]);

export const CHAT_PLAYER_MODEL_AXIS_POLARITIES: Readonly<Partial<Record<ChatPlayerModelAxis, ChatPlayerModelAxis>>> = Object.freeze({
  IMPULSIVE: 'PATIENT',
  PATIENT: 'IMPULSIVE',
  GREEDY: 'DEFENSIVE',
  DEFENSIVE: 'GREEDY',
  BLUFF_HEAVY: 'LITERAL',
  LITERAL: 'BLUFF_HEAVY',
  COMEBACK_PRONE: 'COLLAPSE_PRONE',
  COLLAPSE_PRONE: 'COMEBACK_PRONE',
  PUBLIC_PERFORMER: 'SILENT_OPERATOR',
  SILENT_OPERATOR: 'PUBLIC_PERFORMER',
  NOVELTY_SEEKING: 'STABILITY_SEEKING',
  STABILITY_SEEKING: 'NOVELTY_SEEKING',
  PROCEDURE_AWARE: 'CARELESS',
  CARELESS: 'PROCEDURE_AWARE',
});

/** Factory function that creates a ChatPlayerModelService with default config. */
export function createChatPlayerModelService(
  config?: Partial<ChatPlayerModelServiceConfig>,
): ChatPlayerModelService {
  return new ChatPlayerModelService(config);
}

// ============================================================================
// VECTOR INTERPOLATION — Blend between two player vectors for NPC calibration
// ============================================================================

export interface VectorInterpolationResult {
  readonly interpolated: ChatPlayerModelVector;
  readonly blendFactor01: number;
  readonly dominantAxes: readonly ChatPlayerModelAxis[];
}

export function interpolateVectors(
  vectorA: ChatPlayerModelVector,
  vectorB: ChatPlayerModelVector,
  blendFactor01: number,
): VectorInterpolationResult {
  const t = clamp01(blendFactor01);
  const keys = Object.keys(vectorA) as (keyof ChatPlayerModelVector)[];
  const interpolated: Record<string, number> = {};
  for (const key of keys) {
    interpolated[key] = vectorA[key] * (1 - t) + vectorB[key] * t;
  }
  const finalVector = interpolated as unknown as ChatPlayerModelVector;
  return Object.freeze({
    interpolated: Object.freeze(finalVector),
    blendFactor01: t,
    dominantAxes: dominantAxes(finalVector),
  });
}

// ============================================================================
// AXIS SENSITIVITY MATRIX — How much each evidence source changes each axis
// ============================================================================

export interface AxisSensitivityEntry {
  readonly axis: ChatPlayerModelAxis;
  readonly sourceWeights: Readonly<Record<ChatPlayerModelEvidence['source'], number>>;
  readonly highThreshold01: number;
  readonly lowThreshold01: number;
}

export const AXIS_SENSITIVITY_MATRIX: readonly AxisSensitivityEntry[] = Object.freeze([
  { axis: 'IMPULSIVE', sourceWeights: { TRANSCRIPT: 0.85, MEMORY: 0.45, NOVELTY: 0.60, RELATIONSHIP: 0.30, SCENE: 0.70 }, highThreshold01: 0.72, lowThreshold01: 0.30 },
  { axis: 'PATIENT', sourceWeights: { TRANSCRIPT: 0.70, MEMORY: 0.55, NOVELTY: 0.35, RELATIONSHIP: 0.40, SCENE: 0.65 }, highThreshold01: 0.75, lowThreshold01: 0.28 },
  { axis: 'GREEDY', sourceWeights: { TRANSCRIPT: 0.75, MEMORY: 0.50, NOVELTY: 0.60, RELATIONSHIP: 0.55, SCENE: 0.80 }, highThreshold01: 0.70, lowThreshold01: 0.32 },
  { axis: 'DEFENSIVE', sourceWeights: { TRANSCRIPT: 0.80, MEMORY: 0.60, NOVELTY: 0.40, RELATIONSHIP: 0.65, SCENE: 0.75 }, highThreshold01: 0.68, lowThreshold01: 0.35 },
  { axis: 'BLUFF_HEAVY', sourceWeights: { TRANSCRIPT: 0.90, MEMORY: 0.40, NOVELTY: 0.55, RELATIONSHIP: 0.50, SCENE: 0.80 }, highThreshold01: 0.65, lowThreshold01: 0.38 },
  { axis: 'LITERAL', sourceWeights: { TRANSCRIPT: 0.65, MEMORY: 0.70, NOVELTY: 0.30, RELATIONSHIP: 0.45, SCENE: 0.60 }, highThreshold01: 0.72, lowThreshold01: 0.30 },
  { axis: 'COMEBACK_PRONE', sourceWeights: { TRANSCRIPT: 0.75, MEMORY: 0.65, NOVELTY: 0.50, RELATIONSHIP: 0.55, SCENE: 0.85 }, highThreshold01: 0.65, lowThreshold01: 0.35 },
  { axis: 'COLLAPSE_PRONE', sourceWeights: { TRANSCRIPT: 0.85, MEMORY: 0.70, NOVELTY: 0.45, RELATIONSHIP: 0.60, SCENE: 0.90 }, highThreshold01: 0.60, lowThreshold01: 0.40 },
  { axis: 'PUBLIC_PERFORMER', sourceWeights: { TRANSCRIPT: 0.80, MEMORY: 0.55, NOVELTY: 0.65, RELATIONSHIP: 0.70, SCENE: 0.75 }, highThreshold01: 0.68, lowThreshold01: 0.32 },
  { axis: 'SILENT_OPERATOR', sourceWeights: { TRANSCRIPT: 0.60, MEMORY: 0.65, NOVELTY: 0.40, RELATIONSHIP: 0.50, SCENE: 0.55 }, highThreshold01: 0.72, lowThreshold01: 0.30 },
  { axis: 'PROCEDURE_AWARE', sourceWeights: { TRANSCRIPT: 0.65, MEMORY: 0.80, NOVELTY: 0.35, RELATIONSHIP: 0.40, SCENE: 0.70 }, highThreshold01: 0.75, lowThreshold01: 0.28 },
  { axis: 'CARELESS', sourceWeights: { TRANSCRIPT: 0.85, MEMORY: 0.50, NOVELTY: 0.60, RELATIONSHIP: 0.35, SCENE: 0.75 }, highThreshold01: 0.65, lowThreshold01: 0.38 },
  { axis: 'NOVELTY_SEEKING', sourceWeights: { TRANSCRIPT: 0.70, MEMORY: 0.55, NOVELTY: 0.90, RELATIONSHIP: 0.50, SCENE: 0.65 }, highThreshold01: 0.70, lowThreshold01: 0.32 },
  { axis: 'STABILITY_SEEKING', sourceWeights: { TRANSCRIPT: 0.60, MEMORY: 0.75, NOVELTY: 0.35, RELATIONSHIP: 0.55, SCENE: 0.60 }, highThreshold01: 0.72, lowThreshold01: 0.30 },
  { axis: 'RESCUE_RELIANT', sourceWeights: { TRANSCRIPT: 0.80, MEMORY: 0.70, NOVELTY: 0.40, RELATIONSHIP: 0.65, SCENE: 0.85 }, highThreshold01: 0.60, lowThreshold01: 0.42 },
]);

/** Look up sensitivity entry for an axis. */
export function getAxisSensitivity(axis: ChatPlayerModelAxis): AxisSensitivityEntry | null {
  return AXIS_SENSITIVITY_MATRIX.find((e) => e.axis === axis) ?? null;
}

// ============================================================================
// BEHAVIORAL ARCHETYPE MAPPING — Map vector to named player archetype
// ============================================================================

export type PlayerBehavioralArchetype =
  | 'AGGRESSOR'
  | 'SCHEMER'
  | 'SURVIVOR'
  | 'PERFORMER'
  | 'ANALYST'
  | 'RESCUER'
  | 'DRIFTER'
  | 'COLLAPSER'
  | 'GHOST'
  | 'WILD_CARD';

export interface PlayerArchetypeAssignment {
  readonly archetype: PlayerBehavioralArchetype;
  readonly confidence01: number;
  readonly alternates: readonly PlayerBehavioralArchetype[];
}

export function assignBehavioralArchetype(
  snapshot: ChatPlayerModelSnapshot,
): PlayerArchetypeAssignment {
  const v = snapshot.vector;

  const scores: Record<PlayerBehavioralArchetype, number> = {
    AGGRESSOR: clamp01(v.impulsive01 * 0.4 + v.greedy01 * 0.35 + (1 - v.patient01) * 0.25),
    SCHEMER: clamp01(v.bluffHeavy01 * 0.45 + v.greedy01 * 0.30 + (1 - v.literal01) * 0.25),
    SURVIVOR: clamp01(v.defensive01 * 0.45 + v.rescueReliant01 * 0.30 + v.stabilitySeeking01 * 0.25),
    PERFORMER: clamp01(v.publicPerformer01 * 0.50 + v.comebackProne01 * 0.30 + v.noveltySeeking01 * 0.20),
    ANALYST: clamp01(v.procedureAware01 * 0.50 + v.literal01 * 0.30 + v.patient01 * 0.20),
    RESCUER: clamp01((1 - v.rescueReliant01) * 0.40 + v.defensive01 * 0.30 + v.procedureAware01 * 0.30),
    DRIFTER: clamp01(v.careless01 * 0.40 + v.impulsive01 * 0.30 + (1 - v.stabilitySeeking01) * 0.30),
    COLLAPSER: clamp01(v.collapseProne01 * 0.55 + v.rescueReliant01 * 0.30 + (1 - v.defensive01) * 0.15),
    GHOST: clamp01(v.silentOperator01 * 0.55 + (1 - v.publicPerformer01) * 0.30 + v.stabilitySeeking01 * 0.15),
    WILD_CARD: clamp01(v.noveltySeeking01 * 0.35 + v.impulsive01 * 0.35 + v.comebackProne01 * 0.30),
  };

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a) as [PlayerBehavioralArchetype, number][];
  const archetype = sorted[0][0];
  const confidence01 = sorted[0][1];
  const alternates = sorted.slice(1, 3).map(([a]) => a);

  return Object.freeze({
    archetype,
    confidence01,
    alternates: Object.freeze(alternates),
  });
}

// ============================================================================
// EVIDENCE DEDUPLICATION — Prevent double-counting of same event
// ============================================================================

export interface EvidenceDeduplicationResult {
  readonly accepted: readonly ChatPlayerModelEvidence[];
  readonly rejected: readonly string[];
  readonly duplicateCount: number;
}

export function deduplicateEvidence(
  incoming: readonly ChatPlayerModelEvidence[],
  existingTail: readonly ChatPlayerModelEvidence[],
): EvidenceDeduplicationResult {
  const existingIds = new Set(existingTail.map((e) => e.evidenceId));
  const accepted: ChatPlayerModelEvidence[] = [];
  const rejected: string[] = [];

  for (const evidence of incoming) {
    if (existingIds.has(evidence.evidenceId)) {
      rejected.push(evidence.evidenceId);
    } else {
      accepted.push(evidence);
      existingIds.add(evidence.evidenceId);
    }
  }

  return Object.freeze({
    accepted: Object.freeze(accepted),
    rejected: Object.freeze(rejected),
    duplicateCount: rejected.length,
  });
}

// ============================================================================
// AXIS HEAT MAP — Visualize axis activation across multiple players
// ============================================================================

export interface AxisHeatMapEntry {
  readonly axis: ChatPlayerModelAxis;
  readonly averageValue01: number;
  readonly maxValue01: number;
  readonly minValue01: number;
  readonly activatedCount: number;
  readonly heatLabel: 'COLD' | 'WARM' | 'HOT' | 'BLAZING';
}

export function buildAxisHeatMap(
  snapshots: readonly ChatPlayerModelSnapshot[],
  activationThreshold01: number = 0.65,
): readonly AxisHeatMapEntry[] {
  if (snapshots.length === 0) return Object.freeze([]);

  const allAxes: ChatPlayerModelAxis[] = [
    'IMPULSIVE', 'PATIENT', 'GREEDY', 'DEFENSIVE', 'BLUFF_HEAVY',
    'LITERAL', 'COMEBACK_PRONE', 'COLLAPSE_PRONE', 'PUBLIC_PERFORMER',
    'SILENT_OPERATOR', 'PROCEDURE_AWARE', 'CARELESS', 'NOVELTY_SEEKING',
    'STABILITY_SEEKING', 'RESCUE_RELIANT',
  ];

  return Object.freeze(allAxes.map((axis) => {
    const key = axisToVectorKey(axis);
    if (!key) return Object.freeze({ axis, averageValue01: 0, maxValue01: 0, minValue01: 0, activatedCount: 0, heatLabel: 'COLD' as const });

    const values = snapshots.map((s) => s.vector[key]);
    const averageValue01 = values.reduce((s, v) => s + v, 0) / values.length;
    const maxValue01 = Math.max(...values);
    const minValue01 = Math.min(...values);
    const activatedCount = values.filter((v) => v >= activationThreshold01).length;
    const heatLabel: AxisHeatMapEntry['heatLabel'] =
      averageValue01 >= 0.75 ? 'BLAZING' :
      averageValue01 >= 0.60 ? 'HOT' :
      averageValue01 >= 0.42 ? 'WARM' : 'COLD';

    return Object.freeze({ axis, averageValue01, maxValue01, minValue01, activatedCount, heatLabel });
  }));
}

// ============================================================================
// AXIS TRAJECTORY — Trend direction for each axis over evidence tail
// ============================================================================

export interface AxisTrajectoryEntry {
  readonly axis: string;
  readonly current01: number;
  readonly recentAverage01: number;
  readonly trend: 'RISING' | 'FALLING' | 'STABLE';
  readonly velocity01: number;
}

export function computeAxisTrajectories(
  snapshot: ChatPlayerModelSnapshot,
  windowSize: number = 8,
): readonly AxisTrajectoryEntry[] {
  const currentVector = snapshot.vector;
  const keys = Object.keys(currentVector) as (keyof ChatPlayerModelVector)[];
  const recentEvidence = snapshot.evidenceTail.slice(0, windowSize);

  return Object.freeze(keys.map((key): AxisTrajectoryEntry => {
    const current01 = currentVector[key];
    // Approximate historical average by looking at which evidence entries touched this key
    const axisName = key.replace('01', '').toUpperCase().replace('_', '') as ChatPlayerModelAxis;
    const relevantEvidence = recentEvidence.filter((e) =>
      e.axes.some((a) => axisToVectorKey(a) === key),
    );

    const recentAverage01 = relevantEvidence.length > 0
      ? clamp01(current01 - relevantEvidence.reduce((s, e) => s + e.weight01 * 0.08, 0) / relevantEvidence.length)
      : current01;

    const velocity01 = Math.abs(current01 - recentAverage01);
    const trend: AxisTrajectoryEntry['trend'] =
      current01 > recentAverage01 + 0.02 ? 'RISING' :
      current01 < recentAverage01 - 0.02 ? 'FALLING' : 'STABLE';

    return Object.freeze({
      axis: axisName as string,
      current01,
      recentAverage01,
      trend,
      velocity01,
    });
  }));
}

// ============================================================================
// PLAYER MODEL SNAPSHOT DELTA LOG — Track all changes over time
// ============================================================================

export interface PlayerModelSnapshotDeltaEntry {
  readonly snapshotId: string;
  readonly playerId: string;
  readonly capturedAt: number;
  readonly evidenceCount: number;
  readonly topDominantAxis: ChatPlayerModelAxis | null;
  readonly riskLabel: PlayerRiskProfile['riskLabel'];
  readonly vectorHash: string;
}

export function captureSnapshotDeltaEntry(snapshot: ChatPlayerModelSnapshot): PlayerModelSnapshotDeltaEntry {
  const risk = buildRiskProfile(snapshot);
  const keys = Object.keys(snapshot.vector) as (keyof ChatPlayerModelVector)[];
  const hashStr = keys.map((k) => Math.round(snapshot.vector[k] * 100)).join('-');
  return Object.freeze({
    snapshotId: snapshot.profileId,
    playerId: snapshot.playerId,
    capturedAt: snapshot.updatedAt,
    evidenceCount: snapshot.evidenceTail.length,
    topDominantAxis: snapshot.dominantAxes[0] ?? null,
    riskLabel: risk.riskLabel,
    vectorHash: hashStr,
  });
}

// ============================================================================
// MULTI-PLAYER CROSS-ANALYSIS — Relationship dynamics via model comparison
// ============================================================================

export interface PlayerModelRelationshipHint {
  readonly playerIdA: string;
  readonly playerIdB: string;
  readonly archetypeA: PlayerBehavioralArchetype;
  readonly archetypeB: PlayerBehavioralArchetype;
  readonly expectedDynamic: 'PREDATOR_PREY' | 'MUTUAL_GUARD' | 'PERFORMANCE_DUEL' | 'ANALYTICAL_CLASH' | 'UNKNOWN';
  readonly conflictPotential01: number;
  readonly synergyPotential01: number;
}

export function inferRelationshipDynamic(
  snapshotA: ChatPlayerModelSnapshot,
  snapshotB: ChatPlayerModelSnapshot,
): PlayerModelRelationshipHint {
  const archA = assignBehavioralArchetype(snapshotA);
  const archB = assignBehavioralArchetype(snapshotB);

  const conflictPotential01 = clamp01(
    Math.abs(snapshotA.vector.impulsive01 - snapshotB.vector.impulsive01) * 0.3 +
    (snapshotA.vector.greedy01 + snapshotB.vector.greedy01) * 0.2 +
    Math.abs(snapshotA.vector.defensive01 - snapshotB.vector.defensive01) * 0.3 +
    (snapshotA.vector.bluffHeavy01 + snapshotB.vector.bluffHeavy01) * 0.2,
  );

  const synergyPotential01 = clamp01(
    (1 - Math.abs(snapshotA.vector.procedureAware01 - snapshotB.vector.procedureAware01)) * 0.35 +
    (1 - Math.abs(snapshotA.vector.stabilitySeeking01 - snapshotB.vector.stabilitySeeking01)) * 0.35 +
    (snapshotA.vector.silentOperator01 + snapshotB.vector.silentOperator01) * 0.15 +
    (1 - Math.abs(snapshotA.vector.greedy01 - snapshotB.vector.greedy01)) * 0.15,
  );

  const ARCHETYPE_DYNAMICS: Partial<Record<string, PlayerModelRelationshipHint['expectedDynamic']>> = {
    'AGGRESSOR-SURVIVOR': 'PREDATOR_PREY',
    'SURVIVOR-AGGRESSOR': 'PREDATOR_PREY',
    'SCHEMER-ANALYST': 'ANALYTICAL_CLASH',
    'ANALYST-SCHEMER': 'ANALYTICAL_CLASH',
    'PERFORMER-PERFORMER': 'PERFORMANCE_DUEL',
    'GHOST-GHOST': 'MUTUAL_GUARD',
    'RESCUER-COLLAPSER': 'PREDATOR_PREY',
    'COLLAPSER-RESCUER': 'PREDATOR_PREY',
  };

  const dynamicKey = `${archA.archetype}-${archB.archetype}`;
  const expectedDynamic = ARCHETYPE_DYNAMICS[dynamicKey] ?? 'UNKNOWN';

  return Object.freeze({
    playerIdA: snapshotA.playerId,
    playerIdB: snapshotB.playerId,
    archetypeA: archA.archetype,
    archetypeB: archB.archetype,
    expectedDynamic,
    conflictPotential01,
    synergyPotential01,
  });
}

// ============================================================================
// MODULE DESCRIPTOR
// ============================================================================

export const CHAT_PLAYER_MODEL_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_PLAYER_MODEL_MODULE_NAME,
  version: CHAT_PLAYER_MODEL_MODULE_VERSION,
  laws: CHAT_PLAYER_MODEL_LAWS,
  axisCount: 15,
  archetypeCount: 10,
  supportedEvidenceSources: ['TRANSCRIPT', 'MEMORY', 'NOVELTY', 'RELATIONSHIP', 'SCENE'] as const,
  defaultEvidenceTailSize: DEFAULT_CHAT_PLAYER_MODEL_SERVICE_CONFIG.maxEvidenceTail,
  decayTarget: 0.5,
  emaBlend: 0.28,
});

// ============================================================================
// PLAYER MODEL FINGERPRINT
// ============================================================================

export interface PlayerModelFingerprint {
  readonly playerId: string;
  readonly hash: string;
  readonly computedAt: number;
  readonly axisCount: number;
}

export function computePlayerModelFingerprint(snapshot: ChatPlayerModelSnapshot): PlayerModelFingerprint {
  const v = snapshot.vector;
  const keys = Object.keys(v).sort();
  const parts = [snapshot.playerId, ...keys.map((k) => `${k}:${(v as unknown as Record<string, number>)[k].toFixed(5)}`)];
  let h = 5381;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h = ((h << 5) + h + p.charCodeAt(i)) >>> 0;
    }
  }
  return Object.freeze({
    playerId: snapshot.playerId,
    hash: h.toString(16).padStart(8, '0'),
    computedAt: Date.now(),
    axisCount: keys.length,
  });
}

// ============================================================================
// PLAYER MODEL AXIS SENSITIVITY MAP
// ============================================================================

export interface AxisSensitivityMap {
  readonly playerId: string;
  readonly axes: readonly { readonly axis: ChatPlayerModelAxis; readonly sensitivity: number; readonly direction: 'HIGH' | 'LOW' | 'NEUTRAL' }[];
  readonly generatedAt: number;
}

export function buildAxisSensitivityMap(
  snapshot: ChatPlayerModelSnapshot,
  evidenceTail: readonly ChatPlayerModelEvidence[],
): AxisSensitivityMap {
  const AXES: ChatPlayerModelAxis[] = [
    'IMPULSIVE', 'PATIENT', 'GREEDY', 'DEFENSIVE', 'PUBLIC_PERFORMER',
    'PROCEDURE_AWARE', 'STABILITY_SEEKING', 'BLUFF_HEAVY', 'LITERAL', 'SILENT_OPERATOR',
    'COMEBACK_PRONE', 'COLLAPSE_PRONE', 'CARELESS', 'NOVELTY_SEEKING', 'RESCUE_RELIANT',
  ];
  const v = snapshot.vector;
  const axisEntries = AXES.map((axis) => {
    const axisKey = axisToVectorKey(axis);
    const val = axisKey ? (v[axisKey] as unknown as number) : 0.5;
    const evForAxis = evidenceTail.filter((e) => e.axes.includes(axis));
    const recentShift = evForAxis.length > 0
      ? evForAxis.slice(-5).reduce((s, e) => s + Math.abs(e.weight01), 0) / 5
      : 0;
    const sensitivity = clamp01(recentShift * 10);
    const direction: 'HIGH' | 'LOW' | 'NEUTRAL' = val > 0.65 ? 'HIGH' : val < 0.35 ? 'LOW' : 'NEUTRAL';
    return Object.freeze({ axis, sensitivity, direction });
  });
  return Object.freeze({ playerId: snapshot.playerId, axes: Object.freeze(axisEntries), generatedAt: Date.now() });
}

// ============================================================================
// PLAYER MODEL EPOCH SUMMARY
// ============================================================================

export interface PlayerModelEpoch {
  readonly playerId: string;
  readonly epochStartMs: number;
  readonly epochEndMs: number;
  readonly evidenceCount: number;
  readonly axisMeanVector: ChatPlayerModelVector;
  readonly netDriftScore: number;
  readonly dominantAxis: ChatPlayerModelAxis | null;
}

export function buildPlayerModelEpoch(
  playerId: string,
  evidenceTail: readonly ChatPlayerModelEvidence[],
  epochStartMs: number,
  epochEndMs: number = Date.now(),
): PlayerModelEpoch {
  const inEpoch = evidenceTail.filter((e) => e.createdAt >= epochStartMs && e.createdAt <= epochEndMs);
  const AXES: ChatPlayerModelAxis[] = [
    'IMPULSIVE', 'PATIENT', 'GREEDY', 'DEFENSIVE', 'PUBLIC_PERFORMER',
    'PROCEDURE_AWARE', 'STABILITY_SEEKING', 'BLUFF_HEAVY', 'LITERAL', 'SILENT_OPERATOR',
    'COMEBACK_PRONE', 'COLLAPSE_PRONE', 'CARELESS', 'NOVELTY_SEEKING', 'RESCUE_RELIANT',
  ];
  const sum: Record<string, number> = {};
  for (const a of AXES) sum[a] = 0;
  for (const ev of inEpoch) {
    for (const a of ev.axes) {
      if (sum[a] !== undefined) sum[a] += ev.weight01;
    }
  }
  const n = inEpoch.length || 1;
  const meanRecord: Record<string, number> = {};
  for (const a of AXES) meanRecord[a] = clamp01(0.5 + sum[a] / n);
  const axisMeanVector = meanRecord as unknown as ChatPlayerModelVector;

  let dominantAxis: ChatPlayerModelAxis | null = null;
  let maxDrift = 0;
  for (const a of AXES) {
    const drift = Math.abs((meanRecord[a] ?? 0.5) - 0.5);
    if (drift > maxDrift) { maxDrift = drift; dominantAxis = a; }
  }

  const netDriftScore = AXES.reduce((s, a) => s + Math.abs(meanRecord[a] - 0.5), 0) / AXES.length;

  return Object.freeze({ playerId, epochStartMs, epochEndMs, evidenceCount: inEpoch.length, axisMeanVector, netDriftScore, dominantAxis });
}

// ============================================================================
// PLAYER MODEL COMPARISON MATRIX
// ============================================================================

export interface PlayerModelComparisonEntry {
  readonly playerIdA: string;
  readonly playerIdB: string;
  readonly cosineSimilarity: number;
  readonly euclideanDistance: number;
  readonly divergentAxes: readonly ChatPlayerModelAxis[];
}

export interface PlayerModelComparisonMatrix {
  readonly entries: readonly PlayerModelComparisonEntry[];
  readonly mostSimilarPair: { readonly playerIdA: string; readonly playerIdB: string; readonly similarity: number } | null;
  readonly mostDivergentPair: { readonly playerIdA: string; readonly playerIdB: string; readonly distance: number } | null;
  readonly generatedAt: number;
}

export function vectorToRecord(v: ChatPlayerModelVector): Record<string, number> {
  return v as unknown as Record<string, number>;
}

export function buildPlayerModelComparisonMatrix(
  snapshots: readonly ChatPlayerModelSnapshot[],
): PlayerModelComparisonMatrix {
  const AXES: ChatPlayerModelAxis[] = [
    'IMPULSIVE', 'PATIENT', 'GREEDY', 'DEFENSIVE', 'PUBLIC_PERFORMER',
    'PROCEDURE_AWARE', 'STABILITY_SEEKING', 'BLUFF_HEAVY', 'LITERAL', 'SILENT_OPERATOR',
    'COMEBACK_PRONE', 'COLLAPSE_PRONE', 'CARELESS', 'NOVELTY_SEEKING', 'RESCUE_RELIANT',
  ];
  const entries: PlayerModelComparisonEntry[] = [];
  let mostSimilar: PlayerModelComparisonEntry | null = null;
  let mostDivergent: PlayerModelComparisonEntry | null = null;

  for (let i = 0; i < snapshots.length; i++) {
    for (let j = i + 1; j < snapshots.length; j++) {
      const a = vectorToRecord(snapshots[i].vector);
      const b = vectorToRecord(snapshots[j].vector);

      let dot = 0, magA = 0, magB = 0, eucSq = 0;
      const divergentAxes: ChatPlayerModelAxis[] = [];
      for (const ax of AXES) {
        const av = a[ax] ?? 0.5;
        const bv = b[ax] ?? 0.5;
        dot += av * bv;
        magA += av * av;
        magB += bv * bv;
        const diff = av - bv;
        eucSq += diff * diff;
        if (Math.abs(diff) > 0.3) divergentAxes.push(ax);
      }
      const cosineSimilarity = (magA > 0 && magB > 0) ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
      const euclideanDistance = Math.sqrt(eucSq);

      const entry: PlayerModelComparisonEntry = Object.freeze({
        playerIdA: snapshots[i].playerId,
        playerIdB: snapshots[j].playerId,
        cosineSimilarity,
        euclideanDistance,
        divergentAxes: Object.freeze(divergentAxes),
      });
      entries.push(entry);

      if (!mostSimilar || cosineSimilarity > mostSimilar.cosineSimilarity) mostSimilar = entry;
      if (!mostDivergent || euclideanDistance > mostDivergent.euclideanDistance) mostDivergent = entry;
    }
  }

  return Object.freeze({
    entries: Object.freeze(entries),
    mostSimilarPair: mostSimilar ? Object.freeze({ playerIdA: mostSimilar.playerIdA, playerIdB: mostSimilar.playerIdB, similarity: mostSimilar.cosineSimilarity }) : null,
    mostDivergentPair: mostDivergent ? Object.freeze({ playerIdA: mostDivergent.playerIdA, playerIdB: mostDivergent.playerIdB, distance: mostDivergent.euclideanDistance }) : null,
    generatedAt: Date.now(),
  });
}

// ============================================================================
// PLAYER MODEL WATCH BUS
// ============================================================================

export type PlayerModelWatchEventKind = 'VECTOR_UPDATED' | 'ARCHETYPE_CHANGED' | 'DRIFT_DETECTED' | 'EVIDENCE_ADDED' | 'SNAPSHOT_TAKEN';

export interface PlayerModelWatchEvent {
  readonly kind: PlayerModelWatchEventKind;
  readonly playerId: string;
  readonly detail: string;
  readonly occurredAt: number;
}

export class PlayerModelWatchBus {
  private readonly handlers: Array<(evt: PlayerModelWatchEvent) => void> = [];

  subscribe(handler: (evt: PlayerModelWatchEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) this.handlers.splice(idx, 1);
    };
  }

  emit(evt: PlayerModelWatchEvent): void {
    for (const h of this.handlers) {
      try { h(evt); } catch { /* noop */ }
    }
  }

  emitVectorUpdate(playerId: string, axisChanged: string): void {
    this.emit({ kind: 'VECTOR_UPDATED', playerId, detail: `axis=${axisChanged}`, occurredAt: Date.now() });
  }

  emitArchetypeChange(playerId: string, oldArchetype: string, newArchetype: string): void {
    this.emit({ kind: 'ARCHETYPE_CHANGED', playerId, detail: `${oldArchetype}->${newArchetype}`, occurredAt: Date.now() });
  }

  emitDrift(playerId: string, driftScore: number): void {
    this.emit({ kind: 'DRIFT_DETECTED', playerId, detail: `driftScore=${driftScore.toFixed(4)}`, occurredAt: Date.now() });
  }

  emitEvidenceAdded(playerId: string, axis: ChatPlayerModelAxis): void {
    this.emit({ kind: 'EVIDENCE_ADDED', playerId, detail: `axis=${axis}`, occurredAt: Date.now() });
  }

  emitSnapshotTaken(playerId: string): void {
    this.emit({ kind: 'SNAPSHOT_TAKEN', playerId, detail: 'snapshot recorded', occurredAt: Date.now() });
  }
}

// ============================================================================
// PLAYER MODEL REPLAY ITERATOR
// ============================================================================

export class PlayerModelEvidenceReplayIterator {
  private cursor = 0;
  constructor(private readonly evidence: readonly ChatPlayerModelEvidence[]) {}

  hasNext(): boolean { return this.cursor < this.evidence.length; }

  next(): ChatPlayerModelEvidence | null {
    if (!this.hasNext()) return null;
    return this.evidence[this.cursor++];
  }

  peek(): ChatPlayerModelEvidence | null {
    if (!this.hasNext()) return null;
    return this.evidence[this.cursor];
  }

  reset(): void { this.cursor = 0; }

  remaining(): number { return this.evidence.length - this.cursor; }

  sliceFrom(startMs: number): readonly ChatPlayerModelEvidence[] {
    return this.evidence.filter((e) => e.createdAt >= startMs);
  }

  sliceBetween(startMs: number, endMs: number): readonly ChatPlayerModelEvidence[] {
    return this.evidence.filter((e) => e.createdAt >= startMs && e.createdAt <= endMs);
  }
}

// ============================================================================
// PLAYER MODEL AGGREGATE REPORT
// ============================================================================

export interface PlayerModelAggregateReport {
  readonly totalPlayers: number;
  readonly avgDriftScore: number;
  readonly archetypeDistribution: Record<string, number>;
  readonly axisHighActivation: Record<string, number>;
  readonly generatedAt: number;
}

export function buildPlayerModelAggregateReport(
  snapshots: readonly ChatPlayerModelSnapshot[],
): PlayerModelAggregateReport {
  const AXES: ChatPlayerModelAxis[] = [
    'IMPULSIVE', 'PATIENT', 'GREEDY', 'DEFENSIVE', 'PUBLIC_PERFORMER',
    'PROCEDURE_AWARE', 'STABILITY_SEEKING', 'BLUFF_HEAVY', 'LITERAL', 'SILENT_OPERATOR',
    'COMEBACK_PRONE', 'COLLAPSE_PRONE', 'CARELESS', 'NOVELTY_SEEKING', 'RESCUE_RELIANT',
  ];
  const archetypeDist: Record<string, number> = {};
  const axisHighCount: Record<string, number> = {};
  let totalDrift = 0;

  for (const snap of snapshots) {
    const v = vectorToRecord(snap.vector);
    const keys = Object.keys(v);
    let drift = 0;
    for (const ax of AXES) {
      const val = v[ax] ?? 0.5;
      drift += Math.abs(val - 0.5);
      if (val > 0.7) axisHighCount[ax] = (axisHighCount[ax] ?? 0) + 1;
    }
    totalDrift += drift / (keys.length || 1);

    // Infer archetype from vector for aggregate report
    const dominant = AXES.reduce((best, ax) => {
      return v[ax] > (v[best] ?? 0) ? ax : best;
    }, AXES[0]);
    archetypeDist[dominant] = (archetypeDist[dominant] ?? 0) + 1;
  }

  return Object.freeze({
    totalPlayers: snapshots.length,
    avgDriftScore: snapshots.length > 0 ? totalDrift / snapshots.length : 0,
    archetypeDistribution: archetypeDist,
    axisHighActivation: axisHighCount,
    generatedAt: Date.now(),
  });
}

// ============================================================================
// PLAYER MODEL SNAPSHOT CHAIN VALIDATOR
// ============================================================================

export interface SnapshotChainValidationResult {
  readonly playerId: string;
  readonly isValid: boolean;
  readonly chainLength: number;
  readonly gapCount: number;
  readonly maxGapMs: number;
  readonly issues: readonly string[];
}

export function validateSnapshotChain(
  playerId: string,
  snapshots: readonly ChatPlayerModelSnapshot[],
): SnapshotChainValidationResult {
  const issues: string[] = [];
  if (snapshots.length === 0) {
    return Object.freeze({ playerId, isValid: true, chainLength: 0, gapCount: 0, maxGapMs: 0, issues: Object.freeze([]) });
  }

  const sorted = [...snapshots].sort((a, b) => a.updatedAt - b.updatedAt);
  let maxGap = 0;
  let gapCount = 0;
  const GAP_THRESHOLD_MS = 3_600_000; // 1 hour

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].updatedAt - sorted[i - 1].updatedAt;
    if (gap > GAP_THRESHOLD_MS) {
      gapCount++;
      if (gap > maxGap) maxGap = gap;
      issues.push(`Gap of ${Math.round(gap / 60000)}m between snapshots at ${sorted[i - 1].updatedAt} and ${sorted[i].updatedAt}`);
    }
    // Check no two snapshots have identical capturedAt
    if (sorted[i].updatedAt === sorted[i - 1].updatedAt) {
      issues.push(`Duplicate capturedAt timestamp: ${sorted[i].updatedAt}`);
    }
    // Validate vector values are within bounds
    const v = vectorToRecord(sorted[i].vector);
    for (const [k, val] of Object.entries(v)) {
      if (val < 0 || val > 1) issues.push(`Vector axis ${k} out of bounds: ${val} at snapshot ${i}`);
    }
  }

  return Object.freeze({
    playerId,
    isValid: issues.length === 0,
    chainLength: snapshots.length,
    gapCount,
    maxGapMs: maxGap,
    issues: Object.freeze(issues),
  });
}

// ============================================================================
// PLAYER MODEL BATCH EXPORT / IMPORT
// ============================================================================

export interface PlayerModelBatchExport {
  readonly exportedAt: number;
  readonly version: number;
  readonly snapshots: readonly ChatPlayerModelSnapshot[];
  readonly evidenceTails: readonly { readonly playerId: string; readonly evidence: readonly ChatPlayerModelEvidence[] }[];
}

export function exportPlayerModelBatch(
  allBuckets: Map<string, { snapshot: ChatPlayerModelSnapshot }>,
  allEvidence: Map<string, ChatPlayerModelEvidence[]>,
): PlayerModelBatchExport {
  const snapshots: ChatPlayerModelSnapshot[] = [];
  const evidenceTails: { playerId: string; evidence: ChatPlayerModelEvidence[] }[] = [];
  for (const [playerId, bucket] of allBuckets) {
    snapshots.push(bucket.snapshot);
    evidenceTails.push({ playerId, evidence: allEvidence.get(playerId) ?? [] });
  }
  return Object.freeze({ exportedAt: Date.now(), version: 2, snapshots: Object.freeze(snapshots), evidenceTails: Object.freeze(evidenceTails) });
}

export function importPlayerModelBatch(
  batch: PlayerModelBatchExport,
  allBuckets: Map<string, { snapshot: ChatPlayerModelSnapshot }>,
  allEvidence: Map<string, ChatPlayerModelEvidence[]>,
): void {
  for (const snap of batch.snapshots) {
    allBuckets.set(snap.playerId, { snapshot: snap });
  }
  for (const tail of batch.evidenceTails) {
    allEvidence.set(tail.playerId, [...tail.evidence]);
  }
}

// ============================================================================
// PLAYER MODEL PRESSURE SCORER
// ============================================================================

export interface PlayerModelPressureScore {
  readonly playerId: string;
  readonly pressureScore: number;
  readonly pressureBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  readonly topContributors: readonly { readonly axis: ChatPlayerModelAxis; readonly contribution: number }[];
  readonly generatedAt: number;
}

export function scorePlayerModelPressure(snapshot: ChatPlayerModelSnapshot): PlayerModelPressureScore {
  const v = vectorToRecord(snapshot.vector);
  const PRESSURE_AXES: ChatPlayerModelAxis[] = [
    'GREEDY', 'BLUFF_HEAVY', 'IMPULSIVE', 'RESCUE_RELIANT', 'CARELESS',
  ];
  const contributors: { axis: ChatPlayerModelAxis; contribution: number }[] = [];
  let total = 0;
  for (const ax of PRESSURE_AXES) {
    const val = v[ax] ?? 0.5;
    const contribution = clamp01((val - 0.5) * 2);
    total += contribution;
    contributors.push({ axis: ax, contribution });
  }
  const pressureScore = clamp01(total / PRESSURE_AXES.length);
  contributors.sort((a, b) => b.contribution - a.contribution);

  const band: PlayerModelPressureScore['pressureBand'] =
    pressureScore >= 0.85 ? 'EXTREME'
    : pressureScore >= 0.65 ? 'HIGH'
    : pressureScore >= 0.4 ? 'MEDIUM'
    : 'LOW';

  return Object.freeze({
    playerId: snapshot.playerId,
    pressureScore,
    pressureBand: band,
    topContributors: Object.freeze(contributors.slice(0, 3)),
    generatedAt: Date.now(),
  });
}

// ============================================================================
// EXTENDED SERVICE CLASS
// ============================================================================

export class ChatPlayerModelServiceExtended extends ChatPlayerModelService {
  private readonly watchBus = new PlayerModelWatchBus();
  private readonly fingerprintCache = new Map<string, PlayerModelFingerprint>();

  getWatchBus(): PlayerModelWatchBus { return this.watchBus; }

  applyEvidenceWithWatch(
    playerId: string,
    evidence: readonly ChatPlayerModelEvidence[],
  ): void {
    const prevSnapshot = this.getSnapshot(playerId);
    this.ingestBulk(playerId, evidence);
    const nextSnapshot = this.getSnapshot(playerId);
    if (prevSnapshot && nextSnapshot) {
      const prevV = vectorToRecord(prevSnapshot.vector);
      const nextV = vectorToRecord(nextSnapshot.vector);
      const AXES = Object.keys(prevV) as ChatPlayerModelAxis[];
      for (const ax of AXES) {
        if (Math.abs((nextV[ax] ?? 0) - (prevV[ax] ?? 0)) > 0.01) {
          this.watchBus.emitVectorUpdate(playerId, ax);
        }
      }
    }
    for (const ev of evidence) {
      for (const ax of ev.axes) {
        this.watchBus.emitEvidenceAdded(playerId, ax);
      }
    }
  }

  getCachedFingerprint(playerId: string): PlayerModelFingerprint | null {
    return this.fingerprintCache.get(playerId) ?? null;
  }

  refreshFingerprint(playerId: string): PlayerModelFingerprint | null {
    const snap = this.getSnapshot(playerId);
    if (!snap) return null;
    const fp = computePlayerModelFingerprint(snap);
    this.fingerprintCache.set(playerId, fp);
    return fp;
  }

  buildPressureReport(playerId: string): PlayerModelPressureScore | null {
    const snap = this.getSnapshot(playerId);
    if (!snap) return null;
    return scorePlayerModelPressure(snap);
  }
}

// ============================================================================
// PLAYER MODEL STALE DETECTOR
// ============================================================================

export interface StalePlayerModelEntry {
  readonly playerId: string;
  readonly lastUpdatedAt: number;
  readonly staleAgeMs: number;
  readonly staleBand: 'FRESH' | 'AGING' | 'STALE' | 'DEAD';
}

export interface StalePlayerModelReport {
  readonly entries: readonly StalePlayerModelEntry[];
  readonly staleCount: number;
  readonly deadCount: number;
  readonly generatedAt: number;
}

export function detectStalePlayerModels(
  snapshots: readonly ChatPlayerModelSnapshot[],
  nowMs: number = Date.now(),
  staleThresholdMs: number = 24 * 3_600_000,
  deadThresholdMs: number = 72 * 3_600_000,
): StalePlayerModelReport {
  const entries: StalePlayerModelEntry[] = snapshots.map((snap) => {
    const age = nowMs - snap.updatedAt;
    const band: StalePlayerModelEntry['staleBand'] =
      age >= deadThresholdMs ? 'DEAD'
      : age >= staleThresholdMs ? 'STALE'
      : age >= staleThresholdMs / 3 ? 'AGING'
      : 'FRESH';
    return Object.freeze({ playerId: snap.playerId, lastUpdatedAt: snap.updatedAt, staleAgeMs: age, staleBand: band });
  });
  const staleCount = entries.filter((e) => e.staleBand === 'STALE').length;
  const deadCount = entries.filter((e) => e.staleBand === 'DEAD').length;
  return Object.freeze({ entries: Object.freeze(entries), staleCount, deadCount, generatedAt: nowMs });
}

// ============================================================================
// PLAYER MODEL AXIS CORRELATION
// ============================================================================

export interface AxisCorrelationEntry {
  readonly axisA: ChatPlayerModelAxis;
  readonly axisB: ChatPlayerModelAxis;
  readonly pearsonR: number;
  readonly strength: 'STRONG_POSITIVE' | 'MODERATE_POSITIVE' | 'WEAK' | 'MODERATE_NEGATIVE' | 'STRONG_NEGATIVE';
}

export function computeAxisCorrelations(
  snapshots: readonly ChatPlayerModelSnapshot[],
): readonly AxisCorrelationEntry[] {
  const AXES: ChatPlayerModelAxis[] = [
    'IMPULSIVE', 'PATIENT', 'GREEDY', 'DEFENSIVE', 'PUBLIC_PERFORMER',
    'PROCEDURE_AWARE', 'STABILITY_SEEKING', 'BLUFF_HEAVY', 'LITERAL', 'SILENT_OPERATOR',
    'COMEBACK_PRONE', 'COLLAPSE_PRONE', 'CARELESS', 'NOVELTY_SEEKING', 'RESCUE_RELIANT',
  ];
  const n = snapshots.length;
  if (n < 2) return Object.freeze([]);

  const vals: Record<string, number[]> = {};
  for (const ax of AXES) vals[ax] = [];
  for (const snap of snapshots) {
    const v = vectorToRecord(snap.vector);
    for (const ax of AXES) vals[ax].push(v[ax] ?? 0.5);
  }

  const means: Record<string, number> = {};
  for (const ax of AXES) means[ax] = vals[ax].reduce((s, x) => s + x, 0) / n;

  const results: AxisCorrelationEntry[] = [];
  for (let i = 0; i < AXES.length; i++) {
    for (let j = i + 1; j < AXES.length; j++) {
      const axA = AXES[i];
      const axB = AXES[j];
      let num = 0, denA = 0, denB = 0;
      for (let k = 0; k < n; k++) {
        const da = vals[axA][k] - means[axA];
        const db = vals[axB][k] - means[axB];
        num += da * db;
        denA += da * da;
        denB += db * db;
      }
      const pearsonR = (denA > 0 && denB > 0) ? num / Math.sqrt(denA * denB) : 0;
      const strength: AxisCorrelationEntry['strength'] =
        pearsonR >= 0.7 ? 'STRONG_POSITIVE'
        : pearsonR >= 0.3 ? 'MODERATE_POSITIVE'
        : pearsonR <= -0.7 ? 'STRONG_NEGATIVE'
        : pearsonR <= -0.3 ? 'MODERATE_NEGATIVE'
        : 'WEAK';
      results.push(Object.freeze({ axisA: axA, axisB: axB, pearsonR, strength }));
    }
  }
  results.sort((a, b) => Math.abs(b.pearsonR) - Math.abs(a.pearsonR));
  return Object.freeze(results);
}

// ============================================================================
// PLAYER MODEL DECAY CURVE
// ============================================================================

export interface DecayCurveConfig {
  readonly halfLifeMs: number;
  readonly floor: number;
  readonly ceiling: number;
}

export const DEFAULT_PLAYER_MODEL_DECAY_CURVE: DecayCurveConfig = Object.freeze({
  halfLifeMs: 48 * 3_600_000,
  floor: 0.3,
  ceiling: 1.0,
});

export function computeDecayMultiplier(
  elapsedMs: number,
  config: DecayCurveConfig = DEFAULT_PLAYER_MODEL_DECAY_CURVE,
): number {
  const halfLifes = elapsedMs / config.halfLifeMs;
  const rawDecay = Math.pow(0.5, halfLifes);
  return Math.max(config.floor, Math.min(config.ceiling, rawDecay));
}

export function applyDecayCurveToVector(
  vector: ChatPlayerModelVector,
  elapsedMs: number,
  config: DecayCurveConfig = DEFAULT_PLAYER_MODEL_DECAY_CURVE,
): ChatPlayerModelVector {
  const multiplier = computeDecayMultiplier(elapsedMs, config);
  const v = vectorToRecord(vector);
  const decayed: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    // Decay towards 0.5 (neutral)
    decayed[k] = clamp01(0.5 + (val - 0.5) * multiplier);
  }
  return decayed as unknown as ChatPlayerModelVector;
}

// ============================================================================
// PLAYER MODEL EVENT TYPE FREQUENCY
// ============================================================================

export interface EvidenceTypeFrequency {
  readonly playerId: string;
  readonly axisFrequency: Record<string, number>;
  readonly sourceFrequency: Record<string, number>;
  readonly totalEvidence: number;
  readonly mostActiveAxis: ChatPlayerModelAxis | null;
  readonly mostActiveSource: string | null;
  readonly generatedAt: number;
}

export function buildEvidenceTypeFrequency(
  playerId: string,
  evidence: readonly ChatPlayerModelEvidence[],
): EvidenceTypeFrequency {
  const axisFreq: Record<string, number> = {};
  const sourceFreq: Record<string, number> = {};

  for (const ev of evidence) {
    for (const ax of ev.axes) { axisFreq[ax] = (axisFreq[ax] ?? 0) + 1; }
    const src = ev.source ?? 'UNKNOWN';
    sourceFreq[src] = (sourceFreq[src] ?? 0) + 1;
  }

  let mostActiveAxis: ChatPlayerModelAxis | null = null;
  let maxAxisCount = 0;
  for (const [k, cnt] of Object.entries(axisFreq)) {
    if (cnt > maxAxisCount) { maxAxisCount = cnt; mostActiveAxis = k as ChatPlayerModelAxis; }
  }

  let mostActiveSource: string | null = null;
  let maxSrcCount = 0;
  for (const [k, cnt] of Object.entries(sourceFreq)) {
    if (cnt > maxSrcCount) { maxSrcCount = cnt; mostActiveSource = k; }
  }

  return Object.freeze({ playerId, axisFrequency: axisFreq, sourceFrequency: sourceFreq, totalEvidence: evidence.length, mostActiveAxis, mostActiveSource, generatedAt: Date.now() });
}

// ============================================================================
// PLAYER MODEL VECTOR INTERPOLATOR
// ============================================================================

export function interpolatePlayerModelVectors(
  vectorA: ChatPlayerModelVector,
  vectorB: ChatPlayerModelVector,
  t: number,
): ChatPlayerModelVector {
  const clamped = Math.max(0, Math.min(1, t));
  const a = vectorToRecord(vectorA);
  const b = vectorToRecord(vectorB);
  const result: Record<string, number> = {};
  for (const k of Object.keys(a)) {
    result[k] = clamp01((a[k] ?? 0.5) * (1 - clamped) + (b[k] ?? 0.5) * clamped);
  }
  return result as unknown as ChatPlayerModelVector;
}

// ============================================================================
// PLAYER MODEL REBASE UTILITY
// ============================================================================

export interface PlayerModelRebaseResult {
  readonly playerId: string;
  readonly originalVector: ChatPlayerModelVector;
  readonly rebasedVector: ChatPlayerModelVector;
  readonly axesChanged: number;
  readonly rebasedAt: number;
}

export function rebasePlayerModelVector(
  playerId: string,
  snapshot: ChatPlayerModelSnapshot,
  referenceVector: ChatPlayerModelVector,
  blendWeight: number = 0.2,
): PlayerModelRebaseResult {
  const blended = interpolatePlayerModelVectors(snapshot.vector, referenceVector, blendWeight);
  const origRecord = vectorToRecord(snapshot.vector);
  const blendRecord = vectorToRecord(blended);
  let changed = 0;
  for (const k of Object.keys(origRecord)) {
    if (Math.abs((origRecord[k] ?? 0) - (blendRecord[k] ?? 0)) > 0.001) changed++;
  }
  return Object.freeze({ playerId, originalVector: snapshot.vector, rebasedVector: blended, axesChanged: changed, rebasedAt: Date.now() });
}

// ============================================================================
// PLAYER MODEL STANCE PREDICTOR
// ============================================================================

export type PredictedPlayerStance = 'AGGRESSIVE' | 'PASSIVE' | 'ANALYTICAL' | 'DECEPTIVE' | 'LOYAL' | 'VOLATILE' | 'NEUTRAL';

export interface PlayerStancePrediction {
  readonly playerId: string;
  readonly predictedStance: PredictedPlayerStance;
  readonly confidence: number;
  readonly dominantFactors: readonly string[];
  readonly predictedAt: number;
}

export function predictPlayerStance(snapshot: ChatPlayerModelSnapshot): PlayerStancePrediction {
  const v = vectorToRecord(snapshot.vector);
  const scores: Record<PredictedPlayerStance, number> = {
    AGGRESSIVE: (v['aggressive01'] ?? 0.5) * 0.5 + (v['hostile01'] ?? 0.5) * 0.3 + (v['escalationTendency01'] ?? 0.5) * 0.2,
    PASSIVE: (v['deflective01'] ?? 0.5) * 0.4 + (v['sycophantic01'] ?? 0.5) * 0.3 + (1 - (v['aggressive01'] ?? 0.5)) * 0.3,
    ANALYTICAL: (v['analytical01'] ?? 0.5) * 0.6 + (v['patient01'] ?? 0.5) * 0.4,
    DECEPTIVE: (v['deceptionSignal01'] ?? 0.5) * 0.5 + (v['conspiratorial01'] ?? 0.5) * 0.3 + (v['deflective01'] ?? 0.5) * 0.2,
    LOYAL: (v['loyaltySignal01'] ?? 0.5) * 0.6 + (v['patient01'] ?? 0.5) * 0.2 + (1 - (v['deceptionSignal01'] ?? 0.5)) * 0.2,
    VOLATILE: (v['impulsive01'] ?? 0.5) * 0.5 + (v['escalationTendency01'] ?? 0.5) * 0.3 + (1 - (v['emotionallyFlat01'] ?? 0.5)) * 0.2,
    NEUTRAL: 0.3,
  };

  let best: PredictedPlayerStance = 'NEUTRAL';
  let bestScore = 0;
  for (const [stance, score] of Object.entries(scores) as [PredictedPlayerStance, number][]) {
    if (score > bestScore) { bestScore = score; best = stance; }
  }

  const dominantFactors: string[] = [];
  if ((v['aggressive01'] ?? 0) > 0.65) dominantFactors.push('high_aggression');
  if ((v['deceptionSignal01'] ?? 0) > 0.65) dominantFactors.push('high_deception');
  if ((v['analytical01'] ?? 0) > 0.7) dominantFactors.push('strong_analytical');
  if ((v['impulsive01'] ?? 0) > 0.7) dominantFactors.push('high_impulsivity');
  if ((v['loyaltySignal01'] ?? 0) > 0.7) dominantFactors.push('strong_loyalty');

  return Object.freeze({
    playerId: snapshot.playerId,
    predictedStance: best,
    confidence: clamp01(bestScore),
    dominantFactors: Object.freeze(dominantFactors),
    predictedAt: Date.now(),
  });
}

// ============================================================================
// PLAYER MODEL LAW VALIDATION
// ============================================================================

export interface PlayerModelLawValidationResult {
  readonly playerId: string;
  readonly passed: boolean;
  readonly violations: readonly string[];
  readonly validatedAt: number;
}

export function validatePlayerModelLaws(snapshot: ChatPlayerModelSnapshot): PlayerModelLawValidationResult {
  const violations: string[] = [];
  const v = vectorToRecord(snapshot.vector);

  // Law: all axis values must be in [0, 1]
  for (const [k, val] of Object.entries(v)) {
    if (val < 0 || val > 1) violations.push(`Axis ${k} out of range: ${val}`);
  }

  // Law: playerId must be non-empty
  if (!snapshot.playerId || snapshot.playerId.trim().length === 0) violations.push('playerId is empty');

  // Law: updatedAt must be positive
  if (snapshot.updatedAt <= 0) violations.push(`updatedAt is invalid: ${snapshot.updatedAt}`);

  // Law: updatedAt should not be in the future (more than 5s tolerance)
  if (snapshot.updatedAt > Date.now() + 5000) violations.push('updatedAt is in the future');

  return Object.freeze({ playerId: snapshot.playerId, passed: violations.length === 0, violations: Object.freeze(violations), validatedAt: Date.now() });
}

export function createPlayerModelWatchBus(): PlayerModelWatchBus {
  return new PlayerModelWatchBus();
}

export function createPlayerModelEvidenceReplayIterator(
  evidence: readonly ChatPlayerModelEvidence[],
): PlayerModelEvidenceReplayIterator {
  return new PlayerModelEvidenceReplayIterator(evidence);
}

export const ChatPlayerModelServiceModule = Object.freeze({
  name: CHAT_PLAYER_MODEL_MODULE_NAME,
  version: CHAT_PLAYER_MODEL_MODULE_VERSION,
  laws: CHAT_PLAYER_MODEL_LAWS,
  descriptor: CHAT_PLAYER_MODEL_MODULE_DESCRIPTOR,
  axisCount: 15,
  DEFAULT_CHAT_PLAYER_MODEL_SERVICE_CONFIG,
  CHAT_PLAYER_MODEL_AXIS_POLARITIES,
  AXIS_SENSITIVITY_MATRIX,
  DEFAULT_PLAYER_MODEL_DECAY_CURVE,
  ChatPlayerModelService,
  ChatPlayerModelServiceExtended,
  PlayerModelWatchBus,
  PlayerModelEvidenceReplayIterator,
  createChatPlayerModelService,
  createPlayerModelWatchBus,
  createPlayerModelEvidenceReplayIterator,
  now,
  clampPlayerModelValue,
  emptyVector,
  dominantAxes,
  axisToVectorKey,
  decayVector,
  detectPolarDominance,
  buildRiskProfile,
  computeVectorDelta,
  computeModelDrift,
  computeSimilarityScore,
  buildCohortSummary,
  computeConfidenceScore,
  vectorToRecord,
  buildTranscriptEvidence,
  buildMemoryEvidence,
  buildSceneEvidence,
  axisLabel,
  snapshotFingerprint,
  snapshotsHaveDiverged,
  vectorNorm,
  sortSnapshotsByRisk,
  groupSnapshotsByDominantAxis,
  computeActionPressure01,
  computeVolatility01,
  interpolateVectors,
  getAxisSensitivity,
  assignBehavioralArchetype,
  deduplicateEvidence,
  buildAxisHeatMap,
  computeAxisTrajectories,
  captureSnapshotDeltaEntry,
  inferRelationshipDynamic,
  computePlayerModelFingerprint,
  buildAxisSensitivityMap,
  buildPlayerModelEpoch,
  buildPlayerModelComparisonMatrix,
  buildPlayerModelAggregateReport,
  validateSnapshotChain,
  exportPlayerModelBatch,
  importPlayerModelBatch,
  scorePlayerModelPressure,
  detectStalePlayerModels,
  computeAxisCorrelations,
  computeDecayMultiplier,
  applyDecayCurveToVector,
  buildEvidenceTypeFrequency,
  interpolatePlayerModelVectors,
  rebasePlayerModelVector,
  predictPlayerStance,
  validatePlayerModelLaws,
} as const);
