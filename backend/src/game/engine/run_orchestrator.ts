/**
 * RunOrchestrator manages the run lifecycle from CREATE through FINALIZE, coordinates engine + event store + replay, enforces turn time limits, handles disconnects.
 */

import { Engine } from './engine';
import { EventStore } from './event_store';
import { Replay } from './replay';

export interface RunOrchestratorOptions {
  /** The maximum number of milliseconds per turn. */
  turnTimeLimit: number;
}

export class RunOrchestrator {
  private engine: Engine;
  private eventStore: EventStore;
  private replay: Replay;
  private turnTimeLimit: number;
  private currentRunId: string | null = null;

  constructor(options: RunOrchestratorOptions) {
    this.turnTimeLimit = options.turnTimeLimit;
  }

  public async createRun(): Promise<void> {
    // ... (Implementation details omitted for brevity)
  }

  public async startRun(runId: string): Promise<void> {
    // ... (Implementation details omitted for brevity)
  }

  public async advanceTurn(): Promise<void> {
    // ... (Implementation details omitted for brevity)
  }

  public async finalizeRun(runId: string): Promise<void> {
    // ... (Implementation details omitted for brevity)
  }

  public async disconnect(): Promise<void> {
    // ... (Implementation details omitted for brevity)
  }
}
