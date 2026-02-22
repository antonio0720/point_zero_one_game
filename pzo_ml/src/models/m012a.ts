// tslint:disable:no-any strict-type-checking no-object-literal-types
import { M012aConfig } from './m012a_config';
import { AuditHash } from '../audit_hash';

export class M12a {
  private config: M012aConfig;
  private mlEnabled: boolean;

  constructor(config: M012aConfig, mlEnabled: boolean) {
    this.config = config;
    this.mlEnabled = mlEnabled;
  }

  public calculateRisk(inputData: any): number {
    if (!this.mlEnabled) {
      throw new Error('ML is disabled');
    }
    const boundedInput = inputData.map((x) => Math.max(0, Math.min(x, 1)));
    const riskScore = this.config.model.predict(boundedInput);
    return Math.max(0, Math.min(riskScore, 1));
  }

  public getAuditHash(): AuditHash {
    const auditData: any[] = [];
    // Add data to be audited here
    const auditHash = new AuditHash(auditData);
    return auditHash;
  }
}
