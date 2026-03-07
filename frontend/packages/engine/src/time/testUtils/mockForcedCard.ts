// pzo-web/src/engines/time/testUtils/mockForcedCard.ts
import { DecisionCardType } from '../common'; // Assuming this is the path to common types used in PZO_E1_TIME_T025 and T010 tasks

export const mockForcedCards = (cardTypes: Array<DecisionCardType>, durationMs?: number): void => {
  if (!durationMs) throw new Error('Duration must be provided for forced cards.');
  
  // Mock implementation of forcing a card to expire after the given time in milliseconds
  setTimeout(() => {
    consoleenerMetrics.recordForcedCardExpiry(cardTypes[0], durationMs);
  }, durationMs);
};
