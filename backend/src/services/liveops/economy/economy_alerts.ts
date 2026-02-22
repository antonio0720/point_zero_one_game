/**
 * Economy Alerts Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Alert entity for reward inflation and dead store signals.
 */
export class Alert {
  id: number;
  type: string;
  description: string;
  recommendedAction: string;
}

/**
 * EconomyAlertsService provides alerts for reward inflation and dead store signals.
 */
@Injectable()
export class EconomyAlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
  ) {}

  /**
   * Create a new alert in the database.
   *
   * @param type The type of the alert (e.g., 'reward_inflation', 'dead_store').
   * @param description A brief description of the alert.
   * @param recommendedAction Recommended actions to address the alert.
   */
  async createAlert(type: string, description: string, recommendedAction: string): Promise<void> {
    const newAlert = this.alertRepository.create({ type, description, recommendedAction });
    await this.alertRepository.save(newAlert);
  }
}
