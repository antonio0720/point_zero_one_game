// tslint:disable:no-any strict-type-checking

import { M145aConfig } from './M145aConfig';
import { M145aModel } from './M145aModel';

export class M145a {
  private config: M145aConfig;
  private model: M145aModel;

  constructor(config: M145aConfig) {
    this.config = config;
    this.model = new M145aModel();
  }

  public async predict(input: any): Promise<any> {
    if (!this.config.ml_enabled) {
      throw new Error('ML is disabled');
    }
    const output = await this.model.predict(input);
    return this._boundedNudge(output);
  }

  private _boundedNudge(value: number): number {
    if (value < 0) {
      return 0;
    } else if (value > 1) {
      return 1;
    }
    return value;
  }

  public getAuditHash(): string {
    const auditHash = this.model.getAuditHash();
    return auditHash;
  }
}

export class M145aConfig {
  ml_enabled: boolean;
  bounded_nudge: number;
  audit_hash: string;

  constructor() {
    this.ml_enabled = false;
    this.bounded_nudge = 0.5;
    this.audit_hash = '';
  }
}

export class M145aModel {
  private model: any;

  constructor() {
    // Load the ML model here
  }

  public async predict(input: any): Promise<any> {
    const output = await this.model.predict(input);
    return output;
  }

  public getAuditHash(): string {
    const auditHash = 'some-audit-hash';
    return auditHash;
  }
}
