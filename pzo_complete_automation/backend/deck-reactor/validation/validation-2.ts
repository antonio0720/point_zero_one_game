```typescript
import { validate } from 'jsonschema';
import deckSchema from './deck-schema';

interface Deck {
id?: string;
title: string;
cards: Card[];
}

interface Card {
front: string;
back: string;
}

export function validateDeck(deck: Deck): void {
const result = validate(deck, deckSchema);

if (!result.valid) {
throw new Error(result.errors.map((e) => e.stack).join('\n'));
}
}
```

This code defines a validation function `validateDeck` that uses the `jsonschema` library to validate decks and their cards against a predefined schema (`deckSchema`). If the deck or any of its cards do not validate, an error is thrown with the corresponding error messages. The deck interface contains an optional `id` property along with the required `title` and `cards` properties. Similarly, each card has both a `front` and `back` property.
