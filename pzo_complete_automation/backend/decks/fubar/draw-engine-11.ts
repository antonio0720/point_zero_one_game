type Card = {
suit: string;
rank: number;
};

const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'Jack', 'Queen', 'King', 'Ace'];

function createDeck(): Card[] {
const deck: Card[] = suits.flatMap((suit) =>
ranks.map((rank) => ({ suit, rank }))
);
shuffle(deck);
return deck;
}

function shuffle<T>(array: T[]): void {
for (let i = array.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[array[i], array[j]] = [array[j], array[i]];
}
}

function drawCard(deck: Card[]): Card | null {
if (!deck.length) return null;
const card = deck.pop();
return card;
}
