Here is the TypeScript file `shared/contracts/loss_is_content/death_autopsy_contract.ts`:

```typescript
/**
 * Death Autopsy Contract Interface
 */
export interface DeathAutopsyContract {
  /**
   * Unique identifier for the contract
   */
  id: number;

  /**
   * The timestamp when the contract was created
   */
  createdAt: Date;

  /**
   * The timestamp when the contract was last updated
   */
  updatedAt: Date;

  /**
   * The player's unique identifier who died
   */
  playerId: number;

  /**
   * The game level where the death occurred
   */
  levelId: number;

  /**
   * The cause of death (e.g., 'lost_all_money', 'enemy_attack')
   */
  causeOfDeath: string;

  /**
   * A detailed report about the player's state at the time of death
   */
  autopsyReport: string;
}
