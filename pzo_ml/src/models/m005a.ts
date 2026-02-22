// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M05aMacroRegimeClassifierCashDecay } from './m005a_macro_regime_classifier_cash_decay';
import { BoundedNudge } from '../bounded_nudge';
import { AuditHash } from '../../audit_hash';

export class M05a extends M05aMacroRegimeClassifierCashDecay {
  private readonly _mlEnabled: boolean;

  constructor(
    mlEnabled: boolean,
    boundedNudges: BoundedNudge[],
    auditHash: AuditHash
  ) {
    super(boundedNudges, auditHash);
    this._mlEnabled = mlEnabled;
  }

  public getMlEnabled(): boolean {
    return this._mlEnabled;
  }

  public async classifyMacroRegime(
    inputFeatures: number[]
  ): Promise<number> {
    if (!this._mlEnabled) {
      throw new Error('ML is disabled');
    }
    const output = await super.classifyMacroRegime(inputFeatures);
    if (output < 0 || output > 1) {
      throw new Error('Output must be between 0 and 1');
    }
    return output;
  }

  public async tuneCashDecay(
    inputFeatures: number[]
  ): Promise<number> {
    if (!this._mlEnabled) {
      throw new Error('ML is disabled');
    }
    const output = await super.tuneCashDecay(inputFeatures);
    if (output < 0 || output > 1) {
      throw new Error('Output must be between 0 and 1');
    }
    return output;
  }

  public getAuditHash(): AuditHash {
    return this._auditHash;
  }
}
