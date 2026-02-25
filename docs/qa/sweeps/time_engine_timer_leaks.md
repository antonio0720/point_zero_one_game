// pzo-web/src/engines/time/TickScheduler.tsx
import { useEffect, useRef } from 'react';

export class TickScheduler {
  private intervalId: number | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private rafId: number | null = null;

  constructor(private readonly intervalMs: number) {}

  start() {
    this.intervalId = window.setInterval(() => {
      // Tick logic
    }, this.intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reset() {
    this.stop();
    this.intervalId = null;
    this.timeoutHandle = null;
    this.rafId = null;
    // Recreate scheduler instance to ensure fresh state
    return new TickScheduler(this.intervalMs);
  }

  pause() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  // Additional methods...
}

// pzo-web/src/engines/time/DecisionTimer.tsx
import { useEffect, useRef } from 'react';

export class DecisionTimer {
  private timeoutHandle: NodeJS.Timeout | null = null;

  start(timeoutMs: number) {
    this.timeoutHandle = setTimeout(() => {
      // Decision logic
    }, timeoutMs);
  }

  pause() {
    if (this.timeoutHandle) {
      clearTimeout(this(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  // Additional methods...
}

// pzo-web/src/engines/time/useDecisionWindow.tsx
import { useEffect, useRef } from 'react';

export const useDecisionWindow = (callback: () => void) => {
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      callback();
    });
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [callback]);
};
