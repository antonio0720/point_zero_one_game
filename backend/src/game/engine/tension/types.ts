/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION ENGINE TYPES
 * /backend/src/game/engine/tension/types.ts
 * ====================================================================== */

import type {
  PressureTier,
  ThreatEnvelope,
  VisibilityLevel,
} from '../core/GamePrimitives';

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
    showsThreatCount: true,
    showsThreatType: true,
    showsArrivalTick: true,
    showsMitigationPath: true,
    showsWorstCase: true,
    tensionAwarenessBonus: 0.05,
    visibilityDowngradeDelayTicks: 2,
  },
};

export const PRESSURE_TENSION_AMPLIFIERS: Readonly<Record<PressureTier, number>> = {
  T0: 1.0,
  T1: 1.1,
  T2: 1.2,
  T3: 1.35,
  T4: 1.5,
};

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
  [THREAT_SEVERITY.EXISTENTIAL]: 1,
};

export const THREAT_TYPE_DEFAULT_MITIGATIONS: Readonly<
  Record<ThreatType, readonly string[]>
> = {
  [THREAT_TYPE.DEBT_SPIRAL]: Object.freeze(['REFINANCE', 'INCOME_SHIELD', 'CASH_BUFFER']),
  [THREAT_TYPE.SABOTAGE]: Object.freeze(['COUNTER_PLAY', 'PR_SHIELD', 'LEGAL_DEFENSE']),
  [THREAT_TYPE.HATER_INJECTION]: Object.freeze(['BLOCK', 'PURGE', 'COUNTER_INTEL']),
  [THREAT_TYPE.CASCADE]: Object.freeze(['STABILIZE', 'PATCH', 'CONTAIN']),
  [THREAT_TYPE.SOVEREIGNTY]: Object.freeze(['TRUST_LOCK', 'LEGAL_SHIELD', 'SOVEREIGN_RESET']),
  [THREAT_TYPE.OPPORTUNITY_KILL]: Object.freeze(['RECOVER_OPPORTUNITY', 'INSURE_UPSIDE']),
  [THREAT_TYPE.REPUTATION_BURN]: Object.freeze(['PR_SHIELD', 'REPUTATION_WASH']),
  [THREAT_TYPE.SHIELD_PIERCE]: Object.freeze(['HARDEN', 'REPAIR', 'ABSORB']),
};

export const INTERNAL_VISIBILITY_TO_ENVELOPE: Readonly<
  Record<TensionVisibilityState, VisibilityLevel>
> = {
  [TENSION_VISIBILITY_STATE.SHADOWED]: 'HIDDEN',
  [TENSION_VISIBILITY_STATE.SIGNALED]: 'SILHOUETTE',
  [TENSION_VISIBILITY_STATE.TELEGRAPHED]: 'PARTIAL',
  [TENSION_VISIBILITY_STATE.EXPOSED]: 'EXPOSED',
};

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