/**
 * Death Cause Analyzer Service for Balance Analytics
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/** Game entities */
import { Turn } from '../turns/entities/turn.entity';
import { Card } from '../cards/entities/card.entity';
import { RunOutcome } from './entities/run-outcome.entity';
import { FailureMode } from './enums/failure-mode.enum';

/** Game entities relations */
import { HasMany, JoinColumn, ManyToOne } from 'typeorm';

/** Death Cause Analyzer Service */
@Injectable()
export class DeathCauseAnalyzerService {
  constructor(
    @InjectRepository(RunOutcome)
    private readonly runOutcomeRepository: Repository<RunOutcome>,
    @InjectRepository(Turn)
    private readonly turnRepository: Repository<Turn>,
    @InjectRepository(Card)
    private readonly cardRepository: Repository<Card>,
  ) {}

  /**
   * Analyze run outcomes and find the most lethal card and death spike at turn 5.
   */
  async analyze(): Promise<{ mostLethalCardId: number; turn5DeathSpike: number }> {
    const runOutcomes = await this.runOutcomeRepository.find({ relations: ['turn', 'card'] });
    const groupedByFailureModeAndCardId = this.groupRunOutcomes(runOutcomes);

    let mostLethalCardId: number | undefined;
    let turn5DeathSpike: number = 0;

    for (const [failureMode, outcomes] of Object.entries(groupedByFailureModeAndCardId)) {
      const cardCount = outcomes.length;
      if (!mostLethalCardId || cardCount > (mostLethalCardId as number)) {
        mostLethalCardId = failureMode === FailureMode.RUN_OUT_OF_CARDS ? outcomes[0].card.id : undefined;
      }

      const turn5Outcomes = outcomes.filter((outcome) => outcome.turn.number === 5);
      if (turn5Outcomes.length > turn5DeathSpike) {
        turn5DeathSpike = turn5Outcomes.length;
      }
    }

    return { mostLethalCardId, turn5DeathSpike };
  }

  /**
   * Group run outcomes by failure mode and card ID.
   */
  private groupRunOutcomes(runOutcomes: RunOutcome[]): Record<FailureMode, RunOutcome[]> {
    const groupedByFailureModeAndCardId: Record<FailureMode, RunOutcome[]> = {};

    for (const runOutcome of runOutcomes) {
      const failureMode = runOutcome.failureMode;
      if (!groupedByFailureModeAndCardId[failureMode]) {
        groupedByFailureModeAndCardId[failureMode] = [];
      }

      const cardId = runOutcome.card.id;
      const existingOutcomes = groupedByFailureModeAndCardId[failureMode];
      if (!existingOutcomes.some((outcome) => outcome.id === runOutcome.id)) {
        existingOutcomes.push(runOutcome);
      }
    }

    return groupedByFailureModeAndCardId;
  }
}
