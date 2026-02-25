/**
 * M56PortfolioPlaystyleContracts — Contract shape for M056 doctrine draft output
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_server/src/multiplayer/mechanics/m056_portfolio_playstyle_contracts.ts
 */

/** The three canonical playstyle archetypes M056 produces contracts for */
export type PlaystyleArchetype =
  | 'GROWTH_INVESTOR'   // prefers LONG cards, leverage
  | 'INCOME_BUILDER'    // prefers cashflow cards, low risk
  | 'RISK_ARBITRAGEUR'; // prefers SHORT/HEDGE, volatility plays

/** Discriminator literal kept narrow so downstream switches are exhaustive */
export type ContractType = 'portfolio_playstyle_contract';

/**
 * A single portfolio playstyle contract emitted by M056.
 *
 * contract_value [0, 1]:
 *   How strongly this run/player expresses this archetype.
 *   Derived deterministically from seededFloat(audit_hash, `contract:${i}:${archetype}`).
 *   Not a probability — values across the 3 contracts are independent and
 *   do not need to sum to 1.
 */
export interface M56PortfolioPlaystyleContracts {
  /** Stable ID: `M056:<audit_hash_prefix>:<index>` */
  contract_id:    string;

  /** Discriminator literal */
  contract_type:  ContractType;

  /** Which playstyle this contract represents */
  archetype:      PlaystyleArchetype;

  /** Affinity score [0, 1] — seeded-derived, deterministic per run×player */
  contract_value: number;
}
