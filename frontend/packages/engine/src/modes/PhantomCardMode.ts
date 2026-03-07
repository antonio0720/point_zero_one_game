//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/modes/PhantomCardMode.ts

// pzo-web/src/engines/cards/modes/PhantomCardMode.ts
//
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — PHANTOM CARD MODE HANDLER
// Mode: CHASE_A_LEGEND
//
// Responsibilities:
//   1. Ghost Card Routing    — requires Legend Marker data; 5 marker types
//                              (Gold/Red/Purple/Silver/Black), each resolves
//                              differently based on gap to Legend
//   2. DISCIPLINE Card       — variance reduction; deterministic run stabilization;
//                              locks effect magnitude to median of last N plays
//   3. Divergence Scoring    — per-play gap delta vs. Legend benchmark
//   4. Proof-Badge Tracking  — condition accumulation toward badge unlock events
//   5. Deterministic Deck    — same seed produces same draw order, enforced here
//
// Integration: CardEngine instantiates PhantomCardMode in init() when
//   mode === CHASE_A_LEGEND. Tick hooks called at engine step A.
//
// RULES:
//   ✦ All Ghost card plays require a valid LegendMarker to be present.
//     Plays without marker data are rejected by TimingValidator.
//   ✦ Divergence score is additive across the run. Final divergence feeds
//     the Proof-Badge condition evaluator.
//   ✦ DISCIPLINE cards lock the next N effect magnitudes to a median value.
//   ✦ Never imports from features/, store/, or EngineOrchestrator.
//   ✦ Same seed = same deck order. PhantomCardMode verifies seeded draw
//     matches expected sequence on each draw event.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  LegendMarkerType,
  ModeDeckType,
  type CardInHand,
  type CardPlayRequest,
  type GhostCardRequirement,
  type CardEngineInitParams,
  type DecisionRecord,
} from '../cards/types';
import type { CardUXBridge } from '../cards/CardUXBridge';

// ── LEGEND MARKER REQUIREMENTS ─────────────────────────────────────────────────

/** Minimum markers required per Ghost card type. */
const GHOST_MARKER_REQUIREMENTS: Record<LegendMarkerType, GhostCardRequirement> = {
  [LegendMarkerType.GOLD]: {
    markerType:    LegendMarkerType.GOLD,
    minMarkerCount: 1,
  },
  [LegendMarkerType.RED]: {
    markerType:    LegendMarkerType.RED,
    minMarkerCount: 1,
  },
  [LegendMarkerType.PURPLE]: {
    markerType:    LegendMarkerType.PURPLE,
    minMarkerCount: 2,
  },
  [LegendMarkerType.SILVER]: {
    markerType:    LegendMarkerType.SILVER,
    minMarkerCount: 1,
  },
  [LegendMarkerType.BLACK]: {
    markerType:    LegendMarkerType.BLACK,
    minMarkerCount: 1,
    divergenceThreshold: 0.30,  // only legal if gap ≤ 30%
  },
};

/** CORD multipliers per marker type when ghost card is resolved. */
const GHOST_CORD_MULTIPLIERS: Record<LegendMarkerType, number> = {
  [LegendMarkerType.GOLD]:   1.5,
  [LegendMarkerType.RED]:    1.2,
  [LegendMarkerType.PURPLE]: 1.4,
  [LegendMarkerType.SILVER]: 1.1,
  [LegendMarkerType.BLACK]:  2.0,   // highest risk / highest reward
};

// ── DISCIPLINE CONFIG ─────────────────────────────────────────────────────────

const DISCIPLINE_LOCK_WINDOW   = 3;   // next 3 plays after DISCIPLINE card use
const DISCIPLINE_MEDIAN_SAMPLE = 5;   // look back 5 plays for median calculation

// ── PROOF BADGE CONDITIONS ────────────────────────────────────────────────────

interface ProofBadgeCondition {
  badgeId:          string;
  description:      string;
  targetCount:      number;
  currentCount:     number;
  isUnlocked:       boolean;
  relevantCardIds:  string[];  // empty = any card
}

const PROOF_BADGE_DEFINITIONS: Omit<ProofBadgeCondition, 'currentCount' | 'isUnlocked'>[] = [
  {
    badgeId:         'precision_master',
    description:     'Play 10 cards within 20% of decision window',
    targetCount:     10,
    relevantCardIds: [],
  },
  {
    badgeId:         'ghost_whisperer',
    description:     'Activate 5 Ghost cards',
    targetCount:     5,
    relevantCardIds: ['ghost_gold_read_001', 'ghost_red_exploit_002', 'ghost_purple_chain_003'],
  },
  {
    badgeId:         'no_variance',
    description:     'Play 5 consecutive DISCIPLINE cards without a miss',
    targetCount:     5,
    relevantCardIds: [],
  },
  {
    badgeId:         'legend_convergence',
    description:     'Reduce divergence gap below 5% for 3 consecutive ticks',
    targetCount:     3,
    relevantCardIds: [],
  },
];

// ── GHOST CARD ID → MARKER TYPE MAP ───────────────────────────────────────────

const GHOST_CARD_MARKER_MAP: Record<string, LegendMarkerType> = {
  'ghost_gold_read_001':     LegendMarkerType.GOLD,
  'ghost_red_exploit_002':   LegendMarkerType.RED,
  'ghost_purple_chain_003':  LegendMarkerType.PURPLE,
  'ghost_silver_timing_004': LegendMarkerType.SILVER,
  'ghost_black_risk_005':    LegendMarkerType.BLACK,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHANTOM MODE STATE
// ═══════════════════════════════════════════════════════════════════════════════

export interface PhantomModeState {
  // Divergence tracking
  divergenceScore:          number;    // cumulative gap vs. legend
  divergenceHistory:        number[];  // per-tick divergence deltas
  convergenceStreakTicks:   number;    // consecutive ticks gap ≤ 5%

  // Legend markers
  legendMarkers:            Record<LegendMarkerType, number>; // count per type
  ghostCardsActivated:      number;

  // Discipline
  disciplineLockActive:     boolean;
  disciplineLockRemaining:  number;
  disciplineLockedMagnitude:number;
  recentMagnitudes:         number[];  // last N magnitudes for median

  // Proof badges
  proofBadges:              ProofBadgeCondition[];

  // Deterministic verification
  expectedDrawSequence:     string[];  // cardIds in expected order
  drawIndex:                number;
  sequenceViolations:       number;

  // Run stats
  totalGhostPlays:          number;
  totalDisciplinePlays:     number;
}

export interface GhostCardActivationResult {
  success:            boolean;
  markerType:         LegendMarkerType;
  cordMultiplier:     number;
  divergenceDelta:    number;
  badgesUnlocked:     string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHANTOM CARD MODE
// ═══════════════════════════════════════════════════════════════════════════════

export class PhantomCardMode {

  private uxBridge: CardUXBridge;
  private state:    PhantomModeState;
  private userId:   string = '';
  private seed:     string = '';

  constructor(uxBridge: CardUXBridge) {
    this.uxBridge = uxBridge;
    this.state    = PhantomCardMode.defaultState();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  public init(params: CardEngineInitParams): void {
    this.userId = params.userId;
    this.seed   = params.seed;
    this.state  = PhantomCardMode.defaultState();
    // Initialize proof badge trackers
    this.state.proofBadges = PROOF_BADGE_DEFINITIONS.map(def => ({
      ...def,
      currentCount: 0,
      isUnlocked:   false,
    }));
  }

  public reset(): void {
    this.state = PhantomCardMode.defaultState();
    this.state.proofBadges = PROOF_BADGE_DEFINITIONS.map(def => ({
      ...def,
      currentCount: 0,
      isUnlocked:   false,
    }));
  }

  private static defaultState(): PhantomModeState {
    return {
      divergenceScore:          0,
      divergenceHistory:        [],
      convergenceStreakTicks:   0,
      legendMarkers: {
        [LegendMarkerType.GOLD]:   0,
        [LegendMarkerType.RED]:    0,
        [LegendMarkerType.PURPLE]: 0,
        [LegendMarkerType.SILVER]: 0,
        [LegendMarkerType.BLACK]:  0,
      },
      ghostCardsActivated:      0,
      disciplineLockActive:     false,
      disciplineLockRemaining:  0,
      disciplineLockedMagnitude:0,
      recentMagnitudes:         [],
      proofBadges:              [],
      expectedDrawSequence:     [],
      drawIndex:                0,
      sequenceViolations:       0,
      totalGhostPlays:          0,
      totalDisciplinePlays:     0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TICK HOOK
  // ═══════════════════════════════════════════════════════════════════════════

  public onTick(tickIndex: number, legendCordScore: number, playerCordScore: number): void {
    this.updateDivergence(tickIndex, legendCordScore, playerCordScore);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIVERGENCE SCORING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gap Indicator delta calculation.
   * Divergence = |legendScore - playerScore| / legendScore
   * Positive delta = gap widening; negative delta = gap closing.
   */
  private updateDivergence(
    tickIndex:       number,
    legendScore:     number,
    playerScore:     number,
  ): void {
    if (legendScore <= 0) return;

    const currentGap = Math.abs(legendScore - playerScore) / legendScore;
    const prevGap    = this.state.divergenceHistory.length > 0
      ? this.state.divergenceHistory[this.state.divergenceHistory.length - 1]
      : currentGap;

    const delta = currentGap - prevGap; // positive = diverging, negative = converging

    this.state.divergenceScore += delta;
    this.state.divergenceHistory.push(currentGap);

    // Track convergence streak for proof badge
    if (currentGap <= 0.05) {
      this.state.convergenceStreakTicks++;
      this.evaluateProofBadge('legend_convergence', 1, tickIndex);
    } else {
      this.state.convergenceStreakTicks = 0;
    }
  }

  public getDivergenceScore(): number {
    return this.state.divergenceScore;
  }

  public getCurrentGap(): number {
    const h = this.state.divergenceHistory;
    return h.length > 0 ? h[h.length - 1] : 1.0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGEND MARKERS
  // ═══════════════════════════════════════════════════════════════════════════

  public grantMarker(type: LegendMarkerType, count: number = 1): void {
    this.state.legendMarkers[type] = (this.state.legendMarkers[type] ?? 0) + count;
  }

  public consumeMarker(type: LegendMarkerType, count: number = 1): boolean {
    if ((this.state.legendMarkers[type] ?? 0) < count) return false;
    this.state.legendMarkers[type] -= count;
    return true;
  }

  public getMarkerCount(type: LegendMarkerType): number {
    return this.state.legendMarkers[type] ?? 0;
  }

  public hasRequiredMarkers(type: LegendMarkerType): boolean {
    const req = GHOST_MARKER_REQUIREMENTS[type];
    const has = this.getMarkerCount(type);
    if (has < req.minMarkerCount) return false;
    // BLACK: also check divergence threshold
    if (type === LegendMarkerType.BLACK && req.divergenceThreshold !== undefined) {
      if (this.getCurrentGap() > req.divergenceThreshold) return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GHOST CARD ACTIVATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve a Ghost card play against the matching Legend Marker.
   * Returns GhostCardActivationResult with CORD multiplier and divergence delta.
   */
  public activateGhostCard(
    card:      CardInHand,
    tickIndex: number,
  ): GhostCardActivationResult {
    const markerType = this.resolveGhostMarkerType(card);
    const unlocked: string[] = [];

    if (!this.hasRequiredMarkers(markerType)) {
      return {
        success:         false,
        markerType,
        cordMultiplier:  1.0,
        divergenceDelta: 0,
        badgesUnlocked:  [],
      };
    }

    this.consumeMarker(markerType);
    this.state.ghostCardsActivated++;
    this.state.totalGhostPlays++;

    const cordMultiplier = GHOST_CORD_MULTIPLIERS[markerType];
    const divergenceDelta = -(0.05 + (cordMultiplier - 1.0) * 0.10); // ghost plays close the gap

    this.state.divergenceScore += divergenceDelta;

    this.uxBridge.emitGhostCardActivated(card, markerType, divergenceDelta, tickIndex);

    // Check ghost-related badges
    const ghostBadge = this.evaluateProofBadge('ghost_whisperer', 1, tickIndex);
    if (ghostBadge) unlocked.push('ghost_whisperer');

    return {
      success:         true,
      markerType,
      cordMultiplier,
      divergenceDelta,
      badgesUnlocked:  unlocked,
    };
  }

  /**
   * Map a ghost card's ID to its LegendMarkerType.
   * Falls back to GOLD if card ID is not in the map.
   */
  public resolveGhostMarkerType(card: CardInHand): LegendMarkerType {
    return GHOST_CARD_MARKER_MAP[card.definition.cardId] ?? LegendMarkerType.GOLD;
  }

  public getGhostMarkerRequirement(type: LegendMarkerType): GhostCardRequirement {
    return GHOST_MARKER_REQUIREMENTS[type];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISCIPLINE — VARIANCE REDUCTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Activate DISCIPLINE lock for next N plays.
   * Locks effect magnitude to the median of the last DISCIPLINE_MEDIAN_SAMPLE plays.
   */
  public activateDisciplineLock(card: CardInHand, tickIndex: number): number {
    const median = this.computeMedianMagnitude();
    this.state.disciplineLockActive     = true;
    this.state.disciplineLockRemaining  = DISCIPLINE_LOCK_WINDOW;
    this.state.disciplineLockedMagnitude= median;
    this.state.totalDisciplinePlays++;

    return median;
  }

  /**
   * Get the effective magnitude for a card play when DISCIPLINE lock is active.
   * Returns null if no lock is active (use base magnitude).
   */
  public getDisciplineMagnitude(): number | null {
    if (!this.state.disciplineLockActive) return null;
    return this.state.disciplineLockedMagnitude;
  }

  public consumeDisciplineLockSlot(): void {
    if (!this.state.disciplineLockActive) return;
    this.state.disciplineLockRemaining--;
    if (this.state.disciplineLockRemaining <= 0) {
      this.state.disciplineLockActive = false;
    }
  }

  private computeMedianMagnitude(): number {
    const recent = this.state.recentMagnitudes;
    if (recent.length === 0) return 1.0;

    const sample = [...recent].slice(-DISCIPLINE_MEDIAN_SAMPLE).sort((a, b) => a - b);
    const mid    = Math.floor(sample.length / 2);
    return sample.length % 2 !== 0
      ? sample[mid]
      : (sample[mid - 1] + sample[mid]) / 2;
  }

  private recordMagnitude(magnitude: number): void {
    this.state.recentMagnitudes.push(magnitude);
    if (this.state.recentMagnitudes.length > DISCIPLINE_MEDIAN_SAMPLE * 2) {
      this.state.recentMagnitudes = this.state.recentMagnitudes.slice(-DISCIPLINE_MEDIAN_SAMPLE);
    }
  }

  public isDisciplineLockActive(): boolean {
    return this.state.disciplineLockActive;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROOF BADGES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Increment a badge's progress. Returns true if badge was just unlocked.
   */
  private evaluateProofBadge(
    badgeId:   string,
    increment: number,
    tickIndex: number,
  ): boolean {
    const badge = this.state.proofBadges.find(b => b.badgeId === badgeId);
    if (!badge || badge.isUnlocked) return false;

    badge.currentCount += increment;
    if (badge.currentCount >= badge.targetCount) {
      badge.isUnlocked = true;
      this.uxBridge.emitProofBadgeConditionMet(badgeId, badgeId, tickIndex);
      return true;
    }
    return false;
  }

  public checkPrecisionBadge(speedScore: number, tickIndex: number): void {
    // speedScore > 0.8 means played within 20% of window
    if (speedScore >= 0.8) {
      this.evaluateProofBadge('precision_master', 1, tickIndex);
    }
  }

  public getUnlockedBadges(): string[] {
    return this.state.proofBadges
      .filter(b => b.isUnlocked)
      .map(b => b.badgeId);
  }

  public getBadgeProgress(badgeId: string): { current: number; target: number } | null {
    const badge = this.state.proofBadges.find(b => b.badgeId === badgeId);
    if (!badge) return null;
    return { current: badge.currentCount, target: badge.targetCount };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETERMINISTIC DECK VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Register the expected draw sequence from DeckBuilder (same seed). */
  public registerExpectedSequence(sequence: string[]): void {
    this.state.expectedDrawSequence = [...sequence];
    this.state.drawIndex            = 0;
    this.state.sequenceViolations   = 0;
  }

  /** Verify a drawn card matches the expected deterministic sequence. */
  public verifyDraw(drawnCardId: string): boolean {
    const expected = this.state.expectedDrawSequence[this.state.drawIndex];
    this.state.drawIndex++;

    if (expected === undefined) return true; // sequence exhausted — pass
    if (drawnCardId !== expected) {
      this.state.sequenceViolations++;
      return false;
    }
    return true;
  }

  public getSequenceViolations(): number {
    return this.state.sequenceViolations;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST-PLAY HOOK
  // ═══════════════════════════════════════════════════════════════════════════

  public onCardPlayResolved(
    card:      CardInHand,
    request:   CardPlayRequest,
    record:    DecisionRecord,
    tickIndex: number,
  ): GhostCardActivationResult | null {
    // Record magnitude for discipline median
    this.recordMagnitude(card.definition.base_effect.magnitude);

    // Consume discipline lock slot if active
    if (this.state.disciplineLockActive && card.definition.deckType !== ModeDeckType.DISCIPLINE) {
      this.consumeDisciplineLockSlot();
    }

    // DISCIPLINE card activation
    if (card.definition.deckType === ModeDeckType.DISCIPLINE) {
      this.activateDisciplineLock(card, tickIndex);
      return null;
    }

    // Ghost card activation
    if (card.definition.deckType === ModeDeckType.GHOST) {
      return this.activateGhostCard(card, tickIndex);
    }

    // Precision badge check
    this.checkPrecisionBadge(record.speedScore, tickIndex);

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE SNAPSHOT
  // ═══════════════════════════════════════════════════════════════════════════

  public getState(): Readonly<PhantomModeState> {
    return { ...this.state };
  }
}