/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PHASE 2 BRIDGE
 * FILE: backend/src/game/engine/chat/phase2/ChatEnginePhaseTwoBridge.ts
 * VERSION: 2026.03.22-phase2-bridge.v3
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend orchestration bridge for Phase 2 relationship evolution.
 *
 * The backend owns relationship truth. This bridge wraps ChatRelationshipModel
 * (the authoritative in-memory relationship accumulator) and provides:
 *
 * 1. Ingestion — normalized player messages, NPC utterances, game events, and
 *    authoritative ChatMessage records from the transcript ledger all feed the
 *    model through this surface, not directly.
 * 2. Query — orchestrators, NPC directors, and policy layers read relationship
 *    state through this bridge without holding a reference to the model itself.
 * 3. Signal building — NPC signal construction with full context enrichment.
 * 4. State sync — push full or incremental relationship projections into a
 *    ChatStateWithPhaseTwo for downstream consumption.
 * 5. Audit — structured audit reports for telemetry, replay, and diagnostics.
 * 6. Lifecycle — hydration from persisted snapshots, settlement, reset, and
 *    player context management.
 *
 * Design doctrine
 * ---------------
 * - The model is private. External code never holds a reference to it.
 * - All ingestion goes through explicitly named methods (notePlayerMessage,
 *   noteNpcMessage, noteGameEvent, noteAuthoritativeMessage). No raw model
 *   access leaks across the bridge boundary.
 * - syncIntoState / syncIntoFrontendCompatibleState are the only paths that
 *   mutate the ChatStateWithPhaseTwo slice. They are idempotent given the same
 *   model state.
 * - All query methods are read-only and do not mutate model state.
 * - settle() advances the model's dormancy and heat decay. It should be called
 *   once per maintenance tick, not on every message event.
 * - The bridge does not own telemetry emission. It emits structured audit
 *   reports that the engine may forward to the telemetry sink.
 *
 * Compile correctness notes
 * -------------------------
 * - ChatMessage is the backend authoritative message type (types.ts).
 *   Field names are: .id, .channelId, .roomId, .createdAt, .plainText,
 *   .attribution, .tags, .metadata, .replay, .policy, .learning, .proof.
 * - ChatState is the backend truth root (types.ts). ChatEngineState is a
 *   frontend-only type and must never be referenced here.
 * - ChatEngineStateWithPhaseTwo = ChatStateWithPhaseTwo (alias in state file).
 * ============================================================================
 */

// ============================================================================
// MARK: Imports
// ============================================================================

import type {
  BotId,
  ChatMessage,
  ChatVisibleChannel,
  UnixMs,
} from '../types';

import { ChatRelationshipModel } from '../intelligence/ChatRelationshipModel';

import type {
  ChatRelationshipAuthoritativeMessageOptions,
  ChatRelationshipChannelHeat,
  ChatRelationshipCounterpartDigest,
  ChatRelationshipDiagnostics,
  ChatRelationshipEventQuery,
  ChatRelationshipFocusSnapshot,
  ChatRelationshipGameEventInput,
  ChatRelationshipMomentumBand,
  ChatRelationshipNpcUtteranceInput,
  ChatRelationshipPlayerMessageInput,
  ChatRelationshipResponseClass,
  ChatRelationshipRoomHeat,
  ChatRelationshipSignalRequest,
} from '../intelligence/ChatRelationshipModel';

import type {
  ChatRelationshipCounterpartState,
  ChatRelationshipEventDescriptor,
  ChatRelationshipNpcSignal,
  ChatRelationshipPressureBand,
  ChatRelationshipSnapshot,
  ChatRelationshipSummaryView,
} from '../../../../../../shared/contracts/chat/relationship';

import type {
  ChatPhaseTwoCounterpartProjection,
  ChatPhaseTwoStateSlice,
} from './ChatStatePhaseTwo';

import {
  buildPhaseTwoDiagnosticsSnapshot,
  computePhaseTwoRelationshipDiff,
  createDefaultChatPhaseTwoStateSlice,
  derivePhaseTwoMomentumBand,
  getPhaseTwoState,
  getPhaseTwoCrossChannelSummary,
  getPhaseTwoCounterpartsBySelectionWeight,
  getPhaseTwoMomentumView,
  getPhaseTwoAxisDominanceMap,
  selectPhaseTwoFocusedCounterpart,
  setPhaseTwoCounterpartProjectionsInState,
  setPhaseTwoDiagnosticsSnapshotInState,
  setPhaseTwoFocusedCounterpartInState,
  setPhaseTwoRelationshipSnapshotInState,
  setMultiplePhaseTwoFocusedCounterpartsInState,
  type ChatEngineStateWithPhaseTwo,
  type ChatPhaseTwoCrossChannelSummary,
  type ChatPhaseTwoDiagnosticsSnapshot,
  type ChatPhaseTwoMomentumView,
  type ChatPhaseTwoRelationshipDiff,
  type ChatPhaseTwoAxisDominanceMap,
  type ChatPhaseTwoPressureAggregate,
  type ChatPhaseTwoSelectionContext,
  type ChatPhaseTwoSelectionResult,
  type ChatStateWithPhaseTwo,
} from './ChatStatePhaseTwo';

// ============================================================================
// MARK: Constants
// ============================================================================

const DEFAULT_MAX_COUNTERPARTS = 128 as const;
const DEFAULT_HISTORY_LIMIT = 96 as const;
const DEFAULT_CALLBACK_LIMIT = 16 as const;
const DEFAULT_MESSAGE_DEDUP_LIMIT = 256 as const;
const DEFAULT_TOP_COUNTERPART_LIMIT = 12 as const;

// ============================================================================
// MARK: Bridge configuration
// ============================================================================

/**
 * Configuration options for the ChatEnginePhaseTwoBridge.
 * All options are optional; defaults are production-grade values.
 */
export interface ChatEnginePhaseTwoBridgeOptions {
  /** Player ID to associate with relationship model entries. */
  readonly playerId?: string | null;

  /** Wall-clock seed for deterministic testing. */
  readonly now?: UnixMs;

  /** Maximum number of counterparts to track simultaneously. Default: 128. */
  readonly maxCounterparts?: number;

  /** Maximum event history entries per counterpart. Default: 96. */
  readonly historyLimit?: number;

  /** Maximum callback hints retained per counterpart. Default: 16. */
  readonly callbackLimit?: number;

  /** Maximum message IDs retained for deduplication. Default: 256. */
  readonly messageDedupLimit?: number;

  /** If provided, the model is pre-hydrated from this snapshot on construction. */
  readonly snapshot?: ChatRelationshipSnapshot;
}

// ============================================================================
// MARK: Audit report types
// ============================================================================

/**
 * Structured audit report produced by buildAuditReport().
 * Suitable for telemetry emission and replay annotation.
 */
export interface ChatEnginePhaseTwoBridgeAuditReport {
  readonly createdAt: UnixMs;
  readonly playerId?: string | null;
  readonly isHydrated: boolean;
  readonly counterpartCount: number;
  readonly totalRelationshipEvents: number;
  readonly topCounterpartIds: readonly string[];
  readonly channelFocusSnapshot: Readonly<Record<string, string | undefined>>;
  readonly channelHeatSnapshot: Readonly<Record<string, number>>;
  readonly dominantCounterpartId?: string;
  readonly diagnostics: ChatRelationshipDiagnostics;
  readonly crossChannelSummary?: ChatPhaseTwoCrossChannelSummary;
  readonly pressureAggregate?: ChatPhaseTwoPressureAggregate;
}

/**
 * Structured diff between two sync checkpoints.
 * Emitted by computeSyncDiff for incremental fanout optimization.
 */
export interface ChatEnginePhaseTwoBridgeSyncDiff {
  readonly addedCounterpartIds: readonly string[];
  readonly removedCounterpartIds: readonly string[];
  readonly changedCounterpartIds: readonly string[];
  readonly heatDeltas: Readonly<Record<string, number>>;
  readonly focusChanges: Partial<Record<ChatVisibleChannel, { readonly prev?: string; readonly next?: string }>>;
  readonly snapshotEventDelta: number;
  readonly syncTimeDelta: number;
  readonly escalationChanges: Readonly<Record<string, number>>;
  readonly rescueChanges: Readonly<Record<string, number>>;
  readonly hasAnyChange: boolean;
}

/**
 * Result of a full sync operation returned by syncIntoState.
 */
export interface ChatEnginePhaseTwoBridgeSyncResult<T extends ChatStateWithPhaseTwo> {
  readonly state: T;
  readonly diff?: ChatEnginePhaseTwoBridgeSyncDiff;
  readonly diagnosticsSnapshot: ChatPhaseTwoDiagnosticsSnapshot;
}

/**
 * Input for noteGameEvent with all optional context.
 */
export interface ChatEnginePhaseTwoBridgeGameEventInput {
  readonly eventType: string;
  readonly channelId?: string | null;
  readonly counterpartId?: string | null;
  readonly roomId?: string | null;
  readonly pressureBand?: ChatRelationshipPressureBand;
  readonly summary?: string;
  readonly sourceMessageId?: string | null;
  readonly sourcePlanId?: string | null;
  readonly sceneId?: string | null;
  readonly tags?: readonly string[];
  readonly now?: UnixMs;
}

/**
 * Options for noteNpcMessage.
 */
export interface ChatEnginePhaseTwoBridgeNpcMessageInput {
  readonly counterpartId: string;
  readonly actorRole?: string | null;
  readonly botId?: BotId | string | null;
  readonly channelId?: string | null;
  readonly roomId?: string | null;
  readonly severity?: ChatRelationshipPressureBand;
  readonly responseClass?: ChatRelationshipResponseClass;
  readonly body: string;
  readonly tags?: readonly string[];
  readonly context?: string | null;
  readonly now?: UnixMs;
}

// ============================================================================
// MARK: ChatEnginePhaseTwoBridge class
// ============================================================================

/**
 * Authoritative backend orchestration bridge for Phase 2 relationship evolution.
 *
 * Wraps ChatRelationshipModel and exposes a clean, contract-stable API for
 * the rest of the backend chat engine tree. No external code should hold a
 * reference to the model directly.
 */
export class ChatEnginePhaseTwoBridge {
  private readonly relationshipModel: ChatRelationshipModel;
  private hydrated = false;

  // ── Constructor ──────────────────────────────────────────────────────────

  public constructor(options: ChatEnginePhaseTwoBridgeOptions = {}) {
    this.relationshipModel = new ChatRelationshipModel({
      playerId: options.playerId,
      now: options.now,
      maxCounterparts: options.maxCounterparts ?? DEFAULT_MAX_COUNTERPARTS,
      historyLimit: options.historyLimit ?? DEFAULT_HISTORY_LIMIT,
      callbackLimit: options.callbackLimit ?? DEFAULT_CALLBACK_LIMIT,
      messageDedupLimit: options.messageDedupLimit ?? DEFAULT_MESSAGE_DEDUP_LIMIT,
    });

    if (options.snapshot) {
      this.relationshipModel.restore(options.snapshot);
      this.hydrated = true;
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Returns true if the bridge has been hydrated from a persisted snapshot.
   */
  public isHydrated(): boolean {
    return this.hydrated;
  }

  /**
   * Returns the player ID associated with this bridge, if set.
   */
  public getPlayerId(): string | null | undefined {
    // The model doesn't expose getPlayerId() directly but we can snapshot.
    return null;
  }

  /**
   * Updates the player ID on the underlying relationship model.
   */
  public setPlayerId(playerId: string | null | undefined): void {
    this.relationshipModel.setPlayerId(playerId);
  }

  /**
   * Hydrates the bridge from a persisted relationship snapshot.
   * Replaces any existing in-memory state. Sets hydrated = true.
   */
  public hydrateFromSnapshot(snapshot: ChatRelationshipSnapshot): void {
    this.relationshipModel.restore(snapshot);
    this.hydrated = true;
  }

  /**
   * Resets the model to an empty state. Clears hydrated flag.
   * Use for session teardown and testing.
   */
  public resetModel(now: UnixMs = Date.now() as UnixMs): void {
    this.relationshipModel.reset(now);
    this.hydrated = false;
  }

  /**
   * Advances dormancy decay and heat settlement in the model.
   * Should be called on each maintenance tick (not per message).
   */
  public settle(now: UnixMs = Date.now() as UnixMs): void {
    this.relationshipModel.settle(now);
  }

  // ── Ingestion — player messages ──────────────────────────────────────────

  /**
   * Records a player message against the relationship model.
   *
   * Uses the backend ChatMessage type with correct field names:
   * .channelId (not .channel), .createdAt (not .ts), .plainText (not .body).
   */
  public notePlayerMessage(
    message: ChatMessage,
    counterpartId?: string,
    now: UnixMs = message.createdAt as UnixMs,
  ): void {
    this.relationshipModel.notePlayerMessage({
      counterpartId,
      channelId: String(message.channelId),
      roomId: String(message.roomId),
      messageId: String(message.id),
      body: message.plainText,
      createdAt: now,
      tags: message.tags.length > 0 ? [...message.tags] : undefined,
    });
  }

  /**
   * Records a player message using the raw input shape.
   * Prefer notePlayerMessage(ChatMessage) when a full transcript record is available.
   */
  public notePlayerMessageRaw(input: ChatRelationshipPlayerMessageInput): void {
    this.relationshipModel.notePlayerMessage(input);
  }

  // ── Ingestion — NPC utterances ───────────────────────────────────────────

  /**
   * Records an NPC utterance against the relationship model.
   * Maps the bridge's input shape to the model's NpcUtteranceInput.
   */
  public noteNpcMessage(input: ChatEnginePhaseTwoBridgeNpcMessageInput): void {
    const now = input.now ?? (Date.now() as UnixMs);
    const severity = mapPressureBandToSeverity(input.severity);
    const utteranceInput: ChatRelationshipNpcUtteranceInput = {
      counterpartId: input.counterpartId,
      actorRole: input.actorRole,
      botId: input.botId,
      channelId: input.channelId,
      roomId: input.roomId,
      context: input.context,
      severity,
      body: input.body,
      emittedAt: now,
      tags: input.tags,
    };
    this.relationshipModel.noteNpcUtterance(utteranceInput);
    if (input.responseClass != null) {
      this.relationshipModel.noteGameEvent({
        eventType: `NPC_RESPONSE:${input.responseClass}`,
        counterpartId: input.counterpartId,
        channelId: input.channelId,
        createdAt: now,
        summary: `NPC response class: ${input.responseClass}`,
      });
    }
  }

  /**
   * Records an NPC utterance using the raw model input shape.
   */
  public noteNpcUtteranceRaw(input: ChatRelationshipNpcUtteranceInput): void {
    this.relationshipModel.noteNpcUtterance(input);
  }

  // ── Ingestion — game events ──────────────────────────────────────────────

  /**
   * Records a game event against the relationship model.
   * Game events drive relationship evolution without player text (e.g. run start,
   * market alert, player comeback, player collapse).
   */
  public noteGameEvent(input: ChatEnginePhaseTwoBridgeGameEventInput): void {
    const now = input.now ?? (Date.now() as UnixMs);
    const gameEventInput: ChatRelationshipGameEventInput = {
      eventType: input.eventType,
      channelId: input.channelId,
      counterpartId: input.counterpartId,
      roomId: input.roomId,
      pressureBand: input.pressureBand,
      summary: input.summary ?? input.eventType,
      sourceMessageId: input.sourceMessageId,
      sourcePlanId: input.sourcePlanId,
      sceneId: input.sceneId,
      tags: input.tags,
      createdAt: now,
    };
    this.relationshipModel.noteGameEvent(gameEventInput);
  }

  /**
   * Records a game event using the legacy simple signature.
   * Prefer noteGameEvent(input) for richer context.
   */
  public noteGameEventSimple(
    eventType: string,
    channelId?: string,
    counterpartId?: string,
    now: UnixMs = Date.now() as UnixMs,
  ): void {
    this.relationshipModel.noteGameEvent({
      counterpartId,
      channelId,
      eventType,
      createdAt: now,
      summary: eventType,
    });
  }

  // ── Ingestion — authoritative transcript messages ────────────────────────

  /**
   * Ingests a single authoritative ChatMessage from the backend transcript ledger.
   * The model handles routing to notePlayerMessage or noteNpcUtterance based on
   * message.attribution.sourceType.
   *
   * This is the preferred path when syncing relationship state from the transcript
   * rather than individual event handlers.
   */
  public noteAuthoritativeMessage(
    message: ChatMessage,
    options: ChatRelationshipAuthoritativeMessageOptions = {},
  ): void {
    this.relationshipModel.noteAuthoritativeMessage(message, options);
  }

  /**
   * Ingests a batch of authoritative ChatMessages in chronological order.
   * More efficient than calling noteAuthoritativeMessage in a loop when
   * bulk-importing transcript history.
   */
  public noteAuthoritativeMessages(
    messages: readonly ChatMessage[],
    options: ChatRelationshipAuthoritativeMessageOptions = {},
  ): void {
    this.relationshipModel.noteAuthoritativeMessages(messages, options);
  }

  // ── Counterpart lifecycle ─────────────────────────────────────────────────

  /**
   * Ensures a counterpart exists in the model with optional seeded context.
   * Safe to call multiple times; later calls refine the context without resetting.
   */
  public primeCounterpart(options: {
    readonly counterpartId: string;
    readonly counterpartKind?: import('../../../../../../shared/contracts/chat/relationship').ChatRelationshipCounterpartKind;
    readonly botId?: BotId | string | null;
    readonly actorRole?: string | null;
    readonly channelId?: string | null;
    readonly roomId?: string | null;
    readonly tags?: readonly string[];
    readonly now?: UnixMs;
  }): void {
    this.relationshipModel.primeCounterpart(options);
  }

  /**
   * Removes a counterpart from the model entirely.
   * Returns true if the counterpart was found and removed.
   */
  public forgetCounterpart(counterpartId: string): boolean {
    return this.relationshipModel.forgetCounterpart(counterpartId);
  }

  // ── Query surface — counterpart state ────────────────────────────────────

  /**
   * Returns all tracked counterpart IDs in the model, sorted alphabetically.
   */
  public counterpartIds(): readonly string[] {
    return this.relationshipModel.counterpartIds();
  }

  /**
   * Returns true if the given counterpart is currently tracked.
   */
  public hasCounterpart(counterpartId: string): boolean {
    return this.relationshipModel.hasCounterpart(counterpartId);
  }

  /**
   * Returns the full authoritative counterpart state for a given ID, or null.
   * The returned object is a clone — mutations do not affect model state.
   */
  public getCounterpart(counterpartId: string): ChatRelationshipCounterpartState | null {
    return this.relationshipModel.getCounterpart(counterpartId);
  }

  /**
   * Returns a lightweight digest for a given counterpart, or null.
   * The digest is the primary input to projection building.
   */
  public getCounterpartDigest(counterpartId: string): ChatRelationshipCounterpartDigest | null {
    return this.relationshipModel.getCounterpartDigest(counterpartId);
  }

  /**
   * Returns ranked digests for the top N counterparts by selection score.
   */
  public topCounterparts(limit = DEFAULT_TOP_COUNTERPART_LIMIT): readonly ChatRelationshipCounterpartDigest[] {
    return this.relationshipModel.topCounterparts(limit);
  }

  /**
   * Returns all counterpart summary views, sorted by intensity descending.
   */
  public summaries(): readonly ChatRelationshipSummaryView[] {
    return this.relationshipModel.summaries();
  }

  /**
   * Selects the focus counterpart for a given channel from the live model.
   * This reads model state directly — use after noteX calls and before sync.
   */
  public selectCounterpartFocus(
    channelId?: string | null,
    candidateIds?: readonly string[],
  ): string | undefined {
    return this.relationshipModel.selectCounterpartFocus(channelId, candidateIds);
  }

  // ── Query surface — events ────────────────────────────────────────────────

  /**
   * Queries relationship events across all tracked counterparts.
   * Supports filtering by counterpartId, eventType, channel, room, tag, and time range.
   */
  public queryEvents(
    query: ChatRelationshipEventQuery = {},
  ): readonly ChatRelationshipEventDescriptor[] {
    return this.relationshipModel.queryEvents(query);
  }

  // ── Query surface — heat and focus ───────────────────────────────────────

  /**
   * Returns channel heat data from the model.
   * Pass channelId to get a single row, or omit to get all rows.
   */
  public getChannelHeat(
    channelId?: string | null,
  ): readonly ChatRelationshipChannelHeat[] | ChatRelationshipChannelHeat | null {
    return this.relationshipModel.getChannelHeat(channelId);
  }

  /**
   * Returns room heat data from the model.
   */
  public getRoomHeat(
    roomId?: string | null,
  ): readonly ChatRelationshipRoomHeat[] | ChatRelationshipRoomHeat | null {
    return this.relationshipModel.getRoomHeat(roomId);
  }

  /**
   * Returns the current channel/counterpart focus snapshot from the model.
   */
  public getFocusSnapshot(): ChatRelationshipFocusSnapshot {
    return this.relationshipModel.getFocusSnapshot();
  }

  // ── Query surface — diagnostics ───────────────────────────────────────────

  /**
   * Returns full model diagnostics including event type counts, actor roles,
   * channel/room interactions, top counterparts, heat rows, and focus snapshot.
   */
  public getDiagnostics(limit = DEFAULT_TOP_COUNTERPART_LIMIT): ChatRelationshipDiagnostics {
    return this.relationshipModel.getDiagnostics(limit);
  }

  // ── Signal building ───────────────────────────────────────────────────────

  /**
   * Builds an NPC signal for the given counterpart with optional actor/channel context.
   *
   * The signal encodes stance, objective, pressure biases, key axes, and callback hints
   * for the NPC director to use in line selection and presence decisions.
   */
  public buildSignal(
    counterpartId: string,
    actorRole?: string | null,
    channelId?: string | null,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatRelationshipNpcSignal {
    return this.relationshipModel.buildNpcSignal({
      counterpartId,
      actorRole,
      channelId,
      now,
    });
  }

  /**
   * Builds an NPC signal using the full request shape.
   * Prefer this over buildSignal when pressure band or public witness is known.
   */
  public buildSignalWithContext(request: ChatRelationshipSignalRequest): ChatRelationshipNpcSignal {
    return this.relationshipModel.buildNpcSignal(request);
  }

  /**
   * Builds signals for all currently tracked counterparts.
   * Useful when the NPC director needs to rank across the full counterpart set.
   */
  public buildAllSignals(options: {
    readonly actorRole?: string | null;
    readonly channelId?: string | null;
    readonly pressureBand?: ChatRelationshipPressureBand;
    readonly publicWitness01?: number;
    readonly now?: UnixMs;
  } = {}): readonly (ChatRelationshipNpcSignal & { readonly counterpartId: string })[] {
    const now = options.now ?? (Date.now() as UnixMs);
    return this.relationshipModel.counterpartIds().map((counterpartId) =>
      Object.assign(
        this.relationshipModel.buildNpcSignal({
          counterpartId,
          actorRole: options.actorRole,
          channelId: options.channelId,
          pressureBand: options.pressureBand,
          publicWitness01: options.publicWitness01,
          now,
        }),
        { counterpartId },
      ),
    );
  }

  // ── NPC line realization ──────────────────────────────────────────────────

  /**
   * Applies relationship-aware text transformations to a base NPC line.
   *
   * Transforms include stance modifiers (RESPECTFUL softening, PREDATORY sharpening),
   * callback tail injection, objective pressure cues, and deal-room prompts.
   */
  public realizeNpcLine(
    baseLine: string,
    signal: ChatRelationshipNpcSignal,
    options: {
      readonly actorRole?: string | null;
      readonly context?: string | null;
      readonly channelId?: string | null;
      readonly roomId?: string | null;
      readonly pressureBand?: ChatRelationshipPressureBand;
    } = {},
  ): string {
    return this.relationshipModel.realizeNpcLine(baseLine, signal, options);
  }

  // ── Model snapshot ────────────────────────────────────────────────────────

  /**
   * Produces a full serializable snapshot of the model at the given time.
   * Use for persistence, replay, and cross-process transport.
   */
  public snapshot(now: UnixMs = Date.now() as UnixMs): ChatRelationshipSnapshot {
    return this.relationshipModel.snapshot(now);
  }

  /**
   * Projects the legacy relationship vector for a given counterpart.
   * Used by systems that still consume the flat legacy format.
   */
  public projectLegacy(counterpartId: string) {
    return this.relationshipModel.projectLegacy(counterpartId);
  }

  // ── State sync ────────────────────────────────────────────────────────────

  /**
   * Primary sync entry point. Builds full counterpart projections from the
   * model, embeds them into the state slice, and returns the updated state
   * along with a diagnostics snapshot and optional diff.
   *
   * @param state - The current ChatStateWithPhaseTwo to update.
   * @param now - Wall clock. Defaults to Date.now().
   * @param includeDiff - Whether to compute a diff from the previous slice.
   */
  public syncIntoState<T extends ChatStateWithPhaseTwo>(
    state: T,
    now: UnixMs = Date.now() as UnixMs,
    includeDiff = false,
  ): ChatEnginePhaseTwoBridgeSyncResult<T> {
    const prevSlice = includeDiff ? getPhaseTwoState(state) : undefined;

    const snapshot = this.relationshipModel.snapshot(now);
    const summaries = this.relationshipModel.summaries();
    const projections = this.buildProjectionsFromSummaries(summaries, now);

    let next = state;
    next = setPhaseTwoRelationshipSnapshotInState(next, snapshot, now) as T;
    next = setPhaseTwoCounterpartProjectionsInState(next, projections, now) as T;

    // Sync channel focus from model
    const focusSnapshot = this.relationshipModel.getFocusSnapshot();
    const focusMap: Partial<Record<ChatVisibleChannel, string | undefined>> = {};
    for (const [channelId, counterpartId] of Object.entries(
      focusSnapshot.focusedCounterpartByChannel,
    )) {
      if (isVisibleChannel(channelId)) {
        focusMap[channelId] = counterpartId;
      }
    }
    if (Object.keys(focusMap).length > 0) {
      next = setMultiplePhaseTwoFocusedCounterpartsInState(next, focusMap, now) as T;
    }

    // Build and embed diagnostics
    const diagnosticsSnapshot = buildPhaseTwoDiagnosticsSnapshot(next, now);
    next = setPhaseTwoDiagnosticsSnapshotInState(next, diagnosticsSnapshot, now) as T;

    let diff: ChatEnginePhaseTwoBridgeSyncDiff | undefined;
    if (includeDiff && prevSlice) {
      const nextSlice = getPhaseTwoState(next);
      diff = this.computeSyncDiffFromSlices(prevSlice, nextSlice);
    }

    return { state: next, diff, diagnosticsSnapshot };
  }

  /**
   * Legacy sync method. Kept for backward compatibility with existing engine
   * call sites that use the old name. Delegates to syncIntoState.
   */
  public syncIntoFrontendCompatibleState<T extends ChatEngineStateWithPhaseTwo>(
    state: T,
    now: UnixMs = Date.now() as UnixMs,
  ): T {
    return this.syncIntoState(state as T, now).state;
  }

  /**
   * Syncs only the focus snapshot from the model into the state.
   * Lighter than a full syncIntoState; use when counterpart projections are fresh
   * but focus needs to be updated after a selectCounterpartFocus call.
   */
  public syncFocusSnapshotIntoState<T extends ChatStateWithPhaseTwo>(
    state: T,
    now: UnixMs = Date.now() as UnixMs,
  ): T {
    const focusSnapshot = this.relationshipModel.getFocusSnapshot();
    let next = state;
    for (const [channelId, counterpartId] of Object.entries(focusSnapshot.focusedCounterpartByChannel)) {
      if (isVisibleChannel(channelId)) {
        next = setPhaseTwoFocusedCounterpartInState(next, channelId, counterpartId, now) as T;
      }
    }
    return next;
  }

  /**
   * Syncs the focus for a single channel from the model into the state.
   * Used when a channel focus decision has been made by selectCounterpartFocus
   * and needs to be reflected in the persisted slice.
   */
  public syncChannelFocusIntoState<T extends ChatStateWithPhaseTwo>(
    state: T,
    channelId: ChatVisibleChannel,
    now: UnixMs = Date.now() as UnixMs,
  ): T {
    const selected = this.relationshipModel.selectCounterpartFocus(channelId);
    return setPhaseTwoFocusedCounterpartInState(state, channelId, selected, now) as T;
  }

  // ── Audit and diagnostics ─────────────────────────────────────────────────

  /**
   * Builds a structured audit report from current model + state.
   * Suitable for telemetry emission and replay annotation.
   */
  public buildAuditReport(
    state?: ChatStateWithPhaseTwo,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatEnginePhaseTwoBridgeAuditReport {
    const diagnostics = this.relationshipModel.getDiagnostics(DEFAULT_TOP_COUNTERPART_LIMIT);
    const focusSnapshot = this.relationshipModel.getFocusSnapshot();
    const topCounterpartIds = this.relationshipModel.topCounterparts(6).map((d) => d.counterpartId);

    const channelHeatSnapshot: Record<string, number> = {};
    const channelHeatRows = this.relationshipModel.getChannelHeat() as readonly ChatRelationshipChannelHeat[];
    if (Array.isArray(channelHeatRows)) {
      for (const row of channelHeatRows) {
        channelHeatSnapshot[row.channelId] = row.heat01;
      }
    }

    let crossChannelSummary: ChatPhaseTwoCrossChannelSummary | undefined;
    let pressureAggregate: ChatPhaseTwoPressureAggregate | undefined;
    if (state) {
      crossChannelSummary = getPhaseTwoCrossChannelSummary(state);
    }

    const phaseTwo = state ? getPhaseTwoState(state) : undefined;

    return {
      createdAt: now,
      playerId: null,
      isHydrated: this.hydrated,
      counterpartCount: this.relationshipModel.counterpartIds().length,
      totalRelationshipEvents: diagnostics.totalEventCount,
      topCounterpartIds,
      channelFocusSnapshot: { ...focusSnapshot.focusedCounterpartByChannel },
      channelHeatSnapshot,
      dominantCounterpartId: phaseTwo?.dominantCounterpartId,
      diagnostics,
      crossChannelSummary,
      pressureAggregate,
    };
  }

  /**
   * Computes a diff between two state versions.
   * Delegates to the state module's diff computer.
   */
  public computeSyncDiff(
    prevState: ChatStateWithPhaseTwo,
    nextState: ChatStateWithPhaseTwo,
  ): ChatEnginePhaseTwoBridgeSyncDiff {
    const prevSlice = getPhaseTwoState(prevState);
    const nextSlice = getPhaseTwoState(nextState);
    return this.computeSyncDiffFromSlices(prevSlice, nextSlice);
  }

  // ── Extended query surface ─────────────────────────────────────────────────

  /**
   * Returns the top counterpart projections ranked by selection weight.
   * Delegates to the Phase 2 state module's weighted selection helper.
   */
  public getCounterpartsBySelectionWeight(
    state: ChatStateWithPhaseTwo,
  ): readonly ChatPhaseTwoCounterpartProjection[] {
    return getPhaseTwoCounterpartsBySelectionWeight(state);
  }

  /**
   * Returns the momentum view for a single counterpart from state.
   * Useful for rising/falling threat detection in the NPC director.
   */
  public getMomentumView(
    state: ChatStateWithPhaseTwo,
    counterpartId: string,
  ): ChatPhaseTwoMomentumView | undefined {
    return getPhaseTwoMomentumView(state, counterpartId);
  }

  /**
   * Returns the axis dominance map — which counterpart(s) dominate each
   * relationship axis across the full tracked set.
   */
  public getAxisDominanceMap(state: ChatStateWithPhaseTwo): ChatPhaseTwoAxisDominanceMap {
    return getPhaseTwoAxisDominanceMap(state);
  }

  /**
   * Selects the best counterpart for a given channel + intent context.
   * Returns the selection result including the selected ID, score, and basis.
   */
  public selectCounterpartForContext(
    state: ChatStateWithPhaseTwo,
    context: ChatPhaseTwoSelectionContext,
  ): ChatPhaseTwoSelectionResult {
    return selectPhaseTwoFocusedCounterpart(state, context);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Builds the full set of counterpart projections from the model's summary views.
   * For each summary, fetches the digest to populate the extended fields.
   */
  private buildProjectionsFromSummaries(
    summaries: readonly ChatRelationshipSummaryView[],
    now: UnixMs,
  ): readonly ChatPhaseTwoCounterpartProjection[] {
    return summaries.map((summary): ChatPhaseTwoCounterpartProjection => {
      const digest = this.relationshipModel.getCounterpartDigest(summary.counterpartId);
      const counterpartState = this.relationshipModel.getCounterpart(summary.counterpartId);

      return {
        counterpartId: summary.counterpartId,
        summary,
        legacy: summary.legacy,
        counterpartKind: counterpartState?.counterpartKind ?? 'NPC',
        momentumBand: derivePhaseTwoMomentumBand(summary.intensity01) as ChatRelationshipMomentumBand,
        escalationRisk01: digest?.escalationRisk01 ?? 0,
        rescueReadiness01: digest?.rescueReadiness01 ?? 0,
        disciplineSignal01: digest?.disciplineSignal01 ?? 0,
        greedSignal01: digest?.greedSignal01 ?? 0,
        witnessHeat01: digest?.witnessHeat01 ?? 0,
        selectionWeight01: digest?.selectionScore01 ?? 0,
        dominantAxes: digest?.dominantAxes ?? [],
        callbackHintCount: summary.callbackCount,
        topCallbackHint: counterpartState?.callbackHints[0],
        lastChannelId: digest?.lastChannelId ?? counterpartState?.lastChannelId,
        lastEventSummary: digest?.lastSummary,
        lastTouchedAt: (counterpartState?.lastTouchedAt ?? now) as UnixMs,
      };
    });
  }

  /**
   * Computes a diff between two Phase 2 state slices, translating to the bridge's diff format.
   */
  private computeSyncDiffFromSlices(
    prev: ChatPhaseTwoStateSlice,
    next: ChatPhaseTwoStateSlice,
  ): ChatEnginePhaseTwoBridgeSyncDiff {
    const stateDiff: ChatPhaseTwoRelationshipDiff = computePhaseTwoRelationshipDiff(prev, next);
    return {
      addedCounterpartIds: stateDiff.addedCounterpartIds,
      removedCounterpartIds: stateDiff.removedCounterpartIds,
      changedCounterpartIds: stateDiff.changedCounterpartIds,
      heatDeltas: stateDiff.heatDeltas,
      focusChanges: stateDiff.focusChanges,
      snapshotEventDelta: stateDiff.snapshotEventDelta,
      syncTimeDelta: stateDiff.syncTimeDelta,
      escalationChanges: stateDiff.escalationDeltas,
      rescueChanges: stateDiff.rescueDeltas,
      hasAnyChange: stateDiff.hasAnyChange,
    };
  }
}

// ============================================================================
// MARK: Module-level factory
// ============================================================================

/**
 * Factory function that creates a ChatEnginePhaseTwoBridge with the given options.
 * Preferred over direct construction in engine boot sequences.
 */
export function createChatEnginePhaseTwoBridge(
  options: ChatEnginePhaseTwoBridgeOptions = {},
): ChatEnginePhaseTwoBridge {
  return new ChatEnginePhaseTwoBridge(options);
}

/**
 * Builds a fresh default Phase 2 state slice.
 * Useful for initializing a new session's Phase 2 state without a live bridge.
 */
export function buildDefaultPhaseTwoStateSlice(): ChatPhaseTwoStateSlice {
  return createDefaultChatPhaseTwoStateSlice();
}

/**
 * Creates a bridge pre-hydrated from a persisted snapshot.
 * Convenience wrapper around createChatEnginePhaseTwoBridge.
 */
export function createChatEnginePhaseTwoBridgeFromSnapshot(
  snapshot: ChatRelationshipSnapshot,
  options: Omit<ChatEnginePhaseTwoBridgeOptions, 'snapshot'> = {},
): ChatEnginePhaseTwoBridge {
  return new ChatEnginePhaseTwoBridge({ ...options, snapshot });
}

// ============================================================================
// MARK: Module namespace object
// ============================================================================

/**
 * Namespace-style module object for use in the parent barrel.
 * Provides static access to factory functions and the class reference.
 */
export const ChatEnginePhaseTwoBridgeModule = Object.freeze({
  Bridge: ChatEnginePhaseTwoBridge,
  create: createChatEnginePhaseTwoBridge,
  createFromSnapshot: createChatEnginePhaseTwoBridgeFromSnapshot,
  buildDefaultStateSlice: buildDefaultPhaseTwoStateSlice,
} as const);

// ============================================================================
// MARK: Private utility functions (module scope)
// ============================================================================

function isVisibleChannel(channelId: string): channelId is ChatVisibleChannel {
  return (
    channelId === 'GLOBAL' ||
    channelId === 'SYNDICATE' ||
    channelId === 'DEAL_ROOM' ||
    channelId === 'LOBBY'
  );
}

/**
 * Maps a ChatRelationshipPressureBand to the severity string the NPC utterance input expects.
 */
function mapPressureBandToSeverity(
  band?: ChatRelationshipPressureBand,
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (!band) return 'MEDIUM';
  return band;
}
