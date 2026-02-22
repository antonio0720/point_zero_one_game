import { shuffleArray } from './utils';

type Card = {
id: string;
name: string;
};

type Deck = Array<Card>;

export class DrawEngine7 {
private deck: Deck;
private drawnCards: Set<string> = new Set();

constructor(cards: Array<Card>) {
this.deck = [...cards, ...shuffleArray(cards)];
}

public draw(): Card | null {
if (this.deck.length === 0) return null;

const randomIndex = Math.floor(Math.random() * this.deck.length);
const card = this.deck[randomIndex];

// Check if the same card has been drawn three times consecutively
if (this.drawnCards.size >= 3 && this.drawnCards.has(card.id)) {
// Remove the last three cards from the deck and shuffle them back in
const lastThreeCards = Array.from(this.drawnCards).slice(-3);
this.deck = this.deck.filter((c) => !lastThreeCards.includes(c.id));
this.deck = [...shuffleArray(this.deck), ...lastThreeCards];
}

this.drawnCards.add(card.id);
return card;
}
}
