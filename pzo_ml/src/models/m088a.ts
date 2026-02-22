// tslint:disable:no-any strict-type-checking

import { BoundedNudge } from '../bounded_nudge';
import { AuditHash } from '../audit_hash';

export class M88a {
  private readonly _contributionModel: any;
  private readonly _eligibilityProofModel: any;

  constructor(
    contributionModel: any,
    eligibilityProofModel: any
  ) {
    this._contributionModel = contributionModel;
    this._eligibilityProofModel = eligibilityProofModel;
  }

  public async teamTitleAttribution(
    input: { [key: string]: number },
    auditHash: AuditHash,
    mlEnabled: boolean
  ): Promise<{ [key: string]: number }> {
    if (!mlEnabled) {
      return {};
    }

    const contributionOutput = await this._contributionModel.predict(input);
    const eligibilityProofOutput = await this._eligibilityProofModel.predict(input);

    const attributionOutput = new BoundedNudge(contributionOutput, 0, 1).nudge();
    attributionOutput.auditHash = auditHash;

    return attributionOutput;
  }
}
