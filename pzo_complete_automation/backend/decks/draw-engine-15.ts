import { Card } from "./card";

export class DrawEngine15 {
private deck: Array<Card>;

constructor(private suits: string[], private ranks: string[], private jokers: string[]) {
this.deck = [];
for (let suit of this.suits) {
for (let rank of this.ranks) {
this.deck.push(new Card(rank, suit));
}
}
this.deck = this.deck.concat(this.jokers.map(joker => new Card(joker, "Joker")));
this.shuffle();
}

private shuffle(): void {
for (let i = this.deck.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
}
}

public drawCard(): Card | null {
if (!this.deck.length) return null;
const card = this.deck.pop();
return card;
}
}
