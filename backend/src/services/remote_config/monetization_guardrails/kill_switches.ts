/**
 * Monetization Guardrails - Kill Switches Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * KillSwitch Entity
 */
export enum KillSwitch {
  BAD_OFFER_1 = 'BAD_OFFER_1',
  BAD_EXPERIMENT_2 = 'BAD_EXPERIMENT_2',
  // Add more kill switches as needed
}

/**
 * KillSwitch Repository
 */
@Injectable()
export class KillSwitchesService {
  constructor(
    @InjectRepository(KillSwitch)
    private readonly killSwitchRepository: Repository<KillSwitch>,
  ) {}

  /**
   * Get all active kill switches
   */
  public async getActiveKillSwitches(): Promise<KillSwitch[]> {
    return this.killSwitchRepository.find({ where: { isActive: true } });
  }

  /**
   * Set a kill switch to active state
   * @param killSwitch - The kill switch to activate
   */
  public async setKillSwitchActive(killSwitch: KillSwitch): Promise<void> {
    await this.killSwitchRepository.update(
      { id: killSwitch },
      { isActive: true },
    );
  }

  /**
   * Set a kill switch to inactive state
   * @param killSwitch - The kill switch to deactivate
   */
  public async setKillSwitchInactive(killSwitch: KillSwitch): Promise<void> {
    await this.killSwitchRepository.update(
      { id: killSwitch },
      { isActive: false },
    );
  }
}
