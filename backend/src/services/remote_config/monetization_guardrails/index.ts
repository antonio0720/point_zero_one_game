/**
 * Monetization Guardrails Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * MonetizationGuardrail entity
 */
export class MonetizationGuardrail {
  id: number;
  ruleId: number;
  userId: number;
  isEnabled: boolean;
}

/**
 * Monetization Guardrails Service
 */
@Injectable()
export class MonetizationGuardrailsService {
  constructor(
    @InjectRepository(MonetizationGuardrail)
    private readonly monetizationGuardrailRepository: Repository<MonetizationGuardrail>,
  ) {}

  /**
   * Find a specific user's guardrails by ruleId
   * @param userId - User ID
   * @param ruleId - Rule ID
   */
  async findByUserAndRule(userId: number, ruleId: number): Promise<MonetizationGuardrail | null> {
    return this.monetizationGuardrailRepository.findOne({ where: { userId, ruleId } });
  }

  /**
   * Enable or disable a specific user's guardrails by ruleId
   * @param userId - User ID
   * @param ruleId - Rule ID
   * @param isEnabled - Whether to enable or disable the guardrail
   */
  async updateUserGuardrail(userId: number, ruleId: number, isEnabled: boolean): Promise<void> {
    const monetizationGuardrail = await this.findByUserAndRule(userId, ruleId);

    if (!monetizationGuardrail) {
      monetizationGuardrail = new MonetizationGuardrail();
      monetizationGuardrail.userId = userId;
      monetizationGuardrail.ruleId = ruleId;
    }

    monetizationGuardrail.isEnabled = isEnabled;
    await this.monetizationGuardrailRepository.save(monetizationGuardrail);
  }
}
