import { createHash } from 'node:crypto';
/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION ENGINE TYPES
 * /backend/src/game/engine/tension/types.ts
 * ====================================================================== */

import type {
  PressureTier,
  ThreatEnvelope,
  VisibilityLevel,
} from '../core/GamePrimitives';

export type { PressureTier, ThreatEnvelope, VisibilityLevel } from '../core/GamePrimitives';

export const TENSION_VISIBILITY_STATE = {
  SHADOWED: 'SHADOWED',
  SIGNALED: 'SIGNALED',
  TELEGRAPHED: 'TELEGRAPHED',
  EXPOSED: 'EXPOSED',
} as const;

export type TensionVisibilityState =
  (typeof TENSION_VISIBILITY_STATE)[keyof typeof TENSION_VISIBILITY_STATE];

export const THREAT_TYPE = {
  DEBT_SPIRAL: 'DEBT_SPIRAL',
  SABOTAGE: 'SABOTAGE',
  HATER_INJECTION: 'HATER_INJECTION',
  CASCADE: 'CASCADE',
  SOVEREIGNTY: 'SOVEREIGNTY',
  OPPORTUNITY_KILL: 'OPPORTUNITY_KILL',
  REPUTATION_BURN: 'REPUTATION_BURN',
  SHIELD_PIERCE: 'SHIELD_PIERCE',
} as const;

export type ThreatType = (typeof THREAT_TYPE)[keyof typeof THREAT_TYPE];

export const THREAT_SEVERITY = {
  MINOR: 'MINOR',
  MODERATE: 'MODERATE',
  SEVERE: 'SEVERE',
  CRITICAL: 'CRITICAL',
  EXISTENTIAL: 'EXISTENTIAL',
} as const;

export type ThreatSeverity =
  (typeof THREAT_SEVERITY)[keyof typeof THREAT_SEVERITY];

export const ENTRY_STATE = {
  QUEUED: 'QUEUED',
  ARRIVED: 'ARRIVED',
  MITIGATED: 'MITIGATED',
  EXPIRED: 'EXPIRED',
  NULLIFIED: 'NULLIFIED',
} as const;

export type EntryState = (typeof ENTRY_STATE)[keyof typeof ENTRY_STATE];

export interface VisibilityConfig {
  readonly state: TensionVisibilityState;
  readonly pressureThreshold: PressureTier;
  readonly showsThreatCount: boolean;
  readonly showsThreatType: boolean;
  readonly showsArrivalTick: boolean;
  readonly showsMitigationPath: boolean;
  readonly showsWorstCase: boolean;
  readonly tensionAwarenessBonus: number;
  readonly visibilityDowngradeDelayTicks: number;
}

export const VISIBILITY_CONFIGS: Readonly<
  Record<TensionVisibilityState, VisibilityConfig>
> = {
  [TENSION_VISIBILITY_STATE.SHADOWED]: {
    state: TENSION_VISIBILITY_STATE.SHADOWED,
    pressureThreshold: 'T0',
    showsThreatCount: true,
    showsThreatType: false,
    showsArrivalTick: false,
    showsMitigationPath: false,
    showsWorstCase: false,
    tensionAwarenessBonus: 0,
    visibilityDowngradeDelayTicks: 0,
  },
  [TENSION_VISIBILITY_STATE.SIGNALED]: {
    state: TENSION_VISIBILITY_STATE.SIGNALED,
    pressureThreshold: 'T1',
    showsThreatCount: true,
    showsThreatType: true,
    showsArrivalTick: false,
    showsMitigationPath: false,
    showsWorstCase: false,
    tensionAwarenessBonus: 0,
    visibilityDowngradeDelayTicks: 2,
  },
  [TENSION_VISIBILITY_STATE.TELEGRAPHED]: {
    state: TENSION_VISIBILITY_STATE.TELEGRAPHED,
    pressureThreshold: 'T2',
    showsThreatCount: true,
    showsThreatType: true,
    showsArrivalTick: true,
    showsMitigationPath: false,
    showsWorstCase: false,
    tensionAwarenessBonus: 0.05,
    visibilityDowngradeDelayTicks: 2,
  },
  [TENSION_VISIBILITY_STATE.EXPOSED]: {
    state: TENSION_VISIBILITY_STATE.EXPOSED,
    pressureThreshold: 'T4',
    showsThreatCount: true,
    showsThreatType: true,
    showsArrivalTick: true,
    showsMitigationPath: true,
    showsWorstCase: true,
    tensionAwarenessBonus: 0.05,
    visibilityDowngradeDelayTicks: 2,
  },
} as const;

export const PRESSURE_TENSION_AMPLIFIERS: Readonly<Record<PressureTier, number>> = {
  T0: 1.0,
  T1: 1.1,
  T2: 1.2,
  T3: 1.35,
  T4: 1.5,
} as const;

export const TENSION_CONSTANTS = {
  QUEUED_TENSION_PER_TICK: 0.12,
  ARRIVED_TENSION_PER_TICK: 0.2,
  EXPIRED_GHOST_PER_TICK: 0.08,
  MITIGATION_DECAY_PER_TICK: 0.08,
  MITIGATION_DECAY_TICKS: 3,
  NULLIFY_DECAY_PER_TICK: 0.04,
  NULLIFY_DECAY_TICKS: 3,
  EMPTY_QUEUE_DECAY: 0.05,
  SOVEREIGNTY_BONUS_DECAY: 0.15,
  PULSE_THRESHOLD: 0.9,
  PULSE_SUSTAINED_TICKS: 3,
  MIN_SCORE: 0,
  MAX_SCORE: 1,
} as const;

export const THREAT_SEVERITY_WEIGHTS: Readonly<Record<ThreatSeverity, number>> = {
  [THREAT_SEVERITY.MINOR]: 0.2,
  [THREAT_SEVERITY.MODERATE]: 0.4,
  [THREAT_SEVERITY.SEVERE]: 0.65,
  [THREAT_SEVERITY.CRITICAL]: 0.85,
  [THREAT_SEVERITY.EXISTENTIAL]: 1.0,
} as const;

export const THREAT_TYPE_DEFAULT_MITIGATIONS: Readonly<
  Record<ThreatType, readonly string[]>
> = {
  [THREAT_TYPE.DEBT_SPIRAL]: Object.freeze([
    'REFINANCE',
    'INCOME_SHIELD',
    'CASH_BUFFER',
  ]),
  [THREAT_TYPE.SABOTAGE]: Object.freeze([
    'COUNTER_PLAY',
    'PR_SHIELD',
    'LEGAL_DEFENSE',
  ]),
  [THREAT_TYPE.HATER_INJECTION]: Object.freeze([
    'BLOCK',
    'PURGE',
    'COUNTER_INTEL',
  ]),
  [THREAT_TYPE.CASCADE]: Object.freeze([
    'STABILIZE',
    'PATCH',
    'CONTAIN',
  ]),
  [THREAT_TYPE.SOVEREIGNTY]: Object.freeze([
    'TRUST_LOCK',
    'LEGAL_SHIELD',
    'SOVEREIGN_RESET',
  ]),
  [THREAT_TYPE.OPPORTUNITY_KILL]: Object.freeze([
    'RECOVER_OPPORTUNITY',
    'INSURE_UPSIDE',
  ]),
  [THREAT_TYPE.REPUTATION_BURN]: Object.freeze([
    'PR_SHIELD',
    'REPUTATION_WASH',
  ]),
  [THREAT_TYPE.SHIELD_PIERCE]: Object.freeze([
    'HARDEN',
    'REPAIR',
    'ABSORB',
  ]),
} as const;

export const INTERNAL_VISIBILITY_TO_ENVELOPE: Readonly<
  Record<TensionVisibilityState, VisibilityLevel>
> = {
  [TENSION_VISIBILITY_STATE.SHADOWED]: 'HIDDEN',
  [TENSION_VISIBILITY_STATE.SIGNALED]: 'SILHOUETTE',
  [TENSION_VISIBILITY_STATE.TELEGRAPHED]: 'PARTIAL',
  [TENSION_VISIBILITY_STATE.EXPOSED]: 'EXPOSED',
} as const;

export const VISIBILITY_ORDER: readonly TensionVisibilityState[] = Object.freeze([
  TENSION_VISIBILITY_STATE.SHADOWED,
  TENSION_VISIBILITY_STATE.SIGNALED,
  TENSION_VISIBILITY_STATE.TELEGRAPHED,
  TENSION_VISIBILITY_STATE.EXPOSED,
]);

export const TENSION_EVENT_NAMES = {
  UPDATED_LEGACY: 'tension.updated',
  SCORE_UPDATED: 'tension.score.updated',
  VISIBILITY_CHANGED: 'tension.visibility.changed',
  QUEUE_UPDATED: 'tension.queue.updated',
  PULSE_FIRED: 'tension.pulse',
  THREAT_ARRIVED: 'tension.threat.arrived',
  THREAT_MITIGATED: 'tension.threat.mitigated',
  THREAT_EXPIRED: 'tension.threat.expired',
} as const;

export interface AnticipationEntry {
  readonly entryId: string;
  readonly runId: string;
  readonly sourceKey: string;
  readonly threatId: string;
  readonly source: string;
  readonly threatType: ThreatType;
  readonly threatSeverity: ThreatSeverity;
  readonly enqueuedAtTick: number;
  readonly arrivalTick: number;
  readonly isCascadeTriggered: boolean;
  readonly cascadeTriggerEventId: string | null;
  readonly worstCaseOutcome: string;
  readonly mitigationCardTypes: readonly string[];
  readonly baseTensionPerTick: number;
  readonly severityWeight: number;
  readonly summary: string;
  state: EntryState;
  isArrived: boolean;
  isMitigated: boolean;
  isExpired: boolean;
  isNullified: boolean;
  mitigatedAtTick: number | null;
  expiredAtTick: number | null;
  ticksOverdue: number;
  decayTicksRemaining: number;
}

export interface QueueUpsertInput {
  readonly runId: string;
  readonly sourceKey: string;
  readonly threatId: string;
  readonly source: string;
  readonly threatType: ThreatType;
  readonly threatSeverity: ThreatSeverity;
  readonly currentTick: number;
  readonly arrivalTick: number;
  readonly isCascadeTriggered: boolean;
  readonly cascadeTriggerEventId: string | null;
  readonly worstCaseOutcome: string;
  readonly mitigationCardTypes: readonly string[];
  readonly summary: string;
  readonly severityWeight?: number;
}

export interface QueueProcessResult {
  readonly newArrivals: readonly AnticipationEntry[];
  readonly newExpirations: readonly AnticipationEntry[];
  readonly activeEntries: readonly AnticipationEntry[];
  readonly relievedEntries: readonly AnticipationEntry[];
}

export interface DecayComputeInput {
  readonly activeEntries: readonly AnticipationEntry[];
  readonly expiredEntries: readonly AnticipationEntry[];
  readonly relievedEntries: readonly AnticipationEntry[];
  readonly pressureTier: PressureTier;
  readonly visibilityAwarenessBonus: number;
  readonly queueIsEmpty: boolean;
  readonly sovereigntyMilestoneReached: boolean;
}

export interface DecayContributionBreakdown {
  readonly queuedThreats: number;
  readonly arrivedThreats: number;
  readonly expiredGhosts: number;
  readonly mitigationDecay: number;
  readonly nullifyDecay: number;
  readonly emptyQueueBonus: number;
  readonly visibilityBonus: number;
  readonly sovereigntyBonus: number;
}

export interface DecayComputeResult {
  readonly rawDelta: number;
  readonly amplifiedDelta: number;
  readonly contributionBreakdown: DecayContributionBreakdown;
}

export interface TensionRuntimeSnapshot {
  readonly score: number;
  readonly previousScore: number;
  readonly rawDelta: number;
  readonly amplifiedDelta: number;
  readonly visibilityState: TensionVisibilityState;
  readonly queueLength: number;
  readonly arrivedCount: number;
  readonly queuedCount: number;
  readonly expiredCount: number;
  readonly relievedCount: number;
  readonly visibleThreats: readonly ThreatEnvelope[];
  readonly isPulseActive: boolean;
  readonly pulseTicksActive: number;
  readonly isEscalating: boolean;
  readonly dominantEntryId: string | null;
  readonly lastSpikeTick: number | null;
  readonly tickNumber: number;
  readonly timestamp: number;
  readonly contributionBreakdown: DecayContributionBreakdown;
}

export interface TensionScoreUpdatedEvent {
  readonly eventType: 'TENSION_SCORE_UPDATED';
  readonly score: number;
  readonly previousScore: number;
  readonly rawDelta: number;
  readonly amplifiedDelta: number;
  readonly visibilityState: TensionVisibilityState;
  readonly queueLength: number;
  readonly arrivedCount: number;
  readonly queuedCount: number;
  readonly expiredCount: number;
  readonly dominantEntryId: string | null;
  readonly tickNumber: number;
  readonly timestamp: number;
}

export interface TensionVisibilityChangedEvent {
  readonly eventType: 'TENSION_VISIBILITY_CHANGED';
  readonly from: TensionVisibilityState;
  readonly to: TensionVisibilityState;
  readonly tickNumber: number;
  readonly timestamp: number;
}

export interface TensionPulseFiredEvent {
  readonly eventType: 'TENSION_PULSE_FIRED';
  readonly score: number;
  readonly queueLength: number;
  readonly pulseTicksActive: number;
  readonly tickNumber: number;
  readonly timestamp: number;
}

export interface ThreatArrivedEvent {
  readonly eventType: 'THREAT_ARRIVED';
  readonly entryId: string;
  readonly threatType: ThreatType;
  readonly threatSeverity: ThreatSeverity;
  readonly source: string;
  readonly worstCaseOutcome: string;
  readonly mitigationCardTypes: readonly string[];
  readonly tickNumber: number;
  readonly timestamp: number;
}

export interface ThreatMitigatedEvent {
  readonly eventType: 'THREAT_MITIGATED';
  readonly entryId: string;
  readonly threatType: ThreatType;
  readonly tickNumber: number;
  readonly timestamp: number;
}

export interface ThreatExpiredEvent {
  readonly eventType: 'THREAT_EXPIRED';
  readonly entryId: string;
  readonly threatType: ThreatType;
  readonly threatSeverity: ThreatSeverity;
  readonly ticksOverdue: number;
  readonly tickNumber: number;
  readonly timestamp: number;
}

export interface AnticipationQueueUpdatedEvent {
  readonly eventType: 'ANTICIPATION_QUEUE_UPDATED';
  readonly queueLength: number;
  readonly arrivedCount: number;
  readonly queuedCount: number;
  readonly expiredCount: number;
  readonly tickNumber: number;
  readonly timestamp: number;
}

export type TensionEventMap = {
  [TENSION_EVENT_NAMES.UPDATED_LEGACY]: TensionRuntimeSnapshot;
  [TENSION_EVENT_NAMES.SCORE_UPDATED]: TensionScoreUpdatedEvent;
  [TENSION_EVENT_NAMES.VISIBILITY_CHANGED]: TensionVisibilityChangedEvent;
  [TENSION_EVENT_NAMES.QUEUE_UPDATED]: AnticipationQueueUpdatedEvent;
  [TENSION_EVENT_NAMES.PULSE_FIRED]: TensionPulseFiredEvent;
  [TENSION_EVENT_NAMES.THREAT_ARRIVED]: ThreatArrivedEvent;
  [TENSION_EVENT_NAMES.THREAT_MITIGATED]: ThreatMitigatedEvent;
  [TENSION_EVENT_NAMES.THREAT_EXPIRED]: ThreatExpiredEvent;
};

/* SECTION A — TYPE GUARDS */

/** Checks whether an unknown value is a valid TensionVisibilityState. */
export function isTensionVisibilityState(v: unknown): v is TensionVisibilityState {
  return (
    typeof v === 'string' &&
    (Object.values(TENSION_VISIBILITY_STATE) as string[]).includes(v)
  );
}

/** Checks whether an unknown value is a valid ThreatType. */
export function isThreatType(v: unknown): v is ThreatType {
  return (
    typeof v === 'string' &&
    (Object.values(THREAT_TYPE) as string[]).includes(v)
  );
}

/** Checks whether an unknown value is a valid ThreatSeverity. */
export function isThreatSeverity(v: unknown): v is ThreatSeverity {
  return (
    typeof v === 'string' &&
    (Object.values(THREAT_SEVERITY) as string[]).includes(v)
  );
}

/** Checks whether an unknown value is a valid EntryState. */
export function isEntryState(v: unknown): v is EntryState {
  return (
    typeof v === 'string' &&
    (Object.values(ENTRY_STATE) as string[]).includes(v)
  );
}

/** Returns true if the given EntryState represents an active (non-terminal) entry. */
export function isActiveEntryState(state: EntryState): boolean {
  return state === ENTRY_STATE.QUEUED || state === ENTRY_STATE.ARRIVED;
}

/** Returns true if the given EntryState is a terminal state (no further transitions). */
export function isTerminalEntryState(state: EntryState): boolean {
  return (
    state === ENTRY_STATE.MITIGATED ||
    state === ENTRY_STATE.EXPIRED ||
    state === ENTRY_STATE.NULLIFIED
  );
}

/** Returns true if the given EntryState is a decaying state. */
export function isDecayingEntryState(state: EntryState): boolean {
  return (
    state === ENTRY_STATE.MITIGATED ||
    state === ENTRY_STATE.EXPIRED ||
    state === ENTRY_STATE.NULLIFIED
  );
}

/* SECTION B — ENTRY STATE PREDICATES */

/** Returns true if the entry is currently active (QUEUED or ARRIVED). */
export function entryIsActive(entry: AnticipationEntry): boolean {
  return isActiveEntryState(entry.state);
}

/** Returns true if the entry has reached a terminal state. */
export function entryIsTerminal(entry: AnticipationEntry): boolean {
  return isTerminalEntryState(entry.state);
}

/** Returns true if the entry is currently contributing to tension accumulation. */
export function entryContributesToTension(entry: AnticipationEntry): boolean {
  return entry.state === ENTRY_STATE.QUEUED || entry.state === ENTRY_STATE.ARRIVED;
}

/** Returns true if the entry is in a decaying state with remaining decay ticks. */
export function entryIsDecaying(entry: AnticipationEntry): boolean {
  return isDecayingEntryState(entry.state) && entry.decayTicksRemaining > 0;
}

/** Computes the number of ticks until this entry arrives at the given currentTick. */
export function entryTicksUntilArrival(
  entry: AnticipationEntry,
  currentTick: number,
): number {
  return Math.max(0, entry.arrivalTick - currentTick);
}

/** Returns true if the entry has passed its arrivalTick without being mitigated */
export function entryIsOverdue(
  entry: AnticipationEntry,
  currentTick: number,
): boolean {
  return currentTick > entry.arrivalTick && entry.state !== ENTRY_STATE.QUEUED;
}

/** Computes how far through the anticipation window this entry is, as a */
export function entryProgressPercent(
  entry: AnticipationEntry,
  currentTick: number,
): number {
  const window = entry.arrivalTick - entry.enqueuedAtTick;
  if (window <= 0) return 100;
  const elapsed = currentTick - entry.enqueuedAtTick;
  return Math.min(100, Math.max(0, (elapsed / window) * 100));
}

/** Computes an urgency score (0-1) for the entry at the given currentTick. */
export function entryUrgencyScore(
  entry: AnticipationEntry,
  currentTick: number,
): number {
  const weight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
  const progress = entryProgressPercent(entry, currentTick) / 100;
  return weight * progress;
}

/** Returns true if the entry is still awaiting its arrival (state is QUEUED). */
export function entryAwaitsArrival(entry: AnticipationEntry): boolean {
  return entry.state === ENTRY_STATE.QUEUED;
}

/** Returns true if the entry has at least one mitigation card type available. */
export function entryHasMitigationOptions(entry: AnticipationEntry): boolean {
  return entry.mitigationCardTypes.length > 0;
}

/* SECTION C — THREAT SEVERITY UTILITIES */

/** Returns the numeric weight associated with a ThreatSeverity value. */
export function severityToWeight(severity: ThreatSeverity): number {
  return THREAT_SEVERITY_WEIGHTS[severity];
}

/** Returns a human-readable display label for the given ThreatSeverity. */
export function severityToLabel(severity: ThreatSeverity): string {
  switch (severity) {
    case THREAT_SEVERITY.MINOR:
      return 'Minor Threat';
    case THREAT_SEVERITY.MODERATE:
      return 'Moderate Threat';
    case THREAT_SEVERITY.SEVERE:
      return 'Severe Threat';
    case THREAT_SEVERITY.CRITICAL:
      return 'Critical Threat';
    case THREAT_SEVERITY.EXISTENTIAL:
      return 'Existential Threat';
  }
}

/** Returns the ordinal rank of a ThreatSeverity for comparison. */
export function severityToOrdinal(severity: ThreatSeverity): number {
  switch (severity) {
    case THREAT_SEVERITY.MINOR:
      return 1;
    case THREAT_SEVERITY.MODERATE:
      return 2;
    case THREAT_SEVERITY.SEVERE:
      return 3;
    case THREAT_SEVERITY.CRITICAL:
      return 4;
    case THREAT_SEVERITY.EXISTENTIAL:
      return 5;
  }
}

/** Converts an ordinal (1-5) back to a ThreatSeverity enum value. */
export function ordinalToSeverity(ordinal: number): ThreatSeverity {
  switch (ordinal) {
    case 1:
      return THREAT_SEVERITY.MINOR;
    case 2:
      return THREAT_SEVERITY.MODERATE;
    case 3:
      return THREAT_SEVERITY.SEVERE;
    case 4:
      return THREAT_SEVERITY.CRITICAL;
    case 5:
      return THREAT_SEVERITY.EXISTENTIAL;
    default:
      throw new RangeError(`ordinalToSeverity: ordinal ${ordinal} out of range [1, 5]`);
  }
}

/** Compares two ThreatSeverity values. */
export function compareSeverities(a: ThreatSeverity, b: ThreatSeverity): -1 | 0 | 1 {
  const oa = severityToOrdinal(a);
  const ob = severityToOrdinal(b);
  if (oa < ob) return -1;
  if (oa > ob) return 1;
  return 0;
}

/** Returns the highest ThreatSeverity from a non-empty array. */
export function maxSeverity(severities: ThreatSeverity[]): ThreatSeverity {
  if (severities.length === 0) throw new RangeError('maxSeverity: empty array');
  return severities.reduce((acc, s) => (compareSeverities(s, acc) > 0 ? s : acc));
}

/** Returns the lowest ThreatSeverity from a non-empty array. */
export function minSeverity(severities: ThreatSeverity[]): ThreatSeverity {
  if (severities.length === 0) throw new RangeError('minSeverity: empty array');
  return severities.reduce((acc, s) => (compareSeverities(s, acc) < 0 ? s : acc));
}

/** Computes the average severity weight across all provided entries. */
export function averageSeverityWeight(entries: AnticipationEntry[]): number {
  if (entries.length === 0) return 0;
  const total = entries.reduce(
    (sum, e) => sum + THREAT_SEVERITY_WEIGHTS[e.threatSeverity],
    0,
  );
  return total / entries.length;
}

/** Returns the ThreatSeverity that appears most frequently in the entry array. */
export function dominantSeverity(entries: AnticipationEntry[]): ThreatSeverity {
  if (entries.length === 0) return THREAT_SEVERITY.MINOR;
  const counts: Partial<Record<ThreatSeverity, number>> = {};
  for (const e of entries) {
    counts[e.threatSeverity] = (counts[e.threatSeverity] ?? 0) + 1;
  }
  let best: ThreatSeverity = THREAT_SEVERITY.MINOR;
  let bestCount = 0;
  for (const [sev, count] of Object.entries(counts) as [ThreatSeverity, number][]) {
    if (
      count > bestCount ||
      (count === bestCount && compareSeverities(sev, best) > 0)
    ) {
      best = sev;
      bestCount = count;
    }
  }
  return best;
}

/** Returns the sum of all severity weights across the provided entries. */
export function severityWeightedCount(entries: AnticipationEntry[]): number {
  return entries.reduce(
    (sum, e) => sum + THREAT_SEVERITY_WEIGHTS[e.threatSeverity],
    0,
  );
}

/** Returns true if the severity is CRITICAL or EXISTENTIAL. */
export function isCriticalOrExistential(severity: ThreatSeverity): boolean {
  return severity === THREAT_SEVERITY.CRITICAL || severity === THREAT_SEVERITY.EXISTENTIAL;
}

/* SECTION D — THREAT TYPE UTILITIES */

/** Returns the default mitigation card types for a given ThreatType. */
export function defaultMitigationsForType(type: ThreatType): readonly string[] {
  return THREAT_TYPE_DEFAULT_MITIGATIONS[type];
}

/** Returns a human-readable display label for the given ThreatType. */
export function threatTypeToLabel(type: ThreatType): string {
  switch (type) {
    case THREAT_TYPE.DEBT_SPIRAL:
      return 'Debt Spiral';
    case THREAT_TYPE.SABOTAGE:
      return 'Sabotage';
    case THREAT_TYPE.HATER_INJECTION:
      return 'Hater Injection';
    case THREAT_TYPE.CASCADE:
      return 'Cascade Failure';
    case THREAT_TYPE.SOVEREIGNTY:
      return 'Sovereignty Challenge';
    case THREAT_TYPE.OPPORTUNITY_KILL:
      return 'Opportunity Kill';
    case THREAT_TYPE.REPUTATION_BURN:
      return 'Reputation Burn';
    case THREAT_TYPE.SHIELD_PIERCE:
      return 'Shield Pierce';
  }
}

/** Maps each ThreatType to its high-level category. */
export function threatTypeToCategory(
  type: ThreatType,
): 'ECONOMIC' | 'SOCIAL' | 'STRUCTURAL' | 'SYSTEMIC' {
  switch (type) {
    case THREAT_TYPE.DEBT_SPIRAL:
    case THREAT_TYPE.OPPORTUNITY_KILL:
      return 'ECONOMIC';
    case THREAT_TYPE.SABOTAGE:
    case THREAT_TYPE.HATER_INJECTION:
    case THREAT_TYPE.REPUTATION_BURN:
      return 'SOCIAL';
    case THREAT_TYPE.SHIELD_PIERCE:
      return 'STRUCTURAL';
    case THREAT_TYPE.CASCADE:
    case THREAT_TYPE.SOVEREIGNTY:
      return 'SYSTEMIC';
  }
}

/** Returns true if the ThreatType carries cascade or systemic collapse risk. */
export function threatTypeIsCascadeRisk(type: ThreatType): boolean {
  return type === THREAT_TYPE.CASCADE || type === THREAT_TYPE.SOVEREIGNTY;
}

/** Returns true if the ThreatType specifically threatens player sovereignty. */
export function threatTypeIsSovereigntyRisk(type: ThreatType): boolean {
  return type === THREAT_TYPE.SOVEREIGNTY;
}

/** Returns true if the ThreatType represents an economic risk category. */
export function threatTypeIsEconomicRisk(type: ThreatType): boolean {
  return type === THREAT_TYPE.DEBT_SPIRAL || type === THREAT_TYPE.OPPORTUNITY_KILL;
}

/** Returns true if the ThreatType represents a social risk category. */
export function threatTypeIsSocialRisk(type: ThreatType): boolean {
  return (
    type === THREAT_TYPE.SABOTAGE ||
    type === THREAT_TYPE.HATER_INJECTION ||
    type === THREAT_TYPE.REPUTATION_BURN
  );
}

/** Counts entries grouped by ThreatType. Returns a record with counts for */
export function countEntriesByType(
  entries: AnticipationEntry[],
): Record<ThreatType, number> {
  const counts = Object.fromEntries(
    Object.values(THREAT_TYPE).map((t) => [t, 0]),
  ) as Record<ThreatType, number>;
  for (const e of entries) {
    counts[e.threatType] += 1;
  }
  return counts;
}

/** Returns the ThreatType that appears most frequently in the entry array. */
export function dominantThreatType(
  entries: AnticipationEntry[],
): ThreatType | null {
  if (entries.length === 0) return null;
  const counts = countEntriesByType(entries);
  let bestType: ThreatType = THREAT_TYPE.DEBT_SPIRAL;
  let bestCount = -1;
  for (const t of Object.values(THREAT_TYPE) as ThreatType[]) {
    if (counts[t] > bestCount) {
      bestCount = counts[t];
      bestType = t;
    }
  }
  return bestCount > 0 ? bestType : null;
}

/** Returns the total number of mitigation options across all provided entries. */
export function totalMitigationOptions(entries: AnticipationEntry[]): number {
  return entries.reduce((sum, e) => sum + e.mitigationCardTypes.length, 0);
}

/* SECTION E — VISIBILITY STATE UTILITIES */

/** Converts an internal TensionVisibilityState to the canonical VisibilityLevel */
export function visibilityToEnvelopeLevel(
  state: TensionVisibilityState,
): VisibilityLevel {
  return INTERNAL_VISIBILITY_TO_ENVELOPE[state];
}

/** Returns the ordinal index of a TensionVisibilityState within VISIBILITY_ORDER. */
export function visibilityToOrdinal(state: TensionVisibilityState): number {
  return VISIBILITY_ORDER.indexOf(state);
}

/** Converts an ordinal (0-3) back to a TensionVisibilityState. */
export function ordinalToVisibilityState(ordinal: number): TensionVisibilityState {
  const state = VISIBILITY_ORDER[ordinal];
  if (state === undefined) {
    throw new RangeError(
      `ordinalToVisibilityState: ordinal ${ordinal} out of range [0, ${VISIBILITY_ORDER.length - 1}]`,
    );
  }
  return state;
}

/** Returns the next higher TensionVisibilityState in VISIBILITY_ORDER. */
export function nextVisibilityState(
  state: TensionVisibilityState,
): TensionVisibilityState | null {
  const idx = visibilityToOrdinal(state);
  if (idx >= VISIBILITY_ORDER.length - 1) return null;
  return VISIBILITY_ORDER[idx + 1] ?? null;
}

/** Returns the next lower TensionVisibilityState in VISIBILITY_ORDER. */
export function previousVisibilityState(
  state: TensionVisibilityState,
): TensionVisibilityState | null {
  const idx = visibilityToOrdinal(state);
  if (idx <= 0) return null;
  return VISIBILITY_ORDER[idx - 1] ?? null;
}

/** Returns true if visibility state a is higher (more exposed) than b. */
export function isHigherVisibility(
  a: TensionVisibilityState,
  b: TensionVisibilityState,
): boolean {
  return visibilityToOrdinal(a) > visibilityToOrdinal(b);
}

/** Returns the VisibilityConfig for the given TensionVisibilityState. */
export function visibilityConfig(
  state: TensionVisibilityState,
): VisibilityConfig {
  return VISIBILITY_CONFIGS[state];
}

/** Returns the tensionAwarenessBonus for the given TensionVisibilityState. */
export function visibilityAwarenessBonus(state: TensionVisibilityState): number {
  return VISIBILITY_CONFIGS[state].tensionAwarenessBonus;
}

/** Determines the appropriate TensionVisibilityState for a given PressureTier. */
export function visibilityFromPressureTier(
  tier: PressureTier,
): TensionVisibilityState {
  switch (tier) {
    case 'T0':
      return TENSION_VISIBILITY_STATE.SHADOWED;
    case 'T1':
      return TENSION_VISIBILITY_STATE.SIGNALED;
    case 'T2':
    case 'T3':
      return TENSION_VISIBILITY_STATE.TELEGRAPHED;
    case 'T4':
      return TENSION_VISIBILITY_STATE.EXPOSED;
  }
}

/** Returns the visibilityDowngradeDelayTicks for the given state. */
export function visibilityDowngradeDelay(state: TensionVisibilityState): number {
  return VISIBILITY_CONFIGS[state].visibilityDowngradeDelayTicks;
}

/** Returns true if the given VisibilityConfig field is exposed (true) for the state. */
export function visibilityExposes(
  state: TensionVisibilityState,
  field: keyof VisibilityConfig,
): boolean {
  const cfg = VISIBILITY_CONFIGS[state];
  const val = cfg[field];
  return typeof val === 'boolean' ? val : false;
}

/** Returns the canonical ordered list of all TensionVisibilityStates. */
export function visibilityProgressIndex(): readonly TensionVisibilityState[] {
  return VISIBILITY_ORDER;
}

/** Returns all valid TensionVisibilityState values as a readonly array. */
export function allVisibilityStates(): readonly TensionVisibilityState[] {
  return Object.values(TENSION_VISIBILITY_STATE) as TensionVisibilityState[];
}

/* SECTION F — PRESSURE TIER UTILITIES */

/** Returns the tension amplifier multiplier for the given PressureTier. */
export function pressureAmplifier(tier: PressureTier): number {
  return PRESSURE_TENSION_AMPLIFIERS[tier];
}

/** Returns the ordinal index for a PressureTier (T0=0, T4=4). */
export function pressureTierToOrdinal(tier: PressureTier): number {
  switch (tier) {
    case 'T0':
      return 0;
    case 'T1':
      return 1;
    case 'T2':
      return 2;
    case 'T3':
      return 3;
    case 'T4':
      return 4;
  }
}

/** Converts an ordinal (0-4) back to a PressureTier string. */
export function ordinalToPressureTier(ordinal: number): PressureTier {
  const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
  const tier = tiers[ordinal];
  if (tier === undefined) {
    throw new RangeError(`ordinalToPressureTier: ordinal ${ordinal} out of range [0, 4]`);
  }
  return tier;
}

/** Returns true if the PressureTier is in the critical or maximum range. */
export function isCriticalPressureTier(tier: PressureTier): boolean {
  // Confirm T3 and T4 exist in PRESSURE_TENSION_AMPLIFIERS
  const _t3 = PRESSURE_TENSION_AMPLIFIERS['T3'];
  const _t4 = PRESSURE_TENSION_AMPLIFIERS['T4'];
  void _t3; void _t4;
  return tier === 'T3' || tier === 'T4';
}

/** Returns the difference in amplifier values between two PressureTiers. */
export function pressureAmplifierDelta(
  from: PressureTier,
  to: PressureTier,
): number {
  return PRESSURE_TENSION_AMPLIFIERS[to] - PRESSURE_TENSION_AMPLIFIERS[from];
}

/** Returns all valid PressureTier values as a readonly typed array. */
export function allPressureTiers(): readonly PressureTier[] {
  return Object.keys(PRESSURE_TENSION_AMPLIFIERS) as PressureTier[];
}

/** Returns the maximum possible pressure amplifier value (1.5 for T4). */
export function maxPressureAmplifier(): number {
  return PRESSURE_TENSION_AMPLIFIERS['T4'];
}

/** Returns the minimum possible pressure amplifier value (1.0 for T0). */
export function minPressureAmplifier(): number {
  return PRESSURE_TENSION_AMPLIFIERS['T0'];
}

/** Returns a human-readable label for a PressureTier. */
export function pressureTierLabel(tier: PressureTier): string {
  const amp = PRESSURE_TENSION_AMPLIFIERS[tier];
  return `Pressure ${tier} (x${amp.toFixed(2)})`;
}

/* SECTION G — DECAY MATH PURE FUNCTIONS */

/** Computes the total tension contribution from QUEUED entries for one tick. */
export function computeQueuedThreatContribution(
  entries: AnticipationEntry[],
  amplifier: number,
): number {
  let total = 0;
  for (const e of entries) {
    if (e.state === ENTRY_STATE.QUEUED) {
      total += TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * e.severityWeight * amplifier;
    }
  }
  return total;
}

/** Computes the total tension contribution from ARRIVED entries for one tick. */
export function computeArrivedThreatContribution(
  entries: AnticipationEntry[],
  amplifier: number,
): number {
  let total = 0;
  for (const e of entries) {
    if (e.state === ENTRY_STATE.ARRIVED) {
      total += TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * e.severityWeight * amplifier;
    }
  }
  return total;
}

/** Computes the ghost tension contribution from expired entries that are still */
export function computeExpiredGhostContribution(
  expiredEntries: AnticipationEntry[],
  amplifier: number,
): number {
  let total = 0;
  for (const e of expiredEntries) {
    if (e.decayTicksRemaining > 0) {
      total += TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK * amplifier;
    }
  }
  return total;
}

/** Computes the tension relief from mitigated entries during their decay window. */
export function computeMitigationDecayContribution(
  relievedEntries: AnticipationEntry[],
): number {
  let total = 0;
  for (const e of relievedEntries) {
    if (e.state === ENTRY_STATE.MITIGATED && e.decayTicksRemaining > 0) {
      total += TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK * e.severityWeight;
    }
  }
  return total;
}

/** Computes the tension relief from nullified entries during their decay window. */
export function computeNullifyDecayContribution(
  nullifiedEntries: AnticipationEntry[],
): number {
  let total = 0;
  for (const e of nullifiedEntries) {
    if (e.state === ENTRY_STATE.NULLIFIED && e.decayTicksRemaining > 0) {
      total += TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK * e.severityWeight;
    }
  }
  return total;
}

/** Returns TENSION_CONSTANTS.EMPTY_QUEUE_DECAY if the queue is empty, */
export function computeEmptyQueueBonusDecay(isEmpty: boolean): number {
  return isEmpty ? TENSION_CONSTANTS.EMPTY_QUEUE_DECAY : 0;
}

/** Returns TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY if the sovereignty */
export function computeSovereigntyBonusDecay(reached: boolean): number {
  return reached ? TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY : 0;
}

/** Returns the awarenessBonus value directly. */
export function computeVisibilityBonusDecay(awarenessBonus: number): number {
  return awarenessBonus;
}

/** Computes the net raw decay delta for one tick given a DecayComputeInput. */
export function computeRawDecayDelta(input: DecayComputeInput): number {
  const amp = PRESSURE_TENSION_AMPLIFIERS[input.pressureTier];
  const queued = computeQueuedThreatContribution(
    input.activeEntries as AnticipationEntry[],
    amp,
  );
  const arrived = computeArrivedThreatContribution(
    input.activeEntries as AnticipationEntry[],
    amp,
  );
  const ghost = computeExpiredGhostContribution(
    input.expiredEntries as AnticipationEntry[],
    amp,
  );
  const mitDecay = computeMitigationDecayContribution(
    input.relievedEntries as AnticipationEntry[],
  );
  const nullDecay = computeNullifyDecayContribution(
    input.relievedEntries as AnticipationEntry[],
  );
  const emptyBonus = computeEmptyQueueBonusDecay(input.queueIsEmpty);
  const visBonus = computeVisibilityBonusDecay(input.visibilityAwarenessBonus);
  const sovBonus = computeSovereigntyBonusDecay(input.sovereigntyMilestoneReached);
  return queued + arrived + ghost - mitDecay - nullDecay - emptyBonus - visBonus - sovBonus;
}

/** Amplifies a raw decay delta by the pressure amplifier for the given tier. */
export function computeAmplifiedDecayDelta(
  rawDelta: number,
  tier: PressureTier,
): number {
  return rawDelta * PRESSURE_TENSION_AMPLIFIERS[tier];
}

/** Clamps a tension score to the valid range [MIN_SCORE, MAX_SCORE]. */
export function clampTensionScore(score: number): number {
  return Math.min(
    TENSION_CONSTANTS.MAX_SCORE,
    Math.max(TENSION_CONSTANTS.MIN_SCORE, score),
  );
}

/** Applies a score delta to a current tension score, clamping the result. */
export function applyScoreDelta(currentScore: number, delta: number): number {
  return clampTensionScore(currentScore + delta);
}

/** Returns true if the given tension score meets or exceeds the pulse threshold. */
export function isPulseActive(score: number): boolean {
  return score >= TENSION_CONSTANTS.PULSE_THRESHOLD;
}

/** Computes the complete DecayContributionBreakdown for a single tick. */
export function computeDecayBreakdown(
  input: DecayComputeInput,
): DecayContributionBreakdown {
  const amp = PRESSURE_TENSION_AMPLIFIERS[input.pressureTier];
  return {
    queuedThreats: computeQueuedThreatContribution(
      input.activeEntries as AnticipationEntry[],
      amp,
    ),
    arrivedThreats: computeArrivedThreatContribution(
      input.activeEntries as AnticipationEntry[],
      amp,
    ),
    expiredGhosts: computeExpiredGhostContribution(
      input.expiredEntries as AnticipationEntry[],
      amp,
    ),
    mitigationDecay: computeMitigationDecayContribution(
      input.relievedEntries as AnticipationEntry[],
    ),
    nullifyDecay: computeNullifyDecayContribution(
      input.relievedEntries as AnticipationEntry[],
    ),
    emptyQueueBonus: computeEmptyQueueBonusDecay(input.queueIsEmpty),
    visibilityBonus: computeVisibilityBonusDecay(input.visibilityAwarenessBonus),
    sovereigntyBonus: computeSovereigntyBonusDecay(input.sovereigntyMilestoneReached),
  };
}

/** Computes the full DecayComputeResult including raw delta, amplified delta, */
export function computeFullDecayResult(input: DecayComputeInput): DecayComputeResult {
  const contributionBreakdown = computeDecayBreakdown(input);
  const rawDelta = computeRawDecayDelta(input);
  const amplifiedDelta = computeAmplifiedDecayDelta(rawDelta, input.pressureTier);
  return { rawDelta, amplifiedDelta, contributionBreakdown };
}

/** Estimates the number of ticks until tension reaches maximum (1.0) */
export function estimateTicksToMaxTension(
  currentScore: number,
  input: DecayComputeInput,
): number {
  const clamped = clampTensionScore(currentScore);
  if (clamped >= TENSION_CONSTANTS.MAX_SCORE) return 0;
  const result = computeFullDecayResult(input);
  if (result.amplifiedDelta <= 0) return Infinity;
  return Math.ceil((TENSION_CONSTANTS.MAX_SCORE - clamped) / result.amplifiedDelta);
}

/* SECTION H — ENTRY FACTORY AND MUTATION HELPERS */

/** Creates a fully populated AnticipationEntry from a QueueUpsertInput. */
export function createAnticipationEntry(
  input: QueueUpsertInput,
  entryId: string,
): AnticipationEntry {
  const severityWeight =
    input.severityWeight ?? THREAT_SEVERITY_WEIGHTS[input.threatSeverity];
  const baseTensionPerTick =
    TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * severityWeight;
  return {
    entryId,
    runId: input.runId,
    sourceKey: input.sourceKey,
    threatId: input.threatId,
    source: input.source,
    threatType: input.threatType,
    threatSeverity: input.threatSeverity,
    enqueuedAtTick: input.currentTick,
    arrivalTick: input.arrivalTick,
    isCascadeTriggered: input.isCascadeTriggered,
    cascadeTriggerEventId: input.cascadeTriggerEventId,
    worstCaseOutcome: input.worstCaseOutcome,
    mitigationCardTypes: input.mitigationCardTypes,
    baseTensionPerTick,
    severityWeight,
    summary: input.summary,
    state: ENTRY_STATE.QUEUED,
    isArrived: false,
    isMitigated: false,
    isExpired: false,
    isNullified: false,
    mitigatedAtTick: null,
    expiredAtTick: null,
    ticksOverdue: 0,
    decayTicksRemaining: 0,
  };
}

/** Creates a minimal AnticipationEntry for testing and shorthand scenarios. */
export function createMinimalEntry(
  runId: string,
  threatType: ThreatType,
  threatSeverity: ThreatSeverity,
  tick: number,
  arrivalTick: number,
): AnticipationEntry {
  const severityWeight = THREAT_SEVERITY_WEIGHTS[threatSeverity];
  const baseTensionPerTick =
    TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * severityWeight;
  return {
    entryId: `minimal-${runId}-${threatType}-${tick}`,
    runId,
    sourceKey: `${threatType}-${tick}`,
    threatId: `tid-${threatType}-${tick}`,
    source: 'MINIMAL_FACTORY',
    threatType,
    threatSeverity,
    enqueuedAtTick: tick,
    arrivalTick,
    isCascadeTriggered: false,
    cascadeTriggerEventId: null,
    worstCaseOutcome: 'UNSPECIFIED',
    mitigationCardTypes: THREAT_TYPE_DEFAULT_MITIGATIONS[threatType].slice(),
    baseTensionPerTick,
    severityWeight,
    summary: `${threatType} at tick ${tick}`,
    state: ENTRY_STATE.QUEUED,
    isArrived: false,
    isMitigated: false,
    isExpired: false,
    isNullified: false,
    mitigatedAtTick: null,
    expiredAtTick: null,
    ticksOverdue: 0,
    decayTicksRemaining: 0,
  };
}

/** Returns a shallow clone of an AnticipationEntry with optional overrides applied. */
export function cloneEntry(
  entry: AnticipationEntry,
  overrides?: Partial<AnticipationEntry>,
): AnticipationEntry {
  return { ...entry, ...(overrides ?? {}) };
}

/** Transitions an entry to the ARRIVED state at the given tick. */
export function arriveEntry(
  entry: AnticipationEntry,
  tick: number,
): AnticipationEntry {
  void tick;
  return cloneEntry(entry, {
    state: ENTRY_STATE.ARRIVED,
    isArrived: true,
    ticksOverdue: 0,
    decayTicksRemaining: 0,
  });
}

/** Transitions an entry to the MITIGATED state at the given tick. */
export function mitigateEntry(
  entry: AnticipationEntry,
  tick: number,
): AnticipationEntry {
  return cloneEntry(entry, {
    state: ENTRY_STATE.MITIGATED,
    isMitigated: true,
    mitigatedAtTick: tick,
    decayTicksRemaining: TENSION_CONSTANTS.MITIGATION_DECAY_TICKS,
  });
}

/** Transitions an entry to the EXPIRED state at the given tick. */
export function expireEntry(
  entry: AnticipationEntry,
  tick: number,
  ticksOverdue: number,
): AnticipationEntry {
  return cloneEntry(entry, {
    state: ENTRY_STATE.EXPIRED,
    isExpired: true,
    expiredAtTick: tick,
    ticksOverdue,
    decayTicksRemaining: TENSION_CONSTANTS.MITIGATION_DECAY_TICKS,
  });
}

/** Transitions an entry to the NULLIFIED state immediately. */
export function nullifyEntry(entry: AnticipationEntry): AnticipationEntry {
  return cloneEntry(entry, {
    state: ENTRY_STATE.NULLIFIED,
    isNullified: true,
    decayTicksRemaining: TENSION_CONSTANTS.NULLIFY_DECAY_TICKS,
  });
}

/** Decrements the decayTicksRemaining counter by 1, clamping to a minimum of 0. */
export function decrementDecayTicks(entry: AnticipationEntry): AnticipationEntry {
  return cloneEntry(entry, {
    decayTicksRemaining: Math.max(TENSION_CONSTANTS.MIN_SCORE, entry.decayTicksRemaining - 1),
  });
}

/** Computes the tension contribution per tick for a single entry given an amplifier. */
export function computeEntryTensionPerTick(
  entry: AnticipationEntry,
  amplifier: number,
): number {
  if (entry.state === ENTRY_STATE.QUEUED) {
    return TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * entry.severityWeight * amplifier;
  }
  if (entry.state === ENTRY_STATE.ARRIVED) {
    return TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * entry.severityWeight * amplifier;
  }
  if (entry.state === ENTRY_STATE.EXPIRED && entry.decayTicksRemaining > 0) {
    return TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK * amplifier;
  }
  return 0;
}

/* SECTION I — EVENT FACTORY FUNCTIONS */

/** Constructs a TensionScoreUpdatedEvent from a TensionRuntimeSnapshot. */
export function createScoreUpdatedEvent(
  snapshot: TensionRuntimeSnapshot,
): TensionScoreUpdatedEvent {
  // Corresponds to event channel: TENSION_EVENT_NAMES.SCORE_UPDATED
  const _eventName = TENSION_EVENT_NAMES.SCORE_UPDATED;
  void _eventName;
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

/** Constructs a TensionVisibilityChangedEvent recording a visibility transition. */
export function createVisibilityChangedEvent(
  from: TensionVisibilityState,
  to: TensionVisibilityState,
  tick: number,
  timestamp: number,
): TensionVisibilityChangedEvent {
  const _eventName = TENSION_EVENT_NAMES.VISIBILITY_CHANGED;
  void _eventName;
  return {
    eventType: 'TENSION_VISIBILITY_CHANGED',
    from,
    to,
    tickNumber: tick,
    timestamp,
  };
}

/** Constructs a TensionPulseFiredEvent for when tension enters pulse state. */
export function createPulseFiredEvent(
  score: number,
  queueLength: number,
  pulseTicksActive: number,
  tick: number,
  timestamp: number,
): TensionPulseFiredEvent {
  const _eventName = TENSION_EVENT_NAMES.PULSE_FIRED;
  void _eventName;
  return {
    eventType: 'TENSION_PULSE_FIRED',
    score,
    queueLength,
    pulseTicksActive,
    tickNumber: tick,
    timestamp,
  };
}

/** Constructs a ThreatArrivedEvent from an AnticipationEntry. */
export function createThreatArrivedEvent(
  entry: AnticipationEntry,
  tick: number,
  timestamp: number,
): ThreatArrivedEvent {
  const _eventName = TENSION_EVENT_NAMES.THREAT_ARRIVED;
  void _eventName;
  return {
    eventType: 'THREAT_ARRIVED',
    entryId: entry.entryId,
    threatType: entry.threatType,
    threatSeverity: entry.threatSeverity,
    source: entry.source,
    worstCaseOutcome: entry.worstCaseOutcome,
    mitigationCardTypes: entry.mitigationCardTypes,
    tickNumber: tick,
    timestamp,
  };
}

/** Constructs a ThreatMitigatedEvent from an AnticipationEntry. */
export function createThreatMitigatedEvent(
  entry: AnticipationEntry,
  tick: number,
  timestamp: number,
): ThreatMitigatedEvent {
  const _eventName = TENSION_EVENT_NAMES.THREAT_MITIGATED;
  void _eventName;
  return {
    eventType: 'THREAT_MITIGATED',
    entryId: entry.entryId,
    threatType: entry.threatType,
    tickNumber: tick,
    timestamp,
  };
}

/** Constructs a ThreatExpiredEvent from an AnticipationEntry. */
export function createThreatExpiredEvent(
  entry: AnticipationEntry,
  tick: number,
  timestamp: number,
): ThreatExpiredEvent {
  const _eventName = TENSION_EVENT_NAMES.THREAT_EXPIRED;
  void _eventName;
  return {
    eventType: 'THREAT_EXPIRED',
    entryId: entry.entryId,
    threatType: entry.threatType,
    threatSeverity: entry.threatSeverity,
    ticksOverdue: entry.ticksOverdue,
    tickNumber: tick,
    timestamp,
  };
}

/** Constructs an AnticipationQueueUpdatedEvent with current queue counts. */
export function createQueueUpdatedEvent(
  queueLength: number,
  arrivedCount: number,
  queuedCount: number,
  expiredCount: number,
  tick: number,
  timestamp: number,
): AnticipationQueueUpdatedEvent {
  const _eventName = TENSION_EVENT_NAMES.QUEUE_UPDATED;
  void _eventName;
  return {
    eventType: 'ANTICIPATION_QUEUE_UPDATED',
    queueLength,
    arrivedCount,
    queuedCount,
    expiredCount,
    tickNumber: tick,
    timestamp,
  };
}

/** Builds a partial TensionEventMap from a TensionRuntimeSnapshot. */
export function buildEventMap(
  snapshot: TensionRuntimeSnapshot,
): Partial<TensionEventMap> {
  const map: Partial<TensionEventMap> = {
    [TENSION_EVENT_NAMES.UPDATED_LEGACY]: snapshot,
    [TENSION_EVENT_NAMES.SCORE_UPDATED]: createScoreUpdatedEvent(snapshot),
    [TENSION_EVENT_NAMES.QUEUE_UPDATED]: createQueueUpdatedEvent(
      snapshot.queueLength,
      snapshot.arrivedCount,
      snapshot.queuedCount,
      snapshot.expiredCount,
      snapshot.tickNumber,
      snapshot.timestamp,
    ),
  };
  if (snapshot.isPulseActive) {
    map[TENSION_EVENT_NAMES.PULSE_FIRED] = createPulseFiredEvent(
      snapshot.score,
      snapshot.queueLength,
      snapshot.pulseTicksActive,
      snapshot.tickNumber,
      snapshot.timestamp,
    );
  }
  return map;
}

/* SECTION J — SNAPSHOT QUERY UTILITIES */

/** Returns true if the snapshot indicates tension is currently escalating. */
export function snapshotIsEscalating(s: TensionRuntimeSnapshot): boolean {
  return s.isEscalating;
}

/** Returns true if the snapshot indicates a critical tension state. */
export function snapshotIsCritical(s: TensionRuntimeSnapshot): boolean {
  return s.score >= 0.7 || s.isPulseActive;
}

/** Returns true if the snapshot indicates a clear (safe) state. */
export function snapshotIsClear(s: TensionRuntimeSnapshot): boolean {
  return s.score < 0.25 && s.queuedCount === 0 && s.arrivedCount === 0;
}

/** Returns true if the snapshot has at least one arrived threat in the queue. */
export function snapshotHasArrivedThreats(s: TensionRuntimeSnapshot): boolean {
  return s.arrivedCount > 0;
}

/** Returns the score delta (current minus previous) for this snapshot. */
export function snapshotScoreDelta(s: TensionRuntimeSnapshot): number {
  return s.score - s.previousScore;
}

/** Returns the pressure amplifier for a given tier in snapshot context. */
export function snapshotPressureAmplifier(tier: PressureTier): number {
  return PRESSURE_TENSION_AMPLIFIERS[tier];
}

/** Returns the urgency tier label for the snapshot based on score and pulse state. */
export function snapshotUrgencyTier(
  s: TensionRuntimeSnapshot,
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'PULSE' {
  if (s.isPulseActive || s.score >= TENSION_CONSTANTS.PULSE_THRESHOLD) return 'PULSE';
  if (s.score >= 0.7) return 'CRITICAL';
  if (s.score >= 0.5) return 'HIGH';
  if (s.score >= 0.25) return 'MEDIUM';
  return 'LOW';
}

/** Returns a compact human-readable summary of the snapshot state. */
export function snapshotToMiniSummary(s: TensionRuntimeSnapshot): string {
  const pulse = s.isPulseActive ? ' [PULSE]' : '';
  const _channel = TENSION_EVENT_NAMES.UPDATED_LEGACY;
  void _channel;
  return (
    `Tension ${(s.score * 100).toFixed(1)}%${pulse} | ` +
    `${s.visibilityState} | ` +
    `Q:${s.queuedCount} A:${s.arrivedCount} E:${s.expiredCount} | ` +
    `tick=${s.tickNumber}`
  );
}

/** Compares two TensionRuntimeSnapshots by their score values. */
export function compareSnapshotScores(
  a: TensionRuntimeSnapshot,
  b: TensionRuntimeSnapshot,
): -1 | 0 | 1 {
  if (a.score < b.score) return -1;
  if (a.score > b.score) return 1;
  return 0;
}

/** Returns true if the snapshot's visibility state exposes the given config field. */
export function snapshotVisibilityExposes(
  s: TensionRuntimeSnapshot,
  field: keyof VisibilityConfig,
): boolean {
  return visibilityExposes(s.visibilityState, field);
}

/* SECTION K — ML/DL FEATURE LABEL ARRAYS */

/** 32 ML feature labels covering all key tension engine dimensions. */
export const TENSION_TYPES_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Score features (4)
  'score_current',
  'score_previous',
  'score_raw_delta',
  'score_amplified_delta',
  // Queue count features (4)
  'count_queued',
  'count_arrived',
  'count_expired',
  'count_relieved',
  // Threat type features derived from Object.keys(THREAT_TYPE) (8)
  ...Object.keys(THREAT_TYPE).map((k) => `type_count_${k.toLowerCase()}`),
  // Threat severity features derived from Object.keys(THREAT_SEVERITY) (5)
  ...Object.keys(THREAT_SEVERITY).map((k) => `severity_count_${k.toLowerCase()}`),
  // Visibility state features derived from VISIBILITY_ORDER (4)
  ...VISIBILITY_ORDER.map((v) => `visibility_${v.toLowerCase()}`),
  // Pulse and pressure (3)
  'is_pulse_active',
  'pulse_ticks_active',
  'pressure_amplifier',
  // Decay breakdown aggregates (4)
  'decay_queued_threats',
  'decay_arrived_threats',
  'decay_empty_queue_bonus',
  'decay_sovereignty_bonus',
]) as readonly string[];

/** 8 DL tensor column labels for deep learning row encoding. */
export const TENSION_TYPES_DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  'score',
  'severity_weighted_count',
  'pulse_flag',
  'visibility_ordinal',
  'queued_count',
  'arrived_count',
  'pressure_amplifier',
  'decay_delta',
]);

/** The number of DL rows in a standard tension state tensor batch. */
export const TENSION_TYPES_DL_ROW_COUNT: number = 16;

/** Computes a 32-element ML feature vector from entries, score, and visibility state. */
export function computeTypeMLFeatureVector(
  entries: AnticipationEntry[],
  score: number,
  visState: TensionVisibilityState,
): number[] {
  const typeCounts = countEntriesByType(entries);
  const sevCounts: Record<string, number> = {};
  for (const s of Object.values(THREAT_SEVERITY)) {
    sevCounts[s] = 0;
  }
  for (const e of entries) {
    sevCounts[e.threatSeverity] = (sevCounts[e.threatSeverity] ?? 0) + 1;
  }
  const visOrdinal = visibilityToOrdinal(visState);
  const arrived = entries.filter((e) => e.state === ENTRY_STATE.ARRIVED);
  const queued = entries.filter((e) => e.state === ENTRY_STATE.QUEUED);
  const expired = entries.filter((e) => e.state === ENTRY_STATE.EXPIRED);
  // 4 score features
  const vec: number[] = [score, 0, 0, 0];
  // 4 count features
  vec.push(queued.length, arrived.length, expired.length, 0);
  // 8 type count features derived from THREAT_TYPE keys
  for (const t of Object.values(THREAT_TYPE) as ThreatType[]) {
    vec.push(typeCounts[t]);
  }
  // 5 severity count features derived from THREAT_SEVERITY keys
  for (const s of Object.values(THREAT_SEVERITY) as ThreatSeverity[]) {
    vec.push(sevCounts[s] ?? 0);
  }
  // 4 visibility one-hot features derived from VISIBILITY_ORDER
  for (let i = 0; i < VISIBILITY_ORDER.length; i++) {
    vec.push(VISIBILITY_ORDER[i] === visState ? 1 : 0);
  }
  // 3 pulse/pressure features using TENSION_CONSTANTS and PRESSURE_TENSION_AMPLIFIERS
  const isPulse = score >= TENSION_CONSTANTS.PULSE_THRESHOLD ? 1 : 0;
  const amp = PRESSURE_TENSION_AMPLIFIERS['T0'];
  vec.push(isPulse, 0, amp);
  // 4 decay breakdown aggregates
  const queuedDecay = queued.reduce(
    (s, e) => s + TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * e.severityWeight,
    0,
  );
  const arrivedDecay = arrived.reduce(
    (s, e) => s + TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * e.severityWeight,
    0,
  );
  vec.push(queuedDecay, arrivedDecay, TENSION_CONSTANTS.EMPTY_QUEUE_DECAY, 0);
  void visOrdinal;
  return vec.slice(0, 32);
}

/** Computes an 8-element DL row vector for a single tick of tension state. */
export function computeTypeDLRow(
  entries: AnticipationEntry[],
  score: number,
  tick: number,
): number[] {
  void tick;
  const sevWeighted = severityWeightedCount(entries);
  const isPulse = score >= TENSION_CONSTANTS.PULSE_THRESHOLD ? 1 : 0;
  const visOrdinal = VISIBILITY_ORDER.indexOf(TENSION_VISIBILITY_STATE.SHADOWED);
  const queued = entries.filter((e) => e.state === ENTRY_STATE.QUEUED).length;
  const arrived = entries.filter((e) => e.state === ENTRY_STATE.ARRIVED).length;
  const amp = PRESSURE_TENSION_AMPLIFIERS['T0'];
  const decay =
    queued * TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK +
    arrived * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
  return [score, sevWeighted, isPulse, visOrdinal, queued, arrived, amp, decay];
}

/* SECTION L — VALIDATION FUNCTIONS */

/** Validates all fields of an AnticipationEntry. */
export function validateAnticipationEntry(
  entry: AnticipationEntry,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!entry.entryId || typeof entry.entryId !== 'string') {
    errors.push('entryId must be a non-empty string');
  }
  if (!entry.runId || typeof entry.runId !== 'string') {
    errors.push('runId must be a non-empty string');
  }
  if (!isEntryState(entry.state)) {
    errors.push(
      `state "${String(entry.state)}" is not a valid ENTRY_STATE value (${Object.values(ENTRY_STATE).join(', ')})`,
    );
  }
  if (!isThreatType(entry.threatType)) {
    errors.push(
      `threatType "${String(entry.threatType)}" is not valid (${Object.values(THREAT_TYPE).join(', ')})`,
    );
  }
  if (!isThreatSeverity(entry.threatSeverity)) {
    errors.push(
      `threatSeverity "${String(entry.threatSeverity)}" is not valid (${Object.values(THREAT_SEVERITY).join(', ')})`,
    );
  }
  if (typeof entry.severityWeight !== 'number' || entry.severityWeight < 0 || entry.severityWeight > 1) {
    errors.push('severityWeight must be a number in [0, 1]');
  }
  if (typeof entry.decayTicksRemaining !== 'number' || entry.decayTicksRemaining < 0) {
    errors.push('decayTicksRemaining must be >= 0');
  }
  if (typeof entry.ticksOverdue !== 'number' || entry.ticksOverdue < 0) {
    errors.push('ticksOverdue must be >= 0');
  }
  if (typeof entry.arrivalTick !== 'number' || !isFinite(entry.arrivalTick)) {
    errors.push('arrivalTick must be a finite number');
  }
  if (typeof entry.enqueuedAtTick !== 'number' || !isFinite(entry.enqueuedAtTick)) {
    errors.push('enqueuedAtTick must be a finite number');
  }
  if (
    entry.isArrived &&
    entry.state !== ENTRY_STATE.ARRIVED &&
    entry.state !== ENTRY_STATE.MITIGATED &&
    entry.state !== ENTRY_STATE.EXPIRED
  ) {
    errors.push('isArrived=true but state is not ARRIVED/MITIGATED/EXPIRED');
  }
  if (!Array.isArray(entry.mitigationCardTypes)) {
    errors.push('mitigationCardTypes must be an array');
  }
  return { valid: errors.length === 0, errors };
}

/** Validates a QueueUpsertInput object before it is used to create an entry. */
export function validateQueueUpsertSchema(
  input: QueueUpsertInput,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.runId) errors.push('runId is required');
  if (!input.sourceKey) errors.push('sourceKey is required');
  if (!input.threatId) errors.push('threatId is required');
  if (!isThreatType(input.threatType)) {
    errors.push(
      `threatType "${String(input.threatType)}" not in THREAT_TYPE (${Object.values(THREAT_TYPE).join(', ')})`,
    );
  }
  if (!isThreatSeverity(input.threatSeverity)) {
    errors.push(
      `threatSeverity "${String(input.threatSeverity)}" not in THREAT_SEVERITY`,
    );
  }
  if (typeof input.currentTick !== 'number') errors.push('currentTick must be a number');
  if (typeof input.arrivalTick !== 'number') errors.push('arrivalTick must be a number');
  if (input.arrivalTick < input.currentTick) {
    errors.push('arrivalTick must be >= currentTick');
  }
  if (!Array.isArray(input.mitigationCardTypes)) {
    errors.push('mitigationCardTypes must be an array');
  }
  return { valid: errors.length === 0, errors };
}

/** Validates a DecayComputeInput before it is passed to computeFullDecayResult. */
export function validateDecayComputeSchema(
  input: DecayComputeInput,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const validTiers = Object.keys(PRESSURE_TENSION_AMPLIFIERS) as PressureTier[];
  if (!validTiers.includes(input.pressureTier)) {
    errors.push(
      `pressureTier "${String(input.pressureTier)}" not in PRESSURE_TENSION_AMPLIFIERS`,
    );
  }
  if (!Array.isArray(input.activeEntries)) errors.push('activeEntries must be an array');
  if (!Array.isArray(input.expiredEntries)) errors.push('expiredEntries must be an array');
  if (!Array.isArray(input.relievedEntries)) errors.push('relievedEntries must be an array');
  if (typeof input.visibilityAwarenessBonus !== 'number') {
    errors.push('visibilityAwarenessBonus must be a number');
  }
  if (typeof input.queueIsEmpty !== 'boolean') errors.push('queueIsEmpty must be boolean');
  if (typeof input.sovereigntyMilestoneReached !== 'boolean') {
    errors.push('sovereigntyMilestoneReached must be boolean');
  }
  return { valid: errors.length === 0, errors };
}

/** Validates a DecayComputeResult. Checks that rawDelta and amplifiedDelta are finite */
export function validateDecayComputeResult(
  result: DecayComputeResult,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isFinite(result.rawDelta)) errors.push('rawDelta must be finite');
  if (!isFinite(result.amplifiedDelta)) errors.push('amplifiedDelta must be finite');
  const bdv = validateDecayContributionBreakdown(result.contributionBreakdown);
  errors.push(...bdv.errors);
  return { valid: errors.length === 0, errors };
}

/** Validates all 8 fields of a DecayContributionBreakdown are finite numbers. */
export function validateDecayContributionBreakdown(
  breakdown: DecayContributionBreakdown,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const fields: (keyof DecayContributionBreakdown)[] = [
    'queuedThreats',
    'arrivedThreats',
    'expiredGhosts',
    'mitigationDecay',
    'nullifyDecay',
    'emptyQueueBonus',
    'visibilityBonus',
    'sovereigntyBonus',
  ];
  for (const f of fields) {
    if (typeof breakdown[f] !== 'number' || !isFinite(breakdown[f])) {
      errors.push(`breakdown.${f} must be a finite number`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Validates a TensionRuntimeSnapshot for internal consistency. */
export function validateTensionRuntimeSnapshot(
  snapshot: TensionRuntimeSnapshot,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (
    typeof snapshot.score !== 'number' ||
    snapshot.score < TENSION_CONSTANTS.MIN_SCORE ||
    snapshot.score > TENSION_CONSTANTS.MAX_SCORE
  ) {
    errors.push(
      `score must be in [${TENSION_CONSTANTS.MIN_SCORE}, ${TENSION_CONSTANTS.MAX_SCORE}]`,
    );
  }
  if (!isTensionVisibilityState(snapshot.visibilityState)) {
    errors.push(
      `visibilityState "${String(snapshot.visibilityState)}" is not valid. Valid: ${Object.values(TENSION_VISIBILITY_STATE).join(', ')}`,
    );
  }
  if (snapshot.queueLength < 0) errors.push('queueLength must be >= 0');
  if (snapshot.arrivedCount < 0) errors.push('arrivedCount must be >= 0');
  if (snapshot.queuedCount < 0) errors.push('queuedCount must be >= 0');
  if (snapshot.expiredCount < 0) errors.push('expiredCount must be >= 0');
  if (snapshot.relievedCount < 0) errors.push('relievedCount must be >= 0');
  if (typeof snapshot.tickNumber !== 'number' || !isFinite(snapshot.tickNumber)) {
    errors.push('tickNumber must be a finite number');
  }
  if (typeof snapshot.timestamp !== 'number' || !isFinite(snapshot.timestamp)) {
    errors.push('timestamp must be a finite number');
  }
  if (!isFinite(snapshot.score)) errors.push('score must be finite');
  const bdv = validateDecayContributionBreakdown(snapshot.contributionBreakdown);
  errors.push(...bdv.errors);
  return { valid: errors.length === 0, errors };
}

/* SECTION M — NARRATIVE GENERATORS */

/** Generates a narrative string describing the current threat queue counts. */
export function generateThreatCountNarrative(
  queuedCount: number,
  arrivedCount: number,
): string {
  if (queuedCount === 0 && arrivedCount === 0) {
    return 'No threats detected. The horizon is clear.';
  }
  const parts: string[] = [];
  if (queuedCount > 0) {
    parts.push(`${queuedCount} threat${queuedCount > 1 ? 's' : ''} incoming`);
  }
  if (arrivedCount > 0) {
    parts.push(`${arrivedCount} threat${arrivedCount > 1 ? 's' : ''} active now`);
  }
  return parts.join(' | ') + '. Act fast.';
}

/** Generates a narrative string for the current TensionVisibilityState. */
export function generateVisibilityStateNarrative(
  state: TensionVisibilityState,
): string {
  const cfg = VISIBILITY_CONFIGS[state];
  const parts: string[] = [`Visibility: ${state}`];
  if (cfg.showsThreatType) parts.push('threat types known');
  if (cfg.showsArrivalTick) parts.push('arrival timing known');
  if (cfg.showsMitigationPath) parts.push('mitigation paths available');
  if (cfg.showsWorstCase) parts.push('worst-case scenarios visible');
  if (cfg.tensionAwarenessBonus > 0) {
    parts.push(`+${(cfg.tensionAwarenessBonus * 100).toFixed(0)}% awareness bonus`);
  }
  return parts.join(' | ') + '.';
}

/** Generates a severity narrative string including the weight from THREAT_SEVERITY_WEIGHTS. */
export function generateSeverityNarrative(
  severity: ThreatSeverity,
  count: number,
): string {
  const weight = THREAT_SEVERITY_WEIGHTS[severity];
  const label = severityToLabel(severity);
  return (
    `${count}x ${label} (weight: ${weight.toFixed(2)}) — ` +
    `contributing ${(weight * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * 100).toFixed(1)}% tension/tick if arrived.`
  );
}

/** Generates a verbose narrative of all decay breakdown contributions. */
export function generateDecayBreakdownNarrative(
  breakdown: DecayContributionBreakdown,
): string {
  const lines: string[] = [
    `Queued threats: +${breakdown.queuedThreats.toFixed(4)} (rate: ${TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK}/tick)`,
    `Arrived threats: +${breakdown.arrivedThreats.toFixed(4)} (rate: ${TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK}/tick)`,
    `Expired ghosts: +${breakdown.expiredGhosts.toFixed(4)} (rate: ${TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK}/tick)`,
    `Mitigation decay: -${breakdown.mitigationDecay.toFixed(4)} (rate: ${TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK}/tick, ${TENSION_CONSTANTS.MITIGATION_DECAY_TICKS} ticks)`,
    `Nullify decay: -${breakdown.nullifyDecay.toFixed(4)} (rate: ${TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK}/tick, ${TENSION_CONSTANTS.NULLIFY_DECAY_TICKS} ticks)`,
    `Empty queue bonus: -${breakdown.emptyQueueBonus.toFixed(4)} (flat: ${TENSION_CONSTANTS.EMPTY_QUEUE_DECAY})`,
    `Visibility bonus: -${breakdown.visibilityBonus.toFixed(4)}`,
    `Sovereignty bonus: -${breakdown.sovereigntyBonus.toFixed(4)} (flat: ${TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY})`,
  ];
  return lines.join('\n');
}

/** Generates a narrative for the pulse state given the current score and active ticks. */
export function generatePulseNarrative(
  score: number,
  pulseTicksActive: number,
): string {
  if (score < TENSION_CONSTANTS.PULSE_THRESHOLD) {
    return `Tension at ${(score * 100).toFixed(1)}% — below pulse threshold (${(TENSION_CONSTANTS.PULSE_THRESHOLD * 100).toFixed(0)}%).`;
  }
  const remaining = Math.max(0, TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS - pulseTicksActive);
  return (
    `PULSE ACTIVE — tension at ${(score * 100).toFixed(1)}% for ${pulseTicksActive} tick(s). ` +
    (remaining > 0
      ? `${remaining} more tick(s) until sustained pulse.`
      : 'Sustained pulse: critical state maintained!')
  );
}

/** Generates a mitigation guidance narrative for a specific entry. */
export function generateMitigationNarrative(entry: AnticipationEntry): string {
  const defaults = THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType];
  const available = entry.mitigationCardTypes;
  const combined = Array.from(new Set([...defaults, ...available]));
  return (
    `To counter ${threatTypeToLabel(entry.threatType)}: ` +
    `play one of [${combined.join(', ')}]. ` +
    `Worst case if unaddressed: ${entry.worstCaseOutcome}.`
  );
}

/** Generates a high-level queue state narrative combining entry data and score. */
export function generateQueueStateNarrative(
  entries: AnticipationEntry[],
  score: number,
): string {
  const active = entries.filter((e) => entryContributesToTension(e));
  if (active.length === 0) {
    return `Queue clear. Tension at ${(score * 100).toFixed(1)}%. No active threats.`;
  }
  const dom = dominantThreatType(active);
  const sev = dominantSeverity(active);
  return (
    `${active.length} active threat(s). Dominant type: ${dom ? threatTypeToLabel(dom) : 'mixed'}. ` +
    `Dominant severity: ${severityToLabel(sev)}. ` +
    `Tension: ${(score * 100).toFixed(1)}%.`
  );
}

/** Generates a narrative describing the change in tension score and what it means. */
export function generateScoreProgressNarrative(
  score: number,
  previousScore: number,
  visState: TensionVisibilityState,
): string {
  const delta = score - previousScore;
  const direction = delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'unchanged';
  const cfg = VISIBILITY_CONFIGS[visState];
  const awareness =
    cfg.tensionAwarenessBonus > 0
      ? ` (awareness bonus active: +${(cfg.tensionAwarenessBonus * 100).toFixed(0)}%)`
      : '';
  return (
    `Tension ${direction} from ${(previousScore * 100).toFixed(1)}% to ${(score * 100).toFixed(1)}%${awareness}. ` +
    `State: ${visState}.`
  );
}

/** Generates a narrative explaining a ThreatType, its category, and default mitigations. */
export function generateThreatTypeNarrative(type: ThreatType): string {
  const label = threatTypeToLabel(type);
  const category = threatTypeToCategory(type);
  const mitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[type];
  return (
    `${label} [${category}] — ` +
    `Counter with: [${mitigations.join(', ')}]. ` +
    (threatTypeIsCascadeRisk(type)
      ? 'Warning: cascade risk if unmitigated!'
      : 'Manageable with correct play.')
  );
}

/** Generates a full per-entry narrative including state, urgency, and guidance. */
export function generateEntryNarrative(
  entry: AnticipationEntry,
  currentTick: number,
): string {
  const progress = entryProgressPercent(entry, currentTick).toFixed(1);
  const urgency = entryUrgencyScore(entry, currentTick).toFixed(3);
  const state = entry.state;
  const mitGuidance = entryHasMitigationOptions(entry)
    ? generateMitigationNarrative(entry)
    : 'No mitigation options available.';
  return (
    `[${entry.entryId.slice(0, 8)}] ${threatTypeToLabel(entry.threatType)} | ` +
    `${severityToLabel(entry.threatSeverity)} | State: ${state} | ` +
    `Progress: ${progress}% | Urgency: ${urgency}\n${mitGuidance}`
  );
}

/** Generates a narrative for an event name by validating it against TENSION_EVENT_NAMES. */
export function generateEventNarrative(eventName: string): string {
  const knownEvents = Object.values(TENSION_EVENT_NAMES);
  if (
    !knownEvents.includes(
      eventName as (typeof TENSION_EVENT_NAMES)[keyof typeof TENSION_EVENT_NAMES],
    )
  ) {
    return `Unknown event "${eventName}". Valid events: ${knownEvents.join(', ')}.`;
  }
  const descriptions: Record<string, string> = {
    [TENSION_EVENT_NAMES.UPDATED_LEGACY]: 'Full tension snapshot broadcast (legacy)',
    [TENSION_EVENT_NAMES.SCORE_UPDATED]: 'Tension score changed this tick',
    [TENSION_EVENT_NAMES.VISIBILITY_CHANGED]: 'Threat visibility state transition',
    [TENSION_EVENT_NAMES.QUEUE_UPDATED]: 'Anticipation queue counts changed',
    [TENSION_EVENT_NAMES.PULSE_FIRED]: 'Tension crossed pulse threshold',
    [TENSION_EVENT_NAMES.THREAT_ARRIVED]: 'A queued threat has arrived',
    [TENSION_EVENT_NAMES.THREAT_MITIGATED]: 'A threat was successfully mitigated',
    [TENSION_EVENT_NAMES.THREAT_EXPIRED]: 'A threat expired without mitigation',
  };
  return descriptions[eventName] ?? `Event: ${eventName}`;
}

/** Generates a comprehensive narrative for the full tension state. */
export function generateFullTensionNarrative(
  snapshot: TensionRuntimeSnapshot,
  entries: AnticipationEntry[],
): string {
  const scoreNarrative = generateScoreProgressNarrative(
    snapshot.score,
    snapshot.previousScore,
    snapshot.visibilityState,
  );
  const queueNarrative = generateQueueStateNarrative(entries, snapshot.score);
  const visNarrative = generateVisibilityStateNarrative(snapshot.visibilityState);
  const pulseNarrative = generatePulseNarrative(snapshot.score, snapshot.pulseTicksActive);
  const urgencyLabel = snapshotUrgencyTier(snapshot);
  return [
    `=== TENSION ENGINE NARRATIVE [tick=${snapshot.tickNumber}] ===`,
    `Urgency: ${urgencyLabel}`,
    scoreNarrative,
    visNarrative,
    queueNarrative,
    pulseNarrative,
    `Breakdown: queued=+${snapshot.contributionBreakdown.queuedThreats.toFixed(4)} arrived=+${snapshot.contributionBreakdown.arrivedThreats.toFixed(4)} sov=-${snapshot.contributionBreakdown.sovereigntyBonus.toFixed(4)}`,
    '=== END NARRATIVE ===',
  ].join('\n');
}

/* SECTION N — SERIALIZATION AND CHECKSUM HELPERS */

/** Serializes an AnticipationEntry to a JSON string. */
export function serializeAnticipationEntry(entry: AnticipationEntry): string {
  return JSON.stringify(entry);
}

/** Deserializes an AnticipationEntry from a JSON string. */
export function deserializeAnticipationEntry(json: string): AnticipationEntry {
  const parsed = JSON.parse(json) as unknown;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new TypeError('deserializeAnticipationEntry: expected an object');
  }
  const entry = parsed as AnticipationEntry;
  const { valid, errors } = validateAnticipationEntry(entry);
  if (!valid) {
    throw new Error(`deserializeAnticipationEntry: invalid entry — ${errors.join('; ')}`);
  }
  return entry;
}

/** Serializes a TensionRuntimeSnapshot to a JSON string. */
export function serializeTensionRuntimeSnapshot(
  snapshot: TensionRuntimeSnapshot,
): string {
  return JSON.stringify(snapshot);
}

/** Deserializes a TensionRuntimeSnapshot from a JSON string. */
export function deserializeTensionRuntimeSnapshot(
  json: string,
): TensionRuntimeSnapshot {
  const parsed = JSON.parse(json) as unknown;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new TypeError('deserializeTensionRuntimeSnapshot: expected an object');
  }
  const snap = parsed as TensionRuntimeSnapshot;
  const { valid, errors } = validateTensionRuntimeSnapshot(snap);
  if (!valid) {
    throw new Error(
      `deserializeTensionRuntimeSnapshot: invalid snapshot — ${errors.join('; ')}`,
    );
  }
  return snap;
}

/** Serializes a DecayContributionBreakdown to a JSON string. */
export function serializeDecayContributionBreakdown(
  breakdown: DecayContributionBreakdown,
): string {
  return JSON.stringify(breakdown);
}

/** Computes a 16-character SHA-256 hex checksum for an AnticipationEntry. */
export function computeEntryChecksum(entry: AnticipationEntry): string {
  return createHash('sha256')
    .update(JSON.stringify(entry))
    .digest('hex')
    .slice(0, 16);
}

/** Computes a 16-character SHA-256 hex checksum for a TensionRuntimeSnapshot. */
export function computeSnapshotChecksum(snapshot: TensionRuntimeSnapshot): string {
  return createHash('sha256')
    .update(JSON.stringify(snapshot))
    .digest('hex')
    .slice(0, 16);
}

/** Verifies that the given checksum matches the computed checksum for the entry. */
export function verifyEntryChecksum(
  entry: AnticipationEntry,
  checksum: string,
): boolean {
  return computeEntryChecksum(entry) === checksum;
}

/** Computes a SHA-256 checksum over all entry IDs in the queue concatenated. */
export function computeQueueChecksum(entries: AnticipationEntry[]): string {
  const ids = entries.map((e) => e.entryId).join('|');
  return createHash('sha256').update(ids).digest('hex').slice(0, 16);
}

/* SECTION O — DIFF AND COMPARISON UTILITIES */

/** Diffs two AnticipationEntry objects field by field. */
export function diffAnticipationEntries(
  left: AnticipationEntry,
  right: AnticipationEntry,
): { field: string; left: unknown; right: unknown }[] {
  const fields: (keyof AnticipationEntry)[] = [
    'entryId', 'runId', 'sourceKey', 'threatId', 'source',
    'threatType', 'threatSeverity', 'enqueuedAtTick', 'arrivalTick',
    'isCascadeTriggered', 'cascadeTriggerEventId', 'worstCaseOutcome',
    'baseTensionPerTick', 'severityWeight', 'summary', 'state',
    'isArrived', 'isMitigated', 'isExpired', 'isNullified',
    'mitigatedAtTick', 'expiredAtTick', 'ticksOverdue', 'decayTicksRemaining',
  ];
  const diffs: { field: string; left: unknown; right: unknown }[] = [];
  for (const f of fields) {
    if (left[f] !== right[f]) {
      diffs.push({ field: f, left: left[f], right: right[f] });
    }
  }
  return diffs;
}

/** Diffs two DecayContributionBreakdown objects. */
export function diffDecayBreakdowns(
  left: DecayContributionBreakdown,
  right: DecayContributionBreakdown,
): { field: string; left: number; right: number; delta: number }[] {
  const fields: (keyof DecayContributionBreakdown)[] = [
    'queuedThreats', 'arrivedThreats', 'expiredGhosts',
    'mitigationDecay', 'nullifyDecay', 'emptyQueueBonus',
    'visibilityBonus', 'sovereigntyBonus',
  ];
  const diffs: { field: string; left: number; right: number; delta: number }[] = [];
  for (const f of fields) {
    if (left[f] !== right[f]) {
      diffs.push({ field: f, left: left[f], right: right[f], delta: right[f] - left[f] });
    }
  }
  return diffs;
}

/** Diffs two TensionRuntimeSnapshot objects field by field. */
export function diffRuntimeSnapshots(
  left: TensionRuntimeSnapshot,
  right: TensionRuntimeSnapshot,
): { field: string; left: unknown; right: unknown }[] {
  const fields: (keyof TensionRuntimeSnapshot)[] = [
    'score', 'previousScore', 'rawDelta', 'amplifiedDelta',
    'visibilityState', 'queueLength', 'arrivedCount', 'queuedCount',
    'expiredCount', 'relievedCount', 'isPulseActive', 'pulseTicksActive',
    'isEscalating', 'dominantEntryId', 'lastSpikeTick', 'tickNumber', 'timestamp',
  ];
  const diffs: { field: string; left: unknown; right: unknown }[] = [];
  for (const f of fields) {
    if (left[f] !== right[f]) {
      diffs.push({ field: f, left: left[f], right: right[f] });
    }
  }
  return diffs;
}

/** Computes the sum of absolute differences for all changed numeric fields */
export function computeEntryChangeDelta(
  left: AnticipationEntry,
  right: AnticipationEntry,
): number {
  const diffs = diffAnticipationEntries(left, right);
  let delta = 0;
  for (const d of diffs) {
    if (typeof d.left === 'number' && typeof d.right === 'number') {
      delta += Math.abs(d.right - d.left);
    } else {
      delta += 1;
    }
  }
  return delta;
}

/** Returns the percentage distance between two tension scores (0-100). */
export function scoreDistancePct(a: number, b: number): number {
  return Math.abs(a - b) * 100;
}

/** Returns true if the visibility state changed between two snapshots. */
export function visibilityStateChanged(
  left: TensionRuntimeSnapshot,
  right: TensionRuntimeSnapshot,
): boolean {
  return left.visibilityState !== right.visibilityState;
}

/** Computes a similarity score (0-1) between two TensionRuntimeSnapshots. */
export function snapshotSimilarityScore(
  a: TensionRuntimeSnapshot,
  b: TensionRuntimeSnapshot,
): number {
  const scoreSim = 1 - Math.min(1, scoreDistancePct(a.score, b.score) / 100);
  const visSim =
    visibilityToOrdinal(a.visibilityState) === visibilityToOrdinal(b.visibilityState)
      ? 1
      : 0;
  const queueSim =
    1 -
    Math.min(
      1,
      Math.abs(a.queuedCount - b.queuedCount) /
        Math.max(1, a.queuedCount + b.queuedCount),
    );
  return (scoreSim + visSim + queueSim) / 3;
}

/* SECTION P — SELF-TEST HARNESS */

/** Result type returned by runTypesSelfTest(). */
export interface TypesSelfTestResult {
  passed: boolean;
  checks: string[];
  failures: string[];
  durationMs: number;
}

/** Runs the complete self-test suite for all utility functions in this module. */
export function runTypesSelfTest(): TypesSelfTestResult {
  const start = Date.now();
  const checks: string[] = [];
  const failures: string[] = [];

  function assert(label: string, condition: boolean): void {
    checks.push(label);
    if (!condition) failures.push(label);
  }

  // Section A: Type guards
  assert('isTensionVisibilityState SHADOWED', isTensionVisibilityState(TENSION_VISIBILITY_STATE.SHADOWED));
  assert('isTensionVisibilityState invalid', !isTensionVisibilityState('INVALID_VIS'));
  assert('isThreatType DEBT_SPIRAL', isThreatType(THREAT_TYPE.DEBT_SPIRAL));
  assert('isThreatType invalid', !isThreatType('BOGUS'));
  assert('isThreatSeverity CRITICAL', isThreatSeverity(THREAT_SEVERITY.CRITICAL));
  assert('isThreatSeverity invalid', !isThreatSeverity(99));
  assert('isEntryState QUEUED', isEntryState(ENTRY_STATE.QUEUED));
  assert('isEntryState invalid', !isEntryState('DONE'));
  assert('isActiveEntryState QUEUED', isActiveEntryState(ENTRY_STATE.QUEUED));
  assert('isActiveEntryState ARRIVED', isActiveEntryState(ENTRY_STATE.ARRIVED));
  assert('isActiveEntryState MITIGATED false', !isActiveEntryState(ENTRY_STATE.MITIGATED));
  assert('isTerminalEntryState MITIGATED', isTerminalEntryState(ENTRY_STATE.MITIGATED));
  assert('isTerminalEntryState EXPIRED', isTerminalEntryState(ENTRY_STATE.EXPIRED));
  assert('isTerminalEntryState NULLIFIED', isTerminalEntryState(ENTRY_STATE.NULLIFIED));
  assert('isDecayingEntryState EXPIRED', isDecayingEntryState(ENTRY_STATE.EXPIRED));

  // Section B: Entry state predicates
  const testEntry = createMinimalEntry('run1', THREAT_TYPE.CASCADE, THREAT_SEVERITY.SEVERE, 10, 20);
  assert('entryIsActive QUEUED', entryIsActive(testEntry));
  assert('entryContributesToTension', entryContributesToTension(testEntry));
  assert('entryAwaitsArrival', entryAwaitsArrival(testEntry));
  assert('entryTicksUntilArrival', entryTicksUntilArrival(testEntry, 15) === 5);
  assert('entryProgressPercent 50%', Math.abs(entryProgressPercent(testEntry, 15) - 50) < 1);
  assert('entryIsOverdue false', !entryIsOverdue(testEntry, 15));
  assert('entryHasMitigationOptions', entryHasMitigationOptions(testEntry));
  assert('entryUrgencyScore > 0', entryUrgencyScore(testEntry, 15) > 0);
  const arrivedEntry = arriveEntry(testEntry, 20);
  assert('arriveEntry state', arrivedEntry.state === ENTRY_STATE.ARRIVED);
  assert('arriveEntry isArrived', arrivedEntry.isArrived);

  // Section C: Threat severity utilities
  assert('severityToWeight MINOR', severityToWeight(THREAT_SEVERITY.MINOR) === 0.2);
  assert('severityToWeight EXISTENTIAL', severityToWeight(THREAT_SEVERITY.EXISTENTIAL) === 1.0);
  assert('severityToOrdinal MINOR=1', severityToOrdinal(THREAT_SEVERITY.MINOR) === 1);
  assert('severityToOrdinal EXISTENTIAL=5', severityToOrdinal(THREAT_SEVERITY.EXISTENTIAL) === 5);
  assert('ordinalToSeverity 3=SEVERE', ordinalToSeverity(3) === THREAT_SEVERITY.SEVERE);
  assert('compareSeverities MINOR<CRITICAL', compareSeverities(THREAT_SEVERITY.MINOR, THREAT_SEVERITY.CRITICAL) === -1);
  assert('isCriticalOrExistential CRITICAL', isCriticalOrExistential(THREAT_SEVERITY.CRITICAL));
  assert('isCriticalOrExistential MINOR false', !isCriticalOrExistential(THREAT_SEVERITY.MINOR));
  assert('averageSeverityWeight empty=0', averageSeverityWeight([]) === 0);

  // Section D: Threat type utilities
  assert('defaultMitigationsForType CASCADE', defaultMitigationsForType(THREAT_TYPE.CASCADE).length > 0);
  assert('threatTypeToLabel SABOTAGE', threatTypeToLabel(THREAT_TYPE.SABOTAGE) === 'Sabotage');
  assert('threatTypeToCategory DEBT_SPIRAL=ECONOMIC', threatTypeToCategory(THREAT_TYPE.DEBT_SPIRAL) === 'ECONOMIC');
  assert('threatTypeIsCascadeRisk CASCADE', threatTypeIsCascadeRisk(THREAT_TYPE.CASCADE));
  assert('threatTypeIsSovereigntyRisk SOVEREIGNTY', threatTypeIsSovereigntyRisk(THREAT_TYPE.SOVEREIGNTY));
  assert('threatTypeIsEconomicRisk OPPORTUNITY_KILL', threatTypeIsEconomicRisk(THREAT_TYPE.OPPORTUNITY_KILL));
  assert('threatTypeIsSocialRisk HATER_INJECTION', threatTypeIsSocialRisk(THREAT_TYPE.HATER_INJECTION));
  assert('dominantThreatType null on empty', dominantThreatType([]) === null);
  assert('totalMitigationOptions', totalMitigationOptions([testEntry]) === testEntry.mitigationCardTypes.length);

  // Section E: Visibility state utilities
  assert('visibilityToEnvelopeLevel SHADOWED=HIDDEN', visibilityToEnvelopeLevel(TENSION_VISIBILITY_STATE.SHADOWED) === 'HIDDEN');
  assert('visibilityToOrdinal EXPOSED=3', visibilityToOrdinal(TENSION_VISIBILITY_STATE.EXPOSED) === 3);
  assert('ordinalToVisibilityState 0=SHADOWED', ordinalToVisibilityState(0) === TENSION_VISIBILITY_STATE.SHADOWED);
  assert('nextVisibilityState SHADOWED=SIGNALED', nextVisibilityState(TENSION_VISIBILITY_STATE.SHADOWED) === TENSION_VISIBILITY_STATE.SIGNALED);
  assert('nextVisibilityState EXPOSED=null', nextVisibilityState(TENSION_VISIBILITY_STATE.EXPOSED) === null);
  assert('previousVisibilityState SHADOWED=null', previousVisibilityState(TENSION_VISIBILITY_STATE.SHADOWED) === null);
  assert('isHigherVisibility EXPOSED>SHADOWED', isHigherVisibility(TENSION_VISIBILITY_STATE.EXPOSED, TENSION_VISIBILITY_STATE.SHADOWED));
  assert('visibilityAwarenessBonus TELEGRAPHED=0.05', visibilityAwarenessBonus(TENSION_VISIBILITY_STATE.TELEGRAPHED) === 0.05);
  assert('visibilityFromPressureTier T0=SHADOWED', visibilityFromPressureTier('T0') === TENSION_VISIBILITY_STATE.SHADOWED);
  assert('visibilityFromPressureTier T4=EXPOSED', visibilityFromPressureTier('T4') === TENSION_VISIBILITY_STATE.EXPOSED);
  assert('allVisibilityStates length=4', allVisibilityStates().length === 4);

  // Section F: Pressure tier utilities
  assert('pressureAmplifier T0=1.0', pressureAmplifier('T0') === 1.0);
  assert('pressureAmplifier T4=1.5', pressureAmplifier('T4') === 1.5);
  assert('pressureTierToOrdinal T0=0', pressureTierToOrdinal('T0') === 0);
  assert('pressureTierToOrdinal T4=4', pressureTierToOrdinal('T4') === 4);
  assert('ordinalToPressureTier 2=T2', ordinalToPressureTier(2) === 'T2');
  assert('isCriticalPressureTier T3', isCriticalPressureTier('T3'));
  assert('isCriticalPressureTier T0 false', !isCriticalPressureTier('T0'));
  assert('maxPressureAmplifier=1.5', maxPressureAmplifier() === 1.5);
  assert('minPressureAmplifier=1.0', minPressureAmplifier() === 1.0);
  assert('allPressureTiers length=5', allPressureTiers().length === 5);

  // Section G: Decay math
  const decayInput: DecayComputeInput = {
    activeEntries: [testEntry],
    expiredEntries: [],
    relievedEntries: [],
    pressureTier: 'T2',
    visibilityAwarenessBonus: 0.05,
    queueIsEmpty: false,
    sovereigntyMilestoneReached: false,
  };
  const decayResult = computeFullDecayResult(decayInput);
  assert('computeFullDecayResult rawDelta finite', isFinite(decayResult.rawDelta));
  assert('computeFullDecayResult amplifiedDelta finite', isFinite(decayResult.amplifiedDelta));
  assert('clampTensionScore 0-1', clampTensionScore(1.5) === 1.0);
  assert('clampTensionScore min', clampTensionScore(-0.5) === 0.0);
  assert('isPulseActive 0.9=true', isPulseActive(0.9));
  assert('isPulseActive 0.5=false', !isPulseActive(0.5));
  assert('computeEmptyQueueBonusDecay true', computeEmptyQueueBonusDecay(true) === TENSION_CONSTANTS.EMPTY_QUEUE_DECAY);
  assert('computeSovereigntyBonusDecay true', computeSovereigntyBonusDecay(true) === TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY);
  assert('estimateTicksToMaxTension 1.0=0', estimateTicksToMaxTension(1.0, decayInput) === 0);

  // Section H: Entry factory and mutation
  const upsertInput: QueueUpsertInput = {
    runId: 'run-test',
    sourceKey: 'sk-1',
    threatId: 'tid-1',
    source: 'TEST',
    threatType: THREAT_TYPE.DEBT_SPIRAL,
    threatSeverity: THREAT_SEVERITY.CRITICAL,
    currentTick: 1,
    arrivalTick: 5,
    isCascadeTriggered: false,
    cascadeTriggerEventId: null,
    worstCaseOutcome: 'BANKRUPTCY',
    mitigationCardTypes: ['REFINANCE'],
    summary: 'Test debt spiral',
  };
  const created = createAnticipationEntry(upsertInput, 'eid-test');
  assert('createAnticipationEntry state=QUEUED', created.state === ENTRY_STATE.QUEUED);
  assert(
    'createAnticipationEntry severityWeight',
    created.severityWeight === THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL],
  );
  const mitigated = mitigateEntry(created, 5);
  assert('mitigateEntry state=MITIGATED', mitigated.state === ENTRY_STATE.MITIGATED);
  assert(
    'mitigateEntry decayTicksRemaining=3',
    mitigated.decayTicksRemaining === TENSION_CONSTANTS.MITIGATION_DECAY_TICKS,
  );
  const nullified = nullifyEntry(created);
  assert('nullifyEntry state=NULLIFIED', nullified.state === ENTRY_STATE.NULLIFIED);
  assert(
    'nullifyEntry decayTicks=NULLIFY_DECAY_TICKS',
    nullified.decayTicksRemaining === TENSION_CONSTANTS.NULLIFY_DECAY_TICKS,
  );
  const expired = expireEntry(created, 6, 1);
  assert('expireEntry state=EXPIRED', expired.state === ENTRY_STATE.EXPIRED);
  const decremented = decrementDecayTicks(mitigated);
  assert(
    'decrementDecayTicks',
    decremented.decayTicksRemaining === TENSION_CONSTANTS.MITIGATION_DECAY_TICKS - 1,
  );
  const perTick = computeEntryTensionPerTick(created, 1.2);
  assert('computeEntryTensionPerTick QUEUED > 0', perTick > 0);

  // Section I: Event factory
  const mockSnapshot: TensionRuntimeSnapshot = {
    score: 0.55,
    previousScore: 0.5,
    rawDelta: 0.05,
    amplifiedDelta: 0.06,
    visibilityState: TENSION_VISIBILITY_STATE.TELEGRAPHED,
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
    tickNumber: 42,
    timestamp: Date.now(),
    contributionBreakdown: decayResult.contributionBreakdown,
  };
  const scoreEvt = createScoreUpdatedEvent(mockSnapshot);
  assert('createScoreUpdatedEvent eventType', scoreEvt.eventType === 'TENSION_SCORE_UPDATED');
  assert('createScoreUpdatedEvent score', scoreEvt.score === 0.55);
  const visEvt = createVisibilityChangedEvent(
    TENSION_VISIBILITY_STATE.SHADOWED,
    TENSION_VISIBILITY_STATE.SIGNALED,
    10,
    Date.now(),
  );
  assert('createVisibilityChangedEvent from', visEvt.from === TENSION_VISIBILITY_STATE.SHADOWED);
  const pulseEvt = createPulseFiredEvent(0.92, 3, 1, 10, Date.now());
  assert('createPulseFiredEvent score', pulseEvt.score === 0.92);
  const arrivedEvt = createThreatArrivedEvent(created, 5, Date.now());
  assert('createThreatArrivedEvent entryId', arrivedEvt.entryId === created.entryId);
  const mitigEvt = createThreatMitigatedEvent(mitigated, 5, Date.now());
  assert('createThreatMitigatedEvent eventType', mitigEvt.eventType === 'THREAT_MITIGATED');
  const expiredEvt = createThreatExpiredEvent(expired, 6, Date.now());
  assert('createThreatExpiredEvent ticksOverdue', expiredEvt.ticksOverdue === 1);
  const queueEvt = createQueueUpdatedEvent(2, 1, 1, 0, 10, Date.now());
  assert('createQueueUpdatedEvent queueLength', queueEvt.queueLength === 2);
  const eventMap = buildEventMap(mockSnapshot);
  assert('buildEventMap has SCORE_UPDATED', TENSION_EVENT_NAMES.SCORE_UPDATED in eventMap);

  // Section J: Snapshot query utilities
  assert('snapshotIsEscalating', snapshotIsEscalating(mockSnapshot));
  assert('snapshotIsCritical 0.55 false', !snapshotIsCritical(mockSnapshot));
  assert('snapshotIsClear false', !snapshotIsClear(mockSnapshot));
  assert('snapshotHasArrivedThreats', snapshotHasArrivedThreats(mockSnapshot));
  assert('snapshotScoreDelta=0.05', Math.abs(snapshotScoreDelta(mockSnapshot) - 0.05) < 0.001);
  assert('snapshotUrgencyTier MEDIUM', snapshotUrgencyTier(mockSnapshot) === 'MEDIUM');
  const summary = snapshotToMiniSummary(mockSnapshot);
  assert('snapshotToMiniSummary non-empty', summary.length > 0);
  assert('compareSnapshotScores equal', compareSnapshotScores(mockSnapshot, mockSnapshot) === 0);

  // Section K: ML/DL feature vectors
  assert('TENSION_TYPES_ML_FEATURE_LABELS length=32', TENSION_TYPES_ML_FEATURE_LABELS.length === 32);
  assert('TENSION_TYPES_DL_COLUMN_LABELS length=8', TENSION_TYPES_DL_COLUMN_LABELS.length === 8);
  assert('TENSION_TYPES_DL_ROW_COUNT=16', TENSION_TYPES_DL_ROW_COUNT === 16);
  const mlVec = computeTypeMLFeatureVector([created], 0.5, TENSION_VISIBILITY_STATE.TELEGRAPHED);
  assert('computeTypeMLFeatureVector length=32', mlVec.length === 32);
  const dlRow = computeTypeDLRow([created], 0.5, 10);
  assert('computeTypeDLRow length=8', dlRow.length === 8);

  // Section L: Validation functions
  const entryValidation = validateAnticipationEntry(created);
  assert('validateAnticipationEntry valid', entryValidation.valid);
  const inputValidation = validateQueueUpsertSchema(upsertInput);
  assert('validateQueueUpsertSchema valid', inputValidation.valid);
  const decayInputValidation = validateDecayComputeSchema(decayInput);
  assert('validateDecayComputeSchema valid', decayInputValidation.valid);
  const decayResultValidation = validateDecayComputeResult(decayResult);
  assert('validateDecayComputeResult valid', decayResultValidation.valid);
  const breakdownValidation = validateDecayContributionBreakdown(decayResult.contributionBreakdown);
  assert('validateDecayContributionBreakdown valid', breakdownValidation.valid);
  const snapValidation = validateTensionRuntimeSnapshot(mockSnapshot);
  assert('validateTensionRuntimeSnapshot valid', snapValidation.valid);

  // Section M: Narrative generators
  const threatCountNarrative = generateThreatCountNarrative(2, 1);
  assert('generateThreatCountNarrative non-empty', threatCountNarrative.length > 0);
  const visNarrative = generateVisibilityStateNarrative(TENSION_VISIBILITY_STATE.EXPOSED);
  assert('generateVisibilityStateNarrative includes EXPOSED', visNarrative.includes('EXPOSED'));
  const sevNarrative = generateSeverityNarrative(THREAT_SEVERITY.CRITICAL, 2);
  assert('generateSeverityNarrative non-empty', sevNarrative.length > 0);
  const decayNarrative = generateDecayBreakdownNarrative(decayResult.contributionBreakdown);
  assert('generateDecayBreakdownNarrative non-empty', decayNarrative.length > 0);
  const pulseNarrative = generatePulseNarrative(0.95, 2);
  assert('generatePulseNarrative includes PULSE', pulseNarrative.includes('PULSE'));
  const mitigNarrative = generateMitigationNarrative(created);
  assert('generateMitigationNarrative non-empty', mitigNarrative.length > 0);
  const queueNarrative = generateQueueStateNarrative([created], 0.5);
  assert('generateQueueStateNarrative non-empty', queueNarrative.length > 0);
  const scoreNarrative = generateScoreProgressNarrative(0.55, 0.5, TENSION_VISIBILITY_STATE.TELEGRAPHED);
  assert('generateScoreProgressNarrative non-empty', scoreNarrative.length > 0);
  const typeNarrative = generateThreatTypeNarrative(THREAT_TYPE.CASCADE);
  assert('generateThreatTypeNarrative includes Cascade', typeNarrative.includes('Cascade'));
  const entryNarrative = generateEntryNarrative(created, 12);
  assert('generateEntryNarrative non-empty', entryNarrative.length > 0);
  const eventNarrative = generateEventNarrative(TENSION_EVENT_NAMES.SCORE_UPDATED);
  assert('generateEventNarrative known event', !eventNarrative.includes('Unknown'));
  const fullNarrative = generateFullTensionNarrative(mockSnapshot, [created]);
  assert('generateFullTensionNarrative non-empty', fullNarrative.length > 0);

  // Section N: Serialization and checksums
  const serialized = serializeAnticipationEntry(created);
  assert('serializeAnticipationEntry is string', typeof serialized === 'string');
  const deserialized = deserializeAnticipationEntry(serialized);
  assert('deserializeAnticipationEntry roundtrip', deserialized.entryId === created.entryId);
  const checksum = computeEntryChecksum(created);
  assert('computeEntryChecksum length=16', checksum.length === 16);
  assert('verifyEntryChecksum true', verifyEntryChecksum(created, checksum));
  assert('verifyEntryChecksum false on bad checksum', !verifyEntryChecksum(created, 'badchecksum!!!'));
  const snapChecksum = computeSnapshotChecksum(mockSnapshot);
  assert('computeSnapshotChecksum length=16', snapChecksum.length === 16);
  const queueChecksum = computeQueueChecksum([created]);
  assert('computeQueueChecksum length=16', queueChecksum.length === 16);

  // Section O: Diff and comparison utilities
  const cloned = cloneEntry(created, { ticksOverdue: 5 });
  const diffs = diffAnticipationEntries(created, cloned);
  assert('diffAnticipationEntries finds ticksOverdue', diffs.some((d) => d.field === 'ticksOverdue'));
  const breakdownDiffs = diffDecayBreakdowns(
    decayResult.contributionBreakdown,
    decayResult.contributionBreakdown,
  );
  assert('diffDecayBreakdowns identical=empty', breakdownDiffs.length === 0);
  const snapDiffs = diffRuntimeSnapshots(mockSnapshot, mockSnapshot);
  assert('diffRuntimeSnapshots identical=empty', snapDiffs.length === 0);
  const changeDelta = computeEntryChangeDelta(created, cloned);
  assert('computeEntryChangeDelta > 0', changeDelta > 0);
  assert('scoreDistancePct', Math.abs(scoreDistancePct(0.5, 0.8) - 30) < 0.001);
  assert('visibilityStateChanged false', !visibilityStateChanged(mockSnapshot, mockSnapshot));
  const simScore = snapshotSimilarityScore(mockSnapshot, mockSnapshot);
  assert('snapshotSimilarityScore identical=1', Math.abs(simScore - 1) < 0.001);

  return {
    passed: failures.length === 0,
    checks,
    failures,
    durationMs: Date.now() - start,
  };
}
