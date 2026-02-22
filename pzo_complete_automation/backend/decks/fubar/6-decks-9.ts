interface Card {
suit: string;
rank: number;
}

enum Suit {
HEARTS = '♥',
DIAMONDS = '♦',
CLUBS = '♣',
SPADES = '♠'
}

enum Rank {
TWO = 2,
THREE = 3,
FOUR = 4,
FIVE = 5,
SIX = 6,
SEVEN = 7,
EIGHT = 8,
NINE = 9,
TEN = 10,
JACK = 11,
QUEEN = 12,
KING = 13,
ACE = 14
}

class Deck {
private cards: Card[] = [];

constructor(private suit: Suit) {
for (let rank = Rank.TWO; rank <= Rank.ACE; rank++) {
this.cards.push({ suit: this.suit, rank });
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
}

class SixDecksGame {
private decks: Deck[] = [];

constructor() {
for (let suit of Object.values(Suit)) {
this.decks.push(new Deck(suit));
}
}

shuffleAll(): void {
this.decks.forEach((deck) => deck.shuffle());
}

drawCards(amount: number): Card[] | null {
const drawnCards: Card[] = [];
let totalDrawn = 0;

for (const deck of this.decks) {
const card = deck.draw();

if (card) {
drawnCards.push(card);
totalDrawn++;

if (totalDrawn >= amount) break;
}
}

return totalDrawn === amount ? drawnCards : null;
}
}
