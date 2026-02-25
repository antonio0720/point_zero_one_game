/**
 * Generates a seed commitment for a given run ID.
 */
export function generateSeed(runId: number): string {
  // Combine player_id, timestamp, and nonce to create a reproducible PRNG sequence
  const prngSequence = createPRNGSequence(runId);

  // Hash the PRNG sequence to get the seed commitment
  const seedCommitment = sha256(prngSequence);

  return seedCommitment;
}

/**
 * Creates a pseudo-random number generator (PRNG) sequence using the given run ID.
 */
function createPRNGSequence(runId: number): Uint8Array {
  // Implement your PRNG algorithm here
  // For simplicity, this example uses a simple XOR operation as a PRNG
  const playerId = 123; // Replace with actual player ID
  const timestamp = Date.now(); // Replace with actual timestamp
  const nonce = Math.floor(Math.random() * 1000000); // Replace with actual nonce

  return Buffer.from([playerId, timestamp, nonce]).map((byte) => byte ^ runId);
}

/**
 * Hashes the given data using SHA-256 algorithm.
 */
function sha256(data: Uint8Array): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}
