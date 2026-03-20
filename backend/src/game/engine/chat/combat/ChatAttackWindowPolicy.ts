/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ATTACK WINDOW POLICY
 * FILE: backend/src/game/engine/chat/combat/ChatAttackWindowPolicy.ts
 * VERSION: 2026.03.20
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
 * - translating shared fight contracts into backend-native timing pressure,
 * - preserving replay-safe notes/debug state for audit and legend review,
 * - and returning deterministic timing breakdowns suitable for orchestration.
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
 * - Backend-visible channels are canonical even when donor lanes once modeled more.
 * - Every window must be reconstructible from authoritative input.
 * ============================================================================
 */

import type {
  ChatBossAttack,
  ChatBossAttackSeverity,
  ChatBossCounterDemand,
  ChatBossCounterWindowBinding,
  ChatBossFightPlan,
  ChatBossOpeningMode,
  ChatBossPhase,
  ChatBossPunishmentClass,
  ChatBossRound,
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
  ChatRoomState,
  ChatSessionState,
  ChatSignalEnvelope,
  ChatState,
  ChatVisibleChannel,
  JsonValue,
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
  readonly negotiationBonusMs: number;
  readonly fakeOutPenaltyMs: number;
  readonly executionPenaltyMs: number;
  readonly publicWidenBias01: Score01;
  readonly quietCompressionBias01: Score01;
  readonly reopenRefusalThreshold01: Score01;
  readonly legendPreservationBias01: Score01;
  readonly authoritativeRoundBlend01: Score01;
}

export interface ChatAttackWindowPolicyOptions {
  readonly clock?: ChatAttackWindowPolicyClock;
  readonly logger?: ChatAttackWindowPolicyLogger;
  readonly tuning?: Partial<ChatAttackWindowPolicyTuning>;
}

export interface ChatAttackWindowBudgetBreakdown {
  readonly authoritativeRoundMs: number;
  readonly baseWindowMs: number;
  readonly channelAdjustedMs: number;
  readonly openingAdjustedMs: number;
  readonly severityAdjustedMs: number;
  readonly stageMoodAdjustedMs: number;
  readonly punishmentAdjustedMs: number;
  readonly pressureAdjustedMs: number;
  readonly witnessAdjustedMs: number;
  readonly proofAdjustedMs: number;
  readonly quoteAdjustedMs: number;
  readonly helperAdjustedMs: number;
  readonly rescueAdjustedMs: number;
  readonly silenceAdjustedMs: number;
  readonly negotiationAdjustedMs: number;
  readonly legendAdjustedMs: number;
  readonly fakeOutPenaltyMs: number;
  readonly executionPenaltyMs: number;
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
  readonly lifecycle:
    | 'PREOPEN'
    | 'IDEAL'
    | 'OPEN'
    | 'GRACE'
    | 'EXPIRED'
    | 'FORCED_CLOSED';
  readonly validationStatus: ChatCounterValidationStatus;
  readonly acceptsVisibleReply: boolean;
  readonly acceptsSilentCounter: boolean;
  readonly acceptsHelperAssist: boolean;
  readonly msUntilClose: number;
  readonly msFromIdeal: number;
  readonly likelyFailure: string | null;
  readonly debug: Readonly<Record<string, JsonValue>>;
}

export interface ChatAttackWindowDerivedFactors {
  readonly phaseKind: string;
  readonly openingMode: ChatBossOpeningMode;
  readonly stageMood: string;
  readonly normalizedPressureState: NormalizedPressureState;
  readonly publicExposure01: Score01;
  readonly pressureStress01: Score01;
  readonly helperNeed01: Score01;
  readonly rescueNeed01: Score01;
  readonly proofNeed01: Score01;
  readonly quoteNeed01: Score01;
  readonly silenceNeed01: Score01;
  readonly negotiationNeed01: Score01;
  readonly legendNeed01: Score01;
  readonly fakeOutRisk01: Score01;
  readonly signatureId: ChatAttackWindowPolicySignatureId;
}

// ============================================================================
// MARK: Internal vocab and utility contracts
// ============================================================================

type NormalizedPressureState = 'CALM' | 'WATCHFUL' | 'PRESSURED' | 'CRITICAL' | 'BREAKPOINT';

type WindowProfileRiskClass = 'SAFE' | 'MEASURED' | 'VOLATILE' | 'DANGEROUS' | 'SUICIDAL';

type WindowValidationRequirement =
  | 'NONE'
  | 'VISIBLE_REPLY'
  | 'SILENCE_REPLY'
  | 'PROOF_REPLY'
  | 'QUOTE_REPLY'
  | 'TIMED_REPLY'
  | 'NEGOTIATION_REPLY'
  | 'HELPER_REPLY';

type WindowLikelihoodFailure =
  | 'NOT_YET_OPEN'
  | 'VISIBLE_REPLY_REQUIRED'
  | 'SILENCE_DISCIPLINE_REQUIRED'
  | 'PROOF_REQUIRED'
  | 'QUOTE_REQUIRED'
  | 'TIMING_REQUIRED'
  | 'NEGOTIATION_NOT_ALLOWED'
  | 'HELPER_NOT_ALLOWED'
  | 'EXPIRED'
  | 'FORCED_CLOSED'
  | 'NONE';

interface ChannelWindowProfile {
  readonly multiplier: number;
  readonly graceMultiplier: number;
  readonly witnessBonus01: Score01;
  readonly riskBand: WindowProfileRiskClass;
  readonly signatureId: ChatAttackWindowPolicySignatureId;
  readonly preferredSilenceRatio: number;
}

interface OpeningWindowProfile {
  readonly multiplier: number;
  readonly idealResponseRatio: number;
  readonly visibleReply: boolean;
  readonly allowsSilence: boolean;
  readonly revealLeadScalar: number;
  readonly telegraphCompression01: Score01;
}

interface SeverityWindowProfile {
  readonly multiplier: number;
  readonly graceRatio: number;
  readonly riskEscalation: number;
  readonly executionPenaltyMs: number;
}

interface StageMoodWindowProfile {
  readonly multiplier: number;
  readonly idealShift: number;
  readonly graceShift: number;
}

interface PunishmentWindowProfile {
  readonly multiplier: number;
  readonly helperTax01: Score01;
  readonly silenceTax01: Score01;
  readonly publicExposureBonus01: Score01;
}

interface BudgetBuildInput {
  readonly request: ChatAttackWindowCreationRequest;
  readonly channelProfile: ChannelWindowProfile;
  readonly openingProfile: OpeningWindowProfile;
  readonly severityProfile: SeverityWindowProfile;
  readonly stageMoodProfile: StageMoodWindowProfile;
  readonly punishmentProfile: PunishmentWindowProfile;
  readonly factors: ChatAttackWindowDerivedFactors;
}

interface TimelineBuildInput {
  readonly now: UnixMs;
  readonly request: ChatAttackWindowCreationRequest;
  readonly openingProfile: OpeningWindowProfile;
  readonly severityProfile: SeverityWindowProfile;
  readonly budget: ChatAttackWindowBudgetBreakdown;
  readonly visibleChannel: ChatVisibleChannel;
  readonly factors: ChatAttackWindowDerivedFactors;
}

interface CounterAttemptShape {
  readonly attempted: boolean;
  readonly hasVisibleReply: boolean;
  readonly hasQuote: boolean;
  readonly hasProof: boolean;
  readonly helperTagged: boolean;
  readonly negotiationTagged: boolean;
  readonly silentAttempted: boolean;
  readonly selectedCounterplayId: string | null;
}

export const CHAT_ATTACK_WINDOW_POLICY_SIGNATURES = Object.freeze([
  Object.freeze({
    signatureId: 'PUBLIC_DOGPILE',
    description: 'Long enough for a real reversal because the crowd is part of the punishment.',
    durationMultiplier: 1.18,
    idealResponseRatio: 0.72,
    notes: Object.freeze([
      'Use this signature when global public witness is part of the mechanical threat.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'SYNDICATE_KNIFE',
    description: 'Tighter than global, still readable, optimized for reputation-sensitive counters.',
    durationMultiplier: 1.02,
    idealResponseRatio: 0.64,
    notes: Object.freeze([
      'Use this signature when trust debt and witness memory matter more than spectacle.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'DEAL_ROOM_CLINCH',
    description: 'Quiet and predatory with narrow reprice windows and high bluff punishment.',
    durationMultiplier: 0.88,
    idealResponseRatio: 0.58,
    notes: Object.freeze([
      'Use this signature when negotiation and repricing are the center of gravity.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'LOBBY_MEASURE',
    description: 'Readable but cautious. Appropriate for low-commitment pre-escalation exchanges.',
    durationMultiplier: 0.94,
    idealResponseRatio: 0.60,
    notes: Object.freeze([
      'Use this signature when the room is still measuring rather than executing.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'SHADOW_BIND',
    description: 'Mostly invisible setup with strict timing and minimal visible reply tolerance.',
    durationMultiplier: 0.74,
    idealResponseRatio: 0.51,
    notes: Object.freeze([
      'Use this signature when silence itself is the authored skill test.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'RESCUE_OVERRIDE',
    description: 'Extends enough to allow helper-assisted recovery without nullifying pressure.',
    durationMultiplier: 1.25,
    idealResponseRatio: 0.69,
    notes: Object.freeze([
      'Use this signature when helper intervention must remain possible without becoming free.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
  Object.freeze({
    signatureId: 'LEGEND_TRIAL',
    description: 'Slightly wider because prestige windows need authored clarity.',
    durationMultiplier: 1.12,
    idealResponseRatio: 0.67,
    notes: Object.freeze([
      'Use this signature when legend qualification or public proof value is elevated.',
      'The signature is deterministic and safe for replay.',
    ]),
  }),
] as const);

export type ChatAttackWindowPolicySignatureId =
  (typeof CHAT_ATTACK_WINDOW_POLICY_SIGNATURES)[number]['signatureId'];

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
  negotiationBonusMs: 240,
  fakeOutPenaltyMs: 190,
  executionPenaltyMs: 210,
  publicWidenBias01: clamp01(0.24),
  quietCompressionBias01: clamp01(0.16),
  reopenRefusalThreshold01: clamp01(0.58),
  legendPreservationBias01: clamp01(0.33),
  authoritativeRoundBlend01: clamp01(0.68),
});

const WINDOW_CHANNEL_PROFILE = Object.freeze({
  GLOBAL: Object.freeze({
    multiplier: 1.14,
    graceMultiplier: 1.08,
    witnessBonus01: clamp01(0.24),
    riskBand: 'VOLATILE',
    signatureId: 'PUBLIC_DOGPILE',
    preferredSilenceRatio: 0.12,
  }),
  SYNDICATE: Object.freeze({
    multiplier: 1.01,
    graceMultiplier: 0.96,
    witnessBonus01: clamp01(0.15),
    riskBand: 'MEASURED',
    signatureId: 'SYNDICATE_KNIFE',
    preferredSilenceRatio: 0.18,
  }),
  DEAL_ROOM: Object.freeze({
    multiplier: 0.86,
    graceMultiplier: 0.82,
    witnessBonus01: clamp01(0.08),
    riskBand: 'DANGEROUS',
    signatureId: 'DEAL_ROOM_CLINCH',
    preferredSilenceRatio: 0.24,
  }),
  LOBBY: Object.freeze({
    multiplier: 0.95,
    graceMultiplier: 0.92,
    witnessBonus01: clamp01(0.10),
    riskBand: 'SAFE',
    signatureId: 'LOBBY_MEASURE',
    preferredSilenceRatio: 0.16,
  }),
} as const satisfies Readonly<Record<ChatVisibleChannel, ChannelWindowProfile>>);

const WINDOW_OPENING_MODE_PROFILE = Object.freeze({
  IMMEDIATE: Object.freeze({
    multiplier: 1.03,
    idealResponseRatio: 0.44,
    visibleReply: true,
    allowsSilence: false,
    revealLeadScalar: 0.18,
    telegraphCompression01: clamp01(0.12),
  }),
  STAGGERED: Object.freeze({
    multiplier: 0.97,
    idealResponseRatio: 0.53,
    visibleReply: true,
    allowsSilence: false,
    revealLeadScalar: 0.34,
    telegraphCompression01: clamp01(0.08),
  }),
  CROWD_PRIMED: Object.freeze({
    multiplier: 1.07,
    idealResponseRatio: 0.41,
    visibleReply: true,
    allowsSilence: false,
    revealLeadScalar: 0.22,
    telegraphCompression01: clamp01(0.16),
  }),
  NEGOTIATION_READ_DELAYED: Object.freeze({
    multiplier: 0.88,
    idealResponseRatio: 0.59,
    visibleReply: true,
    allowsSilence: true,
    revealLeadScalar: 0.42,
    telegraphCompression01: clamp01(0.04),
  }),
  SILENCE_LURE: Object.freeze({
    multiplier: 0.84,
    idealResponseRatio: 0.63,
    visibleReply: false,
    allowsSilence: true,
    revealLeadScalar: 0.48,
    telegraphCompression01: clamp01(0.02),
  }),
} as const satisfies Readonly<Record<ChatBossOpeningMode, OpeningWindowProfile>>);

const WINDOW_SEVERITY_PROFILE = Object.freeze({
  PROBING: Object.freeze({
    multiplier: 0.90,
    graceRatio: 0.11,
    riskEscalation: 0.05,
    executionPenaltyMs: 0,
  }),
  HEAVY: Object.freeze({
    multiplier: 1.00,
    graceRatio: 0.13,
    riskEscalation: 0.10,
    executionPenaltyMs: 0,
  }),
  CRITICAL: Object.freeze({
    multiplier: 1.12,
    graceRatio: 0.15,
    riskEscalation: 0.18,
    executionPenaltyMs: 60,
  }),
  EXECUTION: Object.freeze({
    multiplier: 1.24,
    graceRatio: 0.18,
    riskEscalation: 0.28,
    executionPenaltyMs: 120,
  }),
} as const satisfies Readonly<Record<ChatBossAttackSeverity, SeverityWindowProfile>>);

const WINDOW_STAGE_MOOD_PROFILE = Object.freeze({
  CALM: Object.freeze({ multiplier: 1.02, idealShift: 0.02, graceShift: 0.02 }),
  TENSE: Object.freeze({ multiplier: 1.00, idealShift: 0.00, graceShift: 0.00 }),
  HOSTILE: Object.freeze({ multiplier: 0.93, idealShift: -0.03, graceShift: -0.02 }),
  PREDATORY: Object.freeze({ multiplier: 0.88, idealShift: -0.05, graceShift: -0.03 }),
  CEREMONIAL: Object.freeze({ multiplier: 1.08, idealShift: 0.04, graceShift: 0.03 }),
  WATCHFUL: Object.freeze({ multiplier: 0.98, idealShift: 0.01, graceShift: 0.01 }),
  CONSPIRATORIAL: Object.freeze({ multiplier: 0.94, idealShift: 0.03, graceShift: 0.00 }),
} as const);

const WINDOW_PUNISHMENT_PROFILE = Object.freeze({
  EMBARRASSMENT_SPIKE: Object.freeze({
    multiplier: 1.02,
    helperTax01: clamp01(0.03),
    silenceTax01: clamp01(0.08),
    publicExposureBonus01: clamp01(0.12),
  }),
  PRESSURE_SPIKE: Object.freeze({
    multiplier: 1.04,
    helperTax01: clamp01(0.02),
    silenceTax01: clamp01(0.04),
    publicExposureBonus01: clamp01(0.04),
  }),
  REPUTATION_HIT: Object.freeze({
    multiplier: 1.08,
    helperTax01: clamp01(0.02),
    silenceTax01: clamp01(0.10),
    publicExposureBonus01: clamp01(0.14),
  }),
  SHIELD_DAMAGE: Object.freeze({
    multiplier: 1.10,
    helperTax01: clamp01(0.06),
    silenceTax01: clamp01(0.03),
    publicExposureBonus01: clamp01(0.03),
  }),
  DEAL_REPRICE: Object.freeze({
    multiplier: 0.95,
    helperTax01: clamp01(0.00),
    silenceTax01: clamp01(0.05),
    publicExposureBonus01: clamp01(0.00),
  }),
  HELPER_SUPPRESSION: Object.freeze({
    multiplier: 1.06,
    helperTax01: clamp01(0.20),
    silenceTax01: clamp01(0.01),
    publicExposureBonus01: clamp01(0.03),
  }),
  CROWD_SWARM: Object.freeze({
    multiplier: 1.12,
    helperTax01: clamp01(0.03),
    silenceTax01: clamp01(0.12),
    publicExposureBonus01: clamp01(0.22),
  }),
  EXIT_DENIAL: Object.freeze({
    multiplier: 1.05,
    helperTax01: clamp01(0.03),
    silenceTax01: clamp01(0.06),
    publicExposureBonus01: clamp01(0.06),
  }),
} as const satisfies Readonly<Record<ChatBossPunishmentClass, PunishmentWindowProfile>>);

const COUNTER_DEMAND_WEIGHT = Object.freeze({
  VISIBLE_REPLY: clamp01(0.26),
  PROOF_REPLY: clamp01(0.30),
  QUOTE_REPLY: clamp01(0.26),
  TIMED_REPLY: clamp01(0.22),
  SILENCE_REPLY: clamp01(0.20),
  HELPER_REPLY: clamp01(0.18),
  NEGOTIATION_REPLY: clamp01(0.18),
} as const satisfies Readonly<Record<ChatBossCounterDemand, Score01>>);

const COUNTER_TIMING_RATIO = Object.freeze({
  INSTANT: 0.22,
  FAST: 0.37,
  BEAT_LOCKED: 0.49,
  READ_PRESSURE_DELAYED: 0.60,
  LATE_BUT_VALID: 0.72,
  POST_SCENE: 0.80,
  SHADOW_ONLY: 0.64,
} as const satisfies Readonly<Record<ChatCounterTimingClass, number>>);

const WINDOW_REQUIREMENT_TO_VALIDATION_STATUS = Object.freeze({
  NONE: 'AUTHORITATIVE_ACCEPT',
  VISIBLE_REPLY: 'AUTHORITATIVE_REJECT',
  SILENCE_REPLY: 'REQUIRES_SILENCE',
  PROOF_REPLY: 'REQUIRES_PROOF',
  QUOTE_REPLY: 'REQUIRES_QUOTE',
  TIMED_REPLY: 'REQUIRES_TIMING',
  NEGOTIATION_REPLY: 'BLOCKED_BY_POLICY',
  HELPER_REPLY: 'BLOCKED_BY_POLICY',
} as const satisfies Readonly<Record<WindowValidationRequirement, ChatCounterValidationStatus>>);

const WINDOW_FAILURE_MESSAGE = Object.freeze({
  NOT_YET_OPEN: 'Window has not yet opened.',
  VISIBLE_REPLY_REQUIRED: 'A visible reply is required for this counter window.',
  SILENCE_DISCIPLINE_REQUIRED: 'This window rewards silence or shadow discipline rather than a visible reply.',
  PROOF_REQUIRED: 'This attempt needs proof support to qualify.',
  QUOTE_REQUIRED: 'This attempt needs a quote turn or a quote-bearing receipt.',
  TIMING_REQUIRED: 'The attempted reply missed the authored timing beat.',
  NEGOTIATION_NOT_ALLOWED: 'Negotiation escape is not legal in this counter window.',
  HELPER_NOT_ALLOWED: 'Helper intervention is blocked for this counter window.',
  EXPIRED: 'Counter window expired.',
  FORCED_CLOSED: 'Counter window was force-closed by policy.',
  NONE: null,
} as const satisfies Readonly<Record<WindowLikelihoodFailure, string | null>>);

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
    const visibleChannel = this.resolveVisibleChannel(
      request.fight.visibleChannel,
      request.fight.channelId,
      request.room,
    );
    const phase = this.resolvePhase(request.fight, request.round.phaseId);
    const openingMode = this.resolveOpeningMode(request, phase);
    const stageMood = this.resolveStageMood(request);

    const channelProfile = this.getChannelProfile(visibleChannel);
    const openingProfile = this.getOpeningProfile(openingMode);
    const severityProfile = this.getSeverityProfile(request.attack.severity);
    const stageMoodProfile = this.getStageMoodProfile(stageMood);
    const punishmentProfile = this.getPunishmentProfile(request.attack.primaryPunishment);

    const factors = this.deriveFactors({
      request,
      visibleChannel,
      phase,
      openingMode,
      stageMood,
      channelProfile,
      openingProfile,
      punishmentProfile,
    });

    const budget = this.buildBudget({
      request,
      channelProfile,
      openingProfile,
      severityProfile,
      stageMoodProfile,
      punishmentProfile,
      factors,
    });

    const timeline = this.buildTimeline({
      now,
      request,
      openingProfile,
      severityProfile,
      budget,
      visibleChannel,
      factors,
    });

    const windowId = this.asWindowId(
      this.createStableWindowId(request, timeline.opensAt, timeline.hardCloseAt, factors.signatureId),
    );

    const binding: ChatBossCounterWindowBinding = Object.freeze({
      windowId,
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
        `Phase kind: ${factors.phaseKind}.`,
        `Opening mode: ${openingMode}.`,
        `Signature: ${factors.signatureId}.`,
        ...(request.notes ?? []),
      ]),
    });

    const window: ChatCounterWindow = Object.freeze({
      windowId,
      roomId: request.room.roomId,
      sessionId: request.session.identity.sessionId,
      requestId: request.fight.requestId ?? null,
      channelId: request.fight.channelId,
      sourceMessageId: request.sourceMessage?.id ?? null,
      sourceMomentId: request.fight.momentId ?? null,
      sourceSceneId: request.fight.sceneId ?? null,
      sourceTick: null,
      sourceAttackType: request.attack.attackType,
      sourceMomentType: request.fight.pattern.momentTypeHint ?? null,
      sourceSceneArchetype: request.fight.pattern.preferredSceneArchetype ?? null,
      sourceSceneRole: request.fight.pattern.preferredSceneRole ?? null,
      targetActor: this.buildTargetActorSnapshot(request),
      openedAt: timeline.opensAt,
      closesAt: timeline.hardCloseAt,
      idealResponseAt: timeline.idealResponseAt,
      timingClass: this.resolveWindowTimingClass(request.attack.preferredCounterTiming, openingMode),
      validationStatus: 'UNVALIDATED',
      preferredDeliveryPriority: this.preferredDeliveryPriorityForWindow(
        visibleChannel,
        request.attack.preferredCounterTiming,
      ),
      playerVisible: openingProfile.visibleReply,
      requiresVisibleReply: this.windowRequiresVisibleReply(request.attack, openingMode),
      allowsSilence: openingProfile.allowsSilence || request.attack.allowsSilenceOutplay,
      allowsHelperAssist: request.attack.allowsHelperAssistance && request.fight.rescueAllowed,
      allowsProofSpike: request.attack.proofWeighted || request.attack.counterDemands.includes('PROOF_REPLY'),
      allowsQuoteTurn: request.attack.quoteWeighted || request.attack.counterDemands.includes('QUOTE_REPLY'),
      allowsNegotiationEscape: request.attack.allowsNegotiationEscape,
      riskBand: this.deriveRiskBand(
        visibleChannel,
        factors.pressureStress01,
        factors.fakeOutRisk01,
        request.attack.severity,
      ),
      notes: Object.freeze([
        'Counter window created from backend timing law.',
        `Final window ms: ${budget.finalWindowMs}.`,
        `Soft close: ${timeline.softCloseAt}. Grace ends: ${timeline.graceEndsAt}.`,
        `Stage mood: ${stageMood}. Pressure: ${factors.normalizedPressureState}.`,
        `Signature: ${factors.signatureId}.`,
      ]),
    });

    const debug = this.buildCreationDebug(
      request,
      visibleChannel,
      phase,
      openingMode,
      stageMood,
      factors,
      budget,
      timeline,
    );

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
    const attempt = this.deriveAttemptShape(request);

    if (request.forceCloseReason) {
      return this.buildEvaluationResult({
        lifecycle: 'FORCED_CLOSED',
        validationStatus: 'BLOCKED_BY_POLICY',
        acceptsVisibleReply: false,
        acceptsSilentCounter: false,
        acceptsHelperAssist: false,
        msUntilClose: 0,
        msFromIdeal: at - idealAt,
        likelyFailure: WINDOW_FAILURE_MESSAGE.FORCED_CLOSED,
        debug: {
          forceCloseReason: request.forceCloseReason,
          at,
          opensAt,
          idealAt,
          closesAt,
          graceEndsAt,
          attempt: this.debugAttemptShape(attempt),
        },
      });
    }

    if (at < opensAt) {
      return this.buildEvaluationResult({
        lifecycle: 'PREOPEN',
        validationStatus: attempt.attempted ? 'REQUIRES_TIMING' : 'UNVALIDATED',
        acceptsVisibleReply: false,
        acceptsSilentCounter: false,
        acceptsHelperAssist: false,
        msUntilClose: Math.max(0, closesAt - at),
        msFromIdeal: at - idealAt,
        likelyFailure: WINDOW_FAILURE_MESSAGE.NOT_YET_OPEN,
        debug: {
          opensAt,
          at,
          idealAt,
          closesAt,
          graceEndsAt,
          attempt: this.debugAttemptShape(attempt),
        },
      });
    }

    if (at <= closesAt) {
      const timingLifecycle = this.resolveOpenLifecycle(at, idealAt, closesAt);
      const requirement = this.evaluateRequirementForAttempt(request.window, attempt, at, idealAt, closesAt);
      const validationStatus = this.resolveValidationStatusForRequirement(attempt, requirement);
      const likelyFailure = WINDOW_FAILURE_MESSAGE[this.requirementToFailure(requirement)];

      return this.buildEvaluationResult({
        lifecycle: timingLifecycle,
        validationStatus,
        acceptsVisibleReply: this.acceptsVisibleReply(request.window, attempt),
        acceptsSilentCounter: request.window.allowsSilence,
        acceptsHelperAssist: request.window.allowsHelperAssist,
        msUntilClose: Math.max(0, closesAt - at),
        msFromIdeal: at - idealAt,
        likelyFailure,
        debug: {
          opensAt,
          at,
          idealAt,
          closesAt,
          graceEndsAt,
          requirement,
          attempt: this.debugAttemptShape(attempt),
        },
      });
    }

    if (at <= graceEndsAt) {
      const requirement = this.evaluateRequirementForAttempt(request.window, attempt, at, idealAt, graceEndsAt);
      const validationStatus = attempt.attempted
        ? this.resolveValidationStatusForRequirement(attempt, requirement)
        : 'WINDOW_OPEN';
      const likelyFailure = attempt.attempted
        ? WINDOW_FAILURE_MESSAGE[this.requirementToFailure(requirement)]
        : 'You are outside the ideal beat. Resolution quality may degrade.';

      return this.buildEvaluationResult({
        lifecycle: 'GRACE',
        validationStatus,
        acceptsVisibleReply: this.acceptsVisibleReply(request.window, attempt),
        acceptsSilentCounter: false,
        acceptsHelperAssist: request.window.allowsHelperAssist,
        msUntilClose: Math.max(0, graceEndsAt - at),
        msFromIdeal: at - idealAt,
        likelyFailure,
        debug: {
          opensAt,
          at,
          idealAt,
          closesAt,
          graceEndsAt,
          requirement,
          attempt: this.debugAttemptShape(attempt),
        },
      });
    }

    return this.buildEvaluationResult({
      lifecycle: 'EXPIRED',
      validationStatus: attempt.attempted ? 'AUTHORITATIVE_REJECT' : 'WINDOW_CLOSED',
      acceptsVisibleReply: false,
      acceptsSilentCounter: false,
      acceptsHelperAssist: false,
      msUntilClose: 0,
      msFromIdeal: at - idealAt,
      likelyFailure: WINDOW_FAILURE_MESSAGE.EXPIRED,
      debug: {
        opensAt,
        at,
        idealAt,
        closesAt,
        graceEndsAt,
        attempt: this.debugAttemptShape(attempt),
      },
    });
  }

  public deriveGraceMsFromWindow(window: ChatCounterWindow): number {
    const baseWindow = Math.max(1, Number(window.closesAt) - Number(window.openedAt));
    const ratio =
      window.riskBand === 'SUICIDAL' ? 0.08 :
      window.riskBand === 'DANGEROUS' ? 0.10 :
      window.riskBand === 'VOLATILE' ? 0.14 :
      window.riskBand === 'MEASURED' ? 0.17 : 0.20;

    return this.clampGraceMs(Math.round(baseWindow * ratio));
  }

  // ========================================================================
  // MARK: Creation helpers
  // ========================================================================

  private deriveFactors(input: {
    readonly request: ChatAttackWindowCreationRequest;
    readonly visibleChannel: ChatVisibleChannel;
    readonly phase: ChatBossPhase | null;
    readonly openingMode: ChatBossOpeningMode;
    readonly stageMood: string;
    readonly channelProfile: ChannelWindowProfile;
    readonly openingProfile: OpeningWindowProfile;
    readonly punishmentProfile: PunishmentWindowProfile;
  }): ChatAttackWindowDerivedFactors {
    const phaseKind = input.phase?.phaseKind ?? 'MEASURE';
    const publicExposure01 = this.estimatePublicExposure01(input.request, input.channelProfile.witnessBonus01);
    const normalizedPressureState = this.normalizePressureState(input.request.signal);
    const pressureStress01 = this.estimatePressureStress01(normalizedPressureState);
    const helperNeed01 = this.estimateHelperNeed01(input.request, phaseKind, input.punishmentProfile);
    const rescueNeed01 = this.estimateRescueNeed01(input.request, pressureStress01, phaseKind);
    const proofNeed01 = this.estimateProofNeed01(input.request.attack.counterDemands, input.request.attack.proofWeighted);
    const quoteNeed01 = this.estimateQuoteNeed01(input.request.attack.counterDemands, input.request.attack.quoteWeighted);
    const silenceNeed01 = this.estimateSilenceNeed01(input.request, input.openingProfile, input.channelProfile);
    const negotiationNeed01 = this.estimateNegotiationNeed01(input.request);
    const legendNeed01 = this.estimateLegendNeed01(input.request);
    const fakeOutRisk01 = this.estimateFakeOutRisk01(input.request, phaseKind, publicExposure01);
    const signatureId = this.deriveSignatureId(
      input.visibleChannel,
      input.request,
      pressureStress01,
      rescueNeed01,
      legendNeed01,
      input.openingMode,
    );

    return Object.freeze({
      phaseKind,
      openingMode: input.openingMode,
      stageMood: input.stageMood,
      normalizedPressureState,
      publicExposure01,
      pressureStress01,
      helperNeed01,
      rescueNeed01,
      proofNeed01,
      quoteNeed01,
      silenceNeed01,
      negotiationNeed01,
      legendNeed01,
      fakeOutRisk01,
      signatureId,
    });
  }

  private buildBudget(input: BudgetBuildInput): ChatAttackWindowBudgetBreakdown {
    const authoritativeRoundMs = this.authoritativeRoundDurationMs(input.request.round);
    const baseWindowMs = this.blendAuthoritativeBase(
      authoritativeRoundMs,
      this.tuning.defaultWindowMs,
    );

    const channelAdjustedMs = Math.round(baseWindowMs * input.channelProfile.multiplier);
    const openingAdjustedMs = Math.round(channelAdjustedMs * input.openingProfile.multiplier);
    const severityAdjustedMs = Math.round(openingAdjustedMs * input.severityProfile.multiplier);
    const stageMoodAdjustedMs = Math.round(severityAdjustedMs * input.stageMoodProfile.multiplier);
    const punishmentAdjustedMs = Math.round(stageMoodAdjustedMs * input.punishmentProfile.multiplier);
    const pressureAdjustedMs = Math.round(
      punishmentAdjustedMs * (1 - Number(input.factors.pressureStress01) * 0.12 + Number(input.factors.publicExposure01) * 0.04),
    );
    const witnessAdjustedMs = Math.round(
      pressureAdjustedMs * (1 + Number(input.factors.publicExposure01) * Number(this.tuning.publicWidenBias01)),
    );
    const proofAdjustedMs = witnessAdjustedMs + Math.round(this.tuning.proofBonusMs * Number(input.factors.proofNeed01));
    const quoteAdjustedMs = proofAdjustedMs + Math.round(this.tuning.quoteBonusMs * Number(input.factors.quoteNeed01));
    const helperAdjustedMs = quoteAdjustedMs + Math.round(this.tuning.helperBonusMs * Number(input.factors.helperNeed01) * Number(input.request.attack.allowsHelperAssistance));
    const rescueAdjustedMs = helperAdjustedMs + Math.round(this.tuning.rescueBonusMs * Number(input.factors.rescueNeed01));
    const silenceAdjustedMs = rescueAdjustedMs + Math.round(this.tuning.silenceBonusMs * Number(input.factors.silenceNeed01));
    const negotiationAdjustedMs = silenceAdjustedMs + Math.round(this.tuning.negotiationBonusMs * Number(input.factors.negotiationNeed01));
    const legendAdjustedMs = negotiationAdjustedMs + Math.round(this.tuning.quoteBonusMs * Number(input.factors.legendNeed01) * Number(this.tuning.legendPreservationBias01));
    const fakeOutPenaltyMs = Math.round(this.tuning.fakeOutPenaltyMs * Number(input.factors.fakeOutRisk01));
    const executionPenaltyMs = input.request.attack.severity === 'EXECUTION'
      ? this.tuning.executionPenaltyMs + input.severityProfile.executionPenaltyMs
      : input.severityProfile.executionPenaltyMs;

    const finalWindowMs = this.clampWindowMs(
      legendAdjustedMs - fakeOutPenaltyMs - executionPenaltyMs,
    );

    return Object.freeze({
      authoritativeRoundMs,
      baseWindowMs,
      channelAdjustedMs,
      openingAdjustedMs,
      severityAdjustedMs,
      stageMoodAdjustedMs,
      punishmentAdjustedMs,
      pressureAdjustedMs,
      witnessAdjustedMs,
      proofAdjustedMs,
      quoteAdjustedMs,
      helperAdjustedMs,
      rescueAdjustedMs,
      silenceAdjustedMs,
      negotiationAdjustedMs,
      legendAdjustedMs,
      fakeOutPenaltyMs,
      executionPenaltyMs,
      finalWindowMs,
    });
  }

  private buildTimeline(input: TimelineBuildInput): ChatAttackWindowTimeline {
    const attackTelegraphLeadMs = Math.max(
      35,
      Math.round(
        (input.request.attack.telegraph.silenceLeadInMs + input.request.attack.telegraph.revealDelayMs)
        * input.openingProfile.revealLeadScalar,
      ),
    );

    const earliestOpen = Math.max(
      Number(input.now),
      Number(input.request.fight.startsAt),
      Number(input.request.round.openedAt),
    );

    const opensAt = asUnixMs(earliestOpen + attackTelegraphLeadMs);
    const idealRatio = this.deriveIdealResponseRatio(
      this.resolveWindowTimingClass(input.request.attack.preferredCounterTiming, input.factors.openingMode),
      input.openingProfile,
      input.visibleChannel,
      input.factors.stageMood,
    );
    const idealResponseAt = asUnixMs(Number(opensAt) + Math.round(input.budget.finalWindowMs * idealRatio));

    const softCloseRatio = Math.min(
      0.94,
      0.82
      + Number(input.factors.publicExposure01) * 0.05
      + Number(input.factors.quoteNeed01) * 0.02
      + Number(input.factors.proofNeed01) * 0.03,
    );

    const softCloseAt = asUnixMs(Number(opensAt) + Math.round(input.budget.finalWindowMs * softCloseRatio));
    const graceMs = this.clampGraceMs(
      Math.round(
        input.budget.finalWindowMs
        * input.severityProfile.graceRatio
        * input.openingProfile.multiplier
        * this.getChannelProfile(input.visibleChannel).graceMultiplier,
      ),
    );

    const preliminaryHardCloseAt = asUnixMs(Number(opensAt) + input.budget.finalWindowMs);
    const authoritativeHardCloseAt = Math.max(
      Number(preliminaryHardCloseAt),
      Number(input.request.round.closesAt),
    );
    const hardCloseAt = asUnixMs(authoritativeHardCloseAt);
    const graceEndsAt = asUnixMs(Math.min(Number(hardCloseAt), Number(softCloseAt) + graceMs));

    return Object.freeze({
      opensAt,
      idealResponseAt,
      softCloseAt,
      graceEndsAt,
      hardCloseAt,
    });
  }

  private buildCreationDebug(
    request: ChatAttackWindowCreationRequest,
    visibleChannel: ChatVisibleChannel,
    phase: ChatBossPhase | null,
    openingMode: ChatBossOpeningMode,
    stageMood: string,
    factors: ChatAttackWindowDerivedFactors,
    budget: ChatAttackWindowBudgetBreakdown,
    timeline: ChatAttackWindowTimeline,
  ): Readonly<Record<string, JsonValue>> {
    return Object.freeze({
      causeEventId: request.causeEventId ?? null,
      visibleChannel,
      phaseId: request.round.phaseId,
      phaseKind: phase?.phaseKind ?? null,
      openingMode,
      stageMood,
      normalizedPressureState: factors.normalizedPressureState,
      publicExposure01: factors.publicExposure01,
      pressureStress01: factors.pressureStress01,
      helperNeed01: factors.helperNeed01,
      rescueNeed01: factors.rescueNeed01,
      proofNeed01: factors.proofNeed01,
      quoteNeed01: factors.quoteNeed01,
      silenceNeed01: factors.silenceNeed01,
      negotiationNeed01: factors.negotiationNeed01,
      legendNeed01: factors.legendNeed01,
      fakeOutRisk01: factors.fakeOutRisk01,
      signatureId: factors.signatureId,
      attackClass: request.attack.attackClass,
      primaryPunishment: request.attack.primaryPunishment,
      preferredCounterTiming: request.attack.preferredCounterTiming,
      requiredDemands: [...request.attack.counterDemands],
      budget: Object.freeze({ ...budget }),
      timeline: Object.freeze({ ...timeline }),
      noteCount: request.notes?.length ?? 0,
    } satisfies Record<string, JsonValue>);
  }

  // ========================================================================
  // MARK: Evaluation helpers
  // ========================================================================

  private buildEvaluationResult(input: {
    readonly lifecycle: ChatAttackWindowEvaluationResult['lifecycle'];
    readonly validationStatus: ChatCounterValidationStatus;
    readonly acceptsVisibleReply: boolean;
    readonly acceptsSilentCounter: boolean;
    readonly acceptsHelperAssist: boolean;
    readonly msUntilClose: number;
    readonly msFromIdeal: number;
    readonly likelyFailure: string | null;
    readonly debug: Readonly<Record<string, JsonValue>>;
  }): ChatAttackWindowEvaluationResult {
    return Object.freeze({
      lifecycle: input.lifecycle,
      validationStatus: input.validationStatus,
      acceptsVisibleReply: input.acceptsVisibleReply,
      acceptsSilentCounter: input.acceptsSilentCounter,
      acceptsHelperAssist: input.acceptsHelperAssist,
      msUntilClose: input.msUntilClose,
      msFromIdeal: input.msFromIdeal,
      likelyFailure: input.likelyFailure,
      debug: input.debug,
    });
  }

  private deriveAttemptShape(
    request: ChatAttackWindowEvaluationRequest,
  ): CounterAttemptShape {
    const playerMessage = request.playerMessage ?? null;
    const bodyParts = playerMessage?.bodyParts ?? [];
    const selectedCounterplayId = request.selectedCounterplayId ?? null;

    const hasQuote = bodyParts.some((part) => part.type === 'QUOTE');
    const hasProof = Boolean(playerMessage?.proof.proofHash)
      || bodyParts.some((part) => part.type === 'SYSTEM_TAG' && part.tag === 'PROOF');
    const helperTagged = bodyParts.some((part) => part.type === 'SYSTEM_TAG' && part.tag === 'HELPER')
      || this.selectionLooksHelper(selectedCounterplayId);
    const negotiationTagged = bodyParts.some((part) => part.type === 'OFFER')
      || this.selectionLooksNegotiation(selectedCounterplayId);

    const hasVisibleReply = Boolean(playerMessage && playerMessage.plainText.trim().length > 0);
    const silentAttempted = Boolean(selectedCounterplayId) && !hasVisibleReply;

    return Object.freeze({
      attempted: Boolean(playerMessage || selectedCounterplayId),
      hasVisibleReply,
      hasQuote,
      hasProof,
      helperTagged,
      negotiationTagged,
      silentAttempted,
      selectedCounterplayId,
    });
  }

  private evaluateRequirementForAttempt(
    window: ChatCounterWindow,
    attempt: CounterAttemptShape,
    at: number,
    idealAt: number,
    closesAt: number,
  ): WindowValidationRequirement {
    if (!attempt.attempted) {
      return 'NONE';
    }

    if (window.timingClass === 'SHADOW_ONLY' && attempt.hasVisibleReply) {
      return 'SILENCE_REPLY';
    }

    if (window.requiresVisibleReply && !attempt.hasVisibleReply) {
      return 'VISIBLE_REPLY';
    }

    if (window.allowsNegotiationEscape === false && attempt.negotiationTagged) {
      return 'NEGOTIATION_REPLY';
    }

    if (window.allowsHelperAssist === false && attempt.helperTagged) {
      return 'HELPER_REPLY';
    }

    if (window.allowsProofSpike && this.selectionLooksProof(attempt.selectedCounterplayId) && !attempt.hasProof) {
      return 'PROOF_REPLY';
    }

    if (window.allowsQuoteTurn && this.selectionLooksQuote(attempt.selectedCounterplayId) && !attempt.hasQuote) {
      return 'QUOTE_REPLY';
    }

    if (window.timingClass === 'BEAT_LOCKED' && Math.abs(at - idealAt) > Math.max(80, Math.round((closesAt - Number(window.openedAt)) * 0.08))) {
      return 'TIMED_REPLY';
    }

    if (window.timingClass === 'POST_SCENE' && at < idealAt) {
      return 'TIMED_REPLY';
    }

    if (window.timingClass === 'READ_PRESSURE_DELAYED' && at < idealAt - 90) {
      return 'TIMED_REPLY';
    }

    return 'NONE';
  }

  private resolveValidationStatusForRequirement(
    attempt: CounterAttemptShape,
    requirement: WindowValidationRequirement,
  ): ChatCounterValidationStatus {
    if (!attempt.attempted) {
      return 'WINDOW_OPEN';
    }

    return WINDOW_REQUIREMENT_TO_VALIDATION_STATUS[requirement];
  }

  private requirementToFailure(
    requirement: WindowValidationRequirement,
  ): WindowLikelihoodFailure {
    switch (requirement) {
      case 'VISIBLE_REPLY':
        return 'VISIBLE_REPLY_REQUIRED';
      case 'SILENCE_REPLY':
        return 'SILENCE_DISCIPLINE_REQUIRED';
      case 'PROOF_REPLY':
        return 'PROOF_REQUIRED';
      case 'QUOTE_REPLY':
        return 'QUOTE_REQUIRED';
      case 'TIMED_REPLY':
        return 'TIMING_REQUIRED';
      case 'NEGOTIATION_REPLY':
        return 'NEGOTIATION_NOT_ALLOWED';
      case 'HELPER_REPLY':
        return 'HELPER_NOT_ALLOWED';
      case 'NONE':
      default:
        return 'NONE';
    }
  }

  private acceptsVisibleReply(
    window: ChatCounterWindow,
    attempt: CounterAttemptShape,
  ): boolean {
    if (window.timingClass === 'SHADOW_ONLY') {
      return false;
    }

    if (!window.requiresVisibleReply) {
      return true;
    }

    return attempt.hasVisibleReply;
  }

  private resolveOpenLifecycle(
    at: number,
    idealAt: number,
    closesAt: number,
  ): 'IDEAL' | 'OPEN' {
    const idealTolerance = Math.max(60, Math.round((closesAt - idealAt) * 0.12));
    return Math.abs(at - idealAt) <= idealTolerance ? 'IDEAL' : 'OPEN';
  }

  private debugAttemptShape(attempt: CounterAttemptShape): Readonly<Record<string, JsonValue>> {
    return Object.freeze({
      attempted: attempt.attempted,
      hasVisibleReply: attempt.hasVisibleReply,
      hasQuote: attempt.hasQuote,
      hasProof: attempt.hasProof,
      helperTagged: attempt.helperTagged,
      negotiationTagged: attempt.negotiationTagged,
      silentAttempted: attempt.silentAttempted,
      selectedCounterplayId: attempt.selectedCounterplayId,
    });
  }

  // ========================================================================
  // MARK: Factor estimation
  // ========================================================================

  private estimatePublicExposure01(
    request: ChatAttackWindowCreationRequest,
    witnessBonus01: Score01,
  ): Score01 {
    const visible =
      request.fight.visibleChannel === 'GLOBAL' ? 0.30 :
      request.fight.visibleChannel === 'SYNDICATE' ? 0.15 :
      request.fight.visibleChannel === 'DEAL_ROOM' ? 0.07 :
      0.10;

    const fightBias = Number(request.fight.publicExposure01) * 0.32;
    const signalBias = this.estimateSignalPublicity01(request.signal);

    return clamp01(visible + Number(witnessBonus01) + fightBias + Number(signalBias) * 0.18);
  }

  private estimatePressureStress01(
    normalizedPressureState: NormalizedPressureState,
  ): Score01 {
    switch (normalizedPressureState) {
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

  private estimateHelperNeed01(
    request: ChatAttackWindowCreationRequest,
    phaseKind: string,
    punishmentProfile: PunishmentWindowProfile,
  ): Score01 {
    return clamp01(
      Number(request.attack.allowsHelperAssistance) * 0.20
      + Number(request.fight.rescueAllowed) * 0.10
      + Number(request.attack.counterDemands.includes('HELPER_REPLY')) * Number(COUNTER_DEMAND_WEIGHT.HELPER_REPLY)
      + Number(phaseKind === 'RESCUE_CHECK') * 0.18
      - Number(punishmentProfile.helperTax01),
    );
  }

  private estimateRescueNeed01(
    request: ChatAttackWindowCreationRequest,
    pressureStress01: Score01,
    phaseKind: string,
  ): Score01 {
    const source = request.signal as { readonly metadata?: Readonly<Record<string, unknown>> } | null | undefined;
    const rescueFlag = Number(Boolean(source?.metadata?.['rescueRisk']));

    return clamp01(
      Number(request.fight.rescueAllowed) * 0.14
      + Number(pressureStress01) * 0.29
      + rescueFlag * 0.18
      + Number(phaseKind === 'RESCUE_CHECK') * 0.22
      + Number(request.attack.primaryPunishment === 'HELPER_SUPPRESSION') * 0.05,
    );
  }

  private estimateProofNeed01(
    demands: readonly ChatBossCounterDemand[],
    proofWeighted: boolean,
  ): Score01 {
    return clamp01(
      Number(proofWeighted) * 0.72
      + Number(demands.includes('PROOF_REPLY')) * Number(COUNTER_DEMAND_WEIGHT.PROOF_REPLY),
    );
  }

  private estimateQuoteNeed01(
    demands: readonly ChatBossCounterDemand[],
    quoteWeighted: boolean,
  ): Score01 {
    return clamp01(
      Number(quoteWeighted) * 0.69
      + Number(demands.includes('QUOTE_REPLY')) * Number(COUNTER_DEMAND_WEIGHT.QUOTE_REPLY),
    );
  }

  private estimateSilenceNeed01(
    request: ChatAttackWindowCreationRequest,
    openingProfile: OpeningWindowProfile,
    channelProfile: ChannelWindowProfile,
  ): Score01 {
    return clamp01(
      Number(request.attack.allowsSilenceOutplay) * 0.58
      + Number(request.attack.counterDemands.includes('SILENCE_REPLY')) * Number(COUNTER_DEMAND_WEIGHT.SILENCE_REPLY)
      + Number(openingProfile.allowsSilence) * 0.08
      + channelProfile.preferredSilenceRatio,
    );
  }

  private estimateNegotiationNeed01(
    request: ChatAttackWindowCreationRequest,
  ): Score01 {
    return clamp01(
      Number(request.attack.allowsNegotiationEscape) * 0.46
      + Number(request.attack.counterDemands.includes('NEGOTIATION_REPLY')) * Number(COUNTER_DEMAND_WEIGHT.NEGOTIATION_REPLY)
      + Number(request.attack.primaryPunishment === 'DEAL_REPRICE') * 0.20,
    );
  }

  private estimateLegendNeed01(
    request: ChatAttackWindowCreationRequest,
  ): Score01 {
    return clamp01(
      Number(request.fight.legendEligible) * 0.26
      + Number(request.fight.pattern.legendEligible) * 0.22
      + Number(request.fight.shadowLedgerEnabled) * 0.08,
    );
  }

  private estimateFakeOutRisk01(
    request: ChatAttackWindowCreationRequest,
    phaseKind: string,
    publicExposure01: Score01,
  ): Score01 {
    return clamp01(
      Number(request.attack.telegraph.canFakeOut) * 0.36
      + Number(phaseKind === 'BAIT') * 0.18
      + Number(publicExposure01) * 0.12,
    );
  }

  private estimateSignalPublicity01(
    signal: ChatSignalEnvelope | null | undefined,
  ): Score01 {
    if (!signal) return clamp01(0.08);

    const battleBias = signal.battle ? 0.06 : 0;
    const liveopsBias = signal.liveops?.haterRaidActive ? 0.06 : 0;
    const metadataBias =
      Number(Boolean(signal.metadata?.['publicWitness'])) * 0.08
      + Number(Boolean(signal.metadata?.['featured'])) * 0.06;

    return clamp01(battleBias + liveopsBias + metadataBias);
  }

  private normalizePressureState(
    signal: ChatSignalEnvelope | null | undefined,
  ): NormalizedPressureState {
    const direct = signal?.battle?.pressureTier;
    if (direct) {
      return this.mapBackendPressureTier(direct);
    }

    const metadataTier = signal?.metadata?.['pressureTier'];
    if (typeof metadataTier === 'string') {
      return this.mapAnyPressureTierString(metadataTier);
    }

    return 'WATCHFUL';
  }

  private mapBackendPressureTier(tier: PressureTier): NormalizedPressureState {
    switch (tier) {
      case 'CRITICAL':
        return 'CRITICAL';
      case 'HIGH':
        return 'PRESSURED';
      case 'ELEVATED':
        return 'WATCHFUL';
      case 'BUILDING':
        return 'WATCHFUL';
      case 'NONE':
      default:
        return 'CALM';
    }
  }

  private mapAnyPressureTierString(value: string): NormalizedPressureState {
    switch (value) {
      case 'BREAKPOINT':
        return 'BREAKPOINT';
      case 'CRITICAL':
        return 'CRITICAL';
      case 'PRESSURED':
      case 'HIGH':
        return 'PRESSURED';
      case 'WATCHFUL':
      case 'ELEVATED':
      case 'BUILDING':
        return 'WATCHFUL';
      case 'CALM':
      case 'NONE':
      default:
        return 'CALM';
    }
  }

  // ========================================================================
  // MARK: Profiles and mapping helpers
  // ========================================================================

  private resolveVisibleChannel(
    preferred: ChatVisibleChannel,
    fallbackChannelId: ChatChannelId,
    room: ChatRoomState,
  ): ChatVisibleChannel {
    if (preferred && isVisibleChannelId(preferred)) return preferred;
    if (isVisibleChannelId(fallbackChannelId)) return fallbackChannelId;
    if (room.activeVisibleChannel && isVisibleChannelId(room.activeVisibleChannel)) return room.activeVisibleChannel;
    return 'GLOBAL';
  }

  private resolvePhase(
    fight: ChatBossFightPlan,
    phaseId: ChatBossRound['phaseId'],
  ): ChatBossPhase | null {
    return fight.phases.find((phase) => phase.phaseId === phaseId) ?? null;
  }

  private resolveOpeningMode(
    request: ChatAttackWindowCreationRequest,
    phase: ChatBossPhase | null,
  ): ChatBossOpeningMode {
    if (request.attack.telegraph.openingMode) {
      return request.attack.telegraph.openingMode;
    }

    if (phase?.attacks[0]?.telegraph.openingMode) {
      return phase.attacks[0].telegraph.openingMode;
    }

    return request.fight.pattern.openingMode;
  }

  private resolveStageMood(
    request: ChatAttackWindowCreationRequest,
  ): string {
    return request.fight.openingMood
      ?? request.room.stageMood
      ?? 'TENSE';
  }

  private resolveWindowTimingClass(
    preferred: ChatCounterTimingClass,
    openingMode: ChatBossOpeningMode,
  ): ChatCounterTimingClass {
    if (openingMode === 'SILENCE_LURE') return 'SHADOW_ONLY';
    if (openingMode === 'NEGOTIATION_READ_DELAYED' && preferred === 'FAST') return 'READ_PRESSURE_DELAYED';
    return preferred;
  }

  private preferredDeliveryPriorityForWindow(
    visibleChannel: ChatVisibleChannel,
    timingClass: ChatCounterTimingClass,
  ): ChatCounterWindow['preferredDeliveryPriority'] {
    if (timingClass === 'INSTANT') return 'IMMEDIATE';
    if (timingClass === 'BEAT_LOCKED') return 'HIGH';
    if (visibleChannel === 'DEAL_ROOM') return 'HIGH';
    if (visibleChannel === 'LOBBY') return 'LOW';
    return 'NORMAL';
  }

  private deriveRiskBand(
    visibleChannel: ChatVisibleChannel,
    pressureStress01: Score01,
    fakeOutRisk01: Score01,
    severity: ChatBossAttackSeverity,
  ): ChatCounterRiskBand {
    const pressure = Number(pressureStress01);
    const fakeOut = Number(fakeOutRisk01);

    if (severity === 'EXECUTION' || pressure >= 0.88) return 'SUICIDAL';
    if (severity === 'CRITICAL' || fakeOut >= 0.56 || visibleChannel === 'DEAL_ROOM') return 'DANGEROUS';
    if (pressure >= 0.52 || visibleChannel === 'GLOBAL') return 'VOLATILE';
    if (pressure <= 0.18 && fakeOut <= 0.10 && visibleChannel === 'LOBBY') return 'SAFE';
    return 'MEASURED';
  }

  private deriveSignatureId(
    visibleChannel: ChatVisibleChannel,
    request: ChatAttackWindowCreationRequest,
    pressureStress01: Score01,
    rescueNeed01: Score01,
    legendNeed01: Score01,
    openingMode: ChatBossOpeningMode,
  ): ChatAttackWindowPolicySignatureId {
    if (Number(legendNeed01) >= 0.32 && request.fight.legendEligible) return 'LEGEND_TRIAL';
    if (Number(rescueNeed01) >= 0.46 && request.fight.rescueAllowed) return 'RESCUE_OVERRIDE';
    if (openingMode === 'SILENCE_LURE') return 'SHADOW_BIND';
    if (visibleChannel === 'DEAL_ROOM') return 'DEAL_ROOM_CLINCH';
    if (visibleChannel === 'SYNDICATE') return 'SYNDICATE_KNIFE';
    if (visibleChannel === 'LOBBY' && Number(pressureStress01) < 0.40) return 'LOBBY_MEASURE';
    return 'PUBLIC_DOGPILE';
  }

  private deriveIdealResponseRatio(
    timing: ChatCounterTimingClass,
    openingProfile: OpeningWindowProfile,
    visibleChannel: ChatVisibleChannel,
    stageMood: string,
  ): number {
    const base = COUNTER_TIMING_RATIO[timing] ?? openingProfile.idealResponseRatio;
    const channelShift =
      visibleChannel === 'DEAL_ROOM' ? 0.06 :
      visibleChannel === 'GLOBAL' ? -0.03 :
      visibleChannel === 'LOBBY' ? 0.03 :
      0;

    const moodShift = this.getStageMoodProfile(stageMood).idealShift;

    return Math.max(0.18, Math.min(0.82, base + channelShift + moodShift));
  }

  private getChannelProfile(visibleChannel: ChatVisibleChannel): ChannelWindowProfile {
    return WINDOW_CHANNEL_PROFILE[visibleChannel] ?? WINDOW_CHANNEL_PROFILE.GLOBAL;
  }

  private getOpeningProfile(mode: ChatBossOpeningMode): OpeningWindowProfile {
    return WINDOW_OPENING_MODE_PROFILE[mode] ?? WINDOW_OPENING_MODE_PROFILE.IMMEDIATE;
  }

  private getSeverityProfile(severity: ChatBossAttackSeverity): SeverityWindowProfile {
    return WINDOW_SEVERITY_PROFILE[severity] ?? WINDOW_SEVERITY_PROFILE.HEAVY;
  }

  private getStageMoodProfile(stageMood: string): StageMoodWindowProfile {
    return WINDOW_STAGE_MOOD_PROFILE[stageMood as keyof typeof WINDOW_STAGE_MOOD_PROFILE]
      ?? WINDOW_STAGE_MOOD_PROFILE.TENSE;
  }

  private getPunishmentProfile(primaryPunishment: ChatBossPunishmentClass): PunishmentWindowProfile {
    return WINDOW_PUNISHMENT_PROFILE[primaryPunishment] ?? WINDOW_PUNISHMENT_PROFILE.PRESSURE_SPIKE;
  }

  private authoritativeRoundDurationMs(round: ChatBossRound): number {
    const duration = Number(round.closesAt) - Number(round.openedAt);
    return Number.isFinite(duration) && duration > 0 ? duration : this.tuning.defaultWindowMs;
  }

  private blendAuthoritativeBase(
    authoritativeRoundMs: number,
    defaultWindowMs: number,
  ): number {
    const blend = Number(this.tuning.authoritativeRoundBlend01);
    return Math.round(authoritativeRoundMs * blend + defaultWindowMs * (1 - blend));
  }

  private windowRequiresVisibleReply(
    attack: ChatBossAttack,
    openingMode: ChatBossOpeningMode,
  ): boolean {
    if (openingMode === 'SILENCE_LURE') return false;
    if (attack.counterDemands.includes('SILENCE_REPLY')) return false;
    return attack.counterDemands.includes('VISIBLE_REPLY') || !attack.allowsSilenceOutplay;
  }

  // ========================================================================
  // MARK: Target actor construction and message introspection
  // ========================================================================

  private buildTargetActorSnapshot(
    request: ChatAttackWindowCreationRequest,
  ): ChatCounterWindow['targetActor'] {
    const actor = request.fight.player;

    return Object.freeze({
      actorId: this.createTargetActorId(request),
      actorKind: actor.actorKind,
      displayName: actor.displayName,
      npcId: actor.npcId ?? null,
      userId: actor.userId ?? null,
      relationshipId: actor.relationshipId ?? null,
      counterpartKind: actor.counterpartKind ?? null,
      stanceHint: actor.stance,
      objectiveHint: actor.objective,
      confidenceScore: this.score100FromBias((actor.proofBias01 + actor.quoteBias01) / 2),
      intimidationScore: this.score100FromBias((actor.pressureBias01 + actor.crowdBias01) / 2),
      embarrassmentScore: this.score100FromBias((actor.crowdBias01 + actor.silenceBias01) / 2),
    });
  }

  private score100FromBias(value: number): NonNullable<ChatCounterWindow['targetActor']['confidenceScore']> {
    return Math.max(0, Math.min(100, Math.round(value * 100))) as NonNullable<ChatCounterWindow['targetActor']['confidenceScore']>;
  }

  private selectionLooksProof(selectedCounterplayId: string | null): boolean {
    return Boolean(selectedCounterplayId && /proof/i.test(selectedCounterplayId));
  }

  private selectionLooksQuote(selectedCounterplayId: string | null): boolean {
    return Boolean(selectedCounterplayId && /quote/i.test(selectedCounterplayId));
  }

  private selectionLooksHelper(selectedCounterplayId: string | null): boolean {
    return Boolean(selectedCounterplayId && /helper|assist|rescue/i.test(selectedCounterplayId));
  }

  private selectionLooksNegotiation(selectedCounterplayId: string | null): boolean {
    return Boolean(selectedCounterplayId && /deal|negot|reprice|offer/i.test(selectedCounterplayId));
  }

  // ========================================================================
  // MARK: Primitive helpers
  // ========================================================================

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
    signatureId: ChatAttackWindowPolicySignatureId,
  ): string {
    return [
      'cbw',
      String(request.room.roomId),
      String(request.session.identity.sessionId),
      String(request.attack.attackId),
      String(signatureId),
      String(opensAt),
      String(closesAt),
    ].join(':');
  }

  private createTargetActorId(
    request: ChatAttackWindowCreationRequest,
  ): ChatCounterWindow['targetActor']['actorId'] {
    return (
      `target:${String(request.room.roomId)}:${String(request.session.identity.sessionId)}`
    ) as ChatCounterWindow['targetActor']['actorId'];
  }

  private asWindowId(value: string): ChatBossCounterWindowBinding['windowId'] {
    return value as ChatBossCounterWindowBinding['windowId'];
  }
}

// ============================================================================
// MARK: Factory and operator notes
// ============================================================================

export function createChatAttackWindowPolicy(
  options: ChatAttackWindowPolicyOptions = {},
): ChatAttackWindowPolicy {
  return new ChatAttackWindowPolicy(options);
}

export const CHAT_ATTACK_WINDOW_POLICY_NOTES = Object.freeze([
  'PUBLIC_DOGPILE: Long enough for a real reversal because the crowd is part of the punishment.',
  'SYNDICATE_KNIFE: Tighter than global, still readable, optimized for reputation-sensitive counters.',
  'DEAL_ROOM_CLINCH: Quiet and predatory with narrow reprice windows and high bluff punishment.',
  'LOBBY_MEASURE: Readable pre-escalation timing law for low-commitment rooms.',
  'SHADOW_BIND: Mostly invisible setup with strict timing and minimal visible reply tolerance.',
  'RESCUE_OVERRIDE: Extends enough to allow helper-assisted recovery without nullifying pressure.',
  'LEGEND_TRIAL: Slightly wider because prestige windows need authored clarity.',
  'Backend channels remain canonical: GLOBAL, SYNDICATE, DEAL_ROOM, LOBBY.',
  'Fight opening law resolves from attack telegraph first, phase second, pattern third.',
  'Round phase kind is resolved from fight.phases by round.phaseId, never guessed from the round object.',
  'Window.validationStatus is UNVALIDATED at creation time and becomes authoritative only during evaluation.',
  'Reply evidence inspection uses message.id, message.bodyParts, and message.proof — never donor-lane aliases.',
  'Session identity resolves from session.identity.sessionId, not from a flattened session field.',
  'Moment/scene hints resolve from fight.pattern, not from the fight root object.',
  'Actor posture resolves from shared relationship stance/objective plus bias-derived score projections.',
  'Risk bands are SAFE, MEASURED, VOLATILE, DANGEROUS, SUICIDAL — not low/medium/high shorthands.',
  'Backend pressure normalization maps NONE/BUILDING/ELEVATED/HIGH/CRITICAL into calm→breakpoint timing stress.',
  'Counter demands are VISIBLE_REPLY / PROOF_REPLY / QUOTE_REPLY / TIMED_REPLY / SILENCE_REPLY / HELPER_REPLY / NEGOTIATION_REPLY.',
  'Preferred timing classes are INSTANT / FAST / BEAT_LOCKED / READ_PRESSURE_DELAYED / LATE_BUT_VALID / POST_SCENE / SHADOW_ONLY.',
  'This file is authoritative timing law, not a text-generation surface.',
] as const);
