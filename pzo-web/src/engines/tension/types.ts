/**
 * FILE: /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/tension/types.ts
 * All types, enums, constants, and interfaces for the Tension Engine.
 * Imported by TensionEngine, all sub-files, engineStore, and TensionReader consumers.
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */

// ── Imported enum from PressureEngine types ───────────────────────────────
// We import the ENUM ONLY — never the PressureEngine class.
import { PressureTier } from '../pressure/types';
export { PressureTier }; // re-export so consumers can import from one place

// ── Visibility State Enum ─────────────────────────────────────────────────
export enum VisibilityState {
  SHADOWED    = 'SHADOWED',    // threat count only
  SIGNALED    = 'SIGNALED',    // threat type revealed
  TELEGRAPHED = 'TELEGRAPHED', // type + arrival tick revealed
  EXPOSED     = 'EXPOSED',     // full data + optimal mitigation path
}

// ── Threat Type Enum ──────────────────────────────────────────────────────
export enum ThreatType {
  DEBT_SPIRAL      = 'DEBT_SPIRAL',      // cashflow destruction over multiple ticks
  SABOTAGE         = 'SABOTAGE',         // one-time income wipe
  HATER_INJECTION  = 'HATER_INJECTION',  // enemy card forced into hand
  CASCADE          = 'CASCADE',          // consequence of previous failure
  SOVEREIGNTY      = 'SOVEREIGNTY',      // existential wealth threat
  OPPORTUNITY_KILL = 'OPPORTUNITY_KILL', // removes a positive card from play
  REPUTATION_BURN  = 'REPUTATION_BURN',  // increases hater heat permanently
  SHIELD_PIERCE    = 'SHIELD_PIERCE',    // bypasses shield and hits directly
}

// ── Threat Severity Enum ──────────────────────────────────────────────────
export enum ThreatSeverity {
  MINOR       = 'MINOR',       // 1–5% of monthly income
  MODERATE    = 'MODERATE',    // 6–15% of monthly income
  SEVERE      = 'SEVERE',      // 16–35% of monthly income
  CRITICAL    = 'CRITICAL',    // 36–60% of monthly income
  EXISTENTIAL = 'EXISTENTIAL', // >60% of monthly income or direct BANKRUPT risk
}

// ── Anticipation Entry State Enum ─────────────────────────────────────────
export enum EntryState {
  QUEUED    = 'QUEUED',    // scheduled, not yet arrived
  ARRIVED   = 'ARRIVED',   // arrived, action window open
  MITIGATED = 'MITIGATED', // player resolved it
  EXPIRED   = 'EXPIRED',   // arrived and not mitigated — consequence applied
  NULLIFIED = 'NULLIFIED', // removed by external card effect
}

// ── Anticipation Entry ────────────────────────────────────────────────────
// Every queued threat. All readonly fields must be set at enqueue time.
export interface AnticipationEntry {
  // ── Set at enqueue (immutable) ─────────────────────────────────────
  readonly entryId: string;                        // uuid v4
  readonly threatId: string;                       // matches source Threat object
  readonly threatType: ThreatType;                 // category
  readonly threatSeverity: ThreatSeverity;         // magnitude class
  readonly enqueuedAtTick: number;                 // tick this was enqueued
  readonly arrivalTick: number;                    // tick it becomes active
  readonly isCascadeTriggered: boolean;            // arrival driven by event not time
  readonly cascadeTriggerEventId: string | null;   // which event triggers it (if cascade)
  readonly worstCaseOutcome: string;               // human-readable max damage description
  readonly mitigationCardTypes: readonly string[]; // card types that resolve this threat
  readonly baseTensionPerTick: number;             // default 0.12 for QUEUED, 0.20 for ARRIVED
  // ── Mutable (set during lifecycle) ─────────────────────────────────
  state: EntryState;                               // current lifecycle state
  isArrived: boolean;                              // convenience flag
  isMitigated: boolean;                            // convenience flag
  isExpired: boolean;                              // convenience flag
  isNullified: boolean;                            // convenience flag
  mitigatedAtTick: number | null;                  // when mitigation occurred
  expiredAtTick: number | null;                    // when expiry was recorded
  ticksOverdue: number;                            // ticks past arrival without mitigation
  decayTicksRemaining: number;                     // post-mitigation ticks of decay (starts at 3)
}

// ── Tension Score Snapshot ────────────────────────────────────────────────
// Produced each tick by TensionEngine.computeTension()
export interface TensionSnapshot {
  readonly score: number;                       // 0.0–1.0 clipped tension score
  readonly rawScore: number;                    // pre-clip, pre-amplification delta
  readonly amplifiedScore: number;              // after pressure amplifier applied
  readonly visibilityState: VisibilityState;
  readonly queueLength: number;                 // total entries in queue (QUEUED + ARRIVED)
  readonly arrivedCount: number;                // threats in ARRIVED state
  readonly queuedCount: number;                 // threats in QUEUED state
  readonly expiredCount: number;                // threats that expired this run
  readonly isPulseActive: boolean;              // true if score >= 0.90
  readonly pulseTicksActive: number;            // consecutive ticks score >= 0.90
  readonly scoreHistory: readonly number[];     // last 20 ticks
  readonly isEscalating: boolean;               // trending up over last 3 ticks
  readonly dominantEntryId: string | null;      // highest-tension entry in queue
  readonly pressureTierAtCompute: PressureTier; // what pressure was when computed
  readonly tickNumber: number;
  readonly timestamp: number;
}

// ── TensionReader — the interface other engines use ───────────────────────
// No engine imports TensionEngine directly. They use this interface.
export interface TensionReader {
  getCurrentScore(): number;
  getVisibilityState(): VisibilityState;
  getQueueLength(): number;
  isAnticipationPulseActive(): boolean;
  getSnapshot(): TensionSnapshot;
}

// ── Visibility Config per state ───────────────────────────────────────────
export interface VisibilityConfig {
  state: VisibilityState;
  pressureThreshold: PressureTier;       // minimum tier required
  showsThreatCount: boolean;
  showsThreatType: boolean;
  showsArrivalTick: boolean;
  showsMitigationPath: boolean;
  showsWorstCase: boolean;
  tensionAwarenessBonus: number;         // flat bonus to tension score while in this state
  visibilityDowngradeDelayTicks: number; // ticks before downgrade applies
}

export const VISIBILITY_CONFIGS: Record<VisibilityState, VisibilityConfig> = {
  [VisibilityState.SHADOWED]: {
    state: VisibilityState.SHADOWED,
    pressureThreshold: PressureTier.CALM,
    showsThreatCount: true,
    showsThreatType: false,
    showsArrivalTick: false,
    showsMitigationPath: false,
    showsWorstCase: false,
    tensionAwarenessBonus: 0.0,
    visibilityDowngradeDelayTicks: 0,
  },
  [VisibilityState.SIGNALED]: {
    state: VisibilityState.SIGNALED,
    pressureThreshold: PressureTier.BUILDING,
    showsThreatCount: true,
    showsThreatType: true,
    showsArrivalTick: false,
    showsMitigationPath: false,
    showsWorstCase: false,
    tensionAwarenessBonus: 0.0,
    visibilityDowngradeDelayTicks: 2,
  },
  [VisibilityState.TELEGRAPHED]: {
    state: VisibilityState.TELEGRAPHED,
    pressureThreshold: PressureTier.ELEVATED,
    showsThreatCount: true,
    showsThreatType: true,
    showsArrivalTick: true,
    showsMitigationPath: false,
    showsWorstCase: false,
    tensionAwarenessBonus: 0.05,
    visibilityDowngradeDelayTicks: 2,
  },
  [VisibilityState.EXPOSED]: {
    state: VisibilityState.EXPOSED,
    pressureThreshold: PressureTier.CRITICAL,
    showsThreatCount: true,
    showsThreatType: true,
    showsArrivalTick: true,
    showsMitigationPath: true,
    showsWorstCase: true,
    tensionAwarenessBonus: 0.05,
    visibilityDowngradeDelayTicks: 2,
  },
};

// ── Pressure amplifier table ──────────────────────────────────────────────
export const PRESSURE_TENSION_AMPLIFIERS: Record<PressureTier, number> = {
  [PressureTier.CALM]:     1.00,
  [PressureTier.BUILDING]: 1.10,
  [PressureTier.ELEVATED]: 1.20,
  [PressureTier.HIGH]:     1.35,
  [PressureTier.CRITICAL]: 1.50,
};

// ── Tension accumulation constants ────────────────────────────────────────
export const TENSION_CONSTANTS = {
  QUEUED_TENSION_PER_TICK:   0.12, // per queued threat per tick
  ARRIVED_TENSION_PER_TICK:  0.20, // per arrived-but-unresolved threat per tick
  EXPIRED_GHOST_PER_TICK:    0.08, // per expired threat per tick (lingers forever)
  MITIGATION_DECAY_PER_TICK: 0.08, // decay per tick after successful mitigation
  MITIGATION_DECAY_TICKS:    3,    // how many ticks decay runs after mitigation
  NULLIFY_DECAY_PER_TICK:    0.04, // partial decay after card-nullified threat
  NULLIFY_DECAY_TICKS:       3,    // same duration
  EMPTY_QUEUE_DECAY:         0.05, // flat per tick when queue is clear
  SOVEREIGNTY_BONUS_DECAY:   0.15, // one-time flat drop on freedom milestone
  PULSE_THRESHOLD:           0.90, // score at or above this fires Anticipation Pulse
  PULSE_SUSTAINED_TICKS:     3,    // ticks at PULSE_THRESHOLD before screen border shake
  MAX_SCORE:                 1.0,
  MIN_SCORE:                 0.0,
} as const;

// ── Event Types emitted by TensionUXBridge ────────────────────────────────

export interface TensionScoreUpdatedEvent {
  eventType: 'TENSION_SCORE_UPDATED';
  score: number;
  visibilityState: VisibilityState;
  tickNumber: number;
  timestamp: number;
}

export interface TensionVisibilityChangedEvent {
  eventType: 'TENSION_VISIBILITY_CHANGED';
  from: VisibilityState;
  to: VisibilityState;
  tickNumber: number;
  timestamp: number;
}

export interface TensionPulseFiredEvent {
  eventType: 'TENSION_PULSE_FIRED';
  score: number;
  queueLength: number;
  pulseTicksActive: number;
  tickNumber: number;
  timestamp: number;
}

export interface ThreatArrivedEvent {
  eventType: 'THREAT_ARRIVED';
  entryId: string;
  threatType: ThreatType;
  threatSeverity: ThreatSeverity;
  worstCaseOutcome: string;
  mitigationCardTypes: readonly string[];
  tickNumber: number;
  timestamp: number;
}

export interface ThreatMitigatedEvent {
  eventType: 'THREAT_MITIGATED';
  entryId: string;
  threatType: ThreatType;
  tickNumber: number;
  timestamp: number;
}

export interface ThreatExpiredEvent {
  eventType: 'THREAT_EXPIRED';
  entryId: string;
  threatType: ThreatType;
  threatSeverity: ThreatSeverity;
  ticksOverdue: number;
  tickNumber: number;
  timestamp: number;
}

export interface AnticipationQueueUpdatedEvent {
  eventType: 'ANTICIPATION_QUEUE_UPDATED';
  queueLength: number;
  arrivedCount: number;
  tickNumber: number;
  timestamp: number;
}

export type TensionEvent =
  | TensionScoreUpdatedEvent
  | TensionVisibilityChangedEvent
  | TensionPulseFiredEvent
  | ThreatArrivedEvent
  | ThreatMitigatedEvent
  | ThreatExpiredEvent
  | AnticipationQueueUpdatedEvent;