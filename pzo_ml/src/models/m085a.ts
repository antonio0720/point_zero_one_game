// tslint:disable:no-any strict-type-checking
import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M85a extends MlModel {
  private readonly _auditHash: string;
  private readonly _mlEnabled: boolean;

  constructor(
    auditHash: string,
    mlEnabled: boolean = true
  ) {
    super();
    this._auditHash = auditHash;
    this._mlEnabled = mlEnabled;
  }

  public getAuditHash(): string {
    return this._auditHash;
  }

  public isMlEnabled(): boolean {
    return this._mlEnabled;
  }

  public async predict(
    input: any,
    boundedNudge: BoundedNudge
  ): Promise<number> {
    if (!this.isMlEnabled()) {
      throw new Error('ML model is disabled');
    }
    const output = await super.predict(input, boundedNudge);
    return Math.max(0, Math.min(output, 1));
  }

  public getBoundedOutput(
    input: any,
    boundedNudge: BoundedNudge
  ): number {
    if (!this.isMlEnabled()) {
      throw new Error('ML model is disabled');
    }
    const output = super.getBoundedOutput(input, boundedNudge);
    return Math.max(0, Math.min(output, 1));
  }

  public getAuditHashForInput(
    input: any
  ): string {
    if (!this.isMlEnabled()) {
      throw new Error('ML model is disabled');
    }
    const auditHash = super.getAuditHashForInput(input);
    return this._auditHash + auditHash;
  }
}
