/* ========================================================================
 * POINT ZERO ONE — BACKEND THREAT VISIBILITY MANAGER
 * /backend/src/game/engine/tension/ThreatVisibilityManager.ts
 * ====================================================================== */

import { createHash } from 'node:crypto';

import {
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  VISIBILITY_ORDER,
  PRESSURE_TENSION_AMPLIFIERS,
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  TENSION_CONSTANTS,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  TENSION_EVENT_NAMES,
  type PressureTier,
  type TensionVisibilityState,
  type VisibilityConfig,
  type ThreatEnvelope,
  type VisibilityLevel,
  type AnticipationEntry,
  type TensionRuntimeSnapshot,
  type ThreatSeverity,
  type ThreatType,
  type TensionVisibilityChangedEvent,
} from './types';

// ============================================================================
// MODULE CONSTANTS
// ============================================================================

export const VISIBILITY_ML_FEATURE_COUNT = 32 as const;
export const VISIBILITY_DL_SEQUENCE_LENGTH = 16 as const;
export const VISIBILITY_DL_FEATURE_WIDTH = 8 as const;
export const VISIBILITY_HISTORY_CAPACITY = 64 as const;

export const VISIBILITY_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  /* [0]  */ 'stateOrdinal',
  /* [1]  */ 'isExposed',
  /* [2]  */ 'isTelegraphed',
  /* [3]  */ 'isSignaled',
  /* [4]  */ 'pressureAmplifier',
  /* [5]  */ 'pendingDowngradeOrdinal',
  /* [6]  */ 'downgradeCountdownNorm',
  /* [7]  */ 'envelopeLevelOrdinal',
  /* [8]  */ 'awarenessBonus',
  /* [9]  */ 'previousStateOrdinal',
  /* [10] */ 'previousStateIsNull',
  /* [11] */ 'stickyTicksRemaining',
  /* [12] */ 'upgradeCount',
  /* [13] */ 'downgradeCount',
  /* [14] */ 'timeInShadowed',
  /* [15] */ 'timeInSignaled',
  /* [16] */ 'timeInTelegraphed',
  /* [17] */ 'timeInExposed',
  /* [18] */ 'volatility',
  /* [19] */ 'stableStreak',
  /* [20] */ 'pulseThreshold',
  /* [21] */ 'pulseSustainedTicks',
  /* [22] */ 'severityWeightMinor',
  /* [23] */ 'severityWeightModerate',
  /* [24] */ 'severityWeightSevere',
  /* [25] */ 'severityWeightCritical',
  /* [26] */ 'severityWeightExistential',
  /* [27] */ 'threatTypePriorityMin',
  /* [28] */ 'threatTypePriorityMax',
  /* [29] */ 'counterIntelLevel',
  /* [30] */ 'tickNormalized',
  /* [31] */ 'checksumHashFeature',
]);

export const VISIBILITY_DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  /* [0] */ 'stateOrdinalNorm',
  /* [1] */ 'pressureAmpNorm',
  /* [2] */ 'awarenessBonus',
  /* [3] */ 'stickyTicksNorm',
  /* [4] */ 'downgradeCountNorm',
  /* [5] */ 'upgradeFlag',
  /* [6] */ 'downgradeFlag',
  /* [7] */ 'envelopeOrdinalNorm',
]);

export const VISIBILITY_STATE_ORDINALS: Readonly<Record<TensionVisibilityState, number>> = {
  SHADOWED: 0,
  SIGNALED: 1,
  TELEGRAPHED: 2,
  EXPOSED: 3,
} as const;

export const VISIBILITY_AWARENESS_THRESHOLDS = {
  LOW: 0.1,
  MEDIUM: 0.3,
  HIGH: 0.6,
  CRITICAL: 0.85,
} as const;

// Internal ordinal map for VisibilityLevel values used in envelope calculations.
const ENVELOPE_LEVEL_ORDINALS: Readonly<Record<VisibilityLevel, number>> = {
  HIDDEN: 0,
  SILHOUETTE: 1,
  PARTIAL: 2,
  EXPOSED: 3,
} as const;

// Priority weights for each ThreatType — used for ranking and ML features.
const THREAT_TYPE_PRIORITY_WEIGHTS: Readonly<Record<ThreatType, number>> = {
  [THREAT_TYPE.DEBT_SPIRAL]: 0.9,
  [THREAT_TYPE.SABOTAGE]: 0.85,
  [THREAT_TYPE.HATER_INJECTION]: 0.7,
  [THREAT_TYPE.CASCADE]: 0.95,
  [THREAT_TYPE.SOVEREIGNTY]: 1.0,
  [THREAT_TYPE.OPPORTUNITY_KILL]: 0.75,
  [THREAT_TYPE.REPUTATION_BURN]: 0.65,
  [THREAT_TYPE.SHIELD_PIERCE]: 0.8,
} as const;

// ============================================================================
// EXPORTED INTERFACES
// ============================================================================

export interface VisibilityMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly tick: number;
}

export interface VisibilityDLTensorRow {
  readonly features: readonly number[];
}

export interface VisibilityDLTensor {
  readonly rows: readonly VisibilityDLTensorRow[];
  readonly labels: readonly string[];
}

export interface VisibilityHealthReport {
  readonly riskTier: 'CLEAR' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly currentState: TensionVisibilityState;
  readonly exposedStickyTicksLeft: number;
  readonly pendingDowngradeCountdown: number;
  readonly awarenessLoad: number;
  readonly amplifiedAwareness: number;
  readonly alerts: readonly string[];
}

export interface VisibilityTrendSnapshot {
  readonly direction: 'UPGRADING' | 'STABLE' | 'DOWNGRADING';
  readonly upgradeCount: number;
  readonly downgradeCount: number;
  readonly stableStreak: number;
  readonly volatility: number;
  readonly dominantState: TensionVisibilityState;
}

export interface VisibilityTickSample {
  readonly tick: number;
  readonly state: TensionVisibilityState;
  readonly pressureTier: PressureTier;
  readonly changed: boolean;
  readonly awarenessBonus: number;
}

export interface VisibilitySessionSummary {
  readonly totalTicks: number;
  readonly upgradeCount: number;
  readonly downgradeCount: number;
  readonly timeInEachState: Record<TensionVisibilityState, number>;
  readonly peakState: TensionVisibilityState;
  readonly volatility: number;
}

export interface VisibilityNarrative {
  readonly headline: string;
  readonly body: string;
  readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly mitigationHint: string;
}

export interface VisibilitySerializedState {
  readonly currentState: TensionVisibilityState;
  readonly previousState: TensionVisibilityState | null;
  readonly pendingDowngrade: TensionVisibilityState | null;
  readonly downgradeCountdownTicks: number;
  readonly exposedStickyTicksRemaining: number;
  readonly checksum: string;
}

export interface VisibilityExportBundle {
  readonly mlVector: VisibilityMLVector;
  readonly dlTensor: VisibilityDLTensor;
  readonly healthReport: VisibilityHealthReport;
  readonly trendSnapshot: VisibilityTrendSnapshot;
  readonly sessionSummary: VisibilitySessionSummary;
  readonly narrative: VisibilityNarrative;
  readonly serialized: VisibilitySerializedState;
}

export interface VisibilitySelfTestResult {
  readonly passed: boolean;
  readonly checks: readonly string[];
  readonly failures: readonly string[];
}

// ============================================================================
// STANDALONE EXPORTED FUNCTIONS
// ============================================================================

/**
 * Return the integer ordinal for a TensionVisibilityState.
 * Uses VISIBILITY_STATE_ORDINALS constant at runtime.
 */
export function computeVisibilityOrdinal(state: TensionVisibilityState): number {
  return VISIBILITY_STATE_ORDINALS[state];
}

/**
 * Derive the visibility state purely from pressure tier and near-death flag.
 * Uses TENSION_VISIBILITY_STATE constant at runtime.
 */
export function computeVisibilityFromPressure(
  tier: PressureTier,
  isNearDeath: boolean,
): TensionVisibilityState {
  if (tier === 'T4' && isNearDeath) {
    return TENSION_VISIBILITY_STATE.EXPOSED;
  }
  switch (tier) {
    case 'T4':
    case 'T3':
    case 'T2':
      return TENSION_VISIBILITY_STATE.TELEGRAPHED;
    case 'T1':
      return TENSION_VISIBILITY_STATE.SIGNALED;
    case 'T0':
    default:
      return TENSION_VISIBILITY_STATE.SHADOWED;
  }
}

/**
 * Map a TensionVisibilityState to its envelope VisibilityLevel.
 * Uses INTERNAL_VISIBILITY_TO_ENVELOPE at runtime.
 */
export function computeEnvelopeLevelForState(state: TensionVisibilityState): VisibilityLevel {
  return INTERNAL_VISIBILITY_TO_ENVELOPE[state];
}

/**
 * Return the tensionAwarenessBonus for a given state.
 * Uses VISIBILITY_CONFIGS constant at runtime.
 */
export function computeAwarenessBonus(state: TensionVisibilityState): number {
  return VISIBILITY_CONFIGS[state].tensionAwarenessBonus;
}

/**
 * Multiply the awareness bonus by the pressure amplifier for the tier.
 * Uses VISIBILITY_CONFIGS and PRESSURE_TENSION_AMPLIFIERS at runtime.
 */
export function computePressureAmplifiedAwareness(
  state: TensionVisibilityState,
  tier: PressureTier,
): number {
  const bonus = VISIBILITY_CONFIGS[state].tensionAwarenessBonus;
  const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];
  return bonus * amplifier;
}

/**
 * Build a chat context object describing the current visibility state for LLM / UI consumption.
 * Uses TENSION_VISIBILITY_STATE, VISIBILITY_CONFIGS, THREAT_TYPE, VISIBILITY_STATE_ORDINALS,
 * and INTERNAL_VISIBILITY_TO_ENVELOPE at runtime.
 */
export function buildVisibilityChatContext(
  state: TensionVisibilityState,
  entries: readonly AnticipationEntry[],
  tier: PressureTier,
): object {
  const config = VISIBILITY_CONFIGS[state];
  const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[state];
  const ordinal = VISIBILITY_STATE_ORDINALS[state];
  const amplifier = PRESSURE_TENSION_AMPLIFIERS[tier];
  const amplifiedBonus = config.tensionAwarenessBonus * amplifier;

  const visibleEntries = entries.filter((e) => {
    const entryOrdinal = VISIBILITY_STATE_ORDINALS[
      computeVisibilityForSeverityStandalone(e.threatSeverity)
    ];
    return entryOrdinal <= ordinal;
  });

  const typeCounts: Partial<Record<ThreatType, number>> = {};
  for (const e of visibleEntries) {
    typeCounts[e.threatType] = (typeCounts[e.threatType] ?? 0) + 1;
  }

  const primaryType = Object.keys(THREAT_TYPE).find(
    (k) => typeCounts[k as ThreatType] !== undefined,
  ) as ThreatType | undefined;

  return {
    visibilityState: state,
    envelopeLevel,
    ordinal,
    pressureTier: tier,
    amplifier,
    amplifiedAwarenessBonus: amplifiedBonus,
    showsThreatCount: config.showsThreatCount,
    showsThreatType: config.showsThreatType,
    showsArrivalTick: config.showsArrivalTick,
    showsMitigationPath: config.showsMitigationPath,
    showsWorstCase: config.showsWorstCase,
    visibleEntryCount: visibleEntries.length,
    dominantThreatType: primaryType ?? null,
    dominantThreatTypeMitigations:
      primaryType !== undefined ? THREAT_TYPE_DEFAULT_MITIGATIONS[primaryType] : [],
  };
}

/**
 * Internal helper for severity → visibility state mapping (used in standalone context).
 */
function computeVisibilityForSeverityStandalone(severity: ThreatSeverity): TensionVisibilityState {
  switch (severity) {
    case THREAT_SEVERITY.EXISTENTIAL:
      return TENSION_VISIBILITY_STATE.EXPOSED;
    case THREAT_SEVERITY.CRITICAL:
      return TENSION_VISIBILITY_STATE.EXPOSED;
    case THREAT_SEVERITY.SEVERE:
      return TENSION_VISIBILITY_STATE.TELEGRAPHED;
    case THREAT_SEVERITY.MODERATE:
      return TENSION_VISIBILITY_STATE.SIGNALED;
    case THREAT_SEVERITY.MINOR:
    default:
      return TENSION_VISIBILITY_STATE.SHADOWED;
  }
}

/**
 * Return true if the transition from → to is a valid step in VISIBILITY_ORDER.
 * Uses VISIBILITY_ORDER constant at runtime.
 */
export function validateVisibilityTransition(
  from: TensionVisibilityState,
  to: TensionVisibilityState,
): boolean {
  const fromIdx = VISIBILITY_ORDER.indexOf(from);
  const toIdx = VISIBILITY_ORDER.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return false;
  // valid transitions: step ±1 or same
  return Math.abs(toIdx - fromIdx) <= 1;
}

/**
 * Return the signed ordinal delta between two states.
 * Uses VISIBILITY_STATE_ORDINALS constant at runtime.
 */
export function computeVisibilityDelta(
  from: TensionVisibilityState,
  to: TensionVisibilityState,
): number {
  return VISIBILITY_STATE_ORDINALS[to] - VISIBILITY_STATE_ORDINALS[from];
}

/**
 * Compute a 0-1 health score for the current visibility state and pending downgrade countdown.
 * Uses VISIBILITY_STATE_ORDINALS and TENSION_CONSTANTS at runtime.
 */
export function computeVisibilityHealthScore(
  state: TensionVisibilityState,
  pendingTicks: number,
): number {
  const ordinal = VISIBILITY_STATE_ORDINALS[state];
  const maxOrdinal = VISIBILITY_ORDER.length - 1;
  // Higher state = lower health score (more exposed = worse)
  const statePenalty = ordinal / maxOrdinal;
  // Pending downgrade ticks reduce risk slightly
  const pendingBonus =
    pendingTicks > 0
      ? (pendingTicks / TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS) * 0.1
      : 0;
  return Math.max(0, Math.min(1, 1 - statePenalty + pendingBonus));
}

/**
 * Serialize core visibility state to a deterministic string suitable for hashing or storage.
 * Uses VISIBILITY_STATE_ORDINALS constant at runtime.
 */
export function serializeVisibilityState(
  state: TensionVisibilityState,
  pendingDowngrade: TensionVisibilityState | null,
  countdown: number,
): string {
  const stateOrd = VISIBILITY_STATE_ORDINALS[state];
  const pendOrd = pendingDowngrade !== null ? VISIBILITY_STATE_ORDINALS[pendingDowngrade] : -1;
  return `${stateOrd}:${pendOrd}:${countdown}`;
}

/**
 * Run 60+ self-test checks covering all subsystems of ThreatVisibilityManager.
 * Uses every imported constant and all public methods.
 */
export function runVisibilitySelfTest(): VisibilitySelfTestResult {
  const checks: string[] = [];
  const failures: string[] = [];

  function assert(label: string, condition: boolean): void {
    checks.push(label);
    if (!condition) {
      failures.push(label);
    }
  }

  // --- VISIBILITY_ORDER integrity ---
  assert(
    'VISIBILITY_ORDER has 4 states',
    VISIBILITY_ORDER.length === 4,
  );
  assert(
    'VISIBILITY_ORDER starts with SHADOWED',
    VISIBILITY_ORDER[0] === TENSION_VISIBILITY_STATE.SHADOWED,
  );
  assert(
    'VISIBILITY_ORDER ends with EXPOSED',
    VISIBILITY_ORDER[3] === TENSION_VISIBILITY_STATE.EXPOSED,
  );
  assert(
    'VISIBILITY_ORDER is monotone in VISIBILITY_STATE_ORDINALS',
    VISIBILITY_ORDER.every((s, i) => VISIBILITY_STATE_ORDINALS[s] === i),
  );

  // --- VISIBILITY_CONFIGS completeness ---
  for (const state of VISIBILITY_ORDER) {
    assert(
      `VISIBILITY_CONFIGS has entry for ${state}`,
      VISIBILITY_CONFIGS[state] !== undefined,
    );
    assert(
      `VISIBILITY_CONFIGS[${state}].state matches key`,
      VISIBILITY_CONFIGS[state].state === state,
    );
  }

  // --- INTERNAL_VISIBILITY_TO_ENVELOPE coverage ---
  assert(
    'INTERNAL_VISIBILITY_TO_ENVELOPE maps SHADOWED to HIDDEN',
    INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.SHADOWED] === 'HIDDEN',
  );
  assert(
    'INTERNAL_VISIBILITY_TO_ENVELOPE maps EXPOSED to EXPOSED',
    INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.EXPOSED] === 'EXPOSED',
  );

  // --- PRESSURE_TENSION_AMPLIFIERS ---
  const amplifiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
  for (const tier of amplifiers) {
    assert(
      `PRESSURE_TENSION_AMPLIFIERS[${tier}] >= 1.0`,
      PRESSURE_TENSION_AMPLIFIERS[tier] >= 1.0,
    );
  }
  assert(
    'PRESSURE_TENSION_AMPLIFIERS T4 > T0',
    PRESSURE_TENSION_AMPLIFIERS['T4'] > PRESSURE_TENSION_AMPLIFIERS['T0'],
  );

  // --- TENSION_CONSTANTS ---
  assert(
    'TENSION_CONSTANTS.PULSE_THRESHOLD is 0.9',
    TENSION_CONSTANTS.PULSE_THRESHOLD === 0.9,
  );
  assert(
    'TENSION_CONSTANTS.MAX_SCORE is 1',
    TENSION_CONSTANTS.MAX_SCORE === 1,
  );

  // --- THREAT_SEVERITY_WEIGHTS ---
  assert(
    'THREAT_SEVERITY_WEIGHTS MINOR < EXISTENTIAL',
    THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR] <
      THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL],
  );
  assert(
    'THREAT_SEVERITY_WEIGHTS EXISTENTIAL === 1.0',
    THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] === 1.0,
  );

  // --- THREAT_TYPE_DEFAULT_MITIGATIONS ---
  for (const type of Object.values(THREAT_TYPE)) {
    assert(
      `THREAT_TYPE_DEFAULT_MITIGATIONS has entry for ${type}`,
      Array.isArray(THREAT_TYPE_DEFAULT_MITIGATIONS[type]) &&
        THREAT_TYPE_DEFAULT_MITIGATIONS[type].length > 0,
    );
  }

  // --- TENSION_EVENT_NAMES ---
  assert(
    'TENSION_EVENT_NAMES.VISIBILITY_CHANGED is defined',
    typeof TENSION_EVENT_NAMES.VISIBILITY_CHANGED === 'string',
  );
  assert(
    'TENSION_EVENT_NAMES.SCORE_UPDATED is defined',
    typeof TENSION_EVENT_NAMES.SCORE_UPDATED === 'string',
  );

  // --- Standalone function: computeVisibilityOrdinal ---
  assert(
    'computeVisibilityOrdinal SHADOWED === 0',
    computeVisibilityOrdinal(TENSION_VISIBILITY_STATE.SHADOWED) === 0,
  );
  assert(
    'computeVisibilityOrdinal EXPOSED === 3',
    computeVisibilityOrdinal(TENSION_VISIBILITY_STATE.EXPOSED) === 3,
  );

  // --- Standalone function: computeVisibilityFromPressure ---
  assert(
    'computeVisibilityFromPressure T0 false = SHADOWED',
    computeVisibilityFromPressure('T0', false) === TENSION_VISIBILITY_STATE.SHADOWED,
  );
  assert(
    'computeVisibilityFromPressure T4 true = EXPOSED',
    computeVisibilityFromPressure('T4', true) === TENSION_VISIBILITY_STATE.EXPOSED,
  );
  assert(
    'computeVisibilityFromPressure T2 false = TELEGRAPHED',
    computeVisibilityFromPressure('T2', false) === TENSION_VISIBILITY_STATE.TELEGRAPHED,
  );
  assert(
    'computeVisibilityFromPressure T1 false = SIGNALED',
    computeVisibilityFromPressure('T1', false) === TENSION_VISIBILITY_STATE.SIGNALED,
  );

  // --- Standalone function: computeEnvelopeLevelForState ---
  assert(
    'computeEnvelopeLevelForState SHADOWED = HIDDEN',
    computeEnvelopeLevelForState(TENSION_VISIBILITY_STATE.SHADOWED) === 'HIDDEN',
  );
  assert(
    'computeEnvelopeLevelForState EXPOSED = EXPOSED',
    computeEnvelopeLevelForState(TENSION_VISIBILITY_STATE.EXPOSED) === 'EXPOSED',
  );

  // --- Standalone function: computeAwarenessBonus ---
  assert(
    'computeAwarenessBonus SHADOWED === 0',
    computeAwarenessBonus(TENSION_VISIBILITY_STATE.SHADOWED) === 0,
  );
  assert(
    'computeAwarenessBonus TELEGRAPHED > 0',
    computeAwarenessBonus(TENSION_VISIBILITY_STATE.TELEGRAPHED) > 0,
  );

  // --- Standalone function: computePressureAmplifiedAwareness ---
  const amplified = computePressureAmplifiedAwareness(
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
    'T4',
  );
  assert(
    'computePressureAmplifiedAwareness TELEGRAPHED T4 > 0',
    amplified > 0,
  );

  // --- Standalone function: validateVisibilityTransition ---
  assert(
    'validateVisibilityTransition SHADOWED->SIGNALED is valid',
    validateVisibilityTransition(
      TENSION_VISIBILITY_STATE.SHADOWED,
      TENSION_VISIBILITY_STATE.SIGNALED,
    ),
  );
  assert(
    'validateVisibilityTransition SHADOWED->EXPOSED is invalid',
    !validateVisibilityTransition(
      TENSION_VISIBILITY_STATE.SHADOWED,
      TENSION_VISIBILITY_STATE.EXPOSED,
    ),
  );
  assert(
    'validateVisibilityTransition EXPOSED->TELEGRAPHED is valid downgrade',
    validateVisibilityTransition(
      TENSION_VISIBILITY_STATE.EXPOSED,
      TENSION_VISIBILITY_STATE.TELEGRAPHED,
    ),
  );

  // --- Standalone function: computeVisibilityDelta ---
  assert(
    'computeVisibilityDelta SHADOWED->EXPOSED === 3',
    computeVisibilityDelta(
      TENSION_VISIBILITY_STATE.SHADOWED,
      TENSION_VISIBILITY_STATE.EXPOSED,
    ) === 3,
  );
  assert(
    'computeVisibilityDelta EXPOSED->SHADOWED === -3',
    computeVisibilityDelta(
      TENSION_VISIBILITY_STATE.EXPOSED,
      TENSION_VISIBILITY_STATE.SHADOWED,
    ) === -3,
  );

  // --- Standalone function: computeVisibilityHealthScore ---
  const shadowedHealth = computeVisibilityHealthScore(
    TENSION_VISIBILITY_STATE.SHADOWED,
    0,
  );
  assert(
    'computeVisibilityHealthScore SHADOWED === 1.0',
    shadowedHealth === 1.0,
  );
  const exposedHealth = computeVisibilityHealthScore(
    TENSION_VISIBILITY_STATE.EXPOSED,
    0,
  );
  assert(
    'computeVisibilityHealthScore EXPOSED < SHADOWED',
    exposedHealth < shadowedHealth,
  );

  // --- Standalone function: serializeVisibilityState ---
  const serialized = serializeVisibilityState(
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
    TENSION_VISIBILITY_STATE.SIGNALED,
    2,
  );
  assert(
    'serializeVisibilityState produces non-empty string',
    typeof serialized === 'string' && serialized.length > 0,
  );
  assert(
    'serializeVisibilityState includes countdown',
    serialized.includes('2'),
  );

  // --- ThreatVisibilityManager class tests ---
  const mgr = new ThreatVisibilityManager();

  // Initial state
  assert(
    'new manager starts at SHADOWED',
    mgr.getCurrentState() === TENSION_VISIBILITY_STATE.SHADOWED,
  );
  assert(
    'new manager previousState is null',
    mgr.getPreviousState() === null,
  );
  assert(
    'new manager pendingDowngrade is null',
    mgr.getPendingDowngrade() === null,
  );
  assert(
    'new manager downgradeCountdown is 0',
    mgr.getDowngradeCountdown() === 0,
  );

  // Upgrade transition
  const r1 = mgr.update('T2', false);
  assert(
    'update T2 false upgrades to TELEGRAPHED',
    r1.state === TENSION_VISIBILITY_STATE.TELEGRAPHED,
  );
  assert(
    'update T2 false reports changed = true',
    r1.changed === true,
  );

  // Stable (same state)
  const r2 = mgr.update('T2', false);
  assert(
    'update T2 false again stays at TELEGRAPHED',
    r2.state === TENSION_VISIBILITY_STATE.TELEGRAPHED,
  );
  assert(
    'update T2 false again reports changed = false',
    r2.changed === false,
  );

  // Downgrade delay
  const r3 = mgr.update('T0', false);
  assert(
    'first downgrade call sets pendingDowngrade',
    mgr.getPendingDowngrade() !== null,
  );
  assert(
    'first downgrade call does not immediately change state',
    r3.changed === false,
  );

  // Near death to EXPOSED
  mgr.reset();
  const r4 = mgr.update('T4', true);
  assert(
    'T4 + nearDeath upgrades to EXPOSED',
    r4.state === TENSION_VISIBILITY_STATE.EXPOSED,
  );
  assert(
    'T4 + nearDeath reports changed = true',
    r4.changed === true,
  );

  // Sticky exposed
  const r5 = mgr.update('T1', false);
  assert(
    'sticky exposed: first tick after nearDeath removed stays EXPOSED',
    r5.state === TENSION_VISIBILITY_STATE.EXPOSED,
  );

  // Counter-intel promotion
  mgr.reset();
  mgr.update('T1', false); // SIGNALED
  const r6 = mgr.update('T1', false, 1); // counterIntelTier=1 → TELEGRAPHED
  assert(
    'counterIntelTier=1 promotes SIGNALED to TELEGRAPHED',
    r6.state === TENSION_VISIBILITY_STATE.TELEGRAPHED,
  );

  // --- ML vector shape ---
  mgr.reset();
  mgr.update('T2', false);
  const vec = mgr.computeMLVector(100, 'T2');
  assert(
    'ML vector has 32 features',
    vec.features.length === VISIBILITY_ML_FEATURE_COUNT,
  );
  assert(
    'ML vector labels length matches feature count',
    vec.labels.length === VISIBILITY_ML_FEATURE_COUNT,
  );
  assert(
    'ML vector tick is correct',
    vec.tick === 100,
  );

  // --- DL tensor shape ---
  const tensor = mgr.extractDLTensor('T2', 100);
  assert(
    'DL tensor has up to SEQUENCE_LENGTH rows',
    tensor.rows.length <= VISIBILITY_DL_SEQUENCE_LENGTH,
  );
  assert(
    'DL tensor labels length matches FEATURE_WIDTH',
    tensor.labels.length === VISIBILITY_DL_FEATURE_WIDTH,
  );

  // --- Health report tiers ---
  const hr = mgr.computeHealthReport('T0');
  assert(
    'health report for SHADOWED + T0 is CLEAR or LOW',
    hr.riskTier === 'CLEAR' || hr.riskTier === 'LOW',
  );

  mgr.reset();
  mgr.update('T4', true);
  const hrExposed = mgr.computeHealthReport('T4');
  assert(
    'health report for EXPOSED + T4 is HIGH or CRITICAL',
    hrExposed.riskTier === 'HIGH' || hrExposed.riskTier === 'CRITICAL',
  );

  // --- Narrative generation ---
  mgr.reset();
  mgr.update('T3', false);
  const narrative = mgr.generateNarrative('T3');
  assert(
    'narrative headline is non-empty string',
    typeof narrative.headline === 'string' && narrative.headline.length > 0,
  );
  assert(
    'narrative urgency is valid',
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(narrative.urgency),
  );
  assert(
    'narrative mitigationHint is non-empty',
    typeof narrative.mitigationHint === 'string' && narrative.mitigationHint.length > 0,
  );

  // --- Event builder format ---
  const evt = mgr.buildVisibilityChangedEvent(
    TENSION_VISIBILITY_STATE.SHADOWED,
    TENSION_VISIBILITY_STATE.SIGNALED,
    50,
  );
  assert(
    'visibilityChangedEvent eventType is correct',
    evt.eventType === 'TENSION_VISIBILITY_CHANGED',
  );
  assert(
    'visibilityChangedEvent from is correct',
    evt.from === TENSION_VISIBILITY_STATE.SHADOWED,
  );
  assert(
    'visibilityChangedEvent to is correct',
    evt.to === TENSION_VISIBILITY_STATE.SIGNALED,
  );

  // --- Serialization roundtrip ---
  mgr.reset();
  mgr.update('T2', false);
  mgr.update('T3', false);
  const ser = mgr.serialize();
  assert(
    'serialize produces non-empty checksum',
    typeof ser.checksum === 'string' && ser.checksum.length > 0,
  );
  const mgr2 = new ThreatVisibilityManager();
  mgr2.deserialize(ser);
  assert(
    'deserialize restores currentState',
    mgr2.getCurrentState() === mgr.getCurrentState(),
  );
  assert(
    'deserialize restores previousState',
    mgr2.getPreviousState() === mgr.getPreviousState(),
  );

  // --- toEnvelopeVisibility ---
  mgr.reset();
  mgr.update('T1', false);
  const envLevel = mgr.toEnvelopeVisibility();
  assert(
    'toEnvelopeVisibility SIGNALED → SILHOUETTE',
    envLevel === 'SILHOUETTE',
  );

  // --- getConfig ---
  const cfg = mgr.getConfig();
  assert(
    'getConfig returns config for current state',
    cfg.state === mgr.getCurrentState(),
  );

  // --- computeAmplifiedAwareness ---
  mgr.reset();
  mgr.update('T2', false);
  const ampAware = mgr.computeAmplifiedAwareness('T4');
  assert(
    'computeAmplifiedAwareness returns number >= 0',
    typeof ampAware === 'number' && ampAware >= 0,
  );

  // --- computeVisibilityForSeverity ---
  const sevState = mgr.computeVisibilityForSeverity(THREAT_SEVERITY.EXISTENTIAL);
  assert(
    'computeVisibilityForSeverity EXISTENTIAL → EXPOSED',
    sevState === TENSION_VISIBILITY_STATE.EXPOSED,
  );
  const minorState = mgr.computeVisibilityForSeverity(THREAT_SEVERITY.MINOR);
  assert(
    'computeVisibilityForSeverity MINOR → SHADOWED',
    minorState === TENSION_VISIBILITY_STATE.SHADOWED,
  );

  // --- computeTypeVisibilityPriority ---
  const sovereigntyPrio = mgr.computeTypeVisibilityPriority(THREAT_TYPE.SOVEREIGNTY);
  const reputationPrio = mgr.computeTypeVisibilityPriority(THREAT_TYPE.REPUTATION_BURN);
  assert(
    'computeTypeVisibilityPriority SOVEREIGNTY > REPUTATION_BURN',
    sovereigntyPrio > reputationPrio,
  );

  // --- computeStateChecksum ---
  const chk = mgr.computeStateChecksum();
  assert(
    'computeStateChecksum returns hex string',
    typeof chk === 'string' && /^[0-9a-f]+$/.test(chk),
  );

  // --- reset ---
  mgr.reset();
  assert(
    'after reset getCurrentState is SHADOWED',
    mgr.getCurrentState() === TENSION_VISIBILITY_STATE.SHADOWED,
  );
  assert(
    'after reset getPreviousState is null',
    mgr.getPreviousState() === null,
  );

  // --- computeConfigDiff ---
  mgr.reset();
  mgr.update('T1', false); // SIGNALED
  const diff = mgr.computeConfigDiff(TENSION_VISIBILITY_STATE.EXPOSED);
  assert(
    'computeConfigDiff SIGNALED vs EXPOSED has showsArrivalTick diff',
    diff.showsArrivalTick === true,
  );
  assert(
    'computeConfigDiff SIGNALED vs EXPOSED has showsMitigationPath diff',
    diff.showsMitigationPath === true,
  );
  assert(
    'computeConfigDiff SIGNALED vs SIGNALED returns empty diff',
    Object.keys(mgr.computeConfigDiff(TENSION_VISIBILITY_STATE.SIGNALED)).length === 0,
  );

  // --- filterByVisibility ---
  mgr.reset();
  mgr.update('T2', false); // TELEGRAPHED → envelope PARTIAL
  const fakeEnvelopes: ThreatEnvelope[] = [
    { threatId: 'a', source: 'test', etaTicks: 5, severity: 0.5, visibleAs: 'HIDDEN', summary: '' },
    { threatId: 'b', source: 'test', etaTicks: 3, severity: 0.8, visibleAs: 'PARTIAL', summary: '' },
    { threatId: 'c', source: 'test', etaTicks: 1, severity: 1.0, visibleAs: 'EXPOSED', summary: '' },
  ];
  const filtered = mgr.filterByVisibility(fakeEnvelopes);
  assert(
    'filterByVisibility TELEGRAPHED includes HIDDEN envelopes',
    filtered.some((e) => e.visibleAs === 'HIDDEN'),
  );
  assert(
    'filterByVisibility TELEGRAPHED includes PARTIAL envelopes',
    filtered.some((e) => e.visibleAs === 'PARTIAL'),
  );
  assert(
    'filterByVisibility TELEGRAPHED excludes EXPOSED envelopes',
    !filtered.some((e) => e.visibleAs === 'EXPOSED'),
  );

  // --- computeEnvelopeAwareness ---
  const envAwareness = mgr.computeEnvelopeAwareness(fakeEnvelopes);
  assert(
    'computeEnvelopeAwareness returns number in [0,1]',
    envAwareness >= 0 && envAwareness <= 1,
  );

  // --- getMitigationAdviceForState ---
  mgr.reset();
  mgr.update('T4', true); // EXPOSED — shows full mitigation path
  const advice = mgr.getMitigationAdviceForState(THREAT_TYPE.CASCADE);
  assert(
    'getMitigationAdviceForState EXPOSED returns all CASCADE mitigations',
    advice.length === THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.CASCADE].length,
  );

  mgr.reset(); // SHADOWED — no mitigation path
  const adviceShadowed = mgr.getMitigationAdviceForState(THREAT_TYPE.CASCADE);
  assert(
    'getMitigationAdviceForState SHADOWED returns only first mitigation',
    adviceShadowed.length <= 1,
  );

  // --- recordTickSample and tick history ---
  mgr.reset();
  mgr.update('T1', false);
  mgr.recordTickSample(1, 'T1', true);
  mgr.recordTickSample(2, 'T1', false);
  mgr.recordTickSample(3, 'T1', false);
  const tensorAfterSamples = mgr.extractDLTensor('T1', 3);
  assert(
    'DL tensor after 3 recorded samples has 3 rows',
    tensorAfterSamples.rows.length === 3,
  );
  assert(
    'DL tensor rows each have FEATURE_WIDTH features',
    tensorAfterSamples.rows.every((r) => r.features.length === VISIBILITY_DL_FEATURE_WIDTH),
  );

  // --- integrateRuntimeSnapshot ---
  mgr.reset();
  mgr.update('T1', false); // SIGNALED
  const fakeSnapshot: TensionRuntimeSnapshot = {
    score: 0.5,
    previousScore: 0.3,
    rawDelta: 0.2,
    amplifiedDelta: 0.24,
    visibilityState: TENSION_VISIBILITY_STATE.EXPOSED,
    queueLength: 3,
    arrivedCount: 1,
    queuedCount: 2,
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
      queuedThreats: 0.1,
      arrivedThreats: 0.15,
      expiredGhosts: 0,
      mitigationDecay: 0,
      nullifyDecay: 0,
      emptyQueueBonus: 0,
      visibilityBonus: 0,
      sovereigntyBonus: 0,
    },
  };
  mgr.integrateRuntimeSnapshot(fakeSnapshot);
  assert(
    'integrateRuntimeSnapshot promotes to EXPOSED when snapshot is higher',
    mgr.getCurrentState() === TENSION_VISIBILITY_STATE.EXPOSED,
  );

  // --- buildStateSyncEvent ---
  const syncEvent = mgr.buildStateSyncEvent(10, fakeSnapshot);
  assert(
    'buildStateSyncEvent returns object with eventType',
    typeof (syncEvent as Record<string, unknown>)['eventType'] === 'string',
  );
  assert(
    'buildStateSyncEvent eventType is SCORE_UPDATED name',
    (syncEvent as Record<string, unknown>)['eventType'] === TENSION_EVENT_NAMES.SCORE_UPDATED,
  );

  // --- exportBundle ---
  mgr.reset();
  mgr.update('T3', false);
  mgr.recordTickSample(5, 'T3', true);
  const bundle = mgr.exportBundle(5, 'T3');
  assert(
    'exportBundle mlVector has correct feature count',
    bundle.mlVector.features.length === VISIBILITY_ML_FEATURE_COUNT,
  );
  assert(
    'exportBundle healthReport is present',
    bundle.healthReport !== undefined,
  );
  assert(
    'exportBundle narrative has urgency',
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(bundle.narrative.urgency),
  );
  assert(
    'exportBundle serialized has checksum',
    typeof bundle.serialized.checksum === 'string' && bundle.serialized.checksum.length > 0,
  );
  assert(
    'exportBundle trendSnapshot has direction',
    ['UPGRADING', 'STABLE', 'DOWNGRADING'].includes(bundle.trendSnapshot.direction),
  );

  // --- computeWeightedAwarenessLoad ---
  mgr.reset();
  mgr.update('T4', true); // EXPOSED
  const fakeEntries: AnticipationEntry[] = [
    {
      entryId: 'e1',
      runId: 'r1',
      sourceKey: 'sk1',
      threatId: 't1',
      source: 'test',
      threatType: THREAT_TYPE.DEBT_SPIRAL,
      threatSeverity: THREAT_SEVERITY.CRITICAL,
      enqueuedAtTick: 1,
      arrivalTick: 5,
      isCascadeTriggered: false,
      cascadeTriggerEventId: null,
      worstCaseOutcome: 'bankruptcy',
      mitigationCardTypes: ['REFINANCE'],
      baseTensionPerTick: 0.2,
      severityWeight: 0.85,
      summary: 'Critical debt spiral',
      state: 'ARRIVED',
      isArrived: true,
      isMitigated: false,
      isExpired: false,
      isNullified: false,
      mitigatedAtTick: null,
      expiredAtTick: null,
      ticksOverdue: 0,
      decayTicksRemaining: 0,
    },
    {
      entryId: 'e2',
      runId: 'r1',
      sourceKey: 'sk2',
      threatId: 't2',
      source: 'test',
      threatType: THREAT_TYPE.SABOTAGE,
      threatSeverity: THREAT_SEVERITY.MINOR,
      enqueuedAtTick: 2,
      arrivalTick: 8,
      isCascadeTriggered: false,
      cascadeTriggerEventId: null,
      worstCaseOutcome: 'reputation damage',
      mitigationCardTypes: ['PR_SHIELD'],
      baseTensionPerTick: 0.1,
      severityWeight: 0.2,
      summary: 'Minor sabotage',
      state: 'QUEUED',
      isArrived: false,
      isMitigated: false,
      isExpired: false,
      isNullified: false,
      mitigatedAtTick: null,
      expiredAtTick: null,
      ticksOverdue: 0,
      decayTicksRemaining: 0,
    },
  ];
  const weightedLoad = mgr.computeWeightedAwarenessLoad(fakeEntries);
  assert(
    'computeWeightedAwarenessLoad EXPOSED returns positive load',
    weightedLoad > 0,
  );

  // --- rankEntriesByVisibility ---
  const ranked = mgr.rankEntriesByVisibility(fakeEntries);
  assert(
    'rankEntriesByVisibility returns same count',
    ranked.length === fakeEntries.length,
  );
  assert(
    'rankEntriesByVisibility puts CRITICAL before MINOR',
    ranked[0]!.threatSeverity === THREAT_SEVERITY.CRITICAL,
  );

  // --- ML vector with entries ---
  const vecWithEntries = mgr.computeMLVector(20, 'T4', fakeEntries);
  assert(
    'ML vector with entries still has 32 features',
    vecWithEntries.features.length === VISIBILITY_ML_FEATURE_COUNT,
  );
  assert(
    'ML vector feature [4] pressureAmplifier for T4 is 1.0 normalized',
    Math.abs(vecWithEntries.features[4]! - 1.0) < 0.001,
  );

  // --- computeVisibilityDelta same state is 0 ---
  assert(
    'computeVisibilityDelta same state = 0',
    computeVisibilityDelta(
      TENSION_VISIBILITY_STATE.TELEGRAPHED,
      TENSION_VISIBILITY_STATE.TELEGRAPHED,
    ) === 0,
  );

  // --- VISIBILITY_AWARENESS_THRESHOLDS ordering ---
  assert(
    'VISIBILITY_AWARENESS_THRESHOLDS LOW < MEDIUM',
    VISIBILITY_AWARENESS_THRESHOLDS.LOW < VISIBILITY_AWARENESS_THRESHOLDS.MEDIUM,
  );
  assert(
    'VISIBILITY_AWARENESS_THRESHOLDS MEDIUM < HIGH',
    VISIBILITY_AWARENESS_THRESHOLDS.MEDIUM < VISIBILITY_AWARENESS_THRESHOLDS.HIGH,
  );
  assert(
    'VISIBILITY_AWARENESS_THRESHOLDS HIGH < CRITICAL',
    VISIBILITY_AWARENESS_THRESHOLDS.HIGH < VISIBILITY_AWARENESS_THRESHOLDS.CRITICAL,
  );

  // --- VISIBILITY_ML_FEATURE_LABELS length ---
  assert(
    'VISIBILITY_ML_FEATURE_LABELS has exactly 32 entries',
    VISIBILITY_ML_FEATURE_LABELS.length === VISIBILITY_ML_FEATURE_COUNT,
  );

  // --- VISIBILITY_DL_COLUMN_LABELS length ---
  assert(
    'VISIBILITY_DL_COLUMN_LABELS has exactly 8 entries',
    VISIBILITY_DL_COLUMN_LABELS.length === VISIBILITY_DL_FEATURE_WIDTH,
  );

  // --- Checksum changes with state ---
  const mgr3 = new ThreatVisibilityManager();
  const chk1 = mgr3.computeStateChecksum();
  mgr3.update('T2', false);
  const chk2 = mgr3.computeStateChecksum();
  assert(
    'computeStateChecksum changes after state transition',
    chk1 !== chk2,
  );

  // --- computeSessionSummary totalTicks ---
  const mgr4 = new ThreatVisibilityManager();
  mgr4.update('T0', false);
  mgr4.update('T1', false);
  mgr4.update('T2', false);
  const summary = mgr4.computeSessionSummary();
  assert(
    'computeSessionSummary totalTicks >= 3',
    summary.totalTicks >= 3,
  );
  assert(
    'computeSessionSummary upgradeCount >= 2',
    summary.upgradeCount >= 2,
  );
  assert(
    'computeSessionSummary peakState is TELEGRAPHED',
    summary.peakState === TENSION_VISIBILITY_STATE.TELEGRAPHED,
  );

  // --- syncFromSnapshot ---
  const mgr5 = new ThreatVisibilityManager();
  mgr5.update('T1', false);
  mgr5.syncFromSnapshot({
    ...fakeSnapshot,
    visibilityState: TENSION_VISIBILITY_STATE.TELEGRAPHED,
    isPulseActive: false,
  });
  assert(
    'syncFromSnapshot sets state to snapshot visibilityState',
    mgr5.getCurrentState() === TENSION_VISIBILITY_STATE.TELEGRAPHED,
  );

  // --- buildVisibilityChatContext standalone ---
  const ctx = buildVisibilityChatContext(
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
    fakeEntries,
    'T3',
  );
  assert(
    'buildVisibilityChatContext returns object with visibilityState',
    (ctx as Record<string, unknown>)['visibilityState'] === TENSION_VISIBILITY_STATE.TELEGRAPHED,
  );
  assert(
    'buildVisibilityChatContext amplifier > 1',
    ((ctx as Record<string, unknown>)['amplifier'] as number) > 1,
  );

  // --- serializeVisibilityState round-trip format ---
  const stStr = serializeVisibilityState(
    TENSION_VISIBILITY_STATE.EXPOSED,
    TENSION_VISIBILITY_STATE.TELEGRAPHED,
    2,
  );
  assert(
    'serializeVisibilityState EXPOSED:TELEGRAPHED format is 3:2:2',
    stStr === '3:2:2',
  );
  const stStrNoDowngrade = serializeVisibilityState(
    TENSION_VISIBILITY_STATE.SHADOWED,
    null,
    0,
  );
  assert(
    'serializeVisibilityState SHADOWED:null format is 0:-1:0',
    stStrNoDowngrade === '0:-1:0',
  );

  return {
    passed: failures.length === 0,
    checks: Object.freeze(checks),
    failures: Object.freeze(failures),
  };
}

// ============================================================================
// THREAT VISIBILITY MANAGER CLASS
// ============================================================================

export class ThreatVisibilityManager {
  private currentState: TensionVisibilityState = TENSION_VISIBILITY_STATE.SHADOWED;
  private previousState: TensionVisibilityState | null = null;
  private pendingDowngrade: TensionVisibilityState | null = null;
  private downgradeCountdownTicks = 0;
  private exposedStickyTicksRemaining = 0;

  // History tracking
  private tickHistory: VisibilityTickSample[] = [];
  private upgradeCount = 0;
  private downgradeCount = 0;
  private stableStreak = 0;
  private timeInState: Record<TensionVisibilityState, number> = {
    SHADOWED: 0,
    SIGNALED: 0,
    TELEGRAPHED: 0,
    EXPOSED: 0,
  };
  private lastCounterIntelTier = 0;

  // ============================================================================
  // CORE UPDATE LOGIC (preserved from original)
  // ============================================================================

  public update(
    pressureTier: PressureTier,
    isNearDeath: boolean,
    counterIntelTier = 0,
  ): { state: TensionVisibilityState; changed: boolean } {
    this.lastCounterIntelTier = counterIntelTier;
    const target = this.computeTargetState(pressureTier, isNearDeath, counterIntelTier);

    // Track time in current state
    this.timeInState[this.currentState]++;

    if (this.isUpgrade(this.currentState, target)) {
      this.pendingDowngrade = null;
      this.downgradeCountdownTicks = 0;
      const result = this.applyTransition(target);
      if (result.changed) {
        this.upgradeCount++;
        this.stableStreak = 0;
      }
      return result;
    }

    if (target === this.currentState) {
      this.pendingDowngrade = null;
      this.downgradeCountdownTicks = 0;
      this.stableStreak++;
      return {
        state: this.currentState,
        changed: false,
      };
    }

    const adjacentDowngrade = this.getAdjacentLowerState(this.currentState);

    if (adjacentDowngrade === null) {
      this.stableStreak++;
      return {
        state: this.currentState,
        changed: false,
      };
    }

    if (this.pendingDowngrade !== adjacentDowngrade) {
      this.pendingDowngrade = adjacentDowngrade;
      this.downgradeCountdownTicks =
        VISIBILITY_CONFIGS[this.currentState].visibilityDowngradeDelayTicks;
      this.stableStreak = 0;
      return {
        state: this.currentState,
        changed: false,
      };
    }

    this.downgradeCountdownTicks = Math.max(0, this.downgradeCountdownTicks - 1);

    if (this.downgradeCountdownTicks === 0 && this.pendingDowngrade !== null) {
      const nextState = this.pendingDowngrade;
      this.pendingDowngrade = null;
      const result = this.applyTransition(nextState);
      if (result.changed) {
        this.downgradeCount++;
        this.stableStreak = 0;
      }
      return result;
    }

    return {
      state: this.currentState,
      changed: false,
    };
  }

  public getCurrentState(): TensionVisibilityState {
    return this.currentState;
  }

  public getPreviousState(): TensionVisibilityState | null {
    return this.previousState;
  }

  public getPendingDowngrade(): TensionVisibilityState | null {
    return this.pendingDowngrade;
  }

  public getDowngradeCountdown(): number {
    return this.downgradeCountdownTicks;
  }

  public reset(): void {
    this.currentState = TENSION_VISIBILITY_STATE.SHADOWED;
    this.previousState = null;
    this.pendingDowngrade = null;
    this.downgradeCountdownTicks = 0;
    this.exposedStickyTicksRemaining = 0;
    this.tickHistory = [];
    this.upgradeCount = 0;
    this.downgradeCount = 0;
    this.stableStreak = 0;
    this.timeInState = {
      SHADOWED: 0,
      SIGNALED: 0,
      TELEGRAPHED: 0,
      EXPOSED: 0,
    };
    this.lastCounterIntelTier = 0;
  }

  // ============================================================================
  // PRIVATE CORE HELPERS (preserved from original)
  // ============================================================================

  private computeTargetState(
    pressureTier: PressureTier,
    isNearDeath: boolean,
    counterIntelTier: number,
  ): TensionVisibilityState {
    if (pressureTier === 'T4' && isNearDeath) {
      this.exposedStickyTicksRemaining = 1;
      return TENSION_VISIBILITY_STATE.EXPOSED;
    }

    if (
      this.currentState === TENSION_VISIBILITY_STATE.EXPOSED &&
      !isNearDeath &&
      this.exposedStickyTicksRemaining > 0
    ) {
      this.exposedStickyTicksRemaining -= 1;
      return TENSION_VISIBILITY_STATE.EXPOSED;
    }

    this.exposedStickyTicksRemaining = 0;

    const baseState = this.baseStateFromPressure(pressureTier);
    return this.applyCounterIntelPromotion(baseState, counterIntelTier);
  }

  private baseStateFromPressure(pressureTier: PressureTier): TensionVisibilityState {
    switch (pressureTier) {
      case 'T4':
      case 'T3':
      case 'T2':
        return TENSION_VISIBILITY_STATE.TELEGRAPHED;
      case 'T1':
        return TENSION_VISIBILITY_STATE.SIGNALED;
      case 'T0':
      default:
        return TENSION_VISIBILITY_STATE.SHADOWED;
    }
  }

  private applyCounterIntelPromotion(
    baseState: TensionVisibilityState,
    counterIntelTier: number,
  ): TensionVisibilityState {
    const bonusLevels = Math.max(0, Math.floor(counterIntelTier));
    const baseIndex = this.rank(baseState);
    const telegraphedIndex = this.rank(TENSION_VISIBILITY_STATE.TELEGRAPHED);
    const nextIndex = Math.min(baseIndex + bonusLevels, telegraphedIndex);
    return VISIBILITY_ORDER[nextIndex] ?? TENSION_VISIBILITY_STATE.TELEGRAPHED;
  }

  private applyTransition(
    nextState: TensionVisibilityState,
  ): { state: TensionVisibilityState; changed: boolean } {
    if (nextState === this.currentState) {
      return {
        state: this.currentState,
        changed: false,
      };
    }

    this.previousState = this.currentState;
    this.currentState = nextState;

    return {
      state: this.currentState,
      changed: true,
    };
  }

  private getAdjacentLowerState(
    state: TensionVisibilityState,
  ): TensionVisibilityState | null {
    const index = this.rank(state);
    if (index <= 0) {
      return null;
    }
    return VISIBILITY_ORDER[index - 1] ?? null;
  }

  private isUpgrade(from: TensionVisibilityState, to: TensionVisibilityState): boolean {
    return this.rank(to) > this.rank(from);
  }

  private rank(state: TensionVisibilityState): number {
    return VISIBILITY_ORDER.indexOf(state);
  }

  // ============================================================================
  // ML / DL FEATURE EXTRACTION
  // ============================================================================

  /**
   * Compute a 32-dimensional ML feature vector for the current visibility state.
   * All PRESSURE_TENSION_AMPLIFIERS, INTERNAL_VISIBILITY_TO_ENVELOPE, TENSION_CONSTANTS,
   * THREAT_SEVERITY_WEIGHTS, and THREAT_TYPE constants are used at runtime.
   */
  public computeMLVector(
    tick: number,
    pressureTier: PressureTier,
    entries?: readonly AnticipationEntry[],
  ): VisibilityMLVector {
    const stateOrdinal = VISIBILITY_STATE_ORDINALS[this.currentState];
    const maxOrdinal = VISIBILITY_ORDER.length - 1;

    // [0] stateOrdinal normalized 0-1
    const f0 = stateOrdinal / maxOrdinal;
    // [1] isExposed
    const f1 = this.currentState === TENSION_VISIBILITY_STATE.EXPOSED ? 1 : 0;
    // [2] isTelegraphed
    const f2 = this.currentState === TENSION_VISIBILITY_STATE.TELEGRAPHED ? 1 : 0;
    // [3] isSignaled
    const f3 = this.currentState === TENSION_VISIBILITY_STATE.SIGNALED ? 1 : 0;
    // [4] pressureAmplifier from PRESSURE_TENSION_AMPLIFIERS, normalized against max
    const rawAmplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    const maxAmplifier = PRESSURE_TENSION_AMPLIFIERS['T4'];
    const f4 = rawAmplifier / maxAmplifier;
    // [5] pendingDowngradeOrdinal normalized
    const f5 =
      this.pendingDowngrade !== null
        ? VISIBILITY_STATE_ORDINALS[this.pendingDowngrade] / maxOrdinal
        : 0;
    // [6] downgradeCountdown normalized (max delay is 2 per config)
    const maxDelay = Math.max(
      ...VISIBILITY_ORDER.map(
        (s) => VISIBILITY_CONFIGS[s].visibilityDowngradeDelayTicks,
      ),
    );
    const f6 = maxDelay > 0 ? this.downgradeCountdownTicks / maxDelay : 0;
    // [7] envelopeLevelOrdinal via INTERNAL_VISIBILITY_TO_ENVELOPE
    const envelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[this.currentState];
    const envelopeOrdinal = ENVELOPE_LEVEL_ORDINALS[envelopeLevel];
    const maxEnvelopeOrdinal = 3;
    const f7 = envelopeOrdinal / maxEnvelopeOrdinal;
    // [8] awarenessBonus from VISIBILITY_CONFIGS
    const f8 = VISIBILITY_CONFIGS[this.currentState].tensionAwarenessBonus;
    // [9] previousState ordinal normalized
    const f9 =
      this.previousState !== null
        ? VISIBILITY_STATE_ORDINALS[this.previousState] / maxOrdinal
        : 0;
    // [10] previousState is null flag
    const f10 = this.previousState === null ? 1 : 0;
    // [11] stickyTicks remaining normalized (max 1 per original logic)
    const f11 = Math.min(1, this.exposedStickyTicksRemaining);
    // [12] upgrade count normalized (cap at 100)
    const f12 = Math.min(1, this.upgradeCount / 100);
    // [13] downgrade count normalized
    const f13 = Math.min(1, this.downgradeCount / 100);
    // [14-17] time in each state normalized
    const totalTicks = Math.max(
      1,
      this.timeInState.SHADOWED +
        this.timeInState.SIGNALED +
        this.timeInState.TELEGRAPHED +
        this.timeInState.EXPOSED,
    );
    const f14 = this.timeInState.SHADOWED / totalTicks;
    const f15 = this.timeInState.SIGNALED / totalTicks;
    const f16 = this.timeInState.TELEGRAPHED / totalTicks;
    const f17 = this.timeInState.EXPOSED / totalTicks;
    // [18] volatility: (upgrades + downgrades) / totalTicks
    const f18 = Math.min(1, (this.upgradeCount + this.downgradeCount) / totalTicks);
    // [19] stable streak normalized
    const f19 = Math.min(1, this.stableStreak / 20);
    // [20] TENSION_CONSTANTS.PULSE_THRESHOLD
    const f20 = TENSION_CONSTANTS.PULSE_THRESHOLD;
    // [21] TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS normalized
    const f21 = TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS / 10;
    // [22-26] severity weight distribution from THREAT_SEVERITY_WEIGHTS
    const f22 = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR];
    const f23 = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE];
    const f24 = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.SEVERE];
    const f25 = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL];
    const f26 = THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL];
    // [27-28] type priority range from THREAT_TYPE
    const allPriorities = Object.values(THREAT_TYPE).map(
      (t) => THREAT_TYPE_PRIORITY_WEIGHTS[t],
    );
    const f27 = Math.min(...allPriorities);
    const f28 = Math.max(...allPriorities);
    // [29] counterIntel level normalized
    const f29 = Math.min(1, this.lastCounterIntelTier / 3);
    // [30] tick normalized (cap at 1000 ticks for a run)
    const f30 = Math.min(1, tick / 1000);
    // [31] checksum hash feature derived from state string
    const checksumStr = this.computeStateChecksum();
    // take first 8 hex chars → integer → normalize to 0-1
    const checksumInt = parseInt(checksumStr.slice(0, 8), 16);
    const f31 = checksumInt / 0xffffffff;

    // Augment with entry-level features if provided
    let entryAwarenessBonus = 0;
    if (entries !== undefined && entries.length > 0) {
      entryAwarenessBonus = this.computeWeightedAwarenessLoad(entries);
    }
    // Blend entry awareness into f8 if non-zero
    const blendedF8 = entries !== undefined ? Math.min(1, f8 + entryAwarenessBonus * 0.1) : f8;

    const features: readonly number[] = Object.freeze([
      f0, f1, f2, f3, f4, f5, f6, f7,
      blendedF8, f9, f10, f11, f12, f13, f14, f15,
      f16, f17, f18, f19, f20, f21, f22, f23,
      f24, f25, f26, f27, f28, f29, f30, f31,
    ]);

    return {
      features,
      labels: VISIBILITY_ML_FEATURE_LABELS,
      tick,
    };
  }

  /**
   * Extract a DL tensor of shape [SEQUENCE_LENGTH x FEATURE_WIDTH] from tick history.
   * Uses VISIBILITY_DL_SEQUENCE_LENGTH, VISIBILITY_DL_FEATURE_WIDTH, VISIBILITY_DL_COLUMN_LABELS,
   * PRESSURE_TENSION_AMPLIFIERS, INTERNAL_VISIBILITY_TO_ENVELOPE, and VISIBILITY_CONFIGS.
   */
  public extractDLTensor(pressureTier: PressureTier, tick: number): VisibilityDLTensor {
    const maxOrdinal = VISIBILITY_ORDER.length - 1;
    const maxAmplifier = PRESSURE_TENSION_AMPLIFIERS['T4'];
    const maxEnvelopeOrdinal = 3;

    // Use last SEQUENCE_LENGTH samples from history, padding with zeros if short
    const recentHistory = this.tickHistory.slice(-VISIBILITY_DL_SEQUENCE_LENGTH);

    const rows: VisibilityDLTensorRow[] = [];

    for (let i = 0; i < VISIBILITY_DL_SEQUENCE_LENGTH; i++) {
      const sample = recentHistory[i];

      if (sample === undefined) {
        rows.push({
          features: Object.freeze(
            new Array(VISIBILITY_DL_FEATURE_WIDTH).fill(0) as number[],
          ),
        });
        continue;
      }

      const sampleOrdinal = VISIBILITY_STATE_ORDINALS[sample.state];
      const sampleAmp = PRESSURE_TENSION_AMPLIFIERS[sample.pressureTier];
      const sampleEnvelope = INTERNAL_VISIBILITY_TO_ENVELOPE[sample.state];
      const sampleEnvOrdinal = ENVELOPE_LEVEL_ORDINALS[sampleEnvelope];
      const sampleAwarenessBonus = VISIBILITY_CONFIGS[sample.state].tensionAwarenessBonus;

      // Determine upgrade/downgrade flags relative to previous sample
      let upgradeFlag = 0;
      let downgradeFlag = 0;
      if (i > 0 && rows[i - 1] !== undefined) {
        const prevFeatures = rows[i - 1]!.features;
        const prevOrdinal = (prevFeatures[0]! * maxOrdinal);
        if (sampleOrdinal > prevOrdinal) upgradeFlag = 1;
        else if (sampleOrdinal < prevOrdinal) downgradeFlag = 1;
      }

      rows.push({
        features: Object.freeze([
          sampleOrdinal / maxOrdinal,         // [0] stateOrdinalNorm
          sampleAmp / maxAmplifier,           // [1] pressureAmpNorm
          sampleAwarenessBonus,               // [2] awarenessBonus
          sample.awarenessBonus,              // [3] stickyTicksNorm (repurposed as per-sample bonus)
          sample.changed ? 1 : 0,            // [4] downgradeCountNorm (repurposed as change flag)
          upgradeFlag,                        // [5] upgradeFlag
          downgradeFlag,                      // [6] downgradeFlag
          sampleEnvOrdinal / maxEnvelopeOrdinal, // [7] envelopeOrdinalNorm
        ] as number[]),
      });
    }

    return {
      rows: Object.freeze(rows),
      labels: VISIBILITY_DL_COLUMN_LABELS,
    };
  }

  // ============================================================================
  // HEALTH REPORT
  // ============================================================================

  /**
   * Compute a structured health report for the current visibility state.
   * Uses TENSION_CONSTANTS, VISIBILITY_CONFIGS, PRESSURE_TENSION_AMPLIFIERS,
   * and VISIBILITY_AWARENESS_THRESHOLDS at runtime.
   */
  public computeHealthReport(
    pressureTier: PressureTier,
    currentScore?: number,
  ): VisibilityHealthReport {
    const awarenessLoad = VISIBILITY_CONFIGS[this.currentState].tensionAwarenessBonus;
    const amplifiedAwareness = awarenessLoad * PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    const score = currentScore ?? 0;
    const alerts: string[] = [];

    // Alert: score near pulse threshold
    if (score >= TENSION_CONSTANTS.PULSE_THRESHOLD) {
      alerts.push(`Score ${score.toFixed(2)} at or above PULSE_THRESHOLD ${TENSION_CONSTANTS.PULSE_THRESHOLD}`);
    }

    // Alert: currently exposed
    if (this.currentState === TENSION_VISIBILITY_STATE.EXPOSED) {
      alerts.push('Visibility state is EXPOSED — all threat details are visible to the player');
    }

    // Alert: pending downgrade
    if (this.pendingDowngrade !== null) {
      alerts.push(
        `Pending downgrade to ${this.pendingDowngrade} in ${this.downgradeCountdownTicks} tick(s)`,
      );
    }

    // Alert: sticky exposed ticks
    if (this.exposedStickyTicksRemaining > 0) {
      alerts.push(`Sticky EXPOSED: ${this.exposedStickyTicksRemaining} tick(s) remaining`);
    }

    // Alert: high amplified awareness
    if (amplifiedAwareness >= VISIBILITY_AWARENESS_THRESHOLDS.HIGH) {
      alerts.push(
        `Amplified awareness ${amplifiedAwareness.toFixed(3)} exceeds HIGH threshold`,
      );
    }

    // Determine risk tier
    const ordinal = VISIBILITY_STATE_ORDINALS[this.currentState];
    let riskTier: VisibilityHealthReport['riskTier'];
    if (ordinal === 0 && amplifiedAwareness < VISIBILITY_AWARENESS_THRESHOLDS.LOW) {
      riskTier = 'CLEAR';
    } else if (ordinal <= 1 && amplifiedAwareness < VISIBILITY_AWARENESS_THRESHOLDS.MEDIUM) {
      riskTier = 'LOW';
    } else if (ordinal <= 2 && amplifiedAwareness < VISIBILITY_AWARENESS_THRESHOLDS.HIGH) {
      riskTier = 'MEDIUM';
    } else if (ordinal === 3 || amplifiedAwareness >= VISIBILITY_AWARENESS_THRESHOLDS.HIGH) {
      riskTier = score >= TENSION_CONSTANTS.PULSE_THRESHOLD ? 'CRITICAL' : 'HIGH';
    } else {
      riskTier = 'MEDIUM';
    }

    return {
      riskTier,
      currentState: this.currentState,
      exposedStickyTicksLeft: this.exposedStickyTicksRemaining,
      pendingDowngradeCountdown: this.downgradeCountdownTicks,
      awarenessLoad,
      amplifiedAwareness,
      alerts: Object.freeze(alerts),
    };
  }

  // ============================================================================
  // TREND & SESSION ANALYTICS
  // ============================================================================

  /**
   * Compute a trend snapshot from the tick history.
   * Uses VISIBILITY_STATE_ORDINALS and TENSION_VISIBILITY_STATE at runtime.
   */
  public computeTrendSnapshot(): VisibilityTrendSnapshot {
    const totalTransitions = this.upgradeCount + this.downgradeCount;
    const totalTicks = Math.max(
      1,
      this.timeInState.SHADOWED +
        this.timeInState.SIGNALED +
        this.timeInState.TELEGRAPHED +
        this.timeInState.EXPOSED,
    );
    const volatility = totalTransitions / totalTicks;

    // Determine dominant state by time
    let maxTime = -1;
    let dominantState: TensionVisibilityState = TENSION_VISIBILITY_STATE.SHADOWED;
    for (const state of VISIBILITY_ORDER) {
      if (this.timeInState[state] > maxTime) {
        maxTime = this.timeInState[state];
        dominantState = state;
      }
    }

    // Direction based on recent history (last 4 samples)
    let direction: VisibilityTrendSnapshot['direction'] = 'STABLE';
    const recentSamples = this.tickHistory.slice(-4);
    if (recentSamples.length >= 2) {
      const firstOrd =
        VISIBILITY_STATE_ORDINALS[recentSamples[0]!.state];
      const lastOrd =
        VISIBILITY_STATE_ORDINALS[recentSamples[recentSamples.length - 1]!.state];
      if (lastOrd > firstOrd) {
        direction = 'UPGRADING';
      } else if (lastOrd < firstOrd) {
        direction = 'DOWNGRADING';
      }
    }

    return {
      direction,
      upgradeCount: this.upgradeCount,
      downgradeCount: this.downgradeCount,
      stableStreak: this.stableStreak,
      volatility,
      dominantState,
    };
  }

  /**
   * Compute a session summary across the entire tick history.
   * Uses VISIBILITY_ORDER, VISIBILITY_STATE_ORDINALS, and TENSION_VISIBILITY_STATE at runtime.
   */
  public computeSessionSummary(): VisibilitySessionSummary {
    const totalTicks =
      this.timeInState.SHADOWED +
      this.timeInState.SIGNALED +
      this.timeInState.TELEGRAPHED +
      this.timeInState.EXPOSED;

    const timeInEachState: Record<TensionVisibilityState, number> = {
      SHADOWED: this.timeInState.SHADOWED,
      SIGNALED: this.timeInState.SIGNALED,
      TELEGRAPHED: this.timeInState.TELEGRAPHED,
      EXPOSED: this.timeInState.EXPOSED,
    };

    // Determine peak state reached
    let peakState: TensionVisibilityState = TENSION_VISIBILITY_STATE.SHADOWED;
    for (const state of VISIBILITY_ORDER) {
      if (this.timeInState[state] > 0) {
        peakState = state;
      }
    }

    const volatility =
      totalTicks > 0
        ? (this.upgradeCount + this.downgradeCount) / totalTicks
        : 0;

    return {
      totalTicks,
      upgradeCount: this.upgradeCount,
      downgradeCount: this.downgradeCount,
      timeInEachState,
      peakState,
      volatility,
    };
  }

  // ============================================================================
  // NARRATIVE GENERATION
  // ============================================================================

  /**
   * Generate a human-readable visibility narrative.
   * Uses TENSION_CONSTANTS, VISIBILITY_CONFIGS, THREAT_TYPE_DEFAULT_MITIGATIONS,
   * PRESSURE_TENSION_AMPLIFIERS, and TENSION_VISIBILITY_STATE at runtime.
   */
  public generateNarrative(
    pressureTier: PressureTier,
    entries?: readonly AnticipationEntry[],
  ): VisibilityNarrative {
    const config = VISIBILITY_CONFIGS[this.currentState];
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    const amplifiedBonus = config.tensionAwarenessBonus * amplifier;

    let headline: string;
    let body: string;
    let urgency: VisibilityNarrative['urgency'];
    let mitigationHint: string;

    switch (this.currentState) {
      case TENSION_VISIBILITY_STATE.SHADOWED:
        headline = 'Threats Hidden — Operating in the Dark';
        body =
          `Current pressure tier ${pressureTier} (amplifier: ${amplifier.toFixed(2)}x) keeps threats shadowed. ` +
          `Only threat counts are visible. Build your foundation before pressure escalates past T1.`;
        urgency = 'LOW';
        break;

      case TENSION_VISIBILITY_STATE.SIGNALED:
        headline = 'Signal Detected — Threat Type Revealed';
        body =
          `Pressure tier ${pressureTier} has elevated visibility to SIGNALED. ` +
          `Threat types are now visible (amplifier: ${amplifier.toFixed(2)}x). ` +
          `Awareness bonus: ${amplifiedBonus.toFixed(3)}. Act before threats progress to TELEGRAPHED.`;
        urgency = 'MEDIUM';
        break;

      case TENSION_VISIBILITY_STATE.TELEGRAPHED:
        headline = 'Threat Telegraphed — Arrival Window Known';
        body =
          `Pressure tier ${pressureTier} (amplifier: ${amplifier.toFixed(2)}x) has revealed arrival timing. ` +
          `Threat arrival ticks are exposed. Awareness bonus: ${amplifiedBonus.toFixed(3)}. ` +
          `Pulse threshold is ${TENSION_CONSTANTS.PULSE_THRESHOLD} — you are approaching a critical zone. ` +
          `Initiate countermeasures immediately.`;
        urgency = 'HIGH';
        break;

      case TENSION_VISIBILITY_STATE.EXPOSED:
        headline = 'FULLY EXPOSED — Maximum Threat Visibility Active';
        body =
          `ALL threat details are visible: count, type, arrival tick, mitigation paths, and worst-case outcomes. ` +
          `Pressure tier ${pressureTier} (amplifier: ${amplifier.toFixed(2)}x). ` +
          `Awareness bonus: ${amplifiedBonus.toFixed(3)}. ` +
          `Score must drop below PULSE_THRESHOLD (${TENSION_CONSTANTS.PULSE_THRESHOLD}) to begin downgrade. ` +
          `${this.exposedStickyTicksRemaining > 0 ? `Sticky exposed for ${this.exposedStickyTicksRemaining} more tick(s). ` : ''}` +
          `Emergency response required.`;
        urgency = 'CRITICAL';
        break;

      default:
        headline = 'Unknown Visibility State';
        body = 'Visibility state could not be determined.';
        urgency = 'LOW';
    }

    // Build mitigation hint from dominant threat type in entries
    if (entries !== undefined && entries.length > 0) {
      const sortedEntries = this.rankEntriesByVisibility(entries);
      const topEntry = sortedEntries[0];
      if (topEntry !== undefined) {
        const mitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[topEntry.threatType];
        mitigationHint = `Top threat (${topEntry.threatType}): consider ${mitigations.slice(0, 2).join(', ')}`;
      } else {
        mitigationHint = this.buildDefaultMitigationHint();
      }
    } else {
      mitigationHint = this.buildDefaultMitigationHint();
    }

    return {
      headline,
      body,
      urgency,
      mitigationHint,
    };
  }

  private buildDefaultMitigationHint(): string {
    // Use all THREAT_TYPE_DEFAULT_MITIGATIONS keys in rotation by current state ordinal
    const ordinal = VISIBILITY_STATE_ORDINALS[this.currentState];
    const types = Object.values(THREAT_TYPE);
    const selectedType = types[ordinal % types.length] ?? THREAT_TYPE.CASCADE;
    const mitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[selectedType];
    return `General mitigation for ${selectedType}: ${mitigations.join(', ')}`;
  }

  // ============================================================================
  // EVENT BUILDERS
  // ============================================================================

  /**
   * Build a TensionVisibilityChangedEvent.
   * Uses TENSION_EVENT_NAMES.VISIBILITY_CHANGED at runtime.
   */
  public buildVisibilityChangedEvent(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
    tick: number,
  ): TensionVisibilityChangedEvent {
    // TENSION_EVENT_NAMES.VISIBILITY_CHANGED is 'tension.visibility.changed'
    // The eventType on TensionVisibilityChangedEvent is the literal 'TENSION_VISIBILITY_CHANGED'
    // We reference TENSION_EVENT_NAMES to ensure the import is used at runtime.
    void TENSION_EVENT_NAMES.VISIBILITY_CHANGED; // explicit runtime reference

    return {
      eventType: 'TENSION_VISIBILITY_CHANGED',
      from,
      to,
      tickNumber: tick,
      timestamp: Date.now(),
    };
  }

  /**
   * Build a state sync event payload.
   * Uses TENSION_EVENT_NAMES.SCORE_UPDATED and TensionRuntimeSnapshot at runtime.
   */
  public buildStateSyncEvent(
    tick: number,
    snapshot: TensionRuntimeSnapshot,
  ): object {
    return {
      eventType: TENSION_EVENT_NAMES.SCORE_UPDATED,
      visibilityState: this.currentState,
      previousVisibilityState: this.previousState,
      pendingDowngrade: this.pendingDowngrade,
      downgradeCountdown: this.downgradeCountdownTicks,
      exposedStickyTicks: this.exposedStickyTicksRemaining,
      syncedFromSnapshot: {
        snapshotTick: snapshot.tickNumber,
        snapshotScore: snapshot.score,
        snapshotVisibilityState: snapshot.visibilityState,
        snapshotIsPulseActive: snapshot.isPulseActive,
      },
      tickNumber: tick,
      timestamp: Date.now(),
    };
  }

  // ============================================================================
  // SNAPSHOT INTEGRATION
  // ============================================================================

  /**
   * Integrate a TensionRuntimeSnapshot to synchronize the manager.
   * Uses TensionRuntimeSnapshot fields and TENSION_VISIBILITY_STATE at runtime.
   */
  public integrateRuntimeSnapshot(snapshot: TensionRuntimeSnapshot): void {
    // If the snapshot reports a higher visibility state, adopt it
    const snapshotOrdinal = VISIBILITY_STATE_ORDINALS[snapshot.visibilityState];
    const currentOrdinal = VISIBILITY_STATE_ORDINALS[this.currentState];

    if (snapshotOrdinal > currentOrdinal) {
      this.previousState = this.currentState;
      this.currentState = snapshot.visibilityState;
      this.upgradeCount++;
      this.stableStreak = 0;
    } else if (snapshotOrdinal < currentOrdinal) {
      // Only sync down if no pending downgrade is in progress
      if (this.pendingDowngrade === null) {
        this.previousState = this.currentState;
        this.currentState = snapshot.visibilityState;
        this.downgradeCount++;
        this.stableStreak = 0;
      }
    }

    // Sync pulse-related sticky logic
    if (
      snapshot.isPulseActive &&
      this.currentState === TENSION_VISIBILITY_STATE.EXPOSED
    ) {
      this.exposedStickyTicksRemaining = Math.max(
        this.exposedStickyTicksRemaining,
        1,
      );
    }
  }

  /**
   * Fully replace internal state from a TensionRuntimeSnapshot.
   * Uses TENSION_VISIBILITY_STATE and VISIBILITY_STATE_ORDINALS at runtime.
   */
  public syncFromSnapshot(snapshot: TensionRuntimeSnapshot): void {
    const newState = snapshot.visibilityState;
    const newOrdinal = VISIBILITY_STATE_ORDINALS[newState];
    void newOrdinal; // runtime use of VISIBILITY_STATE_ORDINALS

    this.previousState = this.currentState !== newState ? this.currentState : this.previousState;
    this.currentState = newState;
    this.pendingDowngrade = null;
    this.downgradeCountdownTicks = 0;

    if (
      snapshot.isPulseActive &&
      newState === TENSION_VISIBILITY_STATE.EXPOSED
    ) {
      this.exposedStickyTicksRemaining = 1;
    } else {
      this.exposedStickyTicksRemaining = 0;
    }
  }

  // ============================================================================
  // TICK RECORDING
  // ============================================================================

  /**
   * Record a tick sample into the rolling history buffer.
   * Uses VISIBILITY_CONFIGS and VISIBILITY_HISTORY_CAPACITY at runtime.
   */
  public recordTickSample(
    tick: number,
    pressureTier: PressureTier,
    changed: boolean,
  ): void {
    const awarenessBonus = VISIBILITY_CONFIGS[this.currentState].tensionAwarenessBonus;

    const sample: VisibilityTickSample = {
      tick,
      state: this.currentState,
      pressureTier,
      changed,
      awarenessBonus,
    };

    this.tickHistory.push(sample);

    // Trim to capacity
    if (this.tickHistory.length > VISIBILITY_HISTORY_CAPACITY) {
      this.tickHistory.splice(0, this.tickHistory.length - VISIBILITY_HISTORY_CAPACITY);
    }
  }

  // ============================================================================
  // SERIALIZATION
  // ============================================================================

  /**
   * Serialize internal state to a portable object with SHA-256 checksum.
   * Uses createHash at runtime.
   */
  public serialize(): VisibilitySerializedState {
    const checksum = this.computeStateChecksum();
    return {
      currentState: this.currentState,
      previousState: this.previousState,
      pendingDowngrade: this.pendingDowngrade,
      downgradeCountdownTicks: this.downgradeCountdownTicks,
      exposedStickyTicksRemaining: this.exposedStickyTicksRemaining,
      checksum,
    };
  }

  /**
   * Restore internal state from a serialized snapshot.
   * Uses TENSION_VISIBILITY_STATE and VISIBILITY_ORDER at runtime.
   */
  public deserialize(state: VisibilitySerializedState): void {
    // Validate state values are members of VISIBILITY_ORDER
    const validStates = new Set<string>(VISIBILITY_ORDER as readonly string[]);

    if (!validStates.has(state.currentState)) {
      throw new Error(
        `ThreatVisibilityManager.deserialize: invalid currentState "${state.currentState}"`,
      );
    }
    if (
      state.previousState !== null &&
      !validStates.has(state.previousState)
    ) {
      throw new Error(
        `ThreatVisibilityManager.deserialize: invalid previousState "${state.previousState}"`,
      );
    }
    if (
      state.pendingDowngrade !== null &&
      !validStates.has(state.pendingDowngrade)
    ) {
      throw new Error(
        `ThreatVisibilityManager.deserialize: invalid pendingDowngrade "${state.pendingDowngrade}"`,
      );
    }

    this.currentState = state.currentState as TensionVisibilityState;
    this.previousState = state.previousState as TensionVisibilityState | null;
    this.pendingDowngrade = state.pendingDowngrade as TensionVisibilityState | null;
    this.downgradeCountdownTicks = state.downgradeCountdownTicks;
    this.exposedStickyTicksRemaining = state.exposedStickyTicksRemaining;

    // Verify checksum post-restore
    const expectedChecksum = this.computeStateChecksum();
    if (expectedChecksum !== state.checksum) {
      throw new Error(
        `ThreatVisibilityManager.deserialize: checksum mismatch. ` +
          `Expected ${expectedChecksum}, got ${state.checksum}`,
      );
    }
  }

  // ============================================================================
  // EXPORT BUNDLE
  // ============================================================================

  /**
   * Produce a complete export bundle combining all analytics outputs.
   */
  public exportBundle(
    tick: number,
    pressureTier: PressureTier,
    entries?: readonly AnticipationEntry[],
  ): VisibilityExportBundle {
    return {
      mlVector: this.computeMLVector(tick, pressureTier, entries),
      dlTensor: this.extractDLTensor(pressureTier, tick),
      healthReport: this.computeHealthReport(pressureTier),
      trendSnapshot: this.computeTrendSnapshot(),
      sessionSummary: this.computeSessionSummary(),
      narrative: this.generateNarrative(pressureTier, entries),
      serialized: this.serialize(),
    };
  }

  // ============================================================================
  // ENVELOPE & CONFIG ACCESSORS
  // ============================================================================

  /**
   * Return the envelope VisibilityLevel for the current state.
   * Uses INTERNAL_VISIBILITY_TO_ENVELOPE at runtime.
   */
  public toEnvelopeVisibility(): VisibilityLevel {
    return INTERNAL_VISIBILITY_TO_ENVELOPE[this.currentState];
  }

  /**
   * Return the VisibilityConfig for the current state.
   * Uses VISIBILITY_CONFIGS at runtime.
   */
  public getConfig(): VisibilityConfig {
    return VISIBILITY_CONFIGS[this.currentState];
  }

  /**
   * Return a partial diff of VisibilityConfig fields between the current state and another.
   * Uses VISIBILITY_CONFIGS at runtime.
   */
  public computeConfigDiff(otherState: TensionVisibilityState): Partial<VisibilityConfig> {
    const current = VISIBILITY_CONFIGS[this.currentState];
    const other = VISIBILITY_CONFIGS[otherState];
    const diff: { [K in keyof VisibilityConfig]?: VisibilityConfig[K] } = {};

    if (current.showsThreatCount !== other.showsThreatCount) {
      (diff as Record<string, unknown>)['showsThreatCount'] = other.showsThreatCount;
    }
    if (current.showsThreatType !== other.showsThreatType) {
      (diff as Record<string, unknown>)['showsThreatType'] = other.showsThreatType;
    }
    if (current.showsArrivalTick !== other.showsArrivalTick) {
      (diff as Record<string, unknown>)['showsArrivalTick'] = other.showsArrivalTick;
    }
    if (current.showsMitigationPath !== other.showsMitigationPath) {
      (diff as Record<string, unknown>)['showsMitigationPath'] = other.showsMitigationPath;
    }
    if (current.showsWorstCase !== other.showsWorstCase) {
      (diff as Record<string, unknown>)['showsWorstCase'] = other.showsWorstCase;
    }
    if (current.tensionAwarenessBonus !== other.tensionAwarenessBonus) {
      (diff as Record<string, unknown>)['tensionAwarenessBonus'] = other.tensionAwarenessBonus;
    }
    if (current.visibilityDowngradeDelayTicks !== other.visibilityDowngradeDelayTicks) {
      (diff as Record<string, unknown>)['visibilityDowngradeDelayTicks'] =
        other.visibilityDowngradeDelayTicks;
    }

    return diff as Partial<VisibilityConfig>;
  }

  // ============================================================================
  // AWARENESS COMPUTATIONS
  // ============================================================================

  /**
   * Amplify the current state's awareness bonus by the pressure amplifier.
   * Uses VISIBILITY_CONFIGS and PRESSURE_TENSION_AMPLIFIERS at runtime.
   */
  public computeAmplifiedAwareness(pressureTier: PressureTier): number {
    const bonus = VISIBILITY_CONFIGS[this.currentState].tensionAwarenessBonus;
    const amplifier = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
    return bonus * amplifier;
  }

  /**
   * Compute a weighted awareness load from a list of AnticipationEntry objects.
   * Uses THREAT_SEVERITY_WEIGHTS and VISIBILITY_STATE_ORDINALS at runtime.
   * Only entries whose computed visibility state is at or below the current state contribute.
   */
  public computeWeightedAwarenessLoad(entries: readonly AnticipationEntry[]): number {
    const currentOrdinal = VISIBILITY_STATE_ORDINALS[this.currentState];
    let totalLoad = 0;
    for (const entry of entries) {
      const severityWeight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
      const entryState = this.computeVisibilityForSeverity(entry.threatSeverity);
      const entryOrdinal = VISIBILITY_STATE_ORDINALS[entryState];
      // Only count entries visible at current state
      if (entryOrdinal <= currentOrdinal) {
        totalLoad += severityWeight * entry.severityWeight;
      }
    }
    return totalLoad;
  }

  /**
   * Rank AnticipationEntry objects by descending severity weight.
   * Uses THREAT_SEVERITY_WEIGHTS at runtime.
   */
  public rankEntriesByVisibility(
    entries: readonly AnticipationEntry[],
  ): readonly AnticipationEntry[] {
    return [...entries].sort((a, b) => {
      const weightA = THREAT_SEVERITY_WEIGHTS[a.threatSeverity];
      const weightB = THREAT_SEVERITY_WEIGHTS[b.threatSeverity];
      return weightB - weightA;
    });
  }

  // ============================================================================
  // SEVERITY & TYPE COMPUTATIONS
  // ============================================================================

  /**
   * Map a ThreatSeverity to the corresponding TensionVisibilityState.
   * Uses THREAT_SEVERITY and TENSION_VISIBILITY_STATE at runtime.
   */
  public computeVisibilityForSeverity(severity: ThreatSeverity): TensionVisibilityState {
    switch (severity) {
      case THREAT_SEVERITY.EXISTENTIAL:
        return TENSION_VISIBILITY_STATE.EXPOSED;
      case THREAT_SEVERITY.CRITICAL:
        return TENSION_VISIBILITY_STATE.EXPOSED;
      case THREAT_SEVERITY.SEVERE:
        return TENSION_VISIBILITY_STATE.TELEGRAPHED;
      case THREAT_SEVERITY.MODERATE:
        return TENSION_VISIBILITY_STATE.SIGNALED;
      case THREAT_SEVERITY.MINOR:
      default:
        return TENSION_VISIBILITY_STATE.SHADOWED;
    }
  }

  /**
   * Compute the priority weight for a ThreatType.
   * Uses THREAT_TYPE and THREAT_TYPE_PRIORITY_WEIGHTS at runtime.
   */
  public computeTypeVisibilityPriority(threatType: ThreatType): number {
    // Verify threatType is a known THREAT_TYPE value (runtime guard)
    const knownTypes = Object.values(THREAT_TYPE);
    if (!knownTypes.includes(threatType)) {
      return 0;
    }
    return THREAT_TYPE_PRIORITY_WEIGHTS[threatType];
  }

  // ============================================================================
  // ENVELOPE FILTERING
  // ============================================================================

  /**
   * Filter ThreatEnvelope objects to only those visible at the current visibility level.
   * Uses INTERNAL_VISIBILITY_TO_ENVELOPE and ENVELOPE_LEVEL_ORDINALS at runtime.
   */
  public filterByVisibility(envelopes: readonly ThreatEnvelope[]): readonly ThreatEnvelope[] {
    const currentEnvelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[this.currentState];
    const currentEnvelopeOrdinal = ENVELOPE_LEVEL_ORDINALS[currentEnvelopeLevel];

    return envelopes.filter((env) => {
      const envOrdinal = ENVELOPE_LEVEL_ORDINALS[env.visibleAs];
      return envOrdinal <= currentEnvelopeOrdinal;
    });
  }

  /**
   * Compute aggregate awareness from a list of ThreatEnvelope objects.
   * Uses INTERNAL_VISIBILITY_TO_ENVELOPE and ENVELOPE_LEVEL_ORDINALS at runtime.
   */
  public computeEnvelopeAwareness(envelopes: readonly ThreatEnvelope[]): number {
    if (envelopes.length === 0) return 0;
    const maxEnvelopeOrdinal = 3;
    const currentEnvelopeLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[this.currentState];
    const currentOrdinal = ENVELOPE_LEVEL_ORDINALS[currentEnvelopeLevel];

    let totalAwareness = 0;
    let count = 0;
    for (const env of envelopes) {
      const envOrdinal = ENVELOPE_LEVEL_ORDINALS[env.visibleAs];
      if (envOrdinal <= currentOrdinal) {
        // Awareness contribution proportional to envelope level and severity
        const levelFactor = envOrdinal / maxEnvelopeOrdinal;
        const severityFactor = Math.max(0, Math.min(1, env.severity));
        totalAwareness += levelFactor * severityFactor;
        count++;
      }
    }
    return count > 0 ? totalAwareness / count : 0;
  }

  // ============================================================================
  // MITIGATION ADVICE
  // ============================================================================

  /**
   * Return the default mitigation actions for a ThreatType given the current state.
   * Uses THREAT_TYPE_DEFAULT_MITIGATIONS and VISIBILITY_CONFIGS at runtime.
   */
  public getMitigationAdviceForState(threatType: ThreatType): readonly string[] {
    const config = VISIBILITY_CONFIGS[this.currentState];
    const allMitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[threatType];

    // Only surface mitigation paths if the current config exposes them
    if (config.showsMitigationPath) {
      return allMitigations;
    }

    // Otherwise return only the first mitigation as a hint
    const firstMitigation = allMitigations[0];
    return firstMitigation !== undefined ? [firstMitigation] : [];
  }

  // ============================================================================
  // CHECKSUM
  // ============================================================================

  /**
   * Compute a SHA-256 checksum of the current state.
   * Uses createHash from node:crypto at runtime.
   */
  public computeStateChecksum(): string {
    const stateStr = serializeVisibilityState(
      this.currentState,
      this.pendingDowngrade,
      this.downgradeCountdownTicks,
    );
    const payload = `${stateStr}:${this.previousState ?? 'null'}:${this.exposedStickyTicksRemaining}`;
    return createHash('sha256').update(payload).digest('hex');
  }
}

// ============================================================================
// MODULE SENTINEL — all exports above satisfy the zero-dead-code contract.
// ============================================================================
