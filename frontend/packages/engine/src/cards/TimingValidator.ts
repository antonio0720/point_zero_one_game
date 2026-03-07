// pzo-web/src/engines/cards/TimingValidator.ts
// POINT ZERO ONE — TIMING VALIDATOR v2 (Phase 3 Complete)
// All 12 timing classes validated · Density6 LLC · Confidential
//
// TIMING CLASS REGISTRY (12 classes):
//   STANDARD          — Default. Play during active decision window only.
//   IMMEDIATE         — No window required. Plays at any point in player's turn.
//   REACTIVE          — Response to an engine or opponent event. 5-tick reaction window.
//   FORCED            — Engine-injected. Cannot be played by hand; auto-applied.
//   COUNTER_WINDOW    — HEAD_TO_HEAD: must play within 5s of opponent extraction event.
//   RESCUE_WINDOW     — TEAM_UP: must play while at least one teammate is CRITICAL.
//   BLUFF             — HEAD_TO_HEAD: plays from BATTLE_BUDGET; resolves secondary on non-counter.
//   DEFECTION_STEP    — TEAM_UP: must follow arc sequence (break→silent→seize). Locked to mode.
//   PHASE_BOUNDARY    — GO_ALONE: only valid at phase transition tick (engine-triggered window).
//   SOVEREIGNTY_DECISION — GO_ALONE: one-time window at Phase 3 boundary. Single play allowed.
//   LEGENDARY         — No window. Plays immediately from any hand position. Drop-in.
//   DISCIPLINE        — CHASE_A_LEGEND: stacks with VARIANCE_LOCK; can only play if divergence > threshold.

import {
  TimingClass,
  GameMode,
  type CardInHand,
  type TimingValidationRequest,
  type TimingValidationResult,
  TIMING_WINDOW_TICKS,
} from './types';

// ── ENGINE STATE SNAPSHOT (passed per validation call) ────────────────────────
export interface EngineStateSnapshot {
  currentTick:               number;
  activeDecisionWindowOpen:  boolean;
  activeDecisionWindowOpenAt: number | null;

  // Per-mode state
  opponentExtractionEventAt: number | null;   // HEAD_TO_HEAD: tick of last extraction fire
  teammateInCritical:        boolean;          // TEAM_UP: any teammate at CRITICAL shield
  phaseTransitionWindowOpen: boolean;          // GO_ALONE: phase boundary window active
  sovereigntyWindowOpen:     boolean;          // GO_ALONE: sovereignty decision window active
  sovereigntyDecisionPlayed: boolean;          // GO_ALONE: sovereignty card already played this run

  defectionArcState: {                         // TEAM_UP defection arc tracker
    step: 0 | 1 | 2;                           // 0=none, 1=break_pact played, 2=silent_exit played
    lastStepAt: number | null;
  };

  divergenceScore:     number;                 // CHASE_A_LEGEND: current divergence (0-1)
  divergenceThreshold: number;                 // CHASE_A_LEGEND: minimum divergence to play DISCIPLINE
  battleBudget:        number;                 // HEAD_TO_HEAD: remaining battle budget
  currentPhase:        1 | 2 | 3 | 4;
  gameMode:            GameMode;
}

// ── DEFECTION ARC CARD ORDER ──────────────────────────────────────────────────
const DEFECTION_SEQUENCE: [string, string, string] = [
  'def_break_pact_001',
  'def_silent_exit_002',
  'def_asset_seizure_003',
];

// ── TIMING VALIDATOR ──────────────────────────────────────────────────────────

export class TimingValidator {

  /**
   * Primary validation entry point.
   * Returns a TimingValidationResult with pass/fail + reason string.
   * All 12 timing classes are handled via the switch below.
   */
  public validate(
    card:    CardInHand,
    state:   EngineStateSnapshot,
    request: TimingValidationRequest,
  ): TimingValidationResult {

    // ── Mode-legality pre-check ───────────────────────────────────────────────
    if (!card.definition.modes_legal.includes(state.gameMode)) {
      return this.fail(
        `Card '${card.definition.cardId}' is not legal in mode '${state.gameMode}'`
      );
    }

    // ── Overlay timing_lock check ─────────────────────────────────────────────
    // If overlay has locked this timing class in this mode, reject.
    if (card.overlay.timing_lock.includes(card.definition.timingClass)) {
      return this.fail(
        `TimingClass '${card.definition.timingClass}' is locked in mode '${state.gameMode}' for this card`
      );
    }

    // ── FORCED cards cannot be played by hand ─────────────────────────────────
    if (card.definition.is_forced) {
      return this.fail(`Forced card '${card.definition.cardId}' cannot be played from hand — engine-injected only`);
    }

    // ── Per timing class validation ───────────────────────────────────────────
    switch (card.definition.timingClass) {

      // ── STANDARD: active decision window required ─────────────────────────
      case TimingClass.STANDARD:
        return this.validateStandard(card, state);

      // ── IMMEDIATE: no window required ────────────────────────────────────
      case TimingClass.IMMEDIATE:
        return this.pass();

      // ── REACTIVE: 5-tick reaction window from triggering event ───────────
      case TimingClass.REACTIVE:
        return this.validateReactive(card, state, request);

      // ── FORCED: cannot be played from hand (caught above) ─────────────────
      case TimingClass.FORCED:
        return this.fail(`Forced cards cannot be played from hand`);

      // ── COUNTER_WINDOW: 5-tick window after opponent extraction ───────────
      case TimingClass.COUNTER_WINDOW:
        return this.validateCounterWindow(card, state);

      // ── RESCUE_WINDOW: teammate must be at CRITICAL shield ────────────────
      case TimingClass.RESCUE_WINDOW:
        return this.validateRescueWindow(card, state);

      // ── BLUFF: requires BATTLE_BUDGET; HEAD_TO_HEAD only ─────────────────
      case TimingClass.BLUFF:
        return this.validateBluff(card, state, request);

      // ── DEFECTION_STEP: arc sequence enforced ─────────────────────────────
      case TimingClass.DEFECTION_STEP:
        return this.validateDefectionStep(card, state);

      // ── PHASE_BOUNDARY: phase transition window must be open ──────────────
      case TimingClass.PHASE_BOUNDARY:
        return this.validatePhaseBoundary(card, state);

      // ── SOVEREIGNTY_DECISION: Phase 3 window, once per run ────────────────
      case TimingClass.SOVEREIGNTY_DECISION:
        return this.validateSovereigntyDecision(card, state);

      // ── LEGENDARY: always valid from hand (no window required) ────────────
      case TimingClass.LEGENDARY:
        return this.pass();

      // ── DISCIPLINE: CHASE_A_LEGEND, divergence gate ───────────────────────
      case TimingClass.DISCIPLINE:
        return this.validateDiscipline(card, state);

      default: {
        const _exhaustive: never = card.definition.timingClass;
        return this.fail(`Unknown TimingClass: ${_exhaustive}`);
      }
    }
  }

  // ── PER-CLASS VALIDATORS ──────────────────────────────────────────────────

  // STANDARD ─────────────────────────────────────────────────────────────────
  private validateStandard(card: CardInHand, state: EngineStateSnapshot): TimingValidationResult {
    if (!state.activeDecisionWindowOpen) {
      return this.fail(`STANDARD card '${card.definition.cardId}' requires an active decision window`);
    }
    return this.pass();
  }

  // REACTIVE ─────────────────────────────────────────────────────────────────
  // 5-tick window from the triggering event. If no trigger event is tracked,
  // fall through to STANDARD validation (allows proactive reactive plays).
  private validateReactive(
    card:    CardInHand,
    state:   EngineStateSnapshot,
    request: TimingValidationRequest,
  ): TimingValidationResult {
    if (request.triggerEventTick !== null && request.triggerEventTick !== undefined) {
      const elapsed = state.currentTick - request.triggerEventTick;
      const window  = TIMING_WINDOW_TICKS.REACTIVE ?? 5;
      if (elapsed > window) {
        return this.fail(
          `REACTIVE window expired — ${elapsed} ticks since trigger (max ${window})`
        );
      }
      return this.pass();
    }
    // No trigger event tick provided — require standard window
    if (!state.activeDecisionWindowOpen) {
      return this.fail(`REACTIVE card '${card.definition.cardId}' requires active decision window or trigger event`);
    }
    return this.pass();
  }

  // COUNTER_WINDOW ───────────────────────────────────────────────────────────
  // Must be HEAD_TO_HEAD. Requires opponent extraction event within last 5 ticks.
  private validateCounterWindow(card: CardInHand, state: EngineStateSnapshot): TimingValidationResult {
    if (state.gameMode !== GameMode.HEAD_TO_HEAD) {
      return this.fail(`COUNTER_WINDOW requires HEAD_TO_HEAD mode`);
    }
    if (state.opponentExtractionEventAt === null) {
      return this.fail(`No active counter window — opponent has not fired an extraction`);
    }
    const elapsed = state.currentTick - state.opponentExtractionEventAt;
    const window  = TIMING_WINDOW_TICKS.COUNTER_WINDOW ?? 5;
    if (elapsed > window) {
      return this.fail(
        `COUNTER_WINDOW expired — ${elapsed} ticks since extraction (max ${window})`
      );
    }
    return this.pass();
  }

  // RESCUE_WINDOW ────────────────────────────────────────────────────────────
  // Must be TEAM_UP. At least one teammate must be at CRITICAL shield.
  private validateRescueWindow(card: CardInHand, state: EngineStateSnapshot): TimingValidationResult {
    if (state.gameMode !== GameMode.TEAM_UP) {
      return this.fail(`RESCUE_WINDOW requires TEAM_UP mode`);
    }
    if (!state.teammateInCritical) {
      return this.fail(`RESCUE_WINDOW requires at least one teammate at CRITICAL shield integrity`);
    }
    return this.pass();
  }

  // BLUFF ────────────────────────────────────────────────────────────────────
  // Requires HEAD_TO_HEAD. Costs from BATTLE_BUDGET (not liquid cash).
  // If budget insufficient, reject.
  private validateBluff(
    card:    CardInHand,
    state:   EngineStateSnapshot,
    request: TimingValidationRequest,
  ): TimingValidationResult {
    if (state.gameMode !== GameMode.HEAD_TO_HEAD) {
      return this.fail(`BLUFF requires HEAD_TO_HEAD mode`);
    }
    const bluffCost = card.effectiveCost; // cost_modifier already applied
    if (state.battleBudget < bluffCost) {
      return this.fail(
        `Insufficient BATTLE_BUDGET for BLUFF — requires ${bluffCost}, have ${state.battleBudget}`
      );
    }
    return this.pass();
  }

  // DEFECTION_STEP ───────────────────────────────────────────────────────────
  // TEAM_UP only. Arc sequence enforced:
  //   step 0: def_break_pact_001 must be played first
  //   step 1: def_silent_exit_002 must follow break_pact
  //   step 2: def_asset_seizure_003 must follow silent_exit
  // Each step must be played within MAX_DEFECTION_STEP_GAP ticks of the previous.
  private validateDefectionStep(card: CardInHand, state: EngineStateSnapshot): TimingValidationResult {
    if (state.gameMode !== GameMode.TEAM_UP) {
      return this.fail(`DEFECTION_STEP requires TEAM_UP mode`);
    }

    const cardId     = card.definition.cardId;
    const { step, lastStepAt } = state.defectionArcState;
    const MAX_GAP    = 10; // ticks between defection arc steps

    // ── Step timing gap check ───────────────────────────────────────────────
    if (lastStepAt !== null && step > 0) {
      const elapsed = state.currentTick - lastStepAt;
      if (elapsed > MAX_GAP) {
        return this.fail(
          `Defection arc expired — ${elapsed} ticks since last step (max ${MAX_GAP}). Arc resets.`
        );
      }
    }

    // ── Sequence enforcement ────────────────────────────────────────────────
    switch (cardId) {
      case DEFECTION_SEQUENCE[0]: // def_break_pact_001
        if (step !== 0) {
          return this.fail(`Defection arc: '${cardId}' must be the FIRST step (arc step is ${step})`);
        }
        return this.pass();

      case DEFECTION_SEQUENCE[1]: // def_silent_exit_002
        if (step !== 1) {
          return this.fail(
            `Defection arc: '${cardId}' requires '${DEFECTION_SEQUENCE[0]}' to be played first (arc step is ${step})`
          );
        }
        return this.pass();

      case DEFECTION_SEQUENCE[2]: // def_asset_seizure_003
        if (step !== 2) {
          return this.fail(
            `Defection arc: '${cardId}' requires steps 0 and 1 completed first (arc step is ${step})`
          );
        }
        return this.pass();

      default:
        return this.fail(`Unknown DEFECTION_STEP card: '${cardId}'`);
    }
  }

  // PHASE_BOUNDARY ───────────────────────────────────────────────────────────
  // GO_ALONE only. Phase transition window must be open (engine-triggered).
  private validatePhaseBoundary(card: CardInHand, state: EngineStateSnapshot): TimingValidationResult {
    if (state.gameMode !== GameMode.GO_ALONE) {
      return this.fail(`PHASE_BOUNDARY requires GO_ALONE mode`);
    }
    if (!state.phaseTransitionWindowOpen) {
      return this.fail(`PHASE_BOUNDARY: no phase transition window is currently open`);
    }
    return this.pass();
  }

  // SOVEREIGNTY_DECISION ─────────────────────────────────────────────────────
  // GO_ALONE, Phase 3 only. Once-per-run. Sovereignty window must be open.
  private validateSovereigntyDecision(card: CardInHand, state: EngineStateSnapshot): TimingValidationResult {
    if (state.gameMode !== GameMode.GO_ALONE) {
      return this.fail(`SOVEREIGNTY_DECISION requires GO_ALONE mode`);
    }
    if (state.currentPhase < 3) {
      return this.fail(`SOVEREIGNTY_DECISION is only available in Phase 3 or later (current: ${state.currentPhase})`);
    }
    if (state.sovereigntyDecisionPlayed) {
      return this.fail(`SOVEREIGNTY_DECISION can only be played once per run`);
    }
    if (!state.sovereigntyWindowOpen) {
      return this.fail(`SOVEREIGNTY_DECISION: sovereignty window is not currently open`);
    }
    return this.pass();
  }

  // DISCIPLINE ───────────────────────────────────────────────────────────────
  // CHASE_A_LEGEND only. Divergence must be above threshold to unlock.
  // Rationale: discipline cards are the response to being behind — they only
  // activate when the gap is meaningful enough to require variance reduction.
  private validateDiscipline(card: CardInHand, state: EngineStateSnapshot): TimingValidationResult {
    if (state.gameMode !== GameMode.CHASE_A_LEGEND) {
      return this.fail(`DISCIPLINE requires CHASE_A_LEGEND mode`);
    }
    if (state.divergenceScore < state.divergenceThreshold) {
      return this.fail(
        `DISCIPLINE locked — divergence ${state.divergenceScore.toFixed(3)} is below threshold ${state.divergenceThreshold.toFixed(3)}`
      );
    }
    return this.pass();
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  private pass(): TimingValidationResult {
    return { valid: true, reason: null };
  }

  private fail(reason: string): TimingValidationResult {
    return { valid: false, reason };
  }
}

// ── DEFECTION ARC STATE MACHINE ───────────────────────────────────────────────
// Tracks the 3-step defection arc across card plays.
// CardEngine calls advanceDefectionArc after each DEFECTION_STEP card resolves.

export class DefectionArcStateMachine {
  private step:       0 | 1 | 2    = 0;
  private lastStepAt: number | null = null;

  public getState(): EngineStateSnapshot['defectionArcState'] {
    return { step: this.step, lastStepAt: this.lastStepAt };
  }

  public advance(cardId: string, currentTick: number): void {
    const expected = DEFECTION_SEQUENCE[this.step];
    if (cardId !== expected) {
      console.warn(`[DefectionArc] Unexpected card '${cardId}' for step ${this.step} — arc reset`);
      this.reset();
      return;
    }
    if (this.step < 2) {
      this.step = (this.step + 1) as 1 | 2;
    }
    this.lastStepAt = currentTick;
  }

  public reset(): void {
    this.step       = 0;
    this.lastStepAt = null;
  }

  public isComplete(): boolean {
    return this.step === 2 && this.lastStepAt !== null;
  }
}

// ── SOVEREIGNTY WINDOW TRACKER ────────────────────────────────────────────────
// Simple one-shot tracker for the Phase 3 sovereignty decision window.

export class SovereigntyWindowTracker {
  private windowOpen:    boolean = false;
  private decisionMade:  boolean = false;
  private openedAtTick:  number | null = null;
  private readonly windowDuration = TIMING_WINDOW_TICKS.SOVEREIGNTY_DECISION ?? 999;

  public openWindow(currentTick: number): void {
    if (this.decisionMade) return; // one-shot
    this.windowOpen   = true;
    this.openedAtTick = currentTick;
  }

  public isOpen(currentTick: number): boolean {
    if (!this.windowOpen || this.decisionMade) return false;
    if (this.openedAtTick === null) return false;
    const elapsed = currentTick - this.openedAtTick;
    return elapsed <= this.windowDuration;
  }

  public recordDecision(): void {
    this.decisionMade = true;
    this.windowOpen   = false;
  }

  public isDecisionMade(): boolean {
    return this.decisionMade;
  }
}