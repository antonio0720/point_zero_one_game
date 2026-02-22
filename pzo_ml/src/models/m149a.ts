// tslint:disable:no-any strict-type-checking

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M149a extends MlModel {
  private readonly _compliancePlanner: CompliancePlanner;
  private readonly _penaltyForecaster: PenaltyForecaster;

  constructor(
    compliancePlanner: CompliancePlanner,
    penaltyForecaster: PenaltyForecaster
  ) {
    super();
    this._compliancePlanner = compliancePlanner;
    this._penaltyForecaster = penaltyForecaster;
  }

  public getComplianceScore(): number {
    if (!this.mlEnabled) return 0.5;

    const score = this._compliancePlanner.getComplianceScore();
    return Math.max(0, Math.min(score, 1));
  }

  public getPenaltyAmount(): number {
    if (!this.mlEnabled) return 0.5;

    const amount = this._penaltyForecaster.getPenaltyAmount();
    return Math.max(0, Math.min(amount, 1));
  }

  public auditHash(): string {
    return `${this._compliancePlanner.auditHash()}${this._penaltyForecaster.auditHash()}`;
  }
}

class CompliancePlanner extends MlModel {
  private readonly _model: any;

  constructor(model: any) {
    super();
    this._model = model;
  }

  public getComplianceScore(): number {
    if (!this.mlEnabled) return 0.5;

    const score = this._model.getComplianceScore();
    return Math.max(0, Math.min(score, 1));
  }

  public auditHash(): string {
    return 'compliance-planner';
  }
}

class PenaltyForecaster extends MlModel {
  private readonly _model: any;

  constructor(model: any) {
    super();
    this._model = model;
  }

  public getPenaltyAmount(): number {
    if (!this.mlEnabled) return 0.5;

    const amount = this._model.getPenaltyAmount();
    return Math.max(0, Math.min(amount, 1));
  }

  public auditHash(): string {
    return 'penalty-forecaster';
  }
}

export function boundedNudge(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
