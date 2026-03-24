/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ENGINE PHASE 1 BRIDGE
 * FILE: backend/src/game/engine/chat/phase1/ChatEnginePhaseOneBridge.ts
 * VERSION: 2026.03.22
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend bridge between the existing ChatEngine and the Phase 1
 * novelty / episodic memory intelligence stack.
 *
 * This file is deliberately additive:
 *   - it does not assume reducer ownership
 *   - it does not rewrite the existing engine
 *   - it expects ChatEngine.ts to call into it at six safe seams:
 *       1) constructor + hydration
 *       2) committed message append
 *       3) scene plan ingestion
 *       4) upstream signal normalization
 *       5) reaction candidate ranking
 *       6) periodic / authoritative sync
 *
 * Architecture doctrine
 * ---------------------
 * 1. ALL ChatMessage field access beyond id/channelId/tags goes through
 *    the module-level readMsg* accessor helpers using a safe cast pattern.
 *    Never touch message.body, message.channel, message.ts directly.
 *
 * 2. ALL ChatScenePlan field access beyond sceneId/roomId/openedAt/messages
 *    goes through readScene* accessor helpers. Never touch scene.startedAt
 *    or scene.primaryChannel directly.
 *
 * 3. ChatSignalEnvelope.type is the signal discriminant ('BATTLE' | 'RUN' |
 *    'MULTIPLAYER' | 'ECONOMY' | 'LIVEOPS'). There is no signalType field.
 *    Inner snapshots are on .battle / .run / .multiplayer / .economy / .liveops.
 *
 * 4. BotId is aliased from '../types' — not from '../../battle/types'.
 *
 * 5. ChatStateWithPhaseOne = ChatState & { phaseOne?: ChatPhaseOneStateSlice }.
 *    Mutations return a new state value through the official state helpers.
 *    The bridge is stateful in its intelligence objects (novelty, memory)
 *    but stateless with respect to authoritative ChatState ownership.
 *
 * 6. This bridge targets 20 million concurrent users. Every hot path is
 *    O(n log n) or better. Memory eviction, deduplication, and decay are
 *    handled by the intelligence objects. The bridge drives them correctly.
 *
 * Seam contract:
 * --------------
 *   ChatEngine.onMessageCommitted(message, state)
 *     → bridge.noteCommittedMessage(state, message, now) → ChatStateWithPhaseOne
 *
 *   ChatEngine.onScenePlanned(scene, summary, state)
 *     → bridge.noteScene(state, scene, summary, now) → ChatStateWithPhaseOne
 *
 *   ChatEngine.onSignalNormalized(envelope, state)
 *     → bridge.noteSignal(state, envelope, now) → ChatStateWithPhaseOne
 *
 *   ChatEngine.onCandidateRankingRequired(candidates, channelId, state)
 *     → bridge.rankResponseCandidates(state, candidates, channelId, sceneRole, now)
 *
 *   ChatEngine.onPeriodicSync(recommendedId, state)
 *     → bridge.syncIntoState(state, recommendedId, now) → ChatStateWithPhaseOne
 *
 *   ChatEngine.onRehydrationRequired(state)
 *     → bridge.hydrateFromState(state)
 * ============================================================================
 */

// ============================================================================
// MARK: Imports
// ============================================================================

import type {
  BotId,
  ChatBattleSnapshot,
  ChatEconomySnapshot,
  ChatFeatureSnapshot,
  ChatLiveOpsSnapshot,
  ChatMessage,
  ChatMultiplayerSnapshot,
  ChatResponseCandidate,
  ChatRunSnapshot,
  ChatScenePlan,
  ChatSignalEnvelope,
  ChatVisibleChannel,
  UnixMs,
} from '../types';

import {
  ChatNoveltyLedger,
  type ChatNoveltyLedgerCandidate,
  type ChatNoveltyLedgerDirectorHints,
  type ChatNoveltyLedgerOptions,
  type ChatNoveltyLedgerScore,
  type ChatNoveltyLedgerSnapshot,
} from '../intelligence/ChatNoveltyLedger';

import {
  ChatEpisodicMemory,
  type ChatEpisodicCallbackCandidate,
  type ChatEpisodicCallbackRequest,
  type ChatEpisodicCarryoverItem,
  type ChatEpisodicEventType,
  type ChatEpisodicMemoryOptions,
  type ChatEpisodicMemoryRecord,
  type ChatEpisodicMemorySnapshot,
  type ChatEpisodicTriggerContext,
} from '../intelligence/ChatEpisodicMemory';

import {
  type ChatConversationalFingerprint,
  type ChatPhaseOneStateSlice,
  type ChatEngineStateWithPhaseOne as ChatStateWithPhaseOne,
  applyConversationalFingerprintDeltaInState,
  getPhaseOneState,
  notePhaseOneCarryoverSummaryInState,
  serializePhaseOneStateSlice,
  hydratePhaseOneStateSlice,
  setPhaseOneEpisodicMemoryInState,
  setPhaseOneNoveltyLedgerInState,
  setPhaseOneRecommendedCandidateIdInState,
  setSemanticFatigueInState,
  withPhaseOneState,
} from './ChatStatePhaseOne';

// ============================================================================
// MARK: Private accessor helpers — ChatMessage
// These mirror the pattern established in ChatEpisodicMemory.ts.
// They are module-private here. All callers must go through these.
// ============================================================================

/** Unsafe cast to access optional extended fields on ChatMessage. */
interface BackendMessageExtended {
  readonly content?: unknown;
  readonly text?: unknown;
  readonly body?: unknown;
  readonly kind?: unknown;
  readonly ts?: unknown;
  readonly timestamp?: unknown;
  readonly meta?: unknown;
  readonly metadata?: unknown;
  readonly senderId?: unknown;
  readonly botId?: unknown;
  readonly sceneId?: unknown;
  readonly momentId?: unknown;
  readonly proofHash?: unknown;
  readonly pressureTier?: unknown;
}

function asExtendedMsg(message: ChatMessage): BackendMessageExtended {
  return message as unknown as BackendMessageExtended;
}

/**
 * Read the plain-text body of a message.
 * Falls back through content → text → body → plainText → ''.
 */
function readMsgText(message: ChatMessage): string {
  const ext = asExtendedMsg(message);
  const plain = (message as unknown as { plainText?: unknown }).plainText;
  return String(ext.content ?? ext.text ?? ext.body ?? plain ?? '');
}

/**
 * Read the kind discriminant (NPC_TAUNT, RESCUE, BREACH, etc.).
 * Normalized to uppercase.
 */
function readMsgKind(message: ChatMessage): string {
  return String(asExtendedMsg(message).kind ?? '').toUpperCase();
}

/**
 * Read the authoritative channelId.
 * The backend ChatMessage always has channelId on the canonical contract,
 * but we normalize here for safety.
 */
function readMsgChannelId(message: ChatMessage): string | null {
  const ch = message.channelId;
  const normalized = String(ch ?? '').toUpperCase().trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Read a timestamp from the message.
 * Order of preference: createdAt → timestamp → ts → Date.now().
 */
function readMsgTimestamp(message: ChatMessage): UnixMs {
  const ext = asExtendedMsg(message);
  const ts = message.createdAt ?? ext.timestamp ?? ext.ts;
  const num = Number(ts ?? 0);
  return (Number.isFinite(num) && num > 0 ? num : Date.now()) as UnixMs;
}

/** Read meta / metadata blob, normalized to a plain record. */
function readMsgMeta(message: ChatMessage): Record<string, unknown> {
  const ext = asExtendedMsg(message);
  const raw = ext.metadata ?? ext.meta;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/** Read shield breach flag from message metadata. */
function readMsgShieldBreached(message: ChatMessage): boolean {
  const meta = readMsgMeta(message);
  const shieldMeta = meta['shieldMeta'] as Record<string, unknown> | undefined;
  return shieldMeta?.['isBreached'] === true;
}

/** Read cascade direction (POSITIVE | NEGATIVE | null) from metadata. */
function readMsgCascadeDirection(message: ChatMessage): string | null {
  const meta = readMsgMeta(message);
  const cascadeMeta = meta['cascadeMeta'] as Record<string, unknown> | undefined;
  const dir = String(cascadeMeta?.['direction'] ?? '').toUpperCase().trim();
  return dir.length > 0 ? dir : null;
}

/** Read deal-room bluff risk (0–1) from metadata. */
function readMsgBluffRisk(message: ChatMessage): number | null {
  const meta = readMsgMeta(message);
  const dealRoom = meta['dealRoom'] as Record<string, unknown> | undefined;
  const raw = Number(dealRoom?.['bluffRisk'] ?? NaN);
  return Number.isFinite(raw) ? clamp01(raw) : null;
}

/** Read deal-room urgency score (0–1) from metadata. */
function readMsgDealUrgency(message: ChatMessage): number | null {
  const meta = readMsgMeta(message);
  const dealRoom = meta['dealRoom'] as Record<string, unknown> | undefined;
  const raw = Number(dealRoom?.['urgencyScore'] ?? NaN);
  return Number.isFinite(raw) ? clamp01(raw) : null;
}

/** Read the pressure tier string from metadata or top-level field. */
function readMsgPressureTier(message: ChatMessage): string | null {
  const ext = asExtendedMsg(message);
  const meta = readMsgMeta(message);
  const topLevel = ext.pressureTier;
  if (topLevel) return String(topLevel).toUpperCase().trim();
  const metaPt = meta['pressureTier'] ?? (meta['pressure'] as Record<string, unknown> | undefined)?.['pressureTier'];
  if (metaPt) return String(metaPt).toUpperCase().trim();
  return null;
}

/** Read the sceneId from message metadata. */
function readMsgSceneId(message: ChatMessage): string | null {
  const ext = asExtendedMsg(message);
  const meta = readMsgMeta(message);
  const raw = ext.sceneId ?? meta['sceneId'];
  if (!raw) return null;
  const val = String(raw).trim();
  return val.length > 0 ? val : null;
}

/** Read the momentId from message metadata. */
function readMsgMomentId(message: ChatMessage): string | null {
  const ext = asExtendedMsg(message);
  const meta = readMsgMeta(message);
  const raw = ext.momentId ?? meta['momentId'];
  if (!raw) return null;
  const val = String(raw).trim();
  return val.length > 0 ? val : null;
}

/** Read the senderId / playerId from message metadata or top-level. */
function readMsgSenderId(message: ChatMessage): string | null {
  const ext = asExtendedMsg(message);
  const meta = readMsgMeta(message);
  const raw = ext.senderId ?? meta['senderId'] ?? meta['playerId'] ?? message.attribution?.actorId;
  if (!raw) return null;
  const val = String(raw).trim();
  return val.length > 0 ? val : null;
}

/**
 * Read the bot source descriptor from message metadata.
 * Returns null when not present.
 */
function readMsgBotSource(message: ChatMessage): { readonly botId?: string; readonly isRetreat?: boolean } | null {
  const meta = readMsgMeta(message);
  const botSource = meta['botSource'] as Record<string, unknown> | undefined;
  if (!botSource) {
    const attribution = message.attribution;
    if (attribution?.botId) {
      return { botId: String(attribution.botId), isRetreat: false };
    }
    return null;
  }
  return {
    botId: typeof botSource['botId'] === 'string' ? botSource['botId'] : undefined,
    isRetreat: botSource['isRetreat'] === true,
  };
}

// ============================================================================
// MARK: Private accessor helpers — ChatScenePlan
// These mirror the pattern established in ChatEpisodicMemory.ts.
// ============================================================================

/** Unsafe cast to access optional extended fields on ChatScenePlan. */
interface BackendScenePlanExtended {
  readonly primaryChannel?: unknown;
  readonly startedAt?: unknown;
  readonly createdAtMs?: unknown;
  readonly momentId?: unknown;
  readonly momentType?: unknown;
}

function asExtendedScene(scene: ChatScenePlan): BackendScenePlanExtended {
  return scene as unknown as BackendScenePlanExtended;
}

/** Read the sceneId — always present on the canonical contract. */
function readSceneId(scene: ChatScenePlan): string {
  return String(scene.sceneId ?? '').trim();
}

/** Read the primary visible channel from the scene plan extended fields. */
function readScenePrimaryChannel(scene: ChatScenePlan): string {
  const ext = asExtendedScene(scene);
  const raw = ext.primaryChannel;
  if (raw) {
    const ch = String(raw).toUpperCase().trim();
    if (ch.length > 0) return ch;
  }
  return 'GLOBAL';
}

/**
 * Read the scene start timestamp.
 * Falls back through startedAt → createdAtMs → openedAt → Date.now().
 */
function readSceneStartedAt(scene: ChatScenePlan): UnixMs {
  const ext = asExtendedScene(scene);
  const ts = ext.startedAt ?? ext.createdAtMs ?? scene.openedAt;
  const num = Number(ts ?? 0);
  return (Number.isFinite(num) && num > 0 ? num : Date.now()) as UnixMs;
}

/** Read the momentId from the scene plan extended fields. */
function readSceneMomentId(scene: ChatScenePlan): string | null {
  const ext = asExtendedScene(scene);
  const raw = ext.momentId;
  if (!raw) return null;
  const val = String(raw).trim();
  return val.length > 0 ? val : null;
}

/** Read the momentType from the scene plan extended fields. */
function readSceneMomentType(scene: ChatScenePlan): string {
  const ext = asExtendedScene(scene);
  const raw = ext.momentType;
  if (!raw) return '';
  return String(raw).toUpperCase().trim();
}

// ============================================================================
// MARK: Utility helpers
// ============================================================================

function clamp01(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  return value <= 0 ? 0 : value >= 1 ? 1 : Number(value.toFixed(6));
}

function lerp(a: number, b: number, t: number): number {
  return clamp01(a + (b - a) * clamp01(t));
}

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

function normalizeUpperCase(value: unknown): string {
  return String(value ?? '').toUpperCase().trim();
}

/** Map backend PressureTier to episodic pressure band vocabulary. */
function mapPressureTierToBand(
  pressureTier: string | null | undefined,
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (normalizeUpperCase(pressureTier)) {
    case 'CRITICAL': return 'CRITICAL';
    case 'HIGH':     return 'HIGH';
    case 'ELEVATED':
    case 'BUILDING': return 'MEDIUM';
    case 'NONE':
    default:         return 'LOW';
  }
}

/** Map hostileMomentum01 (0–1) to episodic pressure band. */
function momentumToBand(
  hostileMomentum01: number,
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (hostileMomentum01 >= 0.85) return 'CRITICAL';
  if (hostileMomentum01 >= 0.60) return 'HIGH';
  if (hostileMomentum01 >= 0.35) return 'MEDIUM';
  return 'LOW';
}

/** Map roomHeat01 to descriptive label for diagnostics. */
function heatLabel(heat01: number): string {
  if (heat01 >= 0.90) return 'VOLCANIC';
  if (heat01 >= 0.70) return 'HOT';
  if (heat01 >= 0.45) return 'WARM';
  if (heat01 >= 0.20) return 'COOL';
  return 'COLD';
}

/** Nudge a fingerprint dimension toward a target with a given strength. */
function nudge(current: number, target: number, strength: number): number {
  return clamp01(lerp(current, target, clamp01(strength)));
}

// ============================================================================
// MARK: Constants
// ============================================================================

const BRIDGE_VERSION = '2026.03.22.phase1' as const;

/**
 * Minimum interval between full sync-into-state calls when driven by signals
 * only (no message commit). Prevents excessive snapshot churn.
 */
const MIN_SIGNAL_SYNC_INTERVAL_MS = 4_000;

/**
 * Weight applied to novelty score in composite ranking.
 * Remaining weight is split between callback score and candidate priority.
 */
const NOVELTY_COMPOSITE_WEIGHT = 0.55;
const CALLBACK_COMPOSITE_WEIGHT = 0.25;
const PRIORITY_COMPOSITE_WEIGHT = 0.20;

/**
 * Fingerprint blend momentum — lower means slower drift from observed signals.
 * Keep low for stability; each message contributes a small nudge.
 */
const FINGERPRINT_MESSAGE_MOMENTUM = 0.08;
const FINGERPRINT_SIGNAL_MOMENTUM = 0.04;
const FINGERPRINT_SCENE_MOMENTUM = 0.06;
const FINGERPRINT_FEATURE_MOMENTUM = 0.03;

/** Channels that amplify public performer dimension. */
const PUBLIC_CHANNELS = new Set<string>(['GLOBAL', 'LOBBY']);
/** Channels that amplify silent operator dimension. */
const PRIVATE_CHANNELS = new Set<string>(['SYNDICATE', 'NPC_SHADOW']);
/** Deal room channel identifier. */
const DEAL_ROOM_CHANNEL = 'DEAL_ROOM';

// ============================================================================
// MARK: Internal mutable fingerprint builder type
// ChatConversationalFingerprint has all-readonly fields.
// Build deltas into this mutable shape then pass to the state helper.
// ============================================================================

type FingerprintDelta = {
  -readonly [K in keyof Omit<ChatConversationalFingerprint, 'updatedAt'>]?: number;
};

// ============================================================================
// MARK: Exported types and interfaces
// ============================================================================

export interface ChatPhaseOneBridgeOptions {
  /** Authoritative player identifier — used in memory attribution. */
  readonly playerId?: string;
  /** Room identifier — used in signal memory recording. */
  readonly roomId?: string;
  /** Starting timestamp override (useful for deterministic testing). */
  readonly now?: UnixMs;
  /** Novelty ledger tuning options. */
  readonly noveltyOptions?: ChatNoveltyLedgerOptions;
  /** Episodic memory tuning options. */
  readonly memoryOptions?: ChatEpisodicMemoryOptions;
  /**
   * When true, syncIntoState is called automatically after every noteSignal.
   * Default false — let ChatEngine drive sync on its own cadence.
   */
  readonly autoSyncOnSignal?: boolean;
  /**
   * When true, decay() is called on every noteCommittedMessage call.
   * Default false — prefer explicit periodic decay.
   */
  readonly autoDecayOnMessage?: boolean;
  /** Maximum number of callback candidates surfaced per rankResponseCandidates call. */
  readonly maxCallbacksPerRank?: number;
}

export interface ChatPhaseOneResponseCandidate extends ChatNoveltyLedgerCandidate {
  /** Pre-resolved callback candidates for this NPC persona. */
  readonly callbackCandidates?: readonly ChatEpisodicCallbackCandidate[];
  /** Caller-supplied normalized priority weight (0–1). */
  readonly baseWeight01?: number;
  /** NPC role — HATER / HELPER / AMBIENT / NARRATOR. */
  readonly npcRole?: 'HATER' | 'HELPER' | 'AMBIENT' | 'NARRATOR';
  /**
   * Scene role — used in callback eligibility filtering.
   * E.g. 'TAUNT', 'RESCUE', 'RECKONING', 'CROWD_WITNESS', 'TRAP'.
   */
  readonly sceneRole?: string | null;
  /** Persona identifier — for channeling callback eligibility. */
  readonly personaId?: string | null;
}

export interface ChatPhaseOneRankedCandidate {
  readonly candidateId: string;
  readonly novelty: ChatNoveltyLedgerScore;
  readonly callback: ChatEpisodicCallbackCandidate | undefined;
  readonly compositeScore01: number;
  readonly npcRole: 'HATER' | 'HELPER' | 'AMBIENT' | 'NARRATOR' | undefined;
  readonly sceneRole: string | undefined;
  readonly notes: readonly string[];
  readonly rankedAt: UnixMs;
}

export interface ChatPhaseOneBridgeDiagnostics {
  readonly version: typeof BRIDGE_VERSION;
  readonly playerId: string | undefined;
  readonly roomId: string | undefined;
  readonly hydrated: boolean;
  readonly syncCount: number;
  readonly messageNotedCount: number;
  readonly sceneNotedCount: number;
  readonly signalNotedCount: number;
  readonly lastSyncAt: UnixMs | undefined;
  readonly lastMessageAt: UnixMs | undefined;
  readonly lastSceneAt: UnixMs | undefined;
  readonly lastSignalAt: UnixMs | undefined;
  readonly activeMemoryCount: number;
  readonly archivedMemoryCount: number;
  readonly unresolvedMemoryCount: number;
  readonly latestCarryoverSummary: string | undefined;
  readonly fingerprintAge: number;
  readonly semanticFatigueByChannel: Readonly<Record<string, number>>;
  readonly unresolvedCallbackIds: readonly string[];
}

export interface ChatPhaseOneBridgeHealthSnapshot {
  readonly healthy: boolean;
  readonly hydrated: boolean;
  readonly memoryLoad01: number;
  readonly averageFatigue01: number;
  readonly unresolvedPressure01: number;
  readonly lastActivityMs: number;
  readonly warnings: readonly string[];
}

export interface ChatPhaseOneBridgeSignalSummary {
  readonly signalType: string;
  readonly eventType: ChatEpisodicEventType;
  readonly summary: string;
  readonly channelId?: string;
  readonly botId?: BotId | string | null;
  readonly counterpartId?: string | null;
  readonly pressureBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly fingerprintNudges?: Partial<Omit<ChatConversationalFingerprint, 'updatedAt'>>;
  readonly tags: readonly string[];
}

export interface ChatPhaseOneBridgeSyncReport {
  readonly syncedAt: UnixMs;
  readonly recommendedCandidateId: string | undefined;
  readonly noveltySnapshotUpdatedAt: UnixMs | undefined;
  readonly memorySnapshotUpdatedAt: UnixMs | undefined;
  readonly carryoverSummary: string | undefined;
}

/** Structured view of a battle context provided by a signal. */
export interface ChatPhaseOneBattleContext {
  readonly pressureTier: string;
  readonly activeAttackType: string | null;
  readonly activeBotId: string | null;
  readonly hostileMomentum01: number;
  readonly rescueWindowOpen: boolean;
  readonly shieldIntegrity01: number;
}

/** Structured view of a run context provided by a signal. */
export interface ChatPhaseOneRunContext {
  readonly runPhase: string;
  readonly tickTier: string;
  readonly outcome: string;
  readonly bankruptcyWarning: boolean;
  readonly nearSovereignty: boolean;
}

/** Structured view of an economy context provided by a signal. */
export interface ChatPhaseOneEconomyContext {
  readonly activeDealCount: number;
  readonly liquidityStress01: number;
  readonly bluffRisk01: number;
  readonly overpayRisk01: number;
}

/** Structured view of a LiveOps context provided by a signal. */
export interface ChatPhaseOneLiveOpsContext {
  readonly worldEventName: string | null;
  readonly heatMultiplier01: number;
  readonly helperBlackout: boolean;
  readonly haterRaidActive: boolean;
}

// ============================================================================
// MARK: Main class
// ============================================================================

/**
 * ChatEnginePhaseOneBridge
 * ========================
 * The authoritative backend bridge between ChatEngine and the Phase 1
 * novelty + episodic memory intelligence stack.
 *
 * Stateful in its intelligence objects (novelty ledger, episodic memory).
 * Stateless with respect to authoritative ChatState ownership.
 * All state mutations return immutable ChatStateWithPhaseOne values.
 *
 * Thread safety: not thread-safe. ChatEngine must serialize calls per session.
 */
export class ChatEnginePhaseOneBridge {

  /* ── Intelligence objects ───────────────────────────────────────────── */
  private readonly novelty: ChatNoveltyLedger;
  private readonly memory: ChatEpisodicMemory;

  /* ── Identity ──────────────────────────────────────────────────────── */
  private readonly playerId: string | undefined;
  private readonly roomId: string | undefined;

  /* ── Options ───────────────────────────────────────────────────────── */
  private readonly autoSyncOnSignal: boolean;
  private readonly autoDecayOnMessage: boolean;
  private readonly maxCallbacksPerRank: number;

  /* ── Lifecycle state ───────────────────────────────────────────────── */
  private hydrated = false;
  private lastSignalSyncAt: UnixMs | undefined;

  /* ── Telemetry counters ────────────────────────────────────────────── */
  private syncCount = 0;
  private messageNotedCount = 0;
  private sceneNotedCount = 0;
  private signalNotedCount = 0;
  private lastSyncAt: UnixMs | undefined;
  private lastMessageAt: UnixMs | undefined;
  private lastSceneAt: UnixMs | undefined;
  private lastSignalAt: UnixMs | undefined;

  /* ── Cached context frames (updated on signals) ────────────────────── */
  private lastBattleContext: ChatPhaseOneBattleContext | null = null;
  private lastRunContext: ChatPhaseOneRunContext | null = null;
  private lastEconomyContext: ChatPhaseOneEconomyContext | null = null;
  private lastLiveOpsContext: ChatPhaseOneLiveOpsContext | null = null;

  // --------------------------------------------------------------------------
  // MARK: Constructor
  // --------------------------------------------------------------------------

  public constructor(options: ChatPhaseOneBridgeOptions = {}) {
    const now = options.now ?? nowMs();
    this.playerId = options.playerId;
    this.roomId = options.roomId;
    this.autoSyncOnSignal = options.autoSyncOnSignal ?? false;
    this.autoDecayOnMessage = options.autoDecayOnMessage ?? false;
    this.maxCallbacksPerRank = Math.max(1, options.maxCallbacksPerRank ?? 8);
    this.novelty = new ChatNoveltyLedger(options.noveltyOptions ?? {}, now);
    this.memory = new ChatEpisodicMemory(options.memoryOptions ?? {}, now);
  }

  // --------------------------------------------------------------------------
  // MARK: Hydration seam
  // --------------------------------------------------------------------------

  /**
   * Restore internal intelligence state from the authoritative ChatStateWithPhaseOne.
   * Always safe to call — will not double-hydrate (use forceRehydrate if needed).
   */
  public hydrateFromState(state: ChatStateWithPhaseOne): void {
    const phaseOne = getPhaseOneState(state);
    if (phaseOne.noveltyLedger) {
      this.novelty.restore(phaseOne.noveltyLedger);
    }
    if (phaseOne.episodicMemory) {
      this.memory.restore(phaseOne.episodicMemory);
    }
    this.hydrated = true;
  }

  /**
   * Ensure hydrated — lazy hydration on first seam call.
   * Called at the start of every public seam method.
   */
  public ensureHydrated(state: ChatStateWithPhaseOne): void {
    if (this.hydrated) return;
    this.hydrateFromState(state);
  }

  /**
   * Force rehydration regardless of current hydration status.
   * Use when the authoritative state has been patched externally
   * (e.g. after an authoritative reconciliation from persistence).
   */
  public forceRehydrate(state: ChatStateWithPhaseOne): void {
    this.hydrated = false;
    this.hydrateFromState(state);
  }

  // --------------------------------------------------------------------------
  // MARK: Message seam — noteCommittedMessage / noteCommittedMessages
  // --------------------------------------------------------------------------

  /**
   * Seam 2: Called by ChatEngine after a message is committed to the transcript.
   *
   * Drives novelty ledger observation, episodic memory recording,
   * fingerprint derivation, and carryover summary update.
   *
   * Uses readMsg* helpers exclusively — no direct message field access beyond
   * the canonical backend contract fields (id, channelId, tags, attribution).
   */
  public noteCommittedMessage(
    state: ChatStateWithPhaseOne,
    message: ChatMessage,
    now: UnixMs = readMsgTimestamp(message),
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);

    /* Feed the novelty ledger — uses canonical backend fields internally */
    this.novelty.noteMessage(message, now);

    /* Feed episodic memory — uses readMsg* internally */
    this.memory.noteMessage(message, now);

    /* Apply optional decay on message commit when configured */
    if (this.autoDecayOnMessage) {
      this.memory.decay(now);
    }

    /* Derive fingerprint delta from this message */
    const fingerprintDelta = this.deriveFingerprintDeltaFromMessage(message, now);

    /* Mutate state with updated intelligence snapshots */
    let next = state;
    next = setPhaseOneNoveltyLedgerInState(next, this.novelty.snapshot(now), now);
    next = setPhaseOneEpisodicMemoryInState(next, this.memory.snapshot(), now);
    next = applyConversationalFingerprintDeltaInState(next, fingerprintDelta, now);
    next = notePhaseOneCarryoverSummaryInState(next, this.memory.buildCarryoverSummary(), now);

    /* Update semantic fatigue per channel */
    const channelId = readMsgChannelId(message);
    if (channelId && this.isVisibleChannel(channelId)) {
      const snap = this.novelty.snapshot(now);
      const fatigueEntry = snap.fatigueByChannel.find((f) => f.channelId === channelId);
      if (fatigueEntry) {
        next = setSemanticFatigueInState(next, channelId as ChatVisibleChannel, fatigueEntry.fatigue01, now);
      }
    }

    /* Telemetry */
    this.messageNotedCount += 1;
    this.lastMessageAt = now;

    return next;
  }

  /**
   * Batch variant of noteCommittedMessage.
   * All messages are processed in sequence and the final state is returned.
   */
  public noteCommittedMessages(
    state: ChatStateWithPhaseOne,
    messages: readonly ChatMessage[],
    now?: UnixMs,
  ): ChatStateWithPhaseOne {
    let current = state;
    for (const message of messages) {
      const ts = now ?? readMsgTimestamp(message);
      current = this.noteCommittedMessage(current, message, ts);
    }
    return current;
  }

  // --------------------------------------------------------------------------
  // MARK: Scene seam — noteScene / noteScenes
  // --------------------------------------------------------------------------

  /**
   * Seam 3: Called by ChatEngine after a ChatScenePlan is finalized.
   *
   * Uses readScene* accessor helpers exclusively for extended field access.
   * scene.startedAt, scene.primaryChannel must not be accessed directly.
   */
  public noteScene(
    state: ChatStateWithPhaseOne,
    scene: ChatScenePlan,
    summary: string,
    now: UnixMs = readSceneStartedAt(scene),
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);

    /* Feed the novelty ledger — passes primary channel from accessor helper */
    const primaryChannel = readScenePrimaryChannel(scene);
    this.novelty.noteScene(scene, primaryChannel as ChatVisibleChannel, now);

    /* Feed episodic memory — uses readScene* internally */
    this.memory.noteScene(scene, summary, now);

    /* Derive fingerprint nudge from scene context */
    const fingerprintDelta = this.deriveFingerprintDeltaFromScene(scene, now);

    let next = state;
    next = setPhaseOneNoveltyLedgerInState(next, this.novelty.snapshot(now), now);
    next = setPhaseOneEpisodicMemoryInState(next, this.memory.snapshot(), now);
    next = applyConversationalFingerprintDeltaInState(next, fingerprintDelta, now);
    next = notePhaseOneCarryoverSummaryInState(next, this.memory.buildCarryoverSummary(), now);

    /* Propagate legend scene — boost public performer dimension */
    if (scene.legendCandidate) {
      const phaseOne = getPhaseOneState(next);
      const fp = phaseOne.conversationalFingerprint;
      next = applyConversationalFingerprintDeltaInState(next, {
        publicPerformer01: nudge(fp.publicPerformer01, 0.78, FINGERPRINT_SCENE_MOMENTUM * 1.5),
        stabilitySeeking01: nudge(fp.stabilitySeeking01, 0.35, FINGERPRINT_SCENE_MOMENTUM),
      }, now);
    }

    this.sceneNotedCount += 1;
    this.lastSceneAt = now;

    return next;
  }

  /**
   * Batch scene notation. Each entry provides a scene plan and its summary.
   */
  public noteScenes(
    state: ChatStateWithPhaseOne,
    entries: readonly { readonly scene: ChatScenePlan; readonly summary: string }[],
    now?: UnixMs,
  ): ChatStateWithPhaseOne {
    let current = state;
    for (const entry of entries) {
      const ts = now ?? readSceneStartedAt(entry.scene);
      current = this.noteScene(current, entry.scene, entry.summary, ts);
    }
    return current;
  }

  // --------------------------------------------------------------------------
  // MARK: Signal seam — noteSignal / noteSignals
  // --------------------------------------------------------------------------

  /**
   * Seam 4: Called by ChatEngine after a ChatSignalEnvelope is normalized.
   *
   * Dispatches on signal.type ('BATTLE' | 'RUN' | 'MULTIPLAYER' | 'ECONOMY' | 'LIVEOPS').
   * NEVER uses signal.signalType (does not exist on the backend contract).
   *
   * Inner snapshots (signal.battle, signal.run, signal.economy, etc.) are
   * accessed through typed extraction helpers that handle undefined safely.
   */
  public noteSignal(
    state: ChatStateWithPhaseOne,
    signal: ChatSignalEnvelope,
    now: UnixMs = signal.emittedAt,
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);

    const summary = this.describeSignal(signal);
    if (!summary) return state;

    /* Cache context frames for use in fingerprint + ranking decisions */
    this.updateContextFromSignal(signal);

    /* Record the episodic event */
    const triggerContext: ChatEpisodicTriggerContext = {
      roomId: signal.roomId ?? this.roomId ?? null,
      channelId: summary.channelId ?? null,
      summary: summary.summary,
      rawText: summary.summary,
      botId: summary.botId ?? null,
      counterpartId: summary.counterpartId ?? null,
      pressureBand: summary.pressureBand,
      tags: summary.tags,
      sourceKind: 'SYSTEM',
      sourceReliability01: 0.92,
      visibility: 'VISIBLE',
    };

    this.memory.recordEvent(summary.eventType, triggerContext, now);

    /* Apply fingerprint nudges from the signal */
    let next = state;
    if (summary.fingerprintNudges) {
      next = applyConversationalFingerprintDeltaInState(next, summary.fingerprintNudges, now);
    }

    /* Sync episodic memory into state */
    next = setPhaseOneEpisodicMemoryInState(next, this.memory.snapshot(), now);
    next = notePhaseOneCarryoverSummaryInState(next, this.memory.buildCarryoverSummary(), now);

    /* Conditionally sync novelty ledger — throttle to avoid snapshot churn */
    const shouldSyncNovelty = !this.lastSignalSyncAt ||
      (Number(now) - Number(this.lastSignalSyncAt)) >= MIN_SIGNAL_SYNC_INTERVAL_MS;
    if (shouldSyncNovelty || this.autoSyncOnSignal) {
      next = setPhaseOneNoveltyLedgerInState(next, this.novelty.snapshot(now), now);
      this.lastSignalSyncAt = now;
    }

    this.signalNotedCount += 1;
    this.lastSignalAt = now;

    return next;
  }

  /**
   * Process a batch of signal envelopes in emission order.
   */
  public noteSignals(
    state: ChatStateWithPhaseOne,
    signals: readonly ChatSignalEnvelope[],
    now?: UnixMs,
  ): ChatStateWithPhaseOne {
    const sorted = [...signals].sort((a, b) => Number(a.emittedAt) - Number(b.emittedAt));
    let current = state;
    for (const signal of sorted) {
      current = this.noteSignal(current, signal, now ?? signal.emittedAt);
    }
    return current;
  }

  // --------------------------------------------------------------------------
  // MARK: Ranking seam — rankResponseCandidates
  // --------------------------------------------------------------------------

  /**
   * Seam 5a: Rank a set of ChatPhaseOneResponseCandidate objects.
   *
   * Composites novelty score + callback score + caller-supplied base weight.
   * Returns descending by compositeScore01.
   */
  public rankResponseCandidates(
    state: ChatStateWithPhaseOne,
    candidates: readonly ChatPhaseOneResponseCandidate[],
    channelId: ChatVisibleChannel,
    sceneRole: string | null = null,
    now: UnixMs = nowMs(),
  ): readonly ChatPhaseOneRankedCandidate[] {
    this.ensureHydrated(state);

    if (!candidates.length) return [];

    /* Score all candidates through the novelty ledger */
    const noveltyScores = this.novelty.rankCandidates(candidates, now);
    const phaseOne = getPhaseOneState(state);
    const fp = phaseOne.conversationalFingerprint;

    const ranked = noveltyScores.map((noveltyScore) => {
      const candidate = candidates.find((c) => c.candidateId === noveltyScore.candidateId);

      /* Resolve callback candidate for this NPC */
      const callback = this.resolveCallbackForCandidate(candidate, channelId, sceneRole, now);

      /* Build composite score */
      const compositeScore01 = this.buildCompositeScore(noveltyScore, callback, candidate, fp);

      const notes: string[] = [...noveltyScore.notes];
      if (callback) notes.push(`callback:${callback.eventType.toLowerCase()}`);
      if (candidate?.npcRole) notes.push(`npc:${candidate.npcRole.toLowerCase()}`);
      if (candidate?.sceneRole) notes.push(`scene:${candidate.sceneRole.toLowerCase()}`);

      return {
        candidateId: noveltyScore.candidateId,
        novelty: noveltyScore,
        callback,
        compositeScore01,
        npcRole: candidate?.npcRole,
        sceneRole: candidate?.sceneRole ?? undefined,
        notes,
        rankedAt: now,
      } satisfies ChatPhaseOneRankedCandidate;
    });

    return ranked.sort((a, b) =>
      b.compositeScore01 - a.compositeScore01 ||
      a.candidateId.localeCompare(b.candidateId)
    );
  }

  /**
   * Seam 5b: Rank raw ChatResponseCandidate objects from the scene plan.
   * Uses the novelty ledger's direct response-candidate path.
   * Returns novelty scores sorted descending.
   */
  public rankSceneCandidates(
    state: ChatStateWithPhaseOne,
    candidates: readonly ChatResponseCandidate[],
    now: UnixMs = nowMs(),
  ): readonly ChatNoveltyLedgerScore[] {
    this.ensureHydrated(state);
    if (!candidates.length) return [];
    return this.novelty.rankResponseCandidates(candidates, now);
  }

  // --------------------------------------------------------------------------
  // MARK: Sync seam — syncIntoState
  // --------------------------------------------------------------------------

  /**
   * Seam 6: Periodic / authoritative sync.
   *
   * Called by ChatEngine on its own cadence (e.g., after a tick, after a scene,
   * or when the engine wants to checkpoint the Phase 1 state slice.
   *
   * Records the recommended candidate ID and produces a full snapshot of both
   * novelty ledger and episodic memory into the state.
   */
  public syncIntoState(
    state: ChatStateWithPhaseOne,
    recommendedCandidateId: string | undefined,
    now: UnixMs = nowMs(),
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);

    let next = state;
    next = setPhaseOneNoveltyLedgerInState(next, this.novelty.snapshot(now), now);
    next = setPhaseOneEpisodicMemoryInState(next, this.memory.snapshot(), now);
    next = setPhaseOneRecommendedCandidateIdInState(next, recommendedCandidateId, now);
    next = notePhaseOneCarryoverSummaryInState(next, this.memory.buildCarryoverSummary(), now);

    this.syncCount += 1;
    this.lastSyncAt = now;
    this.lastSignalSyncAt = now;

    return next;
  }

  /**
   * Produce a sync report without mutating state — for diagnostic purposes.
   */
  public buildSyncReport(
    state: ChatStateWithPhaseOne,
    recommendedCandidateId: string | undefined,
    now: UnixMs = nowMs(),
  ): ChatPhaseOneBridgeSyncReport {
    this.ensureHydrated(state);
    const noveltySnap: ChatNoveltyLedgerSnapshot = this.novelty.snapshot(now);
    const memorySnap: ChatEpisodicMemorySnapshot = this.memory.snapshot();
    return {
      syncedAt: now,
      recommendedCandidateId,
      noveltySnapshotUpdatedAt: noveltySnap.updatedAt,
      memorySnapshotUpdatedAt: memorySnap.updatedAt,
      carryoverSummary: this.memory.buildCarryoverSummary(),
    };
  }

  // --------------------------------------------------------------------------
  // MARK: Callback management
  // --------------------------------------------------------------------------

  /**
   * Mark a memory as reused after a callback was delivered.
   * Resolves the unresolved flag for the given memoryId.
   */
  public markCallbackUsed(
    state: ChatStateWithPhaseOne,
    memoryId: string,
    callbackId?: string,
    now: UnixMs = nowMs(),
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);
    this.memory.markReused(memoryId, callbackId, now);
    return setPhaseOneEpisodicMemoryInState(state, this.memory.snapshot(), now);
  }

  /**
   * Mark multiple callbacks as used in a single pass.
   */
  public markCallbacksUsed(
    state: ChatStateWithPhaseOne,
    entries: readonly { readonly memoryId: string; readonly callbackId?: string }[],
    now: UnixMs = nowMs(),
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);
    for (const entry of entries) {
      this.memory.markReused(entry.memoryId, entry.callbackId, now);
    }
    return setPhaseOneEpisodicMemoryInState(state, this.memory.snapshot(), now);
  }

  /**
   * Query callback candidates from episodic memory.
   * Delegates to ChatEpisodicMemory.queryCallbacks with the provided request.
   */
  public queryCallbacks(
    state: ChatStateWithPhaseOne,
    request: ChatEpisodicCallbackRequest,
  ): readonly ChatEpisodicCallbackCandidate[] {
    this.ensureHydrated(state);
    return this.memory.queryCallbacks(request);
  }

  /**
   * Query callbacks filtered to a specific event type.
   */
  public queryCallbacksByEventType(
    state: ChatStateWithPhaseOne,
    eventType: ChatEpisodicEventType,
    channelId?: string,
    maxResults = 8,
  ): readonly ChatEpisodicCallbackCandidate[] {
    this.ensureHydrated(state);
    const phaseOne = getPhaseOneState(state);

    /* Build a pool of memories of the requested event type */
    const records = [...(phaseOne.episodicMemory?.activeMemories ?? [])].filter(
      (m): m is ChatEpisodicMemoryRecord => m.eventType === eventType && !m.archived,
    );

    if (!records.length) return [];

    /* Re-query through the live memory object for accurate scoring */
    return this.memory.queryCallbacks({
      channelId: channelId ?? null,
      preferUnresolved: true,
      maxResults,
    }).filter((c) => records.some((m) => m.memoryId === c.memoryId));
  }

  /**
   * Return the current set of unresolved callback memory IDs from state.
   */
  public getUnresolvedCallbackIds(state: ChatStateWithPhaseOne): readonly string[] {
    return getPhaseOneState(state).unresolvedCallbackIds;
  }

  /**
   * Return the latest carryover summary from state.
   */
  public getCarryoverSummary(state: ChatStateWithPhaseOne): string | undefined {
    return getPhaseOneState(state).lastCarryoverSummary;
  }

  /**
   * Build carryover items from live episodic memory (not cached in state).
   */
  public buildCarryoverItems(state: ChatStateWithPhaseOne): readonly ChatEpisodicCarryoverItem[] {
    this.ensureHydrated(state);
    return this.memory.buildCarryoverItems();
  }

  // --------------------------------------------------------------------------
  // MARK: Feature snapshot integration
  // --------------------------------------------------------------------------

  /**
   * Apply a ChatFeatureSnapshot to the conversational fingerprint.
   *
   * Feature snapshots carry authoritative server-side signals that override
   * locally derived fingerprint nudges: pressureTier, hostileMomentum01,
   * roomHeat01, churnRisk01, and affect.
   *
   * Use this when the inference pipeline produces a fresh snapshot after
   * a tick boundary or a session-level learning update.
   */
  public applyFeatureSnapshot(
    state: ChatStateWithPhaseOne,
    snapshot: ChatFeatureSnapshot,
    now: UnixMs = snapshot.generatedAt,
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);
    const delta = this.deriveFingerprintDeltaFromFeatureSnapshot(snapshot, state, now);
    return applyConversationalFingerprintDeltaInState(state, delta, now);
  }

  // --------------------------------------------------------------------------
  // MARK: Director hints + diagnostics
  // --------------------------------------------------------------------------

  /**
   * Get director hints from the novelty ledger for a given channel.
   * These inform the NPC director on what motifs, rhetorical forms,
   * and semantic clusters to prefer or exclude.
   */
  public getDirectorHints(
    state: ChatStateWithPhaseOne,
    channelId: string,
    now: UnixMs = nowMs(),
  ): ChatNoveltyLedgerDirectorHints {
    this.ensureHydrated(state);
    return this.novelty.getDirectorHints(channelId, now);
  }

  /**
   * Get the semantic fatigue score for a channel from the novelty ledger snapshot.
   */
  public getChannelFatigue(
    state: ChatStateWithPhaseOne,
    channelId: string,
    now: UnixMs = nowMs(),
  ): number {
    this.ensureHydrated(state);
    const snap = this.novelty.snapshot(now);
    const entry = snap.fatigueByChannel.find((f) => f.channelId === channelId);
    return entry?.fatigue01 ?? 0;
  }

  /**
   * Get all channel fatigue entries from the novelty snapshot.
   */
  public getAllChannelFatigue(
    state: ChatStateWithPhaseOne,
    now: UnixMs = nowMs(),
  ): readonly { channelId: string; fatigue01: number; volatility01: number }[] {
    this.ensureHydrated(state);
    const snap = this.novelty.snapshot(now);
    return snap.fatigueByChannel.map((f) => ({
      channelId: f.channelId,
      fatigue01: f.fatigue01,
      volatility01: f.volatility01,
    }));
  }

  /**
   * Full diagnostics snapshot. Does not mutate state.
   */
  public getDiagnostics(state: ChatStateWithPhaseOne): ChatPhaseOneBridgeDiagnostics {
    const phaseOne = getPhaseOneState(state);
    const memorySnap = phaseOne.episodicMemory;
    const fp = phaseOne.conversationalFingerprint;
    const now = nowMs();
    const fpAge = Number(now) - Number(fp.updatedAt ?? 0);

    return {
      version: BRIDGE_VERSION,
      playerId: this.playerId,
      roomId: this.roomId,
      hydrated: this.hydrated,
      syncCount: this.syncCount,
      messageNotedCount: this.messageNotedCount,
      sceneNotedCount: this.sceneNotedCount,
      signalNotedCount: this.signalNotedCount,
      lastSyncAt: this.lastSyncAt,
      lastMessageAt: this.lastMessageAt,
      lastSceneAt: this.lastSceneAt,
      lastSignalAt: this.lastSignalAt,
      activeMemoryCount: memorySnap?.activeMemories.length ?? 0,
      archivedMemoryCount: memorySnap?.archivedMemories.length ?? 0,
      unresolvedMemoryCount: memorySnap?.unresolvedMemoryIds.length ?? 0,
      latestCarryoverSummary: phaseOne.lastCarryoverSummary,
      fingerprintAge: fpAge,
      semanticFatigueByChannel: phaseOne.semanticFatigueByChannel,
      unresolvedCallbackIds: phaseOne.unresolvedCallbackIds,
    };
  }

  /**
   * Health snapshot — summarizes the overall health of the bridge state.
   */
  public getHealth(state: ChatStateWithPhaseOne): ChatPhaseOneBridgeHealthSnapshot {
    const phaseOne = getPhaseOneState(state);
    const memorySnap = phaseOne.episodicMemory;
    const now = nowMs();

    const activeCount = memorySnap?.activeMemories.length ?? 0;
    const memoryLoad01 = clamp01(activeCount / 512);

    const fatigueValues = Object.values(phaseOne.semanticFatigueByChannel);
    const averageFatigue01 = fatigueValues.length > 0
      ? clamp01(fatigueValues.reduce((a, b) => a + b, 0) / fatigueValues.length)
      : 0;

    const unresolvedCount = memorySnap?.unresolvedMemoryIds.length ?? 0;
    const unresolvedPressure01 = clamp01(unresolvedCount / 12);

    const lastActivity = Math.max(
      Number(this.lastMessageAt ?? 0),
      Number(this.lastSceneAt ?? 0),
      Number(this.lastSignalAt ?? 0),
      Number(this.lastSyncAt ?? 0),
    );
    const lastActivityMs = lastActivity > 0 ? Number(now) - lastActivity : 0;

    const warnings: string[] = [];
    if (!this.hydrated) warnings.push('NOT_HYDRATED');
    if (memoryLoad01 > 0.85) warnings.push('MEMORY_LOAD_HIGH');
    if (averageFatigue01 > 0.72) warnings.push('CHANNEL_FATIGUE_HIGH');
    if (unresolvedPressure01 > 0.70) warnings.push('UNRESOLVED_CALLBACKS_HIGH');
    if (lastActivityMs > 300_000) warnings.push('BRIDGE_IDLE');

    return {
      healthy: warnings.length === 0,
      hydrated: this.hydrated,
      memoryLoad01,
      averageFatigue01,
      unresolvedPressure01,
      lastActivityMs,
      warnings,
    };
  }

  // --------------------------------------------------------------------------
  // MARK: Maintenance
  // --------------------------------------------------------------------------

  /**
   * Apply time-based salience decay to all active episodic memories.
   * Should be called on a regular cadence (e.g., every session tick).
   * Returns the list of records that were decayed.
   */
  public decay(
    state: ChatStateWithPhaseOne,
    now: UnixMs = nowMs(),
  ): { readonly decayed: readonly ChatEpisodicMemoryRecord[]; readonly next: ChatStateWithPhaseOne } {
    this.ensureHydrated(state);
    const decayed = this.memory.decay(now);
    const next = setPhaseOneEpisodicMemoryInState(state, this.memory.snapshot(), now);
    return { decayed, next };
  }

  /**
   * Archive memories that have passed their expiry timestamp.
   * Call periodically to keep the active pool fresh.
   */
  public archiveExpired(
    state: ChatStateWithPhaseOne,
    now: UnixMs = nowMs(),
  ): { readonly archived: readonly ChatEpisodicMemoryRecord[]; readonly next: ChatStateWithPhaseOne } {
    this.ensureHydrated(state);
    const archived = this.memory.archiveExpired(now);
    const next = setPhaseOneEpisodicMemoryInState(state, this.memory.snapshot(), now);
    return { archived, next };
  }

  /**
   * Resolve a specific memory by ID and sync the update into state.
   */
  public resolveMemory(
    state: ChatStateWithPhaseOne,
    memoryId: string,
    reason?: string,
    summary?: string,
    now: UnixMs = nowMs(),
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);
    this.memory.resolve(memoryId, reason, summary, now);
    return setPhaseOneEpisodicMemoryInState(state, this.memory.snapshot(), now);
  }

  /**
   * Strengthen a memory — e.g. when the player references the event.
   */
  public strengthenMemory(
    state: ChatStateWithPhaseOne,
    memoryId: string,
    delta01: number,
    now: UnixMs = nowMs(),
  ): ChatStateWithPhaseOne {
    this.ensureHydrated(state);
    this.memory.strengthen(memoryId, delta01, now);
    return setPhaseOneEpisodicMemoryInState(state, this.memory.snapshot(), now);
  }

  // --------------------------------------------------------------------------
  // MARK: Serialization
  // --------------------------------------------------------------------------

  /**
   * Serialize the Phase 1 state slice for persistence.
   * Returns undefined if there is no phase1 slice in the state yet.
   */
  public serializeState(state: ChatStateWithPhaseOne): ChatPhaseOneStateSlice | undefined {
    return serializePhaseOneStateSlice(state);
  }

  /**
   * Deserialize a raw persisted blob and hydrate both the state and
   * the internal intelligence objects from it.
   */
  public deserializeIntoState(
    state: ChatStateWithPhaseOne,
    raw: unknown,
    now: UnixMs = nowMs(),
  ): ChatStateWithPhaseOne {
    const slice = hydratePhaseOneStateSlice(raw, now);
    const base = withPhaseOneState(state, slice);

    /* Immediately hydrate the intelligence objects from the deserialized slice */
    if (slice.noveltyLedger) this.novelty.restore(slice.noveltyLedger);
    if (slice.episodicMemory) this.memory.restore(slice.episodicMemory);
    this.hydrated = true;

    return base;
  }

  // --------------------------------------------------------------------------
  // MARK: Context accessors
  // --------------------------------------------------------------------------

  /**
   * Return the cached battle context from the last BATTLE signal.
   * Null if no BATTLE signal has been observed.
   */
  public getLastBattleContext(): ChatPhaseOneBattleContext | null {
    return this.lastBattleContext;
  }

  /**
   * Return the cached run context from the last RUN signal.
   * Null if no RUN signal has been observed.
   */
  public getLastRunContext(): ChatPhaseOneRunContext | null {
    return this.lastRunContext;
  }

  /**
   * Return the cached economy context from the last ECONOMY signal.
   * Null if no ECONOMY signal has been observed.
   */
  public getLastEconomyContext(): ChatPhaseOneEconomyContext | null {
    return this.lastEconomyContext;
  }

  /**
   * Return the cached LiveOps context from the last LIVEOPS signal.
   * Null if no LIVEOPS signal has been observed.
   */
  public getLastLiveOpsContext(): ChatPhaseOneLiveOpsContext | null {
    return this.lastLiveOpsContext;
  }

  /**
   * Return the current conversational fingerprint from state.
   */
  public getFingerprint(state: ChatStateWithPhaseOne): ChatConversationalFingerprint {
    return getPhaseOneState(state).conversationalFingerprint;
  }

  /**
   * Return the current Phase 1 state slice.
   */
  public getPhaseOneSlice(state: ChatStateWithPhaseOne): ChatPhaseOneStateSlice {
    return getPhaseOneState(state);
  }

  /**
   * Return the live novelty ledger snapshot at the given timestamp.
   */
  public getNoveltySnapshot(state: ChatStateWithPhaseOne, now: UnixMs = nowMs()): ChatNoveltyLedgerSnapshot {
    this.ensureHydrated(state);
    return this.novelty.snapshot(now);
  }

  /**
   * Return the live episodic memory snapshot.
   */
  public getMemorySnapshot(state: ChatStateWithPhaseOne): ChatEpisodicMemorySnapshot {
    this.ensureHydrated(state);
    return this.memory.snapshot();
  }

  // --------------------------------------------------------------------------
  // MARK: Private — Signal dispatch
  // --------------------------------------------------------------------------

  /**
   * Master signal descriptor.
   * Dispatches on signal.type — not signal.signalType (which does not exist
   * on the backend ChatSignalEnvelope contract).
   */
  private describeSignal(signal: ChatSignalEnvelope): ChatPhaseOneBridgeSignalSummary | null {
    switch (signal.type) {
      case 'BATTLE':      return this.describeBattleSignal(signal);
      case 'RUN':         return this.describeRunSignal(signal);
      case 'MULTIPLAYER': return this.describeMultiplayerSignal(signal);
      case 'ECONOMY':     return this.describeEconomySignal(signal);
      case 'LIVEOPS':     return this.describeLiveOpsSignal(signal);
      default:            return null;
    }
  }

  /**
   * Describe a BATTLE signal — maps inner ChatBattleSnapshot fields to
   * an episodic event type + fingerprint nudges.
   */
  private describeBattleSignal(signal: ChatSignalEnvelope): ChatPhaseOneBridgeSignalSummary | null {
    const battle: ChatBattleSnapshot | undefined = signal.battle;
    if (!battle) return null;

    const pressure = normalizeUpperCase(battle.pressureTier);
    const pressureBand = mapPressureTierToBand(pressure);
    const attackType = battle.activeAttackType ? normalizeUpperCase(battle.activeAttackType) : null;
    const botId = battle.activeBotId ? String(battle.activeBotId) : null;
    const hostileMomentum = Number(battle.hostileMomentum ?? 0);

    /* Determine event type from battle state */
    let eventType: ChatEpisodicEventType;
    let summary: string;

    if (battle.shieldIntegrity01 != null && Number(battle.shieldIntegrity01) < 0.15) {
      eventType = 'BREACH';
      summary = `Shield integrity critical at ${Math.round(Number(battle.shieldIntegrity01) * 100)}%.`;
    } else if (attackType === 'CROWD_SWARM' || attackType === 'SHADOW_LEAK') {
      eventType = 'COLLAPSE';
      summary = `${attackType.replace(/_/g, ' ')} initiated by ${botId ?? 'unknown'}.`;
    } else if (attackType === 'LIQUIDATION') {
      eventType = 'FAILED_GAMBLE';
      summary = `Liquidation attack active. Hostile momentum: ${(hostileMomentum * 100).toFixed(0)}%.`;
    } else if (battle.rescueWindowOpen) {
      eventType = 'RESCUE';
      summary = 'Rescue window opened. Helper intervention viable.';
    } else if (pressure === 'CRITICAL') {
      eventType = 'OVERCONFIDENCE';
      summary = `Battle pressure critical — tick ${battle.tickNumber ?? 'unknown'}.`;
    } else if (pressure === 'HIGH') {
      eventType = 'HESITATION';
      summary = `High battle pressure from ${botId ?? 'NPC'}.`;
    } else {
      eventType = 'PUBLIC_WITNESS';
      summary = `Battle active — pressure ${pressure}, attack ${attackType ?? 'none'}.`;
    }

    /* Fingerprint nudges from battle state */
    const fingerprintNudges: FingerprintDelta = {};
    const momentum = clamp01(hostileMomentum);

    fingerprintNudges.defensive01 = nudge(0.50, 0.82, momentum * FINGERPRINT_SIGNAL_MOMENTUM * 2);
    fingerprintNudges.collapseProne01 = nudge(0.10, clamp01(momentum * 0.90), FINGERPRINT_SIGNAL_MOMENTUM);

    if (battle.rescueWindowOpen) {
      fingerprintNudges.comebackProne01 = nudge(0.45, 0.72, FINGERPRINT_SIGNAL_MOMENTUM * 1.5);
      fingerprintNudges.patient01 = nudge(0.60, 0.72, FINGERPRINT_SIGNAL_MOMENTUM);
    }
    if (attackType === 'TAUNT') {
      fingerprintNudges.publicPerformer01 = nudge(0.40, 0.68, FINGERPRINT_SIGNAL_MOMENTUM);
    }
    if (pressure === 'NONE' || pressure === 'BUILDING') {
      fingerprintNudges.stabilitySeeking01 = nudge(0.50, 0.62, FINGERPRINT_SIGNAL_MOMENTUM);
    }

    return {
      signalType: 'BATTLE',
      eventType,
      summary,
      channelId: 'GLOBAL',
      botId,
      pressureBand,
      fingerprintNudges,
      tags: ['signal', 'battle', `pressure:${pressureBand.toLowerCase()}`, ...(attackType ? [`attack:${attackType.toLowerCase()}`] : [])],
    };
  }

  /**
   * Describe a RUN signal — maps ChatRunSnapshot to episodic event.
   */
  private describeRunSignal(signal: ChatSignalEnvelope): ChatPhaseOneBridgeSignalSummary | null {
    const run: ChatRunSnapshot | undefined = signal.run;
    if (!run) return null;

    const phase = normalizeUpperCase(run.runPhase);
    const outcome = normalizeUpperCase(run.outcome);
    const tickTier = normalizeUpperCase(run.tickTier);

    let eventType: ChatEpisodicEventType;
    let summary: string;

    if (outcome === 'SOVEREIGN') {
      eventType = 'SOVEREIGNTY';
      summary = `Sovereignty achieved in run ${run.runId ?? 'unknown'}.`;
    } else if (outcome === 'BANKRUPT') {
      eventType = 'COLLAPSE';
      summary = `Bankruptcy outcome reached in run ${run.runId ?? 'unknown'}.`;
    } else if (outcome === 'FAILED') {
      eventType = 'FAILED_GAMBLE';
      summary = `Run failed — phase ${phase}, tier ${tickTier}.`;
    } else if (outcome === 'SURVIVED') {
      eventType = 'COMEBACK';
      summary = `Run survived — ${run.elapsedMs != null ? `${Math.round(Number(run.elapsedMs) / 1000)}s elapsed` : 'unknown duration'}.`;
    } else if (run.bankruptcyWarning) {
      eventType = 'HESITATION';
      summary = `Bankruptcy warning active — run phase ${phase}.`;
    } else if (run.nearSovereignty) {
      eventType = 'DISCIPLINE';
      summary = `Near sovereignty — run ${run.runId ?? 'unknown'}, phase ${phase}.`;
    } else {
      eventType = 'PUBLIC_WITNESS';
      summary = `Run update — phase ${phase}, tier ${tickTier}, outcome ${outcome || 'UNRESOLVED'}.`;
    }

    const pressureBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
      outcome === 'BANKRUPT' || run.bankruptcyWarning ? 'CRITICAL' :
      outcome === 'FAILED' ? 'HIGH' :
      run.nearSovereignty ? 'LOW' : 'MEDIUM';

    const fingerprintNudges: FingerprintDelta = {};

    if (outcome === 'SOVEREIGN') {
      fingerprintNudges.stabilitySeeking01 = nudge(0.50, 0.72, FINGERPRINT_SIGNAL_MOMENTUM * 2);
      fingerprintNudges.procedureAware01 = nudge(0.50, 0.78, FINGERPRINT_SIGNAL_MOMENTUM * 2);
    } else if (outcome === 'BANKRUPT' || run.bankruptcyWarning) {
      fingerprintNudges.collapseProne01 = nudge(0.10, 0.55, FINGERPRINT_SIGNAL_MOMENTUM * 2);
      fingerprintNudges.impulsive01 = nudge(0.20, 0.42, FINGERPRINT_SIGNAL_MOMENTUM);
    } else if (run.nearSovereignty) {
      fingerprintNudges.patient01 = nudge(0.60, 0.78, FINGERPRINT_SIGNAL_MOMENTUM * 1.5);
      // discipline dimension boost handled implicitly by patient01 nudge above
    } else if (outcome === 'SURVIVED') {
      fingerprintNudges.comebackProne01 = nudge(0.45, 0.66, FINGERPRINT_SIGNAL_MOMENTUM);
    }

    return {
      signalType: 'RUN',
      eventType,
      summary,
      channelId: 'GLOBAL',
      pressureBand,
      fingerprintNudges,
      tags: ['signal', 'run', `phase:${phase.toLowerCase()}`, `outcome:${(outcome || 'unresolved').toLowerCase()}`],
    };
  }

  /**
   * Describe an ECONOMY signal — maps ChatEconomySnapshot to episodic event.
   */
  private describeEconomySignal(signal: ChatSignalEnvelope): ChatPhaseOneBridgeSignalSummary | null {
    const economy: ChatEconomySnapshot | undefined = signal.economy;
    if (!economy) return null;

    const bluffRisk = Number(economy.bluffRisk01 ?? 0);
    const liquidityStress = Number(economy.liquidityStress01 ?? 0);
    const overpayRisk = Number(economy.overpayRisk01 ?? 0);
    const dealCount = Number(economy.activeDealCount ?? 0);

    let eventType: ChatEpisodicEventType;
    let summary: string;

    if (bluffRisk >= 0.80) {
      eventType = 'BLUFF';
      summary = `High bluff risk in deal room — ${(bluffRisk * 100).toFixed(0)}% bluff signal.`;
    } else if (liquidityStress >= 0.80) {
      eventType = 'DEAL_ROOM_STANDOFF';
      summary = `Liquidity stress at ${(liquidityStress * 100).toFixed(0)}% — deal room locked.`;
    } else if (overpayRisk >= 0.75) {
      eventType = 'GREED';
      summary = `Overpay risk elevated — ${(overpayRisk * 100).toFixed(0)}% exposure.`;
    } else if (dealCount >= 3) {
      eventType = 'DEAL_ROOM_STANDOFF';
      summary = `${dealCount} active deals — economy under multi-deal pressure.`;
    } else {
      eventType = 'DISCIPLINE';
      summary = `Economy stable — ${dealCount} active deal${dealCount !== 1 ? 's' : ''}.`;
    }

    const pressureBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
      bluffRisk >= 0.80 || liquidityStress >= 0.80 ? 'HIGH' :
      overpayRisk >= 0.75 || dealCount >= 3 ? 'MEDIUM' : 'LOW';

    const fingerprintNudges: FingerprintDelta = {};

    if (bluffRisk >= 0.72) {
      fingerprintNudges.bluffHeavy01 = nudge(0.20, 0.70, FINGERPRINT_SIGNAL_MOMENTUM * (bluffRisk));
      fingerprintNudges.greedy01 = nudge(0.20, 0.55, FINGERPRINT_SIGNAL_MOMENTUM);
    }
    if (liquidityStress >= 0.60) {
      fingerprintNudges.defensive01 = nudge(0.55, 0.72, FINGERPRINT_SIGNAL_MOMENTUM);
      fingerprintNudges.patient01 = nudge(0.60, 0.44, FINGERPRINT_SIGNAL_MOMENTUM);
    }
    if (overpayRisk >= 0.65) {
      fingerprintNudges.greedy01 = nudge(
        fingerprintNudges.greedy01 ?? 0.20,
        0.68,
        FINGERPRINT_SIGNAL_MOMENTUM,
      );
    }

    return {
      signalType: 'ECONOMY',
      eventType,
      summary,
      channelId: DEAL_ROOM_CHANNEL,
      pressureBand,
      fingerprintNudges,
      tags: ['signal', 'economy', `bluff:${bluffRisk.toFixed(2)}`, `liquidity:${liquidityStress.toFixed(2)}`],
    };
  }

  /**
   * Describe a MULTIPLAYER signal — maps ChatMultiplayerSnapshot to episodic event.
   */
  private describeMultiplayerSignal(signal: ChatSignalEnvelope): ChatPhaseOneBridgeSignalSummary | null {
    const mp: ChatMultiplayerSnapshot | undefined = signal.multiplayer;
    if (!mp) return null;

    const memberCount = Number(mp.roomMemberCount ?? 0);
    const spectators = Number(mp.spectatingCount ?? 0);
    const rankingPressure = Number(mp.rankingPressure ?? 0);
    const factionName = mp.factionName ? String(mp.factionName) : null;

    let eventType: ChatEpisodicEventType;
    let summary: string;

    if (spectators > memberCount * 0.5 && spectators > 4) {
      eventType = 'PUBLIC_WITNESS';
      summary = `${spectators} spectators watching — public witness pressure elevated.`;
    } else if (rankingPressure >= 75) {
      eventType = 'OVERCONFIDENCE';
      summary = `High ranking pressure (${rankingPressure}/100) in multiplayer session.`;
    } else if (factionName) {
      eventType = 'DEAL_ROOM_STANDOFF';
      summary = `Faction '${factionName}' active — multiplayer standoff context.`;
    } else {
      eventType = 'PUBLIC_WITNESS';
      summary = `Multiplayer room with ${memberCount} members, ${spectators} spectating.`;
    }

    const pressureBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
      rankingPressure >= 85 ? 'HIGH' :
      rankingPressure >= 55 ? 'MEDIUM' : 'LOW';

    const fingerprintNudges: FingerprintDelta = {};

    if (spectators > 4) {
      fingerprintNudges.publicPerformer01 = nudge(0.40, 0.70, FINGERPRINT_SIGNAL_MOMENTUM * 1.5);
      fingerprintNudges.silentOperator01 = nudge(0.50, 0.30, FINGERPRINT_SIGNAL_MOMENTUM);
    }
    if (factionName) {
      fingerprintNudges.silentOperator01 = nudge(0.50, 0.65, FINGERPRINT_SIGNAL_MOMENTUM);
      fingerprintNudges.procedureAware01 = nudge(0.50, 0.62, FINGERPRINT_SIGNAL_MOMENTUM);
    }

    return {
      signalType: 'MULTIPLAYER',
      eventType,
      summary,
      channelId: 'GLOBAL',
      pressureBand,
      fingerprintNudges,
      tags: ['signal', 'multiplayer', `members:${memberCount}`, ...(factionName ? [`faction:${factionName.toLowerCase()}`] : [])],
    };
  }

  /**
   * Describe a LIVEOPS signal — maps ChatLiveOpsSnapshot to episodic event.
   */
  private describeLiveOpsSignal(signal: ChatSignalEnvelope): ChatPhaseOneBridgeSignalSummary | null {
    const liveops: ChatLiveOpsSnapshot | undefined = signal.liveops;
    if (!liveops) return null;

    const heatMultiplier = Number(liveops.heatMultiplier01 ?? 1.0);
    const worldEvent = liveops.worldEventName ? String(liveops.worldEventName) : null;
    const helperBlackout = liveops.helperBlackout === true;
    const haterRaid = liveops.haterRaidActive === true;

    let eventType: ChatEpisodicEventType;
    let summary: string;

    if (haterRaid && helperBlackout) {
      eventType = 'COLLAPSE';
      summary = `Hater raid active with helper blackout — maximum hostile environment.`;
    } else if (haterRaid) {
      eventType = 'HUMILIATION';
      summary = `Hater raid active — ${worldEvent ?? 'world event'} escalating pressure.`;
    } else if (helperBlackout) {
      eventType = 'HESITATION';
      summary = `Helper blackout active — player operating without rescue safety net.`;
    } else if (heatMultiplier >= 1.8) {
      eventType = 'PUBLIC_WITNESS';
      summary = `LiveOps heat multiplier at ${heatMultiplier.toFixed(1)}x — room attention amplified.`;
    } else if (worldEvent) {
      eventType = 'DEAL_ROOM_STANDOFF';
      summary = `LiveOps event '${worldEvent}' active — deal room dynamics shifted.`;
    } else {
      return null;
    }

    const pressureBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
      haterRaid && helperBlackout ? 'CRITICAL' :
      haterRaid || helperBlackout ? 'HIGH' :
      heatMultiplier >= 1.8 ? 'MEDIUM' : 'LOW';

    const fingerprintNudges: FingerprintDelta = {};

    if (haterRaid) {
      fingerprintNudges.defensive01 = nudge(0.55, 0.82, FINGERPRINT_SIGNAL_MOMENTUM * 2);
      fingerprintNudges.collapseProne01 = nudge(0.10, 0.40, FINGERPRINT_SIGNAL_MOMENTUM);
    }
    if (helperBlackout) {
      fingerprintNudges.patient01 = nudge(0.60, 0.42, FINGERPRINT_SIGNAL_MOMENTUM);
      fingerprintNudges.impulsive01 = nudge(0.20, 0.38, FINGERPRINT_SIGNAL_MOMENTUM);
    }
    if (heatMultiplier >= 1.5) {
      fingerprintNudges.publicPerformer01 = nudge(0.40, 0.60, FINGERPRINT_SIGNAL_MOMENTUM);
    }

    return {
      signalType: 'LIVEOPS',
      eventType,
      summary,
      channelId: 'GLOBAL',
      pressureBand,
      fingerprintNudges,
      tags: [
        'signal', 'liveops',
        ...(worldEvent ? [`event:${worldEvent.toLowerCase().replace(/\s+/g, '-')}`] : []),
        ...(haterRaid ? ['hater-raid'] : []),
        ...(helperBlackout ? ['helper-blackout'] : []),
      ],
    };
  }

  // --------------------------------------------------------------------------
  // MARK: Private — Context frame updater
  // --------------------------------------------------------------------------

  private updateContextFromSignal(signal: ChatSignalEnvelope): void {
    if (signal.type === 'BATTLE' && signal.battle) {
      const b = signal.battle;
      this.lastBattleContext = {
        pressureTier: normalizeUpperCase(b.pressureTier),
        activeAttackType: b.activeAttackType ? normalizeUpperCase(b.activeAttackType) : null,
        activeBotId: b.activeBotId ? String(b.activeBotId) : null,
        hostileMomentum01: clamp01(Number(b.hostileMomentum ?? 0)),
        rescueWindowOpen: b.rescueWindowOpen === true,
        shieldIntegrity01: clamp01(Number(b.shieldIntegrity01 ?? 1)),
      };
    }
    if (signal.type === 'RUN' && signal.run) {
      const r = signal.run;
      this.lastRunContext = {
        runPhase: normalizeUpperCase(r.runPhase),
        tickTier: normalizeUpperCase(r.tickTier),
        outcome: normalizeUpperCase(r.outcome),
        bankruptcyWarning: r.bankruptcyWarning === true,
        nearSovereignty: r.nearSovereignty === true,
      };
    }
    if (signal.type === 'ECONOMY' && signal.economy) {
      const e = signal.economy;
      this.lastEconomyContext = {
        activeDealCount: Number(e.activeDealCount ?? 0),
        liquidityStress01: clamp01(Number(e.liquidityStress01 ?? 0)),
        bluffRisk01: clamp01(Number(e.bluffRisk01 ?? 0)),
        overpayRisk01: clamp01(Number(e.overpayRisk01 ?? 0)),
      };
    }
    if (signal.type === 'LIVEOPS' && signal.liveops) {
      const l = signal.liveops;
      this.lastLiveOpsContext = {
        worldEventName: l.worldEventName ? String(l.worldEventName) : null,
        heatMultiplier01: clamp01(Number(l.heatMultiplier01 ?? 1)),
        helperBlackout: l.helperBlackout === true,
        haterRaidActive: l.haterRaidActive === true,
      };
    }
  }

  // --------------------------------------------------------------------------
  // MARK: Private — Fingerprint derivation helpers
  // --------------------------------------------------------------------------

  /**
   * Derive a conversational fingerprint delta from a committed message.
   * Uses readMsg* accessor helpers — no direct field access beyond canonical fields.
   */
  private deriveFingerprintDeltaFromMessage(
    message: ChatMessage,
    now: UnixMs,
  ): Partial<Omit<ChatConversationalFingerprint, 'updatedAt'>> {
    const text = readMsgText(message).toLowerCase();
    const channelId = readMsgChannelId(message) ?? '';
    const kind = readMsgKind(message);
    const tags = new Set((message.tags ?? []).map((t) => String(t).toLowerCase()));
    const shieldBreached = readMsgShieldBreached(message);
    const cascadeDir = readMsgCascadeDirection(message);
    const bluffRisk = readMsgBluffRisk(message) ?? 0;
    const m = FINGERPRINT_MESSAGE_MOMENTUM;

    const delta: FingerprintDelta = {};

    /* Text length → impulsive vs. patient */
    if (text.length < 24) {
      delta.impulsive01 = nudge(0.20, 0.58, m * 1.5);
      delta.patient01 = nudge(0.60, 0.36, m);
    } else if (text.length > 80) {
      delta.patient01 = nudge(0.60, 0.72, m);
      delta.impulsive01 = nudge(0.20, 0.14, m);
    }

    /* Channel → public performer vs. silent operator */
    if (PUBLIC_CHANNELS.has(channelId)) {
      delta.publicPerformer01 = nudge(0.40, 0.66, m * 1.2);
      delta.silentOperator01 = nudge(0.50, 0.34, m);
    } else if (PRIVATE_CHANNELS.has(channelId)) {
      delta.silentOperator01 = nudge(0.50, 0.68, m * 1.2);
      delta.publicPerformer01 = nudge(0.40, 0.28, m);
    } else if (channelId === DEAL_ROOM_CHANNEL) {
      delta.greedy01 = nudge(0.20, 0.56, m);
      delta.procedureAware01 = nudge(0.50, 0.64, m);
    }

    /* NPC kind signals */
    if (kind.includes('RESCUE') || kind.includes('HELPER')) {
      delta.comebackProne01 = nudge(0.45, 0.68, m * 1.5);
    }
    if (kind.includes('BREACH')) {
      delta.defensive01 = nudge(0.55, 0.76, m * 1.5);
      delta.collapseProne01 = nudge(0.10, 0.32, m);
    }
    if (kind.includes('TAUNT') || kind.includes('HATER')) {
      delta.publicPerformer01 = nudge(delta.publicPerformer01 ?? 0.40, 0.58, m);
    }
    if (kind.includes('LEGEND')) {
      delta.publicPerformer01 = nudge(delta.publicPerformer01 ?? 0.40, 0.74, m * 2);
    }

    /* Tag signals */
    if (tags.has('shield') || tags.has('defense')) {
      delta.defensive01 = nudge(delta.defensive01 ?? 0.55, 0.72, m);
    }
    if (tags.has('bluff') || tags.has('deal-room')) {
      delta.bluffHeavy01 = nudge(0.20, 0.62, m * clamp01(bluffRisk + 0.3));
    }
    if (tags.has('offer') || tags.has('greed')) {
      delta.greedy01 = nudge(delta.greedy01 ?? 0.20, 0.62, m);
    }
    if (tags.has('proof') || tags.has('evidence')) {
      delta.literal01 = nudge(0.60, 0.78, m);
    }
    if (tags.has('terms') || tags.has('review') || tags.has('sequence')) {
      delta.procedureAware01 = nudge(0.50, 0.72, m);
    }
    if (tags.has('comeback') || tags.has('reversal')) {
      delta.comebackProne01 = nudge(delta.comebackProne01 ?? 0.45, 0.70, m * 1.5);
    }

    /* Text content signals */
    if (text.includes('bluff') || text.includes('posture')) {
      delta.bluffHeavy01 = nudge(delta.bluffHeavy01 ?? 0.20, 0.60, m);
    }
    if (text.includes('proof') || text.includes('show')) {
      delta.literal01 = nudge(delta.literal01 ?? 0.60, 0.74, m);
    }
    if (text.includes('hold') || text.includes('wait') || text.includes('patient')) {
      delta.patient01 = nudge(delta.patient01 ?? 0.60, 0.70, m);
      delta.stabilitySeeking01 = nudge(0.50, 0.62, m);
    }
    if (text.includes('now') || text.includes('hurry') || text.includes('quick')) {
      delta.impulsive01 = nudge(delta.impulsive01 ?? 0.20, 0.48, m);
      delta.stabilitySeeking01 = nudge(0.50, 0.36, m);
    }
    if (text.includes('everyone saw') || text.includes('the room') || text.includes('they know')) {
      delta.publicPerformer01 = nudge(delta.publicPerformer01 ?? 0.40, 0.64, m);
    }

    /* Meta signals */
    if (shieldBreached) {
      delta.defensive01 = nudge(delta.defensive01 ?? 0.55, 0.82, m * 2);
      delta.collapseProne01 = nudge(delta.collapseProne01 ?? 0.10, 0.36, m);
    }
    if (cascadeDir === 'POSITIVE') {
      delta.comebackProne01 = nudge(delta.comebackProne01 ?? 0.45, 0.76, m * 2);
      delta.collapseProne01 = nudge(delta.collapseProne01 ?? 0.10, 0.08, m);
    } else if (cascadeDir === 'NEGATIVE') {
      delta.collapseProne01 = nudge(delta.collapseProne01 ?? 0.10, 0.44, m * 2);
    }

    /* High bluff risk → bluffHeavy + greedy */
    if (bluffRisk >= 0.70) {
      delta.bluffHeavy01 = nudge(delta.bluffHeavy01 ?? 0.20, 0.74, m * bluffRisk);
    }

    /* Apply last battle context if available */
    if (this.lastBattleContext) {
      const bc = this.lastBattleContext;
      if (bc.hostileMomentum01 >= 0.70) {
        delta.defensive01 = nudge(delta.defensive01 ?? 0.55, 0.80, m * 0.5);
      }
      if (bc.shieldIntegrity01 < 0.30) {
        delta.collapseProne01 = nudge(delta.collapseProne01 ?? 0.10, 0.42, m);
      }
    }

    /* Apply last economy context if available */
    if (this.lastEconomyContext) {
      const ec = this.lastEconomyContext;
      if (ec.bluffRisk01 >= 0.72 && channelId === DEAL_ROOM_CHANNEL) {
        delta.bluffHeavy01 = nudge(delta.bluffHeavy01 ?? 0.20, 0.70, m * 0.6);
      }
    }

    return delta;
  }

  /**
   * Derive a fingerprint delta from a scene plan.
   * Uses readScene* accessor helpers.
   */
  private deriveFingerprintDeltaFromScene(
    scene: ChatScenePlan,
    _now: UnixMs,
  ): Partial<Omit<ChatConversationalFingerprint, 'updatedAt'>> {
    const m = FINGERPRINT_SCENE_MOMENTUM;
    const primaryChannel = readScenePrimaryChannel(scene);
    const momentType = readSceneMomentType(scene);
    const delta: FingerprintDelta = {};

    /* Channel-based nudges */
    if (PUBLIC_CHANNELS.has(primaryChannel)) {
      delta.publicPerformer01 = nudge(0.40, 0.62, m);
    } else if (primaryChannel === DEAL_ROOM_CHANNEL) {
      delta.procedureAware01 = nudge(0.50, 0.64, m);
      delta.greedy01 = nudge(0.20, 0.44, m * 0.5);
    } else if (PRIVATE_CHANNELS.has(primaryChannel)) {
      delta.silentOperator01 = nudge(0.50, 0.64, m);
    }

    /* Moment type nudges */
    switch (momentType) {
      case 'SHIELD_BREACH':
        delta.defensive01 = nudge(0.55, 0.78, m * 2);
        break;
      case 'HELPER_RESCUE':
        delta.comebackProne01 = nudge(0.45, 0.68, m * 1.5);
        break;
      case 'DEAL_ROOM_STANDOFF':
        delta.bluffHeavy01 = nudge(0.20, 0.56, m);
        delta.procedureAware01 = nudge(0.50, 0.68, m);
        break;
      case 'SOVEREIGN_ACHIEVED':
      case 'SOVEREIGN_APPROACH':
        delta.stabilitySeeking01 = nudge(0.50, 0.72, m * 2);
        delta.patient01 = nudge(0.60, 0.76, m * 1.5);
        break;
      case 'CASCADE_TRIGGER':
        delta.collapseProne01 = nudge(0.10, 0.40, m * 2);
        break;
      case 'CASCADE_BREAK':
        delta.comebackProne01 = nudge(0.45, 0.72, m * 2);
        break;
      case 'LEGEND_MOMENT':
        delta.publicPerformer01 = nudge(0.40, 0.78, m * 2.5);
        break;
    }

    /* Legend candidate boost */
    if (scene.legendCandidate) {
      delta.noveltySeeking01 = nudge(0.50, 0.68, m);
    }

    return delta;
  }

  /**
   * Derive fingerprint delta from a ChatFeatureSnapshot.
   * Feature snapshots carry server-side authoritative signals.
   */
  private deriveFingerprintDeltaFromFeatureSnapshot(
    snapshot: ChatFeatureSnapshot,
    state: ChatStateWithPhaseOne,
    _now: UnixMs,
  ): Partial<Omit<ChatConversationalFingerprint, 'updatedAt'>> {
    const m = FINGERPRINT_FEATURE_MOMENTUM;
    const fp = getPhaseOneState(state).conversationalFingerprint;
    const delta: FingerprintDelta = {};

    const hostileMomentum = clamp01(Number(snapshot.hostileMomentum01 ?? 0));
    const roomHeat = clamp01(Number(snapshot.roomHeat01 ?? 0));
    const churnRisk = clamp01(Number(snapshot.churnRisk01 ?? 0));
    const pressureTier = normalizeUpperCase(snapshot.pressureTier);

    /* Pressure → defensive posture */
    const pressureBand = mapPressureTierToBand(pressureTier);
    if (pressureBand === 'CRITICAL' || pressureBand === 'HIGH') {
      delta.defensive01 = nudge(fp.defensive01, 0.78, m * 2);
      delta.collapseProne01 = nudge(fp.collapseProne01, clamp01(hostileMomentum * 0.80), m);
    }

    /* Hostile momentum → combat dimensions */
    if (hostileMomentum >= 0.65) {
      delta.comebackProne01 = nudge(fp.comebackProne01, 0.64, m * 1.5);
    }
    if (hostileMomentum < 0.25) {
      delta.stabilitySeeking01 = nudge(fp.stabilitySeeking01, 0.62, m);
    }

    /* Room heat → public performer */
    if (roomHeat >= 0.70) {
      delta.publicPerformer01 = nudge(fp.publicPerformer01, 0.66, m * (roomHeat));
    }

    /* Churn risk → impulsive / instability */
    if (churnRisk >= 0.60) {
      delta.impulsive01 = nudge(fp.impulsive01, 0.50, m * churnRisk);
      delta.stabilitySeeking01 = nudge(fp.stabilitySeeking01, 0.32, m);
    }

    /* Affect integration */
    if (snapshot.affect) {
      const affect = snapshot.affect;
      const confidence = clamp01(Number((affect as { confidence01?: number }).confidence01 ?? 0.5));
      const frustration = clamp01(Number((affect as { frustration01?: number }).frustration01 ?? 0));
      const curiosity = clamp01(Number((affect as { curiosity01?: number }).curiosity01 ?? 0.5));

      if (confidence >= 0.75) {
        delta.bluffHeavy01 = nudge(fp.bluffHeavy01, 0.52, m * confidence);
      } else if (confidence < 0.35) {
        delta.defensive01 = nudge(fp.defensive01, 0.70, m * (1 - confidence));
      }
      if (frustration >= 0.60) {
        delta.impulsive01 = nudge(fp.impulsive01, 0.52, m * frustration);
        delta.patient01 = nudge(fp.patient01, 0.36, m);
      }
      if (curiosity >= 0.70) {
        delta.noveltySeeking01 = nudge(fp.noveltySeeking01, 0.68, m * curiosity);
      }
    }

    return delta;
  }

  // --------------------------------------------------------------------------
  // MARK: Private — Composite scoring
  // --------------------------------------------------------------------------

  /**
   * Build a composite score from novelty, callback, and base weight.
   * Weights: novelty 55%, callback 25%, base priority 20%.
   */
  private buildCompositeScore(
    noveltyScore: ChatNoveltyLedgerScore,
    callback: ChatEpisodicCallbackCandidate | undefined,
    candidate: ChatPhaseOneResponseCandidate | undefined,
    fingerprint: ChatConversationalFingerprint,
  ): number {
    let score = noveltyScore.noveltyScore01 * NOVELTY_COMPOSITE_WEIGHT;

    /* Callback contribution */
    score += (callback?.score01 ?? 0) * CALLBACK_COMPOSITE_WEIGHT;

    /* Base weight from caller */
    score += clamp01(candidate?.baseWeight01 ?? 0) * PRIORITY_COMPOSITE_WEIGHT;

    /* Fingerprint-driven bonus/malus for NPC role alignment */
    if (candidate?.npcRole === 'HATER') {
      /* Player with high defensive posture naturally resists hater attacks */
      const resistanceMalus = fingerprint.defensive01 * 0.04;
      score -= resistanceMalus;
    } else if (candidate?.npcRole === 'HELPER') {
      /* Player comeback-prone = more receptive to helper lines */
      score += fingerprint.comebackProne01 * 0.03;
    }

    /* Novelty diversity bonus — prefer diverse scene roles */
    if (noveltyScore.diversityBoost > 0.08) {
      score += 0.02;
    }

    /* Penalize if channel is fatigued */
    if (noveltyScore.fatigueRisk > 0.55) {
      score -= noveltyScore.fatigueRisk * 0.05;
    }

    return clamp01(score);
  }

  /**
   * Resolve the best callback candidate for a response candidate.
   * Checks pre-resolved candidates first, then queries live episodic memory.
   */
  private resolveCallbackForCandidate(
    candidate: ChatPhaseOneResponseCandidate | undefined,
    channelId: string,
    sceneRole: string | null,
    now: UnixMs,
  ): ChatEpisodicCallbackCandidate | undefined {
    if (!candidate) return undefined;

    /* Use pre-resolved callbacks if the caller provided them */
    const preResolved = candidate.callbackCandidates;
    if (preResolved && preResolved.length > 0) {
      /* Sort by score01 and return the top one */
      return [...preResolved].sort((a, b) => b.score01 - a.score01)[0];
    }

    /* Query live episodic memory */
    const results = this.memory.queryCallbacks({
      botId: candidate.botId ?? null,
      counterpartId: candidate.counterpartId ?? null,
      roomId: candidate.roomId ?? null,
      channelId,
      sceneRole,
      preferUnresolved: true,
      requireChannelEligibility: channelId !== 'GLOBAL',
      requireSceneRoleEligibility: sceneRole != null,
      maxResults: this.maxCallbacksPerRank,
    });

    /* Find callbacks matching this candidate's persona */
    if (candidate.personaId) {
      const personaMatch = results.find((c) => c.memoryId.includes(candidate.personaId ?? ''));
      if (personaMatch) return personaMatch;
    }

    /* Return the highest-scored callback */
    return results[0];
  }

  // --------------------------------------------------------------------------
  // MARK: Private — Channel validation
  // --------------------------------------------------------------------------

  private isVisibleChannel(channelId: string): boolean {
    return ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'].includes(channelId);
  }
}

// ============================================================================
// MARK: Module-level singleton management
// ============================================================================

let _defaultBridge: ChatEnginePhaseOneBridge | undefined;

/**
 * Get the process-level default bridge instance.
 * Creates one with default options if it does not exist yet.
 * For multi-player server use, prefer per-session bridge instances.
 */
export function getDefaultChatEnginePhaseOneBridge(): ChatEnginePhaseOneBridge {
  if (!_defaultBridge) {
    _defaultBridge = new ChatEnginePhaseOneBridge();
  }
  return _defaultBridge;
}

/**
 * Replace the default bridge with a pre-configured instance.
 * Useful for testing and for server boot injection.
 */
export function setDefaultChatEnginePhaseOneBridge(bridge: ChatEnginePhaseOneBridge): void {
  _defaultBridge = bridge;
}

/**
 * Reset the default bridge to undefined.
 * The next call to getDefaultChatEnginePhaseOneBridge will create a fresh instance.
 */
export function resetDefaultChatEnginePhaseOneBridge(): void {
  _defaultBridge = undefined;
}

/**
 * Factory function — creates a new bridge with the given options.
 * Prefer this over direct construction to allow future DI hooks.
 */
export function createChatEnginePhaseOneBridge(
  options: ChatPhaseOneBridgeOptions = {},
): ChatEnginePhaseOneBridge {
  return new ChatEnginePhaseOneBridge(options);
}

// ============================================================================
// MARK: Convenience helpers
// ============================================================================

/**
 * One-shot message observation.
 * Creates a fresh bridge, hydrates from state, notes the message, and returns
 * the updated state. Useful in functional contexts where bridge lifecycle is
 * managed externally.
 */
export function applyMessageToPhaseOne(
  state: ChatStateWithPhaseOne,
  message: ChatMessage,
  now?: UnixMs,
  options?: ChatPhaseOneBridgeOptions,
): ChatStateWithPhaseOne {
  const bridge = new ChatEnginePhaseOneBridge(options ?? {});
  bridge.ensureHydrated(state);
  return bridge.noteCommittedMessage(state, message, now ?? (message.createdAt as UnixMs));
}

/**
 * One-shot scene observation.
 */
export function applySceneToPhaseOne(
  state: ChatStateWithPhaseOne,
  scene: ChatScenePlan,
  summary: string,
  now?: UnixMs,
  options?: ChatPhaseOneBridgeOptions,
): ChatStateWithPhaseOne {
  const bridge = new ChatEnginePhaseOneBridge(options ?? {});
  bridge.ensureHydrated(state);
  return bridge.noteScene(state, scene, summary, now);
}

/**
 * One-shot signal observation.
 */
export function applySignalToPhaseOne(
  state: ChatStateWithPhaseOne,
  signal: ChatSignalEnvelope,
  now?: UnixMs,
  options?: ChatPhaseOneBridgeOptions,
): ChatStateWithPhaseOne {
  const bridge = new ChatEnginePhaseOneBridge(options ?? {});
  bridge.ensureHydrated(state);
  return bridge.noteSignal(state, signal, now ?? signal.emittedAt);
}

/**
 * One-shot ranking — returns ranked candidates without managing bridge lifecycle.
 */
export function rankCandidatesOnce(
  state: ChatStateWithPhaseOne,
  candidates: readonly ChatPhaseOneResponseCandidate[],
  channelId: ChatVisibleChannel,
  sceneRole: string | null = null,
  now?: UnixMs,
  options?: ChatPhaseOneBridgeOptions,
): readonly ChatPhaseOneRankedCandidate[] {
  const bridge = new ChatEnginePhaseOneBridge(options ?? {});
  bridge.ensureHydrated(state);
  return bridge.rankResponseCandidates(state, candidates, channelId, sceneRole, now ?? nowMs());
}

/**
 * Build and return a fresh Phase 1 health snapshot from the given state.
 * Does not require a live bridge instance.
 */
export function buildPhaseOneHealth(state: ChatStateWithPhaseOne): ChatPhaseOneBridgeHealthSnapshot {
  const bridge = new ChatEnginePhaseOneBridge();
  bridge.ensureHydrated(state);
  return bridge.getHealth(state);
}

/**
 * Apply a full feature snapshot to the Phase 1 fingerprint in state.
 * Convenience function for pipeline-level integration.
 */
export function applyFeatureSnapshotToPhaseOne(
  state: ChatStateWithPhaseOne,
  snapshot: ChatFeatureSnapshot,
  now?: UnixMs,
  options?: ChatPhaseOneBridgeOptions,
): ChatStateWithPhaseOne {
  const bridge = new ChatEnginePhaseOneBridge(options ?? {});
  bridge.ensureHydrated(state);
  return bridge.applyFeatureSnapshot(state, snapshot, now ?? snapshot.generatedAt);
}

/**
 * One-shot novelty snapshot — returns the current novelty ledger snapshot
 * without managing bridge lifecycle.
 */
export function getPhaseOneNoveltySnapshot(
  state: ChatStateWithPhaseOne,
  now?: UnixMs,
  options?: ChatPhaseOneBridgeOptions,
): ChatNoveltyLedgerSnapshot {
  const bridge = new ChatEnginePhaseOneBridge(options ?? {});
  bridge.ensureHydrated(state);
  return bridge.getNoveltySnapshot(state, now ?? nowMs());
}

/**
 * One-shot memory snapshot — returns the current episodic memory snapshot
 * without managing bridge lifecycle.
 */
export function getPhaseOneMemorySnapshot(
  state: ChatStateWithPhaseOne,
  options?: ChatPhaseOneBridgeOptions,
): ChatEpisodicMemorySnapshot {
  const bridge = new ChatEnginePhaseOneBridge(options ?? {});
  bridge.ensureHydrated(state);
  return bridge.getMemorySnapshot(state);
}

// ============================================================================
// MARK: Namespace export
// ============================================================================

export const ChatEnginePhaseOneBridgeNS = Object.freeze({
  /* Class */
  ChatEnginePhaseOneBridge,

  /* Factory */
  createChatEnginePhaseOneBridge,

  /* Singleton management */
  getDefaultChatEnginePhaseOneBridge,
  setDefaultChatEnginePhaseOneBridge,
  resetDefaultChatEnginePhaseOneBridge,

  /* One-shot helpers */
  applyMessageToPhaseOne,
  applySceneToPhaseOne,
  applySignalToPhaseOne,
  rankCandidatesOnce,
  buildPhaseOneHealth,
  applyFeatureSnapshotToPhaseOne,
  getPhaseOneNoveltySnapshot,
  getPhaseOneMemorySnapshot,

  /* Accessor helpers (re-exported for test inspection) */
  readMsgText,
  readMsgKind,
  readMsgChannelId,
  readMsgTimestamp,
  readMsgMeta,
  readMsgShieldBreached,
  readMsgCascadeDirection,
  readMsgBluffRisk,
  readMsgDealUrgency,
  readMsgPressureTier,
  readMsgSceneId,
  readMsgMomentId,
  readMsgSenderId,
  readMsgBotSource,
  readSceneId,
  readScenePrimaryChannel,
  readSceneStartedAt,
  readSceneMomentId,
  readSceneMomentType,

  /* Utility */
  mapPressureTierToBand,
  momentumToBand,
  heatLabel,
  nudge,
  clamp01,

  /* Constants */
  BRIDGE_VERSION,
  NOVELTY_COMPOSITE_WEIGHT,
  CALLBACK_COMPOSITE_WEIGHT,
  PRIORITY_COMPOSITE_WEIGHT,
  FINGERPRINT_MESSAGE_MOMENTUM,
  FINGERPRINT_SIGNAL_MOMENTUM,
  FINGERPRINT_SCENE_MOMENTUM,
  FINGERPRINT_FEATURE_MOMENTUM,
  MIN_SIGNAL_SYNC_INTERVAL_MS,
  PUBLIC_CHANNELS,
  PRIVATE_CHANNELS,
  DEAL_ROOM_CHANNEL,
});
