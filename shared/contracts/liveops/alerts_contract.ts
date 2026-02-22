Here is the TypeScript file `shared/contracts/liveops/alerts_contract.ts`:

```typescript
/**
 * Alert definitions schema (thresholds, windows, severity, runbooks).
 */

export interface AlertDefinition {
  /** Unique identifier for the alert definition */
  id: number;

  /** Name of the alert definition */
  name: string;

  /** Description of the alert definition */
  description?: string;

  /** Threshold value for triggering the alert */
  threshold: number | string;

  /** Time window for the alert (e.g., "1h", "24h") */
  window: string;

  /** Severity level of the alert (e.g., "info", "warning", "error") */
  severity: AlertSeverity;

  /** Runbook associated with the alert */
  runbookId?: number;
}

export enum AlertSeverity {
  Info = 'info',
  Warning = 'warning',
  Error = 'error'
}
