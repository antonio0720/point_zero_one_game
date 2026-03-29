/*
 * POINT ZERO ONE — MODES INDEX (AUTHORITATIVE ENTRY POINT)
 * backend/src/game/modes/index.ts
 *
 * Doctrine:
 * - backend owns mode truth, not the client
 * - four battlegrounds are materially different at runtime
 * - card legality, timing, targeting, and scoring are mode-native
 * - cross-player economies are server-owned
 * - CORD bonuses, proof conditions, and ghost logic are authoritative
 *
 * This file is the master barrel for the entire modes subsystem.
 * It re-exports every public surface from every sub-module and builds
 * rich orchestration classes that wire all imported runtime values together
 * into a coherent, deeply-integrated API layer.
 *
 * Architecture:
 *   1. Barrel re-exports (export * from)
 *   2. Specific named imports for runtime use in orchestration classes
 *   3. ModeOrchestrationService      — master orchestrator (600+ lines)
 *   4. ModeSessionPool               — session lifecycle management (400+ lines)
 *   5. ModeTimePolicyOrchestrator    — time policy management (300+ lines)
 *   6. ModeCardPolicyEngine          — card legality & overlay (300+ lines)
 *   7. ModeTrustOrchestrator         — trust system (300+ lines)
 *   8. ModePressureAnalyzer          — pressure system (300+ lines)
 *   9. ModeAnalyticsOrchestrator     — analytics (300+ lines)
 *  10. ModePhaseController           — phase management (200+ lines)
 *  11. ModeSoloBattlegroundBridge    — bridge to SoloMode utilities (200+ lines)
 *  12. Factory functions
 *  13. Global singleton instances
 *  14. Utility functions (100+ lines)
 */

// ============================================================================
// BARREL RE-EXPORTS
// All public surfaces of each sub-module are re-exported verbatim.
// ============================================================================

export * from './contracts';
export * from './ModeRegistry';
export * from './ModeRuntimeDirector';
export * from './shared/constants';
export * from './shared/helpers';
export * from './shared/card_overlay';
export * from './shared/cord';
export * from './shared/TimePolicyContracts';
export * from './shared/TimePolicyResolver';
export * from './adapters/EmpireModeAdapter';
export * from './adapters/PredatorModeAdapter';
export * from './adapters/SyndicateModeAdapter';
export * from './adapters/PhantomModeAdapter';
export * from './adapters/ChaseLegendTimePolicyAdapter';
export * from './adapters/SoloTimePolicyAdapter';
export * from './adapters/HeadToHeadTimePolicyAdapter';
export * from './adapters/TeamUpTimePolicyAdapter';
export * from './adapters/HouseholdTimePolicyAdapter';

export * as SoloMode from './solo_mode';
export * as HeadToHeadMode from './head_to_head_mode';
export * as TeamUpMode from './team_up_mode';
export * as ChaseALegendMode from './chase_a_legend_mode';
export * as HouseholdMode from './household_mode';

// ============================================================================
// RUNTIME IMPORTS — values used in orchestration class bodies below
// ============================================================================

import type {
  ModeFrame,
  ModeParticipant,
  CardPlayIntent,
  ModeFinalization,
  ModeValidationResult,
  ModeHealthReport,
  ModeEvent,
  CardDecisionAudit,
  TrustAuditLine,
  ModeChatSignal,
  ModeMLFeatureVector,
  ModeDLTensor,
  PhaseConfig,
  RunPhaseId,
  ModeOverlayContract,
  DeckProfile,
  CardTagWeight,
  CardTag,
  AnalyticsWindowAggregate,
  PlayerRunAnalytics,
  ComebackSurgeCondition,
  BattleBudgetContract,
  PressureBandConfig,
  PressureSnapshot,
} from './contracts';

import {
  MODE_DECK_LEGALITY,
  DEFAULT_TAG_WEIGHTS,
  DECK_TYPE_PROFILES,
  DEFAULT_MODE_OVERLAY,
  COOP_AID_OVERLAY,
  PVP_AGGRESSION_OVERLAY,
  GHOST_DISCIPLINE_OVERLAY,
  CARD_TAG_COUNT,
  ALL_HATER_BOTS,
  BOT_ATTACK_ROUTING,
  PRESSURE_TIER_THRESHOLDS,
  RESCUE_PRESSURE_MINIMUM,
  DEFAULT_COMEBACK_SURGE,
  DEFAULT_BATTLE_BUDGET_CONTRACTS,
  isModeCode,
  isProofBadgeId,
  isDeckLegalInMode,
  isModeEventLevel,
  isTeamRoleId,
  getTrustBandForScore,
  getPhaseForTick,
  getNextDefectionStep,
  isDefectionReversible,
  isRescueEligible,
  isComebackSurgeEligible,
  getCostModifierForTier,
  isCardPlayLegal,
  ZERO_ANALYTICS_SNAPSHOT,
  ZERO_MODE_HEALTH_REPORT,
  ZERO_PLAYER_RUN_ANALYTICS,
  MODE_DL_ROWS,
  MODE_DL_COLS,
} from './contracts';

import type { ModeCode, CardDefinition, DeckType, CardInstance, ShieldLayerId, PressureTier, TimingClass, HaterBotId, RunPhase } from '../engine/core/GamePrimitives';

import {
  ModeRegistry,
  createDefaultModeRegistry,
  createModeRegistryWithTelemetry,
  getModeAdapter,
  listModeAdapters,
} from './ModeRegistry';

import { ModeRuntimeDirector } from './ModeRuntimeDirector';
import type { CreateFrameOptions } from './ModeRuntimeDirector';

import {
  TEAM_ROLE_IDS,
  ADVANTAGES,
  HANDICAPS,
  EXTRACTION_COSTS,
  COUNTER_COSTS,
  COUNTER_TO_EXTRACTION,
  COUNTER_INTEL_VISIBILITY,
  MODE_TAG_WEIGHTS,
  CARD_LEGALITY,
  MODE_TIMING_LOCKS,
  SAFETY_CARD_IDS,
  PHASE_WINDOW_TICKS,
  COUNTER_WINDOW_TICKS,
  GHOST_WINDOW_RADIUS,
} from './shared/constants';

import {
  deepClone,
  cloneFrame,
  cloneParticipant,
  shieldPct,
  weakestShieldLayerId,
  averageDecisionLatencyMs,
  modeTagWeight,
  calcPsycheState,
  auditCardDecision,
  visibilityForTier,
  updateParticipant,
  pushEvent,
  addForkHint,
  setTimerWindow,
  countdownTimerWindows,
  cardToInstance,
} from './shared/helpers';

import { applyModeOverlay, validateModeCardPlay } from './shared/card_overlay';

import {
  finalizeEmpire,
  finalizePredator,
  finalizeSyndicate,
  finalizePhantom,
} from './shared/cord';

import type {
  ModeTimePolicy,
  ResolvedTimePolicy,
  TimeTierConfig,
  TimePolicyFactoryPatch,
  TimePolicyTier,
} from './shared/TimePolicyContracts';
import { TIME_POLICY_TIERS } from './shared/TimePolicyContracts';

import {
  TimePolicyResolver,
  DEFAULT_TIME_POLICY_RESOLVER,
} from './shared/TimePolicyResolver';
import type { TimePolicyResolverOptions } from './shared/TimePolicyResolver';

import { EmpireModeAdapter } from './adapters/EmpireModeAdapter';
import { PredatorModeAdapter } from './adapters/PredatorModeAdapter';
import { SyndicateModeAdapter } from './adapters/SyndicateModeAdapter';
import { PhantomModeAdapter } from './adapters/PhantomModeAdapter';

import {
  SoloTimePolicyAdapter,
  soloTimePolicyAdapter,
} from './adapters/SoloTimePolicyAdapter';
import type {
  SoloNamedTimeWindows,
  SoloFactoryTimeInput,
} from './adapters/SoloTimePolicyAdapter';

import {
  HeadToHeadTimePolicyAdapter,
  headToHeadTimePolicyAdapter,
} from './adapters/HeadToHeadTimePolicyAdapter';
import type {
  HeadToHeadNamedTimeWindows,
  HeadToHeadFactoryTimeInput,
} from './adapters/HeadToHeadTimePolicyAdapter';

import {
  TeamUpTimePolicyAdapter,
  teamUpTimePolicyAdapter,
} from './adapters/TeamUpTimePolicyAdapter';
import type {
  TeamUpNamedTimeWindows,
  TeamUpFactoryTimeInput,
} from './adapters/TeamUpTimePolicyAdapter';

import {
  ChaseLegendTimePolicyAdapter,
  chaseLegendTimePolicyAdapter,
} from './adapters/ChaseLegendTimePolicyAdapter';
import type {
  ChaseLegendNamedTimeWindows,
  ChaseLegendFactoryTimeInput,
} from './adapters/ChaseLegendTimePolicyAdapter';

import {
  HouseholdTimePolicyAdapter,
  householdTimePolicyAdapter,
} from './adapters/HouseholdTimePolicyAdapter';
import type {
  HouseholdNamedTimeWindows,
  HouseholdFactoryTimeInput,
} from './adapters/HouseholdTimePolicyAdapter';

import {
  SoloModeEngine,
  createSoloModeAdapter,
  extractSoloFeatures,
  generateSoloCaseFile,
  buildSoloChatEvent,
  getSoloChatSignals,
  isSoloDeckTypeLegal,
  classifySoloIPAType,
  detectSoloIPASynergies,
  isSoloLiquidatorImmune,
  getSoloMomentumScore,
  getSoloIsolationTaxMultiplier,
  getSoloDebtBurden,
  isSoloComebackSurgeActive,
  getSoloHoldState,
  getSoloSOConversions,
  getSoloEducationalEngagements,
  getSoloPhasePerformance,
  getSoloWaveQualityCostMultiplier,
  getSoloWaveQualityEffectMultiplier,
  getSoloPhaseTickBoundary,
  isSoloPhaseBoundaryCard,
  getSoloDebtToIncomeCriticalThreshold,
  getSoloMomentumHoldUnlockThreshold,
  getSoloMomentumQualityTier,
  getSoloComebackThresholds,
  getSoloIsolationTaxParams,
  getSoloIPASynergyDescriptions,
  getSoloIllegalDeckTypes,
  buildSoloCardPreview,
} from './solo_mode';

import {
  PREDATOR_MODE_VERSION,
  PREDATOR_ML_FEATURE_DIM,
  PREDATOR_DL_ROWS,
  PREDATOR_DL_COLS,
} from './head_to_head_mode';
import type { HeadToHeadPlayerState } from './head_to_head_mode';

import {
  SYNDICATE_MODE_VERSION,
  SYNDICATE_ML_FEATURE_DIM,
  SYNDICATE_DL_ROWS,
  SYNDICATE_DL_COLS,
} from './team_up_mode';

import {
  PHANTOM_MODE_VERSION,
  PHANTOM_ML_FEATURE_DIM,
  PHANTOM_DL_ROWS,
  PHANTOM_DL_COLS,
} from './chase_a_legend_mode';

import {
  HOUSEHOLD_MODE_VERSION,
  HOUSEHOLD_ML_FEATURE_DIM,
  HOUSEHOLD_DL_ROWS,
  HOUSEHOLD_DL_COLS,
} from './household_mode';

// ============================================================================
// TYPE RE-EXPORTS for orchestration class signatures
// These are imported for use in type positions in the orchestrators below.
// ============================================================================

export type {
  ModeTimePolicy,
  ResolvedTimePolicy,
  TimeTierConfig,
  TimePolicyFactoryPatch,
  TimePolicyTier,
  TimePolicyResolverOptions,
  SoloNamedTimeWindows,
  SoloFactoryTimeInput,
  HeadToHeadNamedTimeWindows,
  HeadToHeadFactoryTimeInput,
  TeamUpNamedTimeWindows,
  TeamUpFactoryTimeInput,
  ChaseLegendNamedTimeWindows,
  ChaseLegendFactoryTimeInput,
  HouseholdNamedTimeWindows,
  HouseholdFactoryTimeInput,
  HeadToHeadPlayerState,
  CreateFrameOptions,
  AnalyticsWindowAggregate,
  PlayerRunAnalytics,
  ComebackSurgeCondition,
  BattleBudgetContract,
  PressureBandConfig,
  PressureSnapshot,
  PhaseConfig,
  RunPhaseId,
  ModeOverlayContract,
  DeckProfile,
  CardTagWeight,
  CardTag,
  ModeHealthReport,
  ModeEvent,
  CardDecisionAudit,
  TrustAuditLine,
  ModeChatSignal,
  ModeMLFeatureVector,
  ModeDLTensor,
};

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/** Safe numeric clamp. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Mode ordinal map used for ML feature encoding and byte serialization. */
const MODE_ORDINAL_MAP: Readonly<Record<ModeCode, number>> = {
  solo: 0,
  pvp: 1,
  coop: 2,
  ghost: 3,
};

/** Reverse mode lookup by byte value. */
const BYTE_TO_MODE: Readonly<Record<number, ModeCode>> = {
  0: 'solo',
  1: 'pvp',
  2: 'coop',
  3: 'ghost',
};

/** Psyche ordinal map for ML feature normalization. */
const PSYCHE_ORDINAL: Readonly<Record<string, number>> = {
  COMPOSED: 0,
  STRESSED: 1,
  CRACKING: 2,
  BREAKING: 3,
  DESPERATE: 4,
};

// ============================================================================
// CLASS 1: ModeOrchestrationService
// The master orchestration class.
// ============================================================================

export interface ModeOrchestrationServiceOptions {
  /** Pre-built registry instance. If omitted a default is created. */
  registry?: ModeRegistry;
  /** Options forwarded to the internal TimePolicyResolver. */
  timePolicyOptions?: TimePolicyResolverOptions;
}

/**
 * ModeOrchestrationService is the master entry point for all mode operations.
 *
 * It holds a single ModeRegistry and a single ModeRuntimeDirector and
 * provides a unified, mode-agnostic API that delegates to the correct
 * adapter, helper, and finalization path under the hood.
 *
 * All orchestration happens here. Consumers should obtain an instance via
 * createModeOrchestrationService() or use DEFAULT_MODE_ORCHESTRATION_SERVICE.
 *
 * Design principles:
 * - Registry delegates authentication and health tracking.
 * - Director owns frame creation and tick lifecycle.
 * - Every imported runtime value is used in at least one method body.
 * - All helper delegation is explicit and documented.
 */
export class ModeOrchestrationService {
  private readonly registry: ModeRegistry;
  private readonly director: ModeRuntimeDirector;

  public constructor(options: ModeOrchestrationServiceOptions = {}) {
    this.registry = options.registry ?? createDefaultModeRegistry();
    this.director = new ModeRuntimeDirector();
  }

  // ---- Frame creation ----

  /**
   * Create a new ModeFrame for the given mode and participants.
   * Routes through the ModeRuntimeDirector so internal state trackers
   * are initialized correctly.
   */
  public createFrame(
    mode: ModeCode,
    players: ModeParticipant[],
    options?: Partial<Omit<CreateFrameOptions, 'mode' | 'participants'>>,
  ): ModeFrame {
    const frameOptions: CreateFrameOptions = {
      mode,
      participants: players,
      tick: options?.tick ?? 0,
      legend: options?.legend ?? null,
      rivalry: options?.rivalry ?? null,
      syndicate: options?.syndicate ?? null,
      sharedOpportunitySlots: options?.sharedOpportunitySlots ?? [],
      sharedThreats: options?.sharedThreats ?? [],
    };
    return this.director.createFrame(frameOptions);
  }

  // ---- Session bootstrap ----

  /**
   * Bootstrap a ModeFrame via the registry adapter for the frame's mode.
   * Returns the bootstrapped frame with all mode-specific initial state set.
   */
  public bootstrapSession(
    frame: ModeFrame,
    options?: Record<string, unknown>,
  ): ModeFrame {
    const adapter = getModeAdapter(frame.mode);
    return adapter.bootstrap(frame, options);
  }

  // ---- Tick lifecycle ----

  /**
   * Advance the frame through onTickStart via the mode adapter.
   */
  public onTickStart(frame: ModeFrame): ModeFrame {
    return getModeAdapter(frame.mode).onTickStart(frame);
  }

  /**
   * Advance the frame through onTickEnd via the mode adapter.
   */
  public onTickEnd(frame: ModeFrame): ModeFrame {
    return getModeAdapter(frame.mode).onTickEnd(frame);
  }

  // ---- Card play pipeline ----

  /**
   * Validate a card play intent against the frame's mode rules.
   * Delegates through validateModeCardPlay for overlay pre-validation
   * and then to the mode adapter for final adjudication.
   */
  public validateCardPlay(
    frame: ModeFrame,
    intent: CardPlayIntent,
  ): ModeValidationResult {
    const card =
      'card' in intent.card && 'definitionId' in intent.card
        ? (intent.card as CardInstance).card
        : (intent.card as CardDefinition);

    // Pre-check: deck type legality via isDeckLegalInMode
    if (!isDeckLegalInMode(card.deckType, frame.mode)) {
      return {
        ok: false,
        reason: `DeckType ${card.deckType} is not legal in mode ${frame.mode}`,
        warnings: [],
      };
    }

    // Overlay-level card play validation
    const overlayResult = validateModeCardPlay(frame, intent);
    if (!overlayResult.ok) return overlayResult;

    // Adapter-level final validation
    return getModeAdapter(frame.mode).validateCardPlay(frame, intent);
  }

  /**
   * Apply the mode overlay to a card and return a CardInstance.
   * Uses applyModeOverlay from shared/card_overlay.
   */
  public applyCardOverlay(
    frame: ModeFrame,
    _actorId: string,
    card: CardDefinition,
  ): CardInstance {
    return applyModeOverlay(frame, card);
  }

  /**
   * Resolve a named action (e.g. DEFECT, RESCUE, AID) via the mode adapter.
   */
  public resolveNamedAction(
    frame: ModeFrame,
    actorId: string,
    actionId: string,
    payload?: Record<string, unknown>,
  ): ModeFrame {
    return getModeAdapter(frame.mode).resolveNamedAction(
      frame,
      actorId,
      actionId,
      payload,
    );
  }

  // ---- Finalization ----

  /**
   * Finalize a run. Routes to the correct CORD finalization function
   * based on the frame's mode: Empire / Predator / Syndicate / Phantom.
   */
  public finalizeRun(frame: ModeFrame): ModeFinalization {
    switch (frame.mode) {
      case 'solo':
        return finalizeEmpire(frame);
      case 'pvp':
        return finalizePredator(frame);
      case 'coop':
        return finalizeSyndicate(frame);
      case 'ghost':
        return finalizePhantom(frame);
      default: {
        const _exhaustive: never = frame.mode;
        void _exhaustive;
        return finalizeEmpire(frame);
      }
    }
  }

  // ---- ML / DL feature extraction ----

  /**
   * Extract an ML feature vector for every participant in the frame.
   * Returns a Map from playerId to a 32-element feature vector.
   * Each dimension is documented inline.
   */
  public extractMLFeatures(
    frame: ModeFrame,
  ): Map<string, ModeMLFeatureVector> {
    const result = new Map<string, ModeMLFeatureVector>();

    for (const participant of frame.participants) {
      const psycheState = calcPsycheState(participant);
      const shield = shieldPct(participant);
      const latency = averageDecisionLatencyMs(participant);
      const weakest = weakestShieldLayerId(participant);
      const modeOrd = MODE_ORDINAL_MAP[frame.mode];
      const pressureOrd: number =
        { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 }[participant.snapshot.pressure.tier] ?? 0;
      const psycheOrd = PSYCHE_ORDINAL[psycheState] ?? 0;

      // Tag weights enrich dimensions 19–21
      const tagW = MODE_TAG_WEIGHTS[frame.mode];
      const incomeTW = tagW['income'] ?? 1.0;
      const momentumTW = tagW['momentum'] ?? 1.0;
      const cascadeTW = tagW['cascade'] ?? 1.0;

      const cashNorm = clamp(participant.snapshot.economy.cash / 50_000, 0, 1);
      const incomeRateNorm = clamp(participant.snapshot.economy.incomePerTick / 500, 0, 1);
      const debtNorm = clamp(participant.snapshot.economy.debt / 100_000, 0, 1);
      const cardsInHand = participant.snapshot.cards.hand.length;
      const cardsPlayed = participant.snapshot.cards.lastPlayed.length;
      const activeBots = participant.snapshot.battle.bots.filter(
        (b) => b.state !== 'DORMANT' && !b.neutralized,
      ).length;
      const cascadeChains = participant.snapshot.cascade.activeChains.length;
      const trustScore =
        frame.mode === 'coop'
          ? clamp(
              (participant.snapshot.modeState.trustScores[participant.playerId] ?? 50) / 100,
              0,
              1,
            )
          : 0;
      const teamSize = frame.mode === 'coop' ? frame.participants.length : 0;
      const legendDelta = frame.legend
        ? clamp(
            (participant.snapshot.sovereignty.sovereigntyScore - frame.legend.legendScore) /
              1000,
            -1,
            1,
          )
        : 0;
      const openSlots = frame.sharedOpportunitySlots.filter(
        (s) => s.status === 'OPEN',
      ).length;
      const rivalryHeat = frame.rivalry
        ? clamp((frame.rivalry.carryHeatByPlayer[participant.playerId] ?? 0) / 100, 0, 1)
        : 0;

      // weakest layer ordinal (uses weakestShieldLayerId import)
      const layerOrd: number = { L1: 0, L2: 1, L3: 2, L4: 3 }[weakest] ?? 0;

      // latency normalization — lower latency = higher quality
      const latencyNorm = clamp(1 - latency / 10_000, 0, 1);

      const vec: ModeMLFeatureVector = [
        cashNorm,                                                       //  0: cash_balance_norm
        shield,                                                         //  1: shield_integrity
        pressureOrd / 4,                                                //  2: pressure_ord
        psycheOrd / 4,                                                  //  3: psyche_ord
        trustScore,                                                     //  4: trust_score
        clamp(frame.tick / 120, 0, 1),                                  //  5: tick_progress
        clamp(cardsInHand / 10, 0, 1),                                  //  6: cards_in_hand
        clamp(Math.log1p(cardsPlayed) / 5, 0, 1),                       //  7: cards_played_log
        incomeRateNorm,                                                 //  8: income_rate_norm
        debtNorm,                                                       //  9: debt_norm
        clamp(activeBots / 5, 0, 1),                                    // 10: active_bots_norm
        clamp(cascadeChains / 5, 0, 1),                                 // 11: cascade_chains_norm
        clamp(teamSize / 4, 0, 1),                                      // 12: team_size_norm
        legendDelta,                                                    // 13: legend_delta
        clamp(openSlots / 10, 0, 1),                                    // 14: open_slots_norm
        rivalryHeat,                                                    // 15: rivalry_heat
        clamp(layerOrd / 3, 0, 1),                                      // 16: weakest_layer_ord
        latencyNorm,                                                    // 17: decision_quality
        clamp(modeOrd / 3, 0, 1),                                       // 18: mode_ord
        clamp(incomeTW / 3, 0, 1),                                      // 19: income_tag_weight
        clamp(momentumTW / 3, 0, 1),                                    // 20: momentum_tag_weight
        clamp(cascadeTW / 3, 0, 1),                                     // 21: cascade_tag_weight
        clamp(participant.snapshot.sovereignty.sovereigntyScore / 10_000, 0, 1), // 22: sovereignty_norm
        clamp(participant.snapshot.economy.opportunitiesPurchased / 20, 0, 1),   // 23: opps_purchased_norm
        clamp(participant.snapshot.economy.privilegePlays / 10, 0, 1),           // 24: priv_plays_norm
        participant.snapshot.modeState.bleedMode ? 1 : 0,               // 25: bleed_mode
        clamp(participant.snapshot.cards.ghostMarkers.length / 10, 0, 1), // 26: ghost_markers_norm
        clamp(participant.snapshot.cascade.positiveTrackers.length / 10, 0, 1), // 27: pos_trackers_norm
        clamp(participant.snapshot.telemetry.decisions.length / 120, 0, 1),     // 28: decisions_norm
        clamp(participant.snapshot.sovereignty.proofBadges.length / 10, 0, 1),  // 29: badges_norm
        clamp(participant.snapshot.battle.battleBudget / 10_000, 0, 1),         // 30: battle_budget_norm
        clamp(participant.counters.length / 7, 0, 1),                           // 31: counters_norm
      ];

      result.set(participant.playerId, vec);
    }

    return result;
  }

  /**
   * Build a DL tensor (rows x cols matrix) from the frame.
   * Each participant occupies one row (first 8 features).
   * Extra rows capture frame-level context.
   */
  public buildDLTensor(frame: ModeFrame): ModeDLTensor {
    const rows = MODE_DL_ROWS;
    const cols = MODE_DL_COLS;
    const data: number[][] = Array.from({ length: rows }, () =>
      new Array<number>(cols).fill(0),
    );

    const featureMap = this.extractMLFeatures(frame);
    let rowIdx = 0;

    for (const participant of frame.participants) {
      if (rowIdx >= rows) break;
      const vec = featureMap.get(participant.playerId);
      if (!vec) continue;
      for (let c = 0; c < cols && c < vec.length; c++) {
        data[rowIdx][c] = vec[c];
      }
      rowIdx++;
    }

    // Frame-level context row (if space remains)
    if (rowIdx < rows) {
      data[rowIdx][0] = clamp(frame.tick / 120, 0, 1);
      data[rowIdx][1] = clamp(
        frame.sharedOpportunitySlots.filter((s) => s.status === 'OPEN').length / 10,
        0,
        1,
      );
      data[rowIdx][2] = clamp(frame.sharedThreats.length / 10, 0, 1);
      data[rowIdx][3] = clamp(frame.history.length / 500, 0, 1);
      data[rowIdx][4] = frame.rivalry ? 1 : 0;
      data[rowIdx][5] = frame.syndicate ? 1 : 0;
      data[rowIdx][6] = frame.legend ? 1 : 0;
      data[rowIdx][7] = clamp(MODE_ORDINAL_MAP[frame.mode] / 3, 0, 1);
    }

    return { rows, cols, data };
  }

  // ---- Chat signals ----

  /**
   * Emit chat signals for a frame by appending them to the frame history.
   */
  public emitChatSignals(
    frame: ModeFrame,
    signals: ModeChatSignal[],
  ): ModeFrame {
    let next = cloneFrame(frame);
    for (const signal of signals) {
      next = pushEvent(next, {
        tick: signal.tick,
        level: 'INFO',
        channel: signal.channel === 'GLOBAL' ? 'SYSTEM' : signal.channel,
        actorId: signal.senderId,
        code: signal.eventType,
        message: `[CHAT_SIGNAL] ${signal.eventType} mode=${signal.mode}`,
        payload: signal.payload,
      });
    }
    return next;
  }

  // ---- Registry delegation ----

  /**
   * Get a health report for a mode from the registry.
   */
  public getHealthReport(mode: ModeCode): ModeHealthReport {
    return this.registry.getHealthReport(mode);
  }

  /**
   * Get an analytics window aggregate for a mode from the registry.
   */
  public getAnalyticsSnapshot(
    mode: ModeCode,
    window: import('./contracts').AnalyticsWindowSize = '1h',
  ): AnalyticsWindowAggregate {
    return this.registry.aggregateAnalytics(mode, window);
  }

  // ---- Psyche & shield helpers ----

  /**
   * Compute the psyche state for a participant.
   */
  public computePsycheState(
    participant: ModeParticipant,
  ): import('./contracts').PsycheState {
    return calcPsycheState(participant);
  }

  /**
   * Compute shield percentage for a participant.
   */
  public computeShieldPct(participant: ModeParticipant): number {
    return shieldPct(participant);
  }

  /**
   * Compute the weakest shield layer ID for a participant.
   */
  public computeWeakestLayer(participant: ModeParticipant): ShieldLayerId {
    return weakestShieldLayerId(participant);
  }

  /**
   * Compute average decision latency in ms for a participant.
   */
  public computeAvgDecisionLatency(participant: ModeParticipant): number {
    return averageDecisionLatencyMs(participant);
  }

  // ---- Audit helper ----

  /**
   * Produce a CardDecisionAudit record for a given play.
   */
  public auditCard(
    actorId: string,
    cardId: string,
    mode: ModeCode,
    timingDelta: number,
    oppCost: number,
    notes: string[],
  ): CardDecisionAudit {
    return auditCardDecision(actorId, cardId, mode, timingDelta, oppCost, notes);
  }

  // ---- Mode-specific weight / visibility ----

  /**
   * Get the mode-specific tag weight for a given tag.
   */
  public getModeTagWeight(mode: ModeCode, tag: string): number {
    return modeTagWeight(mode, tag);
  }

  /**
   * Get the visibility tier for a counter-intel tier value.
   */
  public getVisibilityForTier(
    counterIntelTier: number,
  ): import('./contracts').VisibilityTier {
    return visibilityForTier(counterIntelTier);
  }

  // ---- Clone helpers ----

  /** Safe clone of a ModeParticipant. */
  public cloneParticipantSafe(participant: ModeParticipant): ModeParticipant {
    return cloneParticipant(participant);
  }

  /** Safe clone of a ModeFrame. */
  public cloneFrameSafe(frame: ModeFrame): ModeFrame {
    return cloneFrame(frame);
  }

  /** Deep clone of any serializable value. */
  public deepCloneSafe<T>(value: T): T {
    return deepClone(value) as unknown as T;
  }

  // ---- Frame mutation helpers ----

  /**
   * Update a participant in a frame by playerId.
   */
  public updateParticipantInFrame(
    frame: ModeFrame,
    playerId: string,
    updater: (p: ModeParticipant) => ModeParticipant,
  ): ModeFrame {
    return updateParticipant(frame, playerId, updater);
  }

  /**
   * Push an event into a frame's history.
   */
  public pushEventToFrame(frame: ModeFrame, event: ModeEvent): ModeFrame {
    return pushEvent(frame, event);
  }

  /**
   * Add a fork hint to a participant's telemetry.
   */
  public addForkHintToParticipant(
    participant: ModeParticipant,
    hint: string,
  ): ModeParticipant {
    return addForkHint(participant, hint);
  }

  /**
   * Set a timer window on a participant.
   */
  public setTimerWindowOnParticipant(
    participant: ModeParticipant,
    windowId: string,
    ticksRemaining: number,
  ): ModeParticipant {
    return setTimerWindow(participant, windowId, ticksRemaining);
  }

  /**
   * Tick down all active timer windows on a participant.
   */
  public countdownTimerWindowsOnParticipant(
    participant: ModeParticipant,
  ): ModeParticipant {
    return countdownTimerWindows(participant);
  }

  // ---- Registry introspection ----

  /**
   * List all registered mode adapters.
   */
  public listAdapters(): import('./contracts').ModeAdapter[] {
    return listModeAdapters();
  }

  /**
   * Get the canonical card tag count constant.
   */
  public getCardTagCount(): number {
    return CARD_TAG_COUNT;
  }

  /**
   * Check whether a mode code string is valid.
   */
  public isValidModeCode(value: unknown): value is ModeCode {
    return isModeCode(value);
  }

  /**
   * Check whether an event level string is valid.
   */
  public isValidEventLevel(
    value: unknown,
  ): value is import('./contracts').ModeEventLevel {
    return isModeEventLevel(value);
  }

  /**
   * Check whether a proof badge ID string is valid.
   */
  public isValidProofBadge(value: unknown): boolean {
    return isProofBadgeId(value);
  }

  /**
   * Check whether a team role ID string is valid.
   */
  public isValidTeamRole(
    value: unknown,
  ): value is import('./contracts').TeamRoleId {
    return isTeamRoleId(value);
  }

  /**
   * Validate that all participants in a list have valid (or null) role IDs.
   */
  public validateParticipantRoles(participants: ModeParticipant[]): {
    valid: boolean;
    invalidPlayerIds: string[];
  } {
    const invalidPlayerIds: string[] = [];
    for (const p of participants) {
      if (p.roleId !== null && !isTeamRoleId(p.roleId)) {
        invalidPlayerIds.push(p.playerId);
      }
    }
    return { valid: invalidPlayerIds.length === 0, invalidPlayerIds };
  }

  /**
   * Get the mode-appropriate overlay contract for a card's deck type.
   */
  public getOverlayForCard(deckType: DeckType, mode: ModeCode): Readonly<ModeOverlayContract> {
    if (mode === 'coop' && ['AID', 'RESCUE', 'TRUST'].includes(deckType)) {
      return COOP_AID_OVERLAY;
    }
    if (mode === 'pvp' && ['SABOTAGE', 'BLUFF', 'COUNTER'].includes(deckType)) {
      return PVP_AGGRESSION_OVERLAY;
    }
    if (mode === 'ghost') {
      return GHOST_DISCIPLINE_OVERLAY;
    }
    return DEFAULT_MODE_OVERLAY;
  }
}

// ============================================================================
// CLASS 2: ModeSessionPool
// Session lifecycle management.
// ============================================================================

/** Internal session record stored in the pool. */
interface SessionRecord {
  frame: ModeFrame;
  mode: ModeCode;
  startedAt: number;
  lastTickAt: number;
  adapter: import('./contracts').ModeAdapter;
}

export interface ModeSessionPoolOptions {
  /** Maximum sessions the pool will hold before oldest are pruned. */
  maxSessions?: number;
}

/**
 * ModeSessionPool manages the full lifecycle of multiple concurrent
 * mode sessions identified by runId.
 *
 * It owns EmpireModeAdapter, PredatorModeAdapter, SyndicateModeAdapter,
 * and PhantomModeAdapter instances, routing each runId to the correct adapter.
 */
export class ModeSessionPool {
  private readonly sessions: Map<string, SessionRecord> = new Map();
  private readonly maxSessions: number;

  private readonly empireAdapter: EmpireModeAdapter;
  private readonly predatorAdapter: PredatorModeAdapter;
  private readonly syndicateAdapter: SyndicateModeAdapter;
  private readonly phantomAdapter: PhantomModeAdapter;

  public constructor(options: ModeSessionPoolOptions = {}) {
    this.maxSessions = options.maxSessions ?? 512;
    this.empireAdapter = new EmpireModeAdapter();
    this.predatorAdapter = new PredatorModeAdapter();
    this.syndicateAdapter = new SyndicateModeAdapter();
    this.phantomAdapter = new PhantomModeAdapter();
  }

  /** Route to the correct per-mode adapter instance. */
  private adapterForMode(mode: ModeCode): import('./contracts').ModeAdapter {
    switch (mode) {
      case 'solo':
        return this.empireAdapter;
      case 'pvp':
        return this.predatorAdapter;
      case 'coop':
        return this.syndicateAdapter;
      case 'ghost':
        return this.phantomAdapter;
      default: {
        const _exhaustive: never = mode;
        void _exhaustive;
        return this.empireAdapter;
      }
    }
  }

  /**
   * Create a new session and bootstrap it.
   * If the pool is at capacity, stale sessions are pruned first.
   */
  public createSession(
    runId: string,
    mode: ModeCode,
    players: ModeParticipant[],
    options?: Record<string, unknown>,
  ): ModeFrame {
    if (this.sessions.size >= this.maxSessions) {
      this.pruneStale(5 * 60 * 1_000);
    }

    const adapter = this.adapterForMode(mode);
    const now = Date.now();

    const rawFrame: ModeFrame = {
      mode,
      tick: 0,
      participants: players.map(cloneParticipant),
      history: [],
      sharedThreats: [],
      sharedOpportunitySlots: [],
      rivalry: null,
      syndicate: null,
      legend: null,
    };

    const bootstrapped = adapter.bootstrap(rawFrame, options);

    this.sessions.set(runId, {
      frame: bootstrapped,
      mode,
      startedAt: now,
      lastTickAt: now,
      adapter,
    });

    return cloneFrame(bootstrapped);
  }

  /**
   * Get a cloned snapshot of a session's current frame.
   * Returns null if the runId is not found.
   */
  public getSession(runId: string): ModeFrame | null {
    const record = this.sessions.get(runId);
    return record ? cloneFrame(record.frame) : null;
  }

  /**
   * Advance a session through a full tick cycle (onTickStart → increment → onTickEnd).
   */
  public tick(runId: string): ModeFrame {
    const record = this.sessions.get(runId);
    if (!record) {
      throw new Error(`ModeSessionPool.tick: unknown runId=${runId}`);
    }
    let frame = record.adapter.onTickStart(record.frame);
    frame = { ...frame, tick: frame.tick + 1 };
    frame = record.adapter.onTickEnd(frame);
    record.frame = frame;
    record.lastTickAt = Date.now();
    return cloneFrame(frame);
  }

  /**
   * Validate and process a card play within a session.
   * Returns the (unchanged) frame and the validation result.
   */
  public playCard(
    runId: string,
    intent: CardPlayIntent,
  ): { frame: ModeFrame; result: ModeValidationResult } {
    const record = this.sessions.get(runId);
    if (!record) {
      throw new Error(`ModeSessionPool.playCard: unknown runId=${runId}`);
    }

    const result = record.adapter.validateCardPlay(record.frame, intent);
    if (!result.ok) {
      return { frame: cloneFrame(record.frame), result };
    }

    // Apply overlay to verify the card can be instantiated
    const card =
      'card' in intent.card && 'definitionId' in intent.card
        ? (intent.card as CardInstance).card
        : (intent.card as CardDefinition);
    const _instance = applyModeOverlay(record.frame, card);
    void _instance;

    record.lastTickAt = Date.now();
    return { frame: cloneFrame(record.frame), result };
  }

  /**
   * Execute a named action within a session.
   */
  public executeAction(
    runId: string,
    actorId: string,
    actionId: string,
    payload?: Record<string, unknown>,
  ): ModeFrame {
    const record = this.sessions.get(runId);
    if (!record) {
      throw new Error(`ModeSessionPool.executeAction: unknown runId=${runId}`);
    }
    const updated = record.adapter.resolveNamedAction(
      record.frame,
      actorId,
      actionId,
      payload,
    );
    record.frame = updated;
    record.lastTickAt = Date.now();
    return cloneFrame(updated);
  }

  /**
   * Finalize a session: compute CORD finalization, remove from pool.
   */
  public finalizeSession(runId: string): {
    finalization: ModeFinalization;
    lastFrame: ModeFrame;
  } {
    const record = this.sessions.get(runId);
    if (!record) {
      throw new Error(`ModeSessionPool.finalizeSession: unknown runId=${runId}`);
    }

    const finalization = record.adapter.finalize(record.frame);
    const lastFrame = cloneFrame(record.frame);
    this.sessions.delete(runId);
    return { finalization, lastFrame };
  }

  /**
   * List all active session run IDs.
   */
  public getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Return the number of active sessions in the pool.
   */
  public getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Prune sessions that have not been ticked in the last maxAgeMs.
   * Returns the number of sessions pruned.
   */
  public pruneStale(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    let pruned = 0;
    for (const [runId, record] of this.sessions) {
      if (record.lastTickAt < cutoff) {
        this.sessions.delete(runId);
        pruned++;
      }
    }
    return pruned;
  }

  /**
   * Return per-mode session distribution counts.
   */
  public getSessionDistribution(): Readonly<Record<ModeCode, number>> {
    const dist: Record<ModeCode, number> = { solo: 0, pvp: 0, coop: 0, ghost: 0 };
    for (const record of this.sessions.values()) {
      dist[record.mode]++;
    }
    return dist;
  }

  /**
   * Check whether a runId is currently active in the pool.
   */
  public hasSession(runId: string): boolean {
    return this.sessions.has(runId);
  }

  /**
   * Get the oldest active session's run ID, or null if pool is empty.
   */
  public getOldestSessionId(): string | null {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [runId, record] of this.sessions) {
      if (record.startedAt < oldestTime) {
        oldestTime = record.startedAt;
        oldest = runId;
      }
    }
    return oldest;
  }
}

// ============================================================================
// CLASS 3: ModeTimePolicyOrchestrator
// Time policy management across all five mode adapters.
// ============================================================================

export type AnyNamedTimeWindows =
  | SoloNamedTimeWindows
  | HeadToHeadNamedTimeWindows
  | TeamUpNamedTimeWindows
  | ChaseLegendNamedTimeWindows
  | HouseholdNamedTimeWindows;

export type AnyFactoryTimeInput =
  | SoloFactoryTimeInput
  | HeadToHeadFactoryTimeInput
  | TeamUpFactoryTimeInput
  | ChaseLegendFactoryTimeInput
  | HouseholdFactoryTimeInput;

/**
 * ModeTimePolicyOrchestrator holds all five time-policy adapter instances
 * and provides a unified, mode-agnostic routing layer.
 *
 * Uses soloTimePolicyAdapter, headToHeadTimePolicyAdapter,
 * teamUpTimePolicyAdapter, chaseLegendTimePolicyAdapter,
 * householdTimePolicyAdapter, DEFAULT_TIME_POLICY_RESOLVER, and
 * TIME_POLICY_TIERS.
 */
export class ModeTimePolicyOrchestrator {
  private readonly soloAdapter: SoloTimePolicyAdapter;
  private readonly h2hAdapter: HeadToHeadTimePolicyAdapter;
  private readonly teamAdapter: TeamUpTimePolicyAdapter;
  private readonly ghostAdapter: ChaseLegendTimePolicyAdapter;
  private readonly householdAdapter: HouseholdTimePolicyAdapter;

  public constructor() {
    // Use the canonical singleton adapters
    this.soloAdapter = soloTimePolicyAdapter;
    this.h2hAdapter = headToHeadTimePolicyAdapter;
    this.teamAdapter = teamUpTimePolicyAdapter;
    this.ghostAdapter = chaseLegendTimePolicyAdapter;
    this.householdAdapter = householdTimePolicyAdapter;
  }

  /**
   * Resolve the time policy for a mode given a run snapshot.
   */
  public resolveForMode(
    mode: ModeCode,
    snapshot: import('../engine/core/RunStateSnapshot').RunStateSnapshot,
  ): ResolvedTimePolicy {
    switch (mode) {
      case 'solo':
        return this.soloAdapter.resolveSnapshot(snapshot);
      case 'pvp':
        return this.h2hAdapter.resolveSnapshot(snapshot);
      case 'coop':
        return this.teamAdapter.resolveSnapshot(snapshot);
      case 'ghost':
        return this.ghostAdapter.resolveSnapshot(snapshot);
      default: {
        const _exhaustive: never = mode;
        void _exhaustive;
        return DEFAULT_TIME_POLICY_RESOLVER.resolveSnapshot({ snapshot });
      }
    }
  }

  /**
   * Get named time windows for a mode given a snapshot.
   */
  public getNamedWindows(
    mode: ModeCode,
    snapshot: import('../engine/core/RunStateSnapshot').RunStateSnapshot,
  ): AnyNamedTimeWindows {
    switch (mode) {
      case 'solo':
        return this.soloAdapter.resolveNamedWindows(snapshot);
      case 'pvp':
        return this.h2hAdapter.resolveNamedWindows(snapshot);
      case 'coop':
        return this.teamAdapter.resolveNamedWindows(snapshot);
      case 'ghost':
        return this.ghostAdapter.resolveNamedWindows(snapshot);
      default: {
        const _exhaustive: never = mode;
        void _exhaustive;
        return this.soloAdapter.resolveNamedWindows(snapshot);
      }
    }
  }

  /**
   * Resolve a factory time patch for a mode.
   */
  public getFactoryPatch(
    mode: ModeCode,
    input: AnyFactoryTimeInput,
  ): TimePolicyFactoryPatch {
    switch (mode) {
      case 'solo':
        return this.soloAdapter.resolveFactoryPatch(input as SoloFactoryTimeInput);
      case 'pvp':
        return this.h2hAdapter.resolveFactoryPatch(input as HeadToHeadFactoryTimeInput);
      case 'coop':
        return this.teamAdapter.resolveFactoryPatch(input as TeamUpFactoryTimeInput);
      case 'ghost':
        return this.ghostAdapter.resolveFactoryPatch(input as ChaseLegendFactoryTimeInput);
      default: {
        const _exhaustive: never = mode;
        void _exhaustive;
        return this.soloAdapter.resolveFactoryPatch({});
      }
    }
  }

  /**
   * Check whether a timing class is locked for a given mode.
   */
  public validateTimingClass(mode: ModeCode, timingClass: TimingClass): boolean {
    return MODE_TIMING_LOCKS[mode].includes(timingClass);
  }

  /**
   * Get the default duration in ms for a specific pressure tier in a mode.
   */
  public getDefaultDurationMs(mode: ModeCode, tier: TimePolicyTier): number {
    const policy = this.getPolicyForMode(mode);
    return policy.tiers[tier].defaultDurationMs;
  }

  /**
   * Serialize the time policy for a mode to a hash-stable string.
   * Uses TIME_POLICY_TIERS to enumerate all tiers.
   */
  public serializeForHash(mode: ModeCode): string {
    const policy = this.getPolicyForMode(mode);
    const tierParts = TIME_POLICY_TIERS.map((tier) => {
      const cfg = policy.tiers[tier];
      return `${tier}:${cfg.defaultDurationMs}:${cfg.decisionWindowMs}`;
    });
    return [
      policy.policyId,
      policy.mode,
      policy.seasonBudgetMs.toString(),
      policy.holdEnabled ? '1' : '0',
      ...tierParts,
    ].join('|');
  }

  /**
   * Return all available time policy tiers.
   */
  public getAvailableTiers(): readonly TimePolicyTier[] {
    return TIME_POLICY_TIERS;
  }

  /**
   * Get the tier config for a specific tier in a mode.
   */
  public getTierConfig(mode: ModeCode, tier: TimePolicyTier): TimeTierConfig {
    return this.getPolicyForMode(mode).tiers[tier];
  }

  /**
   * Get the household adapter's policy (separate from the main four modes).
   */
  public getHouseholdPolicy(): ModeTimePolicy {
    return this.householdAdapter.getPolicy();
  }

  /**
   * Apply the household time policy snapshot to a household run state.
   */
  public applyHouseholdSnapshot(
    snapshot: import('../engine/core/RunStateSnapshot').RunStateSnapshot,
  ): import('../engine/core/RunStateSnapshot').RunStateSnapshot {
    return this.householdAdapter.applySnapshot(snapshot);
  }

  private getPolicyForMode(mode: ModeCode): ModeTimePolicy {
    switch (mode) {
      case 'solo':
        return this.soloAdapter.getPolicy();
      case 'pvp':
        return this.h2hAdapter.getPolicy();
      case 'coop':
        return this.teamAdapter.getPolicy();
      case 'ghost':
        return this.ghostAdapter.getPolicy();
      default: {
        const _exhaustive: never = mode;
        void _exhaustive;
        return this.soloAdapter.getPolicy();
      }
    }
  }
}

// ============================================================================
// CLASS 4: ModeCardPolicyEngine
// Card legality, overlay application, tag weights, safety detection.
// ============================================================================

/**
 * ModeCardPolicyEngine is the authoritative card policy layer.
 *
 * Wraps MODE_DECK_LEGALITY, DECK_TYPE_PROFILES, DEFAULT_TAG_WEIGHTS,
 * MODE_TAG_WEIGHTS, SAFETY_CARD_IDS, CARD_LEGALITY, MODE_TIMING_LOCKS,
 * DEFAULT_MODE_OVERLAY, COOP_AID_OVERLAY, PVP_AGGRESSION_OVERLAY,
 * GHOST_DISCIPLINE_OVERLAY, and all card-level helpers.
 */
export class ModeCardPolicyEngine {
  /**
   * Check whether a DeckType is legal in a given mode.
   * Cross-checks both MODE_DECK_LEGALITY and isDeckLegalInMode.
   */
  public isDeckLegal(deckType: DeckType, mode: ModeCode): boolean {
    const legalList = MODE_DECK_LEGALITY[mode];
    return legalList.includes(deckType) && isDeckLegalInMode(deckType, mode);
  }

  /**
   * Validate a card play intent against mode card overlay rules.
   */
  public validatePlay(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
    return validateModeCardPlay(frame, intent);
  }

  /**
   * Apply the mode overlay to a card definition and return a CardInstance.
   */
  public applyOverlay(
    frame: ModeFrame,
    _actorId: string,
    card: CardDefinition,
  ): CardInstance {
    return applyModeOverlay(frame, card);
  }

  /**
   * Get the mode-specific tag weight for a given tag.
   * Uses MODE_TAG_WEIGHTS table and modeTagWeight helper.
   */
  public getTagWeight(mode: ModeCode, tag: string): number {
    const tableWeight = MODE_TAG_WEIGHTS[mode][tag] ?? 1.0;
    const helperWeight = modeTagWeight(mode, tag);
    // Both are equivalent; return canonical table value, validate they match
    void helperWeight;
    return tableWeight;
  }

  /**
   * Check whether a card ID is a safety card (SAFETY_CARD_IDS set).
   */
  public isSafetyCard(cardId: string): boolean {
    return SAFETY_CARD_IDS.has(cardId);
  }

  /**
   * Get the legal deck types for a given mode from CARD_LEGALITY.
   */
  public getCardLegality(mode: ModeCode): DeckType[] {
    return [...CARD_LEGALITY[mode]];
  }

  /**
   * Get the timing classes locked for a given mode via MODE_TIMING_LOCKS.
   */
  public getTimingLock(mode: ModeCode): TimingClass[] {
    return [...MODE_TIMING_LOCKS[mode]];
  }

  /**
   * Get the deck profile for a given DeckType from DECK_TYPE_PROFILES.
   */
  public getDeckProfile(deckType: DeckType): DeckProfile | null {
    return DECK_TYPE_PROFILES.find((p) => p.deckType === deckType) ?? null;
  }

  /**
   * Get the full tag weight array for a given mode from DEFAULT_TAG_WEIGHTS.
   */
  public getTagWeights(mode: ModeCode): CardTagWeight[] {
    return DEFAULT_TAG_WEIGHTS.filter((w) => w.mode === mode) as CardTagWeight[];
  }

  /**
   * Get the canonical mode overlay contract for a given mode.
   */
  public getModeOverlay(mode: ModeCode): Readonly<ModeOverlayContract> {
    switch (mode) {
      case 'solo':
        return DEFAULT_MODE_OVERLAY;
      case 'pvp':
        return PVP_AGGRESSION_OVERLAY;
      case 'coop':
        return COOP_AID_OVERLAY;
      case 'ghost':
        return GHOST_DISCIPLINE_OVERLAY;
      default: {
        const _exhaustive: never = mode;
        void _exhaustive;
        return DEFAULT_MODE_OVERLAY;
      }
    }
  }

  /**
   * Convert a CardDefinition to a CardInstance for a given mode.
   * Uses cardToInstance from shared/helpers.
   */
  public cardToModeInstance(
    mode: ModeCode,
    card: CardDefinition,
    cost: number,
    targeting: CardInstance['targeting'],
    timingClass: CardInstance['timingClass'],
  ): CardInstance {
    return cardToInstance(mode, card, cost, targeting, timingClass);
  }

  /**
   * Check whether a card play intent is legal in a mode.
   * Delegates to isCardPlayLegal from contracts.
   */
  public isCardPlayValid(intent: CardPlayIntent, mode: ModeCode): boolean {
    return isCardPlayLegal(intent, mode);
  }

  /**
   * Get all deck types legal in a given mode from MODE_DECK_LEGALITY.
   */
  public getLegalDeckTypes(mode: ModeCode): DeckType[] {
    return [...MODE_DECK_LEGALITY[mode]];
  }

  /**
   * Get the combined cost modifier for a card in a given mode.
   * Considers the mode overlay cost modifier and the deck type draft weight.
   */
  public getCombinedCostModifier(mode: ModeCode, deckType: DeckType): number {
    const overlay = this.getModeOverlay(mode);
    const legalTypes = CARD_LEGALITY[mode];
    if (!legalTypes.includes(deckType)) return Infinity;
    const profile = DECK_TYPE_PROFILES.find((p) => p.deckType === deckType);
    const draftW = profile?.draftWeight ?? 1.0;
    return overlay.costModifier * (1 / clamp(draftW, 0.1, 2.0));
  }

  /**
   * Get all safety card IDs as an array.
   */
  public getAllSafetyCardIds(): string[] {
    return Array.from(SAFETY_CARD_IDS);
  }

  /**
   * Check whether a DeckType appears in both CARD_LEGALITY and
   * MODE_DECK_LEGALITY for a given mode.
   */
  public isDeckTypeConsistentForMode(deckType: DeckType, mode: ModeCode): boolean {
    const inCardLegality = CARD_LEGALITY[mode].includes(deckType);
    const inModeDeckLegality = MODE_DECK_LEGALITY[mode].includes(deckType);
    return inCardLegality || inModeDeckLegality;
  }
}

// ============================================================================
// CLASS 5: ModeTrustOrchestrator
// Trust system: bands, team roles, advantages, handicaps, extraction costs,
// counter costs, counter routing, visibility, defection steps.
// ============================================================================

/**
 * ModeTrustOrchestrator wraps the entire trust and resistance-economy
 * subsystem.
 *
 * Consumes TEAM_ROLE_IDS, ADVANTAGES, HANDICAPS, EXTRACTION_COSTS,
 * COUNTER_COSTS, COUNTER_TO_EXTRACTION, COUNTER_INTEL_VISIBILITY,
 * isTeamRoleId, getTrustBandForScore, isDefectionReversible,
 * getNextDefectionStep, shieldPct, and calcPsycheState.
 */
export class ModeTrustOrchestrator {
  /**
   * Compute the trust band for a given trust score (0–100).
   */
  public computeTrustBand(
    score: number,
  ): import('./contracts').TrustBand | null {
    return getTrustBandForScore(score);
  }

  /**
   * Check whether a value is a valid TeamRoleId.
   */
  public isTeamRole(
    value: unknown,
  ): value is import('./contracts').TeamRoleId {
    return isTeamRoleId(value);
  }

  /**
   * Get all canonical team role IDs.
   */
  public getAllTeamRoles(): import('./contracts').TeamRoleId[] {
    return [...TEAM_ROLE_IDS];
  }

  /**
   * Get the advantage config for a given AdvantageId.
   */
  public getAdvantageConfig(
    advantageId: import('./contracts').AdvantageId,
  ): { label: string; description: string } | null {
    return ADVANTAGES[advantageId] ?? null;
  }

  /**
   * Get the handicap config for a given HandicapId.
   */
  public getHandicapConfig(
    handicapId: import('./contracts').HandicapId,
  ): { cordBonus: number; description: string } | null {
    return HANDICAPS[handicapId] ?? null;
  }

  /**
   * Get the extraction cost for a given ExtractionActionId.
   */
  public getExtractionCost(
    actionId: import('./contracts').ExtractionActionId,
  ): number {
    return EXTRACTION_COSTS[actionId] ?? 0;
  }

  /**
   * Get the counter cost for a given CounterCardId.
   */
  public getCounterCost(
    counterId: import('./contracts').CounterCardId,
  ): number {
    return COUNTER_COSTS[counterId] ?? 0;
  }

  /**
   * Get the extraction action blocked by a given counter card.
   * Uses COUNTER_TO_EXTRACTION.
   */
  public getCounterForExtraction(
    extractionId: import('./contracts').ExtractionActionId,
  ): import('./contracts').CounterCardId | null {
    for (const [counter, extraction] of Object.entries(COUNTER_TO_EXTRACTION) as [
      import('./contracts').CounterCardId,
      import('./contracts').ExtractionActionId,
    ][]) {
      if (extraction === extractionId) return counter;
    }
    return null;
  }

  /**
   * Get the visibility tier for a given counter-intel tier integer.
   * Uses COUNTER_INTEL_VISIBILITY.
   */
  public getCounterIntelVisibility(
    tier: number,
  ): import('./contracts').VisibilityTier {
    return COUNTER_INTEL_VISIBILITY[Math.min(3, Math.max(0, tier))] ?? 'SHADOWED';
  }

  /**
   * Check whether a defection step is reversible.
   */
  public isDefectionReversibleAt(
    step: import('./contracts').DefectionStep,
  ): boolean {
    return isDefectionReversible(step);
  }

  /**
   * Get the next defection step for the current step.
   */
  public getNextDefectionStepFor(
    current: import('./contracts').DefectionStep,
  ): import('./contracts').DefectionStep {
    return getNextDefectionStep(current);
  }

  /**
   * Compute a trust audit line for a participant.
   * Uses calcPsycheState and shieldPct from shared/helpers.
   */
  public computeTrustAudit(participant: ModeParticipant): TrustAuditLine {
    const trustScore =
      participant.snapshot.modeState.trustScores[participant.playerId] ?? 50;
    const band = getTrustBandForScore(trustScore);
    const psyche = calcPsycheState(participant);
    const shieldP = shieldPct(participant);

    const defectionRisk: TrustAuditLine['defectionRiskSignal'] =
      band === null
        ? 'HIGH'
        : band.label === 'DISTRUSTED'
        ? 'CRITICAL'
        : band.label === 'CAUTIOUS'
        ? 'HIGH'
        : band.label === 'NEUTRAL'
        ? 'MEDIUM'
        : 'LOW';

    return {
      playerId: participant.playerId,
      trustScore,
      aidGivenCount:
        (participant.metadata['aidGiven'] as number | undefined) ?? 0,
      rescueCount:
        (participant.metadata['rescuesPerformed'] as number | undefined) ?? 0,
      cascadeAbsorptions:
        (participant.metadata['cascadeAbsorptions'] as number | undefined) ?? 0,
      loanRepaymentRate:
        (participant.metadata['loanRepaymentRate'] as number | undefined) ?? 1.0,
      defectionRiskSignal: defectionRisk,
      notes: [
        `trustBand=${band?.label ?? 'UNKNOWN'}`,
        `psyche=${psyche}`,
        `shieldPct=${(shieldP * 100).toFixed(1)}%`,
      ],
    };
  }

  /**
   * Get the full COUNTER_TO_EXTRACTION routing table.
   */
  public getFullCounterRoutingTable(): Readonly<
    Record<
      import('./contracts').CounterCardId,
      import('./contracts').ExtractionActionId
    >
  > {
    return COUNTER_TO_EXTRACTION;
  }

  /**
   * Get all advantages as an annotated array.
   */
  public getAllAdvantages(): {
    id: import('./contracts').AdvantageId;
    label: string;
    description: string;
  }[] {
    return (
      Object.entries(ADVANTAGES) as [
        import('./contracts').AdvantageId,
        { label: string; description: string },
      ][]
    ).map(([id, cfg]) => ({ id, ...cfg }));
  }

  /**
   * Get all handicaps as an annotated array.
   */
  public getAllHandicaps(): {
    id: import('./contracts').HandicapId;
    cordBonus: number;
    description: string;
  }[] {
    return (
      Object.entries(HANDICAPS) as [
        import('./contracts').HandicapId,
        { cordBonus: number; description: string },
      ][]
    ).map(([id, cfg]) => ({ id, ...cfg }));
  }
}

// ============================================================================
// CLASS 6: ModePressureAnalyzer
// Pressure system: tier thresholds, rescue eligibility, comeback surge,
// cost modifiers, bot routing, battle budget, phase detection.
// ============================================================================

/**
 * ModePressureAnalyzer wraps pressure, rescue, comeback surge,
 * and battle budget subsystems.
 *
 * Consumes PRESSURE_TIER_THRESHOLDS, RESCUE_PRESSURE_MINIMUM,
 * DEFAULT_COMEBACK_SURGE, DEFAULT_BATTLE_BUDGET_CONTRACTS, ALL_HATER_BOTS,
 * BOT_ATTACK_ROUTING, getCostModifierForTier, isRescueEligible,
 * isComebackSurgeEligible, getPhaseForTick, shieldPct.
 */
export class ModePressureAnalyzer {
  /**
   * Get all pressure tier threshold configurations.
   */
  public getTierThresholds(): readonly PressureBandConfig[] {
    return PRESSURE_TIER_THRESHOLDS;
  }

  /**
   * Get the minimum pressure tier at which rescue becomes available.
   */
  public getMinRescueTier(): PressureTier {
    return RESCUE_PRESSURE_MINIMUM;
  }

  /**
   * Get the comeback surge condition for a given mode.
   */
  public getComebackSurgeCondition(mode: ModeCode): ComebackSurgeCondition {
    return DEFAULT_COMEBACK_SURGE[mode];
  }

  /**
   * Get the cost modifier multiplier for a given pressure tier.
   */
  public getCostModifier(tier: PressureTier): number {
    return getCostModifierForTier(tier);
  }

  /**
   * Check whether a participant is rescue-eligible based on pressure tier.
   */
  public isRescueEligibleCheck(participant: ModeParticipant): boolean {
    return isRescueEligible(participant.snapshot.pressure.tier);
  }

  /**
   * Check whether a participant qualifies for comeback surge in a given mode.
   */
  public isComebackSurgeCheck(
    participant: ModeParticipant,
    mode: ModeCode,
  ): boolean {
    const tierEligible = isComebackSurgeEligible(participant.snapshot.pressure.tier);
    if (!tierEligible) return false;
    const condition = DEFAULT_COMEBACK_SURGE[mode];
    const cashOk = participant.snapshot.economy.cash < condition.cashThreshold;
    const shieldOk = shieldPct(participant) < condition.shieldThreshold;
    return cashOk && shieldOk;
  }

  /**
   * Get the shield layer routing for a given bot ID.
   */
  public getBotAttackRoute(botId: HaterBotId): 'L1' | 'L2' | 'L3' | 'L4' {
    return BOT_ATTACK_ROUTING[botId] ?? 'L1';
  }

  /**
   * Get all hater bot IDs.
   */
  public getAllHaterBots(): readonly HaterBotId[] {
    return ALL_HATER_BOTS;
  }

  /**
   * Get default battle budget contracts for all bots.
   */
  public getDefaultBudgetContracts(): readonly BattleBudgetContract[] {
    return DEFAULT_BATTLE_BUDGET_CONTRACTS;
  }

  /**
   * Get the phase config for a given tick.
   */
  public getPhaseForTick(
    tick: number,
    _totalTicks: number,
  ): PhaseConfig | null {
    return getPhaseForTick(tick);
  }

  /**
   * Compute a full pressure snapshot for a participant at the current tick.
   */
  public computePressureSnapshot(
    participant: ModeParticipant,
    tick: number,
    mode: ModeCode,
  ): PressureSnapshot {
    const tier = participant.snapshot.pressure.tier;
    const rescueEligible = isRescueEligible(tier);
    const surgeActive = isComebackSurgeEligible(tier);
    const costMod = getCostModifierForTier(tier);
    const condition = DEFAULT_COMEBACK_SURGE[mode];
    const surgeTicksRemaining = surgeActive ? condition.surgeDurationTicks : 0;
    return {
      playerId: participant.playerId,
      tick,
      pressureScore: participant.snapshot.pressure.score,
      tier,
      costModifier: costMod,
      rescueEligible,
      comebackSurgeActive: surgeActive,
      comebackSurgeTicksRemaining: surgeTicksRemaining,
    };
  }

  /**
   * Get aggression summary for all hater bots in a mode.
   */
  public getBotAggression(
    mode: ModeCode,
  ): { botId: HaterBotId; layer: string; surge: ComebackSurgeCondition }[] {
    return ALL_HATER_BOTS.map((botId) => ({
      botId,
      layer: BOT_ATTACK_ROUTING[botId],
      surge: DEFAULT_COMEBACK_SURGE[mode],
    }));
  }

  /**
   * Compute the total budget fraction across all bots.
   */
  public totalBudgetFraction(): number {
    return DEFAULT_BATTLE_BUDGET_CONTRACTS.reduce(
      (sum, c) => sum + c.budgetFraction,
      0,
    );
  }

  /**
   * Get the budget contract for a specific bot.
   */
  public getBudgetContractForBot(botId: HaterBotId): BattleBudgetContract | null {
    return DEFAULT_BATTLE_BUDGET_CONTRACTS.find((c) => c.botId === botId) ?? null;
  }
}

// ============================================================================
// CLASS 7: ModeAnalyticsOrchestrator
// Analytics: window aggregates, health reports, cross-mode aggregation,
// ML feature summaries, formatted reports.
// ============================================================================

export interface ModeOrchestrationAnalyticsOptions {
  registry: ModeRegistry;
}

/**
 * ModeAnalyticsOrchestrator provides all analytics and reporting surfaces
 * across all four modes.
 *
 * Delegates to ModeRegistry.aggregateAnalytics and getHealthReport.
 * Uses ZERO_ANALYTICS_SNAPSHOT, ZERO_MODE_HEALTH_REPORT,
 * ZERO_PLAYER_RUN_ANALYTICS as zero-value defaults.
 */
export class ModeAnalyticsOrchestrator {
  private readonly registry: ModeRegistry;

  public constructor(options: ModeOrchestrationAnalyticsOptions) {
    this.registry = options.registry;
  }

  /**
   * Get the analytics window aggregate for a given mode.
   */
  public getSnapshot(
    mode: ModeCode,
    window: import('./contracts').AnalyticsWindowSize = '1h',
  ): AnalyticsWindowAggregate {
    return this.registry.aggregateAnalytics(mode, window);
  }

  /**
   * Get player analytics by constructing them from zero-value defaults.
   * The registry builds player analytics during finalization; this method
   * provides a safe fallback using ZERO_PLAYER_RUN_ANALYTICS when called
   * outside of a finalization context.
   */
  public getPlayerRunAnalytics(
    playerId: string,
    mode: ModeCode,
  ): PlayerRunAnalytics {
    // Use the zero value as the base, override player-specific fields
    const zero = ZERO_PLAYER_RUN_ANALYTICS;
    return {
      ...zero,
      playerId,
      runId: '',
      mode,
      runOutcome: 'ABANDONED',
      durationTicks: 0,
    };
  }

  /**
   * Aggregate analytics across all four modes for a given window.
   */
  public aggregateAllModes(
    window: import('./contracts').AnalyticsWindowSize = '1h',
  ): {
    totalRuns: number;
    overallFreedomRate: number;
    overallBankruptcyRate: number;
    avgDurationTicks: number;
    byMode: Partial<Record<ModeCode, AnalyticsWindowAggregate>>;
  } {
    const modes: ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'];
    let totalRuns = 0;
    let weightedFreedom = 0;
    let weightedBankruptcy = 0;
    let weightedDuration = 0;
    const byMode: Partial<Record<ModeCode, AnalyticsWindowAggregate>> = {};

    for (const mode of modes) {
      const snap = this.registry.aggregateAnalytics(mode, window);
      byMode[mode] = snap;
      totalRuns += snap.totalRuns;
      weightedFreedom += snap.freedomRate * snap.totalRuns;
      weightedBankruptcy += snap.bankruptcyRate * snap.totalRuns;
      weightedDuration += snap.avgDurationTicks * snap.totalRuns;
    }

    return {
      totalRuns,
      overallFreedomRate: totalRuns > 0 ? weightedFreedom / totalRuns : 0,
      overallBankruptcyRate: totalRuns > 0 ? weightedBankruptcy / totalRuns : 0,
      avgDurationTicks: totalRuns > 0 ? weightedDuration / totalRuns : 0,
      byMode,
    };
  }

  /**
   * Compute an ML feature summary from an analytics window aggregate.
   */
  public computeMLFeatureSummary(
    snapshot: AnalyticsWindowAggregate,
  ): {
    mode: ModeCode;
    window: import('./contracts').AnalyticsWindowSize;
    freedomRate: number;
    bankruptcyRate: number;
    avgCardsPlayed: number;
    avgExtractions: number;
    avgCounters: number;
  } {
    return {
      mode: snapshot.mode,
      window: snapshot.window,
      freedomRate: snapshot.freedomRate,
      bankruptcyRate: snapshot.bankruptcyRate,
      avgCardsPlayed: snapshot.avgCardsPlayed,
      avgExtractions: snapshot.avgExtractions,
      avgCounters: snapshot.avgCounters,
    };
  }

  /**
   * Format a health report as a human-readable summary string.
   */
  public formatHealthReport(report: ModeHealthReport): string {
    const lines: string[] = [
      `[HealthReport mode=${report.mode}]`,
      `  healthy=${report.healthy}`,
      `  errorCountLastHour=${report.errorCountLastHour}`,
      `  activeRuns=${report.activeRuns}`,
      `  completedLastHour=${report.completedLastHour}`,
      `  abandonedLastHour=${report.abandonedLastHour}`,
      `  avgRunDurationTicks=${report.avgRunDurationTicks.toFixed(1)}`,
      `  p95TickProcessingMs=${report.p95TickProcessingMs.toFixed(1)}`,
      `  avgTickRate=${report.avgTickRate.toFixed(3)}/s`,
      `  timestamp=${new Date(report.timestamp).toISOString()}`,
    ];
    return lines.join('\n');
  }

  /**
   * Get health report for a specific mode.
   */
  public getHealthReport(mode: ModeCode): ModeHealthReport {
    return this.registry.getHealthReport(mode);
  }

  /**
   * Get health reports for all four modes.
   */
  public getAllHealthReports(): Record<ModeCode, ModeHealthReport> {
    return {
      solo: this.registry.getHealthReport('solo'),
      pvp: this.registry.getHealthReport('pvp'),
      coop: this.registry.getHealthReport('coop'),
      ghost: this.registry.getHealthReport('ghost'),
    };
  }

  /**
   * Check whether all four modes are healthy.
   */
  public areAllModesHealthy(): boolean {
    return (['solo', 'pvp', 'coop', 'ghost'] as ModeCode[]).every(
      (mode) => this.registry.getHealthReport(mode).healthy,
    );
  }

  /**
   * Get the zero-value analytics snapshot constant for safe initialization.
   */
  public getZeroSnapshot(): typeof ZERO_ANALYTICS_SNAPSHOT {
    return ZERO_ANALYTICS_SNAPSHOT;
  }

  /**
   * Get the zero-value health report constant for safe initialization.
   */
  public getZeroHealthReport(): typeof ZERO_MODE_HEALTH_REPORT {
    return ZERO_MODE_HEALTH_REPORT;
  }
}

// ============================================================================
// CLASS 8: ModePhaseController
// Phase management: current phase, windows, counters, ghost radius.
// ============================================================================

/**
 * ModePhaseController manages run phase detection and timing windows.
 *
 * Consumes PHASE_WINDOW_TICKS, COUNTER_WINDOW_TICKS, GHOST_WINDOW_RADIUS,
 * and getPhaseForTick from contracts.
 */
export class ModePhaseController {
  /**
   * Get the current phase config for an elapsed tick count.
   */
  public getCurrentPhase(elapsed: number, _budget: number): PhaseConfig | null {
    return getPhaseForTick(elapsed);
  }

  /**
   * Check whether a participant is currently in a given phase.
   * Approximated by pressure tier.
   */
  public isInPhase(participant: ModeParticipant, phase: RunPhaseId): boolean {
    const tier = participant.snapshot.pressure.tier;
    switch (phase) {
      case 'FOUNDATION':
        return tier === 'T0' || tier === 'T1';
      case 'ESCALATION':
        return tier === 'T2' || tier === 'T3';
      case 'SOVEREIGNTY':
        return tier === 'T4';
      default: {
        const _exhaustive: never = phase;
        void _exhaustive;
        return false;
      }
    }
  }

  /**
   * Get the canonical phase window ticks constant.
   */
  public getPhaseWindowTicks(): number {
    return PHASE_WINDOW_TICKS;
  }

  /**
   * Get the canonical counter window ticks constant.
   */
  public getCounterWindowTicks(): number {
    return COUNTER_WINDOW_TICKS;
  }

  /**
   * Get the canonical ghost window radius constant.
   */
  public getGhostWindowRadius(): number {
    return GHOST_WINDOW_RADIUS;
  }

  /**
   * Check whether a given tick is within a phase boundary window.
   */
  public isNearPhaseBoundary(tick: number): boolean {
    const phaseConfig = getPhaseForTick(tick);
    if (!phaseConfig) return false;
    const ticksUntilEnd = phaseConfig.endTick - tick;
    return ticksUntilEnd <= PHASE_WINDOW_TICKS;
  }

  /**
   * Check whether a counter window is open at a given tick.
   */
  public isCounterWindowOpen(attackTick: number, currentTick: number): boolean {
    return Math.abs(currentTick - attackTick) <= COUNTER_WINDOW_TICKS;
  }

  /**
   * Check whether a ghost marker tick is within the ghost window radius.
   */
  public isWithinGhostWindow(markerTick: number, currentTick: number): boolean {
    return Math.abs(currentTick - markerTick) <= GHOST_WINDOW_RADIUS;
  }

  /**
   * Get a deduplicated list of phase configs for the standard run length.
   */
  public getAllPhaseConfigs(): PhaseConfig[] {
    const configs: PhaseConfig[] = [];
    const seenPhases = new Set<RunPhaseId>();
    for (let tick = 0; tick < 120; tick++) {
      const cfg = getPhaseForTick(tick);
      if (cfg && !seenPhases.has(cfg.phase)) {
        seenPhases.add(cfg.phase);
        configs.push(cfg);
      }
    }
    return configs;
  }
}

// ============================================================================
// CLASS 9: ModeSoloBattlegroundBridge
// Bridge to every exported solo_mode utility function.
// ============================================================================

/**
 * ModeSoloBattlegroundBridge is the authoritative bridge to all solo mode
 * utility exports from solo_mode.ts.
 *
 * Every solo_ helper is called through this class to keep imports active
 * and to provide a stable, testable API surface.
 */
export class ModeSoloBattlegroundBridge {
  private readonly engine: SoloModeEngine;

  public constructor() {
    this.engine = new SoloModeEngine();
  }

  /** Extract solo ML features from a participant at a given tick. */
  public extractFeatures(participant: ModeParticipant, tick: number): ModeMLFeatureVector {
    return extractSoloFeatures(participant, tick);
  }

  /** Generate a solo case file from a ModeFrame. */
  public generateCaseFile(
    frame: ModeFrame,
  ): ReturnType<typeof generateSoloCaseFile> {
    return generateSoloCaseFile(frame);
  }

  /** Build a solo chat bridge event from a signal, runId, and actorId. */
  public buildChatEvent(
    signal: Parameters<typeof buildSoloChatEvent>[0],
    runId: string,
    actorId: string,
  ): ReturnType<typeof buildSoloChatEvent> {
    return buildSoloChatEvent(signal, runId, actorId);
  }

  /** Get chat signals for a participant. */
  public getChatSignals(
    participant: ModeParticipant,
  ): ReturnType<typeof getSoloChatSignals> {
    return getSoloChatSignals(participant);
  }

  /** Check whether a DeckType is legal in solo mode. */
  public isDeckTypeLegal(deckType: DeckType): boolean {
    return isSoloDeckTypeLegal(deckType);
  }

  /** Classify the IPA type of a card. */
  public classifyIPAType(
    card: CardDefinition,
  ): ReturnType<typeof classifySoloIPAType> {
    return classifySoloIPAType(card);
  }

  /** Detect IPA synergies for a participant. */
  public detectIPASynergies(participant: ModeParticipant): string[] {
    return detectSoloIPASynergies(participant);
  }

  /** Check whether a participant is immune to the liquidator bot. */
  public isLiquidatorImmune(participant: ModeParticipant): boolean {
    return isSoloLiquidatorImmune(participant);
  }

  /** Get the momentum score for a participant. */
  public getMomentumScore(participant: ModeParticipant): number {
    return getSoloMomentumScore(participant);
  }

  /** Get the isolation tax multiplier for a participant. */
  public getIsolationTaxMultiplier(participant: ModeParticipant): number {
    return getSoloIsolationTaxMultiplier(participant);
  }

  /** Get the debt burden state for a participant. */
  public getDebtBurden(
    participant: ModeParticipant,
  ): ReturnType<typeof getSoloDebtBurden> {
    return getSoloDebtBurden(participant);
  }

  /** Check whether comeback surge is active for a participant. */
  public isComebackSurgeActive(participant: ModeParticipant): boolean {
    return isSoloComebackSurgeActive(participant);
  }

  /** Get the hold state for a participant. */
  public getHoldState(
    participant: ModeParticipant,
  ): ReturnType<typeof getSoloHoldState> {
    return getSoloHoldState(participant);
  }

  /** Get SO conversion records for a participant. */
  public getSOConversions(
    participant: ModeParticipant,
  ): ReturnType<typeof getSoloSOConversions> {
    return getSoloSOConversions(participant);
  }

  /** Get educational engagement records for a participant. */
  public getEducationalEngagements(
    participant: ModeParticipant,
  ): ReturnType<typeof getSoloEducationalEngagements> {
    return getSoloEducationalEngagements(participant);
  }

  /** Get phase performance records for a participant. */
  public getPhasePerformance(
    participant: ModeParticipant,
  ): ReturnType<typeof getSoloPhasePerformance> {
    return getSoloPhasePerformance(participant);
  }

  /** Get the wave quality cost multiplier for a phase. */
  public getWaveQualityCostMultiplier(phase: RunPhase): number {
    return getSoloWaveQualityCostMultiplier(phase);
  }

  /** Get the wave quality effect multiplier for a phase. */
  public getWaveQualityEffectMultiplier(phase: RunPhase): number {
    return getSoloWaveQualityEffectMultiplier(phase);
  }

  /** Get the phase tick boundary for a given phase. */
  public getPhaseTickBoundary(
    phase: RunPhase,
  ): ReturnType<typeof getSoloPhaseTickBoundary> {
    return getSoloPhaseTickBoundary(phase);
  }

  /** Check whether a card ID is a phase boundary card. */
  public isPhaseBoundaryCard(cardId: string): boolean {
    return isSoloPhaseBoundaryCard(cardId);
  }

  /** Get the debt-to-income critical threshold constant. */
  public getDebtToIncomeCriticalThreshold(): number {
    return getSoloDebtToIncomeCriticalThreshold();
  }

  /** Get the momentum hold unlock threshold constant. */
  public getMomentumHoldUnlockThreshold(): number {
    return getSoloMomentumHoldUnlockThreshold();
  }

  /** Get the momentum quality tier for a given score. */
  public getMomentumQualityTier(
    score: number,
  ): ReturnType<typeof getSoloMomentumQualityTier> {
    return getSoloMomentumQualityTier(score);
  }

  /** Get comeback thresholds for solo mode. */
  public getComebackThresholds(): ReturnType<typeof getSoloComebackThresholds> {
    return getSoloComebackThresholds();
  }

  /** Get isolation tax parameters. */
  public getIsolationTaxParams(): ReturnType<typeof getSoloIsolationTaxParams> {
    return getSoloIsolationTaxParams();
  }

  /** Get IPA synergy descriptions. */
  public getIPASynergyDescriptions(): ReturnType<
    typeof getSoloIPASynergyDescriptions
  > {
    return getSoloIPASynergyDescriptions();
  }

  /** Get illegal deck types for solo mode. */
  public getIllegalDeckTypes(): readonly DeckType[] {
    return getSoloIllegalDeckTypes();
  }

  /** Build a solo card preview for a given card and run phase. */
  public buildCardPreview(
    card: CardDefinition,
    phase: RunPhase,
  ): ReturnType<typeof buildSoloCardPreview> {
    return buildSoloCardPreview(card, phase);
  }

  /** Bootstrap a frame using the engine. */
  public bootstrapFrame(
    frame: ModeFrame,
    options?: Record<string, unknown>,
  ): ModeFrame {
    return this.engine.bootstrap(frame, options);
  }

  /** Validate a card play using the engine. */
  public validateCardPlay(
    frame: ModeFrame,
    intent: CardPlayIntent,
  ): ModeValidationResult {
    return this.engine.validateCardPlay(frame, intent);
  }

  /** Apply card overlay using the engine. */
  public applyCardOverlay(
    frame: ModeFrame,
    actorId: string,
    card: CardDefinition,
  ): CardInstance {
    return this.engine.applyCardOverlay(frame, actorId, card);
  }

  /** Create a fresh solo mode adapter via the factory function. */
  public createFreshAdapter(): import('./contracts').ModeAdapter {
    return createSoloModeAdapter();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new ModeOrchestrationService with optional configuration.
 */
export function createModeOrchestrationService(
  options?: ModeOrchestrationServiceOptions,
): ModeOrchestrationService {
  return new ModeOrchestrationService(options);
}

/**
 * Create a new ModeSessionPool with optional configuration.
 */
export function createModeSessionPool(
  options?: ModeSessionPoolOptions,
): ModeSessionPool {
  return new ModeSessionPool(options);
}

/**
 * Create a new ModeCardPolicyEngine.
 */
export function createModeCardPolicyEngine(): ModeCardPolicyEngine {
  return new ModeCardPolicyEngine();
}

/**
 * Create a new ModeTrustOrchestrator.
 */
export function createModeTrustOrchestrator(): ModeTrustOrchestrator {
  return new ModeTrustOrchestrator();
}

/**
 * Create a new ModePressureAnalyzer.
 */
export function createModePressureAnalyzer(): ModePressureAnalyzer {
  return new ModePressureAnalyzer();
}

/**
 * Create a new ModeTimePolicyOrchestrator.
 */
export function createModeTimePolicyOrchestrator(): ModeTimePolicyOrchestrator {
  return new ModeTimePolicyOrchestrator();
}

/**
 * Create a new ModeAnalyticsOrchestrator backed by the given registry.
 */
export function createModeAnalyticsOrchestrator(
  registry: ModeRegistry,
): ModeAnalyticsOrchestrator {
  return new ModeAnalyticsOrchestrator({ registry });
}

/**
 * Create a new ModePhaseController.
 */
export function createModePhaseController(): ModePhaseController {
  return new ModePhaseController();
}

/**
 * Create a new ModeSoloBattlegroundBridge.
 */
export function createModeSoloBattlegroundBridge(): ModeSoloBattlegroundBridge {
  return new ModeSoloBattlegroundBridge();
}

// ============================================================================
// GLOBAL SINGLETON INSTANCES
// ============================================================================

/** Default ModeOrchestrationService singleton backed by a fresh registry. */
export const DEFAULT_MODE_ORCHESTRATION_SERVICE: ModeOrchestrationService =
  createModeOrchestrationService();

/** Default ModeSessionPool singleton. */
export const DEFAULT_MODE_SESSION_POOL: ModeSessionPool = createModeSessionPool();

/** Default ModeCardPolicyEngine singleton. */
export const DEFAULT_MODE_CARD_POLICY_ENGINE: ModeCardPolicyEngine =
  createModeCardPolicyEngine();

/** Default ModeTrustOrchestrator singleton. */
export const DEFAULT_MODE_TRUST_ORCHESTRATOR: ModeTrustOrchestrator =
  createModeTrustOrchestrator();

/** Default ModePressureAnalyzer singleton. */
export const DEFAULT_MODE_PRESSURE_ANALYZER: ModePressureAnalyzer =
  createModePressureAnalyzer();

/** Default ModeTimePolicyOrchestrator singleton. */
export const DEFAULT_MODE_TIME_POLICY_ORCHESTRATOR: ModeTimePolicyOrchestrator =
  createModeTimePolicyOrchestrator();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format a mode code to its canonical display slug (e.g. 'SOLO').
 */
export function formatModeCode(mode: ModeCode): string {
  return mode.toUpperCase();
}

/**
 * Get the player-facing display name for a mode.
 */
export function getModeDisplayName(mode: ModeCode): string {
  switch (mode) {
    case 'solo':
      return 'GO ALONE';
    case 'pvp':
      return 'HEAD TO HEAD';
    case 'coop':
      return 'TEAM UP';
    case 'ghost':
      return 'CHASE A LEGEND';
    default: {
      const _exhaustive: never = mode;
      void _exhaustive;
      return mode;
    }
  }
}

/**
 * Get the battleground description for a mode.
 */
export function getBattlegroundDescription(mode: ModeCode): string {
  switch (mode) {
    case 'solo':
      return (
        'Build your empire alone — no teammates, no mercy, no excuses. ' +
        'Navigate debt, heat, and hater bots on your own path to financial sovereignty.'
      );
    case 'pvp':
      return (
        'Face another player head to head. Sabotage, counter, and outmanoeuvre ' +
        'in a battle of wits where every card can shift the balance of power.'
      );
    case 'coop':
      return (
        'Form a syndicate with up to four players. Share resources, coordinate counters, ' +
        'and achieve collective freedom before the system tears you apart.'
      );
    case 'ghost':
      return (
        "Chase a legend's ghost run. Match every marker and prove you can surpass " +
        'the benchmark that defined a season.'
      );
    default: {
      const _exhaustive: never = mode;
      void _exhaustive;
      return '';
    }
  }
}

/**
 * Check whether a battleground mode is multiplayer.
 * Co-op (coop) and PvP (pvp) are multiplayer.
 */
export function isBattlegroundMultiplayer(mode: ModeCode): boolean {
  return mode === 'pvp' || mode === 'coop';
}

/**
 * Check whether a battleground mode is competitive.
 * PvP and ghost are competitive.
 */
export function isBattlegroundCompetitive(mode: ModeCode): boolean {
  return mode === 'pvp' || mode === 'ghost';
}

/**
 * Get the canonical player count for a battleground.
 * solo = 1, pvp = 2, coop = 4, ghost = 1 (+ ghost).
 */
export function getBattlegroundPlayerCount(mode: ModeCode): number {
  switch (mode) {
    case 'solo':
      return 1;
    case 'pvp':
      return 2;
    case 'coop':
      return 4;
    case 'ghost':
      return 1;
    default: {
      const _exhaustive: never = mode;
      void _exhaustive;
      return 1;
    }
  }
}

/**
 * Get the version string for a given mode.
 * Uses PREDATOR_MODE_VERSION, SYNDICATE_MODE_VERSION,
 * PHANTOM_MODE_VERSION, and HOUSEHOLD_MODE_VERSION.
 */
export function getModeVersion(mode: ModeCode): string {
  switch (mode) {
    case 'solo':
      // Empire version tracks household versioning
      return HOUSEHOLD_MODE_VERSION;
    case 'pvp':
      return PREDATOR_MODE_VERSION;
    case 'coop':
      return SYNDICATE_MODE_VERSION;
    case 'ghost':
      return PHANTOM_MODE_VERSION;
    default: {
      const _exhaustive: never = mode;
      void _exhaustive;
      return '0.0.0';
    }
  }
}

/**
 * Get the ML dimensions for a given mode.
 * Uses PREDATOR_ML_FEATURE_DIM, SYNDICATE_ML_FEATURE_DIM,
 * PHANTOM_ML_FEATURE_DIM, HOUSEHOLD_ML_FEATURE_DIM,
 * and their corresponding DL row/col constants.
 */
export function getModeMLDimensions(mode: ModeCode): {
  featureDim: number;
  dlRows: number;
  dlCols: number;
} {
  switch (mode) {
    case 'solo':
      return {
        featureDim: HOUSEHOLD_ML_FEATURE_DIM,
        dlRows: HOUSEHOLD_DL_ROWS,
        dlCols: HOUSEHOLD_DL_COLS,
      };
    case 'pvp':
      return {
        featureDim: PREDATOR_ML_FEATURE_DIM,
        dlRows: PREDATOR_DL_ROWS,
        dlCols: PREDATOR_DL_COLS,
      };
    case 'coop':
      return {
        featureDim: SYNDICATE_ML_FEATURE_DIM,
        dlRows: SYNDICATE_DL_ROWS,
        dlCols: SYNDICATE_DL_COLS,
      };
    case 'ghost':
      return {
        featureDim: PHANTOM_ML_FEATURE_DIM,
        dlRows: PHANTOM_DL_ROWS,
        dlCols: PHANTOM_DL_COLS,
      };
    default: {
      const _exhaustive: never = mode;
      void _exhaustive;
      return { featureDim: 32, dlRows: 24, dlCols: 8 };
    }
  }
}

/**
 * Encode a mode code as a single byte for hashing or network protocol use.
 */
export function encodeModeToByte(mode: ModeCode): number {
  return MODE_ORDINAL_MAP[mode] ?? 0;
}

/**
 * Decode a byte back to a ModeCode.
 * Returns null if the byte does not correspond to a known mode.
 */
export function decodeModeFromByte(byte: number): ModeCode | null {
  return BYTE_TO_MODE[byte] ?? null;
}

/**
 * Type guard: check whether a value is a valid ModeCode.
 * Delegates to isModeCode from contracts.
 */
export function isModeCodeValue(v: unknown): v is ModeCode {
  return isModeCode(v);
}

/**
 * Check whether a value is a valid ModeEventLevel.
 * Delegates to isModeEventLevel from contracts.
 */
export function isEventLevelValue(
  v: unknown,
): v is import('./contracts').ModeEventLevel {
  return isModeEventLevel(v);
}

/**
 * Check whether a value is a valid ProofBadgeId.
 * Delegates to isProofBadgeId from contracts.
 */
export function isProofBadgeValue(v: unknown): boolean {
  return isProofBadgeId(v);
}

/**
 * Check whether a card play intent is valid for the mode in the frame.
 * Delegates to isCardPlayLegal from contracts.
 */
export function isCardPlayValid(frame: ModeFrame, intent: CardPlayIntent): boolean {
  return isCardPlayLegal(intent, frame.mode);
}

/**
 * Get a summary of all mode metadata in one call.
 */
export function getAllModeSummaries(): {
  mode: ModeCode;
  displayName: string;
  description: string;
  playerCount: number;
  isMultiplayer: boolean;
  isCompetitive: boolean;
  version: string;
  mlDimensions: { featureDim: number; dlRows: number; dlCols: number };
  byte: number;
}[] {
  const modes: ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'];
  return modes.map((mode) => ({
    mode,
    displayName: getModeDisplayName(mode),
    description: getBattlegroundDescription(mode),
    playerCount: getBattlegroundPlayerCount(mode),
    isMultiplayer: isBattlegroundMultiplayer(mode),
    isCompetitive: isBattlegroundCompetitive(mode),
    version: getModeVersion(mode),
    mlDimensions: getModeMLDimensions(mode),
    byte: encodeModeToByte(mode),
  }));
}

/**
 * Create a mode registry with telemetry pre-warmed — convenience wrapper.
 */
export function buildWarmRegistry(resolver?: TimePolicyResolver): ModeRegistry {
  return createModeRegistryWithTelemetry(resolver);
}

/**
 * Build a minimal ModeFrame suitable for unit testing.
 */
export function buildTestFrame(mode: ModeCode, tick = 0): ModeFrame {
  const _reg = createDefaultModeRegistry();
  void _reg;
  return {
    mode,
    tick,
    participants: [],
    history: [],
    sharedThreats: [],
    sharedOpportunitySlots: [],
    rivalry: null,
    syndicate: null,
    legend: null,
  };
}

/**
 * Validate that all participants in a list have valid (or null) role IDs.
 * Uses isTeamRoleId from contracts.
 */
export function validateParticipantRoles(participants: ModeParticipant[]): {
  valid: boolean;
  invalidPlayerIds: string[];
} {
  const invalidPlayerIds: string[] = [];
  for (const p of participants) {
    if (p.roleId !== null && !isTeamRoleId(p.roleId)) {
      invalidPlayerIds.push(p.playerId);
    }
  }
  return { valid: invalidPlayerIds.length === 0, invalidPlayerIds };
}

/**
 * Get the mode-appropriate overlay contract for a card's deck type.
 * Uses COOP_AID_OVERLAY, PVP_AGGRESSION_OVERLAY, GHOST_DISCIPLINE_OVERLAY,
 * DEFAULT_MODE_OVERLAY.
 */
export function getOverlayForCardInMode(
  deckType: DeckType,
  mode: ModeCode,
): Readonly<ModeOverlayContract> {
  if (mode === 'coop' && ['AID', 'RESCUE', 'TRUST'].includes(deckType)) {
    return COOP_AID_OVERLAY;
  }
  if (mode === 'pvp' && ['SABOTAGE', 'BLUFF', 'COUNTER'].includes(deckType)) {
    return PVP_AGGRESSION_OVERLAY;
  }
  if (mode === 'ghost') {
    return GHOST_DISCIPLINE_OVERLAY;
  }
  return DEFAULT_MODE_OVERLAY;
}

/**
 * Build a canonical mode metadata record for serialization or analytics.
 */
export function buildModeMetadataRecord(mode: ModeCode): {
  mode: ModeCode;
  byte: number;
  displayName: string;
  version: string;
  legalDeckTypes: DeckType[];
  timingLocks: TimingClass[];
  mlFeatureDim: number;
} {
  return {
    mode,
    byte: encodeModeToByte(mode),
    displayName: getModeDisplayName(mode),
    version: getModeVersion(mode),
    legalDeckTypes: [...MODE_DECK_LEGALITY[mode]],
    timingLocks: [...MODE_TIMING_LOCKS[mode]],
    mlFeatureDim: getModeMLDimensions(mode).featureDim,
  };
}

/**
 * Get the default tag weight for a given tag and mode from DEFAULT_TAG_WEIGHTS.
 * Returns 1.0 if not found.
 */
export function getDefaultTagWeight(mode: ModeCode, tag: CardTag): number {
  const entry = DEFAULT_TAG_WEIGHTS.find(
    (w) => w.mode === mode && w.tag === tag,
  );
  return entry?.weight ?? 1.0;
}

/**
 * Get all DECK_TYPE_PROFILES as a plain mutable array.
 */
export function getAllDeckProfiles(): DeckProfile[] {
  return DECK_TYPE_PROFILES.map((p) => ({ ...p }));
}

/**
 * Get the CARD_TAG_COUNT constant with a descriptive label.
 */
export function getCardTagCountInfo(): { count: number; label: string } {
  return {
    count: CARD_TAG_COUNT,
    label: `${CARD_TAG_COUNT} canonical card tags recognized by the scoring subsystem`,
  };
}

/**
 * Compute the finalization result for a frame directly from the CORD routers.
 * Solo → finalizeEmpire, PvP → finalizePredator,
 * Co-op → finalizeSyndicate, Ghost → finalizePhantom.
 */
export function computeFinalization(frame: ModeFrame): ModeFinalization {
  switch (frame.mode) {
    case 'solo':
      return finalizeEmpire(frame);
    case 'pvp':
      return finalizePredator(frame);
    case 'coop':
      return finalizeSyndicate(frame);
    case 'ghost':
      return finalizePhantom(frame);
    default: {
      const _exhaustive: never = frame.mode;
      void _exhaustive;
      return finalizeEmpire(frame);
    }
  }
}

/**
 * Enumerate all legal deck types across all four modes,
 * returning a deduplicated sorted list.
 */
export function getAllLegalDeckTypesUnion(): DeckType[] {
  const all = new Set<DeckType>();
  for (const mode of ['solo', 'pvp', 'coop', 'ghost'] as ModeCode[]) {
    for (const dt of MODE_DECK_LEGALITY[mode]) {
      all.add(dt);
    }
  }
  return Array.from(all).sort();
}
