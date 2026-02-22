# Backend API Contracts for Point Zero One Digital

## Overview

This document outlines the endpoint list, request/response examples, auth scopes, and rate limits for the backend API of Point Zero One Digital's financial roguelike game. All assumptions are based on the domain `pointzeroonegame.com`.

## Non-negotiables

1. Strict TypeScript mode with no usage of 'any'.
2. Deterministic effects in all API responses.
3. Production-grade, deployment-ready infrastructure.
4. Anti-bureaucratic language and zero fluff.

## Implementation Spec

### Endpoint List

1. `/auth/login` - User authentication.
2. `/game/start` - Start a new game session.
3. `/game/save` - Save the current game state.
4. `/game/load` - Load a saved game state.
5. `/game/play` - Play a single turn of the game.
6. `/game/stats` - Retrieve game statistics.
7. `/game/leaderboard` - Retrieve the global leaderboard.
8. `/payment/purchase` - Purchase in-game currency.
9. `/notification/subscribe` - Subscribe to game notifications.
10. `/notification/unsubscribe` - Unsubscribe from game notifications.

### Request/Response Examples

#### Login Request

```json
{
  "username": "example_user",
  "password": "example_password"
}
```

#### Login Response (Success)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer"
}
```

#### Login Response (Error)

```json
{
  "error": "Invalid credentials."
}
```

### Auth Scopes

1. `user:read` - Read access to user data.
2. `game:write` - Write access to game data.
3. `payment:write` - Write access for in-game purchases.
4. `notification:write` - Write access for game notifications.

### Rate Limits

1. 60 requests per minute for unauthenticated users.
2. 120 requests per minute for authenticated users with `user:read`, `game:write`, and `payment:write` scopes.
3. 240 requests per minute for authenticated users with all available scopes.

## Edge Cases

1. In case of rate limit exceeding, the API will return a `429 Too Many Requests` status code along with a retry-after header.
2. If an authentication token is expired or invalid, the API will return a `401 Unauthorized` status code.
3. For game-related endpoints, if no valid game session exists for the authenticated user, the API will return a `404 Not Found` status code.
