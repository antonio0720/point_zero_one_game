//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/TimingValidator.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — TIMING VALIDATOR
// pzo-web/src/engines/cards/TimingValidator.ts
//
// Validates whether a card play is legal at the moment of the request.
// All 12 timing classes are enforced here. Returns a typed ValidationResult
// with rejection code and human-readable reason on failure.
//
// RULES:
//   ✦ Forced cards must be resolved before non-forced plays are accepted.
//   ✦ IMMEDIATE cards are always playable — no window check needed.
//   ✦ LEGENDARY cards are always playable — cannot be blocked by bots or timing.
//   ✦ HOLD cards are not "played" — they are staged. TimingValidator blocks
//     direct play if a card is currently isHeld === true.
//   ✦ Mode locks (overlay.timing_lock) are respected for all non-LEGENDARY cards.
//   ✦ Budget checks (Battle Budget for Predator cards) are enforced here.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  GameMode,
  TimingClass,
  TimingRejectionCode,
  DefectionStep,
  type CardInHand,
  type CardPlayRequest,
  type ValidationResult,
  type PhaseBoundaryWindow,
} from './types';

// ── VALIDATOR CONTEXT ─────────────────────────────────────────────────────────
// The current game state snapshot relevant to timing validation.
// Provided by CardEngine each tick — TimingValidator is stateless.

export interface TimingValidatorContext {
  mode:                  GameMode;
  currentTick:           number;
  forcedCardPending:     boolean;      // any unresolved forced card in hand?
  counterWindowOpen:     boolean;      // Predator: 5-sec counter window active?
  counterWindowAttackId: string | null;// which attack triggered the counter window
  rescueWindowOpen:      boolean;      // Syndicate: teammate is CRITICAL?
  rescueWindowTeammate:  string | null;
  phaseBoundaryWindow:   PhaseBoundaryWindow | null; // GO_ALONE phase transition window
  activeBattleBudget:    number;       // Predator: current BB
  defectionStepHistory:  DefectionStep[]; // Syndicate: which steps played this run
  lastDefectionTick:     number;       // tick when last defection step was played
  sovereigntyWindowOpen: boolean;      // GO_ALONE: minute 11:30 window?
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMING VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class TimingValidator {

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate whether a card play request is legal.
   *
   * @param card    - The card the player wants to play
   * @param ctx     - Current game state snapshot for timing context
   * @param request - The play request (choice, target, timestamp).
   *                  Optional — only required for BLUFF timing class validation.
   *                  Pass undefined (or omit) for all other timing classes.
   * @returns       ValidationResult — valid:true or valid:false with rejection code
   */
  public validate(
    card:    CardInHand,
    ctx:     TimingValidatorContext,
    request?: CardPlayRequest,
  ): ValidationResult {
    // ── GATE 0: Card is currently in hold slot ─────────────────────────────
    if (card.isHeld) {
      return this.reject(
        TimingRejectionCode.CARD_ON_HOLD,
        `Card '${card.definition.name}' is staged in the hold slot and cannot be played directly. Release it first.`,
      );
    }

    // ── GATE 1: Already resolved ────────────────────────────────────────────
    if (card.decisionWindowId === null && !this.isAlwaysPlayable(card)) {
      // Card with no open window and not always-playable — stale or already resolved
      return this.reject(
        TimingRejectionCode.ALREADY_RESOLVED,
        `Card '${card.definition.name}' has no active decision window.`,
      );
    }

    // ── GATE 2: Forced card pending — blocks non-forced plays ───────────────
    if (ctx.forcedCardPending && !card.isForced) {
      return this.reject(
        TimingRejectionCode.FORCED_CARD_PENDING,
        `A forced card must be resolved before '${card.definition.name}' can be played.`,
      );
    }

    // ── GATE 3: Mode-level timing lock ──────────────────────────────────────
    const timingClass = card.definition.timingClass;
    if (card.overlay.timing_lock.includes(timingClass)) {
      return this.reject(
        TimingRejectionCode.TIMING_CLASS_LOCKED,
        `Timing class '${timingClass}' is locked in ${ctx.mode} mode.`,
      );
    }

    // ── GATE 4: Per timing class enforcement ────────────────────────────────
    return this.validateByTimingClass(card, ctx, request);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: PER TIMING CLASS RULES
  // ═══════════════════════════════════════════════════════════════════════════

  private validateByTimingClass(
    card:    CardInHand,
    ctx:     TimingValidatorContext,
    request?: CardPlayRequest,
  ): ValidationResult {
    const tc = card.definition.timingClass;

    switch (tc) {

      // ── IMMEDIATE: always playable, no window needed ─────────────────────
      case TimingClass.IMMEDIATE:
        return this.accept();

      // ── LEGENDARY: always playable, cannot be blocked ─────────────────────
      case TimingClass.LEGENDARY:
        return this.accept();

      // ── STANDARD: playable while decision window is open ─────────────────
      case TimingClass.STANDARD:
        return this.validateWindowOpen(card, ctx);

      // ── REACTIVE: playable within 2 ticks of triggering event ─────────────
      // Decision window manages the countdown — validate window is open.
      case TimingClass.REACTIVE:
        return this.validateWindowOpen(card, ctx);

      // ── HOLD: cannot be "played" directly — must go through hold system ───
      case TimingClass.HOLD:
        return this.reject(
          TimingRejectionCode.TIMING_CLASS_LOCKED,
          `'${card.definition.name}' uses the HOLD timing class. Use the hold action — not play.`,
        );

      // ── COUNTER_WINDOW: Predator only — 5-sec window must be active ───────
      case TimingClass.COUNTER_WINDOW:
        if (!ctx.counterWindowOpen) {
          return this.reject(
            TimingRejectionCode.COUNTER_WINDOW_CLOSED,
            `Counter window is not active. '${card.definition.name}' can only be played during the 5-second counter window.`,
          );
        }
        return this.accept();

      // ── RESCUE_WINDOW: Syndicate only — teammate must be CRITICAL ─────────
      case TimingClass.RESCUE_WINDOW:
        if (!ctx.rescueWindowOpen) {
          return this.reject(
            TimingRejectionCode.RESCUE_WINDOW_CLOSED,
            `Rescue window is not active. '${card.definition.name}' can only be played when a teammate is in CRITICAL pressure tier.`,
          );
        }
        return this.accept();

      // ── PHASE_BOUNDARY: GO_ALONE only — 5-tick phase window must be open ──
      case TimingClass.PHASE_BOUNDARY:
        return this.validatePhaseBoundary(card, ctx);

      // ── FORCED: must be resolved — no discard, no skip ───────────────────
      // Player must always pick the worst option if they want to get rid of it.
      // Window is managed by DecisionWindowManager.
      case TimingClass.FORCED:
        return this.validateWindowOpen(card, ctx);

      // ── BLUFF: Predator only — displayed as threat but executes buff/trap ─
      case TimingClass.BLUFF:
        return this.validateBluff(card, ctx, request);

      // ── DEFECTION_STEP: Syndicate only — must follow 3-card sequence ──────
      case TimingClass.DEFECTION_STEP:
        return this.validateDefectionStep(card, ctx);

      // ── SOVEREIGNTY_DECISION: GO_ALONE only — final card at minute 11:30 ──
      case TimingClass.SOVEREIGNTY_DECISION:
        return this.validateSovereigntyWindow(card, ctx);

      default: {
        // Exhaustive check — any unhandled TimingClass is a build error
        const _exhaustive: never = tc;
        return this.reject(
          TimingRejectionCode.TIMING_CLASS_LOCKED,
          `Unknown timing class: ${_exhaustive}`,
        );
      }
    }
  }

  // ── Per-class validators ──────────────────────────────────────────────────

  private validateWindowOpen(card: CardInHand, ctx: TimingValidatorContext): ValidationResult {
    if (!card.decisionWindowId) {
      return this.reject(
        TimingRejectionCode.NO_ACTIVE_WINDOW,
        `'${card.definition.name}' has no open decision window.`,
      );
    }
    return this.accept();
  }

  private validatePhaseBoundary(
    card: CardInHand,
    ctx:  TimingValidatorContext,
  ): ValidationResult {
    if (ctx.mode !== GameMode.GO_ALONE) {
      return this.reject(
        TimingRejectionCode.TIMING_CLASS_LOCKED,
        `Phase boundary cards are only legal in GO ALONE mode.`,
      );
    }
    if (!ctx.phaseBoundaryWindow || ctx.phaseBoundaryWindow.isConsumed) {
      return this.reject(
        TimingRejectionCode.PHASE_BOUNDARY_CLOSED,
        `No phase boundary window is currently open. '${card.definition.name}' is only available during the 5-tick phase transition window.`,
      );
    }
    if (!ctx.phaseBoundaryWindow.cardsAvailable.includes(card.definition.cardId)) {
      return this.reject(
        TimingRejectionCode.PHASE_BOUNDARY_CLOSED,
        `'${card.definition.name}' is not in the current phase boundary card pool.`,
      );
    }
    return this.accept();
  }

  private validateBluff(
    card:    CardInHand,
    ctx:     TimingValidatorContext,
    request?: CardPlayRequest,
  ): ValidationResult {
    if (ctx.mode !== GameMode.HEAD_TO_HEAD) {
      return this.reject(
        TimingRejectionCode.TIMING_CLASS_LOCKED,
        `Bluff cards are only legal in HEAD TO HEAD mode.`,
      );
    }
    // Battle Budget check — BLUFF cards cost BB
    const cost = card.effectiveCost;
    if (ctx.activeBattleBudget < cost) {
      return this.reject(
        TimingRejectionCode.INSUFFICIENT_BUDGET,
        `Insufficient Battle Budget. '${card.definition.name}' costs ${cost} BB. You have ${ctx.activeBattleBudget} BB.`,
      );
    }
    return this.accept();
  }

  private validateDefectionStep(
    card: CardInHand,
    ctx:  TimingValidatorContext,
  ): ValidationResult {
    if (ctx.mode !== GameMode.TEAM_UP) {
      return this.reject(
        TimingRejectionCode.TIMING_CLASS_LOCKED,
        `Defection cards are only legal in TEAM UP mode.`,
      );
    }

    const cardId = card.definition.cardId;
    const history = ctx.defectionStepHistory;

    // Determine required step from cardId
    let requiredStep: DefectionStep | null = null;
    if (cardId === 'def_break_pact_001') {
      requiredStep = DefectionStep.BREAK_PACT;
    } else if (cardId === 'def_silent_exit_002') {
      requiredStep = DefectionStep.SILENT_EXIT;
    } else if (cardId === 'def_asset_seizure_003') {
      requiredStep = DefectionStep.ASSET_SEIZURE;
    }

    if (!requiredStep) {
      return this.reject(
        TimingRejectionCode.DEFECTION_OUT_OF_ORDER,
        `Unknown defection card: '${cardId}'.`,
      );
    }

    // Sequence enforcement: BREAK_PACT → SILENT_EXIT → ASSET_SEIZURE
    // Each step must be at least 1 tick after the previous
    if (requiredStep === DefectionStep.BREAK_PACT) {
      if (history.includes(DefectionStep.BREAK_PACT)) {
        return this.reject(
          TimingRejectionCode.DEFECTION_OUT_OF_ORDER,
          `BREAK_PACT has already been played this run.`,
        );
      }
    } else if (requiredStep === DefectionStep.SILENT_EXIT) {
      if (!history.includes(DefectionStep.BREAK_PACT)) {
        return this.reject(
          TimingRejectionCode.DEFECTION_OUT_OF_ORDER,
          `SILENT_EXIT requires BREAK_PACT to be played first.`,
        );
      }
      if (ctx.currentTick <= ctx.lastDefectionTick) {
        return this.reject(
          TimingRejectionCode.DEFECTION_OUT_OF_ORDER,
          `SILENT_EXIT must be played at least 1 tick after BREAK_PACT.`,
        );
      }
    } else if (requiredStep === DefectionStep.ASSET_SEIZURE) {
      if (!history.includes(DefectionStep.SILENT_EXIT)) {
        return this.reject(
          TimingRejectionCode.DEFECTION_OUT_OF_ORDER,
          `ASSET_SEIZURE requires SILENT_EXIT to be played first.`,
        );
      }
      if (ctx.currentTick <= ctx.lastDefectionTick) {
        return this.reject(
          TimingRejectionCode.DEFECTION_OUT_OF_ORDER,
          `ASSET_SEIZURE must be played at least 1 tick after SILENT_EXIT.`,
        );
      }
    }

    return this.accept();
  }

  private validateSovereigntyWindow(
    card: CardInHand,
    ctx:  TimingValidatorContext,
  ): ValidationResult {
    if (ctx.mode !== GameMode.GO_ALONE) {
      return this.reject(
        TimingRejectionCode.TIMING_CLASS_LOCKED,
        `SOVEREIGNTY_DECISION card is only legal in GO ALONE mode.`,
      );
    }
    if (!ctx.sovereigntyWindowOpen) {
      return this.reject(
        TimingRejectionCode.NO_ACTIVE_WINDOW,
        `The sovereignty window has not opened yet. This card appears at minute 11:30.`,
      );
    }
    return this.accept();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private isAlwaysPlayable(card: CardInHand): boolean {
    return (
      card.definition.timingClass === TimingClass.IMMEDIATE ||
      card.definition.timingClass === TimingClass.LEGENDARY
    );
  }

  private accept(): ValidationResult {
    return { valid: true, rejectionCode: null, reason: null };
  }

  private reject(code: TimingRejectionCode, reason: string): ValidationResult {
    return { valid: false, rejectionCode: code, reason };
  }
}