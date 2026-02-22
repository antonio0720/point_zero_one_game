/**
 * NeverWinAdvantageGuard service for Point Zero One Digital's financial roguelike game.
 * Ensures entitlement-gated features do not affect run outcome probability.
 */

import { EventEmitter, Subscribable } from 'events';

interface NEVER_WIN_ADVANTAGE_VIOLATION {
  timestamp: Date;
  featureId: string;
}

class NeverWinAdvantageGuard {
  private readonly events: EventEmitter = new EventEmitter();
  private readonly violations: NEVER_WIN_ADVANTAGE_VIOLATION[] = [];

  public on(eventName: 'NEVER_WIN_ADVANTAGE_VIOLATION', listener: (violation: NEVER_WIN_ADVANTAGE_VIOLATION) => void): Subscribable {
    return this.events.on(eventName, listener);
  }

  public emit(eventName: 'NEVER_WIN_ADVANTAGE_VIOLATION', violation: NEVER_WIN_ADVANTAGE_VIOLATION): boolean {
    this.violations.push(violation);
    return this.events.emit(eventName, violation);
  }

  public check(featureId: string, runOutcomeProbabilityBefore: number, runOutcomeProbabilityAfter: number): void {
    if (runOutcomeProbabilityAfter > runOutcomeProbabilityBefore) {
      this.emit('NEVER_WIN_ADVANTAGE_VIOLATION', { timestamp: new Date(), featureId });
    }
  }
}

export { NeverWinAdvantageGuard, NEVER_WIN_ADVANTAGE_VIOLATION };
