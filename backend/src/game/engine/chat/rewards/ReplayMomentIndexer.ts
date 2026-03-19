/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT REPLAY MOMENT INDEXER
 * FILE: backend/src/game/engine/chat/rewards/ReplayMomentIndexer.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Cross-index replay artifacts and prestige moments.
 *
 * Replay artifacts already exist in the backend chat lane. Legend moments also
 * now exist as authoritative records. This file binds the two together so the
 * backend can answer questions such as:
 *
 * - which legend moments belong to a replay,
 * - which replay best represents a legend moment,
 * - which prestige beats fall around a message, sequence, or timestamp,
 * - which callbacks or post-run scenes should link into replay,
 * - how to build transport-safe replay prestige bundles without rescanning the
 *   whole transcript and replay tree every time.
 *
 * What this file owns
 * -------------------
 * - replay-to-legend indexing
 * - sequence / message / timestamp prestige lookup
 * - replay prestige bundle shaping
 * - coverage audit over legend vs replay linkage
 * - relinking helpers when replay truth changes
 *
 * What this file does not own
 * ---------------------------
 * - replay artifact authoring
 * - transcript truth
 * - legend admission
 * - reward entitlement mutation
 * ============================================================================
 */

import {
  asSequenceNumber,
  asUnixMs,
  type ChatMessageId,
  type ChatReplayArtifact,
  type ChatReplayId,
  type ChatRoomId,
  type ChatState,
  type JsonValue,
  type SequenceNumber,
  type UnixMs,
} from '../types';
import type {
  LegendMomentLedgerSnapshot,
  LegendMomentRecord,
} from './LegendMomentLedger';

// ============================================================================
// MARK: Index contracts
// ============================================================================

export interface ReplayMomentIndexRecord {
  readonly replayId: ChatReplayId;
  readonly roomId: ChatRoomId;
  readonly legendId: LegendMomentRecord['legendId'];
  readonly linkedAt: UnixMs;
  readonly relation:
    | 'PRIMARY_REPLAY'
    | 'SECONDARY_REPLAY'
    | 'SEQUENCE_OVERLAP'
    | 'ANCHOR_KEY_MATCH'
    | 'MESSAGE_PROXIMITY'
    | 'ROOM_PROXIMITY';
  readonly sequenceDistance: number | null;
  readonly anchorKey: string | null;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ReplayMomentCoverageIssue {
  readonly code:
    | 'LEGEND_WITHOUT_REPLAY'
    | 'REPLAY_WITHOUT_LEGEND'
    | 'INDEX_DRIFT'
    | 'PRIMARY_REPLAY_MISMATCH';
  readonly replayId: ChatReplayId | null;
  readonly legendId: LegendMomentRecord['legendId'] | null;
  readonly roomId: ChatRoomId | null;
  readonly detail: string;
}

export interface ReplayMomentIndexerConfig {
  readonly maxLinksPerLegend: number;
  readonly maxLinksPerReplay: number;
  readonly sequenceDistanceGrace: number;
  readonly timestampDistanceGraceMs: number;
}

export interface ReplayMomentTransportBundle {
  readonly replayId: ChatReplayId;
  readonly roomId: ChatRoomId;
  readonly activeLegendIds: readonly LegendMomentRecord['legendId'][];
  readonly replayReadyLegendIds: readonly LegendMomentRecord['legendId'][];
  readonly callbackReadyLegendIds: readonly LegendMomentRecord['legendId'][];
  readonly rewardReadyLegendIds: readonly LegendMomentRecord['legendId'][];
}

const DEFAULT_REPLAY_MOMENT_INDEXER_CONFIG: ReplayMomentIndexerConfig = Object.freeze({
  maxLinksPerLegend: 12,
  maxLinksPerReplay: 32,
  sequenceDistanceGrace: 25,
  timestampDistanceGraceMs: 1000 * 60 * 2,
});

// ============================================================================
// MARK: Helpers
// ============================================================================

function freezeArray<T>(input: readonly T[]): readonly T[] {
  return Object.freeze([...input]);
}

function freezeRecord<T extends Record<string, unknown>>(input: T): Readonly<T> {
  return Object.freeze({ ...input });
}

function nowUnixMs(): UnixMs {
  return asUnixMs(Date.now());
}

function uniqueIds<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function replaySequenceWindow(artifact: ChatReplayArtifact): { readonly start: SequenceNumber; readonly end: SequenceNumber } {
  const range = artifact.range as { startSequence?: SequenceNumber | number; endSequence?: SequenceNumber | number };
  return Object.freeze({
    start: asSequenceNumber(Number(range.startSequence ?? 0)),
    end: asSequenceNumber(Number(range.endSequence ?? 0)),
  });
}

function legendSequenceNumber(record: LegendMomentRecord): SequenceNumber {
  return asSequenceNumber(record.roomSequence ?? 0);
}

function sequenceDistance(record: LegendMomentRecord, artifact: ChatReplayArtifact): number {
  const window = replaySequenceWindow(artifact);
  const sequence = Number(legendSequenceNumber(record));
  if (sequence < Number(window.start)) return Number(window.start) - sequence;
  if (sequence > Number(window.end)) return sequence - Number(window.end);
  return 0;
}

function anchorKeyMatch(record: LegendMomentRecord, artifact: ChatReplayArtifact): boolean {
  return record.replay.anchorKeys.includes(artifact.anchorKey);
}

function relationForRecord(record: LegendMomentRecord, artifact: ChatReplayArtifact, grace: number): ReplayMomentIndexRecord['relation'] | null {
  if (record.replay.primaryReplayId && record.replay.primaryReplayId === artifact.id) return 'PRIMARY_REPLAY';
  if (record.replay.replayIds.includes(artifact.id)) return 'SECONDARY_REPLAY';
  if (anchorKeyMatch(record, artifact)) return 'ANCHOR_KEY_MATCH';
  if (sequenceDistance(record, artifact) <= grace) return 'SEQUENCE_OVERLAP';
  return null;
}

// ============================================================================
// MARK: Indexer implementation
// ============================================================================

export class ReplayMomentIndexer {
  private readonly config: ReplayMomentIndexerConfig;

  private readonly byReplay = new Map<ChatReplayId, readonly ReplayMomentIndexRecord[]>();

  private readonly byLegend = new Map<LegendMomentRecord['legendId'], readonly ReplayMomentIndexRecord[]>();

  private readonly byRoom = new Map<ChatRoomId, readonly ReplayMomentIndexRecord[]>();

  private readonly byMessage = new Map<ChatMessageId, readonly ReplayMomentIndexRecord[]>();

  public constructor(config: Partial<ReplayMomentIndexerConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_REPLAY_MOMENT_INDEXER_CONFIG,
      ...config,
    });
  }

  public getConfig(): ReplayMomentIndexerConfig {
    return this.config;
  }

  public clear(): void {
    this.byReplay.clear();
    this.byLegend.clear();
    this.byRoom.clear();
    this.byMessage.clear();
  }

  public rebuild(
    replayArtifacts: readonly ChatReplayArtifact[],
    legendSnapshot: LegendMomentLedgerSnapshot,
  ): void {
    this.clear();
    for (const artifact of replayArtifacts) {
      const roomRecords = legendSnapshot.byRoom[artifact.roomId] ?? Object.freeze([]);
      for (const record of roomRecords) {
        const relation = relationForRecord(record, artifact, this.config.sequenceDistanceGrace);
        if (!relation) continue;
        const indexRecord: ReplayMomentIndexRecord = Object.freeze({
          replayId: artifact.id,
          roomId: artifact.roomId,
          legendId: record.legendId,
          linkedAt: nowUnixMs(),
          relation,
          sequenceDistance: sequenceDistance(record, artifact),
          anchorKey: anchorKeyMatch(record, artifact) ? artifact.anchorKey : null,
          metadata: freezeRecord({
            legendClass: record.legendClass,
            legendTier: record.tier,
            legendSeverity: record.severity,
            anchorKey: artifact.anchorKey,
          }),
        });
        this.appendIndexRecord(indexRecord, record);
      }
    }
  }

  public rebuildFromState(state: ChatState, legendSnapshot: LegendMomentLedgerSnapshot): void {
    const replayArtifacts = Object.values(state.replay.byReplayId ?? {});
    this.rebuild(replayArtifacts, legendSnapshot);
  }

  public listByReplayId(replayId: ChatReplayId): readonly ReplayMomentIndexRecord[] {
    return this.byReplay.get(replayId) ?? Object.freeze([]);
  }

  public listByLegendId(legendId: LegendMomentRecord['legendId']): readonly ReplayMomentIndexRecord[] {
    return this.byLegend.get(legendId) ?? Object.freeze([]);
  }

  public listByRoom(roomId: ChatRoomId): readonly ReplayMomentIndexRecord[] {
    return this.byRoom.get(roomId) ?? Object.freeze([]);
  }

  public listByMessageId(messageId: ChatMessageId): readonly ReplayMomentIndexRecord[] {
    return this.byMessage.get(messageId) ?? Object.freeze([]);
  }

  public findPrimaryReplayId(legendId: LegendMomentRecord['legendId']): ChatReplayId | null {
    const records = this.listByLegendId(legendId);
    const primary = records.find((value) => value.relation === 'PRIMARY_REPLAY');
    return primary?.replayId ?? records[0]?.replayId ?? null;
  }

  public buildTransportBundle(
    replayId: ChatReplayId,
    legendSnapshot: LegendMomentLedgerSnapshot,
  ): ReplayMomentTransportBundle | null {
    const records = this.listByReplayId(replayId);
    if (records.length === 0) return null;
    const roomId = records[0].roomId;
    const legendIds = uniqueIds(records.map((value) => value.legendId));
    const legendRecords = legendIds
      .map((value) => legendSnapshot.byId[value])
      .filter((value): value is LegendMomentRecord => Boolean(value));
    return Object.freeze({
      replayId,
      roomId,
      activeLegendIds: freezeArray(legendRecords.filter((value) => value.status !== 'ARCHIVED' && value.status !== 'REVOKED').map((value) => value.legendId)),
      replayReadyLegendIds: freezeArray(legendRecords.filter((value) => value.callback.replayReady).map((value) => value.legendId)),
      callbackReadyLegendIds: freezeArray(legendRecords.filter((value) => value.callback.callbackReady).map((value) => value.legendId)),
      rewardReadyLegendIds: freezeArray(legendRecords.filter((value) => value.reward.eligible && !value.reward.granted).map((value) => value.legendId)),
    });
  }

  public findNearestReplay(
    roomId: ChatRoomId,
    sequence: SequenceNumber,
    replayArtifacts: readonly ChatReplayArtifact[],
  ): ChatReplayId | null {
    const roomArtifacts = replayArtifacts.filter((value) => value.roomId === roomId);
    let best: { replayId: ChatReplayId; distance: number } | null = null;
    for (const artifact of roomArtifacts) {
      const window = replaySequenceWindow(artifact);
      const numeric = Number(sequence);
      const distance =
        numeric < Number(window.start)
          ? Number(window.start) - numeric
          : numeric > Number(window.end)
            ? numeric - Number(window.end)
            : 0;
      if (!best || distance < best.distance) {
        best = { replayId: artifact.id, distance };
      }
    }
    return best?.replayId ?? null;
  }

  public auditCoverage(
    replayArtifacts: readonly ChatReplayArtifact[],
    legendSnapshot: LegendMomentLedgerSnapshot,
  ): readonly ReplayMomentCoverageIssue[] {
    const issues: ReplayMomentCoverageIssue[] = [];
    for (const record of Object.values(legendSnapshot.byId)) {
      const links = this.listByLegendId(record.legendId);
      if (record.replay.replayIds.length > 0 && links.length === 0) {
        issues.push({
          code: 'LEGEND_WITHOUT_REPLAY',
          replayId: null,
          legendId: record.legendId,
          roomId: record.roomId,
          detail: 'Legend carries replay ids but the replay-moment index has no entries.',
        });
      }
      const primaryReplay = this.findPrimaryReplayId(record.legendId);
      if (record.replay.primaryReplayId && primaryReplay && record.replay.primaryReplayId !== primaryReplay) {
        issues.push({
          code: 'PRIMARY_REPLAY_MISMATCH',
          replayId: primaryReplay,
          legendId: record.legendId,
          roomId: record.roomId,
          detail: 'Ledger primary replay id disagrees with replay-moment index primary replay.',
        });
      }
    }

    for (const artifact of replayArtifacts) {
      const links = this.listByReplayId(artifact.id);
      if (links.length === 0) {
        issues.push({
          code: 'REPLAY_WITHOUT_LEGEND',
          replayId: artifact.id,
          legendId: null,
          roomId: artifact.roomId,
          detail: 'Replay exists with no linked prestige moment.',
        });
      }
    }

    return freezeArray(issues);
  }

  private appendIndexRecord(indexRecord: ReplayMomentIndexRecord, legendRecord: LegendMomentRecord): void {
    const replayExisting = this.byReplay.get(indexRecord.replayId) ?? Object.freeze([]);
    this.byReplay.set(indexRecord.replayId, freezeArray([...replayExisting, indexRecord].slice(-this.config.maxLinksPerReplay)));

    const legendExisting = this.byLegend.get(indexRecord.legendId) ?? Object.freeze([]);
    this.byLegend.set(indexRecord.legendId, freezeArray([...legendExisting, indexRecord].slice(-this.config.maxLinksPerLegend)));

    const roomExisting = this.byRoom.get(indexRecord.roomId) ?? Object.freeze([]);
    this.byRoom.set(indexRecord.roomId, freezeArray([...roomExisting, indexRecord]));

    for (const messageId of legendRecord.messages.witnessMessageIds) {
      const messageExisting = this.byMessage.get(messageId) ?? Object.freeze([]);
      this.byMessage.set(messageId, freezeArray([...messageExisting, indexRecord]));
    }
  }
}



// ============================================================================
// MARK: Snapshot / query helpers
// ============================================================================

export interface ReplayMomentIndexerSnapshot {
  readonly byReplay: Readonly<Record<ChatReplayId, readonly ReplayMomentIndexRecord[]>>;
  readonly byLegend: Readonly<Record<LegendMomentRecord['legendId'], readonly ReplayMomentIndexRecord[]>>;
  readonly byRoom: Readonly<Record<ChatRoomId, readonly ReplayMomentIndexRecord[]>>;
}

export interface ReplayMomentSequenceQuery {
  readonly roomId: ChatRoomId;
  readonly sequenceStart: SequenceNumber;
  readonly sequenceEnd: SequenceNumber;
}

export interface ReplayMomentTimestampQuery {
  readonly roomId: ChatRoomId;
  readonly startAt: UnixMs;
  readonly endAt: UnixMs;
}

export interface ReplayMomentRoomCoverageSummary {
  readonly roomId: ChatRoomId;
  readonly replayCount: number;
  readonly linkedLegendCount: number;
  readonly activeLegendCount: number;
  readonly rewardReadyLegendCount: number;
}

export function buildReplayMomentIndexerSnapshot(
  indexer: ReplayMomentIndexer,
  replayIds: readonly ChatReplayId[],
  legendIds: readonly LegendMomentRecord['legendId'][],
  roomIds: readonly ChatRoomId[],
): ReplayMomentIndexerSnapshot {
  const byReplay = Object.fromEntries(replayIds.map((replayId) => [replayId, indexer.listByReplayId(replayId)])) as Record<ChatReplayId, readonly ReplayMomentIndexRecord[]>;
  const byLegend = Object.fromEntries(legendIds.map((legendId) => [legendId, indexer.listByLegendId(legendId)])) as Record<LegendMomentRecord['legendId'], readonly ReplayMomentIndexRecord[]>;
  const byRoom = Object.fromEntries(roomIds.map((roomId) => [roomId, indexer.listByRoom(roomId)])) as Record<ChatRoomId, readonly ReplayMomentIndexRecord[]>;
  return Object.freeze({
    byReplay: freezeRecord(byReplay),
    byLegend: freezeRecord(byLegend),
    byRoom: freezeRecord(byRoom),
  });
}

export function queryReplayMomentsBySequence(
  indexer: ReplayMomentIndexer,
  query: ReplayMomentSequenceQuery,
  replayArtifacts: readonly ChatReplayArtifact[],
): readonly ReplayMomentIndexRecord[] {
  const matchingReplays = replayArtifacts
    .filter((value) => value.roomId === query.roomId)
    .filter((value) => {
      const window = replaySequenceWindow(value);
      return Number(window.end) >= Number(query.sequenceStart) && Number(window.start) <= Number(query.sequenceEnd);
    })
    .map((value) => value.id);
  return freezeArray(matchingReplays.flatMap((replayId) => indexer.listByReplayId(replayId)));
}

export function queryReplayMomentsByTimestamp(
  indexer: ReplayMomentIndexer,
  query: ReplayMomentTimestampQuery,
  legendSnapshot: LegendMomentLedgerSnapshot,
): readonly ReplayMomentIndexRecord[] {
  const roomRecords = legendSnapshot.byRoom[query.roomId] ?? Object.freeze([]);
  const matchingLegendIds = roomRecords
    .filter((value) => Number(value.createdAt) >= Number(query.startAt) && Number(value.createdAt) <= Number(query.endAt))
    .map((value) => value.legendId);
  return freezeArray(matchingLegendIds.flatMap((legendId) => indexer.listByLegendId(legendId)));
}

export function summarizeRoomReplayCoverage(
  indexer: ReplayMomentIndexer,
  roomId: ChatRoomId,
  legendSnapshot: LegendMomentLedgerSnapshot,
): ReplayMomentRoomCoverageSummary {
  const roomLinks = indexer.listByRoom(roomId);
  const roomLegends = legendSnapshot.byRoom[roomId] ?? Object.freeze([]);
  return Object.freeze({
    roomId,
    replayCount: uniqueIds(roomLinks.map((value) => value.replayId)).length,
    linkedLegendCount: uniqueIds(roomLinks.map((value) => value.legendId)).length,
    activeLegendCount: roomLegends.filter((value) => value.status !== 'ARCHIVED' && value.status !== 'REVOKED').length,
    rewardReadyLegendCount: roomLegends.filter((value) => value.reward.eligible && !value.reward.granted).length,
  });
}

export function buildReplayMomentAuditReport(
  indexer: ReplayMomentIndexer,
  replayArtifacts: readonly ChatReplayArtifact[],
  legendSnapshot: LegendMomentLedgerSnapshot,
): Readonly<{
  issues: readonly ReplayMomentCoverageIssue[];
  byRoom: readonly ReplayMomentRoomCoverageSummary[];
}> {
  const roomIds = uniqueIds([
    ...replayArtifacts.map((value) => value.roomId),
    ...(Object.keys(legendSnapshot.byRoom) as ChatRoomId[]),
  ] as readonly ChatRoomId[]);
  return Object.freeze({
    issues: indexer.auditCoverage(replayArtifacts, legendSnapshot),
    byRoom: freezeArray(roomIds.map((roomId) => summarizeRoomReplayCoverage(indexer, roomId, legendSnapshot))),
  });
}

export function buildReplayTransportBundles(
  indexer: ReplayMomentIndexer,
  replayArtifacts: readonly ChatReplayArtifact[],
  legendSnapshot: LegendMomentLedgerSnapshot,
): readonly ReplayMomentTransportBundle[] {
  return freezeArray(
    replayArtifacts
      .map((artifact) => indexer.buildTransportBundle(artifact.id, legendSnapshot))
      .filter((value): value is ReplayMomentTransportBundle => Boolean(value)),
  );
}


export interface ReplayMomentMessageBundle {
  readonly messageId: ChatMessageId;
  readonly legendIds: readonly LegendMomentRecord['legendId'][];
  readonly replayIds: readonly ChatReplayId[];
}

export interface ReplayMomentLegendBundle {
  readonly legendId: LegendMomentRecord['legendId'];
  readonly replayIds: readonly ChatReplayId[];
  readonly roomId: ChatRoomId | null;
  readonly relations: readonly ReplayMomentIndexRecord['relation'][];
}

export function buildReplayMomentMessageBundles(
  indexer: ReplayMomentIndexer,
  messageIds: readonly ChatMessageId[],
): readonly ReplayMomentMessageBundle[] {
  return freezeArray(
    messageIds.map((messageId) => {
      const records = indexer.listByMessageId(messageId);
      return Object.freeze({
        messageId,
        legendIds: uniqueIds(records.map((value) => value.legendId)),
        replayIds: uniqueIds(records.map((value) => value.replayId)),
      });
    }),
  );
}

export function buildReplayMomentLegendBundles(
  indexer: ReplayMomentIndexer,
  legendIds: readonly LegendMomentRecord['legendId'][],
): readonly ReplayMomentLegendBundle[] {
  return freezeArray(
    legendIds.map((legendId) => {
      const records = indexer.listByLegendId(legendId);
      return Object.freeze({
        legendId,
        replayIds: uniqueIds(records.map((value) => value.replayId)),
        roomId: records[0]?.roomId ?? null,
        relations: uniqueIds(records.map((value) => value.relation)),
      });
    }),
  );
}

export function buildRoomReplayHeatmap(
  indexer: ReplayMomentIndexer,
  roomId: ChatRoomId,
): Readonly<Record<string, number>> {
  const heat: Record<string, number> = {};
  for (const record of indexer.listByRoom(roomId)) {
    const key = `${record.replayId}:${record.relation}`;
    heat[key] = (heat[key] ?? 0) + 1;
  }
  return freezeRecord(heat);
}

export function listReplaysForLegendClass(
  indexer: ReplayMomentIndexer,
  legendClass: string,
): readonly ChatReplayId[] {
  const replayIds: ChatReplayId[] = [];
  const snapshot = (indexer as unknown as { byRoom: Map<ChatRoomId, readonly ReplayMomentIndexRecord[]> }).byRoom;
  for (const records of snapshot.values()) {
    for (const record of records) {
      if (String(record.metadata.legendClass ?? '') === legendClass) replayIds.push(record.replayId);
    }
  }
  return uniqueIds(replayIds);
}

export function filterReplayMomentRelations(
  indexer: ReplayMomentIndexer,
  roomId: ChatRoomId,
  relation: ReplayMomentIndexRecord['relation'],
): readonly ReplayMomentIndexRecord[] {
  return freezeArray(indexer.listByRoom(roomId).filter((value) => value.relation === relation));
}

// ============================================================================
// MARK: Thin creation helpers
// ============================================================================

export function createReplayMomentIndexer(
  config: Partial<ReplayMomentIndexerConfig> = {},
): ReplayMomentIndexer {
  return new ReplayMomentIndexer(config);
}

// ============================================================================
// MARK: Module manifest
// ============================================================================

export const BACKEND_CHAT_REPLAY_MOMENT_INDEXER_MODULE_NAME = 'PZO_BACKEND_CHAT_REPLAY_MOMENT_INDEXER' as const;

export const BACKEND_CHAT_REPLAY_MOMENT_INDEXER_MANIFEST = Object.freeze({
  moduleName: BACKEND_CHAT_REPLAY_MOMENT_INDEXER_MODULE_NAME,
  version: '1.0.0',
  path: '/backend/src/game/engine/chat/rewards/ReplayMomentIndexer.ts',
  authorities: Object.freeze({
    backendRewardsRoot: '/backend/src/game/engine/chat/rewards',
    backendReplayRoot: '/backend/src/game/engine/chat/replay',
  }),
  owns: Object.freeze([
    'replay-to-legend cross indexing',
    'message/sequence prestige lookup',
    'transport replay prestige bundles',
    'replay prestige coverage audit',
  ] as const),
  dependsOn: Object.freeze([
    '../types',
    '../replay/ChatReplayAssembler',
    '../replay/ChatReplayIndex',
    './LegendMomentLedger',
  ] as const),
} as const);

export const ChatReplayMomentIndexerModule = Object.freeze({
  moduleName: BACKEND_CHAT_REPLAY_MOMENT_INDEXER_MODULE_NAME,
  manifest: BACKEND_CHAT_REPLAY_MOMENT_INDEXER_MANIFEST,
  defaults: DEFAULT_REPLAY_MOMENT_INDEXER_CONFIG,
  createReplayMomentIndexer,
  ReplayMomentIndexer,
} as const);
