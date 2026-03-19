/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ATTACK WINDOW POLICY
 * FILE: backend/src/game/engine/chat/combat/ChatAttackWindowPolicy.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend timing law for attack windows inside the chat combat lane.
 *
 * This file controls when counter windows open, how long they stay relevant,
 * what counts as ideal timing, when grace is allowed, how helper assistance
 * extends or compresses agency, and how public pressure, proof, quote leverage,
 * and negotiation escape reshape the legal response window.
 *
 * What this file owns
 * -------------------
 * - deriving authoritative window duration and timing targets from fight truth,
 * - constructing backend-safe ChatBossCounterWindowBinding and ChatCounterWindow data,
 * - evaluating whether a player reply is early, ideal, late, expired, or forced closed,
 * - determining window extensions, grace periods, hard close moments, and reopen refusal,
 * - and returning deterministic timing breakdowns suitable for replay and audit.
 *
 * What this file does not own
 * ---------------------------
 * - text generation,
 * - candidate ranking,
 * - fight victory judgment,
 * - frontend animation rules,
 * - or transport fanout.
 *
 * Design doctrine
 * ---------------
 * - Timing is gameplay, not decoration.
 * - Public exposure should widen readability but intensify consequences.
 * - Quiet rooms should compress windows without making them unreadable.
 * - Rescue should save the run, not erase accountability.
 * - Proof and quote counters deserve extra precision time because they require recall.
 * - Every window must be reconstructible from authoritative input.
 * ============================================================================
 */

import type {
  ChatBossAttack,
  ChatBossAttackSeverity,
  ChatBossCounterWindowBinding,
  ChatBossFightPlan,
  ChatBossOpeningMode,
  ChatBossRound,
} from '../../../../../../shared/contracts/chat/ChatBossFight';
import {
  toScore01 as toBossScore01,
} from '../../../../../../shared/contracts/chat/ChatBossFight';

import type {
  ChatCounterRiskBand,
  ChatCounterTimingClass,
  ChatCounterValidationStatus,
  ChatCounterWindow,
} from '../../../../../../shared/contracts/chat/ChatCounterplay';

import type {
  ChatChannelId,
  ChatEventId,
  ChatMessage,
  ChatRoomId,
  ChatRoomState,
  ChatSessionId,
  ChatSessionState,
  ChatSignalEnvelope,
  ChatState,
  ChatVisibleChannel,
  JsonValue,
  Nullable,
  PressureTier,
  Score01,
  UnixMs,
} from '../types';
import {
  asUnixMs,
  clamp01,
  isVisibleChannelId,
} from '../types';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface ChatAttackWindowPolicyClock {
  now(): number;
}

export interface ChatAttackWindowPolicyLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatAttackWindowPolicyTuning {
  readonly minimumWindowMs: number;
  readonly defaultWindowMs: number;
  readonly maximumWindowMs: number;
  readonly minimumGraceMs: number;
  readonly maximumGraceMs: number;
  readonly proofBonusMs: number;
  readonly quoteBonusMs: number;
  readonly helperBonusMs: number;
  readonly rescueBonusMs: number;
  readonly silenceBonusMs: number;
  readonly fakeOutPenaltyMs: number;
  readonly publicWidenBias01: Score01;
  readonly quietCompressionBias01: Score01;
  readonly reopenRefusalThreshold01: Score01;
  readonly legendPreservationBias01: Score01;
}

export interface ChatAttackWindowPolicyOptions {
  readonly clock?: ChatAttackWindowPolicyClock;
  readonly logger?: ChatAttackWindowPolicyLogger;
  readonly tuning?: Partial<ChatAttackWindowPolicyTuning>;
}

export interface ChatAttackWindowBudgetBreakdown {
  readonly baseWindowMs: number;
  readonly channelAdjustedMs: number;
  readonly openingAdjustedMs: number;
  readonly severityAdjustedMs: number;
  readonly pressureAdjustedMs: number;
  readonly witnessAdjustedMs: number;
  readonly proofAdjustedMs: number;
  readonly quoteAdjustedMs: number;
  readonly helperAdjustedMs: number;
  readonly rescueAdjustedMs: number;
  readonly silenceAdjustedMs: number;
  readonly fakeOutPenaltyMs: number;
  readonly finalWindowMs: number;
}

export interface ChatAttackWindowTimeline {
  readonly opensAt: UnixMs;
  readonly idealResponseAt: UnixMs;
  readonly softCloseAt: UnixMs;
  readonly graceEndsAt: UnixMs;
  readonly hardCloseAt: UnixMs;
}

export interface ChatAttackWindowCreationRequest {
  readonly state: ChatState;
  readonly room: ChatRoomState;
  readonly session: ChatSessionState;
  readonly fight: ChatBossFightPlan;
  readonly round: ChatBossRound;
  readonly attack: ChatBossAttack;
  readonly signal?: ChatSignalEnvelope | null;
  readonly sourceMessage?: ChatMessage | null;
  readonly causeEventId?: ChatEventId | null;
  readonly now?: UnixMs;
  readonly notes?: readonly string[];
}

export interface ChatAttackWindowCreationResult {
  readonly binding: ChatBossCounterWindowBinding;
  readonly window: ChatCounterWindow;
  readonly budget: ChatAttackWindowBudgetBreakdown;
  readonly timeline: ChatAttackWindowTimeline;
  readonly visibleChannel: ChatVisibleChannel;
  readonly debug: Readonly<Record<string, JsonValue>>;
}

export interface ChatAttackWindowEvaluationRequest {
  readonly window: ChatCounterWindow;
  readonly at?: UnixMs;
  readonly playerMessage?: ChatMessage | null;
  readonly selectedCounterplayId?: string | null;
  readonly forceCloseReason?: string | null;
}

export interface ChatAttackWindowEvaluationResult {
  readonly lifecycle: 'PREOPEN' | 'IDEAL' | 'OPEN' | 'GRACE' | 'EXPIRED' | 'FORCED_CLOSED';
  readonly validationStatus: ChatCounterValidationStatus;
  readonly acceptsVisibleReply: boolean;
  readonly acceptsSilentCounter: boolean;
  readonly acceptsHelperAssist: boolean;
  readonly msUntilClose: number;
  readonly msFromIdeal: number;
  readonly likelyFailure: string | null;
  readonly debug: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_CLOCK: ChatAttackWindowPolicyClock = Object.freeze({
  now: () => Date.now(),
});

const DEFAULT_LOGGER: ChatAttackWindowPolicyLogger = Object.freeze({
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
});

export const DEFAULT_CHAT_ATTACK_WINDOW_POLICY_TUNING: ChatAttackWindowPolicyTuning = Object.freeze({
  minimumWindowMs: 850,
  defaultWindowMs: 2450,
  maximumWindowMs: 7800,
  minimumGraceMs: 120,
  maximumGraceMs: 1400,
  proofBonusMs: 360,
  quoteBonusMs: 280,
  helperBonusMs: 310,
  rescueBonusMs: 420,
  silenceBonusMs: 260,
  fakeOutPenaltyMs: 190,
  publicWidenBias01: clamp01(0.24),
  quietCompressionBias01: clamp01(0.16),
  reopenRefusalThreshold01: clamp01(0.58),
  legendPreservationBias01: clamp01(0.33),
});

const WINDOW_CHANNEL_PROFILE = Object.freeze({
  GLOBAL: Object.freeze({
    multiplier: 1.14,
    graceMultiplier: 1.08,
    witnessBonus01: clamp01(0.24),
    riskBand: 'MEDIUM',
  }),
  SYNDICATE: Object.freeze({
    multiplier: 1.01,
    graceMultiplier: 0.96,
    witnessBonus01: clamp01(0.15),
    riskBand: 'MEDIUM',
  }),
  DEAL_ROOM: Object.freeze({
    multiplier: 0.86,
    graceMultiplier: 0.82,
    witnessBonus01: clamp01(0.08),
    riskBand: 'HIGH',
  }),
  DIRECT: Object.freeze({
    multiplier: 0.93,
    graceMultiplier: 0.88,
    witnessBonus01: clamp01(0.06),
    riskBand: 'MEDIUM',
  }),
  SPECTATOR: Object.freeze({
    multiplier: 0.9,
    graceMultiplier: 0.84,
    witnessBonus01: clamp01(0.2),
    riskBand: 'HIGH',
  }),
} as const);

const WINDOW_OPENING_MODE_PROFILE = Object.freeze({
  VISIBLE: Object.freeze({
    multiplier: 1.06,
    idealResponseRatio: 0.48,
    visibleReply: true,
    allowsSilence: false,
  }),
  QUIET: Object.freeze({
    multiplier: 0.94,
    idealResponseRatio: 0.57,
    visibleReply: true,
    allowsSilence: true,
  }),
  SHADOW: Object.freeze({
    multiplier: 0.82,
    idealResponseRatio: 0.61,
    visibleReply: false,
    allowsSilence: true,
  }),
  CROWD_SURGE: Object.freeze({
    multiplier: 0.88,
    idealResponseRatio: 0.44,
    visibleReply: true,
    allowsSilence: false,
  }),
  BAIT: Object.freeze({
    multiplier: 0.97,
    idealResponseRatio: 0.52,
    visibleReply: true,
    allowsSilence: true,
  }),
} as const);

const WINDOW_SEVERITY_PROFILE = Object.freeze({
  LOW: Object.freeze({
    multiplier: 0.92,
    graceRatio: 0.11,
    pressureBias: 'EARLY',
  }),
  MEDIUM: Object.freeze({
    multiplier: 1.0,
    graceRatio: 0.13,
    pressureBias: 'NORMAL',
  }),
  HIGH: Object.freeze({
    multiplier: 1.11,
    graceRatio: 0.15,
    pressureBias: 'STRICT',
  }),
  SEVERE: Object.freeze({
    multiplier: 1.24,
    graceRatio: 0.18,
    pressureBias: 'SEVERE',
  }),
} as const);

export const CHAT_ATTACK_WINDOW_POLICY_SIGNATURES = Object.freeze([
  Object.freeze({
    signatureId: 'PUBLIC_DOGPILE',
    description: 'Long enough for a real reversal because the crowd is part of the punishment.',
    durationMultiplier: 1.18,
    idealResponseRatio: 0.72,
    notes: Object.freeze([
      'Use this signature when attack windows should feel distinct across room types.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'SYNDICATE_KNIFE',
    description: 'Tighter than global, still readable, optimized for reputation-sensitive counters.',
    durationMultiplier: 1.02,
    idealResponseRatio: 0.64,
    notes: Object.freeze([
      'Use this signature when attack windows should feel distinct across room types.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'DEAL_ROOM_CLINCH',
    description: 'Quiet and predatory with narrow reprice windows and high bluff punishment.',
    durationMultiplier: 0.88,
    idealResponseRatio: 0.58,
    notes: Object.freeze([
      'Use this signature when attack windows should feel distinct across room types.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'DIRECT_THREAT',
    description: 'Private but still dangerous. Favors proof and quote turns over crowd surfing.',
    durationMultiplier: 0.96,
    idealResponseRatio: 0.63,
    notes: Object.freeze([
      'Use this signature when attack windows should feel distinct across room types.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'SPECTATOR_FLASH',
    description: 'Fast spectator window meant to amplify or embarrass, not to negotiate.',
    durationMultiplier: 0.82,
    idealResponseRatio: 0.55,
    notes: Object.freeze([
      'Use this signature when attack windows should feel distinct across room types.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'SHADOW_BIND',
    description: 'Mostly invisible setup with strict timing and minimal visible reply tolerance.',
    durationMultiplier: 0.74,
    idealResponseRatio: 0.51,
    notes: Object.freeze([
      'Use this signature when attack windows should feel distinct across room types.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'RESCUE_OVERRIDE',
    description: 'Extends enough to allow helper-assisted recovery without nullifying pressure.',
    durationMultiplier: 1.25,
    idealResponseRatio: 0.69,
    notes: Object.freeze([
      'Use this signature when attack windows should feel distinct across room types.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'LEGEND_TRIAL',
    description: 'Slightly wider because prestige windows need authored clarity.',
    durationMultiplier: 1.12,
    idealResponseRatio: 0.67,
    notes: Object.freeze([
      'Use this signature when attack windows should feel distinct across room types.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
] as const);

// ============================================================================
// MARK: Implementation
// ============================================================================

export class ChatAttackWindowPolicy {
  private readonly clock: ChatAttackWindowPolicyClock;
  private readonly logger: ChatAttackWindowPolicyLogger;
  private readonly tuning: ChatAttackWindowPolicyTuning;

  public constructor(options: ChatAttackWindowPolicyOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.tuning = Object.freeze({
      ...DEFAULT_CHAT_ATTACK_WINDOW_POLICY_TUNING,
      ...(options.tuning ?? {}),
    });
  }

  public createWindow(
    request: ChatAttackWindowCreationRequest,
  ): ChatAttackWindowCreationResult {
    const now = asUnixMs(request.now ?? this.clock.now());
    const visibleChannel = this.resolveVisibleChannel(request.fight.visibleChannel, request.fight.channelId);
    const channelProfile = this.getChannelProfile(visibleChannel);
    const openingProfile = this.getOpeningProfile(request.round.openingMode ?? request.fight.openingMode);
    const severityProfile = this.getSeverityProfile(request.attack.severity);

    const publicExposure01 = this.estimatePublicExposure01(request, channelProfile.witnessBonus01);
    const pressureStress01 = this.estimatePressureStress01(request.signal);
    const helperNeed01 = this.estimateHelperNeed01(request);
    const rescueNeed01 = this.estimateRescueNeed01(request, pressureStress01);
    const proofNeed01 = clamp01(Number(request.attack.proofWeighted) * 0.72 + Number(request.attack.counterDemands.includes('PROOF')) * 0.21);
    const quoteNeed01 = clamp01(Number(request.attack.quoteWeighted) * 0.69 + Number(request.attack.counterDemands.includes('QUOTE')) * 0.19);
    const silenceNeed01 = clamp01(Number(request.attack.allowsSilenceOutplay) * 0.58 + Number(request.attack.counterDemands.includes('SILENCE')) * 0.16);
    const fakeOutRisk01 = clamp01(Number(request.attack.telegraph.canFakeOut) * 0.36 + Number(request.round.phaseKind === 'BAIT') * 0.14);

    const budget = this.buildBudget({
      request,
      channelProfile,
      openingProfile,
      severityProfile,
      publicExposure01,
      pressureStress01,
      helperNeed01,
      rescueNeed01,
      proofNeed01,
      quoteNeed01,
      silenceNeed01,
      fakeOutRisk01,
    });

    const timeline = this.buildTimeline({
      now,
      request,
      openingProfile,
      severityProfile,
      budget,
      visibleChannel,
      publicExposure01,
      fakeOutRisk01,
    });

    const binding: ChatBossCounterWindowBinding = Object.freeze({
      windowId: this.asWindowId(this.createStableWindowId(request, timeline.opensAt, timeline.hardCloseAt)),
      attackId: request.attack.attackId,
      createdAt: timeline.opensAt,
      expiresAt: timeline.hardCloseAt,
      requiredDemands: Object.freeze([...request.attack.counterDemands]),
      idealTiming: request.attack.preferredCounterTiming,
      primaryPunishment: request.attack.primaryPunishment,
      counterplayPlan: null,
      notes: Object.freeze([
        'Binding created by authoritative backend attack-window policy.',
        `Visible channel: ${visibleChannel}.`,
        ...(request.notes ?? []),
      ]),
    });

    const window: ChatCounterWindow = Object.freeze({
      windowId: binding.windowId,
      roomId: request.room.roomId,
      sessionId: request.session.sessionId,
      requestId: request.fight.requestId ?? null,
      channelId: request.fight.channelId,
      sourceMessageId: request.sourceMessage?.messageId ?? null,
      sourceMomentId: request.fight.momentId ?? null,
      sourceSceneId: request.fight.sceneId ?? null,
      sourceTick: request.round.order as never,
      sourceAttackType: request.attack.attackType,
      sourceMomentType: request.fight.momentTypeHint ?? null,
      sourceSceneArchetype: request.fight.sceneArchetypeHint ?? null,
      sourceSceneRole: request.fight.sceneRoleHint ?? null,
      targetActor: {
        actorId: this.createTargetActorId(request),
        actorKind: request.fight.player.actorKind,
        displayName: request.fight.player.displayName,
        npcId: request.fight.player.npcId ?? null,
        userId: request.fight.player.userId ?? null,
        relationshipId: request.fight.player.relationshipId ?? null,
        counterpartKind: request.fight.player.counterpartKind ?? null,
        stanceHint: request.fight.player.stanceHint ?? null,
        objectiveHint: request.fight.player.objectiveHint ?? null,
        confidenceScore: request.fight.player.confidenceScore ?? null,
        intimidationScore: request.fight.player.intimidationScore ?? null,
        embarrassmentScore: request.fight.player.embarrassmentScore ?? null,
      },
      openedAt: timeline.opensAt,
      closesAt: timeline.hardCloseAt,
      idealResponseAt: timeline.idealResponseAt,
      timingClass: request.attack.preferredCounterTiming,
      validationStatus: 'VALID',
      preferredDeliveryPriority: this.preferredDeliveryPriorityForWindow(visibleChannel, request.attack.preferredCounterTiming),
      playerVisible: openingProfile.visibleReply,
      requiresVisibleReply: openingProfile.visibleReply && !request.attack.allowsSilenceOutplay,
      allowsSilence: openingProfile.allowsSilence || request.attack.allowsSilenceOutplay,
      allowsHelperAssist: request.attack.allowsHelperAssistance,
      allowsProofSpike: request.attack.proofWeighted || request.attack.counterDemands.includes('PROOF'),
      allowsQuoteTurn: request.attack.quoteWeighted || request.attack.counterDemands.includes('QUOTE'),
      allowsNegotiationEscape: request.attack.allowsNegotiationEscape,
      riskBand: this.deriveRiskBand(visibleChannel, pressureStress01, fakeOutRisk01),
      notes: Object.freeze([
        'Counter window created from backend timing law.',
        `Final window ms: ${budget.finalWindowMs}.`,
        `Soft close: ${timeline.softCloseAt}. Grace ends: ${timeline.graceEndsAt}.`,
      ]),
    });

    const debug = Object.freeze({
      causeEventId: request.causeEventId ?? null,
      visibleChannel,
      publicExposure01,
      pressureStress01,
      helperNeed01,
      rescueNeed01,
      proofNeed01,
      quoteNeed01,
      silenceNeed01,
      fakeOutRisk01,
      budget: Object.freeze({ ...budget }),
      timeline: Object.freeze({ ...timeline }),
      notes: Object.freeze([...(request.notes ?? [])]),
    } satisfies Record<string, JsonValue>);

    this.logger.debug('chat.attackWindow.created', debug);

    return Object.freeze({
      binding,
      window,
      budget,
      timeline,
      visibleChannel,
      debug,
    });
  }

  public evaluateWindow(
    request: ChatAttackWindowEvaluationRequest,
  ): ChatAttackWindowEvaluationResult {
    const at = asUnixMs(request.at ?? this.clock.now());
    const opensAt = Number(request.window.openedAt);
    const idealAt = Number(request.window.idealResponseAt ?? request.window.openedAt);
    const closesAt = Number(request.window.closesAt);
    const graceMs = this.deriveGraceMsFromWindow(request.window);
    const graceEndsAt = closesAt + graceMs;

    if (request.forceCloseReason) {
      return Object.freeze({
        lifecycle: 'FORCED_CLOSED',
        validationStatus: 'WINDOW_CLOSED',
        acceptsVisibleReply: false,
        acceptsSilentCounter: false,
        acceptsHelperAssist: false,
        msUntilClose: 0,
        msFromIdeal: at - idealAt,
        likelyFailure: request.forceCloseReason,
        debug: Object.freeze({
          forceCloseReason: request.forceCloseReason,
          at,
        }),
      });
    }

    if (at < opensAt) {
      return Object.freeze({
        lifecycle: 'PREOPEN',
        validationStatus: 'TOO_EARLY',
        acceptsVisibleReply: false,
        acceptsSilentCounter: false,
        acceptsHelperAssist: false,
        msUntilClose: closesAt - at,
        msFromIdeal: at - idealAt,
        likelyFailure: 'Window has not yet opened.',
        debug: Object.freeze({ opensAt, at, idealAt, closesAt }),
      });
    }

    if (at <= closesAt) {
      const lifecycle = Math.abs(at - idealAt) <= Math.max(60, Math.round((closesAt - opensAt) * 0.12))
        ? 'IDEAL'
        : 'OPEN';
      return Object.freeze({
        lifecycle,
        validationStatus: 'VALID',
        acceptsVisibleReply: request.window.requiresVisibleReply ? request.playerMessage !== null : true,
        acceptsSilentCounter: request.window.allowsSilence,
        acceptsHelperAssist: request.window.allowsHelperAssist,
        msUntilClose: closesAt - at,
        msFromIdeal: at - idealAt,
        likelyFailure: null,
        debug: Object.freeze({ opensAt, at, idealAt, closesAt }),
      });
    }

    if (at <= graceEndsAt) {
      return Object.freeze({
        lifecycle: 'GRACE',
        validationStatus: 'LATE_BUT_VALID',
        acceptsVisibleReply: !request.window.requiresVisibleReply || request.playerMessage !== null,
        acceptsSilentCounter: false,
        acceptsHelperAssist: request.window.allowsHelperAssist,
        msUntilClose: Math.max(0, graceEndsAt - at),
        msFromIdeal: at - idealAt,
        likelyFailure: 'You are outside the ideal beat. Resolution quality may degrade.',
        debug: Object.freeze({ opensAt, at, idealAt, closesAt, graceEndsAt }),
      });
    }

    return Object.freeze({
      lifecycle: 'EXPIRED',
      validationStatus: 'WINDOW_EXPIRED',
      acceptsVisibleReply: false,
      acceptsSilentCounter: false,
      acceptsHelperAssist: false,
      msUntilClose: 0,
      msFromIdeal: at - idealAt,
      likelyFailure: 'Counter window expired.',
      debug: Object.freeze({ opensAt, at, idealAt, closesAt, graceEndsAt }),
    });
  }

  public deriveGraceMsFromWindow(window: ChatCounterWindow): number {
    const baseWindow = Math.max(1, Number(window.closesAt) - Number(window.openedAt));
    const ratio =
      window.riskBand === 'HIGH' ? 0.1 :
      window.riskBand === 'LOW' ? 0.18 : 0.14;
    return this.clampGraceMs(Math.round(baseWindow * ratio));
  }

  private buildBudget(input: {
    readonly request: ChatAttackWindowCreationRequest;
    readonly channelProfile: ReturnType<ChatAttackWindowPolicy['getChannelProfile']>;
    readonly openingProfile: ReturnType<ChatAttackWindowPolicy['getOpeningProfile']>;
    readonly severityProfile: ReturnType<ChatAttackWindowPolicy['getSeverityProfile']>;
    readonly publicExposure01: Score01;
    readonly pressureStress01: Score01;
    readonly helperNeed01: Score01;
    readonly rescueNeed01: Score01;
    readonly proofNeed01: Score01;
    readonly quoteNeed01: Score01;
    readonly silenceNeed01: Score01;
    readonly fakeOutRisk01: Score01;
  }): ChatAttackWindowBudgetBreakdown {
    const baseWindowMs = this.tuning.defaultWindowMs;
    const channelAdjustedMs = Math.round(baseWindowMs * input.channelProfile.multiplier);
    const openingAdjustedMs = Math.round(channelAdjustedMs * input.openingProfile.multiplier);
    const severityAdjustedMs = Math.round(openingAdjustedMs * input.severityProfile.multiplier);
    const pressureAdjustedMs = Math.round(severityAdjustedMs * (1 - input.pressureStress01 * 0.12 + input.publicExposure01 * 0.06));
    const witnessAdjustedMs = Math.round(pressureAdjustedMs * (1 + input.publicExposure01 * this.tuning.publicWidenBias01));
    const proofAdjustedMs = witnessAdjustedMs + Math.round(this.tuning.proofBonusMs * input.proofNeed01);
    const quoteAdjustedMs = proofAdjustedMs + Math.round(this.tuning.quoteBonusMs * input.quoteNeed01);
    const helperAdjustedMs = quoteAdjustedMs + Math.round(this.tuning.helperBonusMs * input.helperNeed01 * Number(input.request.attack.allowsHelperAssistance));
    const rescueAdjustedMs = helperAdjustedMs + Math.round(this.tuning.rescueBonusMs * input.rescueNeed01);
    const silenceAdjustedMs = rescueAdjustedMs + Math.round(this.tuning.silenceBonusMs * input.silenceNeed01);
    const fakeOutPenaltyMs = Math.round(this.tuning.fakeOutPenaltyMs * input.fakeOutRisk01);
    const finalWindowMs = this.clampWindowMs(silenceAdjustedMs - fakeOutPenaltyMs);

    return Object.freeze({
      baseWindowMs,
      channelAdjustedMs,
      openingAdjustedMs,
      severityAdjustedMs,
      pressureAdjustedMs,
      witnessAdjustedMs,
      proofAdjustedMs,
      quoteAdjustedMs,
      helperAdjustedMs,
      rescueAdjustedMs,
      silenceAdjustedMs,
      fakeOutPenaltyMs,
      finalWindowMs,
    });
  }

  private buildTimeline(input: {
    readonly now: UnixMs;
    readonly request: ChatAttackWindowCreationRequest;
    readonly openingProfile: ReturnType<ChatAttackWindowPolicy['getOpeningProfile']>;
    readonly severityProfile: ReturnType<ChatAttackWindowPolicy['getSeverityProfile']>;
    readonly budget: ChatAttackWindowBudgetBreakdown;
    readonly visibleChannel: ChatVisibleChannel;
    readonly publicExposure01: Score01;
    readonly fakeOutRisk01: Score01;
  }): ChatAttackWindowTimeline {
    const telegraphLeadInMs = Math.max(35, Math.round((input.request.attack.telegraph.silenceLeadInMs + input.request.attack.telegraph.revealDelayMs) * 0.42));
    const opensAt = asUnixMs(Number(input.now) + telegraphLeadInMs);
    const idealRatio = this.deriveIdealResponseRatio(input.request.attack.preferredCounterTiming, input.openingProfile, input.visibleChannel);
    const idealResponseAt = asUnixMs(Number(opensAt) + Math.round(input.budget.finalWindowMs * idealRatio));
    const softCloseAt = asUnixMs(Number(opensAt) + Math.round(input.budget.finalWindowMs * (0.84 + input.publicExposure01 * 0.06)));
    const graceMs = this.clampGraceMs(Math.round(input.budget.finalWindowMs * input.severityProfile.graceRatio));
    const graceEndsAt = asUnixMs(Number(softCloseAt) + graceMs);
    const hardCloseAt = asUnixMs(Number(opensAt) + input.budget.finalWindowMs);

    if (hardCloseAt < graceEndsAt) {
      return Object.freeze({
        opensAt,
        idealResponseAt,
        softCloseAt,
        graceEndsAt: hardCloseAt,
        hardCloseAt,
      });
    }

    return Object.freeze({
      opensAt,
      idealResponseAt,
      softCloseAt,
      graceEndsAt,
      hardCloseAt,
    });
  }

  private deriveIdealResponseRatio(
    timing: ChatCounterTimingClass,
    openingProfile: ReturnType<ChatAttackWindowPolicy['getOpeningProfile']>,
    visibleChannel: ChatVisibleChannel,
  ): number {
    const base =
      timing === 'INSTANT' ? 0.22 :
      timing === 'FAST' ? 0.37 :
      timing === 'PATIENT' ? 0.62 :
      timing === 'LATE_TURN' ? 0.76 : openingProfile.idealResponseRatio;

    const channelShift =
      visibleChannel === 'DEAL_ROOM' ? 0.08 :
      visibleChannel === 'GLOBAL' ? -0.03 :
      visibleChannel === 'SPECTATOR' ? -0.05 : 0;

    return Math.max(0.18, Math.min(0.82, base + channelShift));
  }

  private resolveVisibleChannel(preferred: ChatVisibleChannel, fallbackChannelId: ChatChannelId): ChatVisibleChannel {
    if (preferred && isVisibleChannelId(preferred)) return preferred;
    if (isVisibleChannelId(fallbackChannelId)) return fallbackChannelId;
    return 'GLOBAL';
  }

  private preferredDeliveryPriorityForWindow(
    visibleChannel: ChatVisibleChannel,
    timingClass: ChatCounterTimingClass,
  ): ChatCounterWindow['preferredDeliveryPriority'] {
    if (timingClass === 'INSTANT') return 'IMMEDIATE';
    if (visibleChannel === 'DEAL_ROOM') return 'HIGH';
    if (visibleChannel === 'DIRECT') return 'HIGH';
    return 'NORMAL';
  }

  private deriveRiskBand(
    visibleChannel: ChatVisibleChannel,
    pressureStress01: Score01,
    fakeOutRisk01: Score01,
  ): ChatCounterRiskBand {
    if (pressureStress01 >= clamp01(0.74) || fakeOutRisk01 >= clamp01(0.51)) return 'HIGH';
    if (visibleChannel === 'DEAL_ROOM' || visibleChannel === 'SPECTATOR') return 'HIGH';
    if (pressureStress01 <= clamp01(0.24) && fakeOutRisk01 <= clamp01(0.12)) return 'LOW';
    return 'MEDIUM';
  }

  private getChannelProfile(visibleChannel: ChatVisibleChannel) {
    return WINDOW_CHANNEL_PROFILE[visibleChannel] ?? WINDOW_CHANNEL_PROFILE.GLOBAL;
  }

  private getOpeningProfile(mode: ChatBossOpeningMode) {
    return WINDOW_OPENING_MODE_PROFILE[mode] ?? WINDOW_OPENING_MODE_PROFILE.VISIBLE;
  }

  private getSeverityProfile(severity: ChatBossAttackSeverity) {
    return WINDOW_SEVERITY_PROFILE[severity] ?? WINDOW_SEVERITY_PROFILE.MEDIUM;
  }

  private estimatePublicExposure01(request: ChatAttackWindowCreationRequest, witnessBonus01: Score01): Score01 {
    const visible =
      request.fight.visibleChannel === 'GLOBAL' ? 0.32 :
      request.fight.visibleChannel === 'SPECTATOR' ? 0.27 :
      request.fight.visibleChannel === 'SYNDICATE' ? 0.17 :
      request.fight.visibleChannel === 'DEAL_ROOM' ? 0.08 : 0.1;
    const signal = this.estimateSignalPublicity01(request.signal);
    return clamp01(visible + witnessBonus01 + signal * 0.18);
  }

  private estimatePressureStress01(signal: ChatSignalEnvelope | null | undefined): Score01 {
    const tier = this.estimatePressureTier(signal);
    switch (tier) {
      case 'BREAKPOINT':
        return clamp01(0.92);
      case 'CRITICAL':
        return clamp01(0.78);
      case 'PRESSURED':
        return clamp01(0.59);
      case 'WATCHFUL':
        return clamp01(0.31);
      case 'CALM':
      default:
        return clamp01(0.17);
    }
  }

  private estimateHelperNeed01(request: ChatAttackWindowCreationRequest): Score01 {
    return clamp01(
      Number(request.attack.allowsHelperAssistance) * 0.24
      + Number(request.attack.counterDemands.includes('HELPER')) * 0.18
      + Number(request.round.phaseKind === 'BREAK') * 0.11,
    );
  }

  private estimateRescueNeed01(request: ChatAttackWindowCreationRequest, pressureStress01: Score01): Score01 {
    const source = request.signal as unknown as { metadata?: Record<string, unknown> } | null;
    const rescueFlag = Number(Boolean(source?.metadata?.['rescueRisk']));
    return clamp01(
      Number(request.attack.allowsHelperAssistance) * 0.12
      + pressureStress01 * 0.29
      + rescueFlag * 0.18
      + Number(request.attack.primaryPunishment === 'ISOLATION') * 0.11,
    );
  }

  private estimateSignalPublicity01(signal: ChatSignalEnvelope | null | undefined): Score01 {
    if (!signal) return clamp01(0.08);
    const probe = signal as unknown as { channelId?: string; metadata?: Record<string, unknown> };
    const channelBias =
      probe.channelId === 'GLOBAL' ? 0.19 :
      probe.channelId === 'SPECTATOR' ? 0.16 :
      probe.channelId === 'SYNDICATE' ? 0.1 :
      probe.channelId === 'DEAL_ROOM' ? 0.04 : 0.06;
    const metadataBias =
      Number(Boolean(probe.metadata?.['publicWitness'])) * 0.08
      + Number(Boolean(probe.metadata?.['featured'])) * 0.06;
    return clamp01(channelBias + metadataBias);
  }

  private estimatePressureTier(signal: ChatSignalEnvelope | null | undefined): PressureTier {
    const probe = signal as unknown as { pressureTier?: PressureTier | null; metadata?: Record<string, unknown> } | null;
    if (probe?.pressureTier) return probe.pressureTier;
    const metadataTier = probe?.metadata?.['pressureTier'];
    if (typeof metadataTier === 'string') return metadataTier as PressureTier;
    return 'WATCHFUL';
  }

  private clampWindowMs(value: number): number {
    return Math.max(this.tuning.minimumWindowMs, Math.min(this.tuning.maximumWindowMs, value));
  }

  private clampGraceMs(value: number): number {
    return Math.max(this.tuning.minimumGraceMs, Math.min(this.tuning.maximumGraceMs, value));
  }

  private createStableWindowId(
    request: ChatAttackWindowCreationRequest,
    opensAt: UnixMs,
    closesAt: UnixMs,
  ): string {
    return [
      'cbw',
      String(request.room.roomId),
      String(request.session.sessionId),
      String(request.attack.attackId),
      String(opensAt),
      String(closesAt),
    ].join(':');
  }

  private createTargetActorId(request: ChatAttackWindowCreationRequest): ChatCounterWindow['targetActor']['actorId'] {
    return (`target:${String(request.room.roomId)}:${String(request.session.sessionId)}`) as ChatCounterWindow['targetActor']['actorId'];
  }

  private asWindowId(value: string): ChatBossCounterWindowBinding['windowId'] {
    return value as ChatBossCounterWindowBinding['windowId'];
  }
}

export function createChatAttackWindowPolicy(
  options: ChatAttackWindowPolicyOptions = {},
): ChatAttackWindowPolicy {
  return new ChatAttackWindowPolicy(options);
}

// ============================================================================
// MARK: Window registry notes
// ============================================================================

export const CHAT_ATTACK_WINDOW_POLICY_NOTES = Object.freeze([
  'PUBLIC_DOGPILE: Long enough for a real reversal because the crowd is part of the punishment.',
  'SYNDICATE_KNIFE: Tighter than global, still readable, optimized for reputation-sensitive counters.',
  'DEAL_ROOM_CLINCH: Quiet and predatory with narrow reprice windows and high bluff punishment.',
  'DIRECT_THREAT: Private but still dangerous. Favors proof and quote turns over crowd surfing.',
  'SPECTATOR_FLASH: Fast spectator window meant to amplify or embarrass, not to negotiate.',
  'SHADOW_BIND: Mostly invisible setup with strict timing and minimal visible reply tolerance.',
  'RESCUE_OVERRIDE: Extends enough to allow helper-assisted recovery without nullifying pressure.',
  'LEGEND_TRIAL: Slightly wider because prestige windows need authored clarity.',
] as const);
