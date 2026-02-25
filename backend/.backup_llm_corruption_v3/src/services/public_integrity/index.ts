/**
 * PublicIntegrity service for handling proof and replay resources.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Proof entity representing a game session proof.
 */
export class Proof {
  id: number;
  gameSessionId: number;
  proofData: string;
}

/**
 * Replay entity representing a game session replay.
 */
export class Replay {
  id: number;
  gameSessionId: number;
  replayData: string;
}

/**
 * PublicIntegrity service for handling proof and replay resources.
 */
@Injectable()
export class PublicIntegrityService {
  constructor(
    @InjectRepository(Proof)
    private readonly proofRepository: Repository<Proof>,
    @InjectRepository(Replay)
    private readonly replayRepository: Repository<Replay>,
  ) {}

  /**
   * Save a new proof for the given game session.
   * @param gameSessionId The ID of the game session to save the proof for.
   * @param proofData The data representing the proof.
   */
  async saveProof(gameSessionId: number, proofData: string): Promise<void> {
    const proof = new Proof();
    proof.gameSessionId = gameSessionId;
    proof.proofData = proofData;
    await this.proofRepository.save(proof);
  }

  /**
   * Save a new replay for the given game session.
   * @param gameSessionId The ID of the game session to save the replay for.
   * @param replayData The data representing the replay.
   */
  async saveReplay(gameSessionId: number, replayData: string): Promise<void> {
    const replay = new Replay();
    replay.gameSessionId = gameSessionId;
    replay.replayData = replayData;
    await this.replayRepository.save(replay);
  }
}

-- PublicIntegrity service database schema

CREATE TABLE IF NOT EXISTS proofs (
  id SERIAL PRIMARY KEY,
  game_session_id INTEGER NOT NULL,
  proof_data BYTEA NOT NULL,
  UNIQUE (game_session_id)
);

CREATE TABLE IF NOT EXISTS replays (
  id SERIAL PRIMARY KEY,
  game_session_id INTEGER NOT NULL,
  replay_data BYTEA NOT NULL,
  UNIQUE (game_session_id)
);

#!/bin/sh
set -euo pipefail

echo "Saving proof data"
# Save proof data here

echo "Saving replay data"
# Save replay data here

apiVersion: v1
kind: GameSession
metadata:
  name: example-game-session
spec:
  proofData: <base64 encoded proof data>
  replayData: <base64 encoded replay data>
