import { describe, it, expect } from 'vitest';
import { Engine } from '../../../src';

describe('deck_draw_uses_compiled_templates', () => {
  it('draws N cards across 6 decks; every drawn card_id resolves to a template', async () => {
    const engine = new Engine({
      seed: 123,
      numDecks: 6,
      numCardsPerDeck: 10,
    });

    await engine.compileTemplates();

    const drawResult = await engine.draw(20);

    expect(drawResult.cards.length).toBe(20);
    for (const card of drawResult.cards) {
      expect(card.templateId).not.toBeUndefined();
    }
  });
});
