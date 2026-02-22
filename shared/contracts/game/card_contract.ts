/**
 * Card Contract for Point Zero One Digital's financial roguelike game.
 * Strict TypeScript, no 'any', exporting public symbols with JSDoc.
 */

// CardDefinition Interface
export interface CardDefinition {
  id: number;
  name: string;
  description: string;
  cost: number;
  effects: CardEffect[];
}

// CardEffect Interface
export enum EffectOp {
  CASH_ADD = 'CASH_ADD',
  BURN_ADD = 'BURN_ADD',
  ASSET_ADD = 'ASSET_ADD',
  DEBT_ADD = 'DEBT_ADD',
  STATUS_ADD = 'STATUS_ADD',
  DRAW = 'DRAW',
  CHOICE = 'CHOICE',
  ROLL = 'ROLL',
  IF_HAS = 'IF_HAS',
  CHAIN = 'CHAIN',
}

export interface CardEffect {
  op: EffectOp;
  value?: number | string;
  target?: string;
  condition?: string;
}

// DeckDefinition Interface
export interface DeckDefinition {
  id: number;
  name: string;
  cards: CardDefinition[];
}
