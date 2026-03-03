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

import type { GameMode }                               from './modes';
import type {
  CardInHand,
  DeckType,
  CardRarity,
  ForcedCardSource,
  DefectionStep,
  LegendMarkerType,
  RunPhase,
  AidCardTerms,
}                                                      from './cards';
import type { MarketRegime, BattleState }              from './runState';
import type { BattlePhase, ExtractionActionType }      from './battlePhase';
import type {
  RunOutcome,
  CordTier,
  ExtendedGrade,
  BadgeTier,
  IntegrityStatus,
}                                                      from './cord';

// Re-export for consumers of events.ts
export type { RunOutcome } from './cord';

// ── Engine ID Strings ─────────────────────────────────────────────────────────
/**
 * The 7 engine IDs — re-declared here to stay import-free from engine layer.
 * Canonical source: engines/zero/types.ts EngineId enum.
 */
export type EngineId =
  | 'TIME_ENGINE'
  | 'PRESSURE_ENGINE'
  | 'TENSION_ENGINE'
  | 'SHIELD_ENGINE'
  | 'BATTLE_ENGINE'
  | 'CASCADE_ENGINE'
  | 'SOVEREIGNTY_ENGINE';

// ── Forced Event Type ─────────────────────────────────────────────────────────
/**
 * Force-event types used by forcedEventEngine.
 * @deprecated Canonical type is ForcedCardSource in cards.ts.
 * Preserved for backward compat with existing engine consumers.
 */
export type ForcedEventType =
  | 'FUBAR_HIT'
  | 'MISSED_WINDOW'
  | 'OBSTACLE_SPAWN'
  | 'SABOTAGE_INJECT'
  | 'LEGEND_PRESSURE'
  | 'ISOLATION_TAX'
  | 'BLEED_TICK';

// ── Run Event Union ───────────────────────────────────────────────────────────
/**
 * Complete discriminated union of ALL events consumed by runReducer.
 *
 * Sprint 8: Expanded from 23 events to 85+ events, sourced from:
 *   - engines/zero/types.ts EngineEventPayloadMap (all 8 engine groups)
 *   - modes/shared/modeEventTypes.ts (all 4 mode groups)
 *
 * Groups:
 *   1.  Run lifecycle (5)
 *   2.  Card events (12)
 *   3.  Forced events (3)
 *   4.  Economy (6)
 *   5.  Battle / PvP (6)
 *   6.  Syndicate co-op (6)
 *   7.  Season / ML (3)
 *   8.  Telemetry (2)
 *   9.  Time engine (8)
 *   10. Pressure engine (3)
 *   11. Tension engine (7)
 *   12. Shield engine (6)
 *   13. Battle engine (8)
 *   14. Cascade engine (13)
 *   15. Sovereignty engine (4)
 *   16. Orchestrator lifecycle (4)
 *   17. Empire mode events (7)
 *   18. Predator mode events (11)
 *   19. Syndicate mode events (13)
 *   20. Phantom mode events (10)  ← +PHANTOM_MARKER_CAPTURED
 */
export type RunEvent =

  // ── 1. Run Lifecycle ────────────────────────────────────────────────────
  | { type: 'RUN_START';           mode: GameMode; seed: number }
  | { type: 'RUN_COMPLETE';        outcome: RunOutcome; tick: number }
  | { type: 'TICK_ADVANCE';        tick: number }
  | { type: 'SCREEN_TRANSITION';   to: 'run' | 'result' | 'bankrupt' | 'landing' | 'lobby' }
  | { type: 'RUN_ABANDONED' }

  // ── 2. Card Events ──────────────────────────────────────────────────────
  //   CARD_DRAWN:          deckType: DeckType  — deck routing recorded at draw
  //                        rarity: CardRarity  — rarity pulled from CardDefinition
  //   LEGENDARY_CARD_DRAWN: rarity: CardRarity — always LEGENDARY, typed for switch exhaustiveness
  | { type: 'CARD_PLAY_REQUESTED';  cardId: string }
  | { type: 'CARD_PLAY_RESOLVED';   card: CardInHand; cashDelta: number; incomeDelta: number; netWorthDelta: number }
  | { type: 'CARD_PLAY_REJECTED';   cardId: string; reason: 'INSUFFICIENT_CASH' | 'NOT_MANUALLY_PLAYABLE' | 'POLICY_DENIED' | 'TIMING_VIOLATION' | 'INSUFFICIENT_BB' }
  | { type: 'CARD_DRAWN';           card: CardInHand; deckType: DeckType; rarity: CardRarity }
  | { type: 'CARD_HELD';            cardId: string; instanceId: string }
  | { type: 'CARD_UNHELD';          cardId: string; instanceId: string }
  | { type: 'CARD_DISCARDED';       cardId: string; instanceId: string; reason: string }
  | { type: 'CARD_FUBAR_BLOCKED';   cardId: string; shieldSpent: boolean }
  | { type: 'CARD_AUTO_RESOLVED';   cardId: string; instanceId: string; autoChoice: string; speedScore: number }
  | { type: 'LEGENDARY_CARD_DRAWN'; cardId: string; instanceId: string; rarity: CardRarity }
  | { type: 'MISSED_OPPORTUNITY';   cardId: string; instanceId: string; cordLost: number }
  | { type: 'HAND_SNAPSHOT';        handSize: number; forcedCount: number; windowsActive: number }

  // ── 3. Forced Events ────────────────────────────────────────────────────
  //   FORCED_EVENT_TRIGGERED: source: ForcedCardSource — typed canonical injection source
  //                           deckType: DeckType        — which deck the injected card belongs to
  | { type: 'FORCED_EVENT_TRIGGERED'; eventType: ForcedEventType; cardId: string; source: ForcedCardSource; deckType: DeckType }
  | { type: 'COUNTERPLAY_OFFERED';    eventLabel: string; adjustedHit: number }
  | { type: 'COUNTERPLAY_RESOLVED';   actionId: string; success: boolean; costSpent: number }

  // ── 4. Economy ──────────────────────────────────────────────────────────
  | { type: 'MONTHLY_SETTLEMENT';     settlement: number; cashflow: number; mlMod: number }
  | { type: 'REGIME_CHANGED';         regime: MarketRegime }
  | { type: 'SHIELD_PROC';            cashSaved: number; shieldsRemaining: number }
  | { type: 'SHIELD_CONSUMED';        layerId: string }
  | { type: 'FREEZE_APPLIED';         ticks: number; source: string }
  | { type: 'HATER_HEAT_CHANGED';     newHeat: number; delta: number }

  // ── 5. Battle / PvP ─────────────────────────────────────────────────────
  | { type: 'SABOTAGE_RECEIVED';      sabotageId: string; kind: ExtractionActionType; sourceDisplayName: string; intensity: number }
  | { type: 'SABOTAGE_COUNTERED';     sabotageId: string; actionId: string }
  | { type: 'BATTLE_PHASE_CHANGED';   phase: BattlePhase }
  | { type: 'BATTLE_SCORE_UPDATE';    local: number; opponent: number }
  | { type: 'BATTLE_BUDGET_CHANGED';  newBudget: number; delta: number }
  | { type: 'EXTRACTION_FIRED';       extractionId: string; kind: ExtractionActionType; bbCost: number }

  // ── 6. Syndicate Co-op ──────────────────────────────────────────────────
  //   AID_SUBMITTED: terms: AidCardTerms — full typed contract at submission
  | { type: 'RESCUE_WINDOW_OPENED';   rescueeDisplayName: string; ticksRemaining: number; windowId: string }
  | { type: 'RESCUE_CONTRIBUTION';    amount: number; windowId: string }
  | { type: 'RESCUE_DISMISSED' }
  | { type: 'AID_SUBMITTED';          recipientId: string; aidType: string; amount: number; terms: AidCardTerms }
  | { type: 'TRUST_SCORE_CHANGED';    newScore: number; delta: number; reason: string }
  | { type: 'DEFECTION_STEP_PLAYED';  step: DefectionStep; defectorId: string }

  // ── 7. Season / ML ──────────────────────────────────────────────────────
  | { type: 'SEASON_PULSE';           xpGained: number; dominionDelta: number }
  | { type: 'INTELLIGENCE_UPDATE';    alphaDelta: number; riskDelta: number }
  | { type: 'CORD_PREVIEW_UPDATE';    cordPreview: number }

  // ── 8. Telemetry ────────────────────────────────────────────────────────
  | { type: 'TELEMETRY_EMIT';         telemetryType: string; payload: Record<string, number | string | boolean | null> }
  | { type: 'MECHANIC_TOUCHED';       mechanicId: string; signal: number }

  // ── 9. Time Engine ──────────────────────────────────────────────────────
  | { type: 'TICK_START';              tickIndex: number; tickDurationMs: number }
  | { type: 'TICK_COMPLETE';           tickIndex: number; tickDurationMs: number; outcome: RunOutcome | null }
  | { type: 'TICK_TIER_CHANGED';       from: string; to: string; transitionTicks: number }
  | { type: 'TICK_TIER_FORCED';        tier: string; durationTicks: number }
  | { type: 'DECISION_WINDOW_OPENED';  windowId: string; cardId: string; cardInstanceId: string; durationMs: number; autoResolveChoice: string }
  | { type: 'DECISION_WINDOW_EXPIRED'; windowId: string; cardId: string; autoChoice: string; speedScore: number }
  | { type: 'DECISION_WINDOW_RESOLVED'; windowId: string; cardId: string; choiceId: string; resolvedInMs: number; wasOptimal: boolean }
  | { type: 'SEASON_TIMEOUT_IMMINENT'; ticksRemaining: number }

  // ── 10. Pressure Engine ─────────────────────────────────────────────────
  | { type: 'PRESSURE_TIER_CHANGED';  from: string; to: string; score: number }
  | { type: 'PRESSURE_CRITICAL';      score: number; triggerSignals: string[] }
  | { type: 'PRESSURE_SCORE_UPDATED'; score: number; tier: string }

  // ── 11. Tension Engine ──────────────────────────────────────────────────
  | { type: 'TENSION_SCORE_UPDATED';     score: number }
  | { type: 'ANTICIPATION_PULSE';        tensionScore: number; queueDepth: number }
  | { type: 'THREAT_VISIBILITY_CHANGED'; from: string; to: string }
  | { type: 'THREAT_QUEUED';             threatId: string; threatType: string; arrivalTick: number }
  | { type: 'THREAT_ARRIVED';            threatId: string; threatType: string }
  | { type: 'THREAT_MITIGATED';          threatId: string; cardUsed: string }
  | { type: 'THREAT_EXPIRED';            threatId: string; unmitigated: boolean }

  // ── 12. Shield Engine ───────────────────────────────────────────────────
  | { type: 'SHIELD_LAYER_DAMAGED';    layer: string; damage: number; integrity: number; attackId: string }
  | { type: 'SHIELD_LAYER_BREACHED';   layer: string; cascadeEventId?: string }
  | { type: 'SHIELD_REPAIRED';         layer: string; amount: number; newIntegrity: number }
  | { type: 'SHIELD_PASSIVE_REGEN';    layer: string; amount: number; newIntegrity: number }
  | { type: 'SHIELD_FORTIFIED' }
  | { type: 'SHIELD_SNAPSHOT_UPDATED'; layers: Array<{ id: string; current: number; max: number; breached: boolean }> }

  // ── 13. Battle Engine ───────────────────────────────────────────────────
  | { type: 'BOT_STATE_CHANGED';       botId: string; from: string; to: string }
  | { type: 'BOT_ATTACK_FIRED';        botId: string; attackType: string; targetLayer: string }
  | { type: 'BOT_NEUTRALIZED';         botId: string; immunityTicks: number }
  | { type: 'COUNTER_INTEL_AVAILABLE'; botId: string; tier: string }
  | { type: 'BATTLE_BUDGET_UPDATED';   remaining: number; spent: number; tickBudget: number }
  | { type: 'SYNDICATE_DUEL_RESULT';   duelId: string; winnerId: string; loserId: string }
  | { type: 'BUDGET_ACTION_EXECUTED';  actionType: string; remainingBudget: number }
  | { type: 'BATTLE_SNAPSHOT_UPDATED'; state: BattleState }

  // ── 14. Cascade Engine ──────────────────────────────────────────────────
  | { type: 'CASCADE_CHAIN_TRIGGERED';   chainId: string; instanceId: string; severity: string }
  | { type: 'CASCADE_LINK_FIRED';        chainId: string; instanceId: string; linkIndex: number }
  | { type: 'CASCADE_CHAIN_BROKEN';      chainId: string; instanceId: string; recoveryCard: string; linksSkipped: number }
  | { type: 'CASCADE_CHAIN_COMPLETED';   chainId: string; instanceId: string; allLinksResolved: boolean }
  | { type: 'POSITIVE_CASCADE_ACTIVATED'; chainId: string; instanceId: string; chainType: string }
  | { type: 'CASCADE_POSITIVE_DISSOLVED'; chainId: string; reason: string }
  | { type: 'CASCADE_POSITIVE_PAUSED';    chainId: string; reason: string }
  | { type: 'CASCADE_POSITIVE_RESUMED';   chainId: string }
  | { type: 'NEMESIS_BROKEN';             botId: string; immunityTicks: number }
  | { type: 'HATER_HEAT_WRITE_QUEUED';    delta: number; sourceChainId: string }
  | { type: 'CASCADE_TRIGGER_CAPPED';     chainId: string; currentInstanceCount: number }
  | { type: 'CASCADE_SNAPSHOT_UPDATED';   activeChainsCount: number }
  | { type: 'RECOVERY_CONDITION_MET';     chainId: string; instanceId: string }

  // ── 15. Sovereignty Engine ──────────────────────────────────────────────
  //   RUN_COMPLETED:       cordTier: CordTier    — competitive rank at run end
  //   RUN_REWARD_DISPATCHED: cordTier: CordTier  — tier carried forward to reward
  //                          badgeTier: BadgeTier — visual badge tier for proof artifact
  | { type: 'RUN_COMPLETED';             runId: string; proofHash: string; grade: ExtendedGrade; sovereigntyScore: number; integrityStatus: IntegrityStatus; cordTier: CordTier }
  | { type: 'PROOF_VERIFICATION_FAILED'; runId: string; step: number; reason: string }
  | { type: 'RUN_REWARD_DISPATCHED';     runId: string; userId: string; grade: ExtendedGrade; xp: number; cordTier: CordTier; badgeTier: BadgeTier }
  | { type: 'PROOF_ARTIFACT_READY';      runId: string; exportUrl: string; format: 'PDF' | 'PNG' }

  // ── 16. Orchestrator Lifecycle ──────────────────────────────────────────
  | { type: 'RUN_STARTED';     runId: string; userId: string; seed: string; tickBudget: number }
  | { type: 'RUN_ENDED';       runId: string; outcome: RunOutcome; finalNetWorth: number }
  | { type: 'ENGINE_ERROR';    engineId: EngineId; error: string; step: number }
  | { type: 'TICK_STEP_ERROR'; step: number; engineId?: EngineId; error: string }

  // ── 17. Empire Mode Events ──────────────────────────────────────────────
  //   EMPIRE_PHASE_CHANGED: from / to typed as RunPhase (not raw string)
  | { type: 'EMPIRE_BLEED_ACTIVATED';   severity: 'WATCH' | 'CRITICAL' | 'TERMINAL'; cash: number; cashflow: number }
  | { type: 'EMPIRE_BLEED_RESOLVED';    bleedDuration: number; peakSeverity: string }
  | { type: 'EMPIRE_BLEED_ESCALATED';   from: string; to: 'CRITICAL' | 'TERMINAL' }
  | { type: 'EMPIRE_COMEBACK_SURGE';    cardId: string; incomeDelta: number; xpGained: number }
  | { type: 'EMPIRE_ISOLATION_TAX_HIT'; taxAmount: number; effectiveRate: number; totalPaid: number }
  | { type: 'EMPIRE_PHASE_CHANGED';     from: RunPhase; to: RunPhase; wave: number; bots: number }
  | { type: 'EMPIRE_CASE_FILE_READY';   runId: string; grade: ExtendedGrade; score: number }

  // ── 18. Predator Mode Events ────────────────────────────────────────────
  | { type: 'PREDATOR_EXTRACTION_FIRED';     extractionId: string; kind: ExtractionActionType; bbCost: number; windowTicks: number }
  | { type: 'PREDATOR_COUNTERPLAY_RESOLVED'; windowId: string; action: string; outcome: string; cashDelta: number; psycheDelta: number; bbDelta: number; wasOptimal: boolean }
  | { type: 'PREDATOR_COUNTERPLAY_EXPIRED';  windowId: string }
  | { type: 'PREDATOR_TILT_ACTIVATED';       psycheValue: number; tiltCount: number; drawPenalty: number }
  | { type: 'PREDATOR_TILT_RESOLVED';        ticksInTilt: number; cordPenalty: number }
  | { type: 'PREDATOR_BB_READY';             budget: number; generatedFromCard: string }
  | { type: 'PREDATOR_BB_DEPLETED' }
  | { type: 'PREDATOR_RIVALRY_TIER_CHANGED'; from: string; to: string; matchCount: number }
  | { type: 'PREDATOR_PHASE_CHANGED';        from: string; to: string }
  | { type: 'PREDATOR_DECK_CLAIMED';         cardId: string; opponentDenied: boolean }
  | { type: 'PREDATOR_DECK_DENIED';          cardId: string; claimedByOpponent: boolean }

  // ── 19. Syndicate Mode Events ───────────────────────────────────────────
  //   SYNDICATE_AID_CONTRACT_SIGNED: terms: AidCardTerms — full contract snapshot
  | { type: 'SYNDICATE_TRUST_CRITICAL';        playerId: string; trustValue: number; leakageRate: number }
  | { type: 'SYNDICATE_TRUST_RESTORED';        playerId: string; trustValue: number }
  | { type: 'SYNDICATE_RESCUE_OPENED';         rescueId: string; recipientId: string; cashNeeded: number; expiresAtTick: number; guardianPresent: boolean }
  | { type: 'SYNDICATE_RESCUE_FUNDED';         rescueId: string; recipientId: string; totalContributed: number; contributorCount: number }
  | { type: 'SYNDICATE_RESCUE_FAILED';         rescueId: string; recipientId: string }
  | { type: 'SYNDICATE_DEFECTION_STEP';        playerId: string; step: DefectionStep; suspicionEmitted: number; sequenceProgress: number }
  | { type: 'SYNDICATE_DEFECTION_DETECTED';    defectorId: string; detectedById: string; step: DefectionStep }
  | { type: 'SYNDICATE_DEFECTION_COMPLETED';   defectorId: string; cordPenalty: number }
  | { type: 'SYNDICATE_AID_CONTRACT_SIGNED';   contractId: string; senderId: string; recipientId: string; aidType: string; effectiveAmount: number; terms: AidCardTerms }
  | { type: 'SYNDICATE_AID_CONTRACT_BREACHED'; contractId: string; receiverId: string; penaltyApplied: number }
  | { type: 'SYNDICATE_AID_CONTRACT_FULFILLED'; contractId: string; lenderId: string; amount: number }
  | { type: 'SYNDICATE_TREASURY_CRITICAL';     balance: number; freedomThreshold: number }
  | { type: 'SYNDICATE_SYNERGY_BONUS_CHANGED'; newBonus: number; delta: number; reason: string }

  // ── 20. Phantom Mode Events ─────────────────────────────────────────────
  //   PHANTOM_GHOST_DELTA_UPDATE: dominantMarker: LegendMarkerType | null
  //     — most active marker type on current legend timeline segment
  //
  //   PHANTOM_MARKER_CAPTURED (new): player's run records a legend marker.
  //     Fires immediately when the run engine records one of the 5 marker types.
  //
  //   PHANTOM_PROOF_BADGE_EARNED: tier typed as BadgeTier (not raw string)
  | { type: 'PHANTOM_GHOST_LOADED';       legendId: string; legendDisplayName: string; finalNetWorth: number; finalCordScore: number; decayFactor: number; previouslyBeaten: boolean }
  | { type: 'PHANTOM_GHOST_DELTA_UPDATE'; netWorthGap: number; netWorthGapPct: number; cordGap: number; isAhead: boolean; pressureIntensity: number; dominantMarker: LegendMarkerType | null }
  | { type: 'PHANTOM_MARKER_CAPTURED';    markerType: LegendMarkerType; tick: number; cordBasisAwarded: number; totalMarkersThisType: number }
  | { type: 'PHANTOM_GAP_ZONE_CHANGED';   from: string; to: string; gapPct: number }
  | { type: 'PHANTOM_NERVE_CARD_ELIGIBLE'; cardId: string; gapPct: number }
  | { type: 'PHANTOM_DYNASTY_PRESSURE';   dynastyTier: string; multiplier: number }
  | { type: 'PHANTOM_LEGEND_BEATEN';      legendId: string; legendName: string; finalGapPct: number; proofHash: string }
  | { type: 'PHANTOM_PROOF_BADGE_EARNED'; badgeId: string; tier: BadgeTier; proofHash: string }
  | { type: 'PHANTOM_AHEAD_OF_GHOST';     cordGap: number; netWorthGap: number }
  | { type: 'PHANTOM_BEHIND_GHOST';       cordGap: number; netWorthGap: number; ticksRemaining: number };

// ── Engine Event Names ────────────────────────────────────────────────────────
/**
 * All event names on the zero/EventBus (sharedEventBus).
 * Sourced from engines/zero/types.ts EngineEventName.
 * Re-exported here so components can import from one place.
 */
export type EngineEventName =
  // Time (8)
  | 'TICK_START' | 'TICK_COMPLETE' | 'TICK_TIER_CHANGED' | 'TICK_TIER_FORCED'
  | 'DECISION_WINDOW_OPENED' | 'DECISION_WINDOW_EXPIRED' | 'DECISION_WINDOW_RESOLVED'
  | 'SEASON_TIMEOUT_IMMINENT'
  // Pressure (3)
  | 'PRESSURE_TIER_CHANGED' | 'PRESSURE_CRITICAL' | 'PRESSURE_SCORE_UPDATED'
  // Tension (7)
  | 'TENSION_SCORE_UPDATED' | 'ANTICIPATION_PULSE' | 'THREAT_VISIBILITY_CHANGED'
  | 'THREAT_QUEUED' | 'THREAT_ARRIVED' | 'THREAT_MITIGATED' | 'THREAT_EXPIRED'
  // Shield (6)
  | 'SHIELD_LAYER_DAMAGED' | 'SHIELD_LAYER_BREACHED' | 'SHIELD_REPAIRED'
  | 'SHIELD_PASSIVE_REGEN' | 'SHIELD_FORTIFIED' | 'SHIELD_SNAPSHOT_UPDATED'
  // Battle (8)
  | 'BOT_STATE_CHANGED' | 'BOT_ATTACK_FIRED' | 'BOT_NEUTRALIZED'
  | 'COUNTER_INTEL_AVAILABLE' | 'BATTLE_BUDGET_UPDATED' | 'SYNDICATE_DUEL_RESULT'
  | 'BUDGET_ACTION_EXECUTED' | 'BATTLE_SNAPSHOT_UPDATED'
  // Cascade (13)
  | 'CASCADE_CHAIN_TRIGGERED' | 'CASCADE_LINK_FIRED' | 'CASCADE_CHAIN_BROKEN'
  | 'CASCADE_CHAIN_COMPLETED' | 'POSITIVE_CASCADE_ACTIVATED'
  | 'CASCADE_POSITIVE_ACTIVATED' | 'CASCADE_POSITIVE_DISSOLVED'
  | 'CASCADE_POSITIVE_PAUSED' | 'CASCADE_POSITIVE_RESUMED'
  | 'NEMESIS_BROKEN' | 'HATER_HEAT_WRITE_QUEUED' | 'CASCADE_TRIGGER_CAPPED'
  | 'CASCADE_SNAPSHOT_UPDATED'
  // Card layer (28)
  | 'CARD_DRAWN' | 'CARD_PLAYED' | 'CARD_DISCARDED' | 'CARD_HELD' | 'CARD_UNHELD'
  | 'CARD_AUTO_RESOLVED' | 'FORCED_CARD_INJECTED' | 'FORCED_CARD_RESOLVED'
  | 'MISSED_OPPORTUNITY' | 'PHASE_BOUNDARY_CARD_AVAILABLE' | 'PHASE_BOUNDARY_WINDOW_CLOSED'
  | 'LEGENDARY_CARD_DRAWN' | 'BLUFF_CARD_DISPLAYED' | 'COUNTER_WINDOW_OPENED'
  | 'COUNTER_WINDOW_CLOSED' | 'RESCUE_WINDOW_OPENED' | 'RESCUE_WINDOW_CLOSED'
  | 'DEFECTION_STEP_PLAYED' | 'DEFECTION_COMPLETED' | 'AID_TERMS_ACTIVATED'
  | 'AID_REPAID' | 'AID_DEFAULTED' | 'GHOST_CARD_ACTIVATED' | 'PROOF_BADGE_CONDITION_MET'
  | 'CARD_HAND_SNAPSHOT'
  // Sovereignty (4)
  | 'RUN_COMPLETED' | 'PROOF_VERIFICATION_FAILED' | 'RUN_REWARD_DISPATCHED' | 'PROOF_ARTIFACT_READY'
  // Orchestrator lifecycle (4)
  | 'RUN_STARTED' | 'RUN_ENDED' | 'ENGINE_ERROR' | 'TICK_STEP_ERROR';

// ── Mode Event Names ──────────────────────────────────────────────────────────
/**
 * All mode-specific event names — emitted on globalEventBus (core/EventBus).
 * ModeEventBridge translates these to/from zero/EventBus as needed.
 */
export type ModeEventName =
  // Empire
  | 'EMPIRE_BLEED_ACTIVATED'    | 'EMPIRE_BLEED_RESOLVED'    | 'EMPIRE_BLEED_ESCALATED'
  | 'EMPIRE_COMEBACK_SURGE'     | 'EMPIRE_ISOLATION_TAX_HIT' | 'EMPIRE_PHASE_CHANGED'
  | 'EMPIRE_CASE_FILE_READY'
  // Predator
  | 'PREDATOR_EXTRACTION_FIRED'     | 'PREDATOR_COUNTERPLAY_RESOLVED' | 'PREDATOR_COUNTERPLAY_EXPIRED'
  | 'PREDATOR_TILT_ACTIVATED'       | 'PREDATOR_TILT_RESOLVED'
  | 'PREDATOR_BB_READY'             | 'PREDATOR_BB_DEPLETED'
  | 'PREDATOR_RIVALRY_TIER_CHANGED' | 'PREDATOR_PHASE_CHANGED'
  | 'PREDATOR_DECK_CLAIMED'         | 'PREDATOR_DECK_DENIED'
  // Syndicate
  | 'SYNDICATE_TRUST_CRITICAL'      | 'SYNDICATE_TRUST_RESTORED'
  | 'SYNDICATE_RESCUE_OPENED'       | 'SYNDICATE_RESCUE_FUNDED'       | 'SYNDICATE_RESCUE_FAILED'
  | 'SYNDICATE_DEFECTION_STEP'      | 'SYNDICATE_DEFECTION_DETECTED'  | 'SYNDICATE_DEFECTION_COMPLETED'
  | 'SYNDICATE_AID_CONTRACT_SIGNED' | 'SYNDICATE_AID_CONTRACT_BREACHED' | 'SYNDICATE_AID_CONTRACT_FULFILLED'
  | 'SYNDICATE_TREASURY_CRITICAL'   | 'SYNDICATE_SYNERGY_BONUS_CHANGED'
  // Phantom
  | 'PHANTOM_GHOST_LOADED'        | 'PHANTOM_GHOST_DELTA_UPDATE' | 'PHANTOM_GAP_ZONE_CHANGED'
  | 'PHANTOM_NERVE_CARD_ELIGIBLE' | 'PHANTOM_DYNASTY_PRESSURE'   | 'PHANTOM_MARKER_CAPTURED'
  | 'PHANTOM_LEGEND_BEATEN'       | 'PHANTOM_PROOF_BADGE_EARNED'
  | 'PHANTOM_AHEAD_OF_GHOST'      | 'PHANTOM_BEHIND_GHOST';

// ── Mode Event Payload Map ────────────────────────────────────────────────────
/**
 * Typed payloads for all 36 mode events.
 * Components subscribe to globalEventBus and receive these payloads.
 *
 * Sprint 8 patch changes:
 *   EMPIRE_PHASE_CHANGED.from / .to         RunPhase (was string)
 *   SYNDICATE_AID_CONTRACT_SIGNED.terms     AidCardTerms (new field — full contract)
 *   PHANTOM_GHOST_DELTA_UPDATE.dominantMarker LegendMarkerType | null (new field)
 *   PHANTOM_MARKER_CAPTURED                 new event — LegendMarkerType typed
 *   PHANTOM_PROOF_BADGE_EARNED.tier         BadgeTier (was string)
 */
export interface ModeEventPayloadMap {
  // ── Empire ───────────────────────────────────────────────────────────────
  'EMPIRE_BLEED_ACTIVATED':   { tick: number; severity: 'WATCH' | 'CRITICAL' | 'TERMINAL'; cash: number; cashflow: number; activationNo: number };
  'EMPIRE_BLEED_RESOLVED':    { tick: number; bleedDuration: number; peakSeverity: string };
  'EMPIRE_BLEED_ESCALATED':   { tick: number; from: string; to: 'CRITICAL' | 'TERMINAL' };
  'EMPIRE_COMEBACK_SURGE':    { tick: number; cardId: string; cardTitle: string; incomeDelta: number; xpGained: number };
  'EMPIRE_ISOLATION_TAX_HIT': { tick: number; taxAmount: number; effectiveRate: number; totalPaid: number; label: string };
  'EMPIRE_PHASE_CHANGED':     { tick: number; from: RunPhase; to: RunPhase; wave: number; bots: number };
  'EMPIRE_CASE_FILE_READY':   { runId: string; grade: string; score: number };

  // ── Predator ─────────────────────────────────────────────────────────────
  'PREDATOR_EXTRACTION_FIRED':     { tick: number; extractionId: string; kind: ExtractionActionType; bbCost: number; windowTicks: number };
  'PREDATOR_COUNTERPLAY_RESOLVED': { tick: number; windowId: string; action: string; outcome: string; cashDelta: number; psycheDelta: number; bbDelta: number; wasOptimal: boolean };
  'PREDATOR_COUNTERPLAY_EXPIRED':  { tick: number; windowId: string };
  'PREDATOR_TILT_ACTIVATED':       { tick: number; psycheValue: number; tiltCount: number; drawPenalty: number };
  'PREDATOR_TILT_RESOLVED':        { tick: number; ticksInTilt: number; cordPenalty: number };
  'PREDATOR_BB_READY':             { tick: number; budget: number; generatedFromCard: string };
  'PREDATOR_BB_DEPLETED':          { tick: number };
  'PREDATOR_RIVALRY_TIER_CHANGED': { tick: number; from: string; to: string; matchCount: number };
  'PREDATOR_PHASE_CHANGED':        { tick: number; from: string; to: string };
  'PREDATOR_DECK_CLAIMED':         { tick: number; cardId: string; opponentDenied: boolean };
  'PREDATOR_DECK_DENIED':          { tick: number; cardId: string; claimedByOpponent: boolean };

  // ── Syndicate ────────────────────────────────────────────────────────────
  'SYNDICATE_TRUST_CRITICAL':          { tick: number; playerId: string; trustValue: number; leakageRate: number };
  'SYNDICATE_TRUST_RESTORED':          { tick: number; playerId: string; trustValue: number };
  'SYNDICATE_RESCUE_OPENED':           { tick: number; rescueId: string; recipientId: string; cashNeeded: number; expiresAtTick: number; guardianPresent: boolean };
  'SYNDICATE_RESCUE_FUNDED':           { tick: number; rescueId: string; recipientId: string; totalContributed: number; contributorCount: number };
  'SYNDICATE_RESCUE_FAILED':           { tick: number; rescueId: string; recipientId: string };
  'SYNDICATE_DEFECTION_STEP':          { tick: number; playerId: string; step: DefectionStep; suspicionEmitted: number; sequenceProgress: number };
  'SYNDICATE_DEFECTION_DETECTED':      { tick: number; defectorId: string; detectedById: string; step: DefectionStep };
  'SYNDICATE_DEFECTION_COMPLETED':     { tick: number; defectorId: string; cordPenalty: number };
  'SYNDICATE_AID_CONTRACT_SIGNED':     { tick: number; contractId: string; senderId: string; recipientId: string; aidType: string; effectiveAmount: number; leakageApplied: number; terms: AidCardTerms };
  'SYNDICATE_AID_CONTRACT_BREACHED':   { tick: number; contractId: string; receiverId: string; penaltyApplied: number };
  'SYNDICATE_AID_CONTRACT_FULFILLED':  { tick: number; contractId: string; lenderId: string; amount: number };
  'SYNDICATE_TREASURY_CRITICAL':       { tick: number; balance: number; freedomThreshold: number };
  'SYNDICATE_SYNERGY_BONUS_CHANGED':   { tick: number; newBonus: number; delta: number; reason: string };

  // ── Phantom ──────────────────────────────────────────────────────────────
  'PHANTOM_GHOST_LOADED':        { tick: number; legendId: string; legendDisplayName: string; finalNetWorth: number; finalCordScore: number; decayFactor: number; previouslyBeaten: boolean };
  'PHANTOM_GHOST_DELTA_UPDATE':  { tick: number; netWorthGap: number; netWorthGapPct: number; cordGap: number; isAhead: boolean; pressureIntensity: number; dominantMarker: LegendMarkerType | null };
  'PHANTOM_MARKER_CAPTURED':     { tick: number; markerType: LegendMarkerType; cordBasisAwarded: number; totalMarkersThisType: number };
  'PHANTOM_GAP_ZONE_CHANGED':    { tick: number; from: string; to: string; gapPct: number };
  'PHANTOM_NERVE_CARD_ELIGIBLE': { tick: number; cardId: string; gapPct: number };
  'PHANTOM_DYNASTY_PRESSURE':    { tick: number; dynastyTier: string; multiplier: number };
  'PHANTOM_LEGEND_BEATEN':       { tick: number; legendId: string; legendName: string; finalGapPct: number; proofHash: string };
  'PHANTOM_PROOF_BADGE_EARNED':  { tick: number; badgeId: string; tier: BadgeTier; proofHash: string };
  'PHANTOM_AHEAD_OF_GHOST':      { tick: number; cordGap: number; netWorthGap: number };
  'PHANTOM_BEHIND_GHOST':        { tick: number; cordGap: number; netWorthGap: number; ticksRemaining: number };
}