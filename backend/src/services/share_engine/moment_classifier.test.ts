import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MomentClassifier } from '../moment_classifier';
import { NeutralTurn, BuyTurn, SellTurn, WinTurn, LoseTurn } from '../types';

let momentClassifier: MomentClassifier;

beforeEach(() => {
  momentClassifier = new MomentClassifier();
});

afterEach(() => {
  // Reset any state or mock functions as needed for each test
});

describe('Moment Classification', () => {
  it('should correctly classify a BuyTurn', () => {
    const buyTurn: BuyTurn = {
      action: 'buy',
      asset: 'stockA',
      price: 10,
      quantity: 5,
    };

    const result = momentClassifier.classify(buyTurn);
    expect(result).toEqual({ type: 'BuyTurn', confidence: 1 });
  });

  it('should correctly classify a SellTurn', () => {
    const sellTurn: SellTurn = {
      action: 'sell',
      asset: 'stockA',
      price: 20,
      quantity: 3,
    };

    const result = momentClassifier.classify(sellTurn);
    expect(result).toEqual({ type: 'SellTurn', confidence: 1 });
  });

  it('should correctly classify a WinTurn', () => {
    const winTurn: WinTurn = {
      action: 'win',
      amount: 100,
    };

    const result = momentClassifier.classify(winTurn);
    expect(result).toEqual({ type: 'WinTurn', confidence: 1 });
  });

  it('should correctly classify a LoseTurn', () => {
    const loseTurn: LoseTurn = {
      action: 'lose',
      amount: 50,
    };

    const result = momentClassifier.classify(loseTurn);
    expect(result).toEqual({ type: 'LoseTurn', confidence: 1 });
  });

  it('should correctly classify a NeutralTurn with no actions', () => {
    const neutralTurn: NeutralTurn = { action: '' };

    const result = momentClassifier.classify(neutralTurn);
    expect(result).toEqual({ type: 'NeutralTurn', confidence: 1 });
  });

  it('should correctly classify a NeutralTurn with no actions and no assets', () => {
    const neutralTurn: NeutralTurn = { action: '', asset: '' };

    const result = momentClassifier.classify(neutralTurn);
    expect(result).toEqual({ type: 'NeutralTurn', confidence: 1 });
  });

  it('should not classify a NeutralTurn as any other turn type on neutral turns', () => {
    const neutralTurn: NeutralTurn = { action: '', asset: '' };

    const result = momentClassifier.classify(neutralTurn);
    expect(result).toEqual({ type: 'NeutralTurn', confidence: 1 });
  });

  it('should correctly classify edge cases and boundary conditions', () => {
    // Add more specific test cases for edge cases and boundary conditions here
  });
});
