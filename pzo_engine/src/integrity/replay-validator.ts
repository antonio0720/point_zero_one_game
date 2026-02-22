// tslint:disable:no-any strict-type-checking no-empty-interface

import { IGame } from '../game';
import { IEngineConfig } from '../../config/engine-config';
import { IMLModel } from './ml-model';

export interface IReplayValidator {
  validate(game: IGame, config: IEngineConfig): boolean;
}

const mlEnabled = false;

class ReplayValidator implements IReplayValidator {
  private readonly mlModel: IMLModel | null;

  constructor() {
    this.mlModel = mlEnabled ? new MlModel() : null;
  }

  validate(game: IGame, config: IEngineConfig): boolean {
    const auditHash = game.getAuditHash();
    if (this.mlModel !== null) {
      const prediction = this.mlModel.predict(auditHash);
      if (prediction < 0 || prediction > 1) {
        throw new Error('ML model output out of bounds');
      }
      if (!config.quarantineOnMismatch && prediction === 1) {
        return true;
      }
    }

    // Check for deterministic behavior
    const expectedAuditHash = game.getExpectedAuditHash();
    if (auditHash !== expectedAuditHash) {
      throw new Error('Determinism failed');
    }

    return true;
  }
}

class MlModel implements IMLModel {
  predict(input: string): number {
    // Simulate a prediction
    return Math.random() * 2;
  }

  getAuditHash(): string {
    // Simulate an audit hash
    return 'audit_hash';
  }
}

export { ReplayValidator };
