/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT LEGEND MOMENT LEDGER
 * FILE: backend/src/game/engine/chat/rewards/LegendMomentLedger.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Durable prestige-moment authority for the backend chat lane.
 *
 * This file exists because legend moments are not just a frontend celebration.
 * They become part of the authoritative run memory of the room. Once the game
 * decides that a comeback, counterplay, humiliation reversal, rescue, or
 * sovereignty beat crossed the prestige threshold, the backend must own:
 *
 * - the authoritative legend identity,
 * - the room-level archive of prestige moments,
 * - replay linkage and callback linkage,
 * - reward-eligibility state,
 * - later retrieval for post-run ritual, replay, rewards, and transport.
 *
 * What this file owns
 * -------------------
 * - legend record admission and deduplication
 * - provisional vs confirmed prestige lifecycle
 * - room prestige accumulation and cooldown state
 * - witness / replay / message / proof correlation snapshots
 * - reward queue staging for downstream grant resolution
 * - retrieval surfaces for replay, post-run, and callback services
 * - integrity audits over the ledger's own indexes
 *
 * What this file does not own
 * ---------------------------
 * - transcript truth
 * - proof edge creation
 * - replay artifact authoring
 * - permanent entitlement mutation
 * - transport fanout or UI celebration rendering
 *
 * Authority fit
 * -------------
 * This file sits beside:
 * - ChatSceneArchiveService.ts
 * - ChatTranscriptLedger.ts
 * - ChatProofChain.ts
 * - replay/ChatReplayAssembler.ts
 * - replay/ChatReplayIndex.ts
 * - rewards/RewardGrantResolver.ts
 * - rewards/ReplayMomentIndexer.ts
 *
 * Shared contract fit
 * -------------------
 * Long-term legend and reward truth belongs under:
 * - /shared/contracts/chat/ChatLegend.ts
 * - /shared/contracts/chat/ChatReward.ts
 *
 * This backend ledger therefore consumes the shared prestige contracts while
 * retaining backend-owned indexing, lifecycle, and audit semantics.
 * ============================================================================
 */

import type {
  ChatLegendArtifact,
  ChatLegendClass,
  ChatLegendEvent,
  ChatLegendOutcomeTag,
  ChatLegendReplayLink,
  ChatLegendRewardHint,
  ChatLegendSeverity,
  ChatLegendTier,
  ChatLegendTriggerContext,
  ChatLegendVisibility,
  ChatLegendWitness,
} from '../../../../../../shared/contracts/chat/ChatLegend';
import type {
  ChatRewardGrant,
  ChatRewardClass,
} from '../../../../../../shared/contracts/chat/ChatReward';
import {
  asSequenceNumber,
  asUnixMs,
  type ChatEventId,
  type ChatLegendId,
  type ChatMessage,
  type ChatMessageId,
  type ChatProofEdge,
  type ChatProofHash,
  type ChatReplayArtifact,
  type ChatReplayId,
  type ChatRoomId,
  type ChatState,
  type ChatTranscriptEntry,
  type JsonValue,
  type Score01,
  type Score100,
  type SequenceNumber,
  type UnixMs,
} from '../types';

// ============================================================================
// MARK: Local lifecycle contracts
// ============================================================================

export type LegendMomentLedgerStatus =
  | 'PROVISIONAL'
  | 'CONFIRMED'
  | 'GRANT_QUEUED'
  | 'GRANTED'
  | 'ARCHIVED'
  | 'REVOKED';

export type LegendMomentLedgerReasonCode =
  | 'NEW_EVENT_ACCEPTED'
  | 'EXISTING_EVENT_MERGED'
  | 'REPLAY_LINKED'
  | 'WITNESS_LINKED'
  | 'MESSAGE_LINKED'
  | 'PROOF_LINKED'
  | 'ROOM_PRESTIGE_UPDATED'
  | 'REWARD_HINT_STAGED'
  | 'REWARD_GRANTED'
  | 'REWARD_REVOKED'
  | 'ARCHIVED_BY_POLICY'
  | 'REVOKED_BY_POLICY'
  | 'SCORE_UPGRADED'
  | 'SCORE_SUPPRESSED'
  | 'VISIBILITY_UPGRADED'
  | 'DUPLICATE_COALESCED'
  | 'CALLBACK_READY'
  | 'POSTRUN_READY'
  | 'TRANSPORT_INDEXED'
  | 'INTEGRITY_REPAIRED';

export interface LegendMomentLedgerReason {
  readonly code: LegendMomentLedgerReasonCode;
  readonly at: UnixMs;
  readonly detail: string;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface LegendMomentReplayCoverage {
  readonly replayIds: readonly ChatReplayId[];
  readonly primaryReplayId: ChatReplayId | null;
  readonly anchorKeys: readonly string[];
  readonly createdFromReplayRange: boolean;
  readonly sequenceStart: SequenceNumber | null;
  readonly sequenceEnd: SequenceNumber | null;
  readonly coverageScore01: Score01 | null;
}

export interface LegendMomentMessageCoverage {
  readonly primaryMessageId: ChatMessageId | null;
  readonly witnessMessageIds: readonly ChatMessageId[];
  readonly quotedMessageIds: readonly ChatMessageId[];
  readonly causalParentMessageIds: readonly ChatMessageId[];
}

export interface LegendMomentProofCoverage {
  readonly hashes: readonly ChatProofHash[];
  readonly coveredEdgeCount: number;
  readonly causalClosureComplete: boolean;
}

export interface LegendMomentRewardState {
  readonly eligible: boolean;
  readonly queued: boolean;
  readonly granted: boolean;
  readonly lastQueuedAt: UnixMs | null;
  readonly lastGrantedAt: UnixMs | null;
  readonly rewardClasses: readonly ChatRewardClass[];
  readonly rewardHintCount: number;
  readonly grants: readonly ChatRewardGrant[];
}

export interface LegendMomentCallbackState {
  readonly replayReady: boolean;
  readonly callbackReady: boolean;
  readonly postRunReady: boolean;
  readonly callbackLabels: readonly string[];
}

export interface LegendMomentRecord {
  readonly legendId: ChatLegendId;
  readonly roomId: ChatRoomId;
  readonly roomSequence: number;
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly status: LegendMomentLedgerStatus;
  readonly legendClass: ChatLegendClass;
  readonly tier: ChatLegendTier;
  readonly severity: ChatLegendSeverity;
  readonly visibility: ChatLegendVisibility;
  readonly outcomeTags: readonly ChatLegendOutcomeTag[];
  readonly acceptedEvent: ChatLegendEvent;
  readonly triggerContext: ChatLegendTriggerContext | null;
  readonly replay: LegendMomentReplayCoverage;
  readonly messages: LegendMomentMessageCoverage;
  readonly proof: LegendMomentProofCoverage;
  readonly reward: LegendMomentRewardState;
  readonly callback: LegendMomentCallbackState;
  readonly witnessCount: number;
  readonly artifactCount: number;
  readonly reasons: readonly LegendMomentLedgerReason[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface LegendMomentRoomPrestigeState {
  readonly roomId: ChatRoomId;
  readonly legendIds: readonly ChatLegendId[];
  readonly confirmedCount: number;
  readonly grantedCount: number;
  readonly archivedCount: number;
  readonly revokedCount: number;
  readonly scoreByClass: Readonly<Record<string, number>>;
  readonly lastLegendAt: UnixMs | null;
  readonly lastGrantedAt: UnixMs | null;
  readonly activeLegendId: ChatLegendId | null;
  readonly replayReadyLegendIds: readonly ChatLegendId[];
  readonly callbackReadyLegendIds: readonly ChatLegendId[];
  readonly postRunReadyLegendIds: readonly ChatLegendId[];
}

export interface LegendMomentLedgerSnapshot {
  readonly byId: Readonly<Record<ChatLegendId, LegendMomentRecord>>;
  readonly byRoom: Readonly<Record<ChatRoomId, readonly LegendMomentRecord[]>>;
  readonly roomPrestige: Readonly<Record<ChatRoomId, LegendMomentRoomPrestigeState>>;
}

export interface LegendMomentLedgerConfig {
  readonly maxReasonsPerLegend: number;
  readonly maxLegendsPerRoom: number;
  readonly maxWitnessIdsPerLegend: number;
  readonly maxReplayLinksPerLegend: number;
  readonly maxProofHashesPerLegend: number;
  readonly dedupeWindowMs: number;
  readonly archiveAfterMs: number;
  readonly allowProvisionalUpgrade: boolean;
}

export interface LegendMomentAdmitInput {
  readonly legendEvent: ChatLegendEvent;
  readonly state?: ChatState;
  readonly sourceEventId?: ChatEventId | null;
  readonly sourceReplayArtifacts?: readonly ChatReplayArtifact[];
  readonly sourceTranscript?: readonly ChatTranscriptEntry[];
  readonly sourceProofEdges?: readonly ChatProofEdge[];
  readonly preferredPrimaryMessageId?: ChatMessageId | null;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface LegendMomentAdmitResult {
  readonly record: LegendMomentRecord;
  readonly created: boolean;
  readonly merged: boolean;
  readonly roomPrestige: LegendMomentRoomPrestigeState;
}

export interface LegendMomentRewardGrantInput {
  readonly legendId: ChatLegendId;
  readonly grants: readonly ChatRewardGrant[];
  readonly grantedAt?: UnixMs;
}

export interface LegendMomentReplayLinkInput {
  readonly legendId: ChatLegendId;
  readonly replayArtifacts: readonly ChatReplayArtifact[];
  readonly linkedAt?: UnixMs;
}

export interface LegendMomentIntegrityIssue {
  readonly code:
    | 'MISSING_ROOM_INDEX'
    | 'MISSING_ID_INDEX'
    | 'ROOM_INDEX_DRIFT'
    | 'REPLAY_INDEX_DRIFT'
    | 'MESSAGE_INDEX_DRIFT'
    | 'PRESTIGE_STATE_DRIFT'
    | 'DUPLICATE_LEGEND_ID'
    | 'INVALID_REWARD_STATE'
    | 'INVALID_REPLAY_LINK';
  readonly legendId: ChatLegendId | null;
  readonly roomId: ChatRoomId | null;
  readonly detail: string;
}

const DEFAULT_LEGEND_MOMENT_LEDGER_CONFIG: LegendMomentLedgerConfig = Object.freeze({
  maxReasonsPerLegend: 64,
  maxLegendsPerRoom: 5_000,
  maxWitnessIdsPerLegend: 24,
  maxReplayLinksPerLegend: 12,
  maxProofHashesPerLegend: 32,
  dedupeWindowMs: 90_000,
  archiveAfterMs: 1000 * 60 * 60 * 24 * 14,
  allowProvisionalUpgrade: true,
});

// ============================================================================
// MARK: Small helpers
// ============================================================================

function freezeArray<T>(input: readonly T[]): readonly T[] {
  return Object.freeze([...input]);
}

function freezeRecord<T extends Record<string, unknown>>(input: T): Readonly<T> {
  return Object.freeze({ ...input });
}

function toUnixMs(value: number | UnixMs | undefined | null): UnixMs {
  return asUnixMs(typeof value === 'number' ? value : Number(value ?? Date.now()));
}

function toSequence(value: number | SequenceNumber | undefined | null): SequenceNumber {
  return asSequenceNumber(typeof value === 'number' ? value : Number(value ?? 0));
}

function uniqueStrings<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function uniqueIds<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values.filter(Boolean))]);
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function sortUnixMsAsc<T extends { createdAt?: UnixMs; updatedAt?: UnixMs }>(values: readonly T[]): readonly T[] {
  return Object.freeze(
    [...values].sort((a, b) => Number(a.updatedAt ?? a.createdAt ?? 0) - Number(b.updatedAt ?? b.createdAt ?? 0)),
  );
}

function pushUnique<T>(base: readonly T[], value: T): readonly T[] {
  return base.includes(value) ? base : Object.freeze([...base, value]);
}

function hashFragment(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, '0');
}

function coerceLegendId(raw: string): ChatLegendId {
  return raw as ChatLegendId;
}

function arrayFromRoomMap<T>(map: Map<string, readonly T[]>, key: string): readonly T[] {
  return map.get(key) ?? Object.freeze([]);
}

function emptyRewardState(): LegendMomentRewardState {
  return Object.freeze({
    eligible: false,
    queued: false,
    granted: false,
    lastQueuedAt: null,
    lastGrantedAt: null,
    rewardClasses: Object.freeze([]),
    rewardHintCount: 0,
    grants: Object.freeze([]),
  });
}

function emptyCallbackState(): LegendMomentCallbackState {
  return Object.freeze({
    replayReady: false,
    callbackReady: false,
    postRunReady: false,
    callbackLabels: Object.freeze([]),
  });
}

function emptyReplayCoverage(): LegendMomentReplayCoverage {
  return Object.freeze({
    replayIds: Object.freeze([]),
    primaryReplayId: null,
    anchorKeys: Object.freeze([]),
    createdFromReplayRange: false,
    sequenceStart: null,
    sequenceEnd: null,
    coverageScore01: null,
  });
}

function emptyMessageCoverage(): LegendMomentMessageCoverage {
  return Object.freeze({
    primaryMessageId: null,
    witnessMessageIds: Object.freeze([]),
    quotedMessageIds: Object.freeze([]),
    causalParentMessageIds: Object.freeze([]),
  });
}

function emptyProofCoverage(): LegendMomentProofCoverage {
  return Object.freeze({
    hashes: Object.freeze([]),
    coveredEdgeCount: 0,
    causalClosureComplete: false,
  });
}

function buildReason(
  code: LegendMomentLedgerReasonCode,
  detail: string,
  metadata: Readonly<Record<string, JsonValue>> = Object.freeze({}),
  at: UnixMs = toUnixMs(Date.now()),
): LegendMomentLedgerReason {
  return Object.freeze({ code, detail, metadata, at });
}

function safeRecord<T>(input: T | null | undefined): T | null {
  return input ?? null;
}

function extractTriggerContext(event: ChatLegendEvent): ChatLegendTriggerContext | null {
  return (event as { triggerContext?: ChatLegendTriggerContext | null }).triggerContext ?? null;
}

function extractOutcomeTags(event: ChatLegendEvent): readonly ChatLegendOutcomeTag[] {
  return uniqueStrings(((event as { outcomeTags?: readonly ChatLegendOutcomeTag[] }).outcomeTags ?? []) as readonly ChatLegendOutcomeTag[]);
}

function extractLegendMetadata(event: ChatLegendEvent): Readonly<Record<string, JsonValue>> {
  return freezeRecord(((event as { metadata?: Readonly<Record<string, JsonValue>> }).metadata ?? {}) as Record<string, JsonValue>);
}

function extractLegendCreatedAt(event: ChatLegendEvent): UnixMs {
  return toUnixMs((event as { createdAt?: UnixMs | number }).createdAt ?? Date.now());
}

function extractRoomId(event: ChatLegendEvent): ChatRoomId {
  const trigger = extractTriggerContext(event);
  const roomId =
    (event as { roomId?: ChatRoomId }).roomId ??
    (trigger as { roomId?: ChatRoomId | null } | null)?.roomId ??
    ('legend-room:unknown' as ChatRoomId);
  return roomId;
}

function extractLegendClass(event: ChatLegendEvent): ChatLegendClass {
  return ((event as { legendClass?: ChatLegendClass; class?: ChatLegendClass }).legendClass ??
    (event as { class?: ChatLegendClass }).class) as ChatLegendClass;
}

function extractLegendTier(event: ChatLegendEvent): ChatLegendTier {
  return ((event as { tier?: ChatLegendTier }).tier ?? 'SIGNATURE') as ChatLegendTier;
}

function extractLegendSeverity(event: ChatLegendEvent): ChatLegendSeverity {
  return ((event as { severity?: ChatLegendSeverity }).severity ?? 'MAJOR') as ChatLegendSeverity;
}

function extractLegendVisibility(event: ChatLegendEvent): ChatLegendVisibility {
  return ((event as { visibility?: ChatLegendVisibility }).visibility ?? 'VISIBLE') as ChatLegendVisibility;
}

function extractLegendArtifacts(event: ChatLegendEvent): readonly ChatLegendArtifact[] {
  return freezeArray(((event as { artifacts?: readonly ChatLegendArtifact[] }).artifacts ?? []) as readonly ChatLegendArtifact[]);
}

function extractLegendWitnesses(event: ChatLegendEvent): readonly ChatLegendWitness[] {
  return freezeArray(((event as { witnesses?: readonly ChatLegendWitness[] }).witnesses ?? []) as readonly ChatLegendWitness[]);
}

function extractLegendReplayLinks(event: ChatLegendEvent): readonly ChatLegendReplayLink[] {
  return freezeArray(((event as { replayLinks?: readonly ChatLegendReplayLink[] }).replayLinks ?? []) as readonly ChatLegendReplayLink[]);
}

function extractLegendRewardHints(event: ChatLegendEvent): readonly ChatLegendRewardHint[] {
  return freezeArray(((event as { rewardHints?: readonly ChatLegendRewardHint[] }).rewardHints ?? []) as readonly ChatLegendRewardHint[]);
}

function extractSequenceWindowFromReplay(artifacts: readonly ChatReplayArtifact[]): {
  readonly start: SequenceNumber | null;
  readonly end: SequenceNumber | null;
} {
  let start: number | null = null;
  let end: number | null = null;
  for (const artifact of artifacts) {
    const artifactStart = Number((artifact.range as { startSequence?: SequenceNumber | number }).startSequence ?? 0);
    const artifactEnd = Number((artifact.range as { endSequence?: SequenceNumber | number }).endSequence ?? 0);
    start = start === null ? artifactStart : Math.min(start, artifactStart);
    end = end === null ? artifactEnd : Math.max(end, artifactEnd);
  }
  return Object.freeze({
    start: start === null ? null : toSequence(start),
    end: end === null ? null : toSequence(end),
  });
}

function coverageScoreFromReplayLinks(
  replayLinks: readonly ChatLegendReplayLink[],
  replayArtifacts: readonly ChatReplayArtifact[],
): Score01 | null {
  const linkCount = replayLinks.length;
  const artifactCount = replayArtifacts.length;
  if (!linkCount && !artifactCount) return null;
  const raw = clampNumber((linkCount * 0.25) + (artifactCount * 0.15), 0, 1);
  return raw as Score01;
}

function derivePrimaryReplayId(
  replayLinks: readonly ChatLegendReplayLink[],
  replayArtifacts: readonly ChatReplayArtifact[],
): ChatReplayId | null {
  const preferred = replayLinks.find((value) => Boolean((value as { replayId?: ChatReplayId | null }).replayId));
  if (preferred && (preferred as { replayId?: ChatReplayId }).replayId) {
    return (preferred as { replayId?: ChatReplayId }).replayId ?? null;
  }
  return replayArtifacts[0]?.id ?? null;
}

function deriveAnchorKeys(
  replayLinks: readonly ChatLegendReplayLink[],
  replayArtifacts: readonly ChatReplayArtifact[],
): readonly string[] {
  const fromLinks = replayLinks
    .map((value) => (value as { anchorKey?: string | null }).anchorKey)
    .filter((value): value is string => Boolean(value));
  const fromArtifacts = replayArtifacts.map((value) => value.anchorKey).filter(Boolean);
  return uniqueStrings([...fromLinks, ...fromArtifacts]);
}

function deriveWitnessMessageIds(
  witnesses: readonly ChatLegendWitness[],
  preferredPrimaryMessageId?: ChatMessageId | null,
): LegendMomentMessageCoverage {
  const witnessMessageIds = uniqueIds(
    witnesses
      .map((value) => (value as { messageId?: ChatMessageId | null }).messageId)
      .filter((value): value is ChatMessageId => Boolean(value)) as readonly ChatMessageId[],
  );
  const quotedMessageIds = uniqueIds(
    witnesses
      .map((value) => (value as { quotedMessageId?: ChatMessageId | null }).quotedMessageId)
      .filter((value): value is ChatMessageId => Boolean(value)) as readonly ChatMessageId[],
  );
  const primaryMessageId = preferredPrimaryMessageId ?? witnessMessageIds[0] ?? null;
  return Object.freeze({
    primaryMessageId,
    witnessMessageIds,
    quotedMessageIds,
    causalParentMessageIds: Object.freeze([]),
  });
}

function deriveRewardClasses(hints: readonly ChatLegendRewardHint[], grants: readonly ChatRewardGrant[]): readonly ChatRewardClass[] {
  const fromHints = hints
    .map((value) => (value as { rewardClass?: ChatRewardClass | null }).rewardClass)
    .filter((value): value is ChatRewardClass => Boolean(value));
  const fromGrants = grants
    .map((value) => (value as { rewardClass?: ChatRewardClass | null }).rewardClass)
    .filter((value): value is ChatRewardClass => Boolean(value));
  return uniqueStrings([...fromHints, ...fromGrants]);
}

function computeCallbackLabels(event: ChatLegendEvent): readonly string[] {
  const labels = [
    extractLegendClass(event),
    extractLegendTier(event),
    extractLegendSeverity(event),
    ...extractOutcomeTags(event),
  ].filter(Boolean) as string[];
  return uniqueStrings(labels);
}

function stableLegendIdForEvent(event: ChatLegendEvent, sourceEventId?: ChatEventId | null): ChatLegendId {
  const trigger = extractTriggerContext(event);
  const roomId = String(extractRoomId(event));
  const legendClass = String(extractLegendClass(event));
  const tier = String(extractLegendTier(event));
  const sequence = String((trigger as { sequenceNumber?: number | SequenceNumber | null } | null)?.sequenceNumber ?? '0');
  const anchorReplay = extractLegendReplayLinks(event)[0];
  const replayId = String((anchorReplay as { replayId?: ChatReplayId | null } | undefined)?.replayId ?? 'none');
  const seed = [roomId, legendClass, tier, sequence, replayId, String(sourceEventId ?? 'none')].join('|');
  return coerceLegendId(`legend:${roomId}:${legendClass}:${hashFragment(seed)}`);
}

function buildLegendRecord(
  legendId: ChatLegendId,
  event: ChatLegendEvent,
  input: LegendMomentAdmitInput,
  status: LegendMomentLedgerStatus,
): LegendMomentRecord {
  const replayArtifacts = freezeArray(input.sourceReplayArtifacts ?? []);
  const replayLinks = extractLegendReplayLinks(event);
  const rewardHints = extractLegendRewardHints(event);
  const witnesses = extractLegendWitnesses(event);
  const grants = Object.freeze([]) as readonly ChatRewardGrant[];
  const sequenceWindow = extractSequenceWindowFromReplay(replayArtifacts);
  const createdAt = extractLegendCreatedAt(event);
  const messages = deriveWitnessMessageIds(witnesses, input.preferredPrimaryMessageId ?? null);
  const replayCoverage: LegendMomentReplayCoverage = Object.freeze({
    replayIds: uniqueIds([
      ...replayArtifacts.map((value) => value.id),
      ...replayLinks
        .map((value) => (value as { replayId?: ChatReplayId | null }).replayId)
        .filter((value): value is ChatReplayId => Boolean(value)),
    ]),
    primaryReplayId: derivePrimaryReplayId(replayLinks, replayArtifacts),
    anchorKeys: deriveAnchorKeys(replayLinks, replayArtifacts),
    createdFromReplayRange: replayArtifacts.length > 0,
    sequenceStart: sequenceWindow.start,
    sequenceEnd: sequenceWindow.end,
    coverageScore01: coverageScoreFromReplayLinks(replayLinks, replayArtifacts),
  });

  const proofEdges = freezeArray(input.sourceProofEdges ?? []);
  const proofHashes = uniqueIds(
    proofEdges.map((value) => value.hash).filter(Boolean) as readonly ChatProofHash[],
  );
  const rewardClasses = deriveRewardClasses(rewardHints, grants);
  const callbackLabels = computeCallbackLabels(event);

  return Object.freeze({
    legendId,
    roomId: extractRoomId(event),
    roomSequence: Number((extractTriggerContext(event) as { sequenceNumber?: number | SequenceNumber | null } | null)?.sequenceNumber ?? 0),
    createdAt,
    updatedAt: createdAt,
    status,
    legendClass: extractLegendClass(event),
    tier: extractLegendTier(event),
    severity: extractLegendSeverity(event),
    visibility: extractLegendVisibility(event),
    outcomeTags: extractOutcomeTags(event),
    acceptedEvent: event,
    triggerContext: extractTriggerContext(event),
    replay: replayCoverage,
    messages: Object.freeze({
      ...messages,
      causalParentMessageIds: freezeArray(
        proofEdges
          .map((value) => value.fromMessageId)
          .filter((value): value is ChatMessageId => Boolean(value)),
      ),
    }),
    proof: Object.freeze({
      hashes: proofHashes,
      coveredEdgeCount: proofEdges.length,
      causalClosureComplete: proofEdges.length > 0,
    }),
    reward: Object.freeze({
      eligible: rewardHints.length > 0,
      queued: false,
      granted: false,
      lastQueuedAt: null,
      lastGrantedAt: null,
      rewardClasses,
      rewardHintCount: rewardHints.length,
      grants,
    }),
    callback: Object.freeze({
      replayReady: replayCoverage.replayIds.length > 0,
      callbackReady: callbackLabels.length > 0,
      postRunReady: true,
      callbackLabels,
    }),
    witnessCount: witnesses.length,
    artifactCount: extractLegendArtifacts(event).length,
    reasons: Object.freeze([
      buildReason('NEW_EVENT_ACCEPTED', 'Legend event admitted into authoritative ledger.'),
      buildReason('ROOM_PRESTIGE_UPDATED', 'Room prestige will be recomputed.'),
      ...(replayCoverage.replayIds.length > 0
        ? [buildReason('REPLAY_LINKED', 'Legend arrived with replay linkage.')] : []),
      ...(rewardHints.length > 0
        ? [buildReason('REWARD_HINT_STAGED', 'Legend arrived with reward hints.')] : []),
      ...(callbackLabels.length > 0
        ? [buildReason('CALLBACK_READY', 'Legend carries callback labels.')] : []),
      buildReason('POSTRUN_READY', 'Legend is available to post-run narrative layers.'),
    ]),
    metadata: freezeRecord({
      ...extractLegendMetadata(event),
      ...(input.metadata ?? {}),
      legendId,
      roomId: extractRoomId(event),
      roomSequence: Number((extractTriggerContext(event) as { sequenceNumber?: number | SequenceNumber | null } | null)?.sequenceNumber ?? 0),
    }),
  });
}

function mergeLegendRecord(
  previous: LegendMomentRecord,
  nextEvent: ChatLegendEvent,
  input: LegendMomentAdmitInput,
  config: LegendMomentLedgerConfig,
): LegendMomentRecord {
  const now = extractLegendCreatedAt(nextEvent);
  const previousRewardHints = extractLegendRewardHints(previous.acceptedEvent);
  const nextRewardHints = extractLegendRewardHints(nextEvent);
  const rewardHints = freezeArray([...previousRewardHints, ...nextRewardHints]);
  const mergedGrants = previous.reward.grants;
  const rewardClasses = deriveRewardClasses(rewardHints, mergedGrants);
  const mergedReplayArtifacts = freezeArray([
    ...(input.sourceReplayArtifacts ?? []),
  ]);
  const nextReplayLinks = extractLegendReplayLinks(nextEvent);
  const sequenceWindow = extractSequenceWindowFromReplay(mergedReplayArtifacts);
  const replayIds = uniqueIds([
    ...previous.replay.replayIds,
    ...mergedReplayArtifacts.map((value) => value.id),
    ...nextReplayLinks
      .map((value) => (value as { replayId?: ChatReplayId | null }).replayId)
      .filter((value): value is ChatReplayId => Boolean(value)),
  ]);
  const primaryReplayId = previous.replay.primaryReplayId ?? derivePrimaryReplayId(nextReplayLinks, mergedReplayArtifacts);
  const anchorKeys = uniqueStrings([
    ...previous.replay.anchorKeys,
    ...deriveAnchorKeys(nextReplayLinks, mergedReplayArtifacts),
  ]);
  const witnesses = freezeArray([
    ...extractLegendWitnesses(previous.acceptedEvent),
    ...extractLegendWitnesses(nextEvent),
  ]);
  const messages = deriveWitnessMessageIds(witnesses, previous.messages.primaryMessageId ?? input.preferredPrimaryMessageId ?? null);
  const proofEdges = freezeArray(input.sourceProofEdges ?? []);
  const proofHashes = uniqueIds([
    ...previous.proof.hashes,
    ...proofEdges.map((value) => value.hash),
  ] as readonly ChatProofHash[]);
  const outcomeTags = uniqueStrings([
    ...previous.outcomeTags,
    ...extractOutcomeTags(nextEvent),
  ] as readonly ChatLegendOutcomeTag[]);
  const callbackLabels = uniqueStrings([
    ...previous.callback.callbackLabels,
    ...computeCallbackLabels(nextEvent),
  ]);
  const mergedReasons = Object.freeze([
    ...previous.reasons,
    buildReason('EXISTING_EVENT_MERGED', 'Legend event merged into an existing prestige record.', {
      previousLegendId: previous.legendId,
      mergedAt: now,
    }),
    ...(replayIds.length > previous.replay.replayIds.length
      ? [buildReason('REPLAY_LINKED', 'Merged event expanded replay linkage.')] : []),
    ...(rewardHints.length > previous.reward.rewardHintCount
      ? [buildReason('REWARD_HINT_STAGED', 'Merged event expanded reward hints.')] : []),
    ...(callbackLabels.length > previous.callback.callbackLabels.length
      ? [buildReason('CALLBACK_READY', 'Merged event expanded callback labels.')] : []),
  ].slice(-config.maxReasonsPerLegend));

  const upgradedStatus: LegendMomentLedgerStatus =
    previous.status === 'PROVISIONAL' && config.allowProvisionalUpgrade
      ? 'CONFIRMED'
      : previous.status;

  return Object.freeze({
    ...previous,
    updatedAt: now,
    status: upgradedStatus,
    tier: previous.tier,
    severity: previous.severity,
    visibility: previous.visibility,
    outcomeTags,
    acceptedEvent: nextEvent,
    triggerContext: extractTriggerContext(nextEvent) ?? previous.triggerContext,
    replay: Object.freeze({
      replayIds,
      primaryReplayId,
      anchorKeys,
      createdFromReplayRange: previous.replay.createdFromReplayRange || mergedReplayArtifacts.length > 0,
      sequenceStart: previous.replay.sequenceStart ?? sequenceWindow.start,
      sequenceEnd: previous.replay.sequenceEnd ?? sequenceWindow.end,
      coverageScore01: previous.replay.coverageScore01 ?? coverageScoreFromReplayLinks(nextReplayLinks, mergedReplayArtifacts),
    }),
    messages: Object.freeze({
      primaryMessageId: previous.messages.primaryMessageId ?? messages.primaryMessageId,
      witnessMessageIds: uniqueIds([...previous.messages.witnessMessageIds, ...messages.witnessMessageIds]),
      quotedMessageIds: uniqueIds([...previous.messages.quotedMessageIds, ...messages.quotedMessageIds]),
      causalParentMessageIds: uniqueIds([
        ...previous.messages.causalParentMessageIds,
        ...proofEdges.map((value) => value.fromMessageId).filter((value): value is ChatMessageId => Boolean(value)),
      ]),
    }),
    proof: Object.freeze({
      hashes: proofHashes.slice(0, config.maxProofHashesPerLegend),
      coveredEdgeCount: previous.proof.coveredEdgeCount + proofEdges.length,
      causalClosureComplete: previous.proof.causalClosureComplete || proofEdges.length > 0,
    }),
    reward: Object.freeze({
      ...previous.reward,
      eligible: previous.reward.eligible || rewardHints.length > 0,
      rewardClasses,
      rewardHintCount: rewardHints.length,
    }),
    callback: Object.freeze({
      replayReady: replayIds.length > 0,
      callbackReady: callbackLabels.length > 0,
      postRunReady: previous.callback.postRunReady,
      callbackLabels,
    }),
    witnessCount: uniqueIds([...previous.messages.witnessMessageIds, ...messages.witnessMessageIds]).length,
    artifactCount: extractLegendArtifacts(previous.acceptedEvent).length + extractLegendArtifacts(nextEvent).length,
    reasons: mergedReasons,
    metadata: freezeRecord({
      ...previous.metadata,
      ...extractLegendMetadata(nextEvent),
      mergedAt: now,
      mergedReplayCount: replayIds.length,
    }),
  });
}

function buildRoomPrestigeState(roomId: ChatRoomId, records: readonly LegendMomentRecord[]): LegendMomentRoomPrestigeState {
  const confirmed = records.filter((value) => value.status !== 'PROVISIONAL' && value.status !== 'REVOKED');
  const granted = records.filter((value) => value.reward.granted);
  const archived = records.filter((value) => value.status === 'ARCHIVED');
  const revoked = records.filter((value) => value.status === 'REVOKED');
  const scoreByClass: Record<string, number> = {};
  for (const record of records) {
    scoreByClass[String(record.legendClass)] = (scoreByClass[String(record.legendClass)] ?? 0) + 1;
  }
  const sorted = sortUnixMsAsc(records);
  const active = [...sorted].reverse().find((value) => value.status !== 'ARCHIVED' && value.status !== 'REVOKED');
  const lastSorted = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const grantedSorted = sortUnixMsAsc(granted);
  const lastGranted = grantedSorted.length > 0 ? grantedSorted[grantedSorted.length - 1] : null;
  return Object.freeze({
    roomId,
    legendIds: freezeArray(records.map((value) => value.legendId)),
    confirmedCount: confirmed.length,
    grantedCount: granted.length,
    archivedCount: archived.length,
    revokedCount: revoked.length,
    scoreByClass: freezeRecord(scoreByClass),
    lastLegendAt: lastSorted?.updatedAt ?? null,
    lastGrantedAt: lastGranted?.reward.lastGrantedAt ?? null,
    activeLegendId: active?.legendId ?? null,
    replayReadyLegendIds: freezeArray(records.filter((value) => value.callback.replayReady).map((value) => value.legendId)),
    callbackReadyLegendIds: freezeArray(records.filter((value) => value.callback.callbackReady).map((value) => value.legendId)),
    postRunReadyLegendIds: freezeArray(records.filter((value) => value.callback.postRunReady).map((value) => value.legendId)),
  });
}

function isPotentialDuplicate(
  existing: LegendMomentRecord,
  incoming: ChatLegendEvent,
  dedupeWindowMs: number,
): boolean {
  if (existing.roomId !== extractRoomId(incoming)) return false;
  if (existing.legendClass !== extractLegendClass(incoming)) return false;
  const delta = Math.abs(Number(existing.updatedAt) - Number(extractLegendCreatedAt(incoming)));
  if (delta > dedupeWindowMs) return false;
  const existingReplay = existing.replay.primaryReplayId;
  const incomingReplay = derivePrimaryReplayId(extractLegendReplayLinks(incoming), Object.freeze([]));
  if (existingReplay && incomingReplay && existingReplay === incomingReplay) return true;
  const existingMessage = existing.messages.primaryMessageId;
  const incomingMessage = deriveWitnessMessageIds(extractLegendWitnesses(incoming), null).primaryMessageId;
  if (existingMessage && incomingMessage && existingMessage === incomingMessage) return true;
  return existing.legendClass === extractLegendClass(incoming) && delta <= dedupeWindowMs;
}

// ============================================================================
// MARK: Ledger implementation
// ============================================================================

export class LegendMomentLedger {
  private readonly config: LegendMomentLedgerConfig;

  private readonly byId = new Map<ChatLegendId, LegendMomentRecord>();

  private readonly byRoom = new Map<ChatRoomId, readonly ChatLegendId[]>();

  private readonly byReplayId = new Map<ChatReplayId, readonly ChatLegendId[]>();

  private readonly byMessageId = new Map<ChatMessageId, readonly ChatLegendId[]>();

  private readonly roomPrestige = new Map<ChatRoomId, LegendMomentRoomPrestigeState>();

  public constructor(config: Partial<LegendMomentLedgerConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_LEGEND_MOMENT_LEDGER_CONFIG,
      ...config,
    });
  }

  public getConfig(): LegendMomentLedgerConfig {
    return this.config;
  }

  public size(): number {
    return this.byId.size;
  }

  public admitLegend(input: LegendMomentAdmitInput): LegendMomentAdmitResult {
    const event = input.legendEvent;
    const roomId = extractRoomId(event);
    const existing = this.findPotentialDuplicate(roomId, event);
    let record: LegendMomentRecord;
    let created = false;
    let merged = false;

    if (existing) {
      record = mergeLegendRecord(existing, event, input, this.config);
      merged = true;
    } else {
      const legendId = stableLegendIdForEvent(event, input.sourceEventId ?? null);
      const initialStatus: LegendMomentLedgerStatus = extractLegendVisibility(event) === 'PUBLIC' ? 'CONFIRMED' : 'PROVISIONAL';
      record = buildLegendRecord(legendId, event, input, initialStatus);
      created = true;
    }

    this.storeRecord(record);
    const prestige = this.recomputeRoomPrestige(roomId);
    return Object.freeze({ record, created, merged, roomPrestige: prestige });
  }

  public confirmLegend(legendId: ChatLegendId, confirmedAt: UnixMs = toUnixMs(Date.now())): LegendMomentRecord | null {
    const existing = this.byId.get(legendId) ?? null;
    if (!existing) return null;
    if (existing.status !== 'PROVISIONAL') return existing;
    const updated: LegendMomentRecord = Object.freeze({
      ...existing,
      status: 'CONFIRMED',
      updatedAt: confirmedAt,
      reasons: freezeArray([
        ...existing.reasons,
        buildReason('SCORE_UPGRADED', 'Provisional prestige record promoted to confirmed.', { confirmedAt }),
      ].slice(-this.config.maxReasonsPerLegend)),
    });
    this.storeRecord(updated);
    this.recomputeRoomPrestige(updated.roomId);
    return updated;
  }

  public queueForReward(legendId: ChatLegendId, queuedAt: UnixMs = toUnixMs(Date.now())): LegendMomentRecord | null {
    const existing = this.byId.get(legendId) ?? null;
    if (!existing) return null;
    const updated: LegendMomentRecord = Object.freeze({
      ...existing,
      status: existing.status === 'GRANTED' ? existing.status : 'GRANT_QUEUED',
      updatedAt: queuedAt,
      reward: Object.freeze({
        ...existing.reward,
        queued: true,
        eligible: true,
        lastQueuedAt: queuedAt,
      }),
      reasons: freezeArray([
        ...existing.reasons,
        buildReason('REWARD_HINT_STAGED', 'Legend queued for downstream reward grant resolution.', { queuedAt }),
      ].slice(-this.config.maxReasonsPerLegend)),
    });
    this.storeRecord(updated);
    this.recomputeRoomPrestige(updated.roomId);
    return updated;
  }

  public attachRewardGrants(input: LegendMomentRewardGrantInput): LegendMomentRecord | null {
    const existing = this.byId.get(input.legendId) ?? null;
    if (!existing) return null;
    const grantedAt = input.grantedAt ?? toUnixMs(Date.now());
    const rewardClasses = deriveRewardClasses(extractLegendRewardHints(existing.acceptedEvent), input.grants);
    const updated: LegendMomentRecord = Object.freeze({
      ...existing,
      status: 'GRANTED',
      updatedAt: grantedAt,
      reward: Object.freeze({
        eligible: true,
        queued: true,
        granted: input.grants.length > 0,
        lastQueuedAt: existing.reward.lastQueuedAt ?? grantedAt,
        lastGrantedAt: input.grants.length > 0 ? grantedAt : existing.reward.lastGrantedAt,
        rewardClasses,
        rewardHintCount: existing.reward.rewardHintCount,
        grants: freezeArray(input.grants),
      }),
      reasons: freezeArray([
        ...existing.reasons,
        buildReason('REWARD_GRANTED', 'Reward grants attached to authoritative legend record.', {
          grantCount: input.grants.length,
          grantedAt,
        }),
      ].slice(-this.config.maxReasonsPerLegend)),
    });
    this.storeRecord(updated);
    this.recomputeRoomPrestige(updated.roomId);
    return updated;
  }

  public revokeRewardGrants(legendId: ChatLegendId, revokedAt: UnixMs = toUnixMs(Date.now())): LegendMomentRecord | null {
    const existing = this.byId.get(legendId) ?? null;
    if (!existing) return null;
    const updated: LegendMomentRecord = Object.freeze({
      ...existing,
      updatedAt: revokedAt,
      reward: Object.freeze({
        ...existing.reward,
        queued: false,
        granted: false,
        grants: Object.freeze([]),
      }),
      reasons: freezeArray([
        ...existing.reasons,
        buildReason('REWARD_REVOKED', 'Reward grants revoked from authoritative legend record.', { revokedAt }),
      ].slice(-this.config.maxReasonsPerLegend)),
    });
    this.storeRecord(updated);
    this.recomputeRoomPrestige(updated.roomId);
    return updated;
  }

  public attachReplayArtifacts(input: LegendMomentReplayLinkInput): LegendMomentRecord | null {
    const existing = this.byId.get(input.legendId) ?? null;
    if (!existing) return null;
    const linkedAt = input.linkedAt ?? toUnixMs(Date.now());
    const replayIds = uniqueIds([...existing.replay.replayIds, ...input.replayArtifacts.map((value) => value.id)]);
    const sequenceWindow = extractSequenceWindowFromReplay(input.replayArtifacts);
    const updated: LegendMomentRecord = Object.freeze({
      ...existing,
      updatedAt: linkedAt,
      replay: Object.freeze({
        replayIds,
        primaryReplayId: existing.replay.primaryReplayId ?? input.replayArtifacts[0]?.id ?? null,
        anchorKeys: uniqueStrings([...existing.replay.anchorKeys, ...input.replayArtifacts.map((value) => value.anchorKey)]),
        createdFromReplayRange: true,
        sequenceStart: existing.replay.sequenceStart ?? sequenceWindow.start,
        sequenceEnd: existing.replay.sequenceEnd ?? sequenceWindow.end,
        coverageScore01: existing.replay.coverageScore01 ?? coverageScoreFromReplayLinks(Object.freeze([]), input.replayArtifacts),
      }),
      callback: Object.freeze({
        ...existing.callback,
        replayReady: replayIds.length > 0,
      }),
      reasons: freezeArray([
        ...existing.reasons,
        buildReason('REPLAY_LINKED', 'Replay artifacts linked to legend record.', {
          replayCount: input.replayArtifacts.length,
          linkedAt,
        }),
      ].slice(-this.config.maxReasonsPerLegend)),
    });
    this.storeRecord(updated);
    this.recomputeRoomPrestige(updated.roomId);
    return updated;
  }

  public archiveLegend(legendId: ChatLegendId, archivedAt: UnixMs = toUnixMs(Date.now())): LegendMomentRecord | null {
    const existing = this.byId.get(legendId) ?? null;
    if (!existing) return null;
    const updated: LegendMomentRecord = Object.freeze({
      ...existing,
      status: 'ARCHIVED',
      updatedAt: archivedAt,
      reasons: freezeArray([
        ...existing.reasons,
        buildReason('ARCHIVED_BY_POLICY', 'Legend archived by retention or run-completion policy.', { archivedAt }),
      ].slice(-this.config.maxReasonsPerLegend)),
    });
    this.storeRecord(updated);
    this.recomputeRoomPrestige(updated.roomId);
    return updated;
  }

  public revokeLegend(legendId: ChatLegendId, revokedAt: UnixMs = toUnixMs(Date.now())): LegendMomentRecord | null {
    const existing = this.byId.get(legendId) ?? null;
    if (!existing) return null;
    const updated: LegendMomentRecord = Object.freeze({
      ...existing,
      status: 'REVOKED',
      updatedAt: revokedAt,
      reward: Object.freeze({
        ...existing.reward,
        queued: false,
        granted: false,
        grants: Object.freeze([]),
      }),
      reasons: freezeArray([
        ...existing.reasons,
        buildReason('REVOKED_BY_POLICY', 'Legend revoked due to backend policy or later invalidation.', { revokedAt }),
      ].slice(-this.config.maxReasonsPerLegend)),
    });
    this.storeRecord(updated);
    this.recomputeRoomPrestige(updated.roomId);
    return updated;
  }

  public listByRoom(roomId: ChatRoomId, includeArchived = true): readonly LegendMomentRecord[] {
    const ids = arrayFromRoomMap(this.byRoom, roomId);
    const records = ids.map((value) => this.byId.get(value)).filter((value): value is LegendMomentRecord => Boolean(value));
    const filtered = includeArchived ? records : records.filter((value) => value.status !== 'ARCHIVED' && value.status !== 'REVOKED');
    return sortUnixMsAsc(filtered);
  }

  public listByReplayId(replayId: ChatReplayId): readonly LegendMomentRecord[] {
    const ids = arrayFromRoomMap(this.byReplayId, replayId);
    return sortUnixMsAsc(ids.map((value) => this.byId.get(value)).filter((value): value is LegendMomentRecord => Boolean(value)));
  }

  public listByMessageId(messageId: ChatMessageId): readonly LegendMomentRecord[] {
    const ids = arrayFromRoomMap(this.byMessageId, messageId);
    return sortUnixMsAsc(ids.map((value) => this.byId.get(value)).filter((value): value is LegendMomentRecord => Boolean(value)));
  }

  public listEligibleForRewardGrant(roomId?: ChatRoomId): readonly LegendMomentRecord[] {
    const values = roomId ? this.listByRoom(roomId) : sortUnixMsAsc([...this.byId.values()]);
    return Object.freeze(values.filter((value) => value.reward.eligible && !value.reward.granted));
  }

  public listCallbackReady(roomId?: ChatRoomId): readonly LegendMomentRecord[] {
    const values = roomId ? this.listByRoom(roomId) : sortUnixMsAsc([...this.byId.values()]);
    return Object.freeze(values.filter((value) => value.callback.callbackReady));
  }

  public listReplayReady(roomId?: ChatRoomId): readonly LegendMomentRecord[] {
    const values = roomId ? this.listByRoom(roomId) : sortUnixMsAsc([...this.byId.values()]);
    return Object.freeze(values.filter((value) => value.callback.replayReady));
  }

  public getRoomPrestigeState(roomId: ChatRoomId): LegendMomentRoomPrestigeState {
    return this.roomPrestige.get(roomId) ?? buildRoomPrestigeState(roomId, Object.freeze([]));
  }

  public getById(legendId: ChatLegendId): LegendMomentRecord | null {
    return this.byId.get(legendId) ?? null;
  }

  public buildReplayPrestigeBundle(roomId: ChatRoomId): Readonly<{
    roomId: ChatRoomId;
    activeLegendId: ChatLegendId | null;
    replayReady: readonly LegendMomentRecord[];
    callbackReady: readonly LegendMomentRecord[];
    rewardReady: readonly LegendMomentRecord[];
  }> {
    const roomRecords = this.listByRoom(roomId, false);
    return Object.freeze({
      roomId,
      activeLegendId: this.getRoomPrestigeState(roomId).activeLegendId,
      replayReady: freezeArray(roomRecords.filter((value) => value.callback.replayReady)),
      callbackReady: freezeArray(roomRecords.filter((value) => value.callback.callbackReady)),
      rewardReady: freezeArray(roomRecords.filter((value) => value.reward.eligible && !value.reward.granted)),
    });
  }

  public buildSnapshot(): LegendMomentLedgerSnapshot {
    const byRoom: Record<ChatRoomId, readonly LegendMomentRecord[]> = {} as Record<ChatRoomId, readonly LegendMomentRecord[]>;
    for (const [roomId] of this.byRoom.entries()) {
      byRoom[roomId] = this.listByRoom(roomId);
    }
    const byId = Object.fromEntries(this.byId.entries()) as Record<ChatLegendId, LegendMomentRecord>;
    const roomPrestige = Object.fromEntries(this.roomPrestige.entries()) as Record<ChatRoomId, LegendMomentRoomPrestigeState>;
    return Object.freeze({
      byId: freezeRecord(byId),
      byRoom: freezeRecord(byRoom),
      roomPrestige: freezeRecord(roomPrestige),
    });
  }

  public archiveExpired(referenceNow: UnixMs = toUnixMs(Date.now())): readonly LegendMomentRecord[] {
    const archived: LegendMomentRecord[] = [];
    for (const record of this.byId.values()) {
      if (record.status === 'ARCHIVED' || record.status === 'REVOKED') continue;
      if (Number(referenceNow) - Number(record.updatedAt) < this.config.archiveAfterMs) continue;
      const archivedRecord = this.archiveLegend(record.legendId, referenceNow);
      if (archivedRecord) archived.push(archivedRecord);
    }
    return Object.freeze(archived);
  }

  public queryByClass(legendClass: ChatLegendClass, roomId?: ChatRoomId): readonly LegendMomentRecord[] {
    const values = roomId ? this.listByRoom(roomId) : sortUnixMsAsc([...this.byId.values()]);
    return Object.freeze(values.filter((value) => value.legendClass === legendClass));
  }

  public auditIntegrity(): readonly LegendMomentIntegrityIssue[] {
    const issues: LegendMomentIntegrityIssue[] = [];

    for (const [legendId, record] of this.byId.entries()) {
      const roomIndex = this.byRoom.get(record.roomId) ?? Object.freeze([]);
      if (!roomIndex.includes(legendId)) {
        issues.push({
          code: 'MISSING_ROOM_INDEX',
          legendId,
          roomId: record.roomId,
          detail: 'Legend record exists in byId but is missing from byRoom index.',
        });
      }

      for (const replayId of record.replay.replayIds) {
        const replayIndex = this.byReplayId.get(replayId) ?? Object.freeze([]);
        if (!replayIndex.includes(legendId)) {
          issues.push({
            code: 'REPLAY_INDEX_DRIFT',
            legendId,
            roomId: record.roomId,
            detail: `Legend record exists but replay index is missing replay=${String(replayId)}.`,
          });
        }
      }

      for (const messageId of record.messages.witnessMessageIds) {
        const messageIndex = this.byMessageId.get(messageId) ?? Object.freeze([]);
        if (!messageIndex.includes(legendId)) {
          issues.push({
            code: 'MESSAGE_INDEX_DRIFT',
            legendId,
            roomId: record.roomId,
            detail: `Legend record exists but message index is missing message=${String(messageId)}.`,
          });
        }
      }

      if (record.reward.granted && record.reward.grants.length === 0) {
        issues.push({
          code: 'INVALID_REWARD_STATE',
          legendId,
          roomId: record.roomId,
          detail: 'Legend marked granted but grant list is empty.',
        });
      }

      if (record.callback.replayReady && record.replay.replayIds.length === 0) {
        issues.push({
          code: 'INVALID_REPLAY_LINK',
          legendId,
          roomId: record.roomId,
          detail: 'Legend marked replay-ready but replayIds are empty.',
        });
      }
    }

    for (const [roomId, prestige] of this.roomPrestige.entries()) {
      const rebuilt = buildRoomPrestigeState(roomId, this.listByRoom(roomId));
      if (prestige.confirmedCount != rebuilt.confirmedCount || prestige.grantedCount != rebuilt.grantedCount) {
        issues.push({
          code: 'PRESTIGE_STATE_DRIFT',
          legendId: null,
          roomId,
          detail: 'Cached room prestige state differs from rebuilt counts.',
        });
      }
    }

    return Object.freeze(issues);
  }

  public repairIntegrity(): readonly LegendMomentIntegrityIssue[] {
    const issues = this.auditIntegrity();
    for (const [roomId] of this.byRoom.entries()) {
      this.recomputeRoomPrestige(roomId);
    }
    return issues;
  }

  private storeRecord(record: LegendMomentRecord): void {
    this.byId.set(record.legendId, record);
    this.reindexRoom(record.roomId);
    this.reindexReplays(record.legendId, record.replay.replayIds);
    this.reindexMessages(record.legendId, record.messages.witnessMessageIds);
  }

  private reindexRoom(roomId: ChatRoomId): void {
    const records = sortUnixMsAsc(
      [...this.byId.values()].filter((value) => value.roomId === roomId),
    ).slice(-this.config.maxLegendsPerRoom);
    this.byRoom.set(roomId, freezeArray(records.map((value) => value.legendId)));
    this.roomPrestige.set(roomId, buildRoomPrestigeState(roomId, records));
  }

  private reindexReplays(legendId: ChatLegendId, replayIds: readonly ChatReplayId[]): void {
    for (const [replayId, ids] of this.byReplayId.entries()) {
      if (ids.includes(legendId) && !replayIds.includes(replayId)) {
        this.byReplayId.set(replayId, freezeArray(ids.filter((value) => value !== legendId)));
      }
    }
    for (const replayId of replayIds) {
      const existing = this.byReplayId.get(replayId) ?? Object.freeze([]);
      this.byReplayId.set(replayId, pushUnique(existing, legendId));
    }
  }

  private reindexMessages(legendId: ChatLegendId, messageIds: readonly ChatMessageId[]): void {
    for (const [messageId, ids] of this.byMessageId.entries()) {
      if (ids.includes(legendId) && !messageIds.includes(messageId)) {
        this.byMessageId.set(messageId, freezeArray(ids.filter((value) => value !== legendId)));
      }
    }
    for (const messageId of messageIds) {
      const existing = this.byMessageId.get(messageId) ?? Object.freeze([]);
      this.byMessageId.set(messageId, pushUnique(existing, legendId));
    }
  }

  private recomputeRoomPrestige(roomId: ChatRoomId): LegendMomentRoomPrestigeState {
    const records = sortUnixMsAsc(
      (this.byRoom.get(roomId) ?? Object.freeze([]))
        .map((value) => this.byId.get(value))
        .filter((value): value is LegendMomentRecord => Boolean(value)),
    );
    const prestige = buildRoomPrestigeState(roomId, records);
    this.roomPrestige.set(roomId, prestige);
    return prestige;
  }

  private findPotentialDuplicate(roomId: ChatRoomId, event: ChatLegendEvent): LegendMomentRecord | null {
    const roomRecords = this.listByRoom(roomId);
    for (let index = roomRecords.length - 1; index >= 0; index -= 1) {
      const candidate = roomRecords[index];
      if (isPotentialDuplicate(candidate, event, this.config.dedupeWindowMs)) {
        return candidate;
      }
    }
    return null;
  }
}

// ============================================================================
// MARK: Thin creation helpers
// ============================================================================

export function createLegendMomentLedger(
  config: Partial<LegendMomentLedgerConfig> = {},
): LegendMomentLedger {
  return new LegendMomentLedger(config);
}

export function buildLegendMomentLedgerSnapshot(
  ledger: LegendMomentLedger,
): LegendMomentLedgerSnapshot {
  return ledger.buildSnapshot();
}

// ============================================================================
// MARK: Module manifest
// ============================================================================

export const BACKEND_CHAT_LEGEND_MOMENT_LEDGER_MODULE_NAME = 'PZO_BACKEND_CHAT_LEGEND_MOMENT_LEDGER' as const;

export const BACKEND_CHAT_LEGEND_MOMENT_LEDGER_MANIFEST = Object.freeze({
  moduleName: BACKEND_CHAT_LEGEND_MOMENT_LEDGER_MODULE_NAME,
  version: '1.0.0',
  path: '/backend/src/game/engine/chat/rewards/LegendMomentLedger.ts',
  authorities: Object.freeze({
    backendChatRoot: '/backend/src/game/engine/chat',
    backendRewardsRoot: '/backend/src/game/engine/chat/rewards',
    replayRoot: '/backend/src/game/engine/chat/replay',
    sharedLegendContract: '/shared/contracts/chat/ChatLegend.ts',
    sharedRewardContract: '/shared/contracts/chat/ChatReward.ts',
  }),
  owns: Object.freeze([
    'authoritative legend admission',
    'prestige lifecycle state',
    'room prestige caches',
    'legend reward queue staging',
    'replay/message/proof prestige linkage',
    'legend ledger integrity audit',
  ] as const),
  dependsOn: Object.freeze([
    '../types',
    '../ChatTranscriptLedger',
    '../ChatProofChain',
    '../ChatSceneArchiveService',
    '../replay/ChatReplayAssembler',
    '../replay/ChatReplayIndex',
    './RewardGrantResolver',
    './ReplayMomentIndexer',
    '../../../../../../shared/contracts/chat/ChatLegend',
    '../../../../../../shared/contracts/chat/ChatReward',
  ] as const),
} as const);

export const ChatLegendMomentLedgerModule = Object.freeze({
  moduleName: BACKEND_CHAT_LEGEND_MOMENT_LEDGER_MODULE_NAME,
  manifest: BACKEND_CHAT_LEGEND_MOMENT_LEDGER_MANIFEST,
  defaults: DEFAULT_LEGEND_MOMENT_LEDGER_CONFIG,
  createLegendMomentLedger,
  buildLegendMomentLedgerSnapshot,
  LegendMomentLedger,
} as const);

// ============================================================================
// MARK: Prestige scoring
// ============================================================================

export type LegendPrestigeBand =
  | 'APEX'
  | 'ELITE'
  | 'DISTINGUISHED'
  | 'NOTABLE'
  | 'EMERGING'
  | 'PROVISIONAL';

export interface LegendPrestigeScore {
  readonly legendId: ChatLegendId;
  readonly roomId: ChatRoomId;
  readonly rawScore: number;
  readonly normalizedScore01: number;
  readonly band: LegendPrestigeBand;
  readonly tierWeight: number;
  readonly severityWeight: number;
  readonly replayBonus: number;
  readonly rewardBonus: number;
  readonly witnessBonus: number;
}

const TIER_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  PLATINUM: 1.0,
  GOLD: 0.82,
  SILVER: 0.62,
  BRONZE: 0.42,
  SIGNATURE: 0.72,
  ICON: 0.90,
});

const SEVERITY_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  CRITICAL: 1.0,
  MAJOR: 0.75,
  MODERATE: 0.52,
  MINOR: 0.28,
});

function derivePrestigeBand(score01: number): LegendPrestigeBand {
  if (score01 >= 0.90) return 'APEX';
  if (score01 >= 0.72) return 'ELITE';
  if (score01 >= 0.52) return 'DISTINGUISHED';
  if (score01 >= 0.34) return 'NOTABLE';
  if (score01 >= 0.16) return 'EMERGING';
  return 'PROVISIONAL';
}

export function scoreLegendMoment(record: LegendMomentRecord): LegendPrestigeScore {
  const tierWeight = TIER_WEIGHTS[String(record.tier)] ?? 0.5;
  const severityWeight = SEVERITY_WEIGHTS[String(record.severity)] ?? 0.5;
  const replayBonus = Math.min(0.20, record.replay.replayIds.length * 0.06);
  const rewardBonus = record.reward.granted ? 0.18 : record.reward.eligible ? 0.08 : 0;
  const witnessBonus = Math.min(0.12, record.witnessCount * 0.03);
  const proofBonus = record.proof.causalClosureComplete ? 0.06 : 0;
  const rawScore = (tierWeight * 0.40) + (severityWeight * 0.30) + replayBonus + rewardBonus + witnessBonus + proofBonus;
  const normalizedScore01 = Math.max(0, Math.min(1, rawScore));
  return Object.freeze({
    legendId: record.legendId,
    roomId: record.roomId,
    rawScore,
    normalizedScore01,
    band: derivePrestigeBand(normalizedScore01),
    tierWeight,
    severityWeight,
    replayBonus,
    rewardBonus,
    witnessBonus,
  });
}

export function scoreAllLegendsInRoom(
  ledger: LegendMomentLedger,
  roomId: ChatRoomId,
): readonly LegendPrestigeScore[] {
  return freezeArray(
    ledger.listByRoom(roomId, false).map(scoreLegendMoment).sort((a, b) => b.normalizedScore01 - a.normalizedScore01),
  );
}

export function topScoredLegendsInRoom(
  ledger: LegendMomentLedger,
  roomId: ChatRoomId,
  topN: number,
): readonly LegendPrestigeScore[] {
  return freezeArray(scoreAllLegendsInRoom(ledger, roomId).slice(0, topN));
}

// ============================================================================
// MARK: Snapshot diff and comparison
// ============================================================================

export interface LegendMomentLedgerDiff {
  readonly addedLegendIds: readonly ChatLegendId[];
  readonly removedLegendIds: readonly ChatLegendId[];
  readonly upgradedLegendIds: readonly ChatLegendId[];
  readonly grantedLegendIds: readonly ChatLegendId[];
  readonly revokedLegendIds: readonly ChatLegendId[];
  readonly roomPrestigeChanged: readonly ChatRoomId[];
}

export function diffLegendMomentLedgerSnapshots(
  before: LegendMomentLedgerSnapshot,
  after: LegendMomentLedgerSnapshot,
): LegendMomentLedgerDiff {
  const beforeIds = new Set(Object.keys(before.byId) as ChatLegendId[]);
  const afterIds = new Set(Object.keys(after.byId) as ChatLegendId[]);

  const addedLegendIds = [...afterIds].filter((id) => !beforeIds.has(id)) as ChatLegendId[];
  const removedLegendIds = [...beforeIds].filter((id) => !afterIds.has(id)) as ChatLegendId[];

  const upgradedLegendIds: ChatLegendId[] = [];
  const grantedLegendIds: ChatLegendId[] = [];
  const revokedLegendIds: ChatLegendId[] = [];

  for (const id of afterIds) {
    if (!beforeIds.has(id)) continue;
    const b = before.byId[id];
    const a = after.byId[id];
    if (!b || !a) continue;
    if (b.status === 'PROVISIONAL' && a.status === 'CONFIRMED') upgradedLegendIds.push(id);
    if (!b.reward.granted && a.reward.granted) grantedLegendIds.push(id);
    if (b.status !== 'REVOKED' && a.status === 'REVOKED') revokedLegendIds.push(id);
  }

  const allRoomIds = new Set([
    ...Object.keys(before.roomPrestige),
    ...Object.keys(after.roomPrestige),
  ] as ChatRoomId[]);
  const roomPrestigeChanged: ChatRoomId[] = [];
  for (const roomId of allRoomIds) {
    const bp = before.roomPrestige[roomId];
    const ap = after.roomPrestige[roomId];
    if (!bp || !ap) { roomPrestigeChanged.push(roomId); continue; }
    if (bp.confirmedCount !== ap.confirmedCount || bp.grantedCount !== ap.grantedCount) {
      roomPrestigeChanged.push(roomId);
    }
  }

  return Object.freeze({
    addedLegendIds: freezeArray(addedLegendIds),
    removedLegendIds: freezeArray(removedLegendIds),
    upgradedLegendIds: freezeArray(upgradedLegendIds),
    grantedLegendIds: freezeArray(grantedLegendIds),
    revokedLegendIds: freezeArray(revokedLegendIds),
    roomPrestigeChanged: freezeArray(roomPrestigeChanged),
  });
}

// ============================================================================
// MARK: Temporal density analysis
// ============================================================================

export interface LegendMomentTemporalWindow {
  readonly windowId: string;
  readonly roomId: ChatRoomId;
  readonly startAt: UnixMs;
  readonly endAt: UnixMs;
  readonly legendCount: number;
  readonly confirmedCount: number;
  readonly grantedCount: number;
  readonly legendIds: readonly ChatLegendId[];
  readonly densityScore01: number;
}

export function buildLegendTemporalDensityWindows(
  ledger: LegendMomentLedger,
  roomId: ChatRoomId,
  windowDurationMs = 1000 * 60 * 5,
): readonly LegendMomentTemporalWindow[] {
  const records = ledger.listByRoom(roomId);
  if (records.length === 0) return Object.freeze([]);

  const sorted = [...records].sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
  const firstAt = Number(sorted[0].createdAt);
  const lastAt = Number(sorted[sorted.length - 1].createdAt) + windowDurationMs;

  const windows: LegendMomentTemporalWindow[] = [];
  for (let start = firstAt; start < lastAt; start += windowDurationMs) {
    const end = start + windowDurationMs;
    const inWindow = sorted.filter((r) => Number(r.createdAt) >= start && Number(r.createdAt) < end);
    if (inWindow.length === 0) continue;
    const confirmedCount = inWindow.filter((r) => r.status === 'CONFIRMED' || r.status === 'GRANTED').length;
    const grantedCount = inWindow.filter((r) => r.reward.granted).length;
    windows.push(Object.freeze({
      windowId: `temporal:${roomId}:${start}`,
      roomId,
      startAt: asUnixMs(start),
      endAt: asUnixMs(end),
      legendCount: inWindow.length,
      confirmedCount,
      grantedCount,
      legendIds: freezeArray(inWindow.map((r) => r.legendId)),
      densityScore01: Math.min(1, inWindow.length / 6),
    }));
  }
  return freezeArray(windows);
}

export function peakPrestigeWindowForRoom(
  ledger: LegendMomentLedger,
  roomId: ChatRoomId,
  windowDurationMs = 1000 * 60 * 5,
): LegendMomentTemporalWindow | null {
  const windows = buildLegendTemporalDensityWindows(ledger, roomId, windowDurationMs);
  if (windows.length === 0) return null;
  return windows.reduce((best, w) => w.densityScore01 > best.densityScore01 ? w : best);
}

// ============================================================================
// MARK: Prestige momentum
// ============================================================================

export interface LegendMomentumState {
  readonly roomId: ChatRoomId;
  readonly momentumScore01: number;
  readonly recentLegendCount: number;
  readonly recentConfirmedCount: number;
  readonly recentGrantedCount: number;
  readonly accelerating: boolean;
  readonly decelerating: boolean;
  readonly lastLegendAt: UnixMs | null;
  readonly windowMs: number;
}

export function computeLegendMomentum(
  ledger: LegendMomentLedger,
  roomId: ChatRoomId,
  now: UnixMs = asUnixMs(Date.now()),
  windowMs = 1000 * 60 * 10,
  comparisonWindowMs = 1000 * 60 * 20,
): LegendMomentumState {
  const all = ledger.listByRoom(roomId);
  const recent = all.filter((r) => Number(now) - Number(r.createdAt) <= windowMs);
  const previous = all.filter((r) => {
    const age = Number(now) - Number(r.createdAt);
    return age > windowMs && age <= comparisonWindowMs;
  });
  const recentConfirmedCount = recent.filter((r) => r.status === 'CONFIRMED' || r.status === 'GRANTED').length;
  const recentGrantedCount = recent.filter((r) => r.reward.granted).length;
  const momentumScore01 = Math.min(1, recent.length / 5);
  const previousRate = previous.length / Math.max(1, comparisonWindowMs - windowMs);
  const recentRate = recent.length / Math.max(1, windowMs);
  return Object.freeze({
    roomId,
    momentumScore01,
    recentLegendCount: recent.length,
    recentConfirmedCount,
    recentGrantedCount,
    accelerating: recentRate > previousRate * 1.2,
    decelerating: recentRate < previousRate * 0.8,
    lastLegendAt: all.length > 0 ? all[all.length - 1].createdAt : null,
    windowMs,
  });
}

// ============================================================================
// MARK: Cross-room summary
// ============================================================================

export interface LegendMomentCrossRoomSummary {
  readonly roomCount: number;
  readonly totalLegendCount: number;
  readonly totalGrantedCount: number;
  readonly totalConfirmedCount: number;
  readonly topRoomId: ChatRoomId | null;
  readonly topRoomLegendCount: number;
  readonly classDistribution: Readonly<Record<string, number>>;
  readonly tierDistribution: Readonly<Record<string, number>>;
}

export function buildCrossRoomLegendSummary(ledger: LegendMomentLedger): LegendMomentCrossRoomSummary {
  const snapshot = ledger.buildSnapshot();
  const roomIds = Object.keys(snapshot.byRoom) as ChatRoomId[];
  let topRoomId: ChatRoomId | null = null;
  let topRoomLegendCount = 0;
  let totalLegendCount = 0;
  let totalGrantedCount = 0;
  let totalConfirmedCount = 0;
  const classDistribution: Record<string, number> = {};
  const tierDistribution: Record<string, number> = {};

  for (const roomId of roomIds) {
    const records = snapshot.byRoom[roomId] ?? [];
    totalLegendCount += records.length;
    if (records.length > topRoomLegendCount) { topRoomLegendCount = records.length; topRoomId = roomId; }
    for (const r of records) {
      if (r.reward.granted) totalGrantedCount += 1;
      if (r.status === 'CONFIRMED' || r.status === 'GRANTED') totalConfirmedCount += 1;
      classDistribution[String(r.legendClass)] = (classDistribution[String(r.legendClass)] ?? 0) + 1;
      tierDistribution[String(r.tier)] = (tierDistribution[String(r.tier)] ?? 0) + 1;
    }
  }

  return Object.freeze({
    roomCount: roomIds.length,
    totalLegendCount,
    totalGrantedCount,
    totalConfirmedCount,
    topRoomId,
    topRoomLegendCount,
    classDistribution: freezeRecord(classDistribution),
    tierDistribution: freezeRecord(tierDistribution),
  });
}

// ============================================================================
// MARK: Batch admit API
// ============================================================================

export interface LegendMomentBatchAdmitResult {
  readonly results: readonly LegendMomentAdmitResult[];
  readonly createdCount: number;
  readonly mergedCount: number;
  readonly failedCount: number;
  readonly affectedRoomIds: readonly ChatRoomId[];
}

export function batchAdmitLegends(
  ledger: LegendMomentLedger,
  inputs: readonly LegendMomentAdmitInput[],
): LegendMomentBatchAdmitResult {
  const results: LegendMomentAdmitResult[] = [];
  let createdCount = 0;
  let mergedCount = 0;
  let failedCount = 0;
  const affectedRoomIds = new Set<ChatRoomId>();

  for (const input of inputs) {
    try {
      const result = ledger.admitLegend(input);
      results.push(result);
      if (result.created) createdCount += 1;
      if (result.merged) mergedCount += 1;
      affectedRoomIds.add(result.record.roomId);
    } catch {
      failedCount += 1;
    }
  }

  return Object.freeze({
    results: freezeArray(results),
    createdCount,
    mergedCount,
    failedCount,
    affectedRoomIds: freezeArray([...affectedRoomIds]),
  });
}

// ============================================================================
// MARK: Profile system
// ============================================================================

export type LegendMomentLedgerProfile =
  | 'STANDARD'
  | 'COMPACT'
  | 'CINEMATIC'
  | 'FORENSIC'
  | 'HIGH_VOLUME';

export const LEGEND_MOMENT_LEDGER_PROFILES: Readonly<Record<LegendMomentLedgerProfile, Partial<LegendMomentLedgerConfig>>> = Object.freeze({
  STANDARD: Object.freeze({}),
  COMPACT: Object.freeze({
    maxReasonsPerLegend: 16,
    maxLegendsPerRoom: 500,
    maxWitnessIdsPerLegend: 8,
    maxReplayLinksPerLegend: 4,
    maxProofHashesPerLegend: 8,
    dedupeWindowMs: 30_000,
    archiveAfterMs: 1000 * 60 * 60 * 24 * 3,
  }),
  CINEMATIC: Object.freeze({
    maxReasonsPerLegend: 128,
    maxLegendsPerRoom: 10_000,
    maxWitnessIdsPerLegend: 64,
    maxReplayLinksPerLegend: 32,
    maxProofHashesPerLegend: 64,
    dedupeWindowMs: 120_000,
    archiveAfterMs: 1000 * 60 * 60 * 24 * 60,
    allowProvisionalUpgrade: true,
  }),
  FORENSIC: Object.freeze({
    maxReasonsPerLegend: 256,
    maxLegendsPerRoom: 50_000,
    maxWitnessIdsPerLegend: 128,
    maxReplayLinksPerLegend: 64,
    maxProofHashesPerLegend: 128,
    dedupeWindowMs: 300_000,
    archiveAfterMs: 1000 * 60 * 60 * 24 * 365,
    allowProvisionalUpgrade: false,
  }),
  HIGH_VOLUME: Object.freeze({
    maxReasonsPerLegend: 32,
    maxLegendsPerRoom: 100_000,
    maxWitnessIdsPerLegend: 12,
    maxReplayLinksPerLegend: 6,
    maxProofHashesPerLegend: 16,
    dedupeWindowMs: 45_000,
    archiveAfterMs: 1000 * 60 * 60 * 24 * 7,
  }),
});

export function createLegendMomentLedgerFromProfile(
  profile: LegendMomentLedgerProfile,
  overrides: Partial<LegendMomentLedgerConfig> = {},
): LegendMomentLedger {
  const profileConfig = LEGEND_MOMENT_LEDGER_PROFILES[profile] ?? {};
  return createLegendMomentLedger({ ...profileConfig, ...overrides });
}

export function createCompactLegendMomentLedger(overrides: Partial<LegendMomentLedgerConfig> = {}): LegendMomentLedger {
  return createLegendMomentLedgerFromProfile('COMPACT', overrides);
}

export function createCinematicLegendMomentLedger(overrides: Partial<LegendMomentLedgerConfig> = {}): LegendMomentLedger {
  return createLegendMomentLedgerFromProfile('CINEMATIC', overrides);
}

export function createForensicLegendMomentLedger(overrides: Partial<LegendMomentLedgerConfig> = {}): LegendMomentLedger {
  return createLegendMomentLedgerFromProfile('FORENSIC', overrides);
}

export function createHighVolumeLegendMomentLedger(overrides: Partial<LegendMomentLedgerConfig> = {}): LegendMomentLedger {
  return createLegendMomentLedgerFromProfile('HIGH_VOLUME', overrides);
}

// ============================================================================
// MARK: Legend drift detection
// ============================================================================

export interface LegendDriftReport {
  readonly totalIssues: number;
  readonly byCode: Readonly<Record<string, number>>;
  readonly issues: readonly LegendMomentIntegrityIssue[];
  readonly repaired: boolean;
}

export function auditAndRepairLedger(ledger: LegendMomentLedger, repair = false): LegendDriftReport {
  const issues = repair ? ledger.repairIntegrity() : ledger.auditIntegrity();
  const byCode: Record<string, number> = {};
  for (const issue of issues) {
    byCode[issue.code] = (byCode[issue.code] ?? 0) + 1;
  }
  return Object.freeze({
    totalIssues: issues.length,
    byCode: freezeRecord(byCode),
    issues,
    repaired: repair,
  });
}

// ============================================================================
// MARK: Reward queue summary
// ============================================================================

export interface LegendRewardQueueSummary {
  readonly eligibleCount: number;
  readonly queuedCount: number;
  readonly grantedCount: number;
  readonly eligibleLegendIds: readonly ChatLegendId[];
  readonly queuedLegendIds: readonly ChatLegendId[];
  readonly pendingRewardClasses: readonly string[];
}

export function buildRewardQueueSummary(
  ledger: LegendMomentLedger,
  roomId?: ChatRoomId,
): LegendRewardQueueSummary {
  const eligible = ledger.listEligibleForRewardGrant(roomId);
  const all = roomId ? ledger.listByRoom(roomId) : [];
  const queued = all.filter((r) => r.reward.queued && !r.reward.granted);
  const granted = all.filter((r) => r.reward.granted);
  const pendingClasses = uniqueStrings(
    eligible.flatMap((r) => r.reward.rewardClasses.map((c) => String(c))),
  );
  return Object.freeze({
    eligibleCount: eligible.length,
    queuedCount: queued.length,
    grantedCount: granted.length,
    eligibleLegendIds: freezeArray(eligible.map((r) => r.legendId)),
    queuedLegendIds: freezeArray(queued.map((r) => r.legendId)),
    pendingRewardClasses: pendingClasses,
  });
}

// ============================================================================
// MARK: Ledger statistics
// ============================================================================

export interface LegendMomentLedgerStats {
  readonly totalLegends: number;
  readonly provisional: number;
  readonly confirmed: number;
  readonly grantQueued: number;
  readonly granted: number;
  readonly archived: number;
  readonly revoked: number;
  readonly totalRooms: number;
  readonly avgLegendsPerRoom: number;
  readonly totalWitnessLinks: number;
  readonly totalReplayLinks: number;
  readonly totalProofHashes: number;
}

export function buildLegendMomentLedgerStats(ledger: LegendMomentLedger): LegendMomentLedgerStats {
  const snapshot = ledger.buildSnapshot();
  const all = Object.values(snapshot.byId);
  const rooms = Object.keys(snapshot.byRoom);
  return Object.freeze({
    totalLegends: all.length,
    provisional: all.filter((r) => r.status === 'PROVISIONAL').length,
    confirmed: all.filter((r) => r.status === 'CONFIRMED').length,
    grantQueued: all.filter((r) => r.status === 'GRANT_QUEUED').length,
    granted: all.filter((r) => r.status === 'GRANTED').length,
    archived: all.filter((r) => r.status === 'ARCHIVED').length,
    revoked: all.filter((r) => r.status === 'REVOKED').length,
    totalRooms: rooms.length,
    avgLegendsPerRoom: rooms.length > 0 ? all.length / rooms.length : 0,
    totalWitnessLinks: all.reduce((acc, r) => acc + r.messages.witnessMessageIds.length, 0),
    totalReplayLinks: all.reduce((acc, r) => acc + r.replay.replayIds.length, 0),
    totalProofHashes: all.reduce((acc, r) => acc + r.proof.hashes.length, 0),
  });
}

// ============================================================================
// MARK: Doctrine notes
// ============================================================================

export const LEGEND_MOMENT_LEDGER_DOCTRINE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  ADMISSION: Object.freeze([
    'Every legend event admitted here becomes an authoritative prestige record for the session.',
    'Provisional records are admitted when visibility is not VISIBLE; they upgrade on merge.',
    'Duplicate detection is time-windowed and key-matched — not payload-matched.',
  ]),
  REWARD_LIFECYCLE: Object.freeze([
    'Reward eligibility is set on admit if reward hints are present.',
    'Queuing is a staging state — it does not guarantee a grant.',
    'Grant attachment is the terminal reward state; revocation is always permitted.',
  ]),
  INTEGRITY: Object.freeze([
    'auditIntegrity() is non-destructive. It only reports, never writes.',
    'repairIntegrity() recomputes room prestige caches — safe to call at any time.',
    'Index drift should be investigated before archival or transport fanout.',
  ]),
  PROFILES: Object.freeze([
    'STANDARD: default for live sessions.',
    'COMPACT: minimal retention, suitable for low-memory environments.',
    'CINEMATIC: high-retention, ideal for post-run and replay authoring.',
    'FORENSIC: maximum retention with no auto-upgrade, for audit pipelines.',
    'HIGH_VOLUME: large legend counts with bounded reason lists.',
  ]),
});

export const ChatLegendMomentLedgerProfileModule = Object.freeze({
  profiles: LEGEND_MOMENT_LEDGER_PROFILES,
  createFromProfile: createLegendMomentLedgerFromProfile,
  createCompact: createCompactLegendMomentLedger,
  createCinematic: createCinematicLegendMomentLedger,
  createForensic: createForensicLegendMomentLedger,
  createHighVolume: createHighVolumeLegendMomentLedger,
  score: scoreLegendMoment,
  diff: diffLegendMomentLedgerSnapshots,
  momentum: computeLegendMomentum,
  stats: buildLegendMomentLedgerStats,
  batchAdmit: batchAdmitLegends,
  doctrine: LEGEND_MOMENT_LEDGER_DOCTRINE,
} as const);
