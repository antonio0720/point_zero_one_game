// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M145Config } from './M145Config';
import { mlEnabled } from '../ml/mlEnabled';
import { auditHash } from '../utils/auditHash';

export class M145 {
  private config: M145Config;
  private mlModel?: any;

  constructor(config: M145Config) {
    this.config = config;
    if (this.config.mlModelPath && mlEnabled()) {
      try {
        const model = require(this.config.mlModelPath);
        this.mlModel = model.default;
      } catch (error) {
        console.error('Error loading ML model:', error);
      }
    }
  }

  public generateTournamentBrackets(): { [key: string]: any[] } {
    if (!this.config.tournamentSize || !this.config.participants) {
      return {};
    }

    const brackets = this.generateVerifiedSeeds();
    const publishedScoring = this.publishScoring(brackets);

    return {
      verified_seeds: brackets,
      published_scoring: publishedScoring,
    };
  }

  private generateVerifiedSeeds(): { [key: string]: any[] } {
    if (!this.config.participants || !this.config.tournamentSize) {
      return {};
    }

    const participants = this.config.participants.slice();
    const brackets = [];

    for (let i = 0; i < this.config.tournamentSize; i++) {
      const bracket = [];
      for (let j = 0; j < Math.floor(participants.length / 2); j++) {
        bracket.push(participants.shift());
      }
      brackets.push(bracket);
    }

    return brackets;
  }

  private publishScoring(verifiedSeeds: { [key: string]: any[] }): { [key: string]: number } {
    if (!this.mlModel) {
      return {};
    }

    const scoring = {};

    for (const bracket in verifiedSeeds) {
      if (Object.prototype.hasOwnProperty.call(verifiedSeeds, bracket)) {
        const participants = verifiedSeeds[bracket];
        const scores = this.mlModel.predict(participants);

        for (let i = 0; i < participants.length; i++) {
          scoring[participants[i].id] = scores[i];
        }
      }
    }

    return scoring;
  }

  public getAuditHash(): string {
    const brackets = this.generateTournamentBrackets();
    const auditData = JSON.stringify(brackets, Object.keys);
    return auditHash(auditData);
  }
}

export { M145Config };
