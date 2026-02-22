// tslint:disable:no-any strict-type-checking

import { M144aConfig } from './M144aConfig';
import { M144aModel } from './M144aModel';

export class M144a {
  private config: M144aConfig;
  private model: M144aModel;

  constructor(config: M144aConfig) {
    this.config = config;
    this.model = new M144aModel();
  }

  public async run(input: any): Promise<any> {
    if (!this.config.ml_enabled) {
      return { output: 0, audit_hash: 'ml_disabled' };
    }

    const boundedInput = await this.boundedNudge(input);
    const output = await this.model.predict(boundedInput);

    if (output < 0 || output > 1) {
      throw new Error('Output must be between 0 and 1');
    }

    return { output, audit_hash: 'ml_enabled' };
  }

  private async boundedNudge(input: any): Promise<any> {
    const nudgedInput = await this.config.nudge(input);
    if (nudgedInput < 0 || nudgedInput > 1) {
      throw new Error('Nudged input must be between 0 and 1');
    }
    return nudgedInput;
  }

  public get config(): M144aConfig {
    return this.config;
  }

  public set config(value: M144aConfig) {
    this.config = value;
  }

  public get model(): M144aModel {
    return this.model;
  }

  public set model(value: M144aModel) {
    this.model = value;
  }
}

export { M144a };
