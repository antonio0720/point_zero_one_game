/**
 * SafetyRailsService
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * SafetyRail entities
 */
export enum SafetyRail {
  MONETIZATION_SURFACES = 'monetizationSurfaces',
  ADVANCED_SYSTEMS = 'advancedSystems',
  LONG_TUTORIALS = 'longTutorials',
  OVERLAY_VERBOSITY = 'overlayVerbosity'
}

/**
 * SafetyRailRepository
 */
@Injectable()
export class SafetyRailRepository {
  constructor(
    @InjectRepository(SafetyRail)
    private readonly safetyRailRepository: Repository<SafetyRail>,
  ) {}

  async setConstraint(constraint: SafetyRail, enabled: boolean): Promise<void> {
    await this.safetyRailRepository.save({ id: constraint, value: enabled });
  }

  async getConstraint(constraint: SafetyRail): Promise<boolean> {
    const safetyRail = await this.safetyRailRepository.findOne({ where: { id: constraint } });
    return safetyRail?.value || false;
  }
}

/**
 * OnboardingService
 */
@Injectable()
export class OnboardingService {
  constructor(private readonly safetyRails: SafetyRailRepository) {}

  async isMonetizationSurfacesEnabled(): Promise<boolean> {
    return !this.safetyRails.getConstraint(SafetyRail.MONETIZATION_SURFACES);
  }

  async isAdvancedSystemsEnabled(): Promise<boolean> {
    return !this.safetyRails.getConstraint(SafetyRail.ADVANCED_SYSTEMS);
  }

  async isLongTutorialsEnabled(): Promise<boolean> {
    return !this.safetyRails.getConstraint(SafetyRail.LONG_TUTORIALS);
  }

  async isOverlayVerbosityEnabled(): Promise<boolean> {
    const overlayVerbosity = this.safetyRails.getConstraint(SafetyRail.OVERLAY_VERBOSITY);
    return overlayVerbosity && overlayVerbosity <= 2;
  }
}
