```typescript
import { Card } from './card';

export class Deck {
private cards: Card[] = [];

constructor(private suitCount: number, private rankCount: number) {
for (let suit = 1; suit <= this.suitCount; suit++) {
for (let rank = 1; rank <= this.rankCount; rank++) {
const card = new Card(rank, suit);
this.cards.push(card);
}
}
}

public shuffle(): void {
for (let i = this.cards.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
}
}

public deal(): Card | null {
if (this.cards.length > 0) {
return this.cards.pop();
} else {
return null;
}
}
}
```

The `Card` class is not provided in the code snippet, but it would contain the necessary properties and methods to represent a card in your game. You can assume that it implements the required functionality for suit, rank, etc.

In this example, the deck consists of a given number of suits (suitCount) and ranks (rankCount). Each deck contains the same number of cards for each suit and rank combination. The `shuffle` function randomizes the order of the cards in the deck before dealing them, while the `deal` function returns and removes one card from the top of the deck or null if no more cards remain.
