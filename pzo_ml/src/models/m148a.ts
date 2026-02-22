// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M148aConfig } from './M148aConfig';
import { M148aModel } from './M148aModel';

export class M148a {
  private readonly config: M148aConfig;
  private readonly model: M148aModel;

  constructor(config: M148aConfig, model: M148aModel) {
    this.config = config;
    this.model = model;
  }

  public freezeForecast(inputData: any): number {
    if (!this.mlEnabled()) {
      throw new Error('ML is disabled');
    }
    const output = this.model.freezeForecast(inputData);
    return Math.max(0, Math.min(output, 1));
  }

  public premiumEstimator(inputData: any): number {
    if (!this.mlEnabled()) {
      throw new Error('ML is disabled');
    }
    const output = this.model.premiumEstimator(inputData);
    return Math.max(0, Math.min(output, 1));
  }

  private mlEnabled(): boolean {
    // tslint:disable:no-console
    console.log(`M148a.ml_enabled: ${this.config.ml_enabled}`);
    return this.config.ml_enabled;
  }

  public auditHash(): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(this.config));
    hash.update(JSON.stringify(this.model));
    return hash.digest('hex');
  }
}

export class M148aConfig {
  ml_enabled: boolean;
  bounded_nudges: number[];
  audit_hash: string;

  constructor(config: any) {
    this.ml_enabled = config.ml_enabled || false;
    this.bounded_nudges = (config.bounded_nudges || []).map((nudge: number) => Math.max(0, Math.min(nudge, 1)));
    this.audit_hash = config.audit_hash || '';
  }
}

export class M148aModel {
  freezeForecast(inputData: any): number {
    // implement your ML model here
    return 0.5;
  }

  premiumEstimator(inputData: any): number {
    // implement your ML model here
    return 0.7;
  }
}
