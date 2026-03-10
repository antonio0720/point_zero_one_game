/**
 * Solo mode for Point Zero One Digital's financial roguelike game.
 */

export interface SoloRunConfig {
  turns: number;
}

export interface BalanceSheet {
  assets: number;
  liabilities: number;
  equity: number;
}

export interface DailyChallenge {
  id: string;
  description: string;
  reward: number;
}

export interface PersonalGoal {
  id: string;
  description: string;
  target: number;
  progress: number;
}

/**
 * Represents the state of a solo game run.
 */
export class SoloGameRun {
  config: SoloRunConfig;
  balanceSheet: BalanceSheet;
  dailyChallenges: DailyChallenge[];
  personalGoals: PersonalGoal[];

  constructor(config: SoloRunConfig) {
    this.config = config;
    this.balanceSheet = { assets: 0, liabilities: 0, equity: 0 };
    this.dailyChallenges = [];
    this.personalGoals = [];
  }

  /**
   * Adds a daily challenge to the game run.
   * @param challenge The daily challenge to add.
   */
  addDailyChallenge(challenge: DailyChallenge): void {
    this.dailyChallenges.push(challenge);
  }

  /**
   * Adds a personal goal to the game run.
   * @param goal The personal goal to add.
   */
  addPersonalGoal(goal: PersonalGoal): void {
    this.personalGoals.push(goal);
  }
}
