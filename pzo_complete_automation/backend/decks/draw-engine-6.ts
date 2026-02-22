```typescript
import { Deck } from './deck';

class DrawEngine {
private deck: Deck;

constructor(cardsPerDeck: number) {
this.deck = new Deck(cardsPerDeck);
}

shuffle(): void {
this.deck.shuffle();
}

drawCard(): any | null {
return this.deck.drawCard();
}
}
```

The `DrawEngine` class takes a single argument, `cardsPerDeck`, during instantiation to define the number of cards in each deck. The class features two methods: `shuffle()` and `drawCard()`.

The `shuffle()` method calls the `shuffle()` method on the internal `Deck` object, which rearranges its elements randomly.

The `drawCard()` method returns a card from the top of the deck (or null if the deck is empty).
