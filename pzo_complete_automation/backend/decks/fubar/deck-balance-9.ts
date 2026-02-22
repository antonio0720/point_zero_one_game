import { Card } from './card';

class Deck {
private cards: Card[] = [];

constructor(private id: string, private name: string) {}

addCard(card: Card): void {
this.cards.push(card);
}

getCards(): Card[] {
return this.cards;
}
}

class CardCollection {
private cardsByType: { [key: string]: Card[] } = {};

addCard(card: Card): void {
if (!this.cardsByType[card.type]) {
this.cardsByType[card.type] = [];
}
this.cardsByType[card.type].push(card);
}

getCardsByType(cardType: string): Card[] {
return this.cardsByType[cardType] || [];
}
}

function calculateBalance(deck: Deck, cardCollection: CardCollection): number {
const deckCards = deck.getCards();
let totalBalance = 0;

for (const card of deckCards) {
const cardsOfSameType = cardCollection.getCardsByType(card.type);
totalBalance += cardsOfSameType.reduce((sum, currentCard) => sum + currentCard.balance, 0);
}

return totalBalance;
}
