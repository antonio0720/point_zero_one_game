Here is the TypeScript file `shared/contracts/telemetry/telemetry_envelope_v3.ts`:

```typescript
/**
 * TelemetryEnvelopeV3 contract for Point Zero One Digital's financial roguelike game.
 */

export interface TelemetryEnvelopeV3 {
  idempotencyKey: string;
  runId: string;
  userOrGuestId: string;
  tenant: string;
  timestamps: {
    createdAt: Date;
    updatedAt: Date;
  };
  schemaVersion: number;
}
```

This TypeScript file defines an interface `TelemetryEnvelopeV3` that represents the structure of a telemetry envelope version 3 object. The object contains several properties, including an idempotency key, run ID, user or guest ID, tenant, timestamps, and schema version. All properties are strictly typed to ensure type safety in the codebase.
