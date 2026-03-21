/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TELEGRAPH POLICY
 * FILE: backend/src/game/engine/chat/combat/ChatTelegraphPolicy.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend authority for conversational attack telegraphs.
 *
 * This module is the server-side law that determines how a hostile chat attack
 * should announce itself before resolution. In this stack, the telegraph is not
 * flavor text. It is the readable pressure envelope that makes language combat
 * fair, legible, theatrical, and replayable.
 *
 * What this file owns
 * -------------------
 * - selecting the authoritative telegraph profile for a fight / round / attack,
 * - determining whether the player should see the threat, feel it, or only infer it,
 * - staging beat-by-beat lead-in timing, reveal timing, typing theater, and silence,
 * - projecting witness density, crowd posture, helper intercept risk, and proof cues,
 * - mapping telegraph semantics onto overlay-oriented payloads such as threat radar,
 *   moment flash, proof-oriented hinting, rescue banners, and counterplay prompts,
 * - and returning deterministic projections the rest of the backend can trust.
 *
 * What this file does not own
 * ---------------------------
 * - transcript mutation,
 * - socket fanout,
 * - frontend-specific rendering decisions,
 * - counter resolution itself,
 * - or fight-level final authority.
 *
 * Design doctrine
 * ---------------
 * - Telegraphs must make attacks legible without flattening psychological tension.
 * - Silence is a beat, not an absence.
 * - Visibility, pacing, and witness behavior are as important as the attack text.
 * - Helpers may haunt a telegraph before they fully intervene.
 * - Deal room telegraphs should feel predatory; global ones should feel theatrical.
 * - Determinism matters: the same inputs should produce the same telegraph law.
 * ============================================================================
 */

import type {
  ChatBossAttack,
  ChatBossAttackClass,
  ChatBossAttackSeverity,
  ChatBossCounterDemand,
  ChatBossCounterWindowBinding,
  ChatBossFightKind,
  ChatBossFightPlan,
  ChatBossOpeningMode,
  ChatBossRound,
  ChatBossTelegraph,
} from '../../../../../../shared/contracts/chat/ChatBossFight';
import {
  deriveBossTelegraph,
  toScore01 as toBossScore01,
  toScore100 as toBossScore100,
} from '../../../../../../shared/contracts/chat/ChatBossFight';

import type {
  ChatCounterTimingClass,
} from '../../../../../../shared/contracts/chat/ChatCounterplay';

import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
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
  Score100,
  UnixMs,
} from '../types';
import {
  asUnixMs,
  clamp01,
  clamp100,
  isVisibleChannelId,
} from '../types';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export interface ChatTelegraphPolicyClock {
  now(): number;
}

export interface ChatTelegraphPolicyLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatTelegraphPolicyTuning {
  readonly minimumLeadInMs: number;
  readonly maximumLeadInMs: number;
  readonly minimumRevealDelayMs: number;
  readonly maximumRevealDelayMs: number;
  readonly maximumBeats: number;
  readonly quietChannelVisibilityPenalty01: Score01;
  readonly publicWitnessBias01: Score01;
  readonly helperForeshadowBias01: Score01;
  readonly fakeOutTolerance01: Score01;
  readonly minimumThreatReadability01: Score01;
  readonly maximumThreatReadability01: Score01;
  readonly threatRadarEscalationThreshold01: Score01;
  readonly momentFlashThreshold01: Score01;
  readonly rescueBannerThreshold01: Score01;
  readonly proofHintThreshold01: Score01;
  readonly quoteHintThreshold01: Score01;
}

export interface ChatTelegraphPolicyOptions {
  readonly clock?: ChatTelegraphPolicyClock;
  readonly logger?: ChatTelegraphPolicyLogger;
  readonly tuning?: Partial<ChatTelegraphPolicyTuning>;
}

export interface ChatTelegraphBeat {
  readonly beatId: string;
  readonly kind:
    | 'SILENCE'
    | 'TYPING'
    | 'WHISPER'
    | 'RADAR'
    | 'VISIBLE_WARNING'
    | 'HELPER_GHOST'
    | 'CROWD_SHIFT'
    | 'WINDOW_OPEN'
    | 'ATTACK_REVEAL';
  readonly label: string;
  readonly startsAt: UnixMs;
  readonly endsAt: UnixMs;
  readonly visibleToPlayer: boolean;
  readonly recommendedChannelId: ChatChannelId;
  readonly emphasis01: Score01;
  readonly notes: readonly string[];
}

export interface ChatTelegraphWitnessPlan {
  readonly audienceExposure01: Score01;
  readonly ridiculeRisk01: Score01;
  readonly hypeRisk01: Score01;
  readonly whisperRisk01: Score01;
  readonly syndicateLeakRisk01: Score01;
  readonly recommendedCrowdLineCount: number;
  readonly notes: readonly string[];
}

export interface ChatTelegraphOverlayPlan {
  readonly threatRadarVisible: boolean;
  readonly threatRadarThreatTag: string;
  readonly threatRadarSeverityScore: Score100;
  readonly momentFlashVisible: boolean;
  readonly momentFlashLabel: string;
  readonly counterplayPromptVisible: boolean;
  readonly proofCueVisible: boolean;
  readonly quoteCueVisible: boolean;
  readonly rescueBannerVisible: boolean;
  readonly rescueTone: 'NONE' | 'WATCHFUL' | 'STEADY' | 'URGENT';
  readonly notes: readonly string[];
}

export interface ChatTelegraphCounterHint {
  readonly demand: ChatBossCounterDemand;
  readonly label: string;
  readonly explanation: string;
  readonly urgency01: Score01;
  readonly relevance01: Score01;
  readonly recommendedTiming: ChatCounterTimingClass;
  readonly notes: readonly string[];
}

export interface ChatTelegraphProjection {
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly fightId: string;
  readonly roundId: string;
  readonly attackId: string;
  readonly telegraph: ChatBossTelegraph;
  readonly visibleChannel: ChatVisibleChannel;
  readonly leadInMs: number;
  readonly revealDelayMs: number;
  readonly beatSchedule: readonly ChatTelegraphBeat[];
  readonly witnessPlan: ChatTelegraphWitnessPlan;
  readonly overlayPlan: ChatTelegraphOverlayPlan;
  readonly counterHints: readonly ChatTelegraphCounterHint[];
  readonly threatReadability01: Score01;
  readonly dreadScore01: Score01;
  readonly fakeOutRisk01: Score01;
  readonly helperForeshadow01: Score01;
  readonly shouldSimulateTyping: boolean;
  readonly shouldPrimeSilence: boolean;
  readonly shouldEchoToThreatRadar: boolean;
  readonly dominantThreatTag: string;
  readonly debug: Readonly<Record<string, JsonValue>>;
}

export interface ChatTelegraphProjectionRequest {
  readonly state: ChatState;
  readonly room: ChatRoomState;
  readonly session: ChatSessionState;
  readonly fight: ChatBossFightPlan;
  readonly round: ChatBossRound;
  readonly attack: ChatBossAttack;
  readonly binding?: ChatBossCounterWindowBinding | null;
  readonly signal?: ChatSignalEnvelope | null;
  readonly sourceMessage?: ChatMessage | null;
  readonly causeEventId?: ChatEventId | null;
  readonly now?: UnixMs;
  readonly notes?: readonly string[];
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_CLOCK: ChatTelegraphPolicyClock = Object.freeze({
  now: () => Date.now(),
});

const DEFAULT_LOGGER: ChatTelegraphPolicyLogger = Object.freeze({
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
});

export const DEFAULT_CHAT_TELEGRAPH_POLICY_TUNING: ChatTelegraphPolicyTuning = Object.freeze({
  minimumLeadInMs: 120,
  maximumLeadInMs: 4200,
  minimumRevealDelayMs: 40,
  maximumRevealDelayMs: 3800,
  maximumBeats: 8,
  quietChannelVisibilityPenalty01: clamp01(0.18),
  publicWitnessBias01: clamp01(0.61),
  helperForeshadowBias01: clamp01(0.44),
  fakeOutTolerance01: clamp01(0.37),
  minimumThreatReadability01: clamp01(0.21),
  maximumThreatReadability01: clamp01(0.96),
  threatRadarEscalationThreshold01: clamp01(0.46),
  momentFlashThreshold01: clamp01(0.63),
  rescueBannerThreshold01: clamp01(0.72),
  proofHintThreshold01: clamp01(0.42),
  quoteHintThreshold01: clamp01(0.39),
});

const TELEGRAPH_CHANNEL_PROFILES = Object.freeze({
  GLOBAL: Object.freeze({
    label: 'GLOBAL',
    visibilityBonus01: clamp01(0.22),
    witnessBonus01: clamp01(0.28),
    whisperBias01: clamp01(0.16),
    hypeBias01: clamp01(0.34),
    ridiculeBias01: clamp01(0.33),
    baseLeadInMs: 540,
    baseRevealDelayMs: 620,
  }),
  SYNDICATE: Object.freeze({
    label: 'SYNDICATE',
    visibilityBonus01: clamp01(0.1),
    witnessBonus01: clamp01(0.18),
    whisperBias01: clamp01(0.31),
    hypeBias01: clamp01(0.18),
    ridiculeBias01: clamp01(0.14),
    baseLeadInMs: 460,
    baseRevealDelayMs: 540,
  }),
  DEAL_ROOM: Object.freeze({
    label: 'DEAL_ROOM',
    visibilityBonus01: clamp01(0.04),
    witnessBonus01: clamp01(0.06),
    whisperBias01: clamp01(0.37),
    hypeBias01: clamp01(0.04),
    ridiculeBias01: clamp01(0.09),
    baseLeadInMs: 820,
    baseRevealDelayMs: 930,
  }),
  DIRECT: Object.freeze({
    label: 'DIRECT',
    visibilityBonus01: clamp01(0.08),
    witnessBonus01: clamp01(0.05),
    whisperBias01: clamp01(0.12),
    hypeBias01: clamp01(0.02),
    ridiculeBias01: clamp01(0.04),
    baseLeadInMs: 360,
    baseRevealDelayMs: 420,
  }),
  SPECTATOR: Object.freeze({
    label: 'SPECTATOR',
    visibilityBonus01: clamp01(0.19),
    witnessBonus01: clamp01(0.22),
    whisperBias01: clamp01(0.19),
    hypeBias01: clamp01(0.29),
    ridiculeBias01: clamp01(0.24),
    baseLeadInMs: 480,
    baseRevealDelayMs: 590,
  }),
} as const);

const TELEGRAPH_ATTACK_CLASS_PROFILE = Object.freeze({
  HUMILIATION: Object.freeze({
    readabilityBonus01: clamp01(0.14),
    dreadBonus01: clamp01(0.22),
    radarBias01: clamp01(0.27),
    silenceBias01: clamp01(0.09),
    helperForeshadow01: clamp01(0.33),
  }),
  TRAP: Object.freeze({
    readabilityBonus01: clamp01(0.08),
    dreadBonus01: clamp01(0.16),
    radarBias01: clamp01(0.21),
    silenceBias01: clamp01(0.18),
    helperForeshadow01: clamp01(0.26),
  }),
  NEGOTIATION: Object.freeze({
    readabilityBonus01: clamp01(0.09),
    dreadBonus01: clamp01(0.13),
    radarBias01: clamp01(0.12),
    silenceBias01: clamp01(0.24),
    helperForeshadow01: clamp01(0.21),
  }),
  SOCIAL: Object.freeze({
    readabilityBonus01: clamp01(0.12),
    dreadBonus01: clamp01(0.18),
    radarBias01: clamp01(0.18),
    silenceBias01: clamp01(0.11),
    helperForeshadow01: clamp01(0.22),
  }),
  PROOF: Object.freeze({
    readabilityBonus01: clamp01(0.18),
    dreadBonus01: clamp01(0.1),
    radarBias01: clamp01(0.19),
    silenceBias01: clamp01(0.06),
    helperForeshadow01: clamp01(0.17),
  }),
  DOMINANCE: Object.freeze({
    readabilityBonus01: clamp01(0.1),
    dreadBonus01: clamp01(0.2),
    radarBias01: clamp01(0.23),
    silenceBias01: clamp01(0.14),
    helperForeshadow01: clamp01(0.24),
  }),
} as const);

const TELEGRAPH_OPENING_MODE_PROFILE = Object.freeze({
  VISIBLE: Object.freeze({
    leadInMultiplier: 0.86,
    revealDelayMultiplier: 0.88,
    visibilityBias01: clamp01(0.22),
    fakeOutBias01: clamp01(0.08),
    typingBias01: clamp01(0.31),
    silenceBias01: clamp01(0.19),
  }),
  QUIET: Object.freeze({
    leadInMultiplier: 1.22,
    revealDelayMultiplier: 1.27,
    visibilityBias01: clamp01(0.04),
    fakeOutBias01: clamp01(0.18),
    typingBias01: clamp01(0.13),
    silenceBias01: clamp01(0.37),
  }),
  SHADOW: Object.freeze({
    leadInMultiplier: 1.14,
    revealDelayMultiplier: 1.19,
    visibilityBias01: clamp01(0.02),
    fakeOutBias01: clamp01(0.23),
    typingBias01: clamp01(0.09),
    silenceBias01: clamp01(0.41),
  }),
  CROWD_SURGE: Object.freeze({
    leadInMultiplier: 0.74,
    revealDelayMultiplier: 0.82,
    visibilityBias01: clamp01(0.27),
    fakeOutBias01: clamp01(0.11),
    typingBias01: clamp01(0.22),
    silenceBias01: clamp01(0.08),
  }),
  BAIT: Object.freeze({
    leadInMultiplier: 0.97,
    revealDelayMultiplier: 1.06,
    visibilityBias01: clamp01(0.14),
    fakeOutBias01: clamp01(0.31),
    typingBias01: clamp01(0.18),
    silenceBias01: clamp01(0.21),
  }),
} as const);

const TELEGRAPH_SEVERITY_PROFILE = Object.freeze({
  LOW: Object.freeze({
    leadInMultiplier: 0.84,
    revealDelayMultiplier: 0.76,
    dreadBonus01: clamp01(0.38),
    fakeOutRisk01: clamp01(0.24),
  }),
  MEDIUM: Object.freeze({
    leadInMultiplier: 1.0,
    revealDelayMultiplier: 1.0,
    dreadBonus01: clamp01(0.52),
    fakeOutRisk01: clamp01(0.41),
  }),
  HIGH: Object.freeze({
    leadInMultiplier: 1.18,
    revealDelayMultiplier: 1.24,
    dreadBonus01: clamp01(0.68),
    fakeOutRisk01: clamp01(0.56),
  }),
  SEVERE: Object.freeze({
    leadInMultiplier: 1.38,
    revealDelayMultiplier: 1.52,
    dreadBonus01: clamp01(0.84),
    fakeOutRisk01: clamp01(0.72),
  }),
} as const);

export const CHAT_TELEGRAPH_SCENE_SIGNATURES = Object.freeze([
  Object.freeze({
    signatureId: 'BANKRUPTCY_EXPOSURE',
    label: 'Bankruptcy Exposure',
    dominantThreatTag: 'HUMILIATION',
    openingHint: 'VISIBLE',
    severityHint: 'SEVERE',
    description: 'Humiliation-heavy visible read before a public collapse strike.',
  }),
  Object.freeze({
    signatureId: 'SHIELD_BREAK_SWARM',
    label: 'Shield Break Swarm',
    dominantThreatTag: 'SWARM',
    openingHint: 'VISIBLE',
    severityHint: 'HIGH',
    description: 'Crowd-forward shield fracture telegraph with watcher amplification.',
  }),
  Object.freeze({
    signatureId: 'DEAL_ROOM_SQUEEZE',
    label: 'Deal Room Squeeze',
    dominantThreatTag: 'SQUEEZE',
    openingHint: 'QUIET',
    severityHint: 'HIGH',
    description: 'Quiet predatory negotiation squeeze with silence before reveal.',
  }),
  Object.freeze({
    signatureId: 'PROOF_TRAP',
    label: 'Proof Trap',
    dominantThreatTag: 'PROOF',
    openingHint: 'VISIBLE',
    severityHint: 'HIGH',
    description: 'Receipts-first trap that rewards evidence or quote defense.',
  }),
  Object.freeze({
    signatureId: 'QUOTE_AMBUSH',
    label: 'Quote Ambush',
    dominantThreatTag: 'QUOTE',
    openingHint: 'VISIBLE',
    severityHint: 'MEDIUM',
    description: 'Callback ambush built around prior boasts and fast reversal windows.',
  }),
  Object.freeze({
    signatureId: 'RIVALRY_ESCALATION',
    label: 'Rivalry Escalation',
    dominantThreatTag: 'RIVALRY',
    openingHint: 'VISIBLE',
    severityHint: 'MEDIUM',
    description: 'Relationship-colored boss pressure that personalizes the opening.',
  }),
  Object.freeze({
    signatureId: 'PANIC_MISDIRECT',
    label: 'Panic Misdirect',
    dominantThreatTag: 'MISDIRECT',
    openingHint: 'FAKEOUT',
    severityHint: 'MEDIUM',
    description: 'Fast fake-out lane that simulates certainty before a pivot.',
  }),
  Object.freeze({
    signatureId: 'SHADOW_PULL',
    label: 'Shadow Pull',
    dominantThreatTag: 'SHADOW',
    openingHint: 'QUIET',
    severityHint: 'LOW',
    description: 'Low-visibility shadow setup that should still feel dangerous.',
  }),
  Object.freeze({
    signatureId: 'HELPER_TEST',
    label: 'Helper Test',
    dominantThreatTag: 'RESCUE',
    openingHint: 'VISIBLE',
    severityHint: 'MEDIUM',
    description: 'A telegraph that intentionally leaves rescue space without killing pressure.',
  }),
  Object.freeze({
    signatureId: 'LAST_STAND',
    label: 'Last Stand',
    dominantThreatTag: 'FINISHER',
    openingHint: 'VISIBLE',
    severityHint: 'SEVERE',
    description: 'High-drama final-turn telegraph for comeback or humiliation endings.',
  }),
] as const);

export const CHAT_TELEGRAPH_DEMAND_LABELS = Object.freeze({
  PROOF: 'Bring receipts or materially demonstrable truth.',
  QUOTE: 'Use a prior statement, callback, or exact language reversal.',
  TIMING: 'Respond in the intended beat window rather than after it fully settles.',
  SILENCE: 'Hold or delay visibly enough to invert the pressure.',
  DOMINANCE: 'Project command rather than defense.',
  DEFLECTION: 'Refuse the frame and move the threat elsewhere.',
  NEGOTIATION: 'Change price, terms, or exit conditions instead of trading insults.',
  HELPER: 'Use an ally or helper surface without surrendering authorship.',
  EXIT: 'Convert survival into controlled disengagement.',
} as const);

// ============================================================================
// MARK: Implementation
// ============================================================================

export class ChatTelegraphPolicy {
  private readonly clock: ChatTelegraphPolicyClock;
  private readonly logger: ChatTelegraphPolicyLogger;
  private readonly tuning: ChatTelegraphPolicyTuning;

  public constructor(options: ChatTelegraphPolicyOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.tuning = Object.freeze({
      ...DEFAULT_CHAT_TELEGRAPH_POLICY_TUNING,
      ...(options.tuning ?? {}),
    });
  }

  public deriveProjection(request: ChatTelegraphProjectionRequest): ChatTelegraphProjection {
    const now = asUnixMs(request.now ?? this.clock.now());
    const visibleChannel = this.resolveVisibleChannel(request.fight.visibleChannel, request.fight.channelId);
    const telegraph = request.attack.telegraph;
    const channelProfile = this.getChannelProfile(visibleChannel);
    const openingProfile = this.getOpeningProfile(telegraph.openingMode);
    const severityProfile = this.getSeverityProfile(request.attack.severity);
    const classProfile = this.getAttackClassProfile(request.attack.attackClass);

    const publicExposure01 = this.derivePublicExposure01(request, channelProfile);
    const humiliationRisk01 = this.deriveHumiliationRisk01(request, publicExposure01);
    const pressureStress01 = this.derivePressureStress01(request);
    const rescueNeed01 = this.deriveRescueNeed01(request, humiliationRisk01, pressureStress01);
    const witnessPlan = this.buildWitnessPlan(request, channelProfile, publicExposure01, humiliationRisk01);

    const threatReadability01 = clamp01(
      this.tuning.minimumThreatReadability01
      + classProfile.readabilityBonus01
      + openingProfile.visibilityBias01
      + publicExposure01 * 0.22
      + pressureStress01 * 0.12
      - this.visibilityPenaltyForQuietChannel(visibleChannel),
    );

    const dreadScore01 = clamp01(
      severityProfile.dreadBonus01
      + classProfile.dreadBonus01
      + humiliationRisk01 * 0.28
      + pressureStress01 * 0.14
      + witnessPlan.ridiculeRisk01 * 0.1,
    );

    const fakeOutRisk01 = clamp01(
      severityProfile.fakeOutRisk01
      + openingProfile.fakeOutBias01
      + Number(telegraph.canFakeOut) * 0.14
      + Number(request.attack.opensCounterWindow) * 0.04
      - threatReadability01 * 0.08,
    );

    const helperForeshadow01 = clamp01(
      classProfile.helperForeshadow01
      + this.tuning.helperForeshadowBias01 * 0.33
      + rescueNeed01 * 0.22
      + Number(request.attack.allowsHelperAssistance) * 0.16,
    );

    const leadInMs = this.clampLeadInMs(
      Math.round(
        (channelProfile.baseLeadInMs + telegraph.silenceLeadInMs)
        * openingProfile.leadInMultiplier
        * severityProfile.leadInMultiplier
        * (1 + pressureStress01 * 0.22),
      ),
    );

    const revealDelayMs = this.clampRevealDelayMs(
      Math.round(
        (channelProfile.baseRevealDelayMs + telegraph.revealDelayMs)
        * openingProfile.revealDelayMultiplier
        * severityProfile.revealDelayMultiplier
        * (1 + fakeOutRisk01 * 0.18),
      ),
    );

    const shouldSimulateTyping = telegraph.typingTheaterRecommended || openingProfile.typingBias01 > 0.15;
    const shouldPrimeSilence = openingProfile.silenceBias01 > 0.14 || telegraph.silenceLeadInMs > 0;
    const shouldEchoToThreatRadar = dreadScore01 >= this.tuning.threatRadarEscalationThreshold01;

    const counterHints = this.buildCounterHints(request.attack, request.binding, threatReadability01, dreadScore01);
    const beatSchedule = this.buildBeatSchedule({
      now,
      request,
      telegraph,
      visibleChannel,
      leadInMs,
      revealDelayMs,
      shouldSimulateTyping,
      shouldPrimeSilence,
      helperForeshadow01,
      threatReadability01,
      dreadScore01,
      shouldEchoToThreatRadar,
    });

    const dominantThreatTag = this.deriveDominantThreatTag(request, telegraph, witnessPlan, counterHints);
    const overlayPlan = this.buildOverlayPlan({
      request,
      telegraph,
      threatReadability01,
      dreadScore01,
      fakeOutRisk01,
      rescueNeed01,
      dominantThreatTag,
      counterHints,
      shouldEchoToThreatRadar,
    });

    const debug = Object.freeze({
      causeEventId: request.causeEventId ?? null,
      channelId: request.fight.channelId,
      visibleChannel,
      telegraphId: telegraph.telegraphId,
      publicExposure01,
      humiliationRisk01,
      pressureStress01,
      rescueNeed01,
      threatReadability01,
      dreadScore01,
      fakeOutRisk01,
      helperForeshadow01,
      beatCount: beatSchedule.length,
      dominantThreatTag,
      notes: Object.freeze([...(request.notes ?? []), ...(request.attack.notes ?? [])]),
    } satisfies Record<string, JsonValue>);

    this.logger.debug('chat.telegraph.derived', debug);

    return Object.freeze({
      roomId: request.room.roomId,
      sessionId: request.session.identity.sessionId,
      fightId: String(request.fight.bossFightId),
      roundId: String(request.round.roundId),
      attackId: String(request.attack.attackId),
      telegraph,
      visibleChannel,
      leadInMs,
      revealDelayMs,
      beatSchedule,
      witnessPlan,
      overlayPlan,
      counterHints,
      threatReadability01,
      dreadScore01,
      fakeOutRisk01,
      helperForeshadow01,
      shouldSimulateTyping,
      shouldPrimeSilence,
      shouldEchoToThreatRadar,
      dominantThreatTag,
      debug,
    });
  }

  public deriveOverlayPlan(request: ChatTelegraphProjectionRequest): ChatTelegraphOverlayPlan {
    return this.deriveProjection(request).overlayPlan;
  }

  public deriveBeatSchedule(request: ChatTelegraphProjectionRequest): readonly ChatTelegraphBeat[] {
    return this.deriveProjection(request).beatSchedule;
  }

  private buildBeatSchedule(input: {
    readonly now: UnixMs;
    readonly request: ChatTelegraphProjectionRequest;
    readonly telegraph: ChatBossTelegraph;
    readonly visibleChannel: ChatVisibleChannel;
    readonly leadInMs: number;
    readonly revealDelayMs: number;
    readonly shouldSimulateTyping: boolean;
    readonly shouldPrimeSilence: boolean;
    readonly helperForeshadow01: Score01;
    readonly threatReadability01: Score01;
    readonly dreadScore01: Score01;
    readonly shouldEchoToThreatRadar: boolean;
  }): readonly ChatTelegraphBeat[] {
    const beats: ChatTelegraphBeat[] = [];
    const baseStart = input.now;
    let cursor = baseStart;

    if (input.shouldPrimeSilence) {
      const silenceDuration = Math.max(80, Math.round(input.leadInMs * 0.34));
      beats.push(
        this.createBeat(
          'SILENCE',
          'Pressure hangs without text.',
          cursor,
          cursor + silenceDuration,
          false,
          input.request.fight.channelId,
          clamp01(0.31 + input.dreadScore01 * 0.25),
          ['Silence intentionally primes the player before visible language appears.'],
        ),
      );
      cursor = asUnixMs(cursor + silenceDuration);
    }

    if (input.shouldSimulateTyping) {
      const typingDuration = Math.max(120, Math.round(input.leadInMs * 0.28));
      beats.push(
        this.createBeat(
          'TYPING',
          'A rival presence flickers into intent.',
          cursor,
          cursor + typingDuration,
          true,
          input.request.fight.channelId,
          clamp01(0.28 + input.threatReadability01 * 0.32),
          ['Typing theater implies active authorship and sharpens the coming reveal.'],
        ),
      );
      cursor = asUnixMs(cursor + typingDuration);
    }

    if (input.shouldEchoToThreatRadar) {
      const radarDuration = Math.max(60, Math.round(input.revealDelayMs * 0.16));
      beats.push(
        this.createBeat(
          'RADAR',
          'Threat radar spikes before the line lands.',
          cursor,
          cursor + radarDuration,
          true,
          input.request.fight.channelId,
          clamp01(0.22 + input.dreadScore01 * 0.28),
          ['Threat radar should not replace the telegraph; it should corroborate it.'],
        ),
      );
      cursor = asUnixMs(cursor + radarDuration);
    }

    if (input.helperForeshadow01 >= this.tuning.helperForeshadowBias01) {
      const helperDuration = Math.max(70, Math.round(input.leadInMs * 0.14));
      beats.push(
        this.createBeat(
          'HELPER_GHOST',
          'A helper presence hovers but does not yet intervene.',
          cursor,
          cursor + helperDuration,
          false,
          input.request.fight.channelId,
          clamp01(0.19 + input.helperForeshadow01 * 0.41),
          ['Helper foreshadowing signals care without collapsing pressure.'],
        ),
      );
      cursor = asUnixMs(cursor + helperDuration);
    }

    const crowdDuration = Math.max(60, Math.round(input.revealDelayMs * 0.12));
    beats.push(
      this.createBeat(
        'CROWD_SHIFT',
        this.describeCrowdShift(input.visibleChannel, input.dreadScore01),
        cursor,
        cursor + crowdDuration,
        (input.visibleChannel as string) !== 'DIRECT',
        input.request.fight.channelId,
        clamp01(0.18 + input.dreadScore01 * 0.29),
        ['Crowd shift expresses witness behavior before the attack text resolves.'],
      ),
    );
    cursor = asUnixMs(cursor + crowdDuration);

    const warningDuration = Math.max(90, Math.round(input.revealDelayMs * 0.23));
    beats.push(
      this.createBeat(
        'VISIBLE_WARNING',
        this.describeWarningLabel(input.telegraph, input.visibleChannel),
        cursor,
        cursor + warningDuration,
        input.telegraph.visibleToPlayer,
        input.request.fight.channelId,
        clamp01(0.33 + input.threatReadability01 * 0.34),
        ['Visible warnings should feel like mounting inevitability, not UI spam.'],
      ),
    );
    cursor = asUnixMs(cursor + warningDuration);

    if (input.request.binding) {
      const windowDuration = Math.max(50, Math.round(input.revealDelayMs * 0.08));
      beats.push(
        this.createBeat(
          'WINDOW_OPEN',
          'The counter window is about to become live.',
          cursor,
          cursor + windowDuration,
          true,
          input.request.fight.channelId,
          clamp01(0.29 + input.threatReadability01 * 0.31),
          ['Window-open beats communicate agency without giving away the entire attack.'],
        ),
      );
      cursor = asUnixMs(cursor + windowDuration);
    }

    beats.push(
      this.createBeat(
        'ATTACK_REVEAL',
        `Attack reveals: ${input.request.attack.label}`,
        cursor,
        cursor + Math.max(45, Math.round(input.revealDelayMs * 0.06)),
        true,
        input.request.fight.channelId,
        clamp01(0.44 + input.dreadScore01 * 0.34),
        ['Final beat collapses suspense into actionable threat recognition.'],
      ),
    );

    return Object.freeze(beats.slice(0, this.tuning.maximumBeats));
  }

  private buildWitnessPlan(
    request: ChatTelegraphProjectionRequest,
    channelProfile: ReturnType<ChatTelegraphPolicy['getChannelProfile']>,
    publicExposure01: Score01,
    humiliationRisk01: Score01,
  ): ChatTelegraphWitnessPlan {
    const whisperRisk01 = clamp01(channelProfile.whisperBias01 + publicExposure01 * 0.18);
    const hypeRisk01 = clamp01(channelProfile.hypeBias01 + publicExposure01 * 0.21);
    const ridiculeRisk01 = clamp01(channelProfile.ridiculeBias01 + humiliationRisk01 * 0.33);
    const syndicateLeakRisk01 = clamp01(
      Number(request.fight.visibleChannel === 'SYNDICATE') * 0.18
      + Number((request.attack.attackClass as string) === 'NEGOTIATION') * 0.16
      + publicExposure01 * 0.09,
    );
    const recommendedCrowdLineCount = Math.max(
      0,
      Math.min(
        4,
        Math.round(
          publicExposure01 * 2.7
          + ridiculeRisk01 * 1.4
          + hypeRisk01 * 0.8,
        ),
      ),
    );

    return Object.freeze({
      audienceExposure01: publicExposure01,
      ridiculeRisk01,
      hypeRisk01,
      whisperRisk01,
      syndicateLeakRisk01,
      recommendedCrowdLineCount,
      notes: Object.freeze([
        'Witness density determines whether the telegraph should feel private, intimate, or stage-like.',
        request.fight.visibleChannel === 'DEAL_ROOM'
          ? 'Deal-room witnesses should feel quiet and predatory.'
          : 'Public witnesses should feel reactive and reputational.',
      ]),
    });
  }

  private buildOverlayPlan(input: {
    readonly request: ChatTelegraphProjectionRequest;
    readonly telegraph: ChatBossTelegraph;
    readonly threatReadability01: Score01;
    readonly dreadScore01: Score01;
    readonly fakeOutRisk01: Score01;
    readonly rescueNeed01: Score01;
    readonly dominantThreatTag: string;
    readonly counterHints: readonly ChatTelegraphCounterHint[];
    readonly shouldEchoToThreatRadar: boolean;
  }): ChatTelegraphOverlayPlan {
    const topHint = input.counterHints[0] ?? null;
    const proofCueVisible = input.counterHints.some((hint) => hint.demand === 'PROOF_REPLY')
      && input.threatReadability01 >= this.tuning.proofHintThreshold01;
    const quoteCueVisible = input.counterHints.some((hint) => hint.demand === 'QUOTE_REPLY')
      && input.threatReadability01 >= this.tuning.quoteHintThreshold01;
    const rescueTone = input.rescueNeed01 >= this.tuning.rescueBannerThreshold01
      ? 'URGENT'
      : input.rescueNeed01 >= clamp01(0.51)
        ? 'STEADY'
        : input.rescueNeed01 >= clamp01(0.34)
          ? 'WATCHFUL'
          : 'NONE';

    return Object.freeze({
      threatRadarVisible: input.shouldEchoToThreatRadar,
      threatRadarThreatTag: input.dominantThreatTag,
      threatRadarSeverityScore: clamp100(42 + input.dreadScore01 * 58),
      momentFlashVisible: input.dreadScore01 >= this.tuning.momentFlashThreshold01,
      momentFlashLabel: this.buildMomentFlashLabel(input.request.attack, input.telegraph),
      counterplayPromptVisible: topHint !== null && input.fakeOutRisk01 < clamp01(0.81),
      proofCueVisible,
      quoteCueVisible,
      rescueBannerVisible: rescueTone !== 'NONE',
      rescueTone,
      notes: Object.freeze([
        'Overlay visibility is a projection recommendation, not a UI command.',
        input.request.fight.visibleChannel === 'DEAL_ROOM'
          ? 'Deal-room overlays should remain quieter than global panic surfacing.'
          : 'Public overlays may be bolder because spectators are part of the scene.',
      ]),
    });
  }

  private buildCounterHints(
    attack: ChatBossAttack,
    binding: ChatBossCounterWindowBinding | null | undefined,
    threatReadability01: Score01,
    dreadScore01: Score01,
  ): readonly ChatTelegraphCounterHint[] {
    const demands = binding?.requiredDemands?.length
      ? binding.requiredDemands
      : attack.counterDemands;

    const hints = demands.map((demand, index) =>
      Object.freeze({
        demand,
        label: this.labelForDemand(demand),
        explanation: this.explanationForDemand(demand, attack),
        urgency01: clamp01(dreadScore01 + (index === 0 ? 0.12 : 0.02) - index * 0.06),
        relevance01: clamp01(threatReadability01 + (attack.counterDemands.includes(demand) ? 0.09 : 0.01)),
        recommendedTiming: binding?.idealTiming ?? attack.preferredCounterTiming,
        notes: Object.freeze([
          'Hints explain what the attack is asking of the defender without prescribing exact text.',
        ]),
      } satisfies ChatTelegraphCounterHint),
    );

    return Object.freeze(
      hints.sort((a, b) => {
        if (b.relevance01 !== a.relevance01) return Number(b.relevance01) - Number(a.relevance01);
        return Number(b.urgency01) - Number(a.urgency01);
      }),
    );
  }

  private resolveVisibleChannel(
    preferred: ChatVisibleChannel,
    fallbackChannelId: ChatChannelId,
  ): ChatVisibleChannel {
    if (preferred && isVisibleChannelId(preferred)) return preferred;
    if (isVisibleChannelId(fallbackChannelId)) return fallbackChannelId;
    return 'GLOBAL';
  }

  private derivePublicExposure01(
    request: ChatTelegraphProjectionRequest,
    channelProfile: ReturnType<ChatTelegraphPolicy['getChannelProfile']>,
  ): Score01 {
    const base =
      Number(request.fight.visibleChannel === 'GLOBAL') * 0.42
      + Number((request.fight.visibleChannel as string) === 'SPECTATOR') * 0.31
      + Number(request.fight.visibleChannel === 'SYNDICATE') * 0.19
      + channelProfile.witnessBonus01 * 0.66;

    const signalBoost = request.signal ? this.estimateSignalPublicity01(request.signal) * 0.21 : 0;
    const roomBoost = this.estimateRoomPublicity01(request.room) * 0.2;
    return clamp01(base + signalBoost + roomBoost + this.tuning.publicWitnessBias01 * 0.1);
  }

  private deriveHumiliationRisk01(
    request: ChatTelegraphProjectionRequest,
    publicExposure01: Score01,
  ): Score01 {
    const base =
      Number((request.attack.attackClass as string) === 'HUMILIATION') * 0.28
      + Number((request.attack.attackClass as string) === 'DOMINANCE') * 0.18
      + Number(request.attack.crowdAmplified) * 0.11
      + Number((request.attack.primaryPunishment as string) === 'PUBLIC_MARK') * 0.15
      + Number((request.attack.primaryPunishment as string) === 'REPUTATION_BLEED') * 0.13;

    return clamp01(base + publicExposure01 * 0.29 + this.estimateAffectFragility01(request.signal) * 0.14);
  }

  private derivePressureStress01(request: ChatTelegraphProjectionRequest): Score01 {
    const pressureTier = this.estimatePressureTier(request.signal);
    switch (pressureTier) {
      case 'CRITICAL':
        return clamp01(0.91);
      case 'HIGH':
        return clamp01(0.76);
      case 'ELEVATED':
        return clamp01(0.58);
      case 'BUILDING':
        return clamp01(0.32);
      case 'NONE':
      default:
        return clamp01(0.18);
    }
  }

  private deriveRescueNeed01(
    request: ChatTelegraphProjectionRequest,
    humiliationRisk01: Score01,
    pressureStress01: Score01,
  ): Score01 {
    return clamp01(
      Number(request.attack.allowsHelperAssistance) * 0.18
      + humiliationRisk01 * 0.31
      + pressureStress01 * 0.23
      + this.estimateAffectFragility01(request.signal) * 0.16,
    );
  }

  private visibilityPenaltyForQuietChannel(visibleChannel: ChatVisibleChannel): number {
    if (visibleChannel === 'DEAL_ROOM' || (visibleChannel as string) === 'DIRECT') {
      return this.tuning.quietChannelVisibilityPenalty01;
    }
    return 0;
  }

  private buildMomentFlashLabel(attack: ChatBossAttack, telegraph: ChatBossTelegraph): string {
    const severity = attack.severity.toLowerCase();
    const klass = attack.attackClass.toLowerCase();
    return `${telegraph.label} / ${klass} / ${severity}`;
  }

  private deriveDominantThreatTag(
    request: ChatTelegraphProjectionRequest,
    telegraph: ChatBossTelegraph,
    witnessPlan: ChatTelegraphWitnessPlan,
    counterHints: readonly ChatTelegraphCounterHint[],
  ): string {
    const leadHint = counterHints[0]?.demand ?? 'TIMING';
    const sceneTag = request.attack.attackClass.toLowerCase();
    if (witnessPlan.ridiculeRisk01 >= clamp01(0.62)) return `ridicule/${sceneTag}/${String(leadHint).toLowerCase()}`;
    if (request.fight.visibleChannel === 'DEAL_ROOM') return `predation/${sceneTag}/${String(leadHint).toLowerCase()}`;
    if (telegraph.canFakeOut) return `misdirect/${sceneTag}/${String(leadHint).toLowerCase()}`;
    return `${sceneTag}/${String(leadHint).toLowerCase()}`;
  }

  private labelForDemand(demand: ChatBossCounterDemand): string {
    return String(demand)
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/(^\w|\s\w)/g, (value) => value.toUpperCase());
  }

  private explanationForDemand(demand: ChatBossCounterDemand, attack: ChatBossAttack): string {
    const fromRegistry = (CHAT_TELEGRAPH_DEMAND_LABELS as Record<string, string>)[String(demand)];
    const contextual =
      demand === 'PROOF_REPLY' && attack.proofWeighted
        ? 'This attack is weighted toward evidence. Unsupported swagger will underperform.'
        : demand === 'QUOTE_REPLY' && attack.quoteWeighted
          ? 'This boss lane rewards callbacks and direct reversals of prior language.'
          : demand === 'SILENCE_REPLY' && attack.allowsSilenceOutplay
            ? 'Deliberate timing may be stronger than instant speech here.'
            : demand === 'NEGOTIATION_REPLY' && attack.allowsNegotiationEscape
              ? 'Terms can be changed; you do not have to accept the hostile frame.'
              : 'Meet the demand with timing, clarity, and authored intent.';
    return `${fromRegistry ?? 'Readable counter demand.'} ${contextual}`;
  }

  private describeCrowdShift(visibleChannel: ChatVisibleChannel, dreadScore01: Score01): string {
    if (visibleChannel === 'DEAL_ROOM') {
      return dreadScore01 >= clamp01(0.6)
        ? 'The room goes quiet in a predatory way.'
        : 'A quiet read passes across the table.';
    }
    if (visibleChannel === 'SYNDICATE') {
      return dreadScore01 >= clamp01(0.58)
        ? 'Insiders lean in as tension tightens.'
        : 'Trusted watchers notice the angle.';
    }
    return dreadScore01 >= clamp01(0.61)
      ? 'The crowd senses blood before the line drops.'
      : 'Spectators catch the incoming pressure.';
  }

  private describeWarningLabel(telegraph: ChatBossTelegraph, visibleChannel: ChatVisibleChannel): string {
    if (visibleChannel === 'DEAL_ROOM') return `${telegraph.label} — terms are shifting.`;
    if ((visibleChannel as string) === 'DIRECT') return `${telegraph.label} — direct pressure incoming.`;
    return `${telegraph.label} — the room can see it forming.`;
  }

  private createBeat(
    kind: ChatTelegraphBeat['kind'],
    label: string,
    startsAt: number,
    endsAt: number,
    visibleToPlayer: boolean,
    recommendedChannelId: ChatChannelId,
    emphasis01: Score01,
    notes: readonly string[],
  ): ChatTelegraphBeat {
    return Object.freeze({
      beatId: `${kind}:${startsAt}:${endsAt}`,
      kind,
      label,
      startsAt: asUnixMs(startsAt),
      endsAt: asUnixMs(Math.max(endsAt, startsAt + 1)),
      visibleToPlayer,
      recommendedChannelId,
      emphasis01,
      notes: Object.freeze([...notes]),
    });
  }

  private clampLeadInMs(value: number): number {
    return Math.max(this.tuning.minimumLeadInMs, Math.min(this.tuning.maximumLeadInMs, value));
  }

  private clampRevealDelayMs(value: number): number {
    return Math.max(this.tuning.minimumRevealDelayMs, Math.min(this.tuning.maximumRevealDelayMs, value));
  }

  private getChannelProfile(channel: ChatVisibleChannel) {
    return TELEGRAPH_CHANNEL_PROFILES[channel] ?? TELEGRAPH_CHANNEL_PROFILES.GLOBAL;
  }

  private getOpeningProfile(mode: ChatBossOpeningMode) {
    return TELEGRAPH_OPENING_MODE_PROFILE[mode] ?? TELEGRAPH_OPENING_MODE_PROFILE.VISIBLE;
  }

  private getSeverityProfile(severity: ChatBossAttackSeverity) {
    return TELEGRAPH_SEVERITY_PROFILE[severity] ?? TELEGRAPH_SEVERITY_PROFILE.MEDIUM;
  }

  private getAttackClassProfile(attackClass: ChatBossAttackClass) {
    return TELEGRAPH_ATTACK_CLASS_PROFILE[attackClass] ?? TELEGRAPH_ATTACK_CLASS_PROFILE.SOCIAL;
  }

  private estimateSignalPublicity01(signal: ChatSignalEnvelope): Score01 {
    const data = signal as unknown as {
      channelId?: string;
      metadata?: Record<string, unknown>;
    };

    const fromChannel =
      data.channelId === 'GLOBAL' ? 0.26 :
      data.channelId === 'SPECTATOR' ? 0.22 :
      data.channelId === 'SYNDICATE' ? 0.15 :
      data.channelId === 'DEAL_ROOM' ? 0.08 : 0.05;

    const metadata = data.metadata ?? {};
    const fromFlags =
      Number(Boolean(metadata['publicWitness'])) * 0.18
      + Number(Boolean(metadata['globalLeak'])) * 0.12
      + Number(Boolean(metadata['proofVisible'])) * 0.07;

    return clamp01(fromChannel + fromFlags);
  }

  private estimateRoomPublicity01(room: ChatRoomState): Score01 {
    const candidate = room as unknown as {
      channelId?: string;
      roomType?: string;
      metadata?: Record<string, unknown>;
    };
    const channelBias =
      candidate.channelId === 'GLOBAL' ? 0.31 :
      candidate.channelId === 'SPECTATOR' ? 0.27 :
      candidate.channelId === 'SYNDICATE' ? 0.14 :
      candidate.channelId === 'DEAL_ROOM' ? 0.06 : 0.08;
    const metadataBias =
      Number(Boolean(candidate.metadata?.['featured'])) * 0.11
      + Number(Boolean(candidate.metadata?.['highTraffic'])) * 0.09;
    return clamp01(channelBias + metadataBias);
  }

  private estimateAffectFragility01(signal: ChatSignalEnvelope | null | undefined): Score01 {
    if (!signal) return clamp01(0.18);
    const payload = signal as unknown as {
      affect?: ChatAffectSnapshot | null;
      metadata?: Record<string, unknown>;
    };
    const affect = payload.affect;
    const metadata = payload.metadata ?? {};
    const affectBias = affect ? this.extractAffectNumerics(affect) : 0.16;
    const metadataBias =
      Number(Boolean(metadata['frustrated'])) * 0.11
      + Number(Boolean(metadata['recentFailure'])) * 0.14
      + Number(Boolean(metadata['tilted'])) * 0.13;
    return clamp01(affectBias + metadataBias);
  }

  private extractAffectNumerics(affect: ChatAffectSnapshot): number {
    const probe = affect as unknown as Record<string, unknown>;
    const values = ['frustration01', 'desperation01', 'confidence01', 'embarrassment01']
      .map((key) => Number(probe[key] ?? 0))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return 0.16;
    const frustration = Number(probe['frustration01'] ?? 0);
    const desperation = Number(probe['desperation01'] ?? 0);
    const embarrassment = Number(probe['embarrassment01'] ?? 0);
    const confidence = Number(probe['confidence01'] ?? 0);
    return clamp01(frustration * 0.34 + desperation * 0.24 + embarrassment * 0.29 + (1 - confidence) * 0.18);
  }

  private estimatePressureTier(signal: ChatSignalEnvelope | null | undefined): PressureTier {
    const probe = signal as unknown as { pressureTier?: PressureTier | null; metadata?: Record<string, unknown> } | null;
    if (probe?.pressureTier) return probe.pressureTier;
    const metadataTier = probe?.metadata?.['pressureTier'];
    if (typeof metadataTier === 'string') return metadataTier as PressureTier;
    return 'BUILDING';
  }
}

export function createChatTelegraphPolicy(
  options: ChatTelegraphPolicyOptions = {},
): ChatTelegraphPolicy {
  return new ChatTelegraphPolicy(options);
}

// ============================================================================
// MARK: Policy registries
// ============================================================================

export const CHAT_TELEGRAPH_WINDOW_SIGNATURES = Object.freeze([
  Object.freeze({
    ordinal: 1,
    signatureId: 'BANKRUPTCY_EXPOSURE',
    dominantThreatTag: 'humiliation',
    openingMode: 'VISIBLE',
    severityHint: 'SEVERE',
    recommendedUse: 'Humiliation-heavy visible read before a public collapse strike.',
    notes: Object.freeze([
      'Use this signature when the telegraph should feel authored rather than generic.',
      'This registry is deterministic and suitable for backend selection and replay.',
    ]),
  }),
  Object.freeze({
    ordinal: 2,
    signatureId: 'SHIELD_BREAK_SWARM',
    dominantThreatTag: 'swarm',
    openingMode: 'VISIBLE',
    severityHint: 'HIGH',
    recommendedUse: 'Crowd-forward shield fracture telegraph with watcher amplification.',
    notes: Object.freeze([
      'Use this signature when the telegraph should feel authored rather than generic.',
      'This registry is deterministic and suitable for backend selection and replay.',
    ]),
  }),
  Object.freeze({
    ordinal: 3,
    signatureId: 'DEAL_ROOM_SQUEEZE',
    dominantThreatTag: 'squeeze',
    openingMode: 'QUIET',
    severityHint: 'HIGH',
    recommendedUse: 'Quiet predatory negotiation squeeze with silence before reveal.',
    notes: Object.freeze([
      'Use this signature when the telegraph should feel authored rather than generic.',
      'This registry is deterministic and suitable for backend selection and replay.',
    ]),
  }),
  Object.freeze({
    ordinal: 4,
    signatureId: 'PROOF_TRAP',
    dominantThreatTag: 'proof',
    openingMode: 'VISIBLE',
    severityHint: 'HIGH',
    recommendedUse: 'Receipts-first trap that rewards evidence or quote defense.',
    notes: Object.freeze([
      'Use this signature when the telegraph should feel authored rather than generic.',
      'This registry is deterministic and suitable for backend selection and replay.',
    ]),
  }),
  Object.freeze({
    ordinal: 5,
    signatureId: 'QUOTE_AMBUSH',
    dominantThreatTag: 'quote',
    openingMode: 'VISIBLE',
    severityHint: 'MEDIUM',
    recommendedUse: 'Callback ambush built around prior boasts and fast reversal windows.',
    notes: Object.freeze([
      'Use this signature when the telegraph should feel authored rather than generic.',
      'This registry is deterministic and suitable for backend selection and replay.',
    ]),
  }),
  Object.freeze({
    ordinal: 6,
    signatureId: 'RIVALRY_ESCALATION',
    dominantThreatTag: 'rivalry',
    openingMode: 'VISIBLE',
    severityHint: 'MEDIUM',
    recommendedUse: 'Relationship-colored boss pressure that personalizes the opening.',
    notes: Object.freeze([
      'Use this signature when the telegraph should feel authored rather than generic.',
      'This registry is deterministic and suitable for backend selection and replay.',
    ]),
  }),
  Object.freeze({
    ordinal: 7,
    signatureId: 'PANIC_MISDIRECT',
    dominantThreatTag: 'misdirect',
    openingMode: 'FAKEOUT',
    severityHint: 'MEDIUM',
    recommendedUse: 'Fast fake-out lane that simulates certainty before a pivot.',
    notes: Object.freeze([
      'Use this signature when the telegraph should feel authored rather than generic.',
      'This registry is deterministic and suitable for backend selection and replay.',
    ]),
  }),
  Object.freeze({
    ordinal: 8,
    signatureId: 'SHADOW_PULL',
    dominantThreatTag: 'shadow',
    openingMode: 'QUIET',
    severityHint: 'LOW',
    recommendedUse: 'Low-visibility shadow setup that should still feel dangerous.',
    notes: Object.freeze([
      'Use this signature when the telegraph should feel authored rather than generic.',
      'This registry is deterministic and suitable for backend selection and replay.',
    ]),
  }),
  Object.freeze({
    ordinal: 9,
    signatureId: 'HELPER_TEST',
    dominantThreatTag: 'rescue',
    openingMode: 'VISIBLE',
    severityHint: 'MEDIUM',
    recommendedUse: 'A telegraph that intentionally leaves rescue space without killing pressure.',
    notes: Object.freeze([
      'Use this signature when the telegraph should feel authored rather than generic.',
      'This registry is deterministic and suitable for backend selection and replay.',
    ]),
  }),
  Object.freeze({
    ordinal: 10,
    signatureId: 'LAST_STAND',
    dominantThreatTag: 'finisher',
    openingMode: 'VISIBLE',
    severityHint: 'SEVERE',
    recommendedUse: 'High-drama final-turn telegraph for comeback or humiliation endings.',
    notes: Object.freeze([
      'Use this signature when the telegraph should feel authored rather than generic.',
      'This registry is deterministic and suitable for backend selection and replay.',
    ]),
  }),
] as const);

export const CHAT_TELEGRAPH_WINDOW_NOTES = Object.freeze([
  'BANKRUPTCY_EXPOSURE: Humiliation-heavy visible read before a public collapse strike.',
  'SHIELD_BREAK_SWARM: Crowd-forward shield fracture telegraph with watcher amplification.',
  'DEAL_ROOM_SQUEEZE: Quiet predatory negotiation squeeze with silence before reveal.',
  'PROOF_TRAP: Receipts-first trap that rewards evidence or quote defense.',
  'QUOTE_AMBUSH: Callback ambush built around prior boasts and fast reversal windows.',
  'RIVALRY_ESCALATION: Relationship-colored boss pressure that personalizes the opening.',
  'PANIC_MISDIRECT: Fast fake-out lane that simulates certainty before a pivot.',
  'SHADOW_PULL: Low-visibility shadow setup that should still feel dangerous.',
  'HELPER_TEST: A telegraph that intentionally leaves rescue space without killing pressure.',
  'LAST_STAND: High-drama final-turn telegraph for comeback or humiliation endings.',
] as const);
