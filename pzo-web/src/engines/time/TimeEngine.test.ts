// pzo-web/src/engines/time/TimeEngine.test.ts (or create this file if it does not exist)
import { TimeEngine } from './TimeEngine'; // Adjust the import path as necessary based on your project structure
import React, { useEffect, useState } from 'react';
import '@testing-library/jest-dom';

describe('Add SeasonClock tests for default multiplier 1.0 and overlapping windows', () => {
    let timeEngine: TimeEngine;
    const seasonStart = new Date(); // Mock start of a season, adjust as needed
    const seasonEnd = new Date(seasonStart); // Start end date at the same moment for simplicity in this example
    
    beforeEach(() => {
        jest.useFakeTimers().setImmediate(); // Set up fake timers to simulate time passing without real delay
        timeEngine = new TimeEngine();
        const seasonClock = timeEngine.addSeasonClock('Spring', [seasonStart, seasonEnd]);
        
        expect(timeEngine.getPressureMultiplier()).toBe(1); // Season is not active yet so multiplier should be 1
    });
    
    afterEach(() => {
        jest.useRealTimers(); // Reset timers to real-world time for the next test case
        expect(timeEngine).not.toHaveProperty('activeSeasons'); // Ensure no active seasons remain from previous tests
    });

    it('should return pressure multiplier 1.0 when season is not active', () => {
        const start = new Date();
        timeEngine.setTime(start);
        
        expect(timeEngine.getPressureMultiplier()).toBe(1); // No overlapping seasons, so the default should be multiplier 1
  });
});
