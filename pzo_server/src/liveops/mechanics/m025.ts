// tslint:disable:no-any strict-type-checking
import { MlModel } from '../ml_model';
import { AuditHash } from './audit_hash';

export class M025 {
  private mlEnabled = false;
  private auditHash: AuditHash;

  constructor(auditHash: AuditHash) {
    this.auditHash = auditHash;
  }

  public getMlEnabled(): boolean {
    return this.mlEnabled;
  }

  public setMlEnabled(enabled: boolean): void {
    this.mlEnabled = enabled;
  }

  public getAuditHash(): AuditHash {
    return this.auditHash;
  }
}

export class M025OptionalMetrics extends M025 {
  private mlModel: MlModel;

  constructor(auditHash: AuditHash, mlModel: MlModel) {
    super(auditHash);
    this.mlModel = mlModel;
  }

  public getMlModel(): MlModel {
    return this.mlModel;
  }
}

export class M025OptionalMetricsOutput extends M025OptionalMetrics {
  private output: number;

  constructor(auditHash: AuditHash, mlModel: MlModel) {
    super(auditHash, mlModel);
    this.output = Math.min(Math.max(this.mlModel.getOutput(), 0), 1);
  }

  public getOutput(): number {
    return this.output;
  }
}
