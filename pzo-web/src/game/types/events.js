"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/events.ts
// Sprint 8 — Full Rebuild
//
// CHANGES FROM SPRINT 0:
//   ✦ RunEvent union EXPANDED: +50 engine events sourced from
//     engines/zero/types.ts EngineEventPayloadMap (all 8 engine groups)
//   ✦ ADD ModeEventName type — all EMPIRE_* | PREDATOR_* | SYNDICATE_* |
//     PHANTOM_* strings from modeEventTypes.ts
//   ✦ ADD ModeEventPayloadMap — typed payloads for all 35 mode events
//   ✦ ADD EngineEventName type — re-export alias for zero/types.ts events
//   ✦ ForcedEventType declared locally (deprecated compat alias)
//   ✦ RunOutcome re-exported from cord.ts (canonical home)
//
// SPRINT 8 PATCH — All imports now fully consumed in event payloads:
//   ✦ DeckType         → CARD_DRAWN.deckType, FORCED_EVENT_TRIGGERED.deckType
//   ✦ CardRarity       → CARD_DRAWN.rarity, LEGENDARY_CARD_DRAWN.rarity
//   ✦ ForcedCardSource → FORCED_EVENT_TRIGGERED.source (typed, replaces string)
//   ✦ LegendMarkerType → PHANTOM_MARKER_CAPTURED (new), PHANTOM_GHOST_DELTA_UPDATE.dominantMarker
//   ✦ RunPhase         → EMPIRE_PHASE_CHANGED.from / .to (was string)
//   ✦ AidCardTerms     → SYNDICATE_AID_CONTRACT_SIGNED.terms, AID_SUBMITTED.terms
//   ✦ CordTier         → RUN_COMPLETED.cordTier, RUN_REWARD_DISPATCHED.cordTier
//   ✦ BadgeTier        → PHANTOM_PROOF_BADGE_EARNED.tier (was string), RUN_REWARD_DISPATCHED.badgeTier
//
// ARCHITECTURE:
//   RunEvent        — consumed by runReducer (game state layer)
//   EngineEventName — consumed by engineStore (engine layer)
//   ModeEventName   — emitted on globalEventBus by mode engines
//
// RULES:
//   ✦ No circular deps — imports from ./modes, ./cards, ./cord,
//     ./battlePhase, ./runState only.
//   ✦ Zero runtime logic — pure TypeScript declarations only.
//
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=events.js.map