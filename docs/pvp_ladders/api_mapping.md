# PVP Ladders API Mapping Document

## Overview

This document outlines the mapping of PVP ladders endpoints to their respective services, authentication, and caching policies for the Point Zero One Digital's 12-minute financial roguelike game.

## Non-Negotiables

1. Strict TypeScript adherence: No usage of 'any'. All code is strict-mode.
2. Deterministic effects: All game logic and API responses should be predictable and reproducible.
3. Production-grade, deployment-ready: The design should cater to scalability and reliability in a production environment.
4. Windows verified: All solutions must be tested and verified on the Windows platform.

## Implementation Spec

### Endpoints

| Endpoint                     | Service                   | Auth                | Caching Policy          |
|------------------------------|---------------------------|---------------------|-------------------------|
| `/api/pvp/ladders`           | PVP Ladders API Service   | JWT Authentication  | Cache for 1 hour        |
| `/api/pvp/ladders/{ladderId}`| PVP Ladders API Service   | JWT Authentication  | Cache for 5 minutes     |
| `/api/pvp/matches`           | Matchmaking API Service   | JWT Authentication  | No caching             |
| `/api/pvp/matches/{matchId}` | Match API Service         | JWT Authentication  | Cache for 1 minute      |

### Services

#### PVP Ladders API Service

- Responsible for managing and retrieving data related to player ladders.
- Implements the logic for ranking players based on their performance in PvP matches.

#### Matchmaking API Service

- Matches players against each other based on their skill level, rank, and availability.
- Ensures fair matchmaking by considering various factors such as win/loss ratio, time spent in game, etc.

#### Match API Service

- Handles the creation, update, and deletion of PvP matches.
- Tracks the progress and outcome of each match, updating player statistics accordingly.

## Edge Cases

1. In case of a tie between players in the same ladder, the player with the most recent win will be ranked higher.
2. If a player disconnects during a match, the match will be marked as a loss for that player and a win for their opponent.
3. In case of network issues or server downtime, matches may be temporarily paused or rescheduled to ensure fairness and maintain game integrity.
