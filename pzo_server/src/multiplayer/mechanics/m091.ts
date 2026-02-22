// tslint:disable:no-any strict-type-checking no-empty-interface
import { M91FirstTableInviteSafeSocialOnboardingRunMechanics } from './m091.types';
import { mlEnabled, auditHash } from '../ml';

export class M91FirstTableInviteSafeSocialOnboardingRunMechanicsImpl implements M91FirstTableInviteSafeSocialOnboardingRunMechanics {
  public readonly name: string = 'M91 First Table Invite Safe Social Onboarding Run';
  public readonly description: string = 'A co-op run where players are invited to the first table in a safe social onboarding environment.';

  private mlModel: any;

  constructor() {
    if (mlEnabled) {
      this.mlModel = new MlModel();
    }
  }

  public async apply(
    gameSessionId: string,
    playerIds: string[],
    currentGameState: any,
    previousGameState: any,
    action: any
  ): Promise<any> {
    const boundedOutput = await this.boundedApply(gameSessionId, playerIds, currentGameState, previousGameState, action);
    return { ...boundedOutput, auditHash };
  }

  private async boundedApply(
    gameSessionId: string,
    playerIds: string[],
    currentGameState: any,
    previousGameState: any,
    action: any
  ): Promise<any> {
    if (mlEnabled) {
      const mlOutput = await this.mlModel.apply(gameSessionId, playerIds, currentGameState, previousGameState, action);
      return { ...mlOutput, boundedOutput: Math.min(Math.max(mlOutput.boundedOutput, 0), 1) };
    } else {
      throw new Error('ML model is not enabled');
    }
  }

  public async reset(gameSessionId: string): Promise<void> {
    if (mlEnabled) {
      await this.mlModel.reset(gameSessionId);
    }
  }
}

class MlModel {
  private mlModel: any;

  constructor() {
    // Initialize ML model here
  }

  public async apply(
    gameSessionId: string,
    playerIds: string[],
    currentGameState: any,
    previousGameState: any,
    action: any
  ): Promise<any> {
    // Apply ML model here
    return { boundedOutput: Math.random() };
  }

  public async reset(gameSessionId: string): Promise<void> {
    // Reset ML model here
  }
}

export const m091FirstTableInviteSafeSocialOnboardingRunMechanics = new M91FirstTableInviteSafeSocialOnboardingRunMechanicsImpl();
