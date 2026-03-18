/**
 * ============================================================================
 * POINT ZERO ONE — CHAT EXPERIENCE INTERRUPT PRIORITY AUTHORITY
 * FILE: pzo-web/src/engines/chat/experience/ChatInterruptPriority.ts
 * VERSION: 2026.03.18
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic interruption authority for the sovereign chat runtime.
 *
 * This file promotes interruption logic out of ad hoc inline scene code and
 * makes it reusable across:
 * - event-driven chat scenes,
 * - helper rescue timing,
 * - hater swarms,
 * - deal-room standoffs,
 * - crowd echo bursts,
 * - delayed reveal preemption,
 * - future backend/server orchestration.
 *
 * The point is not simply "who speaks first." The point is choosing whether a
 * moment should be:
 * - witnessed,
 * - crowded,
 * - interrupted,
 * - isolated,
 * - rescued,
 * - delayed,
 * - or left inside intentional silence.
 *
 * Design laws
 * -----------
 * 1. Interruption must be deterministic from the same inputs.
 * 2. System truth and liveops truth can cut through almost anything.
 * 3. Deal room is not global chat in a suit; it has its own interruption law.
 * 4. Silence is a first-class beat, not an empty fallback.
 * 5. Relationship continuity changes priority; obsession and rescue debt matter.
 * 6. Crowd is strongest under heat, weakest under negotiation pressure.
 * 7. Helpers should feel timely, not spammy.
 * 8. Haters should feel personal, not random.
 * 9. Output must be pure data; runtime execution belongs elsewhere.
 *
 * Long-term authority
 * -------------------
 * Today this file consumes the canonical bridge types from ../types.
 * As the extraction hardens, the law should converge into:
 * - /shared/contracts/chat/ChatMoment.ts
 * - /shared/contracts/chat/ChatScene.ts
 * - /shared/contracts/chat/ChatInterruption.ts
 *
 * ============================================================================
 */

import {
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_ENGINE_CONSTANTS,
} from '../types';

import type {
  ChatActorKind,
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatChannelId,
  ChatChannelMood,
  ChatFeatureSnapshot,
  ChatInterruptPriority,
  ChatInterruptionRule,
  ChatMessageKind,
  ChatMomentType,
  ChatPresenceSnapshot,
  ChatRelationshipState,
  ChatReputationState,
  ChatSceneBeatType,
  ChatScenePlan,
  ChatSilenceDecision,
  ChatTypingSnapshot,
  ChatVisibleChannel,
  Score100,
  UnixMs,
} from '../types';

// ============================================================================
// MARK: Internal helpers
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function score100(value: number): Score100 {
  return Math.round(clamp(value, 0, CHAT_ENGINE_CONSTANTS.audienceHeatMax)) as Score100;
}

function unix(value: number): UnixMs {
  return Math.round(value) as UnixMs;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function pushUnique(list: string[], value?: string): void {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function compareNumbersDesc(a: number, b: number): number {
  return b - a;
}

function compareNumbersAsc(a: number, b: number): number {
  return a - b;
}

function compareStringsAsc(a: string, b: string): number {
  return a.localeCompare(b);
}

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type ChatInterruptSuppressionReason =
  | 'SILENCE_LOCK'
  | 'SCENE_LOCK'
  | 'CHANNEL_MISMATCH'
  | 'LOW_PRIORITY'
  | 'CROWD_SUPPRESSED_BY_NEGOTIATION'
  | 'HELPER_COOLDOWN'
  | 'INVALID_BREAK_ATTEMPT'
  | 'INACTIVE_CHANNEL'
  | 'STALE_CANDIDATE';

export interface ChatInterruptCandidate {
  readonly candidateId: string;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly visibleChannelPreference?: ChatVisibleChannel;
  readonly messageKind: ChatMessageKind;
  readonly momentType?: ChatMomentType;
  readonly sceneBeatType?: ChatSceneBeatType;
  readonly requestedAt: UnixMs;
  readonly naturalDelayMs?: number;
  readonly canBreakSilence?: boolean;
  readonly canInterruptScene?: boolean;
  readonly relationshipCounterpartId?: string;
  readonly relationshipHint?: Pick<
    ChatRelationshipState,
    'counterpartId' | 'counterpartKind' | 'vector' | 'escalationTier'
  >;
  readonly payloadRef?: string;
  readonly tags?: readonly string[];
}

export interface ChatInterruptScoreBreakdown {
  readonly basePriority: number;
  readonly actorBias: number;
  readonly messageBias: number;
  readonly momentBias: number;
  readonly beatBias: number;
  readonly channelBias: number;
  readonly heatBias: number;
  readonly affectBias: number;
  readonly relationshipBias: number;
  readonly reputationBias: number;
  readonly presenceBias: number;
  readonly typingBias: number;
  readonly sceneBias: number;
  readonly silenceBias: number;
  readonly tagBias: number;
  readonly finalScore: number;
}

export interface ChatInterruptRankedCandidate {
  readonly candidate: ChatInterruptCandidate;
  readonly priority: ChatInterruptPriority;
  readonly numericPriority: number;
  readonly score: number;
  readonly scheduledDelayMs: number;
  readonly breaksSilence: boolean;
  readonly canPreemptScene: boolean;
  readonly suppressionReasons: readonly ChatInterruptSuppressionReason[];
  readonly breakdown: ChatInterruptScoreBreakdown;
}

export interface ChatInterruptResolution {
  readonly createdAt: UnixMs;
  readonly primary?: ChatInterruptRankedCandidate;
  readonly queue: readonly ChatInterruptRankedCandidate[];
  readonly suppressed: readonly ChatInterruptRankedCandidate[];
  readonly shouldBreakSilence: boolean;
  readonly shouldCloseComposerWindow: boolean;
  readonly effectiveSceneLock: boolean;
}

export interface ChatInterruptContext {
  readonly now: UnixMs;
  readonly activeChannel: ChatVisibleChannel;
  readonly activeScene?: ChatScenePlan;
  readonly currentSilence?: ChatSilenceDecision;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly affect?: ChatAffectSnapshot;
  readonly audienceHeatByChannel?: Partial<Record<ChatVisibleChannel, ChatAudienceHeat>>;
  readonly channelMoodByChannel?: Partial<Record<ChatChannelId, ChatChannelMood>>;
  readonly reputation?: ChatReputationState;
  readonly relationshipsByCounterpartId?: Partial<Record<string, ChatRelationshipState>>;
  readonly presenceByActorId?: Partial<Record<string, ChatPresenceSnapshot>>;
  readonly typingByActorId?: Partial<Record<string, ChatTypingSnapshot>>;
  readonly maxVisibleInterrupts?: number;
  readonly helperCooldownActive?: boolean;
}

export interface ChatInterruptPriorityProfile {
  readonly actorKindWeights: Readonly<Record<ChatActorKind, number>>;
  readonly messageKindWeights: Readonly<Record<ChatMessageKind, number>>;
  readonly momentWeights: Readonly<Record<ChatMomentType, number>>;
  readonly beatWeights: Readonly<Record<ChatSceneBeatType, number>>;
  readonly priorityThresholds: {
    readonly absolute: number;
    readonly critical: number;
    readonly high: number;
    readonly normal: number;
  };
  readonly channelQuietBias: Readonly<Record<ChatVisibleChannel, number>>;
  readonly baseDelaysMs: Readonly<Record<ChatInterruptPriority, number>>;
}

// ============================================================================
// MARK: Default law tables
// ============================================================================

export const DEFAULT_CHAT_INTERRUPTION_RULES: Readonly<Record<ChatActorKind, ChatInterruptionRule>> = Object.freeze({
  PLAYER: {
    interrupterActorKind: 'PLAYER',
    priority: 'CRITICAL',
    canBreakSilence: true,
    canPreemptCrowd: true,
    canPreemptHelper: false,
    canPreemptDealRoom: true,
  },
  SYSTEM: {
    interrupterActorKind: 'SYSTEM',
    priority: 'ABSOLUTE',
    canBreakSilence: true,
    canPreemptCrowd: true,
    canPreemptHelper: true,
    canPreemptDealRoom: true,
  },
  HATER: {
    interrupterActorKind: 'HATER',
    priority: 'HIGH',
    canBreakSilence: false,
    canPreemptCrowd: true,
    canPreemptHelper: false,
    canPreemptDealRoom: false,
  },
  HELPER: {
    interrupterActorKind: 'HELPER',
    priority: 'HIGH',
    canBreakSilence: true,
    canPreemptCrowd: true,
    canPreemptHelper: false,
    canPreemptDealRoom: false,
  },
  AMBIENT_NPC: {
    interrupterActorKind: 'AMBIENT_NPC',
    priority: 'LOW',
    canBreakSilence: false,
    canPreemptCrowd: false,
    canPreemptHelper: false,
    canPreemptDealRoom: false,
  },
  CROWD: {
    interrupterActorKind: 'CROWD',
    priority: 'NORMAL',
    canBreakSilence: false,
    canPreemptCrowd: false,
    canPreemptHelper: false,
    canPreemptDealRoom: false,
  },
  DEAL_AGENT: {
    interrupterActorKind: 'DEAL_AGENT',
    priority: 'CRITICAL',
    canBreakSilence: true,
    canPreemptCrowd: true,
    canPreemptHelper: true,
    canPreemptDealRoom: true,
  },
  LIVEOPS: {
    interrupterActorKind: 'LIVEOPS',
    priority: 'ABSOLUTE',
    canBreakSilence: true,
    canPreemptCrowd: true,
    canPreemptHelper: true,
    canPreemptDealRoom: true,
  },
});

export const DEFAULT_CHAT_INTERRUPT_PRIORITY_PROFILE: ChatInterruptPriorityProfile = Object.freeze({
  actorKindWeights: Object.freeze({
    PLAYER: 86,
    SYSTEM: 100,
    HATER: 70,
    HELPER: 74,
    AMBIENT_NPC: 38,
    CROWD: 46,
    DEAL_AGENT: 84,
    LIVEOPS: 98,
  }),
  messageKindWeights: Object.freeze({
    PLAYER: 14,
    SYSTEM: 26,
    MARKET_ALERT: 22,
    ACHIEVEMENT: 16,
    BOT_TAUNT: 8,
    BOT_ATTACK: 18,
    SHIELD_EVENT: 22,
    CASCADE_ALERT: 24,
    DEAL_RECAP: 24,
    NPC_AMBIENT: 2,
    HELPER_PROMPT: 10,
    HELPER_RESCUE: 22,
    HATER_TELEGRAPH: 14,
    HATER_PUNISH: 18,
    CROWD_REACTION: 6,
    RELATIONSHIP_CALLBACK: 16,
    QUOTE_CALLBACK: 18,
    NEGOTIATION_OFFER: 26,
    NEGOTIATION_COUNTER: 28,
    LEGEND_MOMENT: 30,
    POST_RUN_RITUAL: 18,
    WORLD_EVENT: 28,
    SYSTEM_SHADOW_MARKER: 12,
  }),
  momentWeights: Object.freeze({
    RUN_START: 16,
    RUN_END: 18,
    PRESSURE_SURGE: 14,
    SHIELD_BREACH: 24,
    CASCADE_TRIGGER: 24,
    CASCADE_BREAK: 18,
    BOT_ATTACK: 20,
    BOT_RETREAT: 10,
    HELPER_RESCUE: 26,
    DEAL_ROOM_STANDOFF: 22,
    SOVEREIGN_APPROACH: 20,
    SOVEREIGN_ACHIEVED: 26,
    LEGEND_MOMENT: 28,
    WORLD_EVENT: 28,
  }),
  beatWeights: Object.freeze({
    SYSTEM_NOTICE: 22,
    HATER_ENTRY: 16,
    CROWD_SWARM: 8,
    HELPER_INTERVENTION: 18,
    PLAYER_REPLY_WINDOW: 14,
    SILENCE: 0,
    REVEAL: 12,
    POST_BEAT_ECHO: 6,
  }),
  priorityThresholds: Object.freeze({
    absolute: 95,
    critical: 82,
    high: 66,
    normal: 45,
  }),
  channelQuietBias: Object.freeze({
    GLOBAL: -2,
    SYNDICATE: 3,
    DEAL_ROOM: 10,
    LOBBY: -4,
  }),
  baseDelaysMs: Object.freeze({
    ABSOLUTE: 0,
    CRITICAL: 35,
    HIGH: 85,
    NORMAL: 160,
    LOW: 280,
  }),
});

// ============================================================================
// MARK: Scoring helpers
// ============================================================================

function priorityToNumeric(priority: ChatInterruptPriority): number {
  switch (priority) {
    case 'ABSOLUTE':
      return 100;
    case 'CRITICAL':
      return 88;
    case 'HIGH':
      return 72;
    case 'NORMAL':
      return 54;
    case 'LOW':
    default:
      return 30;
  }
}

function numericToPriority(
  score: number,
  profile: ChatInterruptPriorityProfile,
): ChatInterruptPriority {
  if (score >= profile.priorityThresholds.absolute) return 'ABSOLUTE';
  if (score >= profile.priorityThresholds.critical) return 'CRITICAL';
  if (score >= profile.priorityThresholds.high) return 'HIGH';
  if (score >= profile.priorityThresholds.normal) return 'NORMAL';
  return 'LOW';
}

function resolveRuleForActor(
  actorKind: ChatActorKind,
  overrides?: Partial<Record<ChatActorKind, Partial<ChatInterruptionRule>>>,
): ChatInterruptionRule {
  const base = DEFAULT_CHAT_INTERRUPTION_RULES[actorKind];
  const patch = overrides?.[actorKind];
  return patch
    ? {
        interrupterActorKind: actorKind,
        priority: patch.priority ?? base.priority,
        canBreakSilence: patch.canBreakSilence ?? base.canBreakSilence,
        canPreemptCrowd: patch.canPreemptCrowd ?? base.canPreemptCrowd,
        canPreemptHelper: patch.canPreemptHelper ?? base.canPreemptHelper,
        canPreemptDealRoom: patch.canPreemptDealRoom ?? base.canPreemptDealRoom,
      }
    : base;
}

function getAudienceHeat(
  context: ChatInterruptContext,
  channelId: ChatChannelId,
): ChatAudienceHeat | undefined {
  if (!context.audienceHeatByChannel) return undefined;
  if (
    channelId !== 'GLOBAL' &&
    channelId !== 'SYNDICATE' &&
    channelId !== 'DEAL_ROOM' &&
    channelId !== 'LOBBY'
  ) {
    return undefined;
  }
  return context.audienceHeatByChannel[channelId];
}

function getChannelMood(
  context: ChatInterruptContext,
  channelId: ChatChannelId,
): ChatChannelMood | undefined {
  return context.channelMoodByChannel?.[channelId];
}

function getRelationship(
  context: ChatInterruptContext,
  candidate: ChatInterruptCandidate,
): ChatRelationshipState | undefined {
  if (candidate.relationshipCounterpartId) {
    const hit = context.relationshipsByCounterpartId?.[candidate.relationshipCounterpartId];
    if (hit) return hit;
  }
  const actorHit = context.relationshipsByCounterpartId?.[candidate.actorId];
  if (actorHit) return actorHit;
  return undefined;
}

function getPresence(
  context: ChatInterruptContext,
  actorId: string,
): ChatPresenceSnapshot | undefined {
  return context.presenceByActorId?.[actorId];
}

function getTyping(
  context: ChatInterruptContext,
  actorId: string,
): ChatTypingSnapshot | undefined {
  return context.typingByActorId?.[actorId];
}

function computeAffectBias(
  candidate: ChatInterruptCandidate,
  affect?: ChatAffectSnapshot,
): number {
  if (!affect) return 0;

  const vector = affect.vector;
  const intimidation = safeNumber(vector.intimidation);
  const frustration = safeNumber(vector.frustration);
  const desperation = safeNumber(vector.desperation);
  const confidence = safeNumber(vector.confidence);
  const trust = safeNumber(vector.trust);
  const embarrassment = safeNumber(vector.embarrassment);
  const relief = safeNumber(vector.relief);

  switch (candidate.actorKind) {
    case 'HELPER':
      return Math.round((desperation + frustration + intimidation + trust - relief) / 28);
    case 'HATER':
      return Math.round((confidence + embarrassment + intimidation) / 34);
    case 'CROWD':
      return Math.round((embarrassment + confidence) / 40);
    case 'DEAL_AGENT':
      return Math.round((confidence + desperation + frustration) / 36);
    case 'SYSTEM':
    case 'LIVEOPS':
      return Math.round((desperation + intimidation) / 48);
    default:
      return 0;
  }
}

function computeRelationshipBias(
  candidate: ChatInterruptCandidate,
  relationship?: ChatRelationshipState,
): number {
  const hint = candidate.relationshipHint;
  const vector = relationship?.vector ?? hint?.vector;
  const escalationTier = relationship?.escalationTier ?? hint?.escalationTier;

  if (!vector) return 0;

  const rivalry = safeNumber(vector.rivalryIntensity);
  const rescueDebt = safeNumber(vector.rescueDebt);
  const trust = safeNumber(vector.trust);
  const contempt = safeNumber(vector.contempt);
  const fascination = safeNumber(vector.fascination);

  let total = 0;

  if (candidate.actorKind === 'HATER') {
    total += Math.round((rivalry + contempt + fascination) / 18);
    if (escalationTier === 'ACTIVE') total += 5;
    if (escalationTier === 'OBSESSIVE') total += 10;
  }

  if (candidate.actorKind === 'HELPER') {
    total += Math.round((rescueDebt + trust + fascination) / 22);
    if (escalationTier === 'ACTIVE') total += 3;
  }

  if (candidate.actorKind === 'DEAL_AGENT') {
    total += Math.round((rivalry + fascination + trust) / 28);
  }

  return total;
}

function computeHeatBias(
  candidate: ChatInterruptCandidate,
  audienceHeat?: ChatAudienceHeat,
): number {
  if (!audienceHeat) return 0;

  const heat = safeNumber(audienceHeat.heat);
  const hype = safeNumber(audienceHeat.hype);
  const ridicule = safeNumber(audienceHeat.ridicule);
  const scrutiny = safeNumber(audienceHeat.scrutiny);
  const volatility = safeNumber(audienceHeat.volatility);

  switch (candidate.actorKind) {
    case 'CROWD':
      return Math.round((heat + hype + ridicule + volatility) / 18);
    case 'HATER':
      return Math.round((heat + scrutiny + volatility) / 24);
    case 'HELPER':
      return Math.round((scrutiny - ridicule) / 26);
    case 'DEAL_AGENT':
      return Math.round((scrutiny + volatility) / 28);
    default:
      return 0;
  }
}

function computeReputationBias(
  candidate: ChatInterruptCandidate,
  reputation?: ChatReputationState,
): number {
  if (!reputation) return 0;

  const publicAura = safeNumber(reputation.publicAura);
  const syndicateCredibility = safeNumber(reputation.syndicateCredibility);
  const negotiationFear = safeNumber(reputation.negotiationFear);
  const comebackRespect = safeNumber(reputation.comebackRespect);
  const humiliationRisk = safeNumber(reputation.humiliationRisk);

  switch (candidate.channelId) {
    case 'GLOBAL':
      return Math.round((publicAura + comebackRespect + humiliationRisk) / 34);
    case 'SYNDICATE':
      return Math.round((syndicateCredibility + comebackRespect) / 28);
    case 'DEAL_ROOM':
      return Math.round((negotiationFear + humiliationRisk) / 24);
    default:
      return 0;
  }
}

function computePresenceBias(
  candidate: ChatInterruptCandidate,
  presence?: ChatPresenceSnapshot,
): number {
  if (!presence) return -4;
  if (presence.channelId !== candidate.channelId) return -3;

  switch (presence.presence) {
    case 'ACTIVE':
      return 8;
    case 'READING':
    case 'THINKING':
      return 5;
    case 'WATCHING':
    case 'LURKING':
      return 3;
    case 'ONLINE':
      return 1;
    case 'OFFLINE':
    default:
      return -6;
  }
}

function computeTypingBias(
  candidate: ChatInterruptCandidate,
  typing?: ChatTypingSnapshot,
): number {
  if (!typing) return 0;
  if (typing.channelId !== candidate.channelId) return -1;

  switch (typing.typingState) {
    case 'STARTED':
    case 'SIMULATED':
      return 6;
    case 'PAUSED':
      return 2;
    case 'STOPPED':
      return -2;
    case 'NOT_TYPING':
    default:
      return 0;
  }
}

function computeSceneBias(
  candidate: ChatInterruptCandidate,
  activeScene?: ChatScenePlan,
): number {
  if (!activeScene) return 0;

  let score = 0;

  if (activeScene.primaryChannel === candidate.channelId) score += 8;
  if (activeScene.momentType === candidate.momentType) score += 10;

  const matchingBeat = activeScene.beats.find((beat) => {
    if (candidate.sceneBeatType && beat.beatType === candidate.sceneBeatType) return true;
    if (!candidate.sceneBeatType) return false;
    return false;
  });

  if (matchingBeat) {
    score += matchingBeat.canInterrupt ? 8 : 3;
    if (!matchingBeat.skippable) score += 4;
  }

  if (!candidate.canInterruptScene && activeScene.primaryChannel === candidate.channelId) {
    score -= 8;
  }

  return score;
}

function computeBeatBias(
  candidate: ChatInterruptCandidate,
  profile: ChatInterruptPriorityProfile,
): number {
  if (!candidate.sceneBeatType) return 0;
  return profile.beatWeights[candidate.sceneBeatType] ?? 0;
}

function computeMomentBias(
  candidate: ChatInterruptCandidate,
  profile: ChatInterruptPriorityProfile,
): number {
  if (!candidate.momentType) return 0;
  return profile.momentWeights[candidate.momentType] ?? 0;
}

function computeMessageBias(
  candidate: ChatInterruptCandidate,
  profile: ChatInterruptPriorityProfile,
): number {
  return profile.messageKindWeights[candidate.messageKind] ?? 0;
}

function computeActorBias(
  candidate: ChatInterruptCandidate,
  profile: ChatInterruptPriorityProfile,
): number {
  return profile.actorKindWeights[candidate.actorKind] ?? 0;
}

function computeChannelBias(
  candidate: ChatInterruptCandidate,
  context: ChatInterruptContext,
  profile: ChatInterruptPriorityProfile,
  mood?: ChatChannelMood,
): number {
  let score = 0;

  if (candidate.channelId === context.activeChannel) score += 10;
  if (candidate.visibleChannelPreference && candidate.visibleChannelPreference === context.activeChannel) score += 4;

  const descriptor = CHAT_CHANNEL_DESCRIPTORS[candidate.channelId];
  if (!descriptor?.visibleToPlayer && candidate.actorKind !== 'SYSTEM' && candidate.actorKind !== 'LIVEOPS') {
    score -= 12;
  }

  if (
    candidate.channelId === 'GLOBAL' ||
    candidate.channelId === 'SYNDICATE' ||
    candidate.channelId === 'DEAL_ROOM' ||
    candidate.channelId === 'LOBBY'
  ) {
    score += profile.channelQuietBias[candidate.channelId];
  }

  if (mood) {
    switch (mood.mood) {
      case 'PREDATORY':
        if (candidate.actorKind === 'DEAL_AGENT' || candidate.actorKind === 'HATER') score += 8;
        if (candidate.actorKind === 'CROWD') score -= 6;
        break;
      case 'HOSTILE':
        if (candidate.actorKind === 'HATER' || candidate.actorKind === 'SYSTEM') score += 6;
        if (candidate.actorKind === 'HELPER') score += 3;
        break;
      case 'ECSTATIC':
        if (candidate.actorKind === 'CROWD' || candidate.messageKind === 'LEGEND_MOMENT') score += 7;
        break;
      case 'MOURNFUL':
        if (candidate.actorKind === 'HELPER' || candidate.messageKind === 'POST_RUN_RITUAL') score += 6;
        if (candidate.actorKind === 'CROWD') score -= 3;
        break;
      case 'SUSPICIOUS':
        if (candidate.actorKind === 'DEAL_AGENT' || candidate.actorKind === 'AMBIENT_NPC') score += 4;
        break;
      case 'CALM':
      default:
        break;
    }
  }

  return score;
}

function computeSilenceBias(
  candidate: ChatInterruptCandidate,
  rule: ChatInterruptionRule,
  currentSilence?: ChatSilenceDecision,
): {
  readonly score: number;
  readonly suppressionReasons: readonly ChatInterruptSuppressionReason[];
  readonly breaksSilence: boolean;
} {
  if (!currentSilence?.enforced) {
    return {
      score: 0,
      suppressionReasons: [],
      breaksSilence: false,
    };
  }

  const breaksSilence = Boolean(candidate.canBreakSilence || rule.canBreakSilence);
  const reasons: ChatInterruptSuppressionReason[] = [];

  if (!breaksSilence) {
    reasons.push('SILENCE_LOCK');
    return {
      score: -32,
      suppressionReasons: reasons,
      breaksSilence: false,
    };
  }

  switch (currentSilence.reason) {
    case 'NEGOTIATION_PRESSURE':
      return {
        score: candidate.channelId === 'DEAL_ROOM' ? 10 : -8,
        suppressionReasons: reasons,
        breaksSilence: true,
      };
    case 'RESCUE_WAIT':
      return {
        score: candidate.actorKind === 'HELPER' ? 16 : -10,
        suppressionReasons: reasons,
        breaksSilence: true,
      };
    case 'DREAD':
      return {
        score: candidate.actorKind === 'SYSTEM' || candidate.actorKind === 'HATER' ? 8 : -4,
        suppressionReasons: reasons,
        breaksSilence: true,
      };
    case 'READ_THEATER':
      return {
        score: candidate.actorKind === 'DEAL_AGENT' ? 10 : -6,
        suppressionReasons: reasons,
        breaksSilence: true,
      };
    case 'SCENE_COMPOSITION':
      return {
        score: candidate.sceneBeatType === 'REVEAL' || candidate.sceneBeatType === 'HELPER_INTERVENTION' ? 8 : -5,
        suppressionReasons: reasons,
        breaksSilence: true,
      };
    case 'NONE':
    default:
      return {
        score: 0,
        suppressionReasons: reasons,
        breaksSilence: true,
      };
  }
}

function computeTagBias(candidate: ChatInterruptCandidate): number {
  if (!candidate.tags?.length) return 0;

  let score = 0;
  for (const tag of candidate.tags) {
    if (tag === 'legend' || tag === 'prestige') score += 8;
    if (tag === 'rescue' || tag === 'recovery') score += 6;
    if (tag === 'callback' || tag === 'receipt') score += 5;
    if (tag === 'ambient') score -= 4;
    if (tag === 'crowd') score -= 1;
    if (tag === 'deal') score += 4;
    if (tag === 'liveops') score += 9;
  }
  return score;
}

function deriveSuppressionReasons(
  candidate: ChatInterruptCandidate,
  context: ChatInterruptContext,
  rule: ChatInterruptionRule,
): ChatInterruptSuppressionReason[] {
  const reasons: ChatInterruptSuppressionReason[] = [];
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[candidate.channelId];

  if (!descriptor) {
    reasons.push('CHANNEL_MISMATCH');
    return reasons;
  }

  if (!descriptor.visibleToPlayer && candidate.actorKind !== 'SYSTEM' && candidate.actorKind !== 'LIVEOPS') {
    reasons.push('INACTIVE_CHANNEL');
  }

  if (
    context.activeScene &&
    context.activeScene.primaryChannel === candidate.channelId &&
    candidate.canInterruptScene === false
  ) {
    reasons.push('SCENE_LOCK');
  }

  if (
    candidate.actorKind === 'CROWD' &&
    candidate.channelId === 'DEAL_ROOM'
  ) {
    reasons.push('CROWD_SUPPRESSED_BY_NEGOTIATION');
  }

  if (candidate.actorKind === 'HELPER' && context.helperCooldownActive) {
    reasons.push('HELPER_COOLDOWN');
  }

  if (context.currentSilence?.enforced && !candidate.canBreakSilence && !rule.canBreakSilence) {
    reasons.push('INVALID_BREAK_ATTEMPT');
  }

  if ((context.now as number) - (candidate.requestedAt as number) > CHAT_ENGINE_CONSTANTS.sceneSoftTimeoutMs * 2) {
    reasons.push('STALE_CANDIDATE');
  }

  return reasons;
}

function isSuppressed(
  candidate: ChatInterruptRankedCandidate,
): boolean {
  return candidate.suppressionReasons.length > 0 || candidate.score < 16;
}

function scheduledDelayForPriority(
  priority: ChatInterruptPriority,
  candidate: ChatInterruptCandidate,
  context: ChatInterruptContext,
  mood?: ChatChannelMood,
  profile: ChatInterruptPriorityProfile = DEFAULT_CHAT_INTERRUPT_PRIORITY_PROFILE,
): number {
  const base = profile.baseDelaysMs[priority];
  const natural = Math.max(0, Math.round(candidate.naturalDelayMs ?? 0));

  let moodBias = 0;
  if (mood?.mood === 'PREDATORY' && candidate.channelId === 'DEAL_ROOM') moodBias += 60;
  if (mood?.mood === 'HOSTILE' && candidate.actorKind === 'HATER') moodBias -= 20;
  if (mood?.mood === 'ECSTATIC' && candidate.actorKind === 'CROWD') moodBias -= 10;
  if (mood?.mood === 'MOURNFUL' && candidate.messageKind === 'POST_RUN_RITUAL') moodBias += 40;

  let silenceBias = 0;
  if (context.currentSilence?.enforced && !(candidate.canBreakSilence ?? false)) {
    silenceBias += Math.max(90, context.currentSilence.durationMs);
  }

  return Math.max(0, base + natural + moodBias + silenceBias);
}

// ============================================================================
// MARK: Resolver
// ============================================================================

export interface CreateChatInterruptPriorityOptions {
  readonly rules?: Partial<Record<ChatActorKind, Partial<ChatInterruptionRule>>>;
  readonly profile?: Partial<ChatInterruptPriorityProfile>;
}

export class ChatInterruptPriorityEngine {
  private readonly rules?: Partial<Record<ChatActorKind, Partial<ChatInterruptionRule>>>;

  private readonly profile: ChatInterruptPriorityProfile;

  constructor(options: CreateChatInterruptPriorityOptions = {}) {
    this.rules = options.rules;
    this.profile = {
      actorKindWeights: {
        ...DEFAULT_CHAT_INTERRUPT_PRIORITY_PROFILE.actorKindWeights,
        ...(options.profile?.actorKindWeights ?? {}),
      },
      messageKindWeights: {
        ...DEFAULT_CHAT_INTERRUPT_PRIORITY_PROFILE.messageKindWeights,
        ...(options.profile?.messageKindWeights ?? {}),
      },
      momentWeights: {
        ...DEFAULT_CHAT_INTERRUPT_PRIORITY_PROFILE.momentWeights,
        ...(options.profile?.momentWeights ?? {}),
      },
      beatWeights: {
        ...DEFAULT_CHAT_INTERRUPT_PRIORITY_PROFILE.beatWeights,
        ...(options.profile?.beatWeights ?? {}),
      },
      priorityThresholds: {
        ...DEFAULT_CHAT_INTERRUPT_PRIORITY_PROFILE.priorityThresholds,
        ...(options.profile?.priorityThresholds ?? {}),
      },
      channelQuietBias: {
        ...DEFAULT_CHAT_INTERRUPT_PRIORITY_PROFILE.channelQuietBias,
        ...(options.profile?.channelQuietBias ?? {}),
      },
      baseDelaysMs: {
        ...DEFAULT_CHAT_INTERRUPT_PRIORITY_PROFILE.baseDelaysMs,
        ...(options.profile?.baseDelaysMs ?? {}),
      },
    };
  }

  public scoreCandidate(
    candidate: ChatInterruptCandidate,
    context: ChatInterruptContext,
  ): ChatInterruptRankedCandidate {
    const rule = resolveRuleForActor(candidate.actorKind, this.rules);
    const audienceHeat = getAudienceHeat(context, candidate.channelId);
    const mood = getChannelMood(context, candidate.channelId);
    const relationship = getRelationship(context, candidate);
    const presence = getPresence(context, candidate.actorId);
    const typing = getTyping(context, candidate.actorId);

    const basePriority = priorityToNumeric(rule.priority);
    const actorBias = computeActorBias(candidate, this.profile);
    const messageBias = computeMessageBias(candidate, this.profile);
    const momentBias = computeMomentBias(candidate, this.profile);
    const beatBias = computeBeatBias(candidate, this.profile);
    const channelBias = computeChannelBias(candidate, context, this.profile, mood);
    const heatBias = computeHeatBias(candidate, audienceHeat);
    const affectBias = computeAffectBias(candidate, context.affect);
    const relationshipBias = computeRelationshipBias(candidate, relationship);
    const reputationBias = computeReputationBias(candidate, context.reputation);
    const presenceBias = computePresenceBias(candidate, presence);
    const typingBias = computeTypingBias(candidate, typing);
    const sceneBias = computeSceneBias(candidate, context.activeScene);
    const tagBias = computeTagBias(candidate);

    const silenceImpact = computeSilenceBias(candidate, rule, context.currentSilence);

    const suppressionReasons = [
      ...deriveSuppressionReasons(candidate, context, rule),
      ...silenceImpact.suppressionReasons,
    ];

    const finalScore = clamp(
      basePriority +
        actorBias +
        messageBias +
        momentBias +
        beatBias +
        channelBias +
        heatBias +
        affectBias +
        relationshipBias +
        reputationBias +
        presenceBias +
        typingBias +
        sceneBias +
        silenceImpact.score +
        tagBias,
      0,
      100,
    );

    const priority = numericToPriority(finalScore, this.profile);

    return {
      candidate,
      priority,
      numericPriority: priorityToNumeric(priority),
      score: finalScore,
      scheduledDelayMs: scheduledDelayForPriority(priority, candidate, context, mood, this.profile),
      breaksSilence: silenceImpact.breaksSilence,
      canPreemptScene: Boolean(
        candidate.canInterruptScene ??
          (context.activeScene?.primaryChannel === 'DEAL_ROOM'
            ? rule.canPreemptDealRoom
            : candidate.actorKind === 'HELPER'
              ? rule.canPreemptHelper
              : rule.canPreemptCrowd),
      ),
      suppressionReasons,
      breakdown: {
        basePriority,
        actorBias,
        messageBias,
        momentBias,
        beatBias,
        channelBias,
        heatBias,
        affectBias,
        relationshipBias,
        reputationBias,
        presenceBias,
        typingBias,
        sceneBias,
        silenceBias: silenceImpact.score,
        tagBias,
        finalScore,
      },
    };
  }

  public resolve(
    candidates: readonly ChatInterruptCandidate[],
    context: ChatInterruptContext,
  ): ChatInterruptResolution {
    const scored = candidates.map((candidate) => this.scoreCandidate(candidate, context));

    const sorted = [...scored].sort((left, right) => {
      const suppressionOrder = Number(isSuppressed(left)) - Number(isSuppressed(right));
      if (suppressionOrder !== 0) return suppressionOrder;

      const scoreOrder = compareNumbersDesc(left.score, right.score);
      if (scoreOrder !== 0) return scoreOrder;

      const priorityOrder = compareNumbersDesc(left.numericPriority, right.numericPriority);
      if (priorityOrder !== 0) return priorityOrder;

      const delayOrder = compareNumbersAsc(left.scheduledDelayMs, right.scheduledDelayMs);
      if (delayOrder !== 0) return delayOrder;

      const requestedAtOrder = compareNumbersAsc(
        left.candidate.requestedAt as number,
        right.candidate.requestedAt as number,
      );
      if (requestedAtOrder !== 0) return requestedAtOrder;

      return compareStringsAsc(left.candidate.candidateId, right.candidate.candidateId);
    });

    const visibleLimit = Math.max(1, Math.round(context.maxVisibleInterrupts ?? 4));
    const queue: ChatInterruptRankedCandidate[] = [];
    const suppressed: ChatInterruptRankedCandidate[] = [];

    for (const item of sorted) {
      if (isSuppressed(item)) {
        suppressed.push(item);
        continue;
      }
      if (queue.length >= visibleLimit) {
        suppressed.push({
          ...item,
          suppressionReasons: [...item.suppressionReasons, 'LOW_PRIORITY'],
        });
        continue;
      }
      queue.push(item);
    }

    const primary = queue[0];
    const shouldBreakSilence = Boolean(primary?.breaksSilence);
    const shouldCloseComposerWindow = Boolean(
      primary &&
      (primary.candidate.channelId === 'DEAL_ROOM' ||
        primary.candidate.actorKind === 'SYSTEM' ||
        primary.candidate.actorKind === 'LIVEOPS'),
    );

    return {
      createdAt: context.now,
      primary,
      queue,
      suppressed,
      shouldBreakSilence,
      shouldCloseComposerWindow,
      effectiveSceneLock: Boolean(context.activeScene && !primary?.canPreemptScene),
    };
  }
}

// ============================================================================
// MARK: Stateless convenience exports
// ============================================================================

export function createChatInterruptPriorityEngine(
  options: CreateChatInterruptPriorityOptions = {},
): ChatInterruptPriorityEngine {
  return new ChatInterruptPriorityEngine(options);
}

export function rankChatInterruptCandidate(
  candidate: ChatInterruptCandidate,
  context: ChatInterruptContext,
  options: CreateChatInterruptPriorityOptions = {},
): ChatInterruptRankedCandidate {
  return createChatInterruptPriorityEngine(options).scoreCandidate(candidate, context);
}

export function resolveChatInterruptions(
  candidates: readonly ChatInterruptCandidate[],
  context: ChatInterruptContext,
  options: CreateChatInterruptPriorityOptions = {},
): ChatInterruptResolution {
  return createChatInterruptPriorityEngine(options).resolve(candidates, context);
}

export function shouldCandidateBreakSilence(
  candidate: ChatInterruptCandidate,
  context: ChatInterruptContext,
  options: CreateChatInterruptPriorityOptions = {},
): boolean {
  return rankChatInterruptCandidate(candidate, context, options).breaksSilence;
}

export function buildInterruptWindow(
  resolution: ChatInterruptResolution,
  now: UnixMs,
): readonly {
  readonly candidateId: string;
  readonly openAt: UnixMs;
  readonly fireAt: UnixMs;
  readonly closeAt: UnixMs;
  readonly priority: ChatInterruptPriority;
}[] {
  return resolution.queue.map((entry, index) => {
    const openAt = unix((now as number) + index * 15);
    const fireAt = unix((now as number) + entry.scheduledDelayMs);
    const closeAt = unix((fireAt as number) + Math.max(140, 420 - index * 30));
    return {
      candidateId: entry.candidate.candidateId,
      openAt,
      fireAt,
      closeAt,
      priority: entry.priority,
    };
  });
}

export function summarizeInterruptResolution(
  resolution: ChatInterruptResolution,
): {
  readonly primaryCandidateId?: string;
  readonly queuedIds: readonly string[];
  readonly suppressedIds: readonly string[];
  readonly maxScore: Score100;
  readonly shouldBreakSilence: boolean;
} {
  const queuedIds = resolution.queue.map((entry) => entry.candidate.candidateId);
  const suppressedIds = resolution.suppressed.map((entry) => entry.candidate.candidateId);
  const maxScore = score100(resolution.primary?.score ?? 0);

  return {
    primaryCandidateId: resolution.primary?.candidate.candidateId,
    queuedIds,
    suppressedIds,
    maxScore,
    shouldBreakSilence: resolution.shouldBreakSilence,
  };
}

export const CHAT_INTERRUPT_PRIORITY_NAMESPACE = Object.freeze({
  createChatInterruptPriorityEngine,
  rankChatInterruptCandidate,
  resolveChatInterruptions,
  shouldCandidateBreakSilence,
  buildInterruptWindow,
  summarizeInterruptResolution,
  DEFAULT_CHAT_INTERRUPTION_RULES,
  DEFAULT_CHAT_INTERRUPT_PRIORITY_PROFILE,
});
