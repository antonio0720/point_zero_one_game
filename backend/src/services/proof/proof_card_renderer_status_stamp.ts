/**
 * Proof Card Renderer Status Stamp Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Proof Card Entity
 */
export class ProofCard {
  id: number;
  assetId: number;
  status: 'PENDING' | 'VERIFIED' | 'QUARANTINED';
  learnMoreUrl: string;
}

/**
 * Proof Card Repository
 */
@Injectable()
export class ProofCardRepository {
  constructor(
    @InjectRepository(ProofCard)
    private proofCardRepository: Repository<ProofCard>,
  ) {}

  async createProofCard(assetId: number, status: 'PENDING' | 'VERIFIED' | 'QUARANTINED', learnMoreUrl: string): Promise<ProofCard> {
    const proofCard = this.proofCardRepository.create({ assetId, status, learnMoreUrl });
    return this.proofCardRepository.save(proofCard);
  }
}
