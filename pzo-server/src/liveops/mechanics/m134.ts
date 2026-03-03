// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M134Mechanics } from './m134';
import { M134Config } from './config';

export class M134NpcCounterpartiesDeterministicPersonalitiesNoAi extends M134Mechanics {
  private readonly mlEnabled: boolean;
  private readonly auditHash: string;

  constructor(config: M134Config) {
    super();
    this.mlEnabled = config.mlEnabled;
    this.auditHash = config.auditHash;
  }

  public getMlEnabled(): boolean {
    return this.mlEnabled;
  }

  public getAuditHash(): string {
    return this.auditHash;
  }

  public getOutput(value: number): [number, string] {
    if (this.mlEnabled) {
      const output = Math.min(Math.max(value * 0.1, 0), 1);
      return [output, `M134NpcCounterpartiesDeterministicPersonalitiesNoAi output: ${output}`];
    } else {
      return [value, 'M134NpcCounterpartiesDeterministicPersonalitiesNoAi output: value'];
    }
  }

  public getDetermination(): number {
    // Determinism is preserved by always returning the same value
    return 0.5;
  }
}
