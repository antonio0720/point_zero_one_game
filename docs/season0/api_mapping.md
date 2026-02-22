# API Mapping for Point Zero One Digital

## Overview

This document outlines the mapping of endpoints to services, authentication, rate limits, and caching policy for the 12-minute financial roguelike game developed by Point Zero One Digital. The focus is on strict TypeScript adherence, deterministic effects, and production-grade deployment readiness.

## Non-negotiables

1. **TypeScript**: All code will be written in TypeScript, with no exceptions for 'any'. Strict mode will be used throughout.
2. **Determinism**: All game effects must be deterministic to ensure fairness and reproducibility.
3. **Production-grade**: The API design should be scalable, secure, and ready for deployment in a production environment.
4. **Auth & Rate Limits**: Authentication and rate limiting mechanisms will be implemented to protect the game's resources and maintain fair play.
5. **Caching Policy**: A caching policy will be defined to optimize performance and reduce server load.

## Implementation Spec

### Endpoint Mapping

| Endpoint                     | Service                   | Auth Required | Rate Limit (requests/minute) | Caching Policy                |
|------------------------------|---------------------------|---------------|------------------------------|-------------------------------|
| `/game/start`                | GameService               | Yes           | 10                            | Countdown Cache (5 minutes)   |
| `/player/register`           | PlayerService             | Yes           | Unlimited                    | No Caching                    |
| `/player/login`              | PlayerService             | Yes           | Unlimited                    | No Caching                    |
| `/player/{id}/profile`       | PlayerService             | Yes           | 10                            | Membership Card Cache (24 hours)|
| `/game/save`                 | GameService               | Yes           | 5                             | No Caching                    |
| `/game/load`                 | GameService               | Yes           | 5                             | No Caching                    |
| `/market/buy`                | MarketService             | Yes           | 10                            | No Caching                    |
| `/market/sell`               | MarketService             | Yes           | 10                            | No Caching                    |
| `/market/listings`           | MarketService             | No            | 60                            | Cache (5 minutes)              |
| `/newsfeed`                  | NewsFeedService           | No            | Unlimited                    | Cache (1 hour)                 |

### Edge Cases

1. **Game Save/Load**: If a player attempts to save or load more than the allowed rate, they will receive an error message and be temporarily blocked from performing these actions.
2. **Market Listings**: If the cache for market listings expires, the service will fetch fresh data and update the cache accordingly.
3. **Newsfeed**: If the newsfeed cache expires, the service will fetch fresh data and update the cache accordingly. However, if there are breaking news events, real-time updates may bypass the caching mechanism.
