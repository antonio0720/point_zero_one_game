type Card = { suit: string; rank: number };

const decks: Array<Array<Card>> = [];

for (let deckNum = 0; deckNum < 6; deckNum++) {
const deck: Array<Card> = [];

// Assuming a standard deck of cards with 4 suits and 13 ranks.
const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const ranks = Array.from({ length: 13 }, (_, index) => index + 1);

for (let suitIndex = 0; suitIndex < suits.length; suitIndex++) {
for (let rankIndex = 0; rankIndex < ranks.length; rankIndex++) {
deck.push({ suit: suits[suitIndex], rank: ranks[rankIndex] });
}
}

decks.push(deck);
}

// Shuffle a single deck as an example
function shuffleDeck(deck: Array<Card>): void {
for (let i = deck.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[deck[i], deck[j]] = [deck[j], deck[i]];
}
}

shuffleDeck(decks[0]);
