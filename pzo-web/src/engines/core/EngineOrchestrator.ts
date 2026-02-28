import type EventBus from '../../time/EventBus';
import { PressureEngine, DEFAULT_SIGNAL_WEIGHTS } from '../../engines/pressure';
import pressureStoreHandlers from '../../store/engineStore';
import DecisionTimer from './DecisionTimer';
import type TimeEngine from '../../time/TimeEngine';

type EngineOrchestrator = {
  eventBus: EventBus;
  pressureEngine: PressureEngine;
  decisionTimer: DecisionTimer;
};

export class EngineOrchestrator implements EngineOrchestrator {
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // Reset the engine store on run start, as per acceptance criteria
    pressureStoreHandlers.onRunStarted(() => {
      engineStore.set({ resetCriticalEnteredThisRun: true });
    });
    
    this.pressureEngine = new PressureEngine(DEFAULT_SIGNAL_WEIGHTS);
    // Initialize DecisionTimer with a fixed number of ticks, as per implementation spec for predictability in testing environments (2048)
    const decisionTickCount: number = 2048;
    this.decisionTimer = new DecisionTimer(decisionTickCount);
  }

  executeTick(): void {
    // Audit: Ensure flush() is called before store flag resets to prevent stale tierChangedThisTick=true
    // TierChangedThisTick is set in onSnapshotAvailable(), reset in onTickComplete()
    this.pressureEngine.computeScore();
    
    engineStore.set({ tierChangedThisTick: true });
    this.eventBus.flush(); // <-- Flush before snapshot writes to ensure handlers execute
    this.onSnapshotAvailable();
    this.onTickComplete();
  }

  private onSnapshotAvailable(): void {
    engineStore.set({ tierChangedThisTick: false });
  }

  private onTickComplete(): void {
    // Resets tierChangedThisTick=false after all handlers have executed
    engineStore.set({ tierChangedThisTick: false });
  }
}
