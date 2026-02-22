// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M138aConfig } from './M138aConfig';
import { LoadPredictor } from './LoadPredictor';
import { GracefulSheddingPlanner } from './GracefulSheddingPlanner';

export class M138a {
  private readonly config: M138aConfig;
  private readonly loadPredictor: LoadPredictor;
  private readonly gracefulSheddingPlanner: GracefulSheddingPlanner;

  constructor(config: M138aConfig) {
    this.config = config;
    this.loadPredictor = new LoadPredictor(this.config);
    this.gracefulSheddingPlanner = new GracefulSheddingPlanner(this.config);
  }

  public getMlEnabled(): boolean {
    return this.config.ml_enabled;
  }

  public getAuditHash(): string {
    return this.config.audit_hash;
  }

  public predictLoad(): number {
    if (!this.getMlEnabled()) {
      throw new Error('ML is disabled');
    }
    const boundedOutput = Math.max(0, Math.min(this.loadPredictor.predict(), 1));
    return boundedOutput;
  }

  public planShedding(): number[] {
    if (!this.getMlEnabled()) {
      throw new Error('ML is disabled');
    }
    const sheddingPlan = this.gracefulSheddingPlanner.plan();
    const boundedOutputs = sheddingPlan.map((output) => Math.max(0, Math.min(output, 1)));
    return boundedOutputs;
  }
}

export class M138aConfig {
  public ml_enabled: boolean;
  public audit_hash: string;

  constructor(config: { [key: string]: any }) {
    this.ml_enabled = config.ml_enabled || false;
    this.audit_hash = config.audit_hash || '';
  }
}
