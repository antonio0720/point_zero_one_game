// pzo-web/src/engines/time/TimeEngine.ts (continued) - Rollback plan and notes implementation, assuming rollback functionality is part of the engine's lifecycle management system:
export class TimeEngine {
  // ... existing code from above implementations...
  
  public onTierChangeEnd(): void {
    this.tickRateInterpolator.onTierChangeBegin(); // Resetting to start a new tier change event after the end of one, if needed based on game design decisions
  }
}
