// backend/src/game/engine/timing_validator.ts

/**
 * POINT ZERO ONE — BACKEND TIMING VALIDATOR
 * backend/src/game/engine/timing_validator.ts
 *
 * Validates doctrine-native timing classes against authoritative backend state.
 * This validator is intentionally mode-aware and backend-safe.
 */

import {
  GameMode,
  TimingClass,
  type CardInHand,
  type CardPlayRequest,
  type ExecutionContext,
  type TimingValidationResult,
  Targeting,
  TimingRejectionCode,
  TIMING_CLASS_WINDOW_MS,
  TIMING_WINDOW_TICKS,
  clamp,
  isDeckLegalInMode,
  isTimingClassLegalInMode,
  resolveEffectiveTimingClasses,
} from './card_types';

export class TimingValidator {
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

    return this.validateTimingWindow(card, request, context, requestedTiming, allowedTimingClasses);
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

    const open = (() => {
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