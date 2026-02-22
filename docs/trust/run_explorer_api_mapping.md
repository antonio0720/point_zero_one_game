# Explorer API Mapping Document

## Overview

This document outlines the mapping of explorer endpoints to their corresponding read model, cache policy, and status semantics in Point Zero One Digital's financial roguelike game. The focus is on maintaining a production-grade, deployment-ready infrastructure with strict TypeScript adherence and deterministic effects.

## Non-negotiables

1. Strict TypeScript mode: All code must be written in strict mode to ensure type safety and avoid any potential runtime errors.
2. No usage of 'any': To maintain type safety, avoid using the 'any' type in your code.
3. Deterministic effects: All game states should be deterministic to ensure fairness and reproducibility.
4. Cache policy: Implement caching strategies to optimize performance while ensuring data consistency.
5. Status semantics: Clearly define the status of each API endpoint response, including success, error, and edge cases.

## Implementation Spec

### Endpoint 1: `/game/state`
- Read Model: GameState
- Cache Policy: Cache for 60 seconds with a maximum cache size of 100 entries.
- Status Semantics:
  - Success (200): Returns the current game state if available in cache or fetches and stores it before returning.
  - Not Found (404): If no game state is found, returns an empty game state.
  - Internal Server Error (500): Indicates an unexpected error occurred while fetching or processing the game state.

### Endpoint 2: `/player/:playerId/balance`
- Read Model: PlayerBalance
- Cache Policy: Cache for 1 minute with a maximum cache size of 500 entries.
- Status Semantics:
  - Success (200): Returns the balance of the specified player if available in cache or fetches and stores it before returning.
  - Not Found (404): If no player is found, returns an error message indicating the player does not exist.
  - Internal Server Error (500): Indicates an unexpected error occurred while fetching or processing the player balance.

### Endpoint 3: `/transactions`
- Read Model: TransactionHistory
- Cache Policy: Cache for 5 minutes with a maximum cache size of 1000 entries.
- Status Semantics:
  - Success (200): Returns the transaction history if available in cache or fetches and stores it before returning.
  - Not Found (404): If no transactions are found, returns an empty transaction history.
  - Internal Server Error (500): Indicates an unexpected error occurred while fetching or processing the transaction history.

## Edge Cases

1. Concurrent requests: Implement locking mechanisms to prevent race conditions when multiple requests access the same data simultaneously.
2. Cache eviction: Implement a least-recently-used (LRU) cache eviction strategy to manage cache size effectively.
3. Data inconsistency: In case of data inconsistencies due to concurrent updates or race conditions, implement conflict resolution strategies to maintain data integrity.
