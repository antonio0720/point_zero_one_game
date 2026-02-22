// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M23aConfig } from './M23aConfig';
import { M23aModel } from './M23aModel';

export class M23a {
  private readonly config: M23aConfig;
  private readonly model: M23aModel;

  constructor(config: M23aConfig, model: M23aModel) {
    this.config = config;
    this.model = model;
  }

  public async detectHighlights(
    inputImage: Uint8Array,
    outputImage: Uint8Array
  ): Promise<Uint8Array> {
    if (!this.config.mlEnabled) {
      throw new Error('ML is not enabled');
    }

    const boundedInput = await this.boundedNudge(inputImage);
    const auditHash = await this.auditHash(boundedInput);

    const output = await this.model.predict(boundedInput, auditHash);

    return output;
  }

  private async boundedNudge(input: Uint8Array): Promise<Uint8Array> {
    // implement bounded nudges here
    return input;
  }

  private async auditHash(input: Uint8Array): Promise<string> {
    // implement audit hash here
    return 'audit_hash';
  }
}

export class M23aConfig {
  public mlEnabled: boolean;

  constructor(mlEnabled: boolean) {
    this.mlEnabled = mlEnabled;
  }
}

export class M23aModel {
  private readonly model: any; // tslint:disable-line:no-any

  constructor(model: any) { // tslint:disable-line:no-any
    this.model = model;
  }

  public async predict(input: Uint8Array, auditHash: string): Promise<Uint8Array> {
    return await this.model.predict(input);
  }
}
