/**
 * Founder Tier Logic — Test Suite
 * Run: npx vitest run founder_tier_logic.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FounderTierLogic,
  UserRef,
  computeTierForMetrics,
  isEligibleForUpgrade,
} from './founder_tier_logic';

function makeUser(id: string, tier = 'Basic'): UserRef {
  return { id, currentTier: tier };
}

describe('Founder Tier Logic', () => {
  let service: FounderTierLogic;

  beforeEach(() => {
    service = new FounderTierLogic();
  });

  it('should upgrade tier via streak', () => {
    const user = makeUser('123');
    service.incrementStreak(user);
    expect(user.currentTier).toEqual('Bronze');

    for (let i = 0; i < 10; i++) {
      service.incrementStreak(user);
      if (i === 3) expect(user.currentTier).toEqual('Silver'); // streak = 5
      if (i === 7) expect(user.currentTier).toEqual('Gold');   // streak = 9
    }
  });

  it('should upgrade tier via referrals', () => {
    const user = makeUser('123');
    service.registerReferral(user, 'DEF');
    expect(user.currentTier).toEqual('Bronze');

    for (let i = 0; i < 5; i++) {
      const referredUser = makeUser(`REF_${i}`);
      service.registerReferral(referredUser, user.id);
      if (i === 2) expect(user.currentTier).toEqual('Silver');
      if (i === 4) expect(user.currentTier).toEqual('Gold');
    }
  });

  it('should upgrade tier via events', () => {
    const user = makeUser('123');
    service.triggerEvent(user, 'Founder_Event_1');
    expect(user.currentTier).toEqual('Bronze');

    for (let i = 0; i < 3; i++) {
      service.triggerEvent(user, `Founder_Event_${i + 2}`);
      if (i === 1) expect(user.currentTier).toEqual('Silver'); // 3 events ≥ 2
      if (i === 2) expect(user.currentTier).toEqual('Gold');   // 4 events ≥ 3
    }
  });

  it('should not allow tier downgrade via streak', () => {
    const user = makeUser('123', 'Gold');
    service.decrementStreak(user);
    expect(user.currentTier).toEqual('Gold');
  });

  it('should not allow tier downgrade via referrals', () => {
    const user = makeUser('123', 'Gold');
    service.revokeReferral(user, 'ABC');
    expect(user.currentTier).toEqual('Gold');
  });

  it('should not allow tier downgrade via events', () => {
    const user = makeUser('123', 'Gold');
    service.revokeEvent(user, 'Founder_Event_1');
    expect(user.currentTier).toEqual('Gold');
  });

  it('should guarantee anti-purchase for founder tier users', () => {
    const user = makeUser('123', 'Founder');
    service.attemptPurchase(user, 'Standard_Subscription');
    expect(user.currentTier).toEqual('Founder');
  });
});

describe('computeTierForMetrics (pure)', () => {
  it('returns Basic for zero activity', () => {
    expect(computeTierForMetrics(0, 0, [])).toBe('Basic');
  });
  it('Bronze from single activity on any axis', () => {
    expect(computeTierForMetrics(1, 0, [])).toBe('Bronze');
    expect(computeTierForMetrics(0, 1, [])).toBe('Bronze');
    expect(computeTierForMetrics(0, 0, ['e1'])).toBe('Bronze');
  });
  it('Silver thresholds', () => {
    expect(computeTierForMetrics(5, 0, [])).toBe('Silver');
    expect(computeTierForMetrics(0, 3, [])).toBe('Silver');
    expect(computeTierForMetrics(0, 0, ['a', 'b'])).toBe('Silver');
  });
  it('Gold thresholds', () => {
    expect(computeTierForMetrics(9, 0, [])).toBe('Gold');
    expect(computeTierForMetrics(0, 5, [])).toBe('Gold');
    expect(computeTierForMetrics(0, 0, ['a', 'b', 'c'])).toBe('Gold');
  });
});

describe('isEligibleForUpgrade (pure)', () => {
  it('false for Founder', () => {
    expect(isEligibleForUpgrade('Founder', 100, 100, ['e'])).toBe(false);
  });
  it('false for Gold', () => {
    expect(isEligibleForUpgrade('Gold', 100, 100, ['e'])).toBe(false);
  });
  it('true when metrics exceed current tier', () => {
    expect(isEligibleForUpgrade('Basic', 1, 0, [])).toBe(true);
    expect(isEligibleForUpgrade('Bronze', 5, 0, [])).toBe(true);
    expect(isEligibleForUpgrade('Silver', 9, 0, [])).toBe(true);
  });
  it('false when metrics do not exceed current tier', () => {
    expect(isEligibleForUpgrade('Bronze', 0, 0, [])).toBe(false);
  });
});