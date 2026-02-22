export class Deck {
private cards: string[];

constructor(cards: string[]) {
this.cards = cards;
}

public get length(): number {
return this.cards.length;
}

public push(card: string): void {
this.cards.push(card);
}

public pop(): string | null {
const card = this.cards[this.cards.length - 1];
if (!card) return null;
this.cards.pop();
return card;
}
}
