Here is the TypeScript file `shared/contracts/season0/streaks_contract.ts` based on your specifications:

```typescript
/**
 * Streaks Contract for Point Zero One Digital's financial roguelike game
 */

type StreakId = number;
type PlayerId = number;
type StreakType = 'daily' | 'weekly';
type GracePeriod = number;
type FreezeDuration = number;
type EvolutionTrigger = number[];

/**
 * Represents a streak in the game.
 */
export interface Streak {
  id: StreakId;
  playerId: PlayerId;
  type: StreakType;
  currentStreak: number;
  maxStreak: number;
  lastActivity: Date;
  gracePeriod: GracePeriod;
  frozenUntil?: Date | null;
  evolutionTriggers: EvolutionTrigger;
}

/**
 * Creates a new streak for the given player and type.
 */
export function createStreak(playerId: PlayerId, type: StreakType): Streak {
  const initialStreak = 0;
  const maxStreak = 30;
  const gracePeriod = 7; // days
  const evolutionTriggers = [14, 28]; // days

  return {
    id: undefined as StreakId | undefined,
    playerId,
    type,
    currentStreak: initialStreak,
    maxStreak,
    lastActivity: new Date(),
    gracePeriod,
    frozenUntil: null,
    evolutionTriggers,
  };
}

/**
 * Updates the given streak with a new activity.
 */
export function updateStreak(streak: Streak): Streak {
  const currentTime = new Date();
  const gracePeriod = streak.gracePeriod;
  const isWithinGracePeriod = currentTime - streak.lastActivity <= gracePeriod * 24 * 60 * 60 * 1000;

  if (isWithinGracePeriod) {
    streak.currentStreak += 1;
    streak.lastActivity = currentTime;
  } else if (!streak.frozenUntil || currentTime >= streak.frozenUntil) {
    // If the grace period has passed and the streak is not frozen, reset the streak.
    streak = createStreak(streak.playerId, streak.type);
  }

  return streak;
}

/**
 * Freezes the given streak for a specified duration.
 */
export function freezeStreak(streak: Streak, freezeDuration: FreezeDuration): Streak {
  const frozenUntil = new Date();
  frozenUntil.setTime(frozenUntil.getTime() + freezeDuration * 24 * 60 * 60 * 1000); // in milliseconds

  return { ...streak, frozenUntil };
}
