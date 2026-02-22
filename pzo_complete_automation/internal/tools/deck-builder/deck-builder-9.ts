interface Card {
name: string;
power: number;
}

class Deck {
private cards: Card[];

constructor(cards: Card[]) {
this.cards = cards;
}

drawCard(): Card | null {
if (this.cards.length > 0) {
const card = this.cards.pop();
return card;
}
return null;
}
}

const deck = new Deck([
{ name: "Card1", power: 1 },
{ name: "Card2", power: 2 },
{ name: "Card3", power: 3 },
{ name: "Card4", power: 4 },
{ name: "Card5", power: 5 },
{ name: "Card6", power: 6 },
{ name: "Card7", power: 7 },
{ name: "Card8", power: 8 },
{ name: "Card9", power: 9 }
]);
