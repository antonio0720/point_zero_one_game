class Card {
suit: string;
rank: number;

constructor(suit: string, rank: number) {
this.suit = suit;
this.rank = rank;
}
}

enum Suit {
CLUBS = "clubs",
DIAMONDS = "diamonds",
HEARTS = "hearts",
SPADES = "spades"
}

enum Rank {
2 = 2,
3 = 3,
4 = 4,
5 = 5,
6 = 6,
7 = 7,
8 = 8,
9 = 9,
10 = 10,
JACK = 11,
QUEEN = 12,
KING = 13,
ACE = 14
}

class Deck {
private cards: Card[];

constructor() {
this.cards = [];
for (let suit of Object.values(Suit)) {
for (let rank of Object.values(Rank)) {
this.cards.push(new Card(suit, rank));
}
}
}

shuffle() {
for (let i = this.cards.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
}
}

drawCard() {
if (this.cards.length === 0) return null;
return this.cards.pop();
}
}

class SixDecks {
private decks: Deck[];

constructor() {
this.decks = Array(6).fill(null).map(() => new Deck());
}

shuffleAll() {
this.decks.forEach((deck) => deck.shuffle());
}

drawCards(amount: number): Card[] | null {
const drawnCards: Card[] = [];
let totalDecksUsed = 0;

for (let i = 0; i < amount && totalDecksUsed < this.decks.length; i++) {
const deck = this.decks[totalDecksUsed];
if (!deck.cards.length) totalDecksUsed++;
else drawnCards.push(deck.drawCard());
}

return drawnCards.length === amount ? drawnCards : null;
}
}
