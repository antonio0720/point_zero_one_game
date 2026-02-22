// tslint:disable:no-any strict-type-checking

import { M140Config } from './M140Config';
import { PlayerEvidenceExportRedactedTruthPacket } from './PlayerEvidenceExportRedactedTruthPacket';

export class M140 {
  private config: M140Config;
  private mlEnabled: boolean;

  constructor(config: M140Config, mlEnabled: boolean) {
    this.config = config;
    this.mlEnabled = mlEnabled;
  }

  public execute(playerEvidence: PlayerEvidenceExportRedactedTruthPacket): { truth: number; auditHash: string } {
    if (!this.mlEnabled) {
      return {
        truth: 0,
        auditHash: '',
      };
    }

    const boundedOutput = Math.min(Math.max(this.config.boundedOutput, 0), 1);
    const auditHash = this.config.auditHashFunction(playerEvidence);

    return {
      truth: boundedOutput,
      auditHash,
    };
  }
}

export class M140Config {
  public boundedOutput: number;
  public auditHashFunction: (playerEvidence: PlayerEvidenceExportRedactedTruthPacket) => string;

  constructor(boundedOutput: number, auditHashFunction: (playerEvidence: PlayerEvidenceExportRedactedTruthPacket) => string) {
    this.boundedOutput = boundedOutput;
    this.auditHashFunction = auditHashFunction;
  }
}

export class PlayerEvidenceExportRedactedTruthPacket {
  public evidence: any;

  constructor(evidence: any) {
    this.evidence = evidence;
  }
}
