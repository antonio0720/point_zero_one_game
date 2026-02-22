# Backend Mapping for Verifier Service

## Overview

This document outlines the mapping of Point Zero One Digital's game functions to existing verifier-service methods, focusing on `VerifyRun` and `GetVerificationStatus`, quarantine states, and ladder gating implications.

## Non-negotiables

1. Strict TypeScript adherence: No usage of 'any'. All code is strict-mode.
2. Deterministic effects: All game outcomes are predictable and reproducible.
3. Production-grade, deployment-ready: The mapping ensures robustness and scalability for the live environment.

## Implementation Spec

### VerifyRun

- Mapping: Game initialization function to `VerifyRun`.
- Description: Upon game start, the game's initial state is sent to the verifier service for validation.
- Verification checks: Ensures the game's starting conditions are correct and adhere to the game's ruleset.

### GetVerificationStatus

- Mapping: Game progress monitoring function to `GetVerificationStatus`.
- Description: Periodically, during gameplay, the current game state is sent to the verifier service for validation.
- Verification checks: Ensures the game's ongoing conditions are correct and adhere to the game's ruleset.

### Quarantine States

- Mapping: Game states that violate the ruleset to quarantine states.
- Description: If a game state is invalid, it will be flagged as quarantined and isolated from the live game environment.
- Handling: The game will either be restarted or marked for manual review by an administrator.

### Ladder Gating Implications

- Mapping: Game progression through levels to ladder gating.
- Description: If a game state is valid, it will be used to progress the game to the next level or stage.
- Verification checks: Ensures that the player has met the necessary conditions to advance in the game.

## Edge Cases

- Timeouts: If the verifier service takes too long to respond, the game may continue with an unverified state. However, this will be logged for review and potential manual intervention.
- Offline Verifier Service: In case of verifier service downtime, the game will continue but any progress made during that period will be flagged as unverified until the verifier service is back online.
