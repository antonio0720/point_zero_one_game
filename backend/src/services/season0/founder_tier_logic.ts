/**
 * Founder Tier Logic — Season 0
 * Point Zero One · Density6 LLC · Confidential
 *
 * Tier ladder (earned only, never purchased):
 *   Basic → Bronze → Silver → Gold → Founder
 *
 * Promotion thresholds (any axis triggers promotion):
 *   ┌─────────┬────────┬───────────┬────────┐
 *   │  Tier   │ Streak │ Referrals │ Events │
 *   ├─────────┼────────┼───────────┼────────┤
 *   │ Bronze  │   ≥1   │    ≥1     │   ≥1   │
 *   │ Silver  │   ≥5   │    ≥3     │   ≥2   │
 *   │ Gold    │   ≥9   │    ≥5     │   ≥3   │
 *   │ Founder │      grant only        │
 *   └─────────┴────────┴───────────┴────────┘
 *
 * Invariants:
 *   - Tiers NEVER downgrade — highest achieved tier is locked in.
 *   - Founder tier blocks all purchase attempts (anti-purchase guard).
 *   - Internal user registry lets referrer tiers update when
 *     their referred users register.
 */

export type TierName = 'Basic' | 'Bronze' | 'Silver' | 'Gold' | 'Founder';

export interface FounderTier {
  id: number;
  userId: string;
  tier: TierName;
  streak: number;
  referrals: number;
  events: string[];
  createdAt: Date;
}

export interface UserRef {
  id: string;
  currentTier: TierName | string;
  referralCode?: string;
}

// ─── Tier Rank Helpers ────────────────────────────────────────────────────────

const TIER_ORDER: TierName[] = ['Basic', 'Bronze', 'Silver', 'Gold', 'Founder'];

function tierRank(tier: string): number {
  const idx = TIER_ORDER.indexOf(tier as TierName);
  return idx === -1 ? 0 : idx;
}

function higherTier(a: string, b: string): TierName {
  return tierRank(a) >= tierRank(b) ? (a as TierName) : (b as TierName);
}

function computeTierFromMetrics(
  streak: number,
  referralCount: number,
  eventCount: number,
): TierName {
  if (streak >= 9 || referralCount >= 5 || eventCount >= 3) return 'Gold';
  if (streak >= 5 || referralCount >= 3 || eventCount >= 2) return 'Silver';
  if (streak >= 1 || referralCount >= 1 || eventCount >= 1) return 'Bronze';
  return 'Basic';
}

// ─── FounderTierLogic Service ─────────────────────────────────────────────────

export class FounderTierLogic {
  private readonly streaks   = new Map<string, number>();
  private readonly referrals = new Map<string, number>();
  private readonly events    = new Map<string, Set<string>>();
  private readonly registry  = new Map<string, UserRef>();

  private register(user: UserRef): void {
    if (!this.registry.has(user.id)) {
      this.registry.set(user.id, user);
    }
  }

  private getMetrics(userId: string) {
    return {
      streak:        this.streaks.get(userId)        ?? 0,
      referralCount: this.referrals.get(userId)      ?? 0,
      eventCount:    this.events.get(userId)?.size   ?? 0,
    };
  }

  private recalculate(user: UserRef): void {
    const { streak, referralCount, eventCount } = this.getMetrics(user.id);
    const computed = computeTierFromMetrics(streak, referralCount, eventCount);
    user.currentTier = higherTier(user.currentTier, computed);
  }

  // ── Streak ────────────────────────────────────────────────────────────────

  incrementStreak(user: UserRef): void {
    this.register(user);
    this.streaks.set(user.id, (this.streaks.get(user.id) ?? 0) + 1);
    this.recalculate(user);
  }

  decrementStreak(user: UserRef): void {
    this.register(user);
    const cur = this.streaks.get(user.id) ?? 0;
    this.streaks.set(user.id, Math.max(0, cur - 1));
    this.recalculate(user); // higherTier enforces no-downgrade
  }

  // ── Referrals ─────────────────────────────────────────────────────────────
  /**
   * registerReferral(participant, referrerId)
   *
   * Credits the participant (+1 referral for joining the network) and,
   * if the referrerId is already in the registry, credits the referrer too
   * (rewarding them when their invitee joins).
   */
  registerReferral(user: UserRef, referrerId: string): void {
    this.register(user);
    this.referrals.set(user.id, (this.referrals.get(user.id) ?? 0) + 1);
    this.recalculate(user);

    const referrer = this.registry.get(referrerId);
    if (referrer) {
      this.referrals.set(referrer.id, (this.referrals.get(referrer.id) ?? 0) + 1);
      this.recalculate(referrer);
    }
  }

  revokeReferral(user: UserRef, _referralCode: string): void {
    this.register(user);
    const cur = this.referrals.get(user.id) ?? 0;
    this.referrals.set(user.id, Math.max(0, cur - 1));
    this.recalculate(user); // no-downgrade enforced
  }

  // ── Events ────────────────────────────────────────────────────────────────

  triggerEvent(user: UserRef, eventName: string): void {
    this.register(user);
    if (!this.events.has(user.id)) this.events.set(user.id, new Set());
    this.events.get(user.id)!.add(eventName);
    this.recalculate(user);
  }

  revokeEvent(user: UserRef, eventName: string): void {
    this.register(user);
    this.events.get(user.id)?.delete(eventName);
    this.recalculate(user); // no-downgrade enforced
  }

  // ── Founder Guard ─────────────────────────────────────────────────────────

  attemptPurchase(user: UserRef, _productId: string): void {
    if (user.currentTier === 'Founder') return; // silently blocked
    // Non-Founder purchase delegation would go here
  }

  grantFounderTier(user: UserRef): void {
    this.register(user);
    user.currentTier = 'Founder';
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  getMetricsSnapshot(userId: string) {
    const user = this.registry.get(userId);
    const { streak, referralCount } = this.getMetrics(userId);
    return {
      tier:      (user?.currentTier ?? 'Basic') as TierName,
      streak,
      referrals: referralCount,
      events:    Array.from(this.events.get(userId) ?? []),
    };
  }
}

// ─── Pure Functional API (for DB-backed layer) ────────────────────────────────

export function computeTierForMetrics(
  streak: number,
  referrals: number,
  events: string[],
): TierName {
  return computeTierFromMetrics(streak, referrals, events.length);
}

export function assignFounderTier(
  userId: number,
  streak: number,
  referrals: number,
  events: string[],
): FounderTier {
  return {
    id:        0,
    userId:    String(userId),
    tier:      computeTierFromMetrics(streak, referrals, events.length),
    streak,
    referrals,
    events,
    createdAt: new Date(),
  };
}

export function isEligibleForUpgrade(
  currentTier: TierName,
  streak: number,
  referrals: number,
  events: string[],
): boolean {
  if (currentTier === 'Gold' || currentTier === 'Founder') return false;
  const computed = computeTierFromMetrics(streak, referrals, events.length);
  return tierRank(computed) > tierRank(currentTier);
}