/**
 * Stage Timer Scheduler Service
 */

import { EventEmitter, Output } from '@angular/core';
import { IStageTimer, IDefaultOutcome } from '../interfaces';

export interface IStageTimerScheduler {
  start(): void;
  stop(): void;
  schedule(stageTimer: IStageTimer): void;
}

/**
 * Stage Timer Scheduler implementation
 */
export class StageTimerScheduler implements IStageTimerScheduler {
  private timers: Map<number, NodeJS.Timeout>;
  private defaultOutcomes: IDefaultOutcome[];
  private timerEvent = new EventEmitter<IStageTimer>();

  constructor() {
    this.timers = new Map();
    this.defaultOutcomes = []; // Load default outcomes from a persistent storage or configuration
  }

  /**
   * Start the stage timer scheduler
   */
  start(): void {
    // Implement logic to start the scheduler, potentially using an async loop
  }

  /**
   * Stop the stage timer scheduler
   */
  stop(): void {
    // Implement logic to stop the scheduler, clearing all timers
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  /**
   * Schedule a stage timer
   * @param stageTimer The stage timer to schedule
   */
  schedule(stageTimer: IStageTimer): void {
    // Implement logic to schedule the given stage timer, adding it to the timers map and setting up the timeout
    const timerId = setTimeout(() => {
      this.timerEvent.emit(stageTimer);
    }, stageTimer.duration);
    this.timers.set(stageTimer.id, timerId);
  }

  /**
   * Event emitted when a stage times out
   */
  @Output()
  get onStageTimeout(): EventEmitter<IStageTimer> {
    return this.timerEvent;
  }
}
