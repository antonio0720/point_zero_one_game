// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/defectionSequenceEngine.ts
// Sprint 5 — Defection Sequence System — SOVEREIGN EDITION
// Density6 LLC · Confidential
//
// Defection is a 3-card sequence, not a button.
// BREAK_PACT → SILENT_EXIT → ASSET_SEIZURE
// Each step is detectable by sharp teammates.
// Sequence must complete within 60 ticks or resets.
//
// CHANGE LOG:
//   • defectionMinTick corrected to 8 (bible spec)
//   • Added DEFECTION_CORD_PENALTY = 0.15 (bible + SyndicateCardMode alignment)
//   • Added DEFECTION_COUNTDOWN_MS = 3000 (bible: 3-second visible countdown)
//   • Added computeDetectionProbability() — suspicion + COUNTER_INTEL role
//   • Added DefectionAuditRecord for CORD/sovereignty export
//   • Added isMirrorDefection() — both players defect simultaneously edge case
//   • Suspicion broadcast now returns structured event for EventBus
//   • Added getDefectionCORDPenalty() for clean CORD calculator integration
// ═══════════════════════════════════════════════════════════════════════════

import { SYNDICATE_CONFIG } from './syndicateConfig';
import { getDetectionProbability } from './trustScoreEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Flat CORD penalty applied to defector. Must match SyndicateCardMode.DEFECTION_CORD_PENALTY */
export const DEFECTION_CORD_PENALTY = 0.15;

/** How long the team sees "PLAYER X IS DEFECTING" warning (ms) */
export const DEFECTION_COUNTDOWN_MS = SYNDICATE_CONFIG.defectionCountdownMs;

/** Sequence expiry window (ticks) — sequence resets if not completed in time */
const SEQUENCE_WINDOW_TICKS = 60;

/** Minimum ticks between each defection step (SyndicateCardMode: 1 tick gap) */
const MIN_TICKS_BETWEEN_STEPS = 1;

// ─── Types ────────────────────────────────────────────────────────────────────

export type DefectionStep =
  | 'NONE'
  | 'BREAK_PACT'
  | 'SILENT_EXIT'
  | 'ASSET_SEIZURE'
  | 'COMPLETE'
  | 'DETECTED'
  | 'ABANDONED';

export interface DefectionSequenceState {
  currentStep: DefectionStep;
  initiatedAtTick: number;
  lastStepTick: number;
  /** Ticks after which sequence expires if not completed */
  expiresAtTick: number;
  /** Step history for detection */
  stepHistory: Array<{ step: DefectionStep; tick: number }>;
  /** Was defection detected before completion? */
  detected: boolean;
  /** Player who detected it */
  detectedByPlayerId: string | null;
  /** Total runs defected (persists via backend — public on profile) */
  defectionCount: number;
  /** Is the 3-second countdown visible to team right now? */
  countdownActive: boolean;
  /** When the countdown started (ms, wall clock) */
  countdownStartMs: number;
}

export const INITIAL_DEFECTION_STATE: DefectionSequenceState = {
  currentStep:          'NONE',
  initiatedAtTick:      0,
  lastStepTick:         0,
  expiresAtTick:        0,
  stepHistory:          [],
  detected:             false,
  detectedByPlayerId:   null,
  defectionCount:       0,
  countdownActive:      false,
  countdownStartMs:     0,
};

/** Structured suspicion broadcast event (for EventBus routing to teammates) */
export interface SuspicionBroadcastEvent {
  defectorId: string;
  step: DefectionStep;
  suspicionAmount: number;
  tick: number;
  detectable: boolean;
}

/** Audit record exported to CORD/SovereigntyEngine */
export interface DefectionAuditRecord {
  attempted: boolean;
  completed: boolean;
  detected: boolean;
  detectedByPlayerId: string | null;
  stepHistory: Array<{ step: DefectionStep; tick: number }>;
  cordPenalty: number;
  defectionCount: number;
}

const STEP_SEQUENCE: DefectionStep[] = ['BREAK_PACT', 'SILENT_EXIT', 'ASSET_SEIZURE'];

// ─── Step Forward ─────────────────────────────────────────────────────────────

export interface DefectionStepResult {
  success: boolean;
  reason?: 'TOO_EARLY' | 'WRONG_STEP' | 'SEQUENCE_EXPIRED' | 'ALREADY_COMPLETE' | 'ALREADY_DETECTED';
  newState: DefectionSequenceState;
  signalEmitted: boolean;
  /** Structured broadcast event for EventBus */
  broadcastEvent: SuspicionBroadcastEvent | null;
}

export function advanceDefection(
  state: DefectionSequenceState,
  step: DefectionStep,
  defectorId: string,
  currentTick: number,
  nowMs: number,
): DefectionStepResult {

  if (state.currentStep === 'COMPLETE' || state.currentStep === 'DETECTED') {
    return { success: false, reason: 'ALREADY_COMPLETE', newState: state, signalEmitted: false, broadcastEvent: null };
  }

  // Bible: defection only permitted after tick 8
  if (currentTick < SYNDICATE_CONFIG.defectionMinTick && state.currentStep === 'NONE') {
    return { success: false, reason: 'TOO_EARLY', newState: state, signalEmitted: false, broadcastEvent: null };
  }

  // Sequence must be in correct order
  const expectedIdx  = state.currentStep === 'NONE' ? 0 : STEP_SEQUENCE.indexOf(state.currentStep) + 1;
  const expectedStep = STEP_SEQUENCE[expectedIdx];

  if (step !== expectedStep) {
    return { success: false, reason: 'WRONG_STEP', newState: state, signalEmitted: false, broadcastEvent: null };
  }

  // Minimum tick gap between steps (must be ≥1 tick after previous step)
  if (state.currentStep !== 'NONE' && (currentTick - state.lastStepTick) < MIN_TICKS_BETWEEN_STEPS) {
    return { success: false, reason: 'WRONG_STEP', newState: state, signalEmitted: false, broadcastEvent: null };
  }

  // Sequence expiry check
  if (state.currentStep !== 'NONE' && currentTick > state.expiresAtTick) {
    const abandoned = { ...state, currentStep: 'ABANDONED' as DefectionStep, countdownActive: false };
    return { success: false, reason: 'SEQUENCE_EXPIRED', newState: abandoned, signalEmitted: false, broadcastEvent: null };
  }

  const stepHistory = [...state.stepHistory, { step, tick: currentTick }];
  const isComplete  = step === 'ASSET_SEIZURE';
  const newStep: DefectionStep = isComplete ? 'COMPLETE' : step;

  // Countdown activates on ASSET_SEIZURE (final step — bible: 3s visible to team)
  const countdownActive    = isComplete;
  const countdownStartMs   = isComplete ? nowMs : state.countdownStartMs;

  const newState: DefectionSequenceState = {
    ...state,
    currentStep:        newStep,
    lastStepTick:       currentTick,
    initiatedAtTick:    state.currentStep === 'NONE' ? currentTick : state.initiatedAtTick,
    expiresAtTick:      currentTick + SEQUENCE_WINDOW_TICKS,
    stepHistory,
    defectionCount:     isComplete ? state.defectionCount + 1 : state.defectionCount,
    countdownActive,
    countdownStartMs,
  };

  // Suspicion broadcast amounts (higher on later steps — more detectable)
  const suspicionAmount = step === 'BREAK_PACT' ? 0.5 : step === 'SILENT_EXIT' ? 1.2 : 2.5;

  const broadcastEvent: SuspicionBroadcastEvent = {
    defectorId,
    step,
    suspicionAmount,
    tick: currentTick,
    detectable: suspicionAmount >= 1.0,
  };

  return {
    success: true,
    newState,
    signalEmitted: true,
    broadcastEvent,
  };
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Attempt to detect defection in progress.
 * COUNTER_INTEL role significantly improves detection probability.
 */
export function detectDefection(
  state: DefectionSequenceState,
  detectorId: string,
  suspicionLevel: number,
  detectorHasCounterIntel: boolean = false,
): DefectionSequenceState {
  // Can only detect mid-sequence
  if (state.currentStep === 'NONE' || state.currentStep === 'COMPLETE' || state.currentStep === 'DETECTED') {
    return state;
  }

  const detectionProb = getDetectionProbability(suspicionLevel, detectorHasCounterIntel);

  // COUNTER_INTEL baseline detection threshold: 1.5 (vs standard 2.5)
  const threshold = detectorHasCounterIntel ? 1.5 : 2.5;

  if (suspicionLevel < threshold && detectionProb < 0.85) return state;

  return {
    ...state,
    detected:             true,
    detectedByPlayerId:   detectorId,
    currentStep:          'DETECTED',
    countdownActive:      false,
  };
}

// ─── Mirror Defection (edge case: both players defect simultaneously) ─────────

export interface MirrorDefectionResult {
  isMirror: boolean;
  /** If mirror: neither player gets full treasury seizure */
  penaltyMultiplier: number;
}

/**
 * Detects if both players are in defection simultaneously.
 * In mirror defection, both get treasury split evenly and both take -0.15 CORD.
 */
export function detectMirrorDefection(
  stateA: DefectionSequenceState,
  stateB: DefectionSequenceState,
): MirrorDefectionResult {
  const aInProgress = isDefectionInProgress(stateA);
  const bInProgress = isDefectionInProgress(stateB);

  if (aInProgress && bInProgress) {
    return { isMirror: true, penaltyMultiplier: 0.5 }; // treasury split evenly
  }
  return { isMirror: false, penaltyMultiplier: 1.0 };
}

// ─── Asset Seizure Impact ─────────────────────────────────────────────────────

export interface AssetSeizureResult {
  cashSeized: number;
  incomeDrained: number;
  trustCollateral: number;
}

export function computeAssetSeizure(
  defectorCash: number,
  defectorIncome: number,
  sharedTreasuryBalance: number,
): AssetSeizureResult {
  // FIXED: bible says 40% of treasury (was 60%)
  return {
    cashSeized:      Math.round(sharedTreasuryBalance * SYNDICATE_CONFIG.defectionTreasurySeizurePct),
    incomeDrained:   Math.round(defectorIncome * 0.20),
    trustCollateral: 0.85,   // trust drops to floor
  };
}

// ─── CORD Integration ─────────────────────────────────────────────────────────

/** Returns CORD penalty for defector (always -0.15 flat if completed) */
export function getDefectionCORDPenalty(state: DefectionSequenceState): number {
  if (!state.defectionCount) return 0;
  return DEFECTION_CORD_PENALTY;
}

/** Build audit record for SovereigntyEngine */
export function buildDefectionAuditRecord(state: DefectionSequenceState): DefectionAuditRecord {
  return {
    attempted:            state.currentStep !== 'NONE',
    completed:            state.currentStep === 'COMPLETE',
    detected:             state.detected,
    detectedByPlayerId:   state.detectedByPlayerId,
    stepHistory:          [...state.stepHistory],
    cordPenalty:          state.currentStep === 'COMPLETE' ? DEFECTION_CORD_PENALTY : 0,
    defectionCount:       state.defectionCount,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function isDefectionInProgress(state: DefectionSequenceState): boolean {
  return state.currentStep !== 'NONE'
    && state.currentStep !== 'COMPLETE'
    && state.currentStep !== 'DETECTED'
    && state.currentStep !== 'ABANDONED';
}

export function isCountdownVisible(state: DefectionSequenceState, nowMs: number): boolean {
  if (!state.countdownActive) return false;
  return (nowMs - state.countdownStartMs) < DEFECTION_COUNTDOWN_MS;
}

export function getCountdownRemainingMs(state: DefectionSequenceState, nowMs: number): number {
  if (!state.countdownActive) return 0;
  return Math.max(0, DEFECTION_COUNTDOWN_MS - (nowMs - state.countdownStartMs));
}