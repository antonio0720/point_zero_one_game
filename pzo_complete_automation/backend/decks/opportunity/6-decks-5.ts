interface Card {
id: number;
value: string;
}

interface Deck {
id: number;
name: string;
cards: Card[];
}

class DeckSystem {
private decks: Deck[] = [];

constructor(decks: Deck[]) {
this.decks = decks;
}

public getDecks(): Deck[] {
return [...this.decks];
}

public drawCardFromDeck(deckId: number): Card | null {
const deck = this.decks.find((deck) => deck.id === deckId);

if (!deck || deck.cards.length === 0) {
return null;
}

const drawnCard = deck.cards.pop();
return drawnCard;
}

public shuffleDeck(deckId: number): void {
const deck = this.decks.find((deck) => deck.id === deckId);

if (!deck) {
return;
}

for (let i = deck.cards.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[deck.cards[i], deck.cards[j]] = [deck.cards[j], deck.cards[i]];
}
}
}

const decks: Deck[] = [
{ id: 1, name: 'Deck 1', cards: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, value: `Card ${i + 1}` })) },
// ... repeat for other decks with a different ID and unique card values
];

const deckSystem = new DeckSystem(decks);
