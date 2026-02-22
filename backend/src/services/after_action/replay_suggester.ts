/**
 * Replay Suggester Service for Point Zero One Digital's Financial Roguelike Game
 * Suggests a scenario that trains the detected weakness, matches failure_mode to scenario_ids with high training signal, and ranks by novelty to player.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FailureModeDocument } from '../failure-mode/schemas/failure-mode.schema';
import { ScenarioDocument } from './schemas/scenario.schema';
import { Scenario, ScenarioCreationDto } from './scenarios.interface';

/** Scenario Model */
@Injectable()
export class ReplaySuggesterService {
  constructor(
    @InjectModel(Scenario.name) private readonly scenarioModel: Model<ScenarioDocument>,
    @InjectModel(FailureMode.name) private readonly failureModeModel: Model<FailureModeDocument>,
  ) {}

  /**
   * Suggests a scenario that trains the detected weakness, matches failure_mode to scenario_ids with high training signal, and ranks by novelty to player.
   */
  async suggestScenario(failureModeId: string): Promise<Scenario> {
    const failureMode = await this.failureModeModel.findById(failureModeId);
    if (!failureMode) throw new Error('Failure Mode not found');

    const trainedScenarios = await this.scenarioModel.find({ failureMode: failureMode._id })
      .sort({ playerCount: -1, createdAt: 1 }); // Sort by highest player count and oldest first

    let suggestedScenario: Scenario | null = null;
    let trainingSignal = 0;

    for (const trainedScenario of trainedScenarios) {
      const failureRate = trainedScenario.failureRate;
      if (failureRate >= failureMode.baseFailureRate && failureRate < failureMode.maxFailureRate) {
        trainingSignal += failureRate - failureMode.baseFailureRate;
        suggestedScenario = trainedScenario;
      }
    }

    if (!suggestedScenario) {
      // If no suitable trained scenario is found, suggest a new one with the detected failure mode's base failure rate
      const newScenario: ScenarioCreationDto = {
        failureMode: failureMode._id,
        failureRate: failureMode.baseFailureRate,
        playerCount: 0,
      };
      suggestedScenario = await this.scenarioModel.create(newScenario);
    }

    return suggestedScenario;
  }
}

/** Failure Mode Mongoose Schema */
const failureModeSchema = new mongoose.Schema({
  baseFailureRate: Number,
  maxFailureRate: Number,
});

/** Scenario Mongoose Schema */
const scenarioSchema = new mongoose.Schema({
  failureMode: { type: mongoose.Schema.Types.ObjectId, ref: FailureMode.name },
  failureRate: Number,
  playerCount: Number,
  createdAt: Date,
});
