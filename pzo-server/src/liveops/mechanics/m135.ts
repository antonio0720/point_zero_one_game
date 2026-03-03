// tslint:disable:no-any strict-type-checking
import { M135ReputationLabel } from './m135_reputation_label';
import { M135ReversibleProofBasedReputationLabel } from './m135_reversible_proof_based_reputation_label';
import { M135EarnedReputationLabel } from './m135_earned_reputation_label';

export class M135ReputationLabelsMechanic {
  private readonly mlEnabled: boolean;
  private readonly reputationLabels: M135ReputationLabel[];

  constructor(mlEnabled: boolean) {
    this.mlEnabled = mlEnabled;
    this.reputationLabels = [];
  }

  public async init(): Promise<void> {
    if (this.mlEnabled) {
      const earnedLabel = new M135EarnedReputationLabel();
      const reversibleProofBasedLabel = new M135ReversibleProofBasedReputationLabel();

      this.reputationLabels.push(earnedLabel);
      this.reputationLabels.push(reversibleProofBasedLabel);

      await Promise.all(this.reputationLabels.map((label) => label.init()));
    }
  }

  public async getReputationLabels(): Promise<M135ReputationLabel[]> {
    return this.reputationLabels;
  }

  public async getAuditHash(): Promise<string> {
    const reputationLabels = await this.getReputationLabels();
    const auditHash = reputationLabels.reduce((hash, label) => hash + label.getAuditHash(), '');

    return auditHash;
  }
}

export class M135EarnedReputationLabel implements M135ReputationLabel {
  private readonly mlEnabled: boolean;

  constructor() {
    this.mlEnabled = false;
  }

  public async init(): Promise<void> {
    // No-op
  }

  public getAuditHash(): string {
    return 'earned';
  }

  public isEarned(): boolean {
    return true;
  }

  public isReversible(): boolean {
    return false;
  }

  public isProofBased(): boolean {
    return false;
  }
}

export class M135ReversibleProofBasedReputationLabel implements M135ReputationLabel {
  private readonly mlEnabled: boolean;

  constructor() {
    this.mlEnabled = false;
  }

  public async init(): Promise<void> {
    // No-op
  }

  public getAuditHash(): string {
    return 'reversible-proof-based';
  }

  public isEarned(): boolean {
    return false;
  }

  public isReversible(): boolean {
    return true;
  }

  public isProofBased(): boolean {
    return true;
  }
}

export interface M135ReputationLabel {
  init(): Promise<void>;
  getAuditHash(): string;
  isEarned(): boolean;
  isReversible(): boolean;
  isProofBased(): boolean;
}
