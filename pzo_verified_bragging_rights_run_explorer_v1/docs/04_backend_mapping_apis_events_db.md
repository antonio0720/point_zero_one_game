# Backend Mapping: APIs, Events DB, Read Model (Run Explorer Public) v1

This document outlines the design and implementation of the `run_explorer_public` read model, APIs, cache policy, and events for Point Zero One Digital's 12-minute financial roguelike game.

## Overview

The `run_explorer_public` is a read-only service that provides real-time and historical data about game runs to the public. It exposes APIs for retrieving run details, proof hashes, replay windows, and verification panels. The service utilizes an events database to store and process game events, ensuring deterministic results.

## Non-negotiables

1. **TypeScript**: All code is written in TypeScript using strict mode to ensure type safety and maintainability.
2. **Determinism**: All effects are deterministic, ensuring consistent results across all runs.
3. **Cache Policy**: Implement a cache policy for efficient data retrieval and reduced database load.
4. **API Design**: APIs should be designed with REST principles in mind, providing clear endpoints and response formats.

## Implementation Spec

### Run Explorer Public Read Model

The read model is responsible for storing and querying game run data. It maintains a real-time stream of events from the game engine and processes them to update the read model's state. The read model exposes APIs for retrieving run details, proof hashes, replay windows, and verification panels.

#### GetByRunId

Retrieves the details of a specific game run given its ID.

```
GET /runs/{run_id}
```

Response:

```json
{
  "run_id": "abc123",
  "game_state": {...},
  "proof_hash": "0x..."
}
```

#### GetByProofHash

Retrieves the details of a specific game run given its proof hash. This API is useful for verifying the integrity of a run.

```
GET /runs/proof/{proof_hash}
```

Response:

```json
{
  "run_id": "abc123",
  "game_state": {...},
  "proof_hash": "0x..."
}
```

#### GetReplayWindow

Retrieves the game state and proof hash for a specific time window. This API is useful for replaying or verifying runs within a specified timeframe.

```
GET /runs/replay/{start_timestamp}/{end_timestamp}
```

Response:

```json
[
  {
    "run_id": "abc123",
    "game_state": {...},
    "proof_hash": "0x..."
  },
  ...
]
```

#### GetVerificationPanel

Retrieves the verification panel data for a specific game run. This data can be used to verify the integrity of the run and its associated assets.

```
GET /runs/{run_id}/verification_panel
```

Response:

```json
{
  "run_id": "abc123",
  "verification_panel": {...}
}
```

### Cache Policy

To ensure efficient data retrieval and reduced database load, implement a cache policy for the `run_explorer_public` service. The cache should be configured to store frequently accessed run details, proof hashes, and verification panel data.

### Events

The events database stores game events emitted by the game engine. Each event contains information about the state of the game at a specific point in time. The events are processed by the read model to update its state and provide real-time and historical data through the APIs.

## Edge Cases

1. **Concurrent Runs**: Implement locking mechanisms to prevent concurrent modifications to the same run's data.
2. **Database Failure**: Implement retry logic and error handling for database operations to ensure data integrity in case of failures.
3. **Cache Eviction**: Implement a cache eviction strategy to manage memory usage and ensure that stale data is removed from the cache.
