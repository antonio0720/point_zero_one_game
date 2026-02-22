type Suit = 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs';
type Value = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'Jack' | 'Queen' | 'King' | 'Ace';

interface Card {
suit: Suit;
value: Value;
}

class Deck {
private cards: Card[];

constructor() {
this.cards = [];

for (let suit of ['Spades', 'Hearts', 'Diamonds', 'Clubs'] as Suit[]) {
for (let value of [2, 3, 4, 5, 6, 7, 8, 9, 10, 'Jack', 'Queen', 'King', 'Ace'] as Value[]) {
this.cards.push({ suit, value });
}
}
}

shuffle(): void {
for (let i = this.cards.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
}
}

draw(): Card | null {
return this.cards.length > 0 ? this.cards.pop() : null;
}

getTotalValue(): number {
let total = 0;
const faceCards = ['Jack', 'Queen', 'King'];
for (let card of this.cards) {
if (card.value === 'Ace') {
total += 11;
} else if (faceCards.includes(card.value)) {
total += 10;
} else {
total += card.value;
}
}
return Math.min(total, 21);
}
}
