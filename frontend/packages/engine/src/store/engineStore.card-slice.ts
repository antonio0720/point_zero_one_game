// pzo-web/src/store/engineStore.card-slice.ts
//
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE STORE — CARD SLICE
//
// All event names and payload fields sourced directly from:
//   engines/cards/types.ts → CardEventPayloadMap
//   engines/cards/CardUXBridge.ts → emit() call sites
//
// INTEGRATION NOTE:
//   This slice is merged directly into EngineStoreState in engineStore.ts.
//   The store shape is: { ...engineSlices, card: CardEngineStoreSlice }
//   SliceSet here targets { card: CardEngineStoreSlice } — the card sub-key.
//
// PAYLOAD FIELD AUDIT:
//   COUNTER_WINDOW_OPENED/CLOSED: payload.triggerAttackId (NOT payload.attackId)
//   DECISION_WINDOW_OPENED:       payload.autoResolveChoice (NOT autoResolveResult)
//   FORCED_CARD_RESOLVED:         filter by instanceId (NOT definition.cardId)
//   CARD_HELD:                    adds isPaused=true to openedDecisionWindows window
//   CARD_UNHELD:                  recalculates openedAtMs for rAF resume
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  CardInHand,
  HoldSlot,
  DecisionRecord,
  ForcedCardEntry,
  MissedOpportunityRecord,
  PhaseBoundaryWindow,
  AidCardTerms,
  CardEffectResult,
  CardEventPayloadMap,
  LegendMarkerType,
  DefectionStep,
  RunPhase,
} from '../cards/types';
import type { EventBus } from '../zero/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// LIVE DECISION WINDOW
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveDecisionWindow {
  windowId:        string;
  cardInstanceId:  string;
  cardId:          string;
  durationMs:      number;
  remainingMs:     number;
  /** Wall-clock ms at window open — drives rAF progress in useDecisionWindow. */
  openedAtMs:      number;
  /** True while Empire hold is active — freezes rAF ring at current position. */
  isPaused:        boolean;
  isResolved:      boolean;
  isExpired:       boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD ENGINE STORE SLICE
// ─────────────────────────────────────────────────────────────────────────────

export interface CardEngineStoreSlice {
  hand:                    CardInHand[];
  forcedCards:             CardInHand[];
  holdSlot:                HoldSlot | null;
  openDecisionWindows:     Record<string, LiveDecisionWindow>;
  lastPlayedCard:          CardInHand | null;
  missedOpportunityStreak: number;
  lastMissRecord:          MissedOpportunityRecord | null;
  isReplenishing:          boolean;
  deckRemaining:           number;

  // Mode: Predator (HEAD_TO_HEAD)
  battleBudget:                 number;
  battleBudgetMax:              number;
  counterWindowOpen:            boolean;
  counterWindowTriggerAttackId: string | null;

  // Mode: Syndicate (TEAM_UP)
  trustScore:             number;
  trustMultiplier:        number;
  rescueWindowOpen:       boolean;
  rescueWindowTeammateId: string | null;
  activeAidTerms:         AidCardTerms[];
  defectionHistory:       DefectionStep[];

  // Mode: Phantom (CHASE_A_LEGEND)
  divergenceScore: number;
  currentGap:      number;
  legendMarkers:   Record<LegendMarkerType, number>;
  unlockedBadges:  string[];

  // Mode: Empire (GO_ALONE)
  chainSynergyActive:     boolean;
  chainSynergyMultiplier: number;
  currentPhase:           RunPhase;
  phaseBoundaryOpen:      boolean;
  holdsRemaining:         number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT SLICE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function defaultCardSlice(): CardEngineStoreSlice {
  return {
    hand:                    [],
    forcedCards:             [],
    holdSlot:                null,
    openDecisionWindows:     {},
    lastPlayedCard:          null,
    missedOpportunityStreak: 0,
    lastMissRecord:          null,
    isReplenishing:          false,
    deckRemaining:           0,

    battleBudget:                 0,
    battleBudgetMax:              200,
    counterWindowOpen:            false,
    counterWindowTriggerAttackId: null,

    trustScore:             50,
    trustMultiplier:        1.0,
    rescueWindowOpen:       false,
    rescueWindowTeammateId: null,
    activeAidTerms:         [],
    defectionHistory:       [],

    divergenceScore: 0,
    currentGap:      1.0,
    legendMarkers: {
      GOLD:   0,
      RED:    0,
      PURPLE: 0,
      SILVER: 0,
      BLACK:  0,
    } as Record<LegendMarkerType, number>,
    unlockedBadges: [],

    chainSynergyActive:     false,
    chainSynergyMultiplier: 1.0,
    currentPhase:           'FOUNDATION' as RunPhase,
    phaseBoundaryOpen:      false,
    holdsRemaining:         1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER SET TYPE
// Targets the merged store shape. SliceSet writes to state.card.
// ─────────────────────────────────────────────────────────────────────────────

export type SliceSet = (
  updater: (state: { card: CardEngineStoreSlice }) => void
) => void;

// ─────────────────────────────────────────────────────────────────────────────
// CARD STORE HANDLERS
// Every payload field name verified against cards/types.ts CardEventPayloadMap.
// ─────────────────────────────────────────────────────────────────────────────

export const cardStoreHandlers = {

  // ── Hand lifecycle ──────────────────────────────────────────────────────────

  CARD_DRAWN: (set: SliceSet, _payload: CardEventPayloadMap['CARD_DRAWN']) => {
    // Full hand state arrives via CARD_HAND_SNAPSHOT. CARD_DRAWN triggers draw animation flag only.
    set(state => { state.card.isReplenishing = true; });
  },

  CARD_HAND_SNAPSHOT: (set: SliceSet, _payload: CardEventPayloadMap['CARD_HAND_SNAPSHOT']) => {
    // Clears replenishing flag. Hand contents injected via injectHandSnapshot().
    set(state => { state.card.isReplenishing = false; });
  },

  CARD_PLAYED: (set: SliceSet, payload: CardEventPayloadMap['CARD_PLAYED']) => {
    set(state => {
      const played = state.card.hand.find(c => c.instanceId === payload.instanceId) ?? null;
      state.card.hand    = state.card.hand.filter(c => c.instanceId !== payload.instanceId);
      state.card.forcedCards = state.card.forcedCards.filter(c => c.instanceId !== payload.instanceId);
      const { [payload.instanceId]: _removed, ...remainingWindows } = state.card.openDecisionWindows;
      state.card.openDecisionWindows     = remainingWindows;
      state.card.lastPlayedCard          = played;
      state.card.missedOpportunityStreak = 0;
    });
  },

  CARD_AUTO_RESOLVED: (set: SliceSet, payload: CardEventPayloadMap['CARD_AUTO_RESOLVED']) => {
    set(state => {
      state.card.hand        = state.card.hand.filter(c => c.instanceId !== payload.instanceId);
      state.card.forcedCards = state.card.forcedCards.filter(c => c.instanceId !== payload.instanceId);
      const existing = state.card.openDecisionWindows[payload.instanceId];
      if (existing) {
        state.card.openDecisionWindows[payload.instanceId] = {
          ...existing,
          isExpired:   true,
          remainingMs: 0,
        };
      }
    });
  },

  // ── Decision windows ────────────────────────────────────────────────────────

  // Field: autoResolveChoice (NOT autoResolveResult)
  DECISION_WINDOW_OPENED: (set: SliceSet, payload: CardEventPayloadMap['DECISION_WINDOW_OPENED']) => {
    set(state => {
      state.card.openDecisionWindows[payload.cardInstanceId] = {
        windowId:       payload.windowId,
        cardInstanceId: payload.cardInstanceId,
        cardId:         payload.cardId,
        durationMs:     payload.durationMs,
        remainingMs:    payload.durationMs,
        openedAtMs:     Date.now(),
        isPaused:       false,
        isResolved:     false,
        isExpired:      false,
      } satisfies LiveDecisionWindow;
    });
  },

  DECISION_WINDOW_EXPIRED: (set: SliceSet, payload: CardEventPayloadMap['DECISION_WINDOW_EXPIRED']) => {
    set(state => {
      const existing = state.card.openDecisionWindows[payload.cardInstanceId];
      if (existing) {
        state.card.openDecisionWindows[payload.cardInstanceId] = {
          ...existing,
          remainingMs: 0,
          isExpired:   true,
        };
      }
    });
  },

  DECISION_WINDOW_RESOLVED: (set: SliceSet, payload: CardEventPayloadMap['DECISION_WINDOW_RESOLVED']) => {
    set(state => {
      const existing = state.card.openDecisionWindows[payload.cardInstanceId];
      if (existing) {
        state.card.openDecisionWindows[payload.cardInstanceId] = {
          ...existing,
          isResolved: true,
        };
      }
    });
  },

  // ── Hold system (Empire / GO_ALONE) ─────────────────────────────────────────

  CARD_HELD: (set: SliceSet, payload: CardEventPayloadMap['CARD_HELD']) => {
    set(state => {
      const heldCard = state.card.hand.find(c => c.instanceId === payload.instanceId);
      if (heldCard) {
        state.card.holdSlot = {
          card:        heldCard,
          heldAtTick:  payload.tickIndex,
          heldAtMs:    Date.now(),
          remainingMs: payload.remainingMs,
        } satisfies HoldSlot;
      }
      const existing = state.card.openDecisionWindows[payload.instanceId];
      if (existing) {
        state.card.openDecisionWindows[payload.instanceId] = { ...existing, isPaused: true };
      }
      state.card.hand = state.card.hand.map(c =>
        c.instanceId === payload.instanceId ? ({ ...c, isHeld: true } as CardInHand) : c
      );
      state.card.holdsRemaining = Math.max(0, state.card.holdsRemaining - 1);
    });
  },

  CARD_UNHELD: (set: SliceSet, payload: CardEventPayloadMap['CARD_UNHELD']) => {
    set(state => {
      const existing = state.card.openDecisionWindows[payload.instanceId];
      if (existing) {
        state.card.openDecisionWindows[payload.instanceId] = {
          ...existing,
          isPaused:   false,
          // Recalculate openedAtMs so rAF resumes from exact freeze point
          openedAtMs: Date.now() - (existing.durationMs - existing.remainingMs),
        };
      }
      state.card.holdSlot = null;
      state.card.hand = state.card.hand.map(c =>
        c.instanceId === payload.instanceId ? ({ ...c, isHeld: false } as CardInHand) : c
      );
    });
  },

  // ── Forced cards ────────────────────────────────────────────────────────────

  FORCED_CARD_INJECTED: (_set: SliceSet, _payload: CardEventPayloadMap['FORCED_CARD_INJECTED']) => {
    // Card materializes in hand via CARD_DRAWN + injectHandSnapshot.
  },

  // Filter by instanceId — definitive identity (multiple instances of same cardId possible)
  FORCED_CARD_RESOLVED: (set: SliceSet, payload: CardEventPayloadMap['FORCED_CARD_RESOLVED']) => {
    set(state => {
      state.card.forcedCards = state.card.forcedCards.filter(
        c => c.instanceId !== payload.instanceId
      );
    });
  },

  // ── Missed opportunity ──────────────────────────────────────────────────────

  MISSED_OPPORTUNITY: (set: SliceSet, payload: CardEventPayloadMap['MISSED_OPPORTUNITY']) => {
    set(state => {
      state.card.missedOpportunityStreak = payload.streakCount;
      state.card.lastMissRecord = {
        cardId:       payload.cardId,
        instanceId:   payload.instanceId,
        missedAtTick: payload.tickIndex,
        cordLost:     payload.cordLost,
        streakCount:  payload.streakCount,
      } satisfies MissedOpportunityRecord;
    });
  },

  // ── Predator: Counter window ────────────────────────────────────────────────

  // Field: triggerAttackId (NOT attackId)
  COUNTER_WINDOW_OPENED: (set: SliceSet, payload: CardEventPayloadMap['COUNTER_WINDOW_OPENED']) => {
    set(state => {
      state.card.counterWindowOpen            = true;
      state.card.counterWindowTriggerAttackId = payload.triggerAttackId;
    });
  },

  COUNTER_WINDOW_CLOSED: (set: SliceSet, _payload: CardEventPayloadMap['COUNTER_WINDOW_CLOSED']) => {
    set(state => {
      state.card.counterWindowOpen            = false;
      state.card.counterWindowTriggerAttackId = null;
    });
  },

  // ── Syndicate: Rescue window ────────────────────────────────────────────────

  RESCUE_WINDOW_OPENED: (set: SliceSet, payload: CardEventPayloadMap['RESCUE_WINDOW_OPENED']) => {
    set(state => {
      state.card.rescueWindowOpen       = true;
      state.card.rescueWindowTeammateId = payload.teammateId;
    });
  },

  RESCUE_WINDOW_CLOSED: (set: SliceSet, _payload: CardEventPayloadMap['RESCUE_WINDOW_CLOSED']) => {
    set(state => {
      state.card.rescueWindowOpen       = false;
      state.card.rescueWindowTeammateId = null;
    });
  },

  // ── Syndicate: Defection arc ────────────────────────────────────────────────

  DEFECTION_STEP_PLAYED: (set: SliceSet, payload: CardEventPayloadMap['DEFECTION_STEP_PLAYED']) => {
    set(state => {
      state.card.defectionHistory = [...state.card.defectionHistory, payload.step];
    });
  },

  // ── Syndicate: AID contract lifecycle ──────────────────────────────────────

  AID_TERMS_ACTIVATED: (set: SliceSet, payload: CardEventPayloadMap['AID_TERMS_ACTIVATED']) => {
    set(state => {
      state.card.activeAidTerms = [...state.card.activeAidTerms, payload.terms];
    });
  },

  AID_REPAID: (set: SliceSet, payload: CardEventPayloadMap['AID_REPAID']) => {
    set(state => {
      state.card.activeAidTerms = state.card.activeAidTerms.filter(
        t => !(t.lenderId === payload.lenderId && t.receiverId === payload.receiverId)
      );
      const newScore = Math.min(100, state.card.trustScore + 5);
      state.card.trustScore      = newScore;
      state.card.trustMultiplier = computeTrustMultiplier(newScore);
    });
  },

  // Field: penaltyApplied (NOT trustPenalty)
  AID_DEFAULTED: (set: SliceSet, payload: CardEventPayloadMap['AID_DEFAULTED']) => {
    set(state => {
      const newScore = Math.max(0, state.card.trustScore - payload.penaltyApplied);
      state.card.trustScore      = newScore;
      state.card.trustMultiplier = computeTrustMultiplier(newScore);
    });
  },

  // ── Phantom: Ghost card ─────────────────────────────────────────────────────

  GHOST_CARD_ACTIVATED: (set: SliceSet, payload: CardEventPayloadMap['GHOST_CARD_ACTIVATED']) => {
    set(state => {
      state.card.divergenceScore += payload.divergenceDelta;
      state.card.legendMarkers[payload.markerType] =
        (state.card.legendMarkers[payload.markerType] ?? 0) + 1;
    });
  },

  // ── Phantom: Proof badge ────────────────────────────────────────────────────

  PROOF_BADGE_CONDITION_MET: (set: SliceSet, payload: CardEventPayloadMap['PROOF_BADGE_CONDITION_MET']) => {
    set(state => {
      if (!state.card.unlockedBadges.includes(payload.badgeId)) {
        state.card.unlockedBadges = [...state.card.unlockedBadges, payload.badgeId];
      }
    });
  },

  // ── Empire: Phase boundary ──────────────────────────────────────────────────

  PHASE_BOUNDARY_CARD_AVAILABLE: (
    set: SliceSet,
    payload: CardEventPayloadMap['PHASE_BOUNDARY_CARD_AVAILABLE'],
  ) => {
    set(state => {
      state.card.phaseBoundaryOpen = true;
      state.card.currentPhase      = payload.phase;
    });
  },

  PHASE_BOUNDARY_WINDOW_CLOSED: (
    set: SliceSet,
    _payload: CardEventPayloadMap['PHASE_BOUNDARY_WINDOW_CLOSED'],
  ) => {
    set(state => { state.card.phaseBoundaryOpen = false; });
  },

  // ── Legendary draw fanfare ──────────────────────────────────────────────────

  // UI hook owns fanfare side-effect. Hand updated via CARD_DRAWN + injectHandSnapshot.
  LEGENDARY_CARD_DRAWN: (
    _set: SliceSet,
    _payload: CardEventPayloadMap['LEGENDARY_CARD_DRAWN'],
  ) => { /* intentionally empty */ },

} as const;

// ─────────────────────────────────────────────────────────────────────────────
// WIRE CARD ENGINE HANDLERS
//
// Registers all CardUXBridge EventBus subscriptions.
// Returns aggregate unsubscribe — call in cleanup / endRun().
//
// Called by ModeRouter.startRunWithCards() after CardEngine initialization,
// NOT by wireAllEngineHandlers() — CardEngine uses a separate EventBus instance.
//
// Usage:
//   const unsubCard = wireCardEngineHandlers(cardEventBus, useEngineStore.setState);
//   // On run end:
//   unsubCard();
// ─────────────────────────────────────────────────────────────────────────────

export function wireCardEngineHandlers(
  eventBus: EventBus,
  set: SliceSet,
): () => void {
  const unsubs: Array<() => void> = [];

  const wire = <K extends keyof typeof cardStoreHandlers>(eventName: K) => {
    const handler = cardStoreHandlers[eventName] as (s: SliceSet, p: any) => void;
    const unsub = (eventBus as any).on(eventName, (rawEvent: any) => {
      const payload = rawEvent?.payload ?? rawEvent;
      handler(set, payload);
    });
    if (typeof unsub === 'function') unsubs.push(unsub);
  };

  wire('CARD_DRAWN');
  wire('CARD_HAND_SNAPSHOT');
  wire('CARD_PLAYED');
  wire('CARD_AUTO_RESOLVED');
  wire('DECISION_WINDOW_OPENED');
  wire('DECISION_WINDOW_EXPIRED');
  wire('DECISION_WINDOW_RESOLVED');
  wire('CARD_HELD');
  wire('CARD_UNHELD');
  wire('FORCED_CARD_INJECTED');
  wire('FORCED_CARD_RESOLVED');
  wire('MISSED_OPPORTUNITY');
  wire('COUNTER_WINDOW_OPENED');
  wire('COUNTER_WINDOW_CLOSED');
  wire('RESCUE_WINDOW_OPENED');
  wire('RESCUE_WINDOW_CLOSED');
  wire('DEFECTION_STEP_PLAYED');
  wire('AID_TERMS_ACTIVATED');
  wire('AID_REPAID');
  wire('AID_DEFAULTED');
  wire('GHOST_CARD_ACTIVATED');
  wire('PROOF_BADGE_CONDITION_MET');
  wire('PHASE_BOUNDARY_CARD_AVAILABLE');
  wire('PHASE_BOUNDARY_WINDOW_CLOSED');
  wire('LEGENDARY_CARD_DRAWN');

  return () => unsubs.forEach(u => u());
}

// ─────────────────────────────────────────────────────────────────────────────
// HAND INJECTOR
//
// Called from EngineOrchestrator bridge after each CardEngine.tick() completes.
// Canonical mechanism to push full CardInHand[] into the store.
// ─────────────────────────────────────────────────────────────────────────────

export function injectHandSnapshot(
  set: SliceSet,
  hand: CardInHand[],
  deckRemaining: number,
  opts?: {
    battleBudget?:           number;
    chainSynergyActive?:     boolean;
    chainSynergyMultiplier?: number;
    divergenceScore?:        number;
    currentGap?:             number;
    trustScore?:             number;
  },
): void {
  set(state => {
    state.card.hand           = hand;
    state.card.forcedCards    = hand.filter(c => c.isForced);
    state.card.deckRemaining  = deckRemaining;
    state.card.isReplenishing = false;

    if (opts?.battleBudget           !== undefined) state.card.battleBudget           = opts.battleBudget;
    if (opts?.chainSynergyActive     !== undefined) state.card.chainSynergyActive     = opts.chainSynergyActive;
    if (opts?.chainSynergyMultiplier !== undefined) state.card.chainSynergyMultiplier = opts.chainSynergyMultiplier;
    if (opts?.divergenceScore        !== undefined) state.card.divergenceScore        = opts.divergenceScore;
    if (opts?.currentGap             !== undefined) state.card.currentGap             = opts.currentGap;
    if (opts?.trustScore             !== undefined) {
      state.card.trustScore      = opts.trustScore;
      state.card.trustMultiplier = computeTrustMultiplier(opts.trustScore);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trust Score (0–100) → multiplier for Syndicate mode.
 * Mirrors SyndicateCardMode.getTrustMultiplier().
 *   0–50:  0.5 → 1.0 (linear)
 *   51–100: 1.0 → 1.5 (linear)
 */
export function computeTrustMultiplier(trustScore: number): number {
  if (trustScore <= 50) return 0.5 + (trustScore / 50) * 0.5;
  return 1.0 + ((trustScore - 50) / 50) * 0.5;
}