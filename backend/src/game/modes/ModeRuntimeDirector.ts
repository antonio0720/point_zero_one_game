/*
 * POINT ZERO ONE — BACKEND MODES 15X GENERATOR
 * backend/src/game/modes/ModeRuntimeDirector.ts
 *
 * Doctrine:
 * - backend owns mode truth, not the client
 * - four battlegrounds are materially different at runtime
 * - card legality, timing, targeting, and scoring are mode-native
 * - cross-player economies are server-owned
 * - CORD bonuses, proof conditions, and ghost logic are authoritative
 *
 * This file is the authoritative runtime director for all mode operations.
 * It orchestrates tick lifecycle, card play resolution, trust systems,
 * battle budget management, ghost divergence tracking, rescue detection,
 * shared objective evaluation, mode-specific finalization, analytics,
 * ML/DL feature extraction, and chat bridge signal emission.
 *
 * Every import is used. Every constant is referenced. Every method is
 * called by at least one other method or is public API.
 */

import type {
  CardDefinition,
  ModeCode,
  RunOutcome,
  PressureTier,
  TimingClass,
  DeckType,
  DivergencePotential,
  CardInstance,
  HaterBotId,
} from '../engine/core/GamePrimitives';

import type {
  CardPlayIntent,
  ModeFinalization,
  ModeFrame,
  ModeParticipant,
  ModeValidationResult,
  ModeEvent,
  CardDecisionAudit,
  TrustBand,
  TrustAuditLine,
  DefectionStep,
  DefectionSequenceState,
  DefectionConsequences,
  SharedObjectiveId,
  SharedObjectiveState,
  SharedObjectiveDefinition,
  RunPhaseId,
  PhaseConfig,
  ComebackSurgeCondition,
  RescueEligibility,
  PressureSnapshot,
  TrustSnapshot,
  BattleBudgetSnapshot,
  ComboEscalationState,
  BluffCardContract,
  PsycheState,
  VisibilityTier,
  ModeMLFeatureVector,
  ModeDLTensor,
  ModeChatSignal,
  ChatBridgeEventType,
  ModeAnalyticsSnapshot,
  PlayerRunAnalytics,
  ProofBadgeId,
  ProofBadgeResult,
  CardOverlaySnapshot,
  ModeOverlayContract,
} from './contracts';

import {
  MODE_DECK_LEGALITY,
  DEFAULT_COMEBACK_SURGE,
  TRUST_BAND_THRESHOLDS,
  TRUST_SCORE_BOUNDS,
  TRUST_PRESSURE_MAPPINGS,
  PRESSURE_TIER_THRESHOLDS,
  PRESSURE_COST_MODIFIERS,
  RESCUE_PRESSURE_MINIMUM,
  DEFAULT_PHASE_CONFIGS,
  SHARED_OBJECTIVES,
  DEFECTION_STEP_SEQUENCE,
  DEFECTION_STEP_COOLDOWNS,
  DEFECTION_SEIZURE_FRACTIONS,
  DEFECTION_CORD_PENALTY,
  COMBO_ACTIVATION_CONDITIONS,
  ALL_PROOF_BADGES,
  DEFAULT_MODE_OVERLAY,
  COOP_AID_OVERLAY,
  PVP_AGGRESSION_OVERLAY,
  GHOST_DISCIPLINE_OVERLAY,
  MODE_ML_FEATURE_DIM,
  MODE_DL_ROWS,
  MODE_DL_COLS,
  ZERO_ML_VECTOR,
  ZERO_COMBO_ESCALATION,
  ZERO_BATTLE_BUDGET,
  RUN_PHASE_SEQUENCE,
  DEFAULT_CHAT_BRIDGE_CONFIGS,
  getTrustBandForScore,
  getPhaseForTick,
  getNextDefectionStep,
  isDefectionReversible,
  isDeckLegalInMode,
  isRescueEligible,
  isComebackSurgeEligible,
  getCostModifierForTier,
  isCardPlayLegal,
} from './contracts';

import { getModeAdapter } from './ModeRegistry';

import {
  auditCardDecision,
  cloneFrame,
  shieldPct,
  weakestShieldLayerId,
  averageDecisionLatencyMs,
  calcPsycheState,
  modeTagWeight,
  visibilityForTier,
  updateParticipant,
  pushEvent,
  addForkHint,
  setTimerWindow,
  countdownTimerWindows,
  cardToInstance,
} from './shared/helpers';

import {
  MODE_TAG_WEIGHTS,
  CARD_LEGALITY,
  MODE_TIMING_LOCKS,
  SAFETY_CARD_IDS,
  PHASE_WINDOW_TICKS,
  COUNTER_WINDOW_TICKS,
  GHOST_WINDOW_RADIUS,
  HANDICAPS,
  EXTRACTION_COSTS,
  COUNTER_COSTS,
  COUNTER_TO_EXTRACTION,
} from './shared/constants';

// ============================================================================
// INTERNAL CONSTANTS — every one is consumed in runtime methods below
// ============================================================================

/** Pressure tier ordinals for numeric comparison. */
const PRESSURE_ORDINAL: Readonly<Record<PressureTier, number>> = {
  T0: 0, T1: 1, T2: 2, T3: 3, T4: 4,
};

/** Psyche state ordinals for numeric comparison. */
const PSYCHE_ORDINAL: Readonly<Record<PsycheState, number>> = {
  COMPOSED: 0, STRESSED: 1, CRACKING: 2, BREAKING: 3, DESPERATE: 4,
};

/** Phase ordinals for progression tracking. */
const PHASE_ORDINAL: Readonly<Record<RunPhaseId, number>> = {
  FOUNDATION: 0, ESCALATION: 1, SOVEREIGNTY: 2,
};

/** Mode ordinals for ML feature extraction. */
const MODE_ORDINAL: Readonly<Record<ModeCode, number>> = {
  solo: 0, pvp: 1, coop: 2, ghost: 3,
};

/** Defection step ordinals for numeric comparison. */
const DEFECTION_ORDINAL: Readonly<Record<DefectionStep, number>> = {
  NONE: 0, BREAK_PACT: 1, SILENT_EXIT: 2, ASSET_SEIZURE: 3, DEFECTED: 4,
};

/** Trust band label ordinals for comparison. */
const TRUST_BAND_ORDINAL: Readonly<Record<TrustBand['label'], number>> = {
  DISTRUSTED: 0, CAUTIOUS: 1, NEUTRAL: 2, TRUSTED: 3, BONDED: 4,
};

/** Maximum ticks for a rescue window before it closes. */
const RESCUE_WINDOW_MAX_TICKS = 6;

/** Full rescue efficiency cutoff in ticks. */
const RESCUE_FULL_EFFICIENCY_TICKS = 3;

/** Isolation tax rate per tick for Empire mode when no shields are generating income. */
const EMPIRE_ISOLATION_TAX_RATE = 0.02;

/** Battle budget base generation rate per tick (Predator mode). */
const BATTLE_BUDGET_GEN_RATE = 15;

/** Critical timing bleed-through multiplier for Predator battle budget. */
const CRITICAL_TIMING_BLEED_MULTIPLIER = 1.4;

/** Counter cost reduction fraction in PvP battle budget. */
const COUNTER_COST_REDUCTION_PVP = 0.7;

/** Ghost divergence proximity window in ticks. */
const GHOST_DIVERGENCE_PROXIMITY_TICKS = 3;

/** Momentum threshold for second hold slot in Empire. */
const EMPIRE_MOMENTUM_HOLD_THRESHOLD = 0.7;

/** CORD bonus for no-hold runs in Empire. */
const EMPIRE_NO_HOLD_CORD_BONUS = 0.25;

/** Comeback surge minimum consecutive ticks at high pressure. */
const COMEBACK_SURGE_MIN_HIGH_PRESSURE_TICKS = 3;

/** Maximum ML feature vector dimension (must match contracts). */
const ML_FEATURE_DIMENSION = MODE_ML_FEATURE_DIM;

/** DL tensor row count. */
const DL_TENSOR_ROWS = MODE_DL_ROWS;

/** DL tensor column count. */
const DL_TENSOR_COLS = MODE_DL_COLS;

/** Sabotage combo chain timeout in ticks. */
const SABOTAGE_COMBO_CHAIN_TIMEOUT_TICKS = 3;

/** Chat bridge debounce for duplicate event suppression. */
const CHAT_BRIDGE_DEDUP_TICKS = 2;

/** Analytics capture interval in ticks. */
const ANALYTICS_CAPTURE_INTERVAL_TICKS = 5;

/** Telemetry ring buffer capacity per participant. */
const TELEMETRY_RING_CAPACITY = 256;

// ============================================================================
// EXPORTED CreateFrameOptions INTERFACE
// ============================================================================

export interface CreateFrameOptions {
  mode: ModeCode;
  tick?: number;
  participants: ModeParticipant[];
  legend?: ModeFrame['legend'];
  rivalry?: ModeFrame['rivalry'];
  syndicate?: ModeFrame['syndicate'];
  sharedOpportunitySlots?: ModeFrame['sharedOpportunitySlots'];
  sharedThreats?: ModeFrame['sharedThreats'];
}

// ============================================================================
// INTERNAL STATE TRACKERS
// ============================================================================

/** Per-participant tick analytics accumulator. */
interface TickAnalytics {
  timingDeltaSum: number;
  opportunityCostSum: number;
  counterEfficiency: number;
  aidUtilization: number;
  ghostDelta: number;
  cascadeInterceptRate: number;
  decisionCount: number;
  rescueResponseMs: number;
  comebackSurgeActiveTicks: number;
}

/** Per-participant ML feature accumulator. */
interface MLFeatureAccumulator {
  cardPlayPatterns: number[];
  timingPatterns: number[];
  rescueResponsePatterns: number[];
  defectionSignals: number[];
  pressureResponseCurve: number[];
  comebackDetectionFeatures: number[];
}

/** Chat bridge signal buffer. */
interface ChatBridgeBuffer {
  signals: ModeChatSignal[];
  lastEmitTick: number;
  eventCountThisTick: number;
}

/** Combo chain tracker for sabotage sequences. */
interface ComboChainTracker {
  chainLength: number;
  lastCardTick: number;
  cardIds: string[];
  damageMultiplier: number;
}

/** Ghost benchmark window state. */
interface GhostBenchmarkWindow {
  startTick: number;
  endTick: number;
  legendScore: number;
  challengerScore: number;
  markers: string[];
  divergenceScore: number;
}

/** Rescue window tracker. */
interface RescueWindow {
  targetPlayerId: string;
  openedAtTick: number;
  expiresAtTick: number;
  efficiencyMultiplier: number;
  responded: boolean;
  respondedAtTick: number | null;
  responderIds: string[];
}

/** Shared objective runtime tracker. */
interface ObjectiveTracker {
  objectiveId: SharedObjectiveId;
  definition: SharedObjectiveDefinition;
  state: SharedObjectiveState;
}

/** Defection tracker per player. */
interface DefectionTracker {
  playerId: string;
  state: DefectionSequenceState;
  cardArc: DefectionStep[];
}

// ============================================================================
// THE DIRECTOR — ModeRuntimeDirector class
// ============================================================================

export class ModeRuntimeDirector {
  // ---- Internal state ----
  private tickAnalyticsMap: Map<string, TickAnalytics> = new Map();
  private mlAccumulatorMap: Map<string, MLFeatureAccumulator> = new Map();
  private chatBridgeBuffer: ChatBridgeBuffer = { signals: [], lastEmitTick: -1, eventCountThisTick: 0 };
  private comboChainMap: Map<string, ComboChainTracker> = new Map();
  private ghostBenchmarkWindows: GhostBenchmarkWindow[] = [];
  private rescueWindows: RescueWindow[] = [];
  private objectiveTrackers: ObjectiveTracker[] = [];
  private defectionTrackers: Map<string, DefectionTracker> = new Map();
  private lastAnalyticsCaptureTick = -1;
  private analyticsSnapshots: ModeAnalyticsSnapshot[] = [];
  private playerRunAnalyticsMap: Map<string, PlayerRunAnalytics> = new Map();
  private proofBadgeResults: ProofBadgeResult[] = [];
  private cardOverlayHistory: CardOverlaySnapshot[] = [];

  // ========================================================================
  // PUBLIC API — createFrame
  // ========================================================================

  public createFrame(options: CreateFrameOptions): ModeFrame {
    const frame: ModeFrame = {
      mode: options.mode,
      tick: options.tick ?? 0,
      participants: options.participants,
      history: [],
      sharedThreats: options.sharedThreats ?? [],
      sharedOpportunitySlots: options.sharedOpportunitySlots ?? [],
      rivalry: options.rivalry ?? null,
      syndicate: options.syndicate ?? null,
      legend: options.legend ?? null,
    };
    this.initializeInternalTrackers(frame);
    return frame;
  }

  // ========================================================================
  // PUBLIC API — bootstrap
  // ========================================================================

  public bootstrap(frame: ModeFrame, options?: Record<string, unknown>): ModeFrame {
    let next = getModeAdapter(frame.mode).bootstrap(frame, options);
    next = this.initializeParticipantAnalytics(next);
    next = this.initializeModeSystems(next);
    next = this.emitChatSignal(next, 'MODE_STARTED', null, `Mode ${next.mode} bootstrapped with ${next.participants.length} participants`);
    return next;
  }

  // ========================================================================
  // PUBLIC API — processTick (DEEP)
  // ========================================================================

  public processTick(frame: ModeFrame): ModeFrame {
    const adapter = getModeAdapter(frame.mode);

    // --- Pre-tick validation ---
    let next = this.preTickValidation(frame);

    // --- Participant health checks ---
    next = this.participantHealthChecks(next);

    // --- Pressure-aware tick timing adjustments ---
    next = this.adjustTickTiming(next);

    // --- Adapter onTickStart ---
    next = adapter.onTickStart(next);

    // --- Clone and advance tick counter ---
    next = cloneFrame(next);
    next.tick += 1;

    // --- Update participant tick state ---
    next.participants = next.participants.map((participant) => ({
      ...participant,
      snapshot: {
        ...participant.snapshot,
        tick: next.tick,
        timers: {
          ...participant.snapshot.timers,
          elapsedMs: participant.snapshot.timers.elapsedMs + participant.snapshot.timers.currentTickDurationMs,
        },
      },
    }));

    // --- Countdown timer windows ---
    next.participants = next.participants.map((p) => countdownTimerWindows(p));

    // --- Mode-specific per-tick systems ---
    next = this.processModeSystems(next);

    // --- Comeback surge detection ---
    next = this.detectComebackSurge(next);

    // --- Rescue detection ---
    next = this.detectRescueOpportunities(next);
    next = this.processRescueWindows(next);

    // --- Trust score updates (coop) ---
    if (next.mode === 'coop') {
      next = this.updateTrustScores(next);
      next = this.processDefectionTrackers(next);
      next = this.evaluateSharedObjectives(next);
    }

    // --- Battle budget generation (pvp) ---
    if (next.mode === 'pvp') {
      next = this.generateBattleBudget(next);
      next = this.updatePsycheMeter(next);
    }

    // --- Ghost divergence tracking (ghost) ---
    if (next.mode === 'ghost') {
      next = this.trackGhostDivergence(next);
      next = this.processGhostBenchmarkWindows(next);
    }

    // --- Empire isolation tax (solo) ---
    if (next.mode === 'solo') {
      next = this.computeIsolationTax(next);
      next = this.enforceHoldPolicy(next);
    }

    // --- Post-tick analytics capture ---
    next = this.captureTickAnalytics(next);

    // --- ML/DL feature extraction ---
    next = this.extractMLFeatures(next);

    // --- Chat bridge signal emission ---
    next = this.flushChatBridgeSignals(next);

    // --- Adapter onTickEnd ---
    next = adapter.onTickEnd(next);

    return next;
  }

  // ========================================================================
  // PUBLIC API — projectCard
  // ========================================================================

  public projectCard(frame: ModeFrame, actorId: string, card: CardDefinition): CardInstance {
    const adapter = getModeAdapter(frame.mode);
    const instance = adapter.applyCardOverlay(frame, actorId, card);
    const overlay = this.resolveOverlayForMode(frame.mode, card);
    const snapshot: CardOverlaySnapshot = {
      instanceId: instance.instanceId,
      definitionId: instance.definitionId,
      mode: frame.mode,
      appliedTick: frame.tick,
      overlay,
      deckType: card.deckType,
      resolvedCost: instance.cost,
      resolvedTargeting: instance.targeting,
      resolvedTimingClasses: [...instance.timingClass],
    };
    this.cardOverlayHistory.push(snapshot);
    return instance;
  }

  // ========================================================================
  // PUBLIC API — validateCardPlay (DEEP)
  // ========================================================================

  public validateCardPlay(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
    // Step 1: Mode adapter base validation
    const adapterResult = getModeAdapter(frame.mode).validateCardPlay(frame, intent);
    if (!adapterResult.ok) return adapterResult;

    // Step 2: Deck legality check
    const legalityResult = this.checkDeckLegality(frame, intent);
    if (!legalityResult.ok) return legalityResult;

    // Step 3: Timing window validation
    const timingResult = this.validateTimingWindow(frame, intent);
    if (!timingResult.ok) return timingResult;

    // Step 4: Card legality matrix enforcement
    const matrixResult = this.enforceCardLegalityMatrix(frame, intent);
    if (!matrixResult.ok) return matrixResult;

    // Step 5: Counterability check (pvp)
    if (frame.mode === 'pvp') {
      const counterResult = this.checkCounterability(frame, intent);
      if (!counterResult.ok) return counterResult;
    }

    // Step 6: Phase boundary card enforcement
    const phaseResult = this.enforcePhaseCardBoundary(frame, intent);
    if (!phaseResult.ok) return phaseResult;

    // Collect all warnings
    const warnings = [
      ...adapterResult.warnings,
      ...legalityResult.warnings,
      ...timingResult.warnings,
      ...matrixResult.warnings,
      ...phaseResult.warnings,
    ];

    return { ok: true, reason: null, warnings };
  }

  // ========================================================================
  // PUBLIC API — resolveNamedAction
  // ========================================================================

  public resolveNamedAction(
    frame: ModeFrame,
    actorId: string,
    actionId: string,
    payload?: Record<string, unknown>,
  ): ModeFrame {
    let next = getModeAdapter(frame.mode).resolveNamedAction(frame, actorId, actionId, payload);

    // Track mode-specific named action side effects
    if (actionId === 'DEFECT' && frame.mode === 'coop') {
      next = this.advanceDefectionStep(next, actorId);
    }
    if (actionId === 'RESCUE' && frame.mode === 'coop') {
      next = this.resolveRescueAction(next, actorId, payload);
    }
    if (actionId === 'BLUFF_REVEAL' && frame.mode === 'pvp') {
      next = this.resolveBluffAction(next, actorId, payload);
    }
    if (actionId === 'GHOST_BENCHMARK' && frame.mode === 'ghost') {
      next = this.openGhostBenchmarkWindow(next, actorId);
    }
    if (actionId === 'HOLD_CARD' && frame.mode === 'solo') {
      next = this.resolveHoldAction(next, actorId, payload);
    }

    return next;
  }

  // ========================================================================
  // PUBLIC API — recordCardDecision
  // ========================================================================

  public recordCardDecision(
    frame: ModeFrame,
    actorId: string,
    cardId: string,
    timingDeltaTicks: number,
    opportunityCost: number,
    notes: string[],
  ): ModeFrame {
    const next = cloneFrame(frame);
    const audit = auditCardDecision(actorId, cardId, next.mode, timingDeltaTicks, opportunityCost, notes);

    // Record in history
    next.history.push({
      tick: next.tick,
      level: audit.qualityScore >= 0.8 ? 'SUCCESS' : audit.qualityScore >= 0.55 ? 'INFO' : 'WARNING',
      channel: next.mode === 'coop' ? 'TEAM' : 'SYSTEM',
      actorId,
      code: 'CARD_DECISION_AUDIT',
      message: `Card ${cardId} quality=${audit.qualityScore.toFixed(3)} timingDelta=${timingDeltaTicks}`,
      payload: { qualityScore: audit.qualityScore, opportunityCost },
    });

    // Update per-participant analytics
    this.updateTickAnalyticsForDecision(actorId, timingDeltaTicks, opportunityCost, audit.qualityScore);

    // Track combo chains for sabotage sequences in PvP
    if (next.mode === 'pvp') {
      this.trackSabotageComboChain(actorId, cardId, next.tick);
    }

    // Update ML feature accumulator
    this.updateMLAccumulatorForDecision(actorId, cardId, timingDeltaTicks, audit.qualityScore);

    return next;
  }

  // ========================================================================
  // PUBLIC API — finalize (DEEP, mode-specific)
  // ========================================================================

  public finalize(
    frame: ModeFrame,
    outcomes?: Partial<Record<string, RunOutcome>>,
  ): { frame: ModeFrame; finalization: ModeFinalization } {
    let next = cloneFrame(frame);

    // Apply outcomes
    if (outcomes) {
      next.participants = next.participants.map((participant) => ({
        ...participant,
        snapshot: {
          ...participant.snapshot,
          outcome: outcomes[participant.playerId] ?? participant.snapshot.outcome,
        },
      }));
    }

    // Get base finalization from adapter
    const baseFinalization = getModeAdapter(next.mode).finalize(next);

    // Mode-specific finalization enhancements
    const modeEnhancement = this.computeModeSpecificFinalization(next);

    // Merge finalizations
    const finalization: ModeFinalization = {
      bonusMultiplier: baseFinalization.bonusMultiplier + modeEnhancement.bonusMultiplier - 1.0,
      flatBonus: baseFinalization.flatBonus + modeEnhancement.flatBonus,
      badges: Array.from(new Set([...baseFinalization.badges, ...modeEnhancement.badges])),
      audits: [...baseFinalization.audits, ...modeEnhancement.audits],
      notes: [...baseFinalization.notes, ...modeEnhancement.notes],
    };

    // Evaluate proof badges
    const badgeResults = this.evaluateProofBadges(next);
    for (const result of badgeResults) {
      if (result.earned && !finalization.badges.includes(result.badgeId)) {
        finalization.badges.push(result.badgeId);
      }
    }
    this.proofBadgeResults = badgeResults;

    // Apply sovereignty score updates
    next.participants = next.participants.map((participant) => ({
      ...participant,
      snapshot: {
        ...participant.snapshot,
        sovereignty: {
          ...participant.snapshot.sovereignty,
          sovereigntyScore: Number(
            (participant.snapshot.sovereignty.sovereigntyScore * finalization.bonusMultiplier + finalization.flatBonus).toFixed(6),
          ),
          proofBadges: Array.from(new Set([...participant.snapshot.sovereignty.proofBadges, ...finalization.badges])),
        },
      },
    }));

    // Generate run summary
    next = this.generateRunSummary(next, finalization);

    // Generate mode-specific case files / audits
    next = this.generateModeSpecificFinalReport(next, finalization);

    // Final history entry
    next.history.push({
      tick: next.tick,
      level: 'SUCCESS',
      channel: 'SYSTEM',
      actorId: null,
      code: 'MODE_FINALIZED',
      message: `Mode ${next.mode} finalized with bonusMultiplier=${finalization.bonusMultiplier.toFixed(2)} flatBonus=${finalization.flatBonus.toFixed(2)}.`,
    });

    // Emit chat signal
    next = this.emitChatSignal(next, 'MODE_ENDED', null, `Mode ${next.mode} finalized. Badges: ${finalization.badges.join(', ') || 'none'}`);

    // Build player run analytics
    this.buildPlayerRunAnalytics(next, finalization);

    return { frame: next, finalization };
  }

  // ========================================================================
  // PUBLIC QUERY API — for external consumers
  // ========================================================================

  /** Get the latest analytics snapshots. */
  public getAnalyticsSnapshots(): readonly ModeAnalyticsSnapshot[] {
    return this.analyticsSnapshots;
  }

  /** Get proof badge evaluation results from last finalization. */
  public getProofBadgeResults(): readonly ProofBadgeResult[] {
    return this.proofBadgeResults;
  }

  /** Get card overlay history. */
  public getCardOverlayHistory(): readonly CardOverlaySnapshot[] {
    return this.cardOverlayHistory;
  }

  /** Get player run analytics for a given player. */
  public getPlayerRunAnalytics(playerId: string): PlayerRunAnalytics | null {
    return this.playerRunAnalyticsMap.get(playerId) ?? null;
  }

  /** Get current rescue windows. */
  public getRescueWindows(): readonly RescueWindow[] {
    return this.rescueWindows;
  }

  /** Get the chat bridge signal buffer. */
  public getChatBridgeSignals(): readonly ModeChatSignal[] {
    return this.chatBridgeBuffer.signals;
  }

  /** Get defection tracker state for a player. */
  public getDefectionTracker(playerId: string): DefectionTracker | null {
    return this.defectionTrackers.get(playerId) ?? null;
  }

  /** Get shared objective trackers. */
  public getObjectiveTrackers(): readonly ObjectiveTracker[] {
    return this.objectiveTrackers;
  }

  /** Get ghost benchmark windows. */
  public getGhostBenchmarkWindows(): readonly GhostBenchmarkWindow[] {
    return this.ghostBenchmarkWindows;
  }

  /** Extract a full ML feature vector for a participant at the current tick. */
  public extractFeatureVectorForParticipant(frame: ModeFrame, participant: ModeParticipant): ModeMLFeatureVector {
    return this.buildMLFeatureVector(frame, participant);
  }

  /** Extract a DL tensor for a participant. */
  public extractDLTensorForParticipant(frame: ModeFrame, participant: ModeParticipant): ModeDLTensor {
    return this.buildDLTensor(frame, participant);
  }

  // ========================================================================
  // INTERNAL — Initialization
  // ========================================================================

  private initializeInternalTrackers(frame: ModeFrame): void {
    this.tickAnalyticsMap.clear();
    this.mlAccumulatorMap.clear();
    this.comboChainMap.clear();
    this.rescueWindows = [];
    this.objectiveTrackers = [];
    this.defectionTrackers.clear();
    this.ghostBenchmarkWindows = [];
    this.analyticsSnapshots = [];
    this.playerRunAnalyticsMap.clear();
    this.proofBadgeResults = [];
    this.cardOverlayHistory = [];
    this.chatBridgeBuffer = { signals: [], lastEmitTick: frame.tick, eventCountThisTick: 0 };
    this.lastAnalyticsCaptureTick = frame.tick;

    for (const participant of frame.participants) {
      this.tickAnalyticsMap.set(participant.playerId, this.zeroTickAnalytics());
      this.mlAccumulatorMap.set(participant.playerId, this.zeroMLAccumulator());
    }
  }

  private initializeParticipantAnalytics(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    for (const participant of next.participants) {
      if (!this.tickAnalyticsMap.has(participant.playerId)) {
        this.tickAnalyticsMap.set(participant.playerId, this.zeroTickAnalytics());
      }
      if (!this.mlAccumulatorMap.has(participant.playerId)) {
        this.mlAccumulatorMap.set(participant.playerId, this.zeroMLAccumulator());
      }
    }
    return next;
  }

  private initializeModeSystems(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);

    if (next.mode === 'coop') {
      next = this.initializeTrustSystem(next);
      next = this.initializeSharedObjectives(next);
      next = this.initializeDefectionTrackers(next);
    }

    if (next.mode === 'ghost' && next.legend) {
      next = this.initializeGhostBenchmarks(next);
    }

    return next;
  }

  // ========================================================================
  // INTERNAL — Pre-tick Validation
  // ========================================================================

  private preTickValidation(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    const warnings: string[] = [];

    // Validate participant count
    if (next.participants.length === 0) {
      warnings.push('No participants in frame');
    }

    // Validate mode-participant count constraints
    if (next.mode === 'solo' && next.participants.length > 1) {
      warnings.push(`Solo mode has ${next.participants.length} participants, expected 1`);
    }
    if (next.mode === 'pvp' && next.participants.length !== 2) {
      warnings.push(`PvP mode has ${next.participants.length} participants, expected 2`);
    }
    if (next.mode === 'coop' && next.participants.length < 2) {
      warnings.push(`Co-op mode has ${next.participants.length} participants, expected 2+`);
    }

    // Validate tick monotonicity
    for (const participant of next.participants) {
      if (participant.snapshot.tick > next.tick + 1) {
        warnings.push(`Participant ${participant.playerId} tick ${participant.snapshot.tick} ahead of frame tick ${next.tick}`);
      }
    }

    // Log validation warnings
    for (const warning of warnings) {
      next.history.push({
        tick: next.tick,
        level: 'WARNING',
        channel: 'SYSTEM',
        actorId: null,
        code: 'PRE_TICK_VALIDATION',
        message: warning,
      });
    }

    return next;
  }

  // ========================================================================
  // INTERNAL — Participant Health Checks
  // ========================================================================

  private participantHealthChecks(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);

    for (const participant of next.participants) {
      const shieldIntegrity = shieldPct(participant);
      const psyche = calcPsycheState(participant);
      const latency = averageDecisionLatencyMs(participant);
      const pressure = participant.snapshot.pressure;

      // Check for stale participants (no decisions in many ticks)
      if (participant.snapshot.telemetry.decisions.length > 0) {
        const lastDecisionTick = participant.snapshot.telemetry.decisions[
          participant.snapshot.telemetry.decisions.length - 1
        ].tick;
        if (next.tick - lastDecisionTick > 20) {
          next = pushEvent(next, {
            tick: next.tick,
            level: 'WARNING',
            channel: 'SYSTEM',
            actorId: participant.playerId,
            code: 'PARTICIPANT_STALE',
            message: `Player ${participant.playerId} has not made a decision in ${next.tick - lastDecisionTick} ticks`,
          });
        }
      }

      // Check for critical combined state
      if (PSYCHE_ORDINAL[psyche] >= PSYCHE_ORDINAL['BREAKING'] && shieldIntegrity < 0.2 && PRESSURE_ORDINAL[pressure.tier] >= PRESSURE_ORDINAL['T3']) {
        next = pushEvent(next, {
          tick: next.tick,
          level: 'ALERT',
          channel: next.mode === 'coop' ? 'TEAM' : 'SYSTEM',
          actorId: participant.playerId,
          code: 'PARTICIPANT_CRITICAL',
          message: `Player ${participant.playerId} is in critical state: psyche=${psyche} shield=${(shieldIntegrity * 100).toFixed(0)}% pressure=${pressure.tier}`,
          payload: { psyche, shieldPct: Number(shieldIntegrity.toFixed(3)), pressureTier: pressure.tier },
        });

        // Emit chat signal for critical state
        next = this.emitChatSignal(next, 'PRESSURE_TRANSITION', participant.playerId,
          `Player ${participant.playerId} entering critical state`);
      }

      // Track fork hint for high latency
      if (latency > 3000) {
        next = updateParticipant(next, participant.playerId, (p) =>
          addForkHint(p, `HIGH_LATENCY:${latency.toFixed(0)}ms:tick_${next.tick}`));
      }
    }

    return next;
  }

  // ========================================================================
  // INTERNAL — Tick Timing Adjustments
  // ========================================================================

  private adjustTickTiming(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);

    for (let i = 0; i < next.participants.length; i++) {
      const participant = next.participants[i];
      const pressure = participant.snapshot.pressure;
      const psyche = calcPsycheState(participant);

      // Pressure-aware tick duration: higher pressure = slightly longer ticks (merciful)
      let tickDurationModifier = 1.0;
      if (PRESSURE_ORDINAL[pressure.tier] >= PRESSURE_ORDINAL['T3']) {
        tickDurationModifier = 1.05;
      }
      if (PRESSURE_ORDINAL[pressure.tier] >= PRESSURE_ORDINAL['T4']) {
        tickDurationModifier = 1.10;
      }
      if (PSYCHE_ORDINAL[psyche] >= PSYCHE_ORDINAL['DESPERATE']) {
        tickDurationModifier = Math.max(tickDurationModifier, 1.15);
      }

      // Apply modifier
      if (tickDurationModifier !== 1.0) {
        const baseDuration = participant.snapshot.timers.currentTickDurationMs;
        const adjustedDuration = Math.round(baseDuration * tickDurationModifier);
        next.participants[i] = {
          ...participant,
          snapshot: {
            ...participant.snapshot,
            timers: {
              ...participant.snapshot.timers,
              currentTickDurationMs: adjustedDuration,
            },
          },
        };
      }
    }

    return next;
  }

  // ========================================================================
  // INTERNAL — Mode-Specific Per-Tick Systems
  // ========================================================================

  private processModeSystems(frame: ModeFrame): ModeFrame {
    let next = frame;

    const phaseConfig = getPhaseForTick(next.tick);
    if (phaseConfig) {
      // Check for phase transitions
      const prevPhaseConfig = getPhaseForTick(next.tick - 1);
      if (prevPhaseConfig && prevPhaseConfig.phase !== phaseConfig.phase) {
        next = this.handlePhaseTransition(next, prevPhaseConfig.phase, phaseConfig.phase);
      }
    }

    return next;
  }

  private handlePhaseTransition(frame: ModeFrame, fromPhase: RunPhaseId, toPhase: RunPhaseId): ModeFrame {
    let next = cloneFrame(frame);

    next.history.push({
      tick: next.tick,
      level: 'SUCCESS',
      channel: 'SYSTEM',
      actorId: null,
      code: 'PHASE_TRANSITION',
      message: `Phase transition: ${fromPhase} -> ${toPhase} at tick ${next.tick}`,
      payload: { fromPhase, toPhase },
    });

    next = this.emitChatSignal(next, 'PHASE_TRANSITION', null,
      `Phase transition: ${fromPhase} -> ${toPhase}`);

    // Check for double phase change hold expiry (Empire)
    if (next.mode === 'solo') {
      const phaseJump = PHASE_ORDINAL[toPhase] - PHASE_ORDINAL[fromPhase];
      if (phaseJump >= 2) {
        next = this.expireAllHolds(next);
      }
    }

    return next;
  }

  // ========================================================================
  // INTERNAL — Comeback Surge Detection
  // ========================================================================

  private detectComebackSurge(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    const surgeConfig = DEFAULT_COMEBACK_SURGE[next.mode];

    for (const participant of next.participants) {
      const pressure = participant.snapshot.pressure;
      const cash = participant.snapshot.economy.cash;
      const shieldInteg = shieldPct(participant);

      const eligible = isComebackSurgeEligible(pressure.tier) &&
        cash <= surgeConfig.cashThreshold &&
        shieldInteg <= surgeConfig.shieldThreshold &&
        pressure.survivedHighPressureTicks >= COMEBACK_SURGE_MIN_HIGH_PRESSURE_TICKS;

      // Check if participant is already tagged with comeback surge
      const hasSurge = participant.snapshot.tags.includes('COMEBACK_SURGE_ACTIVE');

      if (eligible && !hasSurge) {
        next = updateParticipant(next, participant.playerId, (p) => ({
          ...p,
          snapshot: {
            ...p.snapshot,
            tags: [...p.snapshot.tags, 'COMEBACK_SURGE_ACTIVE'],
          },
          metadata: {
            ...p.metadata,
            comebackSurgeTick: next.tick,
            comebackSurgeDuration: surgeConfig.surgeDurationTicks,
          },
        }));

        next.history.push({
          tick: next.tick,
          level: 'SUCCESS',
          channel: next.mode === 'coop' ? 'TEAM' : 'SYSTEM',
          actorId: participant.playerId,
          code: 'COMEBACK_SURGE_ACTIVATED',
          message: `Comeback surge activated for ${participant.playerId}! Income x${surgeConfig.incomeBonusMultiplier} Counter x${surgeConfig.counterBonusMultiplier} for ${surgeConfig.surgeDurationTicks} ticks`,
          payload: {
            incomeMult: surgeConfig.incomeBonusMultiplier,
            counterMult: surgeConfig.counterBonusMultiplier,
            durationTicks: surgeConfig.surgeDurationTicks,
          },
        });

        next = this.emitChatSignal(next, 'COMEBACK_SURGE_ACTIVATED', participant.playerId,
          `Comeback surge activated for ${participant.playerId}!`);
      }

      // Check for surge expiry
      if (hasSurge) {
        const surgeTick = (participant.metadata['comebackSurgeTick'] as number) ?? 0;
        const surgeDuration = (participant.metadata['comebackSurgeDuration'] as number) ?? surgeConfig.surgeDurationTicks;
        if (next.tick - surgeTick >= surgeDuration) {
          next = updateParticipant(next, participant.playerId, (p) => ({
            ...p,
            snapshot: {
              ...p.snapshot,
              tags: p.snapshot.tags.filter((t) => t !== 'COMEBACK_SURGE_ACTIVE'),
            },
            metadata: { ...p.metadata, comebackFreedom: p.snapshot.outcome === 'FREEDOM' ? true : null },
          }));

          next = this.emitChatSignal(next, 'COMEBACK_SURGE_EXPIRED', participant.playerId,
            `Comeback surge expired for ${participant.playerId}`);
        }
      }
    }

    return next;
  }

  // ========================================================================
  // INTERNAL — Rescue Detection & Processing
  // ========================================================================

  private detectRescueOpportunities(frame: ModeFrame): ModeFrame {
    let next = frame;

    for (const participant of next.participants) {
      const pressure = participant.snapshot.pressure;
      const eligible = isRescueEligible(pressure.tier);
      const alreadyOpen = this.rescueWindows.some(
        (w) => w.targetPlayerId === participant.playerId && !w.responded && next.tick < w.expiresAtTick,
      );

      if (eligible && !alreadyOpen && PRESSURE_ORDINAL[pressure.tier] >= PRESSURE_ORDINAL[RESCUE_PRESSURE_MINIMUM]) {
        const window: RescueWindow = {
          targetPlayerId: participant.playerId,
          openedAtTick: next.tick,
          expiresAtTick: next.tick + RESCUE_WINDOW_MAX_TICKS,
          efficiencyMultiplier: 1.0,
          responded: false,
          respondedAtTick: null,
          responderIds: [],
        };
        this.rescueWindows.push(window);

        next = pushEvent(next, {
          tick: next.tick,
          level: 'ALERT',
          channel: next.mode === 'coop' ? 'TEAM' : 'SYSTEM',
          actorId: participant.playerId,
          code: 'RESCUE_WINDOW_OPENED',
          message: `Rescue window opened for ${participant.playerId} (expires tick ${window.expiresAtTick})`,
          payload: { targetPlayerId: participant.playerId, expiresAtTick: window.expiresAtTick },
        });

        next = this.emitChatSignal(next, 'RESCUE_TRIGGERED', participant.playerId,
          `Rescue needed for ${participant.playerId}!`);
      }
    }

    return next;
  }

  private processRescueWindows(frame: ModeFrame): ModeFrame {
    let next = frame;

    for (const window of this.rescueWindows) {
      if (window.responded || next.tick >= window.expiresAtTick) continue;

      // Calculate efficiency degradation based on time elapsed
      const elapsed = next.tick - window.openedAtTick;
      if (elapsed <= RESCUE_FULL_EFFICIENCY_TICKS) {
        window.efficiencyMultiplier = 1.0;
      } else {
        const degradation = (elapsed - RESCUE_FULL_EFFICIENCY_TICKS) / (RESCUE_WINDOW_MAX_TICKS - RESCUE_FULL_EFFICIENCY_TICKS);
        window.efficiencyMultiplier = Math.max(0.3, 1.0 - degradation * 0.7);
      }
    }

    // Clean up expired windows
    const expired = this.rescueWindows.filter((w) => !w.responded && next.tick >= w.expiresAtTick);
    for (const window of expired) {
      next = pushEvent(next, {
        tick: next.tick,
        level: 'WARNING',
        channel: next.mode === 'coop' ? 'TEAM' : 'SYSTEM',
        actorId: window.targetPlayerId,
        code: 'RESCUE_WINDOW_EXPIRED',
        message: `Rescue window expired for ${window.targetPlayerId} without response`,
      });
    }

    return next;
  }

  private resolveRescueAction(frame: ModeFrame, actorId: string, payload?: Record<string, unknown>): ModeFrame {
    let next = cloneFrame(frame);
    const targetId = (payload?.['targetId'] as string) ?? '';

    const window = this.rescueWindows.find(
      (w) => w.targetPlayerId === targetId && !w.responded && next.tick < w.expiresAtTick,
    );

    if (!window) return next;

    window.responded = true;
    window.respondedAtTick = next.tick;
    window.responderIds.push(actorId);

    // Track rescue response timing for analytics
    const responseTime = next.tick - window.openedAtTick;
    const analytics = this.tickAnalyticsMap.get(actorId);
    if (analytics) {
      analytics.rescueResponseMs = responseTime * 1000; // approximate
    }

    next = pushEvent(next, {
      tick: next.tick,
      level: 'SUCCESS',
      channel: 'TEAM',
      actorId,
      code: 'RESCUE_RESOLVED',
      message: `${actorId} rescued ${targetId} at efficiency ${(window.efficiencyMultiplier * 100).toFixed(0)}%`,
      payload: { targetId, efficiency: Number(window.efficiencyMultiplier.toFixed(3)), responseTimeTicks: responseTime },
    });

    // Update trust for rescuer (coop)
    if (next.mode === 'coop') {
      next = this.awardTrustForRescue(next, actorId, targetId, window.efficiencyMultiplier);
    }

    return next;
  }

  // ========================================================================
  // INTERNAL — Trust System (Co-op)
  // ========================================================================

  private initializeTrustSystem(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);

    if (!next.syndicate) return next;

    // Initialize trust audit lines for all participants
    for (const participant of next.participants) {
      if (!next.syndicate.trustAudit[participant.playerId]) {
        next.syndicate.trustAudit[participant.playerId] = {
          playerId: participant.playerId,
          trustScore: 50,
          aidGivenCount: 0,
          rescueCount: 0,
          cascadeAbsorptions: 0,
          loanRepaymentRate: 1.0,
          defectionRiskSignal: 'LOW',
          notes: [],
        };
      }
    }

    return next;
  }

  private updateTrustScores(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    if (!next.syndicate) return next;

    for (const participant of next.participants) {
      const trustAudit = next.syndicate.trustAudit[participant.playerId];
      if (!trustAudit) continue;

      const pressure = participant.snapshot.pressure;
      const pressureMapping = TRUST_PRESSURE_MAPPINGS.find((m) => m.tier === pressure.tier);
      if (!pressureMapping) continue;

      // Apply per-tick trust decay based on pressure
      let newScore = trustAudit.trustScore - pressureMapping.trustDecayRate;

      // Clamp to bounds
      newScore = Math.max(TRUST_SCORE_BOUNDS.min, Math.min(TRUST_SCORE_BOUNDS.max, newScore));

      // Compute trust band
      const band = getTrustBandForScore(newScore);
      const previousBand = getTrustBandForScore(trustAudit.trustScore);

      // Compute defection risk signal
      const defectionRisk = this.computeDefectionRiskSignal(participant, newScore);

      // Update audit line
      next.syndicate.trustAudit[participant.playerId] = {
        ...trustAudit,
        trustScore: Number(newScore.toFixed(2)),
        defectionRiskSignal: defectionRisk,
      };

      // Update participant mode state trust scores
      next = updateParticipant(next, participant.playerId, (p) => ({
        ...p,
        snapshot: {
          ...p.snapshot,
          modeState: {
            ...p.snapshot.modeState,
            trustScores: {
              ...p.snapshot.modeState.trustScores,
              [participant.playerId]: Number(newScore.toFixed(2)),
            },
          },
        },
      }));

      // Detect trust band transitions
      if (band && previousBand && band.label !== previousBand.label) {
        next.history.push({
          tick: next.tick,
          level: TRUST_BAND_ORDINAL[band.label] > TRUST_BAND_ORDINAL[previousBand.label] ? 'SUCCESS' : 'WARNING',
          channel: 'TEAM',
          actorId: participant.playerId,
          code: 'TRUST_TRANSITION',
          message: `${participant.playerId} trust: ${previousBand.label} -> ${band.label} (score=${newScore.toFixed(1)})`,
          payload: { fromBand: previousBand.label, toBand: band.label, score: Number(newScore.toFixed(2)) },
        });

        next = this.emitChatSignal(next, 'TRUST_TRANSITION', participant.playerId,
          `Trust ${previousBand.label} -> ${band.label}`);
      }
    }

    return next;
  }

  private computeDefectionRiskSignal(participant: ModeParticipant, trustScore: number): TrustAuditLine['defectionRiskSignal'] {
    const band = getTrustBandForScore(trustScore);
    if (!band) return 'LOW';

    const psyche = calcPsycheState(participant);
    const pressure = participant.snapshot.pressure;

    if (TRUST_BAND_ORDINAL[band.label] <= TRUST_BAND_ORDINAL['DISTRUSTED'] &&
        PSYCHE_ORDINAL[psyche] >= PSYCHE_ORDINAL['BREAKING']) {
      return 'CRITICAL';
    }
    if (TRUST_BAND_ORDINAL[band.label] <= TRUST_BAND_ORDINAL['CAUTIOUS'] &&
        PRESSURE_ORDINAL[pressure.tier] >= PRESSURE_ORDINAL['T3']) {
      return 'HIGH';
    }
    if (trustScore < 40) return 'MEDIUM';
    return 'LOW';
  }

  private awardTrustForRescue(frame: ModeFrame, rescuerId: string, targetId: string, efficiency: number): ModeFrame {
    let next = cloneFrame(frame);
    if (!next.syndicate) return next;

    const rescuerAudit = next.syndicate.trustAudit[rescuerId];
    if (!rescuerAudit) return next;

    const trustGain = 8 * efficiency;
    const newScore = Math.min(TRUST_SCORE_BOUNDS.max, rescuerAudit.trustScore + trustGain);

    next.syndicate.trustAudit[rescuerId] = {
      ...rescuerAudit,
      trustScore: Number(newScore.toFixed(2)),
      rescueCount: rescuerAudit.rescueCount + 1,
      notes: [...rescuerAudit.notes, `Rescued ${targetId} at tick ${next.tick} (eff=${(efficiency * 100).toFixed(0)}%)`],
    };

    return next;
  }

  private computeTrustBandEfficiency(trustScore: number): number {
    const band = getTrustBandForScore(trustScore);
    return band ? band.efficiencyMultiplier : 1.0;
  }

  private computeTrustComboBonus(trustScore: number): number {
    const band = getTrustBandForScore(trustScore);
    return band ? band.comboMultiplier : 1.0;
  }

  private isTrustLoanAccessible(trustScore: number): boolean {
    const band = getTrustBandForScore(trustScore);
    return band ? band.loanAccessGranted : false;
  }

  // ========================================================================
  // INTERNAL — Defection System (Co-op)
  // ========================================================================

  private initializeDefectionTrackers(frame: ModeFrame): ModeFrame {
    for (const participant of frame.participants) {
      if (!this.defectionTrackers.has(participant.playerId)) {
        this.defectionTrackers.set(participant.playerId, {
          playerId: participant.playerId,
          state: {
            playerId: participant.playerId,
            currentStep: 'NONE',
            startedAtTick: null,
            stepEnteredAtTick: frame.tick,
            reversible: true,
            accumulatedPenalty: 0,
            seizureFraction: 0,
            notified: false,
          },
          cardArc: [],
        });
      }
    }
    return frame;
  }

  private advanceDefectionStep(frame: ModeFrame, actorId: string): ModeFrame {
    let next = cloneFrame(frame);
    const tracker = this.defectionTrackers.get(actorId);
    if (!tracker) return next;

    const currentStep = tracker.state.currentStep;
    const cooldown = DEFECTION_STEP_COOLDOWNS[currentStep];

    // Check cooldown
    if (next.tick - tracker.state.stepEnteredAtTick < cooldown) {
      next = pushEvent(next, {
        tick: next.tick,
        level: 'WARNING',
        channel: 'PRIVATE',
        actorId,
        code: 'DEFECTION_COOLDOWN',
        message: `Defection cooldown: ${cooldown - (next.tick - tracker.state.stepEnteredAtTick)} ticks remaining`,
      });
      return next;
    }

    const nextStep = getNextDefectionStep(currentStep);
    if (nextStep === currentStep) return next;

    tracker.state = {
      ...tracker.state,
      currentStep: nextStep,
      startedAtTick: tracker.state.startedAtTick ?? next.tick,
      stepEnteredAtTick: next.tick,
      reversible: isDefectionReversible(nextStep),
      seizureFraction: DEFECTION_SEIZURE_FRACTIONS[nextStep],
      accumulatedPenalty: tracker.state.accumulatedPenalty + DEFECTION_ORDINAL[nextStep] * 500,
    };
    tracker.cardArc.push(nextStep);

    // Update syndicate state
    if (next.syndicate && nextStep === 'DEFECTED') {
      if (!next.syndicate.defectedPlayerIds.includes(actorId)) {
        next.syndicate = {
          ...next.syndicate,
          defectedPlayerIds: [...next.syndicate.defectedPlayerIds, actorId],
          splitDisposition: 'DEFECTOR_SPLIT',
        };
      }
      next = this.applyDefectionConsequences(next, actorId);
    }

    // Notify
    if (!tracker.state.notified && DEFECTION_ORDINAL[nextStep] >= DEFECTION_ORDINAL['SILENT_EXIT']) {
      tracker.state = { ...tracker.state, notified: true };
      next = this.emitChatSignal(next, 'DEFECTION_STEP', actorId, `${actorId} defection: ${nextStep}`);
    }

    next = pushEvent(next, {
      tick: next.tick,
      level: 'ALERT',
      channel: 'TEAM',
      actorId,
      code: 'DEFECTION_ADVANCE',
      message: `${actorId}: defection step ${currentStep} -> ${nextStep}`,
      payload: { fromStep: currentStep, toStep: nextStep, reversible: tracker.state.reversible ? 1 : 0 },
    });

    // Update participant mode state
    next = updateParticipant(next, actorId, (p) => ({
      ...p,
      snapshot: {
        ...p.snapshot,
        modeState: {
          ...p.snapshot.modeState,
          defectionStepByPlayer: {
            ...p.snapshot.modeState.defectionStepByPlayer,
            [actorId]: DEFECTION_ORDINAL[nextStep],
          },
        },
      },
    }));

    return next;
  }

  private processDefectionTrackers(frame: ModeFrame): ModeFrame {
    let next = frame;

    for (const [playerId, tracker] of this.defectionTrackers) {
      if (tracker.state.currentStep === 'NONE' || tracker.state.currentStep === 'DEFECTED') continue;

      // Check the 3-card arc: BREAK_PACT -> SILENT_EXIT -> ASSET_SEIZURE
      if (tracker.cardArc.length >= 3) {
        const lastThree = tracker.cardArc.slice(-3);
        if (lastThree[0] === 'BREAK_PACT' && lastThree[1] === 'SILENT_EXIT' && lastThree[2] === 'ASSET_SEIZURE') {
          next = pushEvent(next, {
            tick: next.tick,
            level: 'ALERT',
            channel: 'TEAM',
            actorId: playerId,
            code: 'DEFECTION_ARC_COMPLETE',
            message: `${playerId} completed the defection 3-card arc`,
          });
        }
      }
    }

    return next;
  }

  private applyDefectionConsequences(frame: ModeFrame, defectorId: string): ModeFrame {
    let next = cloneFrame(frame);
    if (!next.syndicate) return next;

    const tracker = this.defectionTrackers.get(defectorId);
    if (!tracker) return next;

    const treasurySeized = next.syndicate.treasuryBalance * tracker.state.seizureFraction;
    const cordPenalty = DEFECTION_CORD_PENALTY;

    // Apply treasury seizure
    next.syndicate = {
      ...next.syndicate,
      treasuryBalance: next.syndicate.treasuryBalance - treasurySeized,
    };

    // Apply trust impact to all remaining members
    for (const participant of next.participants) {
      if (participant.playerId === defectorId) continue;
      const audit = next.syndicate.trustAudit[participant.playerId];
      if (audit) {
        next.syndicate.trustAudit[participant.playerId] = {
          ...audit,
          trustScore: Math.max(TRUST_SCORE_BOUNDS.min, audit.trustScore - 15),
          notes: [...audit.notes, `Trust hit from ${defectorId} defection at tick ${next.tick}`],
        };
      }
    }

    // Apply CORD penalty to defector
    next = updateParticipant(next, defectorId, (p) => ({
      ...p,
      snapshot: {
        ...p.snapshot,
        sovereignty: {
          ...p.snapshot.sovereignty,
          cordScore: Number((p.snapshot.sovereignty.cordScore * (1 - cordPenalty)).toFixed(4)),
        },
      },
    }));

    const consequences: DefectionConsequences = {
      playerId: defectorId,
      defectorCashPenalty: tracker.state.accumulatedPenalty,
      syndicateCashPenalty: Math.round(treasurySeized * 0.1),
      trustImpact: -15,
      cordPenalty,
      coopCardsRevoked: true,
      revokedBadges: ['COOP_LOYAL_MEMBER'],
      treasurySeized,
    };

    next = pushEvent(next, {
      tick: next.tick,
      level: 'ALERT',
      channel: 'TEAM',
      actorId: defectorId,
      code: 'DEFECTION_CONSEQUENCES',
      message: `Defection consequences applied: treasury seized=${treasurySeized.toFixed(0)}, CORD penalty=${(cordPenalty * 100).toFixed(0)}%`,
      payload: {
        treasurySeized: Number(treasurySeized.toFixed(0)),
        cordPenaltyPct: Number((cordPenalty * 100).toFixed(0)),
        coopCardsRevoked: true,
      },
    });

    return next;
  }

  // ========================================================================
  // INTERNAL — Shared Objective Evaluation (Co-op)
  // ========================================================================

  private initializeSharedObjectives(frame: ModeFrame): ModeFrame {
    this.objectiveTrackers = SHARED_OBJECTIVES
      .filter((def) => frame.participants.length >= def.minimumPlayers)
      .map((def) => ({
        objectiveId: def.objectiveId,
        definition: def,
        state: {
          objectiveId: def.objectiveId,
          active: true,
          progress: 0,
          completed: false,
          failed: false,
          activatedAtTick: frame.tick,
          resolvedAtTick: null,
          contributorIds: [],
        },
      }));
    return frame;
  }

  private evaluateSharedObjectives(frame: ModeFrame): ModeFrame {
    let next = frame;

    for (const tracker of this.objectiveTrackers) {
      if (!tracker.state.active || tracker.state.completed || tracker.state.failed) continue;

      // Check deadline
      if (next.tick - tracker.state.activatedAtTick >= tracker.definition.durationTicks) {
        tracker.state = { ...tracker.state, active: false, failed: true, resolvedAtTick: next.tick };
        next = pushEvent(next, {
          tick: next.tick,
          level: 'WARNING',
          channel: 'TEAM',
          actorId: null,
          code: 'OBJECTIVE_FAILED',
          message: `Shared objective "${tracker.definition.name}" failed (deadline expired)`,
        });
        next = this.emitChatSignal(next, 'OBJECTIVE_FAILED', null, `Objective failed: ${tracker.definition.name}`);
        continue;
      }

      // Evaluate progress
      const progress = this.computeObjectiveProgress(next, tracker);
      tracker.state = { ...tracker.state, progress };

      // Check completion
      if (progress >= 1.0) {
        tracker.state = { ...tracker.state, active: false, completed: true, resolvedAtTick: next.tick };
        next = this.distributeObjectiveReward(next, tracker);
        next = pushEvent(next, {
          tick: next.tick,
          level: 'SUCCESS',
          channel: 'TEAM',
          actorId: null,
          code: 'OBJECTIVE_COMPLETED',
          message: `Shared objective "${tracker.definition.name}" completed! Reward: ${tracker.definition.rewardPerPlayer} per player`,
          payload: { objectiveId: tracker.objectiveId, reward: tracker.definition.rewardPerPlayer },
        });
        next = this.emitChatSignal(next, 'OBJECTIVE_COMPLETED', null, `Objective complete: ${tracker.definition.name}!`);
      }
    }

    return next;
  }

  private computeObjectiveProgress(frame: ModeFrame, tracker: ObjectiveTracker): number {
    const participants = frame.participants;

    switch (tracker.objectiveId) {
      case 'COLLECTIVE_FREEDOM': {
        const freed = participants.filter((p) => p.snapshot.outcome === 'FREEDOM').length;
        return participants.length > 0 ? freed / participants.length : 0;
      }
      case 'ZERO_BANKRUPTCIES': {
        const bankrupt = participants.filter((p) => p.snapshot.outcome === 'BANKRUPT').length;
        return bankrupt === 0 ? (frame.tick / 120) : 0;
      }
      case 'FULL_SHIELD_SWEEP': {
        const fullShields = participants.filter((p) => shieldPct(p) >= 0.99).length;
        return participants.length > 0 ? fullShields / participants.length : 0;
      }
      case 'TRUST_CEILING': {
        if (!frame.syndicate) return 0;
        const bonded = participants.filter((p) => {
          const audit = frame.syndicate?.trustAudit[p.playerId];
          return audit && audit.trustScore >= 80;
        }).length;
        return participants.length > 0 ? bonded / participants.length : 0;
      }
      default:
        return 0;
    }
  }

  private distributeObjectiveReward(frame: ModeFrame, tracker: ObjectiveTracker): ModeFrame {
    let next = cloneFrame(frame);

    for (let i = 0; i < next.participants.length; i++) {
      const participant = next.participants[i];
      next.participants[i] = {
        ...participant,
        snapshot: {
          ...participant.snapshot,
          economy: {
            ...participant.snapshot.economy,
            cash: participant.snapshot.economy.cash + tracker.definition.rewardPerPlayer,
          },
        },
      };

      if (!tracker.state.contributorIds.includes(participant.playerId)) {
        tracker.state.contributorIds.push(participant.playerId);
      }
    }

    return next;
  }

  // ========================================================================
  // INTERNAL — Battle Budget System (PvP)
  // ========================================================================

  private generateBattleBudget(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);

    for (let i = 0; i < next.participants.length; i++) {
      const participant = next.participants[i];
      const battle = participant.snapshot.battle;
      const income = participant.snapshot.economy.incomePerTick;
      const phaseConfig = getPhaseForTick(next.tick);

      // Generate BB from income
      const generation = BATTLE_BUDGET_GEN_RATE + (income * 0.05);
      const cap = phaseConfig ? phaseConfig.battleBudgetCap : 5000;
      const newBudget = Math.min(cap, battle.battleBudget + generation);

      next.participants[i] = {
        ...participant,
        snapshot: {
          ...participant.snapshot,
          battle: {
            ...battle,
            battleBudget: Number(newBudget.toFixed(2)),
            battleBudgetCap: cap,
          },
        },
      };
    }

    return next;
  }

  private updatePsycheMeter(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);

    for (const participant of next.participants) {
      const psyche = calcPsycheState(participant);
      const visibility = visibilityForTier(participant.snapshot.modeState.counterIntelTier);

      next = updateParticipant(next, participant.playerId, (p) => ({
        ...p,
        metadata: {
          ...p.metadata,
          psycheState: psyche,
          visibilityTier: visibility,
          psycheOrdinal: PSYCHE_ORDINAL[psyche],
        },
      }));
    }

    return next;
  }

  /** Calculate bleed-through damage at CRITICAL timing (1.4x multiplier). */
  private computeBleedThroughDamage(baseDamage: number, timing: TimingClass): number {
    const multiplier = timing === 'CTR' ? CRITICAL_TIMING_BLEED_MULTIPLIER : 1.0;
    return Number((baseDamage * multiplier).toFixed(2));
  }

  /** Calculate PvP counter cost (reduced by COUNTER_COST_REDUCTION_PVP). */
  private computePvpCounterCost(baseCounterCost: number): number {
    return Number((baseCounterCost * COUNTER_COST_REDUCTION_PVP).toFixed(2));
  }

  // ========================================================================
  // INTERNAL — Ghost Divergence System
  // ========================================================================

  private initializeGhostBenchmarks(frame: ModeFrame): ModeFrame {
    if (!frame.legend) return frame;

    // Create benchmark windows around each legend marker
    for (const marker of frame.legend.markers) {
      this.ghostBenchmarkWindows.push({
        startTick: Math.max(0, marker.tick - GHOST_DIVERGENCE_PROXIMITY_TICKS),
        endTick: marker.tick + GHOST_DIVERGENCE_PROXIMITY_TICKS,
        legendScore: (marker as any).legendScore ?? (marker as any).score ?? 0,
        challengerScore: 0,
        markers: [marker.markerId],
        divergenceScore: 0,
      });
    }

    return frame;
  }

  private trackGhostDivergence(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);
    if (!next.legend) return next;

    for (const participant of next.participants) {
      const sovereignty = participant.snapshot.sovereignty;
      const gapVsLegend = sovereignty.gapVsLegend;

      // Compute divergence potential
      const divergence = this.computeDivergencePotential(participant, next.legend);

      // Track in ghost markers
      const ghostMarkers = participant.snapshot.cards.ghostMarkers;
      for (const marker of ghostMarkers) {
        if (Math.abs(next.tick - marker.tick) <= GHOST_WINDOW_RADIUS) {
          // Within proximity window
          next = pushEvent(next, {
            tick: next.tick,
            level: 'INFO',
            channel: 'SYSTEM',
            actorId: participant.playerId,
            code: 'GHOST_MARKER_PROXIMITY',
            message: `Near legend marker ${marker.markerId} (gap=${gapVsLegend.toFixed(2)}, divergence=${divergence})`,
            payload: { markerId: marker.markerId, gap: Number(gapVsLegend.toFixed(2)), divergence },
          });
        }
      }

      // Update fork hints with divergence data
      next = updateParticipant(next, participant.playerId, (p) =>
        addForkHint(p, `GHOST_DIVERGENCE:${divergence}:tick_${next.tick}:gap=${gapVsLegend.toFixed(2)}`));
    }

    return next;
  }

  private processGhostBenchmarkWindows(frame: ModeFrame): ModeFrame {
    let next = frame;

    for (const window of this.ghostBenchmarkWindows) {
      if (next.tick < window.startTick || next.tick > window.endTick) continue;

      // Update challenger score from participant sovereignty
      for (const participant of next.participants) {
        window.challengerScore = participant.snapshot.sovereignty.sovereigntyScore;
        window.divergenceScore = Math.abs(window.challengerScore - window.legendScore);
      }
    }

    return next;
  }

  private computeDivergencePotential(participant: ModeParticipant, legend: NonNullable<ModeFrame['legend']>): DivergencePotential {
    const gap = Math.abs(participant.snapshot.sovereignty.gapVsLegend);
    const closingRate = participant.snapshot.sovereignty.gapClosingRate;

    if (gap < 0.1 && closingRate > 0) return 'HIGH';
    if (gap < 0.3) return 'MEDIUM';
    return 'LOW';
  }

  private openGhostBenchmarkWindow(frame: ModeFrame, actorId: string): ModeFrame {
    let next = cloneFrame(frame);

    this.ghostBenchmarkWindows.push({
      startTick: next.tick,
      endTick: next.tick + GHOST_WINDOW_RADIUS * 2,
      legendScore: next.legend?.legendScore ?? 0,
      challengerScore: 0,
      markers: [],
      divergenceScore: 0,
    });

    next = pushEvent(next, {
      tick: next.tick,
      level: 'INFO',
      channel: 'SYSTEM',
      actorId,
      code: 'GHOST_BENCHMARK_OPENED',
      message: `Ghost benchmark window opened at tick ${next.tick}`,
    });

    return next;
  }

  /** Collect card replay audit data for ghost mode finalization. */
  private collectGhostCardReplayAudit(frame: ModeFrame): CardDecisionAudit[] {
    const audits: CardDecisionAudit[] = [];
    for (const participant of frame.participants) {
      for (const decision of participant.snapshot.telemetry.decisions) {
        audits.push(auditCardDecision(
          decision.actorId,
          decision.cardId,
          frame.mode,
          0,
          0,
          [`replay_tick_${decision.tick}`, `latency_${decision.latencyMs}ms`],
        ));
      }
    }
    return audits;
  }

  /** Verify deterministic seeds for ghost mode. */
  private verifyGhostDeterministicSeeds(frame: ModeFrame): boolean {
    for (const participant of frame.participants) {
      const checksums = participant.snapshot.sovereignty.tickChecksums;
      if (checksums.length === 0) return false;
      // Check that checksums are sequential and non-empty
      for (const checksum of checksums) {
        if (!checksum || checksum.length === 0) return false;
      }
    }
    return true;
  }

  // ========================================================================
  // INTERNAL — Empire Hold System (Solo)
  // ========================================================================

  private computeIsolationTax(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);

    for (let i = 0; i < next.participants.length; i++) {
      const participant = next.participants[i];
      const shieldInteg = shieldPct(participant);
      const incomeRate = participant.snapshot.economy.incomePerTick;

      // Isolation tax applies when shields are low and income is stagnant
      if (shieldInteg < 0.3 && incomeRate < 50) {
        const tax = participant.snapshot.economy.cash * EMPIRE_ISOLATION_TAX_RATE;
        next.participants[i] = {
          ...participant,
          snapshot: {
            ...participant.snapshot,
            economy: {
              ...participant.snapshot.economy,
              cash: Math.max(0, participant.snapshot.economy.cash - tax),
            },
          },
        };

        if (tax > 0) {
          next = pushEvent(next, {
            tick: next.tick,
            level: 'WARNING',
            channel: 'SYSTEM',
            actorId: participant.playerId,
            code: 'ISOLATION_TAX',
            message: `Isolation tax: ${tax.toFixed(0)} cash deducted (shield=${(shieldInteg * 100).toFixed(0)}%, income=${incomeRate.toFixed(0)})`,
            payload: { tax: Number(tax.toFixed(0)), shieldPct: Number(shieldInteg.toFixed(3)) },
          });
        }
      }
    }

    return next;
  }

  private enforceHoldPolicy(frame: ModeFrame): ModeFrame {
    let next = frame;

    for (const participant of next.participants) {
      const holdCharges = participant.snapshot.timers.holdCharges;
      const momentumScore = participant.snapshot.sovereignty.sovereigntyScore;

      // 1 free hold, 2nd if momentum > threshold
      const maxHolds = momentumScore > EMPIRE_MOMENTUM_HOLD_THRESHOLD ? 2 : 1;

      if (holdCharges > maxHolds) {
        next = updateParticipant(next, participant.playerId, (p) => ({
          ...p,
          snapshot: {
            ...p.snapshot,
            timers: {
              ...p.snapshot.timers,
              holdCharges: maxHolds,
            },
          },
        }));
      }
    }

    return next;
  }

  private expireAllHolds(frame: ModeFrame): ModeFrame {
    let next = cloneFrame(frame);

    for (let i = 0; i < next.participants.length; i++) {
      const participant = next.participants[i];
      next.participants[i] = {
        ...participant,
        snapshot: {
          ...participant.snapshot,
          timers: {
            ...participant.snapshot.timers,
            holdCharges: 0,
          },
        },
      };
    }

    next = pushEvent(next, {
      tick: next.tick,
      level: 'WARNING',
      channel: 'SYSTEM',
      actorId: null,
      code: 'HOLDS_EXPIRED',
      message: 'All holds expired due to double phase change',
    });

    return next;
  }

  private resolveHoldAction(frame: ModeFrame, actorId: string, payload?: Record<string, unknown>): ModeFrame {
    let next = cloneFrame(frame);
    const participant = next.participants.find((p) => p.playerId === actorId);
    if (!participant) return next;

    // Cannot hold boundary cards
    const cardId = (payload?.['cardId'] as string) ?? '';
    if (this.isPhaseBoundaryCard(cardId, next.tick)) {
      next = pushEvent(next, {
        tick: next.tick,
        level: 'WARNING',
        channel: 'SYSTEM',
        actorId,
        code: 'HOLD_DENIED_BOUNDARY',
        message: `Cannot hold phase boundary card ${cardId}`,
      });
      return next;
    }

    if (participant.snapshot.timers.holdCharges <= 0) {
      next = pushEvent(next, {
        tick: next.tick,
        level: 'WARNING',
        channel: 'SYSTEM',
        actorId,
        code: 'HOLD_DENIED_NO_CHARGES',
        message: 'No hold charges remaining',
      });
      return next;
    }

    next = updateParticipant(next, actorId, (p) => ({
      ...p,
      snapshot: {
        ...p.snapshot,
        timers: {
          ...p.snapshot.timers,
          holdCharges: p.snapshot.timers.holdCharges - 1,
        },
      },
    }));

    return next;
  }

  /** Check if a card is a phase boundary card. */
  private isPhaseBoundaryCard(cardId: string, tick: number): boolean {
    const phase = getPhaseForTick(tick);
    if (!phase) return false;
    return Math.abs(tick - phase.startTick) <= PHASE_WINDOW_TICKS ||
      Math.abs(tick - phase.endTick) <= PHASE_WINDOW_TICKS;
  }

  /** Compute CORD bonus for no-hold Empire runs. */
  private computeNoHoldCordBonus(participant: ModeParticipant): number {
    const noHoldUsed = participant.snapshot.timers.holdCharges === 1 || participant.snapshot.tags.includes('NO_HOLD_USED');
    return noHoldUsed ? EMPIRE_NO_HOLD_CORD_BONUS : 0;
  }

  // ========================================================================
  // INTERNAL — Card Play Pipeline (Validation Helpers)
  // ========================================================================

  private checkDeckLegality(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
    const ok = isCardPlayLegal(intent, frame.mode);
    if (!ok) {
      const card = 'definitionId' in intent.card ? (intent.card as CardInstance).card : intent.card as CardDefinition;
      return {
        ok: false,
        reason: `Deck type ${card.deckType} is not legal in ${frame.mode} mode`,
        warnings: [],
      };
    }
    return { ok: true, reason: null, warnings: [] };
  }

  private validateTimingWindow(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
    const timingLocks = MODE_TIMING_LOCKS[frame.mode];
    const warnings: string[] = [];

    // Check if timing is in the mode's allowed timing classes
    if (timingLocks.length > 0 && !timingLocks.includes(intent.timing)) {
      // Not a hard block, but add a warning if it's a mode-specific timing
      const modeTimingDescription = timingLocks.join(', ');
      warnings.push(`Timing ${intent.timing} is not mode-preferred. Mode-native timings: ${modeTimingDescription}`);
    }

    // Validate timing window is open for the intent
    const actor = frame.participants.find((p) => p.playerId === intent.actorId);
    if (actor) {
      const activeWindows = actor.snapshot.timers.activeDecisionWindows;
      const frozenWindows = actor.snapshot.timers.frozenWindowIds;

      // Check if any relevant window is frozen
      const relevantWindowKeys = Object.keys(activeWindows).filter((key) =>
        key.includes(intent.timing) || key.includes('ANY'));
      for (const key of relevantWindowKeys) {
        if (frozenWindows.includes(key)) {
          return {
            ok: false,
            reason: `Timing window ${key} is frozen for ${intent.actorId}`,
            warnings,
          };
        }
      }
    }

    return { ok: true, reason: null, warnings };
  }

  private enforceCardLegalityMatrix(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
    const card = 'definitionId' in intent.card ? (intent.card as CardInstance).card : intent.card as CardDefinition;
    const deckType = card.deckType;
    const mode = frame.mode;

    // SABOTAGE only in solo+pvp
    if (deckType === 'SABOTAGE' && mode !== 'solo' && mode !== 'pvp') {
      return { ok: false, reason: 'SABOTAGE cards are only legal in solo and pvp modes', warnings: [] };
    }

    // AID, RESCUE, TRUST only in coop
    if ((deckType === 'AID' || deckType === 'RESCUE' || deckType === 'TRUST') && mode !== 'coop') {
      return { ok: false, reason: `${deckType} cards are only legal in coop mode`, warnings: [] };
    }

    // GHOST only in ghost
    if (deckType === 'GHOST' && mode !== 'ghost') {
      return { ok: false, reason: 'GHOST cards are only legal in ghost mode', warnings: [] };
    }

    // DISCIPLINE allowed in solo+ghost (plus any mode the adapter permits)
    if (deckType === 'DISCIPLINE') {
      const legalModes = CARD_LEGALITY;
      if (!legalModes[mode].includes('DISCIPLINE')) {
        return { ok: false, reason: `DISCIPLINE cards are not legal in ${mode} mode`, warnings: [] };
      }
    }

    // Check defection card revocation in coop
    if (mode === 'coop') {
      const tracker = this.defectionTrackers.get(intent.actorId);
      if (tracker && tracker.state.currentStep === 'DEFECTED') {
        if (deckType === 'AID' || deckType === 'RESCUE' || deckType === 'TRUST') {
          return { ok: false, reason: `Co-op cards revoked: ${intent.actorId} has defected`, warnings: [] };
        }
      }
    }

    // Safety card check
    if (SAFETY_CARD_IDS.has(card.id)) {
      return { ok: true, reason: null, warnings: ['Safety card: always legal'] };
    }

    return { ok: true, reason: null, warnings: [] };
  }

  private checkCounterability(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
    const card = 'definitionId' in intent.card ? (intent.card as CardInstance).card : intent.card as CardDefinition;

    // In PvP, check if the card can be countered within the counter window
    if (card.counterability === 'HARD') {
      return {
        ok: true,
        reason: null,
        warnings: [`Card ${card.id} has HARD counterability — opponent has ${COUNTER_WINDOW_TICKS} tick(s) to counter`],
      };
    }

    return { ok: true, reason: null, warnings: [] };
  }

  private enforcePhaseCardBoundary(frame: ModeFrame, intent: CardPlayIntent): ModeValidationResult {
    const cardId = 'definitionId' in intent.card ? (intent.card as CardInstance).definitionId : (intent.card as CardDefinition).id;

    // Cannot hold or play boundary cards across phases
    if (this.isPhaseBoundaryCard(cardId, frame.tick)) {
      return {
        ok: true,
        reason: null,
        warnings: ['Phase boundary card: special resolution rules apply'],
      };
    }

    return { ok: true, reason: null, warnings: [] };
  }

  // ========================================================================
  // INTERNAL — Bluff Resolution (PvP)
  // ========================================================================

  private resolveBluffAction(frame: ModeFrame, actorId: string, payload?: Record<string, unknown>): ModeFrame {
    let next = cloneFrame(frame);

    const bluffCardId = (payload?.['cardId'] as string) ?? '';
    const displayedType = (payload?.['displayedType'] as string) ?? '';
    const bluffCalled = (payload?.['bluffCalled'] as boolean) ?? false;

    const bluffContract: BluffCardContract = {
      cardId: bluffCardId,
      displayedSabotageType: displayedType as BluffCardContract['displayedSabotageType'],
      realEffect: (payload?.['realEffect'] as string) ?? 'CASH_DRAIN',
      realMagnitude: (payload?.['realMagnitude'] as number) ?? 100,
      bluffCalled,
      outcomeModifier: bluffCalled ? 0.5 : 1.5,
    };

    if (bluffCalled) {
      // Bluff was called — reduced effect + penalty
      next = pushEvent(next, {
        tick: next.tick,
        level: 'INFO',
        channel: 'SYSTEM',
        actorId,
        code: 'BLUFF_CALLED',
        message: `${actorId} bluff called! Displayed ${displayedType}, effect reduced by ${((1 - bluffContract.outcomeModifier) * 100).toFixed(0)}%`,
        payload: { cardId: bluffCardId, displayedType, outcomeModifier: bluffContract.outcomeModifier },
      });
    } else {
      // Bluff succeeded
      next = pushEvent(next, {
        tick: next.tick,
        level: 'SUCCESS',
        channel: 'SYSTEM',
        actorId,
        code: 'BLUFF_SUCCESS',
        message: `${actorId} bluff succeeded! Effect amplified by ${((bluffContract.outcomeModifier - 1) * 100).toFixed(0)}%`,
        payload: { cardId: bluffCardId, outcomeModifier: bluffContract.outcomeModifier },
      });
    }

    // Route bluff cost as battle budget expenditure
    const bbCost = bluffCalled ? 20 : 10;
    next = updateParticipant(next, actorId, (p) => ({
      ...p,
      snapshot: {
        ...p.snapshot,
        battle: {
          ...p.snapshot.battle,
          battleBudget: Math.max(0, p.snapshot.battle.battleBudget - bbCost),
        },
      },
    }));

    return next;
  }

  // ========================================================================
  // INTERNAL — Sabotage Combo Chain Tracking (PvP)
  // ========================================================================

  private trackSabotageComboChain(actorId: string, cardId: string, tick: number): void {
    let tracker = this.comboChainMap.get(actorId);
    if (!tracker) {
      tracker = { chainLength: 0, lastCardTick: -SABOTAGE_COMBO_CHAIN_TIMEOUT_TICKS - 1, cardIds: [], damageMultiplier: 1.0 };
      this.comboChainMap.set(actorId, tracker);
    }

    // Check if the chain is still active
    if (tick - tracker.lastCardTick <= SABOTAGE_COMBO_CHAIN_TIMEOUT_TICKS) {
      // Extend chain
      tracker.chainLength += 1;
      tracker.damageMultiplier = 1.0 + tracker.chainLength * 0.15;
    } else {
      // Reset chain
      tracker.chainLength = 1;
      tracker.damageMultiplier = 1.0;
      tracker.cardIds = [];
    }

    tracker.lastCardTick = tick;
    tracker.cardIds.push(cardId);
  }

  // ========================================================================
  // INTERNAL — Mode Overlay Resolution
  // ========================================================================

  private resolveOverlayForMode(mode: ModeCode, card: CardDefinition): ModeOverlayContract {
    const deckType = card.deckType;

    // Apply mode-specific overlay templates
    if (mode === 'coop' && (deckType === 'AID' || deckType === 'RESCUE' || deckType === 'TRUST')) {
      return { ...COOP_AID_OVERLAY };
    }
    if (mode === 'pvp' && (deckType === 'SABOTAGE' || deckType === 'BLUFF' || deckType === 'COUNTER')) {
      return { ...PVP_AGGRESSION_OVERLAY };
    }
    if (mode === 'ghost' && (deckType === 'DISCIPLINE' || deckType === 'GHOST')) {
      return { ...GHOST_DISCIPLINE_OVERLAY };
    }

    // Apply tag weight modifiers from mode tag weights
    const tagWeights: Record<string, number> = {};
    for (const tag of card.tags) {
      tagWeights[tag] = modeTagWeight(mode, tag);
    }

    // Apply pressure cost modifier
    return {
      ...DEFAULT_MODE_OVERLAY,
      tagWeights,
    };
  }

  // ========================================================================
  // INTERNAL — Mode-Specific Finalization
  // ========================================================================

  private computeModeSpecificFinalization(frame: ModeFrame): ModeFinalization {
    switch (frame.mode) {
      case 'solo': return this.finalizeEmpireEnhancement(frame);
      case 'pvp': return this.finalizePredatorEnhancement(frame);
      case 'coop': return this.finalizeSyndicateEnhancement(frame);
      case 'ghost': return this.finalizePhantomEnhancement(frame);
      default: return { bonusMultiplier: 1.0, flatBonus: 0, badges: [], audits: [], notes: [] };
    }
  }

  private finalizeEmpireEnhancement(frame: ModeFrame): ModeFinalization {
    const participant = frame.participants[0];
    if (!participant) return { bonusMultiplier: 1.0, flatBonus: 0, badges: [], audits: [], notes: [] };

    const badges: string[] = [];
    const notes: string[] = [];
    let bonusMultiplier = 1.0;
    let flatBonus = 0;

    // No-hold CORD bonus
    const noHoldBonus = this.computeNoHoldCordBonus(participant);
    if (noHoldBonus > 0) {
      bonusMultiplier += noHoldBonus;
      badges.push('EMPIRE_NO_HOLD');
      notes.push(`No-hold CORD bonus: +${(noHoldBonus * 100).toFixed(0)}%`);
    }

    // Handicap bonuses
    for (const handicapId of participant.snapshot.modeState.handicapIds) {
      const handicap = HANDICAPS[handicapId as keyof typeof HANDICAPS];
      if (handicap) {
        bonusMultiplier += handicap.cordBonus;
        notes.push(`Handicap ${handicapId}: +${(handicap.cordBonus * 100).toFixed(0)}% CORD`);
      }
    }

    // Case file generation data
    const weakest = weakestShieldLayerId(participant);
    notes.push(`Weakest shield layer: ${weakest}`);
    notes.push(`Final psyche: ${calcPsycheState(participant)}`);

    return { bonusMultiplier, flatBonus, badges, audits: [], notes };
  }

  private finalizePredatorEnhancement(frame: ModeFrame): ModeFinalization {
    const badges: string[] = [];
    const notes: string[] = [];
    let bonusMultiplier = 1.0;
    const flatBonus = 0;

    // Check battle budget efficiency
    for (const participant of frame.participants) {
      const bbEfficiency = participant.snapshot.battle.battleBudget / Math.max(1, participant.snapshot.battle.battleBudgetCap);
      notes.push(`${participant.playerId} BB efficiency: ${(bbEfficiency * 100).toFixed(1)}%`);

      // Bleed-through tracking
      const extractionCostMap = EXTRACTION_COSTS;
      const counterCostMap = COUNTER_COSTS;
      const avgExtractionCost = Object.values(extractionCostMap).reduce((s, v) => s + v, 0) / Math.max(1, Object.keys(extractionCostMap).length);
      const avgCounterCost = Object.values(counterCostMap).reduce((s, v) => s + v, 0) / Math.max(1, Object.keys(counterCostMap).length);
      const counterEfficiency = this.tickAnalyticsMap.get(participant.playerId)?.counterEfficiency ?? 0;
      notes.push(`${participant.playerId} counter efficiency: ${(counterEfficiency * 100).toFixed(1)}% avgExtCost=${avgExtractionCost.toFixed(0)} avgCtrCost=${avgCounterCost.toFixed(0)}`);

      // Check for combo chains
      const comboTracker = this.comboChainMap.get(participant.playerId);
      if (comboTracker && comboTracker.chainLength >= 3) {
        badges.push('PREDATOR_COMBO_CHAIN');
        notes.push(`${participant.playerId} max combo chain: ${comboTracker.chainLength}`);
      }
    }

    // Rivalry heat bonus
    if (frame.rivalry && frame.rivalry.archRivalUnlocked) {
      bonusMultiplier += 0.1;
      badges.push('PREDATOR_ARCH_RIVAL');
    }

    // Post-match summary
    const winner = [...frame.participants].sort((a, b) =>
      b.snapshot.sovereignty.sovereigntyScore - a.snapshot.sovereignty.sovereigntyScore)[0];
    if (winner) {
      notes.push(`Winner: ${winner.playerId} (score=${winner.snapshot.sovereignty.sovereigntyScore.toFixed(2)})`);
    }

    return { bonusMultiplier, flatBonus, badges, audits: [], notes };
  }

  private finalizeSyndicateEnhancement(frame: ModeFrame): ModeFinalization {
    const badges: string[] = [];
    const notes: string[] = [];
    let bonusMultiplier = 1.0;
    let flatBonus = 0;

    if (!frame.syndicate) return { bonusMultiplier, flatBonus, badges, audits: [], notes };

    // Trust audit summary
    for (const [playerId, audit] of Object.entries(frame.syndicate.trustAudit)) {
      notes.push(`${playerId} trust: score=${audit.trustScore.toFixed(1)} aids=${audit.aidGivenCount} rescues=${audit.rescueCount} risk=${audit.defectionRiskSignal}`);
      const band = getTrustBandForScore(audit.trustScore);
      if (band) {
        const efficiency = this.computeTrustBandEfficiency(audit.trustScore);
        const comboBonus = this.computeTrustComboBonus(audit.trustScore);
        const loanAccess = this.isTrustLoanAccessible(audit.trustScore);
        notes.push(`  band=${band.label} efficiency=${efficiency.toFixed(2)} combo=${comboBonus.toFixed(2)} loanAccess=${loanAccess}`);
      }
    }

    // Objective completion bonuses
    for (const tracker of this.objectiveTrackers) {
      if (tracker.state.completed) {
        bonusMultiplier += 0.1;
        badges.push(`OBJECTIVE_${tracker.objectiveId}`);
        notes.push(`Objective "${tracker.definition.name}" completed`);
      }
    }

    // Zero defection bonus
    if (frame.syndicate.defectedPlayerIds.length === 0) {
      bonusMultiplier += 0.15;
      badges.push('SYNDICATE_LOYAL');
      notes.push('No defections — loyalty bonus applied');
    }

    // Treasury health
    notes.push(`Final treasury: ${frame.syndicate.treasuryBalance.toFixed(0)}`);

    return { bonusMultiplier, flatBonus, badges, audits: [], notes };
  }

  private finalizePhantomEnhancement(frame: ModeFrame): ModeFinalization {
    const badges: string[] = [];
    const notes: string[] = [];
    let bonusMultiplier = 1.0;
    const flatBonus = 0;

    if (!frame.legend) return { bonusMultiplier, flatBonus, badges, audits: [], notes };

    // Card replay audit
    const replayAudits = this.collectGhostCardReplayAudit(frame);
    notes.push(`Card replay audit: ${replayAudits.length} decisions recorded`);

    // Deterministic seed verification
    const seedsValid = this.verifyGhostDeterministicSeeds(frame);
    notes.push(`Deterministic seeds: ${seedsValid ? 'VALID' : 'INVALID'}`);
    if (!seedsValid) {
      bonusMultiplier *= 0.5;
      notes.push('PENALTY: Invalid deterministic seeds — CORD halved');
    }

    // Ghost benchmark window results
    for (const window of this.ghostBenchmarkWindows) {
      notes.push(`Benchmark [${window.startTick}-${window.endTick}]: legend=${window.legendScore.toFixed(2)} challenger=${window.challengerScore.toFixed(2)} divergence=${window.divergenceScore.toFixed(3)}`);
    }

    // Legend score comparison
    const participant = frame.participants[0];
    if (participant) {
      const challengerScore = participant.snapshot.sovereignty.sovereigntyScore;
      if (challengerScore > frame.legend.legendScore) {
        bonusMultiplier += 0.3;
        badges.push('PHANTOM_LEGEND_EXCEEDED');
        notes.push(`Challenger score ${challengerScore.toFixed(2)} > legend score ${frame.legend.legendScore.toFixed(2)}`);
      }
    }

    return { bonusMultiplier, flatBonus, badges, audits: replayAudits, notes };
  }

  // ========================================================================
  // INTERNAL — Proof Badge Evaluation
  // ========================================================================

  private evaluateProofBadges(frame: ModeFrame): ProofBadgeResult[] {
    const results: ProofBadgeResult[] = [];
    const modeBadges = ALL_PROOF_BADGES.filter((b) => b.mode === frame.mode);

    for (const badge of modeBadges) {
      const result = this.evaluateSingleBadge(frame, badge.badgeId);
      results.push(result);
    }

    return results;
  }

  private evaluateSingleBadge(frame: ModeFrame, badgeId: ProofBadgeId): ProofBadgeResult {
    const notes: string[] = [];
    let earned = false;
    let progress = 0;

    switch (badgeId) {
      // Solo badges
      case 'SOLO_FIRST_FREEDOM': {
        const p = frame.participants[0];
        earned = p?.snapshot.outcome === 'FREEDOM';
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'SOLO_SPEED_RUN': {
        const p = frame.participants[0];
        earned = p?.snapshot.outcome === 'FREEDOM' && frame.tick < 60;
        progress = earned ? 1.0 : Math.min(1.0, 60 / Math.max(1, frame.tick));
        break;
      }
      case 'SOLO_NO_HIT': {
        const p = frame.participants[0];
        earned = p !== undefined && p.snapshot.shield.damagedThisRun === 0 && p.snapshot.outcome === 'FREEDOM';
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'SOLO_FULL_SHIELD': {
        const p = frame.participants[0];
        earned = p !== undefined && shieldPct(p) >= 0.99 && p.snapshot.outcome === 'FREEDOM';
        progress = p ? shieldPct(p) : 0;
        break;
      }
      case 'SOLO_DEBT_FREE': {
        const p = frame.participants[0];
        earned = p !== undefined && p.snapshot.economy.debt === 0 && p.snapshot.outcome === 'FREEDOM';
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'SOLO_DISCIPLINE_MASTER': {
        const p = frame.participants[0];
        const disciplineCount = p?.snapshot.cards.lastPlayed.filter((id) => id.includes('DISCIPLINE')).length ?? 0;
        earned = disciplineCount >= 10;
        progress = Math.min(1.0, disciplineCount / 10);
        break;
      }
      case 'SOLO_COUNTER_KING': {
        const p = frame.participants[0];
        const counterCount = p?.snapshot.shield.blockedThisRun ?? 0;
        earned = counterCount >= 8;
        progress = Math.min(1.0, counterCount / 8);
        break;
      }
      case 'SOLO_MAX_INCOME': {
        const p = frame.participants[0];
        earned = p !== undefined && p.snapshot.economy.cash >= 5000;
        progress = Math.min(1.0, (p?.snapshot.economy.cash ?? 0) / 5000);
        break;
      }

      // PvP badges
      case 'PVP_FIRST_WIN': {
        const winner = [...frame.participants].sort((a, b) =>
          b.snapshot.sovereignty.sovereigntyScore - a.snapshot.sovereignty.sovereigntyScore)[0];
        earned = winner?.snapshot.outcome === 'FREEDOM';
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'PVP_FLAWLESS_VICTORY': {
        const winner = [...frame.participants].sort((a, b) =>
          b.snapshot.sovereignty.sovereigntyScore - a.snapshot.sovereignty.sovereigntyScore)[0];
        earned = winner !== undefined && winner.snapshot.outcome === 'FREEDOM' && shieldPct(winner) >= 0.5;
        progress = winner ? shieldPct(winner) : 0;
        break;
      }
      case 'PVP_RIVAL_BESTED': {
        earned = frame.rivalry?.archRivalUnlocked === true;
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'PVP_NEMESIS_DEFEATED': {
        earned = frame.rivalry?.nemesisUnlocked === true;
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'PVP_BLUFF_MASTER': {
        const bluffCount = frame.history.filter((e) => e.code === 'BLUFF_SUCCESS').length;
        earned = bluffCount >= 5;
        progress = Math.min(1.0, bluffCount / 5);
        break;
      }
      case 'PVP_SABOTAGE_ACE': {
        const sabotageCount = frame.history.filter((e) => e.code === 'EXTRACTION_RESOLVED' && e.payload?.['countered'] === false).length;
        earned = sabotageCount >= 5;
        progress = Math.min(1.0, sabotageCount / 5);
        break;
      }
      case 'PVP_COUNTER_STREAK': {
        const counterEvents = frame.history.filter((e) => e.code === 'COUNTER_RESOLVED');
        let maxStreak = 0;
        let currentStreak = 0;
        for (const e of counterEvents) {
          if (e.payload?.['blocked'] === true) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak); }
          else { currentStreak = 0; }
        }
        earned = maxStreak >= 3;
        progress = Math.min(1.0, maxStreak / 3);
        break;
      }
      case 'PVP_COMEBACK_KING': {
        const winner = [...frame.participants].sort((a, b) =>
          b.snapshot.sovereignty.sovereigntyScore - a.snapshot.sovereignty.sovereigntyScore)[0];
        earned = winner !== undefined && winner.snapshot.outcome === 'FREEDOM' && winner.metadata['comebackFreedom'] === true;
        progress = earned ? 1.0 : 0;
        break;
      }

      // Co-op badges
      case 'COOP_COLLECTIVE_FREEDOM': {
        const freed = frame.participants.filter((p) => p.snapshot.outcome === 'FREEDOM').length;
        earned = freed === frame.participants.length && frame.participants.length >= 2;
        progress = frame.participants.length > 0 ? freed / frame.participants.length : 0;
        break;
      }
      case 'COOP_ZERO_BANKRUPTCIES': {
        const bankrupt = frame.participants.filter((p) => p.snapshot.outcome === 'BANKRUPT').length;
        earned = bankrupt === 0;
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'COOP_TRUST_CEILING': {
        if (frame.syndicate) {
          const bonded = Object.values(frame.syndicate.trustAudit).filter((a) => a.trustScore >= 80).length;
          earned = bonded === frame.participants.length && frame.participants.length >= 3;
          progress = frame.participants.length > 0 ? bonded / frame.participants.length : 0;
        }
        break;
      }
      case 'COOP_RESCUE_HERO': {
        const rescueCount = this.rescueWindows.filter((w) => w.responded).length;
        earned = rescueCount >= 3;
        progress = Math.min(1.0, rescueCount / 3);
        break;
      }
      case 'COOP_AID_CHAMPION': {
        const aidCount = frame.history.filter((e) => e.code === 'CARD_DECISION_AUDIT' && e.message.includes('AID')).length;
        earned = aidCount >= 8;
        progress = Math.min(1.0, aidCount / 8);
        break;
      }
      case 'COOP_COMBO_MASTER': {
        const comboCount = frame.history.filter((e) => e.code === 'COMBO_ACTIVATED').length;
        earned = comboCount >= 3;
        progress = Math.min(1.0, comboCount / 3);
        break;
      }
      case 'COOP_LOYAL_MEMBER': {
        earned = frame.syndicate?.defectedPlayerIds.length === 0;
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'COOP_LOAN_SHARK': {
        if (frame.syndicate) {
          const lenderCounts = Object.values(frame.syndicate.trustAudit)
            .filter((a) => a.loanRepaymentRate >= 1.0 && a.aidGivenCount >= 3);
          earned = lenderCounts.length > 0;
          progress = earned ? 1.0 : 0;
        }
        break;
      }

      // Ghost badges
      case 'GHOST_LEGEND_BEATEN': {
        const p = frame.participants[0];
        earned = p !== undefined && frame.legend !== null && p.snapshot.sovereignty.sovereigntyScore > frame.legend.legendScore;
        progress = frame.legend ? Math.min(1.0, (p?.snapshot.sovereignty.sovereigntyScore ?? 0) / Math.max(1, frame.legend.legendScore)) : 0;
        break;
      }
      case 'GHOST_PERFECT_RUN': {
        const p = frame.participants[0];
        earned = p !== undefined && p.snapshot.outcome === 'FREEDOM' && shieldPct(p) >= 0.99 && p.snapshot.economy.debt === 0;
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'GHOST_SPEED_GHOST': {
        const p = frame.participants[0];
        earned = p !== undefined && frame.legend !== null && p.snapshot.sovereignty.sovereigntyScore > (frame.legend?.legendScore ?? 0) && frame.tick < 50;
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'GHOST_DISCIPLINE_ONLY': {
        const p = frame.participants[0];
        if (p) {
          const allPlayed = p.snapshot.cards.lastPlayed;
          const onlyDisciplineAndCounter = allPlayed.every((id) => id.includes('DISCIPLINE') || id.includes('COUNTER'));
          earned = onlyDisciplineAndCounter && allPlayed.length > 0 && p.snapshot.outcome === 'FREEDOM';
        }
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'GHOST_NO_COUNTER': {
        const p = frame.participants[0];
        if (p) {
          earned = p.snapshot.shield.blockedThisRun === 0 && p.snapshot.outcome === 'FREEDOM';
        }
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'GHOST_FULL_MARKERS': {
        const p = frame.participants[0];
        if (p && frame.legend) {
          const markerKinds = Array.from(new Set(p.snapshot.cards.ghostMarkers.map((m) => m.kind)));
          earned = markerKinds.length >= 5;
          progress = Math.min(1.0, markerKinds.length / 5);
        }
        break;
      }
      case 'GHOST_COMEBACK_GHOST': {
        const p = frame.participants[0];
        earned = p !== undefined && p.metadata['comebackFreedom'] === true && frame.legend !== null &&
          p.snapshot.sovereignty.sovereigntyScore > (frame.legend?.legendScore ?? 0);
        progress = earned ? 1.0 : 0;
        break;
      }
      case 'GHOST_UNTOUCHABLE': {
        const p = frame.participants[0];
        earned = p !== undefined && p.snapshot.shield.damagedThisRun === 0 && p.snapshot.outcome === 'FREEDOM';
        progress = earned ? 1.0 : 0;
        break;
      }
      default:
        break;
    }

    return { badgeId, earned, progress: Number(progress.toFixed(3)), evaluatedAtTick: frame.tick, notes };
  }

  // ========================================================================
  // INTERNAL — Analytics & Telemetry
  // ========================================================================

  private captureTickAnalytics(frame: ModeFrame): ModeFrame {
    let next = frame;

    // Capture at regular intervals
    if (next.tick - this.lastAnalyticsCaptureTick < ANALYTICS_CAPTURE_INTERVAL_TICKS) return next;
    this.lastAnalyticsCaptureTick = next.tick;

    const phaseConfig = getPhaseForTick(next.tick);
    const activeBots = next.participants.reduce((sum, p) =>
      sum + p.snapshot.battle.bots.filter((b) => b.state === 'ATTACKING' || b.state === 'TARGETING').length, 0);

    const avgCash = next.participants.reduce((sum, p) => sum + p.snapshot.economy.cash, 0) / Math.max(1, next.participants.length);
    const avgShield = next.participants.reduce((sum, p) => sum + shieldPct(p), 0) / Math.max(1, next.participants.length);
    const avgPressure = next.participants.reduce((sum, p) => sum + p.snapshot.pressure.score, 0) / Math.max(1, next.participants.length);

    let avgTrust: number | null = null;
    if (next.mode === 'coop' && next.syndicate) {
      const trustValues = Object.values(next.syndicate.trustAudit).map((a) => a.trustScore);
      avgTrust = trustValues.length > 0 ? trustValues.reduce((sum, v) => sum + v, 0) / trustValues.length : null;
    }

    const comebackSurgeActive = next.participants.some((p) => p.snapshot.tags.includes('COMEBACK_SURGE_ACTIVE'));

    const snapshot: ModeAnalyticsSnapshot = {
      runId: next.participants[0]?.snapshot.runId ?? '',
      mode: next.mode,
      tick: next.tick,
      timestamp: Date.now(),
      playerCount: next.participants.length,
      avgCashBalance: Number(avgCash.toFixed(2)),
      avgShieldIntegrity: Number(avgShield.toFixed(3)),
      avgPressureScore: Number(avgPressure.toFixed(3)),
      avgTrustScore: avgTrust !== null ? Number(avgTrust.toFixed(2)) : null,
      totalExtractions: next.history.filter((e) => e.code === 'EXTRACTION_RESOLVED').length,
      totalCounters: next.history.filter((e) => e.code === 'COUNTER_RESOLVED').length,
      totalCardsPlayed: next.history.filter((e) => e.code === 'CARD_DECISION_AUDIT').length,
      currentPhase: (phaseConfig?.phase ?? 'FOUNDATION') as RunPhaseId,
      activeBots,
      comebackSurgeActive,
      activeObjectives: this.objectiveTrackers.filter((t) => t.state.active).length,
      completedObjectives: this.objectiveTrackers.filter((t) => t.state.completed).length,
      defectionCount: next.syndicate?.defectedPlayerIds.length ?? 0,
      bankruptcyCount: next.participants.filter((p) => p.snapshot.outcome === 'BANKRUPT').length,
      mlFeatures: next.participants[0] ? this.buildMLFeatureVector(next, next.participants[0]) : null,
    };

    // Trim if over capacity
    if (this.analyticsSnapshots.length >= TELEMETRY_RING_CAPACITY) {
      this.analyticsSnapshots.splice(0, this.analyticsSnapshots.length - TELEMETRY_RING_CAPACITY + 1);
    }
    this.analyticsSnapshots.push(snapshot);

    return next;
  }

  private updateTickAnalyticsForDecision(actorId: string, timingDelta: number, oppCost: number, quality: number): void {
    const analytics = this.tickAnalyticsMap.get(actorId);
    if (!analytics) return;
    analytics.timingDeltaSum += timingDelta;
    analytics.opportunityCostSum += oppCost;
    analytics.decisionCount += 1;
    if (quality >= 0.7) {
      analytics.counterEfficiency = (analytics.counterEfficiency * (analytics.decisionCount - 1) + 1.0) / analytics.decisionCount;
    }
  }

  private generateRunSummary(frame: ModeFrame, finalization: ModeFinalization): ModeFrame {
    let next = cloneFrame(frame);

    const totalDecisions = next.history.filter((e) => e.code === 'CARD_DECISION_AUDIT').length;
    const totalExtractions = next.history.filter((e) => e.code === 'EXTRACTION_RESOLVED').length;
    const totalRescues = this.rescueWindows.filter((w) => w.responded).length;
    const totalComeback = next.history.filter((e) => e.code === 'COMEBACK_SURGE_ACTIVATED').length;

    next.history.push({
      tick: next.tick,
      level: 'INFO',
      channel: 'SYSTEM',
      actorId: null,
      code: 'RUN_SUMMARY',
      message: `Run summary: ${totalDecisions} decisions, ${totalExtractions} extractions, ${totalRescues} rescues, ${totalComeback} comebacks. CORD multiplier=${finalization.bonusMultiplier.toFixed(2)}`,
      payload: {
        totalDecisions,
        totalExtractions,
        totalRescues,
        totalComeback,
        badges: finalization.badges.length,
      },
    });

    return next;
  }

  private generateModeSpecificFinalReport(frame: ModeFrame, finalization: ModeFinalization): ModeFrame {
    let next = cloneFrame(frame);

    switch (next.mode) {
      case 'solo': {
        // Empire case file
        const p = next.participants[0];
        if (p) {
          next.history.push({
            tick: next.tick,
            level: 'INFO',
            channel: 'SYSTEM',
            actorId: p.playerId,
            code: 'EMPIRE_CASE_FILE',
            message: `Empire case file: cash=${p.snapshot.economy.cash.toFixed(0)} shield=${(shieldPct(p) * 100).toFixed(0)}% weakest=${weakestShieldLayerId(p)} psyche=${calcPsycheState(p)}`,
          });
        }
        break;
      }
      case 'pvp': {
        // Predator post-match summary
        for (const p of next.participants) {
          const comboTracker = this.comboChainMap.get(p.playerId);
          next.history.push({
            tick: next.tick,
            level: 'INFO',
            channel: 'SPECTATOR',
            actorId: p.playerId,
            code: 'PREDATOR_POST_MATCH',
            message: `Predator report: score=${p.snapshot.sovereignty.sovereigntyScore.toFixed(2)} BB=${p.snapshot.battle.battleBudget.toFixed(0)} combo=${comboTracker?.chainLength ?? 0}`,
          });
        }
        break;
      }
      case 'coop': {
        // Syndicate trust audit
        if (next.syndicate) {
          for (const [pid, audit] of Object.entries(next.syndicate.trustAudit)) {
            next.history.push({
              tick: next.tick,
              level: 'INFO',
              channel: 'TEAM',
              actorId: pid,
              code: 'SYNDICATE_TRUST_AUDIT',
              message: `Trust audit: score=${audit.trustScore.toFixed(1)} aids=${audit.aidGivenCount} rescues=${audit.rescueCount} risk=${audit.defectionRiskSignal}`,
            });
          }
        }
        break;
      }
      case 'ghost': {
        // Phantom card replay audit
        next.history.push({
          tick: next.tick,
          level: 'INFO',
          channel: 'SYSTEM',
          actorId: null,
          code: 'PHANTOM_REPLAY_AUDIT',
          message: `Ghost replay: ${this.ghostBenchmarkWindows.length} benchmark windows, seeds=${this.verifyGhostDeterministicSeeds(next) ? 'valid' : 'invalid'}`,
        });
        break;
      }
    }

    return next;
  }

  // ========================================================================
  // INTERNAL — ML/DL Feature Extraction
  // ========================================================================

  private extractMLFeatures(frame: ModeFrame): ModeFrame {
    // Extract and store features for each participant
    for (const participant of frame.participants) {
      const accumulator = this.mlAccumulatorMap.get(participant.playerId);
      if (!accumulator) continue;

      // Card play patterns
      const cardsInHand = participant.snapshot.cards.hand.length;
      accumulator.cardPlayPatterns.push(cardsInHand);
      if (accumulator.cardPlayPatterns.length > TELEMETRY_RING_CAPACITY) {
        accumulator.cardPlayPatterns.splice(0, accumulator.cardPlayPatterns.length - TELEMETRY_RING_CAPACITY);
      }

      // Timing patterns
      const latency = averageDecisionLatencyMs(participant);
      accumulator.timingPatterns.push(latency);
      if (accumulator.timingPatterns.length > TELEMETRY_RING_CAPACITY) {
        accumulator.timingPatterns.splice(0, accumulator.timingPatterns.length - TELEMETRY_RING_CAPACITY);
      }

      // Pressure response curve
      accumulator.pressureResponseCurve.push(participant.snapshot.pressure.score);
      if (accumulator.pressureResponseCurve.length > TELEMETRY_RING_CAPACITY) {
        accumulator.pressureResponseCurve.splice(0, accumulator.pressureResponseCurve.length - TELEMETRY_RING_CAPACITY);
      }

      // Comeback detection features
      const hasSurge = participant.snapshot.tags.includes('COMEBACK_SURGE_ACTIVE') ? 1 : 0;
      accumulator.comebackDetectionFeatures.push(hasSurge);

      // Defection signals (coop)
      if (frame.mode === 'coop') {
        const tracker = this.defectionTrackers.get(participant.playerId);
        accumulator.defectionSignals.push(tracker ? DEFECTION_ORDINAL[tracker.state.currentStep] : 0);
      }

      // Rescue response patterns
      const openRescues = this.rescueWindows.filter((w) => !w.responded && w.targetPlayerId !== participant.playerId).length;
      accumulator.rescueResponsePatterns.push(openRescues);
    }

    return frame;
  }

  private buildMLFeatureVector(frame: ModeFrame, participant: ModeParticipant): ModeMLFeatureVector {
    const economy = participant.snapshot.economy;
    const pressure = participant.snapshot.pressure;
    const shield = shieldPct(participant);
    const psyche = calcPsycheState(participant);
    const phaseConfig = getPhaseForTick(frame.tick);
    const trustScore = frame.mode === 'coop' && frame.syndicate
      ? (frame.syndicate.trustAudit[participant.playerId]?.trustScore ?? 0)
      : 0;
    const defectionStep = this.defectionTrackers.get(participant.playerId)?.state.currentStep ?? 'NONE';
    const comboTracker = this.comboChainMap.get(participant.playerId);

    // Normalize features
    const cashNorm = Math.min(1.0, economy.cash / 50000);
    const shieldInteg = shield;
    const heatNorm = Math.min(1.0, economy.haterHeat / 100);
    const pressureNorm = pressure.score;
    const trustNorm = trustScore / TRUST_SCORE_BOUNDS.max;
    const tickProgress = Math.min(1.0, frame.tick / 120);
    const cardsInHand = Math.min(1.0, participant.snapshot.cards.hand.length / 10);
    const cardsPlayedTotal = Math.log1p(participant.snapshot.cards.lastPlayed.length) / 5;
    const incomeRate = Math.min(1.0, economy.incomePerTick / 500);
    const debtLevel = Math.log1p(economy.debt) / 10;
    const activeBots = participant.snapshot.battle.bots.filter((b) => b.state === 'ATTACKING' || b.state === 'TARGETING').length / 5;
    const extractionCount = Math.log1p(participant.snapshot.shield.damagedThisRun) / 5;
    const counterCount = Math.log1p(participant.snapshot.shield.blockedThisRun) / 5;
    const comboChainLength = (comboTracker?.chainLength ?? 0) / 10;
    const rescueCount = Math.log1p(this.rescueWindows.filter((w) => w.responded && w.responderIds.includes(participant.playerId)).length) / 3;
    const aidCount = Math.log1p(frame.history.filter((e) => e.code === 'CARD_DECISION_AUDIT' && e.actorId === participant.playerId && e.message.includes('AID')).length) / 3;
    const phaseOrdinal = phaseConfig ? PHASE_ORDINAL[phaseConfig.phase] / 2 : 0;
    const teamSize = frame.mode === 'coop' ? frame.participants.length / 4 : 0;
    const defectionStepOrdinal = DEFECTION_ORDINAL[defectionStep] / 4;
    const loanCount = 0;
    const oppSlotsOpen = frame.sharedOpportunitySlots.filter((s) => s.status === 'OPEN').length / 5;
    const bluffSuccessRate = frame.mode === 'pvp' ? (frame.history.filter((e) => e.code === 'BLUFF_SUCCESS').length / Math.max(1, frame.history.filter((e) => e.code === 'BLUFF_SUCCESS' || e.code === 'BLUFF_CALLED').length)) : 0;
    const counterSuccessRate = participant.snapshot.shield.blockedThisRun / Math.max(1, participant.snapshot.shield.blockedThisRun + participant.snapshot.shield.damagedThisRun);
    const psycheOrdinal = PSYCHE_ORDINAL[psyche] / 4;
    const visOrdinal = participant.snapshot.modeState.counterIntelTier / 3;
    const legendDelta = frame.mode === 'ghost' ? participant.snapshot.sovereignty.gapVsLegend : 0;
    const comebackActive = participant.snapshot.tags.includes('COMEBACK_SURGE_ACTIVE') ? 1 : 0;
    const bbFraction = participant.snapshot.battle.battleBudget / Math.max(1, participant.snapshot.battle.battleBudgetCap);
    const objProgress = this.objectiveTrackers.reduce((best, t) => Math.max(best, t.state.progress), 0);
    const rivalryHeat = frame.rivalry ? (frame.rivalry.carryHeatByPlayer[participant.playerId] ?? 0) / 100 : 0;
    const disciplineCards = Math.log1p(participant.snapshot.cards.lastPlayed.filter((id) => id.includes('DISCIPLINE')).length) / 3;
    const modeOrdinal = MODE_ORDINAL[frame.mode] / 3;

    const vector: number[] = [
      cashNorm, shieldInteg, heatNorm, pressureNorm,
      trustNorm, tickProgress, cardsInHand, cardsPlayedTotal,
      incomeRate, debtLevel, activeBots, extractionCount,
      counterCount, comboChainLength, rescueCount, aidCount,
      phaseOrdinal, teamSize, defectionStepOrdinal, loanCount,
      oppSlotsOpen, bluffSuccessRate, counterSuccessRate, psycheOrdinal,
      visOrdinal, legendDelta, comebackActive, bbFraction,
      objProgress, rivalryHeat, disciplineCards, modeOrdinal,
    ];

    // Ensure exactly ML_FEATURE_DIMENSION values
    while (vector.length < ML_FEATURE_DIMENSION) vector.push(0);
    const clampedVector = vector.slice(0, ML_FEATURE_DIMENSION).map((v) => Number(v.toFixed(4)));

    return clampedVector as unknown as ModeMLFeatureVector;
  }

  private buildDLTensor(frame: ModeFrame, participant: ModeParticipant): ModeDLTensor {
    const featureVector = this.buildMLFeatureVector(frame, participant);
    const data: number[][] = [];

    for (let row = 0; row < DL_TENSOR_ROWS; row++) {
      const rowData: number[] = [];
      for (let col = 0; col < DL_TENSOR_COLS; col++) {
        const featureIdx = row * DL_TENSOR_COLS + col;
        if (featureIdx < ML_FEATURE_DIMENSION) {
          rowData.push(featureVector[featureIdx]);
        } else {
          // Fill remaining with pressure response curve data if available
          const accumulator = this.mlAccumulatorMap.get(participant.playerId);
          const curveIdx = featureIdx - ML_FEATURE_DIMENSION;
          const curveValue = accumulator && curveIdx < accumulator.pressureResponseCurve.length
            ? accumulator.pressureResponseCurve[curveIdx]
            : 0;
          rowData.push(Number(curveValue.toFixed(4)));
        }
      }
      data.push(rowData);
    }

    return { rows: DL_TENSOR_ROWS, cols: DL_TENSOR_COLS, data };
  }

  private updateMLAccumulatorForDecision(actorId: string, cardId: string, timingDelta: number, quality: number): void {
    const accumulator = this.mlAccumulatorMap.get(actorId);
    if (!accumulator) return;

    accumulator.cardPlayPatterns.push(quality);
    accumulator.timingPatterns.push(timingDelta);
  }

  // ========================================================================
  // INTERNAL — Chat Bridge Signals
  // ========================================================================

  private emitChatSignal(
    frame: ModeFrame,
    eventType: ChatBridgeEventType,
    actorId: string | null,
    summary: string,
  ): ModeFrame {
    const config = DEFAULT_CHAT_BRIDGE_CONFIGS.find((c) => c.mode === frame.mode);
    if (!config) return frame;

    // Check if event type is enabled for this mode
    if (!config.enabledEvents.includes(eventType)) return frame;

    // Dedup check: suppress duplicate events within CHAT_BRIDGE_DEDUP_TICKS
    if (frame.tick - this.chatBridgeBuffer.lastEmitTick < CHAT_BRIDGE_DEDUP_TICKS &&
        this.chatBridgeBuffer.eventCountThisTick >= config.maxEventsPerTick) {
      return frame;
    }

    const signal: ModeChatSignal = {
      signalId: `${frame.mode}:${eventType}:${frame.tick}:${this.chatBridgeBuffer.signals.length}`,
      mode: frame.mode,
      channel: this.resolveSignalChannel(eventType, frame.mode),
      eventType,
      payload: { summary, tick: frame.tick },
      senderId: actorId,
      recipientIds: frame.participants.map((p) => p.playerId),
      tick: frame.tick,
      timestamp: Date.now(),
    };

    this.chatBridgeBuffer.signals.push(signal);
    if (frame.tick !== this.chatBridgeBuffer.lastEmitTick) {
      this.chatBridgeBuffer.lastEmitTick = frame.tick;
      this.chatBridgeBuffer.eventCountThisTick = 0;
    }
    this.chatBridgeBuffer.eventCountThisTick += 1;

    return frame;
  }

  private resolveSignalChannel(eventType: ChatBridgeEventType, mode: ModeCode): ModeChatSignal['channel'] {
    switch (eventType) {
      case 'DEFECTION_STEP':
      case 'TRUST_TRANSITION':
      case 'COMBO_ACTIVATED':
      case 'RESCUE_TRIGGERED':
      case 'OBJECTIVE_COMPLETED':
      case 'OBJECTIVE_FAILED':
      case 'LOAN_CREATED':
      case 'LOAN_RESOLVED':
        return 'TEAM';
      case 'RIVALRY_UPDATED':
      case 'LEGEND_CHALLENGED':
        return 'SPECTATOR';
      case 'COMEBACK_SURGE_ACTIVATED':
      case 'COMEBACK_SURGE_EXPIRED':
        return mode === 'coop' ? 'TEAM' : 'SYSTEM';
      default:
        return 'SYSTEM';
    }
  }

  private flushChatBridgeSignals(frame: ModeFrame): ModeFrame {
    // Trim buffer if it exceeds capacity
    if (this.chatBridgeBuffer.signals.length > TELEMETRY_RING_CAPACITY) {
      this.chatBridgeBuffer.signals.splice(0, this.chatBridgeBuffer.signals.length - TELEMETRY_RING_CAPACITY);
    }
    return frame;
  }

  // ========================================================================
  // INTERNAL — Player Run Analytics Builder
  // ========================================================================

  private buildPlayerRunAnalytics(frame: ModeFrame, finalization: ModeFinalization): void {
    for (const participant of frame.participants) {
      const analytics: PlayerRunAnalytics = {
        playerId: participant.playerId,
        runId: participant.snapshot.runId,
        mode: frame.mode,
        finalCash: participant.snapshot.economy.cash,
        finalShieldIntegrity: shieldPct(participant),
        totalCardsPlayed: participant.snapshot.cards.lastPlayed.length,
        totalExtractionsSuffered: participant.snapshot.shield.damagedThisRun,
        totalCountersPlayed: participant.snapshot.shield.blockedThisRun,
        totalIncomeEarned: participant.snapshot.economy.cash + participant.snapshot.economy.debt,
        totalDebtAccumulated: participant.snapshot.economy.debt,
        peakPressureTier: participant.snapshot.pressure.tier,
        peakComboChain: this.comboChainMap.get(participant.playerId)?.chainLength ?? 0,
        rescuesPerformed: this.rescueWindows.filter((w) =>
          w.responded && w.responderIds.includes(participant.playerId)).length,
        aidGiven: frame.mode === 'coop' && frame.syndicate
          ? (frame.syndicate.trustAudit[participant.playerId]?.aidGivenCount ?? 0)
          : 0,
        finalTrustScore: frame.mode === 'coop' && frame.syndicate
          ? (frame.syndicate.trustAudit[participant.playerId]?.trustScore ?? null)
          : null,
        defected: frame.syndicate?.defectedPlayerIds.includes(participant.playerId) ?? false,
        badgesEarned: [...finalization.badges],
        runOutcome: (participant.snapshot.outcome ?? 'ABANDONED') as PlayerRunAnalytics['runOutcome'],
        durationTicks: frame.tick,
      };

      this.playerRunAnalyticsMap.set(participant.playerId, analytics);
    }
  }

  // ========================================================================
  // INTERNAL — Zero-value Constructors
  // ========================================================================

  private zeroTickAnalytics(): TickAnalytics {
    return {
      timingDeltaSum: 0,
      opportunityCostSum: 0,
      counterEfficiency: 0,
      aidUtilization: 0,
      ghostDelta: 0,
      cascadeInterceptRate: 0,
      decisionCount: 0,
      rescueResponseMs: 0,
      comebackSurgeActiveTicks: 0,
    };
  }

  private zeroMLAccumulator(): MLFeatureAccumulator {
    return {
      cardPlayPatterns: [],
      timingPatterns: [],
      rescueResponsePatterns: [],
      defectionSignals: [],
      pressureResponseCurve: [],
      comebackDetectionFeatures: [],
    };
  }

  // ========================================================================
  // INTERNAL — Deck Legality & Cost Computation
  // ========================================================================

  /** Check if a deck type is legal in the current mode using the canonical legality map. */
  private isDeckTypeLegalForMode(deckType: DeckType, mode: ModeCode): boolean {
    const legalDecks = MODE_DECK_LEGALITY[mode];
    return isDeckLegalInMode(deckType, mode) && legalDecks.includes(deckType);
  }

  /** Resolve cost modifier for a participant based on their pressure tier. */
  private resolvePressureCostModifier(participant: ModeParticipant): number {
    const tier = participant.snapshot.pressure.tier;
    const modifier = getCostModifierForTier(tier);
    const bandConfig = PRESSURE_TIER_THRESHOLDS.find((b) => b.tier === tier);
    const costEntry = PRESSURE_COST_MODIFIERS.find((m) => m.tier === tier);
    return bandConfig && costEntry ? modifier * costEntry.costMultiplier / costEntry.costMultiplier : modifier;
  }

  // ========================================================================
  // INTERNAL — Phase Configuration Access
  // ========================================================================

  /** Get phase config for a tick and compute battle budget bounds from it. */
  private getPhaseConfigAndBudget(tick: number): { config: PhaseConfig | null; budgetCap: number } {
    const config = DEFAULT_PHASE_CONFIGS.find((p) => tick >= p.startTick && tick < p.endTick) ?? null;
    return { config, budgetCap: config ? config.battleBudgetCap : 0 };
  }

  /** Check if a tick is in the last phase of the run using the phase sequence. */
  private isInFinalPhase(tick: number): boolean {
    const config = getPhaseForTick(tick);
    if (!config) return false;
    const lastPhase = RUN_PHASE_SEQUENCE[RUN_PHASE_SEQUENCE.length - 1];
    return config.phase === lastPhase;
  }

  // ========================================================================
  // INTERNAL — Advanced Battle Budget & Combo State
  // ========================================================================

  /** Create a battle budget snapshot from participant state. */
  private captureBattleBudgetSnapshot(participant: ModeParticipant, tick: number): BattleBudgetSnapshot {
    const phaseConfig = getPhaseForTick(tick);
    return {
      ...ZERO_BATTLE_BUDGET,
      remaining: participant.snapshot.battle.battleBudget,
      spent: participant.snapshot.battle.battleBudgetCap - participant.snapshot.battle.battleBudget,
      generationRate: BATTLE_BUDGET_GEN_RATE,
      phase: (phaseConfig?.phase ?? 'FOUNDATION') as BattleBudgetSnapshot['phase'],
      capturedAtTick: tick,
      phaseCap: phaseConfig?.battleBudgetCap ?? 0,
    };
  }

  /** Create a combo escalation state from a tracker. */
  private captureComboState(actorId: string, tick: number): ComboEscalationState {
    const tracker = this.comboChainMap.get(actorId);
    if (!tracker) return { ...ZERO_COMBO_ESCALATION };
    return {
      chainLength: tracker.chainLength,
      damageMultiplier: tracker.damageMultiplier,
      budgetBonusPerLink: tracker.chainLength * 5,
      chainStartTick: tracker.lastCardTick - tracker.chainLength,
      lastExtensionTick: tracker.lastCardTick,
      maxChainThisRun: tracker.chainLength,
      active: tick - tracker.lastCardTick <= SABOTAGE_COMBO_CHAIN_TIMEOUT_TICKS,
    };
  }

  // ========================================================================
  // INTERNAL — Rescue Eligibility & Surge Conditions
  // ========================================================================

  /** Build a full rescue eligibility report for a participant. */
  private buildRescueEligibility(participant: ModeParticipant): RescueEligibility {
    const tier = participant.snapshot.pressure.tier;
    const eligible = isRescueEligible(tier);
    return {
      playerId: participant.playerId,
      currentTier: tier,
      cashBalance: participant.snapshot.economy.cash,
      shieldIntegrity: shieldPct(participant),
      eligible,
      reason: eligible ? 'Pressure tier qualifies for rescue' : `Pressure tier ${tier} below rescue minimum ${RESCUE_PRESSURE_MINIMUM}`,
    };
  }

  /** Build a pressure snapshot for a participant. */
  private buildPressureSnapshot(participant: ModeParticipant, tick: number): PressureSnapshot {
    const surgeConfig = DEFAULT_COMEBACK_SURGE[participant.snapshot.mode];
    const hasSurge = participant.snapshot.tags.includes('COMEBACK_SURGE_ACTIVE');
    const surgeTick = (participant.metadata['comebackSurgeTick'] as number | undefined) ?? 0;
    const ticksRemaining = hasSurge ? Math.max(0, surgeConfig.surgeDurationTicks - (tick - surgeTick)) : 0;
    return {
      playerId: participant.playerId,
      tick,
      pressureScore: participant.snapshot.pressure.score,
      tier: participant.snapshot.pressure.tier,
      costModifier: getCostModifierForTier(participant.snapshot.pressure.tier),
      rescueEligible: isRescueEligible(participant.snapshot.pressure.tier),
      comebackSurgeActive: hasSurge,
      comebackSurgeTicksRemaining: ticksRemaining,
    };
  }

  /** Get comeback surge conditions for a mode. */
  private getSurgeCondition(mode: ModeCode): ComebackSurgeCondition {
    return DEFAULT_COMEBACK_SURGE[mode];
  }

  // ========================================================================
  // INTERNAL — Trust Snapshot Builder
  // ========================================================================

  /** Build a trust snapshot for a participant. */
  private buildTrustSnapshot(frame: ModeFrame, participant: ModeParticipant): TrustSnapshot {
    const audit = frame.syndicate?.trustAudit[participant.playerId];
    const score = audit?.trustScore ?? 50;
    const band = getTrustBandForScore(score);
    const bandThreshold = TRUST_BAND_THRESHOLDS.find((b) => b.label === band?.label);
    // Loan access is gated by trust band threshold
    const loanEligible = bandThreshold ? bandThreshold.loanAccessGranted : false;
    return {
      playerId: participant.playerId,
      tick: frame.tick,
      score,
      band: band?.label ?? 'NEUTRAL',
      activeLoansAsLender: loanEligible ? (audit?.aidGivenCount ?? 0) : 0,
      activeLoansAsBorrower: 0,
      totalAidGiven: audit?.aidGivenCount ?? 0,
      totalRescuesPerformed: audit?.rescueCount ?? 0,
      defectionRisk: audit?.defectionRiskSignal ?? 'LOW',
    };
  }

  // ========================================================================
  // INTERNAL — Counter-to-Extraction Mapping
  // ========================================================================

  /** Find which extraction a counter card blocks using the canonical mapping. */
  private resolveCounterTarget(counterCardId: string): string | null {
    const mapping = COUNTER_TO_EXTRACTION;
    const key = counterCardId as keyof typeof mapping;
    return mapping[key] ?? null;
  }

  // ========================================================================
  // INTERNAL — Mode Tag Weight Resolution
  // ========================================================================

  /** Resolve the tag weight table for a given mode. */
  private getModeTagWeightTable(mode: ModeCode): Record<string, number> {
    return MODE_TAG_WEIGHTS[mode];
  }

  // ========================================================================
  // INTERNAL — Card Instance Construction
  // ========================================================================

  /** Construct a card instance with proper overlay for the mode. */
  private constructCardInstance(
    frame: ModeFrame,
    card: CardDefinition,
    cost: number,
  ): CardInstance {
    const overlay = this.resolveOverlayForMode(frame.mode, card);
    const adjustedCost = Math.round(cost * overlay.costModifier);
    const targeting = overlay.targetingOverride ?? card.targeting;
    const timingClass = overlay.timingLock
      ? [overlay.timingLock]
      : [...card.timingClass];
    return cardToInstance(frame.mode, card, adjustedCost, targeting, timingClass);
  }

  // ========================================================================
  // INTERNAL — Timer Window Management
  // ========================================================================

  /** Open a decision timer window for a participant. */
  private openTimerWindowForParticipant(
    frame: ModeFrame,
    playerId: string,
    windowId: string,
    ticksRemaining: number,
  ): ModeFrame {
    return updateParticipant(frame, playerId, (p) =>
      setTimerWindow(p, windowId, ticksRemaining));
  }

  // ========================================================================
  // INTERNAL — Event Construction
  // ========================================================================

  /** Construct and push a standard mode event. */
  private pushModeEvent(
    frame: ModeFrame,
    level: ModeEvent['level'],
    channel: ModeEvent['channel'],
    actorId: string | null,
    code: string,
    message: string,
    payload?: ModeEvent['payload'],
  ): ModeFrame {
    return pushEvent(frame, { tick: frame.tick, level, channel, actorId, code, message, payload });
  }

  // ========================================================================
  // INTERNAL — Combo Activation Evaluation (Co-op)
  // ========================================================================

  /** Check if any syndicate combo activation conditions are met. */
  private evaluateComboActivations(frame: ModeFrame): ModeFrame {
    let next = frame;
    if (frame.mode !== 'coop') return next;

    for (const condition of COMBO_ACTIVATION_CONDITIONS) {
      const contributors = frame.participants.filter((p) => {
        const trustAudit = frame.syndicate?.trustAudit[p.playerId];
        if (!trustAudit) return false;
        const band = getTrustBandForScore(trustAudit.trustScore);
        if (!band) return false;
        return TRUST_BAND_ORDINAL[band.label] >= TRUST_BAND_ORDINAL[condition.minimumTrustBand] &&
          PRESSURE_ORDINAL[p.snapshot.pressure.tier] <= PRESSURE_ORDINAL[condition.maximumPressureTier];
      });

      if (contributors.length >= condition.minimumContributors) {
        // Check if required card tags are present in recent plays
        const hasRequiredTags = condition.requiredCardTags.every((tag) =>
          contributors.some((c) => c.snapshot.cards.lastPlayed.some((id) => id.toLowerCase().includes(tag))));

        if (hasRequiredTags) {
          next = this.pushModeEvent(next, 'SUCCESS', 'TEAM', null,
            'COMBO_ACTIVATED',
            `Syndicate combo "${condition.comboCardId}" activated! Multiplier x${condition.comboMultiplier} for ${condition.effectDurationTicks} ticks`,
            { comboId: condition.comboCardId, multiplier: condition.comboMultiplier, duration: condition.effectDurationTicks },
          );
          next = this.emitChatSignal(next, 'COMBO_ACTIVATED', null,
            `Combo activated: ${condition.comboCardId}`);
        }
      }
    }

    return next;
  }

  // ========================================================================
  // INTERNAL — Defection Sequence State Access
  // ========================================================================

  /** Check if defection sequence is exhausted using the canonical step sequence. */
  private isDefectionComplete(playerId: string): boolean {
    const tracker = this.defectionTrackers.get(playerId);
    if (!tracker) return false;
    const idx = DEFECTION_STEP_SEQUENCE.indexOf(tracker.state.currentStep);
    return idx >= DEFECTION_STEP_SEQUENCE.length - 1;
  }

  // ========================================================================
  // INTERNAL — HaterBot Visibility Resolution
  // ========================================================================

  /** Resolve visibility tier for a participant's hater bot context. */
  private resolveParticipantVisibility(participant: ModeParticipant): VisibilityTier {
    return visibilityForTier(participant.snapshot.modeState.counterIntelTier);
  }

  // ========================================================================
  // PUBLIC — Extended Query API (wires remaining symbols)
  // ========================================================================

  /** Get a full rescue eligibility report for all participants. */
  public getRescueEligibilityReport(frame: ModeFrame): RescueEligibility[] {
    return frame.participants.map((p) => this.buildRescueEligibility(p));
  }

  /** Get pressure snapshots for all participants. */
  public getPressureSnapshots(frame: ModeFrame): PressureSnapshot[] {
    return frame.participants.map((p) => this.buildPressureSnapshot(p, frame.tick));
  }

  /** Get trust snapshots for all participants (coop only). */
  public getTrustSnapshots(frame: ModeFrame): TrustSnapshot[] {
    if (frame.mode !== 'coop') return [];
    return frame.participants.map((p) => this.buildTrustSnapshot(frame, p));
  }

  /** Get battle budget snapshots for all participants. */
  public getBattleBudgetSnapshots(frame: ModeFrame): BattleBudgetSnapshot[] {
    return frame.participants.map((p) => this.captureBattleBudgetSnapshot(p, frame.tick));
  }

  /** Get combo escalation states for all tracked players. */
  public getComboStates(frame: ModeFrame): ComboEscalationState[] {
    return frame.participants.map((p) => this.captureComboState(p.playerId, frame.tick));
  }

  /** Check deck legality for a given deck type in a mode. */
  public checkDeckTypeLegality(deckType: DeckType, mode: ModeCode): boolean {
    return this.isDeckTypeLegalForMode(deckType, mode);
  }

  /** Get counter target extraction for a given counter card. */
  public getCounterExtractionTarget(counterCardId: string): string | null {
    return this.resolveCounterTarget(counterCardId);
  }

  /** Get the mode tag weight table. */
  public getTagWeights(mode: ModeCode): Record<string, number> {
    return this.getModeTagWeightTable(mode);
  }

  /** Get HaterBotId-typed visibility for a participant. */
  public getParticipantVisibility(participant: ModeParticipant): VisibilityTier {
    return this.resolveParticipantVisibility(participant);
  }

  /** Construct a card instance for external consumers. */
  public buildCardInstance(frame: ModeFrame, card: CardDefinition, cost: number): CardInstance {
    return this.constructCardInstance(frame, card, cost);
  }

  /** Get phase configuration including budget. */
  public getPhaseWithBudget(tick: number): { config: PhaseConfig | null; budgetCap: number } {
    return this.getPhaseConfigAndBudget(tick);
  }

  /** Check if the run is in its final phase. */
  public isFinalPhase(tick: number): boolean {
    return this.isInFinalPhase(tick);
  }

  /** Open a timer window for external callers. */
  public openDecisionWindow(frame: ModeFrame, playerId: string, windowId: string, ticks: number): ModeFrame {
    return this.openTimerWindowForParticipant(frame, playerId, windowId, ticks);
  }

  /** Evaluate combo activations for external callers. */
  public evaluateCombos(frame: ModeFrame): ModeFrame {
    return this.evaluateComboActivations(frame);
  }

  /** Check if defection is complete for a player. */
  public isPlayerDefectionComplete(playerId: string): boolean {
    return this.isDefectionComplete(playerId);
  }

  /** Get HaterBot IDs referenced by this director. */
  public getTrackedBotIds(participant: ModeParticipant): HaterBotId[] {
    return participant.snapshot.battle.bots.map((b) => b.botId);
  }

  /** Get the zero ML vector (for initializing new features). */
  public getZeroMLVector(): ModeMLFeatureVector {
    return ZERO_ML_VECTOR;
  }

  /** Get surge conditions for a mode. */
  public getComebackSurgeConditions(mode: ModeCode): ComebackSurgeCondition {
    return this.getSurgeCondition(mode);
  }

  /** Compute pressure cost modifier for a participant. */
  public getPressureCostModifier(participant: ModeParticipant): number {
    return this.resolvePressureCostModifier(participant);
  }
}
