/**
 * Privacy Service - Run Visibility Updates
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameEvent, User } from '../entities';
import { AuditLogService } from './audit-log.service';
import { RunExplorerPublicService } from './run-explorer-public.service';

/**
 * Privacy Service for managing run visibility updates, authorization, audit log, and propagation to run_explorer_public.
 */
@Injectable()
export class PrivacyService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(GameEvent.name) private gameEventModel: Model<GameEvent>,
    private auditLogService: AuditLogService,
    private runExplorerPublicService: RunExplorerPublicService,
  ) {}

  /**
   * Update run visibility for a user.
   * @param userId - The ID of the user to update.
   * @param runId - The ID of the run to update visibility for.
   * @param isVisible - Whether the run is visible to the user or not.
   */
  async updateRunVisibility(userId: string, runId: string, isVisible: boolean) {
    // Check if the user exists
    const user = await this.userModel.findOne({ _id: userId });
    if (!user) {
      throw new Error('User not found');
    }

    // Check if the run exists
    const run = await this.gameEventModel.findOne({ _id: runId, isPublic: true });
    if (!run) {
      throw new Error('Run not found or not public');
    }

    // Update user's run visibility
    user.runVisibilities[runId] = isVisible;
    await user.save();

    // Log the action
    this.auditLogService.logAction(`Updated run visibility for user ${userId} on run ${runId}`, userId);

    // Propagate to run_explorer_public
    await this.runExplorerPublicService.updateRunVisibility(runId, isVisible);
  }
}
