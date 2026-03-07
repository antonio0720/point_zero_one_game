import { createHash, randomUUID } from 'node:crypto';

export type Season0MemberStatus =
  | 'invited'
  | 'applied'
  | 'approved'
  | 'active'
  | 'paused'
  | 'suspended'
  | 'removed';

export interface Season0MemberRecord {
  memberId: string;
  userId: string;
  email?: string | null;
  cohortId?: string | null;
  joinedAt?: string | null;
  lastActiveAt?: string | null;
  status: Season0MemberStatus;
  referralCode?: string | null;
  referralCount?: number;
  receiptTotalCents?: number;
  notes?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface Season0ReceiptRecord {
  receiptId: string;
  userId: string;
  amountCents: number;
  currency: string;
  source:
    | 'membership'
    | 'founder_pack'
    | 'upgrade'
    | 'manual_credit'
    | 'refund'
    | 'other';
  issuedAt: string;
  settledAt?: string | null;
  reversedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ReferralThrottleRecord {
  userId: string;
  seasonId: string;
  remainingReferrals: number;
  cooldownUntil?: string | null;
  suppressed?: boolean;
  metadata?: Record<string, unknown>;
}

export interface StampIssuanceHealthRecord {
  seasonId: string;
  totalStampsIssued: number;
  totalStampsAvailable: number;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export type AdminActionType =
  | 'member_upserted'
  | 'manual_credit_issued'
  | 'referral_throttle_updated'
  | 'stamp_health_updated'
  | 'bundle_ingested'
  | 'member_status_changed'
  | 'note_attached';

export interface AdminActionRecord {
  actionId: string;
  type: AdminActionType;
  actorId: string;
  createdAt: string;
  targetId?: string | null;
  summary: string;
  payloadHash: string;
  payload: Record<string, unknown>;
}

export interface Season0AdminBundle {
  seasonId: string;
  actorId?: string;
  members?: Season0MemberRecord[];
  receipts?: Season0ReceiptRecord[];
  referralThrottles?: ReferralThrottleRecord[];
  stampHealth?: StampIssuanceHealthRecord[];
}

export interface Season0AdminAnomaly {
  code:
    | 'member_without_receipt'
    | 'receipt_without_member'
    | 'negative_receipt_total'
    | 'over_throttled'
    | 'stamp_capacity_exceeded'
    | 'duplicate_referral_code';
  severity: 'low' | 'medium' | 'high';
  targetId: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface Season0AdminSnapshot {
  seasonId: string;
  generatedAt: string;
  totals: {
    members: number;
    activeMembers: number;
    paidMembers: number;
    totalReceiptCents: number;
    refundCents: number;
    netReceiptCents: number;
    throttledUsers: number;
    suppressedUsers: number;
    totalReferralCapacityRemaining: number;
    issuedStamps: number;
    availableStamps: number;
  };
  cohorts: Array<{
    cohortId: string;
    memberCount: number;
    activeMembers: number;
    totalReceiptCents: number;
  }>;
  topReferrers: Array<{
    userId: string;
    referralCode: string | null;
    referralCount: number;
    receiptTotalCents: number;
  }>;
  anomalies: Season0AdminAnomaly[];
  auditTrailTail: AdminActionRecord[];
}

const ACTIVE_STATUSES = new Set<Season0MemberStatus>(['approved', 'active', 'paused']);
const DEFAULT_AUDIT_TAIL = 50;

function nowIso(): string {
  return new Date().toISOString();
}

function toFiniteInteger(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    output.push(trimmed);
  }

  return output;
}

function payloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function sumReceiptDirectionally(receipts: Season0ReceiptRecord[]): {
  gross: number;
  refunds: number;
  net: number;
} {
  let gross = 0;
  let refunds = 0;

  for (const receipt of receipts) {
    const amount = toFiniteInteger(receipt.amountCents, 0);
    if (amount >= 0) {
      gross += amount;
    } else {
      refunds += Math.abs(amount);
    }
  }

  return {
    gross,
    refunds,
    net: gross - refunds,
  };
}

export class Season0AdminImpl {
  private readonly members = new Map<string, Season0MemberRecord>();
  private readonly receipts = new Map<string, Season0ReceiptRecord>();
  private readonly referralThrottles = new Map<string, ReferralThrottleRecord>();
  private readonly stampHealth = new Map<string, StampIssuanceHealthRecord>();
  private readonly auditTrail: AdminActionRecord[] = [];

  constructor(private readonly seasonId = 'season0') {}

  public ingestBundle(bundle: Season0AdminBundle): Season0AdminSnapshot {
    const actorId = bundle.actorId ?? 'system';

    for (const member of bundle.members ?? []) {
      this.upsertMember(member, actorId);
    }

    for (const receipt of bundle.receipts ?? []) {
      this.recordReceipt(receipt, actorId);
    }

    for (const throttle of bundle.referralThrottles ?? []) {
      this.setReferralThrottle(throttle, actorId);
    }

    for (const stamp of bundle.stampHealth ?? []) {
      this.updateStampHealth(stamp, actorId);
    }

    this.recordAction({
      type: 'bundle_ingested',
      actorId,
      summary: 'Season0 admin bundle ingested',
      payload: {
        seasonId: bundle.seasonId,
        members: bundle.members?.length ?? 0,
        receipts: bundle.receipts?.length ?? 0,
        referralThrottles: bundle.referralThrottles?.length ?? 0,
        stampHealth: bundle.stampHealth?.length ?? 0,
      },
    });

    return this.buildSnapshot();
  }

  public upsertMember(
    input: Season0MemberRecord,
    actorId = 'system',
  ): Season0MemberRecord {
    const existing = this.members.get(input.memberId);

    const normalized: Season0MemberRecord = {
      memberId: input.memberId,
      userId: input.userId,
      email: input.email ?? existing?.email ?? null,
      cohortId: input.cohortId ?? existing?.cohortId ?? null,
      joinedAt: input.joinedAt ?? existing?.joinedAt ?? null,
      lastActiveAt: input.lastActiveAt ?? existing?.lastActiveAt ?? null,
      status: input.status ?? existing?.status ?? 'invited',
      referralCode: input.referralCode ?? existing?.referralCode ?? null,
      referralCount: toFiniteInteger(
        input.referralCount ?? existing?.referralCount ?? 0,
        0,
      ),
      receiptTotalCents: toFiniteInteger(
        input.receiptTotalCents ?? existing?.receiptTotalCents ?? 0,
        0,
      ),
      notes: input.notes ?? existing?.notes ?? null,
      tags: normalizeStringArray(input.tags ?? existing?.tags ?? []),
      metadata: {
        ...(existing?.metadata ?? {}),
        ...(input.metadata ?? {}),
      },
    };

    this.members.set(normalized.memberId, normalized);

    this.recordAction({
      type: 'member_upserted',
      actorId,
      targetId: normalized.memberId,
      summary: `Member ${normalized.memberId} upserted`,
      payload: normalized as unknown as Record<string, unknown>,
    });

    return normalized;
  }

  public changeMemberStatus(
    memberId: string,
    status: Season0MemberStatus,
    actorId: string,
    note?: string,
  ): Season0MemberRecord {
    const member = this.requireMember(memberId);

    const updated: Season0MemberRecord = {
      ...member,
      status,
      notes: note ?? member.notes ?? null,
    };

    this.members.set(memberId, updated);

    this.recordAction({
      type: 'member_status_changed',
      actorId,
      targetId: memberId,
      summary: `Member ${memberId} moved to ${status}`,
      payload: { memberId, status, note: note ?? null },
    });

    return updated;
  }

  public attachNote(memberId: string, actorId: string, note: string): Season0MemberRecord {
    const member = this.requireMember(memberId);
    const mergedNote = member.notes ? `${member.notes}\n${note}` : note;

    const updated: Season0MemberRecord = {
      ...member,
      notes: mergedNote,
    };

    this.members.set(memberId, updated);

    this.recordAction({
      type: 'note_attached',
      actorId,
      targetId: memberId,
      summary: `Note attached to ${memberId}`,
      payload: { memberId, note },
    });

    return updated;
  }

  public recordReceipt(
    input: Season0ReceiptRecord,
    actorId = 'system',
  ): Season0ReceiptRecord {
    const normalized: Season0ReceiptRecord = {
      receiptId: input.receiptId,
      userId: input.userId,
      amountCents: toFiniteInteger(input.amountCents, 0),
      currency: (input.currency ?? 'USD').toUpperCase(),
      source: input.source,
      issuedAt: input.issuedAt ?? nowIso(),
      settledAt: input.settledAt ?? null,
      reversedAt: input.reversedAt ?? null,
      metadata: { ...(input.metadata ?? {}) },
    };

    this.receipts.set(normalized.receiptId, normalized);

    const member = this.findMemberByUserId(normalized.userId);
    if (member) {
      const receiptsForUser = this.listReceiptsForUser(member.userId);
      const totals = sumReceiptDirectionally(receiptsForUser);

      this.members.set(member.memberId, {
        ...member,
        receiptTotalCents: totals.net,
      });
    }

    this.recordAction({
      type: normalized.source === 'manual_credit' ? 'manual_credit_issued' : 'bundle_ingested',
      actorId,
      targetId: normalized.receiptId,
      summary: `Receipt ${normalized.receiptId} recorded`,
      payload: normalized as unknown as Record<string, unknown>,
    });

    return normalized;
  }

  public issueManualCredit(
    userId: string,
    amountCents: number,
    actorId: string,
    reason: string,
  ): Season0ReceiptRecord {
    const receipt: Season0ReceiptRecord = {
      receiptId: `manual_${randomUUID()}`,
      userId,
      amountCents: toFiniteInteger(amountCents, 0),
      currency: 'USD',
      source: 'manual_credit',
      issuedAt: nowIso(),
      settledAt: nowIso(),
      metadata: {
        reason,
        issuedBy: actorId,
      },
    };

    return this.recordReceipt(receipt, actorId);
  }

  public setReferralThrottle(
    input: ReferralThrottleRecord,
    actorId = 'system',
  ): ReferralThrottleRecord {
    const normalized: ReferralThrottleRecord = {
      userId: input.userId,
      seasonId: input.seasonId || this.seasonId,
      remainingReferrals: Math.max(0, toFiniteInteger(input.remainingReferrals, 0)),
      cooldownUntil: input.cooldownUntil ?? null,
      suppressed: Boolean(input.suppressed),
      metadata: { ...(input.metadata ?? {}) },
    };

    this.referralThrottles.set(normalized.userId, normalized);

    this.recordAction({
      type: 'referral_throttle_updated',
      actorId,
      targetId: normalized.userId,
      summary: `Referral throttle updated for ${normalized.userId}`,
      payload: normalized as unknown as Record<string, unknown>,
    });

    return normalized;
  }

  public updateStampHealth(
    input: StampIssuanceHealthRecord,
    actorId = 'system',
  ): StampIssuanceHealthRecord {
    const normalized: StampIssuanceHealthRecord = {
      seasonId: input.seasonId || this.seasonId,
      totalStampsIssued: Math.max(0, toFiniteInteger(input.totalStampsIssued, 0)),
      totalStampsAvailable: Math.max(0, toFiniteInteger(input.totalStampsAvailable, 0)),
      updatedAt: input.updatedAt ?? nowIso(),
      metadata: { ...(input.metadata ?? {}) },
    };

    this.stampHealth.set(normalized.seasonId, normalized);

    this.recordAction({
      type: 'stamp_health_updated',
      actorId,
      targetId: normalized.seasonId,
      summary: `Stamp health updated for ${normalized.seasonId}`,
      payload: normalized as unknown as Record<string, unknown>,
    });

    return normalized;
  }

  public getMember(memberId: string): Season0MemberRecord | null {
    return this.members.get(memberId) ?? null;
  }

  public buildSnapshot(auditTail = DEFAULT_AUDIT_TAIL): Season0AdminSnapshot {
    const members = [...this.members.values()];
    const receipts = [...this.receipts.values()];
    const throttles = [...this.referralThrottles.values()];
    const stamp = this.stampHealth.get(this.seasonId) ?? {
      seasonId: this.seasonId,
      totalStampsIssued: 0,
      totalStampsAvailable: 0,
      updatedAt: nowIso(),
    };

    const totals = sumReceiptDirectionally(receipts);
    const activeMembers = members.filter((member) => ACTIVE_STATUSES.has(member.status));
    const paidUserIds = new Set(
      receipts.filter((receipt) => receipt.amountCents > 0).map((receipt) => receipt.userId),
    );

    const cohortsById = new Map<
      string,
      {
        cohortId: string;
        memberCount: number;
        activeMembers: number;
        totalReceiptCents: number;
      }
    >();

    for (const member of members) {
      const cohortId = member.cohortId ?? 'unassigned';
      if (!cohortsById.has(cohortId)) {
        cohortsById.set(cohortId, {
          cohortId,
          memberCount: 0,
          activeMembers: 0,
          totalReceiptCents: 0,
        });
      }

      const bucket = cohortsById.get(cohortId)!;
      bucket.memberCount += 1;
      if (ACTIVE_STATUSES.has(member.status)) {
        bucket.activeMembers += 1;
      }
      bucket.totalReceiptCents += toFiniteInteger(member.receiptTotalCents, 0);
    }

    return {
      seasonId: this.seasonId,
      generatedAt: nowIso(),
      totals: {
        members: members.length,
        activeMembers: activeMembers.length,
        paidMembers: [...paidUserIds].length,
        totalReceiptCents: totals.gross,
        refundCents: totals.refunds,
        netReceiptCents: totals.net,
        throttledUsers: throttles.filter((item) => Boolean(item.cooldownUntil)).length,
        suppressedUsers: throttles.filter((item) => Boolean(item.suppressed)).length,
        totalReferralCapacityRemaining: throttles.reduce(
          (sum, item) => sum + item.remainingReferrals,
          0,
        ),
        issuedStamps: stamp.totalStampsIssued,
        availableStamps: stamp.totalStampsAvailable,
      },
      cohorts: [...cohortsById.values()].sort(
        (left, right) => right.totalReceiptCents - left.totalReceiptCents,
      ),
      topReferrers: [...members]
        .map((member) => ({
          userId: member.userId,
          referralCode: member.referralCode ?? null,
          referralCount: toFiniteInteger(member.referralCount, 0),
          receiptTotalCents: toFiniteInteger(member.receiptTotalCents, 0),
        }))
        .sort((left, right) => {
          if (right.referralCount !== left.referralCount) {
            return right.referralCount - left.referralCount;
          }
          return right.receiptTotalCents - left.receiptTotalCents;
        })
        .slice(0, 25),
      anomalies: this.reconcile(),
      auditTrailTail: this.auditTrail.slice(-Math.max(1, auditTail)),
    };
  }

  public reconcile(): Season0AdminAnomaly[] {
    const anomalies: Season0AdminAnomaly[] = [];
    const members = [...this.members.values()];
    const receipts = [...this.receipts.values()];
    const referralCodeOwners = new Map<string, string[]>();

    for (const member of members) {
      if (member.referralCode) {
        const owners = referralCodeOwners.get(member.referralCode) ?? [];
        owners.push(member.memberId);
        referralCodeOwners.set(member.referralCode, owners);
      }

      if (toFiniteInteger(member.receiptTotalCents, 0) < 0) {
        anomalies.push({
          code: 'negative_receipt_total',
          severity: 'medium',
          targetId: member.memberId,
          message: `Member ${member.memberId} has a negative net receipt total`,
          metadata: {
            receiptTotalCents: member.receiptTotalCents ?? 0,
          },
        });
      }

      const hasReceipt = receipts.some((receipt) => receipt.userId === member.userId);
      if (ACTIVE_STATUSES.has(member.status) && !hasReceipt) {
        anomalies.push({
          code: 'member_without_receipt',
          severity: 'low',
          targetId: member.memberId,
          message: `Active member ${member.memberId} has no recorded receipt`,
          metadata: {
            userId: member.userId,
          },
        });
      }
    }

    for (const [code, ownerIds] of referralCodeOwners.entries()) {
      if (ownerIds.length > 1) {
        anomalies.push({
          code: 'duplicate_referral_code',
          severity: 'high',
          targetId: code,
          message: `Referral code ${code} is shared across multiple members`,
          metadata: {
            ownerIds,
          },
        });
      }
    }

    const knownUserIds = new Set(members.map((member) => member.userId));
    for (const receipt of receipts) {
      if (!knownUserIds.has(receipt.userId)) {
        anomalies.push({
          code: 'receipt_without_member',
          severity: 'medium',
          targetId: receipt.receiptId,
          message: `Receipt ${receipt.receiptId} is attached to a user without a member record`,
          metadata: {
            userId: receipt.userId,
          },
        });
      }
    }

    for (const throttle of this.referralThrottles.values()) {
      if (throttle.remainingReferrals < 0) {
        anomalies.push({
          code: 'over_throttled',
          severity: 'high',
          targetId: throttle.userId,
          message: `Throttle for ${throttle.userId} is below zero`,
          metadata: {
            remainingReferrals: throttle.remainingReferrals,
          },
        });
      }
    }

    const stamp = this.stampHealth.get(this.seasonId);
    if (stamp && stamp.totalStampsIssued > stamp.totalStampsAvailable) {
      anomalies.push({
        code: 'stamp_capacity_exceeded',
        severity: 'high',
        targetId: stamp.seasonId,
        message: `Stamp issuance exceeds configured capacity for ${stamp.seasonId}`,
        metadata: {
          issued: stamp.totalStampsIssued,
          available: stamp.totalStampsAvailable,
        },
      });
    }

    return anomalies.sort((left, right) => left.code.localeCompare(right.code));
  }

  public exportState(): {
    seasonId: string;
    members: Season0MemberRecord[];
    receipts: Season0ReceiptRecord[];
    referralThrottles: ReferralThrottleRecord[];
    stampHealth: StampIssuanceHealthRecord[];
    auditTrail: AdminActionRecord[];
  } {
    return {
      seasonId: this.seasonId,
      members: [...this.members.values()],
      receipts: [...this.receipts.values()],
      referralThrottles: [...this.referralThrottles.values()],
      stampHealth: [...this.stampHealth.values()],
      auditTrail: [...this.auditTrail],
    };
  }

  private requireMember(memberId: string): Season0MemberRecord {
    const member = this.members.get(memberId);
    if (!member) {
      throw new Error(`Season0 member not found: ${memberId}`);
    }
    return member;
  }

  private findMemberByUserId(userId: string): Season0MemberRecord | null {
    for (const member of this.members.values()) {
      if (member.userId === userId) {
        return member;
      }
    }
    return null;
  }

  private listReceiptsForUser(userId: string): Season0ReceiptRecord[] {
    return [...this.receipts.values()].filter((receipt) => receipt.userId === userId);
  }

  private recordAction(input: {
    type: AdminActionType;
    actorId: string;
    summary: string;
    payload: Record<string, unknown>;
    targetId?: string | null;
  }): void {
    this.auditTrail.push({
      actionId: randomUUID(),
      type: input.type,
      actorId: input.actorId,
      createdAt: nowIso(),
      targetId: input.targetId ?? null,
      summary: input.summary,
      payloadHash: payloadHash(input.payload),
      payload: input.payload,
    });
  }
}

export default Season0AdminImpl;
