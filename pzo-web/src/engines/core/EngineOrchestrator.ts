// pzo-web/src/engines/core/EngineOrchestrator.ts
import { DecisionTimer } from '../time/DecisionTimer';
import type { EventBus } from '../time/DecisionTimer';

export class EngineOrchestrator {
  private decisionTimer: DecisionTimer;
  private eventBus:      EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus      = eventBus;
    this.decisionTimer = new DecisionTimer(eventBus);
    this._registerListeners();
  }

  // ── Public actions for UI layer ────────────────────────────────────────────

  onForcedCardEntersPlay(windowId: string, durationMs: number, optionCount: number): void {
    this.decisionTimer.registerDecisionWindow(windowId, durationMs, optionCount);
  }

  applyHold(windowId: string): boolean {
    return this.decisionTimer.applyHold(windowId);
  }

  resolveDecisionWindow(windowId: string, optionIndex: number): void {
    this.decisionTimer.resolveDecisionWindow(windowId, optionIndex);
  }

  onTick(tick: number): void {
    this.decisionTimer.setTick(tick);
  }

  reset(): void {
    this.decisionTimer.reset();
  }

  // ── EventBus listeners ────────────────────────────────────────────────────

  private _registerListeners(): void {
    this.eventBus.on('decision:window_opened',  (e) => this._onWindowOpened(e));
    this.eventBus.on('decision:resolved',        (e) => this._onWindowResolved(e));
    this.eventBus.on('decision:hold_applied',    (e) => this._onHoldApplied(e));
    this.eventBus.on('decision:hold_denied',     (e) => this._onHoldDenied(e));

    // T101: coalesced countdown tick — one emission per 100ms covering all active windows
    this.eventBus.on('decision:countdown_tick', (event) => {
      const e = event as { tick: number; payload: Record<string, number> };
      // Push to store — import at call site to avoid circular deps
      import('../../store/engineStore').then(({ useTimeEngineStore }) => {
        useTimeEngineStore.getState().onDecisionWindowTick(e.payload);
      });
    });
  }

  private _onWindowOpened(e: unknown): void {
    console.debug('[Orchestrator] decision:window_opened', e);
  }

  private _onWindowResolved(e: unknown): void {
    const ev = e as { payload: { windowId: string } };
    import('../../store/engineStore').then(({ useTimeEngineStore }) => {
      useTimeEngineStore.getState().clearDecisionWindowTick(ev.payload.windowId);
    });
  }

  private _onHoldApplied(e: unknown): void {
    console.debug('[Orchestrator] decision:hold_applied', e);
  }

  private _onHoldDenied(e: unknown): void {
    console.debug('[Orchestrator] decision:hold_denied', e);
  }
}

export default EngineOrchestrator;
