// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M079SharedObjectiveBondsTeamWideIncentiveLocksMechanics } from './m079_shared_objective_bonds_team_wide_incentive_locks_mechanics';
import { M079SharedObjectiveBondsTeamWideIncentiveLocksMechanicsConfig } from './m079_shared_objective_bonds_team_wide_incentive_locks_mechanics_config';

export class M079SharedObjectiveBondsTeamWideIncentiveLocksMechanicsImpl implements M079SharedObjectiveBondsTeamWideIncentiveLocksMechanics {
  private readonly config: M079SharedObjectiveBondsTeamWideIncentiveLocksMechanicsConfig;
  private readonly mlEnabled: boolean;

  constructor(config: M079SharedObjectiveBondsTeamWideIncentiveLocksMechanicsConfig, mlEnabled: boolean) {
    this.config = config;
    this.mlEnabled = mlEnabled;
  }

  public getMechanicName(): string {
    return 'M079 Shared Objective Bonds Team-Wide Incentive Locks';
  }

  public getMechanicDescription(): string {
    return 'Team-wide incentive locks for shared objective bonds.';
  }

  public isMLModelRequired(): boolean {
    return this.mlEnabled;
  }

  public getAuditHash(): string {
    const auditHash = JSON.stringify(this.config);
    return auditHash;
  }

  public getBoundedOutput(): number {
    if (this.mlEnabled) {
      // Use a bounded output from the ML model
      return Math.min(Math.max(0, this.config.boundedOutput), 1);
    } else {
      // Default to 0.5 if ML is not enabled
      return 0.5;
    }
  }

  public getMechanicConfig(): M079SharedObjectiveBondsTeamWideIncentiveLocksMechanicsConfig {
    return this.config;
  }

  public applyMechanicEffect(playerState: any): void {
    // Apply the mechanic effect to the player state
    if (this.mlEnabled) {
      // Use the ML model to determine the effect
      const mlOutput = this.config.mlModel.applyEffect(playerState);
      // Ensure the output is bounded between 0 and 1
      const boundedOutput = Math.min(Math.max(0, mlOutput), 1);
      playerState.incentiveLocks += boundedOutput;
    } else {
      // Default to a simple effect if ML is not enabled
      playerState.incentiveLocks += this.config.defaultEffect;
    }
  }

  public getDeterministicSeed(): number {
    return this.config.deterministicSeed;
  }
}

export function createM079SharedObjectiveBondsTeamWideIncentiveLocksMechanics(config: M079SharedObjectiveBondsTeamWideIncentiveLocksMechanicsConfig, mlEnabled: boolean): M079SharedObjectiveBondsTeamWideIncentiveLocksMechanics {
  return new M079SharedObjectiveBondsTeamWideIncentiveLocksMechanicsImpl(config, mlEnabled);
}
