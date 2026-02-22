// tslint:disable:no-any strict-type-checking

import { M133Config } from './M133Config';
import { M133State } from './M133State';

export class M133Mechanics {
  private config: M133Config;
  private state: M133State;

  constructor(config: M133Config, state: M133State) {
    this.config = config;
    this.state = state;
  }

  public getMeta(): { [key: string]: any } {
    const meta: { [key: string]: any } = {};

    if (this.config.ml_enabled) {
      // Use a bounded output from the ML model
      const mlOutput = this.getMLModelOutput();
      meta['ml_output'] = Math.min(Math.max(mlOutput, 0), 1);
    }

    return meta;
  }

  public getAuditHash(): string {
    const auditData: { [key: string]: any } = {};
    // Add relevant data to the audit hash
    Object.assign(auditData, this.config);
    Object.assign(auditData, this.state);

    if (this.config.ml_enabled) {
      // Include ML model output in the audit hash
      const mlOutput = this.getMLModelOutput();
      auditData['ml_output'] = Math.min(Math.max(mlOutput, 0), 1);
    }

    return crypto.createHash('sha256').update(JSON.stringify(auditData)).digest('hex');
  }

  private getMLModelOutput(): number {
    // Call the ML model to get its output
    const mlModel = this.config.ml_model;
    if (!mlModel) {
      throw new Error('ML model not configured');
    }
    return mlModel.getOutput();
  }
}

export function createM133Mechanics(config: M133Config, state: M133State): M133Mechanics {
  return new M133Mechanics(config, state);
}
