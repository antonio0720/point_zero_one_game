/**
 * Card
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/backend/game-engine/src/Card.ts
 */

export type CardType = 'OPPORTUNITY' | 'FUBAR' | 'PRIVILEGED';

export type SpecialEffect =
  | 'DOUBLE_INCOME_NEXT_TURN'
  | 'REDUCE_INCOME_40PCT_2TURNS'
  | 'HATER_SABOTAGE'
  | 'BONUS_NET_WORTH_5000'
  | null;

export interface CardConfig {
  type:          CardType;
  incomeEffect:  number;
  expenseEffect: number;
  specialEffect: SpecialEffect;
  weight:        number;
}

export class Card {
  constructor(
    public readonly id:     string,
    public readonly config: CardConfig,
  ) {}
}
