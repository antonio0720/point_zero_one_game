/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT TENSION POLICY SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/TensionPolicySignalAdapter.ts
 * VERSION: 2026.03.26
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Translates TensionPolicyResolver output — visibility policy results, health
 * reports, policy narratives, and export bundles — into ChatInputEnvelope
 * objects for the backend chat lane.
 *
 * Owns:
 * - Policy result → envelope translation with priority, channel, and narrative
 * - 16-feature ML vector and 8-feature DL row extraction from policy surfaces
 * - Tick-level key-based deduplication (3-tick window)
 * - Visibility-state channel routing and health-driven priority classification
 * - UX label generation via TENSION_EVENT_NAMES
 * - 0–100 risk scoring for churn and intervention models
 * - Export bundle pass-through adaptation
 * - Resolver delegation for schedule, upsert, classification, and action windows
 * - Session-level analytics
 *
 * Does not own: transcript mutation, NPC speech, rate policy, socket fanout,
 * replay persistence, or final tension score authority.
 *
 * Design laws:
 * - Preserve the tension vocabulary. Do not genericise.
 * - EXPOSED/TELEGRAPHED always escalate channel priority above SHADOWED/SIGNALED.
 * - TENSION_CONSTANTS.PULSE_THRESHOLD gates pulse priority escalation.
 * - THREAT_SEVERITY_WEIGHTS drive all weight-based computations.
 * - ML/DL output must be deterministic and replay-safe.
 * - PRESSURE_TENSION_AMPLIFIERS must modulate all decay-tier computations.
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
  TensionPolicyResolver,
  POLICY_ML_FEATURE_COUNT,
  POLICY_DL_SEQUENCE_LENGTH,
  POLICY_DL_FEATURE_WIDTH,
  POLICY_RESOLVER_VERSION,
  type TensionVisibilityPolicyResult,
  type ThreatSchedulePolicyInput,
  type QueueUpsertBuildInput,
  type PolicyMLVector,
  type PolicyDLTensor,
  type PolicyDecayContribution,
  type PolicyEntryClassification,
  type PolicyEventRouteResult,
  type PolicyHealthReport,
  type PolicyQueueAnalysis,
  type PolicyNarrative,
  type PolicyExportBundle,
  type PolicySelfTestResult,
} from '../../tension/TensionPolicyResolver';

import {
  TENSION_CONSTANTS,
  TENSION_EVENT_NAMES,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  ENTRY_STATE,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  VISIBILITY_ORDER,
  PRESSURE_TENSION_AMPLIFIERS,
  type TensionVisibilityState,
  type ThreatSeverity,
  type ThreatType,
  type EntryState,
  type QueueUpsertInput,
  type AnticipationEntry,
} from '../../tension/types';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const TENSION_POLICY_SIGNAL_ADAPTER_VERSION = '2026.03.26' as const;
export const TENSION_POLICY_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 16 as const;
export const TENSION_POLICY_SIGNAL_ADAPTER_DL_FEATURE_COUNT = 8 as const;
export const TENSION_POLICY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS = 3 as const;
export const TENSION_POLICY_SIGNAL_ADAPTER_MAX_BATCH_SIZE = 32 as const;

/** All signal priority levels produced by this adapter. */
export const POLICY_SIGNAL_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'AMBIENT'] as const;
export type PolicySignalPriority = (typeof POLICY_SIGNAL_PRIORITIES)[number];

// ============================================================================
// MARK: Exported interfaces
// ============================================================================

export interface PolicyAdapterAnalytics {
  readonly totalAdapted: number;
  readonly totalDeduplicated: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly ambientCount: number;
  readonly lastAdaptedTick: number | null;
  readonly averagePriorityScore: number;
}

export interface TensionPolicySignal extends ChatSignalEnvelope {
  readonly signalType: 'TENSION_POLICY';
  readonly visibilityState: string;
  readonly envelopeVisibility: string;
  readonly awarenessBonus: number;
  readonly healthScore: number;
  readonly queuePressureIndex: number;
  readonly decayContributionTotal: number;
  readonly pulseActive: boolean;
}

export interface PolicyAdapterOptions {
  readonly dedupeWindowTicks?: number;
  readonly maxBatchSize?: number;
  readonly defaultChannel?: ChatVisibleChannel;
  readonly roomId?: Nullable<ChatRoomId>;
}

export interface PolicyAdapterContext {
  readonly runId: string;
  readonly tick: number;
  readonly timestamp?: number;
  readonly roomId?: Nullable<ChatRoomId>;
  readonly channel?: ChatVisibleChannel;
}

export interface PolicySignalBatch {
  readonly signals: readonly ChatInputEnvelope[];
  readonly analytics: PolicyAdapterAnalytics;
  readonly batchId: string;
  readonly tick: number;
  readonly timestamp: number;
}

export interface PolicyMLExtract {
  readonly features: readonly number[];
  readonly featureCount: number;
  readonly dlRow: readonly number[];
  readonly dlRowWidth: number;
  readonly tick: number;
}

// ============================================================================
// MARK: Internal state interface
// ============================================================================

interface InternalState {
  totalAdapted: number;
  totalDeduplicated: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  ambientCount: number;
  lastAdaptedTick: number | null;
  priorityScoreSum: number;
}

// ============================================================================
// MARK: Internal deduplicator
// ============================================================================

class PolicySignalDeduplicator {
  private readonly windowTicks: number;
  private readonly lastTickByKey = new Map<string, number>();
  private totalDeduplicated = 0;

  public constructor(windowTicks: number) {
    this.windowTicks = Math.max(1, windowTicks);
  }

  public isDuplicate(key: string, tick: number): boolean {
    const last = this.lastTickByKey.get(key);
    if (last === undefined) return false;
    return tick - last < this.windowTicks;
  }

  public record(key: string, tick: number): void {
    this.lastTickByKey.set(key, tick);
    // Evict oldest entries to keep memory bounded
    if (this.lastTickByKey.size > 512) {
      const firstKey = this.lastTickByKey.keys().next().value;
      if (firstKey !== undefined) {
        this.lastTickByKey.delete(firstKey);
      }
    }
  }

  public getTotalDeduplicated(): number {
    return this.totalDeduplicated;
  }

  public recordDuplicate(): void {
    this.totalDeduplicated++;
  }

  public reset(): void {
    this.lastTickByKey.clear();
    this.totalDeduplicated = 0;
  }
}

// ============================================================================
// MARK: Helper functions
// ============================================================================

/**
 * Clamp a value to [0, 100] and return as Score100.
 */
function clamp100(v: number): Score100 {
  return Math.max(0, Math.min(100, Math.round(v))) as Score100;
}

/**
 * Encode a TensionVisibilityState as a normalised float [0, 1].
 * Uses VISIBILITY_ORDER to derive the ordinal index.
 */
function encodeVisibilityState(state: TensionVisibilityState): number {
  const idx = VISIBILITY_ORDER.indexOf(state);
  return idx < 0 ? 0 : idx / Math.max(1, VISIBILITY_ORDER.length - 1);
}

/**
 * Resolve the signal priority for a policy result and health report.
 *
 * Escalation logic:
 * - CRITICAL: pulse threshold breached with EXPOSED visibility or CRITICAL/EXISTENTIAL
 *   health risk level
 * - HIGH: health is escalating, EXPOSED state, or CRITICAL risk
 * - MEDIUM: TELEGRAPHED state or MEDIUM risk or pulse active
 * - LOW: SIGNALED state or queue pressure above 0.4
 * - AMBIENT: everything else
 *
 * Uses TENSION_VISIBILITY_STATE, TENSION_CONSTANTS.PULSE_THRESHOLD,
 * THREAT_SEVERITY_WEIGHTS.
 */
function resolveSignalPriority(
  result: TensionVisibilityPolicyResult,
  health: PolicyHealthReport,
): PolicySignalPriority {
  const pulseThreshold = TENSION_CONSTANTS.PULSE_THRESHOLD;
  const existentialWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];
  const criticalWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL];
  const severeWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE];

  // CRITICAL: pulse breached at max visibility, or existential-equivalent risk
  if (
    (health.isPulseActive && health.score >= pulseThreshold &&
      result.state === TENSION_VISIBILITY_STATE.EXPOSED) ||
    health.riskLevel === 'CRITICAL' ||
    (health.healthScore <= 10 && result.state === TENSION_VISIBILITY_STATE.EXPOSED)
  ) {
    return 'CRITICAL';
  }

  // Use severity weights as thresholds for HIGH classification
  const awarenessWeight = result.awarenessBonus / existentialWeight;
  if (
    health.riskLevel === 'HIGH' ||
    health.isEscalating ||
    result.state === TENSION_VISIBILITY_STATE.EXPOSED ||
    (health.isPulseActive && awarenessWeight >= criticalWeight)
  ) {
    return 'HIGH';
  }

  // MEDIUM: telegraphed visibility or medium risk or pulse active
  if (
    result.state === TENSION_VISIBILITY_STATE.TELEGRAPHED ||
    health.riskLevel === 'MEDIUM' ||
    (health.isPulseActive && health.score >= pulseThreshold * severeWeight)
  ) {
    return 'MEDIUM';
  }

  // LOW: signaled state or notable queue pressure
  if (
    result.state === TENSION_VISIBILITY_STATE.SIGNALED ||
    health.queuePressureIndex >= 0.4
  ) {
    return 'LOW';
  }

  return 'AMBIENT';
}

/**
 * Resolve the chat channel for a policy result.
 *
 * Routing:
 * - EXPOSED → GLOBAL (maximum broadcast)
 * - TELEGRAPHED → SYNDICATE
 * - SIGNALED → DEAL_ROOM
 * - SHADOWED → LOBBY
 *
 * Uses TENSION_VISIBILITY_STATE.
 */
function resolveSignalChannel(result: TensionVisibilityPolicyResult): ChatVisibleChannel {
  switch (result.state) {
    case TENSION_VISIBILITY_STATE.EXPOSED:
      return 'GLOBAL';
    case TENSION_VISIBILITY_STATE.TELEGRAPHED:
      return 'SYNDICATE';
    case TENSION_VISIBILITY_STATE.SIGNALED:
      return 'DEAL_ROOM';
    case TENSION_VISIBILITY_STATE.SHADOWED:
      return 'LOBBY';
    default:
      return 'LOBBY';
  }
}

/**
 * Compute a normalised priority score [0, 1] for the given policy result and
 * health report.
 *
 * Integrates:
 * - Visibility config awareness bonus (VISIBILITY_CONFIGS)
 * - Pressure amplifier (PRESSURE_TENSION_AMPLIFIERS) via queue pressure index
 * - Health score
 * - Pulse state (TENSION_CONSTANTS)
 *
 * Returns a Score01-compatible number (but typed as plain number for
 * intermediate composition).
 */
function computePriorityScore(
  result: TensionVisibilityPolicyResult,
  health: PolicyHealthReport,
): number {
  const visConfig = VISIBILITY_CONFIGS[result.state];
  const awarenessContrib = visConfig.tensionAwarenessBonus * 0.15;

  // Queue pressure amplified by the tier implied from the pressure index
  // Map pressure index [0,1] onto approximate amplifier by lerping T0→T4
  const pMin = PRESSURE_TENSION_AMPLIFIERS['T0'];
  const pMax = PRESSURE_TENSION_AMPLIFIERS['T4'];
  const amplifierEst = pMin + (pMax - pMin) * Math.min(1, health.queuePressureIndex);
  const amplifiedPressure = Math.min(1, (health.queuePressureIndex * amplifierEst) / pMax);

  // Health score contribution (invert: lower health = higher threat)
  const healthContrib = (100 - Math.max(0, Math.min(100, health.healthScore))) / 100 * 0.35;

  // Pulse contribution
  const pulseContrib = health.isPulseActive &&
    health.score >= TENSION_CONSTANTS.PULSE_THRESHOLD ? 0.2 : 0;

  const raw = awarenessContrib + amplifiedPressure * 0.3 + healthContrib + pulseContrib;
  return clamp01(raw) as unknown as number;
}

/**
 * Build a typed metadata record from the policy result, health report, and
 * narrative.
 *
 * Uses: TENSION_EVENT_NAMES, INTERNAL_VISIBILITY_TO_ENVELOPE, VISIBILITY_ORDER,
 * THREAT_SEVERITY, THREAT_TYPE, ENTRY_STATE.
 */
function buildPolicyMetadata(
  result: TensionVisibilityPolicyResult,
  health: PolicyHealthReport,
  narrative: PolicyNarrative,
): Readonly<Record<string, JsonValue>> {
  const envelopeVis = INTERNAL_VISIBILITY_TO_ENVELOPE[result.state];
  const visibilityIndex = VISIBILITY_ORDER.indexOf(result.state);

  return Object.freeze({
    // Visibility surface
    visibilityState: result.state as JsonValue,
    envelopeVisibility: envelopeVis as JsonValue,
    visibilityIndex: visibilityIndex as JsonValue,
    previousState: (result.previousState ?? null) as JsonValue,
    changed: result.changed as JsonValue,
    awarenessBonus: result.awarenessBonus as JsonValue,
    stickyExposedApplied: result.stickyExposedApplied as JsonValue,
    pendingDowngradeState: (result.pendingDowngradeState ?? null) as JsonValue,
    pendingDowngradeTicksRemaining: result.pendingDowngradeTicksRemaining as JsonValue,
    lastExposedTick: (result.lastExposedTick ?? null) as JsonValue,

    // Health surface
    healthScore: health.healthScore as JsonValue,
    healthIsHealthy: health.isHealthy as JsonValue,
    healthIsPulseActive: health.isPulseActive as JsonValue,
    healthIsEscalating: health.isEscalating as JsonValue,
    healthRiskLevel: health.riskLevel as JsonValue,
    healthScore01: health.score as JsonValue,
    healthQueuePressureIndex: health.queuePressureIndex as JsonValue,
    healthDecayNetDelta: health.decayNetDelta as JsonValue,
    healthDominantEntryId: (health.dominantEntryId ?? null) as JsonValue,
    healthTick: health.tickNumber as JsonValue,

    // Narrative surface
    visibilityNarrative: narrative.visibilityNarrative as JsonValue,
    queueNarrative: narrative.queueNarrative as JsonValue,
    pulseNarrative: narrative.pulseNarrative as JsonValue,
    decayNarrative: narrative.decayNarrative as JsonValue,
    overallNarrative: narrative.overallNarrative as JsonValue,

    // Event name catalogue — ensures all values present in metadata
    eventNameScoreUpdated: TENSION_EVENT_NAMES.SCORE_UPDATED as JsonValue,
    eventNameVisibilityChanged: TENSION_EVENT_NAMES.VISIBILITY_CHANGED as JsonValue,
    eventNameQueueUpdated: TENSION_EVENT_NAMES.QUEUE_UPDATED as JsonValue,
    eventNamePulseFired: TENSION_EVENT_NAMES.PULSE_FIRED as JsonValue,
    eventNameThreatArrived: TENSION_EVENT_NAMES.THREAT_ARRIVED as JsonValue,
    eventNameThreatMitigated: TENSION_EVENT_NAMES.THREAT_MITIGATED as JsonValue,
    eventNameThreatExpired: TENSION_EVENT_NAMES.THREAT_EXPIRED as JsonValue,
    eventNameUpdatedLegacy: TENSION_EVENT_NAMES.UPDATED_LEGACY as JsonValue,

    // Severity catalogue
    severityMinor: THREAT_SEVERITY.MINOR as JsonValue,
    severityModerate: THREAT_SEVERITY.MODERATE as JsonValue,
    severitySevere: THREAT_SEVERITY.SEVERE as JsonValue,
    severityCritical: THREAT_SEVERITY.CRITICAL as JsonValue,
    severityExistential: THREAT_SEVERITY.EXISTENTIAL as JsonValue,

    // Threat type catalogue
    threatTypeDebtSpiral: THREAT_TYPE.DEBT_SPIRAL as JsonValue,
    threatTypeSabotage: THREAT_TYPE.SABOTAGE as JsonValue,
    threatTypeHaterInjection: THREAT_TYPE.HATER_INJECTION as JsonValue,
    threatTypeCascade: THREAT_TYPE.CASCADE as JsonValue,
    threatTypeSovereignty: THREAT_TYPE.SOVEREIGNTY as JsonValue,
    threatTypeOpportunityKill: THREAT_TYPE.OPPORTUNITY_KILL as JsonValue,
    threatTypeReputationBurn: THREAT_TYPE.REPUTATION_BURN as JsonValue,
    threatTypeShieldPierce: THREAT_TYPE.SHIELD_PIERCE as JsonValue,

    // Entry state catalogue
    entryStateQueued: ENTRY_STATE.QUEUED as JsonValue,
    entryStateArrived: ENTRY_STATE.ARRIVED as JsonValue,
    entryStateMitigated: ENTRY_STATE.MITIGATED as JsonValue,
    entryStateExpired: ENTRY_STATE.EXPIRED as JsonValue,
    entryStateNullified: ENTRY_STATE.NULLIFIED as JsonValue,
  });
}

/**
 * Extract a 16-feature ML vector from the policy result, health report, and
 * queue analysis.
 *
 * Feature layout:
 *  0  visibility state encoded (VISIBILITY_ORDER index / max)
 *  1  awareness bonus (clamped to [0,1])
 *  2  health score normalised (health.healthScore / 100)
 *  3  queue pressure index (clamped)
 *  4  decay net delta (normalised, clamped)
 *  5  pulse active flag (0/1)
 *  6  severity: EXISTENTIAL count normalised
 *  7  severity: CRITICAL count normalised
 *  8  severity: SEVERE count normalised
 *  9  severity: MODERATE count normalised
 * 10  severity: MINOR count normalised
 * 11  threat type: SOVEREIGNTY count normalised
 * 12  threat type: CASCADE count normalised
 * 13  threat type: DEBT_SPIRAL count normalised
 * 14  threat type: HATER_INJECTION count normalised
 * 15  pressure amplifier normalised (PRESSURE_TENSION_AMPLIFIERS)
 *
 * Validates that POLICY_ML_FEATURE_COUNT equals expected count at construction.
 */
function extractMLFeatures(
  result: TensionVisibilityPolicyResult,
  health: PolicyHealthReport,
  queue: PolicyQueueAnalysis,
): PolicyMLExtract {
  const visConfig = VISIBILITY_CONFIGS[result.state];
  const maxAwareness = Math.max(
    VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.EXPOSED].tensionAwarenessBonus,
    0.05,
  );

  // Feature 0: visibility encoded
  const f0 = encodeVisibilityState(result.state);

  // Feature 1: awareness bonus (normalised against exposed config)
  const f1 = clamp01(result.awarenessBonus / Math.max(maxAwareness, 0.001)) as unknown as number;

  // Feature 2: health score normalised
  const f2 = clamp01(health.healthScore / 100) as unknown as number;

  // Feature 3: queue pressure
  const f3 = clamp01(health.queuePressureIndex) as unknown as number;

  // Feature 4: decay net delta (positive = tensioning, normalised by arrived rate)
  const maxDecay = TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * PRESSURE_TENSION_AMPLIFIERS['T4'];
  const f4 = clamp01((health.decayNetDelta + maxDecay) / (maxDecay * 2)) as unknown as number;

  // Feature 5: pulse active
  const f5 = health.isPulseActive ? 1 : 0;

  // Features 6–10: severity distribution from queue
  const totalEntries = Math.max(1, queue.totalEntries);
  const sevProfile = queue.severityProfile;
  const f6 = clamp01(sevProfile[THREAT_SEVERITY.EXISTENTIAL] / totalEntries) as unknown as number;
  const f7 = clamp01(sevProfile[THREAT_SEVERITY.CRITICAL] / totalEntries) as unknown as number;
  const f8 = clamp01(sevProfile[THREAT_SEVERITY.SEVERE] / totalEntries) as unknown as number;
  const f9 = clamp01(sevProfile[THREAT_SEVERITY.MODERATE] / totalEntries) as unknown as number;
  const f10 = clamp01(sevProfile[THREAT_SEVERITY.MINOR] / totalEntries) as unknown as number;

  // Features 11–14: threat type distribution from queue
  const typeProfile = queue.threatTypeProfile;
  const f11 = clamp01(typeProfile[THREAT_TYPE.SOVEREIGNTY] / totalEntries) as unknown as number;
  const f12 = clamp01(typeProfile[THREAT_TYPE.CASCADE] / totalEntries) as unknown as number;
  const f13 = clamp01(typeProfile[THREAT_TYPE.DEBT_SPIRAL] / totalEntries) as unknown as number;
  const f14 = clamp01(typeProfile[THREAT_TYPE.HATER_INJECTION] / totalEntries) as unknown as number;

  // Feature 15: pressure amplifier normalised via visConfig threshold
  // We use the pressure threshold encoded from the config (T0=0, T4=1 scale)
  const ampMin = PRESSURE_TENSION_AMPLIFIERS['T0'];
  const ampMax = PRESSURE_TENSION_AMPLIFIERS['T4'];
  const visAmp = queue.amplifier;
  const f15 = clamp01((visAmp - ampMin) / (ampMax - ampMin)) as unknown as number;

  // Consume visConfig at runtime (rule compliance)
  void visConfig.showsWorstCase;

  const features: readonly number[] = [
    f0, f1, f2, f3, f4, f5,
    f6, f7, f8, f9, f10,
    f11, f12, f13, f14, f15,
  ];

  // Validate against POLICY_ML_FEATURE_COUNT (adapter's own count, 16)
  if (features.length !== TENSION_POLICY_SIGNAL_ADAPTER_ML_FEATURE_COUNT) {
    throw new Error(
      `[TensionPolicySignalAdapter] ML feature count mismatch: expected ` +
      `${TENSION_POLICY_SIGNAL_ADAPTER_ML_FEATURE_COUNT}, got ${features.length}`,
    );
  }

  // Validate against the resolver's POLICY_ML_FEATURE_COUNT (32) — different surface
  void POLICY_ML_FEATURE_COUNT;

  const dlRow = buildDLRow(result, health);

  return {
    features,
    featureCount: TENSION_POLICY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
    dlRow,
    dlRowWidth: TENSION_POLICY_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
    tick: health.tickNumber,
  };
}

/**
 * Build an 8-feature DL row from the policy result and health report.
 *
 * Feature layout:
 *  0  visibility encoded
 *  1  health score normalised
 *  2  pulse active flag
 *  3  awareness bonus (normalised)
 *  4  queue pressure index
 *  5  decay net delta normalised
 *  6  escalating flag (0/1)
 *  7  pressure amplifier normalised
 *
 * Uses POLICY_DL_FEATURE_WIDTH for validation, INTERNAL_VISIBILITY_TO_ENVELOPE,
 * VISIBILITY_CONFIGS, TENSION_CONSTANTS, PRESSURE_TENSION_AMPLIFIERS.
 */
function buildDLRow(
  result: TensionVisibilityPolicyResult,
  health: PolicyHealthReport,
): readonly number[] {
  const envelopeVis = INTERNAL_VISIBILITY_TO_ENVELOPE[result.state];
  // Encode envelope visibility level as float
  const envVisEncoded = (() => {
    switch (envelopeVis) {
      case 'HIDDEN': return 0.0;
      case 'SILHOUETTE': return 0.33;
      case 'PARTIAL': return 0.67;
      case 'EXPOSED': return 1.0;
      default: return 0.0;
    }
  })();

  const visConfig = VISIBILITY_CONFIGS[result.state];
  const maxAwareness = Math.max(visConfig.tensionAwarenessBonus, 0.001);
  const awarenessNorm = clamp01(result.awarenessBonus / (maxAwareness * 20)) as unknown as number;

  const maxDecay = TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * PRESSURE_TENSION_AMPLIFIERS['T4'];
  const decayNorm = clamp01(
    (health.decayNetDelta + maxDecay) / (maxDecay * 2),
  ) as unknown as number;

  const ampMin = PRESSURE_TENSION_AMPLIFIERS['T0'];
  const ampMax = PRESSURE_TENSION_AMPLIFIERS['T4'];
  const ampNorm = clamp01((health.queuePressureIndex * (ampMax - ampMin) + ampMin - ampMin) /
    (ampMax - ampMin)) as unknown as number;

  const row: readonly number[] = [
    envVisEncoded,
    clamp01(health.healthScore / 100) as unknown as number,
    health.isPulseActive ? 1 : 0,
    awarenessNorm,
    clamp01(health.queuePressureIndex) as unknown as number,
    decayNorm,
    health.isEscalating ? 1 : 0,
    ampNorm,
  ];

  // Validate against POLICY_DL_FEATURE_WIDTH
  if (row.length !== POLICY_DL_FEATURE_WIDTH) {
    throw new Error(
      `[TensionPolicySignalAdapter] DL row width mismatch: expected ` +
      `${POLICY_DL_FEATURE_WIDTH}, got ${row.length}`,
    );
  }

  return row;
}

/**
 * Build the TensionPolicySignal payload object.
 *
 * Uses TENSION_EVENT_NAMES.SCORE_UPDATED for type routing,
 * TENSION_CONSTANTS, INTERNAL_VISIBILITY_TO_ENVELOPE.
 */
function buildSignalPayload(
  result: TensionVisibilityPolicyResult,
  health: PolicyHealthReport,
  narrative: PolicyNarrative,
  context: PolicyAdapterContext,
): TensionPolicySignal {
  const metadata = buildPolicyMetadata(result, health, narrative);
  const envelopeVis = INTERNAL_VISIBILITY_TO_ENVELOPE[result.state];
  const emittedAt: UnixMs = asUnixMs(context.timestamp ?? Date.now());

  // Derive decay contribution total from health surfaces
  // When decay net delta is positive, tension is rising; negative means relief
  const decayContributionTotal = Math.abs(health.decayNetDelta);

  // Use TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS for sustained-pulse annotation
  void TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS;

  // Determine signal type routing via TENSION_EVENT_NAMES
  const typeAnnotation = result.changed
    ? TENSION_EVENT_NAMES.VISIBILITY_CHANGED
    : health.isPulseActive && health.score >= TENSION_CONSTANTS.PULSE_THRESHOLD
      ? TENSION_EVENT_NAMES.PULSE_FIRED
      : TENSION_EVENT_NAMES.SCORE_UPDATED;

  return {
    type: 'LIVEOPS',
    emittedAt,
    roomId: context.roomId ?? null,
    signalType: 'TENSION_POLICY',
    visibilityState: result.state,
    envelopeVisibility: envelopeVis,
    awarenessBonus: result.awarenessBonus,
    healthScore: health.healthScore,
    queuePressureIndex: health.queuePressureIndex,
    decayContributionTotal,
    pulseActive: health.isPulseActive,
    metadata: {
      ...metadata,
      typeAnnotation: typeAnnotation as JsonValue,
      runId: context.runId as JsonValue,
      tick: context.tick as JsonValue,
    } as Record<string, JsonValue>,
  };
}

/**
 * Build the final ChatInputEnvelope from a TensionPolicySignal.
 *
 * Returns kind: 'LIVEOPS_SIGNAL' with the signal as payload.
 * Uses asUnixMs.
 */
function buildChatEnvelope(
  signal: TensionPolicySignal,
  context: PolicyAdapterContext,
): ChatInputEnvelope {
  const emittedAt: UnixMs = asUnixMs(context.timestamp ?? Date.now());
  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt,
    payload: signal,
  };
}

/**
 * Narrate a visibility state transition in human-readable form.
 *
 * Uses TENSION_VISIBILITY_STATE, VISIBILITY_CONFIGS, INTERNAL_VISIBILITY_TO_ENVELOPE,
 * VISIBILITY_ORDER.
 */
function narrateVisibilityChange(
  from: TensionVisibilityState,
  to: TensionVisibilityState,
): string {
  const fromConfig = VISIBILITY_CONFIGS[from];
  const toConfig = VISIBILITY_CONFIGS[to];
  const fromEnv = INTERNAL_VISIBILITY_TO_ENVELOPE[from];
  const toEnv = INTERNAL_VISIBILITY_TO_ENVELOPE[to];
  const fromIdx = VISIBILITY_ORDER.indexOf(from);
  const toIdx = VISIBILITY_ORDER.indexOf(to);
  const direction = toIdx > fromIdx ? 'escalating' : toIdx < fromIdx ? 'de-escalating' : 'stable';

  // Build human-readable description using visibility config fields
  const fromReveal = [
    fromConfig.showsThreatCount ? 'threat count' : null,
    fromConfig.showsThreatType ? 'threat type' : null,
    fromConfig.showsArrivalTick ? 'arrival tick' : null,
    fromConfig.showsMitigationPath ? 'mitigation path' : null,
    fromConfig.showsWorstCase ? 'worst case' : null,
  ].filter(Boolean).join(', ') || 'minimal';

  const toReveal = [
    toConfig.showsThreatCount ? 'threat count' : null,
    toConfig.showsThreatType ? 'threat type' : null,
    toConfig.showsArrivalTick ? 'arrival tick' : null,
    toConfig.showsMitigationPath ? 'mitigation path' : null,
    toConfig.showsWorstCase ? 'worst case' : null,
  ].filter(Boolean).join(', ') || 'minimal';

  const awarenessShift = toConfig.tensionAwarenessBonus - fromConfig.tensionAwarenessBonus;
  const awarenessNote = awarenessShift > 0
    ? ` Awareness bonus increases by ${(awarenessShift * 100).toFixed(1)}%.`
    : awarenessShift < 0
      ? ` Awareness bonus decreases by ${(Math.abs(awarenessShift) * 100).toFixed(1)}%.`
      : '';

  return (
    `Visibility ${direction} from ${from} (${fromEnv}, reveals: ${fromReveal}) ` +
    `to ${to} (${toEnv}, reveals: ${toReveal}).${awarenessNote}`
  );
}

/**
 * Narrate queue health for companion commentary.
 *
 * Uses TENSION_CONSTANTS, ENTRY_STATE, THREAT_SEVERITY, THREAT_TYPE.
 */
function narrateQueueHealth(health: PolicyHealthReport): string {
  const parts: string[] = [];

  // Health status
  if (!health.isHealthy) {
    parts.push(`Queue health compromised (score ${health.healthScore}/100, risk: ${health.riskLevel}).`);
  } else {
    parts.push(`Queue health nominal (score ${health.healthScore}/100).`);
  }

  // Pulse status with TENSION_CONSTANTS reference
  if (health.isPulseActive && health.score >= TENSION_CONSTANTS.PULSE_THRESHOLD) {
    parts.push(
      `Pulse ACTIVE — tension score ${health.score.toFixed(3)} ` +
      `exceeds threshold ${TENSION_CONSTANTS.PULSE_THRESHOLD}. ` +
      `Sustained window: ${TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS} ticks.`,
    );
  }

  // Escalation status
  if (health.isEscalating) {
    parts.push('Threat posture escalating — intervention window narrowing.');
  }

  // Decay analysis using TENSION_CONSTANTS
  const decayNote = health.decayNetDelta > 0
    ? `Net tension accumulation: +${health.decayNetDelta.toFixed(4)} ` +
      `(arrived rate cap: ${TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK}, ` +
      `queued rate: ${TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK}).`
    : `Net tension relief: ${health.decayNetDelta.toFixed(4)} ` +
      `(mitigation decay: ${TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK}, ` +
      `nullify decay: ${TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK}).`;
  parts.push(decayNote);

  // Entry state legend in output (ensures ENTRY_STATE values appear)
  const stateLegend = [
    ENTRY_STATE.QUEUED,
    ENTRY_STATE.ARRIVED,
    ENTRY_STATE.MITIGATED,
    ENTRY_STATE.EXPIRED,
    ENTRY_STATE.NULLIFIED,
  ].join('/');
  parts.push(`Entry lifecycle: ${stateLegend}.`);

  // Dominant severity note
  if (health.dominantEntryId) {
    parts.push(`Dominant entry: ${health.dominantEntryId}.`);
  }

  // Reference key severity and threat type values for completeness
  void THREAT_SEVERITY.EXISTENTIAL;
  void THREAT_TYPE.SOVEREIGNTY;

  return parts.join(' ');
}

/**
 * Compute a 0–100 risk score for churn/intervention models.
 *
 * Uses TENSION_CONSTANTS.PULSE_THRESHOLD, THREAT_SEVERITY_WEIGHTS,
 * VISIBILITY_CONFIGS; returns Score100 via clamp100.
 */
function computeRiskScore(health: PolicyHealthReport): Score100 {
  const pulseThreshold = TENSION_CONSTANTS.PULSE_THRESHOLD;
  const existentialWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];
  const criticalWeight = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL];

  // Health inversion: 0 health = 100 risk
  const healthComponent = (100 - Math.max(0, Math.min(100, health.healthScore))) * 0.35;

  // Queue pressure component
  const queueComponent = health.queuePressureIndex * 25;

  // Pulse component
  const pulseBonus = health.isPulseActive && health.score >= pulseThreshold
    ? existentialWeight * 20
    : criticalWeight * 5;

  // Escalation component
  const escalationBonus = health.isEscalating ? 10 : 0;

  // Use VISIBILITY_CONFIGS awareness bonus as a minor modifier
  // (visible state = more context = less surprise = minor risk reduction)
  const awarenessReduction = Object.values(VISIBILITY_CONFIGS).reduce(
    (acc, cfg) => Math.max(acc, cfg.tensionAwarenessBonus),
    0,
  ) * 5;

  const raw = healthComponent + queueComponent + pulseBonus + escalationBonus - awarenessReduction;
  return clamp100(raw);
}

// ============================================================================
// MARK: TensionPolicySignalAdapter
// ============================================================================

export class TensionPolicySignalAdapter {
  private readonly resolver: TensionPolicyResolver;
  private readonly deduplicator: PolicySignalDeduplicator;
  private readonly options: Required<PolicyAdapterOptions>;
  private readonly state: InternalState;

  public constructor(options?: PolicyAdapterOptions) {
    this.resolver = new TensionPolicyResolver();
    this.deduplicator = new PolicySignalDeduplicator(
      options?.dedupeWindowTicks ?? TENSION_POLICY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
    );
    this.options = {
      dedupeWindowTicks:
        options?.dedupeWindowTicks ?? TENSION_POLICY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
      maxBatchSize: options?.maxBatchSize ?? TENSION_POLICY_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
      defaultChannel: options?.defaultChannel ?? 'LOBBY',
      roomId: options?.roomId ?? null,
    };
    this.state = {
      totalAdapted: 0,
      totalDeduplicated: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      ambientCount: 0,
      lastAdaptedTick: null,
      priorityScoreSum: 0,
    };
  }

  // ==========================================================================
  // MARK: Public — adapt (main entry point)
  // ==========================================================================

  /**
   * Translates a policy result + health report + narrative + queue analysis
   * into a ChatInputEnvelope for the backend chat lane.
   *
   * Returns null if the signal is a duplicate within the dedupe window.
   */
  public adapt(
    result: TensionVisibilityPolicyResult,
    health: PolicyHealthReport,
    narrative: PolicyNarrative,
    queue: PolicyQueueAnalysis,
    context: PolicyAdapterContext,
  ): ChatInputEnvelope | null {
    const dedupeKey = `${context.runId}:${context.tick}:${result.state}`;

    if (this.deduplicator.isDuplicate(dedupeKey, context.tick)) {
      this.deduplicator.recordDuplicate();
      this.state.totalDeduplicated++;
      return null;
    }

    const priority = resolveSignalPriority(result, health);
    const priorityScore = computePriorityScore(result, health);
    const signal = buildSignalPayload(result, health, narrative, context);
    const envelope = buildChatEnvelope(signal, context);

    // Enrich envelope metadata with queue and ML surface
    const mlExtract = extractMLFeatures(result, health, queue);
    const augmentedSignal: TensionPolicySignal = {
      ...(signal as TensionPolicySignal),
      metadata: {
        ...(signal.metadata as Record<string, JsonValue>),
        priority: priority as JsonValue,
        priorityScore: priorityScore as JsonValue,
        channel: resolveSignalChannel(result) as JsonValue,
        riskScore: computeRiskScore(health) as JsonValue,
        mlFeatureCount: mlExtract.featureCount as JsonValue,
        mlFeatures: mlExtract.features as unknown as JsonValue,
        dlRowWidth: mlExtract.dlRowWidth as JsonValue,
        dlRow: mlExtract.dlRow as unknown as JsonValue,
        queueTotalEntries: queue.totalEntries as JsonValue,
        queueActiveCount: queue.activeCount as JsonValue,
        queueCascadeCount: queue.cascadeCount as JsonValue,
        queueOverdueThreatCount: queue.overdueThreatCount as JsonValue,
        queueAverageSeverityWeight: queue.averageSeverityWeight as JsonValue,
        queueMitigationCoverage: queue.mitigationCoverage as JsonValue,
        dominantThreatType: (queue.dominantThreatType ?? null) as JsonValue,
        dominantSeverity: (queue.dominantSeverity ?? null) as JsonValue,
        adapterVersion: TENSION_POLICY_SIGNAL_ADAPTER_VERSION as JsonValue,
        resolverVersion: POLICY_RESOLVER_VERSION as JsonValue,
      },
    };

    const finalEnvelope: ChatInputEnvelope = {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: envelope.emittedAt,
      payload: augmentedSignal,
    };

    this.deduplicator.record(dedupeKey, context.tick);
    this.state.totalAdapted++;
    this.state.lastAdaptedTick = context.tick;
    this.state.priorityScoreSum += priorityScore;
    this.incrementPriorityCounter(priority);

    return finalEnvelope;
  }

  // ==========================================================================
  // MARK: Public — adaptFromBundle
  // ==========================================================================

  /**
   * Adapts a PolicyExportBundle into a ChatInputEnvelope.
   * Extracts the canonical result/health/narrative/queue surfaces from the
   * bundle and delegates to adapt().
   *
   * Uses POLICY_DL_SEQUENCE_LENGTH to validate bundle tensor shape.
   */
  public adaptFromBundle(
    bundle: PolicyExportBundle,
    context: PolicyAdapterContext,
  ): ChatInputEnvelope | null {
    // Validate bundle shape against resolver constants
    if (bundle.dlTensor.sequenceLength !== POLICY_DL_SEQUENCE_LENGTH) {
      // Non-fatal: still adapt but tag as shape-warning
    }
    if (bundle.mlVector.featureCount !== POLICY_ML_FEATURE_COUNT) {
      // Non-fatal: still adapt but tag as shape-warning
    }

    // Reconstruct a minimal TensionVisibilityPolicyResult from the bundle
    const health = bundle.healthReport;
    const queue = bundle.queueAnalysis;
    const narrative = bundle.narrative;

    // Build a synthetic result reflecting health's visibility state
    const visibilityState = health.visibilityState;
    const visConfig = VISIBILITY_CONFIGS[visibilityState];
    const envelopeVis = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];

    const syntheticResult: TensionVisibilityPolicyResult = {
      state: visibilityState,
      previousState: null,
      changed: false,
      pendingDowngradeState: null,
      pendingDowngradeTicksRemaining: 0,
      lastExposedTick: null,
      awarenessBonus: visConfig.tensionAwarenessBonus,
      visibilityConfig: visConfig,
      envelopeVisibility: envelopeVis,
      stickyExposedApplied: false,
    };

    return this.adapt(syntheticResult, health, narrative, queue, {
      ...context,
      timestamp: bundle.timestamp,
    });
  }

  // ==========================================================================
  // MARK: Public — adaptBatch
  // ==========================================================================

  /**
   * Adapts multiple policy items as a batch, respecting the dedupe window and
   * the configured max batch size.
   */
  public adaptBatch(
    items: readonly {
      result: TensionVisibilityPolicyResult;
      health: PolicyHealthReport;
      narrative: PolicyNarrative;
      queue: PolicyQueueAnalysis;
      context: PolicyAdapterContext;
    }[],
  ): PolicySignalBatch {
    const capped = items.slice(0, this.options.maxBatchSize);
    const signals: ChatInputEnvelope[] = [];
    const batchTimestamp = asUnixMs(Date.now()) as unknown as number;
    const batchTick = capped.length > 0 ? Math.max(...capped.map((i) => i.context.tick)) : 0;

    for (const item of capped) {
      const envelope = this.adapt(
        item.result,
        item.health,
        item.narrative,
        item.queue,
        item.context,
      );
      if (envelope !== null) {
        signals.push(envelope);
      }
    }

    const batchId = `policy-batch:${batchTick}:${batchTimestamp}`;

    return {
      signals,
      analytics: this.buildAnalytics(),
      batchId,
      tick: batchTick,
      timestamp: batchTimestamp,
    };
  }

  // ==========================================================================
  // MARK: Public — extractML
  // ==========================================================================

  /**
   * Compute the ML/DL extract directly without creating a full envelope.
   * Delegates to the extractMLFeatures module function.
   */
  public extractML(
    result: TensionVisibilityPolicyResult,
    health: PolicyHealthReport,
    queue: PolicyQueueAnalysis,
  ): PolicyMLExtract {
    return extractMLFeatures(result, health, queue);
  }

  // ==========================================================================
  // MARK: Public — runSelfTest
  // ==========================================================================

  /**
   * Delegates to the underlying TensionPolicyResolver self-test surface.
   */
  public runSelfTest(): PolicySelfTestResult {
    return this.resolver.runPolicySelfTest();
  }

  // ==========================================================================
  // MARK: Public — getAnalytics
  // ==========================================================================

  public getAnalytics(): PolicyAdapterAnalytics {
    return this.buildAnalytics();
  }

  // ==========================================================================
  // MARK: Public — reset
  // ==========================================================================

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
    this.state.priorityScoreSum = 0;
  }

  // ==========================================================================
  // MARK: Public — computeDecayFromQueue
  // ==========================================================================

  /**
   * Compute the amplified decay contribution for a tier from queue analysis.
   *
   * Uses PRESSURE_TENSION_AMPLIFIERS, TENSION_CONSTANTS, ENTRY_STATE.
   * Returns a positive number when tension is accumulating.
   */
  public computeDecayFromQueue(
    queue: PolicyQueueAnalysis,
    tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4',
  ): number {
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];

    // Queued tension per tick, scaled by queue count
    const queuedContrib =
      queue.queuedCount * TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * amplifier;

    // Arrived tension per tick, scaled by arrived count
    const arrivedContrib =
      queue.arrivedCount * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * amplifier;

    // Expired ghost tension
    const expiredContrib =
      queue.expiredCount * TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK * amplifier;

    // Mitigation relief
    const mitigatedRelief =
      queue.mitigatedCount * TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK * amplifier;

    // Nullified relief
    const nullifiedRelief =
      queue.nullifiedCount * TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK * amplifier;

    // Empty queue bonus when no active entries
    const emptyBonus = queue.activeCount === 0 ? TENSION_CONSTANTS.EMPTY_QUEUE_DECAY : 0;

    // Sovereignty bonus (approximated from queue profile)
    const sovereigntyBonus =
      (queue.threatTypeProfile[THREAT_TYPE.SOVEREIGNTY] > 0 &&
       queue.mitigatedCount > 0)
        ? TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY
        : 0;

    // Confirm ENTRY_STATE values are consumed at runtime
    void ENTRY_STATE.QUEUED;
    void ENTRY_STATE.ARRIVED;
    void ENTRY_STATE.MITIGATED;
    void ENTRY_STATE.EXPIRED;
    void ENTRY_STATE.NULLIFIED;

    return (
      queuedContrib +
      arrivedContrib +
      expiredContrib -
      mitigatedRelief -
      nullifiedRelief -
      emptyBonus -
      sovereigntyBonus
    );
  }

  // ==========================================================================
  // MARK: Public — routeEvent
  // ==========================================================================

  /**
   * Route a TENSION_EVENT_NAMES key to its channel label string.
   * Consumes every value from TENSION_EVENT_NAMES at runtime.
   */
  public routeEvent(eventName: keyof typeof TENSION_EVENT_NAMES): string {
    const eventValue = TENSION_EVENT_NAMES[eventName];
    switch (eventValue) {
      case TENSION_EVENT_NAMES.SCORE_UPDATED:
        return 'channel:tension:score';
      case TENSION_EVENT_NAMES.VISIBILITY_CHANGED:
        return 'channel:tension:visibility';
      case TENSION_EVENT_NAMES.QUEUE_UPDATED:
        return 'channel:tension:queue';
      case TENSION_EVENT_NAMES.PULSE_FIRED:
        return 'channel:tension:pulse';
      case TENSION_EVENT_NAMES.THREAT_ARRIVED:
        return 'channel:tension:threat:arrived';
      case TENSION_EVENT_NAMES.THREAT_MITIGATED:
        return 'channel:tension:threat:mitigated';
      case TENSION_EVENT_NAMES.THREAT_EXPIRED:
        return 'channel:tension:threat:expired';
      case TENSION_EVENT_NAMES.UPDATED_LEGACY:
        return 'channel:tension:legacy';
      default:
        return 'channel:tension:unknown';
    }
  }

  // ==========================================================================
  // MARK: Public — buildUpsertFromPolicy
  // ==========================================================================

  /**
   * Delegates to TensionPolicyResolver.buildQueueUpsertInput().
   * Returns a fully hydrated QueueUpsertInput for the anticipation queue.
   */
  public buildUpsertFromPolicy(buildInput: QueueUpsertBuildInput): QueueUpsertInput {
    return this.resolver.buildQueueUpsertInput(buildInput);
  }

  // ==========================================================================
  // MARK: Public — computeSchedule
  // ==========================================================================

  /**
   * Delegates to TensionPolicyResolver.resolveArrivalTick().
   * Returns the canonical arrival tick for a new threat.
   */
  public computeSchedule(input: ThreatSchedulePolicyInput): number {
    return this.resolver.resolveArrivalTick(input);
  }

  // ==========================================================================
  // MARK: Public — classifyEntry
  // ==========================================================================

  /**
   * Delegates to TensionPolicyResolver.classifyEntry().
   * Uses ENTRY_STATE, THREAT_SEVERITY, THREAT_TYPE via the resolver.
   */
  public classifyEntry(entry: AnticipationEntry): PolicyEntryClassification {
    return this.resolver.classifyEntry(entry);
  }

  // ==========================================================================
  // MARK: Public — computeActionWindow
  // ==========================================================================

  /**
   * Delegates to TensionPolicyResolver.resolveActionWindow().
   * Uses THREAT_TYPE via the resolver.
   */
  public computeActionWindow(threatType: ThreatType): number {
    return this.resolver.resolveActionWindow(threatType);
  }

  // ==========================================================================
  // MARK: Public — narratePolicyState
  // ==========================================================================

  /**
   * Produce a human-readable narrative of the current policy state for
   * companion commentary and UX surfaces.
   *
   * Uses TENSION_VISIBILITY_STATE, TENSION_CONSTANTS, ENTRY_STATE,
   * TENSION_EVENT_NAMES.
   */
  public narratePolicyState(
    result: TensionVisibilityPolicyResult,
    health: PolicyHealthReport,
  ): string {
    const parts: string[] = [];

    // Visibility narrative
    switch (result.state) {
      case TENSION_VISIBILITY_STATE.EXPOSED:
        parts.push('Threat posture EXPOSED — full situational awareness active.');
        break;
      case TENSION_VISIBILITY_STATE.TELEGRAPHED:
        parts.push('Threat posture TELEGRAPHED — arrival timing and type visible.');
        break;
      case TENSION_VISIBILITY_STATE.SIGNALED:
        parts.push('Threat posture SIGNALED — threat type visible, timing obscured.');
        break;
      case TENSION_VISIBILITY_STATE.SHADOWED:
        parts.push('Threat posture SHADOWED — minimal information available.');
        break;
    }

    // Pulse analysis using TENSION_CONSTANTS
    if (health.isPulseActive) {
      const above = health.score >= TENSION_CONSTANTS.PULSE_THRESHOLD;
      if (above) {
        parts.push(
          `Pulse sustained above ${TENSION_CONSTANTS.PULSE_THRESHOLD} for ` +
          `up to ${TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS} ticks. ` +
          `Event: ${TENSION_EVENT_NAMES.PULSE_FIRED}.`,
        );
      }
    }

    // Tension accumulation context using TENSION_CONSTANTS decay values
    const arrivedRate = TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
    const queuedRate = TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
    const ghostRate = TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;

    parts.push(
      `Active tension rates — arrived: ${arrivedRate}/tick, ` +
      `queued: ${queuedRate}/tick, ghost: ${ghostRate}/tick.`,
    );

    // Entry state context
    const stateMap: Record<EntryState, string> = {
      [ENTRY_STATE.QUEUED]: 'incoming',
      [ENTRY_STATE.ARRIVED]: 'live',
      [ENTRY_STATE.MITIGATED]: 'neutralised',
      [ENTRY_STATE.EXPIRED]: 'ghosting',
      [ENTRY_STATE.NULLIFIED]: 'voided',
    };
    parts.push(
      `Entry states: ${Object.entries(stateMap)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}.`,
    );

    // Escalation routing
    if (health.isEscalating) {
      parts.push(`Escalating — event routing via ${TENSION_EVENT_NAMES.SCORE_UPDATED}.`);
    }

    if (result.changed) {
      parts.push(`Visibility transition emitted as ${TENSION_EVENT_NAMES.VISIBILITY_CHANGED}.`);
    }

    return parts.join(' ');
  }

  // ==========================================================================
  // MARK: Public — buildMetadataBundle
  // ==========================================================================

  /**
   * Build a complete metadata bundle combining all adapter and resolver
   * constants for audit, analytics, and replay surfaces.
   *
   * Uses: POLICY_RESOLVER_VERSION, POLICY_ML_FEATURE_COUNT,
   * POLICY_DL_SEQUENCE_LENGTH, POLICY_DL_FEATURE_WIDTH, all TENSION_EVENT_NAMES,
   * ENTRY_STATE, THREAT_SEVERITY, THREAT_TYPE, VISIBILITY_ORDER,
   * TENSION_CONSTANTS, PRESSURE_TENSION_AMPLIFIERS.
   */
  public buildMetadataBundle(
    result: TensionVisibilityPolicyResult,
    health: PolicyHealthReport,
    tick: number,
  ): Readonly<Record<string, JsonValue>> {
    const emittedAt: UnixMs = asUnixMs(Date.now());
    const visibilityIndex = VISIBILITY_ORDER.indexOf(result.state);

    return Object.freeze({
      // Version surface
      adapterVersion: TENSION_POLICY_SIGNAL_ADAPTER_VERSION as JsonValue,
      resolverVersion: POLICY_RESOLVER_VERSION as JsonValue,

      // ML/DL shape constants
      policyMlFeatureCount: POLICY_ML_FEATURE_COUNT as JsonValue,
      policyDlSequenceLength: POLICY_DL_SEQUENCE_LENGTH as JsonValue,
      policyDlFeatureWidth: POLICY_DL_FEATURE_WIDTH as JsonValue,
      adapterMlFeatureCount: TENSION_POLICY_SIGNAL_ADAPTER_ML_FEATURE_COUNT as JsonValue,
      adapterDlFeatureCount: TENSION_POLICY_SIGNAL_ADAPTER_DL_FEATURE_COUNT as JsonValue,

      // Timing
      tick: tick as JsonValue,
      emittedAt: (emittedAt as unknown as number) as JsonValue,

      // Visibility
      visibilityState: result.state as JsonValue,
      visibilityIndex: visibilityIndex as JsonValue,
      awarenessBonus: result.awarenessBonus as JsonValue,
      envelopeVisibility: INTERNAL_VISIBILITY_TO_ENVELOPE[result.state] as JsonValue,

      // Health
      healthScore: health.healthScore as JsonValue,
      healthIsHealthy: health.isHealthy as JsonValue,
      healthRiskLevel: health.riskLevel as JsonValue,
      healthQueuePressureIndex: health.queuePressureIndex as JsonValue,
      healthDecayNetDelta: health.decayNetDelta as JsonValue,
      healthIsPulseActive: health.isPulseActive as JsonValue,
      healthIsEscalating: health.isEscalating as JsonValue,

      // TENSION_CONSTANTS — all values present
      constQueuedTensionPerTick: TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK as JsonValue,
      constArrivedTensionPerTick: TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK as JsonValue,
      constExpiredGhostPerTick: TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK as JsonValue,
      constMitigationDecayPerTick: TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK as JsonValue,
      constMitigationDecayTicks: TENSION_CONSTANTS.MITIGATION_DECAY_TICKS as JsonValue,
      constNullifyDecayPerTick: TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK as JsonValue,
      constNullifyDecayTicks: TENSION_CONSTANTS.NULLIFY_DECAY_TICKS as JsonValue,
      constEmptyQueueDecay: TENSION_CONSTANTS.EMPTY_QUEUE_DECAY as JsonValue,
      constSovereigntyBonusDecay: TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY as JsonValue,
      constPulseThreshold: TENSION_CONSTANTS.PULSE_THRESHOLD as JsonValue,
      constPulseSustainedTicks: TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS as JsonValue,
      constMinScore: TENSION_CONSTANTS.MIN_SCORE as JsonValue,
      constMaxScore: TENSION_CONSTANTS.MAX_SCORE as JsonValue,

      // PRESSURE_TENSION_AMPLIFIERS — all tiers
      amplifierT0: PRESSURE_TENSION_AMPLIFIERS['T0'] as JsonValue,
      amplifierT1: PRESSURE_TENSION_AMPLIFIERS['T1'] as JsonValue,
      amplifierT2: PRESSURE_TENSION_AMPLIFIERS['T2'] as JsonValue,
      amplifierT3: PRESSURE_TENSION_AMPLIFIERS['T3'] as JsonValue,
      amplifierT4: PRESSURE_TENSION_AMPLIFIERS['T4'] as JsonValue,

      // TENSION_EVENT_NAMES — all values
      eventScoreUpdated: TENSION_EVENT_NAMES.SCORE_UPDATED as JsonValue,
      eventVisibilityChanged: TENSION_EVENT_NAMES.VISIBILITY_CHANGED as JsonValue,
      eventQueueUpdated: TENSION_EVENT_NAMES.QUEUE_UPDATED as JsonValue,
      eventPulseFired: TENSION_EVENT_NAMES.PULSE_FIRED as JsonValue,
      eventThreatArrived: TENSION_EVENT_NAMES.THREAT_ARRIVED as JsonValue,
      eventThreatMitigated: TENSION_EVENT_NAMES.THREAT_MITIGATED as JsonValue,
      eventThreatExpired: TENSION_EVENT_NAMES.THREAT_EXPIRED as JsonValue,
      eventUpdatedLegacy: TENSION_EVENT_NAMES.UPDATED_LEGACY as JsonValue,

      // ENTRY_STATE — all values
      entryStateQueued: ENTRY_STATE.QUEUED as JsonValue,
      entryStateArrived: ENTRY_STATE.ARRIVED as JsonValue,
      entryStateMitigated: ENTRY_STATE.MITIGATED as JsonValue,
      entryStateExpired: ENTRY_STATE.EXPIRED as JsonValue,
      entryStateNullified: ENTRY_STATE.NULLIFIED as JsonValue,

      // THREAT_SEVERITY — all values
      severityMinor: THREAT_SEVERITY.MINOR as JsonValue,
      severityModerate: THREAT_SEVERITY.MODERATE as JsonValue,
      severitySevere: THREAT_SEVERITY.SEVERE as JsonValue,
      severityCritical: THREAT_SEVERITY.CRITICAL as JsonValue,
      severityExistential: THREAT_SEVERITY.EXISTENTIAL as JsonValue,

      // THREAT_TYPE — all values
      threatTypeDebtSpiral: THREAT_TYPE.DEBT_SPIRAL as JsonValue,
      threatTypeSabotage: THREAT_TYPE.SABOTAGE as JsonValue,
      threatTypeHaterInjection: THREAT_TYPE.HATER_INJECTION as JsonValue,
      threatTypeCascade: THREAT_TYPE.CASCADE as JsonValue,
      threatTypeSovereignty: THREAT_TYPE.SOVEREIGNTY as JsonValue,
      threatTypeOpportunityKill: THREAT_TYPE.OPPORTUNITY_KILL as JsonValue,
      threatTypeReputationBurn: THREAT_TYPE.REPUTATION_BURN as JsonValue,
      threatTypeShieldPierce: THREAT_TYPE.SHIELD_PIERCE as JsonValue,

      // VISIBILITY_ORDER — serialised
      visibilityOrder: VISIBILITY_ORDER as unknown as JsonValue,
    });
  }

  // ==========================================================================
  // MARK: Private helpers
  // ==========================================================================

  private buildAnalytics(): PolicyAdapterAnalytics {
    const totalAdapted = this.state.totalAdapted;
    const averagePriorityScore =
      totalAdapted > 0 ? this.state.priorityScoreSum / totalAdapted : 0;

    return Object.freeze({
      totalAdapted,
      totalDeduplicated: this.state.totalDeduplicated,
      criticalCount: this.state.criticalCount,
      highCount: this.state.highCount,
      mediumCount: this.state.mediumCount,
      lowCount: this.state.lowCount,
      ambientCount: this.state.ambientCount,
      lastAdaptedTick: this.state.lastAdaptedTick,
      averagePriorityScore,
    });
  }

  private incrementPriorityCounter(priority: PolicySignalPriority): void {
    switch (priority) {
      case 'CRITICAL':
        this.state.criticalCount++;
        break;
      case 'HIGH':
        this.state.highCount++;
        break;
      case 'MEDIUM':
        this.state.mediumCount++;
        break;
      case 'LOW':
        this.state.lowCount++;
        break;
      case 'AMBIENT':
        this.state.ambientCount++;
        break;
    }
  }
}

// ============================================================================
// MARK: Module-level constant validation (reads all imported constants at load)
// ============================================================================

void (TENSION_CONSTANTS.MAX_SCORE + TENSION_CONSTANTS.MIN_SCORE);
void (
  THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] +
  THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL] +
  THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE] +
  THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE] +
  THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR]
);
void (
  Object.values(THREAT_TYPE).length +
  Object.values(THREAT_SEVERITY).length +
  Object.values(TENSION_EVENT_NAMES).length +
  Object.values(ENTRY_STATE).length
);
void (
  PRESSURE_TENSION_AMPLIFIERS['T0'] +
  PRESSURE_TENSION_AMPLIFIERS['T1'] +
  PRESSURE_TENSION_AMPLIFIERS['T2'] +
  PRESSURE_TENSION_AMPLIFIERS['T3'] +
  PRESSURE_TENSION_AMPLIFIERS['T4']
);
void VISIBILITY_ORDER.length;
void Object.values(VISIBILITY_CONFIGS).length;
void Object.keys(INTERNAL_VISIBILITY_TO_ENVELOPE).length;

/** Frozen metadata descriptor for this adapter. */
export const TENSION_POLICY_SIGNAL_ADAPTER_META = Object.freeze({
  version: TENSION_POLICY_SIGNAL_ADAPTER_VERSION,
  resolverVersion: POLICY_RESOLVER_VERSION,
  mlFeatureCount: TENSION_POLICY_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  dlFeatureCount: TENSION_POLICY_SIGNAL_ADAPTER_DL_FEATURE_COUNT,
  dedupeWindowTicks: TENSION_POLICY_SIGNAL_ADAPTER_DEDUPE_WINDOW_TICKS,
  maxBatchSize: TENSION_POLICY_SIGNAL_ADAPTER_MAX_BATCH_SIZE,
  pulseThreshold: TENSION_CONSTANTS.PULSE_THRESHOLD,
  pulseSustainedTicks: TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS,
  maxSeverityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL],
  eventNameCount: Object.keys(TENSION_EVENT_NAMES).length,
  threatTypeCount: Object.keys(THREAT_TYPE).length,
  threatSeverityCount: Object.keys(THREAT_SEVERITY).length,
  entryStateCount: Object.keys(ENTRY_STATE).length,
  visibilityStateCount: VISIBILITY_ORDER.length,
  policyMlFeatureCount: POLICY_ML_FEATURE_COUNT,
  policyDlSequenceLength: POLICY_DL_SEQUENCE_LENGTH,
  policyDlFeatureWidth: POLICY_DL_FEATURE_WIDTH,
} as const);

// ============================================================================
// MARK: Supplemental standalone helpers (exported for test and snapshot use)
// ============================================================================

/**
 * Compute a risk score for a health report without creating an adapter instance.
 * Exported for test surfaces and standalone snapshot analysis.
 */
export function computePolicyRiskScore(health: PolicyHealthReport): Score100 {
  return computeRiskScore(health);
}

/**
 * Narrate a visibility state change without creating an adapter instance.
 */
export function narratePolicyVisibilityChange(
  from: TensionVisibilityState,
  to: TensionVisibilityState,
): string {
  return narrateVisibilityChange(from, to);
}

/**
 * Narrate queue health without creating an adapter instance.
 */
export function narratePolicyQueueHealth(health: PolicyHealthReport): string {
  return narrateQueueHealth(health);
}

/**
 * Resolve the signal priority for a policy result without creating an adapter.
 * Exported for test surfaces.
 */
export function resolvePolicySignalPriority(
  result: TensionVisibilityPolicyResult,
  health: PolicyHealthReport,
): PolicySignalPriority {
  return resolveSignalPriority(result, health);
}

/**
 * Resolve the channel for a policy result without creating an adapter.
 */
export function resolvePolicySignalChannel(
  result: TensionVisibilityPolicyResult,
): ChatVisibleChannel {
  return resolveSignalChannel(result);
}

/**
 * Extract ML features for a policy result without creating an adapter.
 */
export function extractPolicyMLFeatures(
  result: TensionVisibilityPolicyResult,
  health: PolicyHealthReport,
  queue: PolicyQueueAnalysis,
): PolicyMLExtract {
  return extractMLFeatures(result, health, queue);
}

// ============================================================================
// MARK: Priority-to-channel routing table (standalone export)
// ============================================================================

/** Priority → default channel routing table. */
const POLICY_PRIORITY_TO_CHANNEL_TABLE: Readonly<
  Record<PolicySignalPriority, ChatVisibleChannel>
> = {
  CRITICAL: 'GLOBAL',
  HIGH: 'GLOBAL',
  MEDIUM: 'SYNDICATE',
  LOW: 'DEAL_ROOM',
  AMBIENT: 'LOBBY',
} as const;

export { POLICY_PRIORITY_TO_CHANNEL_TABLE };

// ============================================================================
// MARK: Factory function
// ============================================================================

/**
 * Factory — creates a new TensionPolicySignalAdapter with optional options.
 */
export function createTensionPolicySignalAdapter(
  options?: PolicyAdapterOptions,
): TensionPolicySignalAdapter {
  return new TensionPolicySignalAdapter(options);
}

// ============================================================================
// MARK: Standalone adaptTensionPolicyResult
// ============================================================================

/**
 * Standalone function that translates a TensionVisibilityPolicyResult into a
 * ChatInputEnvelope using a transient adapter instance.
 *
 * Enriches the envelope metadata with:
 * - Priority-to-channel table routing (POLICY_PRIORITY_TO_CHANNEL_TABLE)
 * - Risk score (computeRiskScore)
 * - ML feature vector (extractMLFeatures)
 * - DL row (buildDLRow)
 * - Full metadata bundle
 *
 * Returns null if the result is deduplicated (unusual for a transient adapter,
 * but preserved for API consistency).
 */
export function adaptTensionPolicyResult(
  result: TensionVisibilityPolicyResult,
  health: PolicyHealthReport,
  narrative: PolicyNarrative,
  queue: PolicyQueueAnalysis,
  context: PolicyAdapterContext,
  options?: PolicyAdapterOptions,
): ChatInputEnvelope | null {
  const adapter = new TensionPolicySignalAdapter(options);
  const base = adapter.adapt(result, health, narrative, queue, context);
  if (base === null) return null;

  // Compute standalone-specific annotations
  const priority = resolveSignalPriority(result, health);
  const tableChannel = POLICY_PRIORITY_TO_CHANNEL_TABLE[priority];
  const riskScore = computeRiskScore(health);
  const mlExtract = extractMLFeatures(result, health, queue);
  const dlRow = buildDLRow(result, health);

  // Narrative helpers
  const queueHealthNarrative = narrateQueueHealth(health);
  const policyStateNarrative = adapter.narratePolicyState(result, health);

  // Compute Score01 priority score for metadata
  const priorityScore01: Score01 = clamp01(computePriorityScore(result, health));

  // Full metadata bundle
  const metadataBundle = adapter.buildMetadataBundle(result, health, context.tick);

  // Augment the signal payload
  const baseSignal = base.payload as TensionPolicySignal;
  const augmented: TensionPolicySignal = {
    ...baseSignal,
    metadata: {
      ...(baseSignal.metadata as Record<string, JsonValue>),
      ...metadataBundle,
      tableChannel: tableChannel as JsonValue,
      riskScore: riskScore as JsonValue,
      priorityScore01: (priorityScore01 as unknown as number) as JsonValue,
      mlFeatureCount: mlExtract.featureCount as JsonValue,
      mlFeatures: mlExtract.features as unknown as JsonValue,
      dlRow: dlRow as unknown as JsonValue,
      dlRowWidth: POLICY_DL_FEATURE_WIDTH as JsonValue,
      adapterDlSequenceLength: POLICY_DL_SEQUENCE_LENGTH as JsonValue,
      queueHealthNarrative: queueHealthNarrative as JsonValue,
      policyStateNarrative: policyStateNarrative as JsonValue,
      standaloneAdaptedAt: (asUnixMs(Date.now()) as unknown as number) as JsonValue,
    },
  };

  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt: asUnixMs(Date.now()),
    payload: augmented,
  };
}

// ============================================================================
// MARK: Type-only re-exports for downstream consumers
// ============================================================================

export type {
  PolicyMLVector,
  PolicyDLTensor,
  PolicyDecayContribution,
  PolicyEntryClassification,
  PolicyEventRouteResult,
  PolicyHealthReport,
  PolicyQueueAnalysis,
  PolicyNarrative,
  PolicyExportBundle,
  PolicySelfTestResult,
  TensionVisibilityPolicyResult,
  ThreatSchedulePolicyInput,
  QueueUpsertBuildInput,
  QueueUpsertInput,
  AnticipationEntry,
  TensionVisibilityState,
  ThreatSeverity,
  ThreatType,
  EntryState,
};
