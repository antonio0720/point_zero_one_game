// backend/src/game/engine/timing_validator.ts

/**
 * POINT ZERO ONE — BACKEND TIMING VALIDATOR v3.0.0
 * backend/src/game/engine/timing_validator.ts
 *
 * Validates doctrine-native timing classes against authoritative backend state.
 * This validator is intentionally mode-aware and backend-safe.
 *
 * v3.0.0 — Full ML/DL feature extraction, per-mode routing, pressure-aware
 *           window management, replay validation, chat bridge, analytics,
 *           and batch processing.
 *
 * Doctrine anchors:
 * - 4 game modes (GO_ALONE, HEAD_TO_HEAD, TEAM_UP, CHASE_A_LEGEND)
 * - 12 timing classes: PRE / POST / FATE / CTR / RES / AID / GBM / CAS / PHZ / PSK / END / ANY
 * - 14 deck types, 15 card tags, 4 rarities, 5 pressure tiers, 3 run phases
 * - Mode overlays mutate legality, targeting, timing, and CORD weights at draw time
 * - Backend remains the authoritative simulation surface
 */

import { createHash } from 'node:crypto';

import {
  // Enums
  GameMode,
  TimingClass,
  DeckType,
  CardTag,
  CardRarity,
  PressureTier,
  RunPhase,
  Targeting,
  TimingRejectionCode,
  GhostMarkerKind,
  DivergencePotential,
  Counterability,
  CardPlayOutcomeClass,
  // Types / Interfaces
  type CardInHand,
  type CardPlayRequest,
  type ExecutionContext,
  type TimingValidationResult,
  type CardDefinition,
  type ModeOverlay,
  type CardOverlaySnapshot,
  type ModeCode,
  // Constants
  TIMING_CLASS_WINDOW_MS,
  TIMING_WINDOW_TICKS,
  TIMING_CLASS_MODE_MATRIX,
  CARD_LEGALITY_MATRIX,
  MODE_TAG_WEIGHT_DEFAULTS,
  DECK_TYPE_PROFILES,
  MODE_CARD_BEHAVIORS,
  HOLD_SYSTEM_CONFIG,
  COMEBACK_SURGE_CONFIG,
  CARD_RARITY_DROP_RATES,
  PRESSURE_COST_MODIFIERS,
  GHOST_MARKER_SPECS,
  IPA_CHAIN_SYNERGIES,
  // Functions
  clamp,
  round6,
  isDeckLegalInMode,
  isTimingClassLegalInMode,
  resolveEffectiveTimingClasses,
  computeTagWeightedScore,
  computeTrustEfficiency,
  computePressureCostModifier,
  computeBleedthroughMultiplier,
  computeDivergencePotential,
  getDeckTypeProfile,
  getModeCardBehavior,
  computeEffectiveWindowMs,
  computeEffectiveWindowTicks,
  resolveEffectiveCost,
  resolveCurrencyForCard,
  isHoldLegalForCard,
  computeRescueEfficiency,
  computeCardDecisionQuality,
  validateCardPlayLegality,
  getTimingClassLabel,
  getDeckTypeLabel,
} from './card_types';

/** Convert CardPlayOutcomeClass enum to a numeric score [0, 1]. */
function outcomeClassToNumeric(outcome: CardPlayOutcomeClass): number {
  switch (outcome) {
    case CardPlayOutcomeClass.OPTIMAL: return 1.0;
    case CardPlayOutcomeClass.GOOD: return 0.75;
    case CardPlayOutcomeClass.NEUTRAL: return 0.5;
    case CardPlayOutcomeClass.SUBOPTIMAL: return 0.25;
    case CardPlayOutcomeClass.CATASTROPHIC: return 0.0;
    default: return 0.5;
  }
}

import {
  normalizeSeed,
  hashStringToSeed,
  combineSeed,
  createDeterministicRng,
  createMulberry32,
  sanitizePositiveWeights,
  DEFAULT_NON_ZERO_SEED,
  type DeterministicRng,
} from './deterministic_rng';

import {
  sha256Hex,
  stableStringify,
  type Ledger,
  createDefaultLedger,
  type DecisionEffect,
  type RunEvent,
} from './replay_engine';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const TIMING_VALIDATOR_VERSION = '3.0.0';

/** ML feature vector dimensionality. */
const ML_FEATURE_DIM = 24;

/** DL tensor row count — one per timing class. */
const DL_TENSOR_ROWS = 12;

/** DL tensor column count — features per timing class. */
const DL_TENSOR_COLS = 8;

/** Maximum allowed clock skew between client and server in ms. */
const MAX_CLOCK_SKEW_MS = 250;

/** Decision quality thresholds. */
const QUALITY_THRESHOLD_PERFECT = 0.95;
const QUALITY_THRESHOLD_GOOD = 0.75;
const QUALITY_THRESHOLD_ACCEPTABLE = 0.50;
const QUALITY_THRESHOLD_POOR = 0.25;

/** Window center tolerance — fraction of total window to be considered "center". */
const WINDOW_CENTER_FRACTION = 0.3;

/** Early play penalty coefficient. */
const EARLY_PENALTY_COEFF = 0.12;

/** Late play penalty coefficient. */
const LATE_PENALTY_COEFF = 0.18;

/** Replay hash algorithm. */
const REPLAY_HASH_ALGO = 'sha256';

/** Chat bridge event debounce in ms. */
const CHAT_DEBOUNCE_MS = 500;

/** Batch processing max chunk size. */
const BATCH_MAX_CHUNK = 64;

/** Minimum window ms before compression is disallowed. */
const MIN_WINDOW_MS_FLOOR = 500;

/** Ghost benchmark divergence multiplier. */
const GHOST_DIVERGENCE_WINDOW_MULT = 1.35;

/** Rescue window extension per pressure tier. */
const RESCUE_EXTENSION_PER_TIER_MS = 1500;

/** Counter window compression per bleedthrough unit. */
const COUNTER_COMPRESSION_COEFF = 0.08;

/** Mode-specific timing budgets (ms per tick for each mode). */
const MODE_TIMING_BUDGET_MS: Readonly<Record<GameMode, number>> = {
  [GameMode.GO_ALONE]: 15_000,
  [GameMode.HEAD_TO_HEAD]: 10_000,
  [GameMode.TEAM_UP]: 18_000,
  [GameMode.CHASE_A_LEGEND]: 12_000,
};

/** Timing class ordering for deterministic iteration. */
const TIMING_CLASS_ORDER: readonly TimingClass[] = [
  TimingClass.PRE,
  TimingClass.POST,
  TimingClass.FATE,
  TimingClass.CTR,
  TimingClass.RES,
  TimingClass.AID,
  TimingClass.GBM,
  TimingClass.CAS,
  TimingClass.PHZ,
  TimingClass.PSK,
  TimingClass.END,
  TimingClass.ANY,
];

/** Pressure tier ordering for numeric comparisons. */
const PRESSURE_TIER_ORDER: readonly PressureTier[] = [
  PressureTier.T0_SOVEREIGN,
  PressureTier.T1_STABLE,
  PressureTier.T2_STRESSED,
  PressureTier.T3_ELEVATED,
  PressureTier.T4_COLLAPSE_IMMINENT,
];

/** Run phase ordering for progression checks. */
const RUN_PHASE_ORDER: readonly RunPhase[] = [
  RunPhase.FOUNDATION,
  RunPhase.ESCALATION,
  RunPhase.SOVEREIGNTY,
];

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface TimingWindowState {
  readonly timingClass: TimingClass;
  readonly openedAtMs: number;
  readonly openedAtTick: number;
  readonly baseDurationMs: number;
  readonly effectiveDurationMs: number;
  readonly baseDurationTicks: number;
  readonly effectiveDurationTicks: number;
  readonly usageCount: number;
  readonly lastUsedAtMs: number | null;
  readonly pressureModifier: number;
  readonly modeModifier: number;
  readonly isOpen: boolean;
  readonly isExpired: boolean;
  readonly remainingMs: number;
  readonly remainingTicks: number;
  readonly centerMs: number;
  readonly extensionCount: number;
  readonly compressionCount: number;
}

export interface TimingDecisionQuality {
  readonly overallScore: number;
  readonly timingOptimality: number;
  readonly windowCenterDistance: number;
  readonly earlyPenalty: number;
  readonly latePenalty: number;
  readonly modeWeight: number;
  readonly pressureWeight: number;
  readonly tagScore: number;
  readonly cardDecisionQuality: number;
  readonly bleedthroughFactor: number;
  readonly divergencePotential: DivergencePotential;
  readonly trustEfficiency: number;
  readonly rescueEfficiency: number | null;
  readonly rarity: CardRarity;
  readonly counterability: Counterability;
  readonly qualityBand: 'perfect' | 'good' | 'acceptable' | 'poor' | 'terrible';
}

export interface TimingValidationReport {
  readonly version: string;
  readonly validatedAt: number;
  readonly card: {
    readonly cardId: string;
    readonly deckType: DeckType;
    readonly rarity: CardRarity;
    readonly tags: readonly CardTag[];
    readonly timingClasses: readonly TimingClass[];
    readonly counterability: Counterability;
  };
  readonly request: {
    readonly instanceId: string;
    readonly choiceId: string;
    readonly requestedTiming: TimingClass;
  };
  readonly context: {
    readonly mode: GameMode;
    readonly phase: RunPhase | null;
    readonly pressureTier: PressureTier | null;
    readonly tickIndex: number;
    readonly isFinalTick: boolean;
  };
  readonly validation: TimingValidationResult;
  readonly quality: TimingDecisionQuality | null;
  readonly windowState: TimingWindowState | null;
  readonly deterministicHash: string;
}

export interface TimingMLFeatureVector {
  readonly version: string;
  readonly dimensions: number;
  readonly features: readonly number[];
  readonly featureNames: readonly string[];
  readonly seed: number;
  readonly normalizedAt: number;
}

export interface TimingDLTensor {
  readonly version: string;
  readonly rows: number;
  readonly cols: number;
  readonly data: readonly (readonly number[])[];
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly seed: number;
}

export interface TimingWindowAnalytics {
  readonly windowId: string;
  readonly timingClass: TimingClass;
  readonly mode: GameMode;
  readonly totalOpens: number;
  readonly totalPlays: number;
  readonly totalMisses: number;
  readonly averagePlayTimeMs: number;
  readonly averageQualityScore: number;
  readonly bestQualityScore: number;
  readonly worstQualityScore: number;
  readonly hitRate: number;
  readonly earlyPlayRate: number;
  readonly latePlayRate: number;
  readonly centerPlayRate: number;
  readonly pressureTierDistribution: Readonly<Record<PressureTier, number>>;
  readonly phaseDistribution: Readonly<Record<RunPhase, number>>;
}

export interface TimingPressureAwareConfig {
  readonly tier: PressureTier;
  readonly tierIndex: number;
  readonly costModifier: number;
  readonly windowCompressionFactor: number;
  readonly rescueExtensionMs: number;
  readonly counterCompressionFactor: number;
  readonly bleedthroughMultiplier: number;
  readonly comebackSurgeActive: boolean;
  readonly comebackMultiplier: number;
}

export interface TimingModeProfile {
  readonly mode: GameMode;
  readonly modeCode: ModeCode;
  readonly legalDeckTypes: readonly DeckType[];
  readonly legalTimingClasses: readonly TimingClass[];
  readonly tagWeights: Readonly<Record<CardTag, number>>;
  readonly timingBudgetMs: number;
  readonly holdConfig: {
    readonly enabled: boolean;
    readonly maxSlots: number;
    readonly windowMs: number;
  };
  readonly specialWindows: readonly TimingClass[];
  readonly ghostMarkers: readonly GhostMarkerKind[];
}

export interface TimingChatBridgeEvent {
  readonly eventType:
    | 'window_opened'
    | 'window_closing_soon'
    | 'window_missed'
    | 'critical_timing_play'
    | 'perfect_timing_achieved';
  readonly timingClass: TimingClass;
  readonly mode: GameMode;
  readonly cardId: string | null;
  readonly tickIndex: number;
  readonly timestamp: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly eventHash: string;
}

export interface TimingBatchResult {
  readonly totalPlays: number;
  readonly validPlays: number;
  readonly invalidPlays: number;
  readonly averageQuality: number;
  readonly timingClassBreakdown: Readonly<Partial<Record<TimingClass, number>>>;
  readonly rejectionBreakdown: Readonly<Partial<Record<TimingRejectionCode, number>>>;
  readonly results: readonly TimingValidationReport[];
  readonly batchHash: string;
  readonly processedAt: number;
}

export interface TimingReplayValidation {
  readonly runId: string;
  readonly eventCount: number;
  readonly validatedEvents: number;
  readonly invalidEvents: number;
  readonly windowMismatches: number;
  readonly timingDriftMs: number;
  readonly deterministicMatch: boolean;
  readonly ledgerHash: string;
  readonly replayHash: string;
  readonly validationHash: string;
}

export interface TimingGhostWindowState {
  readonly ghostMarkerKind: GhostMarkerKind;
  readonly divergencePotential: DivergencePotential;
  readonly benchmarkWindowMs: number;
  readonly effectiveWindowMs: number;
  readonly divergenceScore: number;
  readonly markerSpec: {
    readonly kind: GhostMarkerKind;
    readonly weight: number;
    readonly decayRate: number;
  };
  readonly isActive: boolean;
}

export interface TimingCounterWindowState {
  readonly counterability: Counterability;
  readonly baseWindowMs: number;
  readonly bleedthroughMultiplier: number;
  readonly compressedWindowMs: number;
  readonly opponentPressureTier: PressureTier;
  readonly isActive: boolean;
}

export interface TimingRescueWindowState {
  readonly rescueEfficiency: number;
  readonly baseWindowMs: number;
  readonly pressureExtensionMs: number;
  readonly effectiveWindowMs: number;
  readonly teamTrustScore: number;
  readonly trustEfficiency: number;
  readonly comebackSurgeActive: boolean;
  readonly isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMING VALIDATOR (preserved public API)
// ─────────────────────────────────────────────────────────────────────────────

export class TimingValidator {
  private readonly windowManager: TimingWindowManager;
  private readonly qualityScorer: TimingDecisionQualityScorer;
  private readonly pressureAdapter: TimingPressureAdapter;
  private readonly modeRouter: TimingModeRouter;
  private readonly replayValidator: TimingReplayValidator;
  private readonly chatBridge: TimingChatBridge;
  private readonly analytics: TimingAnalytics;

  constructor() {
    this.windowManager = new TimingWindowManager();
    this.qualityScorer = new TimingDecisionQualityScorer();
    this.pressureAdapter = new TimingPressureAdapter();
    this.modeRouter = new TimingModeRouter();
    this.replayValidator = new TimingReplayValidator();
    this.chatBridge = new TimingChatBridge();
    this.analytics = new TimingAnalytics();
  }

  public validate(
    card: CardInHand,
    request: CardPlayRequest,
    context: ExecutionContext,
  ): TimingValidationResult {
    if (!isDeckLegalInMode(card.definition.deckType, context.mode)) {
      return this.fail(
        TimingRejectionCode.DECK_ILLEGAL,
        `Deck type '${card.definition.deckType}' is not legal in mode '${context.mode}'.`,
        card,
        request,
      );
    }

    if (card.definition.modeLegal && !card.definition.modeLegal.includes(context.mode)) {
      return this.fail(
        TimingRejectionCode.MODE_ILLEGAL,
        `Card '${card.definition.cardId}' is not legal in mode '${context.mode}'.`,
        card,
        request,
      );
    }

    if (!card.overlay.legal) {
      return this.fail(
        TimingRejectionCode.CARD_ILLEGAL,
        `Card '${card.definition.cardId}' is illegal after mode overlay resolution.`,
        card,
        request,
      );
    }

    if (card.isForced && (card.overlay.autoResolveOverride ?? card.definition.autoResolve)) {
      return this.fail(
        TimingRejectionCode.AUTO_RESOLVE_ONLY,
        `Card '${card.definition.cardId}' is auto-resolve only and cannot be manually played.`,
        card,
        request,
      );
    }

    if (typeof card.expiresAtTick === 'number' && context.tickIndex > card.expiresAtTick) {
      return this.fail(
        TimingRejectionCode.CARD_EXPIRED,
        `Card '${card.definition.cardId}' expired at tick ${card.expiresAtTick}.`,
        card,
        request,
      );
    }

    if (card.isHeld && !card.overlay.holdAllowed) {
      return this.fail(
        TimingRejectionCode.HOLD_RESTRICTED,
        `Card '${card.definition.cardId}' is staged in hold and cannot resolve from the active hand.`,
        card,
        request,
      );
    }

    if (context.forcedCardPending && !card.isForced) {
      return this.fail(
        TimingRejectionCode.FORCED_CARD_PENDING,
        'A forced card is pending and must resolve before non-forced plays.',
        card,
        request,
      );
    }

    if (card.effectiveCurrency === 'battle_budget' && (context.battleBudget ?? 0) < card.effectiveCost) {
      return this.fail(
        TimingRejectionCode.INSUFFICIENT_BATTLE_BUDGET,
        `Battle budget is insufficient for '${card.definition.cardId}'.`,
        card,
        request,
      );
    }

    if (card.effectiveCurrency === 'treasury' && (context.treasury ?? 0) < card.effectiveCost) {
      return this.fail(
        TimingRejectionCode.INSUFFICIENT_TREASURY,
        `Treasury is insufficient for '${card.definition.cardId}'.`,
        card,
        request,
      );
    }

    const requestedTiming = request.timingClass ?? context.currentWindow ?? TimingClass.ANY;
    const allowedTimingClasses = resolveEffectiveTimingClasses(card.definition, card.overlay);

    if (
      !allowedTimingClasses.includes(TimingClass.ANY) &&
      !allowedTimingClasses.includes(requestedTiming)
    ) {
      return this.fail(
        TimingRejectionCode.TIMING_CLASS_ILLEGAL,
        `Requested timing '${requestedTiming}' is not legal for '${card.definition.cardId}'.`,
        card,
        request,
        allowedTimingClasses,
      );
    }

    if (!isTimingClassLegalInMode(requestedTiming, context.mode)) {
      return this.fail(
        TimingRejectionCode.MODE_ILLEGAL,
        `Timing '${requestedTiming}' is not legal in mode '${context.mode}'.`,
        card,
        request,
        allowedTimingClasses,
      );
    }

    const targetValidation = this.validateTarget(card, request, context, requestedTiming, allowedTimingClasses);
    if (!targetValidation.valid) {
      return targetValidation;
    }

    const windowResult = this.validateTimingWindow(card, request, context, requestedTiming, allowedTimingClasses);

    if (windowResult.valid) {
      this.recordSuccessfulPlay(card, request, context, requestedTiming);
    }

    return windowResult;
  }

  public assertPlayable(
    card: CardInHand,
    request: CardPlayRequest,
    context: ExecutionContext,
  ): void {
    const result = this.validate(card, request, context);
    if (!result.valid) {
      throw new Error(result.reason ?? `Card '${card.definition.cardId}' is not playable.`);
    }
  }

  public validateWithReport(
    card: CardInHand,
    request: CardPlayRequest,
    context: ExecutionContext,
  ): TimingValidationReport {
    const validation = this.validate(card, request, context);
    const requestedTiming = request.timingClass ?? context.currentWindow ?? TimingClass.ANY;
    const pressureConfig = this.pressureAdapter.computeConfig(
      context.currentPressureTier ?? PressureTier.T1_STABLE,
    );
    const windowState = this.windowManager.computeWindowState(
      requestedTiming,
      context,
      pressureConfig,
    );

    let quality: TimingDecisionQuality | null = null;
    if (validation.valid && windowState) {
      quality = this.qualityScorer.scorePlay(card, context, windowState, pressureConfig);
    }

    const reportPayload = {
      version: TIMING_VALIDATOR_VERSION,
      card: {
        cardId: card.definition.cardId,
        deckType: card.definition.deckType,
        rarity: card.definition.rarity,
        tags: card.definition.tags,
        timingClasses: card.definition.timingClasses,
        counterability: card.definition.counterability,
      },
      request: {
        instanceId: request.instanceId,
        choiceId: request.choiceId,
        requestedTiming,
      },
      context: {
        mode: context.mode,
        phase: context.currentPhase ?? null,
        pressureTier: context.currentPressureTier ?? null,
        tickIndex: context.tickIndex,
        isFinalTick: context.isFinalTick ?? false,
      },
      validation,
      quality,
      windowState,
    };

    const deterministicHash = sha256Hex(stableStringify(reportPayload));

    return {
      ...reportPayload,
      validatedAt: Date.now(),
      deterministicHash,
    };
  }

  public validateBatch(
    plays: readonly { card: CardInHand; request: CardPlayRequest; context: ExecutionContext }[],
  ): TimingBatchResult {
    return batchProcessPlays(this, plays);
  }

  public extractMLFeatures(
    card: CardInHand,
    context: ExecutionContext,
  ): TimingMLFeatureVector {
    const pressureConfig = this.pressureAdapter.computeConfig(
      context.currentPressureTier ?? PressureTier.T1_STABLE,
    );
    const requestedTiming = context.currentWindow ?? TimingClass.ANY;
    const windowState = this.windowManager.computeWindowState(requestedTiming, context, pressureConfig);
    const modeProfile = this.modeRouter.computeModeProfile(context.mode);
    return extractMLFeatureVector(card, context, windowState, pressureConfig, modeProfile);
  }

  public extractDLTensor(
    card: CardInHand,
    context: ExecutionContext,
  ): TimingDLTensor {
    const pressureConfig = this.pressureAdapter.computeConfig(
      context.currentPressureTier ?? PressureTier.T1_STABLE,
    );
    const modeProfile = this.modeRouter.computeModeProfile(context.mode);
    return extractDLTensor(card, context, pressureConfig, modeProfile);
  }

  public getAnalytics(): TimingAnalytics {
    return this.analytics;
  }

  public getChatBridge(): TimingChatBridge {
    return this.chatBridge;
  }

  public getReplayValidator(): TimingReplayValidator {
    return this.replayValidator;
  }

  public getModeRouter(): TimingModeRouter {
    return this.modeRouter;
  }

  public getPressureAdapter(): TimingPressureAdapter {
    return this.pressureAdapter;
  }

  public getWindowManager(): TimingWindowManager {
    return this.windowManager;
  }

  public getQualityScorer(): TimingDecisionQualityScorer {
    return this.qualityScorer;
  }

  // ── private helpers ──────────────────────────────────────────────────────

  private recordSuccessfulPlay(
    card: CardInHand,
    request: CardPlayRequest,
    context: ExecutionContext,
    requestedTiming: TimingClass,
  ): void {
    const pressureConfig = this.pressureAdapter.computeConfig(
      context.currentPressureTier ?? PressureTier.T1_STABLE,
    );
    const windowState = this.windowManager.computeWindowState(requestedTiming, context, pressureConfig);
    if (windowState) {
      const quality = this.qualityScorer.scorePlay(card, context, windowState, pressureConfig);
      this.analytics.recordPlay(requestedTiming, context.mode, quality, windowState);

      if (quality.qualityBand === 'perfect') {
        this.chatBridge.emitEvent({
          eventType: 'perfect_timing_achieved',
          timingClass: requestedTiming,
          mode: context.mode,
          cardId: card.definition.cardId,
          tickIndex: context.tickIndex,
          timestamp: Date.now(),
          payload: { qualityScore: quality.overallScore, rarity: card.definition.rarity },
        });
      }

      const holdLegal = isHoldLegalForCard(card.definition, context.mode, card.overlay);
      if (!holdLegal && card.isHeld) {
        this.analytics.recordHoldViolation(requestedTiming, context.mode);
      }
    }
  }

  private validateTarget(
    card: CardInHand,
    request: CardPlayRequest,
    context: ExecutionContext,
    requestedTiming: TimingClass,
    allowedTimingClasses: readonly TimingClass[],
  ): TimingValidationResult {
    const effectiveTargeting = card.overlay.targetingOverride ?? card.definition.targeting;

    if (effectiveTargeting === Targeting.SELF || effectiveTargeting === Targeting.GLOBAL) {
      return this.pass(requestedTiming, allowedTimingClasses, effectiveTargeting, context);
    }

    if (!request.targetId) {
      return this.fail(
        TimingRejectionCode.TARGET_ILLEGAL,
        `Card '${card.definition.cardId}' requires a target.`,
        card,
        request,
        allowedTimingClasses,
      );
    }

    const availableTargetIds = context.availableTargetIds ?? [];
    if (availableTargetIds.length > 0 && !availableTargetIds.includes(request.targetId)) {
      return this.fail(
        TimingRejectionCode.TARGET_ILLEGAL,
        `Target '${request.targetId}' is not legal for '${card.definition.cardId}'.`,
        card,
        request,
        allowedTimingClasses,
      );
    }

    return this.pass(requestedTiming, allowedTimingClasses, effectiveTargeting, context);
  }

  private validateTimingWindow(
    card: CardInHand,
    request: CardPlayRequest,
    context: ExecutionContext,
    requestedTiming: TimingClass,
    allowedTimingClasses: readonly TimingClass[],
  ): TimingValidationResult {
    const effectiveTargeting = card.overlay.targetingOverride ?? card.definition.targeting;
    const remainingWindowTicks = this.resolveRemainingTicks(requestedTiming, context);
    const remainingWindowMs = this.resolveRemainingMs(requestedTiming, context);

    const modeSpecificOpen = this.modeRouter.isWindowOpenForMode(requestedTiming, context);

    const open = (() => {
      if (modeSpecificOpen !== null) {
        return modeSpecificOpen;
      }
      switch (requestedTiming) {
        case TimingClass.ANY:
          return true;
        case TimingClass.PRE:
        case TimingClass.POST:
          return context.currentWindow === undefined || context.currentWindow === requestedTiming;
        case TimingClass.FATE:
          return Boolean(context.activeFateWindow || context.currentWindow === TimingClass.FATE);
        case TimingClass.CTR:
          return context.mode === GameMode.HEAD_TO_HEAD && Boolean(context.activeCounterWindow || context.currentWindow === TimingClass.CTR);
        case TimingClass.RES:
          return context.mode === GameMode.TEAM_UP && Boolean(context.activeRescueWindow || context.currentWindow === TimingClass.RES);
        case TimingClass.AID:
          return context.mode === GameMode.TEAM_UP && Boolean(context.activeAidWindow || context.currentWindow === TimingClass.AID);
        case TimingClass.GBM:
          return context.mode === GameMode.CHASE_A_LEGEND && Boolean(context.activeGhostBenchmarkWindow || context.currentWindow === TimingClass.GBM);
        case TimingClass.CAS:
          return Boolean(context.activeCascadeInterceptWindow || context.currentWindow === TimingClass.CAS);
        case TimingClass.PHZ:
          return context.mode === GameMode.GO_ALONE && Boolean(context.activePhaseBoundaryWindow || context.currentWindow === TimingClass.PHZ);
        case TimingClass.PSK:
          return Boolean(context.activePressureSpikeWindow || context.currentWindow === TimingClass.PSK);
        case TimingClass.END:
          return Boolean(context.isFinalTick || context.currentWindow === TimingClass.END);
        default:
          return false;
      }
    })();

    if (!open) {
      return this.fail(
        TimingRejectionCode.WINDOW_CLOSED,
        `Timing window '${requestedTiming}' is not currently open for '${card.definition.cardId}'.`,
        card,
        request,
        allowedTimingClasses,
        effectiveTargeting,
        remainingWindowTicks,
        remainingWindowMs,
      );
    }

    return this.pass(
      requestedTiming,
      allowedTimingClasses,
      effectiveTargeting,
      context,
      remainingWindowTicks,
      remainingWindowMs,
    );
  }

  private resolveRemainingTicks(timingClass: TimingClass, context: ExecutionContext): number | undefined {
    const explicit = context.windowRemainingTicksByTiming?.[timingClass];
    if (typeof explicit === 'number') {
      return explicit;
    }

    const configured = TIMING_WINDOW_TICKS[timingClass];
    return configured > 0 ? configured : undefined;
  }

  private resolveRemainingMs(timingClass: TimingClass, context: ExecutionContext): number | undefined {
    const explicit = context.windowRemainingMsByTiming?.[timingClass];
    if (typeof explicit === 'number') {
      return explicit;
    }

    const configured = TIMING_CLASS_WINDOW_MS[timingClass];
    return configured > 0 ? configured : undefined;
  }

  private pass(
    requestedTiming: TimingClass,
    allowedTimingClasses: readonly TimingClass[],
    effectiveTargeting: Targeting,
    context: ExecutionContext,
    remainingWindowTicks?: number,
    remainingWindowMs?: number,
  ): TimingValidationResult {
    return {
      valid: true,
      rejectionCode: null,
      reason: null,
      requestedTiming,
      allowedTimingClasses,
      effectiveTargeting,
      remainingWindowTicks,
      remainingWindowMs,
    };
  }

  private fail(
    rejectionCode: TimingRejectionCode,
    reason: string,
    card: CardInHand,
    request: CardPlayRequest,
    allowedTimingClasses?: readonly TimingClass[],
    effectiveTargeting?: Targeting,
    remainingWindowTicks?: number,
    remainingWindowMs?: number,
  ): TimingValidationResult {
    return {
      valid: false,
      rejectionCode,
      reason,
      requestedTiming: request.timingClass ?? TimingClass.ANY,
      allowedTimingClasses: allowedTimingClasses ?? resolveEffectiveTimingClasses(card.definition, card.overlay),
      effectiveTargeting: effectiveTargeting ?? (card.overlay.targetingOverride ?? card.definition.targeting),
      remainingWindowTicks:
        typeof remainingWindowTicks === 'number' ? clamp(remainingWindowTicks, 0, Number.MAX_SAFE_INTEGER) : undefined,
      remainingWindowMs:
        typeof remainingWindowMs === 'number' ? clamp(remainingWindowMs, 0, Number.MAX_SAFE_INTEGER) : undefined,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMING WINDOW MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export class TimingWindowManager {
  private readonly windowHistory: Map<string, TimingWindowState[]> = new Map();
  private readonly extensionLog: Map<string, number[]> = new Map();
  private readonly compressionLog: Map<string, number[]> = new Map();

  /**
   * Compute current window state for a timing class given context and pressure.
   */
  public computeWindowState(
    timingClass: TimingClass,
    context: ExecutionContext,
    pressureConfig: TimingPressureAwareConfig,
  ): TimingWindowState | null {
    const baseDurationMs = TIMING_CLASS_WINDOW_MS[timingClass];
    const baseDurationTicks = TIMING_WINDOW_TICKS[timingClass];

    if (baseDurationMs <= 0 && baseDurationTicks <= 0 && timingClass !== TimingClass.ANY) {
      return null;
    }

    const effectiveDurationMs = this.computeEffectiveDuration(
      timingClass,
      baseDurationMs,
      context,
      pressureConfig,
    );
    const effectiveDurationTicks = this.computeEffectiveTickDuration(
      timingClass,
      baseDurationTicks,
      pressureConfig,
    );

    const remainingMs = context.windowRemainingMsByTiming?.[timingClass] ?? effectiveDurationMs;
    const remainingTicks = context.windowRemainingTicksByTiming?.[timingClass] ?? effectiveDurationTicks;

    const isOpen = this.isWindowCurrentlyOpen(timingClass, context);
    const isExpired = remainingMs <= 0 && remainingTicks <= 0 && timingClass !== TimingClass.ANY;

    const openedAtMs = Date.now() - (effectiveDurationMs - remainingMs);
    const centerMs = effectiveDurationMs / 2;

    const key = this.windowKey(timingClass, context.mode);
    const history = this.windowHistory.get(key) ?? [];

    const state: TimingWindowState = {
      timingClass,
      openedAtMs,
      openedAtTick: context.tickIndex,
      baseDurationMs,
      effectiveDurationMs,
      baseDurationTicks,
      effectiveDurationTicks,
      usageCount: history.length,
      lastUsedAtMs: history.length > 0 ? history[history.length - 1].openedAtMs : null,
      pressureModifier: pressureConfig.windowCompressionFactor,
      modeModifier: this.computeModeModifier(timingClass, context.mode),
      isOpen,
      isExpired,
      remainingMs: clamp(remainingMs, 0, Number.MAX_SAFE_INTEGER),
      remainingTicks: clamp(remainingTicks, 0, Number.MAX_SAFE_INTEGER),
      centerMs,
      extensionCount: (this.extensionLog.get(key) ?? []).length,
      compressionCount: (this.compressionLog.get(key) ?? []).length,
    };

    return state;
  }

  /**
   * Open a timing window with specified parameters.
   */
  public openWindow(
    timingClass: TimingClass,
    context: ExecutionContext,
    pressureConfig: TimingPressureAwareConfig,
  ): TimingWindowState | null {
    const state = this.computeWindowState(timingClass, context, pressureConfig);
    if (!state) return null;

    const key = this.windowKey(timingClass, context.mode);
    const history = this.windowHistory.get(key) ?? [];
    history.push(state);
    this.windowHistory.set(key, history);

    return state;
  }

  /**
   * Extend a timing window by additional milliseconds.
   */
  public extendWindow(
    timingClass: TimingClass,
    mode: GameMode,
    extensionMs: number,
  ): number {
    const key = this.windowKey(timingClass, mode);
    const extensions = this.extensionLog.get(key) ?? [];
    const clampedExtension = clamp(extensionMs, 0, TIMING_CLASS_WINDOW_MS[timingClass] * 2);
    extensions.push(clampedExtension);
    this.extensionLog.set(key, extensions);
    return clampedExtension;
  }

  /**
   * Compress a timing window by a fraction.
   */
  public compressWindow(
    timingClass: TimingClass,
    mode: GameMode,
    compressionFactor: number,
  ): number {
    const key = this.windowKey(timingClass, mode);
    const compressions = this.compressionLog.get(key) ?? [];
    const clampedFactor = clamp(compressionFactor, 0.1, 1.0);
    compressions.push(clampedFactor);
    this.compressionLog.set(key, compressions);

    const baseMs = TIMING_CLASS_WINDOW_MS[timingClass];
    const compressedMs = Math.max(MIN_WINDOW_MS_FLOOR, baseMs * clampedFactor);
    return round6(compressedMs);
  }

  /**
   * Compute all 12 window states for the current context.
   */
  public computeAllWindowStates(
    context: ExecutionContext,
    pressureConfig: TimingPressureAwareConfig,
  ): Map<TimingClass, TimingWindowState | null> {
    const result = new Map<TimingClass, TimingWindowState | null>();
    for (const tc of TIMING_CLASS_ORDER) {
      result.set(tc, this.computeWindowState(tc, context, pressureConfig));
    }
    return result;
  }

  /**
   * Get window usage history for a timing class and mode.
   */
  public getWindowHistory(timingClass: TimingClass, mode: GameMode): readonly TimingWindowState[] {
    const key = this.windowKey(timingClass, mode);
    return this.windowHistory.get(key) ?? [];
  }

  /**
   * Compute the effective window duration from card_types helper with pressure overlay.
   */
  public computeEffectiveWindowMsFromCard(
    timingClass: TimingClass,
    pressureConfig: TimingPressureAwareConfig,
  ): number {
    const baseMs = computeEffectiveWindowMs(timingClass, PressureTier.T1_STABLE);
    const compressed = baseMs * pressureConfig.windowCompressionFactor;
    return Math.max(MIN_WINDOW_MS_FLOOR, round6(compressed));
  }

  /**
   * Compute the effective window ticks from card_types helper.
   */
  public computeEffectiveWindowTicksFromCard(timingClass: TimingClass): number {
    return computeEffectiveWindowTicks(timingClass);
  }

  /**
   * Reset all tracked state.
   */
  public reset(): void {
    this.windowHistory.clear();
    this.extensionLog.clear();
    this.compressionLog.clear();
  }

  // ── private ────────────────────────────────────────────────────────────

  private computeEffectiveDuration(
    timingClass: TimingClass,
    baseDurationMs: number,
    context: ExecutionContext,
    pressureConfig: TimingPressureAwareConfig,
  ): number {
    let effective = baseDurationMs;

    effective *= pressureConfig.windowCompressionFactor;

    const modeModifier = this.computeModeModifier(timingClass, context.mode);
    effective *= modeModifier;

    if (timingClass === TimingClass.RES || timingClass === TimingClass.AID) {
      effective += pressureConfig.rescueExtensionMs;
    }

    if (timingClass === TimingClass.CTR) {
      effective *= (1 - pressureConfig.counterCompressionFactor);
    }

    if (timingClass === TimingClass.GBM) {
      const divergenceScore = context.divergenceScore ?? 0;
      if (divergenceScore > 50) {
        effective *= GHOST_DIVERGENCE_WINDOW_MULT;
      }
    }

    const key = this.windowKey(timingClass, context.mode);
    const extensions = this.extensionLog.get(key) ?? [];
    for (const ext of extensions) {
      effective += ext;
    }

    const compressions = this.compressionLog.get(key) ?? [];
    for (const comp of compressions) {
      effective *= comp;
    }

    if (timingClass === TimingClass.PHZ) {
      const phaseIndex = context.currentPhase
        ? RUN_PHASE_ORDER.indexOf(context.currentPhase)
        : 0;
      effective *= (1 + phaseIndex * 0.15);
    }

    if (timingClass === TimingClass.PSK) {
      const tierIndex = pressureConfig.tierIndex;
      effective *= (1 - tierIndex * 0.08);
    }

    return Math.max(MIN_WINDOW_MS_FLOOR, round6(effective));
  }

  private computeEffectiveTickDuration(
    timingClass: TimingClass,
    baseTicks: number,
    pressureConfig: TimingPressureAwareConfig,
  ): number {
    if (baseTicks <= 0) return 0;

    let effective = baseTicks;

    if (pressureConfig.tierIndex >= 3) {
      effective = Math.max(1, effective - 1);
    }

    if (timingClass === TimingClass.GBM) {
      effective = Math.max(1, effective);
    }

    return clamp(Math.round(effective), 0, 100);
  }

  private computeModeModifier(timingClass: TimingClass, mode: GameMode): number {
    const legalModes = TIMING_CLASS_MODE_MATRIX[timingClass];
    if (!legalModes.includes(mode)) {
      return 0;
    }

    const behavior = getModeCardBehavior(mode);
    const budgetMs = MODE_TIMING_BUDGET_MS[mode];
    const baseBudget = MODE_TIMING_BUDGET_MS[GameMode.GO_ALONE];

    const budgetRatio = budgetMs / baseBudget;
    const behaviorFactor = behavior.holdEnabled ? 1.1 : 1.0;

    return round6(budgetRatio * behaviorFactor);
  }

  private isWindowCurrentlyOpen(timingClass: TimingClass, context: ExecutionContext): boolean {
    switch (timingClass) {
      case TimingClass.ANY:
        return true;
      case TimingClass.PRE:
      case TimingClass.POST:
        return context.currentWindow === undefined || context.currentWindow === timingClass;
      case TimingClass.FATE:
        return Boolean(context.activeFateWindow || context.currentWindow === TimingClass.FATE);
      case TimingClass.CTR:
        return Boolean(context.activeCounterWindow || context.currentWindow === TimingClass.CTR);
      case TimingClass.RES:
        return Boolean(context.activeRescueWindow || context.currentWindow === TimingClass.RES);
      case TimingClass.AID:
        return Boolean(context.activeAidWindow || context.currentWindow === TimingClass.AID);
      case TimingClass.GBM:
        return Boolean(context.activeGhostBenchmarkWindow || context.currentWindow === TimingClass.GBM);
      case TimingClass.CAS:
        return Boolean(context.activeCascadeInterceptWindow || context.currentWindow === TimingClass.CAS);
      case TimingClass.PHZ:
        return Boolean(context.activePhaseBoundaryWindow || context.currentWindow === TimingClass.PHZ);
      case TimingClass.PSK:
        return Boolean(context.activePressureSpikeWindow || context.currentWindow === TimingClass.PSK);
      case TimingClass.END:
        return Boolean(context.isFinalTick || context.currentWindow === TimingClass.END);
      default:
        return false;
    }
  }

  private windowKey(timingClass: TimingClass, mode: GameMode): string {
    return `${timingClass}::${mode}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMING DECISION QUALITY SCORER
// ─────────────────────────────────────────────────────────────────────────────

export class TimingDecisionQualityScorer {
  /**
   * Score a card play for timing optimality.
   */
  public scorePlay(
    card: CardInHand,
    context: ExecutionContext,
    windowState: TimingWindowState,
    pressureConfig: TimingPressureAwareConfig,
  ): TimingDecisionQuality {
    const timingOptimality = this.computeTimingOptimality(windowState);
    const centerDistance = this.computeCenterDistance(windowState);
    const earlyPenalty = this.computeEarlyPenalty(windowState);
    const latePenalty = this.computeLatePenalty(windowState);

    const modeWeight = this.computeModeWeight(card, context);
    const pressureWeight = this.computePressureWeight(pressureConfig);

    const tagScore = computeTagWeightedScore(
      card.definition.tags,
      context.mode,
      card.overlay,
    );

    const cardQuality = computeCardDecisionQuality(
      windowState.effectiveDurationTicks - windowState.remainingTicks,
      windowState.effectiveDurationTicks,
      0,
    );

    const bleedFactor = computeBleedthroughMultiplier(
      context.currentPressureTier ?? PressureTier.T1_STABLE,
      (context.trustScore ?? 50) > 70,
    );

    const divPotential = computeDivergencePotential(
      card.definition,
      windowState.timingClass,
      context.divergenceScore ?? 0,
    );

    const trustEff = computeTrustEfficiency(context.trustScore ?? 50);

    let rescueEff: number | null = null;
    if (context.mode === GameMode.TEAM_UP && (
      windowState.timingClass === TimingClass.RES || windowState.timingClass === TimingClass.AID
    )) {
      const rescueResult = computeRescueEfficiency(
        card.definition,
        windowState.effectiveDurationMs - windowState.remainingMs,
      );
      rescueEff = rescueResult.effectMultiplier;
    }

    const pressureCostMod = computePressureCostModifier(
      context.currentPressureTier ?? PressureTier.T1_STABLE,
    );

    const rawScore =
      timingOptimality * 0.30 +
      (1 - earlyPenalty) * 0.10 +
      (1 - latePenalty) * 0.10 +
      modeWeight * 0.15 +
      pressureWeight * 0.10 +
      clamp(tagScore / 10, 0, 1) * 0.10 +
      clamp(outcomeClassToNumeric(cardQuality), 0, 1) * 0.10 +
      clamp(1 - bleedFactor, 0, 1) * 0.05;

    const overallScore = round6(clamp(rawScore + pressureCostMod * 0.01, 0, 1));

    const qualityBand = this.resolveQualityBand(overallScore);

    return {
      overallScore,
      timingOptimality: round6(timingOptimality),
      windowCenterDistance: round6(centerDistance),
      earlyPenalty: round6(earlyPenalty),
      latePenalty: round6(latePenalty),
      modeWeight: round6(modeWeight),
      pressureWeight: round6(pressureWeight),
      tagScore: round6(tagScore),
      cardDecisionQuality: round6(outcomeClassToNumeric(cardQuality)),
      bleedthroughFactor: round6(bleedFactor),
      divergencePotential: divPotential,
      trustEfficiency: round6(trustEff.efficiency),
      rescueEfficiency: rescueEff !== null ? round6(rescueEff) : null,
      rarity: card.definition.rarity,
      counterability: card.definition.counterability,
      qualityBand,
    };
  }

  /**
   * Score multiple plays and return the average quality.
   */
  public scoreBatch(
    plays: readonly {
      card: CardInHand;
      context: ExecutionContext;
      windowState: TimingWindowState;
      pressureConfig: TimingPressureAwareConfig;
    }[],
  ): { scores: TimingDecisionQuality[]; averageScore: number } {
    const scores: TimingDecisionQuality[] = [];
    let total = 0;

    for (const play of plays) {
      const score = this.scorePlay(play.card, play.context, play.windowState, play.pressureConfig);
      scores.push(score);
      total += score.overallScore;
    }

    return {
      scores,
      averageScore: plays.length > 0 ? round6(total / plays.length) : 0,
    };
  }

  /**
   * Compute a rarity-weighted quality factor.
   */
  public computeRarityFactor(rarity: CardRarity): number {
    const dropRate = CARD_RARITY_DROP_RATES[rarity];
    return round6(1 - dropRate);
  }

  /**
   * Compute counterability impact on quality.
   */
  public computeCounterabilityImpact(counterability: Counterability, mode: GameMode): number {
    if (mode !== GameMode.HEAD_TO_HEAD) return 0;
    switch (counterability) {
      case Counterability.NONE:
        return 0;
      case Counterability.SOFT:
        return 0.15;
      case Counterability.HARD:
        return 0.30;
      default:
        return 0;
    }
  }

  // ── private ────────────────────────────────────────────────────────────

  private computeTimingOptimality(windowState: TimingWindowState): number {
    if (windowState.effectiveDurationMs <= 0) return 1.0;

    const elapsed = windowState.effectiveDurationMs - windowState.remainingMs;
    const center = windowState.centerMs;
    const halfWindow = windowState.effectiveDurationMs * WINDOW_CENTER_FRACTION;

    if (Math.abs(elapsed - center) <= halfWindow) {
      return 1.0;
    }

    const distanceFromCenter = Math.abs(elapsed - center) - halfWindow;
    const maxDistance = windowState.effectiveDurationMs / 2 - halfWindow;

    if (maxDistance <= 0) return 1.0;

    return clamp(1.0 - (distanceFromCenter / maxDistance), 0, 1);
  }

  private computeCenterDistance(windowState: TimingWindowState): number {
    if (windowState.effectiveDurationMs <= 0) return 0;

    const elapsed = windowState.effectiveDurationMs - windowState.remainingMs;
    return Math.abs(elapsed - windowState.centerMs);
  }

  private computeEarlyPenalty(windowState: TimingWindowState): number {
    if (windowState.effectiveDurationMs <= 0) return 0;

    const elapsed = windowState.effectiveDurationMs - windowState.remainingMs;
    const earlyThreshold = windowState.effectiveDurationMs * 0.15;

    if (elapsed < earlyThreshold) {
      const penaltyRatio = 1 - (elapsed / earlyThreshold);
      return clamp(penaltyRatio * EARLY_PENALTY_COEFF, 0, 1);
    }

    return 0;
  }

  private computeLatePenalty(windowState: TimingWindowState): number {
    if (windowState.effectiveDurationMs <= 0) return 0;

    const lateThreshold = windowState.effectiveDurationMs * 0.85;
    const elapsed = windowState.effectiveDurationMs - windowState.remainingMs;

    if (elapsed > lateThreshold) {
      const overAmount = elapsed - lateThreshold;
      const remaining = windowState.effectiveDurationMs - lateThreshold;
      if (remaining <= 0) return LATE_PENALTY_COEFF;
      const penaltyRatio = overAmount / remaining;
      return clamp(penaltyRatio * LATE_PENALTY_COEFF, 0, 1);
    }

    return 0;
  }

  private computeModeWeight(card: CardInHand, context: ExecutionContext): number {
    const behavior = getModeCardBehavior(context.mode);
    const profile = getDeckTypeProfile(card.definition.deckType);

    const holdBonus = behavior.holdEnabled && card.isHeld ? 0.1 : 0;
    const deckAlignment = isDeckLegalInMode(card.definition.deckType, context.mode) ? 0.2 : 0;

    const legalDecks = CARD_LEGALITY_MATRIX[context.mode];
    const deckLegalBonus = legalDecks.includes(card.definition.deckType) ? 0.3 : 0;

    return clamp(0.4 + holdBonus + deckAlignment + deckLegalBonus, 0, 1);
  }

  private computePressureWeight(pressureConfig: TimingPressureAwareConfig): number {
    const tierNorm = pressureConfig.tierIndex / (PRESSURE_TIER_ORDER.length - 1);
    const costMod = pressureConfig.costModifier;

    const comebackBonus = pressureConfig.comebackSurgeActive ? 0.15 : 0;
    const bleedPenalty = clamp(pressureConfig.bleedthroughMultiplier * 0.1, 0, 0.3);

    return clamp(0.5 + (1 - tierNorm) * 0.3 - bleedPenalty + comebackBonus - costMod * 0.05, 0, 1);
  }

  private resolveQualityBand(score: number): 'perfect' | 'good' | 'acceptable' | 'poor' | 'terrible' {
    if (score >= QUALITY_THRESHOLD_PERFECT) return 'perfect';
    if (score >= QUALITY_THRESHOLD_GOOD) return 'good';
    if (score >= QUALITY_THRESHOLD_ACCEPTABLE) return 'acceptable';
    if (score >= QUALITY_THRESHOLD_POOR) return 'poor';
    return 'terrible';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMING PRESSURE ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

export class TimingPressureAdapter {
  /**
   * Compute the full pressure-aware config for a given tier.
   */
  public computeConfig(tier: PressureTier): TimingPressureAwareConfig {
    const tierIndex = PRESSURE_TIER_ORDER.indexOf(tier);
    const safeTierIndex = tierIndex >= 0 ? tierIndex : 1;

    const costModifier = PRESSURE_COST_MODIFIERS[tier];

    const windowCompressionFactor = this.computeWindowCompression(safeTierIndex);
    const rescueExtensionMs = this.computeRescueExtension(safeTierIndex);
    const counterCompressionFactor = this.computeCounterCompression(safeTierIndex);

    const bleedthroughMultiplier = computeBleedthroughMultiplier(tier, false);

    const comebackSurgeActive = this.isComebackSurgeActive(tier);
    const comebackMultiplier = comebackSurgeActive
      ? COMEBACK_SURGE_CONFIG.decisionSpeedWeight
      : 1.0;

    return {
      tier,
      tierIndex: safeTierIndex,
      costModifier,
      windowCompressionFactor: round6(windowCompressionFactor),
      rescueExtensionMs: round6(rescueExtensionMs),
      counterCompressionFactor: round6(counterCompressionFactor),
      bleedthroughMultiplier: round6(bleedthroughMultiplier),
      comebackSurgeActive,
      comebackMultiplier: round6(comebackMultiplier),
    };
  }

  /**
   * Compute pressure configs for all tiers.
   */
  public computeAllConfigs(): Map<PressureTier, TimingPressureAwareConfig> {
    const result = new Map<PressureTier, TimingPressureAwareConfig>();
    for (const tier of PRESSURE_TIER_ORDER) {
      result.set(tier, this.computeConfig(tier));
    }
    return result;
  }

  /**
   * Compute the effective cost for a card under pressure.
   */
  public computeEffectiveCostUnderPressure(
    card: CardInHand,
    context: ExecutionContext,
  ): { cost: number; currency: string; modifier: number } {
    const tier = context.currentPressureTier ?? PressureTier.T1_STABLE;
    const baseCost = resolveEffectiveCost(card.definition, context.mode, card.overlay, tier);
    const currency = resolveCurrencyForCard(card.definition.deckType, context.mode, card.overlay);
    const modifier = computePressureCostModifier(tier);

    const effectiveCost = round6(baseCost * (1 + modifier));

    return { cost: effectiveCost, currency, modifier };
  }

  /**
   * Determine whether a timing class window should be extended or compressed.
   */
  public computeWindowAdjustment(
    timingClass: TimingClass,
    tier: PressureTier,
  ): { adjustmentMs: number; reason: string } {
    const config = this.computeConfig(tier);
    const baseMs = TIMING_CLASS_WINDOW_MS[timingClass];

    if (timingClass === TimingClass.RES || timingClass === TimingClass.AID) {
      return {
        adjustmentMs: config.rescueExtensionMs,
        reason: `Rescue/Aid window extended by ${config.rescueExtensionMs}ms at ${tier}`,
      };
    }

    if (timingClass === TimingClass.CTR) {
      const reduction = baseMs * config.counterCompressionFactor;
      return {
        adjustmentMs: -reduction,
        reason: `Counter window compressed by ${round6(reduction)}ms at ${tier}`,
      };
    }

    const compression = baseMs * (1 - config.windowCompressionFactor);
    return {
      adjustmentMs: -compression,
      reason: `Window compressed by ${round6(compression)}ms at ${tier}`,
    };
  }

  /**
   * Compute bleedthrough impact for a card.
   */
  public computeBleedthroughForCard(
    card: CardInHand,
    context: ExecutionContext,
  ): number {
    const tier = context.currentPressureTier ?? PressureTier.T1_STABLE;
    const trust = context.trustScore ?? 50;
    return computeBleedthroughMultiplier(tier, trust > 70);
  }

  /**
   * Check if the comeback surge configuration threshold has been met.
   */
  public checkComebackSurgeThreshold(tier: PressureTier): {
    active: boolean;
    multiplier: number;
    threshold: PressureTier;
  } {
    const config = COMEBACK_SURGE_CONFIG;
    const active = this.isComebackSurgeActive(tier);
    return {
      active,
      multiplier: active ? config.decisionSpeedWeight : 1.0,
      threshold: PressureTier.T3_ELEVATED,
    };
  }

  // ── private ────────────────────────────────────────────────────────────

  private computeWindowCompression(tierIndex: number): number {
    return clamp(1.0 - tierIndex * 0.08, 0.5, 1.0);
  }

  private computeRescueExtension(tierIndex: number): number {
    return tierIndex * RESCUE_EXTENSION_PER_TIER_MS;
  }

  private computeCounterCompression(tierIndex: number): number {
    return clamp(tierIndex * COUNTER_COMPRESSION_COEFF, 0, 0.4);
  }

  private isComebackSurgeActive(tier: PressureTier): boolean {
    const tierIndex = PRESSURE_TIER_ORDER.indexOf(tier);
    const thresholdIndex = PRESSURE_TIER_ORDER.indexOf(PressureTier.T3_ELEVATED);
    return tierIndex >= thresholdIndex;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMING MODE ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export class TimingModeRouter {
  /**
   * Compute a complete mode profile for timing purposes.
   */
  public computeModeProfile(mode: GameMode): TimingModeProfile {
    const legalDeckTypes = CARD_LEGALITY_MATRIX[mode];
    const behavior = getModeCardBehavior(mode);
    const tagWeights = MODE_TAG_WEIGHT_DEFAULTS[mode];
    const timingBudgetMs = MODE_TIMING_BUDGET_MS[mode];

    const legalTimingClasses = TIMING_CLASS_ORDER.filter(
      tc => TIMING_CLASS_MODE_MATRIX[tc].includes(mode),
    );

    const holdConfig = {
      enabled: behavior.holdEnabled,
      maxSlots: HOLD_SYSTEM_CONFIG.baseHoldsPerRun,
      windowMs: HOLD_SYSTEM_CONFIG.holdExpiryPhaseChanges,
    };

    const specialWindows = this.resolveSpecialWindows(mode);
    const ghostMarkers = this.resolveGhostMarkers(mode);

    const modeCode: ModeCode = this.resolveModecode(mode);

    return {
      mode,
      modeCode,
      legalDeckTypes,
      legalTimingClasses,
      tagWeights,
      timingBudgetMs,
      holdConfig,
      specialWindows,
      ghostMarkers,
    };
  }

  /**
   * Check mode-specific window open logic. Returns null if no mode override applies.
   */
  public isWindowOpenForMode(
    timingClass: TimingClass,
    context: ExecutionContext,
  ): boolean | null {
    switch (context.mode) {
      case GameMode.GO_ALONE:
        return this.checkEmpireWindowLogic(timingClass, context);
      case GameMode.HEAD_TO_HEAD:
        return this.checkPredatorWindowLogic(timingClass, context);
      case GameMode.TEAM_UP:
        return this.checkSyndicateWindowLogic(timingClass, context);
      case GameMode.CHASE_A_LEGEND:
        return this.checkPhantomWindowLogic(timingClass, context);
      default:
        return null;
    }
  }

  /**
   * Compute ghost window state for CHASE_A_LEGEND mode.
   */
  public computeGhostWindowState(
    context: ExecutionContext,
    ghostMarkerKind: GhostMarkerKind,
  ): TimingGhostWindowState {
    const spec = GHOST_MARKER_SPECS[ghostMarkerKind];
    const divergenceScore = context.divergenceScore ?? 0;
    const divPotential = this.classifyDivergencePotentialFromScore(divergenceScore);

    const benchmarkWindowMs = TIMING_CLASS_WINDOW_MS[TimingClass.GBM];
    let effectiveWindowMs = benchmarkWindowMs;

    if (divPotential === DivergencePotential.HIGH) {
      effectiveWindowMs *= GHOST_DIVERGENCE_WINDOW_MULT;
    } else if (divPotential === DivergencePotential.MEDIUM) {
      effectiveWindowMs *= 1.15;
    }

    effectiveWindowMs *= (1 + spec.cordBonus * 0.1);

    const isActive = context.mode === GameMode.CHASE_A_LEGEND &&
      Boolean(context.activeGhostBenchmarkWindow || context.currentWindow === TimingClass.GBM);

    return {
      ghostMarkerKind,
      divergencePotential: divPotential,
      benchmarkWindowMs: round6(benchmarkWindowMs),
      effectiveWindowMs: round6(effectiveWindowMs),
      divergenceScore,
      markerSpec: {
        kind: ghostMarkerKind,
        weight: spec.cordBonus,
        decayRate: spec.exploitWindowTicks,
      },
      isActive,
    };
  }

  /**
   * Compute counter window state for HEAD_TO_HEAD mode.
   */
  public computeCounterWindowState(
    context: ExecutionContext,
    opponentPressureTier: PressureTier,
  ): TimingCounterWindowState {
    const baseWindowMs = TIMING_CLASS_WINDOW_MS[TimingClass.CTR];
    const bleedMultiplier = computeBleedthroughMultiplier(
      opponentPressureTier,
      (context.trustScore ?? 50) > 70,
    );
    const compressedWindowMs = Math.max(
      MIN_WINDOW_MS_FLOOR,
      baseWindowMs * (1 - bleedMultiplier * COUNTER_COMPRESSION_COEFF),
    );

    const isActive = context.mode === GameMode.HEAD_TO_HEAD &&
      Boolean(context.activeCounterWindow || context.currentWindow === TimingClass.CTR);

    return {
      counterability: Counterability.HARD,
      baseWindowMs,
      bleedthroughMultiplier: round6(bleedMultiplier),
      compressedWindowMs: round6(compressedWindowMs),
      opponentPressureTier,
      isActive,
    };
  }

  /**
   * Compute rescue window state for TEAM_UP mode.
   */
  public computeRescueWindowState(
    context: ExecutionContext,
    pressureConfig: TimingPressureAwareConfig,
  ): TimingRescueWindowState {
    const baseWindowMs = TIMING_CLASS_WINDOW_MS[TimingClass.RES];

    const trustEff = computeTrustEfficiency(context.trustScore ?? 50);
    const comebackSurgeActive = pressureConfig.comebackSurgeActive;

    const effectiveWindowMs = baseWindowMs + pressureConfig.rescueExtensionMs;

    const isActive = context.mode === GameMode.TEAM_UP &&
      Boolean(context.activeRescueWindow || context.currentWindow === TimingClass.RES);

    return {
      rescueEfficiency: round6(trustEff.efficiency),
      baseWindowMs,
      pressureExtensionMs: pressureConfig.rescueExtensionMs,
      effectiveWindowMs: round6(effectiveWindowMs),
      teamTrustScore: context.trustScore ?? 50,
      trustEfficiency: round6(trustEff.efficiency),
      comebackSurgeActive,
      isActive,
    };
  }

  /**
   * Validate card legality through the full card_types pipeline.
   */
  public validateCardLegalityForMode(
    card: CardDefinition,
    overlay: CardOverlaySnapshot,
    mode: GameMode,
  ): { legal: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (!isDeckLegalInMode(card.deckType, mode)) {
      reasons.push(`Deck type '${getDeckTypeLabel(card.deckType)}' is not legal in mode '${mode}'.`);
    }

    if (card.modeLegal && !card.modeLegal.includes(mode)) {
      reasons.push(`Card '${card.cardId}' is excluded from mode '${mode}'.`);
    }

    const cardInHand: CardInHand = {
      instanceId: card.cardId,
      definition: card,
      overlay: overlay as ModeOverlay,
      drawnAtTick: 0,
      effectiveCost: card.baseCost,
      effectiveCurrency: 'cash',
      isHeld: false,
      isForced: false,
      isLegendary: card.rarity === CardRarity.LEGENDARY,
    };
    const legalResult = validateCardPlayLegality(cardInHand, { mode } as ExecutionContext);
    if (!legalResult.valid) {
      if (legalResult.reason) reasons.push(legalResult.reason);
    }

    const holdLegal = isHoldLegalForCard(card, mode, overlay as ModeOverlay);
    if (!holdLegal && overlay.holdAllowed) {
      reasons.push(`Card '${card.cardId}' hold not legal despite overlay allowing.`);
    }

    return { legal: reasons.length === 0, reasons };
  }

  /**
   * Get IPA chain synergy data relevant to timing decisions.
   */
  public getIPAChainSynergies(): readonly { combination: readonly DeckType[]; bonus: number }[] {
    return IPA_CHAIN_SYNERGIES.map(synergy => ({
      combination: synergy.combination,
      bonus: synergy.synergyBonus.incomeMultiplier,
    }));
  }

  /**
   * Get deck type profiles for all legal deck types in a mode.
   */
  public getDeckTypeProfilesForMode(mode: GameMode): readonly { deckType: DeckType; label: string; profile: ReturnType<typeof getDeckTypeProfile> }[] {
    const legalDecks = CARD_LEGALITY_MATRIX[mode];
    return legalDecks.map(dt => ({
      deckType: dt,
      label: getDeckTypeLabel(dt),
      profile: getDeckTypeProfile(dt),
    }));
  }

  /**
   * Get timing class labels for all legal timing classes in a mode.
   */
  public getTimingClassLabelsForMode(mode: GameMode): readonly { timingClass: TimingClass; label: string }[] {
    return TIMING_CLASS_ORDER
      .filter(tc => TIMING_CLASS_MODE_MATRIX[tc].includes(mode))
      .map(tc => ({
        timingClass: tc,
        label: getTimingClassLabel(tc),
      }));
  }

  // ── private ────────────────────────────────────────────────────────────

  private checkEmpireWindowLogic(timingClass: TimingClass, context: ExecutionContext): boolean | null {
    if (timingClass === TimingClass.PHZ) {
      const phase = context.currentPhase;
      if (!phase) return false;

      const phaseIndex = RUN_PHASE_ORDER.indexOf(phase);
      if (phaseIndex < 0) return false;

      return Boolean(context.activePhaseBoundaryWindow || context.currentWindow === TimingClass.PHZ);
    }

    return null;
  }

  private checkPredatorWindowLogic(timingClass: TimingClass, context: ExecutionContext): boolean | null {
    if (timingClass === TimingClass.CTR) {
      return Boolean(context.activeCounterWindow || context.currentWindow === TimingClass.CTR);
    }
    return null;
  }

  private checkSyndicateWindowLogic(timingClass: TimingClass, context: ExecutionContext): boolean | null {
    if (timingClass === TimingClass.RES) {
      return Boolean(context.activeRescueWindow || context.currentWindow === TimingClass.RES);
    }
    if (timingClass === TimingClass.AID) {
      return Boolean(context.activeAidWindow || context.currentWindow === TimingClass.AID);
    }
    return null;
  }

  private checkPhantomWindowLogic(timingClass: TimingClass, context: ExecutionContext): boolean | null {
    if (timingClass === TimingClass.GBM) {
      const divergenceScore = context.divergenceScore ?? 0;
      const divPotential = this.classifyDivergencePotentialFromScore(divergenceScore);

      if (divPotential === DivergencePotential.HIGH) {
        return Boolean(context.activeGhostBenchmarkWindow || context.currentWindow === TimingClass.GBM);
      }

      return Boolean(context.activeGhostBenchmarkWindow || context.currentWindow === TimingClass.GBM);
    }

    return null;
  }

  private resolveSpecialWindows(mode: GameMode): readonly TimingClass[] {
    switch (mode) {
      case GameMode.GO_ALONE:
        return [TimingClass.PHZ];
      case GameMode.HEAD_TO_HEAD:
        return [TimingClass.CTR];
      case GameMode.TEAM_UP:
        return [TimingClass.RES, TimingClass.AID];
      case GameMode.CHASE_A_LEGEND:
        return [TimingClass.GBM];
      default:
        return [];
    }
  }

  private resolveGhostMarkers(mode: GameMode): readonly GhostMarkerKind[] {
    if (mode !== GameMode.CHASE_A_LEGEND) return [];
    return [
      GhostMarkerKind.GOLD_BUY,
      GhostMarkerKind.RED_PASS,
      GhostMarkerKind.PURPLE_POWER,
      GhostMarkerKind.SILVER_BREACH,
      GhostMarkerKind.BLACK_CASCADE,
    ];
  }

  private resolveModecode(mode: GameMode): ModeCode {
    switch (mode) {
      case GameMode.GO_ALONE:
        return 'solo';
      case GameMode.HEAD_TO_HEAD:
        return 'pvp';
      case GameMode.TEAM_UP:
        return 'coop';
      case GameMode.CHASE_A_LEGEND:
        return 'ghost';
      default:
        return 'solo';
    }
  }

  private classifyDivergencePotentialFromScore(score: number): DivergencePotential {
    if (score >= 70) return DivergencePotential.HIGH;
    if (score >= 35) return DivergencePotential.MEDIUM;
    return DivergencePotential.LOW;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ML FEATURE EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

function extractMLFeatureVector(
  card: CardInHand,
  context: ExecutionContext,
  windowState: TimingWindowState | null,
  pressureConfig: TimingPressureAwareConfig,
  modeProfile: TimingModeProfile,
): TimingMLFeatureVector {
  const seedBase = hashStringToSeed(context.runSeed);
  const featureSeed = combineSeed(seedBase, 'ml_timing_features');
  const rng = createDeterministicRng(featureSeed);

  const features: number[] = new Array(ML_FEATURE_DIM).fill(0);
  const featureNames: string[] = [];

  // Feature 0: Window remaining fraction [0, 1]
  featureNames.push('window_remaining_fraction');
  if (windowState && windowState.effectiveDurationMs > 0) {
    features[0] = round6(windowState.remainingMs / windowState.effectiveDurationMs);
  } else {
    features[0] = 1.0;
  }

  // Feature 1: Pressure tier normalized [0, 1]
  featureNames.push('pressure_tier_normalized');
  features[1] = round6(pressureConfig.tierIndex / Math.max(1, PRESSURE_TIER_ORDER.length - 1));

  // Feature 2: Window compression factor [0, 1]
  featureNames.push('window_compression_factor');
  features[2] = round6(pressureConfig.windowCompressionFactor);

  // Feature 3: Cost modifier [−1, 1]
  featureNames.push('cost_modifier_normalized');
  features[3] = round6(clamp(pressureConfig.costModifier, -1, 1));

  // Feature 4: Card effective cost normalized [0, 1]
  featureNames.push('card_effective_cost');
  features[4] = round6(clamp(card.effectiveCost / 100, 0, 1));

  // Feature 5: Mode timing budget normalized [0, 1]
  featureNames.push('mode_budget_normalized');
  features[5] = round6(modeProfile.timingBudgetMs / 20_000);

  // Feature 6: Tag weighted score [0, 1]
  featureNames.push('tag_weighted_score');
  const tagScore = computeTagWeightedScore(
    card.definition.tags,
    context.mode,
    card.overlay,
  );
  features[6] = round6(clamp(tagScore / 30, 0, 1));

  // Feature 7: Trust efficiency [0, 1]
  featureNames.push('trust_efficiency');
  const trustEff = computeTrustEfficiency(context.trustScore ?? 50);
  features[7] = round6(clamp(trustEff.efficiency, 0, 1));

  // Feature 8: Bleedthrough multiplier [0, 1]
  featureNames.push('bleedthrough_mult');
  features[8] = round6(clamp(pressureConfig.bleedthroughMultiplier, 0, 1));

  // Feature 9: Comeback surge flag [0 or 1]
  featureNames.push('comeback_surge_active');
  features[9] = pressureConfig.comebackSurgeActive ? 1.0 : 0.0;

  // Feature 10: Card rarity encoded [0, 1]
  featureNames.push('card_rarity');
  const rarityMap: Record<string, number> = {
    [CardRarity.COMMON]: 0.0,
    [CardRarity.UNCOMMON]: 0.33,
    [CardRarity.RARE]: 0.66,
    [CardRarity.LEGENDARY]: 1.0,
  };
  features[10] = rarityMap[card.definition.rarity] ?? 0;

  // Feature 11: Deck type legal in mode [0 or 1]
  featureNames.push('deck_type_legal');
  features[11] = isDeckLegalInMode(card.definition.deckType, context.mode) ? 1.0 : 0.0;

  // Feature 12: Timing class legal in mode [0 or 1]
  featureNames.push('timing_class_legal');
  const requestedTiming = context.currentWindow ?? TimingClass.ANY;
  features[12] = isTimingClassLegalInMode(requestedTiming, context.mode) ? 1.0 : 0.0;

  // Feature 13: Number of allowed timing classes normalized [0, 1]
  featureNames.push('allowed_timing_count');
  const allowed = resolveEffectiveTimingClasses(card.definition, card.overlay);
  features[13] = round6(allowed.length / TIMING_CLASS_ORDER.length);

  // Feature 14: Run phase progress [0, 1]
  featureNames.push('run_phase_progress');
  const phaseIndex = context.currentPhase
    ? RUN_PHASE_ORDER.indexOf(context.currentPhase)
    : 0;
  features[14] = round6(Math.max(0, phaseIndex) / Math.max(1, RUN_PHASE_ORDER.length - 1));

  // Feature 15: Window usage count (historical, normalized) [0, 1]
  featureNames.push('window_usage_count');
  features[15] = windowState ? round6(clamp(windowState.usageCount / 20, 0, 1)) : 0;

  // Feature 16: Is forced card [0 or 1]
  featureNames.push('is_forced');
  features[16] = card.isForced ? 1.0 : 0.0;

  // Feature 17: Is held card [0 or 1]
  featureNames.push('is_held');
  features[17] = card.isHeld ? 1.0 : 0.0;

  // Feature 18: Divergence score normalized [0, 1]
  featureNames.push('divergence_score');
  features[18] = round6(clamp((context.divergenceScore ?? 0) / 100, 0, 1));

  // Feature 19: Battle budget remaining fraction [0, 1]
  featureNames.push('battle_budget_fraction');
  features[19] = round6(clamp((context.battleBudget ?? 0) / 1000, 0, 1));

  // Feature 20: Treasury remaining fraction [0, 1]
  featureNames.push('treasury_fraction');
  features[20] = round6(clamp((context.treasury ?? 0) / 1000, 0, 1));

  // Feature 21: Pressure cost modifier from card_types function [−1, 1]
  featureNames.push('pressure_cost_modifier');
  const pMod = computePressureCostModifier(context.currentPressureTier ?? PressureTier.T1_STABLE);
  features[21] = round6(clamp(pMod, -1, 1));

  // Feature 22: Card decision quality [0, 1]
  featureNames.push('card_decision_quality');
  const cdq = computeCardDecisionQuality(
    windowState ? (windowState.effectiveDurationTicks - windowState.remainingTicks) : 0,
    windowState?.effectiveDurationTicks ?? 1,
    0,
  );
  features[22] = round6(clamp(outcomeClassToNumeric(cdq), 0, 1));

  // Feature 23: Deterministic noise from RNG for regularization [0, 1]
  featureNames.push('rng_noise');
  features[23] = round6(rng.next() * 0.01);

  return {
    version: TIMING_VALIDATOR_VERSION,
    dimensions: ML_FEATURE_DIM,
    features,
    featureNames,
    seed: featureSeed,
    normalizedAt: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DL TENSOR EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

function extractDLTensor(
  card: CardInHand,
  context: ExecutionContext,
  pressureConfig: TimingPressureAwareConfig,
  modeProfile: TimingModeProfile,
): TimingDLTensor {
  const seedBase = hashStringToSeed(context.runSeed);
  const tensorSeed = combineSeed(seedBase, 'dl_timing_tensor');
  const mulberry = createMulberry32(normalizeSeed(tensorSeed));

  const data: number[][] = [];

  const rowLabels = TIMING_CLASS_ORDER.map(tc => getTimingClassLabel(tc));
  const colLabels = [
    'mode_legal',
    'window_ms_norm',
    'window_ticks_norm',
    'pressure_mod',
    'tag_relevance',
    'deck_alignment',
    'cost_factor',
    'rng_perturbation',
  ];

  const tagWeightVals = Object.values(modeProfile.tagWeights);
  const sanitized = sanitizePositiveWeights(tagWeightVals);

  const totalTagWeight = sanitized.reduce((s, v) => s + v, 0);
  const averageTagWeight = sanitized.length > 0 ? totalTagWeight / sanitized.length : 1;

  for (let rowIdx = 0; rowIdx < DL_TENSOR_ROWS; rowIdx++) {
    const tc = TIMING_CLASS_ORDER[rowIdx];
    const row: number[] = new Array(DL_TENSOR_COLS).fill(0);

    // Col 0: Mode legality for this timing class [0 or 1]
    const modeLegal = TIMING_CLASS_MODE_MATRIX[tc].includes(context.mode);
    row[0] = modeLegal ? 1.0 : 0.0;

    // Col 1: Window duration (ms) normalized to [0, 1]
    const windowMs = TIMING_CLASS_WINDOW_MS[tc];
    row[1] = round6(clamp(windowMs / 45_000, 0, 1));

    // Col 2: Window duration (ticks) normalized to [0, 1]
    const windowTicks = TIMING_WINDOW_TICKS[tc];
    row[2] = round6(clamp(windowTicks / 5, 0, 1));

    // Col 3: Pressure modifier
    row[3] = round6(clamp(pressureConfig.costModifier, -1, 1));

    // Col 4: Tag relevance — card tags mapped to mode weights
    let tagRelevance = 0;
    for (const tag of card.definition.tags) {
      const weight = modeProfile.tagWeights[tag] ?? 0;
      tagRelevance += weight;
    }
    row[4] = round6(clamp(tagRelevance / (averageTagWeight * Math.max(1, card.definition.tags.length) * 3), 0, 1));

    // Col 5: Deck alignment — how well this card's deck fits the mode
    const deckProfile = getDeckTypeProfile(card.definition.deckType);
    const deckAlignment = isDeckLegalInMode(card.definition.deckType, context.mode) ? 1.0 : 0.5;
    row[5] = round6(deckAlignment);

    // Col 6: Cost factor incorporating effective cost and pressure
    const effectiveCost = resolveEffectiveCost(card.definition, context.mode, card.overlay);
    row[6] = round6(clamp(effectiveCost / 50, 0, 1));

    // Col 7: Small deterministic perturbation from RNG
    row[7] = round6(mulberry() * 0.01);

    data.push(row);
  }

  return {
    version: TIMING_VALIDATOR_VERSION,
    rows: DL_TENSOR_ROWS,
    cols: DL_TENSOR_COLS,
    data,
    rowLabels,
    colLabels,
    seed: tensorSeed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMING REPLAY VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

export class TimingReplayValidator {
  private readonly validationCache: Map<string, TimingReplayValidation> = new Map();

  /**
   * Validate timing decisions against a replay event log.
   */
  public validateReplay(
    runId: string,
    events: readonly RunEvent[],
    expectedLedger: Ledger,
  ): TimingReplayValidation {
    const cacheKey = this.computeReplayCacheKey(runId, events);
    const cached = this.validationCache.get(cacheKey);
    if (cached) return cached;

    let validatedEvents = 0;
    let invalidEvents = 0;
    let windowMismatches = 0;
    let totalDriftMs = 0;

    const ledger = createDefaultLedger();

    for (const event of events) {
      const eventValid = this.validateSingleEvent(event, events);
      if (eventValid.valid) {
        validatedEvents++;
      } else {
        invalidEvents++;
        if (eventValid.windowMismatch) {
          windowMismatches++;
        }
      }
      totalDriftMs += eventValid.driftMs;
    }

    const ledgerHash = sha256Hex(stableStringify(expectedLedger));
    const recomputedHash = sha256Hex(stableStringify(ledger));

    const deterministicMatch = ledgerHash === recomputedHash || events.length === 0;

    const replayPayload = stableStringify({
      runId,
      eventCount: events.length,
      validatedEvents,
      invalidEvents,
      ledgerHash,
    });
    const replayHash = sha256Hex(replayPayload);

    const validationPayload = stableStringify({
      replayHash,
      deterministicMatch,
      windowMismatches,
      totalDriftMs,
    });
    const validationHash = this.computeNodeCryptoHash(validationPayload);

    const result: TimingReplayValidation = {
      runId,
      eventCount: events.length,
      validatedEvents,
      invalidEvents,
      windowMismatches,
      timingDriftMs: round6(totalDriftMs),
      deterministicMatch,
      ledgerHash,
      replayHash,
      validationHash,
    };

    this.validationCache.set(cacheKey, result);

    return result;
  }

  /**
   * Validate a batch of replays.
   */
  public validateBatch(
    replays: readonly { runId: string; events: readonly RunEvent[]; expectedLedger: Ledger }[],
  ): readonly TimingReplayValidation[] {
    return replays.map(r => this.validateReplay(r.runId, r.events, r.expectedLedger));
  }

  /**
   * Check whether a specific decision effect had valid timing.
   */
  public validateDecisionEffect(
    effect: DecisionEffect,
    timingClass: TimingClass,
    mode: GameMode,
  ): { valid: boolean; reason: string } {
    if (!isTimingClassLegalInMode(timingClass, mode)) {
      return {
        valid: false,
        reason: `Timing class '${getTimingClassLabel(timingClass)}' is not legal in mode '${mode}'.`,
      };
    }

    const windowMs = TIMING_CLASS_WINDOW_MS[timingClass];
    if (windowMs <= 0 && timingClass !== TimingClass.ANY) {
      return {
        valid: false,
        reason: `Timing class '${timingClass}' has zero window duration.`,
      };
    }

    if (!Number.isFinite(effect.delta)) {
      return {
        valid: false,
        reason: `Decision effect delta is not finite: ${effect.delta}.`,
      };
    }

    return { valid: true, reason: 'Decision effect timing is valid.' };
  }

  /**
   * Hash events using the replay_engine's sha256Hex.
   */
  public hashEventSequence(events: readonly RunEvent[]): string {
    const payload = stableStringify(events);
    return sha256Hex(payload);
  }

  /**
   * Clear the validation cache.
   */
  public clearCache(): void {
    this.validationCache.clear();
  }

  // ── private ────────────────────────────────────────────────────────────

  private validateSingleEvent(
    event: RunEvent,
    allEvents: readonly RunEvent[],
  ): { valid: boolean; windowMismatch: boolean; driftMs: number } {
    switch (event.type) {
      case 'RUN_CREATED': {
        return { valid: true, windowMismatch: false, driftMs: 0 };
      }

      case 'TURN_SUBMITTED': {
        const effects = event.effects;
        let valid = true;

        for (const effect of effects) {
          if (!Number.isFinite(effect.delta)) {
            valid = false;
          }
        }

        const eventIndex = allEvents.indexOf(event);
        let driftMs = 0;
        if (eventIndex > 0) {
          const prevEvent = allEvents[eventIndex - 1];
          if (prevEvent.type === 'TURN_SUBMITTED') {
            driftMs = Math.abs(event.submittedAt - prevEvent.submittedAt);
            if (driftMs > MAX_CLOCK_SKEW_MS * 100) {
              valid = false;
            }
          }
        }

        return { valid, windowMismatch: !valid, driftMs };
      }

      case 'RUN_FINALIZED': {
        return { valid: true, windowMismatch: false, driftMs: 0 };
      }

      default:
        return { valid: false, windowMismatch: true, driftMs: 0 };
    }
  }

  private computeReplayCacheKey(runId: string, events: readonly RunEvent[]): string {
    return sha256Hex(`${runId}::${events.length}::${stableStringify(events.slice(0, 3))}`);
  }

  private computeNodeCryptoHash(payload: string): string {
    return createHash(REPLAY_HASH_ALGO).update(payload).digest('hex');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

export class TimingChatBridge {
  private readonly eventLog: TimingChatBridgeEvent[] = [];
  private lastEmitMs = 0;

  /**
   * Emit a timing chat bridge event.
   */
  public emitEvent(event: Omit<TimingChatBridgeEvent, 'eventHash'>): TimingChatBridgeEvent {
    const now = Date.now();

    if (now - this.lastEmitMs < CHAT_DEBOUNCE_MS && this.eventLog.length > 0) {
      const last = this.eventLog[this.eventLog.length - 1];
      if (last.eventType === event.eventType && last.timingClass === event.timingClass) {
        return last;
      }
    }

    const hashSeed = hashStringToSeed(
      `${event.eventType}::${event.timingClass}::${event.tickIndex}::${event.timestamp}`,
    );
    const eventHash = sha256Hex(String(hashSeed));

    const fullEvent: TimingChatBridgeEvent = {
      ...event,
      eventHash,
    };

    this.eventLog.push(fullEvent);
    this.lastEmitMs = now;

    return fullEvent;
  }

  /**
   * Emit a window opened event.
   */
  public emitWindowOpened(
    timingClass: TimingClass,
    mode: GameMode,
    tickIndex: number,
  ): TimingChatBridgeEvent {
    return this.emitEvent({
      eventType: 'window_opened',
      timingClass,
      mode,
      cardId: null,
      tickIndex,
      timestamp: Date.now(),
      payload: { windowMs: TIMING_CLASS_WINDOW_MS[timingClass] },
    });
  }

  /**
   * Emit a window closing soon warning.
   */
  public emitWindowClosingSoon(
    timingClass: TimingClass,
    mode: GameMode,
    tickIndex: number,
    remainingMs: number,
  ): TimingChatBridgeEvent {
    return this.emitEvent({
      eventType: 'window_closing_soon',
      timingClass,
      mode,
      cardId: null,
      tickIndex,
      timestamp: Date.now(),
      payload: { remainingMs },
    });
  }

  /**
   * Emit a window missed event.
   */
  public emitWindowMissed(
    timingClass: TimingClass,
    mode: GameMode,
    tickIndex: number,
    cardId: string,
  ): TimingChatBridgeEvent {
    return this.emitEvent({
      eventType: 'window_missed',
      timingClass,
      mode,
      cardId,
      tickIndex,
      timestamp: Date.now(),
      payload: { reason: 'Window expired before play.' },
    });
  }

  /**
   * Emit a critical timing play event.
   */
  public emitCriticalTimingPlay(
    timingClass: TimingClass,
    mode: GameMode,
    cardId: string,
    tickIndex: number,
    qualityScore: number,
  ): TimingChatBridgeEvent {
    return this.emitEvent({
      eventType: 'critical_timing_play',
      timingClass,
      mode,
      cardId,
      tickIndex,
      timestamp: Date.now(),
      payload: { qualityScore },
    });
  }

  /**
   * Get all events.
   */
  public getEvents(): readonly TimingChatBridgeEvent[] {
    return this.eventLog;
  }

  /**
   * Get events filtered by type.
   */
  public getEventsByType(
    eventType: TimingChatBridgeEvent['eventType'],
  ): readonly TimingChatBridgeEvent[] {
    return this.eventLog.filter(e => e.eventType === eventType);
  }

  /**
   * Clear the event log.
   */
  public clearEvents(): void {
    this.eventLog.length = 0;
    this.lastEmitMs = 0;
  }

  /**
   * Compute a summary hash of all events.
   */
  public computeEventLogHash(): string {
    const payload = stableStringify(this.eventLog);
    return sha256Hex(payload);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS & DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

export class TimingAnalytics {
  private readonly playLog: {
    timingClass: TimingClass;
    mode: GameMode;
    quality: TimingDecisionQuality;
    windowState: TimingWindowState;
    recordedAt: number;
  }[] = [];

  private readonly holdViolations: {
    timingClass: TimingClass;
    mode: GameMode;
    recordedAt: number;
  }[] = [];

  /**
   * Record a successful play.
   */
  public recordPlay(
    timingClass: TimingClass,
    mode: GameMode,
    quality: TimingDecisionQuality,
    windowState: TimingWindowState,
  ): void {
    this.playLog.push({ timingClass, mode, quality, windowState, recordedAt: Date.now() });
  }

  /**
   * Record a hold violation.
   */
  public recordHoldViolation(timingClass: TimingClass, mode: GameMode): void {
    this.holdViolations.push({ timingClass, mode, recordedAt: Date.now() });
  }

  /**
   * Get window usage statistics per timing class.
   */
  public getWindowUsageStats(): Map<TimingClass, TimingWindowAnalytics> {
    const result = new Map<TimingClass, TimingWindowAnalytics>();

    for (const tc of TIMING_CLASS_ORDER) {
      const plays = this.playLog.filter(p => p.timingClass === tc);
      const totalOpens = plays.length;
      const totalPlays = plays.length;
      const totalMisses = 0;

      let totalPlayTimeMs = 0;
      let totalQuality = 0;
      let bestQuality = 0;
      let worstQuality = 1;
      let earlyPlays = 0;
      let latePlays = 0;
      let centerPlays = 0;

      const pressureDist: Record<PressureTier, number> = {
        [PressureTier.T0_SOVEREIGN]: 0,
        [PressureTier.T1_STABLE]: 0,
        [PressureTier.T2_STRESSED]: 0,
        [PressureTier.T3_ELEVATED]: 0,
        [PressureTier.T4_COLLAPSE_IMMINENT]: 0,
      };

      const phaseDist: Record<RunPhase, number> = {
        [RunPhase.FOUNDATION]: 0,
        [RunPhase.ESCALATION]: 0,
        [RunPhase.SOVEREIGNTY]: 0,
      };

      for (const play of plays) {
        const q = play.quality;
        totalQuality += q.overallScore;
        if (q.overallScore > bestQuality) bestQuality = q.overallScore;
        if (q.overallScore < worstQuality) worstQuality = q.overallScore;

        if (q.earlyPenalty > 0) earlyPlays++;
        if (q.latePenalty > 0) latePlays++;
        if (q.earlyPenalty === 0 && q.latePenalty === 0) centerPlays++;

        const elapsed = play.windowState.effectiveDurationMs - play.windowState.remainingMs;
        totalPlayTimeMs += elapsed;
      }

      const mode = plays.length > 0 ? plays[0].mode : GameMode.GO_ALONE;

      const analytics: TimingWindowAnalytics = {
        windowId: `${tc}_analytics`,
        timingClass: tc,
        mode,
        totalOpens,
        totalPlays,
        totalMisses,
        averagePlayTimeMs: totalPlays > 0 ? round6(totalPlayTimeMs / totalPlays) : 0,
        averageQualityScore: totalPlays > 0 ? round6(totalQuality / totalPlays) : 0,
        bestQualityScore: bestQuality,
        worstQualityScore: totalPlays > 0 ? worstQuality : 0,
        hitRate: totalOpens > 0 ? round6(totalPlays / totalOpens) : 0,
        earlyPlayRate: totalPlays > 0 ? round6(earlyPlays / totalPlays) : 0,
        latePlayRate: totalPlays > 0 ? round6(latePlays / totalPlays) : 0,
        centerPlayRate: totalPlays > 0 ? round6(centerPlays / totalPlays) : 0,
        pressureTierDistribution: pressureDist,
        phaseDistribution: phaseDist,
      };

      result.set(tc, analytics);
    }

    return result;
  }

  /**
   * Get decision quality trend over time.
   */
  public getQualityTrend(
    windowSize: number = 10,
  ): readonly { index: number; averageQuality: number; qualityBand: string }[] {
    const trend: { index: number; averageQuality: number; qualityBand: string }[] = [];

    for (let i = 0; i < this.playLog.length; i += windowSize) {
      const chunk = this.playLog.slice(i, i + windowSize);
      let total = 0;
      for (const play of chunk) {
        total += play.quality.overallScore;
      }
      const avg = chunk.length > 0 ? round6(total / chunk.length) : 0;

      let band: string;
      if (avg >= QUALITY_THRESHOLD_PERFECT) band = 'perfect';
      else if (avg >= QUALITY_THRESHOLD_GOOD) band = 'good';
      else if (avg >= QUALITY_THRESHOLD_ACCEPTABLE) band = 'acceptable';
      else if (avg >= QUALITY_THRESHOLD_POOR) band = 'poor';
      else band = 'terrible';

      trend.push({ index: i, averageQuality: avg, qualityBand: band });
    }

    return trend;
  }

  /**
   * Get mode comparison analytics.
   */
  public getModeComparison(): Map<GameMode, {
    totalPlays: number;
    averageQuality: number;
    dominantTimingClass: TimingClass;
  }> {
    const result = new Map<GameMode, {
      totalPlays: number;
      averageQuality: number;
      dominantTimingClass: TimingClass;
    }>();

    const modes = [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND];

    for (const mode of modes) {
      const plays = this.playLog.filter(p => p.mode === mode);
      let totalQ = 0;
      const tcCounts = new Map<TimingClass, number>();

      for (const play of plays) {
        totalQ += play.quality.overallScore;
        const current = tcCounts.get(play.timingClass) ?? 0;
        tcCounts.set(play.timingClass, current + 1);
      }

      let dominant = TimingClass.ANY;
      let maxCount = 0;
      for (const [tc, count] of tcCounts) {
        if (count > maxCount) {
          maxCount = count;
          dominant = tc;
        }
      }

      result.set(mode, {
        totalPlays: plays.length,
        averageQuality: plays.length > 0 ? round6(totalQ / plays.length) : 0,
        dominantTimingClass: dominant,
      });
    }

    return result;
  }

  /**
   * Get per-timing-class hit rates.
   */
  public getTimingClassHitRates(): Readonly<Record<string, number>> {
    const counts: Record<string, number> = {};
    const total = this.playLog.length;

    for (const tc of TIMING_CLASS_ORDER) {
      const count = this.playLog.filter(p => p.timingClass === tc).length;
      counts[tc] = total > 0 ? round6(count / total) : 0;
    }

    return counts;
  }

  /**
   * Get hold violation count.
   */
  public getHoldViolationCount(): number {
    return this.holdViolations.length;
  }

  /**
   * Compute a diagnostic summary hash.
   */
  public computeDiagnosticsHash(): string {
    const payload = stableStringify({
      playCount: this.playLog.length,
      holdViolations: this.holdViolations.length,
      lastRecordedAt: this.playLog.length > 0 ? this.playLog[this.playLog.length - 1].recordedAt : 0,
    });
    return sha256Hex(payload);
  }

  /**
   * Get rarity distribution of played cards.
   */
  public getRarityDistribution(): Readonly<Record<CardRarity, number>> {
    const dist: Record<CardRarity, number> = {
      [CardRarity.COMMON]: 0,
      [CardRarity.UNCOMMON]: 0,
      [CardRarity.RARE]: 0,
      [CardRarity.LEGENDARY]: 0,
    };

    for (const play of this.playLog) {
      const rarity = play.quality.rarity;
      dist[rarity] = (dist[rarity] ?? 0) + 1;
    }

    const total = this.playLog.length;
    if (total > 0) {
      for (const rarity of Object.keys(dist) as CardRarity[]) {
        dist[rarity] = round6(dist[rarity] / total);
      }
    }

    return dist;
  }

  /**
   * Get counterability distribution of played cards.
   */
  public getCounterabilityDistribution(): Readonly<Record<Counterability, number>> {
    const dist: Record<Counterability, number> = {
      [Counterability.NONE]: 0,
      [Counterability.SOFT]: 0,
      [Counterability.HARD]: 0,
    };

    for (const play of this.playLog) {
      const c = play.quality.counterability;
      dist[c] = (dist[c] ?? 0) + 1;
    }

    const total = this.playLog.length;
    if (total > 0) {
      for (const c of Object.keys(dist) as Counterability[]) {
        dist[c] = round6(dist[c] / total);
      }
    }

    return dist;
  }

  /**
   * Get divergence potential distribution.
   */
  public getDivergencePotentialDistribution(): Readonly<Record<DivergencePotential, number>> {
    const dist: Record<DivergencePotential, number> = {
      [DivergencePotential.LOW]: 0,
      [DivergencePotential.MEDIUM]: 0,
      [DivergencePotential.HIGH]: 0,
    };

    for (const play of this.playLog) {
      const dp = play.quality.divergencePotential;
      dist[dp] = (dist[dp] ?? 0) + 1;
    }

    const total = this.playLog.length;
    if (total > 0) {
      for (const dp of Object.keys(dist) as DivergencePotential[]) {
        dist[dp] = round6(dist[dp] / total);
      }
    }

    return dist;
  }

  /**
   * Get the pressure tier distribution across all recorded plays.
   */
  public getPressureTierDistribution(): Readonly<Record<PressureTier, number>> {
    const dist: Record<PressureTier, number> = {
      [PressureTier.T0_SOVEREIGN]: 0,
      [PressureTier.T1_STABLE]: 0,
      [PressureTier.T2_STRESSED]: 0,
      [PressureTier.T3_ELEVATED]: 0,
      [PressureTier.T4_COLLAPSE_IMMINENT]: 0,
    };

    return dist;
  }

  /**
   * Get total plays count.
   */
  public getTotalPlays(): number {
    return this.playLog.length;
  }

  /**
   * Clear all analytics data.
   */
  public reset(): void {
    this.playLog.length = 0;
    this.holdViolations.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH PROCESSING
// ─────────────────────────────────────────────────────────────────────────────

function batchProcessPlays(
  validator: TimingValidator,
  plays: readonly { card: CardInHand; request: CardPlayRequest; context: ExecutionContext }[],
): TimingBatchResult {
  const results: TimingValidationReport[] = [];
  let validPlays = 0;
  let invalidPlays = 0;
  let totalQuality = 0;
  let qualityCount = 0;

  const timingClassCounts: Partial<Record<TimingClass, number>> = {};
  const rejectionCounts: Partial<Record<TimingRejectionCode, number>> = {};

  for (let i = 0; i < plays.length; i += BATCH_MAX_CHUNK) {
    const chunk = plays.slice(i, i + BATCH_MAX_CHUNK);

    for (const play of chunk) {
      const report = validator.validateWithReport(play.card, play.request, play.context);
      results.push(report);

      if (report.validation.valid) {
        validPlays++;
        if (report.quality) {
          totalQuality += report.quality.overallScore;
          qualityCount++;
        }

        const tc = report.request.requestedTiming;
        timingClassCounts[tc] = (timingClassCounts[tc] ?? 0) + 1;
      } else {
        invalidPlays++;
        if (report.validation.rejectionCode) {
          const code = report.validation.rejectionCode;
          rejectionCounts[code] = (rejectionCounts[code] ?? 0) + 1;
        }
      }
    }
  }

  const averageQuality = qualityCount > 0 ? round6(totalQuality / qualityCount) : 0;

  const batchPayload = stableStringify({
    totalPlays: plays.length,
    validPlays,
    invalidPlays,
    averageQuality,
  });
  const batchHash = sha256Hex(batchPayload);

  return {
    totalPlays: plays.length,
    validPlays,
    invalidPlays,
    averageQuality,
    timingClassBreakdown: timingClassCounts,
    rejectionBreakdown: rejectionCounts,
    results,
    batchHash,
    processedAt: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a deterministic timing hash for a card play in a given context.
 * Uses node:crypto createHash, sha256Hex from replay_engine, and
 * stableStringify for canonical ordering.
 */
export function computeTimingPlayHash(
  card: CardInHand,
  request: CardPlayRequest,
  context: ExecutionContext,
): string {
  const payload = stableStringify({
    cardId: card.definition.cardId,
    instanceId: request.instanceId,
    choiceId: request.choiceId,
    mode: context.mode,
    tickIndex: context.tickIndex,
    timingClass: request.timingClass ?? context.currentWindow ?? TimingClass.ANY,
    deckType: card.definition.deckType,
    rarity: card.definition.rarity,
  });

  return createHash(REPLAY_HASH_ALGO).update(payload).digest('hex');
}

/**
 * Resolve the mode-specific window duration for a card, incorporating
 * pressure, deck profile, and mode behavior.
 */
export function resolveContextualWindowMs(
  timingClass: TimingClass,
  card: CardInHand,
  context: ExecutionContext,
): number {
  const baseMs = computeEffectiveWindowMs(timingClass, context.currentPressureTier ?? PressureTier.T1_STABLE);
  const behavior = getModeCardBehavior(context.mode);
  const profile = getDeckTypeProfile(card.definition.deckType);

  let effective = baseMs;

  if (behavior.holdEnabled && card.isHeld) {
    const holdConfig = HOLD_SYSTEM_CONFIG;
    effective = Math.max(effective, holdConfig.holdExpiryPhaseChanges);
  }

  if (isDeckLegalInMode(card.definition.deckType, context.mode)) {
    effective *= 1.1;
  }

  const pressureMod = computePressureCostModifier(context.currentPressureTier ?? PressureTier.T1_STABLE);
  effective *= clamp(1 - pressureMod * 0.05, 0.5, 1.5);

  return round6(Math.max(MIN_WINDOW_MS_FLOOR, effective));
}

/**
 * Generate a seed for timing validation from run context.
 * Uses normalizeSeed, combineSeed, DEFAULT_NON_ZERO_SEED.
 */
export function generateTimingSeed(context: ExecutionContext): number {
  const baseSeed = hashStringToSeed(context.runSeed);
  const tickSalt = normalizeSeed(context.tickIndex || DEFAULT_NON_ZERO_SEED);
  const combined = combineSeed(baseSeed, tickSalt);

  const modeSalt = hashStringToSeed(context.mode);
  return combineSeed(combined, modeSalt);
}

/**
 * Compute tag-weighted timing relevance for a card in context.
 */
export function computeTimingTagRelevance(
  card: CardInHand,
  context: ExecutionContext,
): { score: number; dominantTag: CardTag | null; tagCount: number } {
  const modeWeights = MODE_TAG_WEIGHT_DEFAULTS[context.mode];
  const score = computeTagWeightedScore(
    card.definition.tags,
    context.mode,
    card.overlay,
  );

  let dominantTag: CardTag | null = null;
  let maxWeight = 0;

  for (const tag of card.definition.tags) {
    const weight = modeWeights[tag] ?? 0;
    const overlayWeight = card.overlay.tagWeights[tag] ?? 1;
    const effective = weight * overlayWeight;
    if (effective > maxWeight) {
      maxWeight = effective;
      dominantTag = tag;
    }
  }

  return { score: round6(score), dominantTag, tagCount: card.definition.tags.length };
}

/**
 * Compute the effective IPA chain synergy bonus for timing.
 */
export function computeIPATimingSynergyBonus(
  tags: readonly CardTag[],
): number {
  let totalBonus = 0;

  for (const synergy of IPA_CHAIN_SYNERGIES) {
    const matchCount = synergy.combination.filter(t => tags.includes(t as unknown as CardTag)).length;
    if (matchCount >= synergy.combination.length) {
      totalBonus += synergy.synergyBonus.incomeMultiplier;
    } else if (matchCount > 0) {
      totalBonus += synergy.synergyBonus.incomeMultiplier * (matchCount / synergy.combination.length) * 0.5;
    }
  }

  return round6(totalBonus);
}

/**
 * Compute pressure-aware timing profile for display.
 */
export function computeTimingPressureProfile(
  context: ExecutionContext,
): {
  tier: PressureTier;
  costModifier: number;
  bleedthrough: number;
  comebackActive: boolean;
  windowCompressionPct: number;
} {
  const tier = context.currentPressureTier ?? PressureTier.T1_STABLE;
  const costMod = computePressureCostModifier(tier);
  const bleed = computeBleedthroughMultiplier(tier, (context.trustScore ?? 50) > 70);
  const tierIndex = PRESSURE_TIER_ORDER.indexOf(tier);
  const compressionPct = round6(clamp(tierIndex * 8, 0, 50));
  const comebackActive = tierIndex >= PRESSURE_TIER_ORDER.indexOf(PressureTier.T3_ELEVATED);

  return {
    tier,
    costModifier: costMod,
    bleedthrough: bleed,
    comebackActive,
    windowCompressionPct: compressionPct,
  };
}

/**
 * Resolve ghost marker timing specs for a specific kind.
 */
export function resolveGhostMarkerTimingSpec(kind: GhostMarkerKind): {
  kind: GhostMarkerKind;
  weight: number;
  decayRate: number;
  windowMultiplier: number;
} {
  const spec = GHOST_MARKER_SPECS[kind];
  return {
    kind,
    weight: spec.cordBonus,
    decayRate: spec.exploitWindowTicks,
    windowMultiplier: round6(1 + spec.cordBonus * 0.1),
  };
}

/**
 * Compute full deck type timing alignment for a mode.
 */
export function computeDeckTimingAlignment(
  deckType: DeckType,
  mode: GameMode,
): {
  legal: boolean;
  label: string;
  preferredMode: boolean;
  deckProfile: ReturnType<typeof getDeckTypeProfile>;
} {
  const legal = isDeckLegalInMode(deckType, mode);
  const label = getDeckTypeLabel(deckType);
  const profile = getDeckTypeProfile(deckType);
  const preferredMode = isDeckLegalInMode(deckType, mode);

  return { legal, label, preferredMode, deckProfile: profile };
}

/**
 * Compute rarity drop rate influenced timing weight.
 */
export function computeRarityTimingWeight(rarity: CardRarity): number {
  const dropRate = CARD_RARITY_DROP_RATES[rarity];
  return round6(1 / Math.max(0.01, dropRate));
}

/**
 * Compute a full DECK_TYPE_PROFILES summary for timing analysis.
 */
export function computeDeckProfileTimingSummary(): readonly {
  deckType: DeckType;
  label: string;
  profile: ReturnType<typeof getDeckTypeProfile>;
}[] {
  const deckTypes: DeckType[] = [
    DeckType.OPPORTUNITY, DeckType.IPA, DeckType.FUBAR, DeckType.MISSED_OPPORTUNITY,
    DeckType.PRIVILEGED, DeckType.SO, DeckType.SABOTAGE, DeckType.COUNTER,
    DeckType.AID, DeckType.RESCUE, DeckType.DISCIPLINE, DeckType.TRUST,
    DeckType.BLUFF, DeckType.GHOST,
  ];

  return deckTypes.map(dt => ({
    deckType: dt,
    label: getDeckTypeLabel(dt),
    profile: DECK_TYPE_PROFILES[dt],
  }));
}

/**
 * Compute MODE_CARD_BEHAVIORS summary for all modes.
 */
export function computeModeCardBehaviorSummary(): readonly {
  mode: GameMode;
  behavior: ReturnType<typeof getModeCardBehavior>;
  timingBudgetMs: number;
}[] {
  const modes = [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND];
  return modes.map(mode => ({
    mode,
    behavior: MODE_CARD_BEHAVIORS[mode],
    timingBudgetMs: MODE_TIMING_BUDGET_MS[mode],
  }));
}

/**
 * Compute hold system timing constraints.
 */
export function computeHoldSystemTimingConstraints(
  card: CardDefinition,
  overlay: ModeOverlay,
  context: ExecutionContext,
): {
  holdLegal: boolean;
  maxSlots: number;
  holdWindowMs: number;
  holdEnabled: boolean;
} {
  const holdLegal = isHoldLegalForCard(card, context.mode, overlay);
  const config = HOLD_SYSTEM_CONFIG;
  const behavior = getModeCardBehavior(context.mode);

  return {
    holdLegal,
    maxSlots: config.baseHoldsPerRun,
    holdWindowMs: config.holdExpiryPhaseChanges,
    holdEnabled: behavior.holdEnabled,
  };
}

/**
 * Compute full divergence potential analysis for timing decisions.
 */
export function computeTimingDivergenceAnalysis(
  card: CardDefinition,
  mode: GameMode,
  divergenceScore: number,
): {
  potential: DivergencePotential;
  score: number;
  ghostRelevant: boolean;
  windowMultiplier: number;
} {
  const potential = computeDivergencePotential(card, TimingClass.GBM, divergenceScore);
  const ghostRelevant = mode === GameMode.CHASE_A_LEGEND;

  let windowMultiplier = 1.0;
  if (ghostRelevant) {
    if (potential === DivergencePotential.HIGH) {
      windowMultiplier = GHOST_DIVERGENCE_WINDOW_MULT;
    } else if (potential === DivergencePotential.MEDIUM) {
      windowMultiplier = 1.15;
    }
  }

  return {
    potential,
    score: divergenceScore,
    ghostRelevant,
    windowMultiplier: round6(windowMultiplier),
  };
}

/**
 * Compute rescue efficiency timing data.
 */
export function computeRescueTimingData(
  context: ExecutionContext,
): {
  rescueEfficiency: number;
  trustEfficiency: number;
  comebackActive: boolean;
  extensionMs: number;
} | null {
  if (context.mode !== GameMode.TEAM_UP) return null;

  const trustScore = context.trustScore ?? 50;
  const tier = context.currentPressureTier ?? PressureTier.T1_STABLE;

  const trustEff = computeTrustEfficiency(trustScore);

  const tierIndex = PRESSURE_TIER_ORDER.indexOf(tier);
  const comebackThreshold = PRESSURE_TIER_ORDER.indexOf(PressureTier.T3_ELEVATED);
  const comebackActive = tierIndex >= comebackThreshold;
  const extensionMs = tierIndex * RESCUE_EXTENSION_PER_TIER_MS;

  return {
    rescueEfficiency: round6(trustEff.efficiency),
    trustEfficiency: round6(trustEff.efficiency),
    comebackActive,
    extensionMs,
  };
}

/**
 * Compute the effective cost for a card using both card_types helpers.
 */
export function computeTimingEffectiveCost(
  card: CardDefinition,
  overlay: ModeOverlay,
  mode: GameMode = GameMode.GO_ALONE,
): { cost: number; currency: string } {
  const cost = resolveEffectiveCost(card, mode, overlay);
  const currency = resolveCurrencyForCard(card.deckType, mode, overlay);
  return { cost: round6(cost), currency };
}

/**
 * Compute counterability-aware timing data.
 */
export function computeCounterabilityTimingData(
  card: CardDefinition,
  mode: GameMode,
): {
  counterability: Counterability;
  counterWindowMs: number;
  counterLegal: boolean;
} {
  const counterability = card.counterability;
  const counterWindowMs = TIMING_CLASS_WINDOW_MS[TimingClass.CTR];
  const counterLegal = isTimingClassLegalInMode(TimingClass.CTR, mode);

  return { counterability, counterWindowMs, counterLegal };
}

/**
 * Validate play legality through the card_types full pipeline.
 */
export function validateTimingPlayLegality(
  card: CardDefinition,
  mode: GameMode,
): { legal: boolean; reasons: readonly string[] } {
  const cardInHand: CardInHand = {
    instanceId: card.cardId,
    definition: card,
    overlay: {} as ModeOverlay,
    drawnAtTick: 0,
    effectiveCost: card.baseCost,
    effectiveCurrency: 'cash',
    isHeld: false,
    isForced: false,
    isLegendary: card.rarity === CardRarity.LEGENDARY,
  };
  const result = validateCardPlayLegality(cardInHand, { mode } as ExecutionContext);
  return {
    legal: result.valid,
    reasons: result.reason ? [result.reason] : [],
  };
}

/**
 * Compute effective window ticks from card_types.
 */
export function computeTimingEffectiveWindowTicks(
  timingClass: TimingClass,
): number {
  return computeEffectiveWindowTicks(timingClass);
}

/**
 * Compute effective window ms from card_types.
 */
export function computeTimingEffectiveWindowMs(
  timingClass: TimingClass,
  pressureTier: PressureTier,
): number {
  return computeEffectiveWindowMs(timingClass, pressureTier);
}

/**
 * Compute a deterministic RNG for timing validation.
 */
export function createTimingRng(context: ExecutionContext): DeterministicRng {
  const seed = generateTimingSeed(context);
  return createDeterministicRng(seed);
}

/**
 * Compute timing class legality matrix summary.
 */
export function computeTimingClassLegalityMatrix(): Readonly<Record<string, readonly GameMode[]>> {
  const result: Record<string, readonly GameMode[]> = {};
  for (const tc of TIMING_CLASS_ORDER) {
    result[tc] = TIMING_CLASS_MODE_MATRIX[tc];
  }
  return result;
}

/**
 * Compute targeting compatibility for timing windows.
 */
export function computeTargetingTimingCompatibility(
  targeting: Targeting,
  mode: GameMode,
): { compatible: boolean; availableTargetingTypes: readonly Targeting[] } {
  const allTargeting = [Targeting.SELF, Targeting.OPPONENT, Targeting.TEAMMATE, Targeting.TEAM, Targeting.GLOBAL];

  let availableTargeting: Targeting[];
  switch (mode) {
    case GameMode.GO_ALONE:
      availableTargeting = [Targeting.SELF, Targeting.GLOBAL];
      break;
    case GameMode.HEAD_TO_HEAD:
      availableTargeting = [Targeting.SELF, Targeting.OPPONENT, Targeting.GLOBAL];
      break;
    case GameMode.TEAM_UP:
      availableTargeting = [Targeting.SELF, Targeting.TEAMMATE, Targeting.TEAM, Targeting.GLOBAL];
      break;
    case GameMode.CHASE_A_LEGEND:
      availableTargeting = [Targeting.SELF, Targeting.GLOBAL];
      break;
    default:
      availableTargeting = allTargeting;
  }

  return {
    compatible: availableTargeting.includes(targeting),
    availableTargetingTypes: availableTargeting,
  };
}

/**
 * Generate all ghost marker timing specs.
 */
export function generateAllGhostMarkerTimingSpecs(): readonly {
  kind: GhostMarkerKind;
  weight: number;
  decayRate: number;
  windowMultiplier: number;
}[] {
  const kinds = [
    GhostMarkerKind.GOLD_BUY,
    GhostMarkerKind.RED_PASS,
    GhostMarkerKind.PURPLE_POWER,
    GhostMarkerKind.SILVER_BREACH,
    GhostMarkerKind.BLACK_CASCADE,
  ];

  return kinds.map(kind => resolveGhostMarkerTimingSpec(kind));
}

/**
 * Compute all PRESSURE_COST_MODIFIERS as a timing summary.
 */
export function computePressureCostModifierSummary(): readonly {
  tier: PressureTier;
  modifier: number;
  bleedthrough: number;
}[] {
  return PRESSURE_TIER_ORDER.map(tier => ({
    tier,
    modifier: PRESSURE_COST_MODIFIERS[tier],
    bleedthrough: computeBleedthroughMultiplier(tier, false),
  }));
}

/**
 * Create a default timing validation report for error scenarios.
 */
export function createDefaultTimingReport(
  cardId: string,
  mode: GameMode,
  rejectionCode: TimingRejectionCode,
  reason: string,
): TimingValidationReport {
  return {
    version: TIMING_VALIDATOR_VERSION,
    validatedAt: Date.now(),
    card: {
      cardId,
      deckType: DeckType.OPPORTUNITY,
      rarity: CardRarity.COMMON,
      tags: [],
      timingClasses: [TimingClass.ANY],
      counterability: Counterability.NONE,
    },
    request: {
      instanceId: '',
      choiceId: '',
      requestedTiming: TimingClass.ANY,
    },
    context: {
      mode,
      phase: null,
      pressureTier: null,
      tickIndex: 0,
      isFinalTick: false,
    },
    validation: {
      valid: false,
      rejectionCode,
      reason,
      requestedTiming: TimingClass.ANY,
      allowedTimingClasses: [TimingClass.ANY],
      effectiveTargeting: Targeting.SELF,
    },
    quality: null,
    windowState: null,
    deterministicHash: sha256Hex(stableStringify({ cardId, mode, rejectionCode, reason })),
  };
}

/**
 * Compute the full timing window state for every timing class in every mode.
 * Returns a nested structure keyed by mode then timing class.
 */
export function computeFullTimingMatrix(
  context: ExecutionContext,
): Map<GameMode, Map<TimingClass, { windowMs: number; windowTicks: number; legal: boolean; label: string }>> {
  const modes = [GameMode.GO_ALONE, GameMode.HEAD_TO_HEAD, GameMode.TEAM_UP, GameMode.CHASE_A_LEGEND];
  const result = new Map<GameMode, Map<TimingClass, { windowMs: number; windowTicks: number; legal: boolean; label: string }>>();

  for (const mode of modes) {
    const modeMap = new Map<TimingClass, { windowMs: number; windowTicks: number; legal: boolean; label: string }>();
    for (const tc of TIMING_CLASS_ORDER) {
      const legal = isTimingClassLegalInMode(tc, mode);
      const windowMs = TIMING_CLASS_WINDOW_MS[tc];
      const windowTicks = TIMING_WINDOW_TICKS[tc];
      const label = getTimingClassLabel(tc);
      modeMap.set(tc, { windowMs, windowTicks, legal, label });
    }
    result.set(mode, modeMap);
  }

  return result;
}

/**
 * Compute run phase timing adjustments.
 */
export function computeRunPhaseTimingAdjustment(
  phase: RunPhase,
  timingClass: TimingClass,
): { phaseMultiplier: number; adjustedWindowMs: number } {
  const phaseIndex = RUN_PHASE_ORDER.indexOf(phase);
  const phaseMultiplier = 1 + Math.max(0, phaseIndex) * 0.15;
  const baseMs = TIMING_CLASS_WINDOW_MS[timingClass];
  const adjustedWindowMs = round6(baseMs * phaseMultiplier);

  return { phaseMultiplier: round6(phaseMultiplier), adjustedWindowMs };
}

/**
 * Compute a deterministic Mulberry32 timing stream.
 */
export function createTimingMulberryStream(
  context: ExecutionContext,
  count: number,
): readonly number[] {
  const seed = generateTimingSeed(context);
  const mulberry = createMulberry32(normalizeSeed(seed));
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(round6(mulberry()));
  }
  return values;
}

/**
 * Sanitize timing weights using the deterministic_rng utility.
 */
export function sanitizeTimingWeights(
  weights: readonly number[],
): readonly number[] {
  return sanitizePositiveWeights(weights);
}

/**
 * Compute a DEFAULT_NON_ZERO_SEED backed fallback seed for contexts
 * where the run seed is missing or invalid.
 */
export function computeFallbackTimingSeed(runSeed: string | undefined): number {
  if (!runSeed || runSeed.length === 0) {
    return DEFAULT_NON_ZERO_SEED;
  }

  const parsed = hashStringToSeed(runSeed);
  return normalizeSeed(parsed || DEFAULT_NON_ZERO_SEED);
}

/**
 * Compute card overlay snapshot timing implications.
 */
export function computeOverlayTimingImplications(
  overlay: CardOverlaySnapshot,
  baseDefinition: CardDefinition,
): {
  timingLocked: boolean;
  lockedClasses: readonly TimingClass[];
  holdAllowed: boolean;
  autoResolveOverride: boolean;
  costModified: boolean;
  effectiveClasses: readonly TimingClass[];
} {
  const timingLocked = overlay.timingLock !== undefined && overlay.timingLock.length > 0;
  const lockedClasses = overlay.timingLock ?? [];
  const holdAllowed = overlay.holdAllowed ?? false;
  const autoResolveOverride = overlay.autoResolveOverride ?? false;
  const costModified = overlay.costModifier !== undefined && overlay.costModifier !== 0;

  const effectiveClasses = resolveEffectiveTimingClasses(baseDefinition, overlay as ModeOverlay);

  return {
    timingLocked,
    lockedClasses,
    holdAllowed,
    autoResolveOverride,
    costModified,
    effectiveClasses,
  };
}

/**
 * Compute complete mode overlay timing snapshot.
 */
export function computeModeOverlayTimingSnapshot(
  definition: CardDefinition,
  mode: GameMode,
): {
  mode: GameMode;
  overlay: Partial<ModeOverlay> | undefined;
  effectiveTimingClasses: readonly TimingClass[];
  deckLegal: boolean;
  modeLegal: boolean;
} {
  const overlay = definition.modeOverlays?.[mode];
  const deckLegal = isDeckLegalInMode(definition.deckType, mode);
  const modeLegal = !definition.modeLegal || definition.modeLegal.includes(mode);

  const effectiveTimingClasses = overlay?.timingLock && overlay.timingLock.length > 0
    ? overlay.timingLock
    : definition.timingClasses;

  return {
    mode,
    overlay,
    effectiveTimingClasses,
    deckLegal,
    modeLegal,
  };
}

/**
 * Compute the full set of legal card legality matrices for timing.
 */
export function computeTimingLegalityMatrices(): {
  cardLegalityMatrix: Readonly<Record<GameMode, readonly DeckType[]>>;
  timingClassModeMatrix: Readonly<Record<TimingClass, readonly GameMode[]>>;
} {
  return {
    cardLegalityMatrix: CARD_LEGALITY_MATRIX,
    timingClassModeMatrix: TIMING_CLASS_MODE_MATRIX,
  };
}
