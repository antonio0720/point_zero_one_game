// tslint:disable:no-any strict-type-checking no-empty-interface

import { M146aAuditEvent } from './M146aAuditEvent';
import { BoundedNudge } from '../models/BoundedNudge';

export class M146a {
  public static readonly ML_ENABLED_KILL_SWITCH = false;

  private _auditHash: string;
  private _boundedNudges: BoundedNudge[];
  private _mlEnabled: boolean;

  constructor(
    auditHash: string,
    boundedNudges: BoundedNudge[],
    mlEnabled: boolean
  ) {
    this._auditHash = auditHash;
    this._boundedNudges = boundedNudges;
    this._mlEnabled = mlEnabled;
  }

  public getAuditHash(): string {
    return this._auditHash;
  }

  public getBoundedNudges(): BoundedNudge[] {
    return this._boundedNudges;
  }

  public isMlEnabled(): boolean {
    return this._mlEnabled;
  }
}

export class M146aAuditEvent extends M146a {
  private _docBurdenEstimator: number;

  constructor(
    auditHash: string,
    boundedNudges: BoundedNudge[],
    mlEnabled: boolean,
    docBurdenEstimator: number
  ) {
    super(auditHash, boundedNudges, mlEnabled);
    this._docBurdenEstimator = docBurdenEstimator;
  }

  public getDocBurdenEstimator(): number {
    return this._docBurdenEstimator;
  }
}
