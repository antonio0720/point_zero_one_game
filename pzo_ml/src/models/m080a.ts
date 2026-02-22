// tslint:disable:no-any strict-type-checking

import { MlModel } from '../ml_model';
import { BoundedNudge } from './bounded_nudge';

export class M80a extends MlModel {
  private readonly _nudge: BoundedNudge;

  constructor(nudge: BoundedNudge) {
    super();
    this._nudge = nudge;
  }

  public generateProofCompressedCard(
    contractId: string,
    blockNumber: number,
    transactionHash: string
  ): { proof: string; auditHash: string } {
    if (!this.isEnabled()) {
      throw new Error('ML model is disabled');
    }
    const output = this._nudge.generateOutput();
    return {
      proof: output,
      auditHash: this.getAuditHash(),
    };
  }

  public generateNarrativeSummary(
    contractId: string,
    blockNumber: number,
    transactionHash: string
  ): { summary: string; auditHash: string } {
    if (!this.isEnabled()) {
      throw new Error('ML model is disabled');
    }
    const output = this._nudge.generateOutput();
    return {
      summary: output,
      auditHash: this.getAuditHash(),
    };
  }

  private isEnabled(): boolean {
    return process.env.ML_ENABLED === 'true';
  }

  private getAuditHash(): string {
    // implement your own hash function or use a library like crypto-js
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(process.env));
    return hash.digest('hex');
  }
}
