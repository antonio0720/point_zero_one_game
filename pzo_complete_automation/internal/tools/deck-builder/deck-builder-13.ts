type Card = {
suit: string;
value: number;
};

const CARDS_COUNT = 52;
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
const VALUES = Array.from({ length: 13 }, (_, i) => i + 1);

function createCards(): Card[] {
return SUITS.flatMap((suit) =>
VALUES.map((value) => ({ suit, value }))
);
}

function shuffleDeck(deck: Card[]): void {
for (let i = deck.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[deck[i], deck[j]] = [deck[j], deck[i]];
}
}

function main(): void {
const deck = createCards();
shuffleDeck(deck);
console.log(JSON.stringify(deck, null, 2));
}

main();
