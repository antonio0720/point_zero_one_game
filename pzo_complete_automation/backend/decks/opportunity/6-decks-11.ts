interface Deck {
id: number;
cards: Card[];
}

interface Card {
suit: string;
rank: string;
}

class DeckSystem {
private decks: Deck[];

constructor() {
this.decks = [];
for (let i = 0; i < 6; i++) {
const deck: Deck = { id: i + 1, cards: [] };
this.createDeck(deck);
this.decks.push(deck);
}
}

private createDeck(deck: Deck) {
const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const ranks = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];

for (let suitIndex in suits) {
for (let rankIndex in ranks) {
deck.cards.push({ suit: suits[suitIndex], rank: ranks[rankIndex] });
}
}
}

// Additional methods like shuffleDecks, dealCard, etc. can be added here
}
