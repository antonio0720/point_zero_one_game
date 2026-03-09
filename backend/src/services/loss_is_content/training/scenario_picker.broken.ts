/**
 * Scenario picker service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Scenario, ScenarioDocument } from './scenarios.schema';

/** Scenario picker service for Point Zero One Digital's financial roguelike game. */
@Injectable()
export class ScenarioPickerService {
  constructor(
    @InjectModel(Scenario.name) private scenarioModel: Model<ScenarioDocument>,
  ) {}

  /**
   * Picks a scenario from the catalog that matches the user's stage and is short-launchable.
   * @param userId The unique identifier of the user.
   * @returns A promise that resolves with the picked scenario or null if no suitable scenario is found.
   */
  async pickScenario(userId: string): Promise<Scenario | null> {
    // Query for scenarios that match the user's stage and are short-launchable.
    const query = {
      stage: userId,
      shortLaunchable: true,
    };

    // Find one suitable scenario in the catalog.
    return this.scenarioModel.findOne(query);
  }
}
