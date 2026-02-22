type Card = {
id: number;
value: string;
};

type Deck = Array<Card>;

class DeckSystem {
private decks: Deck[];

constructor() {
this.decks = Array(6).fill(null).map(() =>
Array.from({ length: 10 }, (_, i) => ({ id: i, value: `Card ${i}` }))
);
}

getDeck(index: number): Deck {
return this.decks[index];
}

drawCardFromDeck(deckIndex: number): Card | null {
if (this.decks[deckIndex].length > 0) {
const card = this.decks[deckIndex].pop();
return card;
}
return null;
}

addCardToDeck(deckIndex: number, card: Card): void {
this.decks[deckIndex].push(card);
}
}
