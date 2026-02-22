Here's a TypeScript implementation of a draw engine for a deck system in a file named `draw-engine-2.ts`. This is a simplified version and may need adjustments based on your specific project requirements.

```typescript
import { Deck, Card } from "./deck";

interface DrawEngineOptions {
maxCardsToDraw?: number;
}

class DrawEngine {
private deck: Deck;
private options: DrawEngineOptions;

constructor(deck: Deck, options: DrawEngineOptions = {}) {
this.deck = deck;
this.options = options;
}

public drawCards(amount: number): Card[] | undefined {
const cardsToDraw = Array.from({ length: amount }, () => this.deck.drawCard());
return cardsToDraw.filter((card) => !!card);
}

public shuffleDeck(): void {
this.deck.shuffle();
}

public getRemainingCardsCount(): number {
return this.deck.getSize() - this.deck.getCardsInDeck().length;
}
}
```

The `DrawEngine` class takes a deck and an optional configuration object as parameters. It provides methods to draw cards, shuffle the deck, and get the remaining card count. The `drawCards` method returns an array of drawn cards or undefined if there are no more cards in the deck. By default, it draws as many cards as possible from the deck.

In your project, make sure to import this file and instantiate a `DrawEngine` with a suitable deck implementation (e.g., `ArrayDeck`, `LinkedListDeck`, etc.). The `DrawEngineOptions` can be used to configure the maximum number of cards to draw at once or other custom options as needed for your project.
