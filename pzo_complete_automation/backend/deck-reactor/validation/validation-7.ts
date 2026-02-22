type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'jack' | 'queen' | 'king' | 'ace';

interface Card {
suit: Suit;
rank: Rank;
}

type Deck = Array<Card>;

function validateDeck(deck: Deck): deck is ValidDeck {
if (!Array.isArray(deck)) {
throw new Error('Invalid deck structure');
}

if (deck.length !== 52) {
throw new Error('Incorrect number of cards in the deck');
}

const suits = new Set<Suit>();
const ranks = new Set<Rank>();

for (const card of deck) {
if (!Object.values(Card).includes(card)) {
throw new Error('Invalid card structure');
}

if (!suits.add(card.suit)) {
throw new Error('Duplicate suit found in the deck');
}

if (!ranks.add(card.rank)) {
throw new Error('Duplicate rank found in the deck');
}
}

return true;
}

interface ValidDeck extends Deck {}
