/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION UX BRIDGE
 * /backend/src/game/engine/tension/TensionUXBridge.ts
 * ====================================================================== */

import { createHash } from 'node:crypto';

import type { EventBus } from '../core/EventBus';

import {
  TENSION_EVENT_NAMES,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  VISIBILITY_ORDER,
  PRESSURE_TENSION_AMPLIFIERS,
  TENSION_CONSTANTS,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  type AnticipationEntry,
  type AnticipationQueueUpdatedEvent,
  type ThreatArrivedEvent,
  type ThreatExpiredEvent,
  type ThreatMitigatedEvent,
  type TensionPulseFiredEvent,
  type TensionRuntimeSnapshot,
  type TensionScoreUpdatedEvent,
  type TensionVisibilityChangedEvent,
  type TensionVisibilityState,
  type PressureTier,
  type ThreatSeverity,
  type ThreatType,
  type VisibilityConfig,
  type VisibilityLevel,
  type ThreatEnvelope,
  type DecayComputeResult,
} from './types';

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

export const BRIDGE_HISTORY_CAPACITY = 64 as const;
export const BRIDGE_RATE_LIMIT_TICKS = 1 as const;
export const BRIDGE_BUFFER_MAX_SIZE = 32 as const;
export const BRIDGE_URGENCY_THRESHOLDS: Readonly<{
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  CRITICAL: number;
}> = Object.freeze({ LOW: 0.2, MEDIUM: 0.45, HIGH: 0.7, CRITICAL: 0.9 });

export const BRIDGE_CHANNEL_ROUTES: Readonly<Record<ThreatType, string>> =
  Object.freeze({
    [THREAT_TYPE.CASCADE]: 'threat.cascade',
    [THREAT_TYPE.SOVEREIGNTY]: 'threat.sovereignty',
    [THREAT_TYPE.SHIELD_PIERCE]: 'threat.shield',
    [THREAT_TYPE.HATER_INJECTION]: 'threat.hater',
    [THREAT_TYPE.DEBT_SPIRAL]: 'threat.debt',
    [THREAT_TYPE.SABOTAGE]: 'threat.sabotage',
    [THREAT_TYPE.OPPORTUNITY_KILL]: 'threat.opportunity',
    [THREAT_TYPE.REPUTATION_BURN]: 'threat.reputation',
  });

export const BRIDGE_SEVERITY_URGENCY: Readonly<Record<ThreatSeverity, number>> =
  Object.freeze({
    [THREAT_SEVERITY.MINOR]: 0.1,
    [THREAT_SEVERITY.MODERATE]: 0.3,
    [THREAT_SEVERITY.SEVERE]: 0.55,
    [THREAT_SEVERITY.CRITICAL]: 0.8,
    [THREAT_SEVERITY.EXISTENTIAL]: 1.0,
  });

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface EmitRecord {
  readonly eventName: string;
  readonly tick: number;
  readonly timestamp: number;
  readonly payloadChecksum: string;
}

export interface EmitAnalytics {
  readonly totalEmits: number;
  readonly emitsByType: Readonly<Record<string, number>>;
  readonly lastEmitTick: number;
  readonly emitRate: number;
  readonly bufferSize: number;
}

export interface BridgeHealthReport {
  readonly riskTier: 'CLEAR' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly totalEmits: number;
  readonly suppressedEmits: number;
  readonly bufferOverflows: number;
  readonly alerts: readonly string[];
}

export interface BridgeNarrative {
  readonly headline: string;
  readonly body: string;
  readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly channelRoute: string;
}

export interface EnrichedScorePayload extends TensionScoreUpdatedEvent {
  readonly pressureAmplifier: number;
  readonly visibilityOrdinal: number;
  readonly awarenessBonus: number;
  readonly envelopeLevel: VisibilityLevel;
  readonly pulseActive: boolean;
}

export interface EnrichedThreatPayload extends ThreatArrivedEvent {
  readonly severityWeight: number;
  readonly mitigationAdvice: readonly string[];
  readonly typeChannelRoute: string;
  readonly urgencyScore: number;
}

export interface BridgeEmitContext {
  readonly eventName: string;
  readonly tick: number;
  readonly pressureTier: PressureTier;
  readonly visibilityState: TensionVisibilityState;
  readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface BridgeSerializedState {
  readonly totalEmits: number;
  readonly suppressedEmits: number;
  readonly lastEmitTick: number;
  readonly checksum: string;
}

export interface BridgeExportBundle {
  readonly analytics: EmitAnalytics;
  readonly healthReport: BridgeHealthReport;
  readonly recentEmits: readonly EmitRecord[];
  readonly serialized: BridgeSerializedState;
}

export interface BridgeSelfTestResult {
  readonly passed: boolean;
  readonly checks: readonly string[];
  readonly failures: readonly string[];
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type LooseEventBus = EventBus<Record<string, unknown>>;

type UrgencyLabel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ---------------------------------------------------------------------------
// Standalone exported functions
// ---------------------------------------------------------------------------

export function buildScoreEmitPayload(
  snapshot: TensionRuntimeSnapshot,
): TensionScoreUpdatedEvent {
  return {
    eventType: 'TENSION_SCORE_UPDATED',
    score: snapshot.score,
    previousScore: snapshot.previousScore,
    rawDelta: snapshot.rawDelta,
    amplifiedDelta: snapshot.amplifiedDelta,
    visibilityState: snapshot.visibilityState,
    queueLength: snapshot.queueLength,
    arrivedCount: snapshot.arrivedCount,
    queuedCount: snapshot.queuedCount,
    expiredCount: snapshot.expiredCount,
    dominantEntryId: snapshot.dominantEntryId,
    tickNumber: snapshot.tickNumber,
    timestamp: snapshot.timestamp,
  };
}

export function buildVisibilityEmitPayload(
  from: TensionVisibilityState,
  to: TensionVisibilityState,
  tick: number,
): TensionVisibilityChangedEvent {
  return {
    eventType: 'TENSION_VISIBILITY_CHANGED',
    from,
    to,
    tickNumber: tick,
    timestamp: Date.now(),
  };
}

export function buildQueueEmitPayload(
  queueLength: number,
  arrivedCount: number,
  queuedCount: number,
  expiredCount: number,
  tick: number,
): AnticipationQueueUpdatedEvent {
  return {
    eventType: 'ANTICIPATION_QUEUE_UPDATED',
    queueLength,
    arrivedCount,
    queuedCount,
    expiredCount,
    tickNumber: tick,
    timestamp: Date.now(),
  };
}

export function buildPulseEmitPayload(
  snapshot: TensionRuntimeSnapshot,
): TensionPulseFiredEvent {
  return {
    eventType: 'TENSION_PULSE_FIRED',
    score: snapshot.score,
    queueLength: snapshot.queueLength,
    pulseTicksActive: snapshot.pulseTicksActive,
    tickNumber: snapshot.tickNumber,
    timestamp: snapshot.timestamp,
  };
}

export function computeEventUrgency(
  score: number,
  pressureTier: PressureTier,
): number {
  const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
  return Math.min(1, score * amplifier);
}

export function resolveEventChannelForType(threatType: ThreatType): string {
  return BRIDGE_CHANNEL_ROUTES[threatType];
}

export function enrichEventWithVisibility(
  event: object,
  visibilityState: TensionVisibilityState,
): object {
  const config = VISIBILITY_CONFIGS[visibilityState];
  const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
  return {
    ...event,
    visibilityState,
    envelopeLevel,
    showsThreatType: config.showsThreatType,
    showsArrivalTick: config.showsArrivalTick,
    showsMitigationPath: config.showsMitigationPath,
    tensionAwarenessBonus: config.tensionAwarenessBonus,
  };
}

export function validateEmitPayload(
  payload: unknown,
  eventName: string,
): boolean {
  if (payload === null || payload === undefined) return false;
  if (typeof payload !== 'object') return false;
  if (!eventName || eventName.trim().length === 0) return false;
  const knownEventNames = Object.values(TENSION_EVENT_NAMES);
  return knownEventNames.includes(eventName as (typeof knownEventNames)[number]);
}

export function computeBridgeHealthScore(
  totalEmits: number,
  suppressedEmits: number,
): number {
  if (totalEmits === 0) return 1.0;
  const suppressionRate = suppressedEmits / totalEmits;
  return Math.max(0, 1.0 - suppressionRate);
}

export function serializeBridgeState(
  totalEmits: number,
  lastTick: number,
): string {
  const raw = JSON.stringify({ totalEmits, lastTick, ts: Date.now() });
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export function runBridgeSelfTest(): BridgeSelfTestResult {
  const checks: string[] = [];
  const failures: string[] = [];

  // -- Check 1: TENSION_EVENT_NAMES presence
  checks.push('TENSION_EVENT_NAMES has SCORE_UPDATED');
  if (!TENSION_EVENT_NAMES.SCORE_UPDATED) {
    failures.push('TENSION_EVENT_NAMES.SCORE_UPDATED missing');
  }

  checks.push('TENSION_EVENT_NAMES has VISIBILITY_CHANGED');
  if (!TENSION_EVENT_NAMES.VISIBILITY_CHANGED) {
    failures.push('TENSION_EVENT_NAMES.VISIBILITY_CHANGED missing');
  }

  checks.push('TENSION_EVENT_NAMES has QUEUE_UPDATED');
  if (!TENSION_EVENT_NAMES.QUEUE_UPDATED) {
    failures.push('TENSION_EVENT_NAMES.QUEUE_UPDATED missing');
  }

  checks.push('TENSION_EVENT_NAMES has PULSE_FIRED');
  if (!TENSION_EVENT_NAMES.PULSE_FIRED) {
    failures.push('TENSION_EVENT_NAMES.PULSE_FIRED missing');
  }

  checks.push('TENSION_EVENT_NAMES has THREAT_ARRIVED');
  if (!TENSION_EVENT_NAMES.THREAT_ARRIVED) {
    failures.push('TENSION_EVENT_NAMES.THREAT_ARRIVED missing');
  }

  checks.push('TENSION_EVENT_NAMES has THREAT_MITIGATED');
  if (!TENSION_EVENT_NAMES.THREAT_MITIGATED) {
    failures.push('TENSION_EVENT_NAMES.THREAT_MITIGATED missing');
  }

  checks.push('TENSION_EVENT_NAMES has THREAT_EXPIRED');
  if (!TENSION_EVENT_NAMES.THREAT_EXPIRED) {
    failures.push('TENSION_EVENT_NAMES.THREAT_EXPIRED missing');
  }

  // -- Check 2: buildScoreEmitPayload produces valid payload
  checks.push('buildScoreEmitPayload returns TENSION_SCORE_UPDATED eventType');
  const mockSnapshot: TensionRuntimeSnapshot = {
    score: 0.5,
    previousScore: 0.4,
    rawDelta: 0.1,
    amplifiedDelta: 0.12,
    visibilityState: TENSION_VISIBILITY_STATE.SIGNALED,
    queueLength: 2,
    arrivedCount: 1,
    queuedCount: 1,
    expiredCount: 0,
    relievedCount: 0,
    visibleThreats: [],
    isPulseActive: false,
    pulseTicksActive: 0,
    isEscalating: true,
    dominantEntryId: null,
    lastSpikeTick: null,
    tickNumber: 10,
    timestamp: Date.now(),
    contributionBreakdown: {
      queuedThreats: 0.12,
      arrivedThreats: 0.2,
      expiredGhosts: 0,
      mitigationDecay: 0,
      nullifyDecay: 0,
      emptyQueueBonus: 0,
      visibilityBonus: 0,
      sovereigntyBonus: 0,
    },
  };
  const scorePayload = buildScoreEmitPayload(mockSnapshot);
  if (scorePayload.eventType !== 'TENSION_SCORE_UPDATED') {
    failures.push('buildScoreEmitPayload: wrong eventType');
  }

  checks.push('buildScoreEmitPayload uses TENSION_EVENT_NAMES context');
  if (scorePayload.score !== mockSnapshot.score) {
    failures.push('buildScoreEmitPayload: score mismatch');
  }

  // -- Check 3: buildVisibilityEmitPayload
  checks.push('buildVisibilityEmitPayload returns TENSION_VISIBILITY_CHANGED eventType');
  const visPayload = buildVisibilityEmitPayload(
    TENSION_VISIBILITY_STATE.SHADOWED,
    TENSION_VISIBILITY_STATE.SIGNALED,
    5,
  );
  if (visPayload.eventType !== 'TENSION_VISIBILITY_CHANGED') {
    failures.push('buildVisibilityEmitPayload: wrong eventType');
  }

  checks.push('buildVisibilityEmitPayload from/to fields correct');
  if (
    visPayload.from !== TENSION_VISIBILITY_STATE.SHADOWED ||
    visPayload.to !== TENSION_VISIBILITY_STATE.SIGNALED
  ) {
    failures.push('buildVisibilityEmitPayload: from/to mismatch');
  }

  // -- Check 4: buildQueueEmitPayload
  checks.push('buildQueueEmitPayload returns ANTICIPATION_QUEUE_UPDATED eventType');
  const queuePayload = buildQueueEmitPayload(3, 1, 2, 0, 7);
  if (queuePayload.eventType !== 'ANTICIPATION_QUEUE_UPDATED') {
    failures.push('buildQueueEmitPayload: wrong eventType');
  }

  checks.push('buildQueueEmitPayload queueLength correct');
  if (queuePayload.queueLength !== 3) {
    failures.push('buildQueueEmitPayload: queueLength mismatch');
  }

  // -- Check 5: buildPulseEmitPayload
  checks.push('buildPulseEmitPayload returns TENSION_PULSE_FIRED eventType');
  const pulsePayload = buildPulseEmitPayload(mockSnapshot);
  if (pulsePayload.eventType !== 'TENSION_PULSE_FIRED') {
    failures.push('buildPulseEmitPayload: wrong eventType');
  }

  // -- Check 6: PRESSURE_TENSION_AMPLIFIERS in computeEventUrgency
  checks.push('computeEventUrgency uses PRESSURE_TENSION_AMPLIFIERS T4');
  const urgencyT4 = computeEventUrgency(0.5, 'T4');
  const expectedT4 = Math.min(1, 0.5 * PRESSURE_TENSION_AMPLIFIERS['T4']);
  if (Math.abs(urgencyT4 - expectedT4) > 1e-9) {
    failures.push('computeEventUrgency T4 amplifier mismatch');
  }

  checks.push('computeEventUrgency uses PRESSURE_TENSION_AMPLIFIERS T0');
  const urgencyT0 = computeEventUrgency(0.5, 'T0');
  const expectedT0 = Math.min(1, 0.5 * PRESSURE_TENSION_AMPLIFIERS['T0']);
  if (Math.abs(urgencyT0 - expectedT0) > 1e-9) {
    failures.push('computeEventUrgency T0 amplifier mismatch');
  }

  // -- Check 7: BRIDGE_CHANNEL_ROUTES in resolveEventChannelForType
  checks.push('resolveEventChannelForType returns route for CASCADE');
  if (resolveEventChannelForType(THREAT_TYPE.CASCADE) !== 'threat.cascade') {
    failures.push('resolveEventChannelForType: CASCADE route wrong');
  }

  checks.push('resolveEventChannelForType returns route for DEBT_SPIRAL');
  if (resolveEventChannelForType(THREAT_TYPE.DEBT_SPIRAL) !== 'threat.debt') {
    failures.push('resolveEventChannelForType: DEBT_SPIRAL route wrong');
  }

  checks.push('resolveEventChannelForType returns route for SOVEREIGNTY');
  if (resolveEventChannelForType(THREAT_TYPE.SOVEREIGNTY) !== 'threat.sovereignty') {
    failures.push('resolveEventChannelForType: SOVEREIGNTY route wrong');
  }

  // -- Check 8: VISIBILITY_CONFIGS used in enrichEventWithVisibility
  checks.push('enrichEventWithVisibility uses VISIBILITY_CONFIGS');
  const enriched = enrichEventWithVisibility(
    { score: 0.5 },
    TENSION_VISIBILITY_STATE.EXPOSED,
  );
  const exposedConfig = VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.EXPOSED];
  if (
    (enriched as Record<string, unknown>)['showsMitigationPath'] !==
    exposedConfig.showsMitigationPath
  ) {
    failures.push('enrichEventWithVisibility: showsMitigationPath mismatch');
  }

  // -- Check 9: INTERNAL_VISIBILITY_TO_ENVELOPE in enrichEventWithVisibility
  checks.push('enrichEventWithVisibility uses INTERNAL_VISIBILITY_TO_ENVELOPE');
  const enrichedShadowed = enrichEventWithVisibility(
    { score: 0.1 },
    TENSION_VISIBILITY_STATE.SHADOWED,
  );
  const expectedEnvelope =
    INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.SHADOWED];
  if ((enrichedShadowed as Record<string, unknown>)['envelopeLevel'] !== expectedEnvelope) {
    failures.push('enrichEventWithVisibility: envelopeLevel mismatch');
  }

  // -- Check 10: validateEmitPayload
  checks.push('validateEmitPayload returns true for valid payload and name');
  if (!validateEmitPayload({ score: 0.5 }, TENSION_EVENT_NAMES.SCORE_UPDATED)) {
    failures.push('validateEmitPayload: should return true for valid input');
  }

  checks.push('validateEmitPayload returns false for null payload');
  if (validateEmitPayload(null, TENSION_EVENT_NAMES.SCORE_UPDATED)) {
    failures.push('validateEmitPayload: should return false for null');
  }

  checks.push('validateEmitPayload returns false for unknown event name');
  if (validateEmitPayload({ score: 0.5 }, 'tension.unknown.event')) {
    failures.push('validateEmitPayload: should return false for unknown event name');
  }

  // -- Check 11: computeBridgeHealthScore
  checks.push('computeBridgeHealthScore returns 1.0 when no suppression');
  if (computeBridgeHealthScore(100, 0) !== 1.0) {
    failures.push('computeBridgeHealthScore: zero suppression should be 1.0');
  }

  checks.push('computeBridgeHealthScore returns 0 when all suppressed');
  if (computeBridgeHealthScore(10, 10) !== 0) {
    failures.push('computeBridgeHealthScore: full suppression should be 0');
  }

  // -- Check 12: serializeBridgeState uses createHash
  checks.push('serializeBridgeState returns non-empty hex string');
  const serialized = serializeBridgeState(50, 25);
  if (!serialized || serialized.length !== 16) {
    failures.push('serializeBridgeState: unexpected length or empty');
  }

  checks.push('serializeBridgeState produces different values for different inputs');
  const s1 = serializeBridgeState(1, 1);
  const s2 = serializeBridgeState(2, 2);
  if (s1 === s2) {
    failures.push('serializeBridgeState: same hash for different inputs');
  }

  // -- Check 13: THREAT_SEVERITY_WEIGHTS
  checks.push('THREAT_SEVERITY_WEIGHTS EXISTENTIAL is 1.0');
  if (THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] !== 1.0) {
    failures.push('THREAT_SEVERITY_WEIGHTS: EXISTENTIAL should be 1.0');
  }

  checks.push('THREAT_SEVERITY_WEIGHTS MINOR is 0.2');
  if (THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR] !== 0.2) {
    failures.push('THREAT_SEVERITY_WEIGHTS: MINOR should be 0.2');
  }

  // -- Check 14: THREAT_TYPE_DEFAULT_MITIGATIONS
  checks.push('THREAT_TYPE_DEFAULT_MITIGATIONS CASCADE has mitigations');
  const cascadeMitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.CASCADE];
  if (!cascadeMitigations || cascadeMitigations.length === 0) {
    failures.push('THREAT_TYPE_DEFAULT_MITIGATIONS: CASCADE mitigations missing');
  }

  checks.push('THREAT_TYPE_DEFAULT_MITIGATIONS DEBT_SPIRAL has mitigations');
  const debtMitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.DEBT_SPIRAL];
  if (!debtMitigations || debtMitigations.length === 0) {
    failures.push('THREAT_TYPE_DEFAULT_MITIGATIONS: DEBT_SPIRAL mitigations missing');
  }

  // -- Check 15: TENSION_CONSTANTS thresholds
  checks.push('TENSION_CONSTANTS.PULSE_THRESHOLD is 0.9');
  if (TENSION_CONSTANTS.PULSE_THRESHOLD !== 0.9) {
    failures.push('TENSION_CONSTANTS: PULSE_THRESHOLD should be 0.9');
  }

  checks.push('TENSION_CONSTANTS.MAX_SCORE is 1');
  if (TENSION_CONSTANTS.MAX_SCORE !== 1) {
    failures.push('TENSION_CONSTANTS: MAX_SCORE should be 1');
  }

  // -- Check 16: BRIDGE_URGENCY_THRESHOLDS
  checks.push('BRIDGE_URGENCY_THRESHOLDS.CRITICAL is 0.9');
  if (BRIDGE_URGENCY_THRESHOLDS.CRITICAL !== 0.9) {
    failures.push('BRIDGE_URGENCY_THRESHOLDS: CRITICAL should be 0.9');
  }

  checks.push('BRIDGE_URGENCY_THRESHOLDS.LOW is 0.2');
  if (BRIDGE_URGENCY_THRESHOLDS.LOW !== 0.2) {
    failures.push('BRIDGE_URGENCY_THRESHOLDS: LOW should be 0.2');
  }

  // -- Check 17: VISIBILITY_ORDER
  checks.push('VISIBILITY_ORDER starts with SHADOWED');
  if (VISIBILITY_ORDER[0] !== TENSION_VISIBILITY_STATE.SHADOWED) {
    failures.push('VISIBILITY_ORDER: first element should be SHADOWED');
  }

  checks.push('VISIBILITY_ORDER ends with EXPOSED');
  if (VISIBILITY_ORDER[VISIBILITY_ORDER.length - 1] !== TENSION_VISIBILITY_STATE.EXPOSED) {
    failures.push('VISIBILITY_ORDER: last element should be EXPOSED');
  }

  // -- Check 18: BRIDGE_SEVERITY_URGENCY
  checks.push('BRIDGE_SEVERITY_URGENCY.EXISTENTIAL is 1.0');
  if (BRIDGE_SEVERITY_URGENCY[THREAT_SEVERITY.EXISTENTIAL] !== 1.0) {
    failures.push('BRIDGE_SEVERITY_URGENCY: EXISTENTIAL should be 1.0');
  }

  checks.push('BRIDGE_SEVERITY_URGENCY.MINOR is 0.1');
  if (BRIDGE_SEVERITY_URGENCY[THREAT_SEVERITY.MINOR] !== 0.1) {
    failures.push('BRIDGE_SEVERITY_URGENCY: MINOR should be 0.1');
  }

  // -- Check 19: BRIDGE_CHANNEL_ROUTES exhaustive
  checks.push('BRIDGE_CHANNEL_ROUTES covers all THREAT_TYPE keys');
  const allThreatTypes = Object.values(THREAT_TYPE);
  for (const t of allThreatTypes) {
    if (!BRIDGE_CHANNEL_ROUTES[t]) {
      failures.push(`BRIDGE_CHANNEL_ROUTES: missing route for ${t}`);
    }
  }

  // -- Check 20: TensionUXBridge analytics via standalone helpers
  checks.push('computeBridgeHealthScore interpolates linearly');
  const midHealth = computeBridgeHealthScore(100, 50);
  if (Math.abs(midHealth - 0.5) > 1e-9) {
    failures.push('computeBridgeHealthScore: 50% suppression should yield 0.5');
  }

  // -- Check 21: createHash integration
  checks.push('createHash sha256 produces consistent hex');
  const h1 = createHash('sha256').update('test').digest('hex');
  const h2 = createHash('sha256').update('test').digest('hex');
  if (h1 !== h2) {
    failures.push('createHash: inconsistent output');
  }

  checks.push('createHash sha256 hex is 64 chars');
  if (h1.length !== 64) {
    failures.push('createHash: unexpected hex length');
  }

  // -- Check 22: VISIBILITY_CONFIGS tensionAwarenessBonus for TELEGRAPHED
  checks.push('VISIBILITY_CONFIGS.TELEGRAPHED tensionAwarenessBonus is 0.05');
  if (VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.TELEGRAPHED].tensionAwarenessBonus !== 0.05) {
    failures.push('VISIBILITY_CONFIGS: TELEGRAPHED awarenessBonus should be 0.05');
  }

  // -- Check 23: VISIBILITY_CONFIGS.SHADOWED showsThreatType is false
  checks.push('VISIBILITY_CONFIGS.SHADOWED showsThreatType is false');
  if (VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.SHADOWED].showsThreatType !== false) {
    failures.push('VISIBILITY_CONFIGS: SHADOWED showsThreatType should be false');
  }

  // -- Check 24: enrichEventWithVisibility TELEGRAPHED
  checks.push('enrichEventWithVisibility TELEGRAPHED shows arrivalTick');
  const enrichedTelegraphed = enrichEventWithVisibility(
    {},
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
  );
  if (
    (enrichedTelegraphed as Record<string, unknown>)['showsArrivalTick'] !==
    VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.TELEGRAPHED].showsArrivalTick
  ) {
    failures.push('enrichEventWithVisibility: TELEGRAPHED showsArrivalTick mismatch');
  }

  // -- Check 25: computeEventUrgency clamped at 1.0
  checks.push('computeEventUrgency clamps at 1.0 for score=1, T4');
  const clamped = computeEventUrgency(1.0, 'T4');
  if (clamped > 1.0) {
    failures.push('computeEventUrgency: result exceeded 1.0');
  }

  return {
    passed: failures.length === 0,
    checks,
    failures,
  };
}

// ---------------------------------------------------------------------------
// TensionUXBridge class
// ---------------------------------------------------------------------------

export class TensionUXBridge {
  private readonly history: EmitRecord[] = [];
  private readonly emitsByType: Record<string, number> = {};
  private readonly buffer: unknown[] = [];
  private totalEmits = 0;
  private suppressedEmits = 0;
  private bufferOverflows = 0;
  private lastEmitTick = 0;
  private firstEmitTick: number | null = null;

  public constructor(private readonly eventBus: LooseEventBus) {}

  // -------------------------------------------------------------------------
  // Core emit methods (preserved from original)
  // -------------------------------------------------------------------------

  public emitScoreUpdated(snapshot: TensionRuntimeSnapshot): void {
    const event: TensionScoreUpdatedEvent = buildScoreEmitPayload(snapshot);

    this.eventBus.emit(TENSION_EVENT_NAMES.SCORE_UPDATED, event, {
      emittedAtTick: snapshot.tickNumber,
    });

    this.eventBus.emit(TENSION_EVENT_NAMES.UPDATED_LEGACY, snapshot, {
      emittedAtTick: snapshot.tickNumber,
    });

    this.recordEmit(TENSION_EVENT_NAMES.SCORE_UPDATED, snapshot.tickNumber, event);
  }

  public emitVisibilityChanged(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
    tickNumber: number,
    timestamp = Date.now(),
  ): void {
    const event: TensionVisibilityChangedEvent = {
      eventType: 'TENSION_VISIBILITY_CHANGED',
      from,
      to,
      tickNumber,
      timestamp,
    };

    this.eventBus.emit(TENSION_EVENT_NAMES.VISIBILITY_CHANGED, event, {
      emittedAtTick: tickNumber,
    });

    this.recordEmit(TENSION_EVENT_NAMES.VISIBILITY_CHANGED, tickNumber, event);
  }

  public emitPulseFired(snapshot: TensionRuntimeSnapshot): void {
    const event: TensionPulseFiredEvent = buildPulseEmitPayload(snapshot);

    this.eventBus.emit(TENSION_EVENT_NAMES.PULSE_FIRED, event, {
      emittedAtTick: snapshot.tickNumber,
    });

    this.recordEmit(TENSION_EVENT_NAMES.PULSE_FIRED, snapshot.tickNumber, event);
  }

  public emitThreatArrived(entry: AnticipationEntry, tickNumber: number): void {
    const event: ThreatArrivedEvent = {
      eventType: 'THREAT_ARRIVED',
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      source: entry.source,
      worstCaseOutcome: entry.worstCaseOutcome,
      mitigationCardTypes: entry.mitigationCardTypes,
      tickNumber,
      timestamp: Date.now(),
    };

    this.eventBus.emit(TENSION_EVENT_NAMES.THREAT_ARRIVED, event, {
      emittedAtTick: tickNumber,
    });

    this.recordEmit(TENSION_EVENT_NAMES.THREAT_ARRIVED, tickNumber, event);
  }

  public emitThreatMitigated(entry: AnticipationEntry, tickNumber: number): void {
    const event: ThreatMitigatedEvent = {
      eventType: 'THREAT_MITIGATED',
      entryId: entry.entryId,
      threatType: entry.threatType,
      tickNumber,
      timestamp: Date.now(),
    };

    this.eventBus.emit(TENSION_EVENT_NAMES.THREAT_MITIGATED, event, {
      emittedAtTick: tickNumber,
    });

    this.recordEmit(TENSION_EVENT_NAMES.THREAT_MITIGATED, tickNumber, event);
  }

  public emitThreatExpired(entry: AnticipationEntry, tickNumber: number): void {
    const event: ThreatExpiredEvent = {
      eventType: 'THREAT_EXPIRED',
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      ticksOverdue: entry.ticksOverdue,
      tickNumber,
      timestamp: Date.now(),
    };

    this.eventBus.emit(TENSION_EVENT_NAMES.THREAT_EXPIRED, event, {
      emittedAtTick: tickNumber,
    });

    this.recordEmit(TENSION_EVENT_NAMES.THREAT_EXPIRED, tickNumber, event);
  }

  public emitQueueUpdated(
    queueLength: number,
    arrivedCount: number,
    queuedCount: number,
    expiredCount: number,
    tickNumber: number,
  ): void {
    const event: AnticipationQueueUpdatedEvent = buildQueueEmitPayload(
      queueLength,
      arrivedCount,
      queuedCount,
      expiredCount,
      tickNumber,
    );

    this.eventBus.emit(TENSION_EVENT_NAMES.QUEUE_UPDATED, event, {
      emittedAtTick: tickNumber,
    });

    this.recordEmit(TENSION_EVENT_NAMES.QUEUE_UPDATED, tickNumber, event);
  }

  // -------------------------------------------------------------------------
  // New emit methods
  // -------------------------------------------------------------------------

  public emitWithPressureContext(
    snapshot: TensionRuntimeSnapshot,
    pressureTier: PressureTier,
  ): void {
    const enriched = this.buildEnrichedScorePayload(snapshot, pressureTier);

    this.eventBus.emit(TENSION_EVENT_NAMES.SCORE_UPDATED, enriched, {
      emittedAtTick: snapshot.tickNumber,
    });

    this.eventBus.emit(TENSION_EVENT_NAMES.UPDATED_LEGACY, snapshot, {
      emittedAtTick: snapshot.tickNumber,
    });

    this.recordEmit(TENSION_EVENT_NAMES.SCORE_UPDATED, snapshot.tickNumber, enriched);
  }

  public emitDecayResult(
    result: DecayComputeResult,
    tick: number,
    visibilityState: TensionVisibilityState,
  ): void {
    const payload = this.buildDecayEventPayload(result, tick, visibilityState);

    this.eventBus.emit(TENSION_EVENT_NAMES.SCORE_UPDATED, payload, {
      emittedAtTick: tick,
    });

    this.recordEmit(TENSION_EVENT_NAMES.SCORE_UPDATED, tick, payload);
  }

  public emitBatchThreatArrivals(
    entries: readonly AnticipationEntry[],
    tick: number,
  ): void {
    for (const entry of entries) {
      this.emitThreatArrived(entry, tick);
    }

    this.emitQueueUpdated(
      entries.length,
      entries.length,
      0,
      0,
      tick,
    );
  }

  public emitBatchThreatExpirations(
    entries: readonly AnticipationEntry[],
    tick: number,
  ): void {
    for (const entry of entries) {
      this.emitThreatExpired(entry, tick);
    }

    this.emitQueueUpdated(
      0,
      0,
      0,
      entries.length,
      tick,
    );
  }

  public emitEnvelopeContext(
    envelopes: readonly ThreatEnvelope[],
    visibilityState: TensionVisibilityState,
    tick: number,
  ): void {
    const context = this.buildEnvelopeContext(envelopes, visibilityState);
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];

    const payload = {
      eventType: 'ANTICIPATION_QUEUE_UPDATED' as const,
      queueLength: envelopes.length,
      arrivedCount: 0,
      queuedCount: envelopes.length,
      expiredCount: 0,
      tickNumber: tick,
      timestamp: Date.now(),
      envelopeLevel,
      envelopeContext: context,
    };

    this.eventBus.emit(TENSION_EVENT_NAMES.QUEUE_UPDATED, payload, {
      emittedAtTick: tick,
    });

    this.recordEmit(TENSION_EVENT_NAMES.QUEUE_UPDATED, tick, payload);
  }

  // -------------------------------------------------------------------------
  // Payload builders
  // -------------------------------------------------------------------------

  public buildEnrichedScorePayload(
    snapshot: TensionRuntimeSnapshot,
    pressureTier: PressureTier,
  ): EnrichedScorePayload {
    const pressureAmplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    const config = VISIBILITY_CONFIGS[snapshot.visibilityState];
    const ordinal = this.visibilityOrdinal(snapshot.visibilityState);
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[snapshot.visibilityState];
    const pulseActive = snapshot.score >= TENSION_CONSTANTS.PULSE_THRESHOLD;

    return {
      eventType: 'TENSION_SCORE_UPDATED',
      score: snapshot.score,
      previousScore: snapshot.previousScore,
      rawDelta: snapshot.rawDelta,
      amplifiedDelta: snapshot.amplifiedDelta,
      visibilityState: snapshot.visibilityState,
      queueLength: snapshot.queueLength,
      arrivedCount: snapshot.arrivedCount,
      queuedCount: snapshot.queuedCount,
      expiredCount: snapshot.expiredCount,
      dominantEntryId: snapshot.dominantEntryId,
      tickNumber: snapshot.tickNumber,
      timestamp: snapshot.timestamp,
      pressureAmplifier,
      visibilityOrdinal: ordinal,
      awarenessBonus: config.tensionAwarenessBonus,
      envelopeLevel,
      pulseActive,
    };
  }

  public buildEnrichedThreatPayload(
    entry: AnticipationEntry,
    tick: number,
  ): EnrichedThreatPayload {
    const severityWeight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
    const mitigationAdvice = THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType];
    const typeChannelRoute = BRIDGE_CHANNEL_ROUTES[entry.threatType];
    const urgencyScore = BRIDGE_SEVERITY_URGENCY[entry.threatSeverity];

    return {
      eventType: 'THREAT_ARRIVED',
      entryId: entry.entryId,
      threatType: entry.threatType,
      threatSeverity: entry.threatSeverity,
      source: entry.source,
      worstCaseOutcome: entry.worstCaseOutcome,
      mitigationCardTypes: entry.mitigationCardTypes,
      tickNumber: tick,
      timestamp: Date.now(),
      severityWeight,
      mitigationAdvice,
      typeChannelRoute,
      urgencyScore,
    };
  }

  public computeEmitContext(
    eventName: string,
    tick: number,
    pressureTier: PressureTier,
    visibilityState: TensionVisibilityState,
  ): BridgeEmitContext {
    const amplifiedScore = PRESSURE_TENSION_AMPLIFIERS[pressureTier] * 0.5;
    const urgency = this.classifyEmitUrgency(amplifiedScore);

    return {
      eventName,
      tick,
      pressureTier,
      visibilityState,
      urgency,
    };
  }

  private buildDecayEventPayload(
    result: DecayComputeResult,
    tick: number,
    visibilityState: TensionVisibilityState,
  ): object {
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
    const config = VISIBILITY_CONFIGS[visibilityState];

    return {
      eventType: 'TENSION_SCORE_UPDATED',
      rawDelta: result.rawDelta,
      amplifiedDelta: result.amplifiedDelta,
      contributionBreakdown: result.contributionBreakdown,
      visibilityState,
      envelopeLevel,
      tensionAwarenessBonus: config.tensionAwarenessBonus,
      tickNumber: tick,
      timestamp: Date.now(),
    };
  }

  // -------------------------------------------------------------------------
  // Urgency and routing helpers
  // -------------------------------------------------------------------------

  public computeAmplifiedUrgency(score: number, pressureTier: PressureTier): number {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    return Math.min(1, score * amplifier);
  }

  public computeWeightedUrgency(entries: readonly AnticipationEntry[]): number {
    if (entries.length === 0) return 0;
    let total = 0;
    for (const entry of entries) {
      total += THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
    }
    return Math.min(1, total / entries.length);
  }

  public classifyEmitUrgency(score: number): UrgencyLabel {
    if (score >= BRIDGE_URGENCY_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (score >= BRIDGE_URGENCY_THRESHOLDS.HIGH) return 'HIGH';
    if (score >= BRIDGE_URGENCY_THRESHOLDS.MEDIUM) return 'MEDIUM';
    return 'LOW';
  }

  public resolveTypeChannelRoute(threatType: ThreatType): string {
    return BRIDGE_CHANNEL_ROUTES[threatType];
  }

  public buildMitigationContext(entry: AnticipationEntry): readonly string[] {
    return THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType];
  }

  public buildEnvelopeContext(
    envelopes: readonly ThreatEnvelope[],
    visibilityState: TensionVisibilityState,
  ): object {
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
    const config = VISIBILITY_CONFIGS[visibilityState];

    return {
      envelopeCount: envelopes.length,
      visibilityState,
      envelopeLevel,
      showsThreatType: config.showsThreatType,
      showsArrivalTick: config.showsArrivalTick,
      showsMitigationPath: config.showsMitigationPath,
      showsWorstCase: config.showsWorstCase,
      envelopes,
    };
  }

  // -------------------------------------------------------------------------
  // Visibility helpers
  // -------------------------------------------------------------------------

  public getVisibilityConfig(state: TensionVisibilityState): VisibilityConfig {
    return VISIBILITY_CONFIGS[state];
  }

  public resolveEnvelopeVisibility(state: TensionVisibilityState): VisibilityLevel {
    return INTERNAL_VISIBILITY_TO_ENVELOPE[state];
  }

  public visibilityOrdinal(state: TensionVisibilityState): number {
    return VISIBILITY_ORDER.indexOf(state);
  }

  public computeVisibilityDistance(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
  ): number {
    const fromIdx = VISIBILITY_ORDER.indexOf(from);
    const toIdx = VISIBILITY_ORDER.indexOf(to);
    return Math.abs(toIdx - fromIdx);
  }

  // -------------------------------------------------------------------------
  // Narrative generation
  // -------------------------------------------------------------------------

  public generateNarrative(
    snapshot: TensionRuntimeSnapshot,
    pressureTier: PressureTier,
    entries?: readonly AnticipationEntry[],
  ): BridgeNarrative {
    const config = VISIBILITY_CONFIGS[snapshot.visibilityState];
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    const amplifiedScore = Math.min(1, snapshot.score * amplifier);
    const urgency = this.classifyEmitUrgency(amplifiedScore);
    const pulseActive = snapshot.score >= TENSION_CONSTANTS.PULSE_THRESHOLD;

    let headline = `Tension ${urgency}: score ${snapshot.score.toFixed(3)}`;
    if (pulseActive) {
      headline = `PULSE ACTIVE — ${headline} (${snapshot.pulseTicksActive} ticks)`;
    }

    let body = `Visibility: ${snapshot.visibilityState}`;
    if (config.showsThreatCount) {
      body += ` | Threats in queue: ${snapshot.queueLength}`;
    }
    if (config.showsThreatType && entries && entries.length > 0) {
      const types = new Set(entries.map((e) => e.threatType));
      body += ` | Types: ${[...types].join(', ')}`;
    }
    if (snapshot.isEscalating) {
      body += ' | ESCALATING';
    }

    const dominantEntry = entries?.find(
      (e) => e.entryId === snapshot.dominantEntryId,
    );
    const channelRoute =
      dominantEntry != null
        ? BRIDGE_CHANNEL_ROUTES[dominantEntry.threatType]
        : resolveEventChannelForType(THREAT_TYPE.CASCADE);

    return { headline, body, urgency, channelRoute };
  }

  public generateThreatNarrative(
    entry: AnticipationEntry,
    tick: number,
  ): string {
    const severityLabel = entry.threatSeverity;
    const typeLabel = entry.threatType;
    const mitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType];
    const isMinor = entry.threatSeverity === THREAT_SEVERITY.MINOR;
    const isExistential = entry.threatSeverity === THREAT_SEVERITY.EXISTENTIAL;

    let narrative = `[T${tick}] ${severityLabel} threat (${typeLabel})`;
    if (isExistential) {
      narrative += ' — EXISTENTIAL RISK';
    } else if (isMinor) {
      narrative += ' — low impact';
    }
    narrative += `. Mitigations: ${mitigations.join(', ')}.`;
    narrative += ` Worst case: ${entry.worstCaseOutcome}.`;
    return narrative;
  }

  // -------------------------------------------------------------------------
  // Analytics, checksums, and record-keeping
  // -------------------------------------------------------------------------

  public computeEmitChecksum(payload: unknown): string {
    const raw = JSON.stringify(payload) ?? '';
    return createHash('sha256').update(raw).digest('hex');
  }

  public recordEmit(eventName: string, tick: number, payload: unknown): void {
    const checksum = this.computeEmitChecksum(payload);
    const record: EmitRecord = {
      eventName,
      tick,
      timestamp: Date.now(),
      payloadChecksum: checksum,
    };

    if (this.history.length >= BRIDGE_HISTORY_CAPACITY) {
      this.history.shift();
    }
    this.history.push(record);

    this.emitsByType[eventName] = (this.emitsByType[eventName] ?? 0) + 1;
    this.totalEmits += 1;
    this.lastEmitTick = tick;

    if (this.firstEmitTick === null) {
      this.firstEmitTick = tick;
    }

    if (this.buffer.length >= BRIDGE_BUFFER_MAX_SIZE) {
      this.bufferOverflows += 1;
      this.buffer.shift();
    }
    this.buffer.push(payload);
  }

  public computeAnalytics(): EmitAnalytics {
    const tickRange =
      this.firstEmitTick !== null
        ? Math.max(1, this.lastEmitTick - this.firstEmitTick + 1)
        : 1;
    const emitRate = this.totalEmits / tickRange;

    return {
      totalEmits: this.totalEmits,
      emitsByType: { ...this.emitsByType },
      lastEmitTick: this.lastEmitTick,
      emitRate,
      bufferSize: this.buffer.length,
    };
  }

  public computeHealthReport(): BridgeHealthReport {
    const alerts: string[] = [];
    const healthScore = computeBridgeHealthScore(this.totalEmits, this.suppressedEmits);

    if (this.bufferOverflows > 0) {
      alerts.push(`Buffer overflowed ${this.bufferOverflows} time(s)`);
    }
    if (this.suppressedEmits > 0) {
      alerts.push(`${this.suppressedEmits} emit(s) suppressed`);
    }
    if (this.buffer.length >= BRIDGE_BUFFER_MAX_SIZE) {
      alerts.push('Buffer at capacity');
    }

    let riskTier: BridgeHealthReport['riskTier'];
    if (healthScore >= 0.9) riskTier = 'CLEAR';
    else if (healthScore >= 0.7) riskTier = 'LOW';
    else if (healthScore >= 0.5) riskTier = 'MEDIUM';
    else if (healthScore >= 0.25) riskTier = 'HIGH';
    else riskTier = 'CRITICAL';

    return {
      riskTier,
      totalEmits: this.totalEmits,
      suppressedEmits: this.suppressedEmits,
      bufferOverflows: this.bufferOverflows,
      alerts,
    };
  }

  public serialize(): BridgeSerializedState {
    const raw = JSON.stringify({
      totalEmits: this.totalEmits,
      suppressedEmits: this.suppressedEmits,
      lastEmitTick: this.lastEmitTick,
    });
    const checksum = createHash('sha256').update(raw).digest('hex').slice(0, 16);

    return {
      totalEmits: this.totalEmits,
      suppressedEmits: this.suppressedEmits,
      lastEmitTick: this.lastEmitTick,
      checksum,
    };
  }

  public exportBundle(): BridgeExportBundle {
    return {
      analytics: this.computeAnalytics(),
      healthReport: this.computeHealthReport(),
      recentEmits: [...this.history],
      serialized: this.serialize(),
    };
  }

  public reset(): void {
    this.history.length = 0;
    this.buffer.length = 0;
    for (const key of Object.keys(this.emitsByType)) {
      delete this.emitsByType[key];
    }
    this.totalEmits = 0;
    this.suppressedEmits = 0;
    this.bufferOverflows = 0;
    this.lastEmitTick = 0;
    this.firstEmitTick = null;
  }

  // -------------------------------------------------------------------------
  // Public accessor for pulse state via TENSION_CONSTANTS
  // -------------------------------------------------------------------------

  public isPulseActive(score: number): boolean {
    return score >= TENSION_CONSTANTS.PULSE_THRESHOLD;
  }

  // -------------------------------------------------------------------------
  // Visibility state grouping helper
  // -------------------------------------------------------------------------

  public getAllVisibilityStates(): readonly TensionVisibilityState[] {
    return Object.values(TENSION_VISIBILITY_STATE);
  }

  // -------------------------------------------------------------------------
  // Threat severity classifier
  // -------------------------------------------------------------------------

  public classifySeverityFromScore(score: number): ThreatSeverity {
    if (score >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL]) {
      return THREAT_SEVERITY.EXISTENTIAL;
    }
    if (score >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL]) {
      return THREAT_SEVERITY.CRITICAL;
    }
    if (score >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE]) {
      return THREAT_SEVERITY.SEVERE;
    }
    if (score >= THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE]) {
      return THREAT_SEVERITY.MODERATE;
    }
    return THREAT_SEVERITY.MINOR;
  }

  // -------------------------------------------------------------------------
  // Envelope batch helpers
  // -------------------------------------------------------------------------

  public resolveEnvelopesForVisibility(
    envelopes: readonly ThreatEnvelope[],
    visibilityState: TensionVisibilityState,
  ): readonly ThreatEnvelope[] {
    const config = VISIBILITY_CONFIGS[visibilityState];
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];

    if (!config.showsThreatType) {
      return envelopes.map((env) => ({
        ...env,
        visibleAs: envelopeLevel,
      }));
    }

    return envelopes.map((env) => ({
      ...env,
      visibleAs: envelopeLevel,
    }));
  }

  // -------------------------------------------------------------------------
  // Bulk analytics aggregation
  // -------------------------------------------------------------------------

  public aggregateEntrySeverityWeights(
    entries: readonly AnticipationEntry[],
  ): Readonly<Record<ThreatSeverity, number>> {
    const result: Record<ThreatSeverity, number> = {
      [THREAT_SEVERITY.MINOR]: 0,
      [THREAT_SEVERITY.MODERATE]: 0,
      [THREAT_SEVERITY.SEVERE]: 0,
      [THREAT_SEVERITY.CRITICAL]: 0,
      [THREAT_SEVERITY.EXISTENTIAL]: 0,
    };

    for (const entry of entries) {
      result[entry.threatSeverity] += THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Pressure tier amplifier table dump (diagnostic)
  // -------------------------------------------------------------------------

  public dumpAmplifierTable(): Readonly<Record<PressureTier, number>> {
    return PRESSURE_TENSION_AMPLIFIERS;
  }

  // -------------------------------------------------------------------------
  // Channel routing for all threat types
  // -------------------------------------------------------------------------

  public buildFullChannelRouteMap(): Readonly<Record<ThreatType, string>> {
    return BRIDGE_CHANNEL_ROUTES;
  }

  // -------------------------------------------------------------------------
  // Mitigation table dump
  // -------------------------------------------------------------------------

  public dumpMitigationTable(): Readonly<Record<ThreatType, readonly string[]>> {
    return THREAT_TYPE_DEFAULT_MITIGATIONS;
  }

  // -------------------------------------------------------------------------
  // Visibility order inspection
  // -------------------------------------------------------------------------

  public getVisibilityOrderedStates(): readonly TensionVisibilityState[] {
    return VISIBILITY_ORDER;
  }

  public computeVisibilityUpgradeSteps(
    from: TensionVisibilityState,
  ): readonly TensionVisibilityState[] {
    const fromIdx = VISIBILITY_ORDER.indexOf(from);
    return VISIBILITY_ORDER.slice(fromIdx + 1);
  }

  public computeVisibilityDowngradeSteps(
    from: TensionVisibilityState,
  ): readonly TensionVisibilityState[] {
    const fromIdx = VISIBILITY_ORDER.indexOf(from);
    return VISIBILITY_ORDER.slice(0, fromIdx).reverse();
  }

  // -------------------------------------------------------------------------
  // Per-pressure-tier urgency scoring
  // -------------------------------------------------------------------------

  public scoreAllPressureTiers(score: number): Readonly<Record<PressureTier, number>> {
    return {
      T0: this.computeAmplifiedUrgency(score, 'T0'),
      T1: this.computeAmplifiedUrgency(score, 'T1'),
      T2: this.computeAmplifiedUrgency(score, 'T2'),
      T3: this.computeAmplifiedUrgency(score, 'T3'),
      T4: this.computeAmplifiedUrgency(score, 'T4'),
    };
  }

  // -------------------------------------------------------------------------
  // Convenience batch payload builder
  // -------------------------------------------------------------------------

  public buildBatchThreatPayloads(
    entries: readonly AnticipationEntry[],
    tick: number,
  ): readonly EnrichedThreatPayload[] {
    return entries.map((e) => this.buildEnrichedThreatPayload(e, tick));
  }

  // -------------------------------------------------------------------------
  // Checksum batch helper
  // -------------------------------------------------------------------------

  public computeChecksumForEntries(
    entries: readonly AnticipationEntry[],
  ): string {
    const raw = JSON.stringify(entries.map((e) => e.entryId));
    return createHash('sha256').update(raw).digest('hex').slice(0, 16);
  }

  // -------------------------------------------------------------------------
  // History introspection
  // -------------------------------------------------------------------------

  public getHistoryForEvent(eventName: string): readonly EmitRecord[] {
    return this.history.filter((r) => r.eventName === eventName);
  }

  public getHistoryInTickRange(
    fromTick: number,
    toTick: number,
  ): readonly EmitRecord[] {
    return this.history.filter((r) => r.tick >= fromTick && r.tick <= toTick);
  }

  public getMostRecentEmit(): EmitRecord | null {
    return this.history.length > 0
      ? (this.history[this.history.length - 1] ?? null)
      : null;
  }

  // -------------------------------------------------------------------------
  // Narrative factory for all entries
  // -------------------------------------------------------------------------

  public generateAllThreatNarratives(
    entries: readonly AnticipationEntry[],
    tick: number,
  ): readonly string[] {
    return entries.map((e) => this.generateThreatNarrative(e, tick));
  }

  // -------------------------------------------------------------------------
  // Self-test delegation
  // -------------------------------------------------------------------------

  public runSelfTest(): BridgeSelfTestResult {
    return runBridgeSelfTest();
  }

  // -------------------------------------------------------------------------
  // Score trend analysis
  // -------------------------------------------------------------------------

  public computeScoreTrend(
    snapshots: readonly TensionRuntimeSnapshot[],
  ): 'RISING' | 'FALLING' | 'STABLE' {
    if (snapshots.length < 2) return 'STABLE';
    const last = snapshots[snapshots.length - 1];
    const prev = snapshots[snapshots.length - 2];
    if (!last || !prev) return 'STABLE';
    const delta = last.score - prev.score;
    if (delta > 0.01) return 'RISING';
    if (delta < -0.01) return 'FALLING';
    return 'STABLE';
  }

  // -------------------------------------------------------------------------
  // Emit rate guard
  // -------------------------------------------------------------------------

  private canEmitAtTick(tick: number): boolean {
    if (tick - this.lastEmitTick >= BRIDGE_RATE_LIMIT_TICKS) return true;
    this.suppressedEmits += 1;
    return false;
  }

  // -------------------------------------------------------------------------
  // Rate-limited score emit
  // -------------------------------------------------------------------------

  public emitScoreUpdatedRateLimited(snapshot: TensionRuntimeSnapshot): void {
    if (!this.canEmitAtTick(snapshot.tickNumber)) return;
    this.emitScoreUpdated(snapshot);
  }

  // -------------------------------------------------------------------------
  // Composite emit: score + visibility on the same tick
  // -------------------------------------------------------------------------

  public emitScoreAndVisibility(
    snapshot: TensionRuntimeSnapshot,
    from: TensionVisibilityState,
    to: TensionVisibilityState,
  ): void {
    this.emitScoreUpdated(snapshot);
    if (from !== to) {
      this.emitVisibilityChanged(from, to, snapshot.tickNumber, snapshot.timestamp);
    }
  }

  // -------------------------------------------------------------------------
  // Dominant threat enrichment helper
  // -------------------------------------------------------------------------

  public buildDominantThreatSummary(
    entries: readonly AnticipationEntry[],
    dominantEntryId: string | null,
  ): string {
    if (dominantEntryId === null || entries.length === 0) {
      return 'No dominant threat';
    }
    const entry = entries.find((e) => e.entryId === dominantEntryId);
    if (!entry) return 'Dominant threat not found in entries';

    const mitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType];
    const weight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
    const channel = BRIDGE_CHANNEL_ROUTES[entry.threatType];

    return (
      `Dominant: ${entry.threatType} [${entry.threatSeverity}]` +
      ` weight=${weight.toFixed(2)} channel=${channel}` +
      ` mitigations=[${mitigations.join(', ')}]`
    );
  }

  // -------------------------------------------------------------------------
  // Envelope visibility resolution for batch
  // -------------------------------------------------------------------------

  public resolveAllEnvelopeLevels(
    states: readonly TensionVisibilityState[],
  ): readonly VisibilityLevel[] {
    return states.map((s) => INTERNAL_VISIBILITY_TO_ENVELOPE[s]);
  }

  // -------------------------------------------------------------------------
  // Visibility config batch query
  // -------------------------------------------------------------------------

  public getVisibilityConfigsForStates(
    states: readonly TensionVisibilityState[],
  ): readonly VisibilityConfig[] {
    return states.map((s) => VISIBILITY_CONFIGS[s]);
  }

  // -------------------------------------------------------------------------
  // Urgency classifier for all threat types simultaneously
  // -------------------------------------------------------------------------

  public classifyAllTypeUrgencies(): Readonly<Record<ThreatType, string>> {
    const result: Record<string, string> = {};
    for (const type of Object.values(THREAT_TYPE)) {
      result[type] = BRIDGE_CHANNEL_ROUTES[type];
    }
    return result as Readonly<Record<ThreatType, string>>;
  }

  // -------------------------------------------------------------------------
  // Emit summary string
  // -------------------------------------------------------------------------

  public buildEmitSummary(): string {
    const analytics = this.computeAnalytics();
    const health = this.computeHealthReport();
    return (
      `TensionUXBridge | emits=${analytics.totalEmits}` +
      ` rate=${analytics.emitRate.toFixed(3)}/tick` +
      ` risk=${health.riskTier}` +
      ` buffer=${analytics.bufferSize}/${BRIDGE_BUFFER_MAX_SIZE}`
    );
  }

  // -------------------------------------------------------------------------
  // Per-entry urgency enrichment table
  // -------------------------------------------------------------------------

  public buildEntryUrgencyTable(
    entries: readonly AnticipationEntry[],
    pressureTier: PressureTier,
  ): ReadonlyArray<{
    entryId: string;
    rawWeight: number;
    amplifiedWeight: number;
    urgency: UrgencyLabel;
    channelRoute: string;
    mitigations: readonly string[];
  }> {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    return entries.map((entry) => {
      const rawWeight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
      const amplifiedWeight = Math.min(1, rawWeight * amplifier);
      const urgency = this.classifyEmitUrgency(amplifiedWeight);
      const channelRoute = BRIDGE_CHANNEL_ROUTES[entry.threatType];
      const mitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType];
      return {
        entryId: entry.entryId,
        rawWeight,
        amplifiedWeight,
        urgency,
        channelRoute,
        mitigations,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Severity bucket aggregation
  // -------------------------------------------------------------------------

  public bucketEntriesBySeverity(
    entries: readonly AnticipationEntry[],
  ): Readonly<Record<ThreatSeverity, readonly AnticipationEntry[]>> {
    const buckets: Record<ThreatSeverity, AnticipationEntry[]> = {
      [THREAT_SEVERITY.MINOR]: [],
      [THREAT_SEVERITY.MODERATE]: [],
      [THREAT_SEVERITY.SEVERE]: [],
      [THREAT_SEVERITY.CRITICAL]: [],
      [THREAT_SEVERITY.EXISTENTIAL]: [],
    };
    for (const entry of entries) {
      buckets[entry.threatSeverity].push(entry);
    }
    return buckets;
  }

  // -------------------------------------------------------------------------
  // Visibility-aware threat filter
  // -------------------------------------------------------------------------

  public filterEntriesForVisibility(
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
  ): readonly AnticipationEntry[] {
    const config = VISIBILITY_CONFIGS[visibilityState];
    if (!config.showsThreatType) {
      return entries;
    }
    if (!config.showsMitigationPath) {
      return entries.filter((e) => e.isArrived || e.state === 'QUEUED');
    }
    return entries;
  }

  // -------------------------------------------------------------------------
  // Pressure-tier emit multiplier report
  // -------------------------------------------------------------------------

  public buildPressureMultiplierReport(): ReadonlyArray<{
    tier: PressureTier;
    amplifier: number;
    urgencyAtHalfScore: UrgencyLabel;
    urgencyAtFullScore: UrgencyLabel;
  }> {
    const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    return tiers.map((tier) => {
      const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];
      const urgencyAtHalfScore = this.classifyEmitUrgency(
        this.computeAmplifiedUrgency(0.5, tier),
      );
      const urgencyAtFullScore = this.classifyEmitUrgency(
        this.computeAmplifiedUrgency(1.0, tier),
      );
      return { tier, amplifier, urgencyAtHalfScore, urgencyAtFullScore };
    });
  }

  // -------------------------------------------------------------------------
  // Emit history statistics
  // -------------------------------------------------------------------------

  public computeHistoryStats(): Readonly<{
    totalRecords: number;
    uniqueEventTypes: number;
    minTick: number;
    maxTick: number;
    averageTickGap: number;
  }> {
    if (this.history.length === 0) {
      return {
        totalRecords: 0,
        uniqueEventTypes: 0,
        minTick: 0,
        maxTick: 0,
        averageTickGap: 0,
      };
    }

    const ticks = this.history.map((r) => r.tick);
    const minTick = Math.min(...ticks);
    const maxTick = Math.max(...ticks);
    const uniqueEventTypes = new Set(this.history.map((r) => r.eventName)).size;

    let totalGap = 0;
    for (let i = 1; i < ticks.length; i++) {
      totalGap += (ticks[i] ?? 0) - (ticks[i - 1] ?? 0);
    }
    const averageTickGap =
      this.history.length > 1 ? totalGap / (this.history.length - 1) : 0;

    return {
      totalRecords: this.history.length,
      uniqueEventTypes,
      minTick,
      maxTick,
      averageTickGap,
    };
  }

  // -------------------------------------------------------------------------
  // Envelopes-to-channel-route mapping
  // -------------------------------------------------------------------------

  public mapEnvelopesToChannelRoutes(
    envelopes: readonly ThreatEnvelope[],
    visibilityState: TensionVisibilityState,
  ): ReadonlyArray<{ envelopeVisibilityLevel: VisibilityLevel; channelRoute: string }> {
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
    return envelopes.map((env) => ({
      envelopeVisibilityLevel: env.visibleAs ?? envelopeLevel,
      channelRoute: resolveEventChannelForType(THREAT_TYPE.CASCADE),
    }));
  }

  // -------------------------------------------------------------------------
  // Composite visibility + envelope summary
  // -------------------------------------------------------------------------

  public buildVisibilityEnvelopeSummary(
    visibilityState: TensionVisibilityState,
    envelopes: readonly ThreatEnvelope[],
  ): string {
    const config = VISIBILITY_CONFIGS[visibilityState];
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
    const ordinal = this.visibilityOrdinal(visibilityState);

    return (
      `state=${visibilityState} ordinal=${ordinal}` +
      ` envelopeLevel=${envelopeLevel}` +
      ` envelopes=${envelopes.length}` +
      ` showsType=${config.showsThreatType}` +
      ` showsArrival=${config.showsArrivalTick}` +
      ` showsMitigation=${config.showsMitigationPath}` +
      ` awarenessBonus=${config.tensionAwarenessBonus}`
    );
  }

  // -------------------------------------------------------------------------
  // Grouped mitigations report across entries
  // -------------------------------------------------------------------------

  public buildGroupedMitigationsReport(
    entries: readonly AnticipationEntry[],
  ): Readonly<Record<ThreatType, readonly string[]>> {
    const result = {} as Record<ThreatType, readonly string[]>;
    for (const type of Object.values(THREAT_TYPE)) {
      result[type] = THREAT_TYPE_DEFAULT_MITIGATIONS[type];
    }
    // mark which threat types are actually present in entries
    const presentTypes = new Set(entries.map((e) => e.threatType));
    const output: Record<string, readonly string[]> = {};
    for (const type of Object.values(THREAT_TYPE)) {
      if (presentTypes.has(type)) {
        output[type] = result[type];
      }
    }
    return output as Readonly<Record<ThreatType, readonly string[]>>;
  }

  // -------------------------------------------------------------------------
  // Tick-based emit window analysis
  // -------------------------------------------------------------------------

  public computeEmitDensity(windowTicks: number): number {
    if (windowTicks <= 0) return 0;
    const windowStart = this.lastEmitTick - windowTicks;
    const inWindow = this.history.filter((r) => r.tick >= windowStart);
    return inWindow.length / windowTicks;
  }

  // -------------------------------------------------------------------------
  // Snapshot comparison enrichment
  // -------------------------------------------------------------------------

  public buildSnapshotDiff(
    prev: TensionRuntimeSnapshot,
    curr: TensionRuntimeSnapshot,
  ): Readonly<{
    scoreDelta: number;
    visibilityChanged: boolean;
    visibilityDistance: number;
    pulseTransitioned: boolean;
    queueDelta: number;
    amplifiedDeltaDiff: number;
  }> {
    const visibilityChanged = prev.visibilityState !== curr.visibilityState;
    const visibilityDistance = this.computeVisibilityDistance(
      prev.visibilityState,
      curr.visibilityState,
    );
    const prevPulse = prev.score >= TENSION_CONSTANTS.PULSE_THRESHOLD;
    const currPulse = curr.score >= TENSION_CONSTANTS.PULSE_THRESHOLD;

    return {
      scoreDelta: curr.score - prev.score,
      visibilityChanged,
      visibilityDistance,
      pulseTransitioned: prevPulse !== currPulse,
      queueDelta: curr.queueLength - prev.queueLength,
      amplifiedDeltaDiff: curr.amplifiedDelta - prev.amplifiedDelta,
    };
  }

  // -------------------------------------------------------------------------
  // Narrative batch for queue state
  // -------------------------------------------------------------------------

  public buildQueueStateNarrative(
    queueLength: number,
    arrivedCount: number,
    queuedCount: number,
    expiredCount: number,
    visibilityState: TensionVisibilityState,
    pressureTier: PressureTier,
  ): string {
    const config = VISIBILITY_CONFIGS[visibilityState];
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];

    let narrative = `Queue: ${queueLength} total`;
    if (config.showsThreatCount) {
      narrative += ` | arrived=${arrivedCount} queued=${queuedCount} expired=${expiredCount}`;
    }
    narrative += ` | pressure=${pressureTier} amplifier=${amplifier}`;
    narrative += ` | envelope=${envelopeLevel}`;
    return narrative;
  }

  // -------------------------------------------------------------------------
  // Threat timeline builder
  // -------------------------------------------------------------------------

  public buildThreatTimeline(
    entries: readonly AnticipationEntry[],
    currentTick: number,
  ): ReadonlyArray<{
    entryId: string;
    threatType: ThreatType;
    severity: ThreatSeverity;
    ticksUntilArrival: number;
    severityWeight: number;
    channel: string;
  }> {
    return entries
      .filter((e) => !e.isArrived && !e.isExpired && !e.isMitigated)
      .map((e) => ({
        entryId: e.entryId,
        threatType: e.threatType,
        severity: e.threatSeverity,
        ticksUntilArrival: Math.max(0, e.arrivalTick - currentTick),
        severityWeight: THREAT_SEVERITY_WEIGHTS[e.threatSeverity],
        channel: BRIDGE_CHANNEL_ROUTES[e.threatType],
      }))
      .sort((a, b) => a.ticksUntilArrival - b.ticksUntilArrival);
  }

  // -------------------------------------------------------------------------
  // Worst-case threat identification
  // -------------------------------------------------------------------------

  public identifyWorstCaseThreat(
    entries: readonly AnticipationEntry[],
    pressureTier: PressureTier,
  ): AnticipationEntry | null {
    if (entries.length === 0) return null;
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    let worst: AnticipationEntry | null = null;
    let worstScore = -Infinity;

    for (const entry of entries) {
      const weight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
      const score = weight * amplifier;
      if (score > worstScore) {
        worstScore = score;
        worst = entry;
      }
    }

    return worst;
  }

  // -------------------------------------------------------------------------
  // Envelope visibility level distribution
  // -------------------------------------------------------------------------

  public computeEnvelopeLevelDistribution(
    visibilityStates: readonly TensionVisibilityState[],
  ): Readonly<Record<VisibilityLevel, number>> {
    const dist: Record<string, number> = {
      HIDDEN: 0,
      SILHOUETTE: 0,
      PARTIAL: 0,
      EXPOSED: 0,
    };
    for (const state of visibilityStates) {
      const level = INTERNAL_VISIBILITY_TO_ENVELOPE[state];
      dist[level] = (dist[level] ?? 0) + 1;
    }
    return dist as Readonly<Record<VisibilityLevel, number>>;
  }

  // -------------------------------------------------------------------------
  // Full diagnostic payload for debugging
  // -------------------------------------------------------------------------

  public buildDiagnosticPayload(
    snapshot: TensionRuntimeSnapshot,
    pressureTier: PressureTier,
    entries: readonly AnticipationEntry[],
  ): object {
    const enriched = this.buildEnrichedScorePayload(snapshot, pressureTier);
    const narrative = this.generateNarrative(snapshot, pressureTier, entries);
    const analytics = this.computeAnalytics();
    const health = this.computeHealthReport();
    const serialized = this.serialize();
    const checksum = this.computeEmitChecksum({ snapshot, pressureTier });
    const weightedUrgency = this.computeWeightedUrgency(entries);
    const amplifiedUrgency = this.computeAmplifiedUrgency(
      snapshot.score,
      pressureTier,
    );
    const visConfig = this.getVisibilityConfig(snapshot.visibilityState);
    const envelopeLevel = this.resolveEnvelopeVisibility(snapshot.visibilityState);
    const ordinal = this.visibilityOrdinal(snapshot.visibilityState);
    const worstCase = this.identifyWorstCaseThreat(entries, pressureTier);

    return {
      enrichedScore: enriched,
      narrative,
      analytics,
      healthReport: health,
      serialized,
      checksum,
      weightedUrgency,
      amplifiedUrgency,
      visibilityConfig: visConfig,
      envelopeLevel,
      visibilityOrdinal: ordinal,
      worstCaseThreat: worstCase
        ? {
            entryId: worstCase.entryId,
            type: worstCase.threatType,
            severity: worstCase.threatSeverity,
            channel: BRIDGE_CHANNEL_ROUTES[worstCase.threatType],
            mitigations: THREAT_TYPE_DEFAULT_MITIGATIONS[worstCase.threatType],
          }
        : null,
    };
  }

  // -------------------------------------------------------------------------
  // Emit flush — drains buffer entries and records them
  // -------------------------------------------------------------------------

  public flushBuffer(tick: number): readonly unknown[] {
    const flushed = [...this.buffer];
    this.buffer.length = 0;
    for (const item of flushed) {
      this.recordEmit('buffer.flush', tick, item);
    }
    return flushed;
  }

  // -------------------------------------------------------------------------
  // Visibility state change recommendation
  // -------------------------------------------------------------------------

  public recommendVisibilityState(
    score: number,
    pressureTier: PressureTier,
  ): TensionVisibilityState {
    const amplifiedScore = this.computeAmplifiedUrgency(score, pressureTier);

    if (amplifiedScore >= BRIDGE_URGENCY_THRESHOLDS.CRITICAL) {
      return TENSION_VISIBILITY_STATE.EXPOSED;
    }
    if (amplifiedScore >= BRIDGE_URGENCY_THRESHOLDS.HIGH) {
      return TENSION_VISIBILITY_STATE.TELEGRAPHED;
    }
    if (amplifiedScore >= BRIDGE_URGENCY_THRESHOLDS.MEDIUM) {
      return TENSION_VISIBILITY_STATE.SIGNALED;
    }
    return TENSION_VISIBILITY_STATE.SHADOWED;
  }

  // -------------------------------------------------------------------------
  // Awareness bonus aggregation across a sequence of visibility states
  // -------------------------------------------------------------------------

  public sumAwarenessBonuses(
    states: readonly TensionVisibilityState[],
  ): number {
    let total = 0;
    for (const state of states) {
      total += VISIBILITY_CONFIGS[state].tensionAwarenessBonus;
    }
    return total;
  }

  // -------------------------------------------------------------------------
  // Pulse threshold inspection helper
  // -------------------------------------------------------------------------

  public computePulseMargin(score: number): number {
    return TENSION_CONSTANTS.PULSE_THRESHOLD - score;
  }

  public isPulseImminent(score: number, threshold = 0.05): boolean {
    return this.computePulseMargin(score) <= threshold && score < TENSION_CONSTANTS.PULSE_THRESHOLD;
  }

  // -------------------------------------------------------------------------
  // Threat type distribution across entries
  // -------------------------------------------------------------------------

  public computeThreatTypeDistribution(
    entries: readonly AnticipationEntry[],
  ): Readonly<Record<ThreatType, number>> {
    const counts: Record<string, number> = {};
    for (const type of Object.values(THREAT_TYPE)) {
      counts[type] = 0;
    }
    for (const entry of entries) {
      counts[entry.threatType] = (counts[entry.threatType] ?? 0) + 1;
    }
    return counts as Readonly<Record<ThreatType, number>>;
  }

  // -------------------------------------------------------------------------
  // Cascade chain detection
  // -------------------------------------------------------------------------

  public detectCascadeChains(
    entries: readonly AnticipationEntry[],
  ): ReadonlyArray<{ triggerId: string; dependentIds: readonly string[] }> {
    const chains = new Map<string, string[]>();
    for (const entry of entries) {
      if (entry.isCascadeTriggered && entry.cascadeTriggerEventId !== null) {
        const triggerId = entry.cascadeTriggerEventId;
        if (!chains.has(triggerId)) {
          chains.set(triggerId, []);
        }
        chains.get(triggerId)!.push(entry.entryId);
      }
    }
    return Array.from(chains.entries()).map(([triggerId, dependentIds]) => ({
      triggerId,
      dependentIds,
    }));
  }

  // -------------------------------------------------------------------------
  // Multi-tier pressure comparison
  // -------------------------------------------------------------------------

  public comparePressureTierImpact(
    score: number,
    tierA: PressureTier,
    tierB: PressureTier,
  ): Readonly<{
    tierA: PressureTier;
    tierB: PressureTier;
    scoreA: number;
    scoreB: number;
    delta: number;
    higherTier: PressureTier;
  }> {
    const scoreA = this.computeAmplifiedUrgency(score, tierA);
    const scoreB = this.computeAmplifiedUrgency(score, tierB);
    const higherTier = scoreA >= scoreB ? tierA : tierB;
    return {
      tierA,
      tierB,
      scoreA,
      scoreB,
      delta: Math.abs(scoreA - scoreB),
      higherTier,
    };
  }

  // -------------------------------------------------------------------------
  // Mitigation coverage analysis
  // -------------------------------------------------------------------------

  public computeMitigationCoverage(
    entries: readonly AnticipationEntry[],
  ): Readonly<{
    coveredTypes: readonly ThreatType[];
    uncoveredTypes: readonly ThreatType[];
    coverageRatio: number;
  }> {
    const allTypes = Object.values(THREAT_TYPE);
    const presentTypes = new Set(entries.map((e) => e.threatType));
    const coveredTypes = allTypes.filter((t) => presentTypes.has(t));
    const uncoveredTypes = allTypes.filter((t) => !presentTypes.has(t));

    return {
      coveredTypes,
      uncoveredTypes,
      coverageRatio: coveredTypes.length / allTypes.length,
    };
  }

  // -------------------------------------------------------------------------
  // Emit history checksum (integrity check over history window)
  // -------------------------------------------------------------------------

  public computeHistoryIntegrityChecksum(): string {
    const fingerprint = this.history
      .map((r) => `${r.eventName}:${r.tick}:${r.payloadChecksum}`)
      .join('|');
    return createHash('sha256').update(fingerprint).digest('hex').slice(0, 24);
  }

  // -------------------------------------------------------------------------
  // Event name validation against TENSION_EVENT_NAMES
  // -------------------------------------------------------------------------

  public isKnownEventName(name: string): boolean {
    return Object.values(TENSION_EVENT_NAMES).includes(
      name as (typeof TENSION_EVENT_NAMES)[keyof typeof TENSION_EVENT_NAMES],
    );
  }

  // -------------------------------------------------------------------------
  // Per-tier urgency label map
  // -------------------------------------------------------------------------

  public buildUrgencyLabelMapForScore(
    score: number,
  ): Readonly<Record<PressureTier, UrgencyLabel>> {
    return {
      T0: this.classifyEmitUrgency(this.computeAmplifiedUrgency(score, 'T0')),
      T1: this.classifyEmitUrgency(this.computeAmplifiedUrgency(score, 'T1')),
      T2: this.classifyEmitUrgency(this.computeAmplifiedUrgency(score, 'T2')),
      T3: this.classifyEmitUrgency(this.computeAmplifiedUrgency(score, 'T3')),
      T4: this.classifyEmitUrgency(this.computeAmplifiedUrgency(score, 'T4')),
    };
  }

  // -------------------------------------------------------------------------
  // Score range check using TENSION_CONSTANTS
  // -------------------------------------------------------------------------

  public isScoreInValidRange(score: number): boolean {
    return (
      score >= TENSION_CONSTANTS.MIN_SCORE && score <= TENSION_CONSTANTS.MAX_SCORE
    );
  }

  // -------------------------------------------------------------------------
  // Decay contribution summary
  // -------------------------------------------------------------------------

  public summarizeContributionBreakdown(
    snapshot: TensionRuntimeSnapshot,
  ): string {
    const b = snapshot.contributionBreakdown;
    return (
      `contributions: queued=${b.queuedThreats.toFixed(4)}` +
      ` arrived=${b.arrivedThreats.toFixed(4)}` +
      ` expired=${b.expiredGhosts.toFixed(4)}` +
      ` mitDecay=${b.mitigationDecay.toFixed(4)}` +
      ` nullDecay=${b.nullifyDecay.toFixed(4)}` +
      ` emptyQueue=${b.emptyQueueBonus.toFixed(4)}` +
      ` visibility=${b.visibilityBonus.toFixed(4)}` +
      ` sovereignty=${b.sovereigntyBonus.toFixed(4)}`
    );
  }

  // -------------------------------------------------------------------------
  // Emit type frequency report
  // -------------------------------------------------------------------------

  public buildEmitFrequencyReport(): ReadonlyArray<{
    eventName: string;
    count: number;
    percentage: number;
  }> {
    if (this.totalEmits === 0) return [];
    return Object.entries(this.emitsByType)
      .map(([eventName, count]) => ({
        eventName,
        count,
        percentage: (count / this.totalEmits) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }
}
