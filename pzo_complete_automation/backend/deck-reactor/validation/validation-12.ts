import { Deck } from "../models/deck";

function validateDeckReactor(deck: Deck): string | null {
const errors: string[] = [];

// Validate cards length
if (deck.cards.length < 10 || deck.cards.length > 52) {
errors.push("The number of cards should be between 10 and 52.");
}

// Validate each card's suit and rank
for (const card of deck.cards) {
const [suit, rank] = card;

if (![...SUITS, ...INVALIDS].includes(suit)) {
errors.push(`Invalid suit: ${suit}`);
}

if (!RANKS.includes(rank)) {
errors.push(`Invalid rank: ${rank}`);
}
}

// Check for duplicate cards
const cardSet = new Set<string>();
for (const card of deck.cards) {
const cardStr = `${card[0]}${card[1]}`;
if (cardSet.has(cardStr)) {
errors.push("There are duplicate cards.");
break;
}
cardSet.add(cardStr);
}

return errors.length > 0 ? errors.join("\n") : null;
}
