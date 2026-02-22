// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { MlModel } from './ml_model';
import { AuditHash } from '../audit_hash';

export class M143a extends MlModel {
  private readonly _boundedNudges: number;
  private readonly _auditHash: string;

  constructor(
    boundedNudges: number,
    auditHash: string,
    mlEnabled: boolean = true
  ) {
    super();
    this._boundedNudges = boundedNudges;
    this._auditHash = auditHash;
    if (mlEnabled) {
      this.mlEnabled = true;
    } else {
      this.mlEnabled = false;
    }
  }

  public get boundedNudges(): number {
    return this._boundedNudges;
  }

  public set boundedNudges(value: number) {
    if (value < 0 || value > 1) {
      throw new Error('Bounded nudges must be between 0 and 1');
    }
    this._boundedNudges = value;
  }

  public get auditHash(): string {
    return this._auditHash;
  }

  public set auditHash(value: string) {
    if (typeof value !== 'string') {
      throw new Error('Audit hash must be a string');
    }
    this._auditHash = value;
  }

  public get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  public set mlEnabled(value: boolean) {
    if (typeof value !== 'boolean') {
      throw new Error('ML enabled must be a boolean');
    }
    this._mlEnabled = value;
  }

  private _mlEnabled: boolean;

  public predict(input: number[]): number[] {
    if (!this.mlEnabled) {
      return [];
    }
    const output = input.map((x) => Math.min(Math.max(x, 0), 1));
    return output;
  }
}
