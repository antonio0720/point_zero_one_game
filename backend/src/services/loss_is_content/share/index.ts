/**
 * Share rendering service for death cards.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/** DeathCard entity. */
export class DeathCard {
  /** The unique identifier for the death card. */
  id: number;

  /** The player's username associated with this death card. */
  playerUsername: string;

  /** The game round in which the player died. */
  round: number;

  /** The timestamp when the player died. */
  timestamp: Date;
}

/** DeathCardRepository interface. */
export interface DeathCardRepository {
  save(deathCard: DeathCard): Promise<DeathCard>;
  findAll(): Promise<DeathCard[]>;
}

/** Share rendering service for death cards. */
@Injectable()
export class ShareService implements DeathCardRepository {
  constructor(
    @InjectRepository(DeathCard)
    private readonly deathCardRepository: Repository<DeathCard>,
  ) {}

  /**
   * Save a new death card to the database.
   *
   * @param deathCard The death card to save.
   */
  async save(deathCard: DeathCard): Promise<DeathCard> {
    return this.deathCardRepository.save(deathCard);
  }

  /**
   * Retrieve all death cards from the database.
   */
  async findAll(): Promise<DeathCard[]> {
    return this.deathCardRepository.find();
  }
}

