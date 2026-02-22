import { Deck, Card } from '../card';

export class DeckBalance14 extends Deck {
constructor(private _cards: Card[]) {
super();
this.shuffle(_cards);
}

public get cards(): Card[] {
return [...this._cards];
}

public drawCard(): Card | null {
if (this.isEmpty()) return null;
const card = this._cards.pop();
this._cards.unshift(card);
return card;
}

private isEmpty(): boolean {
return this._cards.length === 0;
}
}
