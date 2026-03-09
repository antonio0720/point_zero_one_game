/**
 * Revenue share ledger implementation
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClawbackService } from './clawback.service';
import { GameEvent } from '../game-events/entities/game-event.entity';
import { User } from '../users/entities/user.entity';
import { RevshareLedgerEntry } from './entities/revshare-ledger-entry.entity';

/**
 * Revenue share ledger service
 */
@Injectable()
export class RevshareLedgerService {
  constructor(
    @InjectRepository(RevshareLedgerEntry)
    private readonly revshareLedgerRepository: Repository<RevshareLedgerEntry>,
    private readonly clawbackService: ClawbackService,
  ) {}

  /**
   * Compute payouts from verified engagement and create auditable entries.
   * Exclude sandbox or separate pool, clawback if fraud confirmed.
   *
   * @param gameEvents Verified game events to process.
   */
  async computePayouts(gameEvents: GameEvent[]): Promise<void> {
    // Filter out sandbox and separate pool events
    const eligibleGameEvents = gameEvents.filter((event) => !event.isSandbox && !event.isSeparatePool);

    // Compute payouts for each user
    for (const user of await User.find()) {
      const userPayouts = this.computeUserPayouts(eligibleGameEvents, user);

      // Create auditable entries for each payout
      for (const payout of userPayouts) {
        await this.revshareLedgerRepository.save(payout);
      }
    }

    // Check for fraud and clawback if necessary
    await this.clawbackService.checkForFraudAndClawback();
  }

  /**
   * Compute payouts for a single user from the given game events.
   *
   * @param gameEvents Verified game events to process.
   * @param user The user for whom to compute payouts.
   */
  private computeUserPayouts(gameEvents: GameEvent[], user: User): RevshareLedgerEntry[] {
    return gameEvents
      .filter((event) => event.userId === user.id)
      .map((event) => this.createRevshareLedgerEntry(user, event));
  }

  /**
   * Create a new revenue share ledger entry for the given user and game event.
   *
   * @param user The user for whom to create the entry.
   * @param event The game event for which to create the entry.
   */
  private createRevshareLedgerEntry(user: User, event: GameEvent): RevshareLedgerEntry {
    return new RevshareLedgerEntry({
      userId: user.id,
      gameEventId: event.id,
      amount: this.calculatePayoutAmount(event),
      createdAt: new Date(),
    });
  }

  /**
   * Calculate the payout amount for a given game event.
   *
   * @param event The game event for which to calculate the payout amount.
   */
  private calculatePayoutAmount(event: GameEvent): number {
    // Implement game-specific payout calculation logic here
    return 0;
  }
}
