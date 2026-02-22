import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NeverWinAdvantageGuard } from '../../never_win_advantage_guard';
import { Item } from '../../../../domain/item';
import { CosmeticItem } from '../../cosmetic_item';
import { PurchasableItem } from '../../purchasable_item';
import { SubscriptionAnalytics } from '../../subscription_analytics';

let guard: NeverWinAdvantageGuard;

beforeEach(() => {
  guard = new NeverWinAdvantageGuard();
});

afterEach(() => {
  // Reset any potential side effects after each test
});

describe('NeverWinAdvantageGuard', () => {
  it('should pass all purchasable items', () => {
    const validItem1 = new PurchasableItem({ id: 'valid_item_1', winProbabilityModifier: 0 });
    const validItem2 = new PurchasableItem({ id: 'valid_item_2', winProbabilityModifier: 0 });

    expect(guard.isAllowed(validItem1)).toBe(true);
    expect(guard.isAllowed(validItem2)).toBe(true);
  });

  it('should block any item that increases win probability', () => {
    const winningItem1 = new PurchasableItem({ id: 'winning_item_1', winProbabilityModifier: 10 });
    const winningItem2 = new PurchasableItem({ id: 'winning_item_2', winProbabilityModifier: -5 }); // Negative win probability modifier for clarity

    expect(guard.isAllowed(winningItem1)).toBe(false);
    expect(guard.isAllowed(winningItem2)).toBe(true); // Negative win probability modifier should not be blocked
  });

  it('should pass cosmetic items', () => {
    const cosmeticItem = new CosmeticItem({ id: 'cosmetic_item' });

    expect(guard.isAllowed(cosmeticItem)).toBe(true);
  });

  it('should pass subscription analytics', () => {
    const subscriptionAnalytics = new SubscriptionAnalytics();

    expect(guard.isAllowed(subscriptionAnalytics)).toBe(true);
  });
});
