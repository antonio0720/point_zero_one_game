/**
 * M99IntegrityChallenge
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_server/src/multiplayer/mechanics/M99_integrity_challenges_lightweight_proof_of_play_checks.ts
 *
 * Lightweight proof-of-play challenge object.
 * M99Mechanics constructs one of these per player per tick,
 * sets the nonce, generates a proof, then verifies it against the game world.
 */

import { createHash } from 'crypto';
import { GameWorld }  from '../../game_world';

export class M99IntegrityChallenge {
  private randomNumber: number  = 0;
  private proofOfPlay:  string  = '';

  /**
   * Sets the seeded nonce [0, 1] for this challenge.
   * Must be called before generateProofOfPlay().
   */
  public setRandomNumber(value: number): void {
    this.randomNumber = Math.min(1, Math.max(0, value));
  }

  /**
   * Generates a proof-of-play commitment from the current nonce.
   *
   * Schema: SHA-256('M99:proof:' + randomNumber.toFixed(16))
   * The high-precision fixed string ensures two different nonces
   * never accidentally collide on a rounded representation.
   */
  public generateProofOfPlay(): void {
    this.proofOfPlay = createHash('sha256')
      .update(`M99:proof:${this.randomNumber.toFixed(16)}`)
      .digest('hex');
  }

  /**
   * Verifies the generated proof against the game world state.
   *
   * Verification strategy:
   *   1. Proof must be non-empty (challenge was generated)
   *   2. Proof must be a valid 64-char hex SHA-256 string
   *   3. Game world must be in an active state (not ended/corrupt)
   *   4. Nonce must be in valid [0, 1] range
   *
   * Returns false on any violation — caller applies graduated consequence.
   */
  public verifyProofOfPlay(gameWorld: GameWorld): boolean {
    if (!this.proofOfPlay || this.proofOfPlay.length !== 64) return false;
    if (!/^[0-9a-f]{64}$/.test(this.proofOfPlay))           return false;
    if (this.randomNumber < 0 || this.randomNumber > 1)      return false;
    if (!gameWorld.isActive())                               return false;

    // Recompute and compare — proof must match the nonce we set
    const expected = createHash('sha256')
      .update(`M99:proof:${this.randomNumber.toFixed(16)}`)
      .digest('hex');

    return expected === this.proofOfPlay;
  }

  public getProof(): string  { return this.proofOfPlay; }
  public getNonce(): number  { return this.randomNumber; }
}
