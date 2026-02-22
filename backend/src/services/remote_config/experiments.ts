/**
 * Experiment service for A/B tuning and guardrails to prevent retention regressions.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Experiment entity representing a single experiment in the A/B tuning framework.
 */
export class Experiment {
  id: number;
  name: string;
  variantA: string;
  variantB: string;
  primaryMetric: string;
  retentionGoal: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ExperimentRepository interface for type-safe repository operations.
 */
export interface ExperimentRepository {
  create(experiment: Experiment): Promise<Experiment>;
  findOneByName(name: string): Promise<Experiment | null>;
  updateRetentionGoal(id: number, retentionGoal: number): Promise<void>;
}

/**
 * ExperimentService class for managing experiments and their data.
 */
@Injectable()
export class ExperimentService {
  constructor(
    @InjectRepository(Experiment)
    private readonly experimentRepository: Repository<Experiment>,
  ) {}

  /**
   * Creates a new experiment with the given details.
   * @param name The name of the experiment.
   * @param variantA The variant A configuration for the experiment.
   * @param variantB The variant B configuration for the experiment.
   * @param primaryMetric The primary metric to track for this experiment.
   * @param retentionGoal The retention goal for this experiment.
   */
  public async createExperiment(
    name: string,
    variantA: string,
    variantB: string,
    primaryMetric: string,
    retentionGoal: number,
  ): Promise<Experiment> {
    const newExperiment = this.experimentRepository.create({
      name,
      variantA,
      variantB,
      primaryMetric,
      retentionGoal,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.experimentRepository.save(newExperiment);
  }

  /**
   * Finds an experiment by its name.
   * @param name The name of the experiment to find.
   */
  public async findExperimentByName(name: string): Promise<Experiment | null> {
    return this.experimentRepository.findOne({ where: { name } });
  }

  /**
   * Updates the retention goal for an existing experiment.
   * @param id The ID of the experiment to update.
   * @param retentionGoal The new retention goal for the experiment.
   */
  public async updateRetentionGoal(id: number, retentionGoal: number): Promise<void> {
    await this.experimentRepository.update(id, { retentionGoal, updatedAt: new Date() });
  }
}
