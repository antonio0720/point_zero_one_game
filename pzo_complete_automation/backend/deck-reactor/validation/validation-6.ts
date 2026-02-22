import { ValidatorFn, AbstractControl } from '@angular/forms';

interface Deck {
id?: number;
name: string;
description?: string;
cards: Card[];
}

interface Card {
id?: number;
question: string;
answer: string;
}

const deckValidator: ValidatorFn = (control: AbstractControl): { [key: string]: any } | null => {
const deck = control.value as Deck;

if (!Array.isArray(deck.cards)) {
return { 'deck.cards': { type: 'array' } };
}

for (const card of deck.cards) {
if (typeof card !== 'object' || !('question' in card && typeof card.question === 'string' && 'answer' in card && typeof card.answer === 'string')) {
return { 'deck.cards': { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } };
}
}

return null;
};

export { deckValidator, Deck, Card };
