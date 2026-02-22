class Card {
suit: string;
rank: string;

constructor(suit: string, rank: string) {
this.suit = suit;
this.rank = rank;
}
}

class Deck {
private cards: Card[];

constructor() {
this.cards = [];
const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const ranks = Array.from({ length: 13 }, (_, i) => String.fromCharCode(65 + i));

for (const suit of suits) {
for (const rank of ranks) {
this.cards.push(new Card(suit, rank));
}
}
}

shuffle(): void {
for (let i = this.cards.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
}
}

drawCard(): Card | null {
return this.cards.length > 0 ? this.cards.pop() : null;
}
}

const decks: Deck[] = Array.from({ length: 6 }, () => new Deck());
