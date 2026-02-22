// tslint:disable:no-any strict-type-checking
import { M059aConfig } from './M059aConfig';
import { BoundedNudge } from '../utils/BoundedNudge';

export class M059a {
  private readonly config: M059aConfig;
  private readonly boundedNudge: BoundedNudge;

  constructor(config: M059aConfig) {
    this.config = config;
    this.boundedNudge = new BoundedNudge(0, 1);
  }

  public run(input: number[]): [number[], string] {
    if (!this.config.mlEnabled) {
      return [[], 'ML disabled'];
    }

    const auditHash = this.calculateAuditHash(input);

    let output = this.boundedNudge.nudge(this.calculateComplexityHeatCalibratorComboDegeneracyDetector(input));

    return [
      [output],
      `audit_hash=${auditHash}`,
    ];
  }

  private calculateAuditHash(input: number[]): string {
    const hash = input.reduce((acc, current) => acc + current.toString(), '');
    return hash;
  }

  private calculateComplexityHeatCalibratorComboDegeneracyDetector(input: number[]): number {
    // implementation of the M59a algorithm
    // for demonstration purposes only
    return input.reduce((acc, current) => acc + current, 0);
  }
}

export { M059aConfig };
