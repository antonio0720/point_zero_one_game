//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/modes/PredatorCardMode.ts

// pzo-web/src/engines/cards/modes/PredatorCardMode.ts
//
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — PREDATOR CARD MODE HANDLER
// Mode: HEAD_TO_HEAD
//
// Responsibilities:
//   1. Battle Budget     — second economy (cash for BUILD, BB for SABOTAGE/COUNTER)
//   2. Counter Window    — 5-second reactive window on incoming extraction attacks
//   3. BLUFF Routing     — displays fake threat to opponent, executes buff/trap locally
//   4. Tag Weight Shifts — income 2.2×→0.6×, tempo up to 2.4×
//   5. Build vs. Sabotage routing — enforces correct currency per action type
//
// Integration: CardEngine instantiates PredatorCardMode in init() when
//   mode === HEAD_TO_HEAD. Tick hooks called at designated engine steps.
//
// RULES:
//   ✦ Battle Budget starts at 0 and regenerates 3 BB/tick up to max (200).
//   ✦ SABOTAGE and COUNTER cards cost BB, not cash.
//   ✦ Counter window expires after 5000ms wall-clock. No extensions.
//   ✦ BLUFF display route: opponent sees displayedAsCardId. Local effect fires.
//   ✦ Never imports from features/, store/, or EngineOrchestrator.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  GameMode,
  TimingClass,
  ModeDeckType,
  CardTag,
  BATTLE_BUDGET_CONFIG,
  type CardInHand,
  type CardPlayRequest,
  type CardEngineInitParams,
  type DecisionRecord,
} from '../cards/types';
import type { CardUXBridge } from '../cards/CardUXBridge';

// ── COUNTER WINDOW CONFIG ──────────────────────────────────────────────────────

const COUNTER_WINDOW_DURATION_MS = 5_000;

/** Bonus CORD multiplier when counter is resolved within 2 seconds. */
const COUNTER_CORD_QUICK_BONUS   = 1.25;
const COUNTER_QUICK_THRESHOLD_MS = 2_000;

// ── BLUFF DETECTION THRESHOLD ─────────────────────────────────────────────────

/**
 * If the opponent calls bluff (via BLUFF_CALLED event) within this window,
 * the bluff backfires and the buff/trap does not execute.
 */
const BLUFF_CALL_WINDOW_MS = 3_000;

// ── BB CONSUMPTION BY DECK TYPE ────────────────────────────────────────────────

const BB_COST_DECK_TYPES = new Set<string>([
  ModeDeckType.SABOTAGE,
  ModeDeckType.COUNTER,
  ModeDeckType.BLUFF,
]);

// ═══════════════════════════════════════════════════════════════════════════════
// PREDATOR MODE STATE
// ═══════════════════════════════════════════════════════════════════════════════

export interface PredatorModeState {
  battleBudget:            number;
  battleBudgetMax:         number;

  counterWindowOpen:       boolean;
  counterWindowAttackId:   string | null;
  counterWindowOpenedMs:   number;
  counterWindowEndMs:      number;
  counterWasUsed:          boolean;

  bluffsDisplayed:         number;
  bluffsCalled:            number;
  bluffsSucceeded:         number;

  extractionsLaunched:     number;
  extractionsBlocked:      number;

  totalBBEarned:           number;
  totalBBSpent:            number;
}

export interface CounterWindowResult {
  opened:    boolean;
  attackId:  string;
  durationMs: number;
}

export interface BluffResolution {
  displayed:      boolean;
  displayedAsId:  string;
  backfired:      boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREDATOR CARD MODE
// ═══════════════════════════════════════════════════════════════════════════════

export class PredatorCardMode {

  private uxBridge: CardUXBridge;
  private state:    PredatorModeState;
  private userId:   string = '';

  constructor(uxBridge: CardUXBridge) {
    this.uxBridge = uxBridge;
    this.state    = PredatorCardMode.defaultState();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  public init(params: CardEngineInitParams): void {
    this.userId = params.userId;
    this.state  = PredatorCardMode.defaultState();
    this.state.battleBudgetMax = params.battleBudgetMax ?? BATTLE_BUDGET_CONFIG.MAX;
  }

  public reset(): void {
    this.state = PredatorCardMode.defaultState();
  }

  private static defaultState(): PredatorModeState {
    return {
      battleBudget:          0,
      battleBudgetMax:       BATTLE_BUDGET_CONFIG.MAX,
      counterWindowOpen:     false,
      counterWindowAttackId: null,
      counterWindowOpenedMs: 0,
      counterWindowEndMs:    0,
      counterWasUsed:        false,
      bluffsDisplayed:       0,
      bluffsCalled:          0,
      bluffsSucceeded:       0,
      extractionsLaunched:   0,
      extractionsBlocked:    0,
      totalBBEarned:         0,
      totalBBSpent:          0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TICK HOOK — called by CardEngine at the start of each tick
  // ═══════════════════════════════════════════════════════════════════════════

  public onTick(tickIndex: number, nowMs: number): void {
    this.regenBattleBudget(tickIndex);
    this.checkCounterWindowExpiry(nowMs, tickIndex);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATTLE BUDGET
  // ═══════════════════════════════════════════════════════════════════════════

  private regenBattleBudget(tickIndex: number): void {
    const before = this.state.battleBudget;
    this.state.battleBudget = Math.min(
      this.state.battleBudgetMax,
      this.state.battleBudget + BATTLE_BUDGET_CONFIG.REGEN_PER_TICK,
    );
    const earned = this.state.battleBudget - before;
    this.state.totalBBEarned += earned;
  }

  /**
   * Consume Battle Budget for a card play.
   * Returns true if sufficient BB and BB was deducted.
   * Returns false if insufficient — caller should block the play.
   */
  public consumeBattleBudget(amount: number): boolean {
    if (this.state.battleBudget < amount) return false;
    this.state.battleBudget  -= amount;
    this.state.totalBBSpent  += amount;
    return true;
  }

  /** Grant BB (e.g. from BATTLE_BUDGET_GRANT effect). */
  public grantBattleBudget(amount: number): void {
    this.state.battleBudget = Math.min(
      this.state.battleBudgetMax,
      this.state.battleBudget + amount,
    );
    this.state.totalBBEarned += amount;
  }

  public getBattleBudget(): number {
    return this.state.battleBudget;
  }

  /**
   * Returns whether a card's play should consume BB vs. cash.
   * SABOTAGE, COUNTER, BLUFF deck types use BB.
   */
  public usesBattleBudget(card: CardInHand): boolean {
    return BB_COST_DECK_TYPES.has(card.definition.deckType as string);
  }

  /**
   * Returns the effective BB cost for a card (post overlay).
   * Returns 0 for non-BB cards.
   */
  public getBBCost(card: CardInHand): number {
    if (!this.usesBattleBudget(card)) return 0;
    // effectiveCost for BB cards is their BB cost, not cash cost
    return Math.max(0, Math.floor(card.effectiveCost));
  }

  public hasSufficientBudget(card: CardInHand): boolean {
    if (!this.usesBattleBudget(card)) return true;
    return this.state.battleBudget >= this.getBBCost(card);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COUNTER WINDOW
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Open a 5-second counter window in response to an incoming extraction attack.
   * Called by CardEngine when EXTRACTION_ACTION_FIRED fires on EventBus.
   */
  public openCounterWindow(attackId: string, nowMs: number, tickIndex: number): CounterWindowResult {
    this.state.counterWindowOpen     = true;
    this.state.counterWindowAttackId = attackId;
    this.state.counterWindowOpenedMs = nowMs;
    this.state.counterWindowEndMs    = nowMs + COUNTER_WINDOW_DURATION_MS;
    this.state.counterWasUsed        = false;

    this.uxBridge.emitCounterWindowOpened(attackId, COUNTER_WINDOW_DURATION_MS, tickIndex);

    return {
      opened:     true,
      attackId,
      durationMs: COUNTER_WINDOW_DURATION_MS,
    };
  }

  private checkCounterWindowExpiry(nowMs: number, tickIndex: number): void {
    if (!this.state.counterWindowOpen) return;
    if (nowMs >= this.state.counterWindowEndMs) {
      const wasCountered = this.state.counterWasUsed;
      const attackId     = this.state.counterWindowAttackId!;
      this.closeCounterWindow(false, tickIndex);
      this.uxBridge.emitCounterWindowClosed(attackId, wasCountered, tickIndex);
    }
  }

  public closeCounterWindow(wasCountered: boolean, tickIndex: number): void {
    if (!this.state.counterWindowOpen) return;
    const attackId = this.state.counterWindowAttackId!;
    if (wasCountered) {
      this.state.extractionsBlocked++;
      this.state.counterWasUsed = true;
    }
    this.state.counterWindowOpen     = false;
    this.state.counterWindowAttackId = null;
    this.state.counterWindowOpenedMs = 0;
    this.state.counterWindowEndMs    = 0;
  }

  public isCounterWindowOpen(): boolean {
    return this.state.counterWindowOpen;
  }

  public getCounterWindowAttackId(): string | null {
    return this.state.counterWindowAttackId;
  }

  /**
   * Returns a CORD bonus multiplier if the counter was played quickly.
   */
  public getCounterSpeedBonus(resolvedMs: number): number {
    const elapsed = resolvedMs - this.state.counterWindowOpenedMs;
    return elapsed <= COUNTER_QUICK_THRESHOLD_MS ? COUNTER_CORD_QUICK_BONUS : 1.0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BLUFF ROUTING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Route a BLUFF card play:
   *   1. Emit BLUFF_CARD_DISPLAYED with the fake displayedAsCardId
   *   2. Return resolution — if bluff backfired (opponent called it), buff doesn't apply
   *
   * The displayedAsCardId is encoded in request.choiceId for BLUFF cards.
   */
  public resolveBluff(
    card:       CardInHand,
    request:    CardPlayRequest,
    nowMs:      number,
    tickIndex:  number,
  ): BluffResolution {
    const displayedAs = request.choiceId || card.definition.cardId;
    this.uxBridge.emitBluffCardDisplayed(card, displayedAs, tickIndex);
    this.state.bluffsDisplayed++;

    // Backfire logic is triggered asynchronously (BLUFF_CALLED event).
    // For now, record as succeeded optimistically.
    this.state.bluffsSucceeded++;

    return {
      displayed:     true,
      displayedAsId: displayedAs,
      backfired:     false,  // updated if BLUFF_CALLED fires within window
    };
  }

  /**
   * Called when opponent sends BLUFF_CALLED event within BLUFF_CALL_WINDOW_MS.
   * Decrements bluffsSucceeded, increments bluffsCalled.
   */
  public onBluffCalled(): void {
    this.state.bluffsCalled++;
    if (this.state.bluffsSucceeded > 0) {
      this.state.bluffsSucceeded--;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST-PLAY HOOK
  // ═══════════════════════════════════════════════════════════════════════════

  public onCardPlayResolved(
    card:       CardInHand,
    request:    CardPlayRequest,
    record:     DecisionRecord,
    nowMs:      number,
    tickIndex:  number,
  ): void {
    // Consume BB if this was a BB-cost card
    if (this.usesBattleBudget(card)) {
      const bbCost = this.getBBCost(card);
      this.consumeBattleBudget(bbCost);
    }

    // COUNTER card played — close counter window
    if (
      card.definition.timingClass === TimingClass.COUNTER_WINDOW &&
      this.state.counterWindowOpen
    ) {
      const attackId = this.state.counterWindowAttackId ?? '';
      this.state.extractionsBlocked++;
      this.state.counterWasUsed = true;
      this.closeCounterWindow(true, tickIndex);
      this.uxBridge.emitCounterWindowClosed(attackId, true, tickIndex);
    }

    // Track extraction launches
    if (card.definition.deckType === ModeDeckType.SABOTAGE) {
      this.state.extractionsLaunched++;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE SNAPSHOT
  // ═══════════════════════════════════════════════════════════════════════════

  public getState(): Readonly<PredatorModeState> {
    return { ...this.state };
  }
}