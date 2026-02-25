// timeEngineTestHelpers.ts - This file will contain the helper functions for testing DecisionTimer functionality in TimeEngine class within pzo-web/src/engines/time directory.
import { createEventBus, Event } from 'pzo-utils'; // Assuming this utility is available and provides a mock event bus implementation.
import { PointZeroOneOptions } from '../options/PointZeroOneOptions'; // Importing the options for PZO game to use in tests.
import TimeEngine from './TimeEngine'; // The class we are testing, which contains DecisionTimer functionality.

export const createMockEventBus = () => {
  return new EventEmitter();
};

export const mockForcedCard = (cardId: string) => ({ cardId, isActive: false });

export const mockForcedCardWithWorstAtIndex = (worstIndex: number) => ({ worstOptionIndex: worstIndex, ...mockForcedCard('') });

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
