//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/modes/SyndicateCardMode.ts

// pzo-web/src/engines/cards/modes/SyndicateCardMode.ts
//
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SYNDICATE CARD MODE HANDLER
// Mode: TEAM_UP
//
// Responsibilities:
//   1. Trust Score       — modifier on all AID/RESCUE card effectiveness
//   2. AID Card Terms    — repayment tracking; Trust Score penalty on default
//   3. RESCUE Window     — opens on CRITICAL pressure tier; effectiveness decays
//                          with delay (starts at 1.0×, decays to 0.4× at expiry)
//   4. Defection Arc     — 3-card betrayal sequence with ≥1 tick gap enforcement,
//                          CORD penalty on completion
//   5. Shared Objective  — card injection into team-visible queue
//
// Integration: CardEngine instantiates SyndicateCardMode in init() when
//   mode === TEAM_UP. Tick hooks + EventBus listeners called at engine steps.
//
// RULES:
//   ✦ Trust Score clamped 0–100. Never negative cast, never > 100.
//   ✦ Defection sequence: BREAK_PACT → SILENT_EXIT → ASSET_SEIZURE.
//     Each step must be ≥1 tick after the previous.
//   ✦ AID repayment: if dueAtTick passes without repayment, default fires.
//   ✦ RESCUE effectiveness: linear decay over window duration.
//   ✦ Never imports from features/, store/, or EngineOrchestrator.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  DefectionStep,
  TRUST_SCORE_CONFIG,
  DEFECTION_CORD_PENALTY,
  type CardInHand,
  type CardPlayRequest,
  type AidCardTerms,
  type CardEngineInitParams,
  type DecisionRecord,
} from '../types';
import type { CardUXBridge } from '../CardUXBridge';

// ── RESCUE WINDOW CONFIG ───────────────────────────────────────────────────────

const RESCUE_WINDOW_DURATION_MS  = 15_000;
const RESCUE_EFFECTIVENESS_MIN   = 0.4;   // minimum multiplier at expiry
const RESCUE_EFFECTIVENESS_MAX   = 1.0;   // multiplier when played immediately

// ── DEFECTION TIMING ─────────────────────────────────────────────────────────

const MIN_TICKS_BETWEEN_DEFECTION_STEPS = 1;

// ── AID PENALTY ───────────────────────────────────────────────────────────────

const AID_DEFAULT_TRUST_PENALTY = 20;  // default Trust Score hit on missed repayment

// ── SHARED OBJECTIVE CONFIG ───────────────────────────────────────────────────

const SHARED_OBJECTIVE_MAX_QUEUE = 5;

// ═══════════════════════════════════════════════════════════════════════════════
// SYNDICATE MODE STATE
// ═══════════════════════════════════════════════════════════════════════════════

export interface SyndicateModeState {
  trustScore:              number;         // 0–100

  rescueWindowOpen:        boolean;
  rescueWindowTeammateId:  string | null;
  rescueWindowOpenedMs:    number;
  rescueWindowEndMs:       number;

  activeAidTerms:          AidCardTerms[];
  completedAidTerms:       AidCardTerms[];
  defaultedAidTerms:       AidCardTerms[];

  defectionHistory:        DefectionStep[];
  lastDefectionTick:       number;
  defectionCompleted:      boolean;
  defectionCordPenalty:    number;

  sharedObjectiveQueue:    string[];  // cardIds visible to all teammates

  totalRescuesAttempted:   number;
  totalDefaults:           number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNDICATE CARD MODE
// ═══════════════════════════════════════════════════════════════════════════════

export class SyndicateCardMode {

  private uxBridge: CardUXBridge;
  private state:    SyndicateModeState;
  private userId:   string = '';

  constructor(uxBridge: CardUXBridge) {
    this.uxBridge = uxBridge;
    this.state    = SyndicateCardMode.defaultState();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  public init(params: CardEngineInitParams): void {
    this.userId = params.userId;
    this.state  = SyndicateCardMode.defaultState();
    this.state.trustScore = params.trustScoreInit ?? TRUST_SCORE_CONFIG.INIT;
  }

  public reset(): void {
    this.state = SyndicateCardMode.defaultState();
  }

  private static defaultState(): SyndicateModeState {
    return {
      trustScore:             TRUST_SCORE_CONFIG.INIT,
      rescueWindowOpen:       false,
      rescueWindowTeammateId: null,
      rescueWindowOpenedMs:   0,
      rescueWindowEndMs:      0,
      activeAidTerms:         [],
      completedAidTerms:      [],
      defaultedAidTerms:      [],
      defectionHistory:       [],
      lastDefectionTick:      -100,
      defectionCompleted:     false,
      defectionCordPenalty:   0,
      sharedObjectiveQueue:   [],
      totalRescuesAttempted:  0,
      totalDefaults:          0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TICK HOOK
  // ═══════════════════════════════════════════════════════════════════════════

  public onTick(tickIndex: number, nowMs: number): void {
    this.checkRescueWindowExpiry(nowMs, tickIndex);
    this.checkAidRepaymentDeadlines(tickIndex);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRUST SCORE
  // ═══════════════════════════════════════════════════════════════════════════

  public getTrustScore(): number {
    return this.state.trustScore;
  }

  /**
   * Returns the Trust Score multiplier applied to AID/RESCUE effectiveness.
   * Trust 0–50   → 0.5× to 1.0× linear
   * Trust 50–100 → 1.0× to 1.5× linear
   */
  public getTrustMultiplier(): number {
    const t = this.state.trustScore;
    if (t <= 50) return 0.5 + (t / 50) * 0.5;
    return 1.0 + ((t - 50) / 50) * 0.5;
  }

  public applyTrustBoost(amount: number): void {
    this.state.trustScore = Math.min(
      TRUST_SCORE_CONFIG.MAX,
      this.state.trustScore + amount,
    );
  }

  public applyTrustPenalty(amount: number): void {
    this.state.trustScore = Math.max(
      TRUST_SCORE_CONFIG.MIN,
      this.state.trustScore - amount,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESCUE WINDOW
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Open rescue window when teammate hits CRITICAL pressure tier.
   * Called from CardEngine EventBus subscription.
   */
  public openRescueWindow(teammateId: string, nowMs: number, tickIndex: number): void {
    this.state.rescueWindowOpen      = true;
    this.state.rescueWindowTeammateId= teammateId;
    this.state.rescueWindowOpenedMs  = nowMs;
    this.state.rescueWindowEndMs     = nowMs + RESCUE_WINDOW_DURATION_MS;
    this.state.totalRescuesAttempted++;

    this.uxBridge.emitRescueWindowOpened(teammateId, RESCUE_WINDOW_DURATION_MS, tickIndex);
  }

  private checkRescueWindowExpiry(nowMs: number, tickIndex: number): void {
    if (!this.state.rescueWindowOpen) return;
    if (nowMs >= this.state.rescueWindowEndMs) {
      const teammate = this.state.rescueWindowTeammateId!;
      const eff = this.getRescueEffectiveness(nowMs);
      this.closeRescueWindow(false, tickIndex);
      this.uxBridge.emitRescueWindowClosed(teammate, false, eff, tickIndex);
    }
  }

  public closeRescueWindow(wasRescued: boolean, tickIndex: number): void {
    if (!this.state.rescueWindowOpen) return;
    const teammate = this.state.rescueWindowTeammateId!;
    const eff = this.getRescueEffectiveness(Date.now()); // best estimate
    this.state.rescueWindowOpen      = false;
    this.state.rescueWindowTeammateId= null;
    this.state.rescueWindowOpenedMs  = 0;
    this.state.rescueWindowEndMs     = 0;
    if (wasRescued) {
      this.uxBridge.emitRescueWindowClosed(teammate, true, eff, tickIndex);
    }
  }

  /**
   * Linear effectiveness decay: 1.0 immediately → 0.4 at window expiry.
   * Multiplied by Trust Score multiplier.
   */
  public getRescueEffectiveness(nowMs: number): number {
    if (!this.state.rescueWindowOpen) return RESCUE_EFFECTIVENESS_MIN;
    const elapsed   = Math.max(0, nowMs - this.state.rescueWindowOpenedMs);
    const progress  = Math.min(1.0, elapsed / RESCUE_WINDOW_DURATION_MS);
    const base      = RESCUE_EFFECTIVENESS_MAX - progress * (RESCUE_EFFECTIVENESS_MAX - RESCUE_EFFECTIVENESS_MIN);
    return base * this.getTrustMultiplier();
  }

  public isRescueWindowOpen(): boolean {
    return this.state.rescueWindowOpen;
  }

  public getRescueWindowTeammate(): string | null {
    return this.state.rescueWindowTeammateId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AID CARD TERMS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Register AID card terms when an AID card is played.
   */
  public activateAidTerms(terms: AidCardTerms, tickIndex: number): void {
    this.state.activeAidTerms.push({ ...terms });
    this.uxBridge.emitAidTermsActivated(terms, tickIndex);
  }

  /**
   * Mark an AID contract as repaid. Applies Trust Score boost.
   */
  public repayAid(lenderId: string, receiverId: string, amount: number, tickIndex: number): void {
    const idx = this.state.activeAidTerms.findIndex(
      t => t.lenderId === lenderId && t.receiverId === receiverId && !t.isRepaid,
    );
    if (idx === -1) return;

    const terms   = this.state.activeAidTerms[idx];
    const repaid  = { ...terms, isRepaid: true };
    this.state.activeAidTerms.splice(idx, 1);
    this.state.completedAidTerms.push(repaid);

    // Repayment boosts trust slightly
    this.applyTrustBoost(5);
    this.uxBridge.emitAidRepaid(lenderId, receiverId, amount, tickIndex);
  }

  private checkAidRepaymentDeadlines(tickIndex: number): void {
    const now = [...this.state.activeAidTerms];
    for (let i = now.length - 1; i >= 0; i--) {
      const terms = now[i];
      if (!terms.isRepaid && tickIndex >= terms.dueAtTick) {
        // Default
        this.state.activeAidTerms.splice(i, 1);
        this.state.defaultedAidTerms.push(terms);
        this.state.totalDefaults++;

        const penalty = terms.penaltyOnDefault > 0
          ? terms.penaltyOnDefault
          : AID_DEFAULT_TRUST_PENALTY;
        this.applyTrustPenalty(penalty);
        this.uxBridge.emitAidDefaulted(terms.receiverId, penalty, tickIndex);
      }
    }
  }

  public getActiveAidTerms(): AidCardTerms[] {
    return [...this.state.activeAidTerms];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFECTION ARC
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate whether a defection step card is legal to play now.
   * Returns null if valid, or a string rejection reason.
   */
  public validateDefectionStep(step: DefectionStep, tickIndex: number): string | null {
    const history = this.state.defectionHistory;

    if (this.state.defectionCompleted) {
      return 'Defection arc already completed';
    }

    // BREAK_PACT must be first
    if (step === DefectionStep.BREAK_PACT) {
      if (history.length > 0) return 'BREAK_PACT must be the first defection step';
      return null;
    }

    // SILENT_EXIT requires BREAK_PACT was played ≥1 tick ago
    if (step === DefectionStep.SILENT_EXIT) {
      if (history.length === 0 || history[history.length - 1] !== DefectionStep.BREAK_PACT) {
        return 'SILENT_EXIT requires BREAK_PACT to be played first';
      }
      if (tickIndex - this.state.lastDefectionTick < MIN_TICKS_BETWEEN_DEFECTION_STEPS) {
        return 'SILENT_EXIT must be played ≥1 tick after BREAK_PACT';
      }
      return null;
    }

    // ASSET_SEIZURE requires SILENT_EXIT was played ≥1 tick ago
    if (step === DefectionStep.ASSET_SEIZURE) {
      if (history.length < 2 || history[history.length - 1] !== DefectionStep.SILENT_EXIT) {
        return 'ASSET_SEIZURE requires SILENT_EXIT to be played first';
      }
      if (tickIndex - this.state.lastDefectionTick < MIN_TICKS_BETWEEN_DEFECTION_STEPS) {
        return 'ASSET_SEIZURE must be played ≥1 tick after SILENT_EXIT';
      }
      return null;
    }

    return 'Unknown defection step';
  }

  /**
   * Record a defection step play and fire events.
   * Returns the CORD penalty if defection is completed, else 0.
   */
  public onDefectionStep(
    step:        DefectionStep,
    card:        CardInHand,
    tickIndex:   number,
  ): number {
    this.state.defectionHistory.push(step);
    this.state.lastDefectionTick = tickIndex;

    this.uxBridge.emitDefectionStepPlayed(step, this.userId, tickIndex);

    // Defection lowers trust
    this.applyTrustPenalty(TRUST_SCORE_CONFIG.DEFECTION_PENALTY);

    if (step === DefectionStep.ASSET_SEIZURE) {
      this.state.defectionCompleted    = true;
      this.state.defectionCordPenalty  = DEFECTION_CORD_PENALTY;
      this.uxBridge.emitDefectionCompleted(this.userId, DEFECTION_CORD_PENALTY, tickIndex);
      return DEFECTION_CORD_PENALTY;
    }

    return 0;
  }

  public getDefectionHistory(): DefectionStep[] {
    return [...this.state.defectionHistory];
  }

  public isDefectionCompleted(): boolean {
    return this.state.defectionCompleted;
  }

  public getLastDefectionTick(): number {
    return this.state.lastDefectionTick;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHARED OBJECTIVE QUEUE
  // ═══════════════════════════════════════════════════════════════════════════

  public injectSharedObjective(cardId: string): boolean {
    if (this.state.sharedObjectiveQueue.length >= SHARED_OBJECTIVE_MAX_QUEUE) return false;
    this.state.sharedObjectiveQueue.push(cardId);
    return true;
  }

  public getSharedObjectiveQueue(): string[] {
    return [...this.state.sharedObjectiveQueue];
  }

  public consumeSharedObjective(cardId: string): boolean {
    const idx = this.state.sharedObjectiveQueue.indexOf(cardId);
    if (idx === -1) return false;
    this.state.sharedObjectiveQueue.splice(idx, 1);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST-PLAY HOOK
  // ═══════════════════════════════════════════════════════════════════════════

  public onCardPlayResolved(
    card:      CardInHand,
    request:   CardPlayRequest,
    record:    DecisionRecord,
    nowMs:     number,
    tickIndex: number,
  ): void {
    // AID card — register terms
    if (card.definition.deckType === 'AID') {
      const terms: AidCardTerms = {
        lenderId:         this.userId,
        receiverId:       request.targetId ?? 'teammate',
        amount:           card.effectiveCost,
        repaymentTicks:   10,   // default 10-tick repayment window
        dueAtTick:        tickIndex + 10,
        penaltyOnDefault: AID_DEFAULT_TRUST_PENALTY,
        isRepaid:         false,
      };
      this.activateAidTerms(terms, tickIndex);
    }

    // RESCUE card — close rescue window
    if (card.definition.timingClass === 'RESCUE_WINDOW' && this.state.rescueWindowOpen) {
      this.closeRescueWindow(true, tickIndex);
    }

    // TRUST card — boost trust score
    if (card.definition.deckType === 'TRUST') {
      this.applyTrustBoost(card.definition.base_effect.magnitude * this.getTrustMultiplier());
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE SNAPSHOT
  // ═══════════════════════════════════════════════════════════════════════════

  public getState(): Readonly<SyndicateModeState> {
    return { ...this.state };
  }
}