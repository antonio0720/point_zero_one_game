import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';

@Entity('experiment_threshold_breaches')
export class ExperimentThresholdBreach {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'experiment_id' }) experimentId: number;
  @Column({ name: 'threshold_type' }) thresholdType: string;
  @Column({ type: 'timestamptz', name: 'breached_at', default: () => 'NOW()' }) breachedAt: Date;
  @ManyToOne(() => Experiment, (exp) => exp.thresholdBreaches)
  @JoinColumn({ name: 'experiment_id' }) experiment: Experiment;
}

@Entity('experiments')
export class Experiment {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) name: string;
  @OneToMany(() => ExperimentThresholdBreach, (breach) => breach.experiment)
  thresholdBreaches: ExperimentThresholdBreach[];
}

export enum ThresholdType {
  RAGE_QUIT = 'rage_quit',
  UNINSTALL = 'uninstall',
  PAY_TO_WIN = 'pay_to_win',
  LADDER_PARTICIPATION = 'ladder_participation',
}

@Injectable()
export class KillswitchController {
  constructor(
    @InjectRepository(Experiment)
    private readonly experimentRepo: Repository<Experiment>,
    @InjectRepository(ExperimentThresholdBreach)
    private readonly breachRepo: Repository<ExperimentThresholdBreach>,
  ) {}

  async autoDisableExperiment(experimentId: number, thresholdType: ThresholdType): Promise<void> {
    const experiment = await this.experimentRepo.findOne({
      where: { id: experimentId },
      relations: ['thresholdBreaches'],
    });
    if (!experiment) throw new Error(`Experiment ${experimentId} not found`);

    const existingBreach = experiment.thresholdBreaches.find(b => b.thresholdType === thresholdType);
    if (!existingBreach) {
      await this.breachRepo.save(this.breachRepo.create({
        experimentId, thresholdType, breachedAt: new Date(),
      }));
    }
  }
}
