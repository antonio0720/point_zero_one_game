/**
 * UGC Pipeline Service
 */

import { Context, ServiceAddons } from 'feathers-sequelize';
import { SequelizeClientService } from '@feathersjs/sequenceql';
import { Application } from '../../declarations';
import { GameEvent, UgcSubmission, UgcSubmissionStatus } from './models';

// Models
export const ugcSubmissionsModel = (sequelizeClient: SequelizeClientService) => sequelizeClient.get('ugcSubmissions');
export const gameEventsModel = (sequelizeClient: SequelizeClientService) => sequelizeClient.get('gameEvents');

// Service Addons
const addons: ServiceAddons<any> = {
  async before(context: Context) {
    // Validate UGC submission exists and is in 'pending' status
    const ugcSubmission = await ugcSubmissionsModel().findOne({ where: { id: context.params.ugcId }, include: [{ model: GameEvent, as: 'latestEvent', required: true }] });
    if (!ugcSubmission || ugcSubmission.status !== UgcSubmissionStatus.PENDING) {
      throw new Error('Invalid or non-existent UGC submission');
    }
  },
};

// Service
export default class UgcPipeline extends SequelizeClientService {
  constructor(options: any = {}) {
    super({ ...options, addons });
  }

  /**
   * Process UGC submission pipeline
   */
  async process(context: Context) {
    // Update UGC submission status to 'in-progress'
    await ugcSubmissionsModel().update({ id: context.params.ugcId }, { status: UgcSubmissionStatus.IN_PROGRESS });

    // Create a new game event for the start of the pipeline process
    const gameEvent = await gameEventsModel().create({
      type: GameEvent.Types.UGC_PIPELINE_START,
      data: { ugcId: context.params.ugcId },
    });

    // ... (pipeline processing logic goes here)

    // Create a new game event for the end of the pipeline process
    await gameEventsModel().create({
      type: GameEvent.Types.UGC_PIPELINE_END,
      data: { ugcId: context.params.ugcId },
    });
  }
}
