/**
 * Roster Upload Service
 */

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yup from 'yup';
import { v4 as uuidv4 } from 'uuid';

/**
 * Partner Roster Upload Schema
 */
const rosterSchema = yup.object().shape({
  partner_id: yup.string().required(),
  game_id: yup.string().required(),
  player_id: yup.string().required(),
  eligibility_state: yup.string().oneOf(['eligible', 'ineligible']).default('eligible'),
});

/**
 * Roster Upload Service Interface
 */
export interface IRosterUploadService {
  upload(filePath: string): Promise<void>;
}

/**
 * Roster Upload Service Implementation
 */
@Injectable()
export class RosterUploadService implements IRosterUploadService {
  /**
   * Upload a CSV file containing partner rosters and perform validation, idempotent upserts, and eligibility state updates.
   * @param filePath The path to the CSV file containing the partner roster data.
   */
  async upload(filePath: string): Promise<void> {
    const fileContent = fs.readFileSync(path.resolve(filePath), 'utf-8');
    const rows = fileContent.split('\n').slice(1); // Skip header row

    const validationResult = rosterSchema.validateBatch(rows.map((row) => row.split(',')));

    if (validationResult.errors.length > 0) {
      throw new Error(`Invalid CSV format: ${validationResult.errors.join('. ')}`);
    }

    const connection = await getConnection(); // Assuming a TypeORM connection is available

    for (const row of rows) {
      const [partnerId, gameId, playerId, eligibilityState] = row;

      // Check if the player already exists with the same partner and game IDs
      const existingPlayer = await connection.getRepository(PartnerGamePlayerEntity).findOne({
        where: { partnerId, gameId, playerId },
      });

      if (existingPlayer) {
        // If the player already exists, update the eligibility state deterministically
        existingPlayer.eligibilityState = eligibilityState;
        await connection.save(existingPlayer);
      } else {
        // If the player does not exist, create a new record with a unique ID and set the eligibility state
        const newPlayer = new PartnerGamePlayerEntity();
        newPlayer.id = uuidv4();
        newPlayer.partnerId = partnerId;
        newPlayer.gameId = gameId;
        newPlayer.playerId = playerId;
        newPlayer.eligibilityState = eligibilityState;
        await connection.save(newPlayer);
      }
    }
  }
}

/**
 * TypeORM Entity for PartnerGamePlayer
 */
export class PartnerGamePlayerEntity {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({ type: 'uuid' })
  partnerId: string;

  @Column({ type: 'uuid' })
  gameId: string;

  @Column({ type: 'uuid' })
  playerId: string;

  @Column({ type: 'enum', enum: ['eligible', 'ineligible'], default: 'eligible' })
  eligibilityState: string;
}

