Title: API Mapping, Caching Strategy, and Abuse Controls for Report Endpoint

Overview
---------

This document outlines the endpoint mapping, caching strategy, and abuse controls implemented for the report endpoint in Point Zero One Digital's financial roguelike game. The focus is on strict TypeScript adherence, deterministic effects, and robust security measures.

Non-negotiables
----------------

1. **Endpoint Mapping**: The report endpoint (`/api/report`) will be the sole entry point for user reports.
2. **TypeScript Strict Mode**: All code related to this endpoint will adhere to strict TypeScript mode, ensuring type safety and avoiding implicit any types.
3. **Deterministic Effects**: All operations within the report endpoint should produce consistent results given the same input.
4. **No 'Any' Types**: Avoid using 'any' in TypeScript. Instead, use explicit types to maintain code clarity and type safety.
5. **Caching Strategy**: Implement a caching mechanism to improve performance and reduce server load.
6. **Abuse Controls**: Implement measures to prevent abuse or misuse of the report endpoint.

Implementation Spec
--------------------

### Endpoint Mapping

The report endpoint (`/api/report`) will handle incoming user reports, process them, and store them in a secure database.

### TypeScript Strict Mode

All code related to this endpoint will be written in strict TypeScript mode, enforcing explicit type declarations and disallowing implicit any types.

```typescript
const reportEndpoint = (req: Request, res: Response) => {
  // ...
};
```

### Deterministic Effects

All operations within the report endpoint will be designed to produce consistent results given the same input. This includes data validation, processing, and storage.

### No 'Any' Types

Avoid using 'any' in TypeScript. Instead, use explicit types to maintain code clarity and type safety.

```typescript
const reportData: ReportData = {
  // ...
};
```

### Caching Strategy

Implement a caching mechanism to improve performance and reduce server load. Cache responses for a configurable duration (e.g., 1 hour) and refresh the cache when new reports are received or the cache expires.

```typescript
const reportCache = new Cache();

reportEndpoint(req: Request, res: Response) {
  const cachedReport = reportCache.get('/api/report');

  if (cachedReport) {
    // Serve cached response if available
    res.send(cachedReport);
  } else {
    // Process and store new report, then cache the response
    processAndStoreReport(req.body).then((newReport: ReportData) => {
      reportCache.set('/api/report', newReport);
      res.send(newReport);
    });
  }
}
```

### Abuse Controls

Implement measures to prevent abuse or misuse of the report endpoint, such as rate limiting and IP blocking.

```typescript
const rateLimiter = new RateLimiter();

reportEndpoint(req: Request, res: Response) {
  if (!rateLimiter.allowRequest(req.ip)) {
    // Block request if rate limit exceeded for the IP address
    res.status(429).send('Too Many Requests');
    return;
  }

  // ... process and handle report as usual
}
```

Edge Cases
----------

1. **Rate Limiting**: Handle cases where a user exceeds the rate limit by providing informative error messages and allowing for cooldown periods before resuming requests.
2. **IP Blocking**: Implement mechanisms to unblock IP addresses after a configurable period if they were incorrectly blocked due to temporary network issues or other factors.
