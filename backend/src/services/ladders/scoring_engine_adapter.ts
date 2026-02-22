Here is the TypeScript file `backend/src/services/ladders/scoring_engine_adapter.ts` as per your specifications:

```typescript
/**
 * Scoring Engine Adapter for Ladders
 */

import { ScoringMath } from '../shared';

export interface RulesetHashDeckVersion {
  ruleset_hash: string;
  deck_version: number;
}

export class ScoringEngineAdapter {
  private readonly scoringMath: ScoringMath;

  constructor(scoringMath: ScoringMath) {
    this.scoringMath = scoringMath;
  }

  public score(rulesetHashDeckVersion: RulesetHashDeckVersion, gameReplay: any): number {
    return this.scoringMath.score(rulesetHashDeckVersion, gameReplay);
  }
}
