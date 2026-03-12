/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ENGINE 0 ZERO DIAGNOSTICS
 * pzo-web/src/engines/zero/ZeroDiagnostics.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Purpose
 * - Provide a zero-owned diagnostics surface for Engine 0 without replacing the
 *   core OrchestratorDiagnostics primitive already in the repo.
 * - Combine:
 *   - core tick/step diagnostics
 *   - event observation from ZeroEventBridge
 *   - store/run mirror snapshots from ZeroStoreBridge
 *   - derived runtime status from ZeroRuntimeStatus
 * - Expose a deep dev/operator snapshot for overlays, tooling, and replay/debug.
 *
 * Doctrine
 * - This file is observational.
 * - It does not mutate engine state.
 * - It does not replace EngineOrchestrator sequencing.
 * - It does not replace core/OrchestratorDiagnostics.ts.
 *
 * Density6 LLC · Point Zero One · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  OrchestratorDiagnostics,
  type OrchestratorAlert,
  type OrchestratorDiagnosticThresholds,
  type OrchestratorDiagnosticsSnapshot,
  type OrchestratorStepName,
  type TickWindowSample,
} from '../core/OrchestratorDiagnostics';
import type {
  EngineEvent,
  EngineEventName,
  TickTier,
} from './types';
import {
  ZeroEventBridge,
  zeroEventBridge,
  type ZeroObservedEventRecord,
} from './ZeroEventBridge';
import {
  ZeroStoreBridge,
  zeroStoreBridge,
  type ZeroStoreBridgeSnapshot,
} from './ZeroStoreBridge';
import {
  ZeroRuntimeStatus,
  zeroRuntimeStatus,
  type ZeroRuntimeStatusSnapshot,
} from './ZeroRuntimeStatus';

export interface ZeroDiagnosticEventJournalEntry {
  readonly recordedAt: number;
  readonly sequence: number;
  readonly eventType: EngineEventName;
  readonly tickIndex: number;
  readonly sourceEngine: string | null;
  readonly payload: unknown;
}

export interface ZeroRuntimeSample {
  readonly sampledAt: number;
  readonly runtimeStatus: ZeroRuntimeStatusSnapshot;
  readonly storeBridge: ZeroStoreBridgeSnapshot;
}

export interface ZeroDiagnosticsSnapshot {
  readonly generatedAt: number;
  readonly orchestrator: OrchestratorDiagnosticsSnapshot;
  readonly recentEvents: readonly ZeroDiagnosticEventJournalEntry[];
  readonly recentRuntimeSamples: readonly ZeroRuntimeSample[];
  readonly latestRuntimeStatus: ZeroRuntimeStatusSnapshot;
  readonly latestStoreBridgeSnapshot: ZeroStoreBridgeSnapshot;
  readonly activeAlerts: readonly OrchestratorAlert[];
  readonly pendingEventQueueDepth: number;
  readonly isFlushActive: boolean;
}

export interface ZeroDiagnosticsOptions {
  thresholds?: OrchestratorDiagnosticThresholds;
  historySize?: number;
  runtimeSampleHistorySize?: number;
  eventJournalSize?: number;
  eventBridge?: ZeroEventBridge;
  storeBridge?: ZeroStoreBridge;
  runtimeStatus?: ZeroRuntimeStatus;
  autoAttachEventBridge?: boolean;
}

const DEFAULT_DIAGNOSTIC_EVENT_JOURNAL_SIZE = 512;
const DEFAULT_RUNTIME_SAMPLE_HISTORY_SIZE = 128;

export class ZeroDiagnostics {
  private readonly core: OrchestratorDiagnostics;
  private readonly eventBridge: ZeroEventBridge;
  private readonly storeBridge: ZeroStoreBridge;
  private readonly runtimeStatus: ZeroRuntimeStatus;

  private readonly eventJournal: ZeroDiagnosticEventJournalEntry[] = [];
  private readonly runtimeSamples: ZeroRuntimeSample[] = [];

  private readonly eventJournalSize: number;
  private readonly runtimeSampleHistorySize: number;

  private detachRelay: (() => void) | null = null;

  public constructor(options: ZeroDiagnosticsOptions = {}) {
    this.core = new OrchestratorDiagnostics(
      options.thresholds,
      options.historySize ?? 256,
    );
    this.eventBridge = options.eventBridge ?? zeroEventBridge;
    this.storeBridge = options.storeBridge ?? zeroStoreBridge;
    this.runtimeStatus = options.runtimeStatus ?? zeroRuntimeStatus;

    this.eventJournalSize = Math.max(
      64,
      options.eventJournalSize ?? DEFAULT_DIAGNOSTIC_EVENT_JOURNAL_SIZE,
    );
    this.runtimeSampleHistorySize = Math.max(
      32,
      options.runtimeSampleHistorySize ?? DEFAULT_RUNTIME_SAMPLE_HISTORY_SIZE,
    );

    if (options.autoAttachEventBridge !== false) {
      this.attachEventBridge();
    }
  }

  public getCoreDiagnostics(): OrchestratorDiagnostics {
    return this.core;
  }

  public attachEventBridge(): void {
    if (this.detachRelay) {
      return;
    }

    this.detachRelay = this.eventBridge.addRelayTarget({
      onEventObserved: (record) => {
        this.onObservedEvent(record);
      },
    });
  }

  public detachEventBridge(): void {
    if (this.detachRelay) {
      this.detachRelay();
      this.detachRelay = null;
    }
  }

  public onTickScheduled(
    tickIndex: number,
    scheduledDurationMs: number,
    tier: TickTier | null,
  ): void {
    this.core.onTickScheduled(tickIndex, scheduledDurationMs, tier);
  }

  public onTickStarted(): void {
    this.core.onTickStarted();
  }

  public onStepCompleted(
    step: OrchestratorStepName,
    durationMs: number,
  ): void {
    this.core.onStepCompleted(step, durationMs);
  }

  public onTierChanged(from: TickTier | null, to: TickTier): void {
    this.core.onTierChanged(from, to);
  }

  public onEventEmitted(count = 1): void {
    this.core.onEventEmitted(count);
  }

  public onDecisionWindowCountUpdated(openDecisionWindowCount: number): void {
    this.core.onDecisionWindowCountUpdated(openDecisionWindowCount);
  }

  public onFlushStarted(): void {
    this.core.onFlushStarted();
  }

  public onTickCompleted(): TickWindowSample {
    const sample = this.core.onTickCompleted();
    this.captureRuntimeSample();
    return sample;
  }

  public captureRuntimeSample(): ZeroRuntimeSample {
    const runtimeSample: ZeroRuntimeSample = {
      sampledAt: Date.now(),
      runtimeStatus: this.runtimeStatus.getSnapshot(),
      storeBridge: this.storeBridge.getSnapshot(),
    };

    this.runtimeSamples.push(runtimeSample);

    while (this.runtimeSamples.length > this.runtimeSampleHistorySize) {
      this.runtimeSamples.shift();
    }

    return runtimeSample;
  }

  public getRecentRuntimeSamples(limit = 32): readonly ZeroRuntimeSample[] {
    const safeLimit = Math.max(1, Math.trunc(limit));
    return this.runtimeSamples.slice(-safeLimit);
  }

  public getRecentEvents(limit = 128): readonly ZeroDiagnosticEventJournalEntry[] {
    const safeLimit = Math.max(1, Math.trunc(limit));
    return this.eventJournal.slice(-safeLimit);
  }

  public getSnapshot(): ZeroDiagnosticsSnapshot {
    const orchestrator = this.core.getSnapshot();
    const latestRuntimeStatus = this.runtimeStatus.getSnapshot();
    const latestStoreBridgeSnapshot = this.storeBridge.getSnapshot();

    return {
      generatedAt: Date.now(),
      orchestrator,
      recentEvents: this.getRecentEvents(),
      recentRuntimeSamples: this.getRecentRuntimeSamples(),
      latestRuntimeStatus,
      latestStoreBridgeSnapshot,
      activeAlerts: orchestrator.alerts,
      pendingEventQueueDepth: latestStoreBridgeSnapshot.eventBusPendingCount,
      isFlushActive: latestStoreBridgeSnapshot.eventBusIsFlushing,
    };
  }

  public getLastTickCompletedAtMs(): number | null {
    return this.core.getLastTickCompletedAtMs();
  }

  public clearJournals(): void {
    this.eventJournal.length = 0;
    this.runtimeSamples.length = 0;
  }

  public reset(): void {
    this.core.reset();
    this.clearJournals();
  }

  public destroy(): void {
    this.detachEventBridge();
    this.reset();
  }

  private onObservedEvent(record: ZeroObservedEventRecord): void {
    this.core.onEventEmitted(1);

    this.eventJournal.push({
      recordedAt: record.observedAt,
      sequence: record.sequence,
      eventType: record.event.eventType,
      tickIndex: record.event.tickIndex,
      sourceEngine: record.event.sourceEngine ?? null,
      payload: record.event.payload,
    });

    while (this.eventJournal.length > this.eventJournalSize) {
      this.eventJournal.shift();
    }

    switch (record.event.eventType) {
      case 'TICK_TIER_CHANGED': {
        const payload = record.event.payload as { from?: TickTier | null; to?: TickTier };
        if (payload?.to) {
          this.core.onTierChanged(payload.from ?? null, payload.to);
        }
        break;
      }

      case 'DECISION_WINDOW_OPENED':
      case 'DECISION_WINDOW_EXPIRED':
      case 'DECISION_WINDOW_RESOLVED': {
        const currentOpenWindowCount =
          this.storeBridge.getEngineStoreState().time.activeDecisionWindows.length;
        this.core.onDecisionWindowCountUpdated(currentOpenWindowCount);
        break;
      }

      case 'TICK_COMPLETE': {
        this.captureRuntimeSample();
        break;
      }

      default:
        break;
    }
  }
}

export const zeroDiagnostics = new ZeroDiagnostics();

export default zeroDiagnostics;