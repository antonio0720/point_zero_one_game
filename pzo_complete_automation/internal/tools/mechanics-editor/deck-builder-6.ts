import { DeckBuilder } from './deck-builder';
import { Card } from './card';
import { Deck } from './deck';
import { Shuffler } from './shuffler';

class CardSet {
private cards: Card[];

constructor(private name: string) {}

addCard(card: Card): void {
this.cards.push(card);
}

getCards(): Card[] {
return this.cards;
}
}

class DeckBuilder6 implements DeckBuilder {
private cardSets: Map<string, CardSet> = new Map();

addCardSet(name: string): void {
if (this.cardSets.has(name)) {
throw new Error(`Card set "${name}" already exists.`);
}
this.cardSets.set(name, new CardSet(name));
}

addCardToSet(setName: string, card: Card): void {
const set = this.cardSets.get(setName);
if (!set) {
throw new Error(`Card set "${setName}" does not exist.`);
}
set.addCard(card);
}

buildDeck(deckName: string): Deck {
const cards = Array.from(this.cardSets.values()).reduce((acc, set) => [...acc, ...set.getCards()], []);
return new Deck(deckName, new Shuffler().shuffle(cards));
}
}
