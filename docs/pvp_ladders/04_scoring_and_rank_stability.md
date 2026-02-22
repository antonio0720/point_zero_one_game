# PVP Ladders: Scoring and Rank Stability

## Overview

This document outlines the scoring system, publishing differences, batch rank update windows, and anti-flicker design for Point Zero One Digital's 12-minute financial roguelike game. The focus is on maintaining a deterministic, production-grade, deployment-ready infrastructure.

## Non-Negotiables

1. **Same Scoring Math**: All players should be scored using the same mathematical formula to ensure fairness and consistency.
2. **Publishing Differences**: Scores must be published at different intervals for various platforms to accommodate their respective APIs and update frequencies.
3. **Batch Rank Update Windows**: Rank updates should occur in batches within defined windows to minimize server load and maintain performance.
4. **Anti-Flicker Design**: Implement measures to prevent sudden, frequent changes (flickering) in player ranks due to simultaneous updates or network latency.

## Implementation Spec

### Scoring Math

The scoring system will be based on a combination of factors such as game performance, strategy, and time management. The exact formula will be determined during the development phase, ensuring it is deterministic and reproducible.

### Publishing Differences

For web-based platforms, scores will be published immediately upon calculation. For mobile platforms with limited network connectivity, scores will be buffered locally and sent to the server at regular intervals (e.g., every 5 minutes).

### Batch Rank Update Windows

Rank updates will occur in batches within defined windows (e.g., every hour) to minimize server load and maintain performance. Within each batch, ranks will be updated based on the most recent scores available.

### Anti-Flicker Design

To prevent sudden, frequent changes in player ranks due to simultaneous updates or network latency, implement a smoothing algorithm that averages rank changes over a defined period (e.g., 5 minutes). This will help reduce flickering and provide a more stable ranking experience for players.

## Edge Cases

1. **Network Latency**: If a player's score is calculated but not immediately sent to the server due to network latency, the score should be buffered locally and sent as soon as possible. The smoothing algorithm will help minimize the impact of delayed updates on rank stability.
2. **Simultaneous Updates**: In case multiple players update their scores simultaneously, the server should prioritize processing based on a predefined order (e.g., by player ID or timestamp). This will ensure that rank changes are processed in a consistent and predictable manner.
