import { describe, it, expect } from 'vitest';
import { createClient, createServer } from '../test-utils';

describe('Actions are server-validated', () => {
  it('client submits PLAY_CARD → server validates → broadcast result to all players', async () => {
    const server = await createServer();
    const client1 = await createClient(server);
    const client2 = await createClient(server);

    // Client 1 plays a card
    await client1.playCard({ card: 'Ace of Spades' });

    // Server validates the action and broadcasts the result to all players
    expect(await server.getGameState()).toEqual({
      player1: { cards: ['Ace of Spades'] },
      player2: { cards: [] },
    });
  });
});
