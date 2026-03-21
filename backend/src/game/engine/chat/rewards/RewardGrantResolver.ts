/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT REWARD GRANT RESOLVER
 * FILE: backend/src/game/engine/chat/rewards/RewardGrantResolver.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic backend resolution of prestige-linked rewards.
 *
 * This file converts authoritative legend records into authoritative reward
 * decisions. Frontend may celebrate a candidate reward and the shared contract
 * may define the reward grammar, but the backend must still own:
 *
 * - eligibility,
 * - deduplication,
 * - cooldown law,
 * - replay-safe entitlement mutation intent,
 * - grants vs previews,
 * - revocation and re-application,
 * - inventory and prestige snapshots for later transport.
 *
 * What this file owns
 * -------------------
 * - reward candidate extraction from legend records
 * - policy evaluation and rejection reasons
 * - per-user reward inventory snapshots
 * - replay-safe grant ids and scope ids
 * - duplicate suppression and cooldown enforcement
 * - grant journaling and revocation journaling
 *
 * What this file does not own
 * ---------------------------
 * - permanent database writes outside this in-memory authority bundle
 * - UI celebration treatment
 * - replay indexing
 * - legend admission
 *
 * Authority fit
 * -------------
 * - Consumes: rewards/LegendMomentLedger.ts
 * - Feeds: rewards/ReplayMomentIndexer.ts, transport, post-run, and profile sync
 * - Respects: /shared/contracts/chat/ChatReward.ts
 * ============================================================================
 */

import type {
  ChatLegendClass,
  ChatLegendEvent,
  ChatLegendRewardHint,
} from '../../../../../../shared/contracts/chat/ChatLegend';
import type {
  ChatRewardClass,
  ChatRewardGrant,
} from '../../../../../../shared/contracts/chat/ChatReward';
import {
  asUnixMs,
  type ChatLegendId,
  type ChatRoomId,
  type ChatUserId,
  type JsonValue,
  type UnixMs,
} from '../types';
import type {
  LegendMomentRecord,
  LegendMomentRoomPrestigeState,
} from './LegendMomentLedger';

// ============================================================================
// MARK: Reward resolver contracts
// ============================================================================

export type RewardGrantResolverDecision =
  | 'GRANTED'
  | 'PREVIEW_ONLY'
  | 'DENIED'
  | 'DUPLICATE'
  | 'COOLDOWN'
  | 'SUPPRESSED'
  | 'REVOKED';

export type RewardGrantResolverReasonCode =
  | 'LEGEND_NOT_FOUND'
  | 'LEGEND_NOT_ELIGIBLE'
  | 'LEGEND_ALREADY_GRANTED'
  | 'GRANT_CREATED'
  | 'PREVIEW_CREATED'
  | 'DUPLICATE_SCOPE_SUPPRESSED'
  | 'DUPLICATE_PAYLOAD_SUPPRESSED'
  | 'COOLDOWN_ACTIVE'
  | 'USER_CAP_REACHED'
  | 'ROOM_CAP_REACHED'
  | 'REPUTATION_GATE_FAILED'
  | 'REVOKED_BY_POLICY';

export interface RewardGrantResolverReason {
  readonly code: RewardGrantResolverReasonCode;
  readonly at: UnixMs;
  readonly detail: string;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface RewardGrantPreview {
  readonly previewId: string;
  readonly legendId: ChatLegendId;
  readonly roomId: ChatRoomId;
  readonly userId: ChatUserId;
  readonly rewardClass: ChatRewardClass;
  readonly scopeKey: string;
  readonly label: string;
  readonly payload: Readonly<Record<string, JsonValue>>;
}

export interface RewardGrantRecord {
  readonly grantId: string;
  readonly legendId: ChatLegendId;
  readonly roomId: ChatRoomId;
  readonly userId: ChatUserId;
  readonly rewardClass: ChatRewardClass;
  readonly scopeKey: string;
  readonly createdAt: UnixMs;
  readonly revokedAt: UnixMs | null;
  readonly previewOnly: boolean;
  readonly metadata: Readonly<Record<string, JsonValue>>;
  readonly sharedGrant: ChatRewardGrant | null;
}

export interface RewardInventorySnapshot {
  readonly userId: ChatUserId;
  readonly activeGrantIds: readonly string[];
  readonly activeByRewardClass: Readonly<Record<string, readonly string[]>>;
  readonly lastGrantedAtByRewardClass: Readonly<Record<string, UnixMs>>;
  readonly totalGrantedCount: number;
}

export interface RewardGrantResolverConfig {
  readonly cooldownMsByRewardClass: Readonly<Record<string, number>>;
  readonly maxActivePerRewardClass: Readonly<Record<string, number>>;
  readonly maxActiveRewardsPerUser: number;
  readonly maxRewardsPerRoomLegendBurst: number;
  readonly previewWhenBlocked: boolean;
}

export interface RewardGrantCandidate {
  readonly legendId: ChatLegendId;
  readonly roomId: ChatRoomId;
  readonly userId: ChatUserId;
  readonly rewardClass: ChatRewardClass;
  readonly scopeKey: string;
  readonly label: string;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface RewardGrantResolution {
  readonly decision: RewardGrantResolverDecision;
  readonly legendId: ChatLegendId;
  readonly userId: ChatUserId;
  readonly grants: readonly RewardGrantRecord[];
  readonly previews: readonly RewardGrantPreview[];
  readonly reasons: readonly RewardGrantResolverReason[];
  readonly inventory: RewardInventorySnapshot;
}

export interface RewardGrantResolutionBatch {
  readonly resolutions: readonly RewardGrantResolution[];
  readonly byLegendId: Readonly<Record<ChatLegendId, RewardGrantResolution>>;
}

const DEFAULT_REWARD_GRANT_RESOLVER_CONFIG: RewardGrantResolverConfig = Object.freeze({
  cooldownMsByRewardClass: Object.freeze({
    TITLE: 1000 * 60 * 60 * 12,
    AURA: 1000 * 60 * 30,
    BADGE: 1000 * 60 * 10,
    PHRASE: 1000 * 60 * 10,
    EMOJI: 1000 * 60 * 10,
  }),
  maxActivePerRewardClass: Object.freeze({
    TITLE: 8,
    AURA: 8,
    BADGE: 64,
    PHRASE: 64,
    EMOJI: 64,
  }),
  maxActiveRewardsPerUser: 512,
  maxRewardsPerRoomLegendBurst: 16,
  previewWhenBlocked: true,
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

function hashFragment(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, '0');
}

function buildReason(
  code: RewardGrantResolverReasonCode,
  detail: string,
  metadata: Readonly<Record<string, JsonValue>> = Object.freeze({}),
  at: UnixMs = nowUnixMs(),
): RewardGrantResolverReason {
  return Object.freeze({ code, detail, metadata, at });
}

function uniqueStrings<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function rewardHintsFromLegend(record: LegendMomentRecord): readonly ChatLegendRewardHint[] {
  return freezeArray(((record.acceptedEvent as { rewardHints?: readonly ChatLegendRewardHint[] }).rewardHints ?? []) as readonly ChatLegendRewardHint[]);
}

function rewardClassFromHint(hint: ChatLegendRewardHint): ChatRewardClass | null {
  return ((hint as { rewardClass?: ChatRewardClass | null }).rewardClass ?? null) as ChatRewardClass | null;
}

function rewardLabelFromHint(hint: ChatLegendRewardHint, legendClass: ChatLegendClass): string {
  return String((hint as { label?: string | null }).label ?? `${legendClass} reward`);
}

function rewardMetadataFromHint(hint: ChatLegendRewardHint): Readonly<Record<string, JsonValue>> {
  return freezeRecord(((hint as { metadata?: Readonly<Record<string, JsonValue>> }).metadata ?? {}) as Record<string, JsonValue>);
}

function rewardUserIdFromHint(hint: ChatLegendRewardHint): ChatUserId | null {
  return ((hint as { userId?: ChatUserId | null }).userId ?? null) as ChatUserId | null;
}

function legendUserId(record: LegendMomentRecord): ChatUserId | null {
  const trigger = record.triggerContext as { userId?: ChatUserId | null; actorUserId?: ChatUserId | null } | null;
  return trigger?.userId ?? trigger?.actorUserId ?? null;
}

function buildScopeKey(record: LegendMomentRecord, rewardClass: ChatRewardClass, userId: ChatUserId): string {
  return `reward-scope:${String(userId)}:${String(record.roomId)}:${String(record.legendId)}:${String(rewardClass)}`;
}

function buildGrantId(record: LegendMomentRecord, rewardClass: ChatRewardClass, userId: ChatUserId): string {
  return `grant:${String(record.legendId)}:${String(userId)}:${String(rewardClass)}:${hashFragment(buildScopeKey(record, rewardClass, userId))}`;
}

function buildPreviewId(record: LegendMomentRecord, rewardClass: ChatRewardClass, userId: ChatUserId): string {
  return `preview:${String(record.legendId)}:${String(userId)}:${String(rewardClass)}:${hashFragment(buildScopeKey(record, rewardClass, userId))}`;
}

function indexInventory(records: readonly RewardGrantRecord[], userId: ChatUserId): RewardInventorySnapshot {
  const active = records.filter((value) => value.userId === userId && value.revokedAt === null && !value.previewOnly);
  const activeByRewardClass: Record<string, string[]> = {};
  const lastGrantedAtByRewardClass: Record<string, UnixMs> = {} as Record<string, UnixMs>;
  for (const grant of active) {
    const key = String(grant.rewardClass);
    activeByRewardClass[key] = [...(activeByRewardClass[key] ?? []), grant.grantId];
    const previous = lastGrantedAtByRewardClass[key];
    if (!previous || Number(grant.createdAt) > Number(previous)) {
      lastGrantedAtByRewardClass[key] = grant.createdAt;
    }
  }
  return Object.freeze({
    userId,
    activeGrantIds: freezeArray(active.map((value) => value.grantId)),
    activeByRewardClass: freezeRecord(
      Object.fromEntries(Object.entries(activeByRewardClass).map(([key, value]) => [key, freezeArray(value)])) as Record<string, readonly string[]>,
    ),
    lastGrantedAtByRewardClass: freezeRecord(lastGrantedAtByRewardClass),
    totalGrantedCount: active.length,
  });
}

// ============================================================================
// MARK: Resolver implementation
// ============================================================================

export class RewardGrantResolver {
  private readonly config: RewardGrantResolverConfig;

  private readonly grants = new Map<string, RewardGrantRecord>();

  private readonly grantsByLegend = new Map<ChatLegendId, readonly string[]>();

  private readonly grantsByUser = new Map<ChatUserId, readonly string[]>();

  private readonly grantsByScope = new Map<string, string>();

  public constructor(config: Partial<RewardGrantResolverConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_REWARD_GRANT_RESOLVER_CONFIG,
      ...config,
      cooldownMsByRewardClass: Object.freeze({
        ...DEFAULT_REWARD_GRANT_RESOLVER_CONFIG.cooldownMsByRewardClass,
        ...(config.cooldownMsByRewardClass ?? {}),
      }),
      maxActivePerRewardClass: Object.freeze({
        ...DEFAULT_REWARD_GRANT_RESOLVER_CONFIG.maxActivePerRewardClass,
        ...(config.maxActivePerRewardClass ?? {}),
      }),
    });
  }

  public getConfig(): RewardGrantResolverConfig {
    return this.config;
  }

  public listAllGrantRecords(): readonly RewardGrantRecord[] {
    return freezeArray([...this.grants.values()].sort((a, b) => Number(a.createdAt) - Number(b.createdAt)));
  }

  public listGrantsByLegend(legendId: ChatLegendId): readonly RewardGrantRecord[] {
    const ids = this.grantsByLegend.get(legendId) ?? Object.freeze([]);
    return freezeArray(ids.map((value) => this.grants.get(value)).filter((value): value is RewardGrantRecord => Boolean(value)));
  }

  public listActiveGrantsByUser(userId: ChatUserId): readonly RewardGrantRecord[] {
    const ids = this.grantsByUser.get(userId) ?? Object.freeze([]);
    return freezeArray(
      ids
        .map((value) => this.grants.get(value))
        .filter((value): value is RewardGrantRecord => Boolean(value))
        .filter((value) => value.revokedAt === null && !value.previewOnly),
    );
  }

  public buildInventorySnapshot(userId: ChatUserId): RewardInventorySnapshot {
    return indexInventory(this.listAllGrantRecords(), userId);
  }

  public resolveLegendRewards(record: LegendMomentRecord): RewardGrantResolution {
    const candidates = this.buildCandidates(record);
    if (candidates.length === 0) {
      const userId = legendUserId(record) ?? ('reward-user:unknown' as ChatUserId);
      return Object.freeze({
        decision: 'DENIED',
        legendId: record.legendId,
        userId,
        grants: Object.freeze([]),
        previews: Object.freeze([]),
        reasons: Object.freeze([buildReason('LEGEND_NOT_ELIGIBLE', 'Legend record did not produce reward candidates.')]),
        inventory: this.buildInventorySnapshot(userId),
      });
    }

    const grants: RewardGrantRecord[] = [];
    const previews: RewardGrantPreview[] = [];
    const reasons: RewardGrantResolverReason[] = [];

    const byRoomCount = candidates.filter((value) => value.roomId === record.roomId).length;
    if (byRoomCount > this.config.maxRewardsPerRoomLegendBurst) {
      reasons.push(buildReason('ROOM_CAP_REACHED', 'Room legend burst exceeded configured reward cap.', {
        roomId: String(record.roomId),
        candidateCount: byRoomCount,
      }));
      return Object.freeze({
        decision: this.config.previewWhenBlocked ? 'PREVIEW_ONLY' : 'DENIED',
        legendId: record.legendId,
        userId: candidates[0].userId,
        grants: Object.freeze([]),
        previews: this.config.previewWhenBlocked ? freezeArray(candidates.map((value) => this.toPreview(record, value))) : Object.freeze([]),
        reasons: freezeArray(reasons),
        inventory: this.buildInventorySnapshot(candidates[0].userId),
      });
    }

    for (const candidate of candidates) {
      const inventory = this.buildInventorySnapshot(candidate.userId);
      const activeForClass = inventory.activeByRewardClass[String(candidate.rewardClass)] ?? Object.freeze([]);
      const maxForClass = this.config.maxActivePerRewardClass[String(candidate.rewardClass)] ?? Number.MAX_SAFE_INTEGER;
      const cooldownMs = this.config.cooldownMsByRewardClass[String(candidate.rewardClass)] ?? 0;
      const lastGrantedAt = inventory.lastGrantedAtByRewardClass[String(candidate.rewardClass)] ?? null;
      const existingScopeGrantId = this.grantsByScope.get(candidate.scopeKey) ?? null;

      if (existingScopeGrantId) {
        reasons.push(buildReason('DUPLICATE_SCOPE_SUPPRESSED', 'Reward scope already has an active or historical grant.', {
          scopeKey: candidate.scopeKey,
          existingScopeGrantId,
        }));
        if (this.config.previewWhenBlocked) previews.push(this.toPreview(record, candidate));
        continue;
      }

      if (inventory.totalGrantedCount >= this.config.maxActiveRewardsPerUser) {
        reasons.push(buildReason('USER_CAP_REACHED', 'User has reached the configured active reward ceiling.', {
          userId: String(candidate.userId),
          totalGrantedCount: inventory.totalGrantedCount,
        }));
        if (this.config.previewWhenBlocked) previews.push(this.toPreview(record, candidate));
        continue;
      }

      if (activeForClass.length >= maxForClass) {
        reasons.push(buildReason('USER_CAP_REACHED', 'User reached the per-class reward ceiling.', {
          userId: String(candidate.userId),
          rewardClass: String(candidate.rewardClass),
          activeForClass: activeForClass.length,
          maxForClass,
        }));
        if (this.config.previewWhenBlocked) previews.push(this.toPreview(record, candidate));
        continue;
      }

      if (lastGrantedAt && Number(nowUnixMs()) - Number(lastGrantedAt) < cooldownMs) {
        reasons.push(buildReason('COOLDOWN_ACTIVE', 'Reward class cooldown is still active for this user.', {
          userId: String(candidate.userId),
          rewardClass: String(candidate.rewardClass),
          lastGrantedAt,
          cooldownMs,
        }));
        if (this.config.previewWhenBlocked) previews.push(this.toPreview(record, candidate));
        continue;
      }

      const grantRecord = this.materializeGrant(record, candidate);
      this.storeGrant(grantRecord);
      grants.push(grantRecord);
      reasons.push(buildReason('GRANT_CREATED', 'Authoritative reward grant created from legend record.', {
        grantId: grantRecord.grantId,
        rewardClass: String(grantRecord.rewardClass),
      }));
    }

    const decision: RewardGrantResolverDecision =
      grants.length > 0 ? 'GRANTED' : previews.length > 0 ? 'PREVIEW_ONLY' : 'DENIED';
    const inventory = this.buildInventorySnapshot(candidates[0].userId);

    return Object.freeze({
      decision,
      legendId: record.legendId,
      userId: candidates[0].userId,
      grants: freezeArray(grants),
      previews: freezeArray(previews),
      reasons: freezeArray(reasons),
      inventory,
    });
  }

  public resolveBatch(records: readonly LegendMomentRecord[]): RewardGrantResolutionBatch {
    const resolutions = freezeArray(records.map((value) => this.resolveLegendRewards(value)));
    const byLegendId = Object.fromEntries(resolutions.map((value) => [value.legendId, value])) as Record<ChatLegendId, RewardGrantResolution>;
    return Object.freeze({ resolutions, byLegendId: freezeRecord(byLegendId) });
  }

  public revokeLegendRewards(legendId: ChatLegendId, revokedAt: UnixMs = nowUnixMs()): readonly RewardGrantRecord[] {
    const records = this.listGrantsByLegend(legendId);
    const revoked: RewardGrantRecord[] = [];
    for (const record of records) {
      if (record.revokedAt) continue;
      const updated: RewardGrantRecord = Object.freeze({
        ...record,
        revokedAt,
        metadata: freezeRecord({ ...record.metadata, revokedAt }),
      });
      this.grants.set(updated.grantId, updated);
      revoked.push(updated);
    }
    return freezeArray(revoked);
  }

  public previewLegendRewards(record: LegendMomentRecord): readonly RewardGrantPreview[] {
    return freezeArray(this.buildCandidates(record).map((value) => this.toPreview(record, value)));
  }

  public summarizeRoomPrestigeRewards(roomPrestige: LegendMomentRoomPrestigeState): Readonly<{
    roomId: ChatRoomId;
    grantedLegendIds: readonly ChatLegendId[];
    totalGrants: number;
  }> {
    const grantedLegendIds = freezeArray(
      roomPrestige.legendIds.filter((legendId) => this.listGrantsByLegend(legendId).some((value) => value.revokedAt === null)),
    );
    return Object.freeze({
      roomId: roomPrestige.roomId,
      grantedLegendIds,
      totalGrants: grantedLegendIds.reduce((count, legendId) => count + this.listGrantsByLegend(legendId).length, 0),
    });
  }

  private buildCandidates(record: LegendMomentRecord): readonly RewardGrantCandidate[] {
    const candidates: RewardGrantCandidate[] = [];
    const explicitHints = rewardHintsFromLegend(record);
    const defaultUserId = legendUserId(record);

    for (const hint of explicitHints) {
      const rewardClass = rewardClassFromHint(hint);
      const userId = rewardUserIdFromHint(hint) ?? defaultUserId;
      if (!rewardClass || !userId) continue;
      candidates.push(Object.freeze({
        legendId: record.legendId,
        roomId: record.roomId,
        userId,
        rewardClass,
        scopeKey: buildScopeKey(record, rewardClass, userId),
        label: rewardLabelFromHint(hint, record.legendClass),
        metadata: freezeRecord({
          ...rewardMetadataFromHint(hint),
          legendClass: record.legendClass,
          legendTier: record.tier,
          legendSeverity: record.severity,
        }),
      }));
    }

    return freezeArray(uniqueStrings(candidates.map((value) => JSON.stringify(value))).map((key) => JSON.parse(key) as RewardGrantCandidate));
  }

  private materializeGrant(record: LegendMomentRecord, candidate: RewardGrantCandidate): RewardGrantRecord {
    const createdAt = nowUnixMs();
    return Object.freeze({
      grantId: buildGrantId(record, candidate.rewardClass, candidate.userId),
      legendId: candidate.legendId,
      roomId: candidate.roomId,
      userId: candidate.userId,
      rewardClass: candidate.rewardClass,
      scopeKey: candidate.scopeKey,
      createdAt,
      revokedAt: null,
      previewOnly: false,
      metadata: freezeRecord({
        ...candidate.metadata,
        createdAt,
        label: candidate.label,
      }),
      sharedGrant: null,
    });
  }

  private toPreview(record: LegendMomentRecord, candidate: RewardGrantCandidate): RewardGrantPreview {
    return Object.freeze({
      previewId: buildPreviewId(record, candidate.rewardClass, candidate.userId),
      legendId: candidate.legendId,
      roomId: candidate.roomId,
      userId: candidate.userId,
      rewardClass: candidate.rewardClass,
      scopeKey: candidate.scopeKey,
      label: candidate.label,
      payload: candidate.metadata,
    });
  }

  private storeGrant(record: RewardGrantRecord): void {
    this.grants.set(record.grantId, record);
    this.grantsByScope.set(record.scopeKey, record.grantId);
    this.grantsByLegend.set(record.legendId, freezeArray([...(this.grantsByLegend.get(record.legendId) ?? Object.freeze([])), record.grantId]));
    this.grantsByUser.set(record.userId, freezeArray([...(this.grantsByUser.get(record.userId) ?? Object.freeze([])), record.grantId]));
  }
}



// ============================================================================
// MARK: Snapshot / audit contracts
// ============================================================================

export interface RewardGrantAuditIssue {
  readonly code:
    | 'LEGEND_INDEX_DRIFT'
    | 'USER_INDEX_DRIFT'
    | 'SCOPE_INDEX_DRIFT'
    | 'REVOKED_SCOPE_STILL_ACTIVE'
    | 'PREVIEW_AS_ACTIVE_GRANT';
  readonly grantId: string | null;
  readonly legendId: ChatLegendId | null;
  readonly userId: ChatUserId | null;
  readonly detail: string;
}

export interface RewardGrantJournalEntry {
  readonly at: UnixMs;
  readonly grantId: string;
  readonly legendId: ChatLegendId;
  readonly userId: ChatUserId;
  readonly rewardClass: ChatRewardClass;
  readonly state: 'ACTIVE' | 'REVOKED' | 'PREVIEW';
}

export interface RewardGrantUserSummary {
  readonly userId: ChatUserId;
  readonly activeCount: number;
  readonly activeByRewardClass: Readonly<Record<string, number>>;
  readonly mostRecentGrantId: string | null;
  readonly mostRecentGrantAt: UnixMs | null;
}

export interface RewardGrantResolverSnapshot {
  readonly totalGrantCount: number;
  readonly totalActiveGrantCount: number;
  readonly totalPreviewCount: number;
  readonly byUser: Readonly<Record<ChatUserId, RewardGrantUserSummary>>;
  readonly byLegend: Readonly<Record<ChatLegendId, readonly RewardGrantRecord[]>>;
}

export function buildRewardGrantResolverSnapshot(
  resolver: RewardGrantResolver,
): RewardGrantResolverSnapshot {
  const records = resolver.listAllGrantRecords();
  const byUserBuckets = new Map<ChatUserId, RewardGrantRecord[]>();
  const byLegend: Record<ChatLegendId, readonly RewardGrantRecord[]> = {} as Record<ChatLegendId, readonly RewardGrantRecord[]>;

  for (const record of records) {
    byUserBuckets.set(record.userId, [...(byUserBuckets.get(record.userId) ?? []), record]);
    byLegend[record.legendId] = freezeArray([...(byLegend[record.legendId] ?? Object.freeze([])), record]);
  }

  const byUser = Object.fromEntries(
    [...byUserBuckets.entries()].map(([userId, userRecords]) => {
      const active = userRecords.filter((value) => value.revokedAt === null && !value.previewOnly);
      const byClass: Record<string, number> = {};
      for (const record of active) {
        byClass[String(record.rewardClass)] = (byClass[String(record.rewardClass)] ?? 0) + 1;
      }
      const sorted = [...active].sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
      const lastSorted = sorted.length > 0 ? sorted[sorted.length - 1] : null;
      const summary: RewardGrantUserSummary = Object.freeze({
        userId,
        activeCount: active.length,
        activeByRewardClass: freezeRecord(byClass),
        mostRecentGrantId: lastSorted?.grantId ?? null,
        mostRecentGrantAt: lastSorted?.createdAt ?? null,
      });
      return [userId, summary];
    }),
  ) as Record<ChatUserId, RewardGrantUserSummary>;

  return Object.freeze({
    totalGrantCount: records.length,
    totalActiveGrantCount: records.filter((value) => value.revokedAt === null && !value.previewOnly).length,
    totalPreviewCount: records.filter((value) => value.previewOnly).length,
    byUser: freezeRecord(byUser),
    byLegend: freezeRecord(byLegend),
  });
}

export function auditRewardGrantResolverIntegrity(
  resolver: RewardGrantResolver,
): readonly RewardGrantAuditIssue[] {
  const issues: RewardGrantAuditIssue[] = [];
  const records = resolver.listAllGrantRecords();
  const seenScopes = new Set<string>();

  for (const record of records) {
    const byLegend = resolver.listGrantsByLegend(record.legendId);
    if (!byLegend.some((value) => value.grantId === record.grantId)) {
      issues.push({
        code: 'LEGEND_INDEX_DRIFT',
        grantId: record.grantId,
        legendId: record.legendId,
        userId: record.userId,
        detail: 'Grant exists globally but is missing from legend index.',
      });
    }

    const byUser = resolver.listActiveGrantsByUser(record.userId);
    if (record.revokedAt === null && !record.previewOnly && !byUser.some((value) => value.grantId === record.grantId)) {
      issues.push({
        code: 'USER_INDEX_DRIFT',
        grantId: record.grantId,
        legendId: record.legendId,
        userId: record.userId,
        detail: 'Active grant exists globally but is missing from active user index surface.',
      });
    }

    if (seenScopes.has(record.scopeKey) && record.revokedAt === null && !record.previewOnly) {
      issues.push({
        code: 'SCOPE_INDEX_DRIFT',
        grantId: record.grantId,
        legendId: record.legendId,
        userId: record.userId,
        detail: 'Duplicate active scope detected.',
      });
    }
    if (record.revokedAt === null && !record.previewOnly) seenScopes.add(record.scopeKey);

    if (record.previewOnly && record.revokedAt === null) {
      issues.push({
        code: 'PREVIEW_AS_ACTIVE_GRANT',
        grantId: record.grantId,
        legendId: record.legendId,
        userId: record.userId,
        detail: 'Preview-only grant should not remain active in authoritative resolver state.',
      });
    }
  }

  return freezeArray(issues);
}

export function buildRewardGrantJournal(
  resolver: RewardGrantResolver,
): readonly RewardGrantJournalEntry[] {
  return freezeArray(
    resolver
      .listAllGrantRecords()
      .map((record) =>
        Object.freeze({
          at: record.revokedAt ?? record.createdAt,
          grantId: record.grantId,
          legendId: record.legendId,
          userId: record.userId,
          rewardClass: record.rewardClass,
          state: record.previewOnly ? 'PREVIEW' : record.revokedAt ? 'REVOKED' : 'ACTIVE',
        }),
      )
      .sort((a, b) => Number(a.at) - Number(b.at)),
  );
}


export function summarizeRewardInventoryByUsers(
  resolver: RewardGrantResolver,
  userIds: readonly ChatUserId[],
): Readonly<Record<ChatUserId, RewardInventorySnapshot>> {
  return freezeRecord(
    Object.fromEntries(userIds.map((userId) => [userId, resolver.buildInventorySnapshot(userId)])) as Record<ChatUserId, RewardInventorySnapshot>,
  );
}

export function listRewardGrantRecordsByRoom(
  resolver: RewardGrantResolver,
  roomId: ChatRoomId,
): readonly RewardGrantRecord[] {
  return freezeArray(resolver.listAllGrantRecords().filter((value) => value.roomId === roomId));
}

// ============================================================================
// MARK: Thin creation helpers
// ============================================================================

export function createRewardGrantResolver(
  config: Partial<RewardGrantResolverConfig> = {},
): RewardGrantResolver {
  return new RewardGrantResolver(config);
}

export function resolveLegendRewardBatch(
  records: readonly LegendMomentRecord[],
  config: Partial<RewardGrantResolverConfig> = {},
): RewardGrantResolutionBatch {
  return createRewardGrantResolver(config).resolveBatch(records);
}

// ============================================================================
// MARK: Module manifest
// ============================================================================

export const BACKEND_CHAT_REWARD_GRANT_RESOLVER_MODULE_NAME = 'PZO_BACKEND_CHAT_REWARD_GRANT_RESOLVER' as const;

export const BACKEND_CHAT_REWARD_GRANT_RESOLVER_MANIFEST = Object.freeze({
  moduleName: BACKEND_CHAT_REWARD_GRANT_RESOLVER_MODULE_NAME,
  version: '1.0.0',
  path: '/backend/src/game/engine/chat/rewards/RewardGrantResolver.ts',
  authorities: Object.freeze({
    backendRewardsRoot: '/backend/src/game/engine/chat/rewards',
    sharedRewardContract: '/shared/contracts/chat/ChatReward.ts',
    sharedLegendContract: '/shared/contracts/chat/ChatLegend.ts',
  }),
  owns: Object.freeze([
    'reward candidate extraction',
    'legend-to-reward eligibility',
    'duplicate and cooldown suppression',
    'authoritative reward grant records',
    'grant preview generation',
    'reward inventory snapshots',
  ] as const),
  dependsOn: Object.freeze([
    './LegendMomentLedger',
    './ReplayMomentIndexer',
    '../../../../../../shared/contracts/chat/ChatLegend',
    '../../../../../../shared/contracts/chat/ChatReward',
  ] as const),
} as const);

export const ChatRewardGrantResolverModule = Object.freeze({
  moduleName: BACKEND_CHAT_REWARD_GRANT_RESOLVER_MODULE_NAME,
  manifest: BACKEND_CHAT_REWARD_GRANT_RESOLVER_MANIFEST,
  defaults: DEFAULT_REWARD_GRANT_RESOLVER_CONFIG,
  createRewardGrantResolver,
  resolveLegendRewardBatch,
  RewardGrantResolver,
} as const);

export function countActiveRewardGrants(resolver: RewardGrantResolver): number {
  return resolver.listAllGrantRecords().filter((value) => value.revokedAt === null && !value.previewOnly).length;
}

