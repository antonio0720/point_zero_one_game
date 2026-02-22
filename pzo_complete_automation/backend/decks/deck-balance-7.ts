import { v4 as uuidv4 } from 'uuid';

enum Suit {
Clubs,
Diamonds,
Hearts,
Spades,
RedJokers,
BlackJokers,
WildCard
}

interface Card {
suit: Suit;
value: number;
}

class Deck {
private cards: Card[];

constructor() {
this.cards = [...Array(52)].map((_, i) => ({
suit: i % 4 !== 0 ? (i < 12 ? Suit.Clubs : (i < 28 ? Suit.Diamonds : (i < 44 ? Suit.Hearts : Suit.Spades)) as Suit) : (i < 36 ? Suit.RedJokers : Suit.BlackJokers),
value: Math.floor((i + 1) / 4)
}));
}

shuffle(): void {
for (let i = this.cards.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
}
}

deal(): Card[] {
this.shuffle();
return this.cards.splice(0, 26);
}
}

const deck = new Deck();
export function drawCards(numberOfDeals: number): Card[][] {
const dealtCards: Card[][] = [];
for (let i = 0; i < numberOfDeals; i++) {
dealtCards.push(deck.deal());
}
return dealtCards;
}
