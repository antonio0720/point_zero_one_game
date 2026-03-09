/**
 * Verified Controls Service — PostgreSQL via TypeORM.
 * Replaces mongoose verified_controls/index.ts
 *
 * Manages verified ladder placement tracking and verifier linkage.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerifiedControl, PendingPlacement } from '../../entities/verified_control.entity';

@Injectable()
export class VerifiedControlsService {
  constructor(
    @InjectRepository(VerifiedControl)
    private readonly controlRepo: Repository<VerifiedControl>,
    @InjectRepository(PendingPlacement)
    private readonly placementRepo: Repository<PendingPlacement>,
  ) {}

  // ── Verified Controls ───────────────────────────────────────────────────

  async linkVerifier(
    gameId: string,
    controlId: string,
    placementId: string,
    verifierId: string,
  ): Promise<VerifiedControl> {
    const control = this.controlRepo.create({
      gameId,
      controlId,
      placementId,
      verifierId,
      verifiedAt: new Date(),
    });
    return this.controlRepo.save(control);
  }

  async findByControlId(controlId: string): Promise<VerifiedControl | null> {
    return this.controlRepo.findOneBy({ controlId });
  }

  async findByGame(gameId: string): Promise<VerifiedControl[]> {
    return this.controlRepo.find({ where: { gameId } });
  }

  // ── Pending Placements ──────────────────────────────────────────────────

  async createPending(
    ownerId: string,
    ladderId: string,
    position: number,
  ): Promise<PendingPlacement> {
    const placement = this.placementRepo.create({
      ownerId,
      ladderId,
      position,
      isVisible: false,
      finalized: false,
    });
    return this.placementRepo.save(placement);
  }

  /**
   * Finalize a pending placement — makes it visible to the owner only.
   * Does NOT publish globally until verified.
   */
  async finalizePlacement(placementId: string, ownerId: string): Promise<PendingPlacement | null> {
    const placement = await this.placementRepo.findOneBy({ id: placementId, ownerId });
    if (!placement) return null;

    placement.isVisible = true;
    placement.finalized = true;
    return this.placementRepo.save(placement);
  }

  async findPendingByLadder(ladderId: string): Promise<PendingPlacement[]> {
    return this.placementRepo.find({
      where: { ladderId, finalized: false },
      order: { createdAt: 'ASC' },
    });
  }

  async findByOwner(ownerId: string): Promise<PendingPlacement[]> {
    return this.placementRepo.find({ where: { ownerId } });
  }
}
