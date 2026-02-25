/**
 * LadderServiceImpl
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubmitRunToCasualLadderDto, SubmitRunToVerifiedLadderDto } from './dto';
import { Ladder, Run } from './entities';

/**
 * LadderServiceImpl
 */
@Injectable()
export class LadderServiceImpl {
  constructor(
    @InjectRepository(Ladder)
    private readonly ladderRepository: Repository<Ladder>,
    @InjectRepository(Run)
    private readonly runRepository: Repository<Run>,
  ) {}

  /**
   * Submit a run to the casual ladder (immediate publish)
   */
  async submitRunToCasualLadder(dto: SubmitRunToCasualLadderDto): Promise<void> {
    const { runId, ladderId } = dto;

    // Check if run and ladder exist
    const run = await this.runRepository.findOne(runId);
    if (!run) throw new Error('Run not found');

    const ladder = await this.ladderRepository.findOne(ladderId, { relations: ['runs'] });
    if (!ladder) throw new Error('Ladder not found');

    // Check if run is already in the ladder
    if (ladder.runs.includes(run)) throw new Error('Run already in ladder');

    // Add run to ladder and save changes
    ladder.runs.push(run);
    await this.ladderRepository.save(ladder);
  }

  /**
   * Submit a run to the verified ladder (pending until VERIFIED)
   */
  async submitRunToVerifiedLadder(dto: SubmitRunToVerifiedLadderDto): Promise<void> {
    const { runId, ladderId } = dto;

    // Check if run and ladder exist
    const run = await this.runRepository.findOne(runId);
    if (!run) throw new Error('Run not found');

    const ladder = await this.ladderRepository.findOne(ladderId, { relations: ['runs'] });
    if (!ladder) throw new Error('Ladder not found');

    // Check if run is already in the ladder
    if (ladder.runs.includes(run)) throw new Error('Run already in ladder');

    // Add run to verified ladder and save changes
    ladder.verifiedRuns.push(run);
    await this.ladderRepository.save(ladder);
  }
}

