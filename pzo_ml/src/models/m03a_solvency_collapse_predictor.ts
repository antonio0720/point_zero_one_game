// tslint:disable:no-any strict-type-checking

import { MLBase } from '../ml_base';
import { RunSeed, TickIndex, MacroRegime, PortfolioSnapshot, ActionTimeline } from '../../types';

export class M03aSolvencyCollapsePredictor extends MLBase {
  public ml_enabled = true;

  private _gradientBoostedTree: any;
  private _auditHash: string;

  constructor() {
    super();
    this._gradientBoostedTree = new GradientBoostedTree();
    this._auditHash = crypto.createHash('sha256').update(JSON.stringify(this)).digest('hex');
  }

  public async predict(
    runSeed: RunSeed,
    tickIndex: TickIndex,
    macroRegime: MacroRegime,
    portfolioSnapshot: PortfolioSnapshot,
    actionTimeline: ActionTimeline
  ): Promise<{ score: number; topFactors: string[]; recommendation: string; auditHash: string }> {
    const input = {
      runSeed,
      tickIndex,
      macroRegime,
      portfolioSnapshot,
      actionTimeline,
    };

    const output = await this._gradientBoostedTree.predict(input);

    return {
      score: Math.min(Math.max(output.score, 0), 1),
      topFactors: output.topFactors.map((factor) => factor.toString()),
      recommendation: output.recommendation,
      auditHash: this._auditHash,
    };
  }
}

class GradientBoostedTree {
  public async predict(input: any): Promise<{ score: number; topFactors: string[]; recommendation: string }> {
    // implementation of gradient boosted tree
    return { score: 0.5, topFactors: ['factor1', 'factor2'], recommendation: 'recommendation' };
  }
}

export function getM03aSolvencyCollapsePredictor(): M03aSolvencyCollapsePredictor {
  return new M03aSolvencyCollapsePredictor();
}
