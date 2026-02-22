# Seeded Determinism Specification for Point Zero One Digital's 12-minute Financial Roguelike Game

## Overview

This document outlines the rules and specifications for seed generation, deterministic PRNG algorithm selection, run_seed structure, replay encoding format, and seed commitment in our 12-minute financial roguelike game. The focus is on strict TypeScript coding practices with no 'any' usage, and all effects are deterministic to ensure reproducibility and fairness.

## Non-negotiables

1. Seed generation must produce a unique seed for each game run.
2. PRNG algorithm selection should prioritize xorshift64 due to its high quality and speed.
3. The run_seed structure should encapsulate all necessary information for a single game run.
4. Replay encoding format should be human-readable and machine-parsable.
5. Seed commitment must occur before the game run starts, ensuring that players cannot manipulate the seed after the game begins.

## Implementation Spec

### Seed Generation Rules

1. Generate a unique 64-bit seed using xorshift64.
2. Hash the generated seed with SHA-256 to ensure uniqueness and security.
3. Store the hashed seed securely for future reference or replayability.

### run_seed Structure

1. The run_seed object should contain the following properties:
   - `seed` (number): The unique 64-bit seed used to generate all random values in the game.
   - `hash` (string): The SHA-256 hash of the seed for security and uniqueness.
   - `timestamp` (number): The Unix timestamp at which the game run started.
   - `replay_file` (string): The path or URL to the replay file, if applicable.

### PRNG Algorithm Selection

1. Use xorshift64 as the primary PRNG algorithm for its high quality and speed.
2. If there's a need for a different PRNG algorithm, it should be thoroughly tested and documented.

### Replay Encoding Format

1. Save game state at key points during the game run (e.g., at the end of each round).
2. Encode the game state as JSON, including all relevant data from the run_seed object.
3. Store the encoded replay file with a unique name or identifier.

### Seed Commitment

1. Before starting the game run, commit the seed and hash to a secure storage system (e.g., a blockchain).
2. Make the committed seed and hash publicly available for transparency and verification purposes.

## Edge Cases

1. If multiple players are playing simultaneously, ensure that each player's seed is unique and unpredictable by other players.
2. In case of network issues or errors during seed commitment, implement a fallback mechanism to store the seed securely locally until it can be committed successfully.
3. When replaying a game, verify that the provided seed matches the stored hash for authenticity and integrity.
