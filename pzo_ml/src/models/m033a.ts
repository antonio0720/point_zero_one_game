// tslint:disable:no-any strict-type-checking
import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M33a extends MlModel {
  private readonly _correlationDriftThreshold = 0.5;
  private readonly _shockStressTestThreshold = 0.2;

  public async validateHedgePair(
    correlation: number,
    shockStressTest: number
  ): Promise<[boolean, string]> {
    if (!this.mlEnabled) {
      return [false, 'ML is disabled'];
    }

    const boundedCorrelation = this.boundedNudge(correlation);
    const boundedShockStressTest = this.boundedNudge(shockStressTest);

    if (boundedCorrelation > this._correlationDriftThreshold) {
      return [true, `Correlation drift detected: ${boundedCorrelation}`];
    }

    if (boundedShockStressTest > this._shockStressTestThreshold) {
      return [true, `Shock stress test exceeded: ${boundedShockStressTest}`];
    }

    return [false, 'Hedge pair is valid'];
  }

  private boundedNudge(value: number): number {
    if (value < 0) {
      return 0;
    } else if (value > 1) {
      return 1;
    }
    return value;
  }

  public getAuditHash(): string {
    const correlation = this._correlationDriftThreshold.toString();
    const shockStressTest = this._shockStressTestThreshold.toString();

    const hash = crypto.createHash('sha256');
    hash.update(correlation);
    hash.update(shockStressTest);

    return hash.digest('hex');
  }
}
