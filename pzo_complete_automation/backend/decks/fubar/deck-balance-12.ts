import { Card } from './card';
import { Deck } from './deck';

class DeckBalance {
private _cardsInDeck: Card[];

constructor(public cardQuantities: number[]) {
this._cardsInDeck = this.initializeDeck();
}

private initializeDeck(): Card[] {
return this.cardQuantities.map((quantity, index) => Array(quantity).fill(new Card(index + 1)));
}

public shuffle(): void {
this._cardsInDeck = this._cardsInDeck.flat().sort(() => Math.random() - 0.5);
this._cardsInDeck = new Deck(this._cardsInDeck);
}

public drawCards(count: number): Card[] {
const drawnCards = this._cardsInDeck.drawCards(count);
if (drawnCards.length < count) {
throw new Error('Not enough cards in the deck');
}
return drawnCards;
}
}
