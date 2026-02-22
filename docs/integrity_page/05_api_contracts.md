# API Contracts for Point Zero One Digital

## Overview

This document outlines the read-only endpoints, authentication rules, rate limits, and privacy posture for the API contracts in Point Zero One Digital's financial roguelike game.

## Non-negotiables

1. Strict TypeScript usage with no 'any'. All code is strict-mode.
2. Deterministic effects across all endpoints.
3. Adherence to production-grade, deployment-ready infrastructure architect design principles.

## Implementation Spec

### Endpoints

#### GET /runs/:id/verification

Retrieves the verification status of a specific game run identified by `:id`.

##### Response

```json
{
  "status": "verified" | "unverified",
  "timestamp": "YYYY-MM-DDTHH:MM:SS.SSSZ"
}
```

#### GET /integrity/transparency

Provides a transparent view into the integrity of all game runs, including verification statuses and timestamps.

##### Response

```json
[
  {
    "run_id": "ID",
    "status": "verified" | "unverified",
    "timestamp": "YYYY-MM-DDTHH:MM:SS.SSSZ"
  },
  ...
]
```

#### POST /appeals

Allows users to submit appeals for game runs that have been deemed unverified. The appeal includes a brief explanation and any relevant evidence.

##### Request Body

```json
{
  "run_id": "ID",
  "explanation": "Explanation of the appeal",
  "evidence": [
    {
      "type": "URL" | "FILE",
      "data": "Base64 encoded data"
    },
    ...
  ]
}
```

### Authentication

Authentication is required for all API endpoints. Users must provide a valid API key in the `Authorization` header of each request.

### Rate Limits

Each user is subject to rate limits on API requests to prevent abuse and ensure fairness. The exact number of allowed requests per unit of time will be determined based on factors such as account age, activity level, and compliance with the game's terms of service.

### Privacy Posture

Point Zero One Digital prioritizes user privacy and adheres to strict data protection policies. Personal information is never shared without explicit consent, and all data is encrypted at rest and in transit. Users can manage their privacy settings within the game interface.
