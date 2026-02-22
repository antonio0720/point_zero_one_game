# PVP Ladders Reward Catalog

This document outlines the reward catalog entries, unlock conditions, and safety measures for our PVP ladders system in Point Zero One Digital's 12-minute financial roguelike game.

## Non-Negotiables

1. **Deterministic Rewards**: All rewards must be deterministic to ensure fairness and prevent pay-to-win scenarios.
2. **Clear Unlock Conditions**: Each reward should have a transparent and achievable unlock condition.
3. **Production-Grade Quality**: All rewards must be production-grade, deployment-ready, and adhere to strict TypeScript standards (no use of 'any').

## Implementation Spec

### Reward Catalog Entries

Each reward will have a unique identifier, name, description, unlock condition, and reward value.

```typescript
interface Reward {
  id: string;
  name: string;
  description: string;
  unlockCondition: UnlockCondition;
  rewardValue: RewardValue;
}
```

### Unlock Condition

Unlock conditions will be defined as a function that returns a boolean indicating whether the condition is met.

```typescript
interface UnlockCondition {
  check(player: Player): boolean;
}
```

### Reward Value

Reward values can be in-game resources, power-ups, or cosmetic items. They will be defined as a type-safe object with properties corresponding to the reward's value components.

```typescript
interface RewardValue {
  resource: number;
  powerUp: PowerUp[];
  cosmeticItem: CosmeticItem[];
}
```

### Player

The player object will contain relevant player data, including progress and unlocked rewards.

```typescript
interface Player {
  progress: Progress;
  unlockedRewards: Reward[];
}
```

## Edge Cases

1. **Multiple Unlock Conditions**: If a reward has multiple unlock conditions, they should all be met for the reward to be unlocked.
2. **Progress Tracking**: The system must track player progress accurately and reliably to ensure rewards are only unlocked when appropriate.
3. **Reward Duplication Prevention**: To prevent players from receiving duplicate rewards, the system should check for existing rewards before granting new ones.
