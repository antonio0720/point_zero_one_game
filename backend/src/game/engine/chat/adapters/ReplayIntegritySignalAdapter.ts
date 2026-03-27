// backend/src/game/engine/chat/adapters/ReplayIntegritySignalAdapter.ts
// STUB — placeholder for ReplayIntegritySignalAdapter implementation.

// ============================================================================
// Types
// ============================================================================

export type IntegrityResultCompat = Record<string, unknown>;
export type IntegrityMLVectorCompat = Record<string, unknown>;
export type IntegrityDLTensorCompat = Record<string, unknown>;
export type IntegrityAuditEntryCompat = Record<string, unknown>;
export type IntegritySignalAdapterContext = Record<string, unknown>;
export type IntegritySignalAdapterLogger = { log: (...args: unknown[]) => void };
export type IntegritySignalAdapterClock = { nowMs: () => number };
export type IntegritySignalAdapterSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'AMBIENT';
export type IntegritySignalAdapterEventName = string;
export type ReplayIntegritySignalAdapterOptions = Record<string, unknown>;
export type IntegritySignalAdapterStats = Record<string, unknown>;

// ============================================================================
// Constants
// ============================================================================

export const INTEGRITY_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  domain: 'REPLAY_INTEGRITY',
  version: '1.0.0',
});

// ============================================================================
// Class
// ============================================================================

export class ReplayIntegritySignalAdapter {
  getState(): Record<string, unknown> { return {}; }
}

// ============================================================================
// Factory & functions
// ============================================================================

export function createReplayIntegritySignalAdapter(
  _options?: ReplayIntegritySignalAdapterOptions,
): ReplayIntegritySignalAdapter {
  return new ReplayIntegritySignalAdapter();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildIntegritySignalPayload(..._args: unknown[]): any { return null; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adaptAllIntegritySignals(..._args: unknown[]): any { return []; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adaptIntegrityBundle(..._args: unknown[]): any { return {}; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adaptIntegrityAuditBatch(..._args: unknown[]): any { return []; }
export function integrityStatusHeadline(_input: unknown): string { return ''; }
export function integrityStatusCoachingMessage(_input: unknown): string { return ''; }
export function anomalyHeadline(_input: unknown): string { return ''; }
export function anomalyCoachingMessage(_input: unknown): string { return ''; }
export function auditEntryMessage(_input: unknown): string { return ''; }
