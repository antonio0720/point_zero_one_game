// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/syndicateEventBridge.ts
// Sprint 5 — Syndicate Event Bridge — NEW FILE
// Density6 LLC · Confidential
//
// Bridges SyndicateEngine EventBus events to SyndicateCardMode hook calls.
// This adapter is the single integration point between the game engine layer
// and the card engine layer — neither layer imports the other directly.
//
// Event routing:
//   PARTNER_DISTRESS      → openRescueWindow()
//   AID_CONTRACT_SIGNED   → activateAidTerms()
//   RESCUE_WINDOW_OPENED  → notify UI
//   RESCUE_WINDOW_EXPIRED → closeRescueWindow()
//   INCOME_CHANGED        → trust impact pipeline
//   DEFECTION_STEP        → suspicion broadcast to teammates
// ═══════════════════════════════════════════════════════════════════════════

import type { TrustScoreState }        from './trustScoreEngine';
import type { DefectionSequenceState } from './defectionSequenceEngine';
import { applyTrustImpact }            from './trustScoreEngine';
import { detectDefection }             from './defectionSequenceEngine';
import { emitWarAlert }                from './rescueWindowEngine';

// ─── Event Payload Types ──────────────────────────────────────────────────────

export interface PartnerDistressPayload {
  distressed: boolean;
  isLocal?: boolean;
  cash?: number;
  label: string;
  partnerCash?: number;
}

export interface AidContractSignedPayload {
  contractId: string;
  type: string;
  amount: number;
  label: string;
  message: string;
}

export interface RescueWindowPayload {
  ticksRemaining: number;
  partnerCash: number;
  message: string;
}

export interface SuspicionBroadcastPayload {
  defectorId: string;
  step: string;
  suspicionAmount: number;
  tick: number;
  detectable: boolean;
}

// ─── Bridge Handlers ──────────────────────────────────────────────────────────

export interface SyndicateBridgeHandlers {
  /** Called when PARTNER_DISTRESS fires — open or close rescue window */
  onPartnerDistress: (payload: PartnerDistressPayload, tick: number, nowMs: number) => void;
  /** Called when AID_CONTRACT_SIGNED fires — activate aid terms in card mode */
  onAidContractSigned: (payload: AidContractSignedPayload, tick: number) => void;
  /** Called when suspicion broadcast from defection sequence needs to reach UI */
  onSuspicionBroadcast: (payload: SuspicionBroadcastPayload, tick: number) => void;
  /** Called when shared market event impacts income — feeds trust pipeline */
  onSharedIncomeEvent: (delta: number, isSyndicate: boolean, tick: number) => void;
  /** Called when rescue window expires — close in card mode */
  onRescueWindowExpired: (teammateId: string, tick: number) => void;
}

/**
 * Routes an incoming PZO engine event to the appropriate card mode action.
 * event.type is the EventBus event name.
 * Returns structured result for caller to act on.
 */
export interface BridgeRoutingResult {
  handled: boolean;
  trustDelta?: number; // trust impact from event (applied by caller)
  rescueAction?: 'OPEN' | 'CLOSE' | 'NONE';
  suspicionBroadcast?: SuspicionBroadcastPayload;
  warAlert?: ReturnType<typeof emitWarAlert>;
}

// ─── Safe Readers ─────────────────────────────────────────────────────────────

function readString(obj: Record<string, unknown>, key: string, fallback = ''): string {
  const v = obj[key];
  return typeof v === 'string' ? v : fallback;
}

function readNumber(obj: Record<string, unknown>, key: string, fallback = 0): number {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function readBoolean(obj: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = obj[key];
  return typeof v === 'boolean' ? v : fallback;
}

function readOptionalNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function readOptionalBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
  const v = obj[key];
  return typeof v === 'boolean' ? v : undefined;
}

// ─── Routing ──────────────────────────────────────────────────────────────────

export function routeEngineToBridge(
  eventType: string,
  payload: Record<string, unknown>,
  tick: number,
  nowMs: number,
  handlers: SyndicateBridgeHandlers,
): BridgeRoutingResult {
  switch (eventType) {
    case 'PARTNER_DISTRESS': {
      const p: PartnerDistressPayload = {
        distressed: readBoolean(payload, 'distressed', false),
        label: readString(payload, 'label', 'PARTNER_DISTRESS'),
        isLocal: readOptionalBoolean(payload, 'isLocal'),
        cash: readOptionalNumber(payload, 'cash'),
        partnerCash: readOptionalNumber(payload, 'partnerCash'),
      };

      handlers.onPartnerDistress(p, tick, nowMs);

      return {
        handled: true,
        rescueAction: p.distressed ? 'OPEN' : 'CLOSE',
      };
    }

    case 'AID_CONTRACT_SIGNED': {
      const p: AidContractSignedPayload = {
        contractId: readString(payload, 'contractId', ''),
        type: readString(payload, 'type', ''),
        amount: readNumber(payload, 'amount', 0),
        label: readString(payload, 'label', 'AID_CONTRACT'),
        message: readString(payload, 'message', ''),
      };

      handlers.onAidContractSigned(p, tick);
      return { handled: true };
    }

    case 'RESCUE_WINDOW_EXPIRED': {
      const teammateId = readString(payload, 'teammateId', 'unknown');
      handlers.onRescueWindowExpired(teammateId, tick);
      return { handled: true, rescueAction: 'CLOSE' };
    }

    case 'INCOME_CHANGED': {
      const delta = readNumber(payload, 'delta', 0);
      const isSyndicate = readBoolean(payload, 'isSyndicate', false);

      handlers.onSharedIncomeEvent(delta, isSyndicate, tick);

      // Shared income events that hurt everyone slightly reduce trust
      const trustDelta = isSyndicate && delta < 0 ? delta * 0.01 : 0;

      return { handled: true, trustDelta };
    }

    case 'DEFECTION_STEP': {
      const suspicionAmount = readNumber(payload, 'suspicionAmount', 0);

      const suspBroadcast: SuspicionBroadcastPayload = {
        defectorId: readString(payload, 'defectorId', ''),
        step: readString(payload, 'step', ''),
        suspicionAmount,
        tick,
        detectable: suspicionAmount >= 1.0,
      };

      handlers.onSuspicionBroadcast(suspBroadcast, tick);

      return { handled: true, suspicionBroadcast: suspBroadcast };
    }

    default:
      return { handled: false };
  }
}

// ─── Trust Impact from Events ─────────────────────────────────────────────────

/**
 * Compute trust impact from a shared market event.
 * Positive events (sector opportunity) slightly boost trust.
 * Negative events (regulatory) slightly reduce trust.
 */
export function computeEventTrustImpact(
  eventIncomeDelta: number,
  eventExpenseDelta: number,
): number {
  const netImpact = eventIncomeDelta - eventExpenseDelta;
  if (netImpact > 0) return 0.01;      // minor trust boost
  if (netImpact < -500) return -0.02;  // significant economic hit → minor trust decay
  return 0;
}

// ─── Defection Detection Pipeline ────────────────────────────────────────────

export interface DetectionAttemptResult {
  detected: boolean;
  updatedDefectionState: DefectionSequenceState;
  updatedTrustState: TrustScoreState;
}

/**
 * When a player receives a suspicion broadcast, attempt detection.
 * Applies trust boost to detector if detection succeeds.
 */
export function processSuspicionBroadcast(
  detectorId: string,
  defectionState: DefectionSequenceState,
  trustState: TrustScoreState,
  suspicionBroadcast: SuspicionBroadcastPayload,
  detectorHasCounterIntel: boolean,
  tick: number,
): DetectionAttemptResult {
  const newDefectionState = detectDefection(
    defectionState,
    detectorId,
    suspicionBroadcast.suspicionAmount,
    detectorHasCounterIntel,
  );

  const detected = newDefectionState.detected && !defectionState.detected;

  // Detection is cooperative — small trust boost
  const newTrustState = detected
    ? applyTrustImpact(trustState, 1.0, tick, 1.0)
    : trustState;

  return {
    detected,
    updatedDefectionState: newDefectionState,
    updatedTrustState: newTrustState,
  };
}