# POST STRUCTURES: Complete Posting Guide

## Overview

This guide provides a detailed breakdown of posting structures for Point Zero One Digital's 12-minute financial roguelike game. It includes format specifications, example scripts, platform notes, optimal post times, and comment pin templates for each moment family.

## Non-Negotiables

- Strict TypeScript mode: `--strict` flag must be used in all code files.
- No usage of 'any' type in TypeScript.
- All effects are deterministic.

## Implementation Spec

### 12s Format

```typescript
type TwelveSecondPost = {
  id: string;
  content: string;
  timestamp: number; // Unix timestamp (seconds)
};
```

Example script:

```typescript
const twelveSecondPost: TwelveSecondPost = {
  id: 'unique-id',
  content: 'Your engaging content here',
  timestamp: Date.now() / 1000, // Convert to seconds
};
```

### 25s Format

```typescript
type TwentyFiveSecondPost = {
  id: string;
  content: string;
  timestamp: number; // Unix timestamp (seconds)
  continuationId?: string; // Optional for multi-part posts
};
```

Example script:

```typescript
const twentyFiveSecondPost: TwentyFiveSecondPost = {
  id: 'unique-id',
  content: 'Your engaging content here',
  timestamp: Date.now() / 1000, // Convert to seconds
  continuationId: 'optional-continuation-id', // If applicable
};
```

### 45s Format

```typescript
type FortyFiveSecondPost = {
  id: string;
  content: string;
  timestamp: number; // Unix timestamp (seconds)
  continuationId?: string; // Optional for multi-part posts
  partNumber: number; // Part number within the post (1-3)
};
```

Example script:

```typescript
const fortyFiveSecondPost: FortyFiveSecondPost = {
  id: 'unique-id',
  content: 'Your engaging content here',
  timestamp: Date.now() / 1000, // Convert to seconds
  continuationId: 'optional-continuation-id', // If applicable
  partNumber: 1, // Part number within the post (1-3)
};
```

## Edge Cases

- When a post continues across multiple timeframes, use `continuationId` to link parts.
- Ensure optimal post times are considered for each format based on game dynamics and player engagement.
- Comment pin templates should be customized for each moment family to maximize engagement and clarity.
