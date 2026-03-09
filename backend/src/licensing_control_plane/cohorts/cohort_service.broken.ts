/**
 * Cohort Service for managing cohorts in Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { Cohort, CohortDocument } from './cohort.schema';
import { AssignmentEngineService } from '../assignment_engine/assignment_engine.service';
import { ScheduleWindow, ScheduleWindowDocument } from '../schedule_window/schedule_window.schema';
import { LadderModePolicy, LadderModePolicyDocument } from '../ladder_mode_policy/ladder_mode_policy.schema';

/** Cohort Service Interface */
@Injectable()
export class CohortService {
  constructor(
    @InjectModel(Cohort.name) private cohortModel: Model<CohortDocument>,
    @InjectModel(ScheduleWindow.name) private scheduleWindowModel: Model<ScheduleWindowDocument>,
    @InjectModel(LadderModePolicy.name) private ladderModePolicyModel: Model<LadderModePolicyDocument>,
    private assignmentEngineService: AssignmentEngineService,
  ) {}

  /**
   * Creates a new cohort with the given details and assigns it to a pack based on the assignment engine.
   * @param {string} name - The name of the cohort.
   * @param {number} benchmarkScore - The benchmark score for the cohort.
   * @returns {Promise<Cohort>} A promise that resolves with the created cohort.
   */
  async createCohort(name: string, benchmarkScore: number): Promise<Cohort> {
    const cohort = new this.cohortModel({ name, benchmarkScore });
    await cohort.save();
    await this.assignmentEngineService.assignPackToCohort(cohort._id);
    return cohort;
  }

  /**
   * Assigns a schedule window to the given cohort.
   * @param {string} cohortId - The ID of the cohort.
   * @param {ScheduleWindow} scheduleWindow - The schedule window to be assigned.
   * @returns {Promise<Cohort>} A promise that resolves with the updated cohort.
   */
  async assignScheduleWindowToCohort(cohortId: string, scheduleWindow: ScheduleWindow): Promise<Cohort> {
    const cohort = await this.cohortModel.findByIdAndUpdate(cohortId, { scheduleWindow }, { new: true });
    return cohort;
  }

  /**
   * Sets the ladder mode policy for the given cohort.
   * @param {string} cohortId - The ID of the cohort.
   * @param {LadderModePolicy} ladderModePolicy - The ladder mode policy to be set.
   * @returns {Promise<Cohort>} A promise that resolves with the updated cohort.
   */
  async setLadderModePolicyForCohort(cohortId: string, ladderModePolicy: LadderModePolicy): Promise<Cohort> {
    const cohort = await this.cohortModel.findByIdAndUpdate(cohortId, { ladderModePolicy }, { new: true });
    return cohort;
  }
}

/** Cohort Schema */
export interface Cohort extends Document {
  name: string;
  benchmarkScore: number;
  scheduleWindow?: ScheduleWindow;
  ladderModePolicy?: LadderModePolicy;
}
