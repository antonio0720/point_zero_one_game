/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/index.ts
 *
 * Cards sub-system master barrel AND orchestration layer.
 *
 * This file serves two roles:
 *
 * 1. BARREL — re-exports every public symbol from the 8 cards sub-modules so
 *    that consumers (chat, run-state, drama, AI planner, replay, proof) can
 *    import from a single surface: `import { … } from '../../engine/cards'`.
 *
 * 2. ORCHESTRATION — provides cross-system functions that compose two or more
 *    sub-systems (timing + targeting + legality + scoring) into higher-level
 *    UX surfaces.  These are the canonical "wiring layer" that the
 *    `engine/index.ts` master barrel re-exports as `Cards.*`.
 *
 * Doctrine:
 *   - No circular imports: sub-modules never import from this file.
 *   - Disambiguation: any name exported by two or more sub-modules is resolved
 *     explicitly below; the canonical source wins, the duplicate is suppressed.
 *   - All orchestration imports are from the sub-modules directly (never from
 *     this barrel itself), preserving deterministic load order.
 *   - engine/index.ts is the master barrel: `export * as Cards from './cards'`
 *     This file is its full implementation surface.
 *
 * Disambiguation register (TS2308 guard):
 *   ModeCardScoreBreakdown    → canonical: types.ts
 *   getGhostMarkerWindowTicks → canonical: CardTimingValidator.ts
 *
 * Runtime evaluation type note:
 *   Timing and targeting evaluation requires `CardInstance` (the runtime
 *   wrapper that holds overlay-resolved state).  Scoring functions accept
 *   `CardDefinition` (the static definition).  The orchestrator bridges both:
 *   it takes `CardInstance` for live evaluation, and extracts `.card` to reach
 *   the underlying `CardDefinition` for scoring.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * SECTION 1  ·  Barrel re-exports
 * ──────────────────────────────────────────────────────────────────────────── */

export * from './types';
export * from './CardEffectCompiler';
export * from './CardEffectExecutor';
export * from './CardLegalityService';
export * from './CardRegistry';
export * from './CardTargetingResolver';
export * from './CardTimingValidator';
export * from './CardOverlayResolver';
export * from './DeckComposer';

/* ────────────────────────────────────────────────────────────────────────────
 * SECTION 2  ·  Disambiguation
 * ──────────────────────────────────────────────────────────────────────────── */

/** `ModeCardScoreBreakdown` is canonical in `types.ts`. */
export type { ModeCardScoreBreakdown } from './types';

/** `getGhostMarkerWindowTicks` is canonical in `CardTimingValidator.ts`. */
export { getGhostMarkerWindowTicks } from './CardTimingValidator';

/* ────────────────────────────────────────────────────────────────────────────
 * SECTION 3  ·  Orchestration imports
 * ──────────────────────────────────────────────────────────────────────────── */

import type {
  CardDefinition,
  CardInstance,
  DeckType,
  ModeCode,
  Targeting,
  TimingClass,
} from '../core/GamePrimitives';
import { MODE_CODES } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';

import { CardTimingValidator } from './CardTimingValidator';
import type {
  CardTimingAudit,
  TimingWindowAdvisory,
  TimingHandSummary,
} from './CardTimingValidator';

import { CardTargetingResolver } from './CardTargetingResolver';
import type {
  TargetAllowance,
  TargetingBatchResult,
  TargetingHandSummary,
  TargetingAdvisory,
} from './CardTargetingResolver';

import { CardLegalityService } from './CardLegalityService';
import type {
  CardUXState,
  LegalHandSummary,
  CardUrgencyLevel,
} from './CardLegalityService';

import { DeckComposer } from './DeckComposer';
import type {
  DeckCompositionResult,
} from './DeckComposer';

import type {
  CardModeInsight,
  HandScoringProfile,
  DeckScoringHealthReport,
  ScoreTierLabel,
  DetailedScoringExplanation,
} from './types';

import {
  buildCardModeInsight,
  buildHandScoringProfile,
  buildDeckScoringHealthReport,
  buildDetailedScoringExplanation,
  classifyScoreTier,
  scoreCardForMode,
  rankCardsForMode,
  listPrimaryDecksForMode,
  listSuppressedDecksForMode,
  getModeDoctrine,
  SCORE_TIER_THRESHOLDS,
} from './types';

import {
  warmCardTargetingDoctrine,
  assertTargetDoctrineHealthy,
  getTargetingsByMode,
  isDeckTypePlayableInMode,
  getTargetingLabel,
  getTargetingStatusBadge,
  getFirstBlockingReason,
  explainBlockingReason,
  listAllTargetings,
  getModeTargetingSummary,
  getDeckTargetingSummary,
  sortTargetingsByCanonicalOrder,
  targetingsAreEquivalent,
} from './CardTargetingResolver';

import {
  getTimingClassesForMode,
  getTimingClassesForDeckType,
  getModeTimingDoctrine,
  getLowTrustThreshold,
  getElevatedPressureScore,
  getPhaseBoundaryHighUrgencyRemaining,
  getPhaseBoundaryMediumUrgencyRemaining,
  getPhaseBoundaryLowUrgencyRemaining,
  getTimingOrder,
} from './CardTimingValidator';

import {
  cardUrgencyLevelLabel,
  cardUrgencyAccentClass,
  listBattleBudgetDeckTypes,
  listGhostAnchoredDeckTypes,
} from './CardLegalityService';

import {
  listPressureThresholds,
  listTrustThresholds,
  listOverlayDefaultContextValues,
  getDefaultDrawPileSize,
  getDefaultDeckEntropy,
} from './CardOverlayResolver';

/* ────────────────────────────────────────────────────────────────────────────
 * SECTION 4  ·  Cross-system types and interfaces
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Full cross-system evaluation for a single card (as a `CardInstance`) in a
 * given run state.
 *
 * Combines:
 *   - Timing audit from `CardTimingValidator`    (.timingAudit)
 *   - Target allowance from `CardTargetingResolver` (.targetAllowance)
 *   - Legality UX state from `CardLegalityService`  (.legalityUXState)
 *   - Score insight from the `types.ts` scoring layer (.modeInsight)
 *
 * Used by:
 *   - AI planner to decide which card to play next
 *   - UX card tooltip — complete card state in a single pass
 *   - Chat narrator to describe what is and isn't playable
 *   - Drama engine to understand narrative opportunity cost
 */
export interface CardFullEvaluation {
  /** The runtime card instance that was evaluated. */
  readonly card: CardInstance;
  /** The mode in which the evaluation was performed. */
  readonly mode: ModeCode;
  /** Whether the card passes ALL sub-system checks and can be played now. */
  readonly isPlayableNow: boolean;
  /** Whether the timing window is currently open for this card. */
  readonly timingAllowed: boolean;
  /** Whether a valid target exists for this card. */
  readonly targetingAllowed: boolean;
  /** Raw timing audit result from CardTimingValidator. */
  readonly timingAudit: CardTimingAudit;
  /** Raw target allowance result from CardTargetingResolver. */
  readonly targetAllowance: TargetAllowance;
  /** UX state from CardLegalityService (urgency, accent, blockingCheck). */
  readonly legalityUXState: CardUXState;
  /** Mode-level scoring insight from types.ts. */
  readonly modeInsight: CardModeInsight;
  /** Numeric mode score (0–100 normalised). */
  readonly modeScore: number;
  /** Tier classification for UX display. */
  readonly scoreTier: ScoreTierLabel;
  /** Human-readable blocking reason, or null if fully playable. */
  readonly blockingReason: string | null;
  /** UX urgency signal — how time-sensitive this card is right now. */
  readonly urgencyLevel: CardUrgencyLevel;
  /** Whether this card represents a reaction opportunity live right now. */
  readonly isReactionOpportunity: boolean;
  /** AI planner recommended action ('PLAY' | 'HOLD' | 'BENCH'). */
  readonly recommendation: 'PLAY' | 'HOLD' | 'BENCH';
}

/**
 * Matrix describing which cards in a hand can be played right now.
 *
 * Used by:
 *   - UX hand display to grey out blocked cards
 *   - AI planner to filter candidate set before scoring
 *   - Chat narrator to describe the play state concisely
 */
export interface HandPlayabilityMatrix {
  /** Mode of the snapshot used for this matrix. */
  readonly mode: ModeCode;
  /** Total cards evaluated. */
  readonly totalCards: number;
  /** Cards that are fully playable (timing + targeting both allowed). */
  readonly playableCards: readonly CardFullEvaluation[];
  /** Cards blocked by timing only. */
  readonly timingBlockedCards: readonly CardFullEvaluation[];
  /** Cards blocked by targeting only. */
  readonly targetingBlockedCards: readonly CardFullEvaluation[];
  /** Cards blocked by both timing and targeting simultaneously. */
  readonly multiBlockedCards: readonly CardFullEvaluation[];
  /** True if any card in hand can be played right now. */
  readonly hasAnyPlayable: boolean;
  /** True if a critical urgency card is in the playable set. */
  readonly hasCriticalWindow: boolean;
  /** True if any playable card is SIGNATURE or PREMIUM tier. */
  readonly hasHighValuePlay: boolean;
  /** The single best card to play right now by mode score, or null. */
  readonly bestPlay: CardFullEvaluation | null;
  /** Urgency summary across the entire hand. */
  readonly handUrgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

/**
 * Complete cross-system hand summary for UX surfaces, AI planner, and narrator.
 *
 * Combines the playability matrix, scoring profile, timing summary, and
 * targeting summary into a single pre-computed object.
 *
 * Used by:
 *   - UX hand header (strength badge, play count, urgency indicator)
 *   - AI planner context for turn decision
 *   - Chat narration before first action
 *   - After-action generator for hand summary narration
 */
export interface CardSystemHandSummary {
  readonly mode: ModeCode;
  readonly playability: HandPlayabilityMatrix;
  readonly scoring: HandScoringProfile;
  readonly timing: TimingHandSummary;
  readonly targeting: TargetingHandSummary;
  readonly fullyPlayableCount: number;
  readonly isHandFullyBlocked: boolean;
  readonly hasElitePlay: boolean;
  readonly headline: string;
  readonly subtitle: string;
  readonly aiRecommendation: string;
}

/**
 * Cross-system deck health insight for the deck review screen and AI planner.
 *
 * Used by:
 *   - Deck review screen (grade, composition breakdown, warnings)
 *   - AI pre-game planner (weaknesses to exploit / strengths to leverage)
 *   - Chat narrator during deck construction
 */
export interface CardSystemDeckInsight {
  readonly mode: ModeCode;
  readonly scoringHealth: DeckScoringHealthReport;
  readonly timingClassCoverage: Readonly<Record<TimingClass, number>>;
  readonly targetingCoverageScore: number;
  readonly deckTypesPresent: readonly DeckType[];
  readonly missingPrimaryDeckTypes: readonly DeckType[];
  readonly suppressedDeckTypesPresent: readonly DeckType[];
  readonly battleBudgetTimingCoverage: boolean;
  readonly ghostAnchorTimingCoverage: boolean;
  readonly reachableTargetings: readonly Targeting[];
  readonly compositionGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly compositionSummary: string;
  readonly improvementSuggestions: readonly string[];
}

/**
 * Full diagnostic report for the entire cards sub-system.
 *
 * Used by:
 *   - Backend health-check endpoints
 *   - CI integration test suite
 *   - Liveops audit dashboards
 */
export interface CardSystemDiagnosticReport {
  readonly isHealthy: boolean;
  readonly subsystemHealth: {
    readonly targetingDoctrineHealthy: boolean;
    readonly timingDoctrineHealthy: boolean;
    readonly overlayContextHealthy: boolean;
    readonly scoreTierThresholdsHealthy: boolean;
  };
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly timingClassesCovered: number;
  readonly totalTimingClasses: number;
  readonly modeDoctrinesCovered: number;
  readonly scoreTierThresholdsValid: boolean;
  readonly overlayContextDefaults: Readonly<Record<string, number>>;
  readonly generatedAt: string;
}

/**
 * Session-level card analytics digest for AI planners and after-action review.
 *
 * Used by:
 *   - AI planning agent to reason about card economy over a session
 *   - After-action generator to narrate card usage patterns
 *   - ML/DL layer for feature extraction (card play patterns → outcome labels)
 */
export interface CardSessionDigest {
  readonly modesObserved: readonly ModeCode[];
  readonly totalEvaluations: number;
  readonly totalPlayed: number;
  readonly totalHeld: number;
  readonly totalBenched: number;
  readonly averageScore: number;
  readonly tierDistribution: Readonly<Record<ScoreTierLabel, number>>;
  readonly topBlockingReason: string | null;
  readonly topVersatileCardIds: readonly string[];
  readonly hadCriticalTimingWindows: boolean;
  readonly eliteCardUtilisation: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * SECTION 5  ·  CardSystemOrchestrator class
 *
 * This is the canonical cross-system wiring layer.  It composes all 5 runtime
 * sub-system classes — validator, resolver, legality, composer, registry — into
 * a single evaluation surface that the engine master barrel (engine/index.ts)
 * exposes as `Cards.*`.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Cross-system orchestrator for the cards sub-system.
 *
 * Wires together:
 *   - `CardTimingValidator`   — window legality + urgency
 *   - `CardTargetingResolver` — target reach + advisory
 *   - `CardLegalityService`   — UX state + hand summary
 *   - `DeckComposer`          — composition & definition buckets
 *
 * Every public method returns fully-typed, UX-ready structures that feed
 * directly into the chat narrator, AI planner, UX hand display, and the
 * ML/DL feature extraction pipeline.
 *
 * Usage:
 *   ```typescript
 *   import { Cards } from '../../engine';
 *   const orchestrator = new Cards.CardSystemOrchestrator(
 *     timingValidator, targetingResolver, legalityService, deckComposer
 *   );
 *   const matrix = orchestrator.buildHandPlayabilityMatrix(hand, snapshot, mode);
 *   ```
 */
export class CardSystemOrchestrator {
  constructor(
    private readonly timingValidator: CardTimingValidator,
    private readonly targetingResolver: CardTargetingResolver,
    private readonly legalityService: CardLegalityService,
    private readonly deckComposer: DeckComposer,
  ) {}

  /* ── Single-card evaluation ────────────────────────────────────────────── */

  /**
   * Full cross-system evaluation for a single `CardInstance`.
   *
   * Runs the card through timing, targeting, and legality sub-systems in a
   * single pass and builds a comprehensive `CardFullEvaluation` that contains
   * everything the UX, AI planner, and narrator need.
   *
   * Uses `.card` (the `CardDefinition`) for scoring, and the instance itself
   * for runtime evaluation.
   */
  evaluateCard(
    card: CardInstance,
    snapshot: RunStateSnapshot,
    mode: ModeCode,
  ): CardFullEvaluation {
    const timingAudit = this.timingValidator.evaluate(snapshot, card);
    const targetAllowance = this.targetingResolver.evaluate(
      snapshot,
      card,
      card.targeting,
    );
    const legalityUXState = this.legalityService.buildUXCardState(
      snapshot,
      card.definitionId,
      card.targeting,
    );
    const def = card.card;
    const modeInsight = buildCardModeInsight(def, mode);
    const modeScore = scoreCardForMode(def, mode);
    const scoreTier = classifyScoreTier(modeScore, mode);

    const timingAllowed = timingAudit.allowed;
    const targetingAllowed = targetAllowance.allowed;
    const isPlayableNow = timingAllowed && targetingAllowed;

    // Recommendation for AI planner
    let recommendation: CardFullEvaluation['recommendation'];
    if (isPlayableNow && (scoreTier === 'SIGNATURE' || scoreTier === 'PREMIUM')) {
      recommendation = 'PLAY';
    } else if (!timingAllowed && targetingAllowed) {
      recommendation = 'HOLD'; // timing-blocked; will open
    } else if (scoreTier === 'SUPPRESSED') {
      recommendation = 'BENCH';
    } else if (isPlayableNow) {
      recommendation = modeScore >= 30 ? 'PLAY' : 'HOLD';
    } else {
      recommendation = 'HOLD';
    }

    // Blocking reason
    let blockingReason: string | null = null;
    if (!isPlayableNow) {
      if (!timingAllowed) {
        blockingReason = timingAudit.summary
          ? `Timing blocked: ${timingAudit.summary}`
          : 'Timing window not open';
      } else if (!targetingAllowed) {
        const code = getFirstBlockingReason(targetAllowance);
        blockingReason = code
          ? explainBlockingReason(code)
          : 'No valid target';
      }
    }

    // Urgency level
    const urgencyLevel = this.deriveUrgencyLevel(
      timingAudit,
      isPlayableNow,
      scoreTier,
    );

    // Reaction opportunity: timing allowed AND card has reaction timing class
    const reactionTimings: TimingClass[] = ['CTR', 'RES', 'AID', 'CAS', 'PSK'];
    const isReactionOpportunity =
      timingAllowed &&
      card.timingClass.some((t) => reactionTimings.includes(t));

    return Object.freeze({
      card,
      mode,
      isPlayableNow,
      timingAllowed,
      targetingAllowed,
      timingAudit,
      targetAllowance,
      legalityUXState,
      modeInsight,
      modeScore,
      scoreTier,
      blockingReason,
      urgencyLevel,
      isReactionOpportunity,
      recommendation,
    });
  }

  /**
   * Evaluate an entire hand of `CardInstance` objects in a single pass.
   *
   * Preserves hand order. All sub-system calls are per-card.
   */
  evaluateHand(
    hand: readonly CardInstance[],
    snapshot: RunStateSnapshot,
    mode: ModeCode,
  ): readonly CardFullEvaluation[] {
    return hand.map((card) => this.evaluateCard(card, snapshot, mode));
  }

  /* ── Hand playability matrix ───────────────────────────────────────────── */

  /**
   * Build the full `HandPlayabilityMatrix` for a hand of `CardInstance`.
   *
   * Consumed by:
   *   - UX hand display (grey-out logic)
   *   - AI planner candidate set construction
   *   - Chat narrator ("You have 3 playable cards, 1 is SIGNATURE tier")
   */
  buildHandPlayabilityMatrix(
    hand: readonly CardInstance[],
    snapshot: RunStateSnapshot,
    mode: ModeCode,
  ): HandPlayabilityMatrix {
    const evaluations = this.evaluateHand(hand, snapshot, mode);

    const playableCards: CardFullEvaluation[] = [];
    const timingBlockedCards: CardFullEvaluation[] = [];
    const targetingBlockedCards: CardFullEvaluation[] = [];
    const multiBlockedCards: CardFullEvaluation[] = [];

    for (const ev of evaluations) {
      if (ev.isPlayableNow) {
        playableCards.push(ev);
        continue;
      }
      const bothBlocked = !ev.timingAllowed && !ev.targetingAllowed;
      if (bothBlocked) {
        multiBlockedCards.push(ev);
      } else if (!ev.timingAllowed) {
        timingBlockedCards.push(ev);
      } else {
        targetingBlockedCards.push(ev);
      }
    }

    const hasAnyPlayable = playableCards.length > 0;
    const hasCriticalWindow = evaluations.some(
      (ev) => ev.urgencyLevel === 'CRITICAL',
    );
    const hasHighValuePlay = playableCards.some(
      (ev) => ev.scoreTier === 'SIGNATURE' || ev.scoreTier === 'PREMIUM',
    );

    const bestPlay =
      playableCards.length > 0
        ? playableCards.reduce((best, ev) =>
            ev.modeScore > best.modeScore ? ev : best,
          )
        : null;

    const handUrgency = this.deriveHandUrgency(evaluations);

    return Object.freeze({
      mode,
      totalCards: hand.length,
      playableCards: Object.freeze(playableCards),
      timingBlockedCards: Object.freeze(timingBlockedCards),
      targetingBlockedCards: Object.freeze(targetingBlockedCards),
      multiBlockedCards: Object.freeze(multiBlockedCards),
      hasAnyPlayable,
      hasCriticalWindow,
      hasHighValuePlay,
      bestPlay,
      handUrgency,
    });
  }

  /* ── Full hand summary ─────────────────────────────────────────────────── */

  /**
   * Build the complete `CardSystemHandSummary` combining playability, scoring,
   * timing and targeting into a single UX-ready structure.
   *
   * This is the single most comprehensive hand-state object in the system.
   * It is the canonical input to the UX hand header, AI turn-decision planner,
   * and the chat narrator before each decision round.
   */
  buildHandSummary(
    hand: readonly CardInstance[],
    snapshot: RunStateSnapshot,
    mode: ModeCode,
  ): CardSystemHandSummary {
    const playability = this.buildHandPlayabilityMatrix(hand, snapshot, mode);
    const definitions = hand.map((c) => c.card);
    const scoring = buildHandScoringProfile(definitions, mode);
    const timing = this.timingValidator.buildHandTimingSummary(snapshot, hand);
    const targeting = this.targetingResolver.buildHandTargetingSummary(
      snapshot,
      hand,
    );

    const fullyPlayableCount = playability.playableCards.length;
    const isHandFullyBlocked = hand.length > 0 && fullyPlayableCount === 0;
    const hasElitePlay = playability.playableCards.some(
      (ev) => ev.scoreTier === 'SIGNATURE' || ev.scoreTier === 'PREMIUM',
    );

    const headline = this.buildHandHeadline(playability, scoring, mode);
    const subtitle = this.buildHandSubtitle(playability, timing, targeting);
    const aiRecommendation = this.buildAiRecommendation(
      playability,
      scoring,
      targeting,
    );

    return Object.freeze({
      mode,
      playability,
      scoring,
      timing,
      targeting,
      fullyPlayableCount,
      isHandFullyBlocked,
      hasElitePlay,
      headline,
      subtitle,
      aiRecommendation,
    });
  }

  /* ── Deck composition orchestration ───────────────────────────────────── */

  /**
   * Compose a doctrine-aligned deck for the given mode.
   *
   * Delegates to `DeckComposer.composeDoctrineDeck` and pairs the result with
   * a full `CardSystemDeckInsight` for UX display.
   */
  composeAndAnalyseDeck(
    mode: ModeCode,
    size = 20,
  ): { composition: DeckCompositionResult; insight: CardSystemDeckInsight } {
    const composition = this.deckComposer.composeDoctrineDeck(mode, size);
    const insight = this.buildDeckInsight(composition.definitions, mode);
    return { composition, insight };
  }

  /**
   * Build a `CardSystemDeckInsight` for any set of `CardDefinition` objects.
   *
   * Used to analyse both freshly composed decks and any existing deck.
   */
  buildDeckInsight(
    cards: readonly CardDefinition[],
    mode: ModeCode,
  ): CardSystemDeckInsight {
    const scoringHealth = buildDeckScoringHealthReport(cards, mode);

    // Timing class coverage — count per class
    const timingClassCoverage: Record<TimingClass, number> = {} as Record<
      TimingClass,
      number
    >;
    for (const tc of getTimingOrder()) {
      timingClassCoverage[tc] = cards.filter((c) =>
        c.timingClass.includes(tc),
      ).length;
    }

    // Targeting coverage — fraction of all possible targetings represented
    const allTargetings = listAllTargetings();
    const reachableSet = new Set<Targeting>();
    for (const c of cards) {
      reachableSet.add(c.targeting);
    }
    const reachableTargetings = Array.from(reachableSet) as Targeting[];
    const targetingCoverageScore =
      reachableTargetings.length / Math.max(allTargetings.length, 1);

    // Deck types present
    const deckTypesPresent = Array.from(
      new Set(cards.map((c) => c.deckType)),
    ) as DeckType[];
    const primaryDecks = listPrimaryDecksForMode(mode);
    const suppressedDecks = listSuppressedDecksForMode(mode);
    const missingPrimaryDeckTypes = primaryDecks.filter(
      (dt) => !deckTypesPresent.includes(dt),
    );
    const suppressedDeckTypesPresent = deckTypesPresent.filter((dt) =>
      suppressedDecks.includes(dt),
    );

    // Battle budget and ghost anchor timing coverage
    const battleBudgetTypes = listBattleBudgetDeckTypes();
    const ghostAnchorTypes = listGhostAnchoredDeckTypes();
    const battleBudgetTimingCoverage = battleBudgetTypes.every((dt) =>
      cards
        .filter((c) => c.deckType === dt)
        .some((c) => c.timingClass.length > 0),
    );
    const ghostAnchorTimingCoverage = ghostAnchorTypes.every((dt) =>
      cards
        .filter((c) => c.deckType === dt)
        .some((c) => c.timingClass.length > 0),
    );

    // Composition grade
    const compositionGrade = this.deriveCompositionGrade(
      scoringHealth.overallGrade,
      missingPrimaryDeckTypes.length,
      suppressedDeckTypesPresent.length,
      targetingCoverageScore,
    );

    const compositionSummary = this.buildCompositionSummary(
      mode,
      compositionGrade,
      scoringHealth,
      missingPrimaryDeckTypes,
      suppressedDeckTypesPresent,
    );

    const improvementSuggestions = this.buildImprovementSuggestions(
      mode,
      missingPrimaryDeckTypes,
      suppressedDeckTypesPresent,
      scoringHealth,
      timingClassCoverage,
    );

    return Object.freeze({
      mode,
      scoringHealth,
      timingClassCoverage: Object.freeze(timingClassCoverage),
      targetingCoverageScore,
      deckTypesPresent: Object.freeze(deckTypesPresent),
      missingPrimaryDeckTypes: Object.freeze(missingPrimaryDeckTypes),
      suppressedDeckTypesPresent: Object.freeze(suppressedDeckTypesPresent),
      battleBudgetTimingCoverage,
      ghostAnchorTimingCoverage,
      reachableTargetings: Object.freeze(reachableTargetings),
      compositionGrade,
      compositionSummary,
      improvementSuggestions: Object.freeze(improvementSuggestions),
    });
  }

  /* ── System diagnostics ────────────────────────────────────────────────── */

  /**
   * Run a full health check across all cards sub-system doctrine assertions.
   *
   * Runs:
   *   - `assertTargetDoctrineHealthy()` from CardTargetingResolver
   *   - Score tier thresholds validation
   *   - Overlay context defaults validation
   *   - Timing doctrine coverage check
   *
   * Called by:
   *   - Backend `/health` endpoint
   *   - CI integration test suite
   *   - Liveops audit dashboard on deploy
   */
  runHealthCheck(): CardSystemDiagnosticReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Targeting doctrine
    let targetingDoctrineHealthy = true;
    try {
      assertTargetDoctrineHealthy();
    } catch (err) {
      targetingDoctrineHealthy = false;
      errors.push(
        `Targeting doctrine: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 2. Timing doctrine — coverage across all modes
    let timingDoctrineHealthy = true;
    let timingClassesCovered = 0;
    const allTimingClasses = getTimingOrder();
    for (const tc of allTimingClasses) {
      const hasModeCoverage = MODE_CODES.some((m) =>
        getModeTimingDoctrine(m).includes(tc),
      );
      if (hasModeCoverage) {
        timingClassesCovered++;
      } else {
        warnings.push(`TimingClass '${tc}' has no mode doctrine coverage.`);
      }
    }
    if (timingClassesCovered < allTimingClasses.length * 0.8) {
      timingDoctrineHealthy = false;
      errors.push('Timing doctrine coverage below 80% threshold.');
    }

    // 3. Overlay context defaults
    let overlayContextHealthy = true;
    const overlayDefaults = listOverlayDefaultContextValues();
    if (Object.keys(overlayDefaults).length === 0) {
      overlayContextHealthy = false;
      errors.push('Overlay context defaults are empty.');
    }

    // 4. Score tier thresholds
    let scoreTierThresholdsValid = true;
    for (const mode of MODE_CODES) {
      if (!SCORE_TIER_THRESHOLDS[mode]) {
        scoreTierThresholdsValid = false;
        errors.push(
          `SCORE_TIER_THRESHOLDS missing entry for mode: '${mode}'`,
        );
      }
    }
    const scoreTierThresholdsHealthy = scoreTierThresholdsValid;

    const isHealthy = errors.length === 0;

    return Object.freeze({
      isHealthy,
      subsystemHealth: Object.freeze({
        targetingDoctrineHealthy,
        timingDoctrineHealthy,
        overlayContextHealthy,
        scoreTierThresholdsHealthy,
      }),
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
      timingClassesCovered,
      totalTimingClasses: allTimingClasses.length,
      modeDoctrinesCovered: MODE_CODES.length,
      scoreTierThresholdsValid,
      overlayContextDefaults: Object.freeze(overlayDefaults),
      generatedAt: new Date().toISOString(),
    });
  }

  /* ── Session digest ────────────────────────────────────────────────────── */

  /**
   * Build a `CardSessionDigest` from a collection of evaluations.
   *
   * Used by:
   *   - After-action generator to narrate card economy patterns
   *   - ML/DL feature extraction pipeline
   *   - Liveops analytics dashboard
   */
  buildSessionDigest(
    evaluations: readonly CardFullEvaluation[],
    modesObserved: readonly ModeCode[],
  ): CardSessionDigest {
    const emptyTiers: Record<ScoreTierLabel, number> = {
      SIGNATURE: 0,
      PREMIUM: 0,
      SOLID: 0,
      AVERAGE: 0,
      WEAK: 0,
      SUPPRESSED: 0,
    };
    if (evaluations.length === 0) {
      return Object.freeze({
        modesObserved: Object.freeze(modesObserved),
        totalEvaluations: 0,
        totalPlayed: 0,
        totalHeld: 0,
        totalBenched: 0,
        averageScore: 0,
        tierDistribution: Object.freeze(emptyTiers),
        topBlockingReason: null,
        topVersatileCardIds: Object.freeze([]),
        hadCriticalTimingWindows: false,
        eliteCardUtilisation: 0,
      });
    }

    const totalPlayed = evaluations.filter(
      (e) => e.recommendation === 'PLAY',
    ).length;
    const totalHeld = evaluations.filter(
      (e) => e.recommendation === 'HOLD',
    ).length;
    const totalBenched = evaluations.filter(
      (e) => e.recommendation === 'BENCH',
    ).length;
    const averageScore =
      evaluations.reduce((sum, e) => sum + e.modeScore, 0) /
      evaluations.length;

    const tierDistribution: Record<ScoreTierLabel, number> = { ...emptyTiers };
    for (const ev of evaluations) {
      tierDistribution[ev.scoreTier]++;
    }

    // Top blocking reason
    const reasonCounts = new Map<string, number>();
    for (const ev of evaluations) {
      if (ev.blockingReason) {
        const prefix = ev.blockingReason.split(':')[0].trim();
        reasonCounts.set(prefix, (reasonCounts.get(prefix) ?? 0) + 1);
      }
    }
    let topBlockingReason: string | null = null;
    let topCount = 0;
    for (const [reason, count] of reasonCounts) {
      if (count > topCount) {
        topBlockingReason = reason;
        topCount = count;
      }
    }

    // Top versatile cards (most often recommended PLAY)
    const cardPlayCounts = new Map<string, number>();
    for (const ev of evaluations) {
      if (ev.recommendation === 'PLAY') {
        const id = ev.card.definitionId;
        cardPlayCounts.set(id, (cardPlayCounts.get(id) ?? 0) + 1);
      }
    }
    const topVersatileCardIds = Array.from(cardPlayCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    const hadCriticalTimingWindows = evaluations.some(
      (e) => e.urgencyLevel === 'CRITICAL',
    );

    const eliteCards = evaluations.filter(
      (e) => e.scoreTier === 'SIGNATURE' || e.scoreTier === 'PREMIUM',
    );
    const eliteCardUtilisation =
      eliteCards.length > 0
        ? eliteCards.filter((e) => e.recommendation === 'PLAY').length /
          eliteCards.length
        : 1;

    return Object.freeze({
      modesObserved: Object.freeze(modesObserved),
      totalEvaluations: evaluations.length,
      totalPlayed,
      totalHeld,
      totalBenched,
      averageScore,
      tierDistribution: Object.freeze(tierDistribution),
      topBlockingReason,
      topVersatileCardIds: Object.freeze(topVersatileCardIds),
      hadCriticalTimingWindows,
      eliteCardUtilisation,
    });
  }

  /* ── Private helpers ───────────────────────────────────────────────────── */

  private deriveUrgencyLevel(
    timingAudit: CardTimingAudit,
    isPlayableNow: boolean,
    scoreTier: ScoreTierLabel,
  ): CardUrgencyLevel {
    if (!isPlayableNow) return 'BLOCKED';
    if (scoreTier === 'SIGNATURE' || scoreTier === 'PREMIUM') {
      return 'CRITICAL';
    }
    if (!timingAudit.allowed) return 'BLOCKED';
    if (scoreTier === 'SUPPRESSED' || scoreTier === 'WEAK') return 'LOW';
    if (scoreTier === 'AVERAGE') return 'LOW';
    if (scoreTier === 'SOLID') return 'MEDIUM';
    return 'HIGH';
  }

  private deriveHandUrgency(
    evaluations: readonly CardFullEvaluation[],
  ): HandPlayabilityMatrix['handUrgency'] {
    // Early-exit on CRITICAL — no need to check further.
    if (evaluations.some((ev) => ev.urgencyLevel === 'CRITICAL')) {
      return 'CRITICAL';
    }
    if (evaluations.some((ev) => ev.urgencyLevel === 'HIGH')) return 'HIGH';
    if (evaluations.some((ev) => ev.urgencyLevel === 'MEDIUM')) return 'MEDIUM';
    if (evaluations.some((ev) => ev.urgencyLevel === 'LOW')) return 'LOW';
    return 'NONE';
  }

  private buildHandHeadline(
    playability: HandPlayabilityMatrix,
    scoring: HandScoringProfile,
    mode: ModeCode,
  ): string {
    if (!playability.hasAnyPlayable) {
      return `Hand locked — no cards playable in ${mode} right now.`;
    }
    if (playability.hasHighValuePlay && playability.hasCriticalWindow) {
      return `CRITICAL — elite play window open in ${mode}. Act now.`;
    }
    if (playability.hasHighValuePlay) {
      return `Strong hand in ${mode} — ${playability.playableCards.length} cards ready.`;
    }
    if (scoring.overallHandStrength === 'STRONG') {
      return `Solid ${mode} hand — ${playability.playableCards.length} plays available.`;
    }
    return `${playability.playableCards.length} of ${playability.totalCards} cards playable in ${mode}.`;
  }

  private buildHandSubtitle(
    playability: HandPlayabilityMatrix,
    timing: TimingHandSummary,
    targeting: TargetingHandSummary,
  ): string {
    const parts: string[] = [];
    if (playability.hasCriticalWindow) {
      parts.push('Critical window active');
    }
    if (timing.criticalUrgencyCount > 0) {
      parts.push(`${timing.criticalUrgencyCount} time-sensitive`);
    }
    if (!targeting.hasAnyCooperativeTarget && targeting.hasAnyOpponentTarget) {
      parts.push('Opponent targets reachable');
    }
    if (playability.multiBlockedCards.length > 0) {
      parts.push(`${playability.multiBlockedCards.length} multi-blocked`);
    }
    return parts.length > 0
      ? parts.join(' · ')
      : 'Play when timing aligns.';
  }

  private buildAiRecommendation(
    playability: HandPlayabilityMatrix,
    scoring: HandScoringProfile,
    targeting: TargetingHandSummary,
  ): string {
    if (!playability.hasAnyPlayable) {
      return 'WAIT — no plays available. Reassess next window.';
    }
    if (
      playability.bestPlay &&
      (playability.bestPlay.scoreTier === 'SIGNATURE' ||
        playability.bestPlay.scoreTier === 'PREMIUM')
    ) {
      return `PLAY ${playability.bestPlay.card.card.name} — elite tier, window is live.`;
    }
    if (playability.hasCriticalWindow) {
      return 'ACT — critical window expires soon. Play highest-score legal card.';
    }
    if (
      scoring.overallHandStrength === 'STRONG' &&
      playability.playableCards.length > 1
    ) {
      return 'PLAY — strong hand, multiple good options available.';
    }
    if (
      targeting.playableCards <
      targeting.totalCards * 0.5
    ) {
      return 'HOLD — targeting reach is limited. Wait for better window.';
    }
    return 'PLAY when the next timing window opens.';
  }

  private deriveCompositionGrade(
    scoringGrade: string,
    missingPrimaryCount: number,
    suppressedPresentCount: number,
    targetingCoverage: number,
  ): CardSystemDeckInsight['compositionGrade'] {
    const gradePoints: Record<string, number> = {
      A: 40,
      B: 30,
      C: 20,
      D: 10,
      F: 0,
    };
    let score = gradePoints[scoringGrade] ?? 0;
    score -= missingPrimaryCount * 10;
    score -= suppressedPresentCount * 5;
    score += Math.round(targetingCoverage * 20);
    if (score >= 55) return 'A';
    if (score >= 40) return 'B';
    if (score >= 25) return 'C';
    if (score >= 10) return 'D';
    return 'F';
  }

  private buildCompositionSummary(
    mode: ModeCode,
    grade: CardSystemDeckInsight['compositionGrade'],
    scoringHealth: DeckScoringHealthReport,
    missingPrimaryDecks: readonly DeckType[],
    suppressedDecksPresent: readonly DeckType[],
  ): string {
    const gradeLabels: Record<string, string> = {
      A: 'excellent',
      B: 'strong',
      C: 'adequate',
      D: 'weak',
      F: 'poor',
    };
    const label = gradeLabels[grade] ?? 'unknown';
    let summary = `${mode} composition is ${label} (Grade ${grade}).`;
    if (missingPrimaryDecks.length > 0) {
      summary += ` Missing primary deck types: ${missingPrimaryDecks.join(', ')}.`;
    }
    if (suppressedDecksPresent.length > 0) {
      summary += ` Suppressed types present: ${suppressedDecksPresent.join(', ')}.`;
    }
    const sigCount = scoringHealth.scoreTierDistribution['SIGNATURE'] ?? 0;
    if (sigCount > 0) {
      summary += ` ${sigCount} signature cards anchor the deck.`;
    }
    return summary;
  }

  private buildImprovementSuggestions(
    mode: ModeCode,
    missingPrimaryDecks: readonly DeckType[],
    suppressedDecksPresent: readonly DeckType[],
    scoringHealth: DeckScoringHealthReport,
    timingCoverage: Record<TimingClass, number>,
  ): readonly string[] {
    const suggestions: string[] = [];

    for (const dt of missingPrimaryDecks) {
      suggestions.push(
        `Add ${dt} cards — they are primary doctrine for ${mode}.`,
      );
    }
    for (const dt of suppressedDecksPresent) {
      suggestions.push(
        `Consider benching ${dt} cards — suppressed in ${mode}.`,
      );
    }
    const suppressed = scoringHealth.scoreTierDistribution['SUPPRESSED'] ?? 0;
    const signature = scoringHealth.scoreTierDistribution['SIGNATURE'] ?? 0;
    const weak = scoringHealth.scoreTierDistribution['WEAK'] ?? 0;
    if (suppressed > signature) {
      suggestions.push(
        'Swap suppressed cards for mode-aligned alternatives to raise average score.',
      );
    }
    if (weak > 3) {
      suggestions.push(
        'Multiple WEAK-tier cards detected — replace with SOLID or better.',
      );
    }
    const ghostTimingClasses = getTimingClassesForDeckType('GHOST' as DeckType);
    for (const tc of ghostTimingClasses) {
      if (!timingCoverage[tc] || timingCoverage[tc] === 0) {
        suggestions.push(
          `Add a ${tc} timing card to fill ghost anchor window gap.`,
        );
      }
    }
    if (suggestions.length === 0) {
      suggestions.push(
        'Deck composition is well-balanced for the current mode.',
      );
    }
    return Object.freeze(suggestions);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * SECTION 6  ·  Standalone cross-system utilities
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Filter a hand of `CardInstance` objects to only those where BOTH timing AND
 * targeting sub-systems allow the card to be played.
 *
 * Used by:
 *   - AI planner first-pass candidate filter (before full scoring)
 *   - Hand indicator: "N cards can be targeted right now"
 */
export function filterTimingAndTargetingLegalCards(
  hand: readonly CardInstance[],
  snapshot: RunStateSnapshot,
  timingValidator: CardTimingValidator,
  targetingResolver: CardTargetingResolver,
): readonly CardInstance[] {
  return hand.filter((card) => {
    if (!timingValidator.evaluate(snapshot, card).allowed) return false;
    return targetingResolver.evaluate(snapshot, card, card.targeting).allowed;
  });
}

/**
 * Filter a hand to only `CardInstance` objects that pass timing AND targeting.
 * Also applies a mode-legality pre-check using `CardDefinition.modeLegal`.
 *
 * Used by:
 *   - AI planner tight candidate set construction
 *   - UX "playable now" highlight pass
 */
export function filterModeLegalAndLiveCards(
  hand: readonly CardInstance[],
  snapshot: RunStateSnapshot,
  mode: ModeCode,
  timingValidator: CardTimingValidator,
  targetingResolver: CardTargetingResolver,
): readonly CardInstance[] {
  return hand.filter((card) => {
    if (!card.card.modeLegal.includes(mode)) return false;
    if (!timingValidator.evaluate(snapshot, card).allowed) return false;
    return targetingResolver.evaluate(snapshot, card, card.targeting).allowed;
  });
}

/**
 * Rank a hand by mode score with a live-timing bonus.
 *
 * Cards where timing is allowed receive a 20% bonus so a lower-scored live
 * card can outrank a higher-scored blocked card.
 *
 * Used by:
 *   - AI planner to prioritise the next action
 *   - UX card display to sort hand by current play priority
 */
export function rankHandByLiveScore(
  hand: readonly CardInstance[],
  snapshot: RunStateSnapshot,
  mode: ModeCode,
  timingValidator: CardTimingValidator,
): readonly CardInstance[] {
  const scored = hand.map((card) => {
    const base = scoreCardForMode(card.card, mode);
    const liveBonus = timingValidator.evaluate(snapshot, card).allowed
      ? base * 0.2
      : 0;
    return { card, score: base + liveBonus };
  });
  return scored.sort((a, b) => b.score - a.score).map((s) => s.card);
}

/**
 * Build a targeting advisory for every card in a hand simultaneously.
 *
 * Returns a map of `instanceId → TargetingAdvisory` for efficient UX rendering.
 *
 * Used by:
 *   - UX tooltip renderer (show advisory per card on hover)
 *   - AI planner (understand which targets are available before choosing)
 */
export function buildHandTargetingAdvisoryMap(
  hand: readonly CardInstance[],
  snapshot: RunStateSnapshot,
  targetingResolver: CardTargetingResolver,
): ReadonlyMap<string, TargetingAdvisory> {
  const map = new Map<string, TargetingAdvisory>();
  for (const card of hand) {
    const advisory = targetingResolver.buildTargetingAdvisory(
      snapshot,
      card,
      card.targeting,
    );
    map.set(card.instanceId, advisory);
  }
  return map;
}

/**
 * Build a targeting batch result for a hand of `CardInstance` objects.
 *
 * Each card is evaluated against its own `.targeting` value.  Returns a flat
 * array of `TargetingBatchResult` in hand order.
 *
 * Used by:
 *   - Bulk UX targeting overlay update
 *   - AI planner targeting sweep before scoring
 */
export function buildHandTargetingBatch(
  hand: readonly CardInstance[],
  snapshot: RunStateSnapshot,
  targetingResolver: CardTargetingResolver,
): readonly TargetingBatchResult[] {
  return hand.map((card) => ({
    card,
    targeting: card.targeting,
    allowance: targetingResolver.evaluate(snapshot, card, card.targeting),
  }));
}

/**
 * Build the timing advisory for every card in a hand.
 *
 * Returns a `TimingWindowAdvisory` for each card, preserving hand order.
 *
 * Used by:
 *   - UX timing indicator overlay
 *   - AI planner timing context
 */
export function buildHandTimingAdvisories(
  hand: readonly CardInstance[],
  snapshot: RunStateSnapshot,
  timingValidator: CardTimingValidator,
): readonly TimingWindowAdvisory[] {
  return hand.map((card) =>
    timingValidator.buildTimingWindowAdvisory(snapshot, card),
  );
}

/**
 * Build the `CardUXState` for every card in a hand.
 *
 * Returns a map of `instanceId → CardUXState` ready for direct rendering.
 *
 * Used by:
 *   - UX card rendering layer (single call populates all card badges)
 *   - Chat narrator to describe urgency in natural language
 */
export function buildHandUXStateMap(
  hand: readonly CardInstance[],
  snapshot: RunStateSnapshot,
  legalityService: CardLegalityService,
): ReadonlyMap<string, CardUXState> {
  const map = new Map<string, CardUXState>();
  for (const card of hand) {
    const uxState = legalityService.buildUXCardState(
      snapshot,
      card.definitionId,
      card.targeting,
    );
    map.set(card.instanceId, uxState);
  }
  return map;
}

/**
 * Build the `LegalHandSummary` for the current snapshot and hand.
 *
 * Used by:
 *   - UX hand header (blocked count badge)
 *   - AI planner hand state pre-check
 */
export function buildLegalHandSummary(
  hand: readonly CardInstance[],
  snapshot: RunStateSnapshot,
  legalityService: CardLegalityService,
): LegalHandSummary {
  return legalityService.buildLegalHandSummary(
    snapshot,
    hand.map((c) => ({ definitionId: c.definitionId, target: c.targeting })),
  );
}

/**
 * Get the detailed scoring explanation for a card's definition in a given mode.
 *
 * Returns the `DetailedScoringExplanation` from the types scoring layer,
 * including per-axis contribution percentages.
 *
 * Used by:
 *   - UX card tooltip (expanded scoring breakdown panel)
 *   - AI planner explainability layer
 *   - Post-game card analytics
 */
export function getCardScoringExplanation(
  card: CardDefinition,
  mode: ModeCode,
): DetailedScoringExplanation {
  return buildDetailedScoringExplanation(card, mode);
}

/**
 * Get the mode doctrine summary for UX display.
 *
 * Returns the canonical doctrine profile for a mode as a human-readable string
 * for mode tooltips or AI context injection.
 */
export function getModeDoctrineLabel(mode: ModeCode): string {
  const doctrine = getModeDoctrine(mode);
  const timingClasses = getModeTimingDoctrine(mode);
  const primaryDecks = listPrimaryDecksForMode(mode);
  return [
    `Mode: ${mode}`,
    `Primary decks: ${primaryDecks.join(', ') || 'none'}`,
    `Timing classes: ${timingClasses.join(', ') || 'none'}`,
    `Preferred targeting: ${getTargetingsByMode(mode).join(', ') || 'any'}`,
    `Preferred divergence: ${doctrine.preferredDivergence.join(', ') ?? 'any'}`,
  ].join(' | ');
}

/**
 * Get a targeting advisory for a specific mode + deck type combination.
 *
 * Returns the targeting advisory string for the UX mode selector or
 * deck type filter dropdown.
 *
 * Used by:
 *   - Deck builder mode selector (show mode-deck targeting compatibility)
 *   - Targeting doctrine audit
 */
export function getModeAndDeckTargetingAdvisory(
  mode: ModeCode,
  deckType: DeckType,
): string {
  const modeSummary = getModeTargetingSummary(mode);
  const deckSummary = getDeckTargetingSummary(deckType);
  const isPlayable = isDeckTypePlayableInMode(deckType, mode);
  return [
    `Mode: ${modeSummary}`,
    `Deck: ${deckSummary}`,
    `Compatibility: ${isPlayable ? 'COMPATIBLE' : 'SUPPRESSED'}`,
  ].join(' · ');
}

/**
 * Determine whether a hand contains at least one elite-tier (SIGNATURE or
 * PREMIUM) card that can be played right now.
 *
 * Fast-path check — the UX uses this to show the "elite play available"
 * indicator without running the full playability matrix.
 */
export function handHasElitePlayNow(
  hand: readonly CardInstance[],
  snapshot: RunStateSnapshot,
  mode: ModeCode,
  timingValidator: CardTimingValidator,
  targetingResolver: CardTargetingResolver,
): boolean {
  for (const card of hand) {
    const score = scoreCardForMode(card.card, mode);
    const tier = classifyScoreTier(score, mode);
    if (tier !== 'SIGNATURE' && tier !== 'PREMIUM') continue;
    if (!timingValidator.evaluate(snapshot, card).allowed) continue;
    if (!targetingResolver.evaluate(snapshot, card, card.targeting).allowed) {
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Get the top N cards from a hand ranked by live play priority.
 *
 * Combines mode score with timing legality bonus (20%) and targeting
 * reachability bonus (10%).
 *
 * Used by:
 *   - AI planner top-N candidate selection
 *   - UX hand "recommended plays" indicator
 */
export function getTopNHandPlays(
  hand: readonly CardInstance[],
  snapshot: RunStateSnapshot,
  mode: ModeCode,
  n: number,
  timingValidator: CardTimingValidator,
  targetingResolver: CardTargetingResolver,
): readonly CardInstance[] {
  const scored = hand.map((card) => {
    const base = scoreCardForMode(card.card, mode);
    const timingBonus = timingValidator.evaluate(snapshot, card).allowed
      ? base * 0.2
      : 0;
    const targetingBonus = targetingResolver
      .evaluate(snapshot, card, card.targeting)
      .allowed
      ? base * 0.1
      : 0;
    return { card, score: base + timingBonus + targetingBonus };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((s) => s.card);
}

/**
 * Build a cross-mode score vector for a `CardDefinition`.
 *
 * Returns the score for the card in each known mode, useful for versatility
 * analysis and AI cross-mode planning.
 *
 * Used by:
 *   - AI planner cross-mode strategy model
 *   - Card comparison UX widget (shows score per mode)
 *   - ML feature extraction (card cross-mode score vector → versatility label)
 */
export function buildCardCrossModeScoreVector(
  card: CardDefinition,
): Readonly<Record<ModeCode, number>> {
  const vector: Partial<Record<ModeCode, number>> = {};
  for (const mode of MODE_CODES) {
    vector[mode] = scoreCardForMode(card, mode);
  }
  return Object.freeze(vector) as Readonly<Record<ModeCode, number>>;
}

/**
 * Build the targeting doctrine summary for a full mode × targeting matrix.
 *
 * Returns a string suitable for logging or liveops audit display.
 *
 * Used by:
 *   - Liveops audit dashboard
 *   - Backend health report
 *   - CI doctrine coverage test output
 */
export function buildTargetingDoctrineMatrix(): string {
  const lines: string[] = ['Targeting Doctrine Matrix (mode × targeting):'];
  for (const mode of MODE_CODES) {
    const targetings = getTargetingsByMode(mode);
    lines.push(
      `  ${mode}: ${targetings.length > 0 ? targetings.join(', ') : '(none)'}`,
    );
  }
  return lines.join('\n');
}

/**
 * Build a natural-language narration string describing the current hand state.
 *
 * Used by:
 *   - Chat narrator (injected as context before the player acts)
 *   - AI planner turn briefing
 *   - After-action generator turn summary
 */
export function narrateHandState(
  hand: readonly CardInstance[],
  snapshot: RunStateSnapshot,
  mode: ModeCode,
  timingValidator: CardTimingValidator,
  targetingResolver: CardTargetingResolver,
): string {
  if (hand.length === 0) {
    return 'Hand is empty — no cards available.';
  }
  const liveCards = filterTimingAndTargetingLegalCards(
    hand,
    snapshot,
    timingValidator,
    targetingResolver,
  );
  const definitions = hand.map((c) => c.card);
  const ranked = rankCardsForMode(definitions, mode);
  const topResult = ranked[0];
  const topDef = topResult?.definition;
  const topScore = topDef ? scoreCardForMode(topDef, mode) : 0;
  const topTier = topDef
    ? classifyScoreTier(topScore, mode)
    : 'AVERAGE';

  const parts: string[] = [];
  parts.push(`Hand: ${hand.length} cards in ${mode}.`);
  parts.push(`${liveCards.length} of ${hand.length} are live right now.`);
  if (topDef && (topTier === 'SIGNATURE' || topTier === 'PREMIUM')) {
    parts.push(
      `Top play: ${topDef.name} (${topTier} tier, score ${topScore.toFixed(1)}).`,
    );
  } else if (topDef) {
    parts.push(`Best available: ${topDef.name} (score ${topScore.toFixed(1)}).`);
  }
  const doctrine = getModeDoctrine(mode);
  if (doctrine.premiumTags && doctrine.premiumTags.length > 0) {
    const premiumTagCards = definitions.filter((c) =>
      c.tags.some((t) => doctrine.premiumTags.includes(t as never)),
    );
    if (premiumTagCards.length > 0) {
      parts.push(
        `${premiumTagCards.length} premium-tag cards for ${mode} doctrine.`,
      );
    }
  }
  return parts.join(' ');
}

/**
 * Build a concise targeting status badge map for the full hand.
 *
 * Maps `instanceId → badge string` (e.g. "ALLOWED", "BLOCKED", "RESTRICTED").
 *
 * Used by:
 *   - UX card badge renderer
 *   - AI planner quick filter
 */
export function buildHandTargetingBadgeMap(
  hand: readonly CardInstance[],
  snapshot: RunStateSnapshot,
  targetingResolver: CardTargetingResolver,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const card of hand) {
    const allowance = targetingResolver.evaluate(
      snapshot,
      card,
      card.targeting,
    );
    map.set(card.instanceId, getTargetingStatusBadge(allowance));
  }
  return map;
}

/**
 * Check whether two hands have equivalent targeting reach in a mode.
 *
 * Used by:
 *   - Deck builder comparison view
 *   - AI planner to detect if a reshuffle improves reach
 */
export function handsHaveEquivalentTargetingReach(
  handA: readonly CardInstance[],
  handB: readonly CardInstance[],
  mode: ModeCode,
): boolean {
  const reachA = new Set<Targeting>();
  const reachB = new Set<Targeting>();
  const modeTargetings = getTargetingsByMode(mode);
  for (const card of handA) {
    if (modeTargetings.includes(card.targeting)) reachA.add(card.targeting);
  }
  for (const card of handB) {
    if (modeTargetings.includes(card.targeting)) reachB.add(card.targeting);
  }
  if (reachA.size !== reachB.size) return false;
  for (const t of reachA) {
    if (!reachB.has(t)) return false;
  }
  return true;
}

/**
 * Compare two targeting arrays for structural equivalence after canonical sort.
 *
 * Used by:
 *   - Deck duplicate detection
 *   - Targeting normalisation before hashing
 */
export function normaliseAndCompareTargetings(
  a: readonly Targeting[],
  b: readonly Targeting[],
): boolean {
  const sortedA = sortTargetingsByCanonicalOrder(a);
  const sortedB = sortTargetingsByCanonicalOrder(b);
  return targetingsAreEquivalent(sortedA, sortedB);
}

/**
 * Get the canonical targeting label for a targeting value in a given mode.
 *
 * Wraps `getTargetingLabel` for the unified import surface.
 *
 * Used by:
 *   - Chat narrator target description
 *   - UX targeting badge tooltip
 */
export function describeTargetingInMode(
  targeting: Targeting,
  mode: ModeCode,
): string {
  return getTargetingLabel(targeting, mode);
}

/* ────────────────────────────────────────────────────────────────────────────
 * SECTION 7  ·  System health and assertion surface
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Warm all cards sub-system doctrine caches.
 *
 * Must be called at application startup BEFORE any card evaluation.
 * Idempotent — safe to call multiple times.
 *
 * Used by:
 *   - Application bootstrap (`engine/index.ts` warms on import)
 *   - Test suites that need a clean doctrine state
 */
export function warmCardSubsystemDoctrines(): void {
  warmCardTargetingDoctrine();
  // SCORE_TIER_THRESHOLDS is computed from a frozen constant — accessing it
  // here ensures it is evaluated before any evaluation request.
  void SCORE_TIER_THRESHOLDS;
}

/**
 * Assert that the entire cards sub-system doctrine is healthy.
 *
 * Throws a descriptive error if any assertion fails.
 *
 * Used by:
 *   - CI integration test final assertion
 *   - Backend startup guard (optional strict mode)
 */
export function assertCardSubsystemHealthy(): void {
  assertTargetDoctrineHealthy();
  for (const mode of MODE_CODES) {
    if (!SCORE_TIER_THRESHOLDS[mode]) {
      throw new Error(
        `assertCardSubsystemHealthy: SCORE_TIER_THRESHOLDS missing mode '${mode}'`,
      );
    }
    const timingClasses = getModeTimingDoctrine(mode);
    if (timingClasses.length === 0) {
      throw new Error(
        `assertCardSubsystemHealthy: getModeTimingDoctrine returned empty for mode '${mode}'`,
      );
    }
    const targetings = getTargetingsByMode(mode);
    if (targetings.length === 0) {
      throw new Error(
        `assertCardSubsystemHealthy: getTargetingsByMode returned empty for mode '${mode}'`,
      );
    }
  }
}

/**
 * Get the full system capability surface for introspection.
 *
 * Returns a snapshot of what the cards sub-system can do — modes, timing
 * classes, targetings, scoring thresholds, and environment constants.
 *
 * Used by:
 *   - API capability endpoint (`GET /engine/cards/capabilities`)
 *   - AI planner context injection
 *   - ML feature schema documentation
 */
export function getCardSubsystemCapabilities(): {
  readonly supportedModes: typeof MODE_CODES;
  readonly timingClasses: readonly TimingClass[];
  readonly targetings: readonly Targeting[];
  readonly lowTrustThreshold: number;
  readonly elevatedPressureScore: number;
  readonly phaseBoundaryThresholds: {
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
  readonly drawPileSize: number;
  readonly deckEntropy: number;
  readonly pressureThresholds: Readonly<Record<string, number>>;
  readonly trustThresholds: Readonly<Record<string, number>>;
} {
  return Object.freeze({
    supportedModes: MODE_CODES,
    timingClasses: getTimingOrder(),
    targetings: listAllTargetings(),
    lowTrustThreshold: getLowTrustThreshold(),
    elevatedPressureScore: getElevatedPressureScore(),
    phaseBoundaryThresholds: Object.freeze({
      high: getPhaseBoundaryHighUrgencyRemaining(),
      medium: getPhaseBoundaryMediumUrgencyRemaining(),
      low: getPhaseBoundaryLowUrgencyRemaining(),
    }),
    drawPileSize: getDefaultDrawPileSize(),
    deckEntropy: getDefaultDeckEntropy(),
    pressureThresholds: listPressureThresholds(),
    trustThresholds: listTrustThresholds(),
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * SECTION 8  ·  UX surface constants and signal keys
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Hand-strength labels for the UX hand header badge.
 *
 * Each label maps to a CSS class and a colour in the design system.
 * Referenced by: UX hand header, chat narrator, after-action generator.
 */
export const HAND_STRENGTH_LABELS = Object.freeze({
  ELITE: 'Elite',
  STRONG: 'Strong',
  ADEQUATE: 'Adequate',
  WEAK: 'Weak',
  BLOCKED: 'Blocked',
  EMPTY: 'Empty',
} as const);

/**
 * Canonical event type keys for card sub-system telemetry events.
 *
 * Referenced by: telemetry pipeline, ML/DL feature extraction, liveops dashboards.
 */
export const CARD_SYSTEM_EVENT_TYPES = Object.freeze({
  CARD_EVALUATED: 'card.evaluated',
  CARD_PLAYED: 'card.played',
  CARD_HELD: 'card.held',
  CARD_BENCHED: 'card.benched',
  HAND_ASSESSED: 'hand.assessed',
  HAND_BLOCKED: 'hand.blocked',
  TIMING_WINDOW_OPENED: 'timing.window.opened',
  TIMING_WINDOW_CLOSED: 'timing.window.closed',
  TIMING_WINDOW_EXPIRED: 'timing.window.expired',
  TARGETING_BLOCKED: 'targeting.blocked',
  TARGETING_REACHED: 'targeting.reached',
  ELITE_PLAY_AVAILABLE: 'elite.play.available',
  CRITICAL_WINDOW_ACTIVE: 'critical.window.active',
  DECK_COMPOSED: 'deck.composed',
  DECK_HEALTH_ASSESSED: 'deck.health.assessed',
  SESSION_DIGEST_BUILT: 'session.digest.built',
} as const);

/**
 * Signal keys for AI planner context injection.
 *
 * Every signal key maps to a field in the AI planner context object.
 *
 * Referenced by: AI planner, drama engine, ML/DL feature extraction.
 */
export const CARD_SYSTEM_SIGNAL_KEYS = Object.freeze({
  HAND_PLAYABLE_COUNT: 'hand.playableCount',
  HAND_BLOCKED_COUNT: 'hand.blockedCount',
  HAND_URGENCY: 'hand.urgency',
  HAND_ELITE_AVAILABLE: 'hand.eliteAvailable',
  HAND_STRENGTH: 'hand.strength',
  BEST_PLAY_CARD_ID: 'bestPlay.cardId',
  BEST_PLAY_SCORE: 'bestPlay.score',
  BEST_PLAY_TIER: 'bestPlay.tier',
  TIMING_CLASSES_LIVE: 'timing.classesLive',
  TIMING_WINDOW_EXPIRY_MS: 'timing.windowExpiryMs',
  TARGETING_COVERAGE_SCORE: 'targeting.coverageScore',
  TARGETING_REACHABLE_COUNT: 'targeting.reachableCount',
  MODE_DOCTRINE_PRIMARY_DECKS: 'mode.doctrine.primaryDecks',
  MODE_DOCTRINE_PREMIUM_TAGS: 'mode.doctrine.premiumTags',
  SCORE_TIER_TOP: 'score.tier.top',
  SCORE_AVERAGE: 'score.average',
  PHASE_BOUNDARY_URGENCY: 'phase.boundary.urgency',
  PRESSURE_SCORE: 'pressure.score',
  TRUST_SCORE: 'trust.score',
} as const);

/**
 * Telemetry event schema for the cards sub-system.
 *
 * Defines the required fields for each event type.
 * Referenced by: telemetry validation middleware, ML feature schema.
 */
export const CARD_SYSTEM_TELEMETRY_SCHEMA = Object.freeze({
  [CARD_SYSTEM_EVENT_TYPES.CARD_EVALUATED]: Object.freeze([
    'cardId',
    'mode',
    'score',
    'tier',
    'timingAllowed',
    'targetingAllowed',
    'recommendation',
  ]),
  [CARD_SYSTEM_EVENT_TYPES.CARD_PLAYED]: Object.freeze([
    'cardId',
    'mode',
    'score',
    'tier',
    'urgencyLevel',
  ]),
  [CARD_SYSTEM_EVENT_TYPES.HAND_ASSESSED]: Object.freeze([
    'mode',
    'totalCards',
    'playableCount',
    'blockedCount',
    'urgency',
    'hasElitePlay',
  ]),
  [CARD_SYSTEM_EVENT_TYPES.DECK_COMPOSED]: Object.freeze([
    'mode',
    'cardCount',
    'compositionGrade',
    'signatureCount',
    'suppressedCount',
  ]),
  [CARD_SYSTEM_EVENT_TYPES.SESSION_DIGEST_BUILT]: Object.freeze([
    'totalEvaluations',
    'totalPlayed',
    'averageScore',
    'eliteCardUtilisation',
    'hadCriticalTimingWindows',
  ]),
} as const);

/**
 * UX urgency accent class names for card display.
 *
 * These are the design system class names — do not change without updating
 * the design system.
 *
 * Referenced by: UX card renderer, `cardUrgencyAccentClass()`.
 */
export const CARD_UX_URGENCY_ACCENT_CLASSES = Object.freeze({
  BLOCKED: 'card-urgency--blocked',
  LOW: 'card-urgency--low',
  MEDIUM: 'card-urgency--medium',
  HIGH: 'card-urgency--high',
  CRITICAL: 'card-urgency--critical',
} as const);

/**
 * UX score tier accent class names for card display.
 *
 * Referenced by: UX card renderer, score tier badge component.
 */
export const CARD_UX_SCORE_TIER_CLASSES = Object.freeze({
  SIGNATURE: 'card-tier--signature',
  PREMIUM: 'card-tier--premium',
  SOLID: 'card-tier--solid',
  AVERAGE: 'card-tier--average',
  WEAK: 'card-tier--weak',
  SUPPRESSED: 'card-tier--suppressed',
} as const);

/**
 * UX composition grade colour classes.
 *
 * Used by the deck review component to colour the grade badge.
 *
 * Referenced by: deck review screen, composition feedback modal.
 */
export const DECK_COMPOSITION_GRADE_CLASSES = Object.freeze({
  A: 'grade--a',
  B: 'grade--b',
  C: 'grade--c',
  D: 'grade--d',
  F: 'grade--f',
} as const);

/* ────────────────────────────────────────────────────────────────────────────
 * SECTION 9  ·  ML / DL feature extraction surface
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Extract a flat numeric feature vector from a `CardFullEvaluation`.
 *
 * Features:
 *   [0]  modeScore (normalised 0–1)
 *   [1]  timingAllowed (0 or 1)
 *   [2]  targetingAllowed (0 or 1)
 *   [3]  isPlayableNow (0 or 1)
 *   [4]  isReactionOpportunity (0 or 1)
 *   [5]  urgencyLevel (0=BLOCKED … 4=CRITICAL, normalised)
 *   [6]  scoreTierOrdinal (0=SUPPRESSED … 5=SIGNATURE, normalised)
 *   [7]  recommendation (0=BENCH, 1=HOLD, 2=PLAY, normalised)
 *
 * Used by:
 *   - ML turn decision model feature extraction
 *   - DL card-play outcome prediction model input layer
 */
export function extractCardEvaluationFeatureVector(
  ev: CardFullEvaluation,
): readonly number[] {
  const urgencyOrdinal: Record<CardUrgencyLevel, number> = {
    BLOCKED: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };
  const tierOrdinal: Record<ScoreTierLabel, number> = {
    SUPPRESSED: 0,
    WEAK: 1,
    AVERAGE: 2,
    SOLID: 3,
    PREMIUM: 4,
    SIGNATURE: 5,
  };
  const recommendationOrdinal: Record<
    CardFullEvaluation['recommendation'],
    number
  > = { BENCH: 0, HOLD: 1, PLAY: 2 };
  return Object.freeze([
    Math.min(ev.modeScore / 100, 1),
    ev.timingAllowed ? 1 : 0,
    ev.targetingAllowed ? 1 : 0,
    ev.isPlayableNow ? 1 : 0,
    ev.isReactionOpportunity ? 1 : 0,
    urgencyOrdinal[ev.urgencyLevel] / 4,
    tierOrdinal[ev.scoreTier] / 5,
    recommendationOrdinal[ev.recommendation] / 2,
  ]);
}

/**
 * Extract a hand-level feature matrix from a `CardSystemHandSummary`.
 *
 * Returns a 2D array where each row is the feature vector for one card,
 * suitable for use as input to a sequence model (LSTM, Transformer).
 *
 * Used by:
 *   - DL hand-strength prediction model (input sequence)
 *   - ML hand-state classifier feature matrix
 */
export function extractHandFeatureMatrix(
  summary: CardSystemHandSummary,
): readonly (readonly number[])[] {
  const allEvals = [
    ...summary.playability.playableCards,
    ...summary.playability.timingBlockedCards,
    ...summary.playability.targetingBlockedCards,
    ...summary.playability.multiBlockedCards,
  ];
  return Object.freeze(allEvals.map(extractCardEvaluationFeatureVector));
}

/**
 * Extract a scalar feature vector from a `CardSessionDigest`.
 *
 * Used by:
 *   - ML session outcome prediction model
 *   - DL card economy model feature input
 *
 * Features:
 *   [0]  playRate (totalPlayed / totalEvaluations)
 *   [1]  holdRate (totalHeld / totalEvaluations)
 *   [2]  benchRate (totalBenched / totalEvaluations)
 *   [3]  averageScore (normalised 0–1)
 *   [4]  eliteRate (SIGNATURE + PREMIUM / totalEvaluations)
 *   [5]  eliteCardUtilisation
 *   [6]  hadCriticalTimingWindows (0 or 1)
 */
export function extractSessionDigestFeatureVector(
  digest: CardSessionDigest,
): readonly number[] {
  const total = Math.max(digest.totalEvaluations, 1);
  return Object.freeze([
    digest.totalPlayed / total,
    digest.totalHeld / total,
    digest.totalBenched / total,
    Math.min(digest.averageScore / 100, 1),
    (digest.tierDistribution.SIGNATURE + digest.tierDistribution.PREMIUM) /
      total,
    digest.eliteCardUtilisation,
    digest.hadCriticalTimingWindows ? 1 : 0,
  ]);
}

/**
 * Extract a deck composition feature vector from a `CardSystemDeckInsight`.
 *
 * Used by:
 *   - ML deck composition quality model
 *   - DL win-rate prediction model (deck input layer)
 *
 * Features:
 *   [0]  compositionGradeOrdinal (F=0 … A=4, normalised)
 *   [1]  targetingCoverageScore (0–1)
 *   [2]  missingPrimaryDeckTypes count / 8
 *   [3]  suppressedDeckTypesPresent count / 8
 *   [4]  battleBudgetTimingCoverage (0 or 1)
 *   [5]  ghostAnchorTimingCoverage (0 or 1)
 *   [6]  reachableTargetings / total targetings
 */
export function extractDeckInsightFeatureVector(
  insight: CardSystemDeckInsight,
): readonly number[] {
  const gradeOrdinal: Record<string, number> = {
    F: 0,
    D: 1,
    C: 2,
    B: 3,
    A: 4,
  };
  const allTargetingsCount = Math.max(listAllTargetings().length, 1);
  return Object.freeze([
    (gradeOrdinal[insight.compositionGrade] ?? 0) / 4,
    insight.targetingCoverageScore,
    insight.missingPrimaryDeckTypes.length / 8,
    insight.suppressedDeckTypesPresent.length / 8,
    insight.battleBudgetTimingCoverage ? 1 : 0,
    insight.ghostAnchorTimingCoverage ? 1 : 0,
    insight.reachableTargetings.length / allTargetingsCount,
  ]);
}

/* ────────────────────────────────────────────────────────────────────────────
 * SECTION 10  ·  Urgency and opportunity description utilities
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Get the urgency accent CSS class for a card urgency level.
 *
 * Delegates to `cardUrgencyAccentClass`; exposed here for the unified surface.
 */
export function getCardUrgencyClass(urgency: CardUrgencyLevel): string {
  return cardUrgencyAccentClass(urgency);
}

/**
 * Get the human-readable label for a card urgency level.
 *
 * Delegates to `cardUrgencyLevelLabel`; exposed here for the unified surface.
 */
export function getCardUrgencyLabel(urgency: CardUrgencyLevel): string {
  return cardUrgencyLevelLabel(urgency);
}

/**
 * Classify the current hand urgency into a human-readable priority label.
 *
 * Used by:
 *   - Chat narrator urgency injector
 *   - AI planner priority weight adjustment
 *   - UX urgency status bar
 */
export function classifyHandUrgencyLabel(
  urgency: HandPlayabilityMatrix['handUrgency'],
): string {
  switch (urgency) {
    case 'CRITICAL':
      return 'CRITICAL — act immediately, window expires soon';
    case 'HIGH':
      return 'HIGH — strong play available, act before window shifts';
    case 'MEDIUM':
      return 'MEDIUM — timing window is open, consider your options';
    case 'LOW':
      return 'LOW — window is stable, no immediate pressure';
    case 'NONE':
      return 'NONE — no active timing windows, safe to wait';
  }
}

/**
 * Classify the urgency at a phase boundary given the windows remaining.
 *
 * Used by:
 *   - Chat narrator to describe phase boundary urgency
 *   - AI planner to weight plays by end-of-phase timing
 */
export function classifyPhaseBoundaryUrgencyLabel(
  windowsRemaining: number,
): string {
  const high = getPhaseBoundaryHighUrgencyRemaining();
  const medium = getPhaseBoundaryMediumUrgencyRemaining();
  const low = getPhaseBoundaryLowUrgencyRemaining();
  if (windowsRemaining <= high) {
    return 'CRITICAL — phase boundary approaching immediately';
  }
  if (windowsRemaining <= medium) {
    return 'HIGH — limited windows before phase end';
  }
  if (windowsRemaining <= low) {
    return 'MEDIUM — phase boundary within sight';
  }
  return 'LOW — plenty of phase windows remaining';
}

/**
 * Describe the current trust-timing opportunity in natural language.
 *
 * Used by:
 *   - Chat narrator to describe rescue/defection timing
 *   - AI planner to identify trust-sensitive card plays
 */
export function describeCurrentTrustOpportunity(trustScore: number): string {
  const threshold = getLowTrustThreshold();
  if (trustScore < threshold) {
    return `Trust is critically low (${trustScore}/${threshold}) — rescue and aid cards are high priority.`;
  }
  return `Trust is stable (${trustScore}) — no immediate trust-timing opportunity.`;
}

/**
 * Describe the current pressure-timing opportunity in natural language.
 *
 * Used by:
 *   - Chat narrator to describe pressure escalation timing
 *   - AI planner to identify pressure-sensitive card plays
 */
export function describeCurrentPressureOpportunity(
  pressureScore: number,
): string {
  const threshold = getElevatedPressureScore();
  if (pressureScore >= threshold) {
    return `Pressure is elevated (${pressureScore.toFixed(2)} ≥ ${threshold}) — counter and interrupt cards are high priority.`;
  }
  return `Pressure is below threshold (${pressureScore.toFixed(2)}) — standard play conditions.`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * SECTION 11  ·  Targeting and timing utility wrappers
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Get all targeting modes available for a mode code.
 *
 * Wraps `getTargetingsByMode` — exposed here for the unified import surface.
 */
export function getTargetingsForMode(mode: ModeCode): readonly Targeting[] {
  return getTargetingsByMode(mode);
}

/**
 * Get the timing classes available for a mode code.
 *
 * Wraps `getTimingClassesForMode` — exposed here for the unified surface.
 */
export function getTimingClassesForModeCode(
  mode: string,
): readonly TimingClass[] {
  return getTimingClassesForMode(mode);
}

/**
 * Compute the fraction of the full targeting set that is reachable by a
 * collection of targeting values.
 *
 * Used by:
 *   - Deck composition coverage score
 *   - AI planner targeting coverage signal
 */
export function computeHandTargetingCoverage(
  handTargetings: readonly Targeting[],
): number {
  const all = listAllTargetings();
  const reachable = new Set(handTargetings);
  return reachable.size / Math.max(all.length, 1);
}

/**
 * Get the canonical targeting label for display in UX components.
 *
 * Wraps `getTargetingLabel` — exposed here for the unified import surface.
 */
export function getTargetingDisplayLabel(
  targeting: Targeting,
  mode: ModeCode,
): string {
  return getTargetingLabel(targeting, mode);
}

/* ────────────────────────────────────────────────────────────────────────────
 * SECTION 12  ·  Cards sub-system module authority
 * ──────────────────────────────────────────────────────────────────────────── */

export const CARDS_SUBSYSTEM_MODULE_ID =
  'backend.engine.cards' as const;

export const CARDS_SUBSYSTEM_MODULE_VERSION = '3.0.0' as const;

/**
 * Module authority for the entire cards sub-system barrel.
 *
 * This is the canonical registry of all orchestration-layer symbols that this
 * `cards/index.ts` adds beyond the raw sub-module re-exports.
 *
 * Sub-module authorities are registered separately (e.g.
 * `CARD_TIMING_VALIDATOR_MODULE_AUTHORITY`).
 *
 * Referenced by:
 *   - `engine/index.ts` master barrel health check
 *   - CI barrel surface tests
 *   - Liveops audit endpoint
 */
export const CARDS_SUBSYSTEM_MODULE_AUTHORITY = Object.freeze({
  moduleId: CARDS_SUBSYSTEM_MODULE_ID,
  version: CARDS_SUBSYSTEM_MODULE_VERSION,

  // Orchestration class
  CardSystemOrchestrator: 'class',

  // Cross-system types
  CardFullEvaluation: 'interface',
  HandPlayabilityMatrix: 'interface',
  CardSystemHandSummary: 'interface',
  CardSystemDeckInsight: 'interface',
  CardSystemDiagnosticReport: 'interface',
  CardSessionDigest: 'interface',

  // Standalone utilities — hand
  filterTimingAndTargetingLegalCards: 'function',
  filterModeLegalAndLiveCards: 'function',
  rankHandByLiveScore: 'function',
  buildHandTargetingAdvisoryMap: 'function',
  buildHandTargetingBatch: 'function',
  buildHandTimingAdvisories: 'function',
  buildHandUXStateMap: 'function',
  buildLegalHandSummary: 'function',
  handHasElitePlayNow: 'function',
  getTopNHandPlays: 'function',
  buildHandTargetingBadgeMap: 'function',
  handsHaveEquivalentTargetingReach: 'function',
  narrateHandState: 'function',

  // Standalone utilities — card
  getCardScoringExplanation: 'function',
  buildCardCrossModeScoreVector: 'function',
  normaliseAndCompareTargetings: 'function',
  describeTargetingInMode: 'function',

  // Mode doctrine
  getModeDoctrineLabel: 'function',
  getModeAndDeckTargetingAdvisory: 'function',

  // System health
  warmCardSubsystemDoctrines: 'function',
  assertCardSubsystemHealthy: 'function',
  getCardSubsystemCapabilities: 'function',
  buildTargetingDoctrineMatrix: 'function',

  // UX constants
  HAND_STRENGTH_LABELS: 'const',
  CARD_SYSTEM_EVENT_TYPES: 'const',
  CARD_SYSTEM_SIGNAL_KEYS: 'const',
  CARD_SYSTEM_TELEMETRY_SCHEMA: 'const',
  CARD_UX_URGENCY_ACCENT_CLASSES: 'const',
  CARD_UX_SCORE_TIER_CLASSES: 'const',
  DECK_COMPOSITION_GRADE_CLASSES: 'const',

  // ML / DL feature extraction
  extractCardEvaluationFeatureVector: 'function',
  extractHandFeatureMatrix: 'function',
  extractSessionDigestFeatureVector: 'function',
  extractDeckInsightFeatureVector: 'function',

  // Urgency and opportunity
  getCardUrgencyClass: 'function',
  getCardUrgencyLabel: 'function',
  classifyHandUrgencyLabel: 'function',
  classifyPhaseBoundaryUrgencyLabel: 'function',
  describeCurrentTrustOpportunity: 'function',
  describeCurrentPressureOpportunity: 'function',

  // Targeting / timing wrappers
  getTargetingsForMode: 'function',
  getTimingClassesForModeCode: 'function',
  computeHandTargetingCoverage: 'function',
  getTargetingDisplayLabel: 'function',

  // Disambiguation overrides
  _disambiguation: Object.freeze({
    ModeCardScoreBreakdown:
      'types.ts (canonical over DeckComposer.ts)',
    getGhostMarkerWindowTicks:
      'CardTimingValidator.ts (canonical over CardLegalityService.ts)',
  }),
} as const);
