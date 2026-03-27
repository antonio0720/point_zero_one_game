// backend/src/game/engine/chat/adapters/SnapshotAdapterSignalAdapter.ts
// STUB — placeholder for SnapshotAdapterSignalAdapter implementation.

// ============================================================================
// Types
// ============================================================================

export type TickRecordCompat = Record<string, unknown>;
export type RunSummaryCompat = Record<string, unknown>;
export type SnapshotDeltaCompat = Record<string, unknown>;
export type AdapterMLVectorCompat = Record<string, unknown>;
export type AdapterDLTensorCompat = Record<string, unknown>;
export type AdapterAuditEntryCompat = Record<string, unknown>;
export type SnapshotAdapterSignalContext = Record<string, unknown>;
export type SnapshotAdapterSignalAdapterOptions = Record<string, unknown>;
export type SnapshotAdapterSignalStats = Record<string, unknown>;

// ============================================================================
// Constants
// ============================================================================

export const SNAPSHOT_ADAPTER_SIGNAL_MANIFEST = Object.freeze({
  domain: 'SNAPSHOT_ADAPTER',
  version: '1.0.0',
});

// ============================================================================
// Class
// ============================================================================

export class SnapshotAdapterSignalAdapter {
  getState(): Record<string, unknown> { return {}; }
}

// ============================================================================
// Factory & functions
// ============================================================================

export function createSnapshotAdapterSignalAdapter(
  _options?: SnapshotAdapterSignalAdapterOptions,
): SnapshotAdapterSignalAdapter {
  return new SnapshotAdapterSignalAdapter();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adaptSnapshotSummarySignals(..._args: unknown[]): any { return []; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adaptSnapshotBundle(..._args: unknown[]): any { return {}; }
