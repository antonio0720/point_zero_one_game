/**
 * ==========================================================================
 * POINT ZERO ONE — FRONTEND CHAT LEGEND MOMENT DETECTOR
 * FILE: pzo-web/src/engines/chat/rewards/ChatLegendMomentDetector.ts
 * ==========================================================================
 *
 * Purpose
 * -------
 * Detect, score, and materialize prestige-class legend moments from the live
 * frontend chat lane without stealing final authority from backend replay /
 * ledger truth.
 *
 * This file sits between:
 * - /pzo-web/src/engines/chat/ChatEngine.ts
 * - /pzo-web/src/engines/chat/ChatState.ts
 * - /pzo-web/src/engines/chat/ChatSelectors.ts
 * - /pzo-web/src/engines/chat/replay/ChatReplayIndex.ts
 * - /shared/contracts/chat/ChatLegend.ts
 * - /shared/contracts/chat/ChatReward.ts
 *
 * Design doctrine
 * ---------------
 * - Frontend may detect, stage, and celebrate legend moments.
 * - Backend still owns final transcript authority, moderation truth, replay
 *   publication, and permanent reward state.
 * - Detection must remain deterministic, inspectable, and replay-friendly.
 * - A legend is not just a keyword hit. It is pressure + witness + proof +
 *   timing + reversal + channel atmosphere.
 * - Every accepted legend event must be explainable through a score breakdown.
 * - Shadow-origin evidence is allowed, but public reveal must still serialize
 *   into visible artifacts.
 * - This file must preserve the repo's lane split: engine truth in ../types,
 *   dramaturgic archive truth in shared contracts, and render shaping in
 *   LegendPresentationPolicy.ts.
 *
 * What this file owns
 * -------------------
 * - candidate extraction from live messages, scenes, rescue beats, and signals
 * - class scoring against repo-specific gameplay / chat heuristics
 * - witness seeding and replay-link bridging
 * - prestige thresholds and cooldown suppression
 * - legend-event construction via shared contract factories
 * - thin local ledgers for optimistic presentation and telemetry
 *
 * What this file does NOT own
 * ---------------------------
 * - backend ledger persistence
 * - permanent entitlement mutation
 * - chat UI rendering
 * - transport publication
 * - moderation policy truth
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ==========================================================================
 */

import {
  CHAT_LEGEND_CLASSES,
  CHAT_LEGEND_PRESENTATION_SURFACES,
  ChatLegendConstants,
  ChatLegendFactories,
  ChatLegendPredicates,
  ChatLegendScorers,
  DEFAULT_CHAT_LEGEND_POLICY,
  type ChatLegendArtifact,
  type ChatLegendCallbackHook,
  type ChatLegendCeremony,
  type ChatLegendClass,
  type ChatLegendCooldown,
  type ChatLegendEvent,
  type ChatLegendOutcomeTag,
  type ChatLegendPolicy,
  type ChatLegendPresentationPlan,
  type ChatLegendPressureSnapshot,
  type ChatLegendReplayLink,
  type ChatLegendRewardHint,
  type ChatLegendRewardHintPacket,
  type ChatLegendSeverity,
  type ChatLegendTier,
  type ChatLegendTriggerContext,
  type ChatLegendVisibility,
  type ChatLegendWitness,
} from '../../../../../shared/contracts/chat/ChatLegend';
import {
  deriveRewardGrantsFromLegend,
  type ChatRewardClass,
  type ChatRewardGrant,
  type ChatRewardLegendClass,
} from '../../../../../shared/contracts/chat/ChatReward';
import {
  CHAT_MOUNT_PRESETS,
  CHAT_VISIBLE_CHANNELS,
  type ChatAffectSnapshot,
  type ChatAudienceHeat,
  type ChatCounterplayWindow,
  type ChatEngineState,
  type ChatFeatureSnapshot,
  type ChatLegendId,
  type ChatMessage,
  type ChatMessageId,
  type ChatMountTarget,
  type ChatReplayId,
  type ChatRescueDecision,
  type ChatRoomId,
  type ChatScenePlan,
  type ChatSessionId,
  type ChatUpstreamSignal,
  type ChatUserId,
  type ChatVisibleChannel,
  type PressureTier,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';

// ============================================================================
// MARK: Local detector contracts
// ============================================================================

export type LegendDetectionReasonCode =
  | 'MESSAGE_KIND_MATCH'
  | 'MESSAGE_LEGEND_META'
  | 'MESSAGE_PROOF_PRESENT'
  | 'MESSAGE_REPLAY_ELIGIBLE'
  | 'MESSAGE_WORLD_EVENT_ELIGIBLE'
  | 'BODY_COMEBACK_LANGUAGE'
  | 'BODY_COUNTERPLAY_LANGUAGE'
  | 'BODY_RESCUE_LANGUAGE'
  | 'BODY_HUMILIATION_LANGUAGE'
  | 'BODY_SOVEREIGNTY_LANGUAGE'
  | 'BODY_NEGOTIATION_LANGUAGE'
  | 'BODY_CROWD_CONVERSION_LANGUAGE'
  | 'BODY_SHADOW_REVEAL_LANGUAGE'
  | 'PRESSURE_CRITICAL'
  | 'PRESSURE_HIGH'
  | 'SHIELD_DANGER'
  | 'TIME_PRESSURE'
  | 'SCENE_BEAT_SUPPORT'
  | 'SCENE_MOMENT_TYPE'
  | 'COUNTERPLAY_WINDOW_PRESENT'
  | 'RESCUE_DECISION_PRESENT'
  | 'RESCUE_PROTECT_DIGNITY'
  | 'UPSTREAM_SOVEREIGNTY_ACHIEVED'
  | 'UPSTREAM_CASCADE_BREAK'
  | 'UPSTREAM_BOT_RETREAT'
  | 'UPSTREAM_HELPER_RESCUE'
  | 'UPSTREAM_DEAL_PROOF_ISSUED'
  | 'CHANNEL_HEAT_SUPPORT'
  | 'RIDICULE_REVERSAL'
  | 'WITNESS_SUPPORT'
  | 'REPLAY_WITNESS_SUPPORT'
  | 'REPLAY_LEGEND_SUPPORT'
  | 'COOLDOWN_SUPPRESSED'
  | 'DUPLICATE_SUPPRESSED'
  | 'SCORE_BELOW_FLOOR'
  | 'UNKNOWN';

export interface LegendDetectionReason {
  readonly code: LegendDetectionReasonCode;
  readonly weight100: Score100;
  readonly detail: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface LegendWitnessSeed {
  readonly actorId: string;
  readonly role: 'SYSTEM' | 'RIVAL' | 'HELPER' | 'CROWD' | 'DEAL_ROOM' | 'BOSS' | 'SPECTATOR' | 'SELF';
  readonly channelId: ChatVisibleChannel;
  readonly credibility01: Score01;
  readonly excitement01: Score01;
  readonly hostility01: Score01;
  readonly statementHash?: string;
}

export interface LegendReplayEvidence {
  readonly replayId?: ChatReplayId;
  readonly replayKey?: string;
  readonly witnessLines: readonly {
    readonly messageId: ChatMessageId;
    readonly actorId: string;
    readonly body: string;
    readonly channelId: ChatVisibleChannel;
  }[];
  readonly legendEchoIds: readonly ChatLegendId[];
}

export interface LegendCandidateScore {
  readonly class: ChatLegendClass;
  readonly totalScore100: Score100;
  readonly confidence01: Score01;
  readonly accepted: boolean;
  readonly tier?: ChatLegendTier;
  readonly severity?: ChatLegendSeverity;
  readonly reasons: readonly LegendDetectionReason[];
  readonly tags: readonly ChatLegendOutcomeTag[];
  readonly replayEvidence?: LegendReplayEvidence;
}

export interface LegendCandidateEnvelope {
  readonly legendId: ChatLegendId;
  readonly channelId: ChatVisibleChannel;
  readonly class: ChatLegendClass;
  readonly occurredAtMs: UnixMs;
  readonly sourceMessageIds: readonly ChatMessageId[];
  readonly candidate: LegendCandidateScore;
  readonly rewardHints: readonly ChatLegendRewardHint[];
  readonly titleHint: string;
  readonly subtitleHint: string;
  readonly replayEvidence?: LegendReplayEvidence;
}

export interface LegendSuppression {
  readonly legendId: ChatLegendId;
  readonly class: ChatLegendClass;
  readonly key: string;
  readonly suppressedAtMs: UnixMs;
  readonly reason: LegendDetectionReason;
}

export interface LegendAcceptedEvent {
  readonly envelope: LegendCandidateEnvelope;
  readonly event: ChatLegendEvent;
  readonly rewardGrantPreview: readonly ChatRewardGrant[];
}

export interface LegendDetectionResult {
  readonly accepted: readonly LegendAcceptedEvent[];
  readonly rejected: readonly LegendCandidateEnvelope[];
  readonly suppressed: readonly LegendSuppression[];
}

export interface LegendReplayBridge {
  readonly findWitnessLines?(messageIds: readonly ChatMessageId[]): readonly {
    readonly messageId: ChatMessageId;
    readonly actorId: string;
    readonly body: string;
    readonly channelId: ChatVisibleChannel;
  }[];
  readonly findReplayIdForMessage?(messageId: ChatMessageId): ChatReplayId | undefined;
  readonly findLegendEchoIds?(messageIds: readonly ChatMessageId[]): readonly ChatLegendId[];
}

export interface LegendDetectionInput {
  readonly playerUserId: ChatUserId;
  readonly roomId: ChatRoomId;
  readonly sessionId: ChatSessionId;
  readonly mountTarget: ChatMountTarget;
  readonly state: Pick<
    ChatEngineState,
    | 'activeVisibleChannel'
    | 'messagesByChannel'
    | 'audienceHeat'
    | 'affect'
    | 'activeScene'
    | 'currentSilence'
    | 'notifications'
  >;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly recentMessages?: readonly ChatMessage[];
  readonly sourceMessage?: ChatMessage;
  readonly upstreamSignal?: ChatUpstreamSignal;
  readonly rescueDecision?: ChatRescueDecision;
  readonly counterplayWindow?: ChatCounterplayWindow;
  readonly replayBridge?: LegendReplayBridge;
  readonly nowMs?: UnixMs;
}

export interface LegendDetectorSnapshot {
  readonly generatedAtMs: UnixMs;
  readonly acceptedLedgerSize: number;
  readonly suppressionLedgerSize: number;
  readonly cooldownCount: number;
  readonly lastAcceptedLegendId?: ChatLegendId;
  readonly lastAcceptedClass?: ChatLegendClass;
  readonly lastAcceptedAtMs?: UnixMs;
}

export interface LegendDetectorConfig {
  readonly policy: ChatLegendPolicy;
  readonly recentWindowMs: UnixMs;
  readonly recentMessageScanLimit: number;
  readonly duplicateSuppressionMs: UnixMs;
  readonly witnessLineCap: number;
  readonly requireReplayForImmortal: boolean;
  readonly allowShadowOrigin: boolean;
  readonly debug: boolean;
}

interface LegendClassPolicy {
  readonly class: ChatLegendClass;
  readonly minimumScore100: Score100;
  readonly targetHints: readonly string[];
  readonly titleStem: string;
  readonly subtitleStem: string;
  readonly defaultRewardHints: readonly ChatLegendRewardHint[];
  readonly defaultVisibility: ChatLegendVisibility;
  readonly surfacesByMount: Readonly<Record<ChatMountTarget, readonly (typeof CHAT_LEGEND_PRESENTATION_SURFACES)[number][]>>;
}

interface AcceptedLedgerEntry {
  readonly legendId: ChatLegendId;
  readonly class: ChatLegendClass;
  readonly occurredAtMs: UnixMs;
  readonly sourceMessageIds: readonly ChatMessageId[];
  readonly replayId?: ChatReplayId;
  readonly finalScore100: Score100;
}

const DEFAULT_LEGEND_DETECTOR_CONFIG: LegendDetectorConfig = Object.freeze({
  policy: DEFAULT_CHAT_LEGEND_POLICY,
  recentWindowMs: 1000 * 60 * 3 as UnixMs,
  recentMessageScanLimit: 18,
  duplicateSuppressionMs: 1000 * 45 as UnixMs,
  witnessLineCap: 8,
  requireReplayForImmortal: true,
  allowShadowOrigin: true,
  debug: false,
});

const ALL_MOUNTS: readonly ChatMountTarget[] = Object.freeze([
  'BATTLE_HUD',
  'CLUB_UI',
  'EMPIRE_GAME_SCREEN',
  'GAME_BOARD',
  'LEAGUE_UI',
  'LOBBY_SCREEN',
  'PHANTOM_GAME_SCREEN',
  'PREDATOR_GAME_SCREEN',
  'SYNDICATE_GAME_SCREEN',
  'POST_RUN_SUMMARY',
]);

function buildMountSurfaceMap(
  primary: readonly (typeof CHAT_LEGEND_PRESENTATION_SURFACES)[number][],
  battleExtra: readonly (typeof CHAT_LEGEND_PRESENTATION_SURFACES)[number][],
  postRunExtra: readonly (typeof CHAT_LEGEND_PRESENTATION_SURFACES)[number][],
): Readonly<Record<ChatMountTarget, readonly (typeof CHAT_LEGEND_PRESENTATION_SURFACES)[number][]>> {
  return Object.freeze({
    BATTLE_HUD: Object.freeze([...primary, ...battleExtra]),
    CLUB_UI: Object.freeze(primary),
    EMPIRE_GAME_SCREEN: Object.freeze(primary),
    GAME_BOARD: Object.freeze(primary),
    LEAGUE_UI: Object.freeze([...primary, 'LEAGUE_UI']),
    LOBBY_SCREEN: Object.freeze(primary),
    PHANTOM_GAME_SCREEN: Object.freeze(primary),
    PREDATOR_GAME_SCREEN: Object.freeze([...primary, ...battleExtra]),
    SYNDICATE_GAME_SCREEN: Object.freeze(primary),
    POST_RUN_SUMMARY: Object.freeze([...primary, ...postRunExtra]),
  });
}

const LEGEND_CLASS_POLICIES: Readonly<Record<ChatLegendClass, LegendClassPolicy>> = Object.freeze({
  SOVEREIGNTY_UNDER_PRESSURE: {
    class: 'SOVEREIGNTY_UNDER_PRESSURE',
    minimumScore100: 78 as Score100,
    targetHints: Object.freeze(['sovereign', 'freedom', 'threshold', 'under pressure']),
    titleStem: 'Sovereignty Under Pressure',
    subtitleStem: 'The run refused collapse and crossed the line anyway.',
    defaultRewardHints: Object.freeze(['TITLE', 'AURA', 'BADGE', 'REPLAY_VAULT']),
    defaultVisibility: 'CEREMONIAL_BROADCAST',
    surfacesByMount: buildMountSurfaceMap(
      ['CHAT_PANEL', 'MOMENT_FLASH', 'PROOF_CARD', 'SYSTEM_BANNER'],
      ['BATTLE_HUD'],
      ['PROOF_CARD_V2'],
    ),
  },
  PERFECT_COUNTERPLAY: {
    class: 'PERFECT_COUNTERPLAY',
    minimumScore100: 74 as Score100,
    targetHints: Object.freeze(['perfect counter', 'answer window', 'countered', 'read the attack']),
    titleStem: 'Perfect Counterplay',
    subtitleStem: 'Language and timing turned the attack back on its owner.',
    defaultRewardHints: Object.freeze(['BADGE', 'PHRASE', 'PROOF_CARD_SKIN']),
    defaultVisibility: 'PUBLIC',
    surfacesByMount: buildMountSurfaceMap(
      ['CHAT_PANEL', 'MOMENT_FLASH', 'PROOF_CARD'],
      ['BATTLE_HUD', 'COUNTERPLAY_MODAL'],
      ['PROOF_CARD_V2'],
    ),
  },
  HUMILIATING_HATER_REVERSAL: {
    class: 'HUMILIATING_HATER_REVERSAL',
    minimumScore100: 70 as Score100,
    targetHints: Object.freeze(['reversal', 'crowd turned', 'ate that taunt', 'humiliated']),
    titleStem: 'Humiliating Hater Reversal',
    subtitleStem: 'The crowd watched the aggressor lose ownership of the room.',
    defaultRewardHints: Object.freeze(['BADGE', 'EMOJI_SKIN', 'PHRASE']),
    defaultVisibility: 'PUBLIC',
    surfacesByMount: buildMountSurfaceMap(
      ['CHAT_PANEL', 'MOMENT_FLASH'],
      ['BATTLE_HUD'],
      ['PROOF_CARD_V2'],
    ),
  },
  MIRACLE_RESCUE: {
    class: 'MIRACLE_RESCUE',
    minimumScore100: 71 as Score100,
    targetHints: Object.freeze(['rescued', 'saved', 'one-card recovery', 'kept alive']),
    titleStem: 'Miracle Rescue',
    subtitleStem: 'A helper intervention changed the emotional physics of the run.',
    defaultRewardHints: Object.freeze(['TITLE', 'BADGE', 'BANNER_STYLE']),
    defaultVisibility: 'PUBLIC',
    surfacesByMount: buildMountSurfaceMap(
      ['CHAT_PANEL', 'MOMENT_FLASH', 'RESCUE_WINDOW_BANNER'],
      ['BATTLE_HUD'],
      ['PROOF_CARD_V2'],
    ),
  },
  LAST_SECOND_COMEBACK: {
    class: 'LAST_SECOND_COMEBACK',
    minimumScore100: 73 as Score100,
    targetHints: Object.freeze(['last second', 'late reversal', 'from the floor', 'clawed back']),
    titleStem: 'Last-Second Comeback',
    subtitleStem: 'The room prepared a funeral and got a return instead.',
    defaultRewardHints: Object.freeze(['AURA', 'BADGE', 'REPLAY_VAULT']),
    defaultVisibility: 'PUBLIC',
    surfacesByMount: buildMountSurfaceMap(
      ['CHAT_PANEL', 'MOMENT_FLASH', 'PROOF_CARD'],
      ['BATTLE_HUD'],
      ['PROOF_CARD_V2', 'SYSTEM_BANNER'],
    ),
  },
  NEGOTIATION_HEIST: {
    class: 'NEGOTIATION_HEIST',
    minimumScore100: 72 as Score100,
    targetHints: Object.freeze(['stole the deal', 'flipped the offer', 'heist', 'predatory reversal']),
    titleStem: 'Negotiation Heist',
    subtitleStem: 'The deal room became a weapon, then a trophy.',
    defaultRewardHints: Object.freeze(['TITLE', 'PHRASE', 'REPLAY_VAULT']),
    defaultVisibility: 'DEAL_ROOM_ONLY',
    surfacesByMount: buildMountSurfaceMap(
      ['CHAT_PANEL', 'PROOF_CARD'],
      ['COUNTERPLAY_MODAL'],
      ['PROOF_CARD_V2'],
    ),
  },
  WITNESS_CASCADE: {
    class: 'WITNESS_CASCADE',
    minimumScore100: 68 as Score100,
    targetHints: Object.freeze(['everyone saw it', 'witness line', 'cascade of witnesses', 'room erupted']),
    titleStem: 'Witness Cascade',
    subtitleStem: 'One moment multiplied because too many eyes agreed at once.',
    defaultRewardHints: Object.freeze(['BADGE', 'PHRASE']),
    defaultVisibility: 'PUBLIC',
    surfacesByMount: buildMountSurfaceMap(
      ['CHAT_PANEL', 'MOMENT_FLASH'],
      ['BATTLE_HUD'],
      ['PROOF_CARD_V2'],
    ),
  },
  CROWD_CONVERSION: {
    class: 'CROWD_CONVERSION',
    minimumScore100: 69 as Score100,
    targetHints: Object.freeze(['crowd flipped', 'respect shifted', 'room converted', 'swarm changed sides']),
    titleStem: 'Crowd Conversion',
    subtitleStem: 'Public heat stopped ridiculing and started believing.',
    defaultRewardHints: Object.freeze(['AURA', 'BADGE']),
    defaultVisibility: 'PUBLIC',
    surfacesByMount: buildMountSurfaceMap(
      ['CHAT_PANEL', 'MOMENT_FLASH'],
      ['BATTLE_HUD'],
      ['PROOF_CARD_V2'],
    ),
  },
  BOSS_FIGHT_CONTAINMENT: {
    class: 'BOSS_FIGHT_CONTAINMENT',
    minimumScore100: 75 as Score100,
    targetHints: Object.freeze(['contained the boss', 'telegraph read', 'fight contained', 'closed the window']),
    titleStem: 'Boss Fight Containment',
    subtitleStem: 'The telegraphed threat found no opening worth taking.',
    defaultRewardHints: Object.freeze(['BADGE', 'PROOF_CARD_SKIN', 'REPLAY_VAULT']),
    defaultVisibility: 'PUBLIC',
    surfacesByMount: buildMountSurfaceMap(
      ['CHAT_PANEL', 'PROOF_CARD'],
      ['BATTLE_HUD', 'COUNTERPLAY_MODAL'],
      ['PROOF_CARD_V2'],
    ),
  },
  SHADOW_REVEAL_PERFECTION: {
    class: 'SHADOW_REVEAL_PERFECTION',
    minimumScore100: 76 as Score100,
    targetHints: Object.freeze(['shadow reveal', 'hidden thread surfaced', 'invisible state became public', 'perfect reveal']),
    titleStem: 'Shadow Reveal Perfection',
    subtitleStem: 'Invisible hostility turned into a public artifact at exactly the right time.',
    defaultRewardHints: Object.freeze(['TITLE', 'AURA', 'REPLAY_VAULT']),
    defaultVisibility: 'CEREMONIAL_BROADCAST',
    surfacesByMount: buildMountSurfaceMap(
      ['CHAT_PANEL', 'MOMENT_FLASH', 'PROOF_CARD'],
      ['BATTLE_HUD'],
      ['PROOF_CARD_V2', 'SYSTEM_BANNER'],
    ),
  },
});

const CLASS_TITLE_SUFFIX: Readonly<Record<ChatLegendClass, string>> = Object.freeze({
  SOVEREIGNTY_UNDER_PRESSURE: '— Under Pressure',
  PERFECT_COUNTERPLAY: '— Window Closed',
  HUMILIATING_HATER_REVERSAL: '— Reversal Logged',
  MIRACLE_RESCUE: '— Rescue Witnessed',
  LAST_SECOND_COMEBACK: '— The Turn',
  NEGOTIATION_HEIST: '— Deal Taken',
  WITNESS_CASCADE: '— Seen By The Room',
  CROWD_CONVERSION: '— Heat Flipped',
  BOSS_FIGHT_CONTAINMENT: '— Threat Contained',
  SHADOW_REVEAL_PERFECTION: '— Hidden No Longer',
});

const BODY_MATCHERS: Readonly<Record<ChatLegendClass, readonly RegExp[]>> = Object.freeze({
  SOVEREIGNTY_UNDER_PRESSURE: Object.freeze([/sovereign/i, /freedom/i, /crossed the line/i, /held the threshold/i]),
  PERFECT_COUNTERPLAY: Object.freeze([/perfect counter/i, /read the attack/i, /closed the window/i, /countered/i]),
  HUMILIATING_HATER_REVERSAL: Object.freeze([/humiliat/i, /ate that taunt/i, /crowd turned/i, /reversal/i]),
  MIRACLE_RESCUE: Object.freeze([/rescue/i, /saved/i, /kept you alive/i, /one-card recovery/i]),
  LAST_SECOND_COMEBACK: Object.freeze([/comeback/i, /last[- ]second/i, /from the floor/i, /clawed back/i]),
  NEGOTIATION_HEIST: Object.freeze([/heist/i, /stole the deal/i, /flipped the offer/i, /predatory quiet/i]),
  WITNESS_CASCADE: Object.freeze([/everyone saw/i, /the room saw/i, /witness/i, /crowd erupted/i]),
  CROWD_CONVERSION: Object.freeze([/respect shifted/i, /they believe/i, /crowd converted/i, /swarm changed sides/i]),
  BOSS_FIGHT_CONTAINMENT: Object.freeze([/contained/i, /boss/i, /telegraph/i, /no opening/i]),
  SHADOW_REVEAL_PERFECTION: Object.freeze([/shadow/i, /hidden thread/i, /revealed/i, /invisible state/i]),
});

const KIND_TO_PRIMARY_CLASSES: Readonly<Record<string, readonly ChatLegendClass[]>> = Object.freeze({
  LEGEND_MOMENT: Object.freeze(['WITNESS_CASCADE', 'LAST_SECOND_COMEBACK']),
  HELPER_RESCUE: Object.freeze(['MIRACLE_RESCUE', 'LAST_SECOND_COMEBACK']),
  NEGOTIATION_COUNTER: Object.freeze(['NEGOTIATION_HEIST', 'PERFECT_COUNTERPLAY']),
  NEGOTIATION_OFFER: Object.freeze(['NEGOTIATION_HEIST']),
  HATER_PUNISH: Object.freeze(['HUMILIATING_HATER_REVERSAL', 'BOSS_FIGHT_CONTAINMENT']),
  HATER_TELEGRAPH: Object.freeze(['BOSS_FIGHT_CONTAINMENT', 'PERFECT_COUNTERPLAY']),
  CROWD_REACTION: Object.freeze(['WITNESS_CASCADE', 'CROWD_CONVERSION']),
  RELATIONSHIP_CALLBACK: Object.freeze(['WITNESS_CASCADE', 'SHADOW_REVEAL_PERFECTION']),
  QUOTE_CALLBACK: Object.freeze(['HUMILIATING_HATER_REVERSAL', 'SHADOW_REVEAL_PERFECTION']),
  POST_RUN_RITUAL: Object.freeze(['LAST_SECOND_COMEBACK', 'SOVEREIGNTY_UNDER_PRESSURE']),
  WORLD_EVENT: Object.freeze(['WITNESS_CASCADE', 'SHADOW_REVEAL_PERFECTION']),
  BOT_ATTACK: Object.freeze(['BOSS_FIGHT_CONTAINMENT']),
  BOT_TAUNT: Object.freeze(['HUMILIATING_HATER_REVERSAL']),
  ACHIEVEMENT: Object.freeze(['SOVEREIGNTY_UNDER_PRESSURE', 'LAST_SECOND_COMEBACK']),
  SYSTEM: Object.freeze(['WITNESS_CASCADE']),
});

const SIMPLIFIED_LEGEND_META_MAP: Readonly<Record<string, ChatLegendClass>> = Object.freeze({
  COMEBACK: 'LAST_SECOND_COMEBACK',
  COUNTERPLAY: 'PERFECT_COUNTERPLAY',
  MIRACLE_SAVE: 'MIRACLE_RESCUE',
  HUMILIATION: 'HUMILIATING_HATER_REVERSAL',
  SOVEREIGNTY: 'SOVEREIGNTY_UNDER_PRESSURE',
  WITNESS_LINE: 'WITNESS_CASCADE',
});

function clamp100(value: number): Score100 {
  const normalized = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(normalized))) as Score100;
}

function clamp01(value: number): Score01 {
  const normalized = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(1, Number(normalized.toFixed(4)))) as Score01;
}

function toUnixMs(value: number): UnixMs {
  return Math.max(0, Math.floor(value)) as UnixMs;
}

function scoreTo01(score: Score100): Score01 {
  return clamp01(Number(score) / 100);
}

function asLegendId(value: string): ChatLegendId {
  return value as ChatLegendId;
}

function asLegendClass(value: ChatRewardLegendClass): ChatLegendClass {
  return value as ChatLegendClass;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function dedupe<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function uniqueMessageIds(messages: readonly ChatMessage[]): readonly ChatMessageId[] {
  return dedupe(messages.map((message) => message.id));
}

function nowFrom(input?: UnixMs): UnixMs {
  return input ?? (Date.now() as UnixMs);
}

function inferMessageSourceKind(message: ChatMessage): LegendWitnessSeed['role'] {
  if (message.senderId === 'system' || message.kind === 'SYSTEM') {
    return 'SYSTEM';
  }
  if (message.kind === 'HELPER_PROMPT' || message.kind === 'HELPER_RESCUE') {
    return 'HELPER';
  }
  if (message.kind === 'BOT_TAUNT' || message.kind === 'BOT_ATTACK' || message.kind === 'HATER_PUNISH' || message.kind === 'HATER_TELEGRAPH') {
    return 'RIVAL';
  }
  if (message.kind === 'NEGOTIATION_COUNTER' || message.kind === 'NEGOTIATION_OFFER') {
    return 'DEAL_ROOM';
  }
  if (message.kind === 'CROWD_REACTION') {
    return 'CROWD';
  }
  return message.senderId === 'self' ? 'SELF' : 'SPECTATOR';
}

function inferPressureSnapshot(
  affect: ChatAffectSnapshot,
  message?: ChatMessage,
  featureSnapshot?: ChatFeatureSnapshot,
): ChatLegendPressureSnapshot {
  const pressureScore = clamp100(message?.meta?.pressure?.pressureScore ?? featureSnapshot?.haterHeat ?? 0);
  const frustration = clamp100(affect.vector.frustration);
  const confidence = clamp100(affect.vector.confidence);
  const dominance = clamp100(affect.vector.dominance);
  const crowdHeat = clamp100(featureSnapshot?.unreadCount ? Math.min(100, featureSnapshot.unreadCount * 4) : 0);
  const timePressure = clamp100(
    message?.meta?.tick?.tickTier === 'LATE'
      ? 82
      : message?.meta?.tick?.tickTier === 'CRITICAL'
      ? 96
      : featureSnapshot?.dropOffSignals.silenceAfterCollapseMs
      ? Math.min(100, featureSnapshot.dropOffSignals.silenceAfterCollapseMs / 200)
      : 0,
  );
  const shieldDanger = clamp100(
    message?.shieldMeta?.isBreached
      ? 94
      : message?.shieldMeta?.integrity !== undefined && message?.shieldMeta?.maxIntegrity
      ? 100 - Math.round((message.shieldMeta.integrity / Math.max(1, message.shieldMeta.maxIntegrity)) * 100)
      : 0,
  );

  return ChatLegendFactories.normalizeLegendPressureSnapshot({
    intimidation: scoreTo01(clamp100(affect.vector.intimidation)),
    confidence: scoreTo01(confidence),
    frustration: scoreTo01(frustration),
    trust: scoreTo01(clamp100(affect.vector.trust)),
    desperation: scoreTo01(clamp100(affect.vector.desperation)),
    dominance: scoreTo01(dominance),
    crowdHeat: scoreTo01(crowdHeat),
    timePressure: scoreTo01(timePressure),
    shieldDanger: scoreTo01(shieldDanger),
    riskOfCollapse: scoreTo01(clamp100(Math.max(frustration, pressureScore, shieldDanger))),
  });
}

function detectDirectClassHints(message?: ChatMessage, signal?: ChatUpstreamSignal, rescue?: ChatRescueDecision): readonly ChatLegendClass[] {
  const classes: ChatLegendClass[] = [];

  if (message?.legend?.legendClass && SIMPLIFIED_LEGEND_META_MAP[message.legend.legendClass]) {
    classes.push(SIMPLIFIED_LEGEND_META_MAP[message.legend.legendClass]);
  }

  if (message?.kind && KIND_TO_PRIMARY_CLASSES[message.kind]) {
    classes.push(...KIND_TO_PRIMARY_CLASSES[message.kind]);
  }

  if (signal?.signalType === 'SOVEREIGNTY_ACHIEVED') {
    classes.push('SOVEREIGNTY_UNDER_PRESSURE');
  }
  if (signal?.signalType === 'CASCADE_CHAIN_BROKEN') {
    classes.push('LAST_SECOND_COMEBACK');
  }
  if (signal?.signalType === 'BOT_STATE_CHANGED' || signal?.signalType === 'BOT_ATTACK_FIRED') {
    classes.push('BOSS_FIGHT_CONTAINMENT');
  }
  if (signal?.signalType === 'DEAL_PROOF_ISSUED') {
    classes.push('NEGOTIATION_HEIST');
  }
  if (signal?.signalType === 'SHIELD_LAYER_BREACHED') {
    classes.push('LAST_SECOND_COMEBACK', 'MIRACLE_RESCUE');
  }

  if (rescue?.intent === 'PROTECT_DIGNITY') {
    classes.push('MIRACLE_RESCUE', 'HUMILIATING_HATER_REVERSAL');
  } else if (rescue?.intent === 'OFFER_EXIT') {
    classes.push('MIRACLE_RESCUE');
  }

  return dedupe(classes);
}

function matchBodyHints(body: string, className: ChatLegendClass): number {
  const matchers = BODY_MATCHERS[className] ?? [];
  let hits = 0;
  for (const matcher of matchers) {
    if (matcher.test(body)) {
      hits += 1;
    }
  }
  return hits;
}

function inferOutcomeTags(
  className: ChatLegendClass,
  message?: ChatMessage,
  rescue?: ChatRescueDecision,
  counterplayWindow?: ChatCounterplayWindow,
): readonly ChatLegendOutcomeTag[] {
  const tags: ChatLegendOutcomeTag[] = [];
  if (message?.proofHash || message?.proof?.proofHash) {
    tags.push('PROOF_BEARING');
  }
  if (message?.replay?.replayEligible) {
    tags.push('REPLAY_SAFE');
  }
  if (message?.meta?.pressure?.pressureTier === 'CRITICAL' || message?.meta?.pressure?.pressureScore && message.meta.pressure.pressureScore > 80) {
    tags.push('UNDER_PRESSURE');
  }
  if (counterplayWindow) {
    tags.push('COUNTERPLAY_WINDOW');
  }
  if (className === 'MIRACLE_RESCUE') {
    tags.push('RESCUE');
  }
  if (className === 'NEGOTIATION_HEIST') {
    tags.push('NEGOTIATION');
  }
  if (className === 'SOVEREIGNTY_UNDER_PRESSURE') {
    tags.push('SOVEREIGNTY');
  }
  if (message?.channel === 'GLOBAL') {
    tags.push('CROWD_WITNESSED');
  }
  if (rescue && Number(rescue.urgency) >= 80) {
    tags.push('RESCUE');
  }
  return dedupe(tags);
}

function buildBaseReason(code: LegendDetectionReasonCode, weight100: number, detail: string, metadata?: Readonly<Record<string, unknown>>): LegendDetectionReason {
  return Object.freeze({
    code,
    weight100: clamp100(weight100),
    detail,
    metadata,
  });
}

function makeLegendId(className: ChatLegendClass, messageIds: readonly ChatMessageId[], occurredAtMs: UnixMs): ChatLegendId {
  const tail = messageIds.slice(0, 3).join(':') || 'no-message';
  return asLegendId(`legend:${slugify(className)}:${Number(occurredAtMs)}:${slugify(tail)}`);
}

function chooseChannel(input: LegendDetectionInput): ChatVisibleChannel {
  if (input.sourceMessage?.channel) {
    return input.sourceMessage.channel;
  }
  return input.state.activeVisibleChannel;
}

function buildWitnesses(
  nowMs: UnixMs,
  channelId: ChatVisibleChannel,
  recentMessages: readonly ChatMessage[],
  replayEvidence: LegendReplayEvidence | undefined,
): readonly ChatLegendWitness[] {
  const seeds: LegendWitnessSeed[] = [];

  for (const message of recentMessages.slice(-4)) {
    seeds.push({
      actorId: message.senderId,
      role: inferMessageSourceKind(message),
      channelId: message.channel,
      credibility01: clamp01(message.proofHash || message.proof?.proofHash ? 0.82 : 0.58),
      excitement01: clamp01(message.kind === 'CROWD_REACTION' ? 0.92 : 0.66),
      hostility01: clamp01(message.kind === 'BOT_TAUNT' || message.kind === 'HATER_PUNISH' ? 0.82 : 0.14),
      statementHash: message.proofHash ?? message.proof?.proofHash,
    });
  }

  for (const witnessLine of replayEvidence?.witnessLines ?? []) {
    seeds.push({
      actorId: witnessLine.actorId,
      role: 'CROWD',
      channelId: witnessLine.channelId,
      credibility01: clamp01(0.74),
      excitement01: clamp01(0.81),
      hostility01: clamp01(0.22),
    });
  }

  if (seeds.length === 0) {
    seeds.push({
      actorId: 'system',
      role: 'SYSTEM',
      channelId,
      credibility01: clamp01(0.7),
      excitement01: clamp01(0.44),
      hostility01: clamp01(0.05),
    });
  }

  return ChatLegendFactories.normalizeLegendWitnesses(
    seeds.map((seed, index) =>
      ChatLegendFactories.createLegendWitness({
        witnessId: `legend-witness:${seed.actorId}:${Number(nowMs)}:${index}` as never,
        role: seed.role,
        channelId: seed.channelId,
        timestampMs: nowMs,
        credibility: seed.credibility01,
        excitement: seed.excitement01,
        hostility: seed.hostility01,
        statementHash: seed.statementHash,
        metadata: Object.freeze({ actorId: seed.actorId }),
      }),
    ),
  );
}

function buildReplayEvidence(
  input: LegendDetectionInput,
  sourceMessageIds: readonly ChatMessageId[],
): LegendReplayEvidence | undefined {
  const witnessLines = input.replayBridge?.findWitnessLines?.(sourceMessageIds) ?? [];
  const replayId = sourceMessageIds
    .map((messageId) => input.replayBridge?.findReplayIdForMessage?.(messageId))
    .find(Boolean);
  const legendEchoIds = input.replayBridge?.findLegendEchoIds?.(sourceMessageIds) ?? [];

  if (!replayId && witnessLines.length === 0 && legendEchoIds.length === 0) {
    return undefined;
  }

  return Object.freeze({
    replayId,
    replayKey: replayId ? `replay:${String(replayId)}` : undefined,
    witnessLines: Object.freeze(witnessLines.slice(0, DEFAULT_LEGEND_DETECTOR_CONFIG.witnessLineCap)),
    legendEchoIds: Object.freeze(legendEchoIds),
  });
}

function buildProof(
  input: LegendDetectionInput,
  className: ChatLegendClass,
  sourceMessageIds: readonly ChatMessageId[],
  replayEvidence: LegendReplayEvidence | undefined,
  occurredAtMs: UnixMs,
) {
  const proofHashes = dedupe(
    input.recentMessages
      ?.filter((message) => sourceMessageIds.includes(message.id))
      .map((message) => message.proofHash ?? message.proof?.proofHash)
      .filter((value): value is string => Boolean(value)) ?? [],
  );

  const level =
    proofHashes.length >= 2
      ? 'SEALED'
      : proofHashes.length === 1
      ? 'LINKED'
      : replayEvidence?.replayId
      ? 'TRACE'
      : 'NONE';

  return ChatLegendFactories.createLegendProofPacket({
    proofPacketId: `legend-proof:${slugify(className)}:${Number(occurredAtMs)}` as never,
    level,
    proofHashes: Object.freeze(proofHashes as readonly any[]),
    causalMessageIds: sourceMessageIds,
    replayId: replayEvidence?.replayId,
    replayKey: replayEvidence?.replayKey as never,
    recordedAtMs: occurredAtMs,
    integrityScore: clamp01(proofHashes.length >= 1 ? 0.84 : replayEvidence?.replayId ? 0.66 : 0.42),
    metadata: Object.freeze({ sourceCount: sourceMessageIds.length, className }),
  });
}

function buildNarrative(
  classPolicy: LegendClassPolicy,
  message: ChatMessage | undefined,
  channelId: ChatVisibleChannel,
): Partial<ChatLegendEvent['narrative']> {
  const summaryBody = message?.body?.trim() || classPolicy.subtitleStem;
  return Object.freeze({
    opener: `${classPolicy.titleStem} started in ${channelId}.`,
    turningPoint: summaryBody,
    closer: `${classPolicy.titleStem} is now archived as a witnessed chat event.`,
    summary: summaryBody,
    callbackSeed: message?.body?.slice(0, 96) || classPolicy.titleStem,
    archiveLabel: `${classPolicy.titleStem}${CLASS_TITLE_SUFFIX[classPolicy.class]}`,
  });
}

function buildPresentation(
  classPolicy: LegendClassPolicy,
  input: LegendDetectionInput,
  channelId: ChatVisibleChannel,
): Partial<ChatLegendPresentationPlan> {
  const surfaces = classPolicy.surfacesByMount[input.mountTarget] ?? ['CHAT_PANEL'];
  const preset = CHAT_MOUNT_PRESETS[input.mountTarget];

  return Object.freeze({
    primaryChannelId: channelId,
    visibility: classPolicy.defaultVisibility,
    mirroredChannelIds:
      channelId === 'GLOBAL'
        ? ['SYNDICATE']
        : preset.allowedVisibleChannels.includes('GLOBAL')
        ? ['GLOBAL']
        : [],
    surfaces,
    ceremonialDelayMs: classPolicy.defaultVisibility === 'CEREMONIAL_BROADCAST' ? (850 as UnixMs) : (0 as UnixMs),
    useMomentFlash: surfaces.includes('MOMENT_FLASH'),
    useProofCard: surfaces.includes('PROOF_CARD') || surfaces.includes('PROOF_CARD_V2'),
    useBanner: surfaces.includes('SYSTEM_BANNER') || surfaces.includes('RESCUE_WINDOW_BANNER'),
    useAuraPreview: surfaces.includes('MOMENT_FLASH') || surfaces.includes('PROOF_CARD_V2'),
    silenceAfterRevealMs: classPolicy.defaultVisibility === 'CEREMONIAL_BROADCAST' ? (1200 as UnixMs) : (400 as UnixMs),
  });
}

function buildArtifacts(
  classPolicy: LegendClassPolicy,
  label: string,
  description: string,
): readonly ChatLegendArtifact[] {
  const artifactPairs: readonly [ChatLegendArtifact['type'], string, string][] = [
    ['ARCHIVE_ENTRY', label, 'Archive entry created for future callbacks and prestige browsing.'],
    ['MOMENT_FLASH', `${label} Flash`, 'Moment-flash treatment should burst at first reveal.'],
    ['PROOF_CARD', `${label} Proof`, 'Proof card surface should preserve the event as a durable artifact.'],
    ['REWARD_BUNDLE', `${label} Reward`, 'Prestige reward preview derived from the legend class.'],
  ];

  return ChatLegendFactories.normalizeLegendArtifacts(
    artifactPairs.map(([type, artifactLabel, artifactDescription], index) =>
      ChatLegendFactories.createLegendArtifact({
        artifactId: `legend-artifact:${slugify(artifactLabel)}:${index}` as never,
        type,
        label: artifactLabel,
        description: artifactDescription,
        surfaceId: `legend-surface:${slugify(type)}:${index}` as never,
        sortOrder: index,
        unlockHint: classPolicy.defaultRewardHints[Math.min(index, classPolicy.defaultRewardHints.length - 1)] ?? 'BADGE',
        visibleToPlayer: true,
        payload: Object.freeze({ label, description, className: classPolicy.class }),
      }),
    ),
  );
}

function buildCallbacks(
  classPolicy: LegendClassPolicy,
  message: ChatMessage | undefined,
  channelId: ChatVisibleChannel,
): readonly ChatLegendCallbackHook[] {
  const anchorText = message?.body?.slice(0, 140) || classPolicy.titleStem;
  return ChatLegendFactories.normalizeLegendCallbacks([
    ChatLegendFactories.createLegendCallbackHook({
      callbackId: `legend-callback:${slugify(classPolicy.class)}:quote` as never,
      mode: 'QUOTE',
      class: classPolicy.class,
      anchorText,
      priority: 90,
      channelId,
      metadata: Object.freeze({ source: 'frontend-detector' }),
    }),
    ChatLegendFactories.createLegendCallbackHook({
      callbackId: `legend-callback:${slugify(classPolicy.class)}:system-reference` as never,
      mode: 'SYSTEM_REFERENCE',
      class: classPolicy.class,
      anchorText: `${classPolicy.titleStem} remains in archive memory.`,
      priority: 78,
      channelId,
      metadata: Object.freeze({ source: 'frontend-detector' }),
    }),
  ]);
}

function buildCeremony(classPolicy: LegendClassPolicy): Partial<ChatLegendCeremony> | undefined {
  if (classPolicy.defaultVisibility !== 'CEREMONIAL_BROADCAST') {
    return undefined;
  }
  return Object.freeze({
    ceremonyId: `legend-ceremony:${slugify(classPolicy.class)}` as never,
    title: classPolicy.titleStem,
    subtitle: classPolicy.subtitleStem,
    preRevealDelayMs: 850 as UnixMs,
    postRevealSilenceMs: 1250 as UnixMs,
    crowdBeatCount: 2,
    allowInterruptions: false,
    metadata: Object.freeze({ ceremonial: true }),
  });
}

function chooseHintPacket(classPolicy: LegendClassPolicy): Partial<ChatLegendRewardHintPacket> {
  return Object.freeze({
    hints: classPolicy.defaultRewardHints,
    phraseCandidates: Object.freeze([`${classPolicy.titleStem}`, `${classPolicy.titleStem} Witnessed`]),
    badgeCandidates: Object.freeze([`${classPolicy.titleStem} Badge`]),
    auraCandidates: Object.freeze([`${classPolicy.titleStem} Aura`]),
    titleCandidates: Object.freeze([classPolicy.titleStem]),
    metadata: Object.freeze({ className: classPolicy.class }),
  });
}

function evaluateClassScore(
  className: ChatLegendClass,
  input: LegendDetectionInput,
  recentMessages: readonly ChatMessage[],
  replayEvidence: LegendReplayEvidence | undefined,
): LegendCandidateScore {
  const reasons: LegendDetectionReason[] = [];
  let score = 0;

  const sourceMessage = input.sourceMessage;
  const body = sourceMessage?.body ?? recentMessages.map((message) => message.body).join(' ');
  const classPolicy = LEGEND_CLASS_POLICIES[className];

  if (sourceMessage?.kind && (KIND_TO_PRIMARY_CLASSES[sourceMessage.kind] ?? []).includes(className)) {
    reasons.push(buildBaseReason('MESSAGE_KIND_MATCH', 18, `Message kind ${sourceMessage.kind} favors ${className}.`));
    score += 18;
  }

  if (sourceMessage?.legend?.legendClass && SIMPLIFIED_LEGEND_META_MAP[sourceMessage.legend.legendClass] === className) {
    reasons.push(buildBaseReason('MESSAGE_LEGEND_META', 26, 'Message already carries local legend metadata.'));
    score += 26;
  }

  const bodyHits = matchBodyHints(body, className);
  if (bodyHits > 0) {
    const code =
      className === 'LAST_SECOND_COMEBACK'
        ? 'BODY_COMEBACK_LANGUAGE'
        : className === 'PERFECT_COUNTERPLAY'
        ? 'BODY_COUNTERPLAY_LANGUAGE'
        : className === 'MIRACLE_RESCUE'
        ? 'BODY_RESCUE_LANGUAGE'
        : className === 'HUMILIATING_HATER_REVERSAL'
        ? 'BODY_HUMILIATION_LANGUAGE'
        : className === 'SOVEREIGNTY_UNDER_PRESSURE'
        ? 'BODY_SOVEREIGNTY_LANGUAGE'
        : className === 'NEGOTIATION_HEIST'
        ? 'BODY_NEGOTIATION_LANGUAGE'
        : className === 'CROWD_CONVERSION'
        ? 'BODY_CROWD_CONVERSION_LANGUAGE'
        : className === 'SHADOW_REVEAL_PERFECTION'
        ? 'BODY_SHADOW_REVEAL_LANGUAGE'
        : 'UNKNOWN';
    reasons.push(buildBaseReason(code, 8 * bodyHits, `Body carries ${bodyHits} ${className} language hits.`, { bodyHits }));
    score += 8 * bodyHits;
  }

  const pressure = inferPressureSnapshot(input.state.affect, sourceMessage, input.featureSnapshot);
  const pressureFloor = Number(pressure.riskOfCollapse);
  if (pressureFloor >= 0.8) {
    reasons.push(buildBaseReason('PRESSURE_CRITICAL', 18, 'Pressure snapshot is in critical territory.', { pressure }));
    score += 18;
  } else if (pressureFloor >= 0.6) {
    reasons.push(buildBaseReason('PRESSURE_HIGH', 10, 'Pressure snapshot is elevated enough to support prestige.'));
    score += 10;
  }

  if (Number(pressure.shieldDanger) >= 0.7) {
    reasons.push(buildBaseReason('SHIELD_DANGER', 8, 'Shield danger supports dramatic stakes.'));
    score += 8;
  }

  if (Number(pressure.timePressure) >= 0.65) {
    reasons.push(buildBaseReason('TIME_PRESSURE', 8, 'Late-window timing supports legend severity.'));
    score += 8;
  }

  if (sourceMessage?.proofHash || sourceMessage?.proof?.proofHash) {
    reasons.push(buildBaseReason('MESSAGE_PROOF_PRESENT', 14, 'Proof hash present on the source message.'));
    score += 14;
  }

  if (sourceMessage?.replay?.replayEligible) {
    reasons.push(buildBaseReason('MESSAGE_REPLAY_ELIGIBLE', 10, 'Message is already marked replay eligible.'));
    score += 10;
  }

  if (sourceMessage?.replay?.worldEventEligible) {
    reasons.push(buildBaseReason('MESSAGE_WORLD_EVENT_ELIGIBLE', 4, 'World-event eligibility boosts witness significance.'));
    score += 4;
  }

  if (input.rescueDecision) {
    reasons.push(buildBaseReason('RESCUE_DECISION_PRESENT', 9, 'Live rescue decision is attached to the moment.'));
    score += 9;
    if (input.rescueDecision.intent === 'PROTECT_DIGNITY') {
      reasons.push(buildBaseReason('RESCUE_PROTECT_DIGNITY', 8, 'Protect-dignity rescue implies prestige-level emotional timing.'));
      score += 8;
    }
  }

  if (input.counterplayWindow) {
    reasons.push(buildBaseReason('COUNTERPLAY_WINDOW_PRESENT', 12, 'Counterplay window confirms a playable danger frame.'));
    score += 12;
  }

  if (input.state.activeScene) {
    if (input.state.activeScene.momentType === 'HELPER_RESCUE' && className === 'MIRACLE_RESCUE') {
      reasons.push(buildBaseReason('SCENE_MOMENT_TYPE', 12, 'Scene moment type directly supports miracle rescue.'));
      score += 12;
    }
    if (input.state.activeScene.beats.some((beat) => beat.beatType === 'CROWD_SWARM')) {
      reasons.push(buildBaseReason('SCENE_BEAT_SUPPORT', 8, 'Crowd swarm beat increases witness prestige.'));
      score += 8;
    }
  }

  if (input.upstreamSignal?.signalType === 'SOVEREIGNTY_ACHIEVED' && className === 'SOVEREIGNTY_UNDER_PRESSURE') {
    reasons.push(buildBaseReason('UPSTREAM_SOVEREIGNTY_ACHIEVED', 28, 'Upstream signal confirms sovereignty achieved.'));
    score += 28;
  }
  if (input.upstreamSignal?.signalType === 'CASCADE_CHAIN_BROKEN' && className === 'LAST_SECOND_COMEBACK') {
    reasons.push(buildBaseReason('UPSTREAM_CASCADE_BREAK', 18, 'Cascade break maps directly to comeback prestige.'));
    score += 18;
  }
  if ((input.upstreamSignal?.signalType === 'BOT_STATE_CHANGED' || input.upstreamSignal?.signalType === 'BOT_ATTACK_FIRED') && className === 'BOSS_FIGHT_CONTAINMENT') {
    reasons.push(buildBaseReason('UPSTREAM_BOT_RETREAT', 12, 'Boss-state signal supports containment classification.'));
    score += 12;
  }
  if (input.upstreamSignal?.signalType === 'DEAL_PROOF_ISSUED' && className === 'NEGOTIATION_HEIST') {
    reasons.push(buildBaseReason('UPSTREAM_DEAL_PROOF_ISSUED', 18, 'Deal proof issuance strengthens negotiation-heist detection.'));
    score += 18;
  }

  const audience = input.state.audienceHeat[input.state.activeVisibleChannel];
  if (audience) {
    const audienceSupport = Math.round((Number(audience.heat) + Number(audience.volatility)) / 20);
    if (audienceSupport > 0) {
      reasons.push(buildBaseReason('CHANNEL_HEAT_SUPPORT', audienceSupport, 'Audience heat supports a witnessed legend.'));
      score += audienceSupport;
    }
    if (className === 'HUMILIATING_HATER_REVERSAL' && Number(audience.ridicule) >= 60 && Number(audience.hype) >= 50) {
      reasons.push(buildBaseReason('RIDICULE_REVERSAL', 12, 'Ridicule + hype overlap suggests a humiliation reversal.'));
      score += 12;
    }
  }

  if (recentMessages.length >= 3) {
    reasons.push(buildBaseReason('WITNESS_SUPPORT', Math.min(12, recentMessages.length * 2), 'Multiple recent lines give the moment a witness corridor.'));
    score += Math.min(12, recentMessages.length * 2);
  }

  if (replayEvidence?.witnessLines.length) {
    reasons.push(buildBaseReason('REPLAY_WITNESS_SUPPORT', Math.min(12, replayEvidence.witnessLines.length * 2), 'Replay bridge returned witness lines.'));
    score += Math.min(12, replayEvidence.witnessLines.length * 2);
  }

  if (replayEvidence?.legendEchoIds.length) {
    reasons.push(buildBaseReason('REPLAY_LEGEND_SUPPORT', Math.min(8, replayEvidence.legendEchoIds.length * 2), 'Replay bridge found related legend echoes.'));
    score += Math.min(8, replayEvidence.legendEchoIds.length * 2);
  }

  const totalScore100 = clamp100(score);
  const confidence01 = clamp01(score / 100);
  const accepted = Number(totalScore100) >= Number(classPolicy.minimumScore100);

  const tags = inferOutcomeTags(className, sourceMessage, input.rescueDecision, input.counterplayWindow);
  const severity = ChatLegendScorers.classifyLegendSeverity(totalScore100, DEFAULT_CHAT_LEGEND_POLICY.thresholds);
  const tier = ChatLegendScorers.classifyLegendTier(totalScore100, DEFAULT_CHAT_LEGEND_POLICY.thresholds);

  return Object.freeze({
    class: className,
    totalScore100,
    confidence01,
    accepted,
    tier,
    severity,
    reasons: Object.freeze(reasons),
    tags,
    replayEvidence,
  });
}

function buildRewardGrantPreview(
  playerUserId: ChatUserId,
  event: ChatLegendEvent,
  occurredAtMs: UnixMs,
): readonly ChatRewardGrant[] {
  const rewardClass = asLegendClass(event.class as ChatRewardLegendClass);
  return Object.freeze(
    deriveRewardGrantsFromLegend({
      ownerUserId: playerUserId,
      legendId: event.legendId,
      legendClass: rewardClass as ChatRewardLegendClass,
      legendScore100: event.score.finalScore100,
      createdAtMs: occurredAtMs,
    }),
  );
}

function pickRecentMessages(input: LegendDetectionInput): readonly ChatMessage[] {
  if (input.recentMessages && input.recentMessages.length > 0) {
    return Object.freeze(input.recentMessages.slice(-DEFAULT_LEGEND_DETECTOR_CONFIG.recentMessageScanLimit));
  }

  const channel = chooseChannel(input);
  const messages = input.state.messagesByChannel[channel] ?? [];
  return Object.freeze(messages.slice(-DEFAULT_LEGEND_DETECTOR_CONFIG.recentMessageScanLimit));
}

function buildAcceptedEvent(
  input: LegendDetectionInput,
  candidate: LegendCandidateScore,
  recentMessages: readonly ChatMessage[],
): LegendAcceptedEvent {
  const occurredAtMs = nowFrom(input.nowMs);
  const classPolicy = LEGEND_CLASS_POLICIES[candidate.class];
  const channelId = chooseChannel(input);
  const sourceMessageIds = uniqueMessageIds(recentMessages);
  const legendId = makeLegendId(candidate.class, sourceMessageIds, occurredAtMs);
  const replayEvidence = candidate.replayEvidence;
  const proof = buildProof(input, candidate.class, sourceMessageIds, replayEvidence, occurredAtMs);
  const witnesses = buildWitnesses(occurredAtMs, channelId, recentMessages, replayEvidence);

  const trigger: ChatLegendTriggerContext = ChatLegendFactories.createLegendTriggerContext({
    sessionId: input.sessionId,
    roomId: input.roomId,
    playerUserId: input.playerUserId,
    class: candidate.class,
    sourceChannelId: channelId,
    visibleChannelId: channelId,
    runClockMs: occurredAtMs,
    occurredAtMs,
    pressure: inferPressureSnapshot(input.state.affect, input.sourceMessage, input.featureSnapshot),
    tags: candidate.tags,
    metadata: Object.freeze({
      mountTarget: input.mountTarget,
      sourceMessageCount: sourceMessageIds.length,
      upstreamSignal: input.upstreamSignal?.signalType,
      rescueIntent: input.rescueDecision?.intent,
    }),
  });

  const event = ChatLegendFactories.buildChatLegendEvent(
    {
      legendId,
      trigger,
      proof,
      witnesses,
      narrative: buildNarrative(classPolicy, input.sourceMessage, channelId),
      presentation: buildPresentation(classPolicy, input, channelId),
      artifacts: buildArtifacts(classPolicy, classPolicy.titleStem, classPolicy.subtitleStem),
      callbacks: buildCallbacks(classPolicy, input.sourceMessage, channelId),
      replay:
        replayEvidence?.replayId
          ? ChatLegendFactories.createLegendReplayLink({
              replayId: replayEvidence.replayId,
              replayKey: replayEvidence.replayKey as never,
              startMessageId: sourceMessageIds[0],
              endMessageId: sourceMessageIds[sourceMessageIds.length - 1],
              isPublic: classPolicy.defaultVisibility !== 'PRIVATE',
              generatedAtMs: occurredAtMs,
            })
          : undefined,
      ceremony: buildCeremony(classPolicy),
      rewardHintPacket: chooseHintPacket(classPolicy),
      metadata: Object.freeze({
        titleHint: classPolicy.titleStem,
        subtitleHint: classPolicy.subtitleStem,
      }),
    },
    DEFAULT_CHAT_LEGEND_POLICY,
  );

  const envelope: LegendCandidateEnvelope = Object.freeze({
    legendId,
    channelId,
    class: candidate.class,
    occurredAtMs,
    sourceMessageIds,
    candidate,
    rewardHints: classPolicy.defaultRewardHints,
    titleHint: classPolicy.titleStem,
    subtitleHint: classPolicy.subtitleStem,
    replayEvidence,
  });

  return Object.freeze({
    envelope,
    event,
    rewardGrantPreview: buildRewardGrantPreview(input.playerUserId, event, occurredAtMs),
  });
}

// ============================================================================
// MARK: Detector implementation
// ============================================================================

export class ChatLegendMomentDetector {
  private readonly config: LegendDetectorConfig;
  private readonly acceptedLedger = new Map<string, AcceptedLedgerEntry>();
  private readonly suppressionLedger = new Map<string, LegendSuppression>();
  private readonly cooldownByKey = new Map<string, UnixMs>();
  private lastAcceptedLegendId?: ChatLegendId;
  private lastAcceptedClass?: ChatLegendClass;
  private lastAcceptedAtMs?: UnixMs;

  public constructor(config: Partial<LegendDetectorConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_LEGEND_DETECTOR_CONFIG, ...config });
  }

  public detect(input: LegendDetectionInput): LegendDetectionResult {
    const recentMessages = pickRecentMessages(input);
    const replayEvidence = buildReplayEvidence(input, uniqueMessageIds(recentMessages));
    const candidateClasses = dedupe([
      ...CHAT_LEGEND_CLASSES,
      ...detectDirectClassHints(input.sourceMessage, input.upstreamSignal, input.rescueDecision),
    ]);

    const accepted: LegendAcceptedEvent[] = [];
    const rejected: LegendCandidateEnvelope[] = [];
    const suppressed: LegendSuppression[] = [];
    const occurredAtMs = nowFrom(input.nowMs);

    for (const className of candidateClasses) {
      if (!ChatLegendPredicates.isChatLegendClass(className)) {
        continue;
      }

      const candidate = evaluateClassScore(className, input, recentMessages, replayEvidence);
      const legendId = makeLegendId(className, uniqueMessageIds(recentMessages), occurredAtMs);
      const channelId = chooseChannel(input);
      const envelope: LegendCandidateEnvelope = Object.freeze({
        legendId,
        channelId,
        class: className,
        occurredAtMs,
        sourceMessageIds: uniqueMessageIds(recentMessages),
        candidate,
        rewardHints: LEGEND_CLASS_POLICIES[className].defaultRewardHints,
        titleHint: LEGEND_CLASS_POLICIES[className].titleStem,
        subtitleHint: LEGEND_CLASS_POLICIES[className].subtitleStem,
        replayEvidence,
      });

      const suppression = this.getSuppressionIfAny(envelope, occurredAtMs);
      if (suppression) {
        this.suppressionLedger.set(`${suppression.class}:${suppression.key}`, suppression);
        suppressed.push(suppression);
        continue;
      }

      if (!candidate.accepted) {
        rejected.push(envelope);
        continue;
      }

      const acceptedEvent = buildAcceptedEvent(input, candidate, recentMessages);
      accepted.push(acceptedEvent);
      this.recordAccepted(acceptedEvent, occurredAtMs);
    }

    return Object.freeze({
      accepted: Object.freeze(accepted),
      rejected: Object.freeze(rejected),
      suppressed: Object.freeze(suppressed),
    });
  }

  public detectSingleBest(input: LegendDetectionInput): LegendAcceptedEvent | undefined {
    const result = this.detect(input);
    return [...result.accepted].sort((left, right) => Number(right.event.score.finalScore100) - Number(left.event.score.finalScore100))[0];
  }

  public exportSnapshot(generatedAtMs: UnixMs = Date.now() as UnixMs): LegendDetectorSnapshot {
    return Object.freeze({
      generatedAtMs,
      acceptedLedgerSize: this.acceptedLedger.size,
      suppressionLedgerSize: this.suppressionLedger.size,
      cooldownCount: this.cooldownByKey.size,
      lastAcceptedLegendId: this.lastAcceptedLegendId,
      lastAcceptedClass: this.lastAcceptedClass,
      lastAcceptedAtMs: this.lastAcceptedAtMs,
    });
  }

  public listAcceptedLegends(): readonly AcceptedLedgerEntry[] {
    return Object.freeze([...this.acceptedLedger.values()].sort((left, right) => Number(right.occurredAtMs) - Number(left.occurredAtMs)));
  }

  public listSuppressions(): readonly LegendSuppression[] {
    return Object.freeze([...this.suppressionLedger.values()].sort((left, right) => Number(right.suppressedAtMs) - Number(left.suppressedAtMs)));
  }

  public clear(): void {
    this.acceptedLedger.clear();
    this.suppressionLedger.clear();
    this.cooldownByKey.clear();
    this.lastAcceptedLegendId = undefined;
    this.lastAcceptedClass = undefined;
    this.lastAcceptedAtMs = undefined;
  }

  private recordAccepted(result: LegendAcceptedEvent, occurredAtMs: UnixMs): void {
    this.acceptedLedger.set(String(result.event.legendId), Object.freeze({
      legendId: result.event.legendId,
      class: result.event.class,
      occurredAtMs,
      sourceMessageIds: result.envelope.sourceMessageIds,
      replayId: result.event.replay?.replayId,
      finalScore100: result.event.score.finalScore100,
    }));

    const cooldownKey = this.buildCooldownKey(result.envelope.class, result.envelope.channelId, result.envelope.sourceMessageIds);
    this.cooldownByKey.set(cooldownKey, occurredAtMs);
    this.lastAcceptedLegendId = result.event.legendId;
    this.lastAcceptedClass = result.event.class;
    this.lastAcceptedAtMs = occurredAtMs;
  }

  private getSuppressionIfAny(envelope: LegendCandidateEnvelope, nowMs: UnixMs): LegendSuppression | undefined {
    const duplicateKey = this.buildCooldownKey(envelope.class, envelope.channelId, envelope.sourceMessageIds);
    const cooldownStartedAt = this.cooldownByKey.get(duplicateKey);
    if (cooldownStartedAt !== undefined && Number(nowMs) - Number(cooldownStartedAt) < Number(this.config.duplicateSuppressionMs)) {
      return Object.freeze({
        legendId: envelope.legendId,
        class: envelope.class,
        key: duplicateKey,
        suppressedAtMs: nowMs,
        reason: buildBaseReason('COOLDOWN_SUPPRESSED', 100, 'Class/channel/message cooldown still active.', {
          cooldownStartedAt,
          cooldownMs: this.config.duplicateSuppressionMs,
        }),
      });
    }

    const duplicate = [...this.acceptedLedger.values()].find((entry) =>
      entry.class === envelope.class && entry.sourceMessageIds.some((id) => envelope.sourceMessageIds.includes(id)),
    );
    if (duplicate) {
      return Object.freeze({
        legendId: envelope.legendId,
        class: envelope.class,
        key: `duplicate:${String(duplicate.legendId)}`,
        suppressedAtMs: nowMs,
        reason: buildBaseReason('DUPLICATE_SUPPRESSED', 100, 'Accepted legend already references at least one source message.', {
          existingLegendId: duplicate.legendId,
        }),
      });
    }

    if (Number(envelope.candidate.totalScore100) < Number(LEGEND_CLASS_POLICIES[envelope.class].minimumScore100)) {
      return undefined;
    }

    if (this.config.requireReplayForImmortal && envelope.candidate.tier === 'IMMORTAL' && !envelope.replayEvidence?.replayId) {
      return Object.freeze({
        legendId: envelope.legendId,
        class: envelope.class,
        key: `immortal-without-replay:${String(envelope.legendId)}`,
        suppressedAtMs: nowMs,
        reason: buildBaseReason('SCORE_BELOW_FLOOR', 80, 'Immortal-class frontend celebration is blocked until replay evidence exists.'),
      });
    }

    return undefined;
  }

  private buildCooldownKey(
    className: ChatLegendClass,
    channelId: ChatVisibleChannel,
    messageIds: readonly ChatMessageId[],
  ): string {
    return `${className}:${channelId}:${messageIds.slice(0, 3).join('|')}`;
  }
}

// ============================================================================
// MARK: Factory helpers
// ============================================================================

export function createChatLegendMomentDetector(
  config: Partial<LegendDetectorConfig> = {},
): ChatLegendMomentDetector {
  return new ChatLegendMomentDetector(config);
}

export function detectLegendMoment(
  input: LegendDetectionInput,
  config: Partial<LegendDetectorConfig> = {},
): LegendDetectionResult {
  return createChatLegendMomentDetector(config).detect(input);
}

export function detectSingleLegendMoment(
  input: LegendDetectionInput,
  config: Partial<LegendDetectorConfig> = {},
): LegendAcceptedEvent | undefined {
  return createChatLegendMomentDetector(config).detectSingleBest(input);
}

// ============================================================================
// MARK: Module manifest
// ============================================================================

export const CHAT_LEGEND_MOMENT_DETECTOR_MODULE_NAME = 'PZO_CHAT_LEGEND_MOMENT_DETECTOR' as const;

export const CHAT_LEGEND_MOMENT_DETECTOR_MANIFEST = Object.freeze({
  moduleName: CHAT_LEGEND_MOMENT_DETECTOR_MODULE_NAME,
  version: '1.0.0',
  path: '/pzo-web/src/engines/chat/rewards/ChatLegendMomentDetector.ts',
  authorities: Object.freeze({
    frontendEngineRoot: '/pzo-web/src/engines/chat',
    frontendRewardsRoot: '/pzo-web/src/engines/chat/rewards',
    sharedLegendContract: '/shared/contracts/chat/ChatLegend.ts',
    sharedRewardContract: '/shared/contracts/chat/ChatReward.ts',
    replayIndex: '/pzo-web/src/engines/chat/replay/ChatReplayIndex.ts',
    componentsUiTypes: '/pzo-web/src/components/chat/uiTypes.ts',
  }),
  owns: Object.freeze([
    'legend candidate extraction',
    'legend class scoring',
    'legend witness seeding',
    'frontend legend cooldown suppression',
    'optimistic prestige event construction',
    'shared-contract legend event emission',
  ] as const),
  dependsOn: Object.freeze([
    '../types',
    '../ChatEngine',
    '../ChatState',
    '../ChatSelectors',
    '../replay/ChatReplayIndex',
    '../../../../../shared/contracts/chat/ChatLegend',
    '../../../../../shared/contracts/chat/ChatReward',
  ] as const),
} as const);

export const ChatLegendMomentDetectorModule = Object.freeze({
  moduleName: CHAT_LEGEND_MOMENT_DETECTOR_MODULE_NAME,
  manifest: CHAT_LEGEND_MOMENT_DETECTOR_MANIFEST,
  defaults: DEFAULT_LEGEND_DETECTOR_CONFIG,
  policies: LEGEND_CLASS_POLICIES,
  createChatLegendMomentDetector,
  detectLegendMoment,
  detectSingleLegendMoment,
  ChatLegendMomentDetector,
} as const);
