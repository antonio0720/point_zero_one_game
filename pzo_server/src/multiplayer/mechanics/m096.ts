// tslint:disable:no-any strict-type-checking no-object-literal-types

import { ServerTimeAuthority } from './server_time_authority';
import { MlModel } from '../ml_model';

export class M096 {
  private serverTimeAuthority: ServerTimeAuthority;
  private mlModel: MlModel;

  constructor(serverTimeAuthority: ServerTimeAuthority, mlModel: MlModel) {
    this.serverTimeAuthority = serverTimeAuthority;
    this.mlModel = mlModel;
  }

  public getServerTime(): number {
    return this.serverTimeAuthority.getServerTime();
  }

  public isClientTimeValid(clientTime: number): boolean {
    const serverTime = this.getServerTime();
    if (clientTime < serverTime) {
      // Client time is in the past, reject it
      return false;
    }
    if (clientTime > serverTime + 1000 * 60 * 10) { // 10 minutes
      // Client time is too far in the future, reject it
      return false;
    }
    return true;
  }

  public getMlModel(): MlModel {
    return this.mlModel;
  }

  public getAuditHash(): string {
    const mlModel = this.getMlModel();
    if (mlModel.enabled) {
      // If ML model is enabled, generate an audit hash
      return mlModel.generateAuditHash();
    } else {
      // If ML model is not enabled, return a default audit hash
      return 'default_audit_hash';
    }
  }

  public getBoundedOutput(input: number): number {
    if (input < 0) {
      return 0;
    } else if (input > 1) {
      return 1;
    } else {
      return input;
    }
  }
}
