/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT CONTINUITY / CARRYOVER SCENE STATE
 * FILE: pzo-web/src/engines/chat/continuity/CarryoverSceneState.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Converts a live chat-engine snapshot into a transition-grade continuity payload.
 *
 * The existing chat stack already owns transcript state, scene state, mount policy,
 * pressure metadata, relationship ledgers, presence, typing, reveal queues, rescue,
 * and other runtime signals. This file does not replace any of those systems.
 *
 * It exists to answer a narrower but crucial question:
 *
 *   “What exactly should survive when the player moves from one mount surface to
 *    another, and in what emotional shape should it survive?”
 *
 * The design target is not sticky UI. It is authored carryover:
 * - unresolved tension follows the player without feeling duplicated
 * - the next surface knows whether the scene should stay hot, cool, or go quiet
 * - companion continuity survives the jump without flattening channel policy
 * - the next mount inherits only the right amount of transcript memory
 * - shadow / reveal / rescue momentum can be represented without exposing internal
 *   bookkeeping directly to the player
 *
 * This module is frontend-runtime only.
 * It operates as a deterministic summarizer / planner over existing state.
 */

import {
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_MOUNT_PRESETS,
} from '../types';
import type { ChatMountTarget, ChatVisibleChannel } from '../types';

export type UnixMs = number;

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}

export interface CarryoverSceneMessageLike {
  readonly id?: string;
  readonly channelId?: string;
  readonly text?: string;
  readonly body?: string;
  readonly content?: string;
  readonly sender?: {
    readonly actorId?: string;
    readonly displayName?: string;
    readonly personaId?: string;
    readonly role?: string;
    readonly archetype?: string;
  };
  readonly createdAt?: string;
  readonly audit?: {
    readonly requestId?: string;
  };
  readonly meta?: {
    readonly sceneId?: string;
    readonly sceneBeatId?: string;
    readonly momentId?: string;
    readonly isMeaningful?: boolean;
    readonly botSource?: {
      readonly actorId?: string;
      readonly personaId?: string;
      readonly archetype?: string;
      readonly relationshipId?: string;
    };
    readonly proofTier?: string;
    readonly pressureTier?: string;
    readonly rescue?: JsonObject;
    readonly continuity?: JsonObject;
    readonly carryoverEligible?: boolean;
    readonly [key: string]: JsonValue | undefined;
  };
  readonly legend?: JsonObject;
  readonly replay?: JsonObject;
  readonly proof?: JsonObject;
}

export interface CarryoverRelationshipLike {
  readonly relationshipId?: string;
  readonly counterpartId?: string;
  readonly counterpartPersonaId?: string;
  readonly stance?: string;
  readonly trust?: number;
  readonly fear?: number;
  readonly contempt?: number;
  readonly fascination?: number;
  readonly respect?: number;
  readonly familiarity?: number;
  readonly rivalryIntensity?: number;
  readonly rescueDebt?: number;
  readonly lastMeaningfulAt?: UnixMs | string;
  readonly objective?: string;
}

export interface CarryoverPresenceLike {
  readonly actorId?: string;
  readonly personaId?: string;
  readonly displayName?: string;
  readonly presence?: string;
  readonly typing?: string;
  readonly lastChangedAt?: UnixMs | string;
}

export interface CarryoverSceneLike {
  readonly sceneId?: string;
  readonly archetype?: string;
  readonly status?: string;
  readonly channelId?: string;
  readonly priority?: number;
  readonly leadActorId?: string;
  readonly beatIndex?: number;
  readonly beats?: ReadonlyArray<{
    readonly beatId?: string;
    readonly type?: string;
    readonly actorId?: string;
    readonly priority?: number;
    readonly text?: string;
    readonly status?: string;
    readonly visibleChannel?: string;
  }>;
}

export interface CarryoverSilenceLike {
  readonly silenceId?: string;
  readonly kind?: string;
  readonly breakConditions?: readonly string[];
  readonly untilAt?: UnixMs | string;
}

export interface CarryoverRevealLike {
  readonly revealId?: string;
  readonly sourceId?: string;
  readonly lane?: string;
  readonly reason?: string;
  readonly priority?: number;
  readonly revealAt?: UnixMs | string;
}

export interface CarryoverAudienceHeatLike {
  readonly heat01?: number;
  readonly hostility01?: number;
  readonly hype01?: number;
  readonly ridicule01?: number;
  readonly spectatorship01?: number;
}

export interface CarryoverStateLike {
  readonly activeMountTarget?: ChatMountTarget | string;
  readonly activeVisibleChannel?: ChatVisibleChannel | string;
  readonly messagesByChannel?: Record<string, readonly CarryoverSceneMessageLike[] | undefined>;
  readonly activeScene?: CarryoverSceneLike;
  readonly currentSilence?: CarryoverSilenceLike;
  readonly pendingReveals?: readonly CarryoverRevealLike[];
  readonly presenceByActorId?: Record<string, CarryoverPresenceLike | undefined>;
  readonly typingByActorId?: Record<string, CarryoverPresenceLike | undefined>;
  readonly relationshipsByCounterpartId?: Record<string, CarryoverRelationshipLike | undefined>;
  readonly audienceHeat?: Record<string, CarryoverAudienceHeatLike | undefined>;
  readonly continuity?: {
    readonly lastMountTarget?: ChatMountTarget | string;
    readonly activeSceneId?: string;
    readonly unresolvedMomentIds?: readonly string[];
    readonly carryoverSummary?: JsonObject;
    readonly carriedPersonaIds?: readonly string[];
  };
  readonly liveOps?: {
    readonly activeWorldEvents?: ReadonlyArray<{ readonly eventId?: string; readonly title?: string; readonly severity?: string }>;
    readonly globalMoodOverride?: string;
    readonly suppressedHelperChannels?: readonly string[];
    readonly boostedCrowdChannels?: readonly string[];
  };
  readonly learningProfile?: {
    readonly aggressionCadence01?: number;
    readonly helperCadence01?: number;
    readonly crowdSensitivity01?: number;
    readonly rescueSensitivity01?: number;
  };
  readonly notifications?: {
    readonly hasAnyUnread?: boolean;
    readonly totalUnread?: number;
  };
}

export type CarryoverTensionBand =
  | 'DORMANT'
  | 'LOW'
  | 'WARM'
  | 'HOT'
  | 'VOLATILE'
  | 'CRITICAL';

export type CarryoverSceneTemperature = 'COOL' | 'STEADY' | 'TENSE' | 'PRESSURED' | 'HOSTILE';
export type CarryoverPersistenceClass = 'NONE' | 'LIGHT' | 'SCENE' | 'RUN' | 'ACCOUNT';

export interface CarryoverActorRef {
  readonly actorId: string;
  readonly personaId?: string;
  readonly displayName?: string;
  readonly role?: string;
  readonly archetype?: string;
  readonly relationshipId?: string;
  readonly relationshipStance?: string;
  readonly intensity01: number;
  readonly importance01: number;
  readonly shouldFollow: boolean;
  readonly reason: string;
}

export interface CarryoverMomentRef {
  readonly momentId: string;
  readonly sourceChannel: ChatVisibleChannel | string;
  readonly reason: string;
  readonly priority: number;
  readonly persistenceClass: CarryoverPersistenceClass;
  readonly actorId?: string;
  readonly sceneId?: string;
  readonly happenedAt?: UnixMs;
}

export interface CarryoverRevealRef {
  readonly revealId: string;
  readonly lane?: string;
  readonly priority: number;
  readonly revealAt?: UnixMs;
  readonly holdAcrossMounts: boolean;
}

export interface CarryoverOverlayState {
  readonly preferredChannel: ChatVisibleChannel;
  readonly restoreCollapsed: boolean;
  readonly restorePanelOpen: boolean;
  readonly composerDraftHint?: string;
  readonly transcriptWindowTarget: number;
}

export interface CarryoverSceneSummary {
  readonly summaryId: string;
  readonly builtAt: UnixMs;
  readonly fromMount: ChatMountTarget;
  readonly toMount: ChatMountTarget;
  readonly preferredVisibleChannel: ChatVisibleChannel;
  readonly carryoverAllowedChannels: readonly ChatVisibleChannel[];
  readonly activeSceneId?: string;
  readonly activeSceneArchetype?: string;
  readonly activeSceneChannel?: string;
  readonly tensionBand: CarryoverTensionBand;
  readonly temperature: CarryoverSceneTemperature;
  readonly urgency01: number;
  readonly pressure01: number;
  readonly dominantAudienceChannel?: string;
  readonly unresolvedMoments: readonly CarryoverMomentRef[];
  readonly carriedActors: readonly CarryoverActorRef[];
  readonly pendingReveals: readonly CarryoverRevealRef[];
  readonly transcriptPreview: readonly CarryoverSceneMessageLike[];
  readonly overlay: CarryoverOverlayState;
  readonly summaryLine: string;
  readonly shadowSummaryLine?: string;
  readonly shouldHoldSilence: boolean;
  readonly silenceUntilAt?: UnixMs;
  readonly shouldDelayHelperReentry: boolean;
  readonly liveEventTitles: readonly string[];
  readonly carriedPersonaIds: readonly string[];
  readonly reasonCodes: readonly string[];
}

export interface CarryoverHydrationPlan {
  readonly targetMount: ChatMountTarget;
  readonly preferredChannel: ChatVisibleChannel;
  readonly panelShouldOpen: boolean;
  readonly panelShouldCollapse: boolean;
  readonly transcriptWindowTarget: number;
  readonly carrySummaryPatch: JsonObject;
  readonly sceneReminderLine?: string;
  readonly helperDelayMs: number;
  readonly silenceUntilAt?: UnixMs;
}

export interface CarryoverProjection {
  readonly summary: CarryoverSceneSummary;
  readonly hydration: CarryoverHydrationPlan;
}

export interface CarryoverSceneStateOptions {
  readonly maxTranscriptPreview?: number;
  readonly maxUnresolvedMoments?: number;
  readonly maxCarriedActors?: number;
  readonly maxRevealCarryovers?: number;
  readonly maxSummaryLineLength?: number;
  readonly transcriptRecencyWeight?: number;
  readonly relationshipWeight?: number;
  readonly revealWeight?: number;
  readonly audienceHeatWeight?: number;
  readonly helperPatienceWindowMs?: number;
  readonly silenceCarryoverSlackMs?: number;
}

const DEFAULT_OPTIONS: Required<CarryoverSceneStateOptions> = Object.freeze({
  maxTranscriptPreview: 12,
  maxUnresolvedMoments: 8,
  maxCarriedActors: 6,
  maxRevealCarryovers: 8,
  maxSummaryLineLength: 180,
  transcriptRecencyWeight: 0.55,
  relationshipWeight: 0.25,
  revealWeight: 0.12,
  audienceHeatWeight: 0.08,
  helperPatienceWindowMs: 9_000,
  silenceCarryoverSlackMs: 4_000,
});

const DEFAULT_VISIBLE_CHANNEL: ChatVisibleChannel = 'GLOBAL' as ChatVisibleChannel;
const CONTINUITY_CHANNEL_ORDER: readonly ChatVisibleChannel[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as const;
const FOLLOW_ROLES = new Set(['HELPER', 'ALLY', 'RIVAL', 'NEMESIS', 'BROKER', 'MENTOR']);
const AGGRESSIVE_ARCHETYPES = ['HATER', 'RIVAL', 'PREDATOR', 'ENFORCER', 'LIQUIDATOR'];
const HELPER_ARCHETYPES = ['HELPER', 'MENTOR', 'ALLY', 'GUIDE', 'SUPPORT'];

function nowUnixMs(): UnixMs {
  return Date.now();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toUnixMs(value: unknown): UnixMs | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function messageText(message: CarryoverSceneMessageLike): string {
  return (
    asString(message.text) ??
    asString(message.body) ??
    asString(message.content) ??
    ''
  );
}

function normalizeVisibleChannel(channel: unknown, fallbackMount?: ChatMountTarget): ChatVisibleChannel {
  if (typeof channel === 'string' && channel in CHAT_CHANNEL_DESCRIPTORS) {
    return channel as ChatVisibleChannel;
  }
  if (fallbackMount && CHAT_MOUNT_PRESETS[fallbackMount]) {
    return CHAT_MOUNT_PRESETS[fallbackMount].defaultVisibleChannel;
  }
  return DEFAULT_VISIBLE_CHANNEL;
}

function normalizeMountTarget(mount: unknown, fallback: ChatMountTarget = 'GAME_BOARD' as ChatMountTarget): ChatMountTarget {
  if (typeof mount === 'string' && mount in CHAT_MOUNT_PRESETS) return mount as ChatMountTarget;
  return fallback;
}

function allowedChannelsForMount(target: ChatMountTarget): readonly ChatVisibleChannel[] {
  const preset = CHAT_MOUNT_PRESETS[target];
  return preset?.allowedVisibleChannels ?? [preset?.defaultVisibleChannel ?? DEFAULT_VISIBLE_CHANNEL];
}

function pickPreferredChannel(
  requested: ChatVisibleChannel | undefined,
  target: ChatMountTarget,
  fallback?: ChatVisibleChannel,
): ChatVisibleChannel {
  const allowed = allowedChannelsForMount(target);
  if (requested && allowed.includes(requested)) return requested;
  if (fallback && allowed.includes(fallback)) return fallback;
  return allowed[0] ?? CHAT_MOUNT_PRESETS[target].defaultVisibleChannel;
}

function scoreRelationship(rel: CarryoverRelationshipLike | undefined): number {
  if (!rel) return 0;
  const trust = asNumber(rel.trust) ?? 0;
  const respect = asNumber(rel.respect) ?? 0;
  const rivalry = asNumber(rel.rivalryIntensity) ?? 0;
  const rescueDebt = asNumber(rel.rescueDebt) ?? 0;
  const fear = asNumber(rel.fear) ?? 0;
  const contempt = asNumber(rel.contempt) ?? 0;
  const fascination = asNumber(rel.fascination) ?? 0;
  return Math.max(
    trust,
    respect,
    rivalry,
    rescueDebt * 0.9,
    fear * 0.8,
    contempt * 0.75,
    fascination * 0.6,
  ) / 100;
}

function determineTensionBand(urgency01: number, pressure01: number): CarryoverTensionBand {
  const score = Math.max(urgency01, pressure01 * 0.92);
  if (score >= 0.92) return 'CRITICAL';
  if (score >= 0.78) return 'VOLATILE';
  if (score >= 0.6) return 'HOT';
  if (score >= 0.4) return 'WARM';
  if (score >= 0.18) return 'LOW';
  return 'DORMANT';
}

function determineTemperature(
  sceneArchetype: string | undefined,
  pressure01: number,
  target: ChatMountTarget,
): CarryoverSceneTemperature {
  const archetype = (sceneArchetype ?? '').toUpperCase();
  if (archetype.includes('HOSTILE') || archetype.includes('BOSS') || pressure01 >= 0.86) return 'HOSTILE';
  if (archetype.includes('DEAL') || archetype.includes('SABOTAGE') || pressure01 >= 0.64) return 'PRESSURED';
  if (archetype.includes('BATTLE') || archetype.includes('RIVAL') || pressure01 >= 0.46) return 'TENSE';
  if (target === ('LOBBY_SCREEN' as ChatMountTarget) || pressure01 <= 0.2) return 'COOL';
  return 'STEADY';
}

function inferPersistenceClass(channel: string | undefined): CarryoverPersistenceClass {
  const descriptor = channel ? CHAT_CHANNEL_DESCRIPTORS[channel as keyof typeof CHAT_CHANNEL_DESCRIPTORS] : undefined;
  const persistence = descriptor?.persistenceClass;
  switch (persistence) {
    case 'ACCOUNT_SCOPED':
      return 'ACCOUNT';
    case 'RUN_SCOPED':
      return 'RUN';
    case 'TRANSIENT':
      return 'LIGHT';
    default:
      return 'SCENE';
  }
}

function sortByImportance<T extends { importance01?: number; priority?: number; happenedAt?: number; revealAt?: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const importanceDelta = (b.importance01 ?? b.priority ?? 0) - (a.importance01 ?? a.priority ?? 0);
    if (importanceDelta !== 0) return importanceDelta;
    return (b.happenedAt ?? b.revealAt ?? 0) - (a.happenedAt ?? a.revealAt ?? 0);
  });
}

export class CarryoverSceneState {
  private readonly options: Required<CarryoverSceneStateOptions>;

  public constructor(options: CarryoverSceneStateOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  public getOptions(): Required<CarryoverSceneStateOptions> {
    return { ...this.options };
  }

  public projectTransition(
    state: Readonly<CarryoverStateLike>,
    nextMountTarget: ChatMountTarget,
    now: UnixMs = nowUnixMs(),
  ): CarryoverProjection {
    const fromMount = normalizeMountTarget(state.activeMountTarget, nextMountTarget);
    const summary = this.buildSummary(state, fromMount, nextMountTarget, now);
    return {
      summary,
      hydration: this.buildHydrationPlan(summary, nextMountTarget, now),
    };
  }

  public buildSummary(
    state: Readonly<CarryoverStateLike>,
    fromMountTarget: ChatMountTarget,
    nextMountTarget: ChatMountTarget,
    now: UnixMs = nowUnixMs(),
  ): CarryoverSceneSummary {
    const activeMount = normalizeMountTarget(state.activeMountTarget, fromMountTarget);
    const activeChannel = normalizeVisibleChannel(state.activeVisibleChannel, activeMount);
    const messages = this.collectMessagePreview(state, activeMount, nextMountTarget, activeChannel);
    const unresolvedMoments = this.collectUnresolvedMoments(state, messages, activeChannel, now);
    const carriedActors = this.collectCarriedActors(state, messages, unresolvedMoments, now);
    const pendingReveals = this.collectReveals(state, unresolvedMoments, now);
    const pressure01 = this.derivePressure01(state, messages, pendingReveals, unresolvedMoments);
    const urgency01 = this.deriveUrgency01(state, pendingReveals, unresolvedMoments, carriedActors);
    const tensionBand = determineTensionBand(urgency01, pressure01);
    const activeSceneArchetype = asString(state.activeScene?.archetype);
    const activeSceneId = asString(state.activeScene?.sceneId) ?? asString(state.continuity?.activeSceneId);
    const preferredVisibleChannel = this.derivePreferredChannel(state, nextMountTarget, activeChannel, unresolvedMoments, messages);
    const temperature = determineTemperature(activeSceneArchetype, pressure01, nextMountTarget);
    const shouldHoldSilence = this.shouldCarrySilence(state, pressure01, urgency01, now);
    const silenceUntilAt = shouldHoldSilence ? this.resolveSilenceUntilAt(state, now) : undefined;
    const overlay = this.buildOverlayState(state, nextMountTarget, preferredVisibleChannel, messages, pressure01);
    const liveEventTitles = unique(
      (state.liveOps?.activeWorldEvents ?? [])
        .map((event) => asString(event.title))
        .filter((value): value is string => Boolean(value)),
    );
    const carriedPersonaIds = unique(
      carriedActors
        .map((actor) => actor.personaId)
        .filter((value): value is string => Boolean(value)),
    );
    const dominantAudienceChannel = this.pickDominantAudienceChannel(state);
    const reasonCodes = unique([
      activeSceneId ? 'ACTIVE_SCENE' : '',
      unresolvedMoments.length > 0 ? 'UNRESOLVED_MOMENTS' : '',
      pendingReveals.length > 0 ? 'PENDING_REVEALS' : '',
      carriedActors.some((actor) => actor.shouldFollow) ? 'FOLLOWING_ACTORS' : '',
      shouldHoldSilence ? 'CARRY_SILENCE' : '',
      pressure01 >= 0.66 ? 'PRESSURE_HIGH' : '',
      liveEventTitles.length > 0 ? 'LIVEOPS_ACTIVE' : '',
    ].filter(Boolean));

    const summaryLine = this.composeSummaryLine({
      nextMountTarget,
      activeSceneArchetype,
      unresolvedMoments,
      carriedActors,
      pressure01,
      tensionBand,
      dominantAudienceChannel,
      liveEventTitles,
    });

    const shadowSummaryLine = this.composeShadowSummaryLine({
      unresolvedMoments,
      pendingReveals,
      carriedActors,
      reasonCodes,
    });

    return {
      summaryId: `carryover:${fromMountTarget}:${nextMountTarget}:${now}`,
      builtAt: now,
      fromMount: fromMountTarget,
      toMount: nextMountTarget,
      preferredVisibleChannel,
      carryoverAllowedChannels: allowedChannelsForMount(nextMountTarget),
      activeSceneId,
      activeSceneArchetype,
      activeSceneChannel: asString(state.activeScene?.channelId),
      tensionBand,
      temperature,
      urgency01,
      pressure01,
      dominantAudienceChannel,
      unresolvedMoments,
      carriedActors,
      pendingReveals,
      transcriptPreview: messages,
      overlay,
      summaryLine,
      shadowSummaryLine,
      shouldHoldSilence,
      silenceUntilAt,
      shouldDelayHelperReentry: this.shouldDelayHelperReentry(carriedActors, pressure01, now),
      liveEventTitles,
      carriedPersonaIds,
      reasonCodes,
    };
  }

  public buildHydrationPlan(
    summary: Readonly<CarryoverSceneSummary>,
    targetMount: ChatMountTarget,
    now: UnixMs = nowUnixMs(),
  ): CarryoverHydrationPlan {
    const panelShouldOpen = this.shouldOpenPanel(summary, targetMount);
    const panelShouldCollapse = summary.overlay.restoreCollapsed;
    const helperDelayMs = summary.shouldDelayHelperReentry
      ? clampInt((summary.pressure01 * 7_000) + 1_500, 1_250, 9_500)
      : 0;

    return {
      targetMount,
      preferredChannel: pickPreferredChannel(summary.preferredVisibleChannel, targetMount),
      panelShouldOpen,
      panelShouldCollapse,
      transcriptWindowTarget: summary.overlay.transcriptWindowTarget,
      carrySummaryPatch: {
        summaryId: summary.summaryId,
        fromMount: summary.fromMount,
        toMount: summary.toMount,
        builtAt: summary.builtAt,
        summaryLine: summary.summaryLine,
        shadowSummaryLine: summary.shadowSummaryLine,
        tensionBand: summary.tensionBand,
        temperature: summary.temperature,
        activeSceneId: summary.activeSceneId,
        activeSceneArchetype: summary.activeSceneArchetype,
        preferredVisibleChannel: summary.preferredVisibleChannel,
        unresolvedMomentIds: summary.unresolvedMoments.map((moment) => moment.momentId),
        carriedPersonaIds: [...summary.carriedPersonaIds],
        carriedActorIds: summary.carriedActors.map((actor) => actor.actorId),
        liveEventTitles: [...summary.liveEventTitles],
        pressure01: summary.pressure01,
        urgency01: summary.urgency01,
        hydrationBuiltAt: now,
      },
      sceneReminderLine: summary.transcriptPreview[0]
        ? truncate(messageText(summary.transcriptPreview[0]), 120)
        : summary.summaryLine,
      helperDelayMs,
      silenceUntilAt: summary.silenceUntilAt,
    };
  }

  public applyContinuitySummary(
    state: Readonly<CarryoverStateLike>,
    summary: Readonly<CarryoverSceneSummary>,
  ): JsonObject {
    return {
      ...(state.continuity?.carryoverSummary ?? {}),
      summaryId: summary.summaryId,
      builtAt: summary.builtAt,
      fromMount: summary.fromMount,
      toMount: summary.toMount,
      preferredVisibleChannel: summary.preferredVisibleChannel,
      activeSceneId: summary.activeSceneId,
      tensionBand: summary.tensionBand,
      temperature: summary.temperature,
      unresolvedMomentIds: summary.unresolvedMoments.map((entry) => entry.momentId),
      carriedPersonaIds: [...summary.carriedPersonaIds],
      summaryLine: summary.summaryLine,
      shadowSummaryLine: summary.shadowSummaryLine,
      reasonCodes: [...summary.reasonCodes],
    };
  }

  public summarizeForDebug(summary: Readonly<CarryoverSceneSummary>): JsonObject {
    return {
      summaryId: summary.summaryId,
      fromMount: summary.fromMount,
      toMount: summary.toMount,
      preferredVisibleChannel: summary.preferredVisibleChannel,
      tensionBand: summary.tensionBand,
      temperature: summary.temperature,
      pressure01: Number(summary.pressure01.toFixed(3)),
      urgency01: Number(summary.urgency01.toFixed(3)),
      unresolvedMomentIds: summary.unresolvedMoments.map((item) => item.momentId),
      carriedActorIds: summary.carriedActors.map((item) => item.actorId),
      pendingRevealIds: summary.pendingReveals.map((item) => item.revealId),
      shouldHoldSilence: summary.shouldHoldSilence,
      shouldDelayHelperReentry: summary.shouldDelayHelperReentry,
      reasonCodes: [...summary.reasonCodes],
    };
  }

  private collectMessagePreview(
    state: Readonly<CarryoverStateLike>,
    fromMountTarget: ChatMountTarget,
    nextMountTarget: ChatMountTarget,
    activeChannel: ChatVisibleChannel,
  ): CarryoverSceneMessageLike[] {
    const channelPriority = unique<ChatVisibleChannel>([
      activeChannel,
      CHAT_MOUNT_PRESETS[fromMountTarget]?.defaultVisibleChannel,
      CHAT_MOUNT_PRESETS[nextMountTarget]?.defaultVisibleChannel,
      ...allowedChannelsForMount(nextMountTarget),
      ...CONTINUITY_CHANNEL_ORDER,
    ].filter(Boolean) as ChatVisibleChannel[]);

    const result: CarryoverSceneMessageLike[] = [];
    for (const channelId of channelPriority) {
      const messages = state.messagesByChannel?.[channelId] ?? [];
      const recent = [...messages].slice(-Math.ceil(this.options.maxTranscriptPreview / 2));
      for (const message of recent) result.push(message);
    }

    const deduped = new Map<string, CarryoverSceneMessageLike>();
    for (const message of result) {
      const key = asString(message.id)
        ?? asString(message.audit?.requestId)
        ?? `${message.sender?.actorId ?? 'unknown'}:${toUnixMs(message.createdAt) ?? 0}:${messageText(message)}`;
      if (!deduped.has(key)) deduped.set(key, message);
    }

    return [...deduped.values()]
      .sort((a, b) => (toUnixMs(a.createdAt) ?? 0) - (toUnixMs(b.createdAt) ?? 0))
      .slice(-this.options.maxTranscriptPreview);
  }

  private collectUnresolvedMoments(
    state: Readonly<CarryoverStateLike>,
    messages: readonly CarryoverSceneMessageLike[],
    activeChannel: ChatVisibleChannel,
    now: UnixMs,
  ): CarryoverMomentRef[] {
    const knownMomentIds = new Set(state.continuity?.unresolvedMomentIds ?? []);
    const moments: CarryoverMomentRef[] = [];

    for (const message of messages) {
      const momentId = asString(message.meta?.momentId);
      const explicitlyCarry = message.meta?.carryoverEligible === true;
      const isMeaningful = message.meta?.isMeaningful === true || Boolean(message.legend) || Boolean(message.replay) || explicitlyCarry;
      if (!momentId && !isMeaningful) continue;
      if (momentId && !knownMomentIds.has(momentId) && !explicitlyCarry) continue;

      const text = messageText(message);
      const sourceChannel = normalizeVisibleChannel(message.channelId ?? activeChannel);
      const happenedAt = toUnixMs(message.createdAt) ?? now;
      const priority = clampInt(
        (explicitlyCarry ? 45 : 0)
          + (message.legend ? 24 : 0)
          + (message.replay ? 14 : 0)
          + (message.proof ? 8 : 0)
          + (text.length > 120 ? 8 : text.length > 50 ? 4 : 2)
          + (sourceChannel === 'DEAL_ROOM' ? 10 : 0)
          + (sourceChannel === 'SYNDICATE' ? 5 : 0),
        1,
        100,
      );

      moments.push({
        momentId: momentId ?? `message:${message.id ?? happenedAt}`,
        sourceChannel,
        reason: explicitlyCarry ? 'MESSAGE_MARKED_CARRYOVER' : 'UNRESOLVED_MESSAGE_MOMENT',
        priority,
        persistenceClass: inferPersistenceClass(message.channelId ?? sourceChannel),
        actorId: asString(message.sender?.actorId) ?? asString(message.meta?.botSource?.actorId),
        sceneId: asString(message.meta?.sceneId),
        happenedAt,
      });
    }

    for (const momentId of state.continuity?.unresolvedMomentIds ?? []) {
      if (moments.some((moment) => moment.momentId === momentId)) continue;
      moments.push({
        momentId,
        sourceChannel: activeChannel,
        reason: 'STATE_UNRESOLVED_MOMENT',
        priority: 52,
        persistenceClass: 'SCENE',
        happenedAt: now,
      });
    }

    return sortByImportance(moments).slice(0, this.options.maxUnresolvedMoments);
  }

  private collectCarriedActors(
    state: Readonly<CarryoverStateLike>,
    messages: readonly CarryoverSceneMessageLike[],
    moments: readonly CarryoverMomentRef[],
    now: UnixMs,
  ): CarryoverActorRef[] {
    const byActorId = new Map<string, CarryoverActorRef>();
    const relationships = state.relationshipsByCounterpartId ?? {};

    const upsert = (actor: CarryoverActorRef): void => {
      const existing = byActorId.get(actor.actorId);
      if (!existing || actor.importance01 > existing.importance01) byActorId.set(actor.actorId, actor);
    };

    for (const [relationshipKey, relationship] of Object.entries(relationships)) {
      if (!relationship) continue;
      const actorId = asString(relationship.counterpartId) ?? relationshipKey;
      if (!actorId) continue;
      const relationshipScore = scoreRelationship(relationship);
      const stance = asString(relationship.stance);
      const role = stance ?? inferRoleFromRelationship(relationship);
      const archetype = inferArchetypeFromRelationship(relationship);
      const shouldFollow = relationshipScore >= 0.28 || Boolean(asString(relationship.objective));
      upsert({
        actorId,
        personaId: asString(relationship.counterpartPersonaId),
        displayName: undefined,
        role,
        archetype,
        relationshipId: asString(relationship.relationshipId),
        relationshipStance: stance,
        intensity01: relationshipScore,
        importance01: clamp01((relationshipScore * 0.8) + (shouldFollow ? 0.15 : 0)),
        shouldFollow,
        reason: shouldFollow ? 'RELATIONSHIP_PRESSURE' : 'RELATIONSHIP_BACKGROUND',
      });
    }

    for (const message of messages) {
      const actorId = asString(message.sender?.actorId) ?? asString(message.meta?.botSource?.actorId);
      if (!actorId) continue;
      const text = messageText(message);
      const recentness = deriveRecentness01(toUnixMs(message.createdAt) ?? now, now, 90_000);
      const explicitMoment = moments.some((moment) => moment.actorId === actorId);
      const personaId = asString(message.sender?.personaId) ?? asString(message.meta?.botSource?.personaId);
      const role = asString(message.sender?.role);
      const archetype = asString(message.sender?.archetype) ?? asString(message.meta?.botSource?.archetype);
      const importance01 = clamp01(
        (recentness * this.options.transcriptRecencyWeight)
          + (explicitMoment ? 0.28 : 0)
          + (text.length >= 96 ? 0.14 : text.length >= 48 ? 0.08 : 0.03),
      );
      const shouldFollow = explicitMoment || roleShouldFollow(role, archetype);
      upsert({
        actorId,
        personaId,
        displayName: asString(message.sender?.displayName),
        role,
        archetype,
        relationshipId: asString(message.meta?.botSource?.relationshipId),
        relationshipStance: byActorId.get(actorId)?.relationshipStance,
        intensity01: clamp01(importance01 + (explicitMoment ? 0.1 : 0)),
        importance01,
        shouldFollow,
        reason: explicitMoment ? 'UNRESOLVED_MOMENT' : 'RECENT_SPEAKER',
      });
    }

    const activeSceneLead = asString(state.activeScene?.leadActorId);
    if (activeSceneLead && !byActorId.has(activeSceneLead)) {
      const presence = state.presenceByActorId?.[activeSceneLead];
      upsert({
        actorId: activeSceneLead,
        personaId: asString(presence?.personaId),
        displayName: asString(presence?.displayName),
        role: 'LEAD',
        archetype: undefined,
        intensity01: 0.64,
        importance01: 0.71,
        shouldFollow: true,
        reason: 'ACTIVE_SCENE_LEAD',
      });
    }

    return sortByImportance([...byActorId.values()]).slice(0, this.options.maxCarriedActors);
  }

  private collectReveals(
    state: Readonly<CarryoverStateLike>,
    moments: readonly CarryoverMomentRef[],
    now: UnixMs,
  ): CarryoverRevealRef[] {
    const reveals: CarryoverRevealRef[] = [];
    for (const reveal of state.pendingReveals ?? []) {
      const revealId = asString(reveal.revealId);
      if (!revealId) continue;
      const revealAt = toUnixMs(reveal.revealAt);
      const priority = clampInt((asNumber(reveal.priority) ?? 40) + (reveal.lane?.includes('RESCUE') ? 8 : 0), 1, 100);
      const associatedMoment = moments.some((moment) => moment.momentId === reveal.sourceId || moment.actorId === reveal.sourceId);
      reveals.push({
        revealId,
        lane: asString(reveal.lane),
        priority,
        revealAt,
        holdAcrossMounts: associatedMoment || (revealAt !== undefined && revealAt >= now - 15_000),
      });
    }

    return sortByImportance(reveals).slice(0, this.options.maxRevealCarryovers);
  }

  private derivePressure01(
    state: Readonly<CarryoverStateLike>,
    messages: readonly CarryoverSceneMessageLike[],
    reveals: readonly CarryoverRevealRef[],
    moments: readonly CarryoverMomentRef[],
  ): number {
    const scenePriority = clamp01((asNumber(state.activeScene?.priority) ?? 0) / 100);
    const liveMood = asString(state.liveOps?.globalMoodOverride);
    const liveBoost = liveMood ? 0.08 : 0;
    const revealPressure = clamp01(reveals.reduce((sum, item) => sum + (item.priority / 100), 0) / Math.max(1, reveals.length || 1));
    const unresolvedPressure = clamp01(moments.reduce((sum, item) => sum + (item.priority / 100), 0) / Math.max(1, moments.length || 1));
    const audience = this.pickDominantAudienceHeat(state);
    const transcriptPressure = clamp01(messages.reduce((sum, message) => {
      const channelId = normalizeVisibleChannel(message.channelId, normalizeMountTarget(state.activeMountTarget));
      if (channelId === 'DEAL_ROOM') return sum + 0.14;
      if (channelId === 'SYNDICATE') return sum + 0.08;
      return sum + 0.04;
    }, 0));
    return clamp01(
      (scenePriority * 0.28)
        + (revealPressure * this.options.revealWeight)
        + (unresolvedPressure * 0.24)
        + (audience * this.options.audienceHeatWeight)
        + (transcriptPressure * 0.16)
        + liveBoost,
    );
  }

  private deriveUrgency01(
    state: Readonly<CarryoverStateLike>,
    reveals: readonly CarryoverRevealRef[],
    moments: readonly CarryoverMomentRef[],
    actors: readonly CarryoverActorRef[],
  ): number {
    const silenceUntil = this.resolveSilenceUntilAt(state, nowUnixMs());
    const silenceBoost = silenceUntil ? 0.06 : 0;
    const revealUrgency = clamp01(reveals.filter((item) => item.holdAcrossMounts).length / Math.max(1, this.options.maxRevealCarryovers));
    const momentUrgency = clamp01(moments.filter((item) => item.priority >= 60).length / Math.max(1, this.options.maxUnresolvedMoments));
    const actorUrgency = clamp01(actors.filter((item) => item.shouldFollow).length / Math.max(1, this.options.maxCarriedActors));
    const helperSuppressed = (state.liveOps?.suppressedHelperChannels ?? []).length > 0 ? 0.05 : 0;
    return clamp01((revealUrgency * 0.34) + (momentUrgency * 0.34) + (actorUrgency * 0.21) + silenceBoost + helperSuppressed);
  }

  private derivePreferredChannel(
    state: Readonly<CarryoverStateLike>,
    nextMountTarget: ChatMountTarget,
    activeChannel: ChatVisibleChannel,
    moments: readonly CarryoverMomentRef[],
    messages: readonly CarryoverSceneMessageLike[],
  ): ChatVisibleChannel {
    const targetPreset = CHAT_MOUNT_PRESETS[nextMountTarget];
    const allowed = targetPreset.allowedVisibleChannels;
    const carrySummaryRequested = normalizeVisibleChannel(state.continuity?.carryoverSummary?.preferredVisibleChannel, nextMountTarget);
    if (allowed.includes(carrySummaryRequested)) return carrySummaryRequested;

    const scoreByChannel = new Map<ChatVisibleChannel, number>();
    for (const channelId of allowed) scoreByChannel.set(channelId, 0);

    scoreByChannel.set(activeChannel, (scoreByChannel.get(activeChannel) ?? 0) + 0.2);
    scoreByChannel.set(targetPreset.defaultVisibleChannel, (scoreByChannel.get(targetPreset.defaultVisibleChannel) ?? 0) + 0.18);

    for (const moment of moments) {
      const channelId = normalizeVisibleChannel(moment.sourceChannel, nextMountTarget);
      if (!allowed.includes(channelId)) continue;
      scoreByChannel.set(channelId, (scoreByChannel.get(channelId) ?? 0) + (moment.priority / 100) * 0.42);
    }

    for (const message of messages) {
      const channelId = normalizeVisibleChannel(message.channelId, nextMountTarget);
      if (!allowed.includes(channelId)) continue;
      scoreByChannel.set(channelId, (scoreByChannel.get(channelId) ?? 0) + 0.08);
    }

    const dominantAudience = this.pickDominantAudienceChannel(state);
    if (dominantAudience) {
      const channelId = normalizeVisibleChannel(dominantAudience, nextMountTarget);
      if (allowed.includes(channelId)) scoreByChannel.set(channelId, (scoreByChannel.get(channelId) ?? 0) + 0.1);
    }

    let winner: ChatVisibleChannel = targetPreset.defaultVisibleChannel;
    let winnerScore = -Infinity;
    for (const channelId of allowed) {
      const score = scoreByChannel.get(channelId) ?? 0;
      if (score > winnerScore) {
        winnerScore = score;
        winner = channelId;
      }
    }

    return winner;
  }

  private buildOverlayState(
    state: Readonly<CarryoverStateLike>,
    nextMountTarget: ChatMountTarget,
    preferredVisibleChannel: ChatVisibleChannel,
    messages: readonly CarryoverSceneMessageLike[],
    pressure01: number,
  ): CarryoverOverlayState {
    const preset = CHAT_MOUNT_PRESETS[nextMountTarget];
    const unread = asNumber(state.notifications?.totalUnread) ?? 0;
    const carrySummaryDraft = asString(state.continuity?.carryoverSummary?.composerDraftHint);
    return {
      preferredChannel: preferredVisibleChannel,
      restoreCollapsed: preset.allowCollapse ? (pressure01 < 0.45 && unread === 0) : false,
      restorePanelOpen: pressure01 >= 0.36 || unread > 0 || messages.length > 0,
      composerDraftHint: carrySummaryDraft,
      transcriptWindowTarget: clampInt(Math.max(preset.maxVisibleMessages * 0.4, messages.length + 4), 12, preset.maxVisibleMessages),
    };
  }

  private shouldCarrySilence(state: Readonly<CarryoverStateLike>, pressure01: number, urgency01: number, now: UnixMs): boolean {
    const silenceUntil = this.resolveSilenceUntilAt(state, now);
    if (!silenceUntil) return false;
    if (silenceUntil <= now) return false;
    return pressure01 >= 0.38 || urgency01 >= 0.42;
  }

  private resolveSilenceUntilAt(state: Readonly<CarryoverStateLike>, now: UnixMs): UnixMs | undefined {
    const untilAt = toUnixMs(state.currentSilence?.untilAt);
    if (!untilAt) return undefined;
    return untilAt >= now - this.options.silenceCarryoverSlackMs ? untilAt : undefined;
  }

  private shouldDelayHelperReentry(actors: readonly CarryoverActorRef[], pressure01: number, now: UnixMs): boolean {
    void now;
    const hasAggressiveFollower = actors.some((actor) => actor.shouldFollow && isAggressive(actor.archetype, actor.role));
    const hasHelperFollower = actors.some((actor) => actor.shouldFollow && isHelper(actor.archetype, actor.role));
    return hasAggressiveFollower && hasHelperFollower && pressure01 >= 0.52;
  }

  private shouldOpenPanel(summary: Readonly<CarryoverSceneSummary>, targetMount: ChatMountTarget): boolean {
    const preset = CHAT_MOUNT_PRESETS[targetMount];
    if (!preset.allowCollapse) return true;
    if (summary.tensionBand === 'CRITICAL' || summary.tensionBand === 'VOLATILE') return true;
    if (summary.pendingReveals.length > 0) return true;
    if (summary.unresolvedMoments.length >= 2) return true;
    return summary.overlay.restorePanelOpen;
  }

  private pickDominantAudienceChannel(state: Readonly<CarryoverStateLike>): string | undefined {
    let winner: string | undefined;
    let winnerScore = -Infinity;
    for (const [channelId, heat] of Object.entries(state.audienceHeat ?? {})) {
      const score = ((asNumber(heat?.heat01) ?? 0) * 0.45)
        + ((asNumber(heat?.hostility01) ?? 0) * 0.25)
        + ((asNumber(heat?.hype01) ?? 0) * 0.18)
        + ((asNumber(heat?.spectatorship01) ?? 0) * 0.12);
      if (score > winnerScore) {
        winnerScore = score;
        winner = channelId;
      }
    }
    return winner;
  }

  private pickDominantAudienceHeat(state: Readonly<CarryoverStateLike>): number {
    const channel = this.pickDominantAudienceChannel(state);
    if (!channel) return 0;
    const heat = state.audienceHeat?.[channel];
    return clamp01(
      ((asNumber(heat?.heat01) ?? 0) * 0.55)
        + ((asNumber(heat?.hostility01) ?? 0) * 0.2)
        + ((asNumber(heat?.ridicule01) ?? 0) * 0.1)
        + ((asNumber(heat?.spectatorship01) ?? 0) * 0.15),
    );
  }

  private composeSummaryLine(input: {
    nextMountTarget: ChatMountTarget;
    activeSceneArchetype?: string;
    unresolvedMoments: readonly CarryoverMomentRef[];
    carriedActors: readonly CarryoverActorRef[];
    pressure01: number;
    tensionBand: CarryoverTensionBand;
    dominantAudienceChannel?: string;
    liveEventTitles: readonly string[];
  }): string {
    const fragments: string[] = [];
    if (input.activeSceneArchetype) fragments.push(`${input.activeSceneArchetype} remains active`);
    if (input.unresolvedMoments.length > 0) fragments.push(`${input.unresolvedMoments.length} unresolved beat${input.unresolvedMoments.length === 1 ? '' : 's'} follow into ${input.nextMountTarget}`);
    const followActor = input.carriedActors.find((actor) => actor.shouldFollow);
    if (followActor?.displayName) fragments.push(`${followActor.displayName} is still attached to the scene`);
    else if (followActor?.actorId) fragments.push(`${followActor.actorId} is still attached to the scene`);
    if (input.liveEventTitles[0]) fragments.push(`LiveOps pressure: ${input.liveEventTitles[0]}`);
    else if (input.dominantAudienceChannel) fragments.push(`${input.dominantAudienceChannel} still owns the room heat`);
    fragments.push(`tension=${input.tensionBand.toLowerCase()} (${Math.round(input.pressure01 * 100)}%)`);
    return truncate(fragments.join(' · '), this.options.maxSummaryLineLength);
  }

  private composeShadowSummaryLine(input: {
    unresolvedMoments: readonly CarryoverMomentRef[];
    pendingReveals: readonly CarryoverRevealRef[];
    carriedActors: readonly CarryoverActorRef[];
    reasonCodes: readonly string[];
  }): string | undefined {
    if (
      input.unresolvedMoments.length === 0
      && input.pendingReveals.length === 0
      && input.carriedActors.length === 0
    ) {
      return undefined;
    }
    const topMoment = input.unresolvedMoments[0]?.momentId ?? 'none';
    const topReveal = input.pendingReveals[0]?.revealId ?? 'none';
    const topActor = input.carriedActors[0]?.actorId ?? 'none';
    return truncate(`shadow carry · moment=${topMoment} · reveal=${topReveal} · actor=${topActor} · reasons=${input.reasonCodes.join(',')}`, this.options.maxSummaryLineLength);
  }
}

function deriveRecentness01(createdAt: UnixMs, now: UnixMs, windowMs: number): number {
  const age = Math.max(0, now - createdAt);
  return clamp01(1 - (age / Math.max(1, windowMs)));
}

function roleShouldFollow(role: string | undefined, archetype: string | undefined): boolean {
  const normalizedRole = (role ?? '').toUpperCase();
  const normalizedArchetype = (archetype ?? '').toUpperCase();
  if (FOLLOW_ROLES.has(normalizedRole)) return true;
  if (FOLLOW_ROLES.has(normalizedArchetype)) return true;
  return AGGRESSIVE_ARCHETYPES.some((value) => normalizedArchetype.includes(value))
    || HELPER_ARCHETYPES.some((value) => normalizedArchetype.includes(value));
}

function isAggressive(archetype: string | undefined, role: string | undefined): boolean {
  const value = `${archetype ?? ''} ${role ?? ''}`.toUpperCase();
  return AGGRESSIVE_ARCHETYPES.some((token) => value.includes(token));
}

function isHelper(archetype: string | undefined, role: string | undefined): boolean {
  const value = `${archetype ?? ''} ${role ?? ''}`.toUpperCase();
  return HELPER_ARCHETYPES.some((token) => value.includes(token));
}

function inferRoleFromRelationship(rel: CarryoverRelationshipLike): string | undefined {
  const rivalry = asNumber(rel.rivalryIntensity) ?? 0;
  const trust = asNumber(rel.trust) ?? 0;
  const rescueDebt = asNumber(rel.rescueDebt) ?? 0;
  if (rivalry >= 55) return 'RIVAL';
  if (rescueDebt >= 35 || trust >= 58) return 'HELPER';
  return undefined;
}

function inferArchetypeFromRelationship(rel: CarryoverRelationshipLike): string | undefined {
  const stance = (asString(rel.stance) ?? '').toUpperCase();
  if (stance.includes('HOSTILE') || stance.includes('RIVAL')) return 'RIVAL';
  if (stance.includes('HELP') || stance.includes('ALLY') || stance.includes('TRUST')) return 'HELPER';
    return undefined;
}

export function createCarryoverSceneState(options: CarryoverSceneStateOptions = {}): CarryoverSceneState {
  return new CarryoverSceneState(options);
}

export const CarryoverSceneStateModule = Object.freeze({
  displayName: 'CarryoverSceneState',
  file: 'pzo-web/src/engines/chat/continuity/CarryoverSceneState.ts',
  category: 'frontend-chat-continuity-runtime',
  authorities: {
    frontend: '/pzo-web/src/engines/chat/continuity',
    backend: '/backend/src/game/engine/chat/continuity',
    shared: '/shared/contracts/chat',
  },
  create: createCarryoverSceneState,
});
