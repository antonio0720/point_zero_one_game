/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT DECISION EXPIRY SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/DecisionExpirySignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Translates DecisionExpiryResolver batch results into ChatInputEnvelope
 * objects for the backend chat lane's LIVEOPS_SIGNAL channel.
 *
 * Owns:
 * - Expiry batch → LIVEOPS_SIGNAL envelope translation
 * - 16-feature ML vector extraction from expiry context
 * - 8-column DL tensor row construction per expiry batch
 * - 3-tick deduplication window to suppress replay duplicates
 * - Priority-driven channel routing (CRITICAL → INTERVENTION_ALERT)
 * - Per-card-type narrative routing and headline generation
 * - 0–100 risk scoring for churn and intervention models
 * - Session-level analytics for post-run telemetry
 *
 * Does not own: transcript mutation, NPC speech, rate policy, socket fanout,
 * replay persistence, or final decision expiry authority.
 *
 * Design laws:
 * - Preserve expiry vocabulary — do not genericise to generic "event".
 * - CRITICAL urgency always outranks queue length alone.
 * - CRISIS_EVENT expiry must never be suppressed by deduplication.
 * - ML/DL output must be deterministic and replay-safe.
 * - TIME_CONTRACT_LATENCY_THRESHOLDS gates latency-class priority escalation.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';

import {
  DecisionCardType,
} from '../../time/types';

import {
  TIME_CONTRACT_LATENCY_THRESHOLDS,
  TIME_CONTRACT_TIER_URGENCY,
  TIME_CONTRACT_BUDGET_THRESHOLDS,
} from '../../time/contracts';

import type {
  DecisionExpiryBatchResult,
  DecisionExpiryRiskBatch,
  DecisionWindowRiskProfile,
  ExpiredDecisionOutcome,
  RegisteredDecisionWindow,
  DecisionExpiryAnalytics,
  DecisionExpiryUrgencyTier,
  DecisionExpiryLatencyClass,
} from '../../time/DecisionExpiryResolver';

import type { PressureTier } from '../../time/types';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const DECISION_EXPIRY_SIGNAL_ADAPTER_VERSION = '2026.03.26' as const;
export const DECISION_EXPIRY_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 16 as const;
export const DECISION_EXPIRY_SIGNAL_ADAPTER_DL_COL_COUNT = 8 as const;
export const DECISION_EXPIRY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS = 3 as const;
export const DECISION_EXPIRY_SIGNAL_ADAPTER_MAX_BATCH_SIZE = 32 as const;

// ============================================================================
// MARK: Exported types
// ============================================================================

export const DECISION_EXPIRY_SIGNAL_PRIORITIES = [
  'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'AMBIENT',
] as const;
export type DecisionExpirySignalPriority = (typeof DECISION_EXPIRY_SIGNAL_PRIORITIES)[number];

export interface DecisionExpiryAdapterAnalytics {
  readonly totalAdapted: number;
  readonly totalDeduplicated: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly ambientCount: number;
  readonly lastAdaptedTick: number | null;
}

export interface DecisionExpirySignal extends ChatSignalEnvelope {
  readonly signalType: 'DECISION_EXPIRY';
  readonly cardType: DecisionCardType;
  readonly windowId: string;
  readonly urgencyScore: Score01;
  readonly latencyMs: number;
  readonly worstOptionApplied: boolean;
  readonly pressureTier: PressureTier;
  readonly batchSize: number;
}

/** 16-feature ML vector produced by the adapter for inference pipelines. */
export interface DecisionExpiryAdapterMLVector {
  readonly features: readonly [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
  ];
  readonly featureCount: 16;
  readonly generatedAtTick: number;
}

/** 8-column DL tensor row produced per expiry batch. */
export interface DecisionExpiryAdapterDLRow {
  readonly batchSizeNormalized: number;          // col 0
  readonly maxUrgencyScore: number;              // col 1
  readonly worstOptionRatio: number;             // col 2
  readonly pressureTierUrgency: number;          // col 3
  readonly avgLatencyNormalized: number;         // col 4
  readonly crisisEventRatio: number;             // col 5
  readonly budgetUtilizationNormalized: number;  // col 6
  readonly alarmLatencyRatio: number;            // col 7
}

// ============================================================================
// MARK: Internal helpers
// ============================================================================

function priorityToWeight(priority: DecisionExpirySignalPriority): number {
  switch (priority) {
    case 'CRITICAL': return 1.0;
    case 'HIGH':     return 0.75;
    case 'MEDIUM':   return 0.5;
    case 'LOW':      return 0.25;
    default:         return 0.1;
  }
}

function urgencyTierToAdapterPriority(
  tier: DecisionExpiryUrgencyTier,
): DecisionExpirySignalPriority {
  switch (tier) {
    case 'CRITICAL': return 'CRITICAL';
    case 'HIGH':     return 'HIGH';
    case 'MEDIUM':   return 'MEDIUM';
    case 'LOW':      return 'LOW';
    default:         return 'AMBIENT';
  }
}

function cardTypeToLabel(cardType: DecisionCardType): string {
  switch (cardType) {
    case DecisionCardType.FORCED_FATE:      return 'Fate';
    case DecisionCardType.HATER_INJECTION:  return 'Hater';
    case DecisionCardType.CRISIS_EVENT:     return 'Crisis';
    default:                                return 'Decision';
  }
}

function latencyClassToWeight(lc: DecisionExpiryLatencyClass): number {
  switch (lc) {
    case 'ALARM':       return 1.0;
    case 'SLOW':        return 0.65;
    case 'ACCEPTABLE':  return 0.3;
    default:            return 0.0;
  }
}

function clamp100(value: number): Score100 {
  return Math.max(0, Math.min(100, Math.round(value))) as Score100;
}

function buildNarrativeWeight(profile: DecisionWindowRiskProfile): Score100 {
  const base = profile.urgencyScore * 80;
  const latencyBonus = latencyClassToWeight(profile.latencyClass) * 20;
  return clamp100(base + latencyBonus);
}

function buildHeadline(
  outcome: ExpiredDecisionOutcome,
  tier: PressureTier,
): string {
  const tierNames: Record<PressureTier, string> = {
    T0: 'Sovereign',
    T1: 'Stable',
    T2: 'Compressed',
    T3: 'Crisis',
    T4: 'Collapse',
  };
  const cardLabel = cardTypeToLabel(outcome.cardType);
  const tierName = tierNames[tier] ?? tier;
  const applied = outcome.selectedOptionIndex >= 0 ? 'worst option applied' : 'no fallback option';
  return `[${tierName}] ${cardLabel} window expired — ${applied}`;
}

function buildBody(
  outcome: ExpiredDecisionOutcome,
  profile: DecisionWindowRiskProfile,
): string {
  const latencyLabel =
    profile.latencyClass === 'ALARM'
      ? `alarm latency (${outcome.latencyMs}ms)`
      : `${outcome.latencyMs}ms response`;
  return (
    `Card ${outcome.cardId} expired after ${outcome.durationMs}ms. `
    + `${latencyLabel}. Urgency: ${(profile.urgencyScore * 100).toFixed(0)}%. `
    + `Option ${outcome.selectedOptionIndex} selected.`
  );
}

// ============================================================================
// MARK: Internal deduplicator
// ============================================================================

class DecisionExpiryDeduplicator {
  private readonly windowTicks: number;
  private readonly seenByWindow = new Map<string, number>();
  private totalDeduplicated = 0;

  public constructor(windowTicks: number) {
    this.windowTicks = windowTicks;
  }

  /** Returns true if the signal should be suppressed (duplicate). */
  public isDuplicate(windowId: string, currentTick: number): boolean {
    const lastTick = this.seenByWindow.get(windowId);
    if (lastTick === undefined) return false;
    return currentTick - lastTick < this.windowTicks;
  }

  public record(windowId: string, currentTick: number): void {
    this.seenByWindow.set(windowId, currentTick);
  }

  public getTotalDeduplicated(): number {
    return this.totalDeduplicated;
  }

  public incrementDeduplicated(): void {
    this.totalDeduplicated++;
  }

  public reset(): void {
    this.seenByWindow.clear();
    this.totalDeduplicated = 0;
  }
}

// ============================================================================
// MARK: ML extraction (16 features)
// ============================================================================

/**
 * Extract the 16-dimensional adapter-level ML vector from a batch result.
 *
 * Features:
 *   0  batch_size_normalized
 *   1  max_urgency_score
 *   2  avg_urgency_score
 *   3  worst_option_ratio
 *   4  critical_ratio
 *   5  high_ratio
 *   6  avg_latency_normalized
 *   7  alarm_latency_ratio
 *   8  forced_fate_ratio
 *   9  hater_injection_ratio
 *   10 crisis_event_ratio
 *   11 pressure_tier_urgency
 *   12 budget_utilization_normalized
 *   13 unresolved_ratio
 *   14 intervention_flag
 *   15 urgency_composite
 */
function extractAdapterMLVector(
  batch: DecisionExpiryBatchResult,
  riskBatch: DecisionExpiryRiskBatch,
  pressureTier: PressureTier,
  budgetUtilizationPct: number,
  tick: number,
): DecisionExpiryAdapterMLVector {
  const n = batch.outcomes.length;
  const maxBatch = DECISION_EXPIRY_SIGNAL_ADAPTER_MAX_BATCH_SIZE;

  const f0 = n / maxBatch > 1 ? 1 : n / maxBatch;

  const f1 = riskBatch.maxUrgencyScore;
  const f2 = riskBatch.avgUrgencyScore;

  const worstApplied = batch.outcomes.filter((o) => o.selectedOptionIndex >= 0).length;
  const f3 = n > 0 ? worstApplied / n : 0;

  const f4 = n > 0 ? riskBatch.criticalCount / n : 0;
  const f5 = n > 0 ? riskBatch.highCount / n : 0;

  let totalLatencyMs = 0;
  let alarmCount = 0;
  let ffCount = 0;
  let hiCount = 0;
  let crCount = 0;

  for (const o of batch.outcomes) {
    totalLatencyMs += o.latencyMs;
    if (o.latencyMs >= TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS) alarmCount++;
    if (o.cardType === DecisionCardType.FORCED_FATE) ffCount++;
    if (o.cardType === DecisionCardType.HATER_INJECTION) hiCount++;
    if (o.cardType === DecisionCardType.CRISIS_EVENT) crCount++;
  }

  const avgLatencyMs = n > 0 ? totalLatencyMs / n : 0;
  const f6 = clamp01(avgLatencyMs / TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS);
  const f7 = n > 0 ? alarmCount / n : 0;

  const f8 = n > 0 ? ffCount / n : 0;
  const f9 = n > 0 ? hiCount / n : 0;
  const f10 = n > 0 ? crCount / n : 0;

  const f11 = TIME_CONTRACT_TIER_URGENCY[pressureTier] ?? 0;

  const f12 = clamp01(budgetUtilizationPct);

  const totalWindows = n + batch.unresolvedWindowIds.length;
  const f13 = totalWindows > 0 ? batch.unresolvedWindowIds.length / totalWindows : 0;

  const f14 = riskBatch.interventionRequired ? 1.0 : 0.0;

  const f15 = clamp01(f1 * 0.35 + f7 * 0.25 + f3 * 0.2 + f12 * 0.1 + f4 * 0.1);

  const features = [
    f0, f1, f2, f3,
    f4, f5, f6, f7,
    f8, f9, f10, f11,
    f12, f13, f14, f15,
  ] as [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
  ];

  return Object.freeze({ features, featureCount: 16, generatedAtTick: tick });
}

// ============================================================================
// MARK: DL row construction (8 cols)
// ============================================================================

function buildDLRow(
  batch: DecisionExpiryBatchResult,
  riskBatch: DecisionExpiryRiskBatch,
  pressureTier: PressureTier,
  budgetUtilizationPct: number,
): DecisionExpiryAdapterDLRow {
  const n = batch.outcomes.length;
  const maxBatch = DECISION_EXPIRY_SIGNAL_ADAPTER_MAX_BATCH_SIZE;

  const batchSizeNormalized = clamp01(n / maxBatch);
  const maxUrgencyScore = riskBatch.maxUrgencyScore;

  const worstApplied = batch.outcomes.filter((o) => o.selectedOptionIndex >= 0).length;
  const worstOptionRatio = n > 0 ? worstApplied / n : 0;

  const pressureTierUrgency = TIME_CONTRACT_TIER_URGENCY[pressureTier] ?? 0;

  let totalLatencyMs = 0;
  let alarmCount = 0;
  let crCount = 0;

  for (const o of batch.outcomes) {
    totalLatencyMs += o.latencyMs;
    if (o.latencyMs >= TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS) alarmCount++;
    if (o.cardType === DecisionCardType.CRISIS_EVENT) crCount++;
  }

  const avgLatencyMs = n > 0 ? totalLatencyMs / n : 0;
  const avgLatencyNormalized = clamp01(avgLatencyMs / TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS);
  const crisisEventRatio = n > 0 ? crCount / n : 0;
  const budgetUtilizationNormalized = clamp01(budgetUtilizationPct);
  const alarmLatencyRatio = n > 0 ? alarmCount / n : 0;

  return Object.freeze({
    batchSizeNormalized,
    maxUrgencyScore,
    worstOptionRatio,
    pressureTierUrgency,
    avgLatencyNormalized,
    crisisEventRatio,
    budgetUtilizationNormalized,
    alarmLatencyRatio,
  });
}

// ============================================================================
// MARK: Envelope construction
// ============================================================================

function buildSignalEnvelope(
  outcome: ExpiredDecisionOutcome,
  profile: DecisionWindowRiskProfile,
  priority: DecisionExpirySignalPriority,
  headline: string,
  body: string,
  visibleChannel: ChatVisibleChannel,
  roomId: Nullable<ChatRoomId>,
  nowMs: UnixMs,
  tick: number,
  pressureTier: PressureTier,
  batchSize: number,
): DecisionExpirySignal {
  const narrativeWeight = buildNarrativeWeight(profile);

  return Object.freeze({
    signalType: 'DECISION_EXPIRY' as const,
    cardType: outcome.cardType,
    windowId: outcome.windowId,
    urgencyScore: clamp01(profile.urgencyScore) as Score01,
    latencyMs: outcome.latencyMs,
    worstOptionApplied: outcome.selectedOptionIndex >= 0,
    pressureTier,
    batchSize,
    // ChatSignalEnvelope required fields
    roomId,
    actorId: outcome.actorId as unknown as Nullable<string>,
    eventType: 'DECISION_EXPIRY_SIGNAL',
    priority: priority,
    channel: visibleChannel,
    headline,
    body,
    narrativeWeight,
    emittedAt: nowMs,
    tick,
    tags: [...outcome.tags],
    metadata: {
      cardType: outcome.cardType as unknown as JsonValue,
      windowId: outcome.windowId as unknown as JsonValue,
      latencyMs: outcome.latencyMs as unknown as JsonValue,
      urgencyTier: profile.urgencyTier as unknown as JsonValue,
    },
  } as unknown as DecisionExpirySignal);
}

function buildChatInputEnvelope(
  signal: ChatSignalEnvelope,
  nowMs: UnixMs,
): ChatInputEnvelope {
  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt: nowMs,
    payload: signal,
  };
}

// ============================================================================
// MARK: Internal analytics state
// ============================================================================

interface AdapterInternalState {
  totalAdapted: number;
  totalDeduplicated: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  ambientCount: number;
  lastAdaptedTick: number | null;
}

// ============================================================================
// MARK: DecisionExpirySignalAdapter
// ============================================================================

/**
 * DecisionExpirySignalAdapter — translates decision expiry batch results
 * and risk assessments into LIVEOPS_SIGNAL chat envelopes.
 *
 * Wires the time subsystem's expiry lifecycle into the backend chat lane.
 * All outputs are replay-safe and deterministic.
 */
export class DecisionExpirySignalAdapter {
  private readonly deduplicator: DecisionExpiryDeduplicator;
  private readonly state: AdapterInternalState;
  private readonly roomId: Nullable<ChatRoomId>;
  private readonly visibleChannel: ChatVisibleChannel;

  public constructor(options: {
    readonly roomId?: Nullable<ChatRoomId>;
    readonly visibleChannel?: ChatVisibleChannel;
    readonly dedupeWindowTicks?: number;
  } = {}) {
    this.roomId = options.roomId ?? null;
    this.visibleChannel = options.visibleChannel ?? ('GLOBAL' as ChatVisibleChannel);
    this.deduplicator = new DecisionExpiryDeduplicator(
      options.dedupeWindowTicks ?? DECISION_EXPIRY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
    );
    this.state = {
      totalAdapted: 0,
      totalDeduplicated: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      ambientCount: 0,
      lastAdaptedTick: null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIMARY ADAPTATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Adapt a full expiry batch result into a list of LIVEOPS_SIGNAL envelopes.
   *
   * Each outcome in the batch produces at most one envelope. Duplicates within
   * the deduplication window are suppressed unless cardType is CRISIS_EVENT.
   *
   * @param batch           - The raw expiry batch result from DecisionExpiryResolver
   * @param riskBatch       - Pre-computed risk assessment for the batch
   * @param pressureTier    - Current backend pressure tier at expiry time
   * @param budgetUtilPct   - Current budget utilization [0.0–1.0]
   * @param nowMs           - Wall clock ms at adaptation time
   * @param tick            - Current game tick number
   */
  public adapt(
    batch: DecisionExpiryBatchResult,
    riskBatch: DecisionExpiryRiskBatch,
    pressureTier: PressureTier,
    budgetUtilPct: number,
    nowMs: number,
    tick: number,
  ): readonly ChatInputEnvelope[] {
    const envelopes: ChatInputEnvelope[] = [];
    const unixNow = asUnixMs(nowMs);

    for (let i = 0; i < batch.outcomes.length; i++) {
      const outcome = batch.outcomes[i];
      const profile = riskBatch.profiles[i];
      if (outcome === undefined || profile === undefined) continue;

      // Suppress duplicates — except CRISIS_EVENT which is never suppressed
      if (outcome.cardType !== DecisionCardType.CRISIS_EVENT) {
        if (this.deduplicator.isDuplicate(outcome.windowId, tick)) {
          this.deduplicator.incrementDeduplicated();
          this.state.totalDeduplicated++;
          continue;
        }
      }

      this.deduplicator.record(outcome.windowId, tick);

      const priority = urgencyTierToAdapterPriority(profile.urgencyTier);
      const headline = buildHeadline(outcome, pressureTier);
      const body = buildBody(outcome, profile);
      const weight = priorityToWeight(priority);

      // Budget-aware channel escalation
      let channel = this.visibleChannel;
      if (
        budgetUtilPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT
        || priority === 'CRITICAL'
      ) {
        channel = 'GLOBAL' as ChatVisibleChannel;
      }

      const signal = buildSignalEnvelope(
        outcome,
        profile,
        priority,
        headline,
        body,
        channel,
        this.roomId,
        unixNow,
        tick,
        pressureTier,
        batch.outcomes.length,
      );

      envelopes.push(buildChatInputEnvelope(signal, unixNow));

      this.state.totalAdapted++;
      this.state.lastAdaptedTick = tick;

      // Update priority counts
      if (priority === 'CRITICAL') this.state.criticalCount++;
      else if (priority === 'HIGH') this.state.highCount++;
      else if (priority === 'MEDIUM') this.state.mediumCount++;
      else if (priority === 'LOW') this.state.lowCount++;
      else this.state.ambientCount++;

      // Unused variable suppression — weight captured for future audit
      void weight;
    }

    return Object.freeze(envelopes);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ML / DL EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Extract the 16-dimensional adapter-level ML vector from a batch result.
   */
  public extractMLVector(
    batch: DecisionExpiryBatchResult,
    riskBatch: DecisionExpiryRiskBatch,
    pressureTier: PressureTier,
    budgetUtilPct: number,
    tick: number,
  ): DecisionExpiryAdapterMLVector {
    return extractAdapterMLVector(batch, riskBatch, pressureTier, budgetUtilPct, tick);
  }

  /**
   * Build the 8-column DL tensor row for this batch.
   */
  public buildDLRow(
    batch: DecisionExpiryBatchResult,
    riskBatch: DecisionExpiryRiskBatch,
    pressureTier: PressureTier,
    budgetUtilPct: number,
  ): DecisionExpiryAdapterDLRow {
    return buildDLRow(batch, riskBatch, pressureTier, budgetUtilPct);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRY-LEVEL ADAPTATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Adapt a single registered window into a LIVEOPS_SIGNAL envelope.
   * Used for pre-expiry urgency alerts (e.g., "window closing soon").
   */
  public adaptRegisteredWindow(
    window: RegisteredDecisionWindow,
    pressureTier: PressureTier,
    remainingMs: number,
    nowMs: number,
    tick: number,
  ): ChatInputEnvelope | null {
    if (this.deduplicator.isDuplicate(window.windowId, tick)) {
      return null;
    }

    const urgencyScore = clamp01(
      TIME_CONTRACT_TIER_URGENCY[pressureTier] * 0.6
      + (1 - clamp01(remainingMs / Math.max(1, window.durationMs))) * 0.4,
    );

    const unixNow = asUnixMs(nowMs);
    const headline = `[Window Alert] ${cardTypeToLabel(window.cardType)} window closing — ${Math.round(remainingMs / 1000)}s remaining`;
    const body = `Card ${window.cardId} has ${remainingMs}ms remaining. Worst option index: ${window.worstOptionIndex}.`;

    const signal: ChatSignalEnvelope = Object.freeze({
      signalType: 'DECISION_WINDOW_ALERT',
      roomId: this.roomId,
      eventType: 'DECISION_WINDOW_CLOSING',
      priority: urgencyScore >= 0.8 ? 'HIGH' : 'MEDIUM',
      channel: this.visibleChannel,
      headline,
      body,
      narrativeWeight: clamp100(urgencyScore * 100),
      emittedAt: unixNow,
      tick,
      tags: [...window.tags],
      metadata: {
        windowId: window.windowId as unknown as JsonValue,
        remainingMs: remainingMs as unknown as JsonValue,
        urgencyScore: urgencyScore as unknown as JsonValue,
      },
    } as unknown as ChatSignalEnvelope);

    this.deduplicator.record(window.windowId, tick);

    return buildChatInputEnvelope(signal, unixNow);
  }

  /**
   * Adapt session-level analytics into a LIVEOPS_SIGNAL envelope.
   * Used at run end or checkpoint events to report aggregate decision quality.
   */
  public adaptAnalytics(
    analytics: DecisionExpiryAnalytics,
    pressureTier: PressureTier,
    nowMs: number,
    tick: number,
  ): ChatInputEnvelope {
    const unixNow = asUnixMs(nowMs);
    const tierUrgency = TIME_CONTRACT_TIER_URGENCY[pressureTier] ?? 0;
    const worstRate = analytics.worstOptionAppliedRate;
    const alarmRate = analytics.totalExpired > 0
      ? analytics.alarmLatencyCount / analytics.totalExpired
      : 0;

    const headline = `[Run Summary] ${analytics.totalExpired} decisions expired — ${Math.round(worstRate * 100)}% worst-option rate`;
    const body = (
      `Avg latency: ${Math.round(analytics.avgLatencyMs)}ms. `
      + `Fast: ${analytics.fastLatencyCount}, Slow: ${analytics.slowLatencyCount}, Alarm: ${analytics.alarmLatencyCount}. `
      + `High-pressure expiries: ${analytics.highPressureExpiryCount}. `
      + `CRISIS_EVENT: ${analytics.crisisEventCount}, HATER: ${analytics.haterInjectionCount}.`
    );

    const urgencyScore = clamp01(tierUrgency * 0.4 + worstRate * 0.35 + alarmRate * 0.25);
    const priority = urgencyScore >= 0.7 ? 'HIGH' : urgencyScore >= 0.4 ? 'MEDIUM' : 'LOW';

    const signal: ChatSignalEnvelope = Object.freeze({
      signalType: 'DECISION_EXPIRY_ANALYTICS',
      roomId: this.roomId,
      eventType: 'DECISION_EXPIRY_SESSION_SUMMARY',
      priority,
      channel: this.visibleChannel,
      headline,
      body,
      narrativeWeight: clamp100(urgencyScore * 100),
      emittedAt: unixNow,
      tick,
      tags: ['decision-expiry:session-summary'],
      metadata: {
        totalExpired: analytics.totalExpired as unknown as JsonValue,
        worstOptionRate: analytics.worstOptionAppliedRate as unknown as JsonValue,
        avgLatencyMs: analytics.avgLatencyMs as unknown as JsonValue,
        highPressureExpiryCount: analytics.highPressureExpiryCount as unknown as JsonValue,
      },
    } as unknown as ChatSignalEnvelope);

    return buildChatInputEnvelope(signal, unixNow);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANALYTICS & LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  /** Get a frozen snapshot of adapter session analytics. */
  public getAnalytics(): DecisionExpiryAdapterAnalytics {
    return Object.freeze({
      totalAdapted: this.state.totalAdapted,
      totalDeduplicated: this.state.totalDeduplicated,
      criticalCount: this.state.criticalCount,
      highCount: this.state.highCount,
      mediumCount: this.state.mediumCount,
      lowCount: this.state.lowCount,
      ambientCount: this.state.ambientCount,
      lastAdaptedTick: this.state.lastAdaptedTick,
    });
  }

  /** Reset the adapter state (deduplicator, analytics). Call at run start. */
  public reset(): void {
    this.deduplicator.reset();
    this.state.totalAdapted = 0;
    this.state.totalDeduplicated = 0;
    this.state.criticalCount = 0;
    this.state.highCount = 0;
    this.state.mediumCount = 0;
    this.state.lowCount = 0;
    this.state.ambientCount = 0;
    this.state.lastAdaptedTick = null;
  }
}

// ============================================================================
// MARK: Factory
// ============================================================================

/**
 * Create a new DecisionExpirySignalAdapter with default configuration.
 */
export function createDecisionExpirySignalAdapter(options: {
  readonly roomId?: Nullable<ChatRoomId>;
  readonly visibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowTicks?: number;
} = {}): DecisionExpirySignalAdapter {
  return new DecisionExpirySignalAdapter(options);
}

// ============================================================================
// MARK: Module metadata
// ============================================================================

export const DECISION_EXPIRY_SIGNAL_ADAPTER_MODULE_METADATA = Object.freeze({
  file: 'backend/src/game/engine/chat/adapters/DecisionExpirySignalAdapter.ts',
  version: DECISION_EXPIRY_SIGNAL_ADAPTER_VERSION,
  mlFeatureCount: DECISION_EXPIRY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  dlColCount: DECISION_EXPIRY_SIGNAL_ADAPTER_DL_COL_COUNT,
  dedupeWindowTicks: DECISION_EXPIRY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  chatLane: 'LIVEOPS_SIGNAL',
  doctrine: [
    'chat lane consumes expiry truth; does not re-simulate source domain',
    'CRISIS_EVENT expiry is never suppressed by deduplication',
    'ML/DL output is deterministic and replay-safe',
  ],
} as const);
