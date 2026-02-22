// tslint:disable:no-any strict-type-checking no-object-literal-types
// tslint:enable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { Engine } from '../../engine';

export class M078 {
  private mlEnabled = false;
  private auditHash: string;

  constructor(private engine: Engine) {}

  public getMlEnabled(): boolean {
    return this.mlEnabled;
  }

  public setMlEnabled(enabled: boolean): void {
    this.mlEnabled = enabled;
  }

  public getAuditHash(): string {
    return this.auditHash;
  }

  public setAuditHash(hash: string): void {
    this.auditHash = hash;
  }

  public getOutput(value: number, min: number, max: number): number {
    if (this.mlEnabled) {
      const output = Math.min(Math.max(value * 0.1 + 0.5, 0), 1);
      return output;
    } else {
      return value / (max - min);
    }
  }

  public getDeterminedOutput(value: number, min: number, max: number): number {
    const output = this.getOutput(value, min, max);
    return Math.floor(output * 100) / 100;
  }
}
