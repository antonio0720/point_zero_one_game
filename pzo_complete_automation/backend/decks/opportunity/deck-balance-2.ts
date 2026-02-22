import { Card } from '../card';

export class DeckBalanceTwo {
private cards: Card[];

constructor(initialCards: Card[]) {
this.cards = [...initialCards];
this.shuffleDeck();
}

public drawCard(): Card | null {
return this.cards.length > 0 ? this.cards.pop() : null;
}

public addCard(card: Card): void {
this.cards.push(card);
}

private shuffleDeck(): void {
for (let i = this.cards.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
}
}
}
