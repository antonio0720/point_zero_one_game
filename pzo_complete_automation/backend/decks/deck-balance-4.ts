import { Card } from "./card";

export class BalancedDeck {
private cards: Map<string, number>;

constructor(private maxCardCount: number) {
this.cards = new Map();
}

addCard(card: Card): void {
const cardId = card.id;
if (this.cards.has(cardId)) {
throw new Error("Duplicate card encountered");
}
if (this.cards.size >= this.maxCardCount) {
throw new Error("Maximum deck capacity exceeded");
}
this.cards.set(cardId, 1);
}

hasCard(card: Card): boolean {
return this.cards.has(card.id);
}

getNumberOfCards(): number {
return this.cards.size;
}
}
