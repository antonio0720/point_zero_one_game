/**
 * ModerationActionsService - Handles quarantine, delist, restore, clawback actions and their evidence chains.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationAction, EvidenceChain } from './entities';

/**
 * ModerationActionsService class.
 */
@Injectable()
export class ModerationActionsService {
  constructor(
    @InjectRepository(ModerationAction)
    private moderationActionRepository: Repository<ModerationAction>,
    @InjectRepository(EvidenceChain)
    private evidenceChainRepository: Repository<EvidenceChain>,
  ) {}

  /**
   * Create a new moderation action.
   * @param {string} action - The type of the moderation action (quarantine, delist, restore, clawback).
   * @param {number[]} gameIds - The IDs of the games affected by this moderation action.
   * @param {EvidenceChain[]} evidenceChains - The evidence chains associated with this moderation action.
   */
  async createModerationAction(action: string, gameIds: number[], evidenceChains: EvidenceChain[]): Promise<ModerationAction> {
    const moderationAction = this.moderationActionRepository.create({ action });
    moderationAction.gameIds = gameIds;
    moderationAction.evidenceChains = evidenceChains;
    return this.moderationActionRepository.save(moderationAction);
  }

  /**
   * Get a moderation action by its ID.
   * @param {number} id - The ID of the moderation action to retrieve.
   */
  async getModerationActionById(id: number): Promise<ModerationAction> {
    return this.moderationActionRepository.findOne(id, { relations: ['gameIds', 'evidenceChains'] });
  }
}

