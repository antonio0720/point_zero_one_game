/**
 * GuideStore service for managing facilitator guides per scenario version.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guide } from './guide.entity';
import { ScenarioVersion } from '../scenario-version/scenario-version.entity';

/** GuideStore service */
@Injectable()
export class GuideStore {
  /** GuideRepository dependency injection */
  constructor(
    @InjectRepository(Guide)
    private readonly guideRepository: Repository<Guide>,
    @InjectRepository(ScenarioVersion)
    private readonly scenarioVersionRepository: Repository<ScenarioVersion>,
  ) {}

  /**
   * Retrieve a facilitator guide by scenario version ID.
   * @param scenarioVersionId - The ID of the scenario version to retrieve the guide for.
   */
  async getGuideByScenarioVersionId(scenarioVersionId: number): Promise<Guide | null> {
    return this.guideRepository.findOne({ where: { scenarioVersion: { id: scenarioVersionId } } });
  }

  /**
   * Store a new facilitator guide for the given scenario version.
   * @param scenarioVersionId - The ID of the scenario version to associate the guide with.
   * @param guide - The guide data to store.
   */
  async storeGuide(scenarioVersionId: number, guide: Guide): Promise<void> {
    const scenarioVersion = await this.scenarioVersionRepository.findOne({ where: { id: scenarioVersionId } });

    if (!scenarioVersion) {
      throw new Error('Scenario version not found');
    }

    guide.scenarioVersion = scenarioVersion;
    await this.guideRepository.save(guide);
  }
}

/** Guide entity */
export class Guide {
  /** The ID of the guide */
  id: number;

  /** The ID of the associated scenario version */
  scenarioVersionId: number;

  /** The redacted guide data */
  redaction: string;
}
