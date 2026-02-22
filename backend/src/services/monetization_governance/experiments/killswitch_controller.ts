/**
 * Killswitch Controller for Experiments Management
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Experiment Threshold Breach Entity
 */
export class ExperimentThresholdBreach {
  id: number;
  experimentId: number;
  thresholdType: string;
  breachedAt: Date;
}

/**
 * Experiment Entity with associated Threshold Breaches
 */
@Entity('experiments')
export class Experiment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @OneToMany(() => ExperimentThresholdBreach, (breach) => breach.experiment)
  thresholdBreaches: ExperimentThresholdBreach[];
}

/**
 * Threshold Type Enum
 */
export enum ThresholdType {
  RAGE_QUIT = 'rage_quit',
  UNINSTALL = 'uninstall',
  PAY_TO_WIN = 'pay_to_win',
  LADDER_PARTICIPATION = 'ladder_participation'
}

/**
 * Killswitch Controller
 */
@Injectable()
export class KillswitchController {
  constructor(
    @InjectRepository(Experiment)
    private readonly experimentRepository: Repository<Experiment>,
  ) {}

  /**
   * Auto-disable an experiment when a threshold is breached
   * @param experimentId - The ID of the experiment to check
   * @param thresholdType - The type of threshold that was breached
   */
  async autoDisableExperiment(experimentId: number, thresholdType: ThresholdType): Promise<void> {
    const experiment = await this.experimentRepository.findOne({ where: { id: experimentId } });

    if (!experiment) {
      throw new Error(`Experiment with ID ${experimentId} not found`);
    }

    // Check if the breached threshold already exists for the experiment
    const breach = await this.experimentRepository
      .createQueryBuilder('experiment')
      .leftJoinAndSelect('experiment.thresholdBreaches', 'breach')
      .where('breach.experimentId = :experimentId', { experimentId })
      .andWhere('breach.thresholdType = :thresholdType', { thresholdType })
      .setOptions({ nbRows: 1 })
      .getOne();

    if (!breach) {
      // If not, create a new breach record for the experiment
      await this.experimentRepository.save(
        this.experimentRepository.createQueryBuilder('experiment')
          .update()
          .set({ thresholdBreaches: [...experiment.thresholdBreaches, new ExperimentThresholdBreach({ experimentId, thresholdType, breachedAt: new Date() })] })
          .where('id = :experimentId', { experimentId })
          .execute(),
      );
    }
  }
}
