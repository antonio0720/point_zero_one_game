/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT REPLAY MOMENT INDEXER
 * FILE: backend/src/game/engine/chat/rewards/ReplayMomentIndexer.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
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

// ============================================================================
// MARK: Prestige beat density
// ============================================================================

export interface ReplayPrestigeDensityBand {
  readonly replayId: ChatReplayId;
  readonly roomId: ChatRoomId;
  readonly legendCount: number;
  readonly uniqueClasses: number;
  readonly densityScore01: number;
  readonly peakRelation: ReplayMomentIndexRecord['relation'] | null;
}

export function computeReplayPrestigeDensity(
  indexer: ReplayMomentIndexer,
  replayId: ChatReplayId,
): ReplayPrestigeDensityBand | null {
  const records = indexer.listByReplayId(replayId);
  if (records.length === 0) return null;
  const roomId = records[0].roomId;
  const uniqueClasses = new Set(records.map((r) => String(r.metadata.legendClass ?? ''))).size;
  const densityScore01 = Math.min(1, records.length / 10);
  const relationCounts = new Map<string, number>();
  for (const r of records) {
    relationCounts.set(r.relation, (relationCounts.get(r.relation) ?? 0) + 1);
  }
  let peakRelation: ReplayMomentIndexRecord['relation'] | null = null;
  let peakCount = 0;
  for (const [rel, count] of relationCounts) {
    if (count > peakCount) {
      peakCount = count;
      peakRelation = rel as ReplayMomentIndexRecord['relation'];
    }
  }
  return Object.freeze({ replayId, roomId, legendCount: records.length, uniqueClasses, densityScore01, peakRelation });
}

export function rankReplaysByPrestigeDensity(
  indexer: ReplayMomentIndexer,
  replayIds: readonly ChatReplayId[],
): readonly ReplayPrestigeDensityBand[] {
  return freezeArray(
    replayIds
      .map((id) => computeReplayPrestigeDensity(indexer, id))
      .filter((b): b is ReplayPrestigeDensityBand => b !== null)
      .sort((a, b) => b.densityScore01 - a.densityScore01),
  );
}

// ============================================================================
// MARK: Sequence gap detection
// ============================================================================

export interface ReplaySequenceGap {
  readonly replayId: ChatReplayId;
  readonly roomId: ChatRoomId;
  readonly gapStart: SequenceNumber;
  readonly gapEnd: SequenceNumber;
  readonly gapLength: number;
  readonly hasLegendInGap: boolean;
}

export function detectSequenceGaps(
  indexer: ReplayMomentIndexer,
  replayArtifacts: readonly ChatReplayArtifact[],
  legendSnapshot: LegendMomentLedgerSnapshot,
  minGapLength = 5,
): readonly ReplaySequenceGap[] {
  const gaps: ReplaySequenceGap[] = [];

  for (const artifact of replayArtifacts) {
    const window = (artifact.range as {
      startSequence?: SequenceNumber | number;
      endSequence?: SequenceNumber | number;
    });
    const start = Number(window.startSequence ?? 0);
    const end = Number(window.endSequence ?? 0);
    if (end - start < minGapLength * 2) continue;

    const records = indexer.listByReplayId(artifact.id);
    const coveredSequences = new Set<number>(
      records.map((r) => Number(r.sequenceDistance ?? 0)),
    );

    let gapStart: number | null = null;
    for (let seq = start; seq <= end; seq += 1) {
      const covered = coveredSequences.has(seq - start);
      if (!covered && gapStart === null) {
        gapStart = seq;
      } else if (covered && gapStart !== null) {
        const gapLength = seq - gapStart;
        if (gapLength >= minGapLength) {
          const roomLegends = legendSnapshot.byRoom[artifact.roomId] ?? [];
          const hasLegendInGap = roomLegends.some((l) => {
            const ls = l.roomSequence ?? 0;
            return ls >= gapStart! && ls < seq;
          });
          gaps.push(Object.freeze({
            replayId: artifact.id,
            roomId: artifact.roomId,
            gapStart: asSequenceNumber(gapStart),
            gapEnd: asSequenceNumber(seq - 1),
            gapLength,
            hasLegendInGap,
          }));
        }
        gapStart = null;
      }
    }
  }

  return freezeArray(gaps);
}

// ============================================================================
// MARK: Legend class replay distribution
// ============================================================================

export interface LegendClassReplayDistribution {
  readonly legendClass: string;
  readonly replayCount: number;
  readonly totalLinks: number;
  readonly primaryReplayIds: readonly ChatReplayId[];
  readonly distributionScore01: number;
}

export function buildLegendClassReplayDistribution(
  indexer: ReplayMomentIndexer,
  legendSnapshot: LegendMomentLedgerSnapshot,
): readonly LegendClassReplayDistribution[] {
  const byClass = new Map<string, { replays: Set<ChatReplayId>; links: number; primaries: ChatReplayId[] }>();

  for (const record of Object.values(legendSnapshot.byId)) {
    const cls = String(record.legendClass);
    const entry = byClass.get(cls) ?? { replays: new Set(), links: 0, primaries: [] };
    const links = indexer.listByLegendId(record.legendId);
    for (const link of links) {
      entry.replays.add(link.replayId);
      entry.links += 1;
    }
    if (record.replay.primaryReplayId) entry.primaries.push(record.replay.primaryReplayId);
    byClass.set(cls, entry);
  }

  const allReplayCount = Math.max(1, new Set(Object.values(legendSnapshot.byId).flatMap((r) => r.replay.replayIds)).size);

  return freezeArray(
    [...byClass.entries()].map(([legendClass, entry]) => Object.freeze({
      legendClass,
      replayCount: entry.replays.size,
      totalLinks: entry.links,
      primaryReplayIds: freezeArray(uniqueIds(entry.primaries)),
      distributionScore01: Math.min(1, entry.replays.size / allReplayCount),
    })),
  );
}

// ============================================================================
// MARK: Anchor density scoring
// ============================================================================

export interface ReplayAnchorDensity {
  readonly replayId: ChatReplayId;
  readonly anchorCount: number;
  readonly uniqueAnchorKeys: readonly string[];
  readonly anchorDensityScore01: number;
}

export function computeAnchorDensity(
  indexer: ReplayMomentIndexer,
  replayId: ChatReplayId,
): ReplayAnchorDensity {
  const records = indexer.listByReplayId(replayId).filter((r) => r.anchorKey !== null);
  const uniqueAnchorKeys = uniqueIds(records.map((r) => r.anchorKey!));
  const anchorDensityScore01 = Math.min(1, uniqueAnchorKeys.length / 6);
  return Object.freeze({ replayId, anchorCount: records.length, uniqueAnchorKeys, anchorDensityScore01 });
}

export function rankReplaysByAnchorDensity(
  indexer: ReplayMomentIndexer,
  replayIds: readonly ChatReplayId[],
): readonly ReplayAnchorDensity[] {
  return freezeArray(
    replayIds
      .map((id) => computeAnchorDensity(indexer, id))
      .sort((a, b) => b.anchorDensityScore01 - a.anchorDensityScore01),
  );
}

// ============================================================================
// MARK: Replay clustering
// ============================================================================

export interface ReplayMomentCluster {
  readonly clusterId: string;
  readonly roomId: ChatRoomId;
  readonly replayIds: readonly ChatReplayId[];
  readonly legendIds: readonly LegendMomentRecord['legendId'][];
  readonly centerSequence: SequenceNumber;
  readonly spanSequences: number;
  readonly densityScore01: number;
}

export function clusterReplayMomentsByProximity(
  indexer: ReplayMomentIndexer,
  roomId: ChatRoomId,
  sequenceRadius = 15,
): readonly ReplayMomentCluster[] {
  const allRecords = indexer.listByRoom(roomId);
  if (allRecords.length === 0) return Object.freeze([]);

  const sorted = [...allRecords].sort((a, b) =>
    Number(a.sequenceDistance ?? 0) - Number(b.sequenceDistance ?? 0),
  );

  const clusters: ReplayMomentCluster[] = [];
  const used = new Set<string>();

  for (const pivot of sorted) {
    const pivotSeq = Number(pivot.sequenceDistance ?? 0);
    const key = `${pivot.replayId}:${pivot.legendId}`;
    if (used.has(key)) continue;

    const members = sorted.filter((r) => {
      const dist = Math.abs(Number(r.sequenceDistance ?? 0) - pivotSeq);
      return dist <= sequenceRadius;
    });

    for (const m of members) used.add(`${m.replayId}:${m.legendId}`);

    const replayIds = uniqueIds(members.map((r) => r.replayId));
    const legendIds = uniqueIds(members.map((r) => r.legendId));
    const seqs = members.map((r) => Number(r.sequenceDistance ?? 0));
    const minSeq = Math.min(...seqs);
    const maxSeq = Math.max(...seqs);
    const centerSeq = Math.round((minSeq + maxSeq) / 2);
    const spanSequences = maxSeq - minSeq;

    clusters.push(Object.freeze({
      clusterId: `cluster:${roomId}:${centerSeq}:${hashCluster(replayIds)}`,
      roomId,
      replayIds,
      legendIds,
      centerSequence: asSequenceNumber(centerSeq),
      spanSequences,
      densityScore01: Math.min(1, members.length / 8),
    }));
  }

  return freezeArray(clusters.sort((a, b) => b.densityScore01 - a.densityScore01));
}

function hashCluster(ids: readonly string[]): string {
  const seed = ids.slice(0, 4).join('|');
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).slice(0, 6);
}

// ============================================================================
// MARK: Temporal replay windows
// ============================================================================

export interface ReplayTemporalWindow {
  readonly windowId: string;
  readonly roomId: ChatRoomId;
  readonly startAt: UnixMs;
  readonly endAt: UnixMs;
  readonly durationMs: number;
  readonly legendIds: readonly LegendMomentRecord['legendId'][];
  readonly replayIds: readonly ChatReplayId[];
  readonly momentCount: number;
}

export function buildTemporalReplayWindows(
  indexer: ReplayMomentIndexer,
  roomId: ChatRoomId,
  legendSnapshot: LegendMomentLedgerSnapshot,
  windowDurationMs = 1000 * 60 * 5,
): readonly ReplayTemporalWindow[] {
  const roomLegends = [...(legendSnapshot.byRoom[roomId] ?? [])].sort(
    (a, b) => Number(a.createdAt) - Number(b.createdAt),
  );
  if (roomLegends.length === 0) return Object.freeze([]);

  const windows: ReplayTemporalWindow[] = [];
  let windowStart = Number(roomLegends[0].createdAt);
  const roomEnd = Number(roomLegends[roomLegends.length - 1].createdAt) + windowDurationMs;

  for (let start = windowStart; start < roomEnd; start += windowDurationMs) {
    const end = start + windowDurationMs;
    const legends = roomLegends.filter(
      (l) => Number(l.createdAt) >= start && Number(l.createdAt) < end,
    );
    const legendIds = uniqueIds(legends.map((l) => l.legendId));
    const replayIds = uniqueIds(
      legendIds.flatMap((id) => indexer.listByLegendId(id).map((r) => r.replayId)),
    );
    windows.push(Object.freeze({
      windowId: `temporal:${roomId}:${start}:${end}`,
      roomId,
      startAt: asUnixMs(start),
      endAt: asUnixMs(end),
      durationMs: windowDurationMs,
      legendIds,
      replayIds,
      momentCount: legends.length,
    }));
    windowStart = start;
  }

  return freezeArray(windows.filter((w) => w.momentCount > 0));
}

// ============================================================================
// MARK: Coverage decay scoring
// ============================================================================

export interface ReplayMomentCoverageDecay {
  readonly legendId: LegendMomentRecord['legendId'];
  readonly roomId: ChatRoomId;
  readonly linkedReplayCount: number;
  readonly coverageDecayScore01: number;
  readonly isOrphaned: boolean;
  readonly ageMs: number;
}

const COVERAGE_DECAY_HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 7;

export function computeCoverageDecay(
  indexer: ReplayMomentIndexer,
  legendRecord: LegendMomentRecord,
  now: UnixMs = asUnixMs(Date.now()),
): ReplayMomentCoverageDecay {
  const links = indexer.listByLegendId(legendRecord.legendId);
  const ageMs = Math.max(0, Number(now) - Number(legendRecord.createdAt));
  const decayFactor = Math.pow(0.5, ageMs / COVERAGE_DECAY_HALF_LIFE_MS);
  const coverageDecayScore01 = links.length > 0 ? Math.min(1, links.length * 0.3) * decayFactor : 0;
  return Object.freeze({
    legendId: legendRecord.legendId,
    roomId: legendRecord.roomId,
    linkedReplayCount: links.length,
    coverageDecayScore01,
    isOrphaned: links.length === 0,
    ageMs,
  });
}

export function listOrphanedLegends(
  indexer: ReplayMomentIndexer,
  legendSnapshot: LegendMomentLedgerSnapshot,
  now: UnixMs = asUnixMs(Date.now()),
): readonly ReplayMomentCoverageDecay[] {
  return freezeArray(
    Object.values(legendSnapshot.byId)
      .map((record) => computeCoverageDecay(indexer, record, now))
      .filter((decay) => decay.isOrphaned),
  );
}

// ============================================================================
// MARK: Indexer profile system
// ============================================================================

export type ReplayMomentIndexerProfile =
  | 'STANDARD'
  | 'CINEMATIC'
  | 'FORENSIC'
  | 'MINIMAL'
  | 'DENSE';

export const REPLAY_MOMENT_INDEXER_PROFILES: Readonly<Record<ReplayMomentIndexerProfile, Partial<ReplayMomentIndexerConfig>>> = Object.freeze({
  STANDARD: Object.freeze({}),
  CINEMATIC: Object.freeze({
    maxLinksPerLegend: 24,
    maxLinksPerReplay: 64,
    sequenceDistanceGrace: 40,
    timestampDistanceGraceMs: 1000 * 60 * 5,
  }),
  FORENSIC: Object.freeze({
    maxLinksPerLegend: 64,
    maxLinksPerReplay: 128,
    sequenceDistanceGrace: 8,
    timestampDistanceGraceMs: 1000 * 60,
  }),
  MINIMAL: Object.freeze({
    maxLinksPerLegend: 4,
    maxLinksPerReplay: 8,
    sequenceDistanceGrace: 5,
    timestampDistanceGraceMs: 1000 * 30,
  }),
  DENSE: Object.freeze({
    maxLinksPerLegend: 32,
    maxLinksPerReplay: 96,
    sequenceDistanceGrace: 60,
    timestampDistanceGraceMs: 1000 * 60 * 10,
  }),
});

export function createReplayMomentIndexerFromProfile(
  profile: ReplayMomentIndexerProfile,
  overrides: Partial<ReplayMomentIndexerConfig> = {},
): ReplayMomentIndexer {
  const profileConfig = REPLAY_MOMENT_INDEXER_PROFILES[profile] ?? {};
  return createReplayMomentIndexer({ ...profileConfig, ...overrides });
}

export function createCinematicReplayMomentIndexer(overrides: Partial<ReplayMomentIndexerConfig> = {}): ReplayMomentIndexer {
  return createReplayMomentIndexerFromProfile('CINEMATIC', overrides);
}

export function createForensicReplayMomentIndexer(overrides: Partial<ReplayMomentIndexerConfig> = {}): ReplayMomentIndexer {
  return createReplayMomentIndexerFromProfile('FORENSIC', overrides);
}

export function createMinimalReplayMomentIndexer(overrides: Partial<ReplayMomentIndexerConfig> = {}): ReplayMomentIndexer {
  return createReplayMomentIndexerFromProfile('MINIMAL', overrides);
}

export function createDenseReplayMomentIndexer(overrides: Partial<ReplayMomentIndexerConfig> = {}): ReplayMomentIndexer {
  return createReplayMomentIndexerFromProfile('DENSE', overrides);
}

// ============================================================================
// MARK: Batch rebuild helpers
// ============================================================================

export interface ReplayMomentIndexRebuildResult {
  readonly replayCount: number;
  readonly legendCount: number;
  readonly linkedRecordCount: number;
  readonly unlinkedLegendCount: number;
  readonly rebuildDurationMs: number;
}

export function rebuildAndAudit(
  indexer: ReplayMomentIndexer,
  replayArtifacts: readonly ChatReplayArtifact[],
  legendSnapshot: LegendMomentLedgerSnapshot,
): ReplayMomentIndexRebuildResult {
  const start = Date.now();
  indexer.rebuild(replayArtifacts, legendSnapshot);
  const linkedLegendIds = new Set(
    replayArtifacts.flatMap((a) => indexer.listByReplayId(a.id).map((r) => r.legendId)),
  );
  const allLegendIds = Object.keys(legendSnapshot.byId);
  const unlinkedLegendCount = allLegendIds.filter((id) => !linkedLegendIds.has(id as any)).length;
  const linkedRecordCount = replayArtifacts.reduce((acc, a) => acc + indexer.listByReplayId(a.id).length, 0);

  return Object.freeze({
    replayCount: replayArtifacts.length,
    legendCount: allLegendIds.length,
    linkedRecordCount,
    unlinkedLegendCount,
    rebuildDurationMs: Date.now() - start,
  });
}

export function partialRebuildForRoom(
  indexer: ReplayMomentIndexer,
  roomId: ChatRoomId,
  replayArtifacts: readonly ChatReplayArtifact[],
  legendSnapshot: LegendMomentLedgerSnapshot,
): void {
  const roomArtifacts = replayArtifacts.filter((a) => a.roomId === roomId);
  const roomLegends = legendSnapshot.byRoom[roomId] ?? Object.freeze([]);
  const partialSnapshot: LegendMomentLedgerSnapshot = Object.freeze({
    byId: Object.freeze(Object.fromEntries(roomLegends.map((l) => [l.legendId, l]))) as any,
    byRoom: Object.freeze({ [roomId]: roomLegends } as Record<ChatRoomId, readonly LegendMomentRecord[]>),
    roomPrestige: Object.freeze({}) as any,
  });
  indexer.rebuild(roomArtifacts, partialSnapshot);
}

// ============================================================================
// MARK: Prestige relay heat scoring
// ============================================================================

export interface ReplayPrestigeHeatScore {
  readonly replayId: ChatReplayId;
  readonly roomId: ChatRoomId;
  readonly heatScore01: number;
  readonly primaryLinkCount: number;
  readonly secondaryLinkCount: number;
  readonly anchorMatchCount: number;
  readonly sequenceOverlapCount: number;
}

export function computeReplayPrestigeHeat(
  indexer: ReplayMomentIndexer,
  replayId: ChatReplayId,
): ReplayPrestigeHeatScore | null {
  const records = indexer.listByReplayId(replayId);
  if (records.length === 0) return null;
  const roomId = records[0].roomId;

  const primaryLinkCount = records.filter((r) => r.relation === 'PRIMARY_REPLAY').length;
  const secondaryLinkCount = records.filter((r) => r.relation === 'SECONDARY_REPLAY').length;
  const anchorMatchCount = records.filter((r) => r.relation === 'ANCHOR_KEY_MATCH').length;
  const sequenceOverlapCount = records.filter((r) => r.relation === 'SEQUENCE_OVERLAP').length;

  const heatScore01 = Math.min(
    1,
    (primaryLinkCount * 0.40) +
    (anchorMatchCount * 0.30) +
    (secondaryLinkCount * 0.20) +
    (sequenceOverlapCount * 0.10),
  );

  return Object.freeze({ replayId, roomId, heatScore01, primaryLinkCount, secondaryLinkCount, anchorMatchCount, sequenceOverlapCount });
}

export function buildRoomPrestigeHeatRanking(
  indexer: ReplayMomentIndexer,
  roomId: ChatRoomId,
): readonly ReplayPrestigeHeatScore[] {
  const replayIds = uniqueIds(indexer.listByRoom(roomId).map((r) => r.replayId));
  return freezeArray(
    replayIds
      .map((id) => computeReplayPrestigeHeat(indexer, id))
      .filter((s): s is ReplayPrestigeHeatScore => s !== null)
      .sort((a, b) => b.heatScore01 - a.heatScore01),
  );
}

// ============================================================================
// MARK: Cross-room replay comparison
// ============================================================================

export interface CrossRoomReplayComparison {
  readonly roomA: ChatRoomId;
  readonly roomB: ChatRoomId;
  readonly sharedReplayIds: readonly ChatReplayId[];
  readonly uniqueToRoomA: readonly ChatReplayId[];
  readonly uniqueToRoomB: readonly ChatReplayId[];
  readonly legendOverlapIds: readonly LegendMomentRecord['legendId'][];
  readonly comparisonScore01: number;
}

export function compareRoomReplayPrestige(
  indexer: ReplayMomentIndexer,
  roomA: ChatRoomId,
  roomB: ChatRoomId,
): CrossRoomReplayComparison {
  const replayIdsA = new Set(indexer.listByRoom(roomA).map((r) => r.replayId));
  const replayIdsB = new Set(indexer.listByRoom(roomB).map((r) => r.replayId));
  const legendIdsA = new Set(indexer.listByRoom(roomA).map((r) => r.legendId));
  const legendIdsB = new Set(indexer.listByRoom(roomB).map((r) => r.legendId));

  const sharedReplayIds = uniqueIds([...replayIdsA].filter((id) => replayIdsB.has(id)));
  const legendOverlapIds = uniqueIds([...legendIdsA].filter((id) => legendIdsB.has(id)));
  const totalUnique = replayIdsA.size + replayIdsB.size;
  const comparisonScore01 = totalUnique > 0 ? sharedReplayIds.length / Math.max(1, totalUnique / 2) : 0;

  return Object.freeze({
    roomA,
    roomB,
    sharedReplayIds,
    uniqueToRoomA: uniqueIds([...replayIdsA].filter((id) => !replayIdsB.has(id))),
    uniqueToRoomB: uniqueIds([...replayIdsB].filter((id) => !replayIdsA.has(id))),
    legendOverlapIds,
    comparisonScore01: Math.min(1, comparisonScore01),
  });
}

// ============================================================================
// MARK: Transcript correlation
// ============================================================================

export interface ReplayTranscriptCorrelation {
  readonly legendId: LegendMomentRecord['legendId'];
  readonly replayId: ChatReplayId | null;
  readonly primaryMessageId: ChatMessageId | null;
  readonly witnessMessageCount: number;
  readonly correlationScore01: number;
}

export function buildTranscriptCorrelations(
  indexer: ReplayMomentIndexer,
  legendSnapshot: LegendMomentLedgerSnapshot,
): readonly ReplayTranscriptCorrelation[] {
  return freezeArray(
    Object.values(legendSnapshot.byId).map((record) => {
      const links = indexer.listByLegendId(record.legendId);
      const replayId = indexer.findPrimaryReplayId(record.legendId);
      const witnessMessageCount = record.messages.witnessMessageIds.length;
      const correlationScore01 = Math.min(
        1,
        (links.length > 0 ? 0.45 : 0) +
        (record.messages.primaryMessageId ? 0.35 : 0) +
        Math.min(0.20, witnessMessageCount * 0.05),
      );
      return Object.freeze({
        legendId: record.legendId,
        replayId,
        primaryMessageId: record.messages.primaryMessageId,
        witnessMessageCount,
        correlationScore01,
      });
    }),
  );
}

// ============================================================================
// MARK: Doctrine notes
// ============================================================================

export const REPLAY_MOMENT_INDEXER_DOCTRINE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  RELATIONS: Object.freeze([
    'PRIMARY_REPLAY: the replay explicitly tagged as primary by the legend or reward system.',
    'SECONDARY_REPLAY: the replay is linked but not primary.',
    'ANCHOR_KEY_MATCH: the replay anchor key matches the legend anchor key.',
    'SEQUENCE_OVERLAP: the legend sequence number falls within the replay range ± grace.',
    'MESSAGE_PROXIMITY: the legend primary message is near a message covered by the replay.',
    'ROOM_PROXIMITY: the legend is in the same room as the replay but has no stronger bond.',
  ]),
  REBUILD: Object.freeze([
    'Rebuild is idempotent. Call it whenever replay artifacts or the legend snapshot changes.',
    'Partial rebuild is available per room to avoid full rescanning.',
    'Index records are bounded per legend and per replay by config limits.',
  ]),
  DECAY: Object.freeze([
    'Coverage decay is logarithmic over a configurable half-life.',
    'Orphaned legends (zero replay links) should be investigated before archival.',
    'Decay does not auto-archive — it is a signal surface only.',
  ]),
});

export const ChatReplayMomentIndexerProfileModule = Object.freeze({
  profiles: REPLAY_MOMENT_INDEXER_PROFILES,
  createFromProfile: createReplayMomentIndexerFromProfile,
  createCinematic: createCinematicReplayMomentIndexer,
  createForensic: createForensicReplayMomentIndexer,
  createMinimal: createMinimalReplayMomentIndexer,
  createDense: createDenseReplayMomentIndexer,
  density: computeReplayPrestigeDensity,
  heat: computeReplayPrestigeHeat,
  clusterByProximity: clusterReplayMomentsByProximity,
  compareRooms: compareRoomReplayPrestige,
  doctrine: REPLAY_MOMENT_INDEXER_DOCTRINE,
} as const);
