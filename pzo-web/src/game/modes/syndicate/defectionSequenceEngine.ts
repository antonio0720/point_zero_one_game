// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/defectionSequenceEngine.ts
// Sprint 5 — Defection Sequence System
//
// Defection is a 3-card sequence, not a button.
// BREAK_PACT → SILENT_EXIT → ASSET_SEIZURE
// Each step is detectable by sharp teammates.
// Sequence must complete within 60 ticks or resets.
// ═══════════════════════════════════════════════════════════════════════════

import { SYNDICATE_CONFIG } from './syndicateConfig';

export type DefectionStep = 'NONE' | 'BREAK_PACT' | 'SILENT_EXIT' | 'ASSET_SEIZURE' | 'COMPLETE' | 'DETECTED' | 'ABANDONED';

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
  /** Total runs defected (persists via backend) */
  defectionCount: number;
}

export const INITIAL_DEFECTION_STATE: DefectionSequenceState = {
  currentStep: 'NONE',
  initiatedAtTick: 0,
  lastStepTick: 0,
  expiresAtTick: 0,
  stepHistory: [],
  detected: false,
  detectedByPlayerId: null,
  defectionCount: 0,
};

const STEP_SEQUENCE: DefectionStep[] = ['BREAK_PACT', 'SILENT_EXIT', 'ASSET_SEIZURE'];
const SEQUENCE_WINDOW_TICKS = 60;

// ─── Step Forward ─────────────────────────────────────────────────────────────

export interface DefectionStepResult {
  success: boolean;
  reason?: string;
  newState: DefectionSequenceState;
  signalEmitted: boolean;
  /** Suspicion increase to broadcast to teammates */
  suspicionBroadcast: number;
}

export function advanceDefection(
  state: DefectionSequenceState,
  step: DefectionStep,
  currentTick: number,
): DefectionStepResult {
  // Can't defect before minimum tick
  if (currentTick < SYNDICATE_CONFIG.defectionMinTick && state.currentStep === 'NONE') {
    return { success: false, reason: 'TOO_EARLY', newState: state, signalEmitted: false, suspicionBroadcast: 0 };
  }

  // Sequence must be in correct order
  const expectedIdx = state.currentStep === 'NONE' ? 0
    : STEP_SEQUENCE.indexOf(state.currentStep) + 1;
  const expectedStep = STEP_SEQUENCE[expectedIdx];

  if (step !== expectedStep) {
    return { success: false, reason: 'WRONG_STEP', newState: state, signalEmitted: false, suspicionBroadcast: 0 };
  }

  // Sequence expiry check
  if (state.currentStep !== 'NONE' && currentTick > state.expiresAtTick) {
    const abandoned = { ...state, currentStep: 'ABANDONED' as DefectionStep };
    return { success: false, reason: 'SEQUENCE_EXPIRED', newState: abandoned, signalEmitted: false, suspicionBroadcast: 0 };
  }

  const stepHistory = [...state.stepHistory, { step, tick: currentTick }];
  const isComplete = step === 'ASSET_SEIZURE';
  const newStep: DefectionStep = isComplete ? 'COMPLETE' : step;

  const newState: DefectionSequenceState = {
    ...state,
    currentStep: newStep,
    lastStepTick: currentTick,
    initiatedAtTick: state.currentStep === 'NONE' ? currentTick : state.initiatedAtTick,
    expiresAtTick: currentTick + SEQUENCE_WINDOW_TICKS,
    stepHistory,
    defectionCount: isComplete ? state.defectionCount + 1 : state.defectionCount,
  };

  // Higher suspicion signal on later steps (more detectable)
  const suspicionBroadcast = step === 'BREAK_PACT' ? 0.5
    : step === 'SILENT_EXIT' ? 1.2
    : 2.5;

  return {
    success: true,
    newState,
    signalEmitted: true,
    suspicionBroadcast,
  };
}

// ─── Detection ────────────────────────────────────────────────────────────────

export function detectDefection(
  state: DefectionSequenceState,
  detectorId: string,
  suspicionLevel: number,
): DefectionSequenceState {
  // Can only detect mid-sequence (not NONE or COMPLETE)
  if (state.currentStep === 'NONE' || state.currentStep === 'COMPLETE') return state;
  if (suspicionLevel < 2.5) return state; // not enough evidence

  return { ...state, detected: true, detectedByPlayerId: detectorId, currentStep: 'DETECTED' };
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
  return {
    cashSeized:       Math.round(sharedTreasuryBalance * 0.60),   // 60% of shared treasury
    incomeDrained:    Math.round(defectorIncome * 0.20),           // 20% monthly income drain
    trustCollateral:  0.85,                                        // trust drops to floor
  };
}

export function isDefectionInProgress(state: DefectionSequenceState): boolean {
  return state.currentStep !== 'NONE'
    && state.currentStep !== 'COMPLETE'
    && state.currentStep !== 'DETECTED'
    && state.currentStep !== 'ABANDONED';
}
