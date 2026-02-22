interface Card {
name: string;
cost: number;
effect?: () => void;
}

class Deck {
private cards: Card[];

constructor() {
this.cards = [];
}

addCard(card: Card) {
this.cards.push(card);
}

play() {
for (const card of this.cards) {
if (card.cost <= this.mana) {
this.playCard(card);
this.mana -= card.cost;
}
}
}

private playCard(card: Card) {
if (card.effect) {
card.effect();
}
}

get mana() {
return this._mana;
}

set mana(value: number) {
this._mana = value;
}

private _mana = 0;
}

const myCard: Card = {
name: 'Fireball',
cost: 3,
effect: () => console.log('Deal 5 damage!')
};

const myDeck = new Deck();
myDeck.addCard(myCard);
myDeck.mana = 6;
myDeck.play();
