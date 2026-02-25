/**
 * Card Impact Scorer Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Card entity
 */
export class Card {
  id: number;
  name: string;
  cashDelta: number;
  survivalCorrelation: number;
  playerFrustrationProxy: number;
}

/**
 * RunState entity
 */
export class RunState {
  id: number;
  cash: number;
  survival: number;
  playerFrustration: number;
}

/**
 * CardImpactScorerService
 */
@Injectable()
export class CardImpactScorerService {
  constructor(
    @InjectRepository(Card) private cardRepository: Repository<Card>,
    @InjectRepository(RunState) private runStateRepository: Repository<RunState>,
  ) {}

  /**
   * Calculate average delta for each card based on RunState
   */
  async calculateAverageDelta(): Promise<void> {
    const cards = await this.cardRepository.find();
    const runStates = await this.runStateRepository.find();

    // Implement calculation logic here
  }

  /**
   * Rank cards by 'net danger' and 'net overpowered'
   */
  rankCards(): void {
    // Implement ranking logic here
  }
}
