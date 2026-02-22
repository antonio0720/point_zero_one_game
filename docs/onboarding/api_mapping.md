# API Mapping, Auth Model, and Caching Policy for Point Zero One Digital

## Overview

This document outlines the endpoint mapping, auth model for guest-to-account conversion, and caching policy for our financial roguelike game, Point Zero One Digital. All code adheres to strict TypeScript mode with a deterministic approach.

## Non-Negotiables

1. **Endpoint Mapping**: Each endpoint should have a clear purpose and be easily discoverable through the API documentation.
2. **Auth Model**: The auth model must support guest access while providing a seamless conversion to an account when necessary.
3. **Caching Policy**: Implement a caching policy that ensures efficient data retrieval without compromising data integrity or freshness.

## Implementation Spec

### Endpoint Mapping

- `/api/v1`: The primary API version, containing all endpoints related to gameplay, user management, and financial transactions.
- `/api/v1/auth`: Authentication-related endpoints for guest access and account creation/management.
- `/api/v1/cache`: Endpoints for managing cache data and invalidation.

### Auth Model

Guests can access the game without authentication, but certain features may be limited. To convert a guest to an account, users must complete the registration process by providing necessary information and agreeing to our terms of service.

### Caching Policy

- **Cache Key**: Each cache key should be unique and based on the endpoint, query parameters, and data being cached.
- **Cache Expiration**: Cache data will expire after 1 hour (3600 seconds) to ensure freshness while minimizing API calls.
- **Cache Invalidation**: When data changes, the corresponding cache entry will be invalidated and rebuilt on subsequent requests.

## Edge Cases

- If a guest attempts to access a feature that requires authentication, they will be prompted to create an account or log in.
- If a user's session expires, they will be treated as a guest until they log back in or create a new account.
