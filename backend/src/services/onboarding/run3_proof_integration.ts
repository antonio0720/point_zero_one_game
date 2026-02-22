/**
 * Onboarding Service for Run3 Proof Integration
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Proof, ProofDocument } from './proof.schema';
import { TurningPointService } from '../turning-point/turning-point.service';

/**
 * Onboarding Service for Run3 Proof Integration
 */
@Injectable()
export class Run3ProofIntegrationService {
  constructor(
    @InjectModel(Proof.name) private proofModel: Model<ProofDocument>,
    private turningPointService: TurningPointService,
  ) {}

  /**
   * Finalize Run3 and enqueue verification
   * @param runId - The ID of the Run3 to finalize
   */
  async finalizeRun(runId: string): Promise<void> {
    const proof = await this.proofModel.findOneAndUpdate(
      { runId },
      { status: 'pending' },
      { new: true, upsert: true },
    );

    // Enqueue verification for the proof
    // ... (Assuming you have a queue system in place)
  }

  /**
   * Expose proof status
   * @param runId - The ID of the Run3 to get the proof status for
   * @returns The proof status or null if not found
   */
  async getProofStatus(runId: string): Promise<string | null> {
    const proof = await this.proofModel.findOne({ runId });
    return proof ? proof.status : null;
  }

  /**
   * Wire replay anchor to turning point
   * @param runId - The ID of the Run3 to wire the replay anchor for
   */
  async wireReplayAnchor(runId: string): Promise<void> {
    const proof = await this.proofModel.findOneAndUpdate(
      { runId },
      { replayAnchor: this.turningPointService.getTurningPoint() },
      { new: true },
    );

    // Update the turning point with the new replay anchor
    // ... (Assuming you have a method to update the turning point)
  }
}
