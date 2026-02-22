import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SentimentAnalyzer } from '../sentiment_analyzer';

let sentimentAnalyzer: SentimentAnalyzer;
const balanceBudget = 100;

beforeEach(() => {
  sentimentAnalyzer = new SentimentAnalyzer();
});

afterEach(() => {
  // Ensure no message content is stored between tests
  jest.clearAllMocks();
});

describe('Sentiment Analyzer', () => {
  it('should return no adjustment for neutral sentiment', () => {
    const message = 'This is a neutral message';
    const adjustment = sentimentAnalyzer.analyze(message);
    expect(adjustment).toBe(0);
  });

  it('should cap adjustments at ±20%', () => {
    const positiveMessage = 'This is an extremely positive message';
    const negativeMessage = 'This is an extremely negative message';

    // Positive message should not exceed +20%
    const positiveAdjustment = sentimentAnalyzer.analyze(positiveMessage);
    expect(positiveAdjustment).toBeLessThanOrEqual(20);

    // Negative message should not exceed -20%
    const negativeAdjustment = sentimentAnalyzer.analyze(negativeMessage);
    expect(negativeAdjustment).toBeLessThanOrEqual(-20);
  });

  it('should trigger trap for overconfident messages', () => {
    const overconfidentMessage = 'This message is 100% positive';
    const adjustment = sentimentAnalyzer.analyze(overconfidentMessage);
    expect(adjustment).toBe(-20); // Overconfident messages should be capped at -20%
  });

  it('should ensure all adjustments are within balance budget', () => {
    const veryPositiveMessage = 'This message is extremely positive';
    const veryNegativeMessage = 'This message is extremely negative';

    // Analyze a very positive message multiple times to ensure the budget isn't exceeded
    for (let i = 0; i < balanceBudget / 20; i++) {
      const adjustment = sentimentAnalyzer.analyze(veryPositiveMessage);
      expect(adjustment).toBeLessThanOrEqual(20);
    }

    // Analyze a very negative message multiple times to ensure the budget isn't exceeded
    for (let i = 0; i < balanceBudget / 20; i++) {
      const adjustment = sentimentAnalyzer.analyze(veryNegativeMessage);
      expect(adjustment).toBeLessThanOrEqual(-20);
    }
  });
});
