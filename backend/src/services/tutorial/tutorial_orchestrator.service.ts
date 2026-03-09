/**
 * Tutorial Orchestrator Service — PostgreSQL via TypeORM.
 * Replaces mongoose tutorial_orchestrator.ts
 *
 * Weighted A/B variant selection, curated seed, guaranteed survival turns.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TutorialVariant } from '../../entities/tutorial_variant.entity';

@Injectable()
export class TutorialOrchestratorService {
  constructor(
    @InjectRepository(TutorialVariant)
    private readonly repo: Repository<TutorialVariant>,
  ) {}

  /**
   * Select a tutorial variant using weighted random from active variants.
   */
  async selectVariant(): Promise<TutorialVariant> {
    const variants = await this.repo.find({ where: { isActive: true } });

    if (variants.length === 0) {
      throw new Error('No active tutorial variants configured');
    }

    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const variant of variants) {
      roll -= variant.weight;
      if (roll <= 0) return variant;
    }

    return variants[variants.length - 1];
  }

  /**
   * Get a variant by name (for deterministic testing).
   */
  async getVariantByName(name: string): Promise<TutorialVariant | null> {
    return this.repo.findOneBy({ variantName: name, isActive: true });
  }
}
