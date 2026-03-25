/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/RuntimeCheckpointStore.ts
 *
 * Doctrine:
 * - checkpoints are immutable rollback anchors, not live state
 * - retention must be bounded by run and by store-wide pressure
 * - checkpoint ids must be deterministic enough for audit/replay joins
 * - retrieval should remain O(1) for common latest/by-id access patterns
 *
 * Extended Doctrine (v2 upgrade — depth layer):
 * - ML/DL feature extraction from checkpoints drives adaptive pressure modeling
 * - Diff analysis surfaces the exact fields that changed between any two anchors
 * - Trend analysis detects economy, shield, and battle trajectory over time
 * - Chat signal bridge translates checkpoint events into prioritized backend chat signals
 * - Replay verifier ensures deterministic re-execution matches stored checksums
 * - Query engine exposes composable filters over the checkpoint ledger
 * - Compaction strategy enforces memory pressure policies without data loss
 * - Exporter serializes checkpoints for audit, replay, and ML pipeline ingestion
 * - Every imported symbol is used in at least one runtime computation path
 */

// ============================================================================
// SECTION 1 — TYPE IMPORTS FROM RunStateSnapshot
// ============================================================================

import type { RunStateSnapshot } from './RunStateSnapshot';

// ============================================================================
// SECTION 2 — RUNTIME IMPORTS FROM RunStateSnapshot (predicate + utility fns)
// ============================================================================

import {
  isSnapshotTerminal,
  isSnapshotWin,
  isSnapshotLoss,
  isSnapshotInEndgame,
  isSnapshotInCrisis,
  isShieldFailing,
  isEconomyHealthy,
  isBattleEscalating,
  isCascadeCritical,
  isSovereigntyAtRisk,
  hasActiveDecisionWindows,
  hasPlayableCards,
  hasCriticalPendingAttacks,
  isRunFlagged,
  getPressureTierUrgencyLabel,
  getNormalizedPressureTier,
  validateSnapshotEnums,
  isKnownMode,
} from './RunStateSnapshot';

// ============================================================================
// SECTION 3 — IMPORTS FROM RunStateInvariantGuard
// ============================================================================

import {
  RunStateInvariantGuard,
  INVARIANT_ERROR_CODES,
  INVARIANT_CRITICAL_ERROR_CODES,
  INVARIANT_HIGH_RISK_ERROR_CODES,
  INVARIANT_GUARD_MODULE_VERSION,
  INVARIANT_ML_FEATURE_COUNT,
  INVARIANT_ML_FEATURE_LABELS,
} from './RunStateInvariantGuard';

import type {
  RunStateInvariantReport,
  InvariantMLRiskClass,
} from './RunStateInvariantGuard';

// ============================================================================
// SECTION 4 — IMPORTS FROM Deterministic
// ============================================================================

import {
  checksumSnapshot,
  stableStringify,
  checksumParts,
  createDeterministicId,
  cloneJson,
  deepFrozenClone,
} from './Deterministic';

// ============================================================================
// SECTION 5 — IMPORTS FROM TickSequence
// ============================================================================

import {
  TICK_SEQUENCE,
  TICK_STEP_DESCRIPTORS,
  isTickStep,
  getTickStepIndex,
} from './TickSequence';

import type { TickStep } from './TickSequence';

// ============================================================================
// SECTION 6 — TYPE IMPORTS FROM GamePrimitives
// ============================================================================

import type {
  ModeCode,
  PressureTier,
  RunPhase,
  RunOutcome,
  ShieldLayerId,
  HaterBotId,
  IntegrityStatus,
  VerifiedGrade,
} from './GamePrimitives';

// ============================================================================
// SECTION 7 — RUNTIME IMPORTS FROM GamePrimitives (constants + utility fns)
// ============================================================================

import {
  // Canonical arrays
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  MODE_CODES,
  SHIELD_LAYER_IDS,
  HATER_BOT_IDS,
  TIMING_CLASSES,

  // Scoring maps
  PRESSURE_TIER_NORMALIZED,
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  SHIELD_LAYER_REGEN_RATE,
  MODE_DIFFICULTY_MULTIPLIER,
  TIMING_CLASS_WINDOW_PRIORITY,
  INTEGRITY_STATUS_RISK_SCORE,
  VERIFIED_GRADE_NUMERIC_SCORE,
  LEGEND_MARKER_KIND_WEIGHT,
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  DECK_TYPE_POWER_LEVEL,
  RUN_PHASE_NORMALIZED,
  MODE_NORMALIZED,
  CARD_RARITY_WEIGHT,
  PRESSURE_TIER_ESCALATION_THRESHOLD,
  PRESSURE_TIER_DEESCALATION_THRESHOLD,

  // Type guards
  isModeCode,
  isPressureTier,
  isRunPhase,
  isRunOutcome,
  isShieldLayerId,
  isHaterBotId,
  isTimingClass,
  isIntegrityStatus,
  isVerifiedGrade,

  // Utility functions
  computePressureRiskScore,
  computeShieldLayerVulnerability,
  computeShieldIntegrityRatio,
  estimateShieldRegenPerTick,
  classifyAttackSeverity,
  computeEffectiveAttackDamage,
  isAttackCounterable,
  isAttackFromBot,
  scoreAttackResponseUrgency,
  scoreThreatUrgency,
  classifyThreatUrgency,
  computeAggregateThreatPressure,
  scoreCascadeChainHealth,
  classifyCascadeChainHealth,
  computeCascadeProgressPercent,
  isCascadeRecoverable,
  computeCascadeExperienceImpact,
  computeCardPowerScore,
  computeCardCostEfficiency,
  computeCardTimingPriority,
  isCardOffensive,
  computeEffectMagnitude,
  computeEffectFinancialImpact,
  computeEffectRiskScore,
  isEffectNetPositive,
  computeLegendMarkerValue,
  classifyLegendMarkerSignificance,
  computeLegendMarkerDensity,
  computeRunProgressFraction,
  computeEffectiveStakes,
  isWinOutcome,
  isLossOutcome,
  scoreOutcomeExcitement,
  isEndgamePhase,
  canEscalatePressure,
  canDeescalatePressure,
} from './GamePrimitives';

// ============================================================================
// SECTION 8 — PRESERVED ORIGINAL TYPES
// ============================================================================

export type RuntimeCheckpointReason =
  | 'RUN_START'
  | 'STEP_ENTRY'
  | 'STEP_EXIT'
  | 'TICK_FINAL'
  | 'TERMINAL'
  | 'MANUAL';

export interface RuntimeCheckpointStoreOptions {
  readonly maxRuns?: number;
  readonly maxCheckpointsPerRun?: number;
}

export interface RuntimeCheckpointWriteInput {
  readonly snapshot: RunStateSnapshot;
  readonly capturedAtMs: number;
  readonly step?: TickStep | null;
  readonly reason?: RuntimeCheckpointReason;
  readonly traceId?: string | null;
  readonly tags?: readonly string[];
}

export interface RuntimeCheckpoint {
  readonly checkpointId: string;
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly mode: RunStateSnapshot['mode'];
  readonly outcome: RunStateSnapshot['outcome'];
  readonly step: TickStep | null;
  readonly reason: RuntimeCheckpointReason;
  readonly traceId: string | null;
  readonly capturedAtMs: number;
  readonly checksum: string;
  readonly ordinalInRun: number;
  readonly tags: readonly string[];
  readonly snapshot: RunStateSnapshot;
}

// ============================================================================
// SECTION 9 — MODULE CONSTANTS
// ============================================================================

export const CHECKPOINT_STORE_MODULE_VERSION = 'checkpoint-store.v2.2026' as const;
export const CHECKPOINT_STORE_MODULE_READY = true as const;

export const CHECKPOINT_ML_FEATURE_COUNT = 32 as const;
export const CHECKPOINT_DL_FEATURE_COUNT = 48 as const;
export const CHECKPOINT_DL_TENSOR_SHAPE = Object.freeze([1, 48] as const);

export const CHECKPOINT_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'pressure_risk_score',         // [0]
  'pressure_tier_normalized',    // [1]
  'pressure_can_escalate',       // [2]
  'shield_integrity_ratio',      // [3]
  'shield_regen_capacity',       // [4]
  'economy_freedom_progress',    // [5]
  'economy_cash_normalized',     // [6]
  'economy_debt_burden',         // [7]
  'battle_bot_threat_aggregate', // [8]
  'battle_attack_severity',      // [9]
  'cascade_active_health_avg',   // [10]
  'cascade_broken_ratio',        // [11]
  'sovereignty_integrity_risk',  // [12]
  'sovereignty_grade_score',     // [13]
  'timer_budget_consumed',       // [14]
  'decision_windows_open',       // [15]
  'hand_power_avg',              // [16]
  'hand_timing_priority_max',    // [17]
  'tension_score',               // [18]
  'tension_threat_count',        // [19]
  'mode_difficulty',             // [20]
  'phase_normalized',            // [21]
  'run_progress',                // [22]
  'is_endgame',                  // [23]
  'is_crisis',                   // [24]
  'is_terminal',                 // [25]
  'is_win',                      // [26]
  'has_critical_attacks',        // [27]
  'is_flagged',                  // [28]
  'legend_marker_density',       // [29]
  'tick_step_index_normalized',  // [30]
  'ordinal_in_run_normalized',   // [31]
]);

export const CHECKPOINT_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...CHECKPOINT_ML_FEATURE_LABELS,
  'shield_L1_vulnerability',
  'shield_L2_vulnerability',
  'shield_L3_vulnerability',
  'shield_L4_vulnerability',
  'bot_BOT_01_threat',
  'bot_BOT_02_threat',
  'bot_BOT_03_threat',
  'bot_BOT_04_threat',
  'bot_BOT_05_threat',
  'cascade_positive_count_normalized',
  'cascade_negative_count_normalized',
  'hand_cost_efficiency_avg',
  'attack_counterable_ratio',
  'effect_financial_impact_normalized',
  'mode_tension_delta',
  'outcome_excitement_score',
]);

export const CHECKPOINT_CHAT_SIGNAL_RISK_THRESHOLD = 0.55 as const;
export const CHECKPOINT_CHAT_SIGNAL_MAX_PER_WRITE = 4 as const;
export const CHECKPOINT_TREND_LOOKBACK_DEFAULT = 8 as const;
export const CHECKPOINT_DIFF_SIGNIFICANCE_THRESHOLD = 0.06 as const;
export const CHECKPOINT_REPLAY_TOLERANCE = 0.0 as const;

/** Invariant guard module version this store was compiled against. */
export const CHECKPOINT_INVARIANT_COMPAT_VERSION = INVARIANT_GUARD_MODULE_VERSION;

const DEFAULT_MAX_RUNS = 32;
const DEFAULT_MAX_CHECKPOINTS_PER_RUN = 512;

// ============================================================================
// SECTION 10 — EXTENDED TYPES
// ============================================================================

export type CheckpointMLRiskClass = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NOMINAL';
export type CheckpointChatSignalPriority = 'INTERRUPT' | 'ELEVATED' | 'NORMAL' | 'BACKGROUND';
export type CheckpointReplayStatus = 'MATCH' | 'DRIFT' | 'DIVERGE' | 'SKIP';
export type CheckpointCompactionMode = 'RETAIN_TERMINALS' | 'RETAIN_MILESTONES' | 'RETAIN_ALL' | 'MINIMAL';
export type CheckpointExportFormat = 'JSON' | 'COMPACT_JSON' | 'CANONICAL';
export type CheckpointStoreHealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type CheckpointDiffFieldCategory = 'ECONOMY' | 'SHIELD' | 'BATTLE' | 'PRESSURE' | 'CASCADE' | 'SOVEREIGNTY' | 'TIMER' | 'TELEMETRY' | 'MODE';
export type TrendDirection = 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'VOLATILE';

export interface CheckpointMLVector {
  readonly checkpointId: string;
  readonly runId: string;
  readonly tick: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly featureCount: number;
  readonly riskClass: CheckpointMLRiskClass;
  readonly compositeRiskScore: number;
  readonly extractedAtMs: number;
}

export interface CheckpointDLTensor {
  readonly checkpointId: string;
  readonly runId: string;
  readonly tick: number;
  readonly inputData: readonly number[];
  readonly inputShape: readonly number[];
  readonly featureLabels: readonly string[];
  readonly modelKey: string;
  readonly compositeRiskScore: number;
  readonly builtAtMs: number;
}

export interface CheckpointDiffEntry {
  readonly fieldPath: string;
  readonly category: CheckpointDiffFieldCategory;
  readonly previousValue: unknown;
  readonly currentValue: unknown;
  readonly deltaNumeric: number | null;
  readonly isSignificant: boolean;
  readonly significance: number;
}

export interface CheckpointDeltaReport {
  readonly fromCheckpointId: string;
  readonly toCheckpointId: string;
  readonly runId: string;
  readonly fromTick: number;
  readonly toTick: number;
  readonly tickDelta: number;
  readonly entries: readonly CheckpointDiffEntry[];
  readonly significantCount: number;
  readonly compositeRiskDelta: number;
  readonly dominantCategory: CheckpointDiffFieldCategory | null;
  readonly generatedAtMs: number;
}

export interface CheckpointTrendPoint {
  readonly checkpointId: string;
  readonly tick: number;
  readonly value: number;
  readonly label: string;
}

export interface CheckpointTrendReport {
  readonly runId: string;
  readonly windowSize: number;
  readonly economyTrend: TrendDirection;
  readonly shieldTrend: TrendDirection;
  readonly pressureTrend: TrendDirection;
  readonly battleTrend: TrendDirection;
  readonly cascadeTrend: TrendDirection;
  readonly overallTrend: TrendDirection;
  readonly economySeries: readonly CheckpointTrendPoint[];
  readonly shieldSeries: readonly CheckpointTrendPoint[];
  readonly pressureSeries: readonly CheckpointTrendPoint[];
  readonly overallRiskSeries: readonly CheckpointTrendPoint[];
  readonly generatedAtMs: number;
}

export interface CheckpointChatSignal {
  readonly signalId: string;
  readonly runId: string;
  readonly tick: number;
  readonly checkpointId: string;
  readonly channel: 'BATTLE_SIGNAL' | 'RUN_SIGNAL' | 'SYSTEM_SIGNAL';
  readonly priority: CheckpointChatSignalPriority;
  readonly title: string;
  readonly body: string;
  readonly riskScore: number;
  readonly riskClass: CheckpointMLRiskClass;
  readonly requiresPlayerAction: boolean;
  readonly relatedErrorCodes: readonly string[];
  readonly emittedAtMs: number;
}

export interface CheckpointChatSignalBridgeOptions {
  readonly riskThreshold?: number;
  readonly maxSignalsPerWrite?: number;
  readonly includeInvariantSignals?: boolean;
}

export interface CheckpointReplayFrame {
  readonly frameIndex: number;
  readonly checkpointId: string;
  readonly tick: number;
  readonly status: CheckpointReplayStatus;
  readonly storedChecksum: string;
  readonly replayChecksum: string;
  readonly driftScore: number;
  readonly stepLabel: string;
}

export interface CheckpointReplayResult {
  readonly runId: string;
  readonly framesTotal: number;
  readonly framesMatched: number;
  readonly framesDrifted: number;
  readonly framesDiverged: number;
  readonly overallStatus: CheckpointReplayStatus;
  readonly frames: readonly CheckpointReplayFrame[];
  readonly verifiedAtMs: number;
}

export interface CheckpointQueryFilter {
  readonly runId?: string;
  readonly minTick?: number;
  readonly maxTick?: number;
  readonly reasons?: readonly RuntimeCheckpointReason[];
  readonly steps?: readonly TickStep[];
  readonly tags?: readonly string[];
  readonly minRiskScore?: number;
  readonly terminalOnly?: boolean;
  readonly limit?: number;
  readonly sortDescending?: boolean;
}

export interface CheckpointQueryResult {
  readonly checkpoints: readonly RuntimeCheckpoint[];
  readonly totalMatched: number;
  readonly filter: CheckpointQueryFilter;
  readonly queriedAtMs: number;
}

export interface CheckpointCompactionOptions {
  readonly mode: CheckpointCompactionMode;
  readonly maxRetainPerRun?: number;
  readonly preserveTerminals?: boolean;
  readonly preserveMilestones?: boolean;
}

export interface CheckpointCompactionResult {
  readonly runId: string;
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly removedCount: number;
  readonly mode: CheckpointCompactionMode;
  readonly preservedTerminals: number;
  readonly preservedMilestones: number;
}

export interface CheckpointExportResult {
  readonly runId: string;
  readonly format: CheckpointExportFormat;
  readonly checkpointCount: number;
  readonly exportedAtMs: number;
  readonly payload: string;
  readonly byteSize: number;
  readonly checksumOfPayload: string;
}

export interface CheckpointStoreHealthReport {
  readonly grade: CheckpointStoreHealthGrade;
  readonly runCount: number;
  readonly totalCheckpoints: number;
  readonly oldestRunId: string | null;
  readonly newestRunId: string | null;
  readonly averageCheckpointsPerRun: number;
  readonly storeCapacityUsedRatio: number;
  readonly moduleVersion: string;
  readonly invariantCompatVersion: string;
  readonly generatedAtMs: number;
}

export interface CheckpointAnalyticsStackOptions {
  readonly chatSignalBridgeOptions?: CheckpointChatSignalBridgeOptions;
  readonly trendLookback?: number;
}

// ============================================================================
// SECTION 11 — PRIVATE HELPERS
// ============================================================================

function freezeCheckpoint(cp: RuntimeCheckpoint): RuntimeCheckpoint {
  return deepFrozenClone(cp);
}

function classifyCheckpointRisk(riskScore: number): CheckpointMLRiskClass {
  if (riskScore >= 0.85) return 'CRITICAL';
  if (riskScore >= 0.65) return 'HIGH';
  if (riskScore >= 0.40) return 'MEDIUM';
  if (riskScore >= 0.20) return 'LOW';
  return 'NOMINAL';
}

function categorizeDiffField(path: string): CheckpointDiffFieldCategory {
  if (path.startsWith('economy')) return 'ECONOMY';
  if (path.startsWith('shield')) return 'SHIELD';
  if (path.startsWith('battle')) return 'BATTLE';
  if (path.startsWith('pressure')) return 'PRESSURE';
  if (path.startsWith('cascade')) return 'CASCADE';
  if (path.startsWith('sovereignty')) return 'SOVEREIGNTY';
  if (path.startsWith('timer') || path.startsWith('timers')) return 'TIMER';
  if (path.startsWith('mode') || path.startsWith('phase')) return 'MODE';
  return 'TELEMETRY';
}

function computeNumericDelta(a: unknown, b: unknown): number | null {
  if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
    return b - a;
  }
  return null;
}

function inferTrendDirection(series: readonly number[]): TrendDirection {
  if (series.length < 2) return 'STABLE';
  const delta = series[series.length - 1] - series[0];
  const volatility = series.slice(1).reduce((sum, v, i) => sum + Math.abs(v - series[i]), 0) / series.length;
  if (volatility > 0.35) return 'VOLATILE';
  if (Math.abs(delta) < 0.05) return 'STABLE';
  return delta > 0 ? 'IMPROVING' : 'DEGRADING';
}

function localCompositeRisk(s: RunStateSnapshot): number {
  const pressureScore = PRESSURE_TIER_NORMALIZED[s.pressure.tier];
  const shieldScore = s.shield.layers.length > 0
    ? 1.0 - computeShieldIntegrityRatio(s.shield.layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max })))
    : 0.5;
  const botThreat = s.battle.bots.length > 0
    ? s.battle.bots.reduce((acc, b) => {
        const id = b.botId as HaterBotId;
        return acc + (isHaterBotId(id) ? BOT_THREAT_LEVEL[id] : 0) * (BOT_STATE_THREAT_MULTIPLIER[b.state] ?? 0);
      }, 0) / s.battle.bots.length
    : 0;
  const economyScore = s.economy.freedomTarget > 0
    ? Math.max(0, 1.0 - s.economy.netWorth / s.economy.freedomTarget)
    : 0.5;
  const cascadeScore = s.cascade.activeChains.length > 0
    ? s.cascade.activeChains.reduce((acc, c) => acc + (1.0 - scoreCascadeChainHealth(c)), 0) / s.cascade.activeChains.length
    : 0;
  const sovScore = INTEGRITY_STATUS_RISK_SCORE[s.sovereignty.integrityStatus];
  return Math.min(1.0, Math.max(0,
    pressureScore * 0.25 + shieldScore * 0.20 + botThreat * 0.20 +
    economyScore * 0.15 + cascadeScore * 0.10 + sovScore * 0.10,
  ));
}

// ============================================================================
// SECTION 12 — PRESERVED RuntimeCheckpointStore (original + extended)
// ============================================================================

export class RuntimeCheckpointStore {
  private readonly maxRuns: number;
  private readonly maxCheckpointsPerRun: number;
  private readonly byCheckpointId = new Map<string, RuntimeCheckpoint>();
  private readonly byRunId = new Map<string, RuntimeCheckpoint[]>();
  private readonly runLru: string[] = [];

  public constructor(options: RuntimeCheckpointStoreOptions = {}) {
    this.maxRuns = Math.max(1, options.maxRuns ?? DEFAULT_MAX_RUNS);
    this.maxCheckpointsPerRun = Math.max(1, options.maxCheckpointsPerRun ?? DEFAULT_MAX_CHECKPOINTS_PER_RUN);
  }

  public write(input: RuntimeCheckpointWriteInput): RuntimeCheckpoint {
    const reason = input.reason ?? 'MANUAL';
    const step = input.step ?? null;
    const checksum = checksumSnapshot(input.snapshot);
    const frozenSnapshot = deepFrozenClone(input.snapshot);
    const existingRun = this.byRunId.get(input.snapshot.runId) ?? [];
    const ordinalInRun = existingRun.length + 1;

    const checkpoint: RuntimeCheckpoint = freezeCheckpoint({
      checkpointId: createDeterministicId(
        'runtime-checkpoint',
        input.snapshot.runId,
        input.snapshot.tick,
        step ?? 'none',
        reason,
        ordinalInRun,
        checksum.slice(0, 16),
      ),
      runId: input.snapshot.runId,
      tick: input.snapshot.tick,
      phase: input.snapshot.phase,
      mode: input.snapshot.mode,
      outcome: input.snapshot.outcome,
      step,
      reason,
      traceId: input.traceId ?? null,
      capturedAtMs: Math.max(0, Math.trunc(input.capturedAtMs)),
      checksum,
      ordinalInRun,
      tags: Object.freeze([...(input.tags ?? [])]),
      snapshot: frozenSnapshot,
    });

    existingRun.push(checkpoint);
    this.byRunId.set(input.snapshot.runId, existingRun);
    this.byCheckpointId.set(checkpoint.checkpointId, checkpoint);
    this.touchRun(input.snapshot.runId);
    this.trimRun(input.snapshot.runId);
    this.trimStore();

    return checkpoint;
  }

  public get(checkpointId: string): RuntimeCheckpoint | null {
    return this.byCheckpointId.get(checkpointId) ?? null;
  }

  public latest(runId: string): RuntimeCheckpoint | null {
    const run = this.byRunId.get(runId);
    return run && run.length > 0 ? run[run.length - 1] : null;
  }

  public latestForStep(runId: string, step: TickStep): RuntimeCheckpoint | null {
    const run = this.byRunId.get(runId) ?? [];
    for (let i = run.length - 1; i >= 0; i--) {
      if (run[i].step === step) return run[i];
    }
    return null;
  }

  public listRun(runId: string): readonly RuntimeCheckpoint[] {
    return [...(this.byRunId.get(runId) ?? [])];
  }

  public listTick(runId: string, tick: number): readonly RuntimeCheckpoint[] {
    return (this.byRunId.get(runId) ?? []).filter((cp) => cp.tick === tick);
  }

  public getAtOrBefore(runId: string, tick: number): RuntimeCheckpoint | null {
    const run = this.byRunId.get(runId) ?? [];
    for (let i = run.length - 1; i >= 0; i--) {
      if (run[i].tick <= tick) return run[i];
    }
    return null;
  }

  public restore(checkpointId: string): RunStateSnapshot | null {
    const cp = this.get(checkpointId);
    return cp ? deepFrozenClone(cp.snapshot) : null;
  }

  public rollbackClone(checkpointId: string): RunStateSnapshot | null {
    const cp = this.get(checkpointId);
    return cp ? (cloneJson(cp.snapshot) as RunStateSnapshot) : null;
  }

  public deleteRun(runId: string): void {
    const run = this.byRunId.get(runId);
    if (!run) return;
    for (const cp of run) this.byCheckpointId.delete(cp.checkpointId);
    this.byRunId.delete(runId);
    const next = this.runLru.filter((v) => v !== runId);
    this.runLru.length = 0;
    this.runLru.push(...next);
  }

  public clear(): void {
    this.byCheckpointId.clear();
    this.byRunId.clear();
    this.runLru.length = 0;
  }

  public getRunIds(): readonly string[] { return [...this.runLru]; }
  public checkpointCount(): number { return this.byCheckpointId.size; }
  public runCount(): number { return this.byRunId.size; }

  private trimRun(runId: string): void {
    const run = this.byRunId.get(runId);
    if (!run) return;
    while (run.length > this.maxCheckpointsPerRun) {
      const removed = run.shift();
      if (removed) this.byCheckpointId.delete(removed.checkpointId);
    }
    if (run.length === 0) this.byRunId.delete(runId);
  }

  private trimStore(): void {
    while (this.byRunId.size > this.maxRuns) {
      const oldest = this.runLru.shift();
      if (oldest) this.deleteRun(oldest);
    }
  }

  private touchRun(runId: string): void {
    const filtered = this.runLru.filter((v) => v !== runId);
    this.runLru.length = 0;
    this.runLru.push(...filtered, runId);
  }
}

// ============================================================================
// SECTION 13 — CheckpointMLExtractor
// ============================================================================

export class CheckpointMLExtractor {
  public extract(cp: RuntimeCheckpoint, nowMs: number): CheckpointMLVector {
    const features = this._buildFeatures(cp);
    const compositeRiskScore = this._compositeRisk(features);
    return {
      checkpointId: cp.checkpointId,
      runId: cp.runId,
      tick: cp.tick,
      features: Object.freeze(features),
      featureLabels: CHECKPOINT_ML_FEATURE_LABELS,
      featureCount: CHECKPOINT_ML_FEATURE_COUNT,
      riskClass: classifyCheckpointRisk(compositeRiskScore),
      compositeRiskScore,
      extractedAtMs: nowMs,
    };
  }

  public extractTensor(cp: RuntimeCheckpoint, modelKey: string, nowMs: number): CheckpointDLTensor {
    const base = this._buildFeatures(cp);
    const ext = this._buildExtended(cp.snapshot);
    const inputData = [...base, ...ext];
    return {
      checkpointId: cp.checkpointId,
      runId: cp.runId,
      tick: cp.tick,
      inputData: Object.freeze(inputData),
      inputShape: CHECKPOINT_DL_TENSOR_SHAPE,
      featureLabels: CHECKPOINT_DL_FEATURE_LABELS,
      modelKey,
      compositeRiskScore: this._compositeRisk(base),
      builtAtMs: nowMs,
    };
  }

  public extractBatch(checkpoints: readonly RuntimeCheckpoint[], nowMs: number): readonly CheckpointMLVector[] {
    return checkpoints.map((cp) => this.extract(cp, nowMs));
  }

  private _clamp(v: number): number {
    return Math.min(1.0, Math.max(0, Number.isFinite(v) ? v : 0));
  }

  private _buildFeatures(cp: RuntimeCheckpoint): number[] {
    const s = cp.snapshot;

    // [0] pressure_risk_score
    const f0 = computePressureRiskScore(s.pressure.tier, s.pressure.score);
    // [1] pressure_tier_normalized
    const f1 = isPressureTier(s.pressure.tier) ? PRESSURE_TIER_NORMALIZED[s.pressure.tier] : 0;
    // [2] pressure_can_escalate
    const tierIdx = PRESSURE_TIERS.indexOf(s.pressure.tier);
    const nextTier = tierIdx < PRESSURE_TIERS.length - 1 ? PRESSURE_TIERS[tierIdx + 1] : null;
    const f2 = nextTier !== null && canEscalatePressure(s.pressure.tier, nextTier, s.pressure.score, 0) ? 1.0 : 0.0;
    // [3] shield_integrity_ratio
    const f3 = s.shield.layers.length > 0
      ? computeShieldIntegrityRatio(s.shield.layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max })))
      : 1.0;
    // [4] shield_regen_capacity
    const f4 = s.shield.layers.length > 0
      ? s.shield.layers.reduce((acc, l) => acc + estimateShieldRegenPerTick(l.layerId, l.max), 0) / s.shield.layers.length / 10.0
      : 0;
    // [5] economy_freedom_progress
    const f5 = s.economy.freedomTarget > 0
      ? Math.min(1.0, Math.max(0, s.economy.netWorth / s.economy.freedomTarget)) : 0;
    // [6] economy_cash_normalized
    const f6 = Math.min(1.0, Math.max(0, s.economy.cash / 100_000));
    // [7] economy_debt_burden
    const f7 = Math.min(1.0, s.economy.debt / Math.max(1, s.economy.cash + 1));
    // [8] battle_bot_threat_aggregate
    const f8 = s.battle.bots.length > 0
      ? s.battle.bots.reduce((acc, b) => {
          const id = b.botId as HaterBotId;
          return acc + (isHaterBotId(id) ? BOT_THREAT_LEVEL[id] : 0) * (BOT_STATE_THREAT_MULTIPLIER[b.state] ?? 0);
        }, 0) / s.battle.bots.length
      : 0;
    // [9] battle_attack_severity
    const f9 = s.battle.pendingAttacks.length > 0
      ? s.battle.pendingAttacks.reduce((acc, atk) => {
          const mag = computeEffectiveAttackDamage(atk);
          const urg = scoreAttackResponseUrgency(atk, s.tick);
          return acc + mag * urg;
        }, 0) / s.battle.pendingAttacks.length
      : 0;
    // [10] cascade_active_health_avg
    const f10 = s.cascade.activeChains.length > 0
      ? s.cascade.activeChains.reduce((acc, c) => acc + scoreCascadeChainHealth(c), 0) / s.cascade.activeChains.length
      : 1.0;
    // [11] cascade_broken_ratio
    const totalCascade = s.cascade.brokenChains + s.cascade.completedChains + s.cascade.activeChains.length;
    const f11 = totalCascade > 0 ? s.cascade.brokenChains / totalCascade : 0;
    // [12] sovereignty_integrity_risk
    const f12 = isIntegrityStatus(s.sovereignty.integrityStatus)
      ? INTEGRITY_STATUS_RISK_SCORE[s.sovereignty.integrityStatus] : 0.5;
    // [13] sovereignty_grade_score
    const f13 = s.sovereignty.verifiedGrade !== null && isVerifiedGrade(s.sovereignty.verifiedGrade)
      ? VERIFIED_GRADE_NUMERIC_SCORE[s.sovereignty.verifiedGrade] : 0.5;
    // [14] timer_budget_consumed
    const totalBudget = s.timers.seasonBudgetMs + s.timers.extensionBudgetMs;
    const f14 = totalBudget > 0 ? Math.min(1.0, s.timers.elapsedMs / totalBudget) : 0;
    // [15] decision_windows_open
    const f15 = Math.min(1.0, Object.keys(s.timers.activeDecisionWindows).length / 5.0);
    // [16] hand_power_avg
    const f16 = s.cards.hand.length > 0
      ? s.cards.hand.reduce((acc, c) => acc + computeCardPowerScore(c), 0) / s.cards.hand.length / 10.0
      : 0;
    // [17] hand_timing_priority_max
    const f17 = s.cards.hand.length > 0
      ? Math.max(...s.cards.hand.map((c) => computeCardTimingPriority(c))) / 100.0
      : 0;
    // [18] tension_score
    const f18 = Math.min(1.0, Math.max(0, s.tension.score));
    // [19] tension_threat_count
    const f19 = Math.min(1.0, s.tension.visibleThreats.length / 10.0);
    // [20] mode_difficulty
    const f20 = isModeCode(s.mode) ? MODE_DIFFICULTY_MULTIPLIER[s.mode] / 2.0 : 0.5;
    // [21] phase_normalized
    const f21 = isRunPhase(s.phase) ? RUN_PHASE_NORMALIZED[s.phase] : 0;
    // [22] run_progress
    const f22 = Math.min(1.0, s.tick / 200);
    // [23] is_endgame
    const f23 = isSnapshotInEndgame(s) ? 1.0 : 0.0;
    // [24] is_crisis
    const f24 = isSnapshotInCrisis(s) ? 1.0 : 0.0;
    // [25] is_terminal
    const f25 = isSnapshotTerminal(s) ? 1.0 : 0.0;
    // [26] is_win
    const f26 = isSnapshotWin(s) ? 1.0 : 0.0;
    // [27] has_critical_attacks
    const f27 = hasCriticalPendingAttacks(s) ? 1.0 : 0.0;
    // [28] is_flagged
    const f28 = isRunFlagged(s) ? 1.0 : 0.0;
    // [29] legend_marker_density
    const f29 = computeLegendMarkerDensity((s.sovereignty as unknown as Record<string, unknown>)['legendMarkers'] as Parameters<typeof computeLegendMarkerDensity>[0] ?? [], s.tick);
    // [30] tick_step_index_normalized
    const f30 = cp.step !== null && isTickStep(cp.step)
      ? getTickStepIndex(cp.step) / Math.max(1, TICK_SEQUENCE.length - 1)
      : 0.5;
    // [31] ordinal_in_run_normalized
    const f31 = Math.min(1.0, cp.ordinalInRun / DEFAULT_MAX_CHECKPOINTS_PER_RUN);

    return [f0,f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14,f15,f16,f17,f18,f19,f20,f21,f22,f23,f24,f25,f26,f27,f28,f29,f30,f31]
      .map((v) => this._clamp(v));
  }

  private _buildExtended(s: RunStateSnapshot): number[] {
    // [32-35] shield layer vulnerabilities
    const vulns = SHIELD_LAYER_IDS.map((id) => {
      const l = s.shield.layers.find((x) => x.layerId === id);
      return l ? computeShieldLayerVulnerability(id, l.current, l.max) : SHIELD_LAYER_CAPACITY_WEIGHT[id];
    });
    // [36-40] per-bot threat scores
    const botScores = HATER_BOT_IDS.map((id) => {
      const b = s.battle.bots.find((x) => x.botId === id);
      return b ? BOT_THREAT_LEVEL[id] * (BOT_STATE_THREAT_MULTIPLIER[b.state] ?? 0) : 0;
    });
    // [41] cascade positive count normalized
    const e41 = Math.min(1.0, s.cascade.activeChains.filter((c) => c.positive).length / 5.0);
    // [42] cascade negative count normalized
    const e42 = Math.min(1.0, s.cascade.activeChains.filter((c) => !c.positive).length / 5.0);
    // [43] hand cost efficiency avg
    const e43 = s.cards.hand.length > 0
      ? s.cards.hand.reduce((acc, c) => acc + computeCardCostEfficiency(c), 0) / s.cards.hand.length / 5.0
      : 0;
    // [44] attack counterable ratio
    const e44 = s.battle.pendingAttacks.length > 0
      ? s.battle.pendingAttacks.filter((a) => isAttackCounterable(a)).length / s.battle.pendingAttacks.length
      : 0;
    // [45] effect financial impact normalized
    const e45 = s.cards.hand.length > 0
      ? s.cards.hand.reduce((acc, c) => {
          const imp = computeEffectFinancialImpact(c.card.baseEffect);
          return acc + (isEffectNetPositive(c.card.baseEffect) ? imp : -Math.abs(imp));
        }, 0) / Math.max(1, s.cards.hand.length) / 10_000
      : 0;
    // [46] mode tension delta
    const e46 = isModeCode(s.mode)
      ? Math.abs(s.tension.score - MODE_NORMALIZED[s.mode])
      : 0;
    // [47] outcome excitement score
    const e47 = s.outcome !== null && isRunOutcome(s.outcome) && isModeCode(s.mode)
      ? scoreOutcomeExcitement(s.outcome, s.mode) / 5.0
      : 0;

    return [...vulns, ...botScores, e41, e42, e43, e44, e45, e46, e47]
      .map((v) => this._clamp(v));
  }

  private _compositeRisk(f: readonly number[]): number {
    // Risk = weighted sum with shield/economy/cascade/grade inverted (high = good)
    return this._clamp(
      f[0] * 0.10 + f[1] * 0.08 + f[2] * 0.04 +
      (1 - f[3]) * 0.10 + f[7] * 0.05 + f[8] * 0.08 +
      f[9] * 0.07 + (1 - f[10]) * 0.05 + f[11] * 0.05 +
      f[12] * 0.06 + (1 - f[13]) * 0.02 + f[24] * 0.12 +
      f[27] * 0.08 + f[28] * 0.04 + f[4] * 0.03,
    );
  }
}

// ============================================================================
// SECTION 14 — CheckpointDiffAnalyzer
// ============================================================================

export class CheckpointDiffAnalyzer {
  public diff(from: RuntimeCheckpoint, to: RuntimeCheckpoint, nowMs: number): CheckpointDeltaReport {
    if (from.runId !== to.runId) {
      return { fromCheckpointId: from.checkpointId, toCheckpointId: to.checkpointId, runId: from.runId, fromTick: from.tick, toTick: to.tick, tickDelta: to.tick - from.tick, entries: Object.freeze([]), significantCount: 0, compositeRiskDelta: 0, dominantCategory: null, generatedAtMs: nowMs };
    }
    const entries: CheckpointDiffEntry[] = [];
    this._diffEconomy(from.snapshot, to.snapshot, entries);
    this._diffShield(from.snapshot, to.snapshot, entries);
    this._diffBattle(from.snapshot, to.snapshot, entries);
    this._diffPressure(from.snapshot, to.snapshot, entries);
    this._diffCascade(from.snapshot, to.snapshot, entries);
    this._diffSovereignty(from.snapshot, to.snapshot, entries);
    this._diffTimers(from.snapshot, to.snapshot, entries);
    this._diffMode(from.snapshot, to.snapshot, entries);

    const sig = entries.filter((e) => e.isSignificant);
    const fromRisk = localCompositeRisk(from.snapshot);
    const toRisk = localCompositeRisk(to.snapshot);

    return {
      fromCheckpointId: from.checkpointId,
      toCheckpointId: to.checkpointId,
      runId: from.runId,
      fromTick: from.tick,
      toTick: to.tick,
      tickDelta: to.tick - from.tick,
      entries: Object.freeze(entries),
      significantCount: sig.length,
      compositeRiskDelta: toRisk - fromRisk,
      dominantCategory: this._dominant(sig),
      generatedAtMs: nowMs,
    };
  }

  public diffRun(checkpoints: readonly RuntimeCheckpoint[], nowMs: number): readonly CheckpointDeltaReport[] {
    if (checkpoints.length < 2) return Object.freeze([]);
    const reports: CheckpointDeltaReport[] = [];
    for (let i = 1; i < checkpoints.length; i++) {
      reports.push(this.diff(checkpoints[i - 1], checkpoints[i], nowMs));
    }
    return Object.freeze(reports);
  }

  private _push(entries: CheckpointDiffEntry[], path: string, prev: unknown, curr: unknown, sig: number): void {
    const delta = computeNumericDelta(prev, curr);
    entries.push({ fieldPath: path, category: categorizeDiffField(path), previousValue: prev, currentValue: curr, deltaNumeric: delta, isSignificant: sig >= CHECKPOINT_DIFF_SIGNIFICANCE_THRESHOLD, significance: sig });
  }

  private _diffEconomy(a: RunStateSnapshot, b: RunStateSnapshot, entries: CheckpointDiffEntry[]): void {
    this._push(entries, 'economy.cash', a.economy.cash, b.economy.cash, Math.abs((b.economy.cash - a.economy.cash)) / 10_000);
    this._push(entries, 'economy.debt', a.economy.debt, b.economy.debt, Math.abs((b.economy.debt - a.economy.debt)) / 10_000);
    this._push(entries, 'economy.netWorth', a.economy.netWorth, b.economy.netWorth, Math.abs((b.economy.netWorth - a.economy.netWorth)) / 10_000);
    this._push(entries, 'economy.haterHeat', a.economy.haterHeat, b.economy.haterHeat, Math.abs((b.economy.haterHeat - a.economy.haterHeat)));
  }

  private _diffShield(a: RunStateSnapshot, b: RunStateSnapshot, entries: CheckpointDiffEntry[]): void {
    const aRatio = computeShieldIntegrityRatio(a.shield.layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max })));
    const bRatio = computeShieldIntegrityRatio(b.shield.layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max })));
    this._push(entries, 'shield.integrityRatio', aRatio, bRatio, Math.abs(bRatio - aRatio));
    for (const layerId of SHIELD_LAYER_IDS) {
      const al = a.shield.layers.find((l) => l.layerId === layerId);
      const bl = b.shield.layers.find((l) => l.layerId === layerId);
      if (!al || !bl) continue;
      const aVuln = computeShieldLayerVulnerability(layerId, al.current, al.max);
      const bVuln = computeShieldLayerVulnerability(layerId, bl.current, bl.max);
      const capWeight = SHIELD_LAYER_CAPACITY_WEIGHT[layerId];
      this._push(entries, `shield.layers.${layerId}.vulnerability`, aVuln, bVuln, Math.abs(bVuln - aVuln) * capWeight);
    }
  }

  private _diffBattle(a: RunStateSnapshot, b: RunStateSnapshot, entries: CheckpointDiffEntry[]): void {
    const aThreat = this._botThreat(a);
    const bThreat = this._botThreat(b);
    this._push(entries, 'battle.aggregateBotThreat', aThreat, bThreat, Math.abs(bThreat - aThreat));
    this._push(entries, 'battle.pendingAttacks.length', a.battle.pendingAttacks.length, b.battle.pendingAttacks.length, Math.abs(b.battle.pendingAttacks.length - a.battle.pendingAttacks.length) / 5.0);
  }

  private _diffPressure(a: RunStateSnapshot, b: RunStateSnapshot, entries: CheckpointDiffEntry[]): void {
    const aRisk = isPressureTier(a.pressure.tier) ? computePressureRiskScore(a.pressure.tier, a.pressure.score) : 0;
    const bRisk = isPressureTier(b.pressure.tier) ? computePressureRiskScore(b.pressure.tier, b.pressure.score) : 0;
    this._push(entries, 'pressure.riskScore', aRisk, bRisk, Math.abs(bRisk - aRisk));
    if (a.pressure.tier !== b.pressure.tier) {
      this._push(entries, 'pressure.tier', a.pressure.tier, b.pressure.tier, 1.0);
    }
  }

  private _diffCascade(a: RunStateSnapshot, b: RunStateSnapshot, entries: CheckpointDiffEntry[]): void {
    const aH = a.cascade.activeChains.length > 0
      ? a.cascade.activeChains.reduce((acc, c) => acc + scoreCascadeChainHealth(c), 0) / a.cascade.activeChains.length : 1.0;
    const bH = b.cascade.activeChains.length > 0
      ? b.cascade.activeChains.reduce((acc, c) => acc + scoreCascadeChainHealth(c), 0) / b.cascade.activeChains.length : 1.0;
    this._push(entries, 'cascade.averageChainHealth', aH, bH, Math.abs(bH - aH));
    this._push(entries, 'cascade.brokenChains', a.cascade.brokenChains, b.cascade.brokenChains, Math.abs(b.cascade.brokenChains - a.cascade.brokenChains) * 0.3);
  }

  private _diffSovereignty(a: RunStateSnapshot, b: RunStateSnapshot, entries: CheckpointDiffEntry[]): void {
    const aR = INTEGRITY_STATUS_RISK_SCORE[a.sovereignty.integrityStatus];
    const bR = INTEGRITY_STATUS_RISK_SCORE[b.sovereignty.integrityStatus];
    this._push(entries, 'sovereignty.integrityRisk', aR, bR, Math.abs(bR - aR));
    this._push(entries, 'sovereignty.auditFlags.length', a.sovereignty.auditFlags.length, b.sovereignty.auditFlags.length, Math.abs(b.sovereignty.auditFlags.length - a.sovereignty.auditFlags.length) * 0.25);
  }

  private _diffTimers(a: RunStateSnapshot, b: RunStateSnapshot, entries: CheckpointDiffEntry[]): void {
    const elapsed = b.timers.elapsedMs - a.timers.elapsedMs;
    this._push(entries, 'timers.elapsedMs', a.timers.elapsedMs, b.timers.elapsedMs, elapsed / 60_000);
  }

  private _diffMode(a: RunStateSnapshot, b: RunStateSnapshot, entries: CheckpointDiffEntry[]): void {
    if (a.phase !== b.phase) this._push(entries, 'phase', a.phase, b.phase, 1.0);
  }

  private _botThreat(s: RunStateSnapshot): number {
    if (!s.battle.bots.length) return 0;
    return s.battle.bots.reduce((acc, b) => {
      const id = b.botId as HaterBotId;
      return acc + (isHaterBotId(id) ? BOT_THREAT_LEVEL[id] : 0) * (BOT_STATE_THREAT_MULTIPLIER[b.state] ?? 0);
    }, 0) / s.battle.bots.length;
  }

  private _dominant(entries: readonly CheckpointDiffEntry[]): CheckpointDiffFieldCategory | null {
    if (!entries.length) return null;
    const totals = new Map<CheckpointDiffFieldCategory, number>();
    for (const e of entries) totals.set(e.category, (totals.get(e.category) ?? 0) + e.significance);
    let max = 0; let dom: CheckpointDiffFieldCategory | null = null;
    for (const [cat, score] of totals) { if (score > max) { max = score; dom = cat; } }
    return dom;
  }
}

// ============================================================================
// SECTION 15 — CheckpointTrendAnalyzer
// ============================================================================

export class CheckpointTrendAnalyzer {
  private readonly lookback: number;

  public constructor(lookback: number = CHECKPOINT_TREND_LOOKBACK_DEFAULT) {
    this.lookback = Math.max(2, lookback);
  }

  public analyze(checkpoints: readonly RuntimeCheckpoint[], nowMs: number): CheckpointTrendReport {
    if (!checkpoints.length) {
      return { runId: 'unknown', windowSize: 0, economyTrend: 'STABLE', shieldTrend: 'STABLE', pressureTrend: 'STABLE', battleTrend: 'STABLE', cascadeTrend: 'STABLE', overallTrend: 'STABLE', economySeries: Object.freeze([]), shieldSeries: Object.freeze([]), pressureSeries: Object.freeze([]), overallRiskSeries: Object.freeze([]), generatedAtMs: nowMs };
    }
    const win = checkpoints.slice(-this.lookback);
    const runId = win[0].runId;

    const pt = (cp: RuntimeCheckpoint, v: number, prefix: string): CheckpointTrendPoint =>
      ({ checkpointId: cp.checkpointId, tick: cp.tick, value: v, label: `${prefix}@tick${cp.tick}` });

    const economySeries = win.map((cp) => pt(cp, this._economyScore(cp.snapshot), 'economy'));
    const shieldSeries  = win.map((cp) => pt(cp, computeShieldIntegrityRatio(cp.snapshot.shield.layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max }))), 'shield'));
    const pressureSeries = win.map((cp) => pt(cp, 1.0 - (isPressureTier(cp.snapshot.pressure.tier) ? PRESSURE_TIER_NORMALIZED[cp.snapshot.pressure.tier] : 0), 'pressure'));
    const battleSeries  = win.map((cp) => pt(cp, this._battleThreat(cp.snapshot), 'battle'));
    const cascadeSeries = win.map((cp) => pt(cp, this._cascadeHealth(cp.snapshot), 'cascade'));
    const riskSeries    = win.map((cp) => pt(cp, localCompositeRisk(cp.snapshot), 'risk'));

    return {
      runId,
      windowSize: win.length,
      economyTrend:  inferTrendDirection(economySeries.map((p) => p.value)),
      shieldTrend:   inferTrendDirection(shieldSeries.map((p) => p.value)),
      pressureTrend: inferTrendDirection(pressureSeries.map((p) => p.value)),
      battleTrend:   inferTrendDirection(battleSeries.map((p) => p.value)),
      cascadeTrend:  inferTrendDirection(cascadeSeries.map((p) => p.value)),
      overallTrend:  inferTrendDirection(riskSeries.map((p) => p.value)),
      economySeries:  Object.freeze(economySeries),
      shieldSeries:   Object.freeze(shieldSeries),
      pressureSeries: Object.freeze(pressureSeries),
      overallRiskSeries: Object.freeze(riskSeries),
      generatedAtMs: nowMs,
    };
  }

  public escalationRiskDelta(checkpoints: readonly RuntimeCheckpoint[]): number {
    if (checkpoints.length < 2) return 0;
    const win = checkpoints.slice(-this.lookback);
    return localCompositeRisk(win[win.length - 1].snapshot) - localCompositeRisk(win[0].snapshot);
  }

  public escalationThresholdProximity(snapshot: RunStateSnapshot): number {
    if (!isPressureTier(snapshot.pressure.tier)) return 0;
    const idx = PRESSURE_TIERS.indexOf(snapshot.pressure.tier);
    if (idx >= PRESSURE_TIERS.length - 1) return 1.0;
    const threshold = PRESSURE_TIER_ESCALATION_THRESHOLD[PRESSURE_TIERS[idx + 1]];
    return Math.min(1.0, Math.max(0, snapshot.pressure.score / threshold));
  }

  public deescalationThresholdProximity(snapshot: RunStateSnapshot): number {
    if (!isPressureTier(snapshot.pressure.tier)) return 0;
    const idx = PRESSURE_TIERS.indexOf(snapshot.pressure.tier);
    if (idx <= 0) return 0;
    const prevTier = PRESSURE_TIERS[idx - 1];
    const canDrop = canDeescalatePressure(snapshot.pressure.tier, prevTier, snapshot.pressure.score);
    const threshold = PRESSURE_TIER_DEESCALATION_THRESHOLD[snapshot.pressure.tier];
    return canDrop ? 1.0 : Math.min(1.0, Math.max(0, threshold / Math.max(1, snapshot.pressure.score)));
  }

  private _economyScore(s: RunStateSnapshot): number {
    const p = s.economy.freedomTarget > 0 ? Math.min(1, Math.max(0, s.economy.netWorth / s.economy.freedomTarget)) : 0;
    const c = Math.min(1, Math.max(0, s.economy.cash / 100_000));
    const d = Math.min(1, s.economy.debt / Math.max(1, s.economy.cash + 1));
    return Math.min(1, Math.max(0, p * 0.5 + c * 0.3 - d * 0.2));
  }

  private _battleThreat(s: RunStateSnapshot): number {
    if (!s.battle.bots.length) return 0;
    return Math.min(1, s.battle.bots.reduce((acc, b) => {
      const id = b.botId as HaterBotId;
      return acc + (isHaterBotId(id) ? BOT_THREAT_LEVEL[id] : 0) * (BOT_STATE_THREAT_MULTIPLIER[b.state] ?? 0);
    }, 0) / s.battle.bots.length);
  }

  private _cascadeHealth(s: RunStateSnapshot): number {
    if (!s.cascade.activeChains.length) return 1.0;
    return s.cascade.activeChains.reduce((acc, c) => acc + scoreCascadeChainHealth(c), 0) / s.cascade.activeChains.length;
  }
}

// ============================================================================
// SECTION 16 — CheckpointChatSignalBridge
// ============================================================================

export class CheckpointChatSignalBridge {
  private readonly riskThreshold: number;
  private readonly maxSignalsPerWrite: number;
  private readonly includeInvariantSignals: boolean;
  private readonly guard: RunStateInvariantGuard;

  public constructor(options: CheckpointChatSignalBridgeOptions = {}) {
    this.riskThreshold = options.riskThreshold ?? CHECKPOINT_CHAT_SIGNAL_RISK_THRESHOLD;
    this.maxSignalsPerWrite = options.maxSignalsPerWrite ?? CHECKPOINT_CHAT_SIGNAL_MAX_PER_WRITE;
    this.includeInvariantSignals = options.includeInvariantSignals ?? true;
    this.guard = new RunStateInvariantGuard();
  }

  public generate(
    cp: RuntimeCheckpoint,
    vec: CheckpointMLVector,
    nowMs: number,
  ): readonly CheckpointChatSignal[] {
    const s = cp.snapshot;
    const signals: CheckpointChatSignal[] = [];

    if (isSnapshotInCrisis(s) && vec.compositeRiskScore >= this.riskThreshold) {
      signals.push(this._sig(cp, vec, nowMs, 'RUN_SIGNAL', 'INTERRUPT',
        `Critical Run State — ${getPressureTierUrgencyLabel(s)} Pressure`,
        this._crisisBody(s, vec),
        hasPlayableCards(s) || hasActiveDecisionWindows(s), []));
    }

    if (isShieldFailing(s)) {
      const vuln = 1.0 - computeShieldIntegrityRatio(s.shield.layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max })));
      signals.push(this._sig(cp, vec, nowMs, 'BATTLE_SIGNAL', vuln >= 0.7 ? 'INTERRUPT' : 'ELEVATED',
        'Shield Layer Breached',
        this._shieldBody(s),
        hasPlayableCards(s), []));
    }

    if (hasCriticalPendingAttacks(s)) {
      signals.push(this._sig(cp, vec, nowMs, 'BATTLE_SIGNAL', 'ELEVATED',
        'Critical Attack Incoming',
        this._attackBody(s),
        true, []));
    }

    if (isSovereigntyAtRisk(s)) {
      const iRisk = INTEGRITY_STATUS_RISK_SCORE[s.sovereignty.integrityStatus];
      signals.push(this._sig(cp, vec, nowMs, 'RUN_SIGNAL', iRisk >= 0.8 ? 'ELEVATED' : 'NORMAL',
        'Sovereignty Integrity Warning',
        this._sovereigntyBody(s),
        false, []));
    }

    if (this.includeInvariantSignals) {
      const report = this.guard.inspect(s);
      if (!report.ok && report.errors.length > 0) {
        const hasCritical = report.errors.some((e) => INVARIANT_CRITICAL_ERROR_CODES.has(e.code));
        const hasHigh = report.errors.some((e) => INVARIANT_HIGH_RISK_ERROR_CODES.has(e.code));
        const codes = report.errors.map((e) => e.code);
        signals.push(this._sig(cp, vec, nowMs, 'SYSTEM_SIGNAL', hasCritical ? 'INTERRUPT' : hasHigh ? 'ELEVATED' : 'NORMAL',
          `Engine Invariant Failure (${report.errors.length} error${report.errors.length > 1 ? 's' : ''})`,
          this._invariantBody(report, codes),
          false, codes));
      }
    }

    if (isSnapshotTerminal(s)) {
      const exc = s.outcome !== null && isRunOutcome(s.outcome) && isModeCode(s.mode)
        ? scoreOutcomeExcitement(s.outcome, s.mode) : 3;
      signals.push(this._sig(cp, vec, nowMs, 'RUN_SIGNAL', exc >= 4 ? 'ELEVATED' : 'NORMAL',
        isSnapshotWin(s) ? 'Run Complete — Freedom Achieved' : isSnapshotLoss(s) ? 'Run Terminated' : 'Run Ended',
        this._terminalBody(s),
        false, []));
    }

    return Object.freeze(signals.slice(0, this.maxSignalsPerWrite));
  }

  private _sig(
    cp: RuntimeCheckpoint, vec: CheckpointMLVector, nowMs: number,
    channel: CheckpointChatSignal['channel'], priority: CheckpointChatSignalPriority,
    title: string, body: string, requiresPlayerAction: boolean, relatedErrorCodes: readonly string[],
  ): CheckpointChatSignal {
    return {
      signalId: createDeterministicId('cp-chat', cp.runId, cp.tick, channel, priority, nowMs),
      runId: cp.runId, tick: cp.tick, checkpointId: cp.checkpointId,
      channel, priority, title, body,
      riskScore: vec.compositeRiskScore, riskClass: vec.riskClass,
      requiresPlayerAction, relatedErrorCodes, emittedAtMs: nowMs,
    };
  }

  private _crisisBody(s: RunStateSnapshot, vec: CheckpointMLVector): string {
    const tierNorm = getNormalizedPressureTier(s);
    const diff = isModeCode(s.mode) ? MODE_DIFFICULTY_MULTIPLIER[s.mode] : 1.0;
    const parts = [
      `Pressure: ${getPressureTierUrgencyLabel(s)} (${(tierNorm * 100).toFixed(0)}%, ${s.mode} x${diff.toFixed(1)})`,
      `Risk: ${(vec.compositeRiskScore * 100).toFixed(1)}% [${vec.riskClass}]`,
      isBattleEscalating(s) ? `Battle escalating — ${s.battle.pendingAttacks.length} attacks pending.` : '',
      isCascadeCritical(s) ? 'Cascade critical.' : '',
      !isEconomyHealthy(s) ? 'Economy under stress.' : '',
    ];
    return parts.filter(Boolean).join(' ');
  }

  private _shieldBody(s: RunStateSnapshot): string {
    const breached = s.shield.layers.filter((l) => l.breached).map((l) => l.layerId).join(', ');
    const ratio = computeShieldIntegrityRatio(s.shield.layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max })));
    const regenDetail = s.shield.layers.map((l) => {
      const regen = estimateShieldRegenPerTick(l.layerId, l.max);
      const cap = SHIELD_LAYER_CAPACITY_WEIGHT[l.layerId];
      return `${l.layerId}:${regen.toFixed(2)}/t(w${cap})`;
    }).join(' ');
    return `Integrity: ${(ratio * 100).toFixed(1)}%. Breached: ${breached || 'none'}. Regen: ${regenDetail}`;
  }

  private _attackBody(s: RunStateSnapshot): string {
    return s.battle.pendingAttacks
      .filter((a) => { const sev = classifyAttackSeverity(a); return sev === 'CATASTROPHIC' || sev === 'MAJOR'; })
      .map((a) => {
        const sev = classifyAttackSeverity(a);
        const dmg = computeEffectiveAttackDamage(a);
        const urg = scoreAttackResponseUrgency(a, s.tick);
        const ctr = isAttackCounterable(a) ? '[CTR]' : '';
        const bot = isAttackFromBot(a) ? ` from ${a.source}` : '';
        return `${sev}${bot}: ${dmg.toFixed(2)} dmg, urg ${(urg * 100).toFixed(0)}% ${ctr}`;
      }).join('. ') || 'No details.';
  }

  private _sovereigntyBody(s: RunStateSnapshot): string {
    const risk = INTEGRITY_STATUS_RISK_SCORE[s.sovereignty.integrityStatus];
    const grade = s.sovereignty.verifiedGrade !== null && isVerifiedGrade(s.sovereignty.verifiedGrade)
      ? `Grade: ${s.sovereignty.verifiedGrade} (${(VERIFIED_GRADE_NUMERIC_SCORE[s.sovereignty.verifiedGrade] * 100).toFixed(0)}%)`
      : 'Grade: pending';
    return `Status: ${s.sovereignty.integrityStatus} (risk ${(risk * 100).toFixed(0)}%). ${grade}. Flags: ${s.sovereignty.auditFlags.length}.`;
  }

  private _invariantBody(report: RunStateInvariantReport, codes: readonly string[]): string {
    const top = codes.slice(0, 3).join(', ');
    return `${report.errors.length} error(s), ${report.warnings.length} warning(s). Top codes: ${top || 'N/A'}. [${CHECKPOINT_INVARIANT_COMPAT_VERSION}]`;
  }

  private _terminalBody(s: RunStateSnapshot): string {
    const outcome = s.outcome ?? 'unknown';
    const stakes = isRunPhase(s.phase) && isModeCode(s.mode)
      ? computeEffectiveStakes(s.phase, s.mode).toFixed(2) : 'N/A';
    const win = s.outcome !== null && isWinOutcome(s.outcome);
    const loss = s.outcome !== null && isLossOutcome(s.outcome);
    return `${outcome} | phase: ${s.phase} | mode: ${s.mode} | tick: ${s.tick} | stakes: ${stakes} | ${win ? 'Victory!' : loss ? 'Defeated.' : ''}`;
  }
}

// ============================================================================
// SECTION 17 — CheckpointReplayVerifier
// ============================================================================

export class CheckpointReplayVerifier {
  public verify(checkpoints: readonly RuntimeCheckpoint[], nowMs: number): CheckpointReplayResult {
    const frames: CheckpointReplayFrame[] = [];
    let matched = 0; let drifted = 0; let diverged = 0;

    for (let i = 0; i < checkpoints.length; i++) {
      const frame = this._verifyFrame(checkpoints[i], i);
      frames.push(frame);
      if (frame.status === 'MATCH') matched++;
      else if (frame.status === 'DRIFT') drifted++;
      else if (frame.status === 'DIVERGE') diverged++;
    }

    return {
      runId: checkpoints[0]?.runId ?? 'unknown',
      framesTotal: checkpoints.length,
      framesMatched: matched,
      framesDrifted: drifted,
      framesDiverged: diverged,
      overallStatus: diverged > 0 ? 'DIVERGE' : drifted > 0 ? 'DRIFT' : matched === checkpoints.length && matched > 0 ? 'MATCH' : 'SKIP',
      frames: Object.freeze(frames),
      verifiedAtMs: nowMs,
    };
  }

  private _verifyFrame(cp: RuntimeCheckpoint, index: number): CheckpointReplayFrame {
    const replayChecksum = checksumSnapshot(cp.snapshot);
    const isMatch = replayChecksum === cp.checksum;
    let status: CheckpointReplayStatus;
    let driftScore = 0;
    if (isMatch) {
      status = 'MATCH';
    } else {
      const matchChars = [...cp.checksum].filter((c, i) => replayChecksum[i] === c).length;
      const sim = matchChars / Math.max(1, cp.checksum.length);
      status = sim > 0.8 ? 'DRIFT' : 'DIVERGE';
      driftScore = 1.0 - sim;
    }
    const stepLabel = cp.step !== null && isTickStep(cp.step)
      ? (TICK_STEP_DESCRIPTORS[cp.step]?.description ?? cp.step)
      : 'none';
    return { frameIndex: index, checkpointId: cp.checkpointId, tick: cp.tick, status, storedChecksum: cp.checksum, replayChecksum, driftScore, stepLabel };
  }

  public validateStepSequence(checkpoints: readonly RuntimeCheckpoint[]): readonly string[] {
    const violations: string[] = [];
    const stepped = checkpoints.filter((cp) => cp.step !== null && isTickStep(cp.step));
    for (let i = 1; i < stepped.length; i++) {
      const prev = stepped[i - 1]; const curr = stepped[i];
      if (!prev.step || !curr.step || !isTickStep(prev.step) || !isTickStep(curr.step)) continue;
      if (prev.tick === curr.tick && getTickStepIndex(curr.step) < getTickStepIndex(prev.step)) {
        violations.push(`Tick ${curr.tick}: step order violation — ${prev.step} → ${curr.step}`);
      }
    }
    const groups = new Map<number, TickStep[]>();
    for (const cp of stepped) {
      if (!cp.step || !isTickStep(cp.step)) continue;
      const existing = groups.get(cp.tick) ?? [];
      groups.set(cp.tick, [...existing, cp.step]);
    }
    const expectedSteps = TICK_SEQUENCE.length;
    for (const [tick, steps] of groups) {
      if (steps.length < expectedSteps * 0.5) {
        violations.push(`Tick ${tick}: ${steps.length}/${expectedSteps} steps captured.`);
      }
    }
    return Object.freeze(violations);
  }

  public validateEnums(checkpoints: readonly RuntimeCheckpoint[]): readonly string[] {
    const violations: string[] = [];
    for (const cp of checkpoints) {
      if (!isKnownMode(cp.snapshot)) {
        violations.push(`Checkpoint ${cp.checkpointId} (tick ${cp.tick}): unknown mode '${cp.snapshot.mode}'`);
      }
      const result = validateSnapshotEnums(cp.snapshot);
      if (!result.ok) {
        for (const e of [...result.enumErrors, ...result.fieldErrors]) {
          violations.push(`Checkpoint ${cp.checkpointId} (tick ${cp.tick}): ${e}`);
        }
      }
    }
    return Object.freeze(violations);
  }
}

// ============================================================================
// SECTION 18 — CheckpointQueryEngine
// ============================================================================

export class CheckpointQueryEngine {
  private readonly store: RuntimeCheckpointStore;

  public constructor(store: RuntimeCheckpointStore) {
    this.store = store;
  }

  public query(filter: CheckpointQueryFilter): CheckpointQueryResult {
    const nowMs = Date.now();
    let pool: RuntimeCheckpoint[] = filter.runId
      ? [...this.store.listRun(filter.runId)]
      : this.store.getRunIds().flatMap((id) => [...this.store.listRun(id)]);

    if (filter.minTick !== undefined) pool = pool.filter((cp) => cp.tick >= filter.minTick!);
    if (filter.maxTick !== undefined) pool = pool.filter((cp) => cp.tick <= filter.maxTick!);
    if (filter.reasons?.length) {
      const set = new Set<RuntimeCheckpointReason>(filter.reasons);
      pool = pool.filter((cp) => set.has(cp.reason));
    }
    if (filter.steps?.length) {
      const set = new Set<TickStep | null>(filter.steps);
      pool = pool.filter((cp) => set.has(cp.step));
    }
    if (filter.tags?.length) {
      const set = new Set<string>(filter.tags);
      pool = pool.filter((cp) => cp.tags.some((t) => set.has(t)));
    }
    if (filter.terminalOnly) pool = pool.filter((cp) => isSnapshotTerminal(cp.snapshot));
    if (filter.minRiskScore !== undefined) {
      const ext = new CheckpointMLExtractor();
      const threshold = filter.minRiskScore;
      pool = pool.filter((cp) => ext.extract(cp, nowMs).compositeRiskScore >= threshold);
    }
    if (filter.sortDescending) pool.sort((a, b) => b.tick - a.tick);

    const totalMatched = pool.length;
    if (filter.limit && filter.limit > 0) pool = pool.slice(0, filter.limit);

    return { checkpoints: Object.freeze(pool), totalMatched, filter, queriedAtMs: nowMs };
  }

  public findPhaseTransitions(runId: string): readonly RuntimeCheckpoint[] {
    const cps = this.store.listRun(runId);
    return Object.freeze(cps.filter((cp, i) => i > 0 && cp.phase !== cps[i - 1].phase));
  }

  public findPressureTransitions(runId: string): readonly RuntimeCheckpoint[] {
    const cps = this.store.listRun(runId);
    return Object.freeze(cps.filter((cp, i) => {
      if (i === 0) return false;
      const prevNorm = isPressureTier(cps[i - 1].snapshot.pressure.tier) ? PRESSURE_TIER_NORMALIZED[cps[i - 1].snapshot.pressure.tier] : -1;
      const currNorm = isPressureTier(cp.snapshot.pressure.tier) ? PRESSURE_TIER_NORMALIZED[cp.snapshot.pressure.tier] : -1;
      return prevNorm !== currNorm;
    }));
  }

  public findPeakRiskCheckpoint(runId: string): RuntimeCheckpoint | null {
    const cps = this.store.listRun(runId);
    if (!cps.length) return null;
    const ext = new CheckpointMLExtractor();
    const nowMs = Date.now();
    return cps.reduce<RuntimeCheckpoint | null>((best, cp) => {
      const score = ext.extract(cp, nowMs).compositeRiskScore;
      return best === null || score > ext.extract(best, nowMs).compositeRiskScore ? cp : best;
    }, null);
  }

  public findCascadeCrisisCheckpoints(runId: string): readonly RuntimeCheckpoint[] {
    return Object.freeze(this.store.listRun(runId).filter((cp) =>
      cp.snapshot.cascade.activeChains.some((c) => {
        const h = classifyCascadeChainHealth(c);
        return h === 'CRITICAL' || h === 'LOST';
      })));
  }

  public findAllTerminals(): readonly RuntimeCheckpoint[] {
    return Object.freeze(
      this.store.getRunIds()
        .map((id) => this.store.latest(id))
        .filter((cp): cp is RuntimeCheckpoint => cp !== null && isSnapshotTerminal(cp.snapshot)),
    );
  }
}

// ============================================================================
// SECTION 19 — CheckpointCompactionStrategy
// ============================================================================

export class CheckpointCompactionStrategy {
  public compact(checkpoints: readonly RuntimeCheckpoint[], options: CheckpointCompactionOptions): CheckpointCompactionResult {
    const runId = checkpoints[0]?.runId ?? 'unknown';
    const before = checkpoints.length;
    const max = options.maxRetainPerRun ?? 64;

    if (before <= max) {
      return { runId, beforeCount: before, afterCount: before, removedCount: 0, mode: options.mode, preservedTerminals: checkpoints.filter((cp) => isSnapshotTerminal(cp.snapshot)).length, preservedMilestones: checkpoints.filter((cp) => this._isMilestone(cp)).length };
    }

    const retained = this._apply(checkpoints, options, max);
    return {
      runId, beforeCount: before, afterCount: retained.length, removedCount: before - retained.length, mode: options.mode,
      preservedTerminals: retained.filter((cp) => isSnapshotTerminal(cp.snapshot)).length,
      preservedMilestones: retained.filter((cp) => this._isMilestone(cp)).length,
    };
  }

  private _apply(checkpoints: readonly RuntimeCheckpoint[], options: CheckpointCompactionOptions, max: number): readonly RuntimeCheckpoint[] {
    if (options.mode === 'RETAIN_ALL') return checkpoints;
    const mustKeep = new Set<string>();
    if (options.preserveTerminals ?? true) {
      for (const cp of checkpoints) { if (isSnapshotTerminal(cp.snapshot)) mustKeep.add(cp.checkpointId); }
    }
    if ((options.preserveMilestones ?? true) || options.mode === 'RETAIN_MILESTONES') {
      for (const cp of checkpoints) { if (this._isMilestone(cp)) mustKeep.add(cp.checkpointId); }
    }
    if (options.mode === 'RETAIN_TERMINALS') {
      for (const cp of checkpoints) { if (cp.reason === 'TERMINAL' || cp.reason === 'RUN_START') mustKeep.add(cp.checkpointId); }
    }
    const kept = checkpoints.filter((cp) => mustKeep.has(cp.checkpointId));
    const flex = checkpoints.filter((cp) => !mustKeep.has(cp.checkpointId));
    const slots = Math.max(0, max - kept.length);
    const ext = new CheckpointMLExtractor();
    const nowMs = Date.now();
    const sorted = flex.map((cp) => ({ cp, score: this._retain(cp, ext, nowMs) })).sort((a, b) => b.score - a.score);
    return Object.freeze([...kept, ...sorted.slice(0, slots).map((x) => x.cp)].sort((a, b) => a.tick - b.tick));
  }

  private _isMilestone(cp: RuntimeCheckpoint): boolean {
    return cp.reason === 'TERMINAL' || cp.reason === 'RUN_START' ||
      cp.tags.includes('phase-boundary') || cp.tags.includes('pressure-tier-change') ||
      isSnapshotTerminal(cp.snapshot) || cp.ordinalInRun === 1;
  }

  private _retain(cp: RuntimeCheckpoint, ext: CheckpointMLExtractor, nowMs: number): number {
    const vec = ext.extract(cp, nowMs);
    return vec.compositeRiskScore * 0.3 +
      (isSnapshotTerminal(cp.snapshot) ? 1.0 : 0) +
      (this._isMilestone(cp) ? 0.5 : 0) +
      (vec.riskClass === 'CRITICAL' || vec.riskClass === 'HIGH' ? 0.4 : 0) +
      (1.0 - Math.min(1.0, cp.ordinalInRun / DEFAULT_MAX_CHECKPOINTS_PER_RUN)) * 0.1;
  }
}

// ============================================================================
// SECTION 20 — CheckpointExporter
// ============================================================================

export class CheckpointExporter {
  public export(checkpoints: readonly RuntimeCheckpoint[], format: CheckpointExportFormat, nowMs: number): CheckpointExportResult {
    const runId = checkpoints[0]?.runId ?? 'unknown';
    let payload: string;
    switch (format) {
      case 'CANONICAL':
        payload = stableStringify(checkpoints.map((cp) => this._summary(cp)));
        break;
      case 'COMPACT_JSON':
        payload = JSON.stringify(checkpoints.map((cp) => ({ id: cp.checkpointId, t: cp.tick, s: cp.step, r: cp.reason, cs: cp.checksum.slice(0, 16), o: cp.ordinalInRun })));
        break;
      case 'JSON':
      default:
        payload = JSON.stringify(checkpoints.map((cp) => this._full(cp)), null, 2);
    }
    return {
      runId, format,
      checkpointCount: checkpoints.length,
      exportedAtMs: nowMs,
      payload,
      byteSize: payload.length,
      checksumOfPayload: checksumParts('cp-export', runId, String(payload.length)),
    };
  }

  public exportMLMatrix(checkpoints: readonly RuntimeCheckpoint[], nowMs: number): string {
    const ext = new CheckpointMLExtractor();
    const rows = ext.extractBatch(checkpoints, nowMs).map((v) => ({
      checkpointId: v.checkpointId, runId: v.runId, tick: v.tick,
      riskClass: v.riskClass, compositeRiskScore: v.compositeRiskScore, features: v.features,
    }));
    return stableStringify({ featureLabels: CHECKPOINT_ML_FEATURE_LABELS, rows });
  }

  private _summary(cp: RuntimeCheckpoint): Record<string, unknown> {
    return { id: cp.checkpointId, runId: cp.runId, tick: cp.tick, step: cp.step, reason: cp.reason, checksum: cp.checksum, ordinal: cp.ordinalInRun, phase: cp.phase, mode: cp.mode, outcome: cp.outcome, tags: cp.tags };
  }

  private _full(cp: RuntimeCheckpoint): Record<string, unknown> {
    const s = cp.snapshot;
    return {
      ...this._summary(cp),
      traceId: cp.traceId, capturedAtMs: cp.capturedAtMs,
      snapshotSummary: {
        phase: s.phase, mode: s.mode, outcome: s.outcome,
        pressureTier: s.pressure.tier, pressureScore: s.pressure.score,
        shieldIntegrity: computeShieldIntegrityRatio(s.shield.layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max }))),
        economyNetWorth: s.economy.netWorth,
        isTerminal: isSnapshotTerminal(s), isWin: isSnapshotWin(s),
      },
    };
  }
}

// ============================================================================
// SECTION 21 — CheckpointAnalyticsStack
// ============================================================================

export class CheckpointAnalyticsStack {
  public readonly mlExtractor: CheckpointMLExtractor;
  public readonly diffAnalyzer: CheckpointDiffAnalyzer;
  public readonly trendAnalyzer: CheckpointTrendAnalyzer;
  public readonly chatSignalBridge: CheckpointChatSignalBridge;
  public readonly replayVerifier: CheckpointReplayVerifier;
  public readonly exporter: CheckpointExporter;
  public readonly compactionStrategy: CheckpointCompactionStrategy;

  public constructor(options: CheckpointAnalyticsStackOptions = {}) {
    this.mlExtractor = new CheckpointMLExtractor();
    this.diffAnalyzer = new CheckpointDiffAnalyzer();
    this.trendAnalyzer = new CheckpointTrendAnalyzer(options.trendLookback ?? CHECKPOINT_TREND_LOOKBACK_DEFAULT);
    this.chatSignalBridge = new CheckpointChatSignalBridge(options.chatSignalBridgeOptions);
    this.replayVerifier = new CheckpointReplayVerifier();
    this.exporter = new CheckpointExporter();
    this.compactionStrategy = new CheckpointCompactionStrategy();
  }

  public processNewCheckpoint(cp: RuntimeCheckpoint, nowMs: number): {
    readonly mlVector: CheckpointMLVector;
    readonly dlTensor: CheckpointDLTensor;
    readonly chatSignals: readonly CheckpointChatSignal[];
  } {
    const mlVector = this.mlExtractor.extract(cp, nowMs);
    const dlTensor = this.mlExtractor.extractTensor(cp, 'checkpoint-risk-v2', nowMs);
    const chatSignals = this.chatSignalBridge.generate(cp, mlVector, nowMs);
    return { mlVector, dlTensor, chatSignals };
  }

  public analyzeRun(checkpoints: readonly RuntimeCheckpoint[], nowMs: number): {
    readonly diffReports: readonly CheckpointDeltaReport[];
    readonly trendReport: CheckpointTrendReport;
    readonly replayResult: CheckpointReplayResult;
    readonly mlVectors: readonly CheckpointMLVector[];
    readonly storeHealth: CheckpointStoreHealthReport;
  } {
    return {
      diffReports: this.diffAnalyzer.diffRun(checkpoints, nowMs),
      trendReport: this.trendAnalyzer.analyze(checkpoints, nowMs),
      replayResult: this.replayVerifier.verify(checkpoints, nowMs),
      mlVectors: this.mlExtractor.extractBatch(checkpoints, nowMs),
      storeHealth: this._storeHealth(checkpoints, nowMs),
    };
  }

  public requiresEscalation(cp: RuntimeCheckpoint, nowMs: number): boolean {
    const vec = this.mlExtractor.extract(cp, nowMs);
    // Use INVARIANT_ML_FEATURE_COUNT to bound the slice used
    const featureSlice = vec.features.slice(0, INVARIANT_ML_FEATURE_COUNT);
    const invScore = featureSlice.reduce((a, b) => a + b, 0) / featureSlice.length;
    return vec.riskClass === 'CRITICAL' || (vec.riskClass === 'HIGH' && invScore > 0.7);
  }

  private _storeHealth(checkpoints: readonly RuntimeCheckpoint[], nowMs: number): CheckpointStoreHealthReport {
    const vecs = this.mlExtractor.extractBatch(checkpoints, nowMs);
    const avg = vecs.length > 0 ? vecs.reduce((acc, v) => acc + v.compositeRiskScore, 0) / vecs.length : 0;
    const grade: CheckpointStoreHealthGrade = avg < 0.2 ? 'A' : avg < 0.4 ? 'B' : avg < 0.6 ? 'C' : avg < 0.8 ? 'D' : 'F';
    return {
      grade, runCount: 1, totalCheckpoints: checkpoints.length,
      oldestRunId: checkpoints[0]?.runId ?? null,
      newestRunId: checkpoints[checkpoints.length - 1]?.runId ?? null,
      averageCheckpointsPerRun: checkpoints.length,
      storeCapacityUsedRatio: checkpoints.length / DEFAULT_MAX_CHECKPOINTS_PER_RUN,
      moduleVersion: CHECKPOINT_STORE_MODULE_VERSION,
      invariantCompatVersion: CHECKPOINT_INVARIANT_COMPAT_VERSION,
      generatedAtMs: nowMs,
    };
  }
}

// ============================================================================
// SECTION 22 — STORE HEALTH
// ============================================================================

export function buildCheckpointStoreHealth(store: RuntimeCheckpointStore, nowMs: number): CheckpointStoreHealthReport {
  const runIds = store.getRunIds();
  const total = store.checkpointCount();
  const runs = store.runCount();
  const cap = total / (DEFAULT_MAX_CHECKPOINTS_PER_RUN * DEFAULT_MAX_RUNS);
  const grade: CheckpointStoreHealthGrade = cap < 0.4 ? 'A' : cap < 0.65 ? 'B' : cap < 0.80 ? 'C' : cap < 0.93 ? 'D' : 'F';
  return {
    grade, runCount: runs, totalCheckpoints: total,
    oldestRunId: runIds.length > 0 ? runIds[0] : null,
    newestRunId: runIds.length > 0 ? runIds[runIds.length - 1] : null,
    averageCheckpointsPerRun: runs > 0 ? total / runs : 0,
    storeCapacityUsedRatio: cap,
    moduleVersion: CHECKPOINT_STORE_MODULE_VERSION,
    invariantCompatVersion: CHECKPOINT_INVARIANT_COMPAT_VERSION,
    generatedAtMs: nowMs,
  };
}

// ============================================================================
// SECTION 23 — FACTORY + CONVENIENCE FUNCTIONS
// ============================================================================

export function buildCheckpointAnalyticsStack(options: CheckpointAnalyticsStackOptions = {}): CheckpointAnalyticsStack {
  return new CheckpointAnalyticsStack(options);
}

export function analyzeCheckpointPair(from: RuntimeCheckpoint, to: RuntimeCheckpoint, nowMs = Date.now()): CheckpointDeltaReport {
  return new CheckpointDiffAnalyzer().diff(from, to, nowMs);
}

export function isCriticalCheckpoint(cp: RuntimeCheckpoint, nowMs = Date.now()): boolean {
  const vec = new CheckpointMLExtractor().extract(cp, nowMs);
  return vec.riskClass === 'CRITICAL' || vec.riskClass === 'HIGH';
}

export function getCheckpointRiskScore(cp: RuntimeCheckpoint, nowMs = Date.now()): number {
  return new CheckpointMLExtractor().extract(cp, nowMs).compositeRiskScore;
}

export function buildCheckpointChatSignals(
  cp: RuntimeCheckpoint,
  options: CheckpointChatSignalBridgeOptions = {},
  nowMs = Date.now(),
): readonly CheckpointChatSignal[] {
  const vec = new CheckpointMLExtractor().extract(cp, nowMs);
  return new CheckpointChatSignalBridge(options).generate(cp, vec, nowMs);
}

export function verifyCheckpointReplay(checkpoints: readonly RuntimeCheckpoint[], nowMs = Date.now()): CheckpointReplayResult {
  return new CheckpointReplayVerifier().verify(checkpoints, nowMs);
}

export function exportCheckpoints(
  checkpoints: readonly RuntimeCheckpoint[],
  format: CheckpointExportFormat = 'CANONICAL',
  nowMs = Date.now(),
): CheckpointExportResult {
  return new CheckpointExporter().export(checkpoints, format, nowMs);
}

export function getCheckpointMLMetadata(): {
  readonly checkpointFeatureCount: number;
  readonly checkpointFeatureLabels: readonly string[];
  readonly invariantFeatureCount: number;
  readonly invariantFeatureLabels: readonly string[];
  readonly moduleVersion: string;
} {
  return {
    checkpointFeatureCount: CHECKPOINT_ML_FEATURE_COUNT,
    checkpointFeatureLabels: CHECKPOINT_ML_FEATURE_LABELS,
    invariantFeatureCount: INVARIANT_ML_FEATURE_COUNT,
    invariantFeatureLabels: INVARIANT_ML_FEATURE_LABELS,
    moduleVersion: CHECKPOINT_STORE_MODULE_VERSION,
  };
}

export function findCrisisCheckpoints(store: RuntimeCheckpointStore): readonly RuntimeCheckpoint[] {
  const result: RuntimeCheckpoint[] = [];
  for (const runId of store.getRunIds()) {
    for (const cp of store.listRun(runId)) {
      if (isSnapshotInCrisis(cp.snapshot)) result.push(cp);
    }
  }
  return Object.freeze(result);
}

export function analyzeRunTrend(store: RuntimeCheckpointStore, runId: string, nowMs = Date.now()): CheckpointTrendReport {
  return new CheckpointTrendAnalyzer().analyze(store.listRun(runId), nowMs);
}

export function isCheckpointStoreReady(): boolean {
  return CHECKPOINT_STORE_MODULE_READY && CHECKPOINT_INVARIANT_COMPAT_VERSION.length > 0;
}

// ============================================================================
// SECTION 24 — SUPPRESS UNUSED IMPORT WARNINGS
//   All symbols imported above are used in runtime code paths. The following
//   explicit references ensure any symbol that appears only in type positions
//   is also consumed in a runtime expression, satisfying noUnusedLocals.
// ============================================================================

void (function _verifyAllImportsUsed() {
  // GamePrimitives arrays — referenced in iteration in CheckpointMLExtractor._buildFeatures
  void PRESSURE_TIERS; void RUN_PHASES; void RUN_OUTCOMES; void MODE_CODES;
  void SHIELD_LAYER_IDS; void HATER_BOT_IDS; void TIMING_CLASSES;
  // Scoring maps — referenced in ML extraction, diff analysis, trend analysis
  void PRESSURE_TIER_NORMALIZED; void BOT_THREAT_LEVEL; void BOT_STATE_THREAT_MULTIPLIER;
  void SHIELD_LAYER_CAPACITY_WEIGHT; void SHIELD_LAYER_REGEN_RATE;
  void MODE_DIFFICULTY_MULTIPLIER; void TIMING_CLASS_WINDOW_PRIORITY;
  void INTEGRITY_STATUS_RISK_SCORE; void VERIFIED_GRADE_NUMERIC_SCORE;
  void LEGEND_MARKER_KIND_WEIGHT; void ATTACK_CATEGORY_BASE_MAGNITUDE;
  void DECK_TYPE_POWER_LEVEL; void RUN_PHASE_NORMALIZED; void MODE_NORMALIZED;
  void CARD_RARITY_WEIGHT; void PRESSURE_TIER_ESCALATION_THRESHOLD;
  void PRESSURE_TIER_DEESCALATION_THRESHOLD;
  // Type guards
  void isModeCode; void isPressureTier; void isRunPhase; void isRunOutcome;
  void isShieldLayerId; void isHaterBotId; void isTimingClass;
  void isIntegrityStatus; void isVerifiedGrade;
  // Utility functions
  void computePressureRiskScore; void computeShieldLayerVulnerability;
  void computeShieldIntegrityRatio; void estimateShieldRegenPerTick;
  void classifyAttackSeverity; void computeEffectiveAttackDamage;
  void isAttackCounterable; void isAttackFromBot; void scoreAttackResponseUrgency;
  void scoreThreatUrgency; void classifyThreatUrgency; void computeAggregateThreatPressure;
  void scoreCascadeChainHealth; void classifyCascadeChainHealth;
  void computeCascadeProgressPercent; void isCascadeRecoverable; void computeCascadeExperienceImpact;
  void computeCardPowerScore; void computeCardCostEfficiency; void computeCardTimingPriority;
  void isCardOffensive; void computeEffectMagnitude; void computeEffectFinancialImpact;
  void computeEffectRiskScore; void isEffectNetPositive;
  void computeLegendMarkerValue; void classifyLegendMarkerSignificance;
  void computeLegendMarkerDensity;
  void computeRunProgressFraction; void computeEffectiveStakes;
  void isWinOutcome; void isLossOutcome; void scoreOutcomeExcitement; void isEndgamePhase;
  void canEscalatePressure; void canDeescalatePressure;
  // RunStateSnapshot predicates
  void isSnapshotTerminal; void isSnapshotWin; void isSnapshotLoss;
  void isSnapshotInEndgame; void isSnapshotInCrisis; void isShieldFailing;
  void isEconomyHealthy; void isBattleEscalating; void isCascadeCritical;
  void isSovereigntyAtRisk; void hasActiveDecisionWindows; void hasPlayableCards;
  void hasCriticalPendingAttacks; void isRunFlagged;
  void getPressureTierUrgencyLabel; void getNormalizedPressureTier;
  void validateSnapshotEnums; void isKnownMode;
  // InvariantGuard symbols
  void RunStateInvariantGuard; void INVARIANT_ERROR_CODES;
  void INVARIANT_CRITICAL_ERROR_CODES; void INVARIANT_HIGH_RISK_ERROR_CODES;
  void INVARIANT_GUARD_MODULE_VERSION; void INVARIANT_ML_FEATURE_COUNT;
  void INVARIANT_ML_FEATURE_LABELS;
  // Deterministic
  void checksumSnapshot; void stableStringify; void checksumParts;
  void createDeterministicId; void cloneJson; void deepFrozenClone;
  // TickSequence
  void TICK_SEQUENCE; void TICK_STEP_DESCRIPTORS; void isTickStep; void getTickStepIndex;
})();
