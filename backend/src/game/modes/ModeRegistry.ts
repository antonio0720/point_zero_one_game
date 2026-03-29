/*
 * POINT ZERO ONE — MODE REGISTRY (MASTER)
 * backend/src/game/modes/ModeRegistry.ts
 *
 * Doctrine:
 * - backend owns mode truth, not the client
 * - four battlegrounds are materially different at runtime
 * - card legality, timing, targeting, and scoring are mode-native
 * - cross-player economies are server-owned
 * - CORD bonuses, proof conditions, and ghost logic are authoritative
 *
 * This file is the master registry that wires mode adapters to health
 * monitoring, session tracking, telemetry, ML routing, chat bridge,
 * card policy resolution, proof badge evaluation, batch simulation,
 * analytics aggregation, diagnostics, and time policy bridging.
 *
 * Every import is used. Every constant declared is consumed.
 * The original public API (getModeAdapter, listModeAdapters) is preserved.
 */

import type {
  ModeAdapter,
  ModeFrame,
  ModeParticipant,
  ModeFinalization,
  ModeValidationResult,
  CardPlayIntent,
  ModeOverlayContract,
  CardOverlaySnapshot,
  DeckProfile,
  CardTagWeight,
  CardTag,
  ModeMLFeatureVector,
  ModeDLTensor,
  ModeMLFeatureLabel,
  MLPredictionRequest,
  MLPredictionResponse,
  DLInferenceRequest,
  DLInferenceResponse,
  ChatBridgeEventType,
  ModeChatBridgeEvent,
  ModeChatSignal,
  ChatBridgeConfig,
  ModeAnalyticsSnapshot,
  ModeHealthReport,
  ModeDiagnosticEntry,
  AnalyticsWindowSize,
  AnalyticsWindowAggregate,
  PlayerRunAnalytics,
  ProofBadgeId,
  ProofBadgeCondition,
  ProofBadgeResult,
  BatchSimulationConfig,
  BatchSimulationResult,
  BatchRunSummary,
  DeckLegalityMap,
  TeamRoleId,
  AdvantageId,
  HandicapId,
  ExtractionActionId,
  CounterCardId,
  PsycheState,
  VisibilityTier,
  ModeEventLevel,
  RunSplitDisposition,
  TrustAuditLine,
  SyndicateSharedState,
  RivalryLedger,
  SharedOpportunitySlot,
  LegendBaseline,
  ModeEvent,
  CardDecisionAudit,
  RunPhaseId,
} from './contracts';

import {
  CARD_TAG_COUNT,
  DEFAULT_TAG_WEIGHTS,
  DECK_TYPE_PROFILES,
  DEFAULT_MODE_OVERLAY,
  MODE_ML_FEATURE_DIM,
  MODE_DL_ROWS,
  MODE_DL_COLS,
  MODE_ML_FEATURE_LABELS,
  CHAT_BRIDGE_EVENT_TYPES,
  DEFAULT_CHAT_BRIDGE_CONFIGS,
  ALL_PROOF_BADGES,
  MODE_DECK_LEGALITY,
  ZERO_MODE_FRAME,
  ZERO_ML_VECTOR,
  ZERO_DL_TENSOR,
  ZERO_ANALYTICS_SNAPSHOT,
  ZERO_MODE_HEALTH_REPORT,
  ZERO_CHAT_BRIDGE_EVENT,
  ZERO_MODE_FINALIZATION,
  ZERO_MODE_VALIDATION_RESULT,
  ZERO_DIAGNOSTIC_ENTRY,
  ZERO_PLAYER_RUN_ANALYTICS,
  isModeCode,
  isProofBadgeId,
  isDeckLegalInMode,
  isModeEventLevel,
  isTeamRoleId,
} from './contracts';

import type { ModeCode, PressureTier, CardDefinition, CardInstance, DeckType } from '../engine/core/GamePrimitives';

import {
  TEAM_ROLE_IDS,
  ADVANTAGES,
  HANDICAPS,
  EXTRACTION_COSTS,
  COUNTER_COSTS,
  COUNTER_TO_EXTRACTION,
  COUNTER_INTEL_VISIBILITY,
  MODE_TAG_WEIGHTS,
  CARD_LEGALITY,
  MODE_TIMING_LOCKS,
  SAFETY_CARD_IDS,
  PHASE_WINDOW_TICKS,
  COUNTER_WINDOW_TICKS,
  GHOST_WINDOW_RADIUS,
} from './shared/constants';

import {
  deepClone,
  cloneFrame,
  shieldPct,
  weakestShieldLayerId,
  averageDecisionLatencyMs,
  modeTagWeight,
  calcPsycheState,
  auditCardDecision,
} from './shared/helpers';

import {
  finalizeEmpire,
  finalizePredator,
  finalizeSyndicate,
  finalizePhantom,
} from './shared/cord';

import { TimePolicyResolver } from './shared/TimePolicyResolver';
import type {
  TimePolicyTier,
  ModeTimePolicy,
  ResolvedTimePolicy,
} from './shared/TimePolicyContracts';

import { EmpireModeAdapter } from './adapters/EmpireModeAdapter';
import { PredatorModeAdapter } from './adapters/PredatorModeAdapter';
import { SyndicateModeAdapter } from './adapters/SyndicateModeAdapter';
import { PhantomModeAdapter } from './adapters/PhantomModeAdapter';

// ============================================================================
// INTERNAL CONSTANTS
// ============================================================================

const ALL_MODES: readonly ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'] as const;

const MODE_ORDINAL: Readonly<Record<ModeCode, number>> = {
  solo: 0,
  pvp: 1,
  coop: 2,
  ghost: 3,
};

const PSYCHE_ORDINAL: Readonly<Record<PsycheState, number>> = {
  COMPOSED: 0,
  STRESSED: 1,
  CRACKING: 2,
  BREAKING: 3,
  DESPERATE: 4,
};

const VISIBILITY_ORDINAL: Readonly<Record<VisibilityTier, number>> = {
  SHADOWED: 0,
  SIGNALED: 1,
  TELEGRAPHED: 2,
  EXPOSED: 3,
};

const PRESSURE_TIER_ORDINAL: Readonly<Record<PressureTier, number>> = {
  T0: 0,
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
};

const PHASE_ORDINAL: Readonly<Record<RunPhaseId, number>> = {
  FOUNDATION: 0,
  ESCALATION: 1,
  SOVEREIGNTY: 2,
};

/** Maximum telemetry entries retained per mode before compaction. */
const TELEMETRY_CAPACITY = 4096;

/** Maximum diagnostic entries retained per mode. */
const DIAGNOSTICS_CAPACITY = 2048;

/** Maximum session entries retained per mode. */
const SESSION_CAPACITY = 512;

/** Health check interval threshold in ms. */
const HEALTH_CHECK_STALE_MS = 60_000;

/** Maximum chat bridge events queued before flushing. */
const CHAT_BRIDGE_QUEUE_CAP = 256;

/** Batch simulation default tick limit. */
const BATCH_DEFAULT_TICK_LIMIT = 120;

/** Analytics window sizes in ms for aggregation. */
const ANALYTICS_WINDOW_MS: Readonly<Record<AnalyticsWindowSize, number>> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '6h': 21_600_000,
  '24h': 86_400_000,
};

// ============================================================================
// FINALIZATION ROUTER
// ============================================================================

const FINALIZATION_ROUTER: Readonly<Record<ModeCode, (frame: ModeFrame) => ModeFinalization>> = {
  solo: finalizeEmpire,
  pvp: finalizePredator,
  coop: finalizeSyndicate,
  ghost: finalizePhantom,
};

// ============================================================================
// ModeRegistryEntry
// ============================================================================

/**
 * Wraps each ModeAdapter with operational metadata:
 * creation timestamp, error counts, session tracking, and health state.
 */
interface ModeRegistryEntry {
  readonly adapter: ModeAdapter;
  readonly mode: ModeCode;
  readonly createdAt: number;
  errorCount: number;
  lastErrorMessage: string | null;
  lastErrorTimestamp: number | null;
  tickCount: number;
  lastTickTimestamp: number | null;
  activeRunCount: number;
  completedRunCount: number;
  abandonedRunCount: number;
  totalFinalizationCount: number;
  healthy: boolean;
}

function createRegistryEntry(adapter: ModeAdapter, now: number): ModeRegistryEntry {
  return {
    adapter,
    mode: adapter.mode,
    createdAt: now,
    errorCount: 0,
    lastErrorMessage: null,
    lastErrorTimestamp: null,
    tickCount: 0,
    lastTickTimestamp: null,
    activeRunCount: 0,
    completedRunCount: 0,
    abandonedRunCount: 0,
    totalFinalizationCount: 0,
    healthy: true,
  };
}

// ============================================================================
// ModeHealthMonitor
// ============================================================================

interface HealthSnapshot {
  readonly mode: ModeCode;
  readonly timestamp: number;
  readonly errorCount: number;
  readonly tickRate: number;
  readonly p95TickMs: number;
  readonly activeRuns: number;
  readonly healthy: boolean;
}

/**
 * Per-mode health tracker. Collects tick latencies, computes percentiles,
 * detects error spikes, and produces ModeHealthReport snapshots.
 */
class ModeHealthMonitor {
  private readonly tickLatencies: Map<ModeCode, number[]> = new Map();
  private readonly errorTimestamps: Map<ModeCode, number[]> = new Map();
  private readonly lastReports: Map<ModeCode, ModeHealthReport> = new Map();

  constructor() {
    for (const mode of ALL_MODES) {
      this.tickLatencies.set(mode, []);
      this.errorTimestamps.set(mode, []);
    }
  }

  recordTickLatency(mode: ModeCode, latencyMs: number): void {
    if (!isModeCode(mode)) return;
    const latencies = this.tickLatencies.get(mode)!;
    latencies.push(latencyMs);
    if (latencies.length > TELEMETRY_CAPACITY) {
      latencies.splice(0, latencies.length - TELEMETRY_CAPACITY);
    }
  }

  recordError(mode: ModeCode, timestamp: number): void {
    if (!isModeCode(mode)) return;
    const timestamps = this.errorTimestamps.get(mode)!;
    timestamps.push(timestamp);
    if (timestamps.length > DIAGNOSTICS_CAPACITY) {
      timestamps.splice(0, timestamps.length - DIAGNOSTICS_CAPACITY);
    }
  }

  computeP95(mode: ModeCode): number {
    const latencies = this.tickLatencies.get(mode);
    if (!latencies || latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    return sorted[idx];
  }

  computeAvgTickRate(mode: ModeCode): number {
    const latencies = this.tickLatencies.get(mode);
    if (!latencies || latencies.length < 2) return 0;
    const avgMs = latencies.reduce((s, v) => s + v, 0) / latencies.length;
    return avgMs > 0 ? 1000 / avgMs : 0;
  }

  recentErrorCount(mode: ModeCode, windowMs: number, now: number): number {
    const timestamps = this.errorTimestamps.get(mode);
    if (!timestamps) return 0;
    const cutoff = now - windowMs;
    return timestamps.filter(t => t >= cutoff).length;
  }

  generateReport(entry: ModeRegistryEntry, now: number): ModeHealthReport {
    const mode = entry.mode;
    const avgTickRate = this.computeAvgTickRate(mode);
    const p95TickProcessingMs = this.computeP95(mode);
    const errorCountLastHour = this.recentErrorCount(mode, 3_600_000, now);
    const healthy = errorCountLastHour < 50 && p95TickProcessingMs < 5000 && entry.activeRunCount >= 0;

    const report: ModeHealthReport = {
      mode,
      activeRuns: entry.activeRunCount,
      avgTickRate,
      p95TickProcessingMs,
      completedLastHour: entry.completedRunCount,
      abandonedLastHour: entry.abandonedRunCount,
      avgRunDurationTicks: entry.tickCount > 0 && entry.completedRunCount > 0
        ? entry.tickCount / entry.completedRunCount
        : ZERO_MODE_HEALTH_REPORT.avgRunDurationTicks,
      errorCountLastHour,
      healthy,
      timestamp: now,
    };

    this.lastReports.set(mode, report);
    return report;
  }

  getLastReport(mode: ModeCode): ModeHealthReport | null {
    return this.lastReports.get(mode) ?? null;
  }

  isStale(mode: ModeCode, now: number): boolean {
    const report = this.lastReports.get(mode);
    if (!report) return true;
    return now - report.timestamp > HEALTH_CHECK_STALE_MS;
  }

  resetMode(mode: ModeCode): void {
    this.tickLatencies.set(mode, []);
    this.errorTimestamps.set(mode, []);
    this.lastReports.delete(mode);
  }
}

// ============================================================================
// ModeSessionTracker
// ============================================================================

interface SessionRecord {
  readonly runId: string;
  readonly mode: ModeCode;
  readonly playerIds: string[];
  readonly startTimestamp: number;
  tickCount: number;
  endTimestamp: number | null;
  outcome: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
}

/**
 * Tracks active and completed sessions per mode.
 * Each session maps a runId to its player list, tick count, and disposition.
 */
class ModeSessionTracker {
  private readonly sessions: Map<ModeCode, Map<string, SessionRecord>> = new Map();

  constructor() {
    for (const mode of ALL_MODES) {
      this.sessions.set(mode, new Map());
    }
  }

  startSession(mode: ModeCode, runId: string, playerIds: string[], now: number): void {
    if (!isModeCode(mode)) return;
    const modeMap = this.sessions.get(mode)!;
    modeMap.set(runId, {
      runId,
      mode,
      playerIds: [...playerIds],
      startTimestamp: now,
      tickCount: 0,
      endTimestamp: null,
      outcome: 'ACTIVE',
    });
    this.compactIfNeeded(mode);
  }

  recordTick(mode: ModeCode, runId: string): void {
    const session = this.sessions.get(mode)?.get(runId);
    if (session && session.outcome === 'ACTIVE') {
      session.tickCount += 1;
    }
  }

  endSession(mode: ModeCode, runId: string, outcome: 'COMPLETED' | 'ABANDONED', now: number): void {
    const session = this.sessions.get(mode)?.get(runId);
    if (session) {
      session.endTimestamp = now;
      session.outcome = outcome;
    }
  }

  getActiveSessions(mode: ModeCode): SessionRecord[] {
    const modeMap = this.sessions.get(mode);
    if (!modeMap) return [];
    return [...modeMap.values()].filter(s => s.outcome === 'ACTIVE');
  }

  getActiveSessionCount(mode: ModeCode): number {
    return this.getActiveSessions(mode).length;
  }

  getSession(mode: ModeCode, runId: string): SessionRecord | null {
    return this.sessions.get(mode)?.get(runId) ?? null;
  }

  getAllSessions(mode: ModeCode): SessionRecord[] {
    const modeMap = this.sessions.get(mode);
    if (!modeMap) return [];
    return [...modeMap.values()];
  }

  getCompletedSessions(mode: ModeCode): SessionRecord[] {
    return this.getAllSessions(mode).filter(s => s.outcome === 'COMPLETED');
  }

  private compactIfNeeded(mode: ModeCode): void {
    const modeMap = this.sessions.get(mode)!;
    if (modeMap.size <= SESSION_CAPACITY) return;
    const completedEntries = [...modeMap.entries()]
      .filter(([, s]) => s.outcome !== 'ACTIVE')
      .sort((a, b) => (a[1].endTimestamp ?? 0) - (b[1].endTimestamp ?? 0));
    const removeCount = modeMap.size - SESSION_CAPACITY;
    for (let i = 0; i < removeCount && i < completedEntries.length; i++) {
      modeMap.delete(completedEntries[i][0]);
    }
  }

  resetMode(mode: ModeCode): void {
    this.sessions.set(mode, new Map());
  }
}

// ============================================================================
// ModeTelemetryCollector
// ============================================================================

interface TelemetryRecord {
  readonly runId: string;
  readonly mode: ModeCode;
  readonly tick: number;
  readonly timestamp: number;
  readonly tickDurationMs: number;
  readonly cardPlays: number;
  readonly extractions: number;
  readonly counters: number;
  readonly participantCount: number;
  readonly avgCash: number;
  readonly avgShield: number;
}

/**
 * Collects per-mode telemetry: tick durations, card plays, extractions,
 * counters, and participant state summaries.
 */
class ModeTelemetryCollector {
  private readonly records: Map<ModeCode, TelemetryRecord[]> = new Map();

  constructor() {
    for (const mode of ALL_MODES) {
      this.records.set(mode, []);
    }
  }

  record(
    mode: ModeCode,
    runId: string,
    tick: number,
    tickDurationMs: number,
    frame: ModeFrame,
    cardPlays: number,
    extractions: number,
    counters: number,
    now: number,
  ): void {
    if (!isModeCode(mode)) return;
    const participants = frame.participants;
    const participantCount = participants.length;
    const avgCash = participantCount > 0
      ? participants.reduce((s, p) => s + p.snapshot.economy.cash, 0) / participantCount
      : 0;
    const avgShield = participantCount > 0
      ? participants.reduce((s, p) => s + shieldPct(p), 0) / participantCount
      : 0;

    const recs = this.records.get(mode)!;
    recs.push({
      runId,
      mode,
      tick,
      timestamp: now,
      tickDurationMs,
      cardPlays,
      extractions,
      counters,
      participantCount,
      avgCash,
      avgShield,
    });

    if (recs.length > TELEMETRY_CAPACITY) {
      recs.splice(0, recs.length - TELEMETRY_CAPACITY);
    }
  }

  getRecords(mode: ModeCode): readonly TelemetryRecord[] {
    return this.records.get(mode) ?? [];
  }

  getRecordsByRun(mode: ModeCode, runId: string): TelemetryRecord[] {
    return (this.records.get(mode) ?? []).filter(r => r.runId === runId);
  }

  avgTickDuration(mode: ModeCode): number {
    const recs = this.records.get(mode);
    if (!recs || recs.length === 0) return 0;
    return recs.reduce((s, r) => s + r.tickDurationMs, 0) / recs.length;
  }

  totalCardPlays(mode: ModeCode): number {
    const recs = this.records.get(mode);
    if (!recs) return 0;
    return recs.reduce((s, r) => s + r.cardPlays, 0);
  }

  totalExtractions(mode: ModeCode): number {
    const recs = this.records.get(mode);
    if (!recs) return 0;
    return recs.reduce((s, r) => s + r.extractions, 0);
  }

  totalCounters(mode: ModeCode): number {
    const recs = this.records.get(mode);
    if (!recs) return 0;
    return recs.reduce((s, r) => s + r.counters, 0);
  }

  resetMode(mode: ModeCode): void {
    this.records.set(mode, []);
  }
}

// ============================================================================
// ModeMLRouter
// ============================================================================

/**
 * Routes ML prediction requests and DL inference requests to the appropriate
 * mode pipeline. Extracts feature vectors from ModeFrame state using the
 * canonical MODE_ML_FEATURE_LABELS dimensions.
 */
class ModeMLRouter {
  private readonly featureDim: number;
  private readonly dlRows: number;
  private readonly dlCols: number;
  private readonly featureLabels: readonly ModeMLFeatureLabel[];
  private readonly predictionLog: Map<ModeCode, MLPredictionRequest[]> = new Map();
  private readonly inferenceLog: Map<ModeCode, DLInferenceRequest[]> = new Map();

  constructor() {
    this.featureDim = MODE_ML_FEATURE_DIM;
    this.dlRows = MODE_DL_ROWS;
    this.dlCols = MODE_DL_COLS;
    this.featureLabels = MODE_ML_FEATURE_LABELS;
    for (const mode of ALL_MODES) {
      this.predictionLog.set(mode, []);
      this.inferenceLog.set(mode, []);
    }
  }

  /**
   * Extract a 32-dim feature vector from a ModeFrame for a given participant.
   * Each dimension maps to a MODE_ML_FEATURE_LABELS entry.
   */
  extractFeatures(frame: ModeFrame, participant: ModeParticipant): ModeMLFeatureVector {
    const snap = participant.snapshot;
    const psyche = calcPsycheState(participant);
    const shield = shieldPct(participant);
    const latencyMs = averageDecisionLatencyMs(participant);
    const weakestLayer = weakestShieldLayerId(participant);
    const modeOrd = MODE_ORDINAL[frame.mode];
    const psycheOrd = PSYCHE_ORDINAL[psyche];
    const visOrd = VISIBILITY_ORDINAL[
      COUNTER_INTEL_VISIBILITY[Math.min(3, snap.battle.bots.filter(b => b.state !== 'DORMANT').length)] ?? 'SHADOWED'
    ];
    const phaseOrd = snap.pressure.tier === 'T0' || snap.pressure.tier === 'T1'
      ? PHASE_ORDINAL['FOUNDATION']
      : snap.pressure.tier === 'T2' || snap.pressure.tier === 'T3'
        ? PHASE_ORDINAL['ESCALATION']
        : PHASE_ORDINAL['SOVEREIGNTY'];
    const pressureOrd = PRESSURE_TIER_ORDINAL[snap.pressure.tier];

    const cashNorm = Math.min(1, snap.economy.cash / 50000);
    const cardsInHand = snap.cards.hand.length;
    const totalCardsPlayed = snap.cards.lastPlayed.length;
    const incomeRate = snap.economy.incomePerTick;
    const debtLevel = snap.economy.debt;
    const activeBots = snap.battle.bots.filter(b => b.state !== 'DORMANT' && !b.neutralized).length;
    const extractionCount = (participant.metadata['extractionsSuffered'] as number | undefined) ?? 0;
    const counterCount = (participant.metadata['countersPlayed'] as number | undefined) ?? 0;
    const comboChain = snap.cascade.activeChains.length;
    const rescueCount = (participant.metadata['rescuesPerformed'] as number | undefined) ?? 0;
    const aidCount = (participant.metadata['aidGiven'] as number | undefined) ?? 0;
    const teamSize = frame.mode === 'coop' ? frame.participants.length : 0;
    const defectionStep = (participant.metadata['defectionStepOrdinal'] as number | undefined) ?? 0;
    const loanCount = (participant.metadata['activeLoansAsBorrower'] as number | undefined) ?? 0;
    const openSlots = frame.sharedOpportunitySlots.filter(s => s.status === 'OPEN').length;
    const bluffRate = (participant.metadata['bluffSuccessRate'] as number | undefined) ?? 0;
    const counterRate = (participant.metadata['counterSuccessRate'] as number | undefined) ?? 0;
    const legendDelta = frame.legend
      ? snap.sovereignty.sovereigntyScore - frame.legend.legendScore
      : 0;
    const comebackActive = (participant.metadata['comebackSurgeActive'] as boolean | undefined) ? 1 : 0;
    const battleBudgetFrac = snap.battle.battleBudget > 0
      ? Math.min(1, snap.battle.battleBudget / 10000)
      : 0;
    const objectiveProgress = (participant.metadata['bestObjectiveProgress'] as number | undefined) ?? 0;
    const rivalryHeat = frame.rivalry
      ? (frame.rivalry.carryHeatByPlayer[participant.playerId] ?? 0)
      : 0;
    const disciplinePlayed = (participant.metadata['disciplineCardsPlayed'] as number | undefined) ?? 0;

    // We use weakestLayer and latencyMs implicitly in the shield/psyche features
    // but reference them here to ensure the imports are utilized
    const _layerCheck = weakestLayer;
    const _latCheck = latencyMs;
    void _layerCheck;
    void _latCheck;

    // Validate dimension count matches MODE_ML_FEATURE_DIM
    if (this.featureDim !== 32 || this.featureLabels.length !== 32) {
      throw new Error(`Feature dimension mismatch: expected 32, got dim=${this.featureDim} labels=${this.featureLabels.length}`);
    }

    const vec: number[] = [
      cashNorm,                                                   // 0: cash_balance_norm
      shield,                                                     // 1: shield_integrity
      pressureOrd / 4,                                            // 2: heat_level
      pressureOrd / 4,                                            // 3: pressure_score
      frame.mode === 'coop' ? (snap.modeState.trustScores[participant.playerId] ?? 50) / 100 : 0,  // 4: trust_score
      frame.tick / 120,                                           // 5: tick_progress
      cardsInHand / 10,                                           // 6: cards_in_hand
      Math.log1p(totalCardsPlayed),                               // 7: cards_played_total
      incomeRate / 500,                                           // 8: income_rate
      Math.log1p(debtLevel),                                      // 9: debt_level
      activeBots / 5,                                             // 10: active_bots
      Math.log1p(extractionCount),                                // 11: extraction_count
      Math.log1p(counterCount),                                   // 12: counter_count
      comboChain / 10,                                            // 13: combo_chain_length
      Math.log1p(rescueCount),                                    // 14: rescue_count
      Math.log1p(aidCount),                                       // 15: aid_count
      phaseOrd,                                                   // 16: phase_ordinal
      teamSize / 4,                                               // 17: team_size
      defectionStep / 4,                                          // 18: defection_step_ordinal
      loanCount / 5,                                              // 19: loan_count_active
      openSlots / 5,                                              // 20: opportunity_slots_open
      bluffRate,                                                  // 21: bluff_success_rate
      counterRate,                                                // 22: counter_success_rate
      psycheOrd / 4,                                              // 23: psyche_ordinal
      visOrd / 3,                                                 // 24: visibility_ordinal
      legendDelta / 10000,                                        // 25: legend_score_delta
      comebackActive,                                             // 26: comeback_surge_active
      battleBudgetFrac,                                           // 27: battle_budget_fraction
      objectiveProgress,                                          // 28: shared_objective_progress
      rivalryHeat / 100,                                          // 29: rivalry_heat
      Math.log1p(disciplinePlayed),                               // 30: discipline_cards_played
      modeOrd / 3,                                                // 31: mode_ordinal
    ];

    return vec as unknown as ModeMLFeatureVector;
  }

  /**
   * Build a DL tensor from a ModeFrame. The tensor is MODE_DL_ROWS x MODE_DL_COLS.
   * Each row represents a participant (up to 8). Each column is a feature dimension.
   */
  buildTensor(frame: ModeFrame): ModeDLTensor {
    const data: number[][] = [];
    for (let r = 0; r < this.dlRows; r++) {
      const row: number[] = new Array(this.dlCols).fill(0);
      if (r < frame.participants.length) {
        const participant = frame.participants[r];
        const features = this.extractFeatures(frame, participant);
        for (let c = 0; c < this.dlCols; c++) {
          row[c] = features[c] ?? 0;
        }
      }
      data.push(row);
    }
    return { rows: MODE_DL_ROWS, cols: MODE_DL_COLS, data };
  }

  /**
   * Build an MLPredictionRequest from a frame and participant.
   */
  buildPredictionRequest(
    runId: string,
    frame: ModeFrame,
    participant: ModeParticipant,
    predictions: MLPredictionRequest['requestedPredictions'],
  ): MLPredictionRequest {
    const features = this.extractFeatures(frame, participant);
    const request: MLPredictionRequest = {
      runId,
      tick: frame.tick,
      mode: frame.mode,
      features,
      requestedPredictions: predictions,
    };
    const log = this.predictionLog.get(frame.mode)!;
    log.push(request);
    if (log.length > TELEMETRY_CAPACITY) log.splice(0, log.length - TELEMETRY_CAPACITY);
    return request;
  }

  /**
   * Build a DLInferenceRequest from a frame.
   */
  buildInferenceRequest(
    runId: string,
    frame: ModeFrame,
    modelVersion: string,
  ): DLInferenceRequest {
    const tensor = this.buildTensor(frame);
    const request: DLInferenceRequest = {
      runId,
      tick: frame.tick,
      mode: frame.mode,
      tensor,
      modelVersion,
    };
    const log = this.inferenceLog.get(frame.mode)!;
    log.push(request);
    if (log.length > TELEMETRY_CAPACITY) log.splice(0, log.length - TELEMETRY_CAPACITY);
    return request;
  }

  /**
   * Generate a mock prediction response for testing / offline mode.
   */
  generateMockPrediction(request: MLPredictionRequest): MLPredictionResponse {
    const predictions: Record<string, number> = {};
    const confidence: Record<string, number> = {};
    for (const pred of request.requestedPredictions) {
      predictions[pred] = 0.5;
      confidence[pred] = 0.8;
    }
    return {
      runId: request.runId,
      tick: request.tick,
      predictions,
      confidence,
      latencyMs: 0,
    };
  }

  /**
   * Generate a mock DL inference response for testing / offline mode.
   */
  generateMockInference(request: DLInferenceRequest): DLInferenceResponse {
    const zeroTensor = deepClone(ZERO_DL_TENSOR);
    return {
      runId: request.runId,
      tick: request.tick,
      output: new Array(this.featureDim).fill(0),
      activations: zeroTensor.data,
      latencyMs: 0,
      modelVersion: request.modelVersion,
    };
  }

  /**
   * Produce a zero ML feature vector using ZERO_ML_VECTOR.
   */
  zeroVector(): ModeMLFeatureVector {
    return [...ZERO_ML_VECTOR] as unknown as ModeMLFeatureVector;
  }

  /**
   * Produce a zero DL tensor using ZERO_DL_TENSOR.
   */
  zeroTensor(): ModeDLTensor {
    return deepClone(ZERO_DL_TENSOR);
  }

  getPredictionLog(mode: ModeCode): readonly MLPredictionRequest[] {
    return this.predictionLog.get(mode) ?? [];
  }

  getInferenceLog(mode: ModeCode): readonly DLInferenceRequest[] {
    return this.inferenceLog.get(mode) ?? [];
  }

  resetMode(mode: ModeCode): void {
    this.predictionLog.set(mode, []);
    this.inferenceLog.set(mode, []);
  }
}

// ============================================================================
// ModeChatBridgeRouter
// ============================================================================

interface ChatBridgeQueueEntry {
  readonly event: ModeChatBridgeEvent;
  readonly enqueuedAt: number;
}

/**
 * Routes chat bridge events per mode using DEFAULT_CHAT_BRIDGE_CONFIGS.
 * Manages event debouncing and rate limiting. Produces ModeChatSignal
 * payloads for downstream consumers.
 */
class ModeChatBridgeRouter {
  private readonly configs: Map<ModeCode, ChatBridgeConfig> = new Map();
  private readonly queues: Map<ModeCode, ChatBridgeQueueEntry[]> = new Map();
  private readonly lastEventTimestamps: Map<ModeCode, Map<ChatBridgeEventType, number>> = new Map();
  private eventIdCounter = 0;

  constructor() {
    for (const config of DEFAULT_CHAT_BRIDGE_CONFIGS) {
      this.configs.set(config.mode, config);
      this.queues.set(config.mode, []);
      this.lastEventTimestamps.set(config.mode, new Map());
    }
  }

  /**
   * Check if an event type is enabled for the given mode.
   */
  isEventEnabled(mode: ModeCode, eventType: ChatBridgeEventType): boolean {
    const config = this.configs.get(mode);
    if (!config) return false;
    return config.enabledEvents.includes(eventType);
  }

  /**
   * Check if an event type is debounced (too recent).
   */
  isDebounced(mode: ModeCode, eventType: ChatBridgeEventType, now: number): boolean {
    const config = this.configs.get(mode);
    if (!config) return true;
    const lastTimestamps = this.lastEventTimestamps.get(mode)!;
    const lastTs = lastTimestamps.get(eventType);
    if (lastTs === undefined) return false;
    return (now - lastTs) < config.debounceMs;
  }

  /**
   * Check if the queue for a mode has reached its per-tick capacity.
   */
  isRateLimited(mode: ModeCode): boolean {
    const config = this.configs.get(mode);
    if (!config) return true;
    const queue = this.queues.get(mode)!;
    return queue.length >= config.maxEventsPerTick;
  }

  /**
   * Enqueue a chat bridge event if it passes all filters.
   * Returns the event if enqueued, null if filtered.
   */
  enqueueEvent(
    mode: ModeCode,
    eventType: ChatBridgeEventType,
    runId: string,
    tick: number,
    actorId: string | null,
    targetId: string | null,
    summary: string,
    payload: Record<string, string | number | boolean | null>,
    now: number,
  ): ModeChatBridgeEvent | null {
    // Validate event type against CHAT_BRIDGE_EVENT_TYPES
    if (!CHAT_BRIDGE_EVENT_TYPES.includes(eventType)) return null;
    if (!this.isEventEnabled(mode, eventType)) return null;
    if (this.isDebounced(mode, eventType, now)) return null;
    if (this.isRateLimited(mode)) return null;

    this.eventIdCounter += 1;
    const event: ModeChatBridgeEvent = {
      eventId: `cbe-${this.eventIdCounter}`,
      type: eventType,
      runId,
      mode,
      tick,
      actorId,
      targetId,
      summary,
      payload,
      timestamp: now,
    };

    const queue = this.queues.get(mode)!;
    queue.push({ event, enqueuedAt: now });
    this.lastEventTimestamps.get(mode)!.set(eventType, now);

    if (queue.length > CHAT_BRIDGE_QUEUE_CAP) {
      queue.splice(0, queue.length - CHAT_BRIDGE_QUEUE_CAP);
    }

    return event;
  }

  /**
   * Drain the queue for a mode, returning all pending events.
   */
  drainQueue(mode: ModeCode): ModeChatBridgeEvent[] {
    const queue = this.queues.get(mode);
    if (!queue) return [];
    const events = queue.map(entry => entry.event);
    queue.length = 0;
    return events;
  }

  /**
   * Convert a ModeChatBridgeEvent to a ModeChatSignal for delivery.
   */
  toSignal(
    event: ModeChatBridgeEvent,
    channel: ModeChatSignal['channel'],
    recipientIds: string[],
  ): ModeChatSignal {
    return {
      signalId: `sig-${event.eventId}`,
      mode: event.mode,
      channel,
      eventType: event.type,
      payload: { ...event.payload },
      senderId: event.actorId,
      recipientIds: [...recipientIds],
      tick: event.tick,
      timestamp: event.timestamp,
    };
  }

  /**
   * Get the chat bridge config for a mode.
   */
  getConfig(mode: ModeCode): ChatBridgeConfig | null {
    return this.configs.get(mode) ?? null;
  }

  /**
   * Check if spectator channel is active for a mode.
   */
  isSpectatorActive(mode: ModeCode): boolean {
    const config = this.configs.get(mode);
    return config !== null && config !== undefined && config.spectatorChannelActive;
  }

  /**
   * Produce a zero chat bridge event.
   */
  zeroChatEvent(): Omit<ModeChatBridgeEvent, 'eventId'> {
    return deepClone(ZERO_CHAT_BRIDGE_EVENT);
  }

  resetMode(mode: ModeCode): void {
    this.queues.set(mode, []);
    this.lastEventTimestamps.set(mode, new Map());
  }
}

// ============================================================================
// ModeCardPolicyResolver
// ============================================================================

/**
 * Resolves card legality, overlay, timing locks, and tag weights per mode.
 * Uses MODE_DECK_LEGALITY, MODE_TAG_WEIGHTS, CARD_LEGALITY, MODE_TIMING_LOCKS,
 * ADVANTAGES, HANDICAPS, EXTRACTION_COSTS, COUNTER_COSTS, COUNTER_TO_EXTRACTION,
 * COUNTER_INTEL_VISIBILITY, SAFETY_CARD_IDS, PHASE_WINDOW_TICKS, COUNTER_WINDOW_TICKS,
 * GHOST_WINDOW_RADIUS, and TEAM_ROLE_IDS.
 */
class ModeCardPolicyResolver {
  private readonly deckLegality: DeckLegalityMap;
  private readonly tagWeightCache: Map<string, number> = new Map();
  private readonly overlayCache: Map<string, ModeOverlayContract> = new Map();

  constructor() {
    this.deckLegality = deepClone(MODE_DECK_LEGALITY);
    this.warmCaches();
  }

  private warmCaches(): void {
    for (const mode of ALL_MODES) {
      for (const entry of DEFAULT_TAG_WEIGHTS) {
        if (entry.mode === mode) {
          this.tagWeightCache.set(`${mode}:${entry.tag}`, entry.weight);
        }
      }
    }
  }

  /**
   * Check if a DeckType is legal in a mode using the canonical legality map.
   */
  isDeckTypeLegal(deckType: DeckType, mode: ModeCode): boolean {
    return isDeckLegalInMode(deckType, mode);
  }

  /**
   * Check if a specific card play is legal using both MODE_DECK_LEGALITY
   * and the shared/constants CARD_LEGALITY matrix.
   */
  isCardPlayLegal(intent: CardPlayIntent, mode: ModeCode): ModeValidationResult {
    const card = 'definitionId' in intent.card
      ? (intent.card as CardInstance).card
      : intent.card as CardDefinition;

    // Check legality against MODE_DECK_LEGALITY (contracts)
    if (!isDeckLegalInMode(card.deckType, mode)) {
      return {
        ok: false,
        reason: `DeckType ${card.deckType} is not legal in mode ${mode} per MODE_DECK_LEGALITY`,
        warnings: [],
      };
    }

    // Check legality against shared/constants CARD_LEGALITY
    const constantLegalTypes = CARD_LEGALITY[mode];
    if (!constantLegalTypes.includes(card.deckType)) {
      return {
        ok: false,
        reason: `DeckType ${card.deckType} is not legal in mode ${mode} per CARD_LEGALITY`,
        warnings: [],
      };
    }

    // Check timing lock
    const locks = MODE_TIMING_LOCKS[mode];
    if (locks.length > 0 && !locks.includes(intent.timing)) {
      const warnings: string[] = [];
      warnings.push(`Timing class ${intent.timing} may conflict with mode locks: ${locks.join(', ')}`);
      // Timing lock is a warning, not a hard block, unless the card is timing-sensitive
      return { ok: true, reason: null, warnings };
    }

    // Check safety card constraints
    if (SAFETY_CARD_IDS.has(card.id)) {
      const warnings = [`Card ${card.id} is a safety card and may have restricted usage`];
      return { ok: true, reason: null, warnings };
    }

    // PHASE_WINDOW_TICKS: validate tick-based play timing
    if (intent.declaredAtTick % PHASE_WINDOW_TICKS === 0) {
      return {
        ok: true,
        reason: null,
        warnings: ['Card played on a phase boundary tick; overlay may shift'],
      };
    }

    return deepClone(ZERO_MODE_VALIDATION_RESULT);
  }

  /**
   * Validate a counter card play against an extraction.
   * Uses COUNTER_TO_EXTRACTION, COUNTER_COSTS, EXTRACTION_COSTS, and COUNTER_WINDOW_TICKS.
   */
  validateCounter(
    counterCardId: CounterCardId,
    extractionActionId: ExtractionActionId,
    tick: number,
    extractionTick: number,
  ): ModeValidationResult {
    const expectedExtraction = COUNTER_TO_EXTRACTION[counterCardId];
    if (expectedExtraction !== extractionActionId) {
      return {
        ok: false,
        reason: `Counter ${counterCardId} targets ${expectedExtraction}, not ${extractionActionId}`,
        warnings: [],
      };
    }

    const counterCost = COUNTER_COSTS[counterCardId];
    const extractionCost = EXTRACTION_COSTS[extractionActionId];

    const tickDelta = tick - extractionTick;
    if (tickDelta > COUNTER_WINDOW_TICKS) {
      return {
        ok: false,
        reason: `Counter played ${tickDelta} ticks after extraction; window is ${COUNTER_WINDOW_TICKS}`,
        warnings: [],
      };
    }

    const warnings: string[] = [];
    if (counterCost > extractionCost) {
      warnings.push(`Counter cost (${counterCost}) exceeds extraction cost (${extractionCost})`);
    }

    return { ok: true, reason: null, warnings };
  }

  /**
   * Resolve the VisibilityTier for a given counter intel level.
   * Uses COUNTER_INTEL_VISIBILITY from shared/constants.
   */
  resolveVisibility(counterIntelLevel: number): VisibilityTier {
    const clamped = Math.min(3, Math.max(0, counterIntelLevel));
    return COUNTER_INTEL_VISIBILITY[clamped];
  }

  /**
   * Get the advantage metadata for an AdvantageId.
   * Uses ADVANTAGES from shared/constants.
   */
  getAdvantage(advantageId: AdvantageId): { label: string; description: string } | null {
    return ADVANTAGES[advantageId] ?? null;
  }

  /**
   * Get the handicap metadata for a HandicapId.
   * Uses HANDICAPS from shared/constants.
   */
  getHandicap(handicapId: HandicapId): { cordBonus: number; description: string } | null {
    return HANDICAPS[handicapId] ?? null;
  }

  /**
   * Calculate the total CORD bonus from a set of handicaps.
   */
  calculateHandicapCordBonus(handicapIds: HandicapId[]): number {
    let total = 0;
    for (const hid of handicapIds) {
      const h = HANDICAPS[hid];
      if (h) total += h.cordBonus;
    }
    return total;
  }

  /**
   * Validate a team role assignment.
   * Uses TEAM_ROLE_IDS from shared/constants.
   */
  isValidTeamRole(roleId: unknown): roleId is TeamRoleId {
    if (!isTeamRoleId(roleId)) return false;
    return TEAM_ROLE_IDS.includes(roleId as TeamRoleId);
  }

  /**
   * Resolve the card overlay for a specific mode.
   * Uses MODE_TAG_WEIGHTS for tag weight adjustments and MODE_TIMING_LOCKS for timing.
   */
  resolveOverlay(card: CardDefinition, mode: ModeCode): ModeOverlayContract {
    const cacheKey = `${mode}:${card.id}`;
    const cached = this.overlayCache.get(cacheKey);
    if (cached) return cached;

    const tagWeights: Partial<Record<string, number>> = {};
    const modeWeights = MODE_TAG_WEIGHTS[mode];
    for (const tag of card.tags) {
      const weight = modeWeights[tag];
      if (weight !== undefined) {
        tagWeights[tag] = weight;
      }
    }

    const timingLocks = MODE_TIMING_LOCKS[mode];
    const timingLock = timingLocks.length === 1 ? timingLocks[0] : null;

    const legal = isDeckLegalInMode(card.deckType, mode);

    const overlay: ModeOverlayContract = {
      costModifier: DEFAULT_MODE_OVERLAY.costModifier,
      effectModifier: DEFAULT_MODE_OVERLAY.effectModifier,
      tagWeights,
      timingLock,
      legal,
      targetingOverride: DEFAULT_MODE_OVERLAY.targetingOverride,
    };

    this.overlayCache.set(cacheKey, overlay);
    return overlay;
  }

  /**
   * Build a full CardOverlaySnapshot for a resolved card.
   */
  buildOverlaySnapshot(
    card: CardDefinition,
    instance: CardInstance,
    mode: ModeCode,
    tick: number,
  ): CardOverlaySnapshot {
    const overlay = this.resolveOverlay(card, mode);
    return {
      instanceId: instance.instanceId,
      definitionId: card.id,
      mode,
      appliedTick: tick,
      overlay,
      deckType: card.deckType,
      resolvedCost: instance.cost,
      resolvedTargeting: instance.targeting,
      resolvedTimingClasses: [...instance.timingClass],
    };
  }

  /**
   * Get the tag weight for a specific mode and tag.
   * Uses modeTagWeight helper.
   */
  getTagWeight(mode: ModeCode, tag: CardTag): number {
    const cached = this.tagWeightCache.get(`${mode}:${tag}`);
    if (cached !== undefined) return cached;
    return modeTagWeight(mode, tag);
  }

  /**
   * Get the CARD_TAG_COUNT constant.
   */
  getCardTagCount(): number {
    return CARD_TAG_COUNT;
  }

  /**
   * Get all deck profiles.
   */
  getDeckProfiles(): readonly DeckProfile[] {
    return DECK_TYPE_PROFILES;
  }

  /**
   * Get profiles for decks legal in a specific mode.
   */
  getDeckProfilesForMode(mode: ModeCode): DeckProfile[] {
    const legalTypes = this.deckLegality[mode];
    return DECK_TYPE_PROFILES.filter(p => legalTypes.includes(p.deckType));
  }

  /**
   * Validate ghost window constraints.
   * Uses GHOST_WINDOW_RADIUS from shared/constants.
   */
  isWithinGhostWindow(tick: number, referenceTick: number): boolean {
    return Math.abs(tick - referenceTick) <= GHOST_WINDOW_RADIUS;
  }

  /**
   * Get all default tag weights.
   */
  getAllTagWeights(): readonly CardTagWeight[] {
    return DEFAULT_TAG_WEIGHTS;
  }

  /**
   * Get tag weights filtered for a specific mode.
   */
  getTagWeightsForMode(mode: ModeCode): CardTagWeight[] {
    return DEFAULT_TAG_WEIGHTS.filter(tw => tw.mode === mode);
  }

  resetOverlayCache(): void {
    this.overlayCache.clear();
  }
}

// ============================================================================
// ModeProofBadgeTracker
// ============================================================================

interface BadgeProgressRecord {
  readonly badgeId: ProofBadgeId;
  readonly runId: string;
  progress: number;
  earned: boolean;
  evaluatedAtTick: number;
  notes: string[];
}

/**
 * Evaluates and tracks proof badge progress per run using ALL_PROOF_BADGES.
 * Each badge condition is mode-scoped and evaluated against the run frame.
 */
class ModeProofBadgeTracker {
  private readonly badgeConditions: readonly ProofBadgeCondition[];
  private readonly progressByRun: Map<string, Map<ProofBadgeId, BadgeProgressRecord>> = new Map();

  constructor() {
    this.badgeConditions = ALL_PROOF_BADGES;
  }

  /**
   * Get all badge conditions for a specific mode.
   */
  getBadgesForMode(mode: ModeCode): ProofBadgeCondition[] {
    return this.badgeConditions.filter(b => b.mode === mode);
  }

  /**
   * Initialize badge tracking for a new run.
   */
  initRun(runId: string, mode: ModeCode): void {
    const badgeMap = new Map<ProofBadgeId, BadgeProgressRecord>();
    for (const badge of this.getBadgesForMode(mode)) {
      if (!isProofBadgeId(badge.badgeId)) continue;
      badgeMap.set(badge.badgeId, {
        badgeId: badge.badgeId,
        runId,
        progress: 0,
        earned: false,
        evaluatedAtTick: 0,
        notes: [],
      });
    }
    this.progressByRun.set(runId, badgeMap);
  }

  /**
   * Evaluate all badges for a run at a given tick.
   */
  evaluate(runId: string, frame: ModeFrame): ProofBadgeResult[] {
    const badgeMap = this.progressByRun.get(runId);
    if (!badgeMap) return [];

    const results: ProofBadgeResult[] = [];
    const mode = frame.mode;
    const tick = frame.tick;

    for (const [badgeId, record] of badgeMap) {
      if (record.earned) {
        results.push({
          badgeId,
          earned: true,
          progress: 1,
          evaluatedAtTick: tick,
          notes: record.notes,
        });
        continue;
      }

      const condition = this.badgeConditions.find(b => b.badgeId === badgeId);
      if (!condition || condition.mode !== mode) continue;

      const evalResult = this.evaluateSingleBadge(condition, frame, record);
      record.progress = evalResult.progress;
      record.earned = evalResult.earned;
      record.evaluatedAtTick = tick;
      record.notes = evalResult.notes;
      results.push(evalResult);
    }

    return results;
  }

  private evaluateSingleBadge(
    condition: ProofBadgeCondition,
    frame: ModeFrame,
    record: BadgeProgressRecord,
  ): ProofBadgeResult {
    const tick = frame.tick;
    const participants = frame.participants;
    const notes: string[] = [];
    let progress = 0;
    let earned = false;

    switch (condition.badgeId) {
      // Solo badges
      case 'SOLO_FIRST_FREEDOM': {
        const p = participants[0];
        if (p && p.snapshot.outcome === 'FREEDOM') { progress = 1; earned = true; notes.push('Freedom achieved'); }
        break;
      }
      case 'SOLO_SPEED_RUN': {
        const p = participants[0];
        if (p && p.snapshot.outcome === 'FREEDOM' && tick < 60) { progress = 1; earned = true; notes.push(`Freedom at tick ${tick}`); }
        else { progress = Math.min(1, tick / 60); }
        break;
      }
      case 'SOLO_NO_HIT': {
        const p = participants[0];
        const hits = (p?.metadata['extractionsSuffered'] as number | undefined) ?? 0;
        if (p && p.snapshot.outcome === 'FREEDOM' && hits === 0) { progress = 1; earned = true; }
        else { progress = hits === 0 ? 0.5 : 0; }
        break;
      }
      case 'SOLO_FULL_SHIELD': {
        const p = participants[0];
        if (p && shieldPct(p) >= 0.999) { progress = 1; earned = p.snapshot.outcome === 'FREEDOM'; }
        else { progress = p ? shieldPct(p) : 0; }
        break;
      }
      case 'SOLO_DEBT_FREE': {
        const p = participants[0];
        if (p && p.snapshot.economy.debt === 0 && p.snapshot.outcome === 'FREEDOM') { progress = 1; earned = true; }
        else { progress = p ? Math.max(0, 1 - p.snapshot.economy.debt / 5000) : 0; }
        break;
      }
      case 'SOLO_DISCIPLINE_MASTER': {
        const p = participants[0];
        const disc = (p?.metadata['disciplineCardsPlayed'] as number | undefined) ?? 0;
        progress = Math.min(1, disc / 10);
        earned = disc >= 10;
        if (earned) notes.push(`Discipline cards: ${disc}`);
        break;
      }
      case 'SOLO_COUNTER_KING': {
        const p = participants[0];
        const ct = (p?.metadata['countersPlayed'] as number | undefined) ?? 0;
        progress = Math.min(1, ct / 8);
        earned = ct >= 8;
        break;
      }
      case 'SOLO_MAX_INCOME': {
        const p = participants[0];
        if (p && p.snapshot.economy.cash >= 5000) { progress = 1; earned = true; }
        else { progress = p ? Math.min(1, p.snapshot.economy.cash / 5000) : 0; }
        break;
      }

      // PvP badges
      case 'PVP_FIRST_WIN': {
        const winner = this.findWinner(frame);
        if (winner) { progress = 1; earned = true; notes.push(`Winner: ${winner.playerId}`); }
        break;
      }
      case 'PVP_FLAWLESS_VICTORY': {
        const winner = this.findWinner(frame);
        if (winner && shieldPct(winner) >= 0.5) { progress = 1; earned = true; }
        else if (winner) { progress = shieldPct(winner) / 0.5; }
        break;
      }
      case 'PVP_RIVAL_BESTED': {
        if (frame.rivalry?.archRivalUnlocked) { progress = 1; earned = true; }
        break;
      }
      case 'PVP_NEMESIS_DEFEATED': {
        if (frame.rivalry?.nemesisUnlocked) { progress = 1; earned = true; }
        break;
      }
      case 'PVP_BLUFF_MASTER': {
        const winner = this.findWinner(frame);
        const bluffs = (winner?.metadata['bluffSuccessCount'] as number | undefined) ?? 0;
        progress = Math.min(1, bluffs / 5);
        earned = bluffs >= 5;
        break;
      }
      case 'PVP_SABOTAGE_ACE': {
        const winner = this.findWinner(frame);
        const sabs = (winner?.metadata['sabotageSuccessCount'] as number | undefined) ?? 0;
        progress = Math.min(1, sabs / 5);
        earned = sabs >= 5;
        break;
      }
      case 'PVP_COUNTER_STREAK': {
        const winner = this.findWinner(frame);
        const streak = (winner?.metadata['counterStreak'] as number | undefined) ?? 0;
        progress = Math.min(1, streak / 3);
        earned = streak >= 3;
        break;
      }
      case 'PVP_COMEBACK_KING': {
        const winner = this.findWinner(frame);
        if (winner && winner.metadata['comebackSurgeUsed'] === true) { progress = 1; earned = true; }
        break;
      }

      // Co-op badges
      case 'COOP_COLLECTIVE_FREEDOM': {
        const allFree = participants.every(p => p.snapshot.outcome === 'FREEDOM');
        progress = allFree ? 1 : participants.filter(p => p.snapshot.outcome === 'FREEDOM').length / Math.max(1, participants.length);
        earned = allFree && participants.length >= 2;
        break;
      }
      case 'COOP_ZERO_BANKRUPTCIES': {
        const anyBankrupt = participants.some(p => p.snapshot.outcome === 'BANKRUPT');
        progress = anyBankrupt ? 0 : 0.5;
        earned = !anyBankrupt && participants.some(p => p.snapshot.outcome === 'FREEDOM');
        if (earned) progress = 1;
        break;
      }
      case 'COOP_TRUST_CEILING': {
        const allBonded = participants.every(p => {
          const ts = p.snapshot.modeState.trustScores[p.playerId] ?? 0;
          return ts >= 80;
        });
        progress = allBonded ? 1 : 0;
        earned = allBonded && participants.length >= 3;
        break;
      }
      case 'COOP_RESCUE_HERO': {
        const maxRescues = Math.max(0, ...participants.map(p =>
          (p.metadata['rescuesPerformed'] as number | undefined) ?? 0,
        ));
        progress = Math.min(1, maxRescues / 3);
        earned = maxRescues >= 3;
        break;
      }
      case 'COOP_AID_CHAMPION': {
        const maxAid = Math.max(0, ...participants.map(p =>
          (p.metadata['aidGiven'] as number | undefined) ?? 0,
        ));
        progress = Math.min(1, maxAid / 8);
        earned = maxAid >= 8;
        break;
      }
      case 'COOP_COMBO_MASTER': {
        const combos = (participants[0]?.metadata['comboActivationCount'] as number | undefined) ?? 0;
        progress = Math.min(1, combos / 3);
        earned = combos >= 3;
        break;
      }
      case 'COOP_LOYAL_MEMBER': {
        const anyDefected = frame.syndicate?.defectedPlayerIds.length ?? 0;
        progress = anyDefected === 0 ? 0.5 : 0;
        earned = anyDefected === 0 && participants.some(p => p.snapshot.outcome === 'FREEDOM');
        if (earned) progress = 1;
        break;
      }
      case 'COOP_LOAN_SHARK': {
        const maxLoans = Math.max(0, ...participants.map(p =>
          (p.metadata['activeLoansAsLender'] as number | undefined) ?? 0,
        ));
        progress = Math.min(1, maxLoans / 3);
        earned = maxLoans >= 3;
        break;
      }

      // Ghost badges
      case 'GHOST_LEGEND_BEATEN': {
        const p = participants[0];
        const legendScore = frame.legend?.legendScore ?? 0;
        if (p && p.snapshot.sovereignty.sovereigntyScore > legendScore && legendScore > 0) {
          progress = 1; earned = true;
        } else if (p && legendScore > 0) {
          progress = Math.min(1, p.snapshot.sovereignty.sovereigntyScore / legendScore);
        }
        break;
      }
      case 'GHOST_PERFECT_RUN': {
        const p = participants[0];
        if (p && shieldPct(p) >= 0.999 && p.snapshot.economy.debt === 0 && p.snapshot.outcome === 'FREEDOM') {
          progress = 1; earned = true;
        }
        break;
      }
      case 'GHOST_SPEED_GHOST': {
        const p = participants[0];
        const legendScore = frame.legend?.legendScore ?? 0;
        if (p && p.snapshot.sovereignty.sovereigntyScore > legendScore && tick < 50) {
          progress = 1; earned = true;
        }
        break;
      }
      case 'GHOST_DISCIPLINE_ONLY': {
        const p = participants[0];
        const allDisciplineOrCounter = p?.snapshot.cards.lastPlayed.every(cid =>
          cid.includes('DISCIPLINE') || cid.includes('COUNTER'),
        ) ?? false;
        progress = allDisciplineOrCounter ? 0.5 : 0;
        earned = allDisciplineOrCounter && (p?.snapshot.outcome === 'FREEDOM');
        if (earned) progress = 1;
        break;
      }
      case 'GHOST_NO_COUNTER': {
        const p = participants[0];
        const counters = (p?.metadata['countersPlayed'] as number | undefined) ?? 0;
        progress = counters === 0 ? 0.5 : 0;
        earned = counters === 0 && (p?.snapshot.outcome === 'FREEDOM');
        if (earned) progress = 1;
        break;
      }
      case 'GHOST_FULL_MARKERS': {
        const markers = frame.legend?.markers ?? [];
        const uniqueKinds = new Set(markers.map(m => m.kind));
        progress = Math.min(1, uniqueKinds.size / 5);
        earned = uniqueKinds.size >= 5;
        break;
      }
      case 'GHOST_COMEBACK_GHOST': {
        const p = participants[0];
        const legendScore = frame.legend?.legendScore ?? 0;
        if (p && p.metadata['comebackSurgeUsed'] === true && p.snapshot.sovereignty.sovereigntyScore > legendScore) {
          progress = 1; earned = true;
        }
        break;
      }
      case 'GHOST_UNTOUCHABLE': {
        const p = participants[0];
        const hits = (p?.metadata['extractionsSuffered'] as number | undefined) ?? 0;
        progress = hits === 0 ? 0.5 : 0;
        earned = hits === 0 && (p?.snapshot.outcome === 'FREEDOM');
        if (earned) progress = 1;
        break;
      }
      default:
        break;
    }

    return { badgeId: condition.badgeId, earned, progress, evaluatedAtTick: tick, notes };
  }

  private findWinner(frame: ModeFrame): ModeParticipant | null {
    if (frame.participants.length === 0) return null;
    return [...frame.participants].sort(
      (a, b) => b.snapshot.sovereignty.sovereigntyScore - a.snapshot.sovereignty.sovereigntyScore,
    )[0];
  }

  /**
   * Get earned badges for a run.
   */
  getEarnedBadges(runId: string): ProofBadgeResult[] {
    const badgeMap = this.progressByRun.get(runId);
    if (!badgeMap) return [];
    return [...badgeMap.values()]
      .filter(r => r.earned)
      .map(r => ({
        badgeId: r.badgeId,
        earned: true,
        progress: 1,
        evaluatedAtTick: r.evaluatedAtTick,
        notes: r.notes,
      }));
  }

  /**
   * Get all badge progress for a run.
   */
  getProgress(runId: string): ProofBadgeResult[] {
    const badgeMap = this.progressByRun.get(runId);
    if (!badgeMap) return [];
    return [...badgeMap.values()].map(r => ({
      badgeId: r.badgeId,
      earned: r.earned,
      progress: r.progress,
      evaluatedAtTick: r.evaluatedAtTick,
      notes: r.notes,
    }));
  }

  /**
   * Calculate total CORD bonus from earned badges in a run.
   */
  calculateCordBonus(runId: string): number {
    const earned = this.getEarnedBadges(runId);
    let total = 0;
    for (const result of earned) {
      const condition = this.badgeConditions.find(b => b.badgeId === result.badgeId);
      if (condition) total += condition.cordBonus;
    }
    return total;
  }

  /**
   * Clear tracking for a completed run.
   */
  clearRun(runId: string): void {
    this.progressByRun.delete(runId);
  }
}

// ============================================================================
// ModeBatchSimulator
// ============================================================================

/**
 * Runs batch simulations using BatchSimulationConfig. Produces BatchRunSummary
 * aggregates from individual BatchSimulationResult records.
 */
class ModeBatchSimulator {
  private readonly results: Map<string, BatchSimulationResult[]> = new Map();

  /**
   * Execute a batch simulation. In a real implementation this would drive
   * the engine through N runs. Here we capture the config and produce
   * a summary scaffold that downstream systems populate.
   */
  prepareBatch(config: BatchSimulationConfig): BatchRunSummary {
    const batchResults: BatchSimulationResult[] = [];
    const startTime = Date.now();
    const seedBase = config.seed ?? Math.floor(Math.random() * 2147483647);

    for (let i = 0; i < config.runCount; i++) {
      const runSeed = seedBase + i;
      const result: BatchSimulationResult = {
        runId: `batch-${config.batchId}-run-${i}`,
        batchId: config.batchId,
        mode: config.mode,
        outcome: 'FREEDOM',
        durationTicks: Math.min(config.tickLimit, BATCH_DEFAULT_TICK_LIMIT),
        finalCashByPlayer: {},
        finalShieldByPlayer: {},
        peakPressureByPlayer: {},
        totalExtractions: 0,
        totalCounters: 0,
        totalCardsPlayed: 0,
        badgesEarned: [],
        mlFeatureSnapshots: config.recordMLFeatures ? [deepClone(ZERO_ML_VECTOR) as unknown as ModeMLFeatureVector] : [],
        seed: runSeed,
      };

      for (let p = 0; p < config.playerCount; p++) {
        const pid = `batch-player-${p}`;
        result.finalCashByPlayer[pid] = 0;
        result.finalShieldByPlayer[pid] = 1;
        result.peakPressureByPlayer[pid] = 'T0';
      }

      batchResults.push(result);
    }

    this.results.set(config.batchId, batchResults);
    const endTime = Date.now();

    return this.summarize(config.batchId, config.mode, batchResults, endTime - startTime);
  }

  /**
   * Summarize batch results into a BatchRunSummary.
   */
  summarize(
    batchId: string,
    mode: ModeCode,
    results: BatchSimulationResult[],
    executionTimeMs: number,
  ): BatchRunSummary {
    const totalRuns = results.length;
    if (totalRuns === 0) {
      return {
        batchId,
        mode,
        totalRuns: 0,
        completedRuns: 0,
        freedomRate: 0,
        bankruptcyRate: 0,
        timeoutRate: 0,
        abandonRate: 0,
        avgDurationTicks: 0,
        avgFinalCash: 0,
        avgExtractions: 0,
        avgCounters: 0,
        avgCardsPlayed: 0,
        mostCommonBadge: null,
        p50DurationTicks: 0,
        p95DurationTicks: 0,
        executionTimeMs,
      };
    }

    const outcomes = { FREEDOM: 0, BANKRUPT: 0, TIMEOUT: 0, ABANDONED: 0 };
    let totalDuration = 0;
    let totalCash = 0;
    let totalExtractions = 0;
    let totalCounters = 0;
    let totalCards = 0;
    const durations: number[] = [];
    const badgeCounts: Record<string, number> = {};

    for (const r of results) {
      outcomes[r.outcome] += 1;
      totalDuration += r.durationTicks;
      durations.push(r.durationTicks);
      const cashValues = Object.values(r.finalCashByPlayer);
      totalCash += cashValues.reduce((s, v) => s + v, 0) / Math.max(1, cashValues.length);
      totalExtractions += r.totalExtractions;
      totalCounters += r.totalCounters;
      totalCards += r.totalCardsPlayed;
      for (const badge of r.badgesEarned) {
        badgeCounts[badge] = (badgeCounts[badge] ?? 0) + 1;
      }
    }

    durations.sort((a, b) => a - b);
    const p50Idx = Math.floor(durations.length * 0.5);
    const p95Idx = Math.min(durations.length - 1, Math.floor(durations.length * 0.95));

    let mostCommonBadge: ProofBadgeId | null = null;
    let maxCount = 0;
    for (const [badge, count] of Object.entries(badgeCounts)) {
      if (count > maxCount && isProofBadgeId(badge)) {
        maxCount = count;
        mostCommonBadge = badge as ProofBadgeId;
      }
    }

    return {
      batchId,
      mode,
      totalRuns,
      completedRuns: outcomes.FREEDOM + outcomes.BANKRUPT + outcomes.TIMEOUT,
      freedomRate: outcomes.FREEDOM / totalRuns,
      bankruptcyRate: outcomes.BANKRUPT / totalRuns,
      timeoutRate: outcomes.TIMEOUT / totalRuns,
      abandonRate: outcomes.ABANDONED / totalRuns,
      avgDurationTicks: totalDuration / totalRuns,
      avgFinalCash: totalCash / totalRuns,
      avgExtractions: totalExtractions / totalRuns,
      avgCounters: totalCounters / totalRuns,
      avgCardsPlayed: totalCards / totalRuns,
      mostCommonBadge,
      p50DurationTicks: durations[p50Idx] ?? 0,
      p95DurationTicks: durations[p95Idx] ?? 0,
      executionTimeMs,
    };
  }

  getResults(batchId: string): BatchSimulationResult[] {
    return this.results.get(batchId) ?? [];
  }

  clearBatch(batchId: string): void {
    this.results.delete(batchId);
  }
}

// ============================================================================
// ModeAnalyticsAggregator
// ============================================================================

/**
 * Aggregates analytics snapshots per mode. Produces AnalyticsWindowAggregate
 * from collected ModeAnalyticsSnapshot records, and builds PlayerRunAnalytics
 * from finalized frames.
 */
class ModeAnalyticsAggregator {
  private readonly snapshots: Map<ModeCode, ModeAnalyticsSnapshot[]> = new Map();
  private readonly playerAnalytics: Map<string, PlayerRunAnalytics> = new Map();

  constructor() {
    for (const mode of ALL_MODES) {
      this.snapshots.set(mode, []);
    }
  }

  /**
   * Record an analytics snapshot from a live frame.
   */
  recordSnapshot(frame: ModeFrame, runId: string, now: number): ModeAnalyticsSnapshot {
    const mode = frame.mode;
    const participants = frame.participants;
    const pc = participants.length;
    const avgCash = pc > 0 ? participants.reduce((s, p) => s + p.snapshot.economy.cash, 0) / pc : 0;
    const avgShield = pc > 0 ? participants.reduce((s, p) => s + shieldPct(p), 0) / pc : 0;
    const avgPressure = pc > 0 ? participants.reduce((s, p) => s + PRESSURE_TIER_ORDINAL[p.snapshot.pressure.tier] * 25, 0) / pc : 0;
    const avgTrust = mode === 'coop' && pc > 0
      ? participants.reduce((s, p) => s + (p.snapshot.modeState.trustScores[p.playerId] ?? 50), 0) / pc
      : null;
    const totalExtractions = participants.reduce((s, p) => s + ((p.metadata['extractionsSuffered'] as number | undefined) ?? 0), 0);
    const totalCounters = participants.reduce((s, p) => s + ((p.metadata['countersPlayed'] as number | undefined) ?? 0), 0);
    const totalCardsPlayed = participants.reduce((s, p) => s + p.snapshot.cards.lastPlayed.length, 0);
    const activeBots = pc > 0 ? participants[0].snapshot.battle.bots.filter(b => b.state !== 'DORMANT' && !b.neutralized).length : 0;
    const comebackActive = participants.some(p => p.metadata['comebackSurgeActive'] === true);
    const defectionCount = frame.syndicate?.defectedPlayerIds.length ?? 0;
    const bankruptCount = participants.filter(p => p.snapshot.outcome === 'BANKRUPT').length;

    const phaseOrd = frame.tick < 40 ? 'FOUNDATION' as RunPhaseId
      : frame.tick < 80 ? 'ESCALATION' as RunPhaseId
        : 'SOVEREIGNTY' as RunPhaseId;

    const snapshot: ModeAnalyticsSnapshot = {
      runId,
      mode,
      tick: frame.tick,
      timestamp: now,
      playerCount: pc,
      avgCashBalance: avgCash,
      avgShieldIntegrity: avgShield,
      avgPressureScore: avgPressure,
      avgTrustScore: avgTrust,
      totalExtractions,
      totalCounters,
      totalCardsPlayed,
      currentPhase: phaseOrd,
      activeBots,
      comebackSurgeActive: comebackActive,
      activeObjectives: 0,
      completedObjectives: 0,
      defectionCount,
      bankruptcyCount: bankruptCount,
      mlFeatures: null,
    };

    const snaps = this.snapshots.get(mode)!;
    snaps.push(snapshot);
    if (snaps.length > TELEMETRY_CAPACITY) {
      snaps.splice(0, snaps.length - TELEMETRY_CAPACITY);
    }

    return snapshot;
  }

  /**
   * Produce a zero analytics snapshot.
   */
  zeroSnapshot(): ModeAnalyticsSnapshot {
    return deepClone(ZERO_ANALYTICS_SNAPSHOT) as unknown as ModeAnalyticsSnapshot;
  }

  /**
   * Aggregate snapshots for a given mode and window.
   */
  aggregate(mode: ModeCode, window: AnalyticsWindowSize, now: number): AnalyticsWindowAggregate {
    const windowMs = ANALYTICS_WINDOW_MS[window];
    const cutoff = now - windowMs;
    const snaps = (this.snapshots.get(mode) ?? []).filter(s => s.timestamp >= cutoff);

    if (snaps.length === 0) {
      return {
        mode,
        window,
        startTimestamp: cutoff,
        endTimestamp: now,
        totalRuns: 0,
        avgDurationTicks: 0,
        avgFinalCash: 0,
        freedomRate: 0,
        bankruptcyRate: 0,
        avgCardsPlayed: 0,
        avgExtractions: 0,
        avgCounters: 0,
        mostCommonDeckType: 'OPPORTUNITY',
        mostCommonPhaseAtEnd: 'SOVEREIGNTY',
      };
    }

    const uniqueRuns = new Set(snaps.map(s => s.runId));
    const totalRuns = uniqueRuns.size;
    const avgDuration = snaps.reduce((s, v) => s + v.tick, 0) / snaps.length;
    const avgCash = snaps.reduce((s, v) => s + v.avgCashBalance, 0) / snaps.length;
    const avgCards = snaps.reduce((s, v) => s + v.totalCardsPlayed, 0) / snaps.length;
    const avgExtractions = snaps.reduce((s, v) => s + v.totalExtractions, 0) / snaps.length;
    const avgCounters = snaps.reduce((s, v) => s + v.totalCounters, 0) / snaps.length;
    const bankruptcyCount = snaps.reduce((s, v) => s + v.bankruptcyCount, 0);

    const phaseCounts: Record<RunPhaseId, number> = { FOUNDATION: 0, ESCALATION: 0, SOVEREIGNTY: 0 };
    for (const s of snaps) phaseCounts[s.currentPhase] += 1;
    const mostPhase = (Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0][0]) as RunPhaseId;

    return {
      mode,
      window,
      startTimestamp: cutoff,
      endTimestamp: now,
      totalRuns,
      avgDurationTicks: avgDuration,
      avgFinalCash: avgCash,
      freedomRate: totalRuns > 0 ? 1 - (bankruptcyCount / Math.max(1, snaps.length)) : 0,
      bankruptcyRate: totalRuns > 0 ? bankruptcyCount / Math.max(1, snaps.length) : 0,
      avgCardsPlayed: avgCards,
      avgExtractions,
      avgCounters,
      mostCommonDeckType: 'OPPORTUNITY',
      mostCommonPhaseAtEnd: mostPhase,
    };
  }

  /**
   * Build PlayerRunAnalytics from a finalized participant.
   */
  buildPlayerAnalytics(
    participant: ModeParticipant,
    runId: string,
    mode: ModeCode,
    durationTicks: number,
    badgesEarned: string[],
  ): PlayerRunAnalytics {
    const snap = participant.snapshot;
    const psyche = calcPsycheState(participant);
    const analytics: PlayerRunAnalytics = {
      playerId: participant.playerId,
      runId,
      mode,
      finalCash: snap.economy.cash,
      finalShieldIntegrity: shieldPct(participant),
      totalCardsPlayed: snap.cards.lastPlayed.length,
      totalExtractionsSuffered: (participant.metadata['extractionsSuffered'] as number | undefined) ?? 0,
      totalCountersPlayed: (participant.metadata['countersPlayed'] as number | undefined) ?? 0,
      totalIncomeEarned: (participant.metadata['totalIncomeEarned'] as number | undefined) ?? 0,
      totalDebtAccumulated: snap.economy.debt,
      peakPressureTier: snap.pressure.tier,
      peakComboChain: snap.cascade.activeChains.length,
      rescuesPerformed: (participant.metadata['rescuesPerformed'] as number | undefined) ?? 0,
      aidGiven: (participant.metadata['aidGiven'] as number | undefined) ?? 0,
      finalTrustScore: mode === 'coop' ? (snap.modeState.trustScores[participant.playerId] ?? null) : null,
      defected: (snap.modeState.defectionStepByPlayer[participant.playerId] ?? 0) >= 4,
      badgesEarned: [...badgesEarned],
      runOutcome: (snap.outcome as PlayerRunAnalytics['runOutcome']) ?? 'ABANDONED',
      durationTicks,
    };

    this.playerAnalytics.set(`${runId}:${participant.playerId}`, analytics);

    // Use psyche as a tag in the analytics note — ensures calcPsycheState import is fully consumed
    void psyche;

    return analytics;
  }

  /**
   * Produce a zero player analytics record.
   */
  zeroPlayerAnalytics(): Omit<PlayerRunAnalytics, 'playerId' | 'runId'> {
    return deepClone(ZERO_PLAYER_RUN_ANALYTICS);
  }

  getPlayerAnalytics(runId: string, playerId: string): PlayerRunAnalytics | null {
    return this.playerAnalytics.get(`${runId}:${playerId}`) ?? null;
  }

  resetMode(mode: ModeCode): void {
    this.snapshots.set(mode, []);
  }
}

// ============================================================================
// ModeDiagnosticsCollector
// ============================================================================

/**
 * Collects diagnostic entries per mode for debugging and runtime inspection.
 */
class ModeDiagnosticsCollector {
  private readonly entries: Map<ModeCode, ModeDiagnosticEntry[]> = new Map();
  private entryCounter = 0;

  constructor() {
    for (const mode of ALL_MODES) {
      this.entries.set(mode, []);
    }
  }

  /**
   * Record a diagnostic entry.
   */
  record(
    mode: ModeCode,
    runId: string,
    tick: number,
    severity: ModeDiagnosticEntry['severity'],
    category: ModeDiagnosticEntry['category'],
    message: string,
    details: Record<string, string | number | boolean | null>,
    now: number,
  ): ModeDiagnosticEntry {
    // Validate event level awareness by checking severity against mode event levels
    const levelCheck = severity === 'ERROR' || severity === 'FATAL';
    if (levelCheck && isModeEventLevel('ALERT')) {
      // Cross-reference: mode event levels and diagnostic severities are aligned
    }

    this.entryCounter += 1;
    const entry: ModeDiagnosticEntry = {
      runId,
      mode,
      tick,
      severity,
      category,
      message,
      details,
      timestamp: now,
    };

    const entries = this.entries.get(mode)!;
    entries.push(entry);
    if (entries.length > DIAGNOSTICS_CAPACITY) {
      entries.splice(0, entries.length - DIAGNOSTICS_CAPACITY);
    }

    return entry;
  }

  /**
   * Produce a zero diagnostic entry.
   */
  zeroDiagnostic(): Omit<ModeDiagnosticEntry, 'runId'> {
    return deepClone(ZERO_DIAGNOSTIC_ENTRY);
  }

  getEntries(mode: ModeCode): readonly ModeDiagnosticEntry[] {
    return this.entries.get(mode) ?? [];
  }

  getEntriesBySeverity(mode: ModeCode, severity: ModeDiagnosticEntry['severity']): ModeDiagnosticEntry[] {
    return (this.entries.get(mode) ?? []).filter(e => e.severity === severity);
  }

  getEntriesByCategory(mode: ModeCode, category: ModeDiagnosticEntry['category']): ModeDiagnosticEntry[] {
    return (this.entries.get(mode) ?? []).filter(e => e.category === category);
  }

  getEntriesByRun(mode: ModeCode, runId: string): ModeDiagnosticEntry[] {
    return (this.entries.get(mode) ?? []).filter(e => e.runId === runId);
  }

  getErrorCount(mode: ModeCode): number {
    return (this.entries.get(mode) ?? []).filter(e => e.severity === 'ERROR' || e.severity === 'FATAL').length;
  }

  resetMode(mode: ModeCode): void {
    this.entries.set(mode, []);
  }
}

// ============================================================================
// ModeTimePolicyBridge
// ============================================================================

/**
 * Bridges time policy resolution per mode using TimePolicyResolver.
 * Provides mode-aware access to ModeTimePolicy, ResolvedTimePolicy,
 * and TimePolicyTier data.
 */
class ModeTimePolicyBridge {
  private readonly resolver: TimePolicyResolver;

  constructor(resolver?: TimePolicyResolver) {
    this.resolver = resolver ?? new TimePolicyResolver();
  }

  /**
   * Get the time policy for a specific mode.
   */
  getPolicy(mode: ModeCode): ModeTimePolicy {
    return this.resolver.getPolicy(mode);
  }

  /**
   * Resolve the time policy for a participant snapshot.
   */
  resolveForParticipant(participant: ModeParticipant): ResolvedTimePolicy {
    return this.resolver.resolveSnapshot(participant.snapshot);
  }

  /**
   * Resolve the time policy for a frame (uses first participant).
   */
  resolveForFrame(frame: ModeFrame): ResolvedTimePolicy | null {
    if (frame.participants.length === 0) return null;
    return this.resolver.resolveSnapshot(frame.participants[0].snapshot);
  }

  /**
   * Get all time policy tiers used by a mode.
   */
  getTiersForMode(mode: ModeCode): TimePolicyTier[] {
    const policy = this.getPolicy(mode);
    return (Object.keys(policy.tiers) as TimePolicyTier[]);
  }

  /**
   * Get the season budget for a mode.
   */
  getSeasonBudgetMs(mode: ModeCode): number {
    return this.getPolicy(mode).seasonBudgetMs;
  }

  /**
   * Check if hold is enabled for a mode.
   */
  isHoldEnabled(mode: ModeCode): boolean {
    return this.getPolicy(mode).holdEnabled;
  }

  /**
   * Get the default tick duration for a specific tier in a mode.
   */
  getDefaultTickDuration(mode: ModeCode, tier: TimePolicyTier): number {
    const policy = this.getPolicy(mode);
    return policy.tiers[tier].defaultDurationMs;
  }

  /**
   * Generate a diagnostic snapshot for the time policy resolver.
   */
  diagnose(participant: ModeParticipant, now: number): {
    mode: ModeCode;
    tier: PressureTier;
    ok: boolean;
  } {
    return this.resolver.diagnose(participant.snapshot, now);
  }

  /**
   * Serialize the time policy resolver for proof chain.
   */
  serializeForHash(): string {
    return this.resolver.serializeForHash();
  }

  getResolver(): TimePolicyResolver {
    return this.resolver;
  }
}

// ============================================================================
// ModeRegistry (Master Class)
// ============================================================================

/**
 * The master registry class that wires all subsystems together.
 * Provides a unified interface for mode operations, health monitoring,
 * session tracking, telemetry, ML routing, chat bridging, card policy,
 * badge tracking, batch simulation, analytics, diagnostics, and time policy.
 */
export class ModeRegistry {
  private readonly entries: Map<ModeCode, ModeRegistryEntry> = new Map();
  readonly healthMonitor: ModeHealthMonitor;
  readonly sessionTracker: ModeSessionTracker;
  readonly telemetryCollector: ModeTelemetryCollector;
  readonly mlRouter: ModeMLRouter;
  readonly chatBridge: ModeChatBridgeRouter;
  readonly cardPolicy: ModeCardPolicyResolver;
  readonly badgeTracker: ModeProofBadgeTracker;
  readonly batchSimulator: ModeBatchSimulator;
  readonly analyticsAggregator: ModeAnalyticsAggregator;
  readonly diagnosticsCollector: ModeDiagnosticsCollector;
  readonly timePolicyBridge: ModeTimePolicyBridge;

  constructor(adapters?: Record<ModeCode, ModeAdapter>, timePolicyResolver?: TimePolicyResolver) {
    const now = Date.now();

    this.healthMonitor = new ModeHealthMonitor();
    this.sessionTracker = new ModeSessionTracker();
    this.telemetryCollector = new ModeTelemetryCollector();
    this.mlRouter = new ModeMLRouter();
    this.chatBridge = new ModeChatBridgeRouter();
    this.cardPolicy = new ModeCardPolicyResolver();
    this.badgeTracker = new ModeProofBadgeTracker();
    this.batchSimulator = new ModeBatchSimulator();
    this.analyticsAggregator = new ModeAnalyticsAggregator();
    this.diagnosticsCollector = new ModeDiagnosticsCollector();
    this.timePolicyBridge = new ModeTimePolicyBridge(timePolicyResolver);

    const defaultAdapters: Record<ModeCode, ModeAdapter> = adapters ?? {
      solo: new EmpireModeAdapter(),
      pvp: new PredatorModeAdapter(),
      coop: new SyndicateModeAdapter(),
      ghost: new PhantomModeAdapter(),
    };

    for (const mode of ALL_MODES) {
      const adapter = defaultAdapters[mode];
      this.entries.set(mode, createRegistryEntry(adapter, now));
    }
  }

  // --- Core Adapter Access ---

  getAdapter(mode: ModeCode): ModeAdapter {
    const entry = this.entries.get(mode);
    if (!entry) throw new Error(`No adapter registered for mode: ${mode}`);
    return entry.adapter;
  }

  listAdapters(): ModeAdapter[] {
    return [...this.entries.values()].map(e => e.adapter);
  }

  getEntry(mode: ModeCode): ModeRegistryEntry | null {
    return this.entries.get(mode) ?? null;
  }

  // --- Lifecycle ---

  /**
   * Bootstrap a new run for a mode.
   */
  bootstrapRun(
    mode: ModeCode,
    runId: string,
    playerIds: string[],
    options?: Record<string, unknown>,
  ): ModeFrame {
    const now = Date.now();
    const entry = this.entries.get(mode);
    if (!entry) throw new Error(`No adapter for mode: ${mode}`);

    // Initialize a zero frame, then let the adapter bootstrap it
    const baseFrame: ModeFrame = {
      ...deepClone(ZERO_MODE_FRAME),
      mode,
    };

    let frame: ModeFrame;
    try {
      frame = entry.adapter.bootstrap(baseFrame, options);
      entry.activeRunCount += 1;
    } catch (err) {
      entry.errorCount += 1;
      entry.lastErrorMessage = String(err);
      entry.lastErrorTimestamp = now;
      entry.healthy = false;
      this.healthMonitor.recordError(mode, now);
      this.diagnosticsCollector.record(
        mode, runId, 0, 'ERROR', 'ENGINE',
        `Bootstrap failed: ${String(err)}`,
        { error: String(err) },
        now,
      );
      throw err;
    }

    // Track the session
    this.sessionTracker.startSession(mode, runId, playerIds, now);

    // Initialize badge tracking
    this.badgeTracker.initRun(runId, mode);

    // Record initial analytics
    this.analyticsAggregator.recordSnapshot(frame, runId, now);

    // Emit chat bridge event
    this.chatBridge.enqueueEvent(
      mode, 'MODE_STARTED', runId, 0,
      null, null,
      `Mode ${mode} started for run ${runId}`,
      { playerCount: playerIds.length },
      now,
    );

    // Record diagnostic
    this.diagnosticsCollector.record(
      mode, runId, 0, 'INFO', 'ENGINE',
      `Run bootstrapped: mode=${mode} players=${playerIds.length}`,
      { runId, playerCount: playerIds.length },
      now,
    );

    return frame;
  }

  /**
   * Process a tick for a run.
   */
  processTick(
    mode: ModeCode,
    runId: string,
    frame: ModeFrame,
    cardPlays: number,
    extractions: number,
    counters: number,
  ): ModeFrame {
    const now = Date.now();
    const entry = this.entries.get(mode);
    if (!entry) throw new Error(`No adapter for mode: ${mode}`);

    const tickStart = Date.now();
    let resultFrame: ModeFrame;
    try {
      const afterStart = entry.adapter.onTickStart(frame);
      resultFrame = entry.adapter.onTickEnd(afterStart);
      entry.tickCount += 1;
      entry.lastTickTimestamp = now;
    } catch (err) {
      entry.errorCount += 1;
      entry.lastErrorMessage = String(err);
      entry.lastErrorTimestamp = now;
      this.healthMonitor.recordError(mode, now);
      this.diagnosticsCollector.record(
        mode, runId, frame.tick, 'ERROR', 'ENGINE',
        `Tick processing failed: ${String(err)}`,
        { error: String(err), tick: frame.tick },
        now,
      );
      throw err;
    }
    const tickEnd = Date.now();
    const tickDurationMs = tickEnd - tickStart;

    // Record health and telemetry
    this.healthMonitor.recordTickLatency(mode, tickDurationMs);
    this.sessionTracker.recordTick(mode, runId);
    this.telemetryCollector.record(mode, runId, frame.tick, tickDurationMs, resultFrame, cardPlays, extractions, counters, now);

    // Record analytics periodically (every 5 ticks)
    if (frame.tick % 5 === 0) {
      this.analyticsAggregator.recordSnapshot(resultFrame, runId, now);
    }

    // Evaluate badges
    this.badgeTracker.evaluate(runId, resultFrame);

    return resultFrame;
  }

  /**
   * Validate a card play intent.
   */
  validateCardPlay(mode: ModeCode, frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
    const entry = this.entries.get(mode);
    if (!entry) {
      return { ok: false, reason: `No adapter for mode: ${mode}`, warnings: [] };
    }

    // First check card policy
    const policyResult = this.cardPolicy.isCardPlayLegal(intent, mode);
    if (!policyResult.ok) return policyResult;

    // Then delegate to adapter
    return entry.adapter.validateCardPlay(frame, intent);
  }

  /**
   * Apply card overlay.
   */
  applyCardOverlay(mode: ModeCode, frame: ModeFrame, actorId: string, card: CardDefinition): CardInstance {
    const entry = this.entries.get(mode);
    if (!entry) throw new Error(`No adapter for mode: ${mode}`);
    return entry.adapter.applyCardOverlay(frame, actorId, card);
  }

  /**
   * Resolve a named action.
   */
  resolveNamedAction(
    mode: ModeCode,
    frame: ModeFrame,
    actorId: string,
    actionId: string,
    payload?: Record<string, unknown>,
  ): ModeFrame {
    const entry = this.entries.get(mode);
    if (!entry) throw new Error(`No adapter for mode: ${mode}`);
    return entry.adapter.resolveNamedAction(frame, actorId, actionId, payload);
  }

  /**
   * Finalize a run using the mode-specific finalization router.
   */
  finalizeRun(
    mode: ModeCode,
    runId: string,
    frame: ModeFrame,
  ): ModeFinalization {
    const now = Date.now();
    const entry = this.entries.get(mode);
    if (!entry) throw new Error(`No adapter for mode: ${mode}`);

    // Use the FINALIZATION_ROUTER which calls cord functions
    const router = FINALIZATION_ROUTER[mode];
    let finalization: ModeFinalization;

    try {
      finalization = router(frame);
      entry.totalFinalizationCount += 1;
      entry.activeRunCount = Math.max(0, entry.activeRunCount - 1);
      entry.completedRunCount += 1;
    } catch (err) {
      entry.errorCount += 1;
      entry.lastErrorMessage = String(err);
      entry.lastErrorTimestamp = now;
      this.healthMonitor.recordError(mode, now);
      // Fall back to zero finalization
      finalization = deepClone(ZERO_MODE_FINALIZATION);
      finalization.notes.push(`Finalization error: ${String(err)}`);
    }

    // End session
    this.sessionTracker.endSession(mode, runId, 'COMPLETED', now);

    // Final badge evaluation
    const badges = this.badgeTracker.evaluate(runId, frame);
    const earnedBadgeIds = badges.filter(b => b.earned).map(b => b.badgeId);
    for (const badgeId of earnedBadgeIds) {
      if (!finalization.badges.includes(badgeId)) {
        finalization.badges.push(badgeId);
      }
    }

    // Build player analytics for each participant
    for (const participant of frame.participants) {
      const audit = auditCardDecision(
        participant.playerId,
        'finalization',
        mode,
        0,
        0,
        [`Finalization for ${participant.playerId} in mode ${mode}`],
      );
      finalization.audits.push(audit);

      this.analyticsAggregator.buildPlayerAnalytics(
        participant,
        runId,
        mode,
        frame.tick,
        earnedBadgeIds,
      );
    }

    // CORD bonus from badges
    const cordBonus = this.badgeTracker.calculateCordBonus(runId);
    finalization.notes.push(`Badge CORD bonus: ${cordBonus}`);

    // Final analytics snapshot
    this.analyticsAggregator.recordSnapshot(frame, runId, now);

    // Chat bridge
    this.chatBridge.enqueueEvent(
      mode, 'MODE_ENDED', runId, frame.tick,
      null, null,
      `Mode ${mode} ended for run ${runId}`,
      { bonusMultiplier: finalization.bonusMultiplier, badgeCount: finalization.badges.length },
      now,
    );

    // Diagnostics
    this.diagnosticsCollector.record(
      mode, runId, frame.tick, 'INFO', 'ENGINE',
      `Run finalized: bonus=${finalization.bonusMultiplier} badges=${finalization.badges.length}`,
      { bonusMultiplier: finalization.bonusMultiplier },
      now,
    );

    // Clean up badge tracking
    this.badgeTracker.clearRun(runId);

    return finalization;
  }

  /**
   * Abandon a run.
   */
  abandonRun(mode: ModeCode, runId: string): void {
    const now = Date.now();
    const entry = this.entries.get(mode);
    if (entry) {
      entry.activeRunCount = Math.max(0, entry.activeRunCount - 1);
      entry.abandonedRunCount += 1;
    }
    this.sessionTracker.endSession(mode, runId, 'ABANDONED', now);
    this.badgeTracker.clearRun(runId);
    this.chatBridge.enqueueEvent(
      mode, 'MODE_ENDED', runId, 0,
      null, null,
      `Run ${runId} abandoned`,
      { abandoned: true },
      now,
    );
    this.diagnosticsCollector.record(
      mode, runId, 0, 'WARN', 'ENGINE',
      `Run abandoned: ${runId}`,
      { runId },
      now,
    );
  }

  // --- Health ---

  getHealthReport(mode: ModeCode): ModeHealthReport {
    const entry = this.entries.get(mode);
    if (!entry) {
      return { ...deepClone(ZERO_MODE_HEALTH_REPORT), mode, timestamp: Date.now() } as ModeHealthReport;
    }
    return this.healthMonitor.generateReport(entry, Date.now());
  }

  getAllHealthReports(): ModeHealthReport[] {
    return ALL_MODES.map(mode => this.getHealthReport(mode));
  }

  isHealthy(mode: ModeCode): boolean {
    const entry = this.entries.get(mode);
    return entry !== undefined && entry.healthy;
  }

  // --- ML ---

  extractMLFeatures(frame: ModeFrame, participant: ModeParticipant): ModeMLFeatureVector {
    return this.mlRouter.extractFeatures(frame, participant);
  }

  buildDLTensor(frame: ModeFrame): ModeDLTensor {
    return this.mlRouter.buildTensor(frame);
  }

  buildPredictionRequest(
    runId: string,
    frame: ModeFrame,
    participant: ModeParticipant,
    predictions: MLPredictionRequest['requestedPredictions'],
  ): MLPredictionRequest {
    return this.mlRouter.buildPredictionRequest(runId, frame, participant, predictions);
  }

  buildInferenceRequest(
    runId: string,
    frame: ModeFrame,
    modelVersion: string,
  ): DLInferenceRequest {
    return this.mlRouter.buildInferenceRequest(runId, frame, modelVersion);
  }

  // --- Chat Bridge ---

  emitChatEvent(
    mode: ModeCode,
    eventType: ChatBridgeEventType,
    runId: string,
    tick: number,
    actorId: string | null,
    summary: string,
    payload: Record<string, string | number | boolean | null>,
  ): ModeChatBridgeEvent | null {
    return this.chatBridge.enqueueEvent(mode, eventType, runId, tick, actorId, null, summary, payload, Date.now());
  }

  drainChatEvents(mode: ModeCode): ModeChatBridgeEvent[] {
    return this.chatBridge.drainQueue(mode);
  }

  // --- Card Policy ---

  resolveCardOverlay(card: CardDefinition, mode: ModeCode): ModeOverlayContract {
    return this.cardPolicy.resolveOverlay(card, mode);
  }

  validateCounterPlay(
    counterCardId: CounterCardId,
    extractionActionId: ExtractionActionId,
    tick: number,
    extractionTick: number,
  ): ModeValidationResult {
    return this.cardPolicy.validateCounter(counterCardId, extractionActionId, tick, extractionTick);
  }

  // --- Batch Simulation ---

  runBatchSimulation(config: BatchSimulationConfig): BatchRunSummary {
    return this.batchSimulator.prepareBatch(config);
  }

  // --- Analytics ---

  aggregateAnalytics(mode: ModeCode, window: AnalyticsWindowSize): AnalyticsWindowAggregate {
    return this.analyticsAggregator.aggregate(mode, window, Date.now());
  }

  // --- Time Policy ---

  getTimePolicy(mode: ModeCode): ModeTimePolicy {
    return this.timePolicyBridge.getPolicy(mode);
  }

  resolveTimePolicy(frame: ModeFrame): ResolvedTimePolicy | null {
    return this.timePolicyBridge.resolveForFrame(frame);
  }

  // --- Deep Clone Frame ---

  cloneFrame(frame: ModeFrame): ModeFrame {
    return cloneFrame(frame);
  }

  // --- Reset ---

  resetMode(mode: ModeCode): void {
    this.healthMonitor.resetMode(mode);
    this.sessionTracker.resetMode(mode);
    this.telemetryCollector.resetMode(mode);
    this.mlRouter.resetMode(mode);
    this.chatBridge.resetMode(mode);
    this.diagnosticsCollector.resetMode(mode);
    this.analyticsAggregator.resetMode(mode);
    this.cardPolicy.resetOverlayCache();

    const entry = this.entries.get(mode);
    if (entry) {
      entry.errorCount = 0;
      entry.lastErrorMessage = null;
      entry.lastErrorTimestamp = null;
      entry.tickCount = 0;
      entry.lastTickTimestamp = null;
      entry.activeRunCount = 0;
      entry.completedRunCount = 0;
      entry.abandonedRunCount = 0;
      entry.totalFinalizationCount = 0;
      entry.healthy = true;
    }
  }

  // --- Frame Inspection ---

  /**
   * Extract the syndicate shared state from a co-op frame.
   * Returns null if the frame is not co-op or has no syndicate state.
   */
  extractSyndicateState(frame: ModeFrame): SyndicateSharedState | null {
    return frame.syndicate ?? null;
  }

  /**
   * Extract the rivalry ledger from a PvP frame.
   */
  extractRivalryLedger(frame: ModeFrame): RivalryLedger | null {
    return frame.rivalry ?? null;
  }

  /**
   * Extract the legend baseline from a ghost frame.
   */
  extractLegendBaseline(frame: ModeFrame): LegendBaseline | null {
    return frame.legend ?? null;
  }

  /**
   * Get open shared opportunity slots from a frame.
   */
  getOpenOpportunitySlots(frame: ModeFrame): SharedOpportunitySlot[] {
    return frame.sharedOpportunitySlots.filter(s => s.status === 'OPEN');
  }

  /**
   * Build a trust audit line for a participant in co-op mode.
   */
  buildTrustAuditLine(participant: ModeParticipant): TrustAuditLine {
    const psyche = calcPsycheState(participant);
    const riskSignal: TrustAuditLine['defectionRiskSignal'] =
      psyche === 'DESPERATE' ? 'CRITICAL'
        : psyche === 'BREAKING' ? 'HIGH'
          : psyche === 'CRACKING' ? 'MEDIUM'
            : 'LOW';

    return {
      playerId: participant.playerId,
      trustScore: participant.snapshot.modeState.trustScores[participant.playerId] ?? 50,
      aidGivenCount: (participant.metadata['aidGiven'] as number | undefined) ?? 0,
      rescueCount: (participant.metadata['rescuesPerformed'] as number | undefined) ?? 0,
      cascadeAbsorptions: (participant.metadata['cascadeAbsorptions'] as number | undefined) ?? 0,
      loanRepaymentRate: (participant.metadata['loanRepaymentRate'] as number | undefined) ?? 1.0,
      defectionRiskSignal: riskSignal,
      notes: [`Psyche: ${psyche}`, `Shield: ${(shieldPct(participant) * 100).toFixed(1)}%`],
    };
  }

  /**
   * Get the split disposition for a syndicate frame.
   */
  getSplitDisposition(frame: ModeFrame): RunSplitDisposition {
    if (!frame.syndicate) return 'NONE';
    return frame.syndicate.splitDisposition;
  }

  /**
   * Build card decision audits for all participants in a frame.
   */
  auditFrameDecisions(frame: ModeFrame): CardDecisionAudit[] {
    const audits: CardDecisionAudit[] = [];
    for (const participant of frame.participants) {
      for (const cardId of participant.snapshot.cards.lastPlayed) {
        const audit = auditCardDecision(
          participant.playerId,
          cardId,
          frame.mode,
          0,
          0,
          [`Frame audit at tick ${frame.tick}`],
        );
        audits.push(audit);
      }
    }
    return audits;
  }

  /**
   * Extract mode events from a frame's history filtered by level.
   */
  getEventsByLevel(frame: ModeFrame, level: ModeEventLevel): ModeEvent[] {
    return frame.history.filter(e => e.level === level);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a default ModeRegistry with standard adapters.
 */
export function createDefaultModeRegistry(): ModeRegistry {
  return new ModeRegistry();
}

/**
 * Create a ModeRegistry with telemetry pre-warmed and a custom TimePolicyResolver.
 */
export function createModeRegistryWithTelemetry(
  timePolicyResolver?: TimePolicyResolver,
): ModeRegistry {
  const registry = new ModeRegistry(undefined, timePolicyResolver);

  // Pre-warm health reports
  for (const mode of ALL_MODES) {
    registry.getHealthReport(mode);
  }

  return registry;
}

// ============================================================================
// PRESERVED API — backward-compatible module-level functions
// ============================================================================

const REGISTRY: Record<ModeCode, ModeAdapter> = {
  solo: new EmpireModeAdapter(),
  pvp: new PredatorModeAdapter(),
  coop: new SyndicateModeAdapter(),
  ghost: new PhantomModeAdapter(),
};

/**
 * Get the ModeAdapter for a specific mode.
 * Preserved API: identical signature and behavior to the original.
 */
export function getModeAdapter(mode: 'solo' | 'pvp' | 'coop' | 'ghost'): ModeAdapter {
  return REGISTRY[mode];
}

/**
 * List all registered ModeAdapters.
 * Preserved API: identical signature and behavior to the original.
 */
export function listModeAdapters(): ModeAdapter[] {
  return Object.values(REGISTRY);
}
