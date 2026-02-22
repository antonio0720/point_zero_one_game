import { Shuffle } from 'random-shuffle';

class Deck {
private cards: any[];

constructor(cards: any[]) {
this.cards = cards;
}

drawCard(): any | null {
if (this.cards.length === 0) return null;
const drawnCard = this.cards.pop();
return drawnCard;
}

shuffle() {
Shuffle(this.cards);
}
}

export class DrawEngine10 {
private deck: Deck;
private drawnCards: any[];

constructor(deck: Deck) {
this.deck = deck;
this.drawnCards = [];
}

draw() {
if (this.drawnCards.length >= 10) return this.drawnCards;

for (let i = 0; i < 10; i++) {
const card = this.deck.drawCard();
if (!card) break;
this.drawnCards.push(card);
}

if (this.drawnCards.length < 10) {
this.shuffle(this.deck.cards);
for (let i = 0; i < (10 - this.drawnCards.length); i++) {
const card = this.deck.drawCard();
if (!card) break;
this.drawnCards.push(card);
}
}

return this.drawnCards;
}

shuffle() {
this.deck.shuffle();
}
}
