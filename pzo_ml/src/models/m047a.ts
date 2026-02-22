// tslint:disable:no-any strict-type-checking

import { ClientAction } from './client_action';
import { MlModel } from './ml_model';

export class M47a extends MlModel {
  private readonly _auditHash: string;
  private readonly _boundedNudges: number;

  constructor(
    clientAction: ClientAction,
    boundedNudges: number,
    auditHash: string
  ) {
    super(clientAction);
    this._auditHash = auditHash;
    this._boundedNudges = boundedNudges;
  }

  public getAuditHash(): string {
    return this._auditHash;
  }

  public getBoundedNudges(): number {
    return Math.min(this._boundedNudges, 1);
  }

  public isMlEnabled(): boolean {
    return true; // default to enabled
  }
}
