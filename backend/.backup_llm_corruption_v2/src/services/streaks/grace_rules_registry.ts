Here is the TypeScript file `backend/src/services/streaks/grace_rules_registry.ts` as per your specifications:

```typescript
/**
 * Grace Rules Registry for Point Zero One Digital's financial roguelike game
 */

type Rule = {
  /** Unique identifier for the rule */
  id: number;

  /** Season ID this rule applies to */
  seasonId: number;

  /** The grace rule definition */
  definition: string;
};

/**
 * Registry of versioned grace rules, keyed by season ID.
 */
class GraceRulesRegistry {
  private readonly rules: Map<number, Rule[]>;

  constructor() {
    this.rules = new Map();
  }

  /**
   * Add a rule to the registry for the specified season.
   * @param seasonId The ID of the season the rule applies to.
   * @param rule The grace rule definition.
   */
  public addRule(seasonId: number, rule: Rule): void {
    const rulesForSeason = this.rules.get(seasonId) || [];
    rulesForSeason.push(rule);
    this.rules.set(seasonId, rulesForSeason);
  }

  /**
   * Get the grace rules for the specified season.
   * @param seasonId The ID of the season to get the rules for.
   */
  public getRulesForSeason(seasonId: number): Rule[] {
    return this.rules.get(seasonId) || [];
  }
}

export { GraceRulesRegistry, Rule };
