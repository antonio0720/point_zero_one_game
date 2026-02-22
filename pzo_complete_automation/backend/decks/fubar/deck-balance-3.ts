const deck: Deck = {
cards: [
{ id: 1, points: 3 },
{ id: 2, points: 4 },
{ id: 3, points: 3 },
{ id: 4, points: 5 },
{ id: 5, points: 2 }
],
currentCardIndex: 0
};

const deckBalance = DeckBalance.getInstance(deck);
console.log(deckBalance.isBalanced()); // true
