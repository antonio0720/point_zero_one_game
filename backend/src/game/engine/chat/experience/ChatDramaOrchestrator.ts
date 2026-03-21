/**
 * @file backend/src/game/engine/chat/experience/ChatDramaOrchestrator.ts
 * @description
 * Canonical backend drama orchestrator for cinematic chat scenes.
 *
 * This file is the backend authority bridge between:
 * - relationship/memory/player-model services,
 * - the pure scene planner,
 * - canonical message materialization,
 * - archive/carryover continuity.
 *
 * It does not own transport.
 * It does not own reducers.
 * It does not own frontend dock state.
 * It does own backend scene realization and durable continuity receipts.
 */

import type {
  SharedChatMomentType,
  SharedChatSceneBeat,
  SharedChatScenePlannerInput,
} from '../../../../../../shared/contracts/chat/scene';

import { ChatSceneArchiveService } from '../ChatSceneArchiveService';
import { ChatRelationshipService } from '../ChatRelationshipService';
import { ChatMemoryService } from '../ChatMemoryService';
import { ChatPlayerModelService } from '../ChatPlayerModelService';
import {
  createHelperInterventionMessage,
  createHaterEscalationMessage,
  createLegendMomentMessage,
  createQuoteCallbackMessage,
  createShadowAnnotation,
  createSystemMessage,
} from '../ChatMessageFactory';
import {
  createHaterResponseAuthority,
  type HaterResponseAuthority,
} from '../HaterResponseOrchestrator';
import {
  createHelperResponseAuthority,
  type HelperResponseAuthority,
} from '../HelperResponseOrchestrator';
import {
  ChatScenePlanner,
  type ChatScenePlannerDecisionWithTelemetry,
  type ChatScenePlannerConfig,
} from './ChatScenePlanner';

/* ========================================================================== *
 * MARK: Local structural aliases
 * ========================================================================== */

export type AuthoritativeChatState = any;
export type AuthoritativeChatRoom = any;
export type AuthoritativeChatMessage = any;

export type SharedChatChannelId = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'LOBBY';
export type SharedPressureTier = 'CALM' | 'WATCHFUL' | 'PRESSURED' | 'CRITICAL' | 'BREAKPOINT';
export type SharedEscalationTier = 'NONE' | 'MILD' | 'ACTIVE' | 'OBSESSIVE';
export type SharedMemoryAnchorType =
  | 'QUOTE'
  | 'BREACH'
  | 'RESCUE'
  | 'COMEBACK'
  | 'DEAL_ROOM'
  | 'SOVEREIGNTY'
  | 'HUMILIATION';

export interface SharedChatRelationshipVectorLocal {
  readonly respect: number;
  readonly fear: number;
  readonly contempt: number;
  readonly fascination: number;
  readonly trust: number;
  readonly familiarity: number;
  readonly rivalryIntensity: number;
  readonly rescueDebt: number;
  readonly adviceObedience: number;
}

export interface SharedChatRelationshipStateLocal {
  readonly relationshipId: string;
  readonly playerId: string;
  readonly counterpartId: string;
  readonly counterpartKind: string;
  readonly vector: SharedChatRelationshipVectorLocal;
  readonly lastMeaningfulShiftAt: number;
  readonly callbacksAvailable: readonly string[];
  readonly escalationTier: SharedEscalationTier;
}

export interface SharedChatMemoryAnchorLocal {
  readonly anchorId: string;
  readonly anchorType: SharedMemoryAnchorType;
  readonly roomId: string;
  readonly channelId: SharedChatChannelId;
  readonly messageIds: readonly string[];
  readonly salience: number;
  readonly createdAt: number;
  readonly embeddingKey?: string;
}

export interface SharedChatSceneLocal {
  readonly sceneId: string;
  readonly momentId: string;
  readonly momentType: SharedChatMomentType;
  readonly archetype: string;
  readonly primaryChannel: SharedChatChannelId;
  readonly beats: readonly ExtendedChatSceneBeat[];
  readonly startedAt: number;
  readonly expectedDurationMs: number;
  readonly allowPlayerComposerDuringScene: boolean;
  readonly cancellableByAuthoritativeEvent: boolean;
  readonly speakerOrder: readonly string[];
  readonly escalationPoints: readonly number[];
  readonly silenceWindowsMs: readonly number[];
  readonly callbackAnchorIds: readonly string[];
  readonly possibleBranchPoints: readonly string[];
  readonly planningTags: readonly string[];
  readonly stageMood?: string;
}

export type ExtendedChatSceneBeat = SharedChatSceneBeat & {
  readonly speakerId?: string;
  readonly channelId?: string;
  readonly tags?: readonly string[];
};

/* ========================================================================== *
 * MARK: Orchestrator contracts
 * ========================================================================== */

export interface ChatDramaLogger {
  debug(message: string, payload?: Record<string, unknown>): void;
  info(message: string, payload?: Record<string, unknown>): void;
  warn(message: string, payload?: Record<string, unknown>): void;
  error(message: string, payload?: Record<string, unknown>): void;
}

export interface ChatDramaMomentEnvelope {
  readonly playerId: string;
  readonly roomId: string;
  readonly primaryChannelId: string;
  readonly now: string;
  readonly momentId: string;
  readonly momentType: SharedChatMomentType;
  readonly state: AuthoritativeChatState;
  readonly room: AuthoritativeChatRoom;
  readonly causeEventId?: string;
  readonly pressureTier?: string;
  readonly candidateBotIds?: readonly string[];
  readonly helperIds?: readonly string[];
  readonly worldTags?: readonly string[];
  readonly pendingRevealPayloadIds?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export interface ChatDramaBeatDescriptor {
  readonly beat: ExtendedChatSceneBeat;
  readonly message?: AuthoritativeChatMessage;
  readonly shadowMessage?: AuthoritativeChatMessage;
  readonly speakerId?: string;
  readonly callbackAnchorIds: readonly string[];
  readonly tags: readonly string[];
  readonly authorityReceipt?: Readonly<Record<string, unknown>>;
}

export interface ChatDramaContextSnapshot {
  readonly relationshipSummary: any;
  readonly relationshipState: readonly SharedChatRelationshipStateLocal[];
  readonly playerModelSnapshot: any;
  readonly carryoverSummary: any;
  readonly memorySelections: readonly any[];
  readonly memoryAnchors: readonly SharedChatMemoryAnchorLocal[];
  readonly counterpartId?: string;
  readonly normalizedPrimaryChannel: SharedChatChannelId;
  readonly pressure01: number;
  readonly worldTags: readonly string[];
  readonly suggestedCallbackAnchorIds: readonly string[];
  readonly summaryLines: readonly string[];
}

export interface ChatDramaAuthorityPlans {
  readonly haterPlan: any;
  readonly helperPlan: any;
}

export interface ChatDramaTelemetryDigest {
  readonly pressure01: number;
  readonly relationshipPressure01: number;
  readonly rescueNeed01: number;
  readonly callbackOpportunity01: number;
  readonly crowdHeat01: number;
  readonly silencePreference01: number;
  readonly expectedDurationMs: number;
  readonly expectedVisibleBeats: number;
  readonly expectedShadowBeats: number;
  readonly stageMood: string;
  readonly archetype: string;
  readonly reasons: readonly string[];
  readonly witnessPressure01: number;
}

export interface ChatDramaBudget {
  readonly maxVisibleMessages: number;
  readonly maxShadowMessages: number;
  readonly allowCrowdVisible: boolean;
  readonly allowLegendInsertion: boolean;
  readonly allowRevealMessage: boolean;
  readonly allowReplyWindowReceipt: boolean;
}

export interface ChatDramaMaterializationDiagnostics {
  readonly normalizedNow: number;
  readonly contextWorldTags: readonly string[];
  readonly contextCounterpartId?: string;
  readonly plannerReasons: readonly string[];
  readonly telemetry: ChatDramaTelemetryDigest;
  readonly budget: ChatDramaBudget;
  readonly chosenArchiveTags: readonly string[];
  readonly effectiveCallbackAnchorIds: readonly string[];
  readonly authorityAccepted: {
    readonly hater: boolean;
    readonly helper: boolean;
  };
}

export interface ChatDramaMaterialization {
  readonly envelope: ChatDramaMomentEnvelope;
  readonly plannerDecision: ChatScenePlannerDecisionWithTelemetry;
  readonly scene: SharedChatSceneLocal;
  readonly archiveRecord: any;
  readonly visibleMessages: readonly AuthoritativeChatMessage[];
  readonly shadowMessages: readonly AuthoritativeChatMessage[];
  readonly beatDescriptors: readonly ChatDramaBeatDescriptor[];
  readonly chosenSpeakerIds: readonly string[];
  readonly chosenCallbackAnchorIds: readonly string[];
  readonly chosenTags: readonly string[];
  readonly diagnostics: ChatDramaMaterializationDiagnostics;
}

export interface ChatDramaOrchestratorConfig {
  readonly enableLegendPromotion: boolean;
  readonly enableRevealQuotes: boolean;
  readonly enableShadowAnnotations: boolean;
  readonly enableOutcomeArchival: boolean;
  readonly allowCrowdAsVisibleBeat: boolean;
  readonly enableAdaptiveBudgeting: boolean;
  readonly enableFallbackRevealAnchors: boolean;
  readonly enableSuppressionReceipts: boolean;
  readonly enableAuthorityMetadata: boolean;
  readonly enableWitnessEscalation: boolean;
  readonly enableSignatureHints: boolean;
  readonly maxVisibleMessages: number;
  readonly maxShadowMessages: number;
  readonly maxMemorySelections: number;
  readonly maxWorldTags: number;
  readonly maxSummaryLines: number;
  readonly maxArchiveAnnotationIds: number;
  readonly minLegendWitnessPressure01: number;
  readonly planner?: Partial<ChatScenePlannerConfig>;
}

const DEFAULT_CHAT_DRAMA_ORCHESTRATOR_CONFIG: ChatDramaOrchestratorConfig = {
  enableLegendPromotion: true,
  enableRevealQuotes: true,
  enableShadowAnnotations: true,
  enableOutcomeArchival: true,
  allowCrowdAsVisibleBeat: true,
  enableAdaptiveBudgeting: true,
  enableFallbackRevealAnchors: true,
  enableSuppressionReceipts: true,
  enableAuthorityMetadata: true,
  enableWitnessEscalation: true,
  enableSignatureHints: true,
  maxVisibleMessages: 8,
  maxShadowMessages: 12,
  maxMemorySelections: 6,
  maxWorldTags: 12,
  maxSummaryLines: 5,
  maxArchiveAnnotationIds: 24,
  minLegendWitnessPressure01: 0.9,
  planner: {},
};

/* ========================================================================== *
 * MARK: Default logger
 * ========================================================================== */

const defaultLogger: ChatDramaLogger = {
  debug(message, payload) {
    void message;
    void payload;
  },
  info(message, payload) {
    void message;
    void payload;
  },
  warn(message, payload) {
    void message;
    void payload;
  },
  error(message, payload) {
    console.error(message, payload);
  },
};

/* ========================================================================== *
 * MARK: Numeric / record utilities
 * ========================================================================== */

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function clampMinInt(value: number, floor: number): number {
  if (!Number.isFinite(value)) return floor;
  return Math.max(floor, Math.floor(value));
}

function clampRangeInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function safeNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function safeArray<T>(value: readonly T[] | T[] | null | undefined): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function uniq(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const next = String(value ?? '').trim();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

function uniqLimit(values: readonly string[], limit: number): readonly string[] {
  return uniq(values).slice(0, Math.max(0, limit));
}

function compactRecord<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    out[key] = entry;
  }
  return out as T;
}

function nowNumber(value: string): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function sceneReceiptLabel(scene: SharedChatSceneLocal): string {
  return `${scene.archetype}:${safeString(scene.stageMood, 'UNSPECIFIED')}:${scene.momentType}`;
}

function summarizePressure(pressureTier?: string): number {
  switch (String(pressureTier ?? '').toUpperCase()) {
    case 'CALM':
      return 0.1;
    case 'WATCHFUL':
      return 0.3;
    case 'PRESSURED':
      return 0.55;
    case 'CRITICAL':
      return 0.82;
    case 'BREAKPOINT':
      return 0.97;
    default:
      return 0.42;
  }
}

function inferWitnessPressure(telemetry: ChatDramaTelemetryDigest, context: ChatDramaContextSnapshot): number {
  const memoryLift = clamp01(context.memoryAnchors.length / Math.max(1, 4));
  const carryoverLift = clamp01(safeArray(context.carryoverSummary?.unresolvedSceneIds).length / 6);
  return clamp01(
    telemetry.pressure01 * 0.28 +
      telemetry.relationshipPressure01 * 0.18 +
      telemetry.callbackOpportunity01 * 0.12 +
      telemetry.crowdHeat01 * 0.22 +
      memoryLift * 0.1 +
      carryoverLift * 0.1,
  );
}

function dedupeMessages(messages: readonly AuthoritativeChatMessage[]): readonly AuthoritativeChatMessage[] {
  const seen = new Set<string>();
  const result: AuthoritativeChatMessage[] = [];

  for (const message of messages) {
    const id = String(message?.messageId ?? message?.id ?? '');
    const body = String(message?.text ?? message?.body ?? message?.bodyText ?? '');
    const key = id || `${message?.channelId ?? message?.channel ?? 'UNKNOWN'}::${body}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(message);
  }

  return result;
}

function toSharedChannelId(value: string): SharedChatChannelId {
  switch (String(value ?? '').toUpperCase()) {
    case 'GLOBAL':
      return 'GLOBAL';
    case 'SYNDICATE':
      return 'SYNDICATE';
    case 'DEAL_ROOM':
      return 'DEAL_ROOM';
    case 'LOBBY':
      return 'LOBBY';
    default:
      return 'GLOBAL';
  }
}

function toSharedPressureTier(value?: string): SharedPressureTier | undefined {
  switch (String(value ?? '').toUpperCase()) {
    case 'CALM':
      return 'CALM';
    case 'WATCHFUL':
      return 'WATCHFUL';
    case 'PRESSURED':
      return 'PRESSURED';
    case 'CRITICAL':
      return 'CRITICAL';
    case 'BREAKPOINT':
      return 'BREAKPOINT';
    default:
      return undefined;
  }
}

function inferMemoryAnchorType(entry: any, envelope: ChatDramaMomentEnvelope): SharedMemoryAnchorType {
  const explicit = String(entry?.anchorType ?? '').toUpperCase();
  if (
    explicit === 'QUOTE' ||
    explicit === 'BREACH' ||
    explicit === 'RESCUE' ||
    explicit === 'COMEBACK' ||
    explicit === 'DEAL_ROOM' ||
    explicit === 'SOVEREIGNTY' ||
    explicit === 'HUMILIATION'
  ) {
    return explicit as SharedMemoryAnchorType;
  }

  const tags = safeArray(entry?.tags).map((tag) => String(tag).toUpperCase());
  if (tags.some((tag) => tag.includes('RESCUE'))) return 'RESCUE';
  if (tags.some((tag) => tag.includes('SOVEREIGN'))) return 'SOVEREIGNTY';
  if (tags.some((tag) => tag.includes('DEAL'))) return 'DEAL_ROOM';
  if (tags.some((tag) => tag.includes('HUMILI'))) return 'HUMILIATION';
  if (tags.some((tag) => tag.includes('COMEBACK'))) return 'COMEBACK';
  if (String(envelope.momentType).includes('BREACH')) return 'BREACH';
  return 'QUOTE';
}

function inferEscalationTier(counterpart: any): SharedEscalationTier {
  const obsession = clamp01(safeNumber(counterpart?.obsession01, 0));
  const unfinished = clamp01(safeNumber(counterpart?.unfinishedBusiness01, 0));
  const predictive = clamp01(safeNumber(counterpart?.predictiveConfidence01, 0));
  const pressure = clamp01(obsession * 0.45 + unfinished * 0.35 + predictive * 0.2);

  if (pressure >= 0.86) return 'OBSESSIVE';
  if (pressure >= 0.58) return 'ACTIVE';
  if (pressure >= 0.3) return 'MILD';
  return 'NONE';
}

function buildRelationshipVector(counterpart: any, playerModelSnapshot: any): SharedChatRelationshipVectorLocal {
  const dominantAxes = safeArray(playerModelSnapshot?.dominantAxes).map((axis: any) => String(axis?.axis ?? axis));
  const rescueReliant = dominantAxes.includes('RESCUE_RELIANT') ? 0.1 : 0;
  const publicPerformer = dominantAxes.includes('PUBLIC_PERFORMER') ? 0.08 : 0;

  return {
    respect: clamp01(safeNumber(counterpart?.respect01, 0)),
    fear: clamp01(safeNumber(counterpart?.fear01, 0)),
    contempt: clamp01(safeNumber(counterpart?.contempt01, 0)),
    fascination: clamp01(safeNumber(counterpart?.predictiveConfidence01, 0) * 0.5 + safeNumber(counterpart?.intensity01, 0) * 0.5),
    trust: clamp01(1 - safeNumber(counterpart?.contempt01, 0) * 0.55 + rescueReliant),
    familiarity: clamp01(safeNumber(counterpart?.familiarity01, 0)),
    rivalryIntensity: clamp01(safeNumber(counterpart?.unfinishedBusiness01, 0) * 0.5 + safeNumber(counterpart?.obsession01, 0) * 0.5),
    rescueDebt: clamp01(safeNumber(counterpart?.respect01, 0) * 0.2 + rescueReliant),
    adviceObedience: clamp01(1 - safeNumber(counterpart?.contempt01, 0) * 0.3 + publicPerformer * 0.2),
  };
}

function relationshipSummariesToSceneState(
  summary: any,
  envelope: ChatDramaMomentEnvelope,
  playerModelSnapshot: any,
): readonly SharedChatRelationshipStateLocal[] {
  const counterparts = safeArray(summary?.counterparts);

  return counterparts
    .map((counterpart: any, index) => {
      const counterpartId = safeString(counterpart?.counterpartId, `counterpart:${index + 1}`);
      return {
        relationshipId: safeString(counterpart?.relationshipId, `rel:${envelope.playerId}:${counterpartId}`),
        playerId: envelope.playerId,
        counterpartId,
        counterpartKind: safeString(counterpart?.counterpartKind, 'NPC'),
        vector: buildRelationshipVector(counterpart, playerModelSnapshot),
        lastMeaningfulShiftAt: safeNumber(counterpart?.lastMeaningfulShiftAt, nowNumber(envelope.now)),
        callbacksAvailable: uniqLimit(
          [
            ...safeArray(counterpart?.callbacksAvailable).map((value) => String(value)),
            ...safeArray(counterpart?.callbackIds).map((value) => String(value)),
            ...safeArray(counterpart?.callbackAnchorIds).map((value) => String(value)),
          ],
          12,
        ),
        escalationTier: inferEscalationTier(counterpart),
      } satisfies SharedChatRelationshipStateLocal;
    })
    .filter((entry) => Boolean(entry.counterpartId));
}

function memoryAnchorToSceneAnchor(entry: any, envelope: ChatDramaMomentEnvelope): SharedChatMemoryAnchorLocal {
  const anchorId = safeString(entry?.anchorId ?? entry?.id, `anchor:${envelope.momentId}:${Math.random().toString(36).slice(2, 8)}`);
  const roomId = safeString(entry?.roomId, envelope.roomId);
  const channelId = toSharedChannelId(safeString(entry?.channelId, envelope.primaryChannelId));
  const messageIdCandidate = safeString(entry?.sourceMessageId ?? entry?.messageId, '');
  const messageIds = uniqLimit(
    [
      ...safeArray(entry?.messageIds).map((value) => String(value)),
      ...(messageIdCandidate ? [messageIdCandidate] : []),
    ],
    8,
  );

  return {
    anchorId,
    anchorType: inferMemoryAnchorType(entry, envelope),
    roomId,
    channelId,
    messageIds,
    salience: clamp01(
      typeof entry?.salience === 'number'
        ? entry.salience
        : typeof entry?.salience01 === 'number'
          ? entry.salience01
          : typeof entry?.score01 === 'number'
            ? entry.score01
            : 0.4,
    ),
    createdAt: safeNumber(entry?.createdAt, nowNumber(envelope.now)),
    embeddingKey: safeString(entry?.embeddingKey, undefined as unknown as string),
  };
}

function dominantWorldTagsFromPlayerModel(snapshot: any): readonly string[] {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const dominantAxes = safeArray(snapshot?.dominantAxes);
  const tags = dominantAxes.slice(0, 6).map((axis: any) => `PLAYER_MODEL:${String(axis?.axis ?? axis)}`);
  return uniq(tags);
}

function worldTagsFromCarryover(carryoverSummary: any): readonly string[] {
  const unresolved = safeArray(carryoverSummary?.unresolvedSceneIds).slice(0, 4).map((sceneId) => `UNRESOLVED:${String(sceneId)}`);
  const counterparts = safeArray(carryoverSummary?.activeCounterpartIds).slice(0, 4).map((counterpartId) => `COUNTERPART:${String(counterpartId)}`);
  return uniq([...unresolved, ...counterparts]);
}

function inferSignatureSuffix(speakerId?: string): string | undefined {
  if (!speakerId) return undefined;
  if (speakerId === 'CROWD') return undefined;
  if (speakerId.startsWith('CALLBACK:')) return 'The room heard that.';
  if (speakerId.startsWith('BOT_') || speakerId.includes('hater')) return 'Stay visible.';
  if (speakerId.includes('helper')) return 'Hold the line.';
  return undefined;
}

function withSignatureHint(text: string, speakerId: string | undefined, enabled: boolean): string {
  if (!enabled) return text;
  const suffix = inferSignatureSuffix(speakerId);
  if (!suffix) return text;
  if (text.endsWith(suffix)) return text;
  return `${text} ${suffix}`;
}

function selectCounterpartId(relationshipState: readonly SharedChatRelationshipStateLocal[]): string | undefined {
  return relationshipState[0]?.counterpartId;
}

function selectSuggestedCallbackAnchorIds(context: ChatDramaContextSnapshot, plannerDecision: ChatScenePlannerDecisionWithTelemetry): readonly string[] {
  return uniqLimit(
    [
      ...plannerDecision.chosenCallbackAnchorIds,
      ...safeArray((plannerDecision.plan as any)?.callbackAnchorIds).map((value) => String(value)),
      ...context.suggestedCallbackAnchorIds,
      ...context.relationshipState.flatMap((entry) => entry.callbacksAvailable),
      ...context.memoryAnchors.map((anchor) => anchor.anchorId),
    ],
    12,
  );
}

function extractSceneFromPlannerDecision(decision: ChatScenePlannerDecisionWithTelemetry): SharedChatSceneLocal {
  const plan = decision.plan as any;
  return {
    sceneId: safeString(plan?.sceneId, `scene:${Date.now()}`),
    momentId: safeString(plan?.momentId, 'moment:unknown'),
    momentType: plan?.momentType,
    archetype: safeString(plan?.archetype, 'BREACH_SCENE'),
    primaryChannel: toSharedChannelId(plan?.primaryChannel),
    beats: safeArray(plan?.beats) as readonly ExtendedChatSceneBeat[],
    startedAt: safeNumber(plan?.startedAt, Date.now()),
    expectedDurationMs: safeNumber(plan?.expectedDurationMs, 0),
    allowPlayerComposerDuringScene: Boolean(plan?.allowPlayerComposerDuringScene),
    cancellableByAuthoritativeEvent: Boolean(plan?.cancellableByAuthoritativeEvent),
    speakerOrder: safeArray(plan?.speakerOrder).map((value) => String(value)),
    escalationPoints: safeArray(plan?.escalationPoints).map((value) => safeNumber(value, 0)),
    silenceWindowsMs: safeArray(plan?.silenceWindowsMs).map((value) => safeNumber(value, 0)),
    callbackAnchorIds: safeArray(plan?.callbackAnchorIds).map((value) => String(value)),
    possibleBranchPoints: safeArray(plan?.possibleBranchPoints).map((value) => String(value)),
    planningTags: safeArray(plan?.planningTags).map((value) => String(value)),
    stageMood: safeString(decision.telemetry?.stageMood, undefined as unknown as string),
  };
}

function telemetryDigest(
  plannerDecision: ChatScenePlannerDecisionWithTelemetry,
  context: ChatDramaContextSnapshot,
): ChatDramaTelemetryDigest {
  const raw = plannerDecision.telemetry as any;
  const base: ChatDramaTelemetryDigest = {
    pressure01: clamp01(safeNumber(raw?.pressure01, context.pressure01)),
    relationshipPressure01: clamp01(safeNumber(raw?.relationshipPressure01, 0)),
    rescueNeed01: clamp01(safeNumber(raw?.rescueNeed01, 0)),
    callbackOpportunity01: clamp01(safeNumber(raw?.callbackOpportunity01, 0)),
    crowdHeat01: clamp01(safeNumber(raw?.crowdHeat01, 0)),
    silencePreference01: clamp01(safeNumber(raw?.silencePreference01, 0)),
    expectedDurationMs: clampMinInt(safeNumber(raw?.expectedDurationMs, 0), 0),
    expectedVisibleBeats: clampMinInt(safeNumber(raw?.expectedVisibleBeats, 0), 0),
    expectedShadowBeats: clampMinInt(safeNumber(raw?.expectedShadowBeats, 0), 0),
    stageMood: safeString(raw?.stageMood, 'UNSPECIFIED'),
    archetype: safeString(raw?.archetype, 'UNSPECIFIED'),
    reasons: safeArray(raw?.reasons).map((value) => String(value)),
    witnessPressure01: 0,
  };

  return {
    ...base,
    witnessPressure01: inferWitnessPressure(base, context),
  };
}

function adaptiveBudget(config: ChatDramaOrchestratorConfig, telemetry: ChatDramaTelemetryDigest): ChatDramaBudget {
  if (!config.enableAdaptiveBudgeting) {
    return {
      maxVisibleMessages: config.maxVisibleMessages,
      maxShadowMessages: config.maxShadowMessages,
      allowCrowdVisible: config.allowCrowdAsVisibleBeat,
      allowLegendInsertion: config.enableLegendPromotion,
      allowRevealMessage: config.enableRevealQuotes,
      allowReplyWindowReceipt: true,
    };
  }

  const visibleBoost = telemetry.pressure01 >= 0.82 ? 1 : telemetry.callbackOpportunity01 >= 0.6 ? 1 : 0;
  const shadowBoost = telemetry.silencePreference01 >= 0.58 ? 2 : telemetry.reasons.includes('SILENCE_IS_STRONGER') ? 1 : 0;
  const visible = clampRangeInt(config.maxVisibleMessages + visibleBoost, 3, config.maxVisibleMessages + 2);
  const shadow = clampRangeInt(config.maxShadowMessages + shadowBoost, 4, config.maxShadowMessages + 4);

  return {
    maxVisibleMessages: visible,
    maxShadowMessages: shadow,
    allowCrowdVisible: config.allowCrowdAsVisibleBeat && telemetry.crowdHeat01 >= 0.28,
    allowLegendInsertion: config.enableLegendPromotion && telemetry.witnessPressure01 >= config.minLegendWitnessPressure01,
    allowRevealMessage: config.enableRevealQuotes && telemetry.callbackOpportunity01 >= 0.16,
    allowReplyWindowReceipt: telemetry.pressure01 >= 0.3 || telemetry.silencePreference01 >= 0.45,
  };
}

function chooseBeatChannel(
  scene: SharedChatSceneLocal,
  beat: ExtendedChatSceneBeat,
  envelope: ChatDramaMomentEnvelope,
  fallback?: string,
): string {
  return safeString(beat.channelId, safeString(beat.requiredChannel, fallback ?? scene.primaryChannel ?? envelope.primaryChannelId));
}

function candidateText(prefix: string, scene: SharedChatSceneLocal, beat: ExtendedChatSceneBeat, extras?: string): string {
  const base = `${prefix} [${safeString(scene.stageMood, scene.archetype)}] [${scene.momentType}]`;
  return extras ? `${base} ${extras}` : base;
}

function systemLineForBeat(
  scene: SharedChatSceneLocal,
  beat: ExtendedChatSceneBeat,
  envelope: ChatDramaMomentEnvelope,
  telemetry: ChatDramaTelemetryDigest,
): string {
  switch (beat.beatType) {
    case 'SYSTEM_NOTICE':
      switch (scene.momentType) {
        case 'RUN_START':
          return telemetry.crowdHeat01 >= 0.45 ? 'Run live. The room is already leaning in.' : 'Run live. The room is watching.';
        case 'PRESSURE_SURGE':
          return telemetry.pressure01 >= 0.82
            ? 'Pressure spiking. Reply windows collapsing.'
            : 'Pressure rising. Reaction windows narrowing.';
        case 'SHIELD_BREACH':
          return telemetry.callbackOpportunity01 >= 0.5
            ? 'Shield breach confirmed. Prior receipts are surfacing.'
            : 'Shield breach confirmed. Exposure rising.';
        case 'CASCADE_TRIGGER':
          return 'Cascade vector detected. Stability compromised.';
        case 'CASCADE_BREAK':
          return 'Cascade broken. The room is recalculating.';
        case 'BOT_ATTACK':
          return 'Hostile pressure entering the lane.';
        case 'BOT_RETREAT':
          return 'Hostile pressure eased. The room noticed.';
        case 'HELPER_RESCUE':
          return telemetry.rescueNeed01 >= 0.65 ? 'Recovery vector opened under stress.' : 'Recovery vector opened.';
        case 'DEAL_ROOM_STANDOFF':
          return 'Deal room tone hardening.';
        case 'SOVEREIGN_APPROACH':
          return 'Sovereignty within reach. Margin for error collapsing.';
        case 'SOVEREIGN_ACHIEVED':
          return telemetry.witnessPressure01 >= 0.9 ? 'Sovereignty secured under witness.' : 'Sovereignty secured.';
        case 'LEGEND_MOMENT':
          return 'Legend condition recognized.';
        case 'RUN_END':
          return 'Run closed. Reckoning in progress.';
        case 'WORLD_EVENT':
          return 'World event intrusion detected.';
        default:
          return candidateText('SYSTEM', scene, beat);
      }

    case 'REVEAL':
      return telemetry.callbackOpportunity01 >= 0.55 ? 'The room remembers with receipts.' : 'The room remembers.';

    case 'POST_BEAT_ECHO':
      return telemetry.silencePreference01 >= 0.6 ? 'Echo preserved in the quiet.' : 'Echo preserved.';

    default:
      return candidateText('SYSTEM', scene, beat, `moment=${envelope.momentType}`);
  }
}

function haterLineForBeat(
  scene: SharedChatSceneLocal,
  beat: ExtendedChatSceneBeat,
  envelope: ChatDramaMomentEnvelope,
  relationshipSummary: any,
  telemetry: ChatDramaTelemetryDigest,
  haterPlan: any,
  enableSignatureHints: boolean,
): string {
  const counterpart = safeArray(relationshipSummary?.counterparts)[0];
  const unfinished = clamp01(safeNumber(counterpart?.unfinishedBusiness01, 0));
  const contempt = clamp01(safeNumber(counterpart?.contempt01, 0));
  const respect = clamp01(safeNumber(counterpart?.respect01, 0));
  const tactic = String(haterPlan?.tactic ?? 'UNKNOWN');

  if (scene.momentType === 'SHIELD_BREACH') {
    const line = unfinished > 0.6
      ? 'There it is. You always crack at the exact second you swear you will not.'
      : telemetry.callbackOpportunity01 >= 0.55
        ? 'Shield open. Everyone saw it, and the receipts are waking up.'
        : 'Shield open. Everyone saw it.';
    return withSignatureHint(line, beat.speakerId, enableSignatureHints);
  }

  if (scene.momentType === 'DEAL_ROOM_STANDOFF') {
    const line = contempt > 0.5
      ? 'You came in loud and now you are pricing your own panic.'
      : tactic === 'DEALROOM_THREAT'
        ? 'Your stall is information. In here, delay leaks value.'
        : 'Your stall is information.';
    return withSignatureHint(line, beat.speakerId, enableSignatureHints);
  }

  if (scene.momentType === 'SOVEREIGN_APPROACH') {
    const line = respect > 0.6
      ? 'Do not celebrate early. Earn the last move.'
      : 'So close. This is where you usually blink.';
    return withSignatureHint(line, beat.speakerId, enableSignatureHints);
  }

  if (scene.momentType === 'RUN_END') {
    const line = unfinished > 0.45
      ? 'You left work unfinished. Again.'
      : telemetry.witnessPressure01 >= 0.72
        ? 'That ending belongs to the room now. They will carry it.'
        : 'That ending belongs to the room now.';
    return withSignatureHint(line, beat.speakerId, enableSignatureHints);
  }

  return withSignatureHint(candidateText('HATER', scene, beat, `moment=${envelope.momentType};tactic=${tactic}`), beat.speakerId, enableSignatureHints);
}

function helperLineForBeat(
  scene: SharedChatSceneLocal,
  beat: ExtendedChatSceneBeat,
  envelope: ChatDramaMomentEnvelope,
  playerModelSnapshot: any,
  telemetry: ChatDramaTelemetryDigest,
  helperPlan: any,
  enableSignatureHints: boolean,
): string {
  const dominantAxes = safeArray(playerModelSnapshot?.dominantAxes).map((axis: any) => String(axis?.axis ?? axis));
  const collapseProne = dominantAxes.includes('COLLAPSE_PRONE');
  const rescueReliant = dominantAxes.includes('RESCUE_RELIANT');
  const publicPerformer = dominantAxes.includes('PUBLIC_PERFORMER');
  const urgency = safeNumber(helperPlan?.urgency?.finalUrgency01 ?? helperPlan?.urgency?.rescueWindow01, 0);

  if (scene.momentType === 'SHIELD_BREACH') {
    const line = collapseProne
      ? 'Stop defending your pride. Recover your footing first.'
      : urgency >= 0.7
        ? 'Reset one layer at a time. Do not feed the breach. Breathe before the next reply.'
        : 'Reset one layer at a time. Do not feed the breach.';
    return withSignatureHint(line, beat.speakerId, enableSignatureHints);
  }

  if (scene.momentType === 'DEAL_ROOM_STANDOFF') {
    const line = publicPerformer
      ? 'Say less. Silence raises their uncertainty.'
      : 'Hold your line and make them price the next move.';
    return withSignatureHint(line, beat.speakerId, enableSignatureHints);
  }

  if (scene.momentType === 'RUN_END') {
    const line = rescueReliant
      ? 'We keep the receipt, not the shame. Learn the turn and carry it forward.'
      : telemetry.callbackOpportunity01 >= 0.5
        ? 'Name the turning point and keep the lesson. The room will remember either way.'
        : 'Name the turning point and keep the lesson.';
    return withSignatureHint(line, beat.speakerId, enableSignatureHints);
  }

  return withSignatureHint(candidateText('HELPER', scene, beat, `moment=${envelope.momentType}`), beat.speakerId, enableSignatureHints);
}

function crowdLineForBeat(scene: SharedChatSceneLocal, beat: ExtendedChatSceneBeat, telemetry: ChatDramaTelemetryDigest): string {
  switch (scene.momentType) {
    case 'SHIELD_BREACH':
      return telemetry.callbackOpportunity01 >= 0.5 ? 'The channel tightens. Screenshots energy. Receipts energy.' : 'The channel tightens. Screenshots energy.';
    case 'SOVEREIGN_ACHIEVED':
      return telemetry.witnessPressure01 >= 0.9 ? 'The room flips from doubt to witness.' : 'The room turns and watches.';
    case 'LEGEND_MOMENT':
      return 'This one travels.';
    default:
      return candidateText('CROWD', scene, beat);
  }
}

function revealLineForBeat(
  scene: SharedChatSceneLocal,
  beat: ExtendedChatSceneBeat,
  callbackAnchorIds: readonly string[],
  summaryLines: readonly string[],
): string {
  if (!callbackAnchorIds.length) {
    return summaryLines[0] ? `The room remembers the pattern: ${summaryLines[0]}.` : 'The callback did not surface cleanly.';
  }

  const anchorId = callbackAnchorIds[0]!;

  switch (scene.momentType) {
    case 'SHIELD_BREACH':
      return `Receipt loaded from ${anchorId}. The room remembers your earlier confidence.`;
    case 'RUN_END':
      return `Receipt loaded from ${anchorId}. The ending rhymes with what came before.`;
    case 'SOVEREIGN_APPROACH':
      return `Receipt loaded from ${anchorId}. This is not the first time the room has seen this edge.`;
    default:
      return `Receipt loaded from ${anchorId}.`;
  }
}

function authorityReceipt(
  kind: 'HATER' | 'HELPER',
  plan: any,
  telemetry: ChatDramaTelemetryDigest,
): Readonly<Record<string, unknown>> {
  return compactRecord({
    kind,
    accepted: plan?.accepted !== false,
    channelId: plan?.channelId,
    tactic: plan?.tactic,
    urgency: plan?.urgency?.finalUrgency01,
    hostility: plan?.hostility?.finalHostility01,
    personaId: plan?.personaMatch?.persona?.personaId,
    reasons: safeArray(plan?.reasons),
    suppressionReasons: safeArray(plan?.suppression?.blockingReasons),
    witnessPressure01: telemetry.witnessPressure01,
  });
}

function buildSystemMessage(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatSceneLocal,
  beat: ExtendedChatSceneBeat,
  telemetry: ChatDramaTelemetryDigest,
): AuthoritativeChatMessage {
  const channelId = chooseBeatChannel(scene, beat, envelope);
  return createSystemMessage({} as any, {
    state: envelope.state,
    roomId: envelope.roomId,
    channelId,
    now: nowNumber(envelope.now),
    causeEventId: envelope.causeEventId ?? envelope.momentId,
    text: systemLineForBeat(scene, beat, envelope, telemetry),
    tags: uniq([
      'drama',
      'scene',
      'system',
      `moment:${String(envelope.momentType).toLowerCase()}`,
      `archetype:${String(scene.archetype).toLowerCase()}`,
      `beat:${String(beat.beatType).toLowerCase()}`,
    ]),
    metadata: compactRecord({
      momentId: envelope.momentId,
      momentType: envelope.momentType,
      sceneId: scene.sceneId,
      archetype: scene.archetype,
      stageMood: scene.stageMood,
      beatId: beat.beatId,
      beatType: beat.beatType,
      delayMs: beat.delayMs,
      requiredChannel: beat.requiredChannel,
      witnessPressure01: telemetry.witnessPressure01,
      plannerReasons: telemetry.reasons,
    }),
  } as any);
}

function buildHaterMessage(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatSceneLocal,
  beat: ExtendedChatSceneBeat,
  relationshipSummary: any,
  telemetry: ChatDramaTelemetryDigest,
  haterPlan: any,
  enableSignatureHints: boolean,
): AuthoritativeChatMessage {
  const channelId = safeString(haterPlan?.channelId, chooseBeatChannel(scene, beat, envelope));
  return createHaterEscalationMessage({} as any, {
    state: envelope.state,
    roomId: envelope.roomId,
    channelId,
    now: nowNumber(envelope.now) + safeNumber(beat.delayMs, 0),
    causeEventId: envelope.causeEventId ?? envelope.momentId,
    persona: {
      personaId: haterPlan?.personaMatch?.persona?.personaId ?? beat.speakerId,
      botId: haterPlan?.personaMatch?.persona?.botId ?? beat.speakerId,
      voiceprint: haterPlan?.personaMatch?.persona?.voiceprint ?? { closer: '' },
    },
    text: haterLineForBeat(scene, beat, envelope, relationshipSummary, telemetry, haterPlan, enableSignatureHints),
    escalationTier:
      scene.archetype === 'PUBLIC_HUMILIATION_SCENE'
        ? 'HARD'
        : scene.archetype === 'TRAP_SCENE'
          ? 'MEDIUM'
          : scene.momentType === 'SOVEREIGN_APPROACH'
            ? 'BOSS'
            : 'SOFT',
    attackWindowOpen:
      scene.momentType === 'BOT_ATTACK' ||
      scene.momentType === 'DEAL_ROOM_STANDOFF' ||
      telemetry.pressure01 >= 0.7,
    tags: uniq([
      'drama',
      'scene',
      'hater',
      ...(safeArray(haterPlan?.personaMatch?.persona?.tags).map((tag: unknown) => String(tag))),
      ...(safeArray(beat.tags).map((tag) => String(tag))),
      ...(telemetry.crowdHeat01 >= 0.65 ? ['crowd-heated'] : []),
    ]),
    metadata: compactRecord({
      momentId: envelope.momentId,
      momentType: envelope.momentType,
      sceneId: scene.sceneId,
      beatId: beat.beatId,
      beatType: beat.beatType,
      speakerId: beat.speakerId,
      stageMood: scene.stageMood,
      tactic: haterPlan?.tactic,
      personaId: haterPlan?.personaMatch?.persona?.personaId,
      hostility01: haterPlan?.hostility?.finalHostility01,
      escalationBand: haterPlan?.hostility?.escalationBand,
      authorityReasons: safeArray(haterPlan?.reasons),
      suppressionReasons: safeArray(haterPlan?.suppression?.blockingReasons),
    }),
  } as any);
}

function buildHelperMessage(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatSceneLocal,
  beat: ExtendedChatSceneBeat,
  playerModelSnapshot: any,
  telemetry: ChatDramaTelemetryDigest,
  helperPlan: any,
  enableSignatureHints: boolean,
): AuthoritativeChatMessage {
  const channelId = safeString(helperPlan?.channelId, chooseBeatChannel(scene, beat, envelope));
  return createHelperInterventionMessage({} as any, {
    state: envelope.state,
    roomId: envelope.roomId,
    channelId,
    now: nowNumber(envelope.now) + safeNumber(beat.delayMs, 0),
    causeEventId: envelope.causeEventId ?? envelope.momentId,
    persona: {
      personaId: helperPlan?.personaMatch?.persona?.personaId ?? beat.speakerId,
      botId: helperPlan?.personaMatch?.persona?.botId ?? beat.speakerId,
      voiceprint: helperPlan?.personaMatch?.persona?.voiceprint ?? { closer: '' },
    },
    text: helperLineForBeat(scene, beat, envelope, playerModelSnapshot, telemetry, helperPlan, enableSignatureHints),
    rescueReason:
      scene.momentType === 'SHIELD_BREACH'
        ? 'BREACH_RECOVERY'
        : scene.momentType === 'RUN_END'
          ? 'POST_RUN_DEBRIEF'
          : 'PRESSURE_RELIEF',
    recoveryWindowSuggested:
      scene.momentType === 'SHIELD_BREACH' ||
      scene.momentType === 'RUN_END' ||
      telemetry.rescueNeed01 >= 0.58,
    tags: uniq([
      'drama',
      'scene',
      'helper',
      ...(safeArray(helperPlan?.personaMatch?.persona?.tags).map((tag: unknown) => String(tag))),
      ...(safeArray(beat.tags).map((tag) => String(tag))),
      ...(telemetry.rescueNeed01 >= 0.65 ? ['urgent-rescue'] : []),
    ]),
    metadata: compactRecord({
      momentId: envelope.momentId,
      momentType: envelope.momentType,
      sceneId: scene.sceneId,
      beatId: beat.beatId,
      beatType: beat.beatType,
      speakerId: beat.speakerId,
      stageMood: scene.stageMood,
      urgency01: helperPlan?.urgency?.finalUrgency01,
      helperTactic: helperPlan?.urgency?.tactic,
      personaId: helperPlan?.personaMatch?.persona?.personaId,
      authorityReasons: safeArray(helperPlan?.reasons),
      suppressionReasons: safeArray(helperPlan?.suppression?.blockingReasons),
    }),
  } as any);
}

function buildRevealMessage(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatSceneLocal,
  beat: ExtendedChatSceneBeat,
  callbackAnchorIds: readonly string[],
  summaryLines: readonly string[],
  telemetry: ChatDramaTelemetryDigest,
): AuthoritativeChatMessage {
  const channelId = chooseBeatChannel(scene, beat, envelope);
  return createQuoteCallbackMessage({} as any, {
    state: envelope.state,
    roomId: envelope.roomId,
    channelId,
    now: nowNumber(envelope.now) + safeNumber(beat.delayMs, 0),
    causeEventId: envelope.causeEventId ?? envelope.momentId,
    persona: {
      personaId: beat.speakerId ?? 'persona:callback:room',
      botId: beat.speakerId ?? 'CALLBACK',
      voiceprint: { closer: '' },
    },
    text: revealLineForBeat(scene, beat, callbackAnchorIds, summaryLines),
    quotedMessageId: callbackAnchorIds[0] ?? envelope.momentId,
    quotedText: callbackAnchorIds[0] ? `Anchor ${callbackAnchorIds[0]}` : summaryLines[0] ?? 'No anchor',
    tags: uniq([
      'drama',
      'scene',
      'reveal',
      'callback',
      ...(telemetry.callbackOpportunity01 >= 0.5 ? ['high-opportunity'] : []),
      ...(safeArray(beat.tags).map((tag) => String(tag))),
    ]),
    metadata: compactRecord({
      momentId: envelope.momentId,
      momentType: envelope.momentType,
      sceneId: scene.sceneId,
      beatId: beat.beatId,
      beatType: beat.beatType,
      callbackAnchorIds,
      summaryLines,
    }),
  } as any);
}

function buildLegendMessage(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatSceneLocal,
  beat: ExtendedChatSceneBeat,
  telemetry: ChatDramaTelemetryDigest,
): AuthoritativeChatMessage {
  return createLegendMomentMessage({} as any, {
    state: envelope.state,
    roomId: envelope.roomId,
    channelId: chooseBeatChannel(scene, beat, envelope, scene.primaryChannel),
    now: nowNumber(envelope.now) + safeNumber(beat.delayMs, 0),
    causeEventId: envelope.causeEventId ?? envelope.momentId,
    text:
      scene.momentType === 'SOVEREIGN_ACHIEVED'
        ? telemetry.witnessPressure01 >= 0.9
          ? 'Sovereignty under pressure. The room seals this as legend.'
          : 'Sovereignty under pressure. This run enters legend state.'
        : 'Legend window captured.',
    legendId: `LEGEND:${envelope.momentId}`,
    sceneId: scene.sceneId,
    momentId: envelope.momentId,
    tags: uniq(['drama', 'scene', 'legend', ...(safeArray(beat.tags).map((tag) => String(tag)))]),
    metadata: compactRecord({
      momentType: envelope.momentType,
      beatId: beat.beatId,
      beatType: beat.beatType,
      witnessPressure01: telemetry.witnessPressure01,
    }),
  } as any);
}

function buildShadowReceipt(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatSceneLocal,
  beat: ExtendedChatSceneBeat,
  text: string,
  shadowTag: 'SYSTEM' | 'NPC' | 'RIVALRY' | 'RESCUE' | 'LIVEOPS',
  telemetry: ChatDramaTelemetryDigest,
  extraMetadata?: Record<string, unknown>,
): AuthoritativeChatMessage {
  return createShadowAnnotation({} as any, {
    state: envelope.state,
    roomId: envelope.roomId,
    channelId: chooseBeatChannel(scene, beat, envelope),
    now: nowNumber(envelope.now) + safeNumber(beat.delayMs, 0),
    causeEventId: envelope.causeEventId ?? envelope.momentId,
    text,
    shadowTag,
    tags: uniq([
      'drama',
      'scene',
      'shadow',
      shadowTag.toLowerCase(),
      ...(safeArray(beat.tags).map((tag) => String(tag))),
    ]),
    metadata: compactRecord({
      momentId: envelope.momentId,
      sceneId: scene.sceneId,
      beatId: beat.beatId,
      beatType: beat.beatType,
      archetype: scene.archetype,
      receipt: sceneReceiptLabel(scene),
      witnessPressure01: telemetry.witnessPressure01,
      plannerReasons: telemetry.reasons,
      ...extraMetadata,
    }),
  } as any);
}

function buildCrowdVisibleMessage(
  envelope: ChatDramaMomentEnvelope,
  scene: SharedChatSceneLocal,
  beat: ExtendedChatSceneBeat,
  telemetry: ChatDramaTelemetryDigest,
): AuthoritativeChatMessage {
  return createSystemMessage({} as any, {
    state: envelope.state,
    roomId: envelope.roomId,
    channelId: chooseBeatChannel(scene, beat, envelope),
    now: nowNumber(envelope.now) + safeNumber(beat.delayMs, 0),
    causeEventId: envelope.causeEventId ?? envelope.momentId,
    text: crowdLineForBeat(scene, beat, telemetry),
    tags: uniq(['drama', 'scene', 'crowd', ...(safeArray(beat.tags).map((tag) => String(tag)))]),
    metadata: {
      sceneId: scene.sceneId,
      beatId: beat.beatId,
      beatType: beat.beatType,
      crowd: true,
      crowdHeat01: telemetry.crowdHeat01,
    },
  } as any);
}

function createCanonicalDescriptor(
  beat: ExtendedChatSceneBeat,
  message: AuthoritativeChatMessage | undefined,
  shadowMessage: AuthoritativeChatMessage | undefined,
  callbackAnchorIds: readonly string[],
  authorityReceipt?: Readonly<Record<string, unknown>>,
): ChatDramaBeatDescriptor {
  return {
    beat,
    message,
    shadowMessage,
    speakerId: safeString(beat.speakerId, undefined as unknown as string),
    callbackAnchorIds,
    tags: uniqLimit(safeArray(beat.tags).map((tag) => String(tag)), 16),
    authorityReceipt,
  };
}

/* ========================================================================== *
 * MARK: Orchestrator
 * ========================================================================== */

export class ChatDramaOrchestrator {
  private readonly planner: ChatScenePlanner;
  private readonly archiveService: ChatSceneArchiveService;
  private readonly relationshipService: ChatRelationshipService;
  private readonly memoryService: ChatMemoryService;
  private readonly playerModelService: ChatPlayerModelService;
  private readonly haterAuthority: HaterResponseAuthority;
  private readonly helperAuthority: HelperResponseAuthority;
  private readonly logger: ChatDramaLogger;
  private readonly config: ChatDramaOrchestratorConfig;

  public constructor(args?: {
    planner?: ChatScenePlanner;
    archiveService?: ChatSceneArchiveService;
    relationshipService?: ChatRelationshipService;
    memoryService?: ChatMemoryService;
    playerModelService?: ChatPlayerModelService;
    haterAuthority?: HaterResponseAuthority;
    helperAuthority?: HelperResponseAuthority;
    logger?: ChatDramaLogger;
    config?: Partial<ChatDramaOrchestratorConfig>;
  }) {
    this.config = {
      ...DEFAULT_CHAT_DRAMA_ORCHESTRATOR_CONFIG,
      ...(args?.config ?? {}),
      planner: {
        ...DEFAULT_CHAT_DRAMA_ORCHESTRATOR_CONFIG.planner,
        ...(args?.config?.planner ?? {}),
      },
    };

    this.planner = args?.planner ?? new ChatScenePlanner(this.config.planner);
    this.archiveService = args?.archiveService ?? new ChatSceneArchiveService();
    this.relationshipService = args?.relationshipService ?? new ChatRelationshipService();
    this.memoryService = args?.memoryService ?? new ChatMemoryService();
    this.playerModelService = args?.playerModelService ?? new ChatPlayerModelService();
    this.haterAuthority = args?.haterAuthority ?? createHaterResponseAuthority();
    this.helperAuthority = args?.helperAuthority ?? createHelperResponseAuthority();
    this.logger = args?.logger ?? defaultLogger;
  }

  public planAndMaterialize(envelope: ChatDramaMomentEnvelope): ChatDramaMaterialization {
    const normalizedNow = nowNumber(envelope.now);
    const context = this.captureContext(envelope, normalizedNow);
    const plannerInput = this.buildPlannerInput(envelope, context, normalizedNow);
    const plannerDecision = this.planner.plan(plannerInput);
    const scene = extractSceneFromPlannerDecision(plannerDecision);
    const telemetry = telemetryDigest(plannerDecision, context);
    const budget = adaptiveBudget(this.config, telemetry);
    const authority = this.resolveAuthorityPlans(envelope, context, telemetry, normalizedNow);
    const callbackAnchorIds = this.resolveCallbackAnchorIds(context, plannerDecision, scene);

    const visibleMessages: AuthoritativeChatMessage[] = [];
    const shadowMessages: AuthoritativeChatMessage[] = [];
    const beatDescriptors: ChatDramaBeatDescriptor[] = [];

    for (const beat of scene.beats) {
      const descriptor = this.materializeBeat({
        envelope,
        scene,
        beat,
        plannerDecision,
        context,
        telemetry,
        budget,
        authority,
        callbackAnchorIds,
      });

      beatDescriptors.push(descriptor);

      if (descriptor.message && visibleMessages.length < budget.maxVisibleMessages) {
        visibleMessages.push(descriptor.message);
      }
      if (descriptor.shadowMessage && shadowMessages.length < budget.maxShadowMessages) {
        shadowMessages.push(descriptor.shadowMessage);
      }
    }

    this.injectLegendIfEligible({
      envelope,
      scene,
      telemetry,
      budget,
      visibleMessages,
    });

    const finalizedVisible = dedupeMessages(visibleMessages).slice(0, budget.maxVisibleMessages);
    const finalizedShadow = dedupeMessages(shadowMessages).slice(0, budget.maxShadowMessages);

    const archiveTags = uniqLimit(
      [
        ...plannerDecision.chosenTags,
        ...scene.planningTags,
        ...context.worldTags,
        ...telemetry.reasons.map((reason) => `planner:${String(reason).toLowerCase()}`),
      ],
      48,
    );

    const archiveRecord = this.archiveService.archiveScene(
      envelope.playerId,
      envelope.roomId,
      scene.primaryChannel,
      scene as any,
      {
        counterpartIds: uniqLimit(
          [
            ...plannerDecision.chosenSpeakerIds.filter((speakerId) => speakerId !== 'CROWD' && !String(speakerId).startsWith('CALLBACK:')),
            ...(context.counterpartId ? [context.counterpartId] : []),
          ],
          16,
        ),
        callbackAnchorIds,
        transcriptAnnotationIds: uniqLimit(
          finalizedVisible
            .map((message) => safeString(message?.messageId ?? message?.id, ''))
            .filter(Boolean),
          this.config.maxArchiveAnnotationIds,
        ),
        tags: archiveTags,
      } as any,
    );

    const diagnostics: ChatDramaMaterializationDiagnostics = {
      normalizedNow,
      contextWorldTags: context.worldTags,
      contextCounterpartId: context.counterpartId,
      plannerReasons: telemetry.reasons,
      telemetry,
      budget,
      chosenArchiveTags: archiveTags,
      effectiveCallbackAnchorIds: callbackAnchorIds,
      authorityAccepted: {
        hater: authority.haterPlan?.accepted !== false,
        helper: authority.helperPlan?.accepted !== false,
      },
    };

    this.logger.info('chat_drama_materialized', {
      playerId: envelope.playerId,
      roomId: envelope.roomId,
      momentId: envelope.momentId,
      momentType: envelope.momentType,
      sceneId: scene.sceneId,
      archetype: scene.archetype,
      stageMood: scene.stageMood,
      visibleMessageCount: finalizedVisible.length,
      shadowMessageCount: finalizedShadow.length,
      callbackAnchorIds,
      budget,
      telemetry,
    });

    return {
      envelope,
      plannerDecision,
      scene,
      archiveRecord,
      visibleMessages: finalizedVisible,
      shadowMessages: finalizedShadow,
      beatDescriptors,
      chosenSpeakerIds: plannerDecision.chosenSpeakerIds,
      chosenCallbackAnchorIds: callbackAnchorIds,
      chosenTags: archiveTags,
      diagnostics,
    };
  }

  public appendOutcome(playerId: string, sceneId: string, outcome: string): any {
    if (!this.config.enableOutcomeArchival) return undefined;
    return this.archiveService.appendOutcome(playerId, sceneId, {
      outcomeKind: 'COMPLETED',
      resolvedAt: Date.now(),
      summary: outcome,
      generatedTags: [`outcome:${String(outcome).slice(0, 48)}`],
    } as any);
  }

  public buildCarryoverSummary(playerId: string): any {
    return this.archiveService.buildCarryoverSummary(playerId);
  }

  private captureContext(envelope: ChatDramaMomentEnvelope, normalizedNow: number): ChatDramaContextSnapshot {
    const relationshipSummary = this.relationshipService.summarize(envelope.playerId);
    const playerModelSnapshot = this.playerModelService.getSnapshot(envelope.playerId);
    const carryoverSummary = this.archiveService.buildCarryoverSummary(envelope.playerId);
    const relationshipState = relationshipSummariesToSceneState(relationshipSummary, envelope, playerModelSnapshot);
    const counterpartId = selectCounterpartId(relationshipState);

    const memorySelections = safeArray(
      this.memoryService.selectCallbacks({
        playerId: envelope.playerId,
        roomId: envelope.roomId,
        channelId: envelope.primaryChannelId,
        counterpartId,
        limit: this.config.maxMemorySelections,
        minSalience01: summarizePressure(envelope.pressureTier) > 0.8 ? 0.25 : 0.4,
      } as any),
    );

    const memoryAnchors = memorySelections.map((entry) => memoryAnchorToSceneAnchor(entry, envelope));
    const normalizedPrimaryChannel = toSharedChannelId(envelope.primaryChannelId);
    const pressure01 = summarizePressure(envelope.pressureTier);
    const worldTags = uniqLimit(
      [
        ...safeArray(envelope.worldTags).map((tag) => String(tag)),
        ...dominantWorldTagsFromPlayerModel(playerModelSnapshot),
        ...worldTagsFromCarryover(carryoverSummary),
      ],
      this.config.maxWorldTags,
    );

    return {
      relationshipSummary,
      relationshipState,
      playerModelSnapshot,
      carryoverSummary,
      memorySelections,
      memoryAnchors,
      counterpartId,
      normalizedPrimaryChannel,
      pressure01,
      worldTags,
      suggestedCallbackAnchorIds: uniqLimit(
        [
          ...safeArray(carryoverSummary?.suggestedCallbackAnchorIds).map((value) => String(value)),
          ...relationshipState.flatMap((entry) => entry.callbacksAvailable),
          ...memoryAnchors.map((anchor) => anchor.anchorId),
        ],
        16,
      ),
      summaryLines: uniqLimit(
        safeArray(carryoverSummary?.summaryLines).map((line) => String(line)),
        this.config.maxSummaryLines,
      ),
    };
  }

  private buildPlannerInput(
    envelope: ChatDramaMomentEnvelope,
    context: ChatDramaContextSnapshot,
    normalizedNow: number,
  ): SharedChatScenePlannerInput {
    return {
      playerId: envelope.playerId,
      roomId: envelope.roomId,
      now: normalizedNow,
      momentId: envelope.momentId,
      momentType: envelope.momentType,
      primaryChannel: context.normalizedPrimaryChannel as any,
      pressureTier: toSharedPressureTier(envelope.pressureTier) as any,
      relationshipState: context.relationshipState as any,
      memoryAnchors: context.memoryAnchors as any,
      unresolvedMomentIds: safeArray(context.carryoverSummary?.unresolvedSceneIds).map((value) => String(value)),
      carriedPersonaIds: uniqLimit(
        [
          ...safeArray(context.carryoverSummary?.activeCounterpartIds).map((value) => String(value)),
          ...safeArray(envelope.candidateBotIds).map((value) => String(value)),
          ...safeArray(envelope.helperIds).map((value) => String(value)),
        ],
        16,
      ),
      pendingRevealPayloadIds: safeArray(envelope.pendingRevealPayloadIds).map((value) => String(value)),
      candidateBotIds: safeArray(envelope.candidateBotIds).map((value) => String(value)),
      helperIds: safeArray(envelope.helperIds).map((value) => String(value)),
      worldTags: context.worldTags,
    } satisfies SharedChatScenePlannerInput;
  }

  private resolveAuthorityPlans(
    envelope: ChatDramaMomentEnvelope,
    context: ChatDramaContextSnapshot,
    telemetry: ChatDramaTelemetryDigest,
    normalizedNow: number,
  ): ChatDramaAuthorityPlans {
    const haterPlan = this.haterAuthority.plan(
      this.mapMomentToHaterTrigger(envelope, context, telemetry, normalizedNow),
    );
    const helperPlan = this.helperAuthority.plan(
      this.mapMomentToHelperTrigger(envelope, context, telemetry, normalizedNow),
    );

    return { haterPlan, helperPlan };
  }

  private resolveCallbackAnchorIds(
    context: ChatDramaContextSnapshot,
    plannerDecision: ChatScenePlannerDecisionWithTelemetry,
    scene: SharedChatSceneLocal,
  ): readonly string[] {
    const resolved = selectSuggestedCallbackAnchorIds(context, plannerDecision);
    if (resolved.length > 0) return resolved;
    if (!this.config.enableFallbackRevealAnchors) return [];
    return uniqLimit(scene.callbackAnchorIds, 8);
  }

  private injectLegendIfEligible(args: {
    envelope: ChatDramaMomentEnvelope;
    scene: SharedChatSceneLocal;
    telemetry: ChatDramaTelemetryDigest;
    budget: ChatDramaBudget;
    visibleMessages: AuthoritativeChatMessage[];
  }): void {
    const { envelope, scene, telemetry, budget, visibleMessages } = args;
    if (!budget.allowLegendInsertion) return;
    if (scene.momentType !== 'SOVEREIGN_ACHIEVED' && scene.momentType !== 'LEGEND_MOMENT') return;
    if (visibleMessages.length >= budget.maxVisibleMessages) return;

    const legendBeat =
      scene.beats.find((beat) => beat.beatType === 'POST_BEAT_ECHO') ?? scene.beats[scene.beats.length - 1];
    if (!legendBeat) return;

    visibleMessages.push(buildLegendMessage(envelope, scene, legendBeat, telemetry));
  }

  private materializeBeat(args: {
    envelope: ChatDramaMomentEnvelope;
    scene: SharedChatSceneLocal;
    beat: ExtendedChatSceneBeat;
    plannerDecision: ChatScenePlannerDecisionWithTelemetry;
    context: ChatDramaContextSnapshot;
    telemetry: ChatDramaTelemetryDigest;
    budget: ChatDramaBudget;
    authority: ChatDramaAuthorityPlans;
    callbackAnchorIds: readonly string[];
  }): ChatDramaBeatDescriptor {
    const { envelope, scene, beat, context, telemetry, budget, authority, callbackAnchorIds } = args;

    let message: AuthoritativeChatMessage | undefined;
    let shadowMessage: AuthoritativeChatMessage | undefined;
    let receipt: Readonly<Record<string, unknown>> | undefined;

    switch (beat.beatType) {
      case 'SYSTEM_NOTICE': {
        message = buildSystemMessage(envelope, scene, beat, telemetry);
        if (this.config.enableShadowAnnotations) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            `System established ${sceneReceiptLabel(scene)}.`,
            'SYSTEM',
            telemetry,
          );
        }
        break;
      }

      case 'HATER_ENTRY': {
        receipt = authorityReceipt('HATER', authority.haterPlan, telemetry);
        if (authority.haterPlan?.accepted !== false) {
          message = buildHaterMessage(
            envelope,
            scene,
            beat,
            context.relationshipSummary,
            telemetry,
            authority.haterPlan,
            this.config.enableSignatureHints,
          );
          if (this.config.enableShadowAnnotations) {
            shadowMessage = buildShadowReceipt(
              envelope,
              scene,
              beat,
              `Hater authority accepted with tactic=${String(authority.haterPlan?.tactic ?? 'UNKNOWN')}.`,
              'RIVALRY',
              telemetry,
              this.config.enableAuthorityMetadata ? { authority: receipt } : undefined,
            );
          }
        } else if (this.config.enableSuppressionReceipts) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            `Hater authority suppressed: ${safeArray(authority.haterPlan?.suppression?.blockingReasons).join(',') || 'no reason emitted'}.`,
            'RIVALRY',
            telemetry,
            this.config.enableAuthorityMetadata ? { authority: receipt } : undefined,
          );
        }
        break;
      }

      case 'CROWD_SWARM': {
        if (budget.allowCrowdVisible) {
          message = buildCrowdVisibleMessage(envelope, scene, beat, telemetry);
        }
        if (this.config.enableShadowAnnotations) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            `Crowd heat reflected in ${String(chooseBeatChannel(scene, beat, envelope))}.`,
            'SYSTEM',
            telemetry,
            { crowdHeat01: telemetry.crowdHeat01 },
          );
        }
        break;
      }

      case 'HELPER_INTERVENTION': {
        receipt = authorityReceipt('HELPER', authority.helperPlan, telemetry);
        if (authority.helperPlan?.accepted !== false) {
          message = buildHelperMessage(
            envelope,
            scene,
            beat,
            context.playerModelSnapshot,
            telemetry,
            authority.helperPlan,
            this.config.enableSignatureHints,
          );
          if (this.config.enableShadowAnnotations) {
            shadowMessage = buildShadowReceipt(
              envelope,
              scene,
              beat,
              `Helper authority accepted with urgency=${String(authority.helperPlan?.urgency?.finalUrgency01 ?? authority.helperPlan?.urgency ?? 'UNKNOWN')}.`,
              'RESCUE',
              telemetry,
              this.config.enableAuthorityMetadata ? { authority: receipt } : undefined,
            );
          }
        } else if (this.config.enableSuppressionReceipts) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            `Helper authority suppressed: ${safeArray(authority.helperPlan?.suppression?.blockingReasons).join(',') || 'no reason emitted'}.`,
            'RESCUE',
            telemetry,
            this.config.enableAuthorityMetadata ? { authority: receipt } : undefined,
          );
        }
        break;
      }

      case 'PLAYER_REPLY_WINDOW': {
        if (this.config.enableShadowAnnotations && budget.allowReplyWindowReceipt) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            'Reply window opened for player choice.',
            'SYSTEM',
            telemetry,
            { allowPlayerComposerDuringScene: scene.allowPlayerComposerDuringScene },
          );
        }
        break;
      }

      case 'SILENCE': {
        if (this.config.enableShadowAnnotations) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            `Intentional silence held for ${String(beat.delayMs ?? 0)}ms.`,
            'SYSTEM',
            telemetry,
            { silencePreference01: telemetry.silencePreference01 },
          );
        }
        break;
      }

      case 'REVEAL': {
        if (budget.allowRevealMessage) {
          message = buildRevealMessage(
            envelope,
            scene,
            beat,
            callbackAnchorIds,
            context.summaryLines,
            telemetry,
          );
        }
        if (this.config.enableShadowAnnotations) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            `Reveal attempted with anchors=${callbackAnchorIds.join(',') || 'NONE'}.`,
            'NPC',
            telemetry,
          );
        }
        break;
      }

      case 'POST_BEAT_ECHO': {
        if (
          (scene.momentType === 'SOVEREIGN_ACHIEVED' || scene.momentType === 'LEGEND_MOMENT') &&
          this.config.enableLegendPromotion &&
          telemetry.witnessPressure01 >= this.config.minLegendWitnessPressure01
        ) {
          message = buildLegendMessage(envelope, scene, beat, telemetry);
        } else {
          message = buildSystemMessage(envelope, scene, beat, telemetry);
        }

        if (this.config.enableShadowAnnotations) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            'Post-beat echo preserved for continuity.',
            'SYSTEM',
            telemetry,
          );
        }
        break;
      }

      default: {
        this.logger.warn('chat_drama_unknown_beat', {
          beatType: (beat as any)?.beatType,
          beatId: (beat as any)?.beatId,
          sceneId: scene.sceneId,
        });
        if (this.config.enableShadowAnnotations) {
          shadowMessage = buildShadowReceipt(
            envelope,
            scene,
            beat,
            `Unknown beat ignored: ${String((beat as any)?.beatType ?? 'UNKNOWN')}.`,
            'SYSTEM',
            telemetry,
          );
        }
        break;
      }
    }

    return createCanonicalDescriptor(beat, message, shadowMessage, callbackAnchorIds, receipt);
  }

  private mapMomentToHaterTrigger(
    envelope: ChatDramaMomentEnvelope,
    context: ChatDramaContextSnapshot,
    telemetry: ChatDramaTelemetryDigest,
    normalizedNow: number,
  ): any {
    const signal = compactRecord({
      pressure01: context.pressure01,
      witnessPressure01: telemetry.witnessPressure01,
      callbackOpportunity01: telemetry.callbackOpportunity01,
      crowdHeat01: telemetry.crowdHeat01,
      worldTags: context.worldTags,
      counterpartId: context.counterpartId,
      summaryLines: context.summaryLines,
    });

    return {
      kind:
        envelope.momentType === 'DEAL_ROOM_STANDOFF'
          ? 'ECONOMY_SIGNAL'
          : envelope.momentType === 'RUN_END'
            ? 'RUN_SIGNAL'
            : envelope.momentType === 'BOT_ATTACK' || envelope.momentType === 'SHIELD_BREACH'
              ? 'BATTLE_SIGNAL'
              : envelope.momentType === 'WORLD_EVENT'
                ? 'LIVEOPS_SIGNAL'
                : 'AMBIENT_MAINTENANCE',
      state: envelope.state,
      room: envelope.room,
      now: normalizedNow,
      causeEventId: envelope.causeEventId ?? envelope.momentId,
      signal,
      preferredChannelId: envelope.primaryChannelId,
      metadata: compactRecord({
        momentId: envelope.momentId,
        momentType: envelope.momentType,
        pressureTier: envelope.pressureTier,
        plannerWorldTags: context.worldTags,
        counterpartId: context.counterpartId,
        suggestedCallbackAnchorIds: context.suggestedCallbackAnchorIds,
        ...envelope.metadata,
      }),
    };
  }

  private mapMomentToHelperTrigger(
    envelope: ChatDramaMomentEnvelope,
    context: ChatDramaContextSnapshot,
    telemetry: ChatDramaTelemetryDigest,
    normalizedNow: number,
  ): any {
    return {
      kind:
        envelope.momentType === 'HELPER_RESCUE'
          ? 'RECOVERY_EVENT'
          : envelope.momentType === 'RUN_END'
            ? 'RUN_EVENT'
            : envelope.momentType === 'SHIELD_BREACH'
              ? 'ENGINE_EVENT'
              : 'SYSTEM_EVENT',
      state: envelope.state,
      room: envelope.room,
      now: normalizedNow,
      causeEventId: envelope.causeEventId ?? envelope.momentId,
      signal: compactRecord({
        pressure01: context.pressure01,
        witnessPressure01: telemetry.witnessPressure01,
        rescueNeed01: telemetry.rescueNeed01,
        silencePreference01: telemetry.silencePreference01,
        dominantAxes: context.playerModelSnapshot?.dominantAxes,
        summaryLines: context.summaryLines,
      }),
      playerMessage: null,
      preferredChannelId: envelope.primaryChannelId,
      metadata: compactRecord({
        momentId: envelope.momentId,
        momentType: envelope.momentType,
        pressureTier: envelope.pressureTier,
        counterpartId: context.counterpartId,
        worldTags: context.worldTags,
        suggestedCallbackAnchorIds: context.suggestedCallbackAnchorIds,
        ...envelope.metadata,
      }),
    };
  }
}

/* ========================================================================== *
 * MARK: Factory
 * ========================================================================== */

export function createChatDramaOrchestrator(args?: {
  planner?: ChatScenePlanner;
  archiveService?: ChatSceneArchiveService;
  relationshipService?: ChatRelationshipService;
  memoryService?: ChatMemoryService;
  playerModelService?: ChatPlayerModelService;
  haterAuthority?: HaterResponseAuthority;
  helperAuthority?: HelperResponseAuthority;
  logger?: ChatDramaLogger;
  config?: Partial<ChatDramaOrchestratorConfig>;
}): ChatDramaOrchestrator {
  return new ChatDramaOrchestrator(args);
}
