// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M103aConfig } from './M103aConfig';
import { M103aModel } from './M103aModel';

export class M103a {
  private config: M103aConfig;
  private model: M103aModel;

  constructor(config: M103aConfig, model: M103aModel) {
    this.config = config;
    this.model = model;
  }

  public async execute(input: any): Promise<any> {
    if (!this.config.ml_enabled) {
      throw new Error('ML is not enabled');
    }

    const output = await this.model.predict(input);
    if (output < 0 || output > 1) {
      throw new Error(`Output must be between 0 and 1, but got ${output}`);
    }

    return output;
  }
}

export class M103aConfig {
  public ml_enabled: boolean;
  public audit_hash: string;

  constructor(mlEnabled: boolean, auditHash: string) {
    this.ml_enabled = mlEnabled;
    this.audit_hash = auditHash;
  }
}

export class M103aModel {
  private model: any;

  constructor(model: any) {
    this.model = model;
  }

  public async predict(input: any): Promise<number> {
    return this.model.predict(input);
  }
}
