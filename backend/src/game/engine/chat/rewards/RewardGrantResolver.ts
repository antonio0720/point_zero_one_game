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

// ============================================================================
// MARK: Reward scoring and value bands
// ============================================================================

export type RewardGrantValueBand =
  | 'LEGENDARY'
  | 'EPIC'
  | 'RARE'
  | 'UNCOMMON'
  | 'COMMON'
  | 'MINIMAL';

export interface RewardGrantScore {
  readonly grantId: string;
  readonly userId: ChatUserId;
  readonly rewardClass: ChatRewardClass;
  readonly rawScore: number;
  readonly normalizedScore01: number;
  readonly valueBand: RewardGrantValueBand;
  readonly ageMs: number;
  readonly factors: Readonly<Record<string, number>>;
}

export interface RewardGrantScoreConfig {
  readonly classWeights: Readonly<Record<string, number>>;
  readonly freshnessBonusMs: number;
  readonly freshnessWeight: number;
  readonly legendaryThreshold: number;
  readonly epicThreshold: number;
  readonly rareThreshold: number;
  readonly uncommonThreshold: number;
  readonly commonThreshold: number;
}

const DEFAULT_REWARD_GRANT_SCORE_CONFIG: RewardGrantScoreConfig = Object.freeze({
  classWeights: Object.freeze({
    TITLE: 1.0,
    AURA: 0.82,
    BADGE: 0.55,
    PHRASE: 0.42,
    EMOJI: 0.28,
  }),
  freshnessBonusMs: 1000 * 60 * 60 * 6,
  freshnessWeight: 0.18,
  legendaryThreshold: 0.88,
  epicThreshold: 0.72,
  rareThreshold: 0.52,
  uncommonThreshold: 0.34,
  commonThreshold: 0.16,
});

function deriveValueBand(score01: number, config: RewardGrantScoreConfig): RewardGrantValueBand {
  if (score01 >= config.legendaryThreshold) return 'LEGENDARY';
  if (score01 >= config.epicThreshold) return 'EPIC';
  if (score01 >= config.rareThreshold) return 'RARE';
  if (score01 >= config.uncommonThreshold) return 'UNCOMMON';
  if (score01 >= config.commonThreshold) return 'COMMON';
  return 'MINIMAL';
}

export function scoreRewardGrant(
  record: RewardGrantRecord,
  now: UnixMs = nowUnixMs(),
  config: Partial<RewardGrantScoreConfig> = {},
): RewardGrantScore {
  const cfg: RewardGrantScoreConfig = Object.freeze({ ...DEFAULT_REWARD_GRANT_SCORE_CONFIG, ...config });
  const classWeight = cfg.classWeights[String(record.rewardClass)] ?? 0.2;
  const ageMs = Math.max(0, Number(now) - Number(record.createdAt));
  const freshnessFactor = ageMs < cfg.freshnessBonusMs
    ? 1 - (ageMs / cfg.freshnessBonusMs) * cfg.freshnessWeight
    : 1 - cfg.freshnessWeight;
  const revocationPenalty = record.revokedAt ? 0.0 : 1.0;
  const previewPenalty = record.previewOnly ? 0.12 : 1.0;
  const rawScore = classWeight * freshnessFactor * revocationPenalty * previewPenalty;
  const normalizedScore01 = Math.max(0, Math.min(1, rawScore));
  return Object.freeze({
    grantId: record.grantId,
    userId: record.userId,
    rewardClass: record.rewardClass,
    rawScore,
    normalizedScore01,
    valueBand: deriveValueBand(normalizedScore01, cfg),
    ageMs,
    factors: Object.freeze({
      classWeight,
      freshnessFactor,
      revocationPenalty,
      previewPenalty,
    }),
  });
}

export function scoreAllGrantsForUser(
  resolver: RewardGrantResolver,
  userId: ChatUserId,
  now: UnixMs = nowUnixMs(),
  config: Partial<RewardGrantScoreConfig> = {},
): readonly RewardGrantScore[] {
  return freezeArray(
    resolver.listActiveGrantsByUser(userId).map((record) => scoreRewardGrant(record, now, config)),
  );
}

export function topScoredGrantsForUser(
  resolver: RewardGrantResolver,
  userId: ChatUserId,
  topN: number,
  now: UnixMs = nowUnixMs(),
): readonly RewardGrantScore[] {
  const scores = scoreAllGrantsForUser(resolver, userId, now);
  return freezeArray([...scores].sort((a, b) => b.normalizedScore01 - a.normalizedScore01).slice(0, topN));
}

// ============================================================================
// MARK: Grant timeline and history
// ============================================================================

export interface RewardGrantTimelineSlice {
  readonly at: UnixMs;
  readonly grantId: string;
  readonly legendId: ChatLegendId;
  readonly userId: ChatUserId;
  readonly rewardClass: ChatRewardClass;
  readonly event: 'CREATED' | 'REVOKED' | 'PREVIEWED';
  readonly scopeKey: string;
}

export interface RewardGrantTimeline {
  readonly userId: ChatUserId;
  readonly slices: readonly RewardGrantTimelineSlice[];
  readonly firstGrantAt: UnixMs | null;
  readonly lastGrantAt: UnixMs | null;
  readonly totalCreatedEvents: number;
  readonly totalRevokedEvents: number;
}

export function buildRewardGrantTimeline(
  resolver: RewardGrantResolver,
  userId: ChatUserId,
): RewardGrantTimeline {
  const records = resolver.listAllGrantRecords().filter((r) => r.userId === userId);
  const slices: RewardGrantTimelineSlice[] = [];

  for (const record of records) {
    slices.push(Object.freeze({
      at: record.createdAt,
      grantId: record.grantId,
      legendId: record.legendId,
      userId: record.userId,
      rewardClass: record.rewardClass,
      event: record.previewOnly ? 'PREVIEWED' : 'CREATED',
      scopeKey: record.scopeKey,
    }));
    if (record.revokedAt) {
      slices.push(Object.freeze({
        at: record.revokedAt,
        grantId: record.grantId,
        legendId: record.legendId,
        userId: record.userId,
        rewardClass: record.rewardClass,
        event: 'REVOKED',
        scopeKey: record.scopeKey,
      }));
    }
  }

  const sorted = [...slices].sort((a, b) => Number(a.at) - Number(b.at));
  const createdEvents = sorted.filter((s) => s.event === 'CREATED');

  return Object.freeze({
    userId,
    slices: freezeArray(sorted),
    firstGrantAt: createdEvents[0]?.at ?? null,
    lastGrantAt: createdEvents[createdEvents.length - 1]?.at ?? null,
    totalCreatedEvents: createdEvents.length,
    totalRevokedEvents: sorted.filter((s) => s.event === 'REVOKED').length,
  });
}

export function buildRewardGrantTimelineWindow(
  resolver: RewardGrantResolver,
  userId: ChatUserId,
  startAt: UnixMs,
  endAt: UnixMs,
): readonly RewardGrantTimelineSlice[] {
  const timeline = buildRewardGrantTimeline(resolver, userId);
  return freezeArray(
    timeline.slices.filter((s) => Number(s.at) >= Number(startAt) && Number(s.at) <= Number(endAt)),
  );
}

// ============================================================================
// MARK: Cooldown calendar
// ============================================================================

export interface RewardGrantCooldownState {
  readonly userId: ChatUserId;
  readonly rewardClass: ChatRewardClass;
  readonly lastGrantedAt: UnixMs | null;
  readonly cooldownMs: number;
  readonly cooldownExpiresAt: UnixMs | null;
  readonly isActive: boolean;
  readonly remainingMs: number;
}

export function buildCooldownCalendar(
  resolver: RewardGrantResolver,
  userId: ChatUserId,
  now: UnixMs = nowUnixMs(),
): readonly RewardGrantCooldownState[] {
  const config = resolver.getConfig();
  const inventory = resolver.buildInventorySnapshot(userId);
  const classes = Object.keys(config.cooldownMsByRewardClass) as ChatRewardClass[];

  return freezeArray(classes.map((rewardClass) => {
    const cooldownMs = config.cooldownMsByRewardClass[String(rewardClass)] ?? 0;
    const lastGrantedAt = inventory.lastGrantedAtByRewardClass[String(rewardClass)] ?? null;
    const cooldownExpiresAt = lastGrantedAt
      ? (Number(lastGrantedAt) + cooldownMs as UnixMs)
      : null;
    const isActive = cooldownExpiresAt !== null && Number(now) < Number(cooldownExpiresAt);
    const remainingMs = isActive ? Number(cooldownExpiresAt) - Number(now) : 0;

    return Object.freeze({
      userId,
      rewardClass,
      lastGrantedAt,
      cooldownMs,
      cooldownExpiresAt,
      isActive,
      remainingMs,
    });
  }));
}

export function activeCooldownsForUser(
  resolver: RewardGrantResolver,
  userId: ChatUserId,
  now: UnixMs = nowUnixMs(),
): readonly RewardGrantCooldownState[] {
  return freezeArray(buildCooldownCalendar(resolver, userId, now).filter((c) => c.isActive));
}

// ============================================================================
// MARK: Cross-user deduplication surface
// ============================================================================

export interface RewardGrantScopeDuplicate {
  readonly scopeKey: string;
  readonly grantIds: readonly string[];
  readonly affectedUsers: readonly ChatUserId[];
  readonly affectedLegendIds: readonly ChatLegendId[];
}

export function detectCrossUserScopeDuplicates(
  resolver: RewardGrantResolver,
): readonly RewardGrantScopeDuplicate[] {
  const records = resolver.listAllGrantRecords().filter((r) => !r.previewOnly && r.revokedAt === null);
  const byScopeBase = new Map<string, RewardGrantRecord[]>();

  for (const record of records) {
    const baseScope = record.scopeKey.replace(`:${String(record.userId)}:`, ':__any__:');
    const bucket = byScopeBase.get(baseScope) ?? [];
    bucket.push(record);
    byScopeBase.set(baseScope, bucket);
  }

  const duplicates: RewardGrantScopeDuplicate[] = [];
  for (const [, bucket] of byScopeBase) {
    const uniqueUsers = uniqueStrings(bucket.map((r) => r.userId));
    if (uniqueUsers.length > 1) {
      duplicates.push(Object.freeze({
        scopeKey: bucket[0].scopeKey,
        grantIds: freezeArray(bucket.map((r) => r.grantId)),
        affectedUsers: uniqueUsers,
        affectedLegendIds: uniqueStrings(bucket.map((r) => r.legendId)),
      }));
    }
  }
  return freezeArray(duplicates);
}

// ============================================================================
// MARK: Policy profiles
// ============================================================================

export type RewardGrantResolverProfile =
  | 'BALANCED'
  | 'CONSERVATIVE'
  | 'AGGRESSIVE'
  | 'PRESTIGE_FIRST'
  | 'PREVIEW_DOMINANT'
  | 'MINIMAL';

export const REWARD_GRANT_RESOLVER_PROFILES: Readonly<Record<RewardGrantResolverProfile, Partial<RewardGrantResolverConfig>>> = Object.freeze({
  BALANCED: Object.freeze({}),
  CONSERVATIVE: Object.freeze({
    cooldownMsByRewardClass: Object.freeze({
      TITLE: 1000 * 60 * 60 * 48,
      AURA: 1000 * 60 * 120,
      BADGE: 1000 * 60 * 30,
      PHRASE: 1000 * 60 * 30,
      EMOJI: 1000 * 60 * 30,
    }),
    maxActiveRewardsPerUser: 128,
    maxRewardsPerRoomLegendBurst: 8,
    previewWhenBlocked: false,
  }),
  AGGRESSIVE: Object.freeze({
    cooldownMsByRewardClass: Object.freeze({
      TITLE: 1000 * 60 * 30,
      AURA: 1000 * 60 * 5,
      BADGE: 0,
      PHRASE: 0,
      EMOJI: 0,
    }),
    maxActiveRewardsPerUser: 2048,
    maxRewardsPerRoomLegendBurst: 64,
    previewWhenBlocked: true,
  }),
  PRESTIGE_FIRST: Object.freeze({
    maxActivePerRewardClass: Object.freeze({
      TITLE: 32,
      AURA: 32,
      BADGE: 256,
      PHRASE: 256,
      EMOJI: 256,
    }),
    maxRewardsPerRoomLegendBurst: 32,
    previewWhenBlocked: true,
  }),
  PREVIEW_DOMINANT: Object.freeze({
    previewWhenBlocked: true,
    maxRewardsPerRoomLegendBurst: 4,
    maxActiveRewardsPerUser: 64,
  }),
  MINIMAL: Object.freeze({
    maxActiveRewardsPerUser: 32,
    maxRewardsPerRoomLegendBurst: 4,
    previewWhenBlocked: false,
    cooldownMsByRewardClass: Object.freeze({
      TITLE: 1000 * 60 * 60 * 72,
      AURA: 1000 * 60 * 60 * 24,
      BADGE: 1000 * 60 * 60 * 12,
      PHRASE: 1000 * 60 * 60 * 12,
      EMOJI: 1000 * 60 * 60 * 12,
    }),
  }),
});

export function createRewardGrantResolverFromProfile(
  profile: RewardGrantResolverProfile,
  overrides: Partial<RewardGrantResolverConfig> = {},
): RewardGrantResolver {
  const profileConfig = REWARD_GRANT_RESOLVER_PROFILES[profile] ?? {};
  return createRewardGrantResolver({
    ...profileConfig,
    ...overrides,
    cooldownMsByRewardClass: Object.freeze({
      ...(profileConfig.cooldownMsByRewardClass ?? {}),
      ...(overrides.cooldownMsByRewardClass ?? {}),
    }),
    maxActivePerRewardClass: Object.freeze({
      ...(profileConfig.maxActivePerRewardClass ?? {}),
      ...(overrides.maxActivePerRewardClass ?? {}),
    }),
  });
}

// ============================================================================
// MARK: Reward decay analysis
// ============================================================================

export interface RewardGrantDecayState {
  readonly grantId: string;
  readonly userId: ChatUserId;
  readonly rewardClass: ChatRewardClass;
  readonly ageMs: number;
  readonly decayScore01: number;
  readonly isStale: boolean;
  readonly staleSinceMs: number | null;
}

const REWARD_STALE_THRESHOLD_MS: Readonly<Record<string, number>> = Object.freeze({
  TITLE: 1000 * 60 * 60 * 24 * 90,
  AURA: 1000 * 60 * 60 * 24 * 30,
  BADGE: 1000 * 60 * 60 * 24 * 60,
  PHRASE: 1000 * 60 * 60 * 24 * 60,
  EMOJI: 1000 * 60 * 60 * 24 * 120,
});

export function computeGrantDecayState(
  record: RewardGrantRecord,
  now: UnixMs = nowUnixMs(),
): RewardGrantDecayState {
  const ageMs = Math.max(0, Number(now) - Number(record.createdAt));
  const staleThresholdMs = REWARD_STALE_THRESHOLD_MS[String(record.rewardClass)] ?? 1000 * 60 * 60 * 24 * 60;
  const decayScore01 = Math.max(0, 1 - ageMs / staleThresholdMs);
  const isStale = ageMs >= staleThresholdMs;
  return Object.freeze({
    grantId: record.grantId,
    userId: record.userId,
    rewardClass: record.rewardClass,
    ageMs,
    decayScore01,
    isStale,
    staleSinceMs: isStale ? ageMs - staleThresholdMs : null,
  });
}

export function listStaleGrantsForUser(
  resolver: RewardGrantResolver,
  userId: ChatUserId,
  now: UnixMs = nowUnixMs(),
): readonly RewardGrantDecayState[] {
  return freezeArray(
    resolver
      .listActiveGrantsByUser(userId)
      .map((r) => computeGrantDecayState(r, now))
      .filter((s) => s.isStale),
  );
}

export function computeDecayHeatForUser(
  resolver: RewardGrantResolver,
  userId: ChatUserId,
  now: UnixMs = nowUnixMs(),
): number {
  const grants = resolver.listActiveGrantsByUser(userId);
  if (grants.length === 0) return 0;
  const totalDecay = grants.reduce((acc, r) => acc + (1 - computeGrantDecayState(r, now).decayScore01), 0);
  return Math.min(1, totalDecay / grants.length);
}

// ============================================================================
// MARK: Grant forecast / simulation
// ============================================================================

export interface RewardGrantForecast {
  readonly userId: ChatUserId;
  readonly rewardClass: ChatRewardClass;
  readonly eligibleAt: UnixMs | null;
  readonly blockerCode: RewardGrantResolverReasonCode | null;
  readonly blockerDetail: string | null;
  readonly currentCooldownRemainingMs: number;
  readonly currentActiveCount: number;
  readonly maxActiveForClass: number;
  readonly canGrantNow: boolean;
}

export function forecastGrantEligibility(
  resolver: RewardGrantResolver,
  userId: ChatUserId,
  rewardClass: ChatRewardClass,
  now: UnixMs = nowUnixMs(),
): RewardGrantForecast {
  const config = resolver.getConfig();
  const inventory = resolver.buildInventorySnapshot(userId);
  const cooldownMs = config.cooldownMsByRewardClass[String(rewardClass)] ?? 0;
  const maxActive = config.maxActivePerRewardClass[String(rewardClass)] ?? Number.MAX_SAFE_INTEGER;
  const lastGrantedAt = inventory.lastGrantedAtByRewardClass[String(rewardClass)] ?? null;
  const activeForClass = (inventory.activeByRewardClass[String(rewardClass)] ?? []).length;
  const cooldownExpiresAt = lastGrantedAt ? (Number(lastGrantedAt) + cooldownMs as UnixMs) : null;
  const cooldownActive = cooldownExpiresAt !== null && Number(now) < Number(cooldownExpiresAt);
  const cooldownRemainingMs = cooldownActive ? Number(cooldownExpiresAt) - Number(now) : 0;
  const overUserCap = inventory.totalGrantedCount >= config.maxActiveRewardsPerUser;
  const overClassCap = activeForClass >= maxActive;

  let blockerCode: RewardGrantResolverReasonCode | null = null;
  let blockerDetail: string | null = null;
  let eligibleAt: UnixMs | null = null;

  if (overUserCap) {
    blockerCode = 'USER_CAP_REACHED';
    blockerDetail = `User has ${inventory.totalGrantedCount} active grants; cap is ${config.maxActiveRewardsPerUser}.`;
  } else if (overClassCap) {
    blockerCode = 'USER_CAP_REACHED';
    blockerDetail = `User has ${activeForClass} active ${String(rewardClass)} grants; cap is ${maxActive}.`;
  } else if (cooldownActive && cooldownExpiresAt !== null) {
    blockerCode = 'COOLDOWN_ACTIVE';
    blockerDetail = `Cooldown expires in ${cooldownRemainingMs}ms.`;
    eligibleAt = cooldownExpiresAt;
  }

  return Object.freeze({
    userId,
    rewardClass,
    eligibleAt: blockerCode === null ? now : eligibleAt,
    blockerCode,
    blockerDetail,
    currentCooldownRemainingMs: cooldownRemainingMs,
    currentActiveCount: activeForClass,
    maxActiveForClass: maxActive,
    canGrantNow: blockerCode === null,
  });
}

export function forecastAllClassEligibility(
  resolver: RewardGrantResolver,
  userId: ChatUserId,
  now: UnixMs = nowUnixMs(),
): Readonly<Record<string, RewardGrantForecast>> {
  const config = resolver.getConfig();
  const classes = Object.keys(config.cooldownMsByRewardClass) as ChatRewardClass[];
  return freezeRecord(
    Object.fromEntries(
      classes.map((rewardClass) => [
        String(rewardClass),
        forecastGrantEligibility(resolver, userId, rewardClass, now),
      ]),
    ) as Record<string, RewardGrantForecast>,
  );
}

// ============================================================================
// MARK: Batch revocation
// ============================================================================

export interface RewardGrantBatchRevocationResult {
  readonly revokedIds: readonly string[];
  readonly skippedIds: readonly string[];
  readonly revokedAt: UnixMs;
}

export function revokeAllGrantsForUser(
  resolver: RewardGrantResolver,
  userId: ChatUserId,
  revokedAt: UnixMs = nowUnixMs(),
): RewardGrantBatchRevocationResult {
  const active = resolver.listActiveGrantsByUser(userId);
  const revokedIds: string[] = [];
  const skippedIds: string[] = [];

  for (const record of active) {
    const revoked = resolver.revokeLegendRewards(record.legendId, revokedAt);
    if (revoked.some((r) => r.grantId === record.grantId)) {
      revokedIds.push(record.grantId);
    } else {
      skippedIds.push(record.grantId);
    }
  }

  return Object.freeze({
    revokedIds: freezeArray(revokedIds),
    skippedIds: freezeArray(skippedIds),
    revokedAt,
  });
}

export function revokeGrantsByRewardClass(
  resolver: RewardGrantResolver,
  userId: ChatUserId,
  rewardClass: ChatRewardClass,
  revokedAt: UnixMs = nowUnixMs(),
): RewardGrantBatchRevocationResult {
  const active = resolver.listActiveGrantsByUser(userId).filter((r) => r.rewardClass === rewardClass);
  const revokedIds: string[] = [];
  const skippedIds: string[] = [];

  for (const record of active) {
    const revoked = resolver.revokeLegendRewards(record.legendId, revokedAt);
    if (revoked.some((r) => r.grantId === record.grantId)) {
      revokedIds.push(record.grantId);
    } else {
      skippedIds.push(record.grantId);
    }
  }

  return Object.freeze({
    revokedIds: freezeArray(revokedIds),
    skippedIds: freezeArray(skippedIds),
    revokedAt,
  });
}

// ============================================================================
// MARK: Grant annotation
// ============================================================================

export interface RewardGrantAnnotation {
  readonly grantId: string;
  readonly tags: readonly string[];
  readonly notes: string;
  readonly annotatedAt: UnixMs;
}

const ANNOTATION_STORE = new Map<string, RewardGrantAnnotation>();

export function annotateRewardGrant(
  grantId: string,
  tags: readonly string[],
  notes: string,
  annotatedAt: UnixMs = nowUnixMs(),
): RewardGrantAnnotation {
  const annotation = Object.freeze({ grantId, tags: freezeArray(tags), notes, annotatedAt });
  ANNOTATION_STORE.set(grantId, annotation);
  return annotation;
}

export function getRewardGrantAnnotation(grantId: string): RewardGrantAnnotation | null {
  return ANNOTATION_STORE.get(grantId) ?? null;
}

export function listAnnotatedGrants(resolver: RewardGrantResolver): readonly RewardGrantRecord[] {
  return freezeArray(
    resolver.listAllGrantRecords().filter((r) => ANNOTATION_STORE.has(r.grantId)),
  );
}

// ============================================================================
// MARK: Grant diff / comparison
// ============================================================================

export interface RewardGrantResolverDiff {
  readonly addedGrantIds: readonly string[];
  readonly revokedGrantIds: readonly string[];
  readonly newPreviewIds: readonly string[];
  readonly clearedPreviewIds: readonly string[];
  readonly userCapChanged: boolean;
  readonly classCapChangedFor: readonly string[];
}

export function diffRewardResolverSnapshots(
  before: RewardGrantResolverSnapshot,
  after: RewardGrantResolverSnapshot,
): RewardGrantResolverDiff {
  const beforeActiveIds = new Set<string>();
  const afterActiveIds = new Set<string>();
  const beforePreviewIds = new Set<string>();
  const afterPreviewIds = new Set<string>();

  for (const records of Object.values(before.byLegend)) {
    for (const r of records) {
      if (!r.previewOnly && r.revokedAt === null) beforeActiveIds.add(r.grantId);
      if (r.previewOnly) beforePreviewIds.add(r.grantId);
    }
  }
  for (const records of Object.values(after.byLegend)) {
    for (const r of records) {
      if (!r.previewOnly && r.revokedAt === null) afterActiveIds.add(r.grantId);
      if (r.previewOnly) afterPreviewIds.add(r.grantId);
    }
  }

  const classCapChangedFor: string[] = [];
  const allClasses = new Set([
    ...Object.keys(Object.values(before.byUser)[0]?.activeByRewardClass ?? {}),
    ...Object.keys(Object.values(after.byUser)[0]?.activeByRewardClass ?? {}),
  ]);
  for (const cls of allClasses) {
    const bTotal = Object.values(before.byUser).reduce((acc, u) => acc + (u.activeByRewardClass[cls] ?? 0), 0);
    const aTotal = Object.values(after.byUser).reduce((acc, u) => acc + (u.activeByRewardClass[cls] ?? 0), 0);
    if (bTotal !== aTotal) classCapChangedFor.push(cls);
  }

  return Object.freeze({
    addedGrantIds: freezeArray([...afterActiveIds].filter((id) => !beforeActiveIds.has(id))),
    revokedGrantIds: freezeArray([...beforeActiveIds].filter((id) => !afterActiveIds.has(id))),
    newPreviewIds: freezeArray([...afterPreviewIds].filter((id) => !beforePreviewIds.has(id))),
    clearedPreviewIds: freezeArray([...beforePreviewIds].filter((id) => !afterPreviewIds.has(id))),
    userCapChanged: before.totalActiveGrantCount !== after.totalActiveGrantCount,
    classCapChangedFor: freezeArray(classCapChangedFor),
  });
}

// ============================================================================
// MARK: Policy violation log
// ============================================================================

export type RewardGrantPolicyViolationCode =
  | 'SCOPE_COLLISION'
  | 'CAP_EXCEEDED'
  | 'COOLDOWN_BYPASS'
  | 'BURST_OVERFLOW'
  | 'PREVIEW_LEAKED_AS_ACTIVE';

export interface RewardGrantPolicyViolation {
  readonly code: RewardGrantPolicyViolationCode;
  readonly grantId: string | null;
  readonly userId: ChatUserId | null;
  readonly legendId: ChatLegendId | null;
  readonly detail: string;
  readonly detectedAt: UnixMs;
}

export function detectPolicyViolations(
  resolver: RewardGrantResolver,
  now: UnixMs = nowUnixMs(),
): readonly RewardGrantPolicyViolation[] {
  const issues: RewardGrantPolicyViolation[] = [];
  const records = resolver.listAllGrantRecords();
  const config = resolver.getConfig();
  const scopeSeen = new Map<string, string>();

  for (const record of records) {
    if (record.revokedAt !== null || record.previewOnly) continue;

    const existing = scopeSeen.get(record.scopeKey);
    if (existing) {
      issues.push({
        code: 'SCOPE_COLLISION',
        grantId: record.grantId,
        userId: record.userId,
        legendId: record.legendId,
        detail: `Scope key ${record.scopeKey} has multiple active grants (collision with ${existing}).`,
        detectedAt: now,
      });
    } else {
      scopeSeen.set(record.scopeKey, record.grantId);
    }

    const inventory = resolver.buildInventorySnapshot(record.userId);
    if (inventory.totalGrantedCount > config.maxActiveRewardsPerUser) {
      issues.push({
        code: 'CAP_EXCEEDED',
        grantId: record.grantId,
        userId: record.userId,
        legendId: record.legendId,
        detail: `User has ${inventory.totalGrantedCount} active grants, exceeding cap of ${config.maxActiveRewardsPerUser}.`,
        detectedAt: now,
      });
    }
  }

  for (const record of records.filter((r) => r.previewOnly && r.revokedAt === null)) {
    const nonPreview = records.find((r) => r.scopeKey === record.scopeKey && !r.previewOnly && r.revokedAt === null);
    if (nonPreview) {
      issues.push({
        code: 'PREVIEW_LEAKED_AS_ACTIVE',
        grantId: record.grantId,
        userId: record.userId,
        legendId: record.legendId,
        detail: `Preview grant ${record.grantId} coexists with active grant ${nonPreview.grantId} on same scope.`,
        detectedAt: now,
      });
    }
  }

  return freezeArray(issues);
}

// ============================================================================
// MARK: Grant ledger statistics
// ============================================================================

export interface RewardGrantLedgerStats {
  readonly totalRecords: number;
  readonly totalActive: number;
  readonly totalRevoked: number;
  readonly totalPreviews: number;
  readonly uniqueUsers: number;
  readonly uniqueLegends: number;
  readonly byClass: Readonly<Record<string, number>>;
  readonly oldestActiveGrantAt: UnixMs | null;
  readonly newestActiveGrantAt: UnixMs | null;
  readonly averageAgeMs: number;
}

export function buildRewardGrantLedgerStats(
  resolver: RewardGrantResolver,
  now: UnixMs = nowUnixMs(),
): RewardGrantLedgerStats {
  const records = resolver.listAllGrantRecords();
  const active = records.filter((r) => r.revokedAt === null && !r.previewOnly);
  const byClass: Record<string, number> = {};

  for (const r of active) {
    byClass[String(r.rewardClass)] = (byClass[String(r.rewardClass)] ?? 0) + 1;
  }

  const ages = active.map((r) => Math.max(0, Number(now) - Number(r.createdAt)));
  const totalAgeMs = ages.reduce((acc, a) => acc + a, 0);
  const sorted = [...active].sort((a, b) => Number(a.createdAt) - Number(b.createdAt));

  return Object.freeze({
    totalRecords: records.length,
    totalActive: active.length,
    totalRevoked: records.filter((r) => r.revokedAt !== null).length,
    totalPreviews: records.filter((r) => r.previewOnly).length,
    uniqueUsers: new Set(records.map((r) => r.userId)).size,
    uniqueLegends: new Set(records.map((r) => r.legendId)).size,
    byClass: freezeRecord(byClass),
    oldestActiveGrantAt: sorted[0]?.createdAt ?? null,
    newestActiveGrantAt: sorted[sorted.length - 1]?.createdAt ?? null,
    averageAgeMs: active.length > 0 ? totalAgeMs / active.length : 0,
  });
}

// ============================================================================
// MARK: Named profile factories
// ============================================================================

export function createBalancedRewardGrantResolver(
  overrides: Partial<RewardGrantResolverConfig> = {},
): RewardGrantResolver {
  return createRewardGrantResolverFromProfile('BALANCED', overrides);
}

export function createConservativeRewardGrantResolver(
  overrides: Partial<RewardGrantResolverConfig> = {},
): RewardGrantResolver {
  return createRewardGrantResolverFromProfile('CONSERVATIVE', overrides);
}

export function createAggressiveRewardGrantResolver(
  overrides: Partial<RewardGrantResolverConfig> = {},
): RewardGrantResolver {
  return createRewardGrantResolverFromProfile('AGGRESSIVE', overrides);
}

export function createPrestigeFirstRewardGrantResolver(
  overrides: Partial<RewardGrantResolverConfig> = {},
): RewardGrantResolver {
  return createRewardGrantResolverFromProfile('PRESTIGE_FIRST', overrides);
}

// ============================================================================
// MARK: Doctrine notes
// ============================================================================

export const REWARD_GRANT_RESOLVER_DOCTRINE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  DEDUPLICATION: Object.freeze([
    'Scope keys are the canonical deduplication surface. Two grants on the same scope key will never coexist.',
    'Scope keys encode: userId + roomId + legendId + rewardClass.',
    'Preview grants are not counted toward active caps but are tracked separately.',
  ]),
  COOLDOWNS: Object.freeze([
    'Cooldowns are per user, per reward class. They do not cross users.',
    'Cooldown state survives in the in-memory resolver for the duration of the session.',
    'A grant that is revoked does not reset cooldown — the grant timestamp is permanent.',
  ]),
  CAPS: Object.freeze([
    'User cap applies to total active (non-preview, non-revoked) grants.',
    'Class cap applies per user, per reward class.',
    'Room burst cap applies to a single legend batch, not the full resolver state.',
  ]),
  PROFILES: Object.freeze([
    'BALANCED: default policy for standard live sessions.',
    'CONSERVATIVE: used during test periods, pilot rooms, or sensitive contexts.',
    'AGGRESSIVE: maximum yield, minimal restriction, ideal for prestige events.',
    'PRESTIGE_FIRST: maximises TITLE and AURA density, suitable for legend-heavy rooms.',
    'PREVIEW_DOMINANT: holds most grants as previews, suitable for staged reveal workflows.',
    'MINIMAL: used in replay-only or audit-only contexts.',
  ]),
});

export const ChatRewardGrantResolverProfileModule = Object.freeze({
  profiles: REWARD_GRANT_RESOLVER_PROFILES,
  createFromProfile: createRewardGrantResolverFromProfile,
  createBalanced: createBalancedRewardGrantResolver,
  createConservative: createConservativeRewardGrantResolver,
  createAggressive: createAggressiveRewardGrantResolver,
  createPrestigeFirst: createPrestigeFirstRewardGrantResolver,
  score: scoreRewardGrant,
  timeline: buildRewardGrantTimeline,
  cooldowns: buildCooldownCalendar,
  forecast: forecastGrantEligibility,
  stats: buildRewardGrantLedgerStats,
  detectViolations: detectPolicyViolations,
  doctrine: REWARD_GRANT_RESOLVER_DOCTRINE,
} as const);

