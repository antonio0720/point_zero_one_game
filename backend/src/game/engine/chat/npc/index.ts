/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT BOT PERSONA EVOLUTION SERVICE
 * FILE: backend/src/game/engine/chat/npc/ChatBotPersonaEvolutionService.ts
 * ============================================================================
 *
 * Deep backend service wrapper over the canonical frontend persona evolution runtime.
 *
 * Design goals
 * ------------
 * 1. Preserve the authored runtime as the source of final evolution projection truth.
 * 2. Make backend usage materially richer: audits, caching, batching, receipts, boards,
 *    manifests, health snapshots, heat maps, and replayable projection analytics.
 * 3. Use the imported shared contract surfaces in actual execution paths, not only in
 *    pass-through signatures.
 * 4. Stay defensive with unknown contract shapes by treating imported structures as
 *    opaque records unless the runtime contract plainly exposes values at execution time.
 */

import type {
  ChatPersonaEvolutionEvent as RawChatPersonaEvolutionEvent,
  ChatPersonaEvolutionSignal as RawChatPersonaEvolutionSignal,
  ChatPersonaEvolutionSnapshot as RawChatPersonaEvolutionSnapshot,
} from '../../../../../../shared/contracts/chat/persona-evolution';
import type { ChatPlayerFingerprintSnapshot as RawChatPlayerFingerprintSnapshot } from '../../../../../../shared/contracts/chat/player-fingerprint';
import type { ChatLiveOpsOverlayContext as RawChatLiveOpsOverlayContext } from '../../../../../../shared/contracts/chat/liveops';
import type { ChatRelationshipSummaryView as RawChatRelationshipSummaryView } from '../../../../../../shared/contracts/chat/relationship';
import {
  ChatBotPersonaEvolution,
  type ChatBotPersonaEvolutionProjectionRequest,
} from '../../../../../../pzo-web/src/engines/chat/npc/ChatBotPersonaEvolution';

export type ChatPlayerFingerprintSnapshot = RawChatPlayerFingerprintSnapshot;
export type ChatLiveOpsOverlayContext = RawChatLiveOpsOverlayContext;
export type ChatRelationshipSummaryView = RawChatRelationshipSummaryView;

export type ChatPersonaStageId =
  | 'DORMANT'
  | 'SEED'
  | 'CURIOUS'
  | 'RIVALRIC'
  | 'ASCENDANT'
  | 'MYTHIC'
  | 'SOVEREIGN'
  | (string & {});

export interface ChatPersonaEvolutionEvent extends Omit<RawChatPersonaEvolutionEvent, 'eventType'> {
  readonly eventType?: string;
  readonly kind?: string;
  readonly type?: string;
  readonly channelId?: string | null;
  readonly mode?: string;
  readonly intensity01?: number;
  readonly pressureBand?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ChatPersonaEvolutionSignal extends Omit<RawChatPersonaEvolutionSignal, 'stage' | 'temperament' | 'transformBiases'> {
  readonly stage: ChatPersonaStageId;
  readonly temperament: string;
  readonly callbackAggression01: number;
  readonly transformBiases: readonly string[];
  readonly selectionBias01: number;
  readonly callbackAppetite01?: number;
  readonly publicPressure01?: number;
  readonly privatePressure01?: number;
  readonly mythBias01?: number;
  readonly volatility01?: number;
}

export type ChatPersonaEvolutionSnapshot = RawChatPersonaEvolutionSnapshot;

export interface ChatPersonaEvolutionProfile {
  readonly botId: string;
  readonly playerId: string | null;
  readonly stage: ChatPersonaStageId;
  readonly signal: ChatPersonaEvolutionSignal;
  readonly updatedAt: number;
  readonly aggression01: number;
  readonly respect01: number;
  readonly callbackAppetite01: number;
  readonly publicPressure01: number;
  readonly privatePressure01: number;
  readonly mythBias01: number;
  readonly volatility01: number;
  readonly eventCount: number;
  readonly projectionCount: number;
}

export interface EvolutionBatchObserveInput {
  readonly events: readonly ChatPersonaEvolutionEvent[];
  readonly captureAudit?: boolean;
}

export interface EvolutionStageTransitionRecord {
  readonly transitionId: string;
  readonly botId: string;
  readonly playerId: string | null;
  readonly fromStage: ChatPersonaStageId | null;
  readonly toStage: ChatPersonaStageId;
  readonly transitionedAt: number;
  readonly reason: string;
}

export interface BotEvolutionStats {
  readonly botId: string;
  readonly profilesTracked: number;
  readonly eventCount: number;
  readonly projectionCount: number;
  readonly currentStage: ChatPersonaStageId;
  readonly stageCounts: Readonly<Record<string, number>>;
  readonly averages: Readonly<Record<string, number>>;
}

export interface EvolutionSystemStats {
  readonly totalProfiles: number;
  readonly totalBots: number;
  readonly totalPlayers: number;
  readonly totalEvents: number;
  readonly totalProjections: number;
  readonly stageCounts: Readonly<Record<string, number>> & { readonly MYTHIC: number; readonly RIVALRIC: number };
  readonly health: PersonaEvolutionHealth;
}

export interface PersonaInsight {
  readonly botId: string;
  readonly playerId: string | null;
  readonly stage: ChatPersonaStageId;
  readonly temperament: string;
  readonly objective: string;
  readonly aggression01: number;
  readonly respect01: number;
  readonly callbackAggression01: number;
  readonly selectionBias01: number;
  readonly recommendedTone: string;
  readonly tags: readonly string[];
}

export interface BotCounterplayHint {
  readonly botId: string;
  readonly playerId: string;
  readonly stage: ChatPersonaStageId;
  readonly title: string;
  readonly summary: string;
  readonly tactics: readonly string[];
}

export interface EvolutionServiceCompactSnapshot {
  readonly generatedAt: number;
  readonly snapshot: ChatPersonaEvolutionSnapshot;
  readonly health: PersonaEvolutionHealthSnapshot;
  readonly manifest: PersonaEvolutionManifest;
  readonly transitions: readonly EvolutionStageTransitionRecord[];
}

export type EvolutionBatchObserveResult = PersonaEvolutionObserveBatchResult & {
  readonly profiles: readonly ChatPersonaEvolutionProfile[];
  readonly audit?: PersonaEvolutionServiceAudit | null;
};

export type EvolutionBatchProjectResult = PersonaEvolutionProjectBatchResult;
export type EvolutionProjectionInput = ChatBotPersonaEvolutionProjectInput;

// ============================================================================
// INTERNAL TYPES
// ============================================================================

export type PersonaEvolutionMode = 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM' | 'LOBBY' | 'POST_RUN' | 'UNKNOWN';
export type PersonaEvolutionChannelClass = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'DIRECT' | 'LOBBY' | 'SYSTEM' | 'PRIVATE' | 'UNKNOWN';
export type PersonaEvolutionHealth = 'COLD' | 'WARM' | 'HOT' | 'SATURATED' | 'DEGRADED';
export type PersonaEvolutionLifecycle = 'IDLE' | 'OBSERVING' | 'PROJECTING' | 'PRUNING' | 'RESETTING';
export type PersonaEvolutionCachePolicy = 'NONE' | 'REQUEST' | 'BOT' | 'PLAYER' | 'BOT_PLAYER';
export type PersonaEvolutionRiskBand = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ChatBotPersonaEvolutionServiceClock {
  now(): number;
}

export interface ChatBotPersonaEvolutionServiceOptions {
  readonly maxEventHistoryPerBot?: number;
  readonly maxProjectionHistoryPerBot?: number;
  readonly maxSignalHistoryPerBot?: number;
  readonly maxPlayerHistory?: number;
  readonly maxChannelHistory?: number;
  readonly maxAuditTrail?: number;
  readonly maxRequestCacheEntries?: number;
  readonly cacheTtlMs?: number;
  readonly cachePolicy?: PersonaEvolutionCachePolicy;
  readonly retainSnapshots?: boolean;
  readonly retainSignals?: boolean;
  readonly enableRequestNormalization?: boolean;
  readonly enableAuditDigest?: boolean;
  readonly enableProjectionBoards?: boolean;
  readonly enableSignalBoards?: boolean;
  readonly enableEventBoards?: boolean;
  readonly enableHealthTracking?: boolean;
  readonly enableCounterTracking?: boolean;
}

export interface ChatBotPersonaEvolutionProjectInput {
  readonly botId: string;
  readonly playerId?: string | null;
  readonly now: number;
  readonly channelId?: string | null;
  readonly fingerprint?: ChatPlayerFingerprintSnapshot | null;
  readonly relationship?: ChatRelationshipSummaryView | null;
  readonly overlay?: ChatLiveOpsOverlayContext | null;
  readonly traceId?: string;
  readonly modeHint?: PersonaEvolutionMode;
  readonly forceRefresh?: boolean;
  readonly tags?: readonly string[];
  readonly contextLabel?: string;
}

export interface ChatBotPersonaEvolutionObserveReceipt {
  readonly receiptId: string;
  readonly botId: string;
  readonly eventId: string;
  readonly playerId: string | null;
  readonly observedAt: number;
  readonly channelClass: PersonaEvolutionChannelClass;
  readonly mode: PersonaEvolutionMode;
  readonly tags: readonly string[];
  readonly runtimeResult: unknown;
}

export interface ChatBotPersonaEvolutionProjectReceipt {
  readonly receiptId: string;
  readonly requestId: string;
  readonly botId: string;
  readonly playerId: string | null;
  readonly projectedAt: number;
  readonly mode: PersonaEvolutionMode;
  readonly channelClass: PersonaEvolutionChannelClass;
  readonly traceId: string;
  readonly cacheHit: boolean;
  readonly cacheKey: string;
  readonly tags: readonly string[];
  readonly request: ChatBotPersonaEvolutionProjectionRequest;
  readonly signal: ChatPersonaEvolutionSignal;
  readonly descriptor: PersonaEvolutionSignalDescriptor;
}

export interface PersonaEvolutionOpaqueEventDescriptor {
  readonly botId: string;
  readonly playerId: string | null;
  readonly eventId: string;
  readonly kind: string;
  readonly channelId: string | null;
  readonly channelClass: PersonaEvolutionChannelClass;
  readonly mode: PersonaEvolutionMode;
  readonly createdAt: number;
  readonly tags: readonly string[];
  readonly objectKeys: readonly string[];
  readonly payload: ChatPersonaEvolutionEvent;
}

export interface PersonaEvolutionSignalDescriptor {
  readonly botId: string;
  readonly playerId: string | null;
  readonly channelId: string | null;
  readonly channelClass: PersonaEvolutionChannelClass;
  readonly mode: PersonaEvolutionMode;
  readonly posture: string;
  readonly transformBias: string;
  readonly callbackAppetite: number;
  readonly publicPressureShare: number;
  readonly privatePressureShare: number;
  readonly mythBias: number;
  readonly volatility: number;
  readonly signalKeys: readonly string[];
  readonly tags: readonly string[];
  readonly raw: ChatPersonaEvolutionSignal;
}

export interface PersonaEvolutionSnapshotDescriptor {
  readonly botsTracked: number;
  readonly playersTracked: number;
  readonly channelsTracked: number;
  readonly projectionsTracked: number;
  readonly eventsTracked: number;
  readonly signalKeys: readonly string[];
  readonly raw: ChatPersonaEvolutionSnapshot;
}

export interface PersonaEvolutionCacheEntry {
  readonly key: string;
  readonly botId: string;
  readonly playerId: string | null;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly request: ChatBotPersonaEvolutionProjectionRequest;
  readonly signal: ChatPersonaEvolutionSignal;
  readonly descriptor: PersonaEvolutionSignalDescriptor;
}

export interface PersonaEvolutionCounterBoardEntry {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly lastSeenAt: number | null;
  readonly weight01: number;
}

export interface PersonaEvolutionBoard<TEntry = PersonaEvolutionCounterBoardEntry> {
  readonly boardId: string;
  readonly boardType: string;
  readonly generatedAt: number;
  readonly entries: readonly TEntry[];
}

export interface PersonaEvolutionServiceAudit {
  readonly auditId: string;
  readonly createdAt: number;
  readonly lifecycle: PersonaEvolutionLifecycle;
  readonly health: PersonaEvolutionHealth;
  readonly cachePolicy: PersonaEvolutionCachePolicy;
  readonly eventCount: number;
  readonly projectionCount: number;
  readonly cacheSize: number;
  readonly botCount: number;
  readonly playerCount: number;
  readonly channelCount: number;
  readonly modeBoard: PersonaEvolutionBoard;
  readonly channelBoard: PersonaEvolutionBoard;
  readonly botBoard: PersonaEvolutionBoard;
  readonly playerBoard: PersonaEvolutionBoard;
  readonly riskBand: PersonaEvolutionRiskBand;
}

export interface PersonaEvolutionHealthSnapshot {
  readonly health: PersonaEvolutionHealth;
  readonly lifecycle: PersonaEvolutionLifecycle;
  readonly now: number;
  readonly cacheEntries: number;
  readonly botsTracked: number;
  readonly playersTracked: number;
  readonly channelsTracked: number;
  readonly auditsTracked: number;
  readonly staleCacheEntries: number;
  readonly staleProjectionWindows: number;
}

export interface PersonaEvolutionManifest {
  readonly manifestId: string;
  readonly generatedAt: number;
  readonly options: ChatBotPersonaEvolutionServiceResolvedOptions;
  readonly runtimeClass: string;
  readonly eventHistoryDepth: number;
  readonly projectionHistoryDepth: number;
  readonly trackedBots: readonly string[];
  readonly trackedPlayers: readonly string[];
  readonly trackedChannels: readonly string[];
  readonly trackedModes: readonly PersonaEvolutionMode[];
}

export interface ChatBotPersonaEvolutionServiceResolvedOptions {
  readonly maxEventHistoryPerBot: number;
  readonly maxProjectionHistoryPerBot: number;
  readonly maxSignalHistoryPerBot: number;
  readonly maxPlayerHistory: number;
  readonly maxChannelHistory: number;
  readonly maxAuditTrail: number;
  readonly maxRequestCacheEntries: number;
  readonly cacheTtlMs: number;
  readonly cachePolicy: PersonaEvolutionCachePolicy;
  readonly retainSnapshots: boolean;
  readonly retainSignals: boolean;
  readonly enableRequestNormalization: boolean;
  readonly enableAuditDigest: boolean;
  readonly enableProjectionBoards: boolean;
  readonly enableSignalBoards: boolean;
  readonly enableEventBoards: boolean;
  readonly enableHealthTracking: boolean;
  readonly enableCounterTracking: boolean;
}

export interface PersonaEvolutionProjectBatchInput {
  readonly inputs: readonly ChatBotPersonaEvolutionProjectInput[];
  readonly pruneBefore?: boolean;
  readonly captureAudit?: boolean;
}

export interface PersonaEvolutionProjectBatchResult {
  readonly batchId: string;
  readonly generatedAt: number;
  readonly receipts: readonly ChatBotPersonaEvolutionProjectReceipt[];
  readonly audit: PersonaEvolutionServiceAudit | null;
}

export interface PersonaEvolutionObserveBatchResult {
  readonly batchId: string;
  readonly generatedAt: number;
  readonly receipts: readonly ChatBotPersonaEvolutionObserveReceipt[];
}

export interface PersonaEvolutionScenarioStep {
  readonly label: string;
  readonly event?: ChatPersonaEvolutionEvent;
  readonly project?: ChatBotPersonaEvolutionProjectInput;
}

export interface PersonaEvolutionScenarioResult {
  readonly scenarioId: string;
  readonly executedAt: number;
  readonly observeReceipts: readonly ChatBotPersonaEvolutionObserveReceipt[];
  readonly projectReceipts: readonly ChatBotPersonaEvolutionProjectReceipt[];
  readonly finalSnapshot: ChatPersonaEvolutionSnapshot;
}

// ============================================================================
// CONSTANTS & HELPERS
// ============================================================================

const DEFAULT_OPTIONS: ChatBotPersonaEvolutionServiceResolvedOptions = Object.freeze({
  maxEventHistoryPerBot: 256,
  maxProjectionHistoryPerBot: 256,
  maxSignalHistoryPerBot: 256,
  maxPlayerHistory: 512,
  maxChannelHistory: 256,
  maxAuditTrail: 128,
  maxRequestCacheEntries: 512,
  cacheTtlMs: 30_000,
  cachePolicy: 'BOT_PLAYER',
  retainSnapshots: true,
  retainSignals: true,
  enableRequestNormalization: true,
  enableAuditDigest: true,
  enableProjectionBoards: true,
  enableSignalBoards: true,
  enableEventBoards: true,
  enableHealthTracking: true,
  enableCounterTracking: true,
});

const MODES: readonly PersonaEvolutionMode[] = ['EMPIRE', 'PREDATOR', 'SYNDICATE', 'PHANTOM', 'LOBBY', 'POST_RUN', 'UNKNOWN'];
const CHANNEL_CLASSES: readonly PersonaEvolutionChannelClass[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'DIRECT', 'LOBBY', 'SYSTEM', 'PRIVATE', 'UNKNOWN'];

const SYSTEM_CLOCK: ChatBotPersonaEvolutionServiceClock = {
  now: () => Date.now(),
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function clampCount(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(max, Math.floor(value));
}

function createId(prefix: string, now: number, salt: string): string {
  const base = `${prefix}_${now}_${salt}`;
  let hash = 0;
  for (let index = 0; index < base.length; index += 1) {
    hash = ((hash << 5) - hash) + base.charCodeAt(index);
    hash |= 0;
  }
  return `${prefix}_${Math.abs(hash).toString(36)}_${now.toString(36)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== "object") return input;
    if (seen.has(input as object)) return "[Circular]";
    seen.add(input as object);
    if (Array.isArray(input)) return input.map(normalize);
    const record = input as Record<string, unknown>;
    return Object.keys(record).sort().reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = normalize(record[key]);
      return acc;
    }, {});
  };
  return JSON.stringify(normalize(value));
}

function mergeOptions(
  options?: ChatBotPersonaEvolutionServiceOptions,
): ChatBotPersonaEvolutionServiceResolvedOptions {
  return Object.freeze({
    ...DEFAULT_OPTIONS,
    ...options,
  });
}

function normalizeModeFromString(value: string | null | undefined): PersonaEvolutionMode {
  switch ((value ?? "").toUpperCase()) {
    case 'EMPIRE':
    case 'PREDATOR':
    case 'SYNDICATE':
    case 'PHANTOM':
    case 'LOBBY':
    case 'POST_RUN':
      return (value ?? "UNKNOWN").toUpperCase() as PersonaEvolutionMode;
    default:
      return 'UNKNOWN';
  }
}

function normalizeChannelClass(value: string | null | undefined): PersonaEvolutionChannelClass {
  switch ((value ?? "").toUpperCase()) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'DIRECT':
    case 'LOBBY':
    case 'SYSTEM':
    case 'PRIVATE':
      return (value ?? "UNKNOWN").toUpperCase() as PersonaEvolutionChannelClass;
    default:
      return 'UNKNOWN';
  }
}

function inferChannelClass(channelId: string | null): PersonaEvolutionChannelClass {
  if (!channelId) return "UNKNOWN";
  const upper = channelId.toUpperCase();
  if (upper.includes("DEAL")) return "DEAL_ROOM";
  if (upper.includes("SYND")) return "SYNDICATE";
  if (upper.includes("DIRECT")) return "DIRECT";
  if (upper.includes("LOBBY")) return "LOBBY";
  if (upper.includes("SYSTEM")) return "SYSTEM";
  if (upper.includes("PRIV")) return "PRIVATE";
  if (upper.includes("GLOBAL")) return "GLOBAL";
  return "UNKNOWN";
}

function inferModeFromOverlay(overlay: ChatLiveOpsOverlayContext | null | undefined): PersonaEvolutionMode {
  const record = asRecord(overlay);
  return normalizeModeFromString(readString(record.mode ?? record.overlayMode ?? record.gameMode ?? record.surfaceMode, "UNKNOWN"));
}

function inferModeFromChannel(channelClass: PersonaEvolutionChannelClass): PersonaEvolutionMode {
  switch (channelClass) {
    case 'DEAL_ROOM':
      return 'PREDATOR';
    case 'SYNDICATE':
      return 'SYNDICATE';
    case 'LOBBY':
      return 'LOBBY';
    default:
      return 'UNKNOWN';
  }
}

function inferMode(
  modeHint: PersonaEvolutionMode | undefined,
  channelClass: PersonaEvolutionChannelClass,
  overlay?: ChatLiveOpsOverlayContext | null,
): PersonaEvolutionMode {
  if (modeHint && modeHint !== "UNKNOWN") return modeHint;
  const fromOverlay = inferModeFromOverlay(overlay);
  if (fromOverlay !== "UNKNOWN") return fromOverlay;
  return inferModeFromChannel(channelClass);
}

function normalizeProjectInput(input: ChatBotPersonaEvolutionProjectInput): ChatBotPersonaEvolutionProjectInput {
  return {
    ...input,
    botId: readString(input.botId),
    playerId: readOptionalString(input.playerId ?? null),
    channelId: readOptionalString(input.channelId ?? null),
    tags: Array.from(new Set(readStringArray(input.tags))),
    modeHint: normalizeModeFromString(input.modeHint ?? "UNKNOWN"),
  };
}

function describeSignal(
  signal: ChatPersonaEvolutionSignal,
  request: ChatBotPersonaEvolutionProjectionRequest,
  mode: PersonaEvolutionMode,
  channelClass: PersonaEvolutionChannelClass,
  tags: readonly string[],
): PersonaEvolutionSignalDescriptor {
  const record = asRecord(signal);
  const botId = readString((request as unknown as Record<string, unknown>).botId);
  const playerId = readOptionalString((request as unknown as Record<string, unknown>).playerId ?? null);
  const channelId = readOptionalString((request as unknown as Record<string, unknown>).channelId ?? null);
  return {
    botId,
    playerId,
    channelId,
    channelClass,
    mode,
    posture: readString(record.posture ?? record.postureDrift ?? record.currentPosture, "STABLE"),
    transformBias: readString(record.transformBias ?? record.transformBiasDrift ?? record.currentTransformBias, "NEUTRAL"),
    callbackAppetite: clamp01(readNumber(record.callbackAppetite ?? record.callbackBias01 ?? record.callbackPressure01, 0)),
    publicPressureShare: clamp01(readNumber(record.publicPressureShare ?? record.publicPressure01 ?? record.publicPressureBias01, 0.5)),
    privatePressureShare: clamp01(readNumber(record.privatePressureShare ?? record.privatePressure01 ?? record.privatePressureBias01, 0.5)),
    mythBias: clamp01(readNumber(record.mythBias ?? record.legendBias01 ?? record.mythBuildBias01, 0)),
    volatility: clamp01(readNumber(record.volatility ?? record.volatility01 ?? record.instability01, 0)),
    signalKeys: Object.keys(record).sort(),
    tags,
    raw: signal,
  };
}

function describeSnapshot(snapshot: ChatPersonaEvolutionSnapshot): PersonaEvolutionSnapshotDescriptor {
  const record = asRecord(snapshot);
  return {
    botsTracked: clampCount(readNumber(record.botsTracked ?? record.botCount ?? record.bots, 0), Number.MAX_SAFE_INTEGER),
    playersTracked: clampCount(readNumber(record.playersTracked ?? record.playerCount ?? record.players, 0), Number.MAX_SAFE_INTEGER),
    channelsTracked: clampCount(readNumber(record.channelsTracked ?? record.channelCount ?? record.channels, 0), Number.MAX_SAFE_INTEGER),
    projectionsTracked: clampCount(readNumber(record.projectionsTracked ?? record.projectionCount ?? record.projections, 0), Number.MAX_SAFE_INTEGER),
    eventsTracked: clampCount(readNumber(record.eventsTracked ?? record.eventCount ?? record.events, 0), Number.MAX_SAFE_INTEGER),
    signalKeys: Object.keys(record).sort(),
    raw: snapshot,
  };
}

function describeEvent(event: ChatPersonaEvolutionEvent): PersonaEvolutionOpaqueEventDescriptor {
  const record = asRecord(event);
  const botId = readString(record.botId ?? record.npcId ?? record.actorId, "UNKNOWN_BOT");
  const playerId = readOptionalString(record.playerId ?? record.targetPlayerId ?? null);
  const channelId = readOptionalString(record.channelId ?? record.channel ?? null);
  const channelClass = normalizeChannelClass(readString(record.channelClass, inferChannelClass(channelId)));
  const mode = normalizeModeFromString(readString(record.mode ?? record.gameMode ?? record.surfaceMode, inferModeFromChannel(channelClass)));
  const createdAt = readNumber(record.now ?? record.timestamp ?? Date.now(), Date.now());
  const eventId = readString(record.eventId ?? record.id, createId("persona_event", createdAt, `${botId}_${playerId ?? "anon"}`));
  const kind = readString(record.kind ?? record.eventType ?? record.type, "UNKNOWN_EVENT");
  const tags = Array.from(new Set(readStringArray(record.tags)));
  return {
    botId,
    playerId,
    eventId,
    kind,
    channelId,
    channelClass,
    mode,
    createdAt,
    tags,
    objectKeys: Object.keys(record).sort(),
    payload: event,
  };
}

function makeProjectionRequest(input: ChatBotPersonaEvolutionProjectInput): ChatBotPersonaEvolutionProjectionRequest {
  return {
    botId: input.botId,
    playerId: input.playerId ?? null,
    now: input.now,
    channelId: input.channelId ?? null,
    fingerprint: input.fingerprint ?? null,
    relationship: input.relationship ?? null,
    overlay: input.overlay ?? null,
  };
}

function createBoard(
  boardType: string,
  generatedAt: number,
  entries: readonly PersonaEvolutionCounterBoardEntry[],
): PersonaEvolutionBoard {
  return {
    boardId: createId(`board_${boardType}`, generatedAt, `${entries.length}`),
    boardType,
    generatedAt,
    entries,
  };
}

function sortBoardEntries(entries: readonly PersonaEvolutionCounterBoardEntry[]): readonly PersonaEvolutionCounterBoardEntry[] {
  return [...entries].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    if ((right.lastSeenAt ?? 0) !== (left.lastSeenAt ?? 0)) return (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0);
    return left.label.localeCompare(right.label);
  });
}

function makeCounterEntry(id: string, label: string, count: number, lastSeenAt: number | null, total: number): PersonaEvolutionCounterBoardEntry {
  return {
    id,
    label,
    count,
    lastSeenAt,
    weight01: total > 0 ? clamp01(count / total) : 0,
  };
}

function readMetricFromDescriptor(descriptor: PersonaEvolutionSignalDescriptor, metric: string): number {
  switch (metric) {
    case 'aggression':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['aggression'], descriptor.volatility) : descriptor.volatility);
    case 'respect':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['respect'], descriptor.volatility) : descriptor.volatility);
    case 'callbackAppetite':
      return descriptor.callbackAppetite;
    case 'publicPressure':
      return descriptor.publicPressureShare;
    case 'privatePressure':
      return descriptor.privatePressureShare;
    case 'myth':
      return descriptor.mythBias;
    case 'instability':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['instability'], descriptor.volatility) : descriptor.volatility);
    case 'adaptation':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['adaptation'], descriptor.volatility) : descriptor.volatility);
    case 'novelty':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['novelty'], descriptor.volatility) : descriptor.volatility);
    case 'memory':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['memory'], descriptor.volatility) : descriptor.volatility);
    case 'pressure':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['pressure'], descriptor.volatility) : descriptor.volatility);
    case 'rescue':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['rescue'], descriptor.volatility) : descriptor.volatility);
    case 'spectacle':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['spectacle'], descriptor.volatility) : descriptor.volatility);
    case 'heat':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['heat'], descriptor.volatility) : descriptor.volatility);
    case 'trust':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['trust'], descriptor.volatility) : descriptor.volatility);
    case 'rivalry':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['rivalry'], descriptor.volatility) : descriptor.volatility);
    case 'patience':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['patience'], descriptor.volatility) : descriptor.volatility);
    case 'volatility':
      return descriptor.volatility;
    case 'persistence':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['persistence'], descriptor.volatility) : descriptor.volatility);
    case 'dominance':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['dominance'], descriptor.volatility) : descriptor.volatility);
    case 'humiliation':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['humiliation'], descriptor.volatility) : descriptor.volatility);
    case 'hype':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['hype'], descriptor.volatility) : descriptor.volatility);
    case 'silence':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['silence'], descriptor.volatility) : descriptor.volatility);
    case 'recovery':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['recovery'], descriptor.volatility) : descriptor.volatility);
    case 'proof':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['proof'], descriptor.volatility) : descriptor.volatility);
    case 'negotiation':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['negotiation'], descriptor.volatility) : descriptor.volatility);
    case 'scene':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['scene'], descriptor.volatility) : descriptor.volatility);
    case 'persona':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['persona'], descriptor.volatility) : descriptor.volatility);
    case 'authority':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['authority'], descriptor.volatility) : descriptor.volatility);
    case 'variance':
      return clamp01(descriptor.raw && typeof descriptor.raw === 'object' ? readNumber((descriptor.raw as unknown as Record<string, unknown>)['variance'], descriptor.volatility) : descriptor.volatility);
    default:
      return descriptor.volatility;
  }
}

function inferStageFromSignalRecord(record: Record<string, unknown>): ChatPersonaStageId {
  const explicit = readString(
    record.stage ?? record.stageId ?? record.currentStage ?? record.personaStage ?? record.evolutionStage,
    '',
  ).trim();
  if (explicit) return explicit as ChatPersonaStageId;
  const myth = clamp01(readNumber(record.mythBias01 ?? record.legendBias01 ?? record.mythBias, 0));
  const callback = clamp01(readNumber(record.callbackAggression01 ?? record.callbackAppetite01 ?? record.callbackAppetite ?? 0));
  const volatility = clamp01(readNumber(record.volatility01 ?? record.volatility ?? record.instability01 ?? 0));
  if (myth >= 0.85) return 'MYTHIC';
  if (callback >= 0.8 || volatility >= 0.78) return 'ASCENDANT';
  if (callback >= 0.6) return 'RIVALRIC';
  if (myth >= 0.35 || callback >= 0.35) return 'CURIOUS';
  return 'SEED';
}

function normalizeEvolutionSignal(
  signal: RawChatPersonaEvolutionSignal | ChatPersonaEvolutionSignal,
  request: ChatBotPersonaEvolutionProjectionRequest,
  mode: PersonaEvolutionMode,
  channelClass: PersonaEvolutionChannelClass,
  tags: readonly string[],
): ChatPersonaEvolutionSignal {
  const descriptor = describeSignal(signal as ChatPersonaEvolutionSignal, request, mode, channelClass, tags);
  const record = asRecord(signal);
  const transformBiases = Array.from(new Set([
    ...readStringArray(record.transformBiases),
    ...readStringArray(record.biases),
    descriptor.transformBias !== 'NEUTRAL' ? descriptor.transformBias : '',
  ].filter((value): value is string => Boolean(value))));
  return Object.freeze({
    ...(signal as unknown as Record<string, unknown>),
    stage: inferStageFromSignalRecord(record),
    temperament: readString(record.temperament ?? record.posture ?? descriptor.posture, descriptor.posture),
    callbackAggression01: clamp01(readNumber(
      record.callbackAggression01 ?? record.callbackAggression ?? record.callbackAppetite01 ?? record.callbackAppetite ?? descriptor.callbackAppetite,
      descriptor.callbackAppetite,
    )),
    transformBiases,
    selectionBias01: clamp01(readNumber(
      record.selectionBias01 ?? record.selectionBias ?? record.selectionWeight01 ?? descriptor.publicPressureShare,
      descriptor.publicPressureShare,
    )),
    callbackAppetite01: descriptor.callbackAppetite,
    publicPressure01: descriptor.publicPressureShare,
    privatePressure01: descriptor.privatePressureShare,
    mythBias01: descriptor.mythBias,
    volatility01: descriptor.volatility,
  }) as unknown as ChatPersonaEvolutionSignal;
}

function profileKey(botId: string, playerId: string | null | undefined): string {
  return `${botId}::${playerId ?? 'anon'}`;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ChatBotPersonaEvolutionService {
  private readonly runtime: ChatBotPersonaEvolution;
  private readonly clock: ChatBotPersonaEvolutionServiceClock;
  private readonly options: ChatBotPersonaEvolutionServiceResolvedOptions;
  private lifecycle: PersonaEvolutionLifecycle = "IDLE";

  private readonly eventHistoryByBot = new Map<string, PersonaEvolutionOpaqueEventDescriptor[]>();
  private readonly eventHistoryByPlayer = new Map<string, PersonaEvolutionOpaqueEventDescriptor[]>();
  private readonly eventHistoryByChannel = new Map<string, PersonaEvolutionOpaqueEventDescriptor[]>();
  private readonly projectionHistoryByBot = new Map<string, ChatBotPersonaEvolutionProjectReceipt[]>();
  private readonly projectionHistoryByPlayer = new Map<string, ChatBotPersonaEvolutionProjectReceipt[]>();
  private readonly projectionHistoryByChannel = new Map<string, ChatBotPersonaEvolutionProjectReceipt[]>();
  private readonly signalHistoryByBot = new Map<string, PersonaEvolutionSignalDescriptor[]>();
  private readonly cache = new Map<string, PersonaEvolutionCacheEntry>();
  private readonly audits: PersonaEvolutionServiceAudit[] = [];
  private readonly fingerprintsByPlayer = new Map<string, ChatPlayerFingerprintSnapshot>();
  private readonly relationshipsByPlayer = new Map<string, ChatRelationshipSummaryView>();
  private readonly overlaysByChannel = new Map<string, ChatLiveOpsOverlayContext>();
  private readonly eventCounters = new Map<string, number>();
  private readonly projectCounters = new Map<string, number>();
  private readonly lastSeenAt = new Map<string, number>();
  private readonly transitionHistoryByBot = new Map<string, EvolutionStageTransitionRecord[]>();
  private readonly latestProfileByKey = new Map<string, ChatPersonaEvolutionProfile>();

  constructor(
    runtime: ChatBotPersonaEvolution = new ChatBotPersonaEvolution(),
    options?: ChatBotPersonaEvolutionServiceOptions,
    clock: ChatBotPersonaEvolutionServiceClock = SYSTEM_CLOCK,
  ) {
    this.runtime = runtime;
    this.options = mergeOptions(options);
    this.clock = clock;
  }

  observeWithReceipt(event: ChatPersonaEvolutionEvent): ChatBotPersonaEvolutionObserveReceipt {
    this.lifecycle = "OBSERVING";
    const descriptor = describeEvent(event);
    this.recordEventDescriptor(descriptor);
    const runtimeResult = this.runtime.observe(event as RawChatPersonaEvolutionEvent);
    const receipt: ChatBotPersonaEvolutionObserveReceipt = {
      receiptId: createId("persona_observe", descriptor.createdAt, `${descriptor.botId}_${descriptor.eventId}`),
      botId: descriptor.botId,
      eventId: descriptor.eventId,
      playerId: descriptor.playerId,
      observedAt: descriptor.createdAt,
      channelClass: descriptor.channelClass,
      mode: descriptor.mode,
      tags: descriptor.tags,
      runtimeResult,
    };
    this.bumpCounter(this.eventCounters, descriptor.kind, descriptor.createdAt);
    this.maybeCaptureAudit();
    this.lifecycle = "IDLE";
    return receipt;
  }

  observe(event: ChatPersonaEvolutionEvent): ChatPersonaEvolutionProfile {
    const receipt = this.observeWithReceipt(event);
    return this.getProfile(receipt.botId, receipt.playerId, receipt.observedAt);
  }

  observeBatch(input: readonly ChatPersonaEvolutionEvent[] | EvolutionBatchObserveInput): EvolutionBatchObserveResult {
    const now = this.clock.now();
    const events = Array.isArray(input)
      ? (input as readonly ChatPersonaEvolutionEvent[])
      : (input as EvolutionBatchObserveInput).events;
    const receipts = events.map((event) => this.observeWithReceipt(event));
    const profiles = receipts.map((receipt) => this.getProfile(receipt.botId, receipt.playerId, receipt.observedAt));
    const audit = !Array.isArray(input) && (input as EvolutionBatchObserveInput).captureAudit
      ? this.captureAudit(now)
      : null;
    return {
      batchId: createId("persona_observe_batch", now, `${events.length}`),
      generatedAt: now,
      receipts,
      profiles,
      audit,
    };
  }

  project(input: ChatBotPersonaEvolutionProjectInput): ChatPersonaEvolutionSignal {
    return this.projectWithReceipt(input).signal;
  }

  projectWithReceipt(input: ChatBotPersonaEvolutionProjectInput): ChatBotPersonaEvolutionProjectReceipt {
    this.lifecycle = "PROJECTING";
    const normalized = this.options.enableRequestNormalization ? normalizeProjectInput(input) : input;
    const channelClass = normalizeChannelClass(readString(normalized.channelId, inferChannelClass(normalized.channelId ?? null)));
    const mode = inferMode(normalized.modeHint, channelClass, normalized.overlay);
    this.recordContextArtifacts(normalized);
    const request = makeProjectionRequest(normalized);
    const cacheKey = this.computeCacheKey(request, mode, channelClass);
    const cacheEntry = !normalized.forceRefresh ? this.getUsableCacheEntry(cacheKey) : null;
    const rawSignal = cacheEntry ? cacheEntry.signal : (this.runtime.project(request) as RawChatPersonaEvolutionSignal);
    const signal = cacheEntry ? cacheEntry.signal : normalizeEvolutionSignal(rawSignal, request, mode, channelClass, normalized.tags ?? []);
    const descriptor = cacheEntry ? cacheEntry.descriptor : describeSignal(signal, request, mode, channelClass, normalized.tags ?? []);
    if (!cacheEntry) this.storeCacheEntry(cacheKey, request, signal, descriptor);
    const now = this.clock.now();
    const receipt: ChatBotPersonaEvolutionProjectReceipt = {
      receiptId: createId("persona_project", now, `${normalized.botId}_${normalized.playerId ?? "anon"}`),
      requestId: createId("persona_request", normalized.now, stableStringify(request)),
      botId: normalized.botId,
      playerId: normalized.playerId ?? null,
      projectedAt: now,
      mode,
      channelClass,
      traceId: normalized.traceId ?? createId("persona_trace", now, cacheKey),
      cacheHit: Boolean(cacheEntry),
      cacheKey,
      tags: normalized.tags ?? [],
      request,
      signal,
      descriptor,
    };
    this.recordProjectionReceipt(receipt);
    this.bumpCounter(this.projectCounters, normalized.botId, now);
    this.maybeCaptureAudit();
    this.lifecycle = "IDLE";
    return receipt;
  }

  projectBatch(input: PersonaEvolutionProjectBatchInput | readonly EvolutionProjectionInput[]): EvolutionBatchProjectResult {
    const normalizedInput: PersonaEvolutionProjectBatchInput = Array.isArray(input)
      ? { inputs: input as readonly ChatBotPersonaEvolutionProjectInput[], pruneBefore: false, captureAudit: false }
      : (input as PersonaEvolutionProjectBatchInput);
    if (normalizedInput.pruneBefore) this.prune();
    const now = this.clock.now();
    const receipts = normalizedInput.inputs.map((entry) => this.projectWithReceipt(entry));
    const audit = normalizedInput.captureAudit ? this.captureAudit(now) : null;
    return {
      batchId: createId("persona_project_batch", now, `${receipts.length}`),
      generatedAt: now,
      receipts,
      audit,
    };
  }

  projectMatrix(bots: readonly string[], inputs: readonly Omit<ChatBotPersonaEvolutionProjectInput, "botId">[]): readonly ChatBotPersonaEvolutionProjectReceipt[] {
    const receipts: ChatBotPersonaEvolutionProjectReceipt[] = [];
    for (const botId of bots) {
      for (const input of inputs) {
        receipts.push(this.projectWithReceipt({ ...input, botId }));
      }
    }
    return receipts;
  }

  projectScenario(steps: readonly PersonaEvolutionScenarioStep[]): PersonaEvolutionScenarioResult {
    const observeReceipts: ChatBotPersonaEvolutionObserveReceipt[] = [];
    const projectReceipts: ChatBotPersonaEvolutionProjectReceipt[] = [];
    for (const step of steps) {
      if (step.event) observeReceipts.push(this.observeWithReceipt(step.event));
      if (step.project) projectReceipts.push(this.projectWithReceipt(step.project));
    }
    const executedAt = this.clock.now();
    return {
      scenarioId: createId("persona_scenario", executedAt, `${steps.length}`),
      executedAt,
      observeReceipts,
      projectReceipts,
      finalSnapshot: this.getSnapshot(executedAt),
    };
  }

  getSnapshot(now = this.clock.now()): ChatPersonaEvolutionSnapshot {
    return this.runtime.getSnapshot(now);
  }

  getSnapshotDescriptor(now = this.clock.now()): PersonaEvolutionSnapshotDescriptor {
    return describeSnapshot(this.getSnapshot(now));
  }

  getHealthSnapshot(now = this.clock.now()): PersonaEvolutionHealthSnapshot {
    const staleCacheEntries = this.countStaleCacheEntries(now);
    const staleProjectionWindows = this.countStaleProjectionWindows(now);
    return {
      health: this.computeHealth(now),
      lifecycle: this.lifecycle,
      now,
      cacheEntries: this.cache.size,
      botsTracked: this.eventHistoryByBot.size,
      playersTracked: this.projectionHistoryByPlayer.size,
      channelsTracked: this.projectionHistoryByChannel.size,
      auditsTracked: this.audits.length,
      staleCacheEntries,
      staleProjectionWindows,
    };
  }

  getManifest(now = this.clock.now()): PersonaEvolutionManifest {
    return {
      manifestId: createId("persona_manifest", now, `${this.eventHistoryByBot.size}_${this.cache.size}`),
      generatedAt: now,
      options: this.options,
      runtimeClass: this.runtime.constructor.name || "ChatBotPersonaEvolution",
      eventHistoryDepth: this.sumMapLengths(this.eventHistoryByBot),
      projectionHistoryDepth: this.sumMapLengths(this.projectionHistoryByBot),
      trackedBots: [...this.eventHistoryByBot.keys()].sort(),
      trackedPlayers: [...this.projectionHistoryByPlayer.keys()].sort(),
      trackedChannels: [...this.projectionHistoryByChannel.keys()].sort(),
      trackedModes: MODES.filter((mode) => this.countProjectionsForMode(mode) > 0),
    };
  }

  captureAudit(now = this.clock.now()): PersonaEvolutionServiceAudit {
    const audit: PersonaEvolutionServiceAudit = {
      auditId: createId("persona_audit", now, `${this.eventHistoryByBot.size}_${this.cache.size}`),
      createdAt: now,
      lifecycle: this.lifecycle,
      health: this.computeHealth(now),
      cachePolicy: this.options.cachePolicy,
      eventCount: this.sumMapLengths(this.eventHistoryByBot),
      projectionCount: this.sumMapLengths(this.projectionHistoryByBot),
      cacheSize: this.cache.size,
      botCount: this.eventHistoryByBot.size,
      playerCount: this.projectionHistoryByPlayer.size,
      channelCount: this.projectionHistoryByChannel.size,
      modeBoard: this.buildModeBoard(now),
      channelBoard: this.buildChannelBoard(now),
      botBoard: this.buildBotBoard(now),
      playerBoard: this.buildPlayerBoard(now),
      riskBand: this.computeRiskBand(now),
    };
    this.audits.push(audit);
    this.trimArray(this.audits, this.options.maxAuditTrail);
    return audit;
  }

  listAudits(): readonly PersonaEvolutionServiceAudit[] {
    return this.audits;
  }

  reset(): void {
    this.lifecycle = "RESETTING";
    this.eventHistoryByBot.clear();
    this.eventHistoryByPlayer.clear();
    this.eventHistoryByChannel.clear();
    this.projectionHistoryByBot.clear();
    this.projectionHistoryByPlayer.clear();
    this.projectionHistoryByChannel.clear();
    this.signalHistoryByBot.clear();
    this.cache.clear();
    this.audits.length = 0;
    this.fingerprintsByPlayer.clear();
    this.relationshipsByPlayer.clear();
    this.overlaysByChannel.clear();
    this.eventCounters.clear();
    this.projectCounters.clear();
    this.lastSeenAt.clear();
    this.transitionHistoryByBot.clear();
    this.latestProfileByKey.clear();
    this.lifecycle = "IDLE";
  }

  prune(now = this.clock.now()): void {
    this.lifecycle = "PRUNING";
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt <= now) this.cache.delete(key);
    }
    this.pruneProjectionWindows(now);
    this.lifecycle = "IDLE";
  }

  warmFromSnapshot(snapshot: ChatPersonaEvolutionSnapshot): PersonaEvolutionSnapshotDescriptor {
    const descriptor = describeSnapshot(snapshot);
    if (this.options.retainSnapshots) {
      const now = this.clock.now();
      this.audits.push({
        auditId: createId("persona_snapshot_audit", now, `${descriptor.botsTracked}_${descriptor.playersTracked}`),
        createdAt: now,
        lifecycle: this.lifecycle,
        health: this.computeHealth(now),
        cachePolicy: this.options.cachePolicy,
        eventCount: this.sumMapLengths(this.eventHistoryByBot),
        projectionCount: this.sumMapLengths(this.projectionHistoryByBot),
        cacheSize: this.cache.size,
        botCount: descriptor.botsTracked,
        playerCount: descriptor.playersTracked,
        channelCount: descriptor.channelsTracked,
        modeBoard: this.buildModeBoard(now),
        channelBoard: this.buildChannelBoard(now),
        botBoard: this.buildBotBoard(now),
        playerBoard: this.buildPlayerBoard(now),
        riskBand: this.computeRiskBand(now),
      });
      this.trimArray(this.audits, this.options.maxAuditTrail);
    }
    return descriptor;
  }

  listBotEvents(botId: string): readonly PersonaEvolutionOpaqueEventDescriptor[] {
    return this.eventHistoryByBot.get(botId) ?? [];
  }

  listBotSignals(botId: string): readonly PersonaEvolutionSignalDescriptor[] {
    return this.signalHistoryByBot.get(botId) ?? [];
  }

  listBotProjections(botId: string): readonly ChatBotPersonaEvolutionProjectReceipt[] {
    return this.projectionHistoryByBot.get(botId) ?? [];
  }

  listPlayerProjections(playerId: string): readonly ChatBotPersonaEvolutionProjectReceipt[] {
    return this.projectionHistoryByPlayer.get(playerId) ?? [];
  }

  listChannelProjections(channelId: string): readonly ChatBotPersonaEvolutionProjectReceipt[] {
    return this.projectionHistoryByChannel.get(channelId) ?? [];
  }

  summarizeBot(botId: string, now = this.clock.now()): PersonaEvolutionBoard {
    const receipts = this.listBotProjections(botId);
    const total = receipts.length;
    const entries = MODES.map((mode) => {
      const modeReceipts = receipts.filter((receipt) => receipt.mode === mode);
      const lastSeenAt = modeReceipts.length > 0 ? modeReceipts[modeReceipts.length - 1]!.projectedAt : null;
      return makeCounterEntry(`${botId}_${mode}`, mode, modeReceipts.length, lastSeenAt, total);
    }).filter((entry) => entry.count > 0);
    return createBoard(`bot_${botId}`, now, sortBoardEntries(entries));
  }

  computeAggressionAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'aggression'), 0) / descriptors.length;
  }

  buildAggressionBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeAggressionAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`aggression_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('aggression', now, sortBoardEntries(entries));
  }

  computeRespectAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'respect'), 0) / descriptors.length;
  }

  buildRespectBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeRespectAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`respect_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('respect', now, sortBoardEntries(entries));
  }

  computeCallbackappetiteAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'callbackAppetite'), 0) / descriptors.length;
  }

  buildCallbackappetiteBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeCallbackappetiteAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`callbackAppetite_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('callbackAppetite', now, sortBoardEntries(entries));
  }

  computePublicpressureAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'publicPressure'), 0) / descriptors.length;
  }

  buildPublicpressureBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computePublicpressureAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`publicPressure_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('publicPressure', now, sortBoardEntries(entries));
  }

  computePrivatepressureAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'privatePressure'), 0) / descriptors.length;
  }

  buildPrivatepressureBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computePrivatepressureAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`privatePressure_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('privatePressure', now, sortBoardEntries(entries));
  }

  computeMythAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'myth'), 0) / descriptors.length;
  }

  buildMythBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeMythAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`myth_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('myth', now, sortBoardEntries(entries));
  }

  computeInstabilityAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'instability'), 0) / descriptors.length;
  }

  buildInstabilityBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeInstabilityAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`instability_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('instability', now, sortBoardEntries(entries));
  }

  computeAdaptationAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'adaptation'), 0) / descriptors.length;
  }

  buildAdaptationBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeAdaptationAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`adaptation_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('adaptation', now, sortBoardEntries(entries));
  }

  computeNoveltyAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'novelty'), 0) / descriptors.length;
  }

  buildNoveltyBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeNoveltyAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`novelty_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('novelty', now, sortBoardEntries(entries));
  }

  computeMemoryAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'memory'), 0) / descriptors.length;
  }

  buildMemoryBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeMemoryAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`memory_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('memory', now, sortBoardEntries(entries));
  }

  computePressureAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'pressure'), 0) / descriptors.length;
  }

  buildPressureBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computePressureAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`pressure_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('pressure', now, sortBoardEntries(entries));
  }

  computeRescueAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'rescue'), 0) / descriptors.length;
  }

  buildRescueBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeRescueAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`rescue_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('rescue', now, sortBoardEntries(entries));
  }

  computeSpectacleAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'spectacle'), 0) / descriptors.length;
  }

  buildSpectacleBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeSpectacleAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`spectacle_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('spectacle', now, sortBoardEntries(entries));
  }

  computeHeatAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'heat'), 0) / descriptors.length;
  }

  buildHeatBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeHeatAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`heat_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('heat', now, sortBoardEntries(entries));
  }

  computeTrustAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'trust'), 0) / descriptors.length;
  }

  buildTrustBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeTrustAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`trust_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('trust', now, sortBoardEntries(entries));
  }

  computeRivalryAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'rivalry'), 0) / descriptors.length;
  }

  buildRivalryBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeRivalryAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`rivalry_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('rivalry', now, sortBoardEntries(entries));
  }

  computePatienceAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'patience'), 0) / descriptors.length;
  }

  buildPatienceBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computePatienceAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`patience_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('patience', now, sortBoardEntries(entries));
  }

  computeVolatilityAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'volatility'), 0) / descriptors.length;
  }

  buildVolatilityBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeVolatilityAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`volatility_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('volatility', now, sortBoardEntries(entries));
  }

  computePersistenceAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'persistence'), 0) / descriptors.length;
  }

  buildPersistenceBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computePersistenceAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`persistence_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('persistence', now, sortBoardEntries(entries));
  }

  computeDominanceAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'dominance'), 0) / descriptors.length;
  }

  buildDominanceBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeDominanceAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`dominance_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('dominance', now, sortBoardEntries(entries));
  }

  computeHumiliationAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'humiliation'), 0) / descriptors.length;
  }

  buildHumiliationBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeHumiliationAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`humiliation_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('humiliation', now, sortBoardEntries(entries));
  }

  computeHypeAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'hype'), 0) / descriptors.length;
  }

  buildHypeBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeHypeAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`hype_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('hype', now, sortBoardEntries(entries));
  }

  computeSilenceAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'silence'), 0) / descriptors.length;
  }

  buildSilenceBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeSilenceAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`silence_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('silence', now, sortBoardEntries(entries));
  }

  computeRecoveryAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'recovery'), 0) / descriptors.length;
  }

  buildRecoveryBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeRecoveryAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`recovery_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('recovery', now, sortBoardEntries(entries));
  }

  computeProofAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'proof'), 0) / descriptors.length;
  }

  buildProofBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeProofAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`proof_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('proof', now, sortBoardEntries(entries));
  }

  computeNegotiationAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'negotiation'), 0) / descriptors.length;
  }

  buildNegotiationBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeNegotiationAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`negotiation_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('negotiation', now, sortBoardEntries(entries));
  }

  computeSceneAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'scene'), 0) / descriptors.length;
  }

  buildSceneBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeSceneAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`scene_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('scene', now, sortBoardEntries(entries));
  }

  computePersonaAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'persona'), 0) / descriptors.length;
  }

  buildPersonaBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computePersonaAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`persona_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('persona', now, sortBoardEntries(entries));
  }

  computeAuthorityAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'authority'), 0) / descriptors.length;
  }

  buildAuthorityBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeAuthorityAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`authority_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('authority', now, sortBoardEntries(entries));
  }

  computeVarianceAverage(botId: string): number {
    const descriptors = this.signalHistoryByBot.get(botId) ?? [];
    if (descriptors.length === 0) return 0;
    return descriptors.reduce((total, descriptor) => total + readMetricFromDescriptor(descriptor, 'variance'), 0) / descriptors.length;
  }

  buildVarianceBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const botIds = [...this.signalHistoryByBot.keys()];
    const entries = botIds.map((botId) => {
      const value = this.computeVarianceAverage(botId);
      const last = this.lastSeenAt.get(`bot:${botId}`) ?? null;
      return makeCounterEntry(`variance_${botId}`, botId, Math.round(value * 1000), last, botIds.length * 1000 || 1);
    }).filter((entry) => entry.count > 0);
    return createBoard('variance', now, sortBoardEntries(entries));
  }

  buildPlayerBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const keys = [...this.projectionHistoryByPlayer.keys()];
    const total = this.sumMapLengths(this.projectionHistoryByPlayer);
    const entries = keys.map((key) => {
      const items = this.projectionHistoryByPlayer.get(key) ?? [];
      const last = items.length > 0 ? items[items.length - 1]!.projectedAt : null;
      return makeCounterEntry(`player_${key}`, key, items.length, last, total);
    });
    return createBoard('player', now, sortBoardEntries(entries));
  }

  buildChannelBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const keys = [...this.projectionHistoryByChannel.keys()];
    const total = this.sumMapLengths(this.projectionHistoryByChannel);
    const entries = keys.map((key) => {
      const items = this.projectionHistoryByChannel.get(key) ?? [];
      const last = items.length > 0 ? items[items.length - 1]!.projectedAt : null;
      return makeCounterEntry(`channel_${key}`, key, items.length, last, total);
    });
    return createBoard('channel', now, sortBoardEntries(entries));
  }

  buildModeBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const total = this.sumMapLengths(this.projectionHistoryByBot);
    const entries = MODES.map((mode) => {
      const count = this.countProjectionsForMode(mode);
      const last = this.lastProjectionForMode(mode);
      return makeCounterEntry(`mode_${mode}`, mode, count, last, total);
    }).filter((entry) => entry.count > 0);
    return createBoard('mode', now, sortBoardEntries(entries));
  }

  buildOverlayBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const keys = [...this.overlaysByChannel.keys()];
    const total = keys.length || 1;
    const entries = keys.map((key) => makeCounterEntry(`overlay_${key}`, key, 1, this.lastSeenAt.get(`overlay:${key}`) ?? null, total));
    return createBoard('overlay', now, sortBoardEntries(entries));
  }

  buildRelationshipBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const keys = [...this.relationshipsByPlayer.keys()];
    const total = keys.length || 1;
    const entries = keys.map((key) => makeCounterEntry(`relationship_${key}`, key, 1, this.lastSeenAt.get(`relationship:${key}`) ?? null, total));
    return createBoard('relationship', now, sortBoardEntries(entries));
  }

  buildFingerprintBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const keys = [...this.fingerprintsByPlayer.keys()];
    const total = keys.length || 1;
    const entries = keys.map((key) => makeCounterEntry(`fingerprint_${key}`, key, 1, this.lastSeenAt.get(`fingerprint:${key}`) ?? null, total));
    return createBoard('fingerprint', now, sortBoardEntries(entries));
  }

  buildSeasonBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const entries = MODES.map((mode) => makeCounterEntry(`season_${mode}`, mode, this.countProjectionsForMode(mode), this.lastProjectionForMode(mode), this.sumMapLengths(this.projectionHistoryByBot) || 1)).filter((entry) => entry.count > 0);
    return createBoard('season', now, sortBoardEntries(entries));
  }

  buildWindowBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const total = this.cache.size || 1;
    const entries = [...this.cache.values()].map((entry) => makeCounterEntry(`window_${entry.key}`, entry.botId, 1, entry.createdAt, total));
    return createBoard('window', now, sortBoardEntries(entries));
  }

  buildRiskBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const band = this.computeRiskBand(now);
    const counts = new Map<PersonaEvolutionRiskBand, number>();
    counts.set(band, (counts.get(band) ?? 0) + 1);
    const entries = [...counts.entries()].map(([key, value]) => makeCounterEntry(`risk_${key}`, key, value, now, 1));
    return createBoard('risk', now, sortBoardEntries(entries));
  }

  buildAuditBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const total = this.audits.length || 1;
    const entries = this.audits.map((audit) => makeCounterEntry(`audit_${audit.auditId}`, audit.health, 1, audit.createdAt, total));
    return createBoard('audit', now, sortBoardEntries(entries));
  }

  buildProjectionBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const total = this.sumMapLengths(this.projectionHistoryByBot);
    const entries = [...this.projectionHistoryByBot.entries()].map(([key, receipts]) => makeCounterEntry(`projection_${key}`, key, receipts.length, receipts.length > 0 ? receipts[receipts.length - 1]!.projectedAt : null, total));
    return createBoard('projection', now, sortBoardEntries(entries));
  }

  buildEventBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const total = this.sumMapLengths(this.eventHistoryByBot);
    const entries = [...this.eventHistoryByBot.entries()].map(([key, events]) => makeCounterEntry(`event_${key}`, key, events.length, events.length > 0 ? events[events.length - 1]!.createdAt : null, total));
    return createBoard('event', now, sortBoardEntries(entries));
  }

  buildSignalBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const total = this.sumMapLengths(this.signalHistoryByBot);
    const entries = [...this.signalHistoryByBot.entries()].map(([key, signals]) => makeCounterEntry(`signal_${key}`, key, signals.length, this.lastSeenAt.get(`bot:${key}`) ?? null, total));
    return createBoard('signal', now, sortBoardEntries(entries));
  }

  buildSnapshotBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const snapshot = this.getSnapshotDescriptor(now);
    const entries = [
      makeCounterEntry(`snapshot_bots`, `bots`, snapshot.botsTracked, now, snapshot.botsTracked + snapshot.playersTracked + snapshot.channelsTracked || 1),
      makeCounterEntry(`snapshot_players`, `players`, snapshot.playersTracked, now, snapshot.botsTracked + snapshot.playersTracked + snapshot.channelsTracked || 1),
      makeCounterEntry(`snapshot_channels`, `channels`, snapshot.channelsTracked, now, snapshot.botsTracked + snapshot.playersTracked + snapshot.channelsTracked || 1),
    ];
    return createBoard('snapshot', now, sortBoardEntries(entries));
  }

  buildBotBoard(now = this.clock.now()): PersonaEvolutionBoard {
    const keys = [...this.projectionHistoryByBot.keys()];
    const total = this.sumMapLengths(this.projectionHistoryByBot);
    const entries = keys.map((key) => {
      const items = this.projectionHistoryByBot.get(key) ?? [];
      const last = items.length > 0 ? items[items.length - 1]!.projectedAt : null;
      return makeCounterEntry(`bot_${key}`, key, items.length, last, total);
    });
    return createBoard("bot", now, sortBoardEntries(entries));
  }

  exportBoards(now = this.clock.now()): readonly PersonaEvolutionBoard[] {
    return [
      this.buildBotBoard(now),
      this.buildPlayerBoard(now),
      this.buildChannelBoard(now),
      this.buildModeBoard(now),
      this.buildOverlayBoard(now),
      this.buildRelationshipBoard(now),
      this.buildFingerprintBoard(now),
      this.buildProjectionBoard(now),
      this.buildSignalBoard(now),
      this.buildEventBoard(now),
      this.buildAuditBoard(now),
      this.buildRiskBoard(now),
      this.buildSnapshotBoard(now),
    ];
  }

  compareBots(leftBotId: string, rightBotId: string): Record<string, number> {
    return {
      aggression: this.computeAggressionAverage(leftBotId) - this.computeAggressionAverage(rightBotId),
      respect: this.computeRespectAverage(leftBotId) - this.computeRespectAverage(rightBotId),
      callbackAppetite: this.computeCallbackappetiteAverage(leftBotId) - this.computeCallbackappetiteAverage(rightBotId),
      publicPressure: this.computePublicpressureAverage(leftBotId) - this.computePublicpressureAverage(rightBotId),
      privatePressure: this.computePrivatepressureAverage(leftBotId) - this.computePrivatepressureAverage(rightBotId),
      myth: this.computeMythAverage(leftBotId) - this.computeMythAverage(rightBotId),
      instability: this.computeInstabilityAverage(leftBotId) - this.computeInstabilityAverage(rightBotId),
      adaptation: this.computeAdaptationAverage(leftBotId) - this.computeAdaptationAverage(rightBotId),
      novelty: this.computeNoveltyAverage(leftBotId) - this.computeNoveltyAverage(rightBotId),
      memory: this.computeMemoryAverage(leftBotId) - this.computeMemoryAverage(rightBotId),
      pressure: this.computePressureAverage(leftBotId) - this.computePressureAverage(rightBotId),
      rescue: this.computeRescueAverage(leftBotId) - this.computeRescueAverage(rightBotId),
      spectacle: this.computeSpectacleAverage(leftBotId) - this.computeSpectacleAverage(rightBotId),
      heat: this.computeHeatAverage(leftBotId) - this.computeHeatAverage(rightBotId),
      trust: this.computeTrustAverage(leftBotId) - this.computeTrustAverage(rightBotId),
      rivalry: this.computeRivalryAverage(leftBotId) - this.computeRivalryAverage(rightBotId),
      patience: this.computePatienceAverage(leftBotId) - this.computePatienceAverage(rightBotId),
      volatility: this.computeVolatilityAverage(leftBotId) - this.computeVolatilityAverage(rightBotId),
      persistence: this.computePersistenceAverage(leftBotId) - this.computePersistenceAverage(rightBotId),
      dominance: this.computeDominanceAverage(leftBotId) - this.computeDominanceAverage(rightBotId),
      humiliation: this.computeHumiliationAverage(leftBotId) - this.computeHumiliationAverage(rightBotId),
      hype: this.computeHypeAverage(leftBotId) - this.computeHypeAverage(rightBotId),
      silence: this.computeSilenceAverage(leftBotId) - this.computeSilenceAverage(rightBotId),
      recovery: this.computeRecoveryAverage(leftBotId) - this.computeRecoveryAverage(rightBotId),
      proof: this.computeProofAverage(leftBotId) - this.computeProofAverage(rightBotId),
      negotiation: this.computeNegotiationAverage(leftBotId) - this.computeNegotiationAverage(rightBotId),
      scene: this.computeSceneAverage(leftBotId) - this.computeSceneAverage(rightBotId),
      persona: this.computePersonaAverage(leftBotId) - this.computePersonaAverage(rightBotId),
      authority: this.computeAuthorityAverage(leftBotId) - this.computeAuthorityAverage(rightBotId),
      variance: this.computeVarianceAverage(leftBotId) - this.computeVarianceAverage(rightBotId),
    };
  }

  exportDetailedState(now = this.clock.now()): Record<string, unknown> {
    return {
      manifest: this.getManifest(now),
      snapshot: this.getSnapshotDescriptor(now),
      health: this.getHealthSnapshot(now),
      boards: this.exportBoards(now),
      audits: this.listAudits(),
      cacheKeys: [...this.cache.keys()].sort(),
    };
  }

  getProfile(botId: string, playerId: string | null | undefined, now = this.clock.now()): ChatPersonaEvolutionProfile {
    const signal = this.project({ botId, playerId, now });
    const key = profileKey(botId, playerId);
    const cached = this.latestProfileByKey.get(key);
    const profile: ChatPersonaEvolutionProfile = Object.freeze({
      botId,
      playerId: playerId ?? null,
      stage: signal.stage,
      signal,
      updatedAt: now,
      aggression01: this.computeAggressionAverage(botId),
      respect01: this.computeRespectAverage(botId),
      callbackAppetite01: this.computeCallbackappetiteAverage(botId),
      publicPressure01: this.computePublicpressureAverage(botId),
      privatePressure01: this.computePrivatepressureAverage(botId),
      mythBias01: this.computeMythAverage(botId),
      volatility01: this.computeVolatilityAverage(botId),
      eventCount: this.listBotEvents(botId).length,
      projectionCount: this.listBotProjections(botId).length,
    });
    if (!cached || cached.stage !== profile.stage) {
      this.recordTransition(botId, playerId ?? null, cached?.stage ?? null, profile.stage, now, cached ? 'PROFILE_REFRESH' : 'PROFILE_INITIALIZED');
    }
    this.latestProfileByKey.set(key, profile);
    return profile;
  }

  listTransitions(): readonly EvolutionStageTransitionRecord[] {
    return Object.freeze([...this.transitionHistoryByBot.values()].flat().sort((a, b) => a.transitionedAt - b.transitionedAt));
  }

  getTransitionHistoryForBot(botId: string): readonly EvolutionStageTransitionRecord[] {
    return this.transitionHistoryByBot.get(botId) ?? [];
  }

  computeBotStats(botId: string, now = this.clock.now()): BotEvolutionStats {
    const current = this.getProfile(botId, null, now);
    const transitions = this.getTransitionHistoryForBot(botId);
    const stageCounts: Record<string, number> = {};
    for (const transition of transitions) {
      stageCounts[transition.toStage] = (stageCounts[transition.toStage] ?? 0) + 1;
    }
    stageCounts[current.stage] = (stageCounts[current.stage] ?? 0) + 1;
    return Object.freeze({
      botId,
      profilesTracked: [...this.latestProfileByKey.values()].filter((profile) => profile.botId === botId).length,
      eventCount: this.listBotEvents(botId).length,
      projectionCount: this.listBotProjections(botId).length,
      currentStage: current.stage,
      stageCounts: Object.freeze(stageCounts),
      averages: Object.freeze(createChatBotPersonaEvolutionMetricDeck(this, botId)),
    });
  }

  computeSystemStats(now = this.clock.now()): EvolutionSystemStats {
    const stageCounts: Record<string, number> = { MYTHIC: 0, RIVALRIC: 0 };
    for (const botId of this.projectionHistoryByBot.keys()) {
      const profile = this.getProfile(botId, null, now);
      stageCounts[profile.stage] = (stageCounts[profile.stage] ?? 0) + 1;
      if (profile.stage === 'MYTHIC') stageCounts.MYTHIC += 1;
      if (profile.stage === 'RIVALRIC') stageCounts.RIVALRIC += 1;
    }
    return Object.freeze({
      totalProfiles: this.latestProfileByKey.size,
      totalBots: this.projectionHistoryByBot.size,
      totalPlayers: this.projectionHistoryByPlayer.size,
      totalEvents: this.sumMapLengths(this.eventHistoryByBot),
      totalProjections: this.sumMapLengths(this.projectionHistoryByBot),
      stageCounts: Object.freeze(stageCounts) as EvolutionSystemStats['stageCounts'],
      health: this.computeHealth(now),
    });
  }

  hasReachedStage(botId: string, playerId: string | null | undefined, targetStage: ChatPersonaStageId, now = this.clock.now()): boolean {
    return this.getProfile(botId, playerId, now).stage === targetStage
      || this.getTransitionHistoryForBot(botId).some((transition) => transition.toStage === targetStage && transition.playerId === (playerId ?? null));
  }

  scoreBotAggressionLevel(botId: string, _playerId: string | null | undefined, _now = this.clock.now()): number {
    return this.computeAggressionAverage(botId);
  }

  inferBotObjective(
    botId: string,
    playerId: string | null | undefined,
    relationship?: ChatRelationshipSummaryView | null,
    fingerprint?: ChatPlayerFingerprintSnapshot | null,
    now = this.clock.now(),
  ): string {
    const profile = this.getProfile(botId, playerId, now);
    if (profile.stage === 'MYTHIC') return 'DOMINATE_PUBLIC_MYTH';
    if (relationship) return 'ADAPT_TO_RELATIONSHIP_PRESSURE';
    if (fingerprint) return 'EXPLOIT_PLAYER_PATTERN';
    if (profile.callbackAppetite01 >= 0.7) return 'FORCE_CALLBACK';
    if (profile.publicPressure01 >= profile.privatePressure01) return 'SEIZE_PUBLIC_STAGE';
    return 'ESCALATE_PRIVATE_PRESSURE';
  }

  buildPersonaInsight(
    botId: string,
    playerId: string | null | undefined,
    now = this.clock.now(),
    channelId?: string | null,
    fingerprint?: ChatPlayerFingerprintSnapshot | null,
    relationship?: ChatRelationshipSummaryView | null,
    overlay?: ChatLiveOpsOverlayContext | null,
  ): PersonaInsight {
    const signal = this.project({ botId, playerId, now, channelId, fingerprint, relationship, overlay });
    return Object.freeze({
      botId,
      playerId: playerId ?? null,
      stage: signal.stage,
      temperament: signal.temperament,
      objective: this.inferBotObjective(botId, playerId, relationship, fingerprint, now),
      aggression01: this.computeAggressionAverage(botId),
      respect01: this.computeRespectAverage(botId),
      callbackAggression01: signal.callbackAggression01,
      selectionBias01: signal.selectionBias01,
      recommendedTone: signal.callbackAggression01 >= 0.66 ? 'DEFENSIVE_PRECISION' : 'CALM_COUNTERPLAY',
      tags: Object.freeze(signal.transformBiases),
    });
  }

  buildCounterplayHint(
    botId: string,
    playerId: string,
    fingerprint: ChatPlayerFingerprintSnapshot,
    now = this.clock.now(),
  ): BotCounterplayHint {
    const insight = this.buildPersonaInsight(botId, playerId, now, null, fingerprint, null, null);
    const tactics = insight.callbackAggression01 >= 0.66
      ? ['Delay escalation windows', 'Force proof-based exchanges', 'Avoid public overcommitment']
      : ['Exploit low-pressure timing', 'Counter with calm tempo control', 'Push selective public witnesses'];
    return Object.freeze({
      botId,
      playerId,
      stage: insight.stage,
      title: `${insight.stage} counterplay`,
      summary: insight.objective,
      tactics: Object.freeze(tactics),
    });
  }

  serializeCompact(now = this.clock.now()): EvolutionServiceCompactSnapshot {
    return Object.freeze({
      generatedAt: now,
      snapshot: this.getSnapshot(now),
      health: this.getHealthSnapshot(now),
      manifest: this.getManifest(now),
      transitions: this.listTransitions(),
    });
  }

  hydrateFromSnapshot(snapshot: EvolutionServiceCompactSnapshot, _now = this.clock.now()): void {
    this.warmFromSnapshot(snapshot.snapshot);
    for (const transition of snapshot.transitions) {
      const bucket = this.transitionHistoryByBot.get(transition.botId) ?? [];
      bucket.push(transition);
      this.transitionHistoryByBot.set(transition.botId, bucket);
    }
  }

  flushProjectionCache(): void {
    this.cache.clear();
  }

  private recordTransition(botId: string, playerId: string | null, fromStage: ChatPersonaStageId | null, toStage: ChatPersonaStageId, transitionedAt: number, reason: string): void {
    if (fromStage === toStage && fromStage !== null) return;
    const transition: EvolutionStageTransitionRecord = Object.freeze({
      transitionId: createId('persona_transition', transitionedAt, `${botId}_${playerId ?? 'anon'}_${toStage}`),
      botId,
      playerId,
      fromStage,
      toStage,
      transitionedAt,
      reason,
    });
    const bucket = this.transitionHistoryByBot.get(botId) ?? [];
    bucket.push(transition);
    this.trimArray(bucket, this.options.maxProjectionHistoryPerBot);
    this.transitionHistoryByBot.set(botId, bucket);
  }

  private recordEventDescriptor(descriptor: PersonaEvolutionOpaqueEventDescriptor): void {
    this.pushMapArray(this.eventHistoryByBot, descriptor.botId, descriptor, this.options.maxEventHistoryPerBot);
    if (descriptor.playerId) this.pushMapArray(this.eventHistoryByPlayer, descriptor.playerId, descriptor, this.options.maxPlayerHistory);
    if (descriptor.channelId) this.pushMapArray(this.eventHistoryByChannel, descriptor.channelId, descriptor, this.options.maxChannelHistory);
    this.lastSeenAt.set(`bot:${descriptor.botId}`, descriptor.createdAt);
    if (descriptor.playerId) this.lastSeenAt.set(`player:${descriptor.playerId}`, descriptor.createdAt);
    if (descriptor.channelId) this.lastSeenAt.set(`channel:${descriptor.channelId}`, descriptor.createdAt);
  }

  private recordProjectionReceipt(receipt: ChatBotPersonaEvolutionProjectReceipt): void {
    this.pushMapArray(this.projectionHistoryByBot, receipt.botId, receipt, this.options.maxProjectionHistoryPerBot);
    if (receipt.playerId) this.pushMapArray(this.projectionHistoryByPlayer, receipt.playerId, receipt, this.options.maxPlayerHistory);
    if (receipt.request.channelId) this.pushMapArray(this.projectionHistoryByChannel, receipt.request.channelId, receipt, this.options.maxChannelHistory);
    if (this.options.retainSignals) {
      this.pushMapArray(this.signalHistoryByBot, receipt.botId, receipt.descriptor, this.options.maxSignalHistoryPerBot);
    }
    this.lastSeenAt.set(`bot:${receipt.botId}`, receipt.projectedAt);
    if (receipt.playerId) this.lastSeenAt.set(`player:${receipt.playerId}`, receipt.projectedAt);
    if (receipt.request.channelId) this.lastSeenAt.set(`channel:${receipt.request.channelId}`, receipt.projectedAt);
  }

  private recordContextArtifacts(input: ChatBotPersonaEvolutionProjectInput): void {
    if (input.playerId && input.fingerprint) {
      this.fingerprintsByPlayer.set(input.playerId, input.fingerprint);
      this.lastSeenAt.set(`fingerprint:${input.playerId}`, input.now);
    }
    if (input.playerId && input.relationship) {
      this.relationshipsByPlayer.set(input.playerId, input.relationship);
      this.lastSeenAt.set(`relationship:${input.playerId}`, input.now);
    }
    if (input.channelId && input.overlay) {
      this.overlaysByChannel.set(input.channelId, input.overlay);
      this.lastSeenAt.set(`overlay:${input.channelId}`, input.now);
    }
  }

  private computeCacheKey(
    request: ChatBotPersonaEvolutionProjectionRequest,
    mode: PersonaEvolutionMode,
    channelClass: PersonaEvolutionChannelClass,
  ): string {
    const record = request as unknown as Record<string, unknown>;
    const botId = readString(record.botId);
    const playerId = readOptionalString(record.playerId) ?? "anon";
    const channelId = readOptionalString(record.channelId) ?? "no_channel";
    switch (this.options.cachePolicy) {
      case 'NONE':
        return createId("persona_cache_none", this.clock.now(), stableStringify(request));
      case 'REQUEST':
        return stableStringify(request);
      case 'BOT':
        return `${botId}`;
      case 'PLAYER':
        return `${playerId}`;
      case 'BOT_PLAYER':
      default:
        return `${botId}::${playerId}::${channelId}::${mode}::${channelClass}`;
    }
  }

  private getUsableCacheEntry(key: string): PersonaEvolutionCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.clock.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  private storeCacheEntry(
    key: string,
    request: ChatBotPersonaEvolutionProjectionRequest,
    signal: ChatPersonaEvolutionSignal,
    descriptor: PersonaEvolutionSignalDescriptor,
  ): void {
    const record = request as unknown as Record<string, unknown>;
    const now = this.clock.now();
    const entry: PersonaEvolutionCacheEntry = {
      key,
      botId: readString(record.botId),
      playerId: readOptionalString(record.playerId),
      createdAt: now,
      expiresAt: now + this.options.cacheTtlMs,
      request,
      signal,
      descriptor,
    };
    this.cache.set(key, entry);
    while (this.cache.size > this.options.maxRequestCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) break;
      this.cache.delete(oldestKey);
    }
  }

  private countStaleCacheEntries(now: number): number {
    let count = 0;
    for (const entry of this.cache.values()) {
      if (entry.expiresAt <= now) count += 1;
    }
    return count;
  }

  private countStaleProjectionWindows(now: number): number {
    const ttl = this.options.cacheTtlMs * 4;
    let count = 0;
    for (const receipts of this.projectionHistoryByBot.values()) {
      for (const receipt of receipts) {
        if ((now - receipt.projectedAt) > ttl) count += 1;
      }
    }
    return count;
  }

  private computeHealth(now: number): PersonaEvolutionHealth {
    if (!this.options.enableHealthTracking) return "WARM";
    const cacheRatio = this.options.maxRequestCacheEntries > 0 ? this.cache.size / this.options.maxRequestCacheEntries : 0;
    const staleRatio = this.options.maxRequestCacheEntries > 0 ? this.countStaleCacheEntries(now) / Math.max(1, this.cache.size) : 0;
    if (staleRatio > 0.75) return "DEGRADED";
    if (cacheRatio > 0.95) return "SATURATED";
    if (cacheRatio > 0.70) return "HOT";
    if (this.cache.size > 0 || this.sumMapLengths(this.eventHistoryByBot) > 0) return "WARM";
    return "COLD";
  }

  private computeRiskBand(now: number): PersonaEvolutionRiskBand {
    const stale = this.countStaleCacheEntries(now);
    const totalEvents = this.sumMapLengths(this.eventHistoryByBot);
    const totalProjections = this.sumMapLengths(this.projectionHistoryByBot);
    if (stale > this.options.maxRequestCacheEntries * 0.5) return "CRITICAL";
    if (totalEvents > totalProjections * 4 && totalEvents > 32) return "HIGH";
    if (this.cache.size > this.options.maxRequestCacheEntries * 0.75) return "MEDIUM";
    if (this.cache.size > 0 || totalEvents > 0) return "LOW";
    return "NONE";
  }

  private pruneProjectionWindows(now: number): void {
    const ttl = this.options.cacheTtlMs * 4;
    for (const receipts of this.projectionHistoryByBot.values()) {
      while (receipts.length > 0 && (now - receipts[0]!.projectedAt) > ttl) receipts.shift();
    }
    for (const receipts of this.projectionHistoryByPlayer.values()) {
      while (receipts.length > 0 && (now - receipts[0]!.projectedAt) > ttl) receipts.shift();
    }
    for (const receipts of this.projectionHistoryByChannel.values()) {
      while (receipts.length > 0 && (now - receipts[0]!.projectedAt) > ttl) receipts.shift();
    }
  }

  private countProjectionsForMode(mode: PersonaEvolutionMode): number {
    let count = 0;
    for (const receipts of this.projectionHistoryByBot.values()) {
      for (const receipt of receipts) if (receipt.mode === mode) count += 1;
    }
    return count;
  }

  private lastProjectionForMode(mode: PersonaEvolutionMode): number | null {
    let last: number | null = null;
    for (const receipts of this.projectionHistoryByBot.values()) {
      for (const receipt of receipts) {
        if (receipt.mode !== mode) continue;
        if (last === null || receipt.projectedAt > last) last = receipt.projectedAt;
      }
    }
    return last;
  }

  private maybeCaptureAudit(): void {
    if (!this.options.enableAuditDigest) return;
    const totalOps = this.sumMapLengths(this.eventHistoryByBot) + this.sumMapLengths(this.projectionHistoryByBot);
    if (totalOps === 0) return;
    if (totalOps % 16 === 0) this.captureAudit(this.clock.now());
  }

  private pushMapArray<T>(map: Map<string, T[]>, key: string, value: T, max: number): void {
    const bucket = map.get(key) ?? [];
    bucket.push(value);
    this.trimArray(bucket, max);
    map.set(key, bucket);
  }

  private trimArray<T>(items: T[], max: number): void {
    while (items.length > max) items.shift();
  }

  private bumpCounter(map: Map<string, number>, key: string, now: number): void {
    if (!this.options.enableCounterTracking) return;
    map.set(key, (map.get(key) ?? 0) + 1);
    this.lastSeenAt.set(`counter:${key}`, now);
  }

  private sumMapLengths<T>(map: Map<string, readonly T[]>): number {
    let total = 0;
    for (const bucket of map.values()) total += bucket.length;
    return total;
  }
}

// ============================================================================
// STANDALONE HELPERS & FACTORIES
// ============================================================================

export function createChatBotPersonaEvolutionService(
  runtime?: ChatBotPersonaEvolution,
  options?: ChatBotPersonaEvolutionServiceOptions,
  clock?: ChatBotPersonaEvolutionServiceClock,
): ChatBotPersonaEvolutionService {
  return new ChatBotPersonaEvolutionService(runtime ?? new ChatBotPersonaEvolution(), options, clock ?? SYSTEM_CLOCK);
}

export function summarizeChatBotPersonaEvolutionSignal(
  signal: ChatPersonaEvolutionSignal,
  request: ChatBotPersonaEvolutionProjectionRequest,
  mode: PersonaEvolutionMode = "UNKNOWN",
  channelClass: PersonaEvolutionChannelClass = "UNKNOWN",
  tags: readonly string[] = [],
): PersonaEvolutionSignalDescriptor {
  return describeSignal(signal, request, mode, channelClass, tags);
}

export function summarizeChatBotPersonaEvolutionSnapshot(
  snapshot: ChatPersonaEvolutionSnapshot,
): PersonaEvolutionSnapshotDescriptor {
  return describeSnapshot(snapshot);
}

export function summarizeChatBotPersonaEvolutionEvent(
  event: ChatPersonaEvolutionEvent,
): PersonaEvolutionOpaqueEventDescriptor {
  return describeEvent(event);
}

export function buildChatBotPersonaEvolutionProjectionRequest(
  input: ChatBotPersonaEvolutionProjectInput,
): ChatBotPersonaEvolutionProjectionRequest {
  return makeProjectionRequest(normalizeProjectInput(input));
}

export function createChatBotPersonaEvolutionMetricDeck(
  service: ChatBotPersonaEvolutionService,
  botId: string,
): Record<string, number> {
  return {
    aggression: service.computeAggressionAverage(botId),
    respect: service.computeRespectAverage(botId),
    callbackAppetite: service.computeCallbackappetiteAverage(botId),
    publicPressure: service.computePublicpressureAverage(botId),
    privatePressure: service.computePrivatepressureAverage(botId),
    myth: service.computeMythAverage(botId),
    instability: service.computeInstabilityAverage(botId),
    adaptation: service.computeAdaptationAverage(botId),
    novelty: service.computeNoveltyAverage(botId),
    memory: service.computeMemoryAverage(botId),
    pressure: service.computePressureAverage(botId),
    rescue: service.computeRescueAverage(botId),
    spectacle: service.computeSpectacleAverage(botId),
    heat: service.computeHeatAverage(botId),
    trust: service.computeTrustAverage(botId),
    rivalry: service.computeRivalryAverage(botId),
    patience: service.computePatienceAverage(botId),
    volatility: service.computeVolatilityAverage(botId),
    persistence: service.computePersistenceAverage(botId),
    dominance: service.computeDominanceAverage(botId),
    humiliation: service.computeHumiliationAverage(botId),
    hype: service.computeHypeAverage(botId),
    silence: service.computeSilenceAverage(botId),
    recovery: service.computeRecoveryAverage(botId),
    proof: service.computeProofAverage(botId),
    negotiation: service.computeNegotiationAverage(botId),
    scene: service.computeSceneAverage(botId),
    persona: service.computePersonaAverage(botId),
    authority: service.computeAuthorityAverage(botId),
    variance: service.computeVarianceAverage(botId),
  };
}

export const CHAT_BOT_PERSONA_EVOLUTION_SERVICE_MODES = MODES;
export const CHAT_BOT_PERSONA_EVOLUTION_SERVICE_CHANNEL_CLASSES = CHANNEL_CLASSES;
// ============================================================================
// EXTENDED SELECTORS
// ============================================================================

export interface PersonaEvolutionMetricSummaryEntry {
  readonly botId: string;
  readonly metric: string;
  readonly value01: number;
}

export interface PersonaEvolutionMetricSummaryDeck {
  readonly generatedAt: number;
  readonly entries: readonly PersonaEvolutionMetricSummaryEntry[];
}

export function createChatBotPersonaEvolutionMetricSummaryDeck(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  now = Date.now(),
): PersonaEvolutionMetricSummaryDeck {
  const entries: PersonaEvolutionMetricSummaryEntry[] = [];
  for (const botId of botIds) {
    entries.push({ botId, metric: 'aggression', value01: service.computeAggressionAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'respect', value01: service.computeRespectAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'callbackAppetite', value01: service.computeCallbackappetiteAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'publicPressure', value01: service.computePublicpressureAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'privatePressure', value01: service.computePrivatepressureAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'myth', value01: service.computeMythAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'instability', value01: service.computeInstabilityAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'adaptation', value01: service.computeAdaptationAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'novelty', value01: service.computeNoveltyAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'memory', value01: service.computeMemoryAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'pressure', value01: service.computePressureAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'rescue', value01: service.computeRescueAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'spectacle', value01: service.computeSpectacleAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'heat', value01: service.computeHeatAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'trust', value01: service.computeTrustAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'rivalry', value01: service.computeRivalryAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'patience', value01: service.computePatienceAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'volatility', value01: service.computeVolatilityAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'persistence', value01: service.computePersistenceAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'dominance', value01: service.computeDominanceAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'humiliation', value01: service.computeHumiliationAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'hype', value01: service.computeHypeAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'silence', value01: service.computeSilenceAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'recovery', value01: service.computeRecoveryAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'proof', value01: service.computeProofAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'negotiation', value01: service.computeNegotiationAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'scene', value01: service.computeSceneAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'persona', value01: service.computePersonaAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'authority', value01: service.computeAuthorityAverage(botId) });
  }
  for (const botId of botIds) {
    entries.push({ botId, metric: 'variance', value01: service.computeVarianceAverage(botId) });
  }
  return { generatedAt: now, entries };
}

export function selectTopBotsByAggression(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'aggression',
      value01: service.computeAggressionAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByRespect(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'respect',
      value01: service.computeRespectAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByCallbackappetite(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'callbackAppetite',
      value01: service.computeCallbackappetiteAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByPublicpressure(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'publicPressure',
      value01: service.computePublicpressureAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByPrivatepressure(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'privatePressure',
      value01: service.computePrivatepressureAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByMyth(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'myth',
      value01: service.computeMythAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByInstability(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'instability',
      value01: service.computeInstabilityAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByAdaptation(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'adaptation',
      value01: service.computeAdaptationAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByNovelty(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'novelty',
      value01: service.computeNoveltyAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByMemory(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'memory',
      value01: service.computeMemoryAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByPressure(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'pressure',
      value01: service.computePressureAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByRescue(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'rescue',
      value01: service.computeRescueAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsBySpectacle(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'spectacle',
      value01: service.computeSpectacleAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByHeat(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'heat',
      value01: service.computeHeatAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByTrust(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'trust',
      value01: service.computeTrustAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByRivalry(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'rivalry',
      value01: service.computeRivalryAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByPatience(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'patience',
      value01: service.computePatienceAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByVolatility(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'volatility',
      value01: service.computeVolatilityAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByPersistence(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'persistence',
      value01: service.computePersistenceAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByDominance(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'dominance',
      value01: service.computeDominanceAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByHumiliation(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'humiliation',
      value01: service.computeHumiliationAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByHype(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'hype',
      value01: service.computeHypeAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsBySilence(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'silence',
      value01: service.computeSilenceAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByRecovery(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'recovery',
      value01: service.computeRecoveryAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByProof(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'proof',
      value01: service.computeProofAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByNegotiation(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'negotiation',
      value01: service.computeNegotiationAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByScene(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'scene',
      value01: service.computeSceneAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByPersona(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'persona',
      value01: service.computePersonaAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByAuthority(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'authority',
      value01: service.computeAuthorityAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function selectTopBotsByVariance(
  service: ChatBotPersonaEvolutionService,
  botIds: readonly string[],
  limit = 5,
): readonly PersonaEvolutionMetricSummaryEntry[] {
  return [...botIds]
    .map((botId) => ({
      botId,
      metric: 'variance',
      value01: service.computeVarianceAverage(botId),
    }))
    .sort((left, right) => right.value01 - left.value01 || left.botId.localeCompare(right.botId))
    .slice(0, limit);
}

export function exportChatBotPersonaEvolutionServiceBoards(
  service: ChatBotPersonaEvolutionService,
  now = Date.now(),
): readonly PersonaEvolutionBoard[] {
  return service.exportBoards(now);
}