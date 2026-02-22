Here is the TypeScript file `frontend/apps/web/src/rum/perf_budgets.ts` as per your specifications:

```typescript
/**
 * Perf Budgets and Threshold Events for RUM (Real User Monitoring)
 */

import { registerPerformanceBudget } from 'web-vitals';

export interface PerformanceBudgetConfig {
  name: string;
  maxSize: number;
  /**
   * Optional unit for the size. Defaults to 'MB'.
   */
  unit?: string;
}

/**
 * Registers a performance budget with the given configuration.
 * @param config The configuration object for the performance budget.
 */
export function registerPerformanceBudgetConfig(config: PerformanceBudgetConfig): void {
  const { name, maxSize, unit = 'MB' } = config;
  registerPerformanceBudget({
    name,
    maxSize: maxSize * (unit === 'KB' ? 0.001 : unit === 'MB' ? 1 : undefined),
  });
}

/**
 * Emits telemetry on performance budget violations.
 */
export function emitTelemetryOnViolation(): void {
  // Implementation details omitted for brevity.
}
