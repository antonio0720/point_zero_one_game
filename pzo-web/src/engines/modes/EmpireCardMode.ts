//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/modes/EmpireCardMode.ts

// pzo-web/src/engines/cards/modes/EmpireCardMode.ts
//
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — EMPIRE CARD MODE HANDLER
// Mode: GO_ALONE
//
// Responsibilities:
//   1. Hold System       — pause decision timer, stage card for precision timing
//   2. Phase Boundary    — inject special cards at each of 3 phase transitions
//   3. Missed Opportunity Streak — track consecutive missed windows, trigger
//                                  escalating CORD penalties
//   4. Chain Synergy     — bonus CORD computation for stacked IPA cards
//   5. CORD Formula      — capital allocation scoring: weigh income, resilience,
//                          compounding tags against run state
//
// Integration: CardEngine instantiates EmpireCardMode in init() when
//   mode === GO_ALONE and calls hooks at the appropriate tick steps.
//
// RULES:
//   ✦ Never imports from features/, store/, or EngineOrchestrator.
//   ✦ All EventBus communication goes through the CardUXBridge reference
//     passed at construction.
//   ✦ State is fully reset on endRun().
//   ✦ Hold system is exclusive to GO_ALONE. Any call from outside this mode
//     is silently rejected.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  GameMode,
  RunPhase,
  BaseDeckType,
  CardTag,
  TimingClass,
  CardEffectType,
  type CardInHand,
  type HoldSlot,
  type PhaseBoundaryWindow,
  type DecisionRecord,
  type CardEngineInitParams,
} from '../cards/types';
import type { HandManager } from '../cards/HandManager';
import type { DecisionWindowManager } from '../cards/DecisionWindowManager';
import type { CardUXBridge } from '../cards/CardUXBridge';

// ── PHASE BOUNDARY CARD MAP ────────────────────────────────────────────────────

/** Card IDs available at each phase transition window. */
const PHASE_BOUNDARY_CARDS: Record<RunPhase, string[]> = {
  [RunPhase.FOUNDATION]:  ['pb_capital_seed_001', 'pb_foundation_lock_002'],
  [RunPhase.ESCALATION]:  ['pb_leverage_shift_003', 'pb_scale_trigger_004'],
  [RunPhase.SOVEREIGNTY]: ['pb_sovereignty_decision_005', 'pb_legacy_anchor_006'],
};

/** Phase transition tick offsets within a run (normalized to seasonTickBudget). */
const PHASE_TICK_RATIOS = {
  FOUNDATION_TO_ESCALATION:  0.33,  // ~1/3 into run
  ESCALATION_TO_SOVEREIGNTY: 0.66,  // ~2/3 into run
} as const;

// ── CHAIN SYNERGY CONFIG ───────────────────────────────────────────────────────

/**
 * IPA Chain Synergy — bonus CORD multiplier for consecutive IPA plays.
 * Three IPA cards played within CHAIN_WINDOW_TICKS earns a bonus.
 */
const CHAIN_SYNERGY_CONFIG = {
  REQUIRED_COUNT:    3,       // must play 3 IPA cards
  WINDOW_TICKS:      5,       // within 5 ticks of each other
  CORD_MULTIPLIER:   1.35,    // +35% CORD on the third card in the chain
  STACK_DECAY:       0.90,    // each additional IPA beyond 3 multiplies at 90% of prior bonus
} as const;

// ── MISSED OPPORTUNITY ESCALATION ─────────────────────────────────────────────

/** Escalating CORD penalty per consecutive miss streak. */
const MISS_STREAK_PENALTIES: Record<number, number> = {
  1: 0.00,  // first miss: no penalty
  2: 0.02,  // second: -2% CORD
  3: 0.05,  // third: -5% CORD
  4: 0.10,  // fourth: -10% CORD
};
const MISS_STREAK_MAX_PENALTY = 0.18;  // floor: beyond streak 4 = -18%

// ── CORD FORMULA WEIGHTS (Empire) ─────────────────────────────────────────────

const EMPIRE_CORD_WEIGHTS: Partial<Record<CardTag, number>> = {
  [CardTag.INCOME]:       0.30,
  [CardTag.COMPOUNDING]:  0.25,
  [CardTag.RESILIENCE]:   0.20,
  [CardTag.AUTOMATION]:   0.15,
  [CardTag.CAPITAL_ALLOC]:0.10,
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMPIRE CARD MODE
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmpireModeState {
  currentPhase:         RunPhase;
  phaseBoundaryWindow:  PhaseBoundaryWindow | null;
  holdSlotActive:       boolean;
  missedOpportunityStreak: number;
  ipaChain:             { instanceId: string; tick: number }[];
  chainSynergyActive:   boolean;
  chainSynergyMultiplier: number;
  totalHoldsUsed:       number;
  totalPhaseBoundaryCardsConsumed: number;
}

export interface EmpirePlayContext {
  hand:         CardInHand[];
  tickIndex:    number;
  params:       CardEngineInitParams;
}

export interface PhaseBoundaryResult {
  opened:       boolean;
  phase:        RunPhase;
  window:       PhaseBoundaryWindow | null;
}

export class EmpireCardMode {

  // ── Dependencies ─────────────────────────────────────────────────────────────
  private handManager:   HandManager;
  private windowManager: DecisionWindowManager;
  private uxBridge:      CardUXBridge;

  // ── Config ────────────────────────────────────────────────────────────────────
  private seasonTickBudget: number = 0;
  private boundary1Tick:    number = 0;
  private boundary2Tick:    number = 0;
  private userId:           string = '';

  // ── State ─────────────────────────────────────────────────────────────────────
  private state: EmpireModeState = EmpireCardMode.defaultState();

  constructor(
    handManager:   HandManager,
    windowManager: DecisionWindowManager,
    uxBridge:      CardUXBridge,
  ) {
    this.handManager   = handManager;
    this.windowManager = windowManager;
    this.uxBridge      = uxBridge;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  public init(params: CardEngineInitParams): void {
    this.userId           = params.userId;
    this.seasonTickBudget = params.seasonTickBudget;
    this.boundary1Tick    = Math.floor(params.seasonTickBudget * PHASE_TICK_RATIOS.FOUNDATION_TO_ESCALATION);
    this.boundary2Tick    = Math.floor(params.seasonTickBudget * PHASE_TICK_RATIOS.ESCALATION_TO_SOVEREIGNTY);
    this.state            = EmpireCardMode.defaultState();
  }

  public reset(): void {
    this.state = EmpireCardMode.defaultState();
  }

  private static defaultState(): EmpireModeState {
    return {
      currentPhase:                    RunPhase.FOUNDATION,
      phaseBoundaryWindow:             null,
      holdSlotActive:                  false,
      missedOpportunityStreak:         0,
      ipaChain:                        [],
      chainSynergyActive:              false,
      chainSynergyMultiplier:          1.0,
      totalHoldsUsed:                  0,
      totalPhaseBoundaryCardsConsumed: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TICK HOOK — called by CardEngine at the start of each tick
  // ═══════════════════════════════════════════════════════════════════════════

  public onTick(tickIndex: number): PhaseBoundaryResult {
    this.checkPhaseBoundaries(tickIndex);
    this.checkPhaseBoundaryExpiry(tickIndex);
    return {
      opened: this.state.phaseBoundaryWindow !== null &&
              this.state.phaseBoundaryWindow.openedAtTick === tickIndex,
      phase:  this.state.currentPhase,
      window: this.state.phaseBoundaryWindow,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOLD SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Stage a card in the Empire hold slot.
   * Pauses the decision window. Card is not in the active hand count.
   * Returns true if hold was successfully staged.
   */
  public holdCard(instanceId: string, tickIndex: number): boolean {
    if (this.state.holdSlotActive) return false; // one hold slot only

    const remainingMs = this.windowManager.getRemainingMs(instanceId);
    if (remainingMs <= 0) return false; // expired — can't hold

    const held = this.handManager.holdCard(instanceId, remainingMs, tickIndex);
    if (!held) return false;

    this.windowManager.pauseWindow(instanceId);
    this.state.holdSlotActive = true;
    this.state.totalHoldsUsed++;

    const card = this.handManager.getHoldSlot()?.card;
    if (card) {
      this.uxBridge.emitCardHeld(card, remainingMs, tickIndex);
    }
    return true;
  }

  /**
   * Release the held card back into the active hand.
   * Resumes the decision window from where it was paused.
   */
  public releaseHold(tickIndex: number): CardInHand | null {
    const holdSlot = this.handManager.releaseHold();
    if (!holdSlot) return null;

    this.windowManager.resumeWindow(holdSlot.card.instanceId);
    this.state.holdSlotActive = false;

    this.uxBridge.emitCardUnheld(holdSlot.card, tickIndex);
    return holdSlot.card;
  }

  public get isHoldOccupied(): boolean {
    return this.state.holdSlotActive;
  }

  public getHoldsRemaining(): number {
    return this.handManager.getHoldsRemaining();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE BOUNDARY
  // ═══════════════════════════════════════════════════════════════════════════

  private checkPhaseBoundaries(tickIndex: number): void {
    // Foundation → Escalation
    if (
      this.state.currentPhase === RunPhase.FOUNDATION &&
      tickIndex === this.boundary1Tick
    ) {
      this.openPhaseBoundaryWindow(RunPhase.ESCALATION, tickIndex);
      this.state.currentPhase = RunPhase.ESCALATION;
      return;
    }

    // Escalation → Sovereignty
    if (
      this.state.currentPhase === RunPhase.ESCALATION &&
      tickIndex === this.boundary2Tick
    ) {
      this.openPhaseBoundaryWindow(RunPhase.SOVEREIGNTY, tickIndex);
      this.state.currentPhase = RunPhase.SOVEREIGNTY;
    }
  }

  private openPhaseBoundaryWindow(phase: RunPhase, tickIndex: number): void {
    const cards = PHASE_BOUNDARY_CARDS[phase];
    const window: PhaseBoundaryWindow = {
      phase,
      openedAtTick:    tickIndex,
      closesAtTick:    tickIndex + 5,
      cardsAvailable:  [...cards],
      isConsumed:      false,
    };
    this.state.phaseBoundaryWindow = window;
    this.uxBridge.emitPhaseBoundaryCardAvailable(phase, cards, tickIndex + 5, tickIndex);
  }

  private checkPhaseBoundaryExpiry(tickIndex: number): void {
    const w = this.state.phaseBoundaryWindow;
    if (!w || w.isConsumed) return;
    if (tickIndex >= w.closesAtTick) {
      w.isConsumed = true;
      this.state.phaseBoundaryWindow = null;
      this.uxBridge.emitPhaseBoundaryWindowClosed(w.phase, false, tickIndex);
    }
  }

  public consumePhaseBoundaryWindow(tickIndex: number): void {
    const w = this.state.phaseBoundaryWindow;
    if (!w || w.isConsumed) return;
    w.isConsumed = true;
    this.state.phaseBoundaryWindow = null;
    this.state.totalPhaseBoundaryCardsConsumed++;
    this.uxBridge.emitPhaseBoundaryWindowClosed(w.phase, true, tickIndex);
  }

  public getPhaseBoundaryWindow(): PhaseBoundaryWindow | null {
    return this.state.phaseBoundaryWindow;
  }

  public getCurrentPhase(): RunPhase {
    return this.state.currentPhase;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSED OPPORTUNITY STREAK
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Called by CardEngine when a card expires without being played.
   * Returns the CORD penalty that should be subtracted from this tick's score.
   */
  public onMissedOpportunity(card: CardInHand, tickIndex: number): number {
    this.state.missedOpportunityStreak++;
    const streak  = this.state.missedOpportunityStreak;
    const penalty = MISS_STREAK_PENALTIES[streak] ?? MISS_STREAK_MAX_PENALTY;

    this.uxBridge.emitMissedOpportunity(
      card,
      penalty,
      streak,
      tickIndex,
    );

    return penalty;
  }

  public onCardPlayed(): void {
    // Any successful play resets the miss streak
    this.state.missedOpportunityStreak = 0;
  }

  public getMissedOpportunityStreak(): number {
    return this.state.missedOpportunityStreak;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAIN SYNERGY (IPA stacking)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Call after every card play. If the played card is IPA-type,
   * evaluates chain synergy and returns a CORD multiplier bonus.
   *
   * Returns 1.0 if no chain bonus applies.
   */
  public evaluateChainSynergy(card: CardInHand, tickIndex: number): number {
    if (card.definition.deckType !== BaseDeckType.IPA) {
      // Non-IPA card breaks the chain
      this.state.ipaChain = [];
      this.state.chainSynergyActive = false;
      this.state.chainSynergyMultiplier = 1.0;
      return 1.0;
    }

    // Prune stale entries outside the window
    this.state.ipaChain = this.state.ipaChain.filter(
      entry => tickIndex - entry.tick <= CHAIN_SYNERGY_CONFIG.WINDOW_TICKS
    );
    this.state.ipaChain.push({ instanceId: card.instanceId, tick: tickIndex });

    const count = this.state.ipaChain.length;

    if (count < CHAIN_SYNERGY_CONFIG.REQUIRED_COUNT) {
      this.state.chainSynergyActive = false;
      this.state.chainSynergyMultiplier = 1.0;
      return 1.0;
    }

    // 3+ IPA in window: compute exponential bonus
    const extra         = count - CHAIN_SYNERGY_CONFIG.REQUIRED_COUNT;
    const baseBonus     = CHAIN_SYNERGY_CONFIG.CORD_MULTIPLIER;
    const stackDecay    = Math.pow(CHAIN_SYNERGY_CONFIG.STACK_DECAY, extra);
    const finalMulti    = 1.0 + (baseBonus - 1.0) * stackDecay;

    this.state.chainSynergyActive     = true;
    this.state.chainSynergyMultiplier = finalMulti;

    return finalMulti;
  }

  public isChainSynergyActive(): boolean {
    return this.state.chainSynergyActive;
  }

  public getChainSynergyMultiplier(): number {
    return this.state.chainSynergyMultiplier;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPIRE CORD FORMULA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compute the Empire-weighted CORD contribution for a card play.
   *
   * Formula:
   *   cordContribution = Σ(tagWeight[tag] × tagPresent) × effectiveMagnitude
   *                      × chainSynergyMultiplier × (1 - missStreakPenalty)
   *
   * @param card           The card that was played
   * @param baseCordDelta  Raw CORD delta from CardEffectResolver
   * @param tickIndex      Current tick
   * @returns              Adjusted CORD contribution
   */
  public computeEmpireCord(
    card:          CardInHand,
    baseCordDelta: number,
    tickIndex:     number,
  ): number {
    // Tag weight sum
    const tags      = card.definition.tags;
    let tagScore    = 0;
    let tagCount    = 0;

    for (const tag of tags) {
      const weight = EMPIRE_CORD_WEIGHTS[tag];
      if (weight !== undefined) {
        tagScore += weight;
        tagCount++;
      }
    }

    // Normalize: if no Empire-relevant tags, fall back to 1.0
    const tagMultiplier = tagCount > 0 ? (1.0 + tagScore) : 1.0;

    // Streak penalty
    const streak         = this.state.missedOpportunityStreak;
    const streakPenalty  = MISS_STREAK_PENALTIES[streak] ?? MISS_STREAK_MAX_PENALTY;

    // Chain synergy
    const chainMulti = this.state.chainSynergyActive ? this.state.chainSynergyMultiplier : 1.0;

    return baseCordDelta * tagMultiplier * chainMulti * (1.0 - streakPenalty);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST-PLAY HOOK — call after every resolved play in GO_ALONE mode
  // ═══════════════════════════════════════════════════════════════════════════

  public onCardPlayResolved(
    card:        CardInHand,
    record:      DecisionRecord,
    tickIndex:   number,
  ): void {
    this.onCardPlayed();
    this.evaluateChainSynergy(card, tickIndex);

    // Consume phase boundary window if this was a PHASE_BOUNDARY card
    if (card.definition.deckType === BaseDeckType.PHASE_BOUNDARY) {
      this.consumePhaseBoundaryWindow(tickIndex);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE SNAPSHOT
  // ═══════════════════════════════════════════════════════════════════════════

  public getState(): Readonly<EmpireModeState> {
    return { ...this.state };
  }
}