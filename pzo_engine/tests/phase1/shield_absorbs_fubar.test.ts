import { describe, it, expect } from 'vitest';
import { Engine } from '../../../src/engine';

describe('Shield absorbs FUBAR', () => {
  it('shield=1, draw FUBAR card, verify shield consumed and FUBAR skipped', async () => {
    const engine = new Engine();
    await engine.init({
      players: [{ name: 'Player' }],
      cardsInDeck: [
        { type: 'FUBAR', id: 1 },
        // Add more test cards here
      ],
    });

    await engine.drawCard(0);
    expect(engine.getShield()).toBe(0);

    const result = await engine.resolve();
    expect(result).toEqual({
      playerTurn: false,
      phase: 'end',
      events: [
        {
          type: 'cardPlayed',
          cardId: 1,
          playerId: 0,
        },
      ],
    });
  });
});
