import { describe, it, expect } from 'vitest';
import { Game } from '../../../src/game/Game';
import { Player } from '../../../src/player/Player';

describe('M09a regret card generates on missed +EV deal', () => {
  it('player passes deal with EV > 0 → regret card stamped with delta amount', async () => {
    const game = new Game();
    const player = new Player(game);
    const deal = { id: 'deal-1', ev: 10, bet: 100 };
    await game.addDeal(deal);

    // Pass the deal
    await player.passDeal(deal.id);

    // Get the regret card
    const regretCard = await player.getRegretCard();

    // Check that the regret card has been stamped with the delta amount
    expect(regretCard.deltaAmount).toBe(10);
  });
});
