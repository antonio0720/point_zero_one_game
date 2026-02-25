/**
 * Weekly Challenge Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WeeklyChallenge, WeeklyChallengeDocument } from './schemas/weekly-challenge.schema';
import { ChallengeScenario, ChallengeScenarioDocument } from '../scenarios/schemas/challenge-scenario.schema';
import { Participant, ParticipantDocument } from '../participants/schemas/participant.schema';

/**
 * Weekly Challenge Service Interface
 */
@Injectable()
export interface IWeeklyChallengeService {
  createChallenge(scenario: string, constraint?: string): Promise<WeeklyChallengeDocument>;
  getGlobalLeaderboard(): Promise<WeeklyChallengeDocument[]>;
  displayParticipantCount(): Promise<number>;
  calculateCompletionRate(): Promise<number>;
  announceWinnerAndShareMoment(winner: ParticipantDocument): Promise<void>;
}

/**
 * Weekly Challenge Service Implementation
 */
@Injectable()
export class WeeklyChallengeService implements IWeeklyChallengeService {
  constructor(
    @InjectModel(WeeklyChallenge.name) private readonly weeklyChallengeModel: Model<WeeklyChallengeDocument>,
    @InjectModel(ChallengeScenario.name) private readonly scenarioModel: Model<ChallengeScenarioDocument>,
    @InjectModel(Participant.name) private readonly participantModel: Model<ParticipantDocument>,
  ) {}

  async createChallenge(scenario: string, constraint?: string): Promise<WeeklyChallengeDocument> {
    const scenarioDoc = await this.scenarioModel.findOne({ name: scenario });
    if (!scenarioDoc) throw new Error('Invalid scenario');

    const challenge = new this.weeklyChallengeModel({
      scenarioId: scenarioDoc._id,
      constraint,
      createdAt: new Date(),
    });

    return challenge.save();
  }

  async getGlobalLeaderboard(): Promise<WeeklyChallengeDocument[]> {
    return this.weeklyChallengeModel.find().sort({ createdAt: -1 }).exec();
  }

  async displayParticipantCount(): Promise<number> {
    const participants = await this.participantModel.countDocuments();
    return participants;
  }

  async calculateCompletionRate(): Promise<number> {
    // Implement deterministic calculation based on game engine or replay data
  }

  async announceWinnerAndShareMoment(winner: ParticipantDocument): Promise<void> {
    // Implement winner announcement and share moment logic
  }
}

-- Weekly Challenge Schema
