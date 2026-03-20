/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT TYPING THEATER
 * FILE: pzo-web/src/engines/chat/presence/TypingTheater.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic scheduler and action planner for ambient typing / reading /
 * lurk theater.
 *
 * This file turns presence style into *timed behavior* so the rest of the chat
 * lane can feel watched before it is spoken to.
 *
 * It does not replace:
 * - ChatTypingController.ts
 * - ChatPresenceController.ts
 * - backend transcript authority
 *
 * It sits between style selection and controller execution. The output is a
 * queue of due actions the runtime can apply when appropriate.
 *
 * Design doctrine
 * ---------------
 * 1. Typing theater is authored pressure with a clock.
 * 2. Feints matter. Start-then-stop matters. Silence after read matters.
 * 3. Helpers, rivals, deal agents, crowd, system, and liveops deserve distinct
 *    pacing rules.
 * 4. A read delay and a typing sequence should agree with each other.
 * 5. Queue operations must be deterministic, inspectable, and cancel-safe.
 * 6. Frontend stages responsiveness; backend still owns durable truth.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatPresenceIntent,
  ChatPresenceTypingBehavior,
} from '../../../../../shared/contracts/chat/ChatPresenceStyle';

import type {
  ChatActorKind,
  ChatChannelId,
  ChatMessageId,
  ChatPresenceSnapshot,
  ChatPresenceState,
  ChatReadReceipt,
  ChatTypingSnapshot,
  ChatTypingState,
  JsonObject,
  PressureTier,
  TickTier,
  UnixMs,
} from '../types';

import {
  NpcPresenceStyleRegistry,
  type NpcPresencePlannedCue,
  type NpcPresenceReactionMode,
  type NpcPresenceRuntimeContext,
} from './NpcPresenceStyle';

import {
  ReadDelayPolicy,
  type ReadDelayEvaluationInput,
  type ReadDelayDecision,
} from './ReadDelayPolicy';

// ============================================================================
// MARK: Public theater contracts
// ============================================================================

export type TypingTheaterActionKind =
  | 'SET_PRESENCE'
  | 'START_TYPING'
  | 'PAUSE_TYPING'
  | 'STOP_TYPING'
  | 'MARK_READ'
  | 'EMIT_HINT'
  | 'CANCEL_PLAN';

export type TypingTheaterHintKind =
  | 'EDGE_PEEK'
  | 'READ_AND_WAIT'
  | 'UNREAD_PRESSURE'
  | 'HELPER_HOLD'
  | 'RIVAL_FEINT'
  | 'LIVEOPS_PULSE';

export interface TypingTheaterPlanContext {
  readonly now: UnixMs;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly messageId: ChatMessageId;
  readonly trigger: NpcPresenceRuntimeContext['trigger'];
  readonly preferredIntent?: ChatPresenceIntent;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly pressureScore?: number;
  readonly urgencyScore?: number;
  readonly rescueRiskScore?: number;
  readonly embarrassmentScore?: number;
  readonly rivalryScore?: number;
  readonly crowdHeatScore?: number;
  readonly negotiationRiskScore?: number;
  readonly worldEventWeight?: number;
  readonly helperProtectionWindowActive?: boolean;
  readonly counterplayWindowOpen?: boolean;
  readonly unreadStreak?: number;
  readonly messageAgeMs?: number;
  readonly metadata?: JsonObject;
}

export interface TypingTheaterPlanStep {
  readonly stepId: string;
  readonly dueAt: UnixMs;
  readonly kind: TypingTheaterActionKind;
  readonly typingState?: ChatTypingState;
  readonly presenceState?: ChatPresenceState;
  readonly readDecision?: ReadDelayDecision;
  readonly hintKind?: TypingTheaterHintKind;
  readonly metadata?: JsonObject;
}

export interface TypingTheaterPlan {
  readonly planId: string;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly messageId: ChatMessageId;
  readonly cue: NpcPresencePlannedCue;
  readonly readDecision: ReadDelayDecision;
  readonly steps: readonly TypingTheaterPlanStep[];
  readonly createdAt: UnixMs;
  readonly expiresAt: UnixMs;
}

export interface TypingTheaterAction {
  readonly actionId: string;
  readonly planId: string;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly messageId: ChatMessageId;
  readonly dueAt: UnixMs;
  readonly kind: TypingTheaterActionKind;
  readonly typing?: ChatTypingSnapshot;
  readonly presence?: ChatPresenceSnapshot;
  readonly readReceipt?: ChatReadReceipt;
  readonly hintKind?: TypingTheaterHintKind;
  readonly metadata?: JsonObject;
}

export interface TypingTheaterSnapshot {
  readonly activePlanCount: number;
  readonly queuedActionCount: number;
  readonly metrics: TypingTheaterMetrics;
}

export interface TypingTheaterMetrics {
  readonly plannedCount: number;
  readonly cancelledCount: number;
  readonly executedCount: number;
  readonly feintCount: number;
  readonly pauseCount: number;
  readonly readActionCount: number;
  readonly hintCount: number;
}

export interface TypingTheaterOptions {
  readonly registry?: NpcPresenceStyleRegistry;
  readonly readDelayPolicy?: ReadDelayPolicy;
  readonly log?: (message: string, context?: Record<string, unknown>) => void;
}

interface InternalPlanState {
  readonly plan: TypingTheaterPlan;
  nextIndex: number;
  cancelled: boolean;
}

const DEFAULT_METRICS: TypingTheaterMetrics = Object.freeze({
  plannedCount: 0,
  cancelledCount: 0,
  executedCount: 0,
  feintCount: 0,
  pauseCount: 0,
  readActionCount: 0,
  hintCount: 0,
});

// ============================================================================
// MARK: Helpers
// ============================================================================

function asUnixMs(value: number): UnixMs {
  return value as UnixMs;
}

function stableHash(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(33, hash) ^ input.charCodeAt(index);
  }
  return Math.abs(hash);
}

function signedJitter(seed: string, magnitude: number): number {
  const hash = stableHash(seed);
  return magnitude <= 0 ? 0 : (hash % (magnitude * 2 + 1)) - magnitude;
}

function typingTokenSeed(actorId: string, channelId: ChatChannelId, dueAt: UnixMs): string {
  return `typing:${actorId}:${channelId}:${Number(dueAt)}`;
}

function toPresenceContext(input: TypingTheaterPlanContext): NpcPresenceRuntimeContext {
  return {
    now: input.now,
    actorId: input.actorId,
    actorKind: input.actorKind,
    channelId: input.channelId,
    trigger: input.trigger,
    preferredIntent: input.preferredIntent,
    currentPressureTier: input.pressureTier,
    currentTickTier: input.tickTier,
    pressureScore: input.pressureScore,
    urgencyScore: input.urgencyScore,
    rescueRiskScore: input.rescueRiskScore,
    embarrassmentScore: input.embarrassmentScore,
    rivalryScore: input.rivalryScore,
    crowdHeatScore: input.crowdHeatScore,
    negotiationRiskScore: input.negotiationRiskScore,
    worldEventWeight: input.worldEventWeight,
    helperProtectionWindowActive: input.helperProtectionWindowActive,
    counterplayWindowOpen: input.counterplayWindowOpen,
    unreadStreak: input.unreadStreak,
    metadata: input.metadata,
  };
}

function toReadInput(input: TypingTheaterPlanContext): ReadDelayEvaluationInput {
  return {
    now: input.now,
    actorId: input.actorId,
    actorKind: input.actorKind,
    channelId: input.channelId,
    messageId: input.messageId,
    trigger: input.trigger,
    preferredIntent: input.preferredIntent,
    pressureTier: input.pressureTier,
    tickTier: input.tickTier,
    pressureScore: input.pressureScore,
    urgencyScore: input.urgencyScore,
    rescueRiskScore: input.rescueRiskScore,
    embarrassmentScore: input.embarrassmentScore,
    rivalryScore: input.rivalryScore,
    crowdHeatScore: input.crowdHeatScore,
    negotiationRiskScore: input.negotiationRiskScore,
    worldEventWeight: input.worldEventWeight,
    helperProtectionWindowActive: input.helperProtectionWindowActive,
    counterplayWindowOpen: input.counterplayWindowOpen,
    unreadStreak: input.unreadStreak,
    messageAgeMs: input.messageAgeMs,
    metadata: input.metadata,
  };
}

function buildPresenceSnapshot(
  context: TypingTheaterPlanContext,
  dueAt: UnixMs,
  presenceState: ChatPresenceState,
  latencyMs: number,
): ChatPresenceSnapshot {
  return {
    actorId: context.actorId,
    actorKind: context.actorKind,
    channelId: context.channelId,
    presence: presenceState,
    updatedAt: dueAt,
    isVisibleToPlayer: !String(context.channelId).endsWith('_SHADOW'),
    latencyMs,
  };
}

function buildTypingSnapshot(
  context: TypingTheaterPlanContext,
  dueAt: UnixMs,
  typingState: ChatTypingState,
  expiresAt?: UnixMs,
  simulatedByPersona?: string,
): ChatTypingSnapshot {
  return {
    actorId: context.actorId,
    actorKind: context.actorKind,
    channelId: context.channelId,
    typingState,
    startedAt: typingState === 'STARTED' || typingState === 'SIMULATED' ? dueAt : undefined,
    expiresAt,
    token: typingTokenSeed(context.actorId, context.channelId, dueAt) as ChatTypingSnapshot['token'],
    simulatedByPersona,
  };
}

function buildActionId(planId: string, step: TypingTheaterPlanStep): string {
  return `${planId}:${step.stepId}`;
}

// ============================================================================
// MARK: Theater
// ============================================================================

export class TypingTheater {
  private readonly registry: NpcPresenceStyleRegistry;
  private readonly readDelayPolicy: ReadDelayPolicy;
  private readonly log?: (message: string, context?: Record<string, unknown>) => void;
  private readonly plans = new Map<string, InternalPlanState>();
  private metrics: TypingTheaterMetrics = { ...DEFAULT_METRICS };

  public constructor(options: TypingTheaterOptions = {}) {
    this.registry = options.registry ?? new NpcPresenceStyleRegistry();
    this.readDelayPolicy = options.readDelayPolicy ?? new ReadDelayPolicy({ registry: this.registry });
    this.log = options.log;
  }

  public getSnapshot(): TypingTheaterSnapshot {
    let queuedActionCount = 0;
    for (const state of this.plans.values()) {
      queuedActionCount += Math.max(0, state.plan.steps.length - state.nextIndex);
    }
    return {
      activePlanCount: this.plans.size,
      queuedActionCount,
      metrics: { ...this.metrics },
    };
  }

  public planReaction(input: TypingTheaterPlanContext): TypingTheaterPlan {
    const cue = this.registry.planCue(toPresenceContext(input));
    const readDecision = this.readDelayPolicy.evaluate(toReadInput(input));
    const createdAt = input.now;
    const steps = this.composeSteps(input, cue, readDecision);
    const expiresAt = steps.length > 0
      ? steps[steps.length - 1]!.dueAt
      : asUnixMs(Number(createdAt) + cue.computedLatencyMs);

    const plan: TypingTheaterPlan = {
      planId: `theater:${input.actorId}:${stableHash(`${input.channelId}:${input.messageId}:${Number(input.now)}`)}`,
      actorId: input.actorId,
      actorKind: input.actorKind,
      channelId: input.channelId,
      messageId: input.messageId,
      cue,
      readDecision,
      steps,
      createdAt,
      expiresAt,
    };

    this.plans.set(plan.planId, {
      plan,
      nextIndex: 0,
      cancelled: false,
    });

    this.metrics = {
      ...this.metrics,
      plannedCount: this.metrics.plannedCount + 1,
      feintCount: this.metrics.feintCount + (steps.some((step) => step.hintKind === 'RIVAL_FEINT') ? 1 : 0),
      pauseCount: this.metrics.pauseCount + (steps.some((step) => step.kind === 'PAUSE_TYPING') ? 1 : 0),
      readActionCount: this.metrics.readActionCount + (steps.some((step) => step.kind === 'MARK_READ') ? 1 : 0),
      hintCount: this.metrics.hintCount + steps.filter((step) => step.kind === 'EMIT_HINT').length,
    };

    this.log?.('typing_theater_planned', {
      actorId: input.actorId,
      actorKind: input.actorKind,
      channelId: input.channelId,
      planId: plan.planId,
      stepCount: steps.length,
      reactionMode: cue.reactionMode,
      intent: cue.cue.intent,
    });

    return plan;
  }

  public drainDueActions(now: UnixMs): readonly TypingTheaterAction[] {
    const dueActions: TypingTheaterAction[] = [];
    const toDelete: string[] = [];

    for (const [planId, state] of this.plans.entries()) {
      if (state.cancelled) {
        toDelete.push(planId);
        continue;
      }

      while (state.nextIndex < state.plan.steps.length) {
        const step = state.plan.steps[state.nextIndex]!;
        if (Number(step.dueAt) > Number(now)) {
          break;
        }
        dueActions.push(this.materializeAction(state.plan, step));
        state.nextIndex += 1;
        this.metrics = {
          ...this.metrics,
          executedCount: this.metrics.executedCount + 1,
        };
      }

      if (state.nextIndex >= state.plan.steps.length || Number(state.plan.expiresAt) < Number(now)) {
        toDelete.push(planId);
      }
    }

    for (const planId of toDelete) {
      this.plans.delete(planId);
    }

    dueActions.sort((left, right) => Number(left.dueAt) - Number(right.dueAt));
    return dueActions;
  }

  public cancelActor(actorId: string, reason = 'actor_cancelled'): void {
    for (const [planId, state] of this.plans.entries()) {
      if (state.plan.actorId === actorId) {
        state.cancelled = true;
        this.metrics = {
          ...this.metrics,
          cancelledCount: this.metrics.cancelledCount + 1,
        };
        this.log?.('typing_theater_cancelled', { actorId, planId, reason });
      }
    }
  }

  public cancelChannel(channelId: ChatChannelId, reason = 'channel_cancelled'): void {
    for (const [planId, state] of this.plans.entries()) {
      if (state.plan.channelId === channelId) {
        state.cancelled = true;
        this.metrics = {
          ...this.metrics,
          cancelledCount: this.metrics.cancelledCount + 1,
        };
        this.log?.('typing_theater_cancelled', { channelId, planId, reason });
      }
    }
  }

  private composeSteps(
    input: TypingTheaterPlanContext,
    cue: NpcPresencePlannedCue,
    readDecision: ReadDelayDecision,
  ): readonly TypingTheaterPlanStep[] {
    const startTime = Number(input.now);
    const latency = cue.computedLatencyMs;
    const leadInMs = this.resolveLeadInMs(cue);
    const typingStartAt = startTime + leadInMs;
    const readAt = Number(readDecision.markReadAt);
    const revealAt = startTime + latency;
    const stopAt = Math.max(typingStartAt + 60, revealAt - this.resolveStopLeadMs(cue));
    const steps: TypingTheaterPlanStep[] = [];

    steps.push({
      stepId: 'presence:set-initial',
      dueAt: input.now,
      kind: 'SET_PRESENCE',
      presenceState: cue.localPresenceState,
      metadata: {
        phase: 'initial',
        reactionMode: cue.reactionMode,
      },
    });

    if (cue.lurkPolicy?.behavior && cue.lurkPolicy.behavior !== 'NONE') {
      const hint = this.resolveHintKind(cue);
      steps.push({
        stepId: 'hint:lurk',
        dueAt: asUnixMs(startTime + Math.max(0, leadInMs - this.resolveHintLeadMs(cue))),
        kind: 'EMIT_HINT',
        hintKind: hint,
        metadata: {
          phase: 'lurk',
          behavior: cue.lurkPolicy.behavior,
        },
      });
    }

    if (readDecision.delayMs > 0 || readDecision.shouldEmitReceipt) {
      steps.push({
        stepId: 'read:mark',
        dueAt: readDecision.markReadAt,
        kind: 'MARK_READ',
        readDecision,
        metadata: {
          phase: 'read',
          behavior: readDecision.behavior,
          reasonCode: readDecision.reasonCode,
        },
      });
    }

    const behavior = cue.typingPhase?.behavior ?? 'NONE';
    switch (behavior) {
      case 'NONE':
        break;
      case 'INSTANT':
        steps.push(this.createStartStep(input, cue, asUnixMs(typingStartAt)));
        steps.push(this.createStopStep(input, cue, asUnixMs(stopAt)));
        break;
      case 'SHORT_BURST':
        steps.push(this.createStartStep(input, cue, asUnixMs(typingStartAt)));
        steps.push(this.createStopStep(input, cue, asUnixMs(Math.min(stopAt, typingStartAt + 420))));
        break;
      case 'STEADY':
      case 'NEGOTIATION_MEASURED':
      case 'LIVEOPS_BROADCAST':
      case 'RESCUE_GENTLE':
        steps.push(this.createStartStep(input, cue, asUnixMs(typingStartAt)));
        steps.push(this.createStopStep(input, cue, asUnixMs(stopAt)));
        break;
      case 'STUTTER':
        steps.push(this.createStartStep(input, cue, asUnixMs(typingStartAt)));
        steps.push(this.createPauseStep(input, cue, asUnixMs(typingStartAt + 280)));
        steps.push(this.createStartStep(input, cue, asUnixMs(typingStartAt + 520), 'restart'));
        steps.push(this.createStopStep(input, cue, asUnixMs(stopAt)));
        break;
      case 'FEINT':
      case 'BAIT_PAUSE':
        steps.push(this.createStartStep(input, cue, asUnixMs(typingStartAt)));
        steps.push(this.createStopStep(input, cue, asUnixMs(typingStartAt + 240), 'feint_stop'));
        steps.push({
          stepId: 'hint:feint',
          dueAt: asUnixMs(typingStartAt + 260),
          kind: 'EMIT_HINT',
          hintKind: 'RIVAL_FEINT',
          metadata: {
            phase: 'feint',
          },
        });
        if (cue.reactionMode !== 'STALL') {
          steps.push(this.createStartStep(input, cue, asUnixMs(Math.max(typingStartAt + 420, revealAt - 300)), 'feint_restart'));
          steps.push(this.createStopStep(input, cue, asUnixMs(stopAt)));
        }
        break;
      case 'AGGRESSIVE_STOP_START':
        steps.push(this.createStartStep(input, cue, asUnixMs(typingStartAt)));
        steps.push(this.createPauseStep(input, cue, asUnixMs(typingStartAt + 160)));
        steps.push(this.createStartStep(input, cue, asUnixMs(typingStartAt + 260), 'aggressive_restart'));
        steps.push(this.createStopStep(input, cue, asUnixMs(stopAt)));
        break;
      case 'LONG_FORM':
        steps.push(this.createStartStep(input, cue, asUnixMs(typingStartAt)));
        steps.push(this.createPauseStep(input, cue, asUnixMs(typingStartAt + Math.max(500, Math.round(latency * 0.34)))));
        steps.push(this.createStartStep(input, cue, asUnixMs(typingStartAt + Math.max(800, Math.round(latency * 0.46))), 'longform_resume'));
        steps.push(this.createStopStep(input, cue, asUnixMs(stopAt)));
        break;
      default:
        steps.push(this.createStartStep(input, cue, asUnixMs(typingStartAt)));
        steps.push(this.createStopStep(input, cue, asUnixMs(stopAt)));
        break;
    }

    steps.sort((left, right) => Number(left.dueAt) - Number(right.dueAt));
    return steps;
  }

  private createStartStep(
    input: TypingTheaterPlanContext,
    cue: NpcPresencePlannedCue,
    dueAt: UnixMs,
    phase = 'start',
  ): TypingTheaterPlanStep {
    return {
      stepId: `typing:${phase}`,
      dueAt,
      kind: 'START_TYPING',
      typingState: cue.visibleToPlayer ? cue.localTypingState : 'SIMULATED',
      metadata: {
        phase,
        reactionMode: cue.reactionMode,
      },
    };
  }

  private createPauseStep(
    input: TypingTheaterPlanContext,
    cue: NpcPresencePlannedCue,
    dueAt: UnixMs,
  ): TypingTheaterPlanStep {
    return {
      stepId: 'typing:pause',
      dueAt,
      kind: 'PAUSE_TYPING',
      typingState: 'PAUSED',
      metadata: {
        reactionMode: cue.reactionMode,
      },
    };
  }

  private createStopStep(
    input: TypingTheaterPlanContext,
    cue: NpcPresencePlannedCue,
    dueAt: UnixMs,
    phase = 'stop',
  ): TypingTheaterPlanStep {
    return {
      stepId: `typing:${phase}`,
      dueAt,
      kind: 'STOP_TYPING',
      typingState: 'STOPPED',
      metadata: {
        phase,
        reactionMode: cue.reactionMode,
      },
    };
  }

  private resolveLeadInMs(cue: NpcPresencePlannedCue): number {
    const latency = cue.computedLatencyMs;
    switch (cue.reactionMode) {
      case 'INSTANT_STRIKE':
        return Math.max(30, Math.round(latency * 0.12));
      case 'STALL':
        return Math.max(220, Math.round(latency * 0.58));
      case 'RESCUE_HOLD':
        return Math.max(120, Math.round(latency * 0.34));
      case 'CEREMONIAL':
        return Math.max(40, Math.round(latency * 0.18));
      case 'SLOW_BURN':
        return Math.max(280, Math.round(latency * 0.52));
      case 'FEINT':
        return Math.max(60, Math.round(latency * 0.22));
      case 'MEASURED':
      default:
        return Math.max(80, Math.round(latency * 0.28));
    }
  }

  private resolveStopLeadMs(cue: NpcPresencePlannedCue): number {
    switch (cue.typingPhase?.behavior) {
      case 'SHORT_BURST':
        return 20;
      case 'LIVEOPS_BROADCAST':
      case 'RESCUE_GENTLE':
        return 70;
      case 'NEGOTIATION_MEASURED':
        return 140;
      case 'FEINT':
      case 'BAIT_PAUSE':
        return 180;
      case 'AGGRESSIVE_STOP_START':
        return 90;
      case 'LONG_FORM':
        return 160;
      default:
        return 60;
    }
  }

  private resolveHintLeadMs(cue: NpcPresencePlannedCue): number {
    switch (cue.lurkPolicy?.behavior) {
      case 'PREDATORY_LURK':
        return 420;
      case 'RESCUE_WATCH':
        return 180;
      case 'LIVEOPS_SHADOW':
        return 60;
      case 'CROWD_SWELL':
        return 260;
      case 'HEAVY_LURK':
        return 320;
      case 'EDGE_PEEK':
      case 'SHORT_LURK':
      default:
        return 120;
    }
  }

  private resolveHintKind(cue: NpcPresencePlannedCue): TypingTheaterHintKind {
    if (cue.style.actorKind === 'HELPER') {
      return cue.reactionMode === 'RESCUE_HOLD' ? 'HELPER_HOLD' : 'READ_AND_WAIT';
    }
    if (cue.style.actorKind === 'DEAL_AGENT') {
      return 'UNREAD_PRESSURE';
    }
    if (cue.style.actorKind === 'LIVEOPS_AGENT' || cue.style.actorKind === 'SYSTEM') {
      return 'LIVEOPS_PULSE';
    }
    if (cue.style.actorKind === 'RIVAL') {
      return 'RIVAL_FEINT';
    }
    return 'EDGE_PEEK';
  }

  private materializeAction(plan: TypingTheaterPlan, step: TypingTheaterPlanStep): TypingTheaterAction {
    const context: TypingTheaterPlanContext = {
      now: plan.createdAt,
      actorId: plan.actorId,
      actorKind: plan.actorKind,
      channelId: plan.channelId,
      messageId: plan.messageId,
      trigger: plan.cue.cue.trigger,
    };

    const typing = step.kind === 'START_TYPING' || step.kind === 'PAUSE_TYPING' || step.kind === 'STOP_TYPING'
      ? buildTypingSnapshot(
          context,
          step.dueAt,
          step.typingState ?? 'STARTED',
          step.kind === 'START_TYPING'
            ? asUnixMs(Number(step.dueAt) + Math.max(250, plan.cue.computedLatencyMs))
            : undefined,
          plan.cue.style.id,
        )
      : undefined;

    const presence = step.kind === 'SET_PRESENCE'
      ? buildPresenceSnapshot(context, step.dueAt, step.presenceState ?? plan.cue.localPresenceState, plan.cue.computedLatencyMs)
      : undefined;

    const readReceipt = step.kind === 'MARK_READ'
      ? {
          actorId: plan.actorId,
          actorKind: plan.actorKind,
          messageId: plan.messageId,
          readAt: step.readDecision?.markReadAt ?? step.dueAt,
          delayedByPolicy: Boolean(step.readDecision?.delayedByPolicy),
          delayReason: step.readDecision?.suppressReceipt
            ? 'NPC_LATENCY'
            : step.readDecision?.behavior === 'AFTER_OFFER_REVIEW'
              ? 'NEGOTIATION_PRESSURE'
              : 'PRESENCE_THEATER',
        } satisfies ChatReadReceipt
      : undefined;

    return {
      actionId: buildActionId(plan.planId, step),
      planId: plan.planId,
      actorId: plan.actorId,
      actorKind: plan.actorKind,
      channelId: plan.channelId,
      messageId: plan.messageId,
      dueAt: step.dueAt,
      kind: step.kind,
      typing,
      presence,
      readReceipt,
      hintKind: step.hintKind,
      metadata: {
        cueId: plan.cue.cue.id,
        reactionMode: plan.cue.reactionMode,
        ...step.metadata,
      },
    };
  }
}

export function createTypingTheater(options: TypingTheaterOptions = {}): TypingTheater {
  return new TypingTheater(options);
}
