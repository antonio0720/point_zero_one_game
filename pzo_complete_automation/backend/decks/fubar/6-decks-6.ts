class Deck {
private cards: number[] = Array(52).fill(0);
private index: number = 0;

constructor(private id: string) {}

public dealCard(): number | null {
if (this.index >= this.cards.length) return null;
const card = this.cards[this.index];
this.index++;
return card;
}

public shuffle() {
for (let i = this.cards.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
}
this.index = 0;
}
}

class DeckManager {
private decks: Deck[] = Array(6).fill(null).map(() => new Deck(`deck-${Math.floor(Math.random() * 100)}`));

public dealCardFromAllDecks(): number | null {
for (const deck of this.decks) {
const card = deck.dealCard();
if (card !== null) return card;
}
return null;
}

public shuffleAll() {
for (const deck of this.decks) {
deck.shuffle();
}
}
}
