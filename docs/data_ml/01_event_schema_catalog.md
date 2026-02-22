# Event Schema Catalog

## Overview

This document outlines the Event Schema Catalog for Point Zero One Digital's services, detailing all 60+ event types and their respective versions, breaking vs non-breaking change rules, and consumer contract registry.

## Non-Negotiables

1. Strict TypeScript adherence: No usage of 'any'. All code is strict-mode.
2. Deterministic effects: All events should have predictable outcomes.
3. Versioning: Each event schema version will be identified by a unique version number.
4. Breaking vs Non-Breaking Change Rules: Clearly defined rules for backward compatibility and potential breaking changes.
5. Consumer Contract Registry: A registry to track the contracts between producers and consumers of events.

## Implementation Spec

### Event Types

Each event type will have a unique name, version number, and schema definition. The schema definition should include all necessary fields and their data types.

```markdown
# GameEventV1

## Fields
- timestamp (string): ISO 8601 formatted date and time
- gameId (string): Unique identifier for the game
- eventType (string): Type of the event (e.g., "GameStarted", "PlayerJoined")
- data (object): Event-specific data
```

### Versioning

Event schema versions will be incremented when there are changes that may affect consumers, such as adding or removing fields, changing field types, or altering the meaning of existing fields.

#### Breaking Changes

Breaking changes include:

1. Adding required fields to an event schema.
2. Changing the data type of a required field.
3. Removing required fields from an event schema.
4. Altering the meaning of a required field.

#### Non-Breaking Changes

Non-breaking changes include:

1. Adding optional fields to an event schema.
2. Changing the data type of an optional field.
3. Removing optional fields from an event schema.
4. Altering the meaning of an optional field.
5. Renaming an event or a field, as long as there is a clear mapping between the old and new names.

### Consumer Contract Registry

The consumer contract registry will track which services are consuming each event type and the version they can handle. This information will help producers ensure backward compatibility when making changes to event schemas.

## Edge Cases

1. Event schema evolution: Procedures for handling long-term evolution of event schemas, including deprecation and archiving of old versions.
2. Consumer contract updates: Mechanisms for notifying consumers about breaking changes and guiding them through the update process.
3. Event schema compatibility checks: Tools to verify that producers and consumers are using compatible event schema versions.
