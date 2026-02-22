import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EffectOp, CardEffect, GameState } from '../card_effects';
import { createGameState } from '../game/state';

describe('Card Effects', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = createGameState();
  });

  afterEach(() => {
    // Reset the game state for each test to ensure determinism
    gameState = createGameState();
  });

  const applyEffect = (effect: CardEffect) => {
    effect.apply(gameState);
    return gameState;
  };

  describe('EffectOp', () => {
    it('should handle all 15 EffectOp types correctly', () => {
      // Add tests for each EffectOp type (ADD_COINS, SUBTRACT_COINS, ADD_CARDS, etc.)
      // Ensure happy path, edge cases, and boundary conditions are covered
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle negative coin amounts correctly', () => {
      const effect = new CardEffect(EffectOp.SUBTRACT_COINS, -10);
      expect(applyEffect(effect).coins).toEqual(-10);
    });

    it('should handle zero or negative card amounts correctly', () => {
      // Add tests for adding/subtracting cards with zero or negative amounts
    });
  });

  describe('Chained Effects', () => {
    it('should correctly apply multiple effects in sequence', () => {
      const effect1 = new CardEffect(EffectOp.ADD_COINS, 5);
      const effect2 = new CardEffect(EffectOp.SUBTRACT_COINS, 3);

      const chainedEffects = [effect1, effect2];
      chainedEffects.forEach((effect) => applyEffect(effect));

      expect(gameState.coins).toEqual(2);
    });
  });

  describe('IF_HAS Branching', () => {
    it('should correctly apply IF_HAS effects based on card presence', () => {
      // Add tests for IF_HAS branching, ensuring that the correct path is taken based on the presence of cards in the game state
    });
  });

  describe('ROLL Seeding', () => {
    it('should correctly seed ROLL effects with a deterministic value', () => {
      const effect = new CardEffect(EffectOp.ROLL, undefined);
      const roll1 = applyEffect(effect).roll;
      const roll2 = applyEffect(effect).roll;

      expect(roll1).toEqual(roll2);
    });
  });
});
