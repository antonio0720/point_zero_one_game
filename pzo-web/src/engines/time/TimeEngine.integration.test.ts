import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { TimeEngine } from '../engines/time/TimeEngine';
import { TimeWindow } from '../models/TimeWindow';

describe('Edge Cases & Hardening', () => {
  let timeEngine: TimeEngine;
  let window1: TimeWindow;
  let window2: TimeWindow;

  beforeEach(() => {
    timeEngine = new TimeEngine();
    window1 = new TimeWindow({ duration: 10 });
    window2 = new TimeWindow({ duration: 10 });
  });

  afterEach(() => {
    jest.clearAllMocks();
    timeEngine = null;
    window1 = null;
    window2 = null;
  });

  describe('Concurrent Forced Card Stress Test', () => {
    it('should allow two windows to count down independently with hold on one', async () => {
      // Start both windows
      await window1.start();
      await window2.start();

      // Simulate time passing to ensure countdown is active
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Apply hold to window1
      await window1.applyHold();

      // Verify window1 is paused, window2 is active
      expect(window1.isPaused()).toBe(true);
      expect(window2.isPaused()).toBe(false);

      // Attempt to apply hold to window2 should fail
      await expect(window2.applyHold()).rejects.toThrow('Hold already active');

      // Release hold on window1
      await window1.releaseHold();

      // Verify window1 resumes
      expect(window1.isPaused()).toBe(false);

      // Wait for countdown to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify both windows have expired
      expect(window1.hasExpired()).toBe(true);
      expect(window2.hasExpired()).toBe(true);
    });

    it('should prevent multiple holds across windows', async () => {
      // Start both windows
      await window1.start();
      await window2.start();

      // Apply hold to window1
      await window1.applyHold();

      // Attempt to apply hold to window2 should fail
      await expect(window2.applyHold()).rejects.toThrow('Hold already active');

      // Release hold on window1
      await window1.releaseHold();

      // Apply hold to window2
      await window2.applyHold();

      // Attempt to apply hold to window1 should fail
      await expect(window1.applyHold()).rejects.toThrow('Hold already active');
    });
  });
});
