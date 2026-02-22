# Backend API DB Mapping for PZO Two-Tier Ladder System v1

## Overview

This document outlines the backend tables, APIs, events, and query performance Service Level Objectives (SLOs) for the PZO Two-Tier Ladder System v1. Additionally, it details the event-sourced rank computation pattern implementation.

## Non-negotiables

- Strict TypeScript adherence with no usage of 'any'
- All code in strict mode
- Deterministic effects across all components
- Production-grade and deployment-ready infrastructure

## Implementation Spec

### Backend Tables

1. **Users** (user_id, username, password_hash, email, created_at, updated_at)
   - Unique user_id primary key
   - Email validation for unique emails

2. **Games** (game_id, game_name, game_type, created_by, created_at, updated_at)
   - Unique game_id primary key
   - Created_by references user_id

3. **GameSessions** (session_id, game_id, player_id, score, created_at, updated_at)
   - Unique session_id primary key
   - Foreign keys for game_id and player_id

4. **Rankings** (ranking_id, user_id, total_score, highest_score, average_score, created_at, updated_at)
   - Unique ranking_id primary key
   - Foreign key for user_id

### APIs

1. **User API**
   - POST /users: Create a new user
   - GET /users/:userId: Retrieve user details
   - PUT /users/:userId: Update user details
   - DELETE /users/:userId: Delete a user

2. **Game API**
   - POST /games: Create a new game (requires authentication)
   - GET /games: Retrieve all games
   - GET /games/:gameId: Retrieve game details
   - PUT /games/:gameId: Update game details (requires authentication)
   - DELETE /games/:gameId: Delete a game (requires authentication)

3. **GameSession API**
   - POST /sessions: Create a new session (requires authentication and game_id)
   - GET /sessions: Retrieve all sessions
   - GET /sessions/:sessionId: Retrieve session details
   - PUT /sessions/:sessionId: Update session details (score only)
   - DELETE /sessions/:sessionId: Delete a session

4. **Ranking API**
   - GET /rankings: Retrieve all rankings
   - GET /rankings/:userId: Retrieve user rankings

### Events

1. **GameCreatedEvent** (game_id, game_name, game_type, created_by)
2. **SessionCreatedEvent** (session_id, game_id, player_id, score, created_at)
3. **ScoreUpdatedEvent** (session_id, new_score)
4. **RankComputedEvent** (ranking_id, user_id, total_score, highest_score, average_score)

### Query Performance SLOs

- All read queries should return results within 10ms for 99th percentile
- All write queries should complete within 50ms for 99th percentile

### Event-Sourced Rank Computation Pattern

Upon creation or update of a GameSession, the ScoreUpdatedEvent is published. A separate process listens to these events and computes the rankings based on total score, highest score, and average score. The RankComputedEvent is then published, triggering the Ranking API to update the rankings accordingly.

## Edge Cases

- Handling concurrent updates to GameSessions and Rankings using optimistic locking or similar techniques
- Ensuring data consistency when updating multiple tables in a single transaction
- Implementing rate limiting on API endpoints to prevent abuse and ensure fairness
